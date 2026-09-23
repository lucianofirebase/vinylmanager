(function(global) {
  'use strict';

  const AppEvents = {
    // Store / State
    STATE_CHANGED: 'state:changed',
    FILTER_CHANGED: 'filter:changed',
    VIEW_CHANGED: 'view:changed',
    CURRENCY_CHANGED: 'currency:changed',
    COUNTRY_CHANGED: 'country:changed',

    // Wants / Wishlist
    WANTS_LOADED: 'wants:loaded',
    WANTS_UPDATED: 'wants:updated',
    FAVORITE_TOGGLED: 'wants:favorite_toggled',

    // Scanning Lifecycle
    SCAN_STARTED: 'scan:started',
    SCAN_PROGRESS: 'scan:progress',
    SCAN_SELLER_FOUND: 'scan:seller_found',
    SCAN_PAUSED: 'scan:paused',
    SCAN_RESUMED: 'scan:resumed',
    SCAN_STOPPED: 'scan:stopped',
    SCAN_COMPLETED: 'scan:completed',
    SCAN_ERROR: 'scan:error',

    // Sellers & Shipping
    SELLERS_GROUPED: 'sellers:grouped',
    SELLERS_FILTERED: 'sellers:filtered',
    ASP_POLICY_RESOLVED: 'shipping:asp_policy_resolved',

    // UI Notifications & Modals
    TOAST_MESSAGE: 'ui:toast',
    MODAL_OPENED: 'ui:modal_opened',
    MODAL_CLOSED: 'ui:modal_closed'
  };

  if (typeof global !== 'undefined') {
    global.AppEvents = AppEvents;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppEvents;
  }
})(typeof window !== 'undefined' ? window : globalThis);

