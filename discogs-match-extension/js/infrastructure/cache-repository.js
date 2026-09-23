/**
 * Discogs Matcher • Cache & Storage Repository
 * Encapsulates localStorage and sessionStorage access with TTL and versioning
 */

class CacheRepository {
  constructor() {
    this.ASP_CACHE_PREFIX = 'discogs_asp_banner_v9_';
    this.LISTINGS_CACHE_PREFIX = 'discogs_cache_listings_';
    this.WANTS_CACHE_PREFIX = 'discogs_wants_cache_';
    this.SESSION_KEY = 'vinyl_scan_session';
    this.DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  }

  // --- ASP Shipping Policies Cache ---
  getAspBanner(sellerName, buyerCountry) {
    try {
      const key = `${this.ASP_CACHE_PREFIX}${encodeURIComponent(sellerName)}_${encodeURIComponent(buyerCountry)}`;
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      const data = JSON.parse(raw);
      if (!data || typeof data.timestamp !== 'number') return undefined;
      // Expire after 7 days
      if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return undefined;
      }
      return data.value;
    } catch (e) {
      return undefined;
    }
  }

  setAspBanner(sellerName, buyerCountry, thresholdObj) {
    try {
      const key = `${this.ASP_CACHE_PREFIX}${encodeURIComponent(sellerName)}_${encodeURIComponent(buyerCountry)}`;
      localStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        value: thresholdObj
      }));
    } catch (e) {}
  }

  // --- Marketplace Release Listings Cache ---
  getListings(releaseId, maxAgeHours = 12) {
    try {
      const key = `${this.LISTINGS_CACHE_PREFIX}${releaseId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || !cached.timestamp || !cached.listings) return null;
      const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
      if (ageHours > maxAgeHours) {
        localStorage.removeItem(key);
        return null;
      }
      return { listings: cached.listings, ageHours };
    } catch (e) {
      return null;
    }
  }

  setListings(releaseId, listings) {
    try {
      const key = `${this.LISTINGS_CACHE_PREFIX}${releaseId}`;
      localStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        listings
      }));
    } catch (e) {}
  }

  // --- Wantlist Cache ---
  getWantlist(username) {
    try {
      const key = `${this.WANTS_CACHE_PREFIX}${encodeURIComponent(username)}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || !Array.isArray(cached.wants)) return null;
      return cached.wants;
    } catch (e) {
      return null;
    }
  }

  setWantlist(username, wants) {
    try {
      const key = `${this.WANTS_CACHE_PREFIX}${encodeURIComponent(username)}`;
      localStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        wants
      }));
    } catch (e) {}
  }

  // --- Scan Session Persistence ---
  getScanSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  saveScanSession(sessionData) {
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    } catch (e) {}
  }

  clearScanSession() {
    try {
      localStorage.removeItem(this.SESSION_KEY);
    } catch (e) {}
  }

  // --- Global Cache Flush ---
  clearAllCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(this.ASP_CACHE_PREFIX) || k.startsWith(this.LISTINGS_CACHE_PREFIX) || k.startsWith(this.WANTS_CACHE_PREFIX) || k === this.SESSION_KEY)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      return keysToRemove.length;
    } catch (e) {
      return 0;
    }
  }
}

const cacheRepository = new CacheRepository();

if (typeof window !== 'undefined') {
  window.CacheRepository = CacheRepository;
  window.cacheRepository = cacheRepository;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CacheRepository, cacheRepository };
}
