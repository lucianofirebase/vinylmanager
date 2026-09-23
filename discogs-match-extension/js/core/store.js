/**
 * Discogs Matcher • Central Reactive App Store
 * Decouples domain logic and scanning processes from DOM manipulation
 */

class AppStore {
  constructor() {
    this._listeners = new Map();
    this._state = {
      username: '',
      isLoggedIn: false,
      buyerCountry: 'Uruguay',
      displayCurrency: 'USD',
      activeView: 'onboarding', // 'onboarding' | 'wantlist-manager' | 'results' | 'stats' | 'local'
      wants: [],
      groupedSellers: [],
      filteredSellers: [],
      isScanning: false,
      scanIndex: 0,
      totalToScan: 0,
      filters: {
        minMatches: 2,
        minCondition: 'VG+',
        country: 'all',
        minRating: 99,
        sortBy: 'matches-desc',
        searchQuery: '',
        priorityOnly: false,
        hasShipping: true,
        freeShippingOnly: false
      },
      settings: {
        useCache: true,
        batchVerificationSize: 250,
        concurrency: 4
      }
    };
  }

  getState() {
    return this._state;
  }

  get(key) {
    return this._state[key];
  }

  set(key, value, silent = false) {
    const prev = this._state[key];
    this._state[key] = value;
    if (!silent && prev !== value) {
      this.emit(AppEvents.STATE_CHANGED, { key, value, prev });
    }
  }

  updateState(partial, silent = false) {
    const changes = {};
    for (const [k, v] of Object.entries(partial)) {
      if (this._state[k] !== v) {
        changes[k] = { prev: this._state[k], next: v };
        this._state[k] = v;
      }
    }
    if (!silent && Object.keys(changes).length > 0) {
      this.emit(AppEvents.STATE_CHANGED, { changes });
    }
  }

  setFilters(partial) {
    this._state.filters = { ...this._state.filters, ...partial };
    this.emit(AppEvents.FILTER_CHANGED, { filters: this._state.filters });
  }

  // --- PubSub Event Bus ---
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
  }

  emit(event, payload = null) {
    if (this._listeners.has(event)) {
      for (const cb of this._listeners.get(event)) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[AppStore] Error in listener for event "${event}":`, err);
        }
      }
    }
  }
}

// Global Singleton
const appStore = new AppStore();

if (typeof window !== 'undefined') {
  window.AppStore = AppStore;
  window.appStore = appStore;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppStore, appStore };
}
