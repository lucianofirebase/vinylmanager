/**
 * Vinyl Stock Manager • Discogs Shipping Policies Infrastructure Service (js/infrastructure/discogs-shipping.js)
 *
 * Responsibility:
 * - Fetch seller shipping policies from official Discogs endpoint:
 *   GET https://api.discogs.com/v3/marketplace/shipping/policies?seller_id={sellerId}&country={country}
 * - Match applicable policy by buyer country
 * - Normalize data model for application consumption
 * - Manage TTL caching per (sellerId + country) and deduplicate in-flight requests
 * - ZERO DOM manipulation, ZERO UI logic, ZERO direct AppStore mutation.
 */

(function(global) {
  'use strict';

  const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const CACHE_PREFIX = 'shippingPolicy:';

  class DiscogsShippingService {
    constructor(options = {}) {
      this.baseUrl = options.baseUrl || 'https://api.discogs.com';
      this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
      this.fetchFn = options.fetchFn || null; // Injected fetcher for tests / custom network
      this._inMemoryCache = new Map();
      this._inFlightRequests = new Map();
    }

    /**
     * Builds standard cache key for seller + country
     */
    getCacheKey(sellerId, country) {
      const cleanId = String(sellerId || '').trim();
      const cleanCountry = String(country || '').trim().toLowerCase();
      return `${CACHE_PREFIX}${cleanId}:${cleanCountry}`;
    }

    /**
     * Retrieves cached normalized shipping policy if available and not expired
     */
    getFromCache(sellerId, country) {
      const key = this.getCacheKey(sellerId, country);

      // 1. Check in-memory cache
      if (this._inMemoryCache.has(key)) {
        const item = this._inMemoryCache.get(key);
        if (Date.now() - item.timestamp < this.ttlMs) {
          return item.data;
        }
        this._inMemoryCache.delete(key);
      }

      // 2. Check localStorage if available
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.timestamp === 'number') {
              if (Date.now() - parsed.timestamp < this.ttlMs) {
                this._inMemoryCache.set(key, parsed);
                return parsed.data;
              }
              localStorage.removeItem(key);
            }
          }
        }
      } catch (e) {
        // LocalStorage access may fail in private mode or quota exceeded
      }

      return null;
    }

    /**
     * Saves normalized policy to cache with TTL
     */
    saveToCache(sellerId, country, data) {
      const key = this.getCacheKey(sellerId, country);
      const cacheItem = {
        timestamp: Date.now(),
        data
      };

      this._inMemoryCache.set(key, cacheItem);

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(cacheItem));
        }
      } catch (e) {
        // Fail silently if localStorage quota is exceeded
      }
    }

    /**
     * Clears all shipping policy cache entries
     */
    clearCache() {
      this._inMemoryCache.clear();
      try {
        if (typeof localStorage !== 'undefined') {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(CACHE_PREFIX)) {
              localStorage.removeItem(k);
            }
          }
        }
      } catch (e) {}
    }

    /**
     * Normalizes raw Discogs shipping policies response for a target country
     *
     * @param {Object} rawData - Response from /v3/marketplace/shipping/policies
     * @param {number|string} sellerId - Seller identifier
     * @param {string} targetCountry - User-selected country name
     * @returns {Object} Normalized shipping model
     */
    normalizeResponse(rawData, sellerId, targetCountry) {
      const normCountry = String(targetCountry || '').trim();
      const targetLower = normCountry.toLowerCase();
      const numSellerId = Number(sellerId) || sellerId;

      if (!rawData || !Array.isArray(rawData.policies)) {
        return {
          sellerId: numSellerId,
          country: normCountry,
          currency: rawData?.currency || 'USD',
          shipsToCountry: false,
          freeShipping: false,
          freeShippingMinimum: null,
          formattedFreeShippingMinimum: null,
          methods: [],
          status: 'not_shippable'
        };
      }

      // Determine applicable policy: policy whose countries array includes the target country
      const applicablePolicy = rawData.policies.find(p => {
        if (!p || !Array.isArray(p.countries)) return false;
        return p.countries.some(c => String(c || '').trim().toLowerCase() === targetLower);
      });

      if (!applicablePolicy) {
        return {
          sellerId: numSellerId,
          country: normCountry,
          currency: rawData.currency || 'USD',
          shipsToCountry: false,
          freeShipping: false,
          freeShippingMinimum: null,
          formattedFreeShippingMinimum: null,
          methods: [],
          status: 'not_shippable'
        };
      }

      // Extract explicit free shipping fields from the matched policy
      const hasFreeShipping = Boolean(applicablePolicy.free_shipping);
      let freeShippingMinimum = null;
      let formattedFreeShippingMinimum = null;

      if (hasFreeShipping && applicablePolicy.free_shipping_min_order_val != null) {
        const val = parseFloat(applicablePolicy.free_shipping_min_order_val);
        if (!isNaN(val) && isFinite(val) && val > 0) {
          freeShippingMinimum = val;
          formattedFreeShippingMinimum = applicablePolicy.formatted_free_shipping_min_order_val || null;
        }
      }

      // Map shipping methods
      const methods = Array.isArray(applicablePolicy.methods)
        ? applicablePolicy.methods.map(m => ({
            name: m.name || 'Standard Shipping',
            price: m.price != null ? parseFloat(m.price) : null,
            currency: m.currency || applicablePolicy.currency || rawData.currency || 'USD',
            minWeight: m.min_weight ?? null,
            maxWeight: m.max_weight ?? null,
            deliveryMin: m.delivery_min ?? null,
            deliveryMax: m.delivery_max ?? null
          }))
        : [];

      return {
        sellerId: numSellerId,
        country: normCountry,
        currency: rawData.currency || applicablePolicy.currency || 'USD',
        shipsToCountry: true,
        freeShipping: hasFreeShipping && freeShippingMinimum !== null,
        freeShippingMinimum,
        formattedFreeShippingMinimum,
        methods,
        status: 'success'
      };
    }

    /**
     * Executes the HTTP request through the extension's available transport
     */
    async _executeFetch(url) {
      if (typeof this.fetchFn === 'function') {
        return await this.fetchFn(url);
      }

      // In browser extension context: api.discogs.com is fetched directly with host permissions
      if (typeof global.fetchDirect === 'function') {
        const result = await global.fetchDirect(url);
        try {
          return typeof result === 'string' ? JSON.parse(result) : result;
        } catch (e) {
          return result;
        }
      }

      // Tab proxy fallback for same-origin web paths (not cross-origin api.discogs.com)
      if (typeof global.fetchThroughTab === 'function' && !url.includes('api.discogs.com')) {
        try {
          return await global.fetchThroughTab(url);
        } catch (err) {
          console.warn('[DiscogsShippingService] Tab proxy falló:', err.message);
        }
      }

      // Standard browser fetch
      const headers = { 'Accept': 'application/json' };
      const auth = typeof global.getDiscogsAuthHeader === 'function' ? global.getDiscogsAuthHeader() : null;
      if (auth) headers['Authorization'] = auth;

      const resp = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!resp.ok) {
        const error = new Error(`HTTP Error ${resp.status}`);
        error.status = resp.status;
        throw error;
      }

      return await resp.json();
    }

    /**
     * Main API: Fetch shipping policy for a seller and country
     *
     * @param {number|string} sellerId - Numeric seller UID
     * @param {string} country - Target country name (e.g. "Uruguay", "United States")
     * @returns {Promise<Object>} Normalized shipping policy object
     */
    async getSellerShippingPolicy(sellerId, country) {
      if (!sellerId || !country) {
        return {
          sellerId: sellerId || null,
          country: country || '',
          currency: 'USD',
          shipsToCountry: false,
          freeShipping: false,
          freeShippingMinimum: null,
          formattedFreeShippingMinimum: null,
          methods: [],
          status: 'error',
          error: 'Parámetros sellerId y country requeridos'
        };
      }

      const cleanCountry = String(country).trim();
      const numSellerId = Number(sellerId) || sellerId;

      // 1. Check cache first
      const cached = this.getFromCache(numSellerId, cleanCountry);
      if (cached) {
        return cached;
      }

      // 2. In-flight request deduplication
      const flightKey = this.getCacheKey(numSellerId, cleanCountry);
      if (this._inFlightRequests.has(flightKey)) {
        return await this._inFlightRequests.get(flightKey);
      }

      // 3. Perform request
      const requestPromise = (async () => {
        const url = `${this.baseUrl}/v3/marketplace/shipping/policies?seller_id=${encodeURIComponent(numSellerId)}&country=${encodeURIComponent(cleanCountry)}`;

        try {
          const rawResult = await this._executeFetch(url);
          const data = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

          const normalized = this.normalizeResponse(data, numSellerId, cleanCountry);

          // Cache valid results
          this.saveToCache(numSellerId, cleanCountry, normalized);
          return normalized;
        } catch (err) {
          const status = err.status || (err.message && err.message.includes('429') ? 429 : 500);
          console.warn(`[DiscogsShippingService] Error en shipping policies para seller ${numSellerId} (${cleanCountry}):`, err.message);

          const errorResult = {
            sellerId: numSellerId,
            country: cleanCountry,
            currency: 'USD',
            shipsToCountry: false,
            freeShipping: false,
            freeShippingMinimum: null,
            formattedFreeShippingMinimum: null,
            methods: [],
            status: 'error',
            httpStatus: status,
            error: err.message
          };

          // Cache 404 or unconfirmed negative briefly to prevent immediate retry storms
          if (status === 404) {
            this.saveToCache(numSellerId, cleanCountry, errorResult);
          }

          return errorResult;
        } finally {
          this._inFlightRequests.delete(flightKey);
        }
      })();

      this._inFlightRequests.set(flightKey, requestPromise);
      return await requestPromise;
    }
  }

  // Singleton instance
  const discogsShippingService = new DiscogsShippingService();

  if (typeof global !== 'undefined') {
    global.DiscogsShippingService = DiscogsShippingService;
    global.discogsShippingService = discogsShippingService;
    global.getSellerShippingPolicy = (sellerId, country) => discogsShippingService.getSellerShippingPolicy(sellerId, country);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DiscogsShippingService,
      discogsShippingService
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
