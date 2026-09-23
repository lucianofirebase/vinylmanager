(function(global) {
  'use strict';

  const GOLDMINE_RANKS = global.GOLDMINE_RANKS || {
    'M': 6,
    'Mint (M)': 6,
    'NM': 5,
    'Near Mint (NM or M-)': 5,
    'VG+': 4,
    'Very Good Plus (VG+)': 4,
    'VG': 3,
    'Very Good (VG)': 3,
    'G+': 2,
    'Good Plus (G+)': 2,
    'G': 1,
    'Good (G)': 1,
    'F': 0,
    'Fair (F)': 0,
    'P': -1,
    'Poor (P)': -1
  };

class FilterEngine {
  constructor() {
    this.conditionRanks = GOLDMINE_RANKS;
  }

  getConditionRank(condition) {
    if (!condition) return 0;
    const clean = condition.trim();
    if (this.conditionRanks[clean] !== undefined) return this.conditionRanks[clean];
    const upper = clean.toUpperCase();
    for (const [k, v] of Object.entries(this.conditionRanks)) {
      if (k.toUpperCase() === upper) return v;
    }
    return 0;
  }

  isConditionAccepted(itemCondition, minCondition) {
    if (!minCondition || minCondition === 'any') return true;
    const itemRank = this.getConditionRank(itemCondition);
    const minRank = this.getConditionRank(minCondition);
    return itemRank >= minRank;
  }

  applyFilters(sellers, options = {}) {
    if (!Array.isArray(sellers)) return [];

    const {
      minMatches = 1,
      minCondition = 'VG+',
      country = 'all',
      minRating = 0,
      searchQuery = '',
      priorityOnly = false,
      priorityIds = [],
      hasShipping = false,
      freeShippingOnly = false,
      wants = [],
      aspCacheResolver = null
    } = options;

    const query = (searchQuery || '').toLowerCase().trim();

    return sellers.filter(seller => {
      if (!seller || !seller.name) return false;

      // Filter listings by condition first
      const validListings = (seller.listings || []).filter(listing => {
        return this.isConditionAccepted(listing.mediaCondition, minCondition);
      });
      seller.displayListings = validListings;

      // 1. Matches threshold
      if (validListings.length < minMatches) return false;

      // 2. Rating threshold
      if (typeof seller.rating === 'number' && seller.rating < minRating) return false;

      // 3. Country / Region filter
      if (country !== 'all') {
        const loc = (seller.shipsFrom || '').toLowerCase();
        if (country === 'Europe') {
          const euroCountries = [
            'spain', 'germany', 'france', 'italy', 'united kingdom', 'uk', 'netherlands',
            'belgium', 'austria', 'switzerland', 'sweden', 'norway', 'portugal', 'greece',
            'poland', 'ireland', 'españa', 'deutschland', 'francia', 'italia'
          ];
          if (!euroCountries.some(c => loc.includes(c))) return false;
        } else if (country === 'United States') {
          if (!loc.includes('united states') && !loc.includes('us')) return false;
        } else if (country === 'Spain') {
          if (!loc.includes('spain') && !loc.includes('españa') && !loc.includes('es')) return false;
        } else if (country === 'United Kingdom') {
          if (!loc.includes('united kingdom') && !loc.includes('uk') && !loc.includes('great britain')) return false;
        } else if (country === 'Germany') {
          if (!loc.includes('germany') && !loc.includes('deutschland') && !loc.includes('de')) return false;
        } else if (country === 'Brazil') {
          if (!loc.includes('brazil') && !loc.includes('brasil')) return false;
        } else {
          const targetVal = country.toLowerCase();
          if (!loc.includes(targetVal) && !targetVal.includes(loc)) return false;
        }
      }

      // 4. Priority items filter
      if (priorityOnly && priorityIds.length > 0) {
        const hasPriorityItem = validListings.some(l => priorityIds.includes(String(l.releaseId)));
        if (!hasPriorityItem) return false;
      }

      // 5. Search query filter
      if (query) {
        const matchesSearch = validListings.some(l => {
          const want = wants.find(w => String(w.id) === String(l.releaseId));
          const titleMatch = want?.title?.toLowerCase().includes(query);
          const artistMatch = want?.artist?.toLowerCase().includes(query);
          const rawTitleMatch = l.title?.toLowerCase().includes(query);
          return titleMatch || artistMatch || rawTitleMatch;
        });
        if (!matchesSearch) return false;
      }

      // 6. Verified shipping configured filter
      if (hasShipping && seller.isShippingEstimated) {
        return false;
      }

      // Sync ASP banner from cache resolver if provided
      if (!seller.freeShippingThreshold && typeof aspCacheResolver === 'function') {
        const cached = aspCacheResolver(seller.name);
        if (cached) {
          seller.aspBannerThreshold = cached;
          seller.freeShippingThreshold = cached;
        }
      }

      // 7. Free shipping / threshold filter
      if (freeShippingOnly) {
        const hasThreshold = Boolean(seller.freeShippingThreshold && seller.freeShippingThreshold.amount > 0);
        const isDirectFree = Boolean(validListings.length > 0 && validListings.every(l => l && l.isDirectFree));
        if (!hasThreshold && !isDirectFree && !seller.hasFreeShippingUnlocked) {
          return false;
        }
      }

      return true;
    });
  }

  sortSellers(sellers, sortBy = 'matches-desc') {
    if (!Array.isArray(sellers)) return [];
    const list = [...sellers];

    return list.sort((a, b) => {
      const aMatches = a.displayListings ? a.displayListings.length : (a.matchCount || 0);
      const bMatches = b.displayListings ? b.displayListings.length : (b.matchCount || 0);
      const aPrice = typeof a.totalPrice === 'number' ? a.totalPrice : 99999;
      const bPrice = typeof b.totalPrice === 'number' ? b.totalPrice : 99999;

      if (sortBy === 'matches-desc') {
        if (bMatches !== aMatches) return bMatches - aMatches;
        return aPrice - bPrice;
      }
      if (sortBy === 'price-asc') {
        return aPrice - bPrice;
      }
      if (sortBy === 'rating-desc') {
        const aRating = typeof a.rating === 'number' ? a.rating : 0;
        const bRating = typeof b.rating === 'number' ? b.rating : 0;
        if (bRating !== aRating) return bRating - aRating;
        return bMatches - aMatches;
      }
      return 0;
    });
  }
}

const filterEngine = new FilterEngine();

// Static helpers on class
FilterEngine.getConditionRank = (cond) => filterEngine.getConditionRank(cond);
FilterEngine.isConditionAccepted = (itemCond, minCond) => filterEngine.isConditionAccepted(itemCond, minCond);
FilterEngine.matchesConditionFilter = (itemCond, minCond) => filterEngine.isConditionAccepted(itemCond, minCond);
FilterEngine.applyFilters = (sellers, options) => filterEngine.applyFilters(sellers, options);
FilterEngine.sortSellers = (sellers, sortBy) => filterEngine.sortSellers(sellers, sortBy);

  if (typeof global !== 'undefined') {
    global.GOLDMINE_RANKS = GOLDMINE_RANKS;
    global.FilterEngine = FilterEngine;
    global.filterEngine = filterEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterEngine;
    module.exports.GOLDMINE_RANKS = GOLDMINE_RANKS;
    module.exports.FilterEngine = FilterEngine;
    module.exports.filterEngine = filterEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);


