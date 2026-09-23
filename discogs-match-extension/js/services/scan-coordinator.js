/**
 * Vinyl Stock Manager • Scan Coordinator Service (js/services/scan-coordinator.js)
 * Orchestrates marketplace scanning, wantlist synchronization, batch concurrency,
 * throttling, and session resumption. Communicates via AppStore events (PubSub).
 * Fully decoupled from direct DOM manipulation.
 */

(function(global) {
  'use strict';

  class ScanCoordinator {
    constructor(options = {}) {
      this.store = options.store || global.appStore;
      this.apiClient = options.apiClient || global.ApiClient;
      this.cacheRepo = options.cacheRepo || global.CacheRepository;
      this.parser = options.parser || global.DiscogsParser;
      this.shippingEngine = options.shippingEngine || global.ShippingEngine;

      this.isScanning = false;
      this.cancelRequested = false;
      this.liveScannedCount = 0;
      this.currentBatchSize = 3;
      this.cooldownItemsLeft = 0;
    }

    getEvents() {
      return global.AppEvents || {
        SCAN_START: 'scan:start',
        SCAN_PROGRESS: 'scan:progress',
        SCAN_ITEM_DONE: 'scan:item_done',
        SCAN_COMPLETED: 'scan:completed',
        SCAN_CANCELLED: 'scan:cancelled',
        SCAN_ERROR: 'scan:error',
        SELLERS_UPDATED: 'sellers:updated',
        WANTS_LOADED: 'wants:loaded'
      };
    }

    emit(event, payload) {
      if (this.store && typeof this.store.emit === 'function') {
        this.store.emit(event, payload);
      }
    }

    /**
     * Loads wantlist using Discogs API client or fallback HTML scraping.
     */
    async loadWantlist(username) {
      const cleanUser = (username || '').trim();
      if (!cleanUser) {
        throw new Error('Nombre de usuario de Discogs no especificado');
      }

      const events = this.getEvents();
      let loadedWants = [];

      // 1. Try official authenticated API endpoint via DiscogsApiClient
      try {
        let page = 1;
        let totalPages = 1;

        do {
          const data = await this.apiClient.fetchWantlistPage(cleanUser, page, 100);
          if (data && Array.isArray(data.wants)) {
            const pageWants = data.wants.map(item => ({
              id: item.id || (item.basic_information && item.basic_information.id),
              title: item.basic_information?.title || `Disco #${item.id}`,
              artist: (item.basic_information?.artists || []).map(a => a.name).join(', ') || 'Desconocido',
              year: item.basic_information?.year || '',
              image: this.parser.upgradeDiscogsImageUrl(item.basic_information?.cover_image || item.basic_information?.thumb || ''),
              wantCount: (item.basic_information?.community && (item.basic_information.community.want || item.basic_information.community.in_wantlist)) || 0,
              haveCount: (item.basic_information?.community && item.basic_information.community.have) || 0,
              forSaleCount: (item.basic_information && (item.basic_information.num_for_sale || item.basic_information.numForSale)) || item.num_for_sale || 0
            }));

            loadedWants.push(...pageWants);
            totalPages = data.pagination?.pages || 1;
            page++;

            if (page <= totalPages) {
              await new Promise(r => setTimeout(r, 1000));
            }
          } else {
            break;
          }
        } while (page <= totalPages);
      } catch (apiErr) {
        console.warn('[ScanCoordinator] Falló fetch Wantlist vía API, intentando scraping:', apiErr.message);

        // 2. Fallback: Scraping HTML
        let page = 1;
        let hasMore = true;
        const seenIds = new Set();
        loadedWants = [];

        do {
          const candidateUrls = [
            `https://www.discogs.com/wantlist?user=${encodeURIComponent(cleanUser)}&limit=100&page=${page}`,
            `https://www.discogs.com/users/${encodeURIComponent(cleanUser)}/wants?limit=100&page=${page}`
          ];

          let html = '';
          for (const url of candidateUrls) {
            try {
              if (typeof global.fetchThroughTab === 'function') {
                html = await global.fetchThroughTab(url);
              } else if (typeof global.fetchDirect === 'function') {
                html = await global.fetchDirect(url);
              }
              if (html && html.length > 500 && !html.includes('HTTP Error 404')) {
                break;
              }
            } catch (err) {}
          }

          if (html && (html.includes('is private') || html.includes('es privada'))) {
            throw new Error('La lista de deseos es privada en Discogs. Cámbiala a Pública.');
          }

          const parsedItems = this.parser.parseWantlistHTML(html);
          let added = 0;
          if (parsedItems.length > 0) {
            parsedItems.forEach(item => {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                loadedWants.push(item);
                added++;
              }
            });
            if (added === 0) hasMore = false;
            else {
              page++;
              await new Promise(r => setTimeout(r, 600));
            }
          } else {
            hasMore = false;
          }
        } while (hasMore && page <= 50);
      }

      if (loadedWants.length === 0) {
        throw new Error('No se encontraron vinilos en la Wantlist de este usuario.');
      }

      // Cache wantlist
      this.cacheRepo.cacheWants(cleanUser, loadedWants);

      if (this.store) {
        this.store.setState({ wants: loadedWants, username: cleanUser });
      }
      if (global.state) {
        global.state.wants = loadedWants;
        global.state.username = cleanUser;
      }

      this.emit(events.WANTS_LOADED, { wants: loadedWants, username: cleanUser });
      return loadedWants;
    }

    /**
     * Scans a single release with caching and seller grouping.
     */
    async scanSingleRelease(item, index, totalWants, timeEstText = '', buyerCountry = 'Uruguay') {
      const releaseId = item.id;
      let listings = [];
      let totalWorldListings = 0;
      let unshippableCount = 0;
      let unshippableLocations = [];
      let communityStats = {};
      let isFromCache = false;

      // Check persistent cache
      const cached = this.cacheRepo.getReleaseListings(releaseId, buyerCountry);
      if (cached && Array.isArray(cached.listings)) {
        listings = cached.listings;
        totalWorldListings = cached.totalWorldListings || listings.length;
        unshippableCount = cached.unshippableCount || 0;
        unshippableLocations = cached.unshippableLocations || [];
        communityStats = cached.communityStats || {};
        isFromCache = true;
      } else {
        const url = `https://www.discogs.com/sell/release/${releaseId}?ev=rb`;
        let html = '';

        try {
          if (typeof global.fetchThroughTab === 'function') {
            html = await global.fetchThroughTab(url);
          } else if (typeof global.fetchDirect === 'function') {
            html = await global.fetchDirect(url);
          } else {
            const resp = await fetch(url);
            if (resp.ok) html = await resp.text();
          }
        } catch (fetchErr) {
          console.warn(`[ScanCoordinator] Error cargando release ${releaseId}:`, fetchErr.message);
        }

        if (html) {
          const parsed = this.parser.parseReleaseHTML(html, releaseId, buyerCountry, this.cacheRepo);
          listings = parsed.listings || [];
          totalWorldListings = parsed.totalWorldListings || listings.length;
          unshippableCount = parsed.unshippableCount || 0;
          unshippableLocations = parsed.unshippableLocations || [];
          communityStats = parsed.communityStats || {};

          // Store in cache
          this.cacheRepo.setReleaseListings(releaseId, buyerCountry, {
            listings,
            totalWorldListings,
            unshippableCount,
            unshippableLocations,
            communityStats
          });
        }
      }

      const progress = Math.round(((index + 1) / totalWants) * 100);
      const events = this.getEvents();

      this.emit(events.SCAN_PROGRESS, {
        index,
        total: totalWants,
        progress,
        item,
        timeEstText,
        listingsCount: listings.length,
        isFromCache
      });

      return {
        listings,
        totalWorldListings,
        unshippableCount,
        unshippableLocations,
        communityStats,
        isFromCache
      };
    }

    /**
     * Starts the full marketplace scan process across the wantlist.
     */
    async startMarketplaceScan(startIndex = 0, buyerCountry = 'Uruguay') {
      const wants = (this.store ? this.store.getState().wants : global.state?.wants) || [];
      if (!Array.isArray(wants) || wants.length === 0) {
        throw new Error('No hay discos en la lista de deseos para escanear.');
      }

      this.isScanning = true;
      this.cancelRequested = false;
      this.liveScannedCount = 0;
      this.currentBatchSize = 3;
      this.cooldownItemsLeft = 0;

      const events = this.getEvents();
      this.emit(events.SCAN_START, { total: wants.length, startIndex });

      if (global.state) global.state.isScanning = true;

      // Sort priority items first
      wants.sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0));

      const allListings = startIndex === 0 ? [] : (global.state?.allListings || []);
      const scanStartTime = Date.now();

      try {
        for (let i = startIndex; i < wants.length; i += this.currentBatchSize) {
          if (this.cancelRequested) {
            this.emit(events.SCAN_CANCELLED, { currentIndex: i });
            break;
          }

          if (global.state?.rateLimitTriggered || this.cooldownItemsLeft > 0) {
            if (global.state?.rateLimitTriggered) {
              global.state.rateLimitTriggered = false;
              this.cooldownItemsLeft = 4;
            } else {
              this.cooldownItemsLeft--;
            }
            this.currentBatchSize = 1;
          } else {
            this.currentBatchSize = 3;
          }

          const batchItems = wants.slice(i, i + this.currentBatchSize);
          const remainingCount = wants.length - i;
          const elapsedTimeSec = (Date.now() - scanStartTime) / 1000;
          const avgSecPerItem = this.liveScannedCount > 0 ? (elapsedTimeSec / this.liveScannedCount) : 0.4;
          const estSecRemaining = Math.round(remainingCount * avgSecPerItem);

          let timeEstText = '';
          if (remainingCount > 0) {
            if (estSecRemaining < 60) {
              timeEstText = ` • ⏱️ Restan ~${Math.max(1, estSecRemaining)} seg`;
            } else {
              const mins = Math.floor(estSecRemaining / 60);
              const secs = estSecRemaining % 60;
              timeEstText = ` • ⏱️ Restan ~${mins} min ${secs > 0 ? secs + ' seg' : ''}`;
            }
          }

          const results = await Promise.all(
            batchItems.map((item, bIdx) => this.scanSingleRelease(item, i + bIdx, wants.length, timeEstText, buyerCountry))
          );

          let hasLiveFetch = false;
          results.forEach((res, bIdx) => {
            const item = batchItems[bIdx];
            if (!res.isFromCache) {
              this.liveScannedCount++;
              hasLiveFetch = true;
            }
            allListings.push(...res.listings);

            item.totalWorldListings = res.totalWorldListings;
            item.unshippableCount = res.unshippableCount;
            item.unshippableLocations = res.unshippableLocations;
            if (res.communityStats) {
              Object.assign(item, res.communityStats);
            }

            this.emit(events.SCAN_ITEM_DONE, { item, listings: res.listings, index: i + bIdx });
          });

          // Sync state
          if (this.store) {
            this.store.setState({ allListings });
          }
          if (global.state) {
            global.state.allListings = allListings;
          }

          // Save session
          this.cacheRepo.saveScanSession({
            username: (this.store ? this.store.getState().username : global.state?.username) || 'user',
            currentIndex: Math.min(i + this.currentBatchSize - 1, wants.length - 1),
            allListings,
            wants
          });

          if (hasLiveFetch) {
            const pauseDelay = this.currentBatchSize === 1 ? 900 : 600;
            await new Promise(r => setTimeout(r, pauseDelay));
          }
        }

        // Group sellers
        const groupedSellers = this.parser.groupListingsBySeller(allListings, buyerCountry, this.cacheRepo);

        if (this.store) {
          this.store.setState({ allListings, groupedSellers });
        }
        if (global.state) {
          global.state.allListings = allListings;
          global.state.groupedSellers = groupedSellers;
        }

        this.emit(events.SELLERS_UPDATED, { groupedSellers });
        this.emit(events.SCAN_COMPLETED, { allListings, groupedSellers });

        if (this.cacheRepo && typeof this.cacheRepo.saveCompletedScan === 'function') {
          const uName = this.store?.getState()?.username || global.state?.username || 'default';
          this.cacheRepo.saveCompletedScan(uName, { allListings, groupedSellers, buyerCountry });
        }

        return { allListings, groupedSellers };
      } catch (err) {
        this.emit(events.SCAN_ERROR, { error: err.message });
        throw err;
      } finally {
        this.isScanning = false;
        if (global.state) global.state.isScanning = false;
      }
    }

    cancelScan() {
      this.cancelRequested = true;
      if (global.state) global.state.cancelRequested = true;
    }
  }

  global.ScanCoordinator = ScanCoordinator;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScanCoordinator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
