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
    global.parseFreeShippingThresholds = (fullRowText, currency) =>
      global.ShippingEngine.parseFreeShippingThresholds(fullRowText, currency);
    global.isCountryEU = (c) => global.ShippingEngine.isCountryEU(c);
    global.isDomesticSeller = (shipsFrom, buyer) => global.ShippingEngine.isDomesticSeller(shipsFrom, buyer);
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
    global.startRadarShaderCanvas = () => global.RadarRenderer.startRadarCanvas();
    global.stopRadarShaderCanvas = () => global.RadarRenderer.stopRadarCanvas();
  }

  if (global.SmartPurchaseRenderer) {
    global.renderSmartPurchase = (filteredSellers) => global.SmartPurchaseRenderer.render(filteredSellers);
  }

  if (global.WantsGridRenderer) {
    global.renderWantsListInManager = (resetPage) => global.WantsGridRenderer.renderWantsListInManager(resetPage);
  }

  if (global.AppRouter) {
    global.switchTab = (tabName, pushHistory) => global.AppRouter.switchTab(tabName, pushHistory);
    global.showWantlistManager = () => global.AppRouter.showWantlistManager();
  }

  console.log('[VinylManager] Architecture facade initialized successfully: 12 modular layers active.');
})(typeof window !== 'undefined' ? window : globalThis);
