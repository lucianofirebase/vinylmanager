/**
 * Vinyl Stock Manager • Architecture Facade Layer (js/facade.js)
 * Exposes clean, backward-compatible APIs on window for legacy callers, inline HTML event handlers,
 * and Chrome extension popup/content scripts.
 */

(function(global) {
  'use strict';

  // 1. Currency & Pricing APIs
  if (global.CurrencyService) {
    global.formatPrice = (amount, currency, displayCurrency) =>
      global.CurrencyService.formatPrice(amount, currency, displayCurrency);
    global.getCurrencyRate = (curr) => global.CurrencyService.getCurrencyRate(curr);
    global.convertPrice = (amount, from, to) => global.CurrencyService.convertPrice(amount, from, to);
    global.getCountryFlag = (country) => global.CurrencyService.getCountryFlag(country);
    global.detectCurrencyInContext = (text, fallback) => global.CurrencyService.detectCurrencyInContext(text, fallback);
  }

  // 2. Shipping & ASP APIs
  if (global.ShippingEngine) {
    global.calculateSellerShipping = (seller, listingsList) =>
      global.ShippingEngine.calculateSellerShipping(seller, listingsList);
    global.parseShippingPoliciesJson = (data, buyerCountryVal) =>
      global.ShippingEngine.parseShippingPoliciesJson(data, buyerCountryVal);
    global.parseFreeShippingThresholds = (fullRowText, currency, buyerCountryVal, sellerShipsFrom) =>
      global.ShippingEngine.parseFreeShippingThresholds(fullRowText, currency, null, buyerCountryVal, sellerShipsFrom);
    global.isCountryEU = (c) => global.ShippingEngine.isCountryEU(c);
    global.isDomesticSeller = (shipsFrom, buyer) => global.ShippingEngine.isDomesticSeller(shipsFrom, buyer);
  }
  if (global.discogsShippingService) {
    global.getSellerShippingPolicy = (sellerId, country) =>
      global.discogsShippingService.getSellerShippingPolicy(sellerId, country);
  }

  // 3. Filter & Ranking APIs
  if (global.FilterEngine) {
    global.getConditionRank = (cond) => global.FilterEngine.getConditionRank(cond);
    global.matchesConditionFilter = (itemCond, minCond) => global.FilterEngine.matchesConditionFilter(itemCond, minCond);
    global.matchesCountryFilter = (shipsFrom, countryFilter) => global.FilterEngine.matchesCountryFilter(shipsFrom, countryFilter);
    global.matchesSearchQuery = (seller, query, wants) => global.FilterEngine.matchesSearchQuery(seller, query, wants);
  }

  // 4. Optimizer APIs
  if (global.OptimizerService) {
    global.getSmartPurchaseCombo = (filteredSellers, targetReleases) =>
      global.OptimizerService.getSmartPurchaseCombo(filteredSellers, targetReleases);
    global.calculateWishlistCompletaStats = (filteredSellers, targetReleases) =>
      global.OptimizerService.calculateWishlistCompletaStats(filteredSellers, targetReleases);
  }

  // 5. Parser APIs
  if (global.DiscogsParser) {
    global.upgradeDiscogsImageUrl = (url) => global.DiscogsParser.upgradeDiscogsImageUrl(url);
    global.parseLocalePrice = (cleanPrice, currency) => global.DiscogsParser.parseLocalePrice(cleanPrice, currency);
    global.parseWantlistHTML = (html) => global.DiscogsParser.parseWantlistHTML(html);
    global.parseReleaseHTML = (html, relId, buyer) => global.DiscogsParser.parseReleaseHTML(html, relId, buyer);
  }

  // 6. Local Matcher APIs
  if (global.LocalMatcher) {
    global.parseSheetText = (text) => global.LocalMatcher.parseSheetText(text);
    global.matchLocalCatalog = (wants, rows, mapping) => global.LocalMatcher.matchLocalCatalog(wants, rows, mapping);
  }

  // 7. UI Component Renderers
  if (global.RadarRenderer) {
    if (!global.startRadarShaderCanvas) global.startRadarShaderCanvas = () => global.RadarRenderer.startRadarCanvas();
    if (!global.stopRadarShaderCanvas) global.stopRadarShaderCanvas = () => global.RadarRenderer.stopRadarCanvas();
  }

  // Preserve existing working UI renderers and expose new ones on App namespace
  global.App = {
    currency: global.CurrencyService,
    filter: global.FilterEngine,
    shipping: global.ShippingEngine,
    parser: global.DiscogsParser,
    optimizer: global.OptimizerService,
    local: global.LocalMatcher,
    scanCoordinator: global.ScanCoordinator,
    ui: {
      radar: global.RadarRenderer,
      smartPurchase: global.SmartPurchaseRenderer,
      wantsGrid: global.WantsGridRenderer,
      router: global.AppRouter
    }
  };


  console.log('[VinylManager] Architecture facade initialized successfully: 12 modular layers active.');
})(typeof window !== 'undefined' ? window : globalThis);
