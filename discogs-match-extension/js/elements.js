/**
 * Vinyl Stock Manager • DOM Elements Registry (js/elements.js)
 * Centralized DOM node references bound on load for fast, consistent access
 */

// DOM Elements
const logoVinyl = document.getElementById('logo-vinyl');
const connectionStatus = document.getElementById('connection-status');
const usernameDisplay = document.getElementById('username-display');
const userAvatar = document.getElementById('user-avatar');
const userCard = document.getElementById('user-card');
const filterToolbar = document.getElementById('filter-toolbar');
const inputFallback = document.getElementById('input-fallback');
const manualUsername = document.getElementById('manual-username');
const saveUsernameBtn = document.getElementById('save-username-btn');
const loadWantsBtn = document.getElementById('load-wants-btn');
const refreshWantsBtn = document.getElementById('refresh-wants-btn');
const startScanBtn = document.getElementById('start-scan-btn');
const useCacheCheckbox = document.getElementById('use-cache-checkbox');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const statusCard = document.getElementById('status-card');
const statusTitle = document.getElementById('status-title');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const statusLogs = document.getElementById('status-logs');
const cancelScanBtn = document.getElementById('cancel-scan-btn');
const scanningArtist = document.getElementById('scanning-artist');
const scanningTitle = document.getElementById('scanning-title');
const scanningBadgeStep = document.getElementById('scanning-badge-step');
const scanningOffersBadge = document.getElementById('scanning-offers-badge');
const scanningEtaBadge = document.getElementById('scanning-eta-badge');
const scanningPriorityTag = document.getElementById('scanning-priority-tag');
const scanningFormatBadge = document.getElementById('scanning-format-badge');
const scanLoggerDock = document.getElementById('scan-logger-dock');
const logAccordionToggle = document.getElementById('log-accordion-toggle');
const statusLogsWrapper = document.getElementById('status-logs-wrapper');
const logChevron = document.getElementById('log-chevron');
const logLatestTicker = document.getElementById('log-latest-ticker');
const logCountBadge = document.getElementById('log-count-badge');
const copyLogsBtn = document.getElementById('copy-logs-btn');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const emptyState = document.getElementById('empty-state');
const resultsGrid = document.getElementById('results-grid');
const noResultsState = document.getElementById('no-results-state');

// Wantlist Manager Elements
const wantlistManager = document.getElementById('wantlist-manager');
const wantsSearchInput = document.getElementById('wants-search-input');
const wantsListGrid = document.getElementById('wants-list-grid');
const wantsPaginationBar = document.getElementById('wants-pagination-bar');
const managerStartScanBtn = document.getElementById('manager-start-scan-btn');
const managerStartScanTopBtn = document.getElementById('manager-start-scan-top-btn');

// Location Elements
const buyerCountry = document.getElementById('buyer-country');
const wizardBuyerCountry = document.getElementById('wizard-buyer-country');

// Export to Sheets Elements
const exportSheetsSidebarBtn = document.getElementById('export-sheets-sidebar-btn');
const exportWantsManagerBtn = document.getElementById('export-wants-manager-btn');
const btnExportResultsCsv = document.getElementById('btn-export-results-csv');
const exportSheetsModal = document.getElementById('export-sheets-modal');
const btnCloseExportModal = document.getElementById('btn-close-export-modal');
const btnCloseExportModalTop = document.getElementById('btn-close-export-modal-top');
const btnCopySheetsAction = document.getElementById('btn-copy-sheets-action');
const btnDownloadCsvAction = document.getElementById('btn-download-csv-action');

// Local Sheet Import Elements
const importLocalSheetSidebarBtn = document.getElementById('import-local-sheet-sidebar-btn');
const importLocalSheetManagerBtn = document.getElementById('import-local-sheet-manager-btn');
const localSheetModal = document.getElementById('local-sheet-modal');
const btnCloseLocalModal = document.getElementById('btn-close-local-modal');
const btnCloseLocalModalTop = document.getElementById('btn-close-local-modal-top');
const btnAnalyzeLocalPaste = document.getElementById('btn-analyze-local-paste');
const btnRunLocalMatch = document.getElementById('btn-run-local-match');
const btnBackLocalStep1 = document.getElementById('btn-back-local-step-1');

// Onboarding Portal & Wizard Elements
const wizardNext1Btn = document.getElementById('wizard-next-1-btn');
const wizardNext2Btn = document.getElementById('wizard-next-2-btn');
const wizardBack2Btn = document.getElementById('wizard-back-2-btn');
const wizardBack3Btn = document.getElementById('wizard-back-3-btn');
const wizardSyncBtn = document.getElementById('wizard-sync-btn');
const wizardSyncLoader = document.getElementById('wizard-sync-loader');
const wizardSyncText = document.getElementById('wizard-sync-text');
const wizardDetectionStatus = document.getElementById('wizard-detection-status');
const wizardDetectionText = document.getElementById('wizard-detection-text');
const wizardInputFallback = document.getElementById('wizard-input-fallback');
const wizardManualUsername = document.getElementById('wizard-manual-username');
const wizardSaveUsernameBtn = document.getElementById('wizard-save-username-btn');
const btnChangeUsernameToggle = document.getElementById('btn-change-username-toggle');
const onboardSheetPasteArea = document.getElementById('onboard-sheet-paste-area');
const onboardSheetFileInput = document.getElementById('onboard-sheet-file-input');
const onboardFileName = document.getElementById('onboard-file-name');
const onboardSheetAnalyzeBtn = document.getElementById('onboard-sheet-analyze-btn');
let currentSheetTarget = 'wishlist'; // 'wishlist' | 'local_catalog'

// Metrics elements
const metricWantsCount = document.getElementById('metric-wants-count');
const metricSellersCount = document.getElementById('metric-sellers-count');
const metricMatchesCount = document.getElementById('metric-matches-count');

// Filter elements
const filterSearchRelease = document.getElementById('filter-search-release');
const filterMinMatches = document.getElementById('filter-min-matches');
const filterCountry = document.getElementById('filter-country');
const filterRating = document.getElementById('filter-rating');
const sortBy = document.getElementById('sort-by');
const filterPriorityOnly = document.getElementById('filter-priority-only');
const filterHasShipping = document.getElementById('filter-has-shipping');
const filterMinCondition = document.getElementById('filter-min-condition');
const discogsTokenInput = document.getElementById('discogs-token-input');

// Global Logger & Event Counter
var logEventCount = 0;
window.logEventCount = 0;

function log(message, type = 'info') {
  console.log(`[Log] ${message}`);
  logEventCount++;
  window.logEventCount = logEventCount;
  if (logCountBadge) logCountBadge.textContent = `${logEventCount} eventos`;
  if (logLatestTicker) logLatestTicker.textContent = message;

  if (statusLogs) {
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    if (type === 'error') p.style.color = '#f87171';
    else if (type === 'success') p.style.color = '#34d399';
    else p.style.color = '#e2e8f0';
    statusLogs.appendChild(p);
    statusLogs.scrollTop = statusLogs.scrollHeight;
  }

  // Forward to remote Firebase Telemetry logger for iPhone / remote devices
  if (window.Telemetry) {
    if (type === 'error') {
      window.Telemetry.error(message);
    } else if (type === 'success' || message.includes('Iniciando') || message.includes('cargada') || message.includes('Escaneo') || message.includes('Usuario')) {
      window.Telemetry.info(message);
    }
  }
}

window.log = log;
