// State management
let state = {
  username: '',
  wants: [],
  allListings: [],
  groupedSellers: [],
  isScanning: false,
  cancelRequested: false,
  proxyTabId: null,
  localSheetRows: [],
  localMatches: []
};

// Detect whether running inside a Chrome extension context or as a plain web page.
// In web mode (GitHub Pages, local file, etc.) chrome.tabs / chrome.cookies are unavailable.
const IS_EXTENSION = (typeof chrome !== 'undefined' && !!chrome.tabs && !!chrome.runtime?.id);

const CURRENCY_MAP = {
  'EUR': { symbol: '€', code: 'EUR', rate: 1.08 },
  'USD': { symbol: '$', code: 'USD', rate: 1.0 },
  'GBP': { symbol: '£', code: 'GBP', rate: 1.28 },
  'JPY': { symbol: '¥', code: 'JPY', rate: 0.0065 },
  'UYU': { symbol: '$U', code: 'UYU', rate: 0.025 },
  'ARS': { symbol: '$', code: 'ARS', rate: 0.001 },
  'AUD': { symbol: 'A$', code: 'AUD', rate: 0.67 },
  'CAD': { symbol: 'CA$', code: 'CAD', rate: 0.73 },
  'CHF': { symbol: 'CHF', code: 'CHF', rate: 1.12 },
  'SEK': { symbol: 'kr', code: 'SEK', rate: 0.095 },
  'NOK': { symbol: 'kr', code: 'NOK', rate: 0.093 },
  'DKK': { symbol: 'kr', code: 'DKK', rate: 0.14 },
  'NZD': { symbol: 'NZ$', code: 'NZD', rate: 0.61 },
  'BRL': { symbol: 'R$', code: 'BRL', rate: 0.18 },
  'MXN': { symbol: 'Mex$', code: 'MXN', rate: 0.055 },
  'CLP': { symbol: '$', code: 'CLP', rate: 0.0011 },
  'COP': { symbol: '$', code: 'COP', rate: 0.00025 }
};

// Load custom UYU rate if saved in personalization settings
const savedCustomUyuRate = parseFloat(localStorage.getItem('custom_uyu_rate'));
if (savedCustomUyuRate > 0 && CURRENCY_MAP.UYU) {
  CURRENCY_MAP.UYU.rate = 1 / savedCustomUyuRate;
}

// Synchronize all Cache Checkboxes and remember user's choice in localStorage
function syncCacheState(enabled) {
  const useCacheCheckbox = document.getElementById('use-cache-checkbox');
  const managerUseCacheCheckbox = document.getElementById('manager-use-cache-checkbox');
  const bottomUseCacheCheckbox = document.getElementById('bottom-use-cache-checkbox');
  const settingsTurbo = document.getElementById('settings-cache-turbo');
  const settingsDirect = document.getElementById('settings-cache-direct');
  if (useCacheCheckbox) useCacheCheckbox.checked = enabled;
  if (managerUseCacheCheckbox) managerUseCacheCheckbox.checked = enabled;
  if (bottomUseCacheCheckbox) bottomUseCacheCheckbox.checked = enabled;
  if (settingsTurbo && settingsDirect) {
    settingsTurbo.checked = enabled;
    settingsDirect.checked = !enabled;
  }
  localStorage.setItem('use_scan_cache', String(enabled));
}
window.syncCacheState = syncCacheState;

function formatPrice(val, currencyCode, overrideDisplayCurrency = null) {
  const numVal = typeof val === 'number' ? (isNaN(val) ? 0 : val) : (parseFloat(val) || 0);
  const displayCurrencySelect = document.getElementById('display-currency');
  const displayCurr = overrideDisplayCurrency || (displayCurrencySelect ? displayCurrencySelect.value : 'UYU');
  
  if (displayCurr === 'original' || !displayCurr) {
    const info = CURRENCY_MAP[currencyCode] || { symbol: '$', code: currencyCode || 'USD' };
    if (info.code === info.symbol) {
      return `${info.code} ${numVal.toFixed(2)}`;
    }
    return `${info.code} ${info.symbol}${numVal.toFixed(2)}`;
  }
  
  // Convert val from currencyCode to USD first
  const sourceRate = CURRENCY_MAP[currencyCode]?.rate || 1.0;
  const valInUSD = numVal * sourceRate;
  
  // Convert USD to displayCurr
  const targetInfo = CURRENCY_MAP[displayCurr] || { symbol: '$', code: displayCurr, rate: 1.0 };
  const valInTarget = valInUSD / (targetInfo.rate || 1.0);
  
  // Format target output
  const isNoCentsCurrency = ['UYU', 'ARS', 'CLP', 'COP', 'JPY'].includes(targetInfo.code);
  const formattedNum = isNoCentsCurrency
    ? Math.round(valInTarget).toLocaleString('es-UY')
    : valInTarget.toFixed(2);
    
  if (targetInfo.code === targetInfo.symbol) {
    return `${targetInfo.code} ${formattedNum}`;
  }
  return `${targetInfo.code} ${targetInfo.symbol}${formattedNum}`;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function getCountryFlag(country) {
  if (!country) return '🌐';
  const c = country.toLowerCase();
  if (c.includes('germany') || c.includes('alemania') || c.includes('deutschland')) return '🇩🇪';
  if (c.includes('united kingdom') || c.includes('reino unido') || c.includes('uk') || c.includes('great britain')) return '🇬🇧';
  if (c.includes('united states') || c.includes('estados unidos') || c.includes('usa') || c.includes('ee.uu')) return '🇺🇸';
  if (c.includes('spain') || c.includes('españa')) return '🇪🇸';
  if (c.includes('france') || c.includes('francia')) return '🇫🇷';
  if (c.includes('italy') || c.includes('italia')) return '🇮🇹';
  if (c.includes('netherlands') || c.includes('países bajos') || c.includes('holanda') || c.includes('amsterdam')) return '🇳🇱';
  if (c.includes('japan') || c.includes('japón') || c.includes('tokyo')) return '🇯🇵';
  if (c.includes('uruguay') || c.includes('montevideo')) return '🇺🇾';
  if (c.includes('argentina') || c.includes('buenos aires')) return '🇦🇷';
  if (c.includes('brazil') || c.includes('brasil')) return '🇧🇷';
  if (c.includes('hungary') || c.includes('hungría')) return '🇭🇺';
  if (c.includes('austria')) return '🇦🇹';
  if (c.includes('switzerland') || c.includes('suiza')) return '🇨🇭';
  if (c.includes('canada') || c.includes('canadá')) return '🇨🇦';
  if (c.includes('australia')) return '🇦🇺';
  if (c.includes('belgium') || c.includes('bélgica')) return '🇧🇪';
  if (c.includes('sweden') || c.includes('suecia')) return '🇸🇪';
  if (c.includes('poland') || c.includes('polonia')) return '🇵🇱';
  return '📍';
}

function renderGoldmineTag(cond, isSleeve) {
  const c = (cond || '').toUpperCase().trim();
  let bg = 'border-prada-ochre/50 bg-prada-ochre-bg text-amber-950';
  if (c.includes('M') && !c.includes('NM') && !c.includes('VG')) {
    bg = 'border-prada-emerald bg-prada-emerald-bg text-emerald-900 font-bold';
  } else if (c.includes('NM')) {
    bg = 'border-prada-blue/40 bg-blue-50 text-prada-blue font-bold';
  } else if (c.includes('VG+') || c.includes('VG')) {
    bg = 'border-prada-ochre/50 bg-prada-ochre-bg text-amber-950 font-bold';
  }
  let displayCond = c;
  if (c.includes('GENERIC')) {
    bg = 'border-hairline-light bg-stone-100 text-muted-graphite';
    displayCond = 'GENÉRICA';
  }
  return `<span class="border ${bg} px-2 py-0.5 text-[9px] font-mono uppercase shadow-2xs">${escapeHTML(displayCond || (isSleeve ? 'GENÉRICA' : 'VG+'))}</span>`;
}

// Resilient Exponential Backoff with Jitter for Network & Discogs Rate-Limiting
let globalRateLimitCooldownPromise = null;

async function retryOnRateLimit(fn, retries = 5, initialDelay = 2200) {
  // If another request is currently waiting out a cooldown, queue behind it
  if (globalRateLimitCooldownPromise) {
    await globalRateLimitCooldownPromise;
  }

  let delay = initialDelay;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // 1. Check for session expiration: abort retries immediately to protect progress
      if (error && (error.isSessionExpired || (error.message && (error.message.includes('401') || error.message.toLowerCase().includes('session expired'))))) {
        console.warn('[SessionGuard] Sesión expirada detectada. Abortando reintentos para solicitar reautenticación.');
        throw error;
      }

      // 2. Check for rate limiting (429 or explicit flag)
      const isRateLimit = error && (
        error.isRateLimited || 
        (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('too many requests')))
      );

      if (isRateLimit && attempt <= retries) {
        // Compute backoff with +/- 20% randomized jitter to prevent synchronous re-bursts
        const jitterMultiplier = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
        const sleepTimeMs = Math.round(delay * jitterMultiplier);
        const sleepSec = (sleepTimeMs / 1000).toFixed(1);

        log(`[Anti-Rate-Limit] Límite de consultas Discogs detectado. Pausando ${sleepSec}s (reintento ${attempt}/${retries})...`, 'action');
        if (logLatestTicker) logLatestTicker.textContent = `[Enfriamiento ${sleepSec}s] Protegiendo sesión ante límite 429...`;

        // Establish global lock so parallel batch requests pause as well
        let cooldownResolver;
        globalRateLimitCooldownPromise = new Promise(res => { cooldownResolver = res; });

        await new Promise(resolve => setTimeout(resolve, sleepTimeMs));

        globalRateLimitCooldownPromise = null;
        if (cooldownResolver) cooldownResolver();

        delay = Math.min(delay * 2.2, 45000); // Exponential backoff capped at 45 seconds
      } else {
        throw error;
      }
    }
  }
}

// Helper to calculate estimated shipping for a seller based on matches count (accounting for weight tiers & per-disc increments)
function calculateSellerShipping(seller, listingsList) {
  const listCount = listingsList.length;
  if (listCount === 0) return 0;
  
  // Base & Incremental shipping rates in USD
  let baseShippingUSD = 6.00;
  let extraItemUSD = 1.50;
  
  if (seller.isDomestic) {
    baseShippingUSD = 4.50;
    extraItemUSD = 1.00; // ~$1.00 per additional item domestic
  } else if (seller.isEUToEU) {
    baseShippingUSD = 9.50;
    extraItemUSD = 1.50; // ~$1.50 per additional item EU
  } else {
    // International / Overseas (handles weight steps ~230g e.g. Royal Mail / USPS / DHL weight brackets)
    baseShippingUSD = 22.00;
    extraItemUSD = 2.00; // ~$2.00 USD (~£1.60 GBP / ~€1.85 EUR per additional LP)
  }
  
  // Convert estimated rates from USD to seller's currency
  const currencyInfo = CURRENCY_MAP[seller.currency] || { rate: 1.0 };
  const conversionFactor = 1.0 / (currencyInfo.rate || 1.0);
  
  const baseShippingInSellerCurrency = baseShippingUSD * conversionFactor;
  const extraItemInSellerCurrency = extraItemUSD * conversionFactor;
  
  // Check if we parsed actual shipping costs from listings
  const shippingValues = listingsList.map(l => l.shippingVal).filter(v => v > 0);
  if (shippingValues.length > 0) {
    const maxShipping = Math.max(...shippingValues);
    return maxShipping + (listCount - 1) * extraItemInSellerCurrency;
  } else {
    return baseShippingInSellerCurrency + (listCount - 1) * extraItemInSellerCurrency;
  }
}

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

// Add Event Listeners on Load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Restore saved Discogs API Token if present
  if (discogsTokenInput) {
    discogsTokenInput.value = localStorage.getItem('discogs_token') || '';
    discogsTokenInput.addEventListener('input', () => {
      localStorage.setItem('discogs_token', discogsTokenInput.value.trim());
    });
  }
  
  // Mobile Menu Toggle
  const mobileMenuToggleBtn = document.getElementById('mobile-menu-toggle-btn');
  const sidebarEl = document.getElementById('sidebar');
  if (mobileMenuToggleBtn && sidebarEl) {
    mobileMenuToggleBtn.addEventListener('click', () => {
      sidebarEl.classList.toggle('hidden');
      sidebarEl.classList.toggle('flex');
    });
  }

  // Tab Navigation switching
  const tabBtnSellers = document.getElementById('tab-btn-sellers');
  const tabBtnLocal = document.getElementById('tab-btn-local');
  const tabBtnStats = document.getElementById('tab-btn-stats');
  if (tabBtnSellers) tabBtnSellers.addEventListener('click', () => switchTab('sellers', true));
  if (tabBtnLocal) tabBtnLocal.addEventListener('click', () => switchTab('local', true));
  if (tabBtnStats) tabBtnStats.addEventListener('click', () => switchTab('stats', true));
  
  // Controls
  loadWantsBtn.addEventListener('click', loadWantlist);
  const mobileLoadWantsBtn = document.getElementById('mobile-load-wants-btn');
  if (mobileLoadWantsBtn) mobileLoadWantsBtn.addEventListener('click', loadWantlist);
  // Mobile user badge opens the account dropdown
  const mobileUserBadge = document.getElementById('mobile-user-badge');
  if (mobileUserBadge && userCard) {
    mobileUserBadge.addEventListener('click', () => userCard.click());
  }
  if (refreshWantsBtn) {
    refreshWantsBtn.style.display = 'flex';
    refreshWantsBtn.disabled = false;
    refreshWantsBtn.addEventListener('click', refreshWantlistIncremental);
  }
  // startScanBtn and mobileStartScanBtn listeners are wired below to openScanCacheModal
  cancelScanBtn.addEventListener('click', cancelScan);
  if (saveUsernameBtn) saveUsernameBtn.addEventListener('click', saveManualUsername);
  // Also allow pressing Enter inside the username field to confirm
  if (manualUsername) {
    manualUsername.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveManualUsername(); }
    });
  }
  clearCacheBtn.addEventListener('click', clearScanCache);
  
  // Expandable Logger Accordion listeners
  if (logAccordionToggle && statusLogsWrapper) {
    logAccordionToggle.addEventListener('click', () => {
      const isHidden = statusLogsWrapper.classList.contains('hidden');
      if (isHidden) {
        statusLogsWrapper.classList.remove('hidden');
        if (logChevron) logChevron.style.transform = 'rotate(180deg)';
        if (statusLogs) statusLogs.scrollTop = statusLogs.scrollHeight;
      } else {
        statusLogsWrapper.classList.add('hidden');
        if (logChevron) logChevron.style.transform = '';
      }
    });
  }

  if (copyLogsBtn) {
    copyLogsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (statusLogs) {
        navigator.clipboard.writeText(statusLogs.innerText).then(() => {
          const orig = copyLogsBtn.innerHTML;
          copyLogsBtn.innerHTML = '<span class="material-symbols-outlined text-[13px] text-emerald-400">check</span> Copiado';
          setTimeout(() => { copyLogsBtn.innerHTML = orig; }, 1500);
        });
      }
    });
  }

  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (statusLogs) statusLogs.innerHTML = '';
      logEventCount = 0;
      if (logCountBadge) logCountBadge.textContent = '0 eventos';
      if (logLatestTicker) logLatestTicker.textContent = 'Registro limpiado.';
    });
  }

  // Toggle user account / testing dropdown when clicking user card
  if (userCard && inputFallback) {
    userCard.addEventListener('click', (e) => {
      e.stopPropagation();
      const isClosed = inputFallback.style.display === 'none' || !inputFallback.style.display;
      if (isClosed) {
        positionUserDropdown();
        inputFallback.style.display = 'block';
        updateUserDropdownInfo();
        if (manualUsername) manualUsername.focus();
      } else {
        inputFallback.style.display = 'none';
      }
    });

    const btnCloseUserDropdown = document.getElementById('btn-close-user-dropdown');
    if (btnCloseUserDropdown) {
      btnCloseUserDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        inputFallback.style.display = 'none';
      });
    }

    const btnDisconnectSession = document.getElementById('btn-disconnect-session');
    if (btnDisconnectSession) {
      btnDisconnectSession.addEventListener('click', (e) => {
        e.stopPropagation();
        disconnectUserSession(true);
        inputFallback.style.display = 'none';
      });
    }

    const btnReconnectSession = document.getElementById('btn-reconnect-session');
    if (btnReconnectSession) {
      btnReconnectSession.addEventListener('click', async (e) => {
        e.stopPropagation();
        await reconnectUserSession();
      });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (inputFallback.style.display === 'block') {
        if (!inputFallback.contains(e.target) && !userCard.contains(e.target)) {
          inputFallback.style.display = 'none';
        }
      }
    });
  }
  
  // Export to Sheets listeners
  if (exportSheetsSidebarBtn) exportSheetsSidebarBtn.addEventListener('click', openExportSheetsModal);
  if (exportWantsManagerBtn) exportWantsManagerBtn.addEventListener('click', openExportSheetsModal);
  if (btnExportResultsCsv) btnExportResultsCsv.addEventListener('click', openExportSheetsModal);
  if (btnCloseExportModal) btnCloseExportModal.addEventListener('click', closeExportSheetsModal);
  if (btnCloseExportModalTop) btnCloseExportModalTop.addEventListener('click', closeExportSheetsModal);
  if (btnCopySheetsAction) btnCopySheetsAction.addEventListener('click', handleCopySheetsAction);
  if (btnDownloadCsvAction) btnDownloadCsvAction.addEventListener('click', handleDownloadCsvAction);
  
  // Local Sheet Import listeners
  if (importLocalSheetSidebarBtn) importLocalSheetSidebarBtn.addEventListener('click', openLocalSheetModal);
  if (importLocalSheetManagerBtn) importLocalSheetManagerBtn.addEventListener('click', openLocalSheetModal);
  if (btnCloseLocalModal) btnCloseLocalModal.addEventListener('click', closeLocalSheetModal);
  if (btnCloseLocalModalTop) btnCloseLocalModalTop.addEventListener('click', closeLocalSheetModal);
  if (btnAnalyzeLocalPaste) btnAnalyzeLocalPaste.addEventListener('click', handleAnalyzeLocalSheet);
  if (btnRunLocalMatch) btnRunLocalMatch.addEventListener('click', handleRunLocalMatch);

  // Settings & Personalization modal listeners
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const mobileBtnOpenSettings = document.getElementById('mobile-btn-open-settings');
  const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
  const btnCloseSettingsModalBottom = document.getElementById('btn-close-settings-modal-bottom');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnClearScanCache = document.getElementById('btn-clear-scan-cache');
  const btnResetDefaultSettings = document.getElementById('btn-reset-default-settings');
  const settingsDensityStandard = document.getElementById('settings-density-standard');
  const settingsDensityCompact = document.getElementById('settings-density-compact');

  if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettingsModal);
  if (mobileBtnOpenSettings) mobileBtnOpenSettings.addEventListener('click', openSettingsModal);
  if (btnCloseSettingsModal) btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
  if (btnCloseSettingsModalBottom) btnCloseSettingsModalBottom.addEventListener('click', closeSettingsModal);
  if (btnSaveSettings) btnSaveSettings.addEventListener('click', applySettingsFromModal);
  if (btnClearScanCache) btnClearScanCache.addEventListener('click', clearScanCacheAction);
  if (btnResetDefaultSettings) btnResetDefaultSettings.addEventListener('click', resetDefaultSettingsAction);

  if (settingsDensityStandard) {
    settingsDensityStandard.addEventListener('click', () => updateSettingsDensityUI('standard'));
  }
  if (settingsDensityCompact) {
    settingsDensityCompact.addEventListener('click', () => updateSettingsDensityUI('compact'));
  }
  if (btnBackLocalStep1) {
    btnBackLocalStep1.addEventListener('click', () => {
      const step1 = document.getElementById('local-step-1');
      const step2 = document.getElementById('local-step-2');
      if (step1) step1.style.display = 'block';
      if (step2) step2.style.display = 'none';
    });
  }
  
  // Onboarding Portal & Wizard Navigation
  if (wizardNext1Btn) {
    wizardNext1Btn.addEventListener('click', () => {
      const manualVal = wizardManualUsername ? wizardManualUsername.value.trim() : '';
      if (manualVal && !state.username) {
        localStorage.setItem('discogs_username', manualVal);
        setLoggedInUser(manualVal);
        log(`Usuario '${manualVal}' guardado automáticamente al continuar.`, 'success');
      }
      navigateToView('wizard-2');
    });
  }
  if (wizardNext2Btn) wizardNext2Btn.addEventListener('click', () => navigateToView('wizard-3'));
  if (wizardBack2Btn) wizardBack2Btn.addEventListener('click', () => navigateToView('wizard-1'));
  if (wizardBack3Btn) wizardBack3Btn.addEventListener('click', () => navigateToView('wizard-2'));
  
  if (wizardSyncBtn) {
    wizardSyncBtn.addEventListener('click', () => {
      const manualVal = wizardManualUsername ? wizardManualUsername.value.trim() : '';
      if (manualVal && !state.username) {
        localStorage.setItem('discogs_username', manualVal);
        setLoggedInUser(manualVal);
      }
      loadWantlist();
    });
  }

  if (wizardSaveUsernameBtn) wizardSaveUsernameBtn.addEventListener('click', saveWizardManualUsername);

  if (btnChangeUsernameToggle) {
    btnChangeUsernameToggle.addEventListener('click', () => {
      if (wizardInputFallback) {
        const isHidden = wizardInputFallback.style.display === 'none';
        wizardInputFallback.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && wizardManualUsername) wizardManualUsername.focus();
      }
    });
  }

  // Onboarding Sheet Paste & Upload
  if (onboardSheetFileInput) {
    onboardSheetFileInput.addEventListener('change', () => {
      if (onboardSheetFileInput.files && onboardSheetFileInput.files[0]) {
        if (onboardFileName) onboardFileName.textContent = onboardSheetFileInput.files[0].name;
      }
    });
  }

  if (onboardSheetAnalyzeBtn) {
    onboardSheetAnalyzeBtn.addEventListener('click', () => {
      handleAnalyzeOnboardSheet();
    });
  }

  if (wizardBuyerCountry) {
    wizardBuyerCountry.addEventListener('change', () => {
      if (buyerCountry) buyerCountry.value = wizardBuyerCountry.value;
      localStorage.setItem('buyer_country', wizardBuyerCountry.value);
    });
  }

  // Onboarding Two-Step Choice Navigation
  const choiceBtnDiscogs = document.getElementById('choice-btn-discogs');
  const choiceBtnSheet = document.getElementById('choice-btn-sheet');
  const btnBackToChoiceDiscogs = document.getElementById('btn-back-to-choice-discogs');
  const btnBackToChoiceSheet = document.getElementById('btn-back-to-choice-sheet');
  const onboardStepChoice = document.getElementById('onboard-step-choice');
  const onboardPaneDiscogs = document.getElementById('onboard-pane-discogs');
  const onboardPaneSheet = document.getElementById('onboard-pane-sheet');

  const showChoiceStep = () => {
    if (onboardStepChoice) onboardStepChoice.style.display = 'flex';
    if (onboardPaneDiscogs) onboardPaneDiscogs.style.display = 'none';
    if (onboardPaneSheet) onboardPaneSheet.style.display = 'none';
    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('ONBOARDING_VIEW_CHOICE', 'Usuario volvió al menú de bienvenida');
      }
    } catch (e) {}
  };

  const showDiscogsPane = () => {
    if (onboardStepChoice) onboardStepChoice.style.display = 'none';
    if (onboardPaneDiscogs) onboardPaneDiscogs.style.display = 'block';
    if (onboardPaneSheet) onboardPaneSheet.style.display = 'none';
    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('CHOICE_DISCOGS', 'Usuario seleccionó conectar cuenta de Discogs');
      }
    } catch (e) {}
  };

  const showSheetPane = () => {
    if (onboardStepChoice) onboardStepChoice.style.display = 'none';
    if (onboardPaneDiscogs) onboardPaneDiscogs.style.display = 'none';
    if (onboardPaneSheet) onboardPaneSheet.style.display = 'block';
    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('CHOICE_SHEET', 'Usuario seleccionó importar catálogo local');
      }
    } catch (e) {}
  };

  if (choiceBtnDiscogs) choiceBtnDiscogs.addEventListener('click', showDiscogsPane);
  if (choiceBtnSheet) choiceBtnSheet.addEventListener('click', showSheetPane);
  if (btnBackToChoiceDiscogs) btnBackToChoiceDiscogs.addEventListener('click', showChoiceStep);
  if (btnBackToChoiceSheet) btnBackToChoiceSheet.addEventListener('click', showChoiceStep);

  // Screen & Back Navigation Event Listeners
  const navBackBtn = document.getElementById('nav-back-btn');
  const btnBackToWants = document.getElementById('btn-back-to-wants');
  const btnBackToWantsFromNoResults = document.getElementById('btn-back-to-wants-from-no-results');
  const btnBackToWizard = document.getElementById('btn-back-to-wizard');
  const bottomBtnBackToWizard = document.getElementById('bottom-btn-back-to-wizard');
  const btnForwardToResults = document.getElementById('btn-forward-to-results');
  const bottomBtnForwardToResults = document.getElementById('bottom-btn-forward-to-results');
  const wizardResumeWantsBtn1 = document.getElementById('wizard-resume-wants-btn-1');
  const wizardResumeWantsBtn3 = document.getElementById('wizard-resume-wants-btn-3');

  if (navBackBtn) navBackBtn.addEventListener('click', () => handleHierarchicalBack());
  if (btnBackToWants) btnBackToWants.addEventListener('click', () => navigateToView('wantlist'));
  if (btnBackToWantsFromNoResults) btnBackToWantsFromNoResults.addEventListener('click', () => navigateToView('wantlist'));
  if (btnBackToWizard) btnBackToWizard.addEventListener('click', () => navigateToView('wizard-1'));
  if (bottomBtnBackToWizard) bottomBtnBackToWizard.addEventListener('click', () => navigateToView('wizard-1'));
  if (btnForwardToResults) btnForwardToResults.addEventListener('click', () => navigateToView('results-sellers'));
  if (bottomBtnForwardToResults) bottomBtnForwardToResults.addEventListener('click', () => navigateToView('results-sellers'));
  if (wizardResumeWantsBtn1) wizardResumeWantsBtn1.addEventListener('click', () => navigateToView('wantlist'));
  if (wizardResumeWantsBtn3) wizardResumeWantsBtn3.addEventListener('click', () => navigateToView('wantlist'));

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Global Escape key handler to close modals or go back
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const closed = closeAllModals();
      if (!closed) {
        handleHierarchicalBack();
      }
    }
  });

  // Browser / Mouse Back Button (popstate)
  window.addEventListener('popstate', (e) => {
    const closed = closeAllModals();
    if (closed) return;

    if (e.state && e.state.view) {
      navigateToView(e.state.view, false);
    } else {
      handleHierarchicalBack(false);
    }
  });
  
  if (wizardManualUsername) {
    wizardManualUsername.addEventListener('input', () => {
      const username = wizardManualUsername.value.trim();
      if (username || state.username) {
        wizardNext1Btn.disabled = false;
      } else {
        wizardNext1Btn.disabled = true;
      }
    });
  }
  
  // Location selectors synchronization
  buyerCountry.addEventListener('change', () => {
    wizardBuyerCountry.value = buyerCountry.value;
    localStorage.setItem('buyer_country', buyerCountry.value);
    onLocationChange();
  });
  
  wizardBuyerCountry.addEventListener('change', () => {
    buyerCountry.value = wizardBuyerCountry.value;
    localStorage.setItem('buyer_country', wizardBuyerCountry.value);
    onLocationChange();
  });
  
  // Wantlist Manager controls
  const managerStartScanTopBtn = document.getElementById('manager-start-scan-top-btn');
  const managerUseCacheCheckbox = document.getElementById('manager-use-cache-checkbox');
  const bottomUseCacheCheckbox = document.getElementById('bottom-use-cache-checkbox');
  const btnDensityCompact = document.getElementById('btn-density-compact');
  const btnDensityStandard = document.getElementById('btn-density-standard');
  const wantsGrid = document.getElementById('wants-list-grid');

  // Synchronize all Cache Checkboxes and remember user's choice in localStorage
  const savedCachePref = localStorage.getItem('use_scan_cache');
  const initialCacheVal = savedCachePref === null ? true : savedCachePref === 'true';
  syncCacheState(initialCacheVal);

  if (useCacheCheckbox) useCacheCheckbox.addEventListener('change', () => syncCacheState(useCacheCheckbox.checked));
  if (managerUseCacheCheckbox) managerUseCacheCheckbox.addEventListener('change', () => syncCacheState(managerUseCacheCheckbox.checked));
  if (bottomUseCacheCheckbox) bottomUseCacheCheckbox.addEventListener('change', () => syncCacheState(bottomUseCacheCheckbox.checked));

  // Scan Mode / Cache Choice Dialog Handler
  const scanCacheModal = document.getElementById('scan-cache-modal');
  const btnScanWithCache = document.getElementById('btn-scan-with-cache');
  const btnScanLiveDirect = document.getElementById('btn-scan-live-direct');
  const btnCloseScanCacheModal = document.getElementById('btn-close-scan-cache-modal');
  const btnCancelScanCacheModal = document.getElementById('btn-cancel-scan-cache-modal');
  const scanRememberCacheChoice = document.getElementById('scan-remember-cache-choice');

  const openScanCacheModal = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!state.wants || state.wants.length === 0) {
      if (typeof showToast === 'function') {
        showToast('Tu Wantlist no tiene vinilos cargados. Sincroniza tu lista en el Paso 03 antes de escanear.', 'warning', 4500);
      } else {
        alert('Tu Wantlist no tiene vinilos cargados. Carga tus deseos en el Paso 03 antes de escanear.');
      }
      return;
    }

    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('SCAN_MODAL_OPEN', `Usuario abrió modal de escaneo para ${state.wants.length} vinilos`, {
          wantsCount: state.wants.length,
          username: state.username
        });
      }
    } catch (e) {}

    // If user previously set "remember choice", execute directly
    const rememberPref = localStorage.getItem('remember_scan_cache_choice') === 'true';
    if (rememberPref) {
      const savedUseCache = localStorage.getItem('use_scan_cache') !== 'false';
      syncCacheState(savedUseCache);
      startMarketplaceScan();
      return;
    }

    if (scanCacheModal) {
      scanCacheModal.style.display = 'flex';
      scanCacheModal.classList.add('open');
    } else {
      startMarketplaceScan();
    }
  };

  const closeScanCacheModal = () => {
    if (scanCacheModal) {
      scanCacheModal.classList.remove('open');
      scanCacheModal.style.display = 'none';
    }
  };

  if (btnCloseScanCacheModal) btnCloseScanCacheModal.addEventListener('click', closeScanCacheModal);
  if (btnCancelScanCacheModal) btnCancelScanCacheModal.addEventListener('click', closeScanCacheModal);

  if (btnScanWithCache) {
    btnScanWithCache.addEventListener('click', () => {
      try {
        if (window.Telemetry?.track) {
          window.Telemetry.track('SCAN_OPTION_CACHE', 'Usuario eligió escanear con Caché Turbo');
        }
      } catch (e) {}
      if (scanRememberCacheChoice && scanRememberCacheChoice.checked) {
        localStorage.setItem('remember_scan_cache_choice', 'true');
      }
      syncCacheState(true);
      closeScanCacheModal();
      startMarketplaceScan();
    });
  }

  if (btnScanLiveDirect) {
    btnScanLiveDirect.addEventListener('click', () => {
      try {
        if (window.Telemetry?.track) {
          window.Telemetry.track('SCAN_OPTION_LIVE', 'Usuario eligió escaneo en vivo sin caché');
        }
      } catch (e) {}
      if (scanRememberCacheChoice && scanRememberCacheChoice.checked) {
        localStorage.setItem('remember_scan_cache_choice', 'true');
      }
      syncCacheState(false);
      closeScanCacheModal();
      startMarketplaceScan();
    });
  }

  // Grid Density Switcher (Compact vs Standard with mutually exclusive high-contrast colors)
  const setGridDensity = (density) => {
    if (!wantsGrid) return;
    localStorage.setItem('wants_grid_density', density);
    const activeClass = 'px-2.5 py-1 bg-pitch-black text-pure-white font-bold uppercase text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-xs';
    const inactiveClass = 'px-2.5 py-1 bg-transparent text-muted-graphite hover:text-pitch-black font-semibold uppercase text-[10px] flex items-center gap-1 cursor-pointer transition-colors';

    if (density === 'standard') {
      wantsGrid.classList.remove('density-compact');
      wantsGrid.classList.add('density-standard');
      if (btnDensityStandard) btnDensityStandard.className = activeClass;
      if (btnDensityCompact) btnDensityCompact.className = inactiveClass;
    } else {
      wantsGrid.classList.remove('density-standard');
      wantsGrid.classList.add('density-compact');
      if (btnDensityCompact) btnDensityCompact.className = activeClass;
      if (btnDensityStandard) btnDensityStandard.className = inactiveClass;
    }
  };

  // Delegated event listener to guarantee Wantlist Manager buttons always trigger modals and actions
  document.addEventListener('click', (e) => {
    const exportBtn = e.target.closest('#export-wants-manager-btn');
    if (exportBtn) {
      e.preventDefault();
      openExportSheetsModal();
      return;
    }
    const importBtn = e.target.closest('#import-local-sheet-manager-btn');
    if (importBtn) {
      e.preventDefault();
      openLocalSheetModal();
      return;
    }
    const scanTopBtn = e.target.closest('#manager-start-scan-top-btn');
    if (scanTopBtn) {
      e.preventDefault();
      openScanCacheModal(e);
      return;
    }
    const scanBottomBtn = e.target.closest('#manager-start-scan-btn');
    if (scanBottomBtn) {
      e.preventDefault();
      openScanCacheModal(e);
      return;
    }
  });

  if (btnDensityCompact) btnDensityCompact.addEventListener('click', () => setGridDensity('compact'));
  if (btnDensityStandard) btnDensityStandard.addEventListener('click', () => setGridDensity('standard'));
  setGridDensity(localStorage.getItem('wants_grid_density') || 'compact');

  if (wantsSearchInput) {
    wantsSearchInput.addEventListener('input', filterWantsInManager);
    wantsSearchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        wantsSearchInput.value = '';
        filterWantsInManager();
      } else if (e.key === 'Enter') {
        filterWantsInManager();
      }
    });
    wantsSearchInput.addEventListener('search', filterWantsInManager);
  }
  if (managerStartScanBtn) managerStartScanBtn.addEventListener('click', openScanCacheModal);
  if (managerStartScanTopBtn) managerStartScanTopBtn.addEventListener('click', openScanCacheModal);
  if (startScanBtn) startScanBtn.addEventListener('click', openScanCacheModal);
  const mobileStartScanBtn = document.getElementById('mobile-start-scan-btn');
  if (mobileStartScanBtn) mobileStartScanBtn.addEventListener('click', openScanCacheModal);
  
  // Filters
  const displayCurrencySelect = document.getElementById('display-currency');
  if (displayCurrencySelect) {
    const savedDisplayCurr = localStorage.getItem('display_currency') || 'UYU';
    displayCurrencySelect.value = savedDisplayCurr;
    displayCurrencySelect.addEventListener('change', () => {
      localStorage.setItem('display_currency', displayCurrencySelect.value);
      if (state.groupedSellers.length > 0) {
        renderResults();
        if (typeof calculateAndRenderStats === 'function') calculateAndRenderStats();
      }
    });
  }

  if (filterSearchRelease) {
    filterSearchRelease.addEventListener('input', renderResults);
    filterSearchRelease.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        filterSearchRelease.value = '';
        renderResults();
      } else if (e.key === 'Enter') {
        renderResults();
      }
    });
    filterSearchRelease.addEventListener('search', renderResults);
  }
  filterMinMatches.addEventListener('change', renderResults);
  if (filterMinCondition) {
    filterMinCondition.addEventListener('change', renderResults);
  }
  filterCountry.addEventListener('change', renderResults);
  filterRating.addEventListener('change', renderResults);
  sortBy.addEventListener('change', renderResults);
  filterPriorityOnly.addEventListener('change', () => {
    localStorage.setItem('filter_priority_only', filterPriorityOnly.checked ? 'true' : 'false');
    renderResults();
  });
  if (filterHasShipping) {
    filterHasShipping.addEventListener('change', renderResults);
  }

  // Auto currency sync when buyer destination country is changed
  if (buyerCountry && displayCurrencySelect) {
    buyerCountry.addEventListener('change', () => {
      const c = buyerCountry.value;
      if (c === 'Uruguay') displayCurrencySelect.value = 'UYU';
      else if (c === 'Spain' || c === 'Germany') displayCurrencySelect.value = 'EUR';
      else if (c === 'United States') displayCurrencySelect.value = 'USD';
      else if (c === 'United Kingdom') displayCurrencySelect.value = 'GBP';
      else if (c === 'Argentina') displayCurrencySelect.value = 'ARS';
      localStorage.setItem('display_currency', displayCurrencySelect.value);
      if (state.allListings.length > 0) {
        groupListingsBySeller();
        renderResults();
      }
    });
  }

  // Reset filters button listener
  const btnResetFilters = document.getElementById('btn-reset-filters');
  if (btnResetFilters) {
    btnResetFilters.addEventListener('click', () => {
      filterMinMatches.value = "1";
      if (filterMinCondition) filterMinCondition.value = "any";
      filterCountry.value = "all";
      filterRating.value = "0";
      filterPriorityOnly.checked = false;
      localStorage.setItem('filter_priority_only', 'false');
      if (filterSearchRelease) filterSearchRelease.value = "";
      renderResults();
    });
  }

  // Private Wantlist Help Modal controls
  const btnClosePrivateModal = document.getElementById('btn-close-private-modal');
  const btnSyncAgain = document.getElementById('btn-sync-again');
  const privateWantlistModal = document.getElementById('private-wantlist-modal');

  if (btnClosePrivateModal && privateWantlistModal) {
    btnClosePrivateModal.addEventListener('click', () => {
      privateWantlistModal.style.display = 'none';
    });
  }

  if (btnSyncAgain && privateWantlistModal) {
    btnSyncAgain.addEventListener('click', () => {
      privateWantlistModal.style.display = 'none';
      loadWantlist();
    });
  }
});

// Intercept all target="_blank" links and open them via chrome.tabs.create (necessary for Chrome extension panels/popups)
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.getAttribute('target') === '_blank') {
    const url = link.getAttribute('href');
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      e.preventDefault();
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: url });
      } else {
        window.open(url, '_blank');
      }
    }
    return;
  }

  // Handle "Volver a Vendedores" button in wantlist stats & local views
  const backToSellersBtn = e.target.closest('.btn-back-to-sellers');
  if (backToSellersBtn) {
    e.preventDefault();
    switchTab('sellers');
    return;
  }

  // Handle Not-for-sale filtering tabs in Wantlist Stats view
  const notForSaleTab = e.target.closest('.not-for-sale-tab-btn');
  if (notForSaleTab) {
    e.preventDefault();
    const filter = notForSaleTab.getAttribute('data-filter');
    const container = notForSaleTab.closest('.stats-card-rich');
    if (container) {
      container.querySelectorAll('.not-for-sale-tab-btn').forEach(btn => btn.classList.remove('active'));
      notForSaleTab.classList.add('active');
      const rows = container.querySelectorAll('.not-for-sale-row');
      rows.forEach(row => {
        const cat = row.getAttribute('data-category');
        if (filter === 'all' || filter === cat) {
          row.style.display = 'flex';
        } else {
          row.style.display = 'none';
        }
      });
    }
    return;
  }

  // Handle Accordion clicks for Consolidated Smart Purchase candidates
  const header = e.target.closest('.smart-candidate-header');
  if (header) {
    const card = header.closest('.smart-candidate-card');
    if (card) {
      const container = card.closest('.smart-candidates-stack');
      // Collapse all other candidates in this stack
      container.querySelectorAll('.smart-candidate-card').forEach(sibling => {
        if (sibling !== card) {
          sibling.classList.remove('active');
        }
      });
      // Toggle the clicked one
      card.classList.toggle('active');
    }
  }
});

// Helper to score vinyl media conditions (M = 6, NM = 5, VG+ = 4, VG = 3, G+ = 2, G = 1)
function getConditionRank(cond) {
  const c = (cond || '').toUpperCase().trim();
  if (c === 'M' || (c.includes('MINT') && !c.includes('NEAR'))) return 6;
  if (c === 'NM' || c.includes('NEAR MINT') || c === 'M-' || c === 'NM-') return 5;
  if (c === 'VG+' || c === 'VGPLUS' || c.includes('VERY GOOD PLUS')) return 4;
  if (c === 'VG' || c.includes('VERY GOOD')) return 3;
  if (c === 'G+' || c === 'GPLUS' || c.includes('GOOD PLUS')) return 2;
  return 1;
}

// Dynamic priority filter state management
function updatePriorityFilterUI() {
  const priorityCount = state.wants ? state.wants.filter(w => w.isPriority).length : 0;
  const filterPriorityOnly = document.getElementById('filter-priority-only');
  const label = document.getElementById('label-filter-priority') || (filterPriorityOnly ? filterPriorityOnly.closest('label') : null);
  if (!filterPriorityOnly || !label) return;

  if (priorityCount === 0) {
    filterPriorityOnly.disabled = true;
    filterPriorityOnly.checked = false;
    label.classList.add('opacity-40', 'cursor-not-allowed');
    label.classList.remove('cursor-pointer');
    filterPriorityOnly.classList.add('cursor-not-allowed');
    label.setAttribute('data-tooltip', 'No has marcado ningún disco como favorito (★)');
  } else {
    filterPriorityOnly.disabled = false;
    label.classList.remove('opacity-40', 'cursor-not-allowed');
    label.classList.add('cursor-pointer');
    filterPriorityOnly.classList.remove('cursor-not-allowed');
    label.setAttribute('data-tooltip', 'Mostrar únicamente tiendas con discos prioritarios ★');
    
    // User preference from localStorage (default to false if not set)
    const saved = localStorage.getItem('filter_priority_only');
    if (saved !== null) {
      filterPriorityOnly.checked = (saved === 'true');
    }
  }
}

// Dynamic lock/unlock filters section
function toggleFiltersState(enabled) {
  const displayCurrencySelect = document.getElementById('display-currency');
  if (displayCurrencySelect) displayCurrencySelect.disabled = !enabled;
  filterMinMatches.disabled = !enabled;
  if (filterMinCondition) filterMinCondition.disabled = !enabled;
  filterCountry.disabled = !enabled;
  filterRating.disabled = !enabled;
  sortBy.disabled = !enabled;
  if (enabled) {
    updatePriorityFilterUI();
  } else {
    filterPriorityOnly.disabled = true;
  }
  if (filterHasShipping) filterHasShipping.disabled = !enabled;
  
  const filterSection = document.querySelector('.filter-section');
  if (filterSection) {
    if (enabled) {
      filterSection.style.opacity = '1';
      filterSection.style.pointerEvents = 'auto';
    } else {
      filterSection.style.opacity = '0.4';
      filterSection.style.pointerEvents = 'none';
    }
  }

  // Only show horizontal filter toolbar and navigation row when results exist and are active
  const filterToolbarEl = document.getElementById('filter-toolbar');
  if (filterToolbarEl) {
    filterToolbarEl.style.display = enabled ? 'block' : 'none';
  }
  const headerNavRowEl = document.getElementById('header-nav-row');
  if (headerNavRowEl) {
    headerNavRowEl.style.display = enabled ? 'flex' : 'none';
  }
}

// Save currently running search session
function saveScanSession(currentIndex) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      'scan_session': {
        timestamp: Date.now(),
        username: state.username,
        currentIndex: currentIndex,
        allListings: state.allListings,
        wants: state.wants
      }
    });
  }
}

// Clear scan session cache
function clearScanSession() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.remove(['scan_session']);
  }
}

// Verify if there is an interrupted session to restore
function checkScanSession() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['scan_session'], (result) => {
      const session = result.scan_session;
      if (session) {
        const now = Date.now();
        const ageHours = (now - session.timestamp) / (1000 * 60 * 60);
        // Session must be less than 12 hours old and not fully completed
        if (ageHours < 12 && session.currentIndex < session.wants.length - 1 && session.allListings.length > 0) {
          const resumeModal = document.getElementById('resume-modal');
          const resumeUsername = document.getElementById('resume-username');
          const resumeProgress = document.getElementById('resume-progress');
          const resumeMatches = document.getElementById('resume-matches');
          
          if (resumeModal && resumeUsername && resumeProgress && resumeMatches) {
            resumeUsername.textContent = session.username || 'detectado';
            resumeProgress.textContent = `${session.currentIndex + 1} de ${session.wants.length}`;
            resumeMatches.textContent = session.allListings.length;
            
            // Show modal overlay
            resumeModal.style.display = 'flex';
            
            // Set up button actions
            const resumeBtn = document.getElementById('btn-resume-session');
            const discardBtn = document.getElementById('btn-discard-session');
            
            // Clone to strip duplicate event listeners if any
            const newResumeBtn = resumeBtn.cloneNode(true);
            const newDiscardBtn = discardBtn.cloneNode(true);
            resumeBtn.parentNode.replaceChild(newResumeBtn, resumeBtn);
            discardBtn.parentNode.replaceChild(newDiscardBtn, discardBtn);
            
            newResumeBtn.addEventListener('click', () => {
              resumeModal.style.display = 'none';
              restoreSessionAndResume(session);
            });
            
            newDiscardBtn.addEventListener('click', () => {
              resumeModal.style.display = 'none';
              clearScanSession();
            });
          }
        }
      }
    });
  }
}

// Restore saved wants, listings, and start scanning from where it left off
function restoreSessionAndResume(session) {
  state.username = session.username;
  state.wants = session.wants;
  state.allListings = session.allListings;
  
  // Set UI elements
  usernameDisplay.textContent = state.username || 'Usuario';
  connectionStatus.textContent = 'Sesión Activa (Restaurada)';
  if (userAvatar) {
    userAvatar.textContent = state.username ? state.username.substring(0, 2).toUpperCase() : '?';
  }
  
  // Update UI Stats
  metricWantsCount.textContent = state.wants.length;
  const uniqueSellers = new Set(state.allListings.map(l => l.sellerName));
  metricSellersCount.textContent = uniqueSellers.size;
  metricMatchesCount.textContent = state.allListings.length;
  
  // Resume scan from next index
  startMarketplaceScan(session.currentIndex + 1);
}




// Utility to animate count-up numbers (0 -> 17 -> 839)
function animateCounter(elementId, startVal, endVal, duration = 800) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const startTime = performance.now();
  const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - (1 - progress) * (1 - progress);
    const currentVal = Math.floor(startVal + (endVal - startVal) * easeProgress);
    el.textContent = currentVal.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

// Motion Shader: Radar Canvas Animation for Active Scanning Status
let radarAnimFrameId = null;
function startRadarShaderCanvas() {
  const canvas = document.getElementById('scan-radar-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let width = (canvas.width = canvas.offsetWidth || 600);
  let height = (canvas.height = canvas.offsetHeight || 160);
  
  let angle = 0;
  let particles = Array.from({ length: 24 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 2 + 1,
    speed: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.6 + 0.2
  }));

  function draw() {
    ctx.clearRect(0, 0, width, height);
    
    // Draw glowing center radar pulses centered on the vinyl artwork
    const centerX = width * 0.5;
    const centerY = height * 0.38;
    
    angle += 0.03;
    
    // Concentric glowing vinyl grooves
    for (let r = 30; r <= 160; r += 26) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r + Math.sin(angle + r) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 166, 35, ${0.18 - r * 0.0009})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Scanning radar line pulse
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(0, 0, 150, 0);
    grad.addColorStop(0, 'rgba(245, 166, 35, 0.4)');
    grad.addColorStop(1, 'rgba(245, 166, 35, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 130, 0, Math.PI / 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Floating golden particles
    particles.forEach(p => {
      p.x += p.speed;
      if (p.x > width) p.x = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 166, 35, ${p.alpha})`;
      ctx.fill();
    });

    radarAnimFrameId = requestAnimationFrame(draw);
  }
  
  if (radarAnimFrameId) cancelAnimationFrame(radarAnimFrameId);
  draw();
}

function stopRadarShaderCanvas() {
  if (radarAnimFrameId) {
    cancelAnimationFrame(radarAnimFrameId);
    radarAnimFrameId = null;
  }
}

// ==========================================
// UNIFIED SCREEN & NAVIGATION MANAGER
// ==========================================

let currentAppView = 'wizard-1';

function closeAllModals() {
  const modals = [
    document.getElementById('export-sheets-modal'),
    document.getElementById('local-sheet-modal'),
    document.getElementById('private-wantlist-modal'),
    document.getElementById('resume-modal'),
    document.getElementById('scan-cache-modal'),
    document.getElementById('settings-modal')
  ];
  let closedAny = false;
  modals.forEach(m => {
    if (m && (m.style.display === 'flex' || m.style.display === 'block')) {
      m.style.display = 'none';
      closedAny = true;
    }
  });
  return closedAny;
}

function updateForwardAndBackButtons() {
  const hasWants = state.wants && state.wants.length > 0;
  const hasResults = state.groupedSellers && state.groupedSellers.length > 0;
  
  // Forward to results button in wantlist manager
  const btnForwardToResults = document.getElementById('btn-forward-to-results');
  const bottomBtnForwardToResults = document.getElementById('bottom-btn-forward-to-results');
  if (btnForwardToResults) btnForwardToResults.style.display = hasResults ? 'inline-flex' : 'none';
  if (bottomBtnForwardToResults) bottomBtnForwardToResults.style.display = hasResults ? 'inline-flex' : 'none';

  // Resume buttons in wizard
  const resume1 = document.getElementById('wizard-resume-wants-btn-1');
  const resume3 = document.getElementById('wizard-resume-wants-btn-3');
  const text1 = document.getElementById('wizard-resume-wants-text-1');
  const text3 = document.getElementById('wizard-resume-wants-text-3');
  if (resume1) {
    resume1.style.display = hasWants ? 'inline-flex' : 'none';
    if (text1) text1.textContent = `Continuar con mi lista (${state.wants.length} discos)`;
  }
  if (resume3) {
    resume3.style.display = hasWants ? 'inline-flex' : 'none';
    if (text3) text3.textContent = `Ir a mi lista cargada (${state.wants.length} discos)`;
  }

  // Top navbar back button
  const navBackBtn = document.getElementById('nav-back-btn');
  if (navBackBtn) {
    const isRoot = currentAppView === 'wizard-1' && !hasWants;
    navBackBtn.style.display = isRoot ? 'none' : 'inline-flex';
  }
}

function navigateToView(viewName, pushHistory = true) {
  closeAllModals();
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('NAVIGATE_VIEW', `Navegación a vista: ${viewName}`, { view: viewName, username: state.username });
    }
  } catch (e) {}

  const emptyState = document.getElementById('empty-state');
  const wantlistManager = document.getElementById('wantlist-manager');
  const resultsGrid = document.getElementById('results-grid');
  const resultsViewWrapper = document.getElementById('results-view-wrapper');
  const noResultsState = document.getElementById('no-results-state');
  const smartPurchaseCard = document.getElementById('smart-purchase-card');
  const tabNavigation = document.getElementById('tab-navigation');
  const headerNavRow = document.getElementById('header-nav-row');
  const statsView = document.getElementById('stats-view');
  const localView = document.getElementById('local-view');
  const filterToolbar = document.getElementById('filter-toolbar');

  if (viewName.startsWith('wizard')) {
    const stepNum = parseInt(viewName.split('-')[1] || '1', 10);
    if (wantlistManager) wantlistManager.style.display = 'none';
    if (resultsGrid) resultsGrid.style.display = 'none';
    if (resultsViewWrapper) resultsViewWrapper.style.display = 'none';
    if (noResultsState) noResultsState.style.display = 'none';
    if (smartPurchaseCard) smartPurchaseCard.style.display = 'none';
    if (tabNavigation) tabNavigation.style.display = 'none';
    if (headerNavRow) headerNavRow.style.display = 'none';
    if (statsView) statsView.style.display = 'none';
    if (localView) localView.style.display = 'none';
    if (filterToolbar) filterToolbar.style.display = 'none';
    
    if (emptyState) {
      emptyState.style.display = 'flex';
      const choice = document.getElementById('onboard-step-choice');
      const pDiscogs = document.getElementById('onboard-pane-discogs');
      const pSheet = document.getElementById('onboard-pane-sheet');
      if (stepNum === 1) {
        if (choice) choice.style.display = 'flex';
        if (pDiscogs) pDiscogs.style.display = 'none';
        if (pSheet) pSheet.style.display = 'none';
      } else {
        if (choice) choice.style.display = 'none';
        if (pDiscogs) pDiscogs.style.display = 'block';
        if (pSheet) pSheet.style.display = 'none';
      }
      goToWizardStep(stepNum);
    }
    currentAppView = `wizard-${stepNum}`;
  } else if (viewName === 'wantlist') {
    if (emptyState) emptyState.style.display = 'none';
    if (resultsGrid) resultsGrid.style.display = 'none';
    if (resultsViewWrapper) resultsViewWrapper.style.display = 'none';
    if (noResultsState) noResultsState.style.display = 'none';
    if (smartPurchaseCard) smartPurchaseCard.style.display = 'none';
    if (tabNavigation) tabNavigation.style.display = 'none';
    if (headerNavRow) headerNavRow.style.display = 'none';
    if (statsView) statsView.style.display = 'none';
    if (localView) localView.style.display = 'none';
    if (filterToolbar) filterToolbar.style.display = 'none';

    if (wantlistManager) {
      wantlistManager.style.display = 'block';
      renderWantsListInManager();
    }
    currentAppView = 'wantlist';
  } else if (viewName.startsWith('results')) {
    const subTab = viewName.includes('-') ? viewName.split('-')[1] : 'sellers';
    if (emptyState) emptyState.style.display = 'none';
    if (wantlistManager) wantlistManager.style.display = 'none';
    if (tabNavigation) tabNavigation.style.display = 'flex';
    if (headerNavRow) headerNavRow.style.display = 'flex';
    if (filterToolbar) filterToolbar.style.display = 'block';

    switchTab(subTab);
    currentAppView = `results-${subTab}`;
  }

  updateForwardAndBackButtons();

  if (pushHistory) {
    try {
      window.history.pushState({ view: currentAppView }, '', '');
    } catch (e) {
      // Ignore in sandboxed environment
    }
  }
}

function handleHierarchicalBack(pushHistory = true) {
  if (closeAllModals()) return;

  if (currentAppView.startsWith('results-') && currentAppView !== 'results-sellers') {
    switchTab('sellers', pushHistory);
    return;
  }
  if (currentAppView.startsWith('results')) {
    if (state.wants && state.wants.length > 0) {
      navigateToView('wantlist', pushHistory);
    } else {
      navigateToView('wizard-1', pushHistory);
    }
    return;
  }
  if (currentAppView === 'wantlist') {
    navigateToView('wizard-1', pushHistory);
    return;
  }
  if (currentAppView === 'wizard-1') {
    if (state.wants && state.wants.length > 0) {
      navigateToView('wantlist', pushHistory);
    }
  }
}

// Utility: Upgrade Discogs image URLs to high-resolution versions
function upgradeDiscogsImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  // Discogs uses imgproxy on i.discogs.com with HMAC-SHA256 signatures in the URL path.
  // Modifying dimensions or quality (/h:600/w:600/ or /q:90/) invalidates the cryptographic signature,
  // causing Cloudflare/imgproxy to reject the request with HTTP 403 Forbidden.
  // Therefore, URLs on i.discogs.com must be preserved exactly as generated and signed by Discogs.
  if (url.includes('i.discogs.com')) {
    return url;
  }
  let upgraded = url;
  upgraded = upgraded.replace(/height=\d+([,&])width=\d+/i, 'height=600$1width=600');
  upgraded = upgraded.replace(/[?&]w=\d+/gi, '?w=600');
  upgraded = upgraded.replace(/[?&]h=\d+/gi, '&h=600');
  upgraded = upgraded.replace(/\/150x150\//i, '/600x600/');
  upgraded = upgraded.replace(/\/40x40\//i, '/600x600/');
  upgraded = upgraded.replace(/\/90x90\//i, '/600x600/');
  upgraded = upgraded.replace(/\/R-(?:90|150)-\d+/i, (m) => m.replace(/-(?:90|150)-/, '-'));
  return upgraded;
}

// Show Wantlist Manager section when wants are loaded
function showWantlistManager(pushHistory = true) {
  navigateToView('wantlist', pushHistory);
}

// Render loaded wants list inside Wantlist Manager for marking favorites (★)
let wantsRenderLimit = 48;

function renderWantsListInManager(resetLimit = true) {
  if (resetLimit) wantsRenderLimit = 48;
  updatePriorityFilterUI();
  const wantsListGrid = document.getElementById('wants-list-grid');
  if (!wantsListGrid) return;
  
  wantsListGrid.innerHTML = '';
  const searchVal = (wantsSearchInput ? wantsSearchInput.value : '').toLowerCase().trim();
  
  const filteredWants = state.wants.filter(w => {
    if (!searchVal) return true;
    return (w.title || '').toLowerCase().includes(searchVal) || (w.artist || '').toLowerCase().includes(searchVal);
  });

  if (filteredWants.length === 0) {
    wantsListGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--tertiary); padding: 30px;" class="text-body-md">No se encontraron vinilos en la búsqueda.</p>`;
    return;
  }

  // Safe chunked rendering for mobile performance & memory stability
  const itemsToRender = filteredWants.slice(0, wantsRenderLimit);

  itemsToRender.forEach((item, index) => {
    const card = document.createElement('div');
    const isChecked = item.isPriority ? 'checked' : '';
    const starId = `star-want-${item.id || index}`;
    
    // Resolve clean title and artist for display
    let displayTitle = (item.title || '').trim();
    let displayArtist = (item.artist || '').trim();
    if ((!displayTitle || displayTitle === 'Título del Disco' || displayTitle === 'Unknown Title') && (displayArtist.includes(' - ') || displayArtist.includes(' – '))) {
      let clean = displayArtist.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
      const parts = clean.split(/\s+[-–—]\s+/);
      if (parts.length >= 2) {
        displayArtist = parts[0].trim();
        displayTitle = parts.slice(1).join(' - ').replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    } else if (!displayTitle || displayTitle === 'Título del Disco' || displayTitle === 'Unknown Title') {
      displayTitle = displayArtist || `Disco #${item.id || index}`;
      displayArtist = 'Desconocido';
    }
    displayArtist = displayArtist.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();

    card.className = `record-card record-card-animated bg-pure-white border border-hairline-dark p-2.5 flex flex-col items-center relative transition-all duration-200 hover:shadow-md cursor-pointer ${item.isPriority ? 'active-priority' : ''}`;
    card.style.animationDelay = `${Math.min(index * 0.02, 0.5)}s`;
    card.dataset.title = displayTitle.toLowerCase();
    card.dataset.artist = displayArtist.toLowerCase();
    
    card.innerHTML = `
      <div class="record-hover-tooltip">
        <p class="font-bold mb-0.5 leading-snug">${escapeHTML(displayTitle)}</p>
        <p class="text-zinc-400 text-[10px] leading-tight">${escapeHTML(displayArtist)}</p>
      </div>
      <button type="button" class="record-star-btn ${item.isPriority ? 'active' : ''}" aria-label="Priorizar disco" data-tooltip="${item.isPriority ? 'Quitar de prioritarios' : 'Destacar disco favorito'}" data-tooltip-pos="top">
        <span class="material-symbols-outlined star-icon" style="font-variation-settings: 'FILL' ${item.isPriority ? 1 : 0};">star</span>
      </button>
      <input type="checkbox" id="${starId}" class="star-checkbox sr-only" ${isChecked}>
      <div class="record-cover-wrapper w-full aspect-square bg-surface-low mb-2 overflow-hidden border border-hairline-light flex items-center justify-center relative shadow-xs">
        ${item.image ? `<img src="${upgradeDiscogsImageUrl(item.image)}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none transition-transform duration-300 hover:scale-105" alt="${escapeHTML(displayTitle)}" loading="lazy">` : `<span class="material-symbols-outlined text-3xl text-muted-graphite">album</span>`}
      </div>
      <div class="w-full text-center px-0.5">
        <p class="font-sans font-extrabold text-[11px] uppercase tracking-tight text-pitch-black truncate w-full leading-tight mb-1" title="${escapeHTML(displayTitle)}">
          ${escapeHTML(displayTitle)}
        </p>
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-graphite truncate w-full leading-tight font-medium" title="${escapeHTML(displayArtist)}">
          ${escapeHTML(displayArtist)}
        </p>
      </div>
    `;

    const coverImg = card.querySelector('.record-cover-wrapper img');
    if (coverImg) {
      coverImg.addEventListener('error', function() {
        this.style.display = 'none';
        const wrapper = this.closest('.record-cover-wrapper');
        if (wrapper && !wrapper.querySelector('.material-symbols-outlined')) {
          wrapper.innerHTML = '<span class="material-symbols-outlined text-3xl text-muted-graphite">album</span>';
        }
      });
    }

    const starBtn = card.querySelector('.record-star-btn');
    const starIcon = card.querySelector('.record-star-btn .star-icon');
    const starCheckbox = card.querySelector('.star-checkbox');

    const toggleStar = (e) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      item.isPriority = !item.isPriority;
      updatePriorityFilterUI();
      if (starCheckbox) starCheckbox.checked = item.isPriority;
      if (starBtn) {
        starBtn.classList.toggle('active', item.isPriority);
        starBtn.setAttribute('data-tooltip', item.isPriority ? 'Quitar de prioritarios' : 'Destacar disco favorito');
        starBtn.title = item.isPriority ? 'Quitar prioridad' : 'Marcar como prioritario';
        if (item.isPriority) {
          starBtn.classList.add('star-pop-anim');
          starBtn.addEventListener('animationend', () => starBtn.classList.remove('star-pop-anim'), { once: true });
        }
      }
      if (starIcon) {
        starIcon.style.fontVariationSettings = `'FILL' ${item.isPriority ? 1 : 0}`;
      }
      card.classList.toggle('active-priority', item.isPriority);

      if (item.isPriority && window.Motion && window.Motion.starBurst) {
        window.Motion.starBurst(starBtn || card, true);
      }
    };

    if (starBtn) {
      starBtn.addEventListener('click', (e) => toggleStar(e));
    }
    card.addEventListener('click', (e) => {
      if (e.target.closest('.record-star-btn')) return;
      toggleStar(e);
    });

    wantsListGrid.appendChild(card);
  });

  // "Cargar más discos" button if there are more than current chunk
  if (filteredWants.length > wantsRenderLimit) {
    const remaining = filteredWants.length - wantsRenderLimit;
    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.id = 'wants-load-more-container';
    loadMoreContainer.className = 'w-full py-6 text-center col-span-full flex flex-col items-center justify-center gap-2';
    loadMoreContainer.style.gridColumn = '1 / -1';
    loadMoreContainer.innerHTML = `
      <button type="button" id="btn-load-more-wants" class="px-6 py-2.5 bg-pitch-black hover:bg-prada-red text-pure-white font-mono text-xs font-bold uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-2">
        <span class="material-symbols-outlined text-base">expand_more</span>
        <span>Cargar más discos (${itemsToRender.length} de ${filteredWants.length})</span>
      </button>
      <span class="text-[10px] font-mono text-muted-graphite uppercase tracking-wider">+${remaining} discos disponibles en memoria</span>
    `;
    wantsListGrid.appendChild(loadMoreContainer);

    const btnLoadMore = loadMoreContainer.querySelector('#btn-load-more-wants');
    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', (e) => {
        e.preventDefault();
        wantsRenderLimit += 48;
        renderWantsListInManager(false);
      });
    }
  }

  // Patch star burst microanimations after render
  if (window.Motion) {
    requestAnimationFrame(() => window.Motion.patchStarCards());
  }
}

function filterWantsInManager() {
  renderWantsListInManager(true);
}

// Initialize Application and detect user session
async function initApp() {
  log('Iniciando Discogs Wishlist Matcher...');
  
  // Check GPU Hardware Acceleration
  checkHardwareAcceleration();
  
  // Lock filters initially until results exist
  toggleFiltersState(false);
  updatePriorityFilterUI();
  
  // Ensure onboarding wizard / empty state is visible on init
  if (emptyState) emptyState.style.display = 'flex';
  if (typeof goToWizardStep === 'function') goToWizardStep(1);
  
  // Load saved shipping destination country
  const savedCountry = localStorage.getItem('buyer_country') || 'Uruguay';
  buyerCountry.value = savedCountry;
  wizardBuyerCountry.value = savedCountry;
  
  // Check for interrupted scan session
  checkScanSession();
  
  try {
    const isDisconnectedTesting = localStorage.getItem('discogs_session_disconnected') === 'true';
    if (isDisconnectedTesting) {
      log('Iniciando en modo desconectado para pruebas...', 'info');
      setDisconnectedUser();
    } else {
      const detectedUser = await detectDiscogsSession();
      if (detectedUser) {
        setLoggedInUser(detectedUser);
      } else {
        showFallbackLogin();
      }
    }
    // Load saved wants cache if available for this user
    const savedUser = state.username || localStorage.getItem('discogs_username');
    if (savedUser && (!state.wants || state.wants.length === 0)) {
      try {
        const cached = localStorage.getItem(`discogs_wants_cache_${savedUser.toLowerCase()}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            state.wants = parsed;
            if (metricWantsCount) metricWantsCount.textContent = state.wants.length;
            log(`Lista de deseos (${state.wants.length} discos) restaurada automáticamente para ${savedUser}.`, 'info');
          }
        }
      } catch (e) {
        console.warn('Error reading saved wants cache:', e);
      }
    }

    updateForwardAndBackButtons();
  } catch (error) {
    console.error('Session detection error:', error);
    showFallbackLogin();
  }
}

// Write message to dashboard log section & live ticker
let logEventCount = 0;
function log(message, type = 'info') {
  console.log(`[Log] ${message}`);
  logEventCount++;
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

// Update account popup card info based on current state
function updateUserDropdownInfo() {
  const statusBadge = document.getElementById('user-dropdown-status-badge');
  const avatarEl = document.getElementById('user-dropdown-avatar');
  const userText = document.getElementById('user-dropdown-username');
  const subtextEl = document.getElementById('user-dropdown-subtext');
  const btnDisconnect = document.getElementById('btn-disconnect-session');
  const btnReconnect = document.getElementById('btn-reconnect-session');
  
  if (state.username) {
    if (statusBadge) {
      statusBadge.textContent = 'ACTIVO';
      statusBadge.className = 'text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300';
    }
    if (avatarEl) {
      avatarEl.textContent = state.username.substring(0, 2).toUpperCase();
      avatarEl.className = 'w-8 h-8 bg-pitch-black text-pure-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs';
    }
    if (userText) {
      userText.textContent = state.username;
    }
    if (subtextEl) {
      subtextEl.textContent = 'Sesión vinculada a Discogs';
    }
    if (btnDisconnect) {
      btnDisconnect.style.display = 'flex';
    }
    if (btnReconnect) {
      btnReconnect.style.display = 'none';
    }
  } else {
    if (statusBadge) {
      statusBadge.textContent = 'DESCONECTADO (MODO TESTING)';
      statusBadge.className = 'text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-300';
    }
    if (avatarEl) {
      avatarEl.textContent = '?';
      avatarEl.className = 'w-8 h-8 bg-stone-300 text-stone-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs';
    }
    if (userText) {
      userText.textContent = 'INVITADO (SIN SESIÓN)';
    }
    if (subtextEl) {
      subtextEl.textContent = 'Modo de prueba sin cuenta activa';
    }
    if (btnDisconnect) {
      btnDisconnect.style.display = 'none';
    }
    if (btnReconnect) {
      btnReconnect.style.display = 'flex';
    }
  }
}

// Set user layout as disconnected for testing purposes
function setDisconnectedUser() {
  state.username = '';
  
  if (connectionStatus) {
    connectionStatus.textContent = 'DESCONECTADO';
    connectionStatus.style.color = '#71717A';
    connectionStatus.className = 'text-[9px] text-muted-graphite bg-stone-100 px-1 font-medium';
  }
  const dot = document.getElementById('connection-status-dot');
  if (dot) {
    dot.className = 'w-1.5 h-1.5 bg-stone-400';
  }
  if (usernameDisplay) {
    usernameDisplay.textContent = 'INVITADO';
  }
  if (userAvatar) {
    userAvatar.textContent = '?';
    userAvatar.style.background = '#71717A';
  }
  
  updateUserDropdownInfo();
  updateMobileBar();
  
  // Update wizard detection status with clear options to reconnect or enter username
  if (wizardDetectionStatus) {
    wizardDetectionStatus.innerHTML = `
      <span class="flex items-center gap-1.5 text-muted-graphite font-bold">
        <span class="w-2 h-2 rounded-full bg-stone-400 inline-block"></span>
        <span>Sin sesión activa (Modo pruebas)</span>
      </span>
      <div class="flex items-center gap-2">
        <button id="btn-change-username-toggle" type="button" class="text-[9px] text-prada-blue underline uppercase cursor-pointer hover:text-pitch-black font-semibold">Ingresar usuario</button>
        <span class="text-hairline-light select-none">|</span>
        <button id="btn-wizard-reconnect" type="button" class="text-[9px] text-emerald-700 underline uppercase cursor-pointer hover:text-pitch-black font-semibold">Autodetectar</button>
      </div>
    `;
    const toggle = document.getElementById('btn-change-username-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        if (wizardInputFallback) {
          const isHidden = wizardInputFallback.style.display === 'none';
          wizardInputFallback.style.display = isHidden ? 'flex' : 'none';
          if (isHidden && wizardManualUsername) wizardManualUsername.focus();
        }
      });
    }
    const wizardReconnect = document.getElementById('btn-wizard-reconnect');
    if (wizardReconnect) {
      wizardReconnect.addEventListener('click', reconnectUserSession);
    }
  }
  
  if (wizardInputFallback) {
    wizardInputFallback.style.display = 'flex';
  }
}

// Disconnect user session (clears username and prevents auto-relogin for testing)
function disconnectUserSession(showNotification = true) {
  state.username = '';
  localStorage.removeItem('discogs_username');
  localStorage.setItem('discogs_session_disconnected', 'true');
  
  // Clear lists
  state.wants = [];
  state.allListings = [];
  state.groupedSellers = [];
  
  setDisconnectedUser();
  
  // Reset navigation and views to initial choice
  if (emptyState) emptyState.style.display = 'flex';
  if (resultsGrid) resultsGrid.style.display = 'none';
  const resultsViewWrapper = document.getElementById('results-view-wrapper');
  if (resultsViewWrapper) resultsViewWrapper.style.display = 'none';
  const smartCard = document.getElementById('smart-purchase-card');
  if (smartCard) smartCard.style.display = 'none';
  const tabNavigation = document.getElementById('tab-navigation');
  if (tabNavigation) tabNavigation.style.display = 'none';
  const filterToolbar = document.getElementById('filter-toolbar');
  if (filterToolbar) filterToolbar.style.display = 'none';
  const headerNavRow = document.getElementById('header-nav-row');
  if (headerNavRow) headerNavRow.style.display = 'none';
  
  // Reset counters
  animateCounter('metric-wants-count', 0, 0);
  animateCounter('metric-sellers-count', 0, 0);
  animateCounter('metric-matches-count', 0, 0);
  const tickerWants = document.getElementById('ticker-wants-count');
  if (tickerWants) tickerWants.textContent = '0 DISCOS';
  const tickerSellers = document.getElementById('ticker-sellers-count');
  if (tickerSellers) tickerSellers.textContent = '0';
  const tickerMatches = document.getElementById('ticker-matches-count');
  if (tickerMatches) tickerMatches.textContent = '0';
  
  if (typeof goToOnboardChoiceStep === 'function') {
    goToOnboardChoiceStep();
  }
  
  if (showNotification) {
    showToast('Sesión desconectada. Modo testing sin cuenta activado.', 'info');
    log('Sesión desconectada por el usuario (Modo Testing).', 'info');
    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('USER_DISCONNECTED', 'Usuario desconectó la sesión (Modo Invitado / Testing)');
      }
    } catch (e) {}
  }
}

// Reconnect to active session by detecting cookies
async function reconnectUserSession() {
  localStorage.removeItem('discogs_session_disconnected');
  log('Intentando autodetectar sesión de Discogs...', 'info');
  showToast('Buscando sesión activa en Discogs...', 'info');
  
  const detectedUser = await detectDiscogsSession();
  if (detectedUser) {
    setLoggedInUser(detectedUser);
    showToast(`Sesión detectada y vinculada: ${detectedUser}`, 'success');
  } else {
    showToast('No se detectó sesión abierta en discogs.com. Ingresa un usuario manualmente.', 'warning');
    showFallbackLogin();
  }
}

// Show manual input fallback if session detection fails
function showFallbackLogin() {
  // If user explicitly disconnected for testing, do not restore previous username
  if (localStorage.getItem('discogs_session_disconnected') === 'true') {
    setDisconnectedUser();
    return;
  }

  // Try retrieving from local storage
  const saved = localStorage.getItem('discogs_username');
  if (saved) {
    if (manualUsername) manualUsername.value = saved;
    if (wizardManualUsername) {
      wizardManualUsername.value = saved;
    }
    setLoggedInUser(saved);
    return;
  }

  setDisconnectedUser();
}

// Save manual username configuration
function saveManualUsername() {
  const username = manualUsername ? manualUsername.value.trim() : '';
  if (username) {
    localStorage.removeItem('discogs_session_disconnected');
    localStorage.setItem('discogs_username', username);
    setLoggedInUser(username);
    log(`Usuario '${username}' guardado manualmente.`, 'success');
    showToast(`Sesión cambiada al usuario: ${username}`, 'success');
    if (inputFallback) inputFallback.style.display = 'none';
  } else {
    showToast('Por favor escribe un nombre de usuario de Discogs válido.', 'warning');
  }
}

// Sync the mobile action bar user badge with current session state
function updateMobileBar() {
  const mobileUsername = document.getElementById('mobile-username');
  const mobileDot = document.getElementById('mobile-status-dot');
  if (mobileUsername) mobileUsername.textContent = state.username || 'INVITADO';
  if (mobileDot) {
    mobileDot.className = state.username
      ? 'w-1.5 h-1.5 bg-prada-red'
      : 'w-1.5 h-1.5 bg-stone-400';
  }
}

// Set user layout as logged in
function setLoggedInUser(username) {
  state.username = username;
  localStorage.removeItem('discogs_session_disconnected');
  localStorage.setItem('discogs_username', username);
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('USER_LOGGED_IN', `Usuario conectado: ${username}`, { username });
    }
  } catch (e) {}
  
  if (connectionStatus) {
    connectionStatus.textContent = 'ACTIVO';
    connectionStatus.style.color = '#047857';
    connectionStatus.className = 'text-[9px] text-emerald-700 bg-emerald-50 px-1 font-medium';
  }
  const dot = document.getElementById('connection-status-dot');
  if (dot) {
    dot.className = 'w-1.5 h-1.5 bg-prada-red';
  }
  if (usernameDisplay) {
    usernameDisplay.textContent = username;
  }
  if (userAvatar) {
    userAvatar.textContent = username.substring(0, 2).toUpperCase();
    userAvatar.style.background = 'linear-gradient(135deg, var(--color-purple) 0%, var(--color-purple-dark) 100%)';
  }
  if (manualUsername) {
    manualUsername.value = username;
  }
  if (wizardManualUsername) {
    wizardManualUsername.value = username;
  }
  
  loadWantsBtn.disabled = false;
  updateUserDropdownInfo();
  updateMobileBar();
  
  // Enable onboarding next step
  if (wizardDetectionStatus) {
    wizardDetectionStatus.innerHTML = `
      <span class="flex items-center gap-1.5 text-emerald-700 font-bold">
        <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
        <span>Sesión activa: ${escapeHTML(username)}</span>
      </span>
      <div class="flex items-center gap-2">
        <button id="btn-change-username-toggle" type="button" class="text-[9px] text-prada-blue underline uppercase cursor-pointer hover:text-pitch-black font-semibold">Cambiar</button>
        <span class="text-hairline-light select-none">|</span>
        <button id="btn-wizard-disconnect" type="button" class="text-[9px] text-prada-red underline uppercase cursor-pointer hover:text-pitch-black font-semibold">Desconectar</button>
      </div>
    `;
    const toggle = document.getElementById('btn-change-username-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        if (wizardInputFallback) {
          const isHidden = wizardInputFallback.style.display === 'none';
          wizardInputFallback.style.display = isHidden ? 'flex' : 'none';
          if (isHidden && wizardManualUsername) wizardManualUsername.focus();
        }
      });
    }
    const wizardDisconnect = document.getElementById('btn-wizard-disconnect');
    if (wizardDisconnect) {
      wizardDisconnect.addEventListener('click', () => disconnectUserSession(true));
    }
  }
  if (wizardNext1Btn) wizardNext1Btn.disabled = false;
  if (wizardSyncBtn) wizardSyncBtn.disabled = false;
  
  if (wizardInputFallback) {
    wizardInputFallback.style.display = 'none';
  }
}

// Find username in cookies or fetch home page
async function detectDiscogsSession() {
  log('Buscando cookies de sesión en el navegador...');
  
  // 1. Try retrieving via cookies if chrome.cookies is available
  if (typeof chrome !== 'undefined' && chrome.cookies) {
    try {
      const cookies = await new Promise((resolve) => {
        chrome.cookies.getAll({ domain: 'discogs.com' }, (cookiesList) => {
          resolve(cookiesList || []);
        });
      });
      
      // Look for custom username cookies or matching patterns
      for (const cookie of cookies) {
        if (cookie.name === 'username' || cookie.name === 'discogs_user') {
          const username = decodeURIComponent(cookie.value);
          if (username) {
            log(`¡Sesión detectada vía cookies! Usuario: ${username}`, 'success');
            return username;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading cookies:', e);
    }
  }

  // 2. Try fetching the discogs.com main page to extract user
  log('Intentando verificar sesión a través del portal de Discogs...');
  try {
    const html = await fetchDirect('https://www.discogs.com/');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Scan for profile links
    const userLinks = doc.querySelectorAll('a[href^="/user/"]');
    for (const link of userLinks) {
      const href = link.getAttribute('href');
      const parts = href.split('/');
      const u = parts[parts.length - 1].trim();
      
      // Filter out utility URLs
      if (u && u !== 'login' && u !== 'create' && u !== 'inbox' && u !== 'notifications' && u !== 'settings') {
        log(`¡Sesión detectada vía portal! Usuario: ${u}`, 'success');
        return u;
      }
    }
  } catch (error) {
    console.warn('Direct fetch on portal failed or user is not logged in:', error.message);
  }
  
  return null;
}

// Direct fetch (no proxy)
async function fetchDirect(url) {
  return retryOnRateLimit(async () => {
    console.log(`[DirectFetch] Iniciando fetch directo para URL: ${url}`);
    try {
      const response = await fetch(url);
      console.log(`[DirectFetch] Status respuesta: ${response.status} para URL: ${url}`);
      if (response.status === 429) {
        throw new Error(`HTTP Error 429: Too Many Requests`);
      }
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      const text = await response.text();
      console.log(`[DirectFetch] Éxito. Descargados ${text.length} bytes.`);
      return text;
    } catch (error) {
      console.warn(`[DirectFetch] Error en fetch directo para URL: ${url}:`, error.message);
      // In web mode without extension privileges, browser blocks cross-origin requests.
      // Attempt proxy fallback for API requests:
      if (!IS_EXTENSION && (error.message?.includes('Failed to fetch') || error.name === 'TypeError')) {
        try {
          console.log(`[DirectFetch] Intentando proxy CORS para: ${url}`);
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const proxyResp = await fetch(proxyUrl);
          if (proxyResp.ok) {
            const proxyText = await proxyResp.text();
            console.log(`[DirectFetch] Éxito vía proxy CORS. ${proxyText.length} bytes.`);
            return proxyText;
          }
        } catch (proxyErr) {
          console.error(`[DirectFetch] Proxy CORS falló:`, proxyErr.message);
        }
      }
      throw error;
    }
  });
}

// Fetch helper using the content script proxy to bypass Cloudflare
async function fetchThroughTab(url) {
  // In web mode (no extension context) fall straight through to a direct fetch.
  // api.discogs.com supports CORS so this works fine for API endpoints.
  if (!IS_EXTENSION) {
    console.log(`[ProxyFetch] No extension context — using fetchDirect for: ${url}`);
    return fetchDirect(url);
  }

  return retryOnRateLimit(async () => {
    console.log(`[ProxyFetch] Solicitando URL a través de pestaña proxy: ${url}`);
    
    // Query all active tabs on Discogs
    let tabs = await new Promise((resolve) => {
      chrome.tabs.query({ url: "*://*.discogs.com/*" }, (result) => {
        resolve(result || []);
      });
    });

    let activeProxyTab = null;

    if (tabs.length > 0) {
      // If a tab is open, use the first one
      activeProxyTab = tabs[0];
      console.log(`[ProxyFetch] Usando pestaña Discogs abierta (ID: ${activeProxyTab.id})`);
    } else {
      // If no tab is open and we have already created a background proxy tab, use it
      if (state.proxyTabId !== null) {
        try {
          const tab = await new Promise((resolve, reject) => {
            chrome.tabs.get(state.proxyTabId, (tabInfo) => {
              if (chrome.runtime.lastError) reject();
              else resolve(tabInfo);
            });
          });
          activeProxyTab = tab;
          console.log(`[ProxyFetch] Reusando pestaña proxy creada previamente (ID: ${activeProxyTab.id})`);
        } catch (e) {
          state.proxyTabId = null;
        }
      }

      // If no tab is available at all, create one in the background
      if (activeProxyTab === null) {
        console.log('[ProxyFetch] Creando nueva pestaña de Discogs en segundo plano...');
        activeProxyTab = await new Promise((resolve) => {
          chrome.tabs.create({ url: "https://www.discogs.com/", active: false }, (tab) => {
            state.proxyTabId = tab.id;
            
            const listener = (tabId, changeInfo) => {
              if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                console.log(`[ProxyFetch] Nueva pestaña proxy creada y cargada (ID: ${tab.id})`);
                // Pequeño retardo de seguridad para asegurar la inyección de content scripts
                setTimeout(() => {
                  resolve(tab);
                }, 200);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
        });
      }
    }

    // Send request message to the proxy tab with a timeout
    return new Promise((resolve, reject) => {
      let timeoutId = setTimeout(() => {
        timeoutId = null;
        console.warn(`[ProxyFetch] TIMEOUT (10s) en pestaña proxy para ${url}. Intentando conexión directa...`);
        doDirectFallback();
      }, 10000);

      const doDirectFallback = () => {
        if (timeoutId) clearTimeout(timeoutId);
        fetchDirect(url)
          .then(resolve)
          .catch(err => {
            console.error(`[ProxyFetch] Falló fallback directo tras error de canal:`, err.message);
            reject(err);
          });
      };

      const sendMessageToTab = (tabId, isRetry = false) => {
        console.log(`[ProxyFetch] Enviando mensaje fetchUrl a pestaña ${tabId} para URL: ${url}`);
        chrome.tabs.sendMessage(tabId, { action: "fetchUrl", url }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(`[ProxyFetch] Error de comunicación con pestaña ${tabId}:`, chrome.runtime.lastError.message);
            // If content script was not injected yet in an existing tab, inject dynamically
            if (!isRetry && typeof chrome !== 'undefined' && chrome.scripting && chrome.scripting.executeScript) {
              console.log(`[ProxyFetch] Inyectando content.js dinámicamente en pestaña ${tabId}...`);
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
              }, () => {
                if (chrome.runtime.lastError) {
                  console.warn(`[ProxyFetch] Falló inyección dinámica:`, chrome.runtime.lastError.message);
                  doDirectFallback();
                } else {
                  console.log(`[ProxyFetch] Inyección exitosa. Reintentando mensaje...`);
                  sendMessageToTab(tabId, true);
                }
              });
            } else {
              doDirectFallback();
            }
          } else if (response && response.success) {
            if (timeoutId) clearTimeout(timeoutId);
            console.log(`[ProxyFetch] Respuesta exitosa recibida de pestaña proxy para URL: ${url} (${response.html ? response.html.length : 0} bytes)`);
            resolve(response.html);
          } else {
            if (timeoutId) clearTimeout(timeoutId);
            const errMsg = response ? response.error : "Unknown same-origin fetch error";
            console.error(`[ProxyFetch] La pestaña proxy retornó error para ${url}:`, errMsg);
            const err = new Error(errMsg);
            if (response) {
              err.status = response.status;
              err.isRateLimited = Boolean(response.isRateLimited || response.status === 429);
              err.isSessionExpired = Boolean(response.isSessionExpired || response.status === 401 || response.status === 403);
            }
            reject(err);
          }
        });
      };

      sendMessageToTab(activeProxyTab.id);
    });
  });
}

// Step 1: Load Wants List from Discogs API
async function loadWantlist() {
  if (!state.username) {
    loadWantsBtn.disabled = false;
    loadWantsBtn.innerHTML = '<span class="material-symbols-outlined text-[15px]">favorite</span><span>1. CARGAR DESEOS</span>';
    if (refreshWantsBtn) refreshWantsBtn.disabled = false;
    if (wizardSyncBtn) wizardSyncBtn.style.display = 'flex';
    if (wizardSyncLoader) wizardSyncLoader.style.display = 'none';
    
    showToast('No hay una cuenta de Discogs conectada. Ingresa un usuario o autodetecta tu sesión para continuar.', 'warning');
    if (inputFallback) {
      inputFallback.style.display = 'block';
      updateUserDropdownInfo();
      if (manualUsername) manualUsername.focus();
    }
    return;
  }

  loadWantsBtn.disabled = true;
  loadWantsBtn.textContent = 'Cargando...';
  if (refreshWantsBtn) refreshWantsBtn.disabled = true;
  
  // Show onboarding wizard loader if active
  if (wizardSyncBtn) {
    wizardSyncBtn.style.display = 'none';
    wizardSyncLoader.style.display = 'flex';
    wizardSyncText.textContent = 'Conectando con Discogs...';
  }
  
  log(`Cargando lista de deseos para '${state.username}'...`);
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('WANTLIST_LOAD_START', `Iniciando carga de Wantlist para ${state.username}`, { username: state.username });
    }
  } catch (e) {}
  
  try {
    // Clear previous runs
    state.wants = [];
    state.allListings = [];
    state.groupedSellers = [];
    
    let loadedWants = [];
    
    // Method A: JSON API through tab proxy with pagination
    try {
      console.log(`[WantlistAPI] Iniciando carga de Wantlist de '${state.username}' a través de la API de Discogs...`);
      let page = 1;
      let totalPages = 1;
      
      do {
        console.log(`[WantlistAPI] Solicitando página ${page} de ${totalPages}...`);
        log(`Cargando página ${page} de la API de Discogs...`);
        if (wizardSyncText) wizardSyncText.textContent = `Cargando página ${page} (API)...`;
        
        const savedToken = localStorage.getItem('discogs_token') || (discogsTokenInput ? discogsTokenInput.value.trim() : '');
        const tokenParam = savedToken ? `&token=${encodeURIComponent(savedToken)}` : '';
        
        let jsonText = '';
        try {
          console.log(`[WantlistAPI] Solicitando API vía tab proxy...`);
          jsonText = await fetchThroughTab(`https://api.discogs.com/users/${state.username}/wants?page=${page}&per_page=100${tokenParam}`);
        } catch (eProxy) {
          console.log(`[WantlistAPI] Tab proxy devolvió error, intentando fetchDirect...`, eProxy.message);
          jsonText = await fetchDirect(`https://api.discogs.com/users/${state.username}/wants?page=${page}&per_page=100${tokenParam}`);
        }
        
        console.log(`[WantlistAPI] Respuesta recibida para página ${page}. Parseando JSON...`);
        const data = JSON.parse(jsonText);
        
        if (data && data.wants && data.wants.length > 0) {
          console.log(`[WantlistAPI] Página ${page} parseada con éxito. Encontrados ${data.wants.length} vinilos deseados.`);
          const pageWants = data.wants.map(item => ({
            id: item.id,
            title: item.basic_information.title,
            artist: item.basic_information.artists.map(a => a.name).join(', '),
            year: item.basic_information.year,
            image: item.basic_information.cover_image || item.basic_information.thumb || '',
            wantCount: (item.basic_information.community && (item.basic_information.community.want || item.basic_information.community.in_wantlist)) || 0,
            haveCount: (item.basic_information.community && item.basic_information.community.have) || 0,
            forSaleCount: (item.basic_information && (item.basic_information.num_for_sale || item.basic_information.numForSale)) || item.num_for_sale || 0
          }));
          
          loadedWants.push(...pageWants);
          totalPages = data.pagination ? data.pagination.pages : 1;
          page++;
          
          // Polite delay to avoid rate limits
          if (page <= totalPages) {
            console.log(`[WantlistAPI] Esperando 1.2s antes de solicitar la página ${page}...`);
            await new Promise(r => setTimeout(r, 1200));
          }
        } else {
          break;
        }
      } while (page <= totalPages);
      
      log(`Wantlist cargada con éxito a través de la API (${loadedWants.length} discos).`, 'success');
    } catch (apiError) {
      log(`La API devolvió un error o restricción (${apiError.message}). Usando método alternativo de raspado HTML con paginación...`, 'warning');
      
      let page = 1;
      let hasMore = true;
      loadedWants = []; // Reset to ensure no partial API items mixed
      const seenIds = new Set();
      
      do {
        log(`Cargando página ${page} de tu Wishlist... (Total cargados hasta ahora: ${loadedWants.length})`);
        if (wizardSyncText) wizardSyncText.textContent = `Cargando página ${page} (Web) - ${loadedWants.length} discos...`;
        
        let html = '';
        const limitParam = 'limit=100';
        const userTrimmed = encodeURIComponent(state.username.trim());
        const candidateUrls = [
          `https://www.discogs.com/wantlist?user=${userTrimmed}&${limitParam}&page=${page}`,
          `https://www.discogs.com/users/${userTrimmed}/wants?${limitParam}&page=${page}`,
          `https://www.discogs.com/user/${userTrimmed}/wants?${limitParam}&page=${page}`
        ];

        for (const candidateUrl of candidateUrls) {
          try {
            html = await fetchThroughTab(candidateUrl);
            if (html && html.length > 500 && !html.includes('HTTP Error 404') && !html.includes('Page Not Found')) {
              break;
            }
          } catch (tabErr) {
            console.warn(`[WantlistScrape] Falló URL ${candidateUrl}:`, tabErr.message);
          }
        }

        if (html && (html.includes('is private') || html.includes('es privada') || html.includes('private wantlist'))) {
          log(`La lista de deseos de '${state.username}' es privada en Discogs. Cámbiala a Pública en discogs.com/settings/privacy`, 'error');
          const privateModal = document.getElementById('private-wantlist-modal');
          if (privateModal) privateModal.style.display = 'flex';
          break;
        }
        
        const pageWants = parseWantlistHTML(html);
        let newItemsAdded = 0;
        
        if (pageWants.length > 0) {
          pageWants.forEach(item => {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              loadedWants.push(item);
              newItemsAdded++;
            }
          });
          
          log(`Página ${page}: +${newItemsAdded} discos nuevos (Total: ${loadedWants.length}).`);
          metricWantsCount.textContent = loadedWants.length;
          
          if (newItemsAdded === 0) {
            hasMore = false;
          } else {
            page++;
            // Pequeña pausa cortés entre páginas
            await new Promise(r => setTimeout(r, 600));
          }
        } else {
          hasMore = false;
        }
      } while (hasMore && page <= 100);
      
      if (loadedWants.length > 0) {
        log(`¡Wishlist completa cargada con éxito! (${loadedWants.length} discos).`, 'success');
      } else {
        throw new Error('No se encontraron discos en la Wishlist usando ninguno de los dos métodos.');
      }
    }
    
    state.wants = loadedWants;
    metricWantsCount.textContent = state.wants.length;

    // Persist wants to localStorage to survive mobile Safari memory drops / reloads
    try {
      const compact = loadedWants.map(w => ({
        id: w.id,
        title: w.title,
        artist: w.artist,
        image: w.image,
        isPriority: !!w.isPriority,
        haveCount: w.haveCount,
        wantCount: w.wantCount,
        year: w.year
      }));
      localStorage.setItem(`discogs_wants_cache_${(state.username || 'user').toLowerCase()}`, JSON.stringify(compact));
    } catch (cacheErr) {
      console.warn('Could not cache wants in localStorage:', cacheErr);
    }

    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('WANTLIST_LOAD_SUCCESS', `Wantlist cargada con éxito: ${loadedWants.length} discos`, {
          username: state.username,
          totalWants: loadedWants.length
        });
      }
    } catch (e) {}
    
    // Pre-calculate and render stats immediately when wantlist finishes loading
    calculateAndRenderStats();
    enrichWantlistStats();
    
    // Hide onboarding wizard and load wants manager
    showWantlistManager();
    
    // Update controls
    loadWantsBtn.textContent = '1. Cargar Lista de Deseos';
    loadWantsBtn.disabled = false;
    startScanBtn.disabled = false;
    if (refreshWantsBtn) {
      refreshWantsBtn.style.display = 'flex';
      refreshWantsBtn.disabled = false;
    }
    if (exportSheetsSidebarBtn) exportSheetsSidebarBtn.disabled = false;
    if (importLocalSheetSidebarBtn) importLocalSheetSidebarBtn.disabled = false;
    
  } catch (error) {
    log(`Error al cargar Wantlist: ${error.message}`, 'error');
    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('WANTLIST_LOAD_ERROR', `Error al cargar Wantlist: ${error.message}`, {
          username: state.username,
          error: error.message
        });
      }
    } catch (e) {}
    const privateModal = document.getElementById('private-wantlist-modal');
    if (privateModal) {
      privateModal.style.display = 'flex';
    } else {
      alert(`No pudimos cargar la Wantlist. Si tu lista está en modo Privado, cámbiala a "Pública" en Ajustes de Privacidad en Discogs.`);
    }
    loadWantsBtn.textContent = '1. Cargar Lista de Deseos';
    loadWantsBtn.disabled = false;
    if (refreshWantsBtn) refreshWantsBtn.disabled = false;
    
    // Restore wizard buttons on error
    if (wizardSyncBtn) {
      wizardSyncBtn.style.display = 'block';
      wizardSyncLoader.style.display = 'none';
    }
  }
}

// Helper to parse the Wantlist HTML page when API fails
function parseWantlistHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const wants = [];
  
  // Find all row elements
  let rows = doc.querySelectorAll('.shortcut_navigable, tr.shortcut_navigable, tr, .want_item, .release-card, [class*="want"]');
  if (rows.length === 0) {
    // Universal fallback: target all release links directly
    rows = doc.querySelectorAll('a[href*="/release/"]');
  }
  
  rows.forEach(row => {
    // Find all release links in row, prioritizing those with non-empty text
    const allLinks = Array.from(row.matches && row.matches('a[href*="/release/"]') ? [row] : row.querySelectorAll('a[href*="/release/"]'));
    const releaseLink = allLinks.find(a => (a.textContent || '').trim().length > 0) || allLinks[0];
    if (!releaseLink) return;
    
    const href = releaseLink.getAttribute('href') || '';
    const match = href.match(/\/release\/(\d+)/);
    if (!match) return;
    
    const id = parseInt(match[1], 10);
    
    // Avoid duplicates
    if (wants.some(w => w.id === id)) return;
    
    // Check specific sub-elements in Discogs table
    const artistEl = row.querySelector('.artist, [class*="artist"], a[href*="/artist/"]');
    const titleEl = row.querySelector('.item_description, .title, [class*="title"], [class*="release-title"]');
    
    let text = (releaseLink.textContent || '').trim();
    let artist = artistEl ? artistEl.textContent.trim() : '';
    let title = titleEl ? titleEl.textContent.trim() : '';
    
    // If not found in specific cells, parse from text
    if (!title && text) {
      let cleanText = text.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
      const parts = cleanText.split(/\s+[-–—]\s+/);
      if (parts.length >= 2) {
        if (!artist) artist = parts[0].trim();
        title = parts.slice(1).join(' - ').replace(/\s*\([^)]*\)\s*$/, '').trim();
      } else {
        title = cleanText.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    } else if (title && !artist && title.includes(' - ')) {
      const parts = title.split(/\s+[-–—]\s+/);
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
    
    if (!artist) artist = 'Desconocido';
    if (!title) title = 'Disco #' + id;
    
    // Clean trailing market copies info if present
    artist = artist.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
    title = title.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
    
    // Check if we can get the cover image
    const img = row.querySelector('img[data-src], img[srcset], img[src]');
    let image = '';
    if (img) {
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          const candidate = parts[parts.length - 1].split(/\s+/)[0];
          if (candidate && (candidate.startsWith('http://') || candidate.startsWith('https://'))) {
            image = candidate;
          }
        }
      }
      if (!image) {
        image = img.getAttribute('data-src') || img.getAttribute('src') || '';
      }
      image = upgradeDiscogsImageUrl(image);
    }

    // Extract want/have counts from row if present
    let rowWantCount = null;
    let rowHaveCount = null;
    const rowText = row.textContent.toLowerCase();
    const wantMatch = rowText.match(/(\d[\d.,]*)\s*(?:quieren|wants?)/i) || rowText.match(/(?:quieren|wants?)\S*\s*:?\s*(\d[\d.,]*)/i);
    if (wantMatch) rowWantCount = parseInt(wantMatch[1].replace(/[^\d]/g, ''), 10);
    const haveMatch = rowText.match(/(\d[\d.,]*)\s*(?:tienen|haves?)/i) || rowText.match(/(?:tienen|haves?)\S*\s*:?\s*(\d[\d.,]*)/i);
    if (haveMatch) rowHaveCount = parseInt(haveMatch[1].replace(/[^\d]/g, ''), 10);

    // Extract for sale count from row text (e.g. "3 en venta desde US$33,78" or "9 for sale from")
    let rowForSaleCount = 0;
    const forSaleMatch = rowText.match(/(\d[\d.,]*)\s*(?:en venta|for sale)/i);
    if (forSaleMatch) {
      rowForSaleCount = parseInt(forSaleMatch[1].replace(/[^\d]/g, ''), 10) || 0;
    }
    
    wants.push({
      id,
      title,
      artist,
      year: '',
      image,
      wantCount: rowWantCount,
      haveCount: rowHaveCount,
      forSaleCount: rowForSaleCount
    });
  });
  
  return wants;
}

// Step 2: Scan Single Release (Utility)
async function scanSingleRelease(item, index, totalWants, timeEstText = '') {
  const buyerCountryVal = (buyerCountry ? buyerCountry.value : 'Uruguay').trim().toLowerCase();
  const progress = Math.round(((index + 1) / totalWants) * 100);
  
  // Extract and clean display title and artist
  let displayTitle = (item.title || '').trim();
  let displayArtist = (item.artist || '').trim();

  // If title is missing/placeholder and artist has "Artist - Title"
  if ((!displayTitle || displayTitle === 'Título del Disco' || displayTitle === 'Unknown Title') && (displayArtist.includes(' - ') || displayArtist.includes(' – '))) {
    let clean = displayArtist.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
    const parts = clean.split(/\s+[-–—]\s+/);
    if (parts.length >= 2) {
      displayArtist = parts[0].trim();
      displayTitle = parts.slice(1).join(' - ').replace(/\s*\([^)]*\)\s*$/, '').trim();
    }
  } else if (!displayTitle || displayTitle === 'Título del Disco' || displayTitle === 'Unknown Title') {
    displayTitle = displayArtist || `Disco #${item.id}`;
    displayArtist = '';
  }

  // Clean copies/market info from displayArtist and displayTitle
  displayArtist = displayArtist.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
  displayTitle = displayTitle.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
  
  let labelPart = '';
  const parenMatch = displayTitle.match(/\s*\(([^)]+)\)\s*$/) || displayArtist.match(/\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    labelPart = parenMatch[1].trim();
    displayTitle = displayTitle.replace(/\s*\(([^)]+)\)\s*$/, '').trim();
  }

  // Update UI Progress & Hero Artwork
  statusTitle.textContent = `Escaneando disco ${index + 1} de ${totalWants}`;
  if (scanningEtaBadge) {
    const cleanEta = (timeEstText || '').replace(/^[ ·]+/, '').trim();
    scanningEtaBadge.textContent = cleanEta || 'Calculando tiempo...';
  }
  progressBar.style.width = `${progress}%`;
  progressText.textContent = `Analizando: ${displayArtist ? displayArtist + ' - ' : ''}${displayTitle}...`;
  progressPercent.textContent = `${progress}%`;

  // Update Hero Metadata Info
  if (scanningTitle) scanningTitle.textContent = displayTitle || 'Disco sin título';
  if (scanningArtist) {
    scanningArtist.textContent = labelPart ? `${displayArtist || 'Artista'} • ${labelPart}` : (displayArtist || 'Artista');
  }
  if (scanningBadgeStep) scanningBadgeStep.textContent = `Disco ${index + 1} de ${totalWants}`;
  if (scanningPriorityTag) scanningPriorityTag.style.display = item.isPriority ? 'flex' : 'none';
  if (scanningOffersBadge) {
    scanningOffersBadge.textContent = 'Buscando ofertas...';
    scanningOffersBadge.className = 'text-[11px] font-semibold bg-primary/10 text-primary border border-primary/25 px-2.5 py-0.5 rounded-full';
  }

  // Update Cover Art Preview with high resolution image
  const highResImage = upgradeDiscogsImageUrl(item.image || '');
  if (window.Motion) {
    window.Motion.updateCoverArt(highResImage, displayTitle);
  } else {
    const scanningCoverArt = document.getElementById('scanning-cover-art');
    const coverPlaceholder = document.getElementById('cover-placeholder');
    if (scanningCoverArt) {
      if (highResImage) {
        scanningCoverArt.style.backgroundImage = `url('${highResImage}')`;
        if (coverPlaceholder) coverPlaceholder.style.display = 'none';
      } else {
        scanningCoverArt.style.backgroundImage = '';
        if (coverPlaceholder) coverPlaceholder.style.display = 'block';
      }
    }
  }

  // Helper to update live offers badge once listings are known
  const updateOffersDisplay = (list) => {
    if (scanningOffersBadge) {
      if (list && list.length > 0) {
        const prices = list.map(l => l.priceNum).filter(p => !isNaN(p) && p > 0);
        let minPriceStr = '';
        if (prices.length > 0) {
          const minP = Math.min(...prices);
          minPriceStr = ` · desde ${formatPrice(minP, list[0].currencyCode || 'USD')}`;
        }
        scanningOffersBadge.textContent = `${list.length} en venta${minPriceStr}`;
        scanningOffersBadge.className = 'text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full';
      } else {
        scanningOffersBadge.textContent = 'Sin copias en venta';
        scanningOffersBadge.className = 'text-[11px] font-semibold bg-surface-container text-tertiary border border-outline-variant/30 px-2.5 py-0.5 rounded-full';
      }
    }
  };
  
  let parsedListings = null;
  let isFromCache = false;
  let cacheAgeHours = 0;
  let communityStats = null;
  let totalWorldListings = 0;
  let unshippableCount = 0;
  let unshippableLocations = [];
  
  // Try fetching from chrome.storage.local or localStorage cache first (if user enabled cache)
  const isCacheEnabled = localStorage.getItem('use_scan_cache') !== 'false' && (!useCacheCheckbox || useCacheCheckbox.checked);
  if (isCacheEnabled) {
    try {
      const cacheKey = `release_${item.id}_${buyerCountryVal}`;
      let cacheData = null;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        cacheData = await new Promise(resolve => {
          chrome.storage.local.get([cacheKey], (result) => {
            resolve(result[cacheKey] || null);
          });
        });
      } else {
        const localRaw = localStorage.getItem(cacheKey);
        if (localRaw) {
          try { cacheData = JSON.parse(localRaw); } catch (e) {}
        }
      }
      
      if (cacheData && cacheData.version === 3) {
        const now = Date.now();
        cacheAgeHours = (now - cacheData.timestamp) / (1000 * 60 * 60);
        
        // Priority items get live updates if cache is older than 2h; standard items if older than 6h
        const maxAgeAllowed = item.isPriority ? 2.0 : 6.0;
        
        if (cacheAgeHours < maxAgeAllowed) {
          parsedListings = cacheData.listings;
          communityStats = cacheData.communityStats || null;
          totalWorldListings = cacheData.totalWorldListings !== undefined ? cacheData.totalWorldListings : (item.forSaleCount || (parsedListings ? parsedListings.length : 0));
          unshippableCount = cacheData.unshippableCount || 0;
          unshippableLocations = cacheData.unshippableLocations || [];
          isFromCache = true;
        }
      }
    } catch (cacheErr) {
      console.warn('Error reading from cache:', cacheErr);
    }
  }
  
  if (isFromCache && parsedListings) {
    const priorityTag = item.isPriority ? ' ★ Prioritario' : '';
    log(`[Caché${priorityTag}] Cargadas ${parsedListings.length} copias en venta para este disco (hace ${Math.round(cacheAgeHours * 10) / 10}h).`, 'success');
    updateOffersDisplay(parsedListings);
    return { 
      listings: parsedListings, 
      communityStats: communityStats, 
      isFromCache: true,
      totalWorldListings: totalWorldListings,
      unshippableCount: unshippableCount,
      unshippableLocations: unshippableLocations
    };
  }
  
  log(`Escaneando en vivo (${index + 1}/${totalWants}${timeEstText}): ${item.artist} - ${item.title}...`);
  
  try {
    const url = `https://www.discogs.com/sell/release/${item.id}?limit=100`;
    const html = await fetchThroughTab(url);
    const result = parseReleaseHTML(html, item.id);
    parsedListings = result.listings;
    communityStats = result.communityStats;
    totalWorldListings = result.totalWorldListings !== undefined ? result.totalWorldListings : (item.forSaleCount || (parsedListings ? parsedListings.length : 0));
    unshippableCount = result.unshippableCount || 0;
    unshippableLocations = result.unshippableLocations || [];
    updateOffersDisplay(parsedListings);
    
    // Save to cache with version 3 tag
    const cacheObj = {
      timestamp: Date.now(),
      version: 3,
      listings: parsedListings,
      communityStats: communityStats,
      totalWorldListings: totalWorldListings,
      unshippableCount: unshippableCount,
      unshippableLocations: unshippableLocations
    };
    const cacheKey = `release_${item.id}_${buyerCountryVal}`;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [cacheKey]: cacheObj });
    } else {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
      } catch (err) {}
    }
    
    return { 
      listings: parsedListings, 
      communityStats: communityStats, 
      isFromCache: false,
      totalWorldListings: totalWorldListings,
      unshippableCount: unshippableCount,
      unshippableLocations: unshippableLocations
    };
  } catch (e) {
    // If Discogs session is expired or requires human verification, bubble up immediately
    if (e && (e.isSessionExpired || (e.message && (e.message.includes('401') || e.message.toLowerCase().includes('session expired'))))) {
      throw e;
    }
    // If rate-limited, flag for batch throttle
    if (e && (e.isRateLimited || (e.message && e.message.includes('429')))) {
      state.rateLimitTriggered = true;
    }
    log(`Error al escanear release ${item.id}: ${e.message}`, 'error');
    updateOffersDisplay([]);
    return { 
      listings: [], 
      communityStats: null, 
      isFromCache: false,
      totalWorldListings: item.forSaleCount || 0,
      unshippableCount: 0,
      unshippableLocations: []
    };
  }
}

// Step 3: Start Marketplace Scan
async function startMarketplaceScan(startIndex = 0) {
  // Ensure startIndex is a valid number (handles PointerEvent from button click event listeners)
  if (typeof startIndex !== 'number') {
    startIndex = 0;
  }
  if (state.wants.length === 0) return;
  
  state.isScanning = true;
  state.cancelRequested = false;
  state.rateLimitTriggered = false;
  
  // Lock filters dynamically while scanning
  toggleFiltersState(false);
  
  if (startIndex === 0) {
    state.allListings = [];
    state.groupedSellers = [];
    statusLogs.innerHTML = '';
    logEventCount = 0;
    if (logCountBadge) logCountBadge.textContent = '0 eventos';
    if (logLatestTicker) logLatestTicker.textContent = 'Iniciando escaneo del marketplace...';
    log('Iniciando escaneo del marketplace...');
    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('SCAN_STARTED', `Iniciando escaneo del marketplace para ${state.wants.length} discos`, {
          username: state.username,
          totalWants: state.wants.length,
          startIndex
        });
      }
    } catch (e) {}
  } else {
    log(`Reanudando escaneo del marketplace desde el disco ${startIndex + 1}...`, 'info');
    try {
      if (window.Telemetry?.track) {
        window.Telemetry.track('SCAN_RESUMED', `Reanudando escaneo desde disco ${startIndex + 1}`, {
          username: state.username,
          startIndex
        });
      }
    } catch (e) {}
  }
  
  startScanBtn.disabled = true;
  loadWantsBtn.disabled = true;
  const refreshWantsBtn = document.getElementById('refresh-wants-btn');
  if (refreshWantsBtn) refreshWantsBtn.disabled = true;
  if (logoVinyl) logoVinyl.classList.add('spinning');
  
  // Show progress panel with animation, start radar shader and trigger turntable spinning
  startRadarShaderCanvas();
  if (window.Motion) {
    window.Motion.showScanCard();
  } else {
    statusCard.style.display = 'block';
  }
  if (scanLoggerDock) scanLoggerDock.style.display = 'block';
  
  // Reset cover art preview & hero text
  if (scanningArtist) scanningArtist.textContent = 'Iniciando análisis...';
  if (scanningTitle) scanningTitle.textContent = 'Preparando colección...';
  if (scanningBadgeStep) scanningBadgeStep.textContent = `0 de ${state.wants.length}`;
  if (scanningOffersBadge) scanningOffersBadge.textContent = 'Preparando...';
  if (scanningPriorityTag) scanningPriorityTag.style.display = 'none';

  const scanningCoverArt = document.getElementById('scanning-cover-art');
  const coverPlaceholder = document.getElementById('cover-placeholder');
  if (scanningCoverArt) {
    scanningCoverArt.style.backgroundImage = '';
    if (coverPlaceholder) coverPlaceholder.style.display = 'block';
  }
  
  emptyState.style.display = 'none';
  wantlistManager.style.display = 'none';
  resultsGrid.style.display = 'none';
  noResultsState.style.display = 'none';
  
  const headerNavRow = document.getElementById('header-nav-row');
  if (headerNavRow) headerNavRow.style.display = 'none';
  const tabNavigation = document.getElementById('tab-navigation');
  if (tabNavigation) tabNavigation.style.display = 'none';
  const filterToolbar = document.getElementById('filter-toolbar');
  if (filterToolbar) filterToolbar.style.display = 'none';
  const statsView = document.getElementById('stats-view');
  if (statsView) statsView.style.display = 'none';
  const tabBtnSellers = document.getElementById('tab-btn-sellers');
  const tabBtnStats = document.getElementById('tab-btn-stats');
  if (tabBtnSellers && tabBtnStats) {
    tabBtnSellers.classList.add('active');
    tabBtnStats.classList.remove('active');
  }
  
  // Sort wants so priority/starred items are scanned FIRST
  state.wants.sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0));

  const scanStartTime = Date.now();
  let liveScannedCount = 0;
  let currentBatchSize = 3;
  let cooldownItemsLeft = 0;
  
  try {
    for (let i = startIndex; i < state.wants.length; i += currentBatchSize) {
      if (state.cancelRequested) {
        log('Escaneo cancelado por el usuario.', 'error');
        break;
      }
      
      // Adaptive batch throttling: if rate limit was triggered, switch to serial (1 by 1)
      if (state.rateLimitTriggered || cooldownItemsLeft > 0) {
        if (state.rateLimitTriggered) {
          state.rateLimitTriggered = false;
          cooldownItemsLeft = 4;
          log('[Throttling Inteligente] Reduciendo concurrencia a 1 consulta por lote para restablecer margen de API...', 'action');
        } else {
          cooldownItemsLeft--;
        }
        currentBatchSize = 1;
      } else {
        currentBatchSize = 3;
      }

      const batchItems = state.wants.slice(i, i + currentBatchSize);
      const remainingCount = state.wants.length - i;
      const elapsedTimeSec = (Date.now() - scanStartTime) / 1000;
      const avgSecPerItem = liveScannedCount > 0 ? (elapsedTimeSec / liveScannedCount) : 0.4;
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
      
      // Execute batch in parallel
      const results = await Promise.all(
        batchItems.map((item, bIdx) => scanSingleRelease(item, i + bIdx, state.wants.length, timeEstText))
      );
      
      let hasLiveFetch = false;
      results.forEach((result, bIdx) => {
        const item = batchItems[bIdx];
        if (!result.isFromCache) {
          liveScannedCount++;
          hasLiveFetch = true;
        }
        state.allListings.push(...result.listings);
        
        item.totalWorldListings = result.totalWorldListings !== undefined 
          ? result.totalWorldListings 
          : (item.forSaleCount || (result.listings ? result.listings.length : 0));
        item.unshippableCount = result.unshippableCount || 0;
        item.unshippableLocations = result.unshippableLocations || [];

        if (result.communityStats) {
          if (result.communityStats.wantCount !== null && result.communityStats.wantCount !== undefined) item.wantCount = result.communityStats.wantCount;
          if (result.communityStats.haveCount !== null && result.communityStats.haveCount !== undefined) item.haveCount = result.communityStats.haveCount;
          if (result.communityStats.lowPrice) item.lowPrice = result.communityStats.lowPrice;
          if (result.communityStats.highPrice) item.highPrice = result.communityStats.highPrice;
          if (result.communityStats.ratingValue) item.ratingValue = result.communityStats.ratingValue;
          if (result.communityStats.catalogNumber) item.catalogNumber = result.communityStats.catalogNumber;
          if (result.communityStats.recordLabel) item.recordLabel = result.communityStats.recordLabel;
        }
      });
      
      // Update stats on-the-fly
      const uniqueSellers = new Set(state.allListings.map(l => l.sellerName));
      if (metricSellersCount) metricSellersCount.textContent = uniqueSellers.size;
      if (metricMatchesCount) metricMatchesCount.textContent = state.allListings.length;
      const liveTickerSellers = document.getElementById('ticker-sellers-count');
      if (liveTickerSellers) liveTickerSellers.textContent = uniqueSellers.size.toLocaleString();
      const liveTickerMatches = document.getElementById('ticker-matches-count');
      if (liveTickerMatches) liveTickerMatches.textContent = state.allListings.length.toLocaleString();
      
      // Save scan session progress
      saveScanSession(Math.min(i + currentBatchSize - 1, state.wants.length - 1));
      
      // Short pause between live batches to respect Discogs server limits
      if (hasLiveFetch) {
        const pauseDelay = currentBatchSize === 1 ? 900 : 600;
        await new Promise(resolve => setTimeout(resolve, pauseDelay));
      }
    }
    
    // Close background tab if we opened one
    if (state.proxyTabId !== null) {
      chrome.tabs.remove(state.proxyTabId);
      state.proxyTabId = null;
    }
    
    log('Escaneo completado. Procesando y agrupando resultados...', 'success');
    
    // Group and show results
    groupListingsBySeller();
    renderResults();
    
  } catch (error) {
    if (error && (error.isSessionExpired || (error.message && (error.message.includes('401') || error.message.toLowerCase().includes('session expired'))))) {
      log('⚠️ [Sesión Expirada] Tu sesión en Discogs ha caducado o requiere verificación.', 'error');
      if (typeof showToast === 'function') {
        showToast('Sesión de Discogs expirada. Inicia sesión en Discogs y presiona "Reanudar".', 'error', 10000);
      }
      alert('Tu sesión en Discogs ha expirado o requiere resolver una verificación de navegador.\n\n1. Inicia sesión en tu cuenta de Discogs en una pestaña.\n2. Vuelve a este Dashboard y presiona "Reanudar Búsqueda" para continuar exactamente donde quedaste.');
    } else {
      log(`Error crítico durante el escaneo: ${error.message}`, 'error');
    }
  } finally {
    state.isScanning = false;
    startScanBtn.disabled = false;
    loadWantsBtn.disabled = false;
    const refreshWantsBtn = document.getElementById('refresh-wants-btn');
    if (refreshWantsBtn) refreshWantsBtn.disabled = false;
    if (logoVinyl) logoVinyl.classList.remove('spinning');
    stopRadarShaderCanvas();
    if (window.Motion) {
      window.Motion.hideScanCard();
    } else {
      statusCard.style.display = 'none';
    }
    if (scanLoggerDock) scanLoggerDock.style.display = 'none';
    
    // Reset cover art preview
    const scanningCoverArt = document.getElementById('scanning-cover-art');
    const coverPlaceholder = document.getElementById('cover-placeholder');
    if (scanningCoverArt) {
      scanningCoverArt.style.backgroundImage = '';
      if (coverPlaceholder) coverPlaceholder.style.display = 'block';
    }

    // Enable filters back if results exist
    if (state.allListings.length > 0 && state.groupedSellers.length > 0) {
      toggleFiltersState(true);
      // Clear session only if finished completely without cancellation
      if (!state.cancelRequested) {
        clearScanSession();
      }
      currentAppView = 'results-sellers';
      try {
        if (window.Telemetry?.track) {
          window.Telemetry.track('SCAN_COMPLETED', `Escaneo completado: ${state.groupedSellers.length} vendedores con stock, ${state.allListings.length} ofertas`, {
            username: state.username,
            sellersFound: state.groupedSellers.length,
            listingsFound: state.allListings.length,
            cancelled: state.cancelRequested
          });
        }
      } catch (e) {}
    } else {
      toggleFiltersState(false);
      if (state.wants && state.wants.length > 0) {
        navigateToView('wantlist', false);
      } else {
        navigateToView('wizard-1', false);
      }

      if (typeof showToast === 'function' && !state.cancelRequested) {
        if (!IS_EXTENSION) {
          showToast('Análisis finalizado. En la web móvil, Discogs restringe peticiones en vivo por CORS. Para cruzar vendedores en vivo ilimitado, usa la extensión de Chrome.', 'info', 6000);
        } else {
          showToast('No se encontraron copias en venta para los filtros seleccionados.', 'info', 4000);
        }
      }

      try {
        if (window.Telemetry?.track && !state.cancelRequested) {
          window.Telemetry.track('SCAN_ZERO_RESULTS', `Escaneo finalizado sin resultados para ${state.wants ? state.wants.length : 0} discos`, {
            username: state.username,
            wantsCount: state.wants ? state.wants.length : 0
          });
        }
      } catch (e) {}
    }
    updateForwardAndBackButtons();
  }
}

// Step 4: Incremental Wantlist Refresh
async function refreshWantlistIncremental() {
  if (state.isScanning) return;
  
  const refreshWantsBtn = document.getElementById('refresh-wants-btn');
  if (!refreshWantsBtn) return;
  
  refreshWantsBtn.disabled = true;
  refreshWantsBtn.classList.add('spinning-btn');
  log('Iniciando actualización incremental del Wantlist...', 'info');
  
  try {
    let newWants = [];
    let page = 1;
    let totalPages = 1;
    
    try {
      do {
        log(`Cargando página ${page} de la API de Discogs para refrescar...`);
        const jsonText = await fetchDirect(`https://api.discogs.com/users/${state.username}/wants?page=${page}&per_page=100`);
        const data = JSON.parse(jsonText);
        
        if (data && data.wants && data.wants.length > 0) {
          const pageWants = data.wants.map(item => ({
            id: item.id,
            title: item.basic_information.title,
            artist: item.basic_information.artists.map(a => a.name).join(', '),
            year: item.basic_information.year,
            image: item.basic_information.cover_image || item.basic_information.thumb || '',
            wantCount: (item.basic_information.community && (item.basic_information.community.want || item.basic_information.community.in_wantlist)) || 0,
            haveCount: (item.basic_information.community && item.basic_information.community.have) || 0,
            forSaleCount: (item.basic_information && (item.basic_information.num_for_sale || item.basic_information.numForSale)) || item.num_for_sale || 0
          }));
          newWants.push(...pageWants);
          totalPages = data.pagination.pages;
          page++;
          
          if (page <= totalPages) {
            await new Promise(r => setTimeout(r, 1200));
          }
        } else {
          break;
        }
      } while (page <= totalPages);
      
    } catch (apiError) {
      log(`La API falló al refrescar (${apiError.message}). Usando método alternativo de raspado HTML...`, 'warning');
      let page = 1;
      newWants = [];
      let hasMore = true;
      do {
        const html = await fetchThroughTab(`https://www.discogs.com/wantlist?user=${state.username}&limit=250&page=${page}`);
        const pageWants = parseWantlistHTML(html);
        if (pageWants && pageWants.length > 0) {
          newWants.push(...pageWants);
          page++;
          await new Promise(r => setTimeout(r, 1200));
        } else {
          hasMore = false;
        }
      } while (hasMore);
    }
    
    if (newWants.length === 0) {
      log('No se pudo obtener el Wantlist o está vacío.', 'error');
      refreshWantsBtn.disabled = false;
      refreshWantsBtn.classList.remove('spinning-btn');
      return;
    }
    
    const newlyAddedWants = newWants.filter(nw => !state.wants.some(ow => ow.id === nw.id));
    const removedWants = state.wants.filter(ow => !newWants.some(nw => nw.id === ow.id));
    
    log(`Resultados de comparación: +${newlyAddedWants.length} nuevos discos, -${removedWants.length} eliminados.`, 'info');
    
    if (removedWants.length > 0) {
      state.wants = state.wants.filter(ow => newWants.some(nw => nw.id === ow.id));
      state.allListings = state.allListings.filter(l => newWants.some(nw => nw.id === l.releaseId));
    }
    
    metricWantsCount.textContent = state.wants.length;
    
    if (newlyAddedWants.length > 0) {
      state.isScanning = true;
      state.cancelRequested = false;
      
      state.wants.push(...newlyAddedWants);
      metricWantsCount.textContent = state.wants.length;
      
      statusCard.style.display = 'block';
      if (scanLoggerDock) scanLoggerDock.style.display = 'block';
      startRadarShaderCanvas();
      const turntableVinyl = document.getElementById('turntable-vinyl');
      if (turntableVinyl) turntableVinyl.classList.add('spinning');
      if (logoVinyl) logoVinyl.classList.add('spinning');
      
      log(`Escaneando ${newlyAddedWants.length} nuevos discos en venta...`);
      
      for (let i = 0; i < newlyAddedWants.length; i += BATCH_SIZE) {
        if (state.cancelRequested) {
          log('Actualización incremental cancelada por el usuario.', 'error');
          break;
        }
        
        const batchItems = newlyAddedWants.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batchItems.map((item, bIdx) => scanSingleRelease(item, i + bIdx, newlyAddedWants.length))
        );
        
        let hasLiveFetch = false;
        results.forEach((result, bIdx) => {
          const item = batchItems[bIdx];
          if (!result.isFromCache) hasLiveFetch = true;
          state.allListings.push(...result.listings);
          item.totalWorldListings = result.totalWorldListings !== undefined 
            ? result.totalWorldListings 
            : (item.forSaleCount || (result.listings ? result.listings.length : 0));
          item.unshippableCount = result.unshippableCount || 0;
          item.unshippableLocations = result.unshippableLocations || [];
          if (result.communityStats) {
            if (result.communityStats.wantCount !== null) item.wantCount = result.communityStats.wantCount;
            if (result.communityStats.haveCount !== null) item.haveCount = result.communityStats.haveCount;
          }
        });
        
        const uniqueSellers = new Set(state.allListings.map(l => l.sellerName));
        metricSellersCount.textContent = uniqueSellers.size;
        metricMatchesCount.textContent = state.allListings.length;
        
        if (hasLiveFetch) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      }
      
      if (state.proxyTabId !== null) {
        chrome.tabs.remove(state.proxyTabId);
        state.proxyTabId = null;
      }
      
      log('Escaneo de nuevos discos completado.', 'success');
    }
    
    log('Procesando y agrupando resultados actualizados...', 'success');
    groupListingsBySeller();
    renderResults();
    
    const tabBtnStats = document.getElementById('tab-btn-stats');
    if (tabBtnStats && tabBtnStats.classList.contains('active')) {
      calculateAndRenderStats();
    }
    
    alert(`¡Actualización incremental exitosa!\nSe agregaron ${newlyAddedWants.length} discos y se removieron ${removedWants.length}.`);
    
  } catch (error) {
    log(`Error en la actualización incremental: ${error.message}`, 'error');
    alert(`Error al actualizar incrementalmente: ${error.message}`);
  } finally {
    state.isScanning = false;
    if (logoVinyl) logoVinyl.classList.remove('spinning');
    statusCard.style.display = 'none';
    if (scanLoggerDock) scanLoggerDock.style.display = 'none';
    stopRadarShaderCanvas();
    const turntableVinyl = document.getElementById('turntable-vinyl');
    if (turntableVinyl) turntableVinyl.classList.remove('spinning');
    
    const scanningCoverArt = document.getElementById('scanning-cover-art');
    const coverPlaceholder = document.getElementById('cover-placeholder');
    if (scanningCoverArt) {
      scanningCoverArt.style.backgroundImage = '';
      if (coverPlaceholder) coverPlaceholder.style.display = 'block';
    }
    
    refreshWantsBtn.disabled = false;
    refreshWantsBtn.classList.remove('spinning-btn');
  }
}

// Cancel current scan
function cancelScan() {
  state.cancelRequested = true;
  cancelScanBtn.textContent = 'Cancelando...';
  log('Solicitando cancelación del escaneo...');
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('SCAN_CANCELLED', 'Usuario solicitó cancelar el escaneo', { username: state.username });
    }
  } catch (e) {}
}

// Robust helper to parse prices and shipping costs taking into account different locale formats (dots vs commas)
function parseLocalePrice(cleanPrice, currency) {
  if (!cleanPrice) return 0;
  
  // Non-decimal currencies (JPY, UYU, ARS, CLP, COP): remove all dots and commas
  const nonDecimalCurrencies = ['JPY', 'UYU', 'ARS', 'CLP', 'COP'];
  if (nonDecimalCurrencies.includes(currency)) {
    return parseFloat(cleanPrice.replace(/[.,]/g, '')) || 0;
  }

  const hasDot = cleanPrice.includes('.');
  const hasComma = cleanPrice.includes(',');

  if (hasDot && hasComma) {
    const lastDotIndex = cleanPrice.lastIndexOf('.');
    const lastCommaIndex = cleanPrice.lastIndexOf(',');
    if (lastCommaIndex > lastDotIndex) {
      // European format: 1.250,50 -> 1250.50
      const numStr = cleanPrice.replace(/\./g, '').replace(',', '.');
      return parseFloat(numStr) || 0;
    } else {
      // US/UK format: 1,250.50 -> 1250.50
      const numStr = cleanPrice.replace(/,/g, '');
      return parseFloat(numStr) || 0;
    }
  } else if (hasComma && !hasDot) {
    const parts = cleanPrice.split(',');
    if (parts[1] && parts[1].length === 3 && currency === 'EUR') {
      // e.g. 1,250 EUR (thousands)
      return parseFloat(cleanPrice.replace(',', '')) || 0;
    }
    // Single comma decimal: 25,50 -> 25.50
    return parseFloat(cleanPrice.replace(',', '.')) || 0;
  } else if (hasDot && !hasComma) {
    const parts = cleanPrice.split('.');
    if (parts[1] && parts[1].length === 3 && (currency === 'EUR' || currency === 'BRL')) {
      // e.g. 1.250 EUR (thousands)
      return parseFloat(cleanPrice.replace('.', '')) || 0;
    }
    return parseFloat(cleanPrice) || 0;
  }
  
  return parseFloat(cleanPrice) || 0;
}

// Parse release HTML response using DOMParser
function parseReleaseHTML(html, releaseId) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const listings = [];
  
  // Extract community stats for the release (Haves / Wants)
  let haveCount = null;
  let wantCount = null;

  try {
    // Direct selector for Discogs stats links: <a href="/release/stats/32241999">17</a>
    const statsAnchors = doc.querySelectorAll('a[href*="/release/stats/"]');
    statsAnchors.forEach(a => {
      const cleanText = a.textContent.trim();
      const num = parseInt(cleanText.replace(/[^\d]/g, ''), 10);
      if (isNaN(num) || num <= 0) return;

      const parentText = (a.parentElement ? a.parentElement.textContent : '').toLowerCase();
      const containerText = (a.closest('tr, li, div, section') ? a.closest('tr, li, div, section').textContent : '').toLowerCase();
      const contextText = parentText + ' ' + containerText;

      if (contextText.includes('quieren') || contextText.includes('want')) {
        if (wantCount === null) wantCount = num;
      } else if (contextText.includes('tienen') || contextText.includes('have')) {
        if (haveCount === null) haveCount = num;
      }
    });

    // Fallback: Check __NEXT_DATA__ JSON script tag if present
    if (wantCount === null || haveCount === null) {
      const nextDataScript = doc.querySelector('script#__NEXT_DATA__');
      if (nextDataScript && nextDataScript.textContent) {
        try {
          const nextData = JSON.parse(nextDataScript.textContent);
          const relData = nextData?.props?.pageProps?.release || nextData?.props?.pageProps?.data;
          if (relData) {
            if (relData.community?.want && wantCount === null) wantCount = parseInt(relData.community.want, 10);
            if (relData.community?.have && haveCount === null) haveCount = parseInt(relData.community.have, 10);
            if (relData.num_want && wantCount === null) wantCount = parseInt(relData.num_want, 10);
            if (relData.num_have && haveCount === null) haveCount = parseInt(relData.num_have, 10);
          }
        } catch (e) {}
      }
    }

    // Fallback: Precise regex matching on "miembros quieren esto" or "quieren esto"
    if (wantCount === null || haveCount === null) {
      const bodyText = doc.body ? doc.body.textContent : html;

      if (wantCount === null) {
        const esWantText = bodyText.match(/(\d[\d.,]*)\s*(?:miembros\s*)?quieren\s*esto/i) ||
                           bodyText.match(/(\d[\d.,]*)\s*people\s*want\s*this/i) ||
                           bodyText.match(/(?:lo quieren|quieren)\s*:\s*(\d[\d.,]*)/i);
        if (esWantText) {
          const num = parseInt(esWantText[1].replace(/[^\d]/g, ''), 10);
          if (!isNaN(num) && num > 0) wantCount = num;
        }
      }

      if (haveCount === null) {
        const esHaveText = bodyText.match(/(\d[\d.,]*)\s*(?:miembros\s*)?tienen\s*esto/i) ||
                           bodyText.match(/(\d[\d.,]*)\s*people\s*have\s*this/i) ||
                           bodyText.match(/(?:lo tienen|tienen)\s*:\s*(\d[\d.,]*)/i);
        if (esHaveText) {
          const num = parseInt(esHaveText[1].replace(/[^\d]/g, ''), 10);
          if (!isNaN(num) && num > 0) haveCount = num;
        }
      }
    }
  } catch (err) {
    console.warn('Error parsing community stats:', err);
  }

  // Extract structured JSON-LD metadata schema if available
  let lowPrice = null;
  let highPrice = null;
  let ratingValue = null;
  let catalogNumber = null;
  let recordLabel = null;

  let jsonLdOffersCount = 0;
  try {
    const jsonLdEl = doc.querySelector('script#release_schema, script[type="application/ld+json"]');
    if (jsonLdEl) {
      const data = JSON.parse(jsonLdEl.textContent);
      if (data) {
        if (data.catalogNumber) catalogNumber = data.catalogNumber;
        if (data.recordLabel && Array.isArray(data.recordLabel) && data.recordLabel[0]?.name) {
          recordLabel = data.recordLabel[0].name;
        } else if (data.recordLabel?.name) {
          recordLabel = data.recordLabel.name;
        }
        if (data.aggregateRating?.ratingValue) ratingValue = parseFloat(data.aggregateRating.ratingValue);
        if (data.offers) {
          lowPrice = parseFloat(data.offers.lowPrice) || null;
          highPrice = parseFloat(data.offers.highPrice) || null;
          if (data.offers.offerCount != null) {
            jsonLdOffersCount = parseInt(data.offers.offerCount, 10) || 0;
          } else if (Array.isArray(data.offers)) {
            jsonLdOffersCount = data.offers.length;
          }
        }
      }
    }
  } catch (ldErr) {
    console.warn('Error parsing release_schema JSON-LD:', ldErr);
  }
  
  // Find listings rows
  let rows = doc.querySelectorAll('.shortcut_navigable');
  
  if (rows.length === 0) {
    rows = doc.querySelectorAll('tr[class*="shortcut_navigable"], .listing_row, tr');
    rows = Array.from(rows).filter(r => r.querySelector('.seller_info, [class*="seller"]'));
  }
  
  const rawRowsCount = rows.length;
  let unshippableCount = 0;
  const unshippableLocations = [];

  rows.forEach(row => {
    try {
      // Check if seller does not ship to buyer's location (skip them)
      const rowTextLower = row.textContent.toLowerCase();
      if (
        rowTextLower.includes('no disponible en') || 
        rowTextLower.includes('does not ship') || 
        rowTextLower.includes('not available in') ||
        rowTextLower.includes('no hace envíos') ||
        rowTextLower.includes('no envia a') ||
        rowTextLower.includes('no envía a')
      ) {
        unshippableCount++;
        // Capture seller location if available
        const sellerInfoText = row.querySelector('.seller_info')?.textContent || '';
        let shipsFrom = '';
        if (sellerInfoText.toLowerCase().includes('ships from:') || sellerInfoText.toLowerCase().includes('desde:')) {
          const parts = sellerInfoText.split(/(?:Ships From:|Desde:)/i);
          if (parts.length > 1) {
            shipsFrom = parts[1].split('\n')[0].trim();
          }
        } else {
          const locationEl = row.querySelector('.seller_info li:nth-child(3), .seller_info span:nth-child(3)');
          if (locationEl) shipsFrom = locationEl.textContent.trim();
        }
        if (shipsFrom) {
          shipsFrom = shipsFrom.replace(/[\n\r]/g, '').trim();
          if (shipsFrom && !unshippableLocations.includes(shipsFrom)) {
            unshippableLocations.push(shipsFrom);
          }
        }
        return; // Skip this listing
      }

      // 1. Seller Name (extracted from href to prevent issues with browser translations)
      const sellerLink = row.querySelector('.seller_info a, a[href^="/user/"], [class*="seller"] a');
      if (!sellerLink) return;
      
      let sellerName = '';
      const href = sellerLink.getAttribute('href') || '';
      const sellerMatch = href.match(/\/seller\/([^/]+)\/profile/i);
      const userMatch = href.match(/\/user\/([^/?#]+)/i);
      
      if (sellerMatch) {
        sellerName = decodeURIComponent(sellerMatch[1]);
      } else if (userMatch) {
        sellerName = decodeURIComponent(userMatch[1]);
      } else {
        sellerName = sellerLink.textContent.trim();
      }
      
      if (!sellerName || sellerName.toLowerCase() === 'view seller profile' || sellerName.toLowerCase() === 'vendedor') return;
      
      // 2. Seller Rating and Ratings Count
      const sellerInfoEl = row.querySelector('.seller_info, [class*="seller_info"], [class*="seller-info"]');
      const sellerInfoText = sellerInfoEl?.textContent || row.textContent || '';
      let rating = 100;
      let ratingCount = 0;
      
      const ratingMatch = sellerInfoText.match(/(\d+(?:\.\d+)?)\%/);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      }
      
      // Look for reviews count in explicit review/history/feedback links first
      const reviewLink = row.querySelector('a[href*="/history"], a[href*="/reviews"], a[href*="/feedback"]');
      if (reviewLink) {
        const matchNum = reviewLink.textContent.match(/([\d.,]+)/);
        if (matchNum) {
          const cleanNum = matchNum[1].replace(/[.,]/g, '');
          if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
        }
      }
      
      if (!ratingCount) {
        // Pattern 1: With parens, e.g. (5,420 ratings), (5.420 valoraciones), (120)
        const countMatch = sellerInfoText.match(/\(([\d.,]+)\s*(?:ratings?|valoraciones|calificaciones|evaluaciones|bewertungen)?\)/i);
        if (countMatch) {
          const cleanNum = countMatch[1].replace(/[.,]/g, '');
          if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
        } else {
          // Pattern 2: Without parens, e.g. 99.5%, 1,234 ratings or 5.420 valoraciones
          const altCount = sellerInfoText.match(/(?:%[,\s]+|ratings?|valoraciones|calificaciones|evaluaciones)[:\s]*([\d.,]+)/i)
            || sellerInfoText.match(/([\d.,]+)\s*(?:ratings?|valoraciones|calificaciones|evaluaciones|bewertungen)/i);
          if (altCount) {
            const cleanNum = altCount[1].replace(/[.,]/g, '');
            if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
          }
        }
      }
      
      // 3. Ships From
      let shipsFrom = 'Unknown';
      const shipsFromText = sellerInfoText.toLowerCase();
      if (shipsFromText.includes('ships from:') || shipsFromText.includes('desde:')) {
        const parts = sellerInfoText.split(/(?:Ships From:|Desde:)/i);
        if (parts.length > 1) {
          shipsFrom = parts[1].split('\n')[0].trim();
        }
      } else {
        const locationEl = row.querySelector('.seller_info li:nth-child(3), .seller_info span:nth-child(3)');
        if (locationEl) shipsFrom = locationEl.textContent.trim();
      }
      
      // Clean shipsFrom location string
      shipsFrom = shipsFrom.replace(/[\n\r]/g, '').trim();
      
      // 4. Price & Currency (Parse original seller price to prevent double shipping addition in converted prices)
      const priceEl = row.querySelector('.price, .item_price, .price_value');
      let priceText = '';
      if (priceEl) {
        const priceClone = priceEl.cloneNode(true);
        priceClone.querySelectorAll('.converted_price, .converted-price, .converted').forEach(el => el.remove());
        priceText = priceClone.textContent.trim();
      }
      
      let priceVal = 0;
      let currency = 'USD';
      let source = 'original';
      
      // Detect the original currency code FIRST from the original price text
      const upperPrice = priceText.toUpperCase();
      if (upperPrice.includes('R$') || upperPrice.includes('BRL')) currency = 'BRL';
      else if (upperPrice.includes('€') || upperPrice.includes('EUR')) currency = 'EUR';
      else if (upperPrice.includes('£') || upperPrice.includes('GBP')) currency = 'GBP';
      else if (upperPrice.includes('¥') || upperPrice.includes('JPY')) currency = 'JPY';
      else if (upperPrice.includes('MEX$') || upperPrice.includes('MXN')) currency = 'MXN';
      else if (upperPrice.includes('CA$') || upperPrice.includes('C$') || upperPrice.includes('CAD')) currency = 'CAD';
      else if (upperPrice.includes('A$') || upperPrice.includes('AUD')) currency = 'AUD';
      else if (upperPrice.includes('NZ$') || upperPrice.includes('NZD')) currency = 'NZD';
      else if (upperPrice.includes('CLP')) currency = 'CLP';
      else if (upperPrice.includes('COP')) currency = 'COP';
      else if (upperPrice.includes('ARS')) currency = 'ARS';
      else if (upperPrice.includes('UYU')) currency = 'UYU';
      else if (upperPrice.includes('SEK')) currency = 'SEK';
      else if (upperPrice.includes('NOK')) currency = 'NOK';
      else if (upperPrice.includes('DKK')) currency = 'DKK';
      else if (upperPrice.includes('CHF')) currency = 'CHF';
      else if (upperPrice.includes('ZAR')) currency = 'ZAR';
      else if (upperPrice.includes('USD') || upperPrice.includes('$')) currency = 'USD';
      else {
        currency = 'USD'; // default fallback
      }
      
      const priceValAttr = priceEl?.getAttribute('data-pricevalue');
      if (priceValAttr) {
        source = 'data-pricevalue';
        priceVal = parseFloat(priceValAttr) || 0;
      } else if (priceText) {
        source = 'price_element_text';
        const cleanText = priceText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible|sobre|about|\()/i)[0].trim();
        const cleanPrice = cleanText.replace(/[^\d.,]/g, '');
        priceVal = parseLocalePrice(cleanPrice, currency);
      }

      // Handle JPY non-decimal thousands separator fix for priceVal
      if (currency === 'JPY' && priceText) {
        const cleanText = priceText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible|sobre|about|\()/i)[0].trim();
        const digitsOnly = cleanText.replace(/[^\d]/g, '');
        if (digitsOnly) priceVal = parseInt(digitsOnly, 10) || 0;
      }
      
      // 5. Shipping (Parse original shipping cost to match the original currency of the price)
      const shippingEl = row.querySelector('.item_shipping, .shipping');
      let shippingText = '';
      if (shippingEl) {
        const shippingClone = shippingEl.cloneNode(true);
        shippingClone.querySelectorAll('.converted_price, .converted-price, .converted').forEach(el => el.remove());
        shippingText = shippingClone.textContent.trim();
      }
      let shippingVal = 0;
      let rawShippingText = shippingText;
      let isShippingEstimated = false;
      
      if (shippingText) {
        const upperShipping = shippingText.toUpperCase();
        const hasDigits = /\d/.test(shippingText);
        const isFree = shippingText.toLowerCase().includes('gratis') || shippingText.toLowerCase().includes('free');
        
        if (isFree) {
          shippingVal = 0;
          isShippingEstimated = false;
        } else if (!hasDigits) {
          isShippingEstimated = true;
          shippingVal = 0; // will fall back to base shipping rate in estimate calculations
        } else {
          // We split by parenthesis first to avoid parsing the converted parentheses value
          const cleanText = shippingText.split(/\(|(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible)/i)[0].trim();
          if (currency === 'JPY' || upperShipping.includes('JPY') || upperShipping.includes('¥')) {
            const digitsOnly = cleanText.replace(/[^\d]/g, '');
            shippingVal = parseInt(digitsOnly, 10) || 0;
          } else {
            const cleanShipping = cleanText.replace(/[^\d.,]/g, '');
            shippingVal = parseLocalePrice(cleanShipping, currency);
          }
        }
      } else {
        isShippingEstimated = true;
        shippingVal = 0; // will fall back to base shipping rate in estimate calculations
      }

      // 6. Condition (Avoid regex \b boundary bug on '+')
      const conditionEl = row.querySelector('.item_condition, .condition');
      let mediaCondition = 'VG+';
      let sleeveCondition = 'VG';
      
      if (conditionEl) {
        const text = conditionEl.textContent.trim();
        if (/Near Mint|\bNM\b|\bM-\b/i.test(text)) mediaCondition = 'NM';
        else if (/\bMint\b|\bM\b/i.test(text) && !/Near/i.test(text)) mediaCondition = 'M';
        else if (/Very Good Plus|VG\+|VGplus/i.test(text)) mediaCondition = 'VG+';
        else if (/Very Good|\bVG\b/i.test(text)) mediaCondition = 'VG';
        else if (/Good Plus|G\+|Gplus/i.test(text)) mediaCondition = 'G+';
        else if (/\bGood\b|\bG\b/i.test(text)) mediaCondition = 'G';
        else if (/\bFair\b|\bF\b/i.test(text)) mediaCondition = 'F';
        else if (/\bPoor\b|\bP\b/i.test(text)) mediaCondition = 'P';
        
        if (text.includes('(') || text.includes('/')) {
          const sleeveText = text.split(/[\(/]/)[1] || '';
          if (/Near Mint|\bNM\b|\bM-\b/i.test(sleeveText)) sleeveCondition = 'NM';
          else if (/\bMint\b|\bM\b/i.test(sleeveText) && !/Near/i.test(sleeveText)) sleeveCondition = 'M';
          else if (/Very Good Plus|VG\+|VGplus/i.test(sleeveText)) sleeveCondition = 'VG+';
          else if (/Very Good|\bVG\b/i.test(sleeveText)) sleeveCondition = 'VG';
          else if (/Good Plus|G\+|Gplus/i.test(sleeveText)) sleeveCondition = 'G+';
          else if (/\bGood\b|\bG\b/i.test(sleeveText)) sleeveCondition = 'G';
        }
      }
      
      // Standardize VGplus and Gplus text representation for DOM classes
      let mediaCondClass = mediaCondition;
      if (mediaCondClass === 'VG+') mediaCondClass = 'VGplus';
      if (mediaCondClass === 'G+') mediaCondClass = 'Gplus';
      
      // 7. Listing URL/ID
      const itemLink = row.querySelector('a[href^="/sell/item/"]');
      const listingUrl = itemLink ? `https://www.discogs.com${itemLink.getAttribute('href')}` : '';
      const listingId = itemLink ? itemLink.getAttribute('href').split('/').pop() : '';
      
      listings.push({
        releaseId,
        sellerName,
        rating,
        ratingCount,
        shipsFrom,
        priceVal,
        shippingVal,
        currency,
        isShippingEstimated,
        mediaCondition,
        mediaCondClass,
        sleeveCondition,
        listingUrl,
        listingId
      });
    } catch (e) {
      console.error('Error parsing row:', e);
    }
  });
  
  let textOffersCount = 0;
  const bodyText = doc.body ? doc.body.textContent : html;
  const offerMatch = bodyText.match(/(\d[\d.,]*)\s*(?:en venta|for sale|items? for sale)/i);
  if (offerMatch) {
    textOffersCount = parseInt(offerMatch[1].replace(/[^\d]/g, ''), 10) || 0;
  }

  const totalWorldListings = Math.max(
    rawRowsCount,
    unshippableCount,
    jsonLdOffersCount || 0,
    textOffersCount || 0
  );

  return {
    listings: listings,
    totalWorldListings: totalWorldListings,
    unshippableCount: unshippableCount,
    unshippableLocations: unshippableLocations,
    communityStats: {
      haveCount,
      wantCount,
      lowPrice,
      highPrice,
      ratingValue,
      catalogNumber,
      recordLabel,
      totalOffersCount: totalWorldListings
    }
  };
}

// Group all matching listings by Seller Name with defensive data normalization
function groupListingsBySeller() {
  const sellersMap = {};
  const buyerCountryVal = (buyerCountry ? buyerCountry.value : 'Uruguay') || 'Uruguay';
  
  // List of European countries to check EU-to-EU shipping
  const euroCountries = ['spain', 'germany', 'france', 'italy', 'united kingdom', 'uk', 'netherlands', 'belgium', 'austria', 'switzerland', 'sweden', 'norway', 'portugal', 'greece', 'poland', 'ireland', 'spain (es)', 'deutschland', 'de', 'es'];
  
  const isCountryEU = (c) => {
    if (!c || typeof c !== 'string') return false;
    const lower = c.toLowerCase();
    return euroCountries.some(eu => lower.includes(eu));
  };
  const isBuyerEU = isCountryEU(buyerCountryVal);

  (state.allListings || []).forEach(listing => {
    if (!listing) return;
    const sName = (listing.sellerName || '').trim() || 'Vendedor Desconocido';
    
    // Normalize and sanitize price value
    const rawPrice = typeof listing.priceVal === 'number' ? listing.priceVal : parseFloat(listing.priceVal);
    listing.priceVal = (!isNaN(rawPrice) && isFinite(rawPrice) && rawPrice > 0) ? rawPrice : 0;

    // Preserve the detected listing currency
    if (listing.currency === 'JPY' && listing.priceVal < 100) {
      listing.currency = 'USD';
    }
    
    if (!sellersMap[sName]) {
      const rawRating = typeof listing.rating === 'number' ? listing.rating : parseFloat(listing.rating);
      const rawRatingCount = typeof listing.ratingCount === 'number' ? listing.ratingCount : parseInt(listing.ratingCount, 10);
      sellersMap[sName] = {
        name: sName,
        rating: (!isNaN(rawRating) && isFinite(rawRating)) ? rawRating : 100,
        ratingCount: (!isNaN(rawRatingCount) && isFinite(rawRatingCount)) ? rawRatingCount : 0,
        shipsFrom: (listing.shipsFrom || 'Internacional').trim(),
        currency: listing.currency || 'USD',
        listings: []
      };
    }
    
    // Avoid double listings of same release by same seller (keep cheapest copy)
    const existing = sellersMap[sName].listings.find(l => l && String(l.releaseId) === String(listing.releaseId));
    if (existing) {
      if (listing.priceVal < existing.priceVal) {
        const idx = sellersMap[sName].listings.indexOf(existing);
        sellersMap[sName].listings[idx] = listing;
      }
    } else {
      sellersMap[sName].listings.push(listing);
    }
  });
  
  // Convert map to array and calculate metrics
  state.groupedSellers = Object.values(sellersMap).map(seller => {
    const listCount = (seller.listings || []).length;
    const subtotal = (seller.listings || []).reduce((sum, item) => sum + (item.priceVal || 0), 0);
    
    // Determine location relationship defensively
    const shipsFromLower = (seller.shipsFrom || '').toLowerCase();
    const buyerLower = (buyerCountryVal || 'uruguay').toLowerCase();
    
    let isDomestic = shipsFromLower.includes(buyerLower) || buyerLower.includes(shipsFromLower);
    
    // Map common names
    if (buyerLower === 'uruguay' && (shipsFromLower.includes('uruguay') || shipsFromLower.includes('uy'))) isDomestic = true;
    if (buyerLower === 'spain' && (shipsFromLower.includes('spain') || shipsFromLower.includes('españa') || shipsFromLower.includes('es'))) isDomestic = true;
    if (buyerLower === 'germany' && (shipsFromLower.includes('germany') || shipsFromLower.includes('deutschland') || shipsFromLower.includes('de'))) isDomestic = true;
    if (buyerLower === 'united states' && (shipsFromLower.includes('united states') || shipsFromLower.includes('us'))) isDomestic = true;
    if (buyerLower === 'united kingdom' && (shipsFromLower.includes('united kingdom') || shipsFromLower.includes('uk') || shipsFromLower.includes('great britain'))) isDomestic = true;
    
    let isEUToEU = false;
    if (!isDomestic && isBuyerEU && isCountryEU(seller.shipsFrom)) {
      isEUToEU = true;
    }
    
    // Save properties to seller object
    seller.isDomestic = isDomestic;
    seller.isEUToEU = isEUToEU;
    
    const estimatedShipping = calculateSellerShipping(seller, seller.listings || []);
    const totalPrice = subtotal + estimatedShipping;
    
    return {
      ...seller,
      matchCount: listCount,
      subtotal: parseFloat(subtotal.toFixed(2)),
      estimatedShipping: parseFloat(estimatedShipping.toFixed(2)),
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      isDomestic,
      isEUToEU,
      isShippingEstimated: (seller.listings || []).some(l => l && l.isShippingEstimated)
    };
  });
  
  console.log('Grouped sellers with location-based shipping:', state.groupedSellers);
  populateCountryFilter();
}

// Dynamically populate seller country filter from actual scraped seller locations
function populateCountryFilter() {
  if (!filterCountry) return;
  
  const currentSelection = filterCountry.value;
  
  // Collect all unique shipsFrom strings
  const rawCountries = state.groupedSellers
    .map(s => s.shipsFrom ? s.shipsFrom.trim() : '')
    .filter(Boolean);

  // Map and clean up common country representations
  const uniqueMap = new Map();
  rawCountries.forEach(c => {
    let clean = c;
    const lower = c.toLowerCase();
    
    if (lower.includes('united states') || lower.includes('us')) clean = 'United States';
    else if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('great britain')) clean = 'United Kingdom';
    else if (lower.includes('spain') || lower.includes('españa')) clean = 'Spain';
    else if (lower.includes('germany') || lower.includes('deutschland')) clean = 'Germany';
    else if (lower.includes('brazil') || lower.includes('brasil')) clean = 'Brazil';
    else if (lower.includes('sweden') || lower.includes('suecia')) clean = 'Sweden';
    else if (lower.includes('uruguay')) clean = 'Uruguay';
    else if (lower.includes('france') || lower.includes('francia')) clean = 'France';
    else if (lower.includes('japan') || lower.includes('japón')) clean = 'Japan';
    else if (lower.includes('netherlands') || lower.includes('holland') || lower.includes('países bajos')) clean = 'Netherlands';
    else if (lower.includes('italy') || lower.includes('italia')) clean = 'Italy';
    
    const key = clean.toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, clean);
    }
  });

  // Sort alphabetically
  const sortedCountries = Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b));

  // Build options HTML
  let optionsHtml = `<option value="all">Cualquier país</option>`;
  optionsHtml += `<option value="Europe">Europa (Región)</option>`;

  sortedCountries.forEach(countryName => {
    optionsHtml += `<option value="${escapeHTML(countryName)}">${escapeHTML(countryName)}</option>`;
  });

  filterCountry.innerHTML = optionsHtml;

  // Preserve previous selection if it still exists
  if (Array.from(filterCountry.options).some(o => o.value === currentSelection)) {
    filterCountry.value = currentSelection;
  } else {
    filterCountry.value = 'all';
  }
}

// Helper to find optimal combinations of sellers for Compra Inteligente
function getSmartPurchaseCombo(filteredSellers, targetReleases) {
  if (filteredSellers.length === 0 || targetReleases.length === 0) return null;
  
  // Take top 12 sellers to keep combination search space small and fast
  const candidates = [...filteredSellers]
    .sort((a, b) => b.listings.length - a.listings.length)
    .slice(0, 12);
    
  let bestCombo = null;
  let maxCovered = -1;
  let minCost = Infinity;
  let bestAssignments = null;

  // Helper to generate combinations of size k
  function getCombos(arr, k) {
    const results = [];
    function helper(temp, start) {
      if (temp.length === k) {
        results.push([...temp]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        temp.push(arr[i]);
        helper(temp, i + 1);
        temp.pop();
      }
    }
    helper([], 0);
    return results;
  }

  // Recommend strictly the single best seller (combo of size 1) to avoid shipping division/multiplicity
  const maxComboSize = 1;
  for (let size = 1; size <= maxComboSize; size++) {
    const combos = getCombos(candidates, size);
    for (const combo of combos) {
      // Find coverage and best assignments
      const coveredReleases = new Set();
      const assignments = {}; // sellerName -> list of listings
      combo.forEach(s => { assignments[s.name] = []; });

      targetReleases.forEach(relId => {
        let cheapestSeller = null;
        let cheapestListing = null;
        
        combo.forEach(s => {
          const listing = s.listings.find(l => l.releaseId === relId);
          if (listing) {
            if (!cheapestListing || listing.priceVal < cheapestListing.priceVal) {
              cheapestSeller = s;
              cheapestListing = listing;
            }
          }
        });

        if (cheapestSeller) {
          coveredReleases.add(relId);
          assignments[cheapestSeller.name].push(cheapestListing);
        }
      });

      const numCovered = coveredReleases.size;
      
      // Calculate total cost for this combo
      let totalComboCost = 0;
      combo.forEach(s => {
        const assignedListings = assignments[s.name];
        if (assignedListings.length > 0) {
          const subtotal = assignedListings.reduce((sum, l) => sum + l.priceVal, 0);
          
          // Re-estimate shipping based on assigned items
          const estimatedShipping = calculateSellerShipping(s, assignedListings);
          
          totalComboCost += subtotal + estimatedShipping;
        }
      });

      // We want to maximize coverage, then minimize cost
      if (numCovered > maxCovered) {
        maxCovered = numCovered;
        minCost = totalComboCost;
        bestCombo = combo;
        bestAssignments = assignments;
      } else if (numCovered === maxCovered && totalComboCost < minCost) {
        minCost = totalComboCost;
        bestCombo = combo;
        bestAssignments = assignments;
      }
    }
  }

  if (!bestCombo) return null;

  const activeSellers = bestCombo.filter(s => bestAssignments[s.name].length > 0);

  return {
    sellers: activeSellers,
    assignments: bestAssignments,
    totalCovered: maxCovered,
    totalCost: minCost,
  };
}

// Helper to calculate cost statistics for covering the complete wishlist using multiple shops
function calculateWishlistCompletaStats(filteredSellers, targetReleases) {
  const cheapestListingsMap = new Map();
  
  targetReleases.forEach(relId => {
    let cheapest = null;
    let cheapestUSD = Infinity;
    
    filteredSellers.forEach(seller => {
      seller.listings.forEach(l => {
        if (l.releaseId === relId) {
          const rate = CURRENCY_MAP[l.currency]?.rate || 1.0;
          const priceUSD = l.priceVal * rate;
          if (priceUSD < cheapestUSD) {
            cheapestUSD = priceUSD;
            cheapest = { listing: l, seller: seller };
          }
        }
      });
    });
    
    if (cheapest) {
      cheapestListingsMap.set(relId, cheapest);
    }
  });
  
  if (cheapestListingsMap.size === 0) return null;
  
  const sellerAssignments = new Map();
  let totalDiscsPriceUSD = 0;
  
  cheapestListingsMap.forEach((val, relId) => {
    const sellerName = val.seller.name;
    if (!sellerAssignments.has(sellerName)) {
      sellerAssignments.set(sellerName, { seller: val.seller, listings: [] });
    }
    sellerAssignments.get(sellerName).listings.push(val.listing);
    
    const rate = CURRENCY_MAP[val.listing.currency]?.rate || 1.0;
    totalDiscsPriceUSD += val.listing.priceVal * rate;
  });
  
  let totalShippingUSD = 0;
  sellerAssignments.forEach((data, sellerName) => {
    const shippingInSellerCurrency = calculateSellerShipping(data.seller, data.listings);
    const rate = CURRENCY_MAP[data.seller.currency]?.rate || 1.0;
    totalShippingUSD += shippingInSellerCurrency * rate;
  });
  
  const totalCostUSD = totalDiscsPriceUSD + totalShippingUSD;
  
  return {
    coveredCount: cheapestListingsMap.size,
    totalReleasesCount: targetReleases.length,
    discsPriceUSD: totalDiscsPriceUSD,
    shippingUSD: totalShippingUSD,
    totalCostUSD: totalCostUSD,
    sellersCount: sellerAssignments.size
  };
}

// Render the Compra Inteligente Recommendation Card
function renderSmartPurchase(filteredSellers) {
  const smartPurchaseCard = document.getElementById('smart-purchase-card');
  if (!smartPurchaseCard) return;

  const priorityIds = state.wants.filter(w => w.isPriority).map(w => w.id);
  const priorityFilterActive = filterPriorityOnly.checked && priorityIds.length > 0;
  
  let targetReleases = state.wants.map(w => w.id);
  if (priorityFilterActive) {
    targetReleases = priorityIds;
  }
  
  const wishlistStats = calculateWishlistCompletaStats(filteredSellers, targetReleases);
  
  const coverableReleases = targetReleases.filter(relId => 
    filteredSellers.some(s => s.listings.some(l => l.releaseId === relId))
  );

  if (coverableReleases.length === 0 || filteredSellers.length === 0) {
    smartPurchaseCard.style.display = 'none';
    return;
  }

  // Calculate Option A: Max Consolidation (greatest quantity of matching wants)
  const candidatesA = [...filteredSellers].sort((a, b) => {
    if (b.listings.length !== a.listings.length) {
      return b.listings.length - a.listings.length;
    }
    const rateA = CURRENCY_MAP[a.currency]?.rate || 1.0;
    const rateB = CURRENCY_MAP[b.currency]?.rate || 1.0;
    const costA = a.totalPrice * rateA;
    const costB = b.totalPrice * rateB;
    return costA - costB;
  });
  
  const topSellersA = candidatesA.slice(0, 3);

  // Calculate Option B: Best average cost per disc (Efficiency, minimum of 3 discs)
  const eligibleB = filteredSellers.filter(s => s.listings.length >= 3);
  let candidatesBSorted = [];
  
  const mapAndSortB = (sellersList) => {
    return [...sellersList].map(s => {
      const avgCost = s.totalPrice / s.listings.length;
      const rate = CURRENCY_MAP[s.currency]?.rate || 1.0;
      const avgCostUSD = avgCost * rate;
      return { seller: s, avgCostUSD };
    }).sort((a, b) => a.avgCostUSD - b.avgCostUSD).map(c => c.seller);
  };
  
  if (eligibleB.length > 0) {
    candidatesBSorted = mapAndSortB(eligibleB);
  } else {
    const eligibleB2 = filteredSellers.filter(s => s.listings.length >= 2);
    if (eligibleB2.length > 0) {
      candidatesBSorted = mapAndSortB(eligibleB2);
    } else {
      candidatesBSorted = mapAndSortB(filteredSellers);
    }
  }
  
  const topSellersB = candidatesBSorted.slice(0, 3);

  if (topSellersA.length === 0) {
    smartPurchaseCard.style.display = 'none';
    return;
  }

  // Helper function to render Stitch Luxury Bento Grid (Option A and Option B)
  const sellerA = topSellersA[0];
  const subtotalA = sellerA.listings.reduce((sum, l) => sum + l.priceVal, 0);
  const totalCostA = sellerA.totalPrice;
  const shippingCostA = Math.max(totalCostA - subtotalA, 0);
  const estSavingsA = Math.max((sellerA.listings.length - 1) * 18.50, 24);
  const coveragePercentA = ((sellerA.listings.length / Math.max(state.wants.length, 1)) * 100).toFixed(2);

  // 6 visual covers for Option A (up to 5 covers + 1 overflow tile if > 6)
  let galleryAHtml = '';
  const totalListingsA = sellerA.listings.length;
  const showOverflowA = totalListingsA > 6;
  const sliceCountA = showOverflowA ? 5 : Math.min(totalListingsA, 6);
  const itemsToRenderA = sellerA.listings.slice(0, sliceCountA);

  itemsToRenderA.forEach(l => {
    const wantInfo = state.wants.find(w => String(w.id) === String(l.releaseId)) || {};
    const coverRaw = wantInfo.image || wantInfo.cover || wantInfo.thumb || wantInfo.coverImage || wantInfo.cover_image || l.image || '';
    const coverImg = upgradeDiscogsImageUrl(coverRaw);
    const condTag = (l.mediaCondition || 'VG+').toUpperCase();
    const condColor = condTag.includes('M') && !condTag.includes('NM') 
      ? 'bg-emerald-600' 
      : (condTag.includes('NM') ? 'bg-blue-600' : 'bg-amber-600');
    
    const imgHtml = coverImg 
      ? `<img alt="${escapeHTML(wantInfo.title || 'Vinyl')}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none group-hover/cover:scale-105 transition-transform duration-300" src="${escapeHTML(coverImg)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
         <div class="w-full h-full hidden items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`
      : `<div class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`;
    
    galleryAHtml += `
      <div class="aspect-square bg-stone-100 border border-hairline-dark relative group/cover overflow-hidden hover:border-prada-red transition-all shadow-xs" title="${escapeHTML((wantInfo.artist ? wantInfo.artist + ' - ' : '') + (wantInfo.title || 'Vinilo'))}">
        ${imgHtml}
        <span class="absolute bottom-1 right-1 ${condColor} text-pure-white text-[9px] font-mono font-bold px-1.5 py-0.5 shadow-sm">${escapeHTML(condTag)}</span>
      </div>
    `;
  });

  if (showOverflowA) {
    const overflowCount = totalListingsA - 5;
    galleryAHtml += `
      <div class="aspect-square border-2 border-prada-red bg-prada-red-bg flex flex-col items-center justify-center text-prada-red font-mono hover:bg-prada-red hover:text-white transition-all cursor-pointer shadow-xs btn-scroll-to-seller group/more" data-scroll-to="${escapeHTML(sellerA.name)}" title="Ver todos los ${totalListingsA} discos de este vendedor">
        <span class="font-extrabold text-lg leading-none group-hover/more:scale-110 transition-transform">+${overflowCount}</span>
        <span class="text-[9px] uppercase tracking-wider font-bold mt-1">DISCOS</span>
      </div>
    `;
  }

  // Option B setup
  const sellerB = topSellersB[0] || topSellersA[1] || topSellersA[0];
  const subtotalB = sellerB.listings.reduce((sum, l) => sum + l.priceVal, 0);
  const totalCostB = sellerB.totalPrice;
  const shippingCostB = Math.max(totalCostB - subtotalB, 0);
  const avgCostPerPieceB = totalCostB / Math.max(sellerB.listings.length, 1);

  // 6 visual covers for Option B (up to 5 covers + 1 overflow tile if > 6)
  let galleryBHtml = '';
  const totalListingsB = sellerB.listings.length;
  const showOverflowB = totalListingsB > 6;
  const sliceCountB = showOverflowB ? 5 : Math.min(totalListingsB, 6);
  const itemsToRenderB = sellerB.listings.slice(0, sliceCountB);

  itemsToRenderB.forEach(l => {
    const wantInfo = state.wants.find(w => String(w.id) === String(l.releaseId)) || {};
    const coverRaw = wantInfo.image || wantInfo.cover || wantInfo.thumb || wantInfo.coverImage || wantInfo.cover_image || l.image || '';
    const coverImg = upgradeDiscogsImageUrl(coverRaw);
    const condTag = (l.mediaCondition || 'VG+').toUpperCase();
    const condColor = condTag.includes('M') && !condTag.includes('NM') 
      ? 'bg-emerald-600' 
      : (condTag.includes('NM') ? 'bg-blue-600' : 'bg-amber-600');
    
    const imgHtml = coverImg 
      ? `<img alt="${escapeHTML(wantInfo.title || 'Vinyl')}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none group-hover/cover:scale-105 transition-transform duration-300" src="${escapeHTML(coverImg)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
         <div class="w-full h-full hidden items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`
      : `<div class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`;
    
    galleryBHtml += `
      <div class="aspect-square bg-stone-100 border border-hairline-dark relative group/cover overflow-hidden hover:border-prada-blue transition-all shadow-xs" title="${escapeHTML((wantInfo.artist ? wantInfo.artist + ' - ' : '') + (wantInfo.title || 'Vinilo'))}">
        ${imgHtml}
        <span class="absolute bottom-1 right-1 ${condColor} text-pure-white text-[9px] font-mono font-bold px-1.5 py-0.5 shadow-sm">${escapeHTML(condTag)}</span>
      </div>
    `;
  });

  if (showOverflowB) {
    const overflowCountB = totalListingsB - 5;
    galleryBHtml += `
      <div class="aspect-square border-2 border-prada-blue bg-blue-50 flex flex-col items-center justify-center text-prada-blue font-mono hover:bg-prada-blue hover:text-white transition-all cursor-pointer shadow-xs btn-scroll-to-seller group/more" data-scroll-to="${escapeHTML(sellerB.name)}" title="Ver todos los ${totalListingsB} discos de este vendedor">
        <span class="font-extrabold text-lg leading-none group-hover/more:scale-110 transition-transform">+${overflowCountB}</span>
        <span class="text-[9px] uppercase tracking-wider font-bold mt-1">DISCOS</span>
      </div>
    `;
  }

  const bentoGridHtml = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <!-- CARD 01: MÁXIMO STOCK / CONSOLIDACIÓN (BORDE ROJO PRADA) -->
      <article class="border-2 border-prada-red/70 bg-pure-white p-6 sm:p-7 flex flex-col justify-between relative group hover:border-prada-red transition-all shadow-[4px_4px_0px_rgba(224,43,32,0.08)]">
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-prada-red"></div>
        <div class="flex flex-col gap-5 pt-1">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 sm:gap-4">
              <span class="w-10 h-10 border-2 border-pitch-black font-mono font-bold text-base flex items-center justify-center bg-ivory-warm text-pitch-black group-hover:bg-prada-red group-hover:text-pure-white transition-colors shrink-0 shadow-xs">
                01
              </span>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-mono tracking-wider uppercase bg-prada-red text-pure-white px-2.5 py-1 font-bold shadow-xs">
                    OPCIÓN 1: MAYOR CATÁLOGO EN STOCK
                  </span>
                  <span class="text-[11px] font-mono uppercase text-prada-blue font-semibold border border-blue-200 bg-blue-50 px-2 py-0.5">${getCountryFlag(sellerA.shipsFrom)} ${escapeHTML(sellerA.shipsFrom)}</span>
                </div>
                <h2 class="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-tight mt-1.5 text-pitch-black">
                  ${escapeHTML(sellerA.name)}
                  <span class="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 ml-2 align-middle inline-block">${sellerA.rating}% ${sellerA.ratingCount > 0 ? `(${sellerA.ratingCount.toLocaleString()} VOTOS)` : 'POSITIVO'}</span>
                </h2>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="inline-block bg-prada-ochre-bg border border-prada-ochre text-amber-950 font-mono font-bold text-sm px-3 py-1 tracking-wider shadow-xs">
                ${sellerA.listings.length} DISCOS EN STOCK
              </span>
              <div class="font-mono text-[11px] text-prada-red font-bold uppercase tracking-wider mt-1.5">
                ★ CONSOLIDA MÁS EN 1 ENVÍO (${coveragePercentA}%)
              </div>
            </div>
          </div>

          <!-- Wantlist Coverage Architectural Gauge -->
          <div class="border border-hairline-light p-3.5 bg-ivory-warm">
            <div class="flex justify-between items-center text-[11px] font-mono tracking-wider mb-2 uppercase">
              <span class="text-muted-graphite font-semibold">RESOLUCIÓN DE ARCHIVO (${sellerA.listings.length} / ${state.wants.length} LANZAMIENTOS)</span>
              <span class="text-prada-red font-bold">${coveragePercentA}% RESUELTO</span>
            </div>
            <div class="w-full h-2.5 bg-surface-low overflow-hidden border border-hairline-dark">
              <div class="h-full bg-prada-red transition-all duration-500" style="width: ${Math.min(coveragePercentA, 100)}%;" title="${coveragePercentA}% de tu Wantlist resuelta (${sellerA.listings.length} de ${state.wants.length} discos en stock)"></div>
            </div>
          </div>

          <!-- Covers Gallery -->
          <div class="flex flex-col gap-2.5">
            <div class="flex justify-between text-[11px] font-mono tracking-wider uppercase text-muted-graphite font-semibold">
              <span>MUESTRA DE LOTE DISCOGRÁFICO</span>
              <span class="text-prada-blue font-bold">STOCK CURADO DISPONIBLE</span>
            </div>
            <div class="grid grid-cols-6 gap-2 sm:gap-2.5">
              ${galleryAHtml}
            </div>
          </div>

          <!-- Financial Breakdown Tabular Receipt -->
          <div class="grid grid-cols-3 border border-hairline-dark py-3 font-mono bg-ivory-warm px-3 shadow-xs">
            <div>
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">SUBTOTAL DISCOS</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(subtotalA, sellerA.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-4">
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">ENVÍO CONSOLIDADO</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-prada-blue">${formatPrice(shippingCostA, sellerA.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-4 bg-prada-red-bg px-2 py-0.5">
              <span class="text-[10px] uppercase tracking-wider text-prada-red font-bold block">AHORRO EN FLETE</span>
              <span class="font-bold text-base sm:text-lg tracking-tight text-prada-red">-$${estSavingsA.toFixed(2)} <span class="text-[11px] font-normal">USD</span></span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-5 mt-4">
          <button class="btn-scroll-to-seller flex-1 bg-prada-red text-pure-white hover:bg-prada-red-dark text-xs font-mono font-bold py-3 uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer" data-scroll-to="${escapeHTML(sellerA.name)}" type="button">
            <span class="material-symbols-outlined text-[16px]">inventory_2</span>
            <span>EXAMINAR LOTE (${sellerA.listings.length} DISCOS)</span>
          </button>
          <a class="border-2 border-pitch-black text-pitch-black hover:bg-surface-low px-5 py-3 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 font-bold cursor-pointer shrink-0" href="https://www.discogs.com/seller/${encodeURIComponent(sellerA.name)}/mywants" target="_blank" rel="noreferrer" title="Abrir perfil de ${escapeHTML(sellerA.name)} en Discogs">
            <span>VER EN DISCOGS</span>
            <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </article>

      <!-- CARD 02: LOTE MÁS ECONÓMICO / MEJOR VALOR (BORDE AZUL PRADA) -->
      <article class="border-2 border-prada-blue/70 bg-pure-white p-6 sm:p-7 flex flex-col justify-between relative group hover:border-prada-blue transition-all shadow-[4px_4px_0px_rgba(29,78,216,0.08)]">
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-prada-blue"></div>
        <div class="flex flex-col gap-5 pt-1">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 sm:gap-4">
              <span class="w-10 h-10 border-2 border-pitch-black font-mono font-bold text-base flex items-center justify-center bg-ivory-warm text-pitch-black group-hover:bg-prada-blue group-hover:text-pure-white transition-colors shrink-0 shadow-xs">
                02
              </span>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-mono tracking-wider uppercase bg-prada-blue text-pure-white px-2.5 py-1 font-bold shadow-xs">
                    OPCIÓN 2: LOTE MÁS ECONÓMICO
                  </span>
                  <span class="text-[11px] font-mono uppercase text-prada-blue font-semibold border border-blue-200 bg-blue-50 px-2 py-0.5">${getCountryFlag(sellerB.shipsFrom)} ${escapeHTML(sellerB.shipsFrom)}</span>
                </div>
                <h2 class="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-tight mt-1.5 text-pitch-black">
                  ${escapeHTML(sellerB.name)}
                  <span class="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 ml-2 align-middle inline-block">${sellerB.rating}% ${sellerB.ratingCount > 0 ? `(${sellerB.ratingCount.toLocaleString()} VOTOS)` : 'POSITIVO'}</span>
                </h2>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="inline-block bg-emerald-50 border border-emerald-300 text-emerald-950 font-mono font-bold text-sm px-3 py-1 tracking-wider shadow-xs">
                ${formatPrice(avgCostPerPieceB, sellerB.currency)} / DISCO
              </span>
              <div class="font-mono text-[11px] text-emerald-800 font-bold uppercase tracking-wider mt-1.5 flex items-center justify-end gap-1">
                <span>★</span> MENOR PRECIO PROMEDIO (${sellerB.listings.length} DISCOS)
              </div>
            </div>
          </div>

          <!-- Covers Gallery for Option B -->
          <div class="flex flex-col gap-2.5">
            <div class="flex justify-between text-[11px] font-mono tracking-wider uppercase text-muted-graphite font-semibold">
              <span>MUESTRA DE LOTE DISCOGRÁFICO</span>
              <span class="text-prada-blue font-bold">STOCK MÁS ECONÓMICO</span>
            </div>
            <div class="grid grid-cols-6 gap-2 sm:gap-2.5">
              ${galleryBHtml}
            </div>
          </div>

          <!-- Financial Metrics Grid -->
          <div class="grid grid-cols-4 border border-hairline-dark py-3 font-mono bg-ivory-warm px-3 shadow-xs">
            <div>
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">MEDIA / PIEZA</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-emerald-800">${formatPrice(avgCostPerPieceB, sellerB.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-3">
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">SUBTOTAL</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(subtotalB, sellerB.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-3">
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">FLETE</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-prada-blue">${formatPrice(shippingCostB, sellerB.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-3 bg-blue-50/60 px-2 py-0.5">
              <span class="text-[10px] uppercase tracking-wider text-prada-blue font-bold block">TOTAL LOTE</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(totalCostB, sellerB.currency)}</span>
            </div>
          </div>

          <!-- Museum Condition Guarantee Note -->
          <div class="border border-emerald-300 bg-prada-emerald-bg p-3.5 flex items-start gap-2.5">
            <span class="material-symbols-outlined text-[20px] text-prada-emerald shrink-0 mt-0.5">verified</span>
            <p class="font-mono text-xs text-emerald-950 leading-relaxed font-medium">
              ESTADO CERTIFICADO: VINILOS VERIFICADOS CON GARANTÍA DIRECTA Y PROTECCIÓN DE COMPRA EN DISCOGS MARKETPLACE.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-5 mt-4">
          <button class="btn-scroll-to-seller flex-1 bg-prada-blue-night hover:bg-prada-blue text-pure-white text-xs font-mono font-bold py-3 uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer" data-scroll-to="${escapeHTML(sellerB.name)}" type="button">
            <span class="material-symbols-outlined text-[16px]">inventory_2</span>
            <span>EXAMINAR LOTE (${sellerB.listings.length} DISCOS)</span>
          </button>
          <a class="border-2 border-pitch-black text-pitch-black hover:bg-surface-low px-5 py-3 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 font-bold cursor-pointer shrink-0" href="https://www.discogs.com/seller/${encodeURIComponent(sellerB.name)}/mywants" target="_blank" rel="noreferrer" title="Abrir perfil de ${escapeHTML(sellerB.name)} en Discogs">
            <span>VER EN DISCOGS</span>
            <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </article>
    </div>
  `;

  smartPurchaseCard.className = 'smart-purchase-card w-full mb-8';
  smartPurchaseCard.innerHTML = bentoGridHtml;

  smartPurchaseCard.style.display = 'block';

  // Animate bento cards and savings counter
  if (window.Motion) {
    requestAnimationFrame(() => {
      window.Motion.revealBento('#smart-purchase-card');
      // Animate savings elements
      smartPurchaseCard.querySelectorAll('.savings-amount, [data-savings]').forEach(el => {
        window.Motion.revealSavings(el.id || null);
        if (!el.id) el.classList.add('savings-highlight', 'savings-amount');
      });
      // Animate bento inner cards
      smartPurchaseCard.querySelectorAll('.bento-cell, .bento-card, .smart-purchase-option').forEach(card => {
        card.classList.add('bento-card');
      });
    });
  }

  // Attach event listeners for scrolling to and auto-expanding seller cards
  smartPurchaseCard.querySelectorAll('[data-scroll-to]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sellerName = link.getAttribute('data-scroll-to');
      if (!sellerName) return;

      // Auto-expand seller listings accordion
      if (typeof expandSellerCard === 'function') {
        expandSellerCard(sellerName);
      }

      const targetCard = document.getElementById('seller-card-' + sellerName);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  const scrollBtn = document.getElementById('btn-scroll-to-results');
  if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
      const grid = document.getElementById('results-grid');
      if (grid) {
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

// Render dynamic results card matching filters
function renderResults() {
  if (state.groupedSellers.length === 0) {
    if (state.wants.length > 0) {
      showWantlistManager(false);
    } else {
      emptyState.style.display = 'flex';
      resultsGrid.style.display = 'none';
      const resultsViewWrapper = document.getElementById('results-view-wrapper');
      if (resultsViewWrapper) resultsViewWrapper.style.display = 'none';
      noResultsState.style.display = 'none';
      const smartCard = document.getElementById('smart-purchase-card');
      if (smartCard) smartCard.style.display = 'none';
      const tabNavigation = document.getElementById('tab-navigation');
      if (tabNavigation) tabNavigation.style.display = 'none';
      const statsView = document.getElementById('stats-view');
      if (statsView) statsView.style.display = 'none';
      toggleFiltersState(false);
      currentAppView = 'wizard-1';
    }
    updateForwardAndBackButtons();
    return;
  }
  
  // Enable filters since we have results
  toggleFiltersState(true);
  
  // Extract filters
  const minMatches = parseInt(filterMinMatches.value, 10);
  const countryFilter = filterCountry.value;
  const minRating = parseFloat(filterRating.value);
  const sortCriteria = sortBy.value;
  const searchQuery = filterSearchRelease ? filterSearchRelease.value.trim().toLowerCase() : '';
  const minCondVal = filterMinCondition ? filterMinCondition.value : 'any';
  const minCondRank = minCondVal === 'any' ? 0 : getConditionRank(minCondVal);
  
  // Priority items filtering setup
  const priorityIds = state.wants.filter(w => w.isPriority).map(w => w.id);
  const priorityFilterActive = filterPriorityOnly.checked && priorityIds.length > 0;
  
  // Filter list
  let filtered = state.groupedSellers.filter(seller => {
    // Filter listings matching min condition requirement
    const validListings = minCondRank > 0 
      ? seller.listings.filter(l => getConditionRank(l.mediaCondition) >= minCondRank)
      : seller.listings;
    
    seller.displayListings = validListings;
    
    // 1. Matches limit
    if (validListings.length < minMatches) return false;
    
    // 2. Rating limit
    if (seller.rating < minRating) return false;
    
    // 3. Country filter
    if (countryFilter !== 'all') {
      const loc = seller.shipsFrom.toLowerCase();
      if (countryFilter === 'Europe') {
        const euroCountries = ['spain', 'germany', 'france', 'italy', 'united kingdom', 'uk', 'netherlands', 'belgium', 'austria', 'switzerland', 'sweden', 'norway', 'portugal', 'greece', 'poland', 'ireland', 'españa', 'deutschland', 'francia', 'italia'];
        const matchesEuro = euroCountries.some(c => loc.includes(c));
        if (!matchesEuro) return false;
      } else if (countryFilter === 'United States') {
        if (!loc.includes('united states') && !loc.includes('us')) return false;
      } else if (countryFilter === 'Spain') {
        if (!loc.includes('spain') && !loc.includes('españa') && !loc.includes('es')) return false;
      } else if (countryFilter === 'United Kingdom') {
        if (!loc.includes('united kingdom') && !loc.includes('uk') && !loc.includes('great britain')) return false;
      } else if (countryFilter === 'Germany') {
        if (!loc.includes('germany') && !loc.includes('deutschland') && !loc.includes('de')) return false;
      } else if (countryFilter === 'Brazil') {
        if (!loc.includes('brazil') && !loc.includes('brasil')) return false;
      } else {
        const targetVal = countryFilter.toLowerCase();
        if (!loc.includes(targetVal) && !targetVal.includes(loc)) return false;
      }
    }
    
    // 4. Priority items filter
    if (priorityFilterActive) {
      const hasPriorityItem = seller.listings.some(l => priorityIds.includes(l.releaseId));
      if (!hasPriorityItem) return false;
    }
    
    // 5. Search query filter (Artist / Album Title)
    if (searchQuery) {
      const matchesSearch = seller.listings.some(l => {
        const want = state.wants.find(w => w.id === l.releaseId);
        const titleMatch = want?.title?.toLowerCase().includes(searchQuery);
        const artistMatch = want?.artist?.toLowerCase().includes(searchQuery);
        const rawTitleMatch = l.title?.toLowerCase().includes(searchQuery);
        return titleMatch || artistMatch || rawTitleMatch;
      });
      if (!matchesSearch) return false;
    }
    // 6. Has shipping configured filter
    if (filterHasShipping && filterHasShipping.checked && seller.isShippingEstimated) {
      return false;
    }
    
    return true;
  });
  
  // Sort list
  filtered.sort((a, b) => {
    if (sortCriteria === 'matches-desc') {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount; // Primary: matches
      }
      return a.totalPrice - b.totalPrice; // Secondary: price
    } else if (sortCriteria === 'price-asc') {
      return a.totalPrice - b.totalPrice;
    } else if (sortCriteria === 'rating-desc') {
      if (b.rating !== a.rating) {
        return b.rating - a.rating; // Primary: rating
      }
      return b.ratingCount - a.ratingCount; // Secondary: ratings count
    }
    return 0;
  });
  
  // UI Display
  if (filtered.length === 0) {
    emptyState.style.display = 'none';
    resultsGrid.style.display = 'none';
    const resultsViewWrapper = document.getElementById('results-view-wrapper');
    if (resultsViewWrapper) resultsViewWrapper.style.display = 'none';
    noResultsState.style.display = 'block';
    const smartCard = document.getElementById('smart-purchase-card');
    if (smartCard) smartCard.style.display = 'none';
    const headerNavRow = document.getElementById('header-nav-row');
    if (headerNavRow) headerNavRow.style.display = 'flex';
    const tabNavigation = document.getElementById('tab-navigation');
    if (tabNavigation) tabNavigation.style.display = 'flex';
    const filterToolbar = document.getElementById('filter-toolbar');
    if (filterToolbar) filterToolbar.style.display = 'block';
    const statsView = document.getElementById('stats-view');
    if (statsView) statsView.style.display = 'none';
    currentAppView = 'results-no-results';
    updateForwardAndBackButtons();
    return;
  }
  
  // Render Smart Purchase recommendation card
  renderSmartPurchase(filtered);

  // Animate Header Metric Counters (0 -> 17 -> count)
  const currentWantsVal = parseInt(document.getElementById('metric-wants-count')?.textContent.replace(/,/g, '') || '0', 10) || 0;
  const currentSellersVal = parseInt(document.getElementById('metric-sellers-count')?.textContent.replace(/,/g, '') || '0', 10) || 0;
  const currentMatchesVal = parseInt(document.getElementById('metric-matches-count')?.textContent.replace(/,/g, '') || '0', 10) || 0;

  animateCounter('metric-wants-count', currentWantsVal, state.wants.length);
  animateCounter('metric-sellers-count', currentSellersVal, state.groupedSellers.length);
  animateCounter('metric-matches-count', currentMatchesVal, state.allListings.length);
  
  emptyState.style.display = 'none';
  noResultsState.style.display = 'none';
  const headerNavRow = document.getElementById('header-nav-row');
  if (headerNavRow) headerNavRow.style.display = 'flex';
  const tabNavigation = document.getElementById('tab-navigation');
  if (tabNavigation) tabNavigation.style.display = 'flex';
  const filterToolbar = document.getElementById('filter-toolbar');
  if (filterToolbar) filterToolbar.style.display = 'block';
  const refreshWantsBtn = document.getElementById('refresh-wants-btn');
  if (refreshWantsBtn) {
    refreshWantsBtn.style.display = 'flex';
    refreshWantsBtn.disabled = false;
  }
  const currentActiveTab = state.currentTab || 'sellers';
  currentAppView = `results-${currentActiveTab}`;
  updateForwardAndBackButtons();
  resultsGrid.style.display = currentActiveTab === 'sellers' ? 'grid' : 'none';
  const resultsViewWrapper = document.getElementById('results-view-wrapper');
  if (resultsViewWrapper) resultsViewWrapper.style.display = currentActiveTab === 'sellers' ? 'flex' : 'none';
  const smartCard = document.getElementById('smart-purchase-card');
  if (smartCard) smartCard.style.display = currentActiveTab === 'sellers' ? 'block' : 'none';
  const statsView = document.getElementById('stats-view');
  if (statsView) statsView.style.display = currentActiveTab === 'stats' ? 'flex' : 'none';
  const localView = document.getElementById('local-view');
  if (localView) localView.style.display = currentActiveTab === 'local' ? 'block' : 'none';
  if (currentActiveTab === 'stats') {
    calculateAndRenderStats();
  }
  resultsGrid.innerHTML = '';
  
  // Render cards with isolated Error Boundary per seller
  filtered.forEach((seller, idx) => {
    try {
      if (!seller || !seller.name) return;
      const card = document.createElement('div');
      card.className = 'seller-card';
      card.id = 'seller-card-' + seller.name;
      
      const activeListings = seller.displayListings || seller.listings || [];
      const activeSubtotal = activeListings.reduce((sum, item) => sum + (item.priceVal || 0), 0);
      const activeShipping = calculateSellerShipping(seller, activeListings);
      const activeTotalPrice = activeSubtotal + activeShipping;
      const bundleItemShipping = activeShipping / Math.max(activeListings.length, 1);
      const rankNumber = String(idx + 1).padStart(2, '0');
      const matchPct = ((activeListings.length / Math.max(state.wants.length, 1)) * 100).toFixed(1);

      // Generate deep-dive catalog rows
      let listingsHtml = '';
      const totalPages = Math.ceil(activeListings.length / 10);

      activeListings.forEach((list, rowIdx) => {
        const pageNumber = Math.floor(rowIdx / 10) + 1;
        const isHiddenStyle = pageNumber > 1 ? 'display: none;' : '';
        const wantInfo = state.wants.find(w => String(w.id) === String(list.releaseId)) || { title: 'Unknown Title', artist: 'Unknown Artist' };
        const isPriority = priorityIds.some(pid => String(pid) === String(list.releaseId));
        const starHtml = isPriority ? `<span class="text-prada-red mr-1" title="Disco prioritario">★</span>` : '';
        const coverRaw = wantInfo.image || wantInfo.cover || wantInfo.thumb || wantInfo.coverImage || wantInfo.cover_image || list.image || '';
        const coverThumb = upgradeDiscogsImageUrl(coverRaw);
        const imgHtml = coverThumb
          ? `<img alt="${escapeHTML(wantInfo.title || 'Vinyl')}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none group-hover/img:scale-110 transition-transform duration-300" src="${escapeHTML(coverThumb)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
             <div class="w-full h-full hidden items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-sm">album</span></div>`
          : `<div class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-sm">album</span></div>`;

        const artistLabel = wantInfo.artist || list.releaseArtist || list.artist || 'Unknown Artist';
        const titleLabel = wantInfo.title || list.releaseTitle || list.title || 'Unknown Title';
        const labelText = [wantInfo.label || list.label || '', wantInfo.catno || list.catno || '', wantInfo.year || list.year || ''].filter(Boolean).join(' • ');

        listingsHtml += `
          <div class="seller-listing-row grid grid-cols-12 gap-4 items-center px-4 py-3.5 border border-hairline-light hover:border-prada-blue bg-ivory-warm/40 transition-colors" data-seller="${escapeHTML(seller.name)}" data-page="${pageNumber}" style="${isHiddenStyle}">
            <div class="col-span-5 flex items-center gap-3">
              <input checked="" class="h-4 w-4 border-hairline-dark text-prada-red shrink-0 focus:ring-0" type="checkbox"/>
              <div class="w-12 h-12 bg-bone border border-hairline-light shrink-0 overflow-hidden relative group/img">
                ${imgHtml}
              </div>
              <div class="flex flex-col min-w-0 font-mono">
                <a href="https://www.discogs.com/release/${list.releaseId}" target="_blank" class="font-sans font-bold text-xs sm:text-sm tracking-tight text-pitch-black uppercase truncate hover:text-prada-red transition-colors">
                  ${starHtml}${escapeHTML(artistLabel)} — ${escapeHTML(titleLabel)}
                </a>
                <span class="text-[10px] text-muted-graphite uppercase truncate mt-0.5">${escapeHTML(labelText || 'DISCOGS MARKETPLACE ITEM')}</span>
              </div>
            </div>
            <div class="col-span-2 flex justify-center items-center gap-1.5 font-mono text-[10px]">
              ${renderGoldmineTag(list.mediaCondition, false)}
              ${renderGoldmineTag(list.sleeveCondition || 'Generic', true)}
            </div>
            <div class="col-span-2 text-right font-mono">
              <span class="font-bold text-sm text-pitch-black tracking-tight">${formatPrice(list.priceVal, list.currency)}</span>
            </div>
            <div class="col-span-2 text-right font-mono text-[11px]">
              <span class="text-muted-graphite line-through text-[10px] block">${formatPrice(list.shippingVal || 18.50, list.currency)}</span>
              <span class="font-bold text-prada-emerald block">LOTE: ${formatPrice(bundleItemShipping, seller.currency)}</span>
            </div>
            <div class="col-span-1 flex justify-center">
              <a href="${list.listingUrl || (list.listingId ? 'https://www.discogs.com/sell/item/' + list.listingId : 'https://www.discogs.com/release/' + list.releaseId)}" target="_blank" class="w-7 h-7 border border-hairline-light hover:border-prada-blue hover:text-prada-blue flex items-center justify-center text-pitch-black transition-colors" title="Ver Oferta">
                <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
              </a>
            </div>
          </div>
        `;
      });
      
      const sellerShippingWarning = seller.isShippingEstimated 
        ? `<span class="shipping-estimate-warning" style="color: var(--color-amber); cursor: help; margin-left: 4px;" title="Envío estimado por seguridad.">⚠️</span>` 
        : '';
      
      card.innerHTML = `
        <!-- Linea Rossa Strip Indicator (visible when expanded) -->
        <div class="h-1 bg-prada-red w-full hidden" id="strip-indicator-${seller.name}"></div>

        <!-- Collapsed Header Strip -->
        <div class="px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-4 transition-colors shadow-sm bg-pure-white" id="header-strip-${seller.name}">
          <div class="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
            <span class="font-mono font-bold text-xs text-prada-red bg-prada-red-bg px-2 py-0.5 border border-prada-red/30 shrink-0">#${rankNumber}</span>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span class="font-sans font-bold text-base uppercase tracking-tight text-pitch-black truncate max-w-[180px] sm:max-w-none">${escapeHTML(seller.name)}</span>
                <span class="border border-emerald-300 bg-prada-emerald-bg px-1.5 py-0.5 text-[9px] font-mono uppercase text-emerald-900 font-bold">${seller.rating}%</span>
                <span class="font-mono text-[10px] text-prada-blue uppercase font-semibold">${getCountryFlag(seller.shipsFrom)} ${escapeHTML(seller.shipsFrom)}</span>
              </div>
              <span class="font-mono text-[10px] text-muted-graphite uppercase tracking-wider mt-0.5 truncate">${seller.ratingCount > 0 ? `${seller.ratingCount.toLocaleString()} CALIFICACIONES • ` : ''}${seller.isDomestic ? 'ENVÍO AUTOMATIZADO (NACIONAL)' : (seller.isEUToEU ? 'ENVÍO INTRA-UE' : 'TIENDA VERIFICADA DISCOGS')}</span>
            </div>
          </div>
          <!-- Architectural Commercial Metrics Pod -->
          <div class="metrics-pod flex items-center divide-x divide-hairline-light border border-hairline-light bg-ivory-warm/50 px-2 py-2 font-mono shadow-2xs">
            <div class="px-3 sm:px-5 text-right">
              <span class="text-[9px] text-muted-graphite uppercase tracking-widest block font-semibold mb-1">COINCIDENCIAS</span>
              <span class="font-bold text-prada-red text-xs sm:text-[13px] whitespace-nowrap block">
                ${activeListings.length} DE ${state.wants.length} <span class="text-muted-graphite font-normal text-[10px]">(${matchPct}%)</span>
              </span>
            </div>
            <div class="px-3 sm:px-5 text-right">
              <span class="text-[9px] text-muted-graphite uppercase tracking-widest block font-semibold mb-1">SUBTOTAL</span>
              <span class="font-bold text-pitch-black text-xs sm:text-[13px] whitespace-nowrap block">
                ${formatPrice(activeSubtotal, seller.currency)}
              </span>
            </div>
            <div class="px-3 sm:px-5 text-right">
              <span class="text-[9px] text-muted-graphite uppercase tracking-widest block font-semibold mb-1">ENVÍO A UY</span>
              <span class="font-bold text-prada-blue text-xs sm:text-[13px] whitespace-nowrap block">
                ${formatPrice(activeShipping, seller.currency)}${sellerShippingWarning}
              </span>
            </div>
            <div class="pl-3 sm:pl-5 pr-3 sm:pr-4 text-right min-w-[105px] sm:min-w-[125px] bg-pure-white/90 py-1 border-l border-hairline-light">
              <span class="text-[9px] text-muted-graphite uppercase tracking-widest block font-semibold mb-1">TOTAL EST.</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black whitespace-nowrap block">
                ${formatPrice(activeTotalPrice, seller.currency)}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 font-mono">
            <a class="border border-hairline-light hover:border-prada-blue px-4 py-2 text-[10px] uppercase tracking-widest text-pitch-black hover:text-prada-blue transition-colors flex items-center gap-1 font-semibold" href="https://www.discogs.com/seller/${encodeURIComponent(seller.name)}/mywants" target="_blank" rel="noreferrer">
              <span>DISCOGS</span>
              <span class="material-symbols-outlined text-[13px]">open_in_new</span>
            </a>
            <button aria-label="Expandir" class="btn-collapse w-8 h-8 border border-hairline-light hover:border-pitch-black flex items-center justify-center text-pitch-black transition-colors cursor-pointer" data-seller="${seller.name}" type="button">
              <span class="material-symbols-outlined text-[16px] pointer-events-none">expand_more</span>
            </button>
          </div>
        </div>
        
        <!-- Expanded Inventory Details Panel with Horizontal Scroller for Mobile Safety -->
        <div class="listings-details border-t border-hairline-dark bg-pure-white flex flex-col" id="details-${seller.name}" style="display: none;">
          <div class="overflow-x-auto w-full">
            <div class="min-w-[620px]">
              <!-- Table Header -->
              <div class="grid grid-cols-12 gap-4 px-4 py-2.5 bg-ivory-warm border-b border-hairline-light font-mono text-[9px] uppercase tracking-widest text-muted-graphite font-bold">
                <div class="col-span-5">DISCO / EDICIÓN</div>
                <div class="col-span-2 text-center">ESTADO (VINILO / TAPA)</div>
                <div class="col-span-2 text-right">PRECIO ÍTEM</div>
                <div class="col-span-2 text-right">ENVÍO APROX / LOTE</div>
                <div class="col-span-1 text-center">ENLACE</div>
              </div>
              
              <!-- Rows container -->
              <div class="divide-y divide-hairline-light">
                ${listingsHtml}
              </div>
            </div>
          </div>

          <!-- Pagination Bar (if totalPages > 1) -->
          ${totalPages > 1 ? `
            <div class="seller-pagination px-4 py-3 bg-ivory-warm/60 border-t border-hairline-light flex flex-wrap items-center justify-between gap-3 font-mono text-xs" data-seller="${escapeHTML(seller.name)}" data-current-page="1" data-total-pages="${totalPages}">
              <div class="text-[11px] text-muted-graphite">
                MOSTRANDO <span class="seller-page-range font-bold text-pitch-black">1–${Math.min(10, activeListings.length)}</span> DE <span class="font-bold text-pitch-black">${activeListings.length}</span> DISCOS
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" class="btn-seller-prev w-7 h-7 flex items-center justify-center border border-hairline-light bg-pure-white hover:border-pitch-black text-pitch-black transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer" disabled title="Página anterior">
                  <span class="material-symbols-outlined text-[14px]">chevron_left</span>
                </button>
                <div class="seller-page-btn-group flex items-center gap-1">
                  ${buildSellerPageButtonsHtml(seller.name, 1, totalPages)}
                </div>
                <button type="button" class="btn-seller-next w-7 h-7 flex items-center justify-center border border-hairline-light bg-pure-white hover:border-pitch-black text-pitch-black transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer" ${totalPages <= 1 ? 'disabled' : ''} title="Página siguiente">
                  <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    resultsGrid.appendChild(card);
    } catch (cardErr) {
      console.error('Error rendering seller card for:', seller?.name, cardErr);
    }
  });

  // Animate metric counters & sync top luxury ticker
  const tickerWants = document.getElementById('ticker-wants-count');
  if (tickerWants) tickerWants.textContent = `${state.wants.length} DISCOS`;
  const tickerSellers = document.getElementById('ticker-sellers-count');
  if (tickerSellers) tickerSellers.textContent = `${filtered.length}`;
  const tickerMatches = document.getElementById('ticker-matches-count');
  const totalOffersCount = filtered.reduce((s, sel) => s + (sel.listings?.length || 0), 0);
  if (tickerMatches) tickerMatches.textContent = `${totalOffersCount.toLocaleString()}`;
  const selectionSummary = document.getElementById('selection-sellers-summary');
  if (selectionSummary) selectionSummary.textContent = `// ${filtered.length} TIENDAS EVALUADAS CON ALGORITMO LOGÍSTICO`;

  if (window.Motion) {
    const wantsCount   = parseInt(document.getElementById('metric-wants-count')?.textContent || '0');
    const sellersCount = filtered.length;
    const matchesCount = totalOffersCount;
    window.Motion.animateMetrics(wantsCount, sellersCount, matchesCount);

    requestAnimationFrame(() => {
      const resultsEl = document.getElementById('results-grid');
      if (resultsEl) resultsEl.classList.add('visible');
    });
  }

  // Attach expand / collapse event listeners to cards with Prada styling
  document.querySelectorAll('.btn-collapse').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sName = e.currentTarget.getAttribute('data-seller');
      const detailsDiv = document.getElementById(`details-${sName}`);
      const isExpanded = detailsDiv && detailsDiv.style.display !== 'none';
      if (isExpanded) {
        collapseSellerCard(sName);
      } else {
        expandSellerCard(sName);
      }
    });
  });

  // Attach pagination event listeners inside seller cards
  document.querySelectorAll('.seller-pagination').forEach(paginationEl => {
    const sName = paginationEl.getAttribute('data-seller');
    const prevBtn = paginationEl.querySelector('.btn-seller-prev');
    const nextBtn = paginationEl.querySelector('.btn-seller-next');
    const btnGroup = paginationEl.querySelector('.seller-page-btn-group');

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const curPage = parseInt(paginationEl.getAttribute('data-current-page'), 10) || 1;
        goToSellerPage(sName, curPage - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const curPage = parseInt(paginationEl.getAttribute('data-current-page'), 10) || 1;
        goToSellerPage(sName, curPage + 1);
      });
    }

    if (btnGroup) {
      btnGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        const pageBtn = e.target.closest('.btn-seller-page');
        if (pageBtn) {
          const page = parseInt(pageBtn.getAttribute('data-page'), 10);
          if (page) goToSellerPage(sName, page);
        }
      });
    }
  });
}

// Build pagination number buttons for seller crate table
function buildSellerPageButtonsHtml(sellerName, currentPage, totalPages) {
  let pages = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (currentPage <= 3) {
      pages = [1, 2, 3, 4, '...', totalPages];
    } else if (currentPage >= totalPages - 2) {
      pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    }
  }

  return pages.map(p => {
    if (p === '...') {
      return `<span class="w-5 text-center text-muted-graphite text-[10px] font-mono select-none">…</span>`;
    }
    const isActive = p === currentPage;
    return `<button type="button" class="btn-seller-page w-7 h-7 flex items-center justify-center border text-[10px] font-mono font-bold transition-colors cursor-pointer ${isActive ? 'bg-prada-red text-pure-white border-prada-red shadow-xs' : 'bg-pure-white text-pitch-black border-hairline-light hover:border-pitch-black'}" data-seller="${escapeHTML(sellerName)}" data-page="${p}">${p}</button>`;
  }).join('');
}

// Navigate to specific page inside a seller card
function goToSellerPage(sellerName, newPage) {
  const card = document.getElementById(`seller-card-${sellerName}`);
  if (!card) return;
  const paginationEl = card.querySelector(`.seller-pagination[data-seller="${CSS.escape(sellerName)}"]`);
  if (!paginationEl) return;

  const totalPages = parseInt(paginationEl.getAttribute('data-total-pages'), 10) || 1;
  const targetPage = Math.max(1, Math.min(newPage, totalPages));
  paginationEl.setAttribute('data-current-page', targetPage);

  // Update visible rows
  const allRows = card.querySelectorAll(`.seller-listing-row[data-seller="${CSS.escape(sellerName)}"]`);
  allRows.forEach(row => {
    const rowPage = parseInt(row.getAttribute('data-page'), 10);
    if (rowPage === targetPage) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });

  // Update range and current indicator text
  const totalListings = allRows.length;
  const startIdx = (targetPage - 1) * 10 + 1;
  const endIdx = Math.min(targetPage * 10, totalListings);

  const rangeEl = paginationEl.querySelector('.seller-page-range');
  if (rangeEl) rangeEl.textContent = `${startIdx}–${endIdx}`;

  const currentEl = paginationEl.querySelector('.seller-page-current');
  if (currentEl) currentEl.textContent = `${targetPage}`;

  // Update prev / next buttons
  const prevBtn = paginationEl.querySelector('.btn-seller-prev');
  if (prevBtn) prevBtn.disabled = targetPage <= 1;

  const nextBtn = paginationEl.querySelector('.btn-seller-next');
  if (nextBtn) nextBtn.disabled = targetPage >= totalPages;

  // Update page number buttons
  const btnGroup = paginationEl.querySelector('.seller-page-btn-group');
  if (btnGroup) {
    btnGroup.innerHTML = buildSellerPageButtonsHtml(sellerName, targetPage, totalPages);
  }

  // Smooth scroll up to header strip if user scrolled down
  const headerStrip = document.getElementById(`header-strip-${sellerName}`);
  if (headerStrip) {
    const rect = headerStrip.getBoundingClientRect();
    if (rect.top < 70) {
      headerStrip.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Function to expand a seller card and reveal its vinyl inventory
function expandSellerCard(sName) {
  const detailsDiv = document.getElementById(`details-${sName}`);
  const parentCard = document.getElementById(`seller-card-${sName}`);
  const stripIndicator = document.getElementById(`strip-indicator-${sName}`);
  const headerStrip = document.getElementById(`header-strip-${sName}`);
  const collapseBtn = document.querySelector(`.btn-collapse[data-seller="${CSS.escape(sName)}"]`);

  if (detailsDiv) {
    detailsDiv.style.display = 'flex';
  }
  if (parentCard) {
    parentCard.classList.add('is-expanded');
    parentCard.style.borderColor = '#E02B20';
    parentCard.style.boxShadow = '0 6px 20px rgba(224, 43, 32, 0.2)';
    setTimeout(() => {
      if (parentCard.classList.contains('is-expanded')) {
        parentCard.style.boxShadow = '0 4px 14px rgba(224, 43, 32, 0.1)';
      }
    }, 2000);
  }
  if (stripIndicator) stripIndicator.classList.remove('hidden');
  if (headerStrip) headerStrip.style.backgroundColor = '#FDF2F1';
  if (collapseBtn) {
    collapseBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] pointer-events-none">expand_less</span>';
  }
}

// Function to collapse a seller card
function collapseSellerCard(sName) {
  const detailsDiv = document.getElementById(`details-${sName}`);
  const parentCard = document.getElementById(`seller-card-${sName}`);
  const stripIndicator = document.getElementById(`strip-indicator-${sName}`);
  const headerStrip = document.getElementById(`header-strip-${sName}`);
  const collapseBtn = document.querySelector(`.btn-collapse[data-seller="${CSS.escape(sName)}"]`);

  if (detailsDiv) {
    detailsDiv.style.display = 'none';
  }
  if (parentCard) {
    parentCard.classList.remove('is-expanded');
    parentCard.style.borderColor = '#E5E3DC';
    parentCard.style.boxShadow = '';
  }
  if (stripIndicator) stripIndicator.classList.add('hidden');
  if (headerStrip) headerStrip.style.backgroundColor = '#FFFFFF';
  if (collapseBtn) {
    collapseBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] pointer-events-none">expand_more</span>';
  }
}

// Wantlist Manager UI functions
function showWantlistManager(pushHistory = true) {
  navigateToView('wantlist', pushHistory);
  if (wantsSearchInput) wantsSearchInput.value = '';
  if (refreshWantsBtn) {
    refreshWantsBtn.style.display = 'flex';
    refreshWantsBtn.disabled = false;
  }
  renderWantsManagerList();
}

function renderWantsManagerList() {
  renderWantsListInManager();
}

function toggleWantPriority(id, cardEl) {
  const item = state.wants.find(w => w.id === id);
  if (!item) return;
  
  item.isPriority = !item.isPriority;
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('FAVORITE_TOGGLED', `${item.isPriority ? 'Marcado como prioritario' : 'Desmarcado de prioritarios'}: ${item.title || id}`, {
        releaseId: id,
        title: item.title,
        isPriority: item.isPriority,
        username: state.username
      });
    }
  } catch (e) {}
  
  const star = cardEl.querySelector('.want-star');
  if (item.isPriority) {
    cardEl.classList.add('priority');
    star.classList.add('active');
  } else {
    cardEl.classList.remove('priority');
    star.classList.remove('active');
  }
  
  // Re-run results filter if we are already displaying results
  if (state.groupedSellers.length > 0) {
    renderResults();
  }
}


// Onboarding Wizard step navigation
function goToWizardStep(stepNum) {
  const panes = document.querySelectorAll('.wizard-step-pane');
  if (!panes || panes.length === 0) return;

  // Find current visible pane
  let currentStep = 1;
  for (let i = 1; i <= 3; i++) {
    const pane = document.getElementById(`step-pane-${i}`);
    if (pane && pane.style.display !== 'none' && pane.offsetParent !== null) {
      currentStep = i;
      break;
    }
  }

  // Use Motion system for animated transition
  if (window.Motion && currentStep !== stepNum) {
    window.Motion.goToStep(currentStep, stepNum);
  } else {
    // Fallback: hide all, show target
    panes.forEach(pane => {
      pane.classList.remove('active');
      pane.style.display = 'none';
    });
    const targetPane = document.getElementById(`step-pane-${stepNum}`);
    if (targetPane) {
      targetPane.classList.add('active');
      targetPane.style.display = 'flex';
    }
  }

  // Update indicator dots with animated transitions
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) {
      if (i < stepNum) {
        dot.classList.add('completed', 'active');
      } else if (i === stepNum) {
        dot.classList.add('active');
        dot.classList.remove('completed');
      } else {
        dot.classList.remove('active', 'completed');
      }
    }
  }
}

// Shipping Location destination country update listener
function onLocationChange() {
  log(`Ubicación de envío de comprador actualizada a: ${buyerCountry.value}`, 'info');
  if (state.allListings.length > 0) {
    groupListingsBySeller();
    renderResults();
  }
}

// Save manual username inside onboarding wizard
function saveWizardManualUsername() {
  const wizardUsernameInput = document.getElementById('wizard-manual-username');
  const username = wizardUsernameInput ? wizardUsernameInput.value.trim() : '';
  if (username) {
    localStorage.setItem('discogs_username', username);
    setLoggedInUser(username);
    log(`Usuario '${username}' configurado manualmente.`, 'success');
    showToast(`Usuario '${username}' guardado con éxito`, 'success');
  } else {
    alert('Por favor ingresa un nombre de usuario de Discogs válido.');
  }
}

// Show sleek toast notifications
function showToast(message, type = 'info', duration = 3500) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    info: 'ℹ️',
    success: '✨',
    warning: '⚠️',
    error: '❌'
  };

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger smooth enter animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

// Hardware Acceleration Detection
function checkHardwareAcceleration() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      showGPUWarningBanner();
      return;
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
      if (/swiftshader|software|llvmpipe|basic render|microsoft basic/i.test(renderer)) {
        showGPUWarningBanner();
      }
    }
  } catch (e) {
    console.warn('GPU Hardware acceleration check skipped:', e);
  }
}

function showGPUWarningBanner() {
  if (localStorage.getItem('dismissed_gpu_warning') === 'true') return;

  const banner = document.createElement('div');
  banner.className = 'gpu-warning-banner';
  banner.innerHTML = `
    <span class="gpu-banner-icon">⚡</span>
    <div class="gpu-banner-text">
      <strong>Aceleración por Hardware Desactivada</strong>
      <p>Para mayor fluidez a 60 FPS, activa la Aceleración por Hardware en <code>chrome://settings/system</code> o <code>brave://settings/system</code>.</p>
    </div>
    <button class="gpu-banner-close" title="Cerrar aviso">✕</button>
  `;

  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));

  const closeBtn = banner.querySelector('.gpu-banner-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      banner.classList.remove('show');
      localStorage.setItem('dismissed_gpu_warning', 'true');
      setTimeout(() => banner.remove(), 400);
    });
  }
}

// Clear the storage-based scan cache with sleek Toast feedback
async function clearScanCache() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(k => k.startsWith('release_'));
      if (keysToRemove.length === 0) {
        log('La caché de escaneo ya está vacía.', 'info');
        showToast('La caché de escaneo ya está completamente vacía.', 'info');
        return;
      }
      chrome.storage.local.remove(keysToRemove, () => {
        log(`Caché de escaneo limpiada con éxito (${keysToRemove.length} elementos eliminados).`, 'success');
        showToast(`🧹 ¡Caché limpiada con éxito! Se eliminaron ${keysToRemove.length} discos guardados.`, 'success');
      });
    });
  } else {
    showToast('La caché de almacenamiento local no está disponible.', 'error');
  }
}

// Background helper to enrich community stats (wantCount / haveCount) for all wants directly from Discogs API
async function enrichWantlistStats() {
  if (!state.wants || state.wants.length === 0) return;
  // Mark items that already have want/have count as enriched
  state.wants.forEach(w => {
    if (w.wantCount !== undefined && w.wantCount !== null) {
      w._statsEnriched = true;
    }
  });
  
  const itemsToFetch = state.wants.filter(w => !w._statsEnriched);
  if (itemsToFetch.length === 0) return;

  console.log(`[StatsEnrich 🚀] Omite llamadas innecesarias a la API para prevenir límite 429... (${itemsToFetch.length} sin stats)`);
  itemsToFetch.forEach(item => { item._statsEnriched = true; });
}

// Calculate and render all wantlist & marketplace statistics
function calculateAndRenderStats() {
  const statsView = document.getElementById('stats-view');
  if (!statsView) return;
  
  try {
    const allWants = (state.wants || []).filter(w => w && w.id != null);
    const allListings = (state.allListings || []).filter(l => l && l.releaseId != null);
    const totalWantsCount = allWants.length;
    
    // Fast lookup set of release IDs that have at least one valid listing
    const releasesWithListings = new Set(
      allListings
        .filter(l => (typeof l.priceVal === 'number' ? l.priceVal : parseFloat(l.priceVal) || 0) > 0)
        .map(l => String(l.releaseId))
    );
    
    // Find releases that are actually for sale (have at least one match)
    const wantsForSale = allWants.filter(w => releasesWithListings.has(String(w.id)));
    
    // Find releases not for sale (0 matches for the buyer's destination)
    const wantsNotForSale = allWants.filter(w => !releasesWithListings.has(String(w.id)));

    const buyerCountryVal = (buyerCountry ? buyerCountry.value : 'Uruguay') || 'Uruguay';

    // Helper to determine if a release has copies on Discogs that don't ship to the buyer
    const isBlockedByShipping = (w) => {
      if (w.unshippableCount && w.unshippableCount > 0) return true;
      if (w.totalWorldListings && w.totalWorldListings > 0) return true;
      if (w.forSaleCount && w.forSaleCount > 0) return true;
      if (w.communityStats && w.communityStats.totalOffersCount > 0) return true;
      return false;
    };

    const getWorldCount = (w) => {
      return (typeof w.totalWorldListings === 'number' ? w.totalWorldListings : 0) ||
             (typeof w.forSaleCount === 'number' ? w.forSaleCount : 0) ||
             (w.communityStats && w.communityStats.totalOffersCount ? w.communityStats.totalOffersCount : 0) ||
             (w.unshippableCount > 0 ? w.unshippableCount : 0) ||
             0;
    };

    const wantsBlockedByShipping = wantsNotForSale.filter(w => isBlockedByShipping(w));
    const wantsTrulyUnavailable = wantsNotForSale.filter(w => !isBlockedByShipping(w));

    const renderNotForSaleItem = (w, isBlocked) => {
      const worldCount = getWorldCount(w);
      const locations = w.unshippableLocations || [];
      const locationsText = locations.length > 0
        ? `<span class="badge-seller-countries font-mono text-[9px] text-muted-graphite uppercase" title="Vendedores ubicados en: ${escapeHTML(locations.join(', '))}">📍 ${escapeHTML(locations.slice(0, 3).join(', '))}${locations.length > 3 ? ' +' + (locations.length - 3) : ''}</span>`
        : '';
      
      const badgeHtml = isBlocked
        ? `<div class="flex items-center flex-wrap gap-1.5 mt-1">
             <span class="badge-shipping-blocked font-mono text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.5">🌍 ${worldCount > 0 ? worldCount + ' en venta' : 'En venta'} · Sin envío a ${escapeHTML(buyerCountryVal)}</span>
             ${locationsText}
           </div>`
        : `<div class="flex items-center gap-1.5 mt-1">
             <span class="badge-truly-unavailable font-mono text-[9px] font-bold uppercase bg-prada-red-bg text-prada-red border border-prada-red/40 px-1.5 py-0.5">🚫 0 en venta en Discogs</span>
           </div>`;

      const discogsBtn = isBlocked
        ? `<a href="https://www.discogs.com/sell/release/${w ? w.id : ''}?limit=100" target="_blank" class="border border-hairline-dark hover:border-pitch-black bg-pure-white text-pitch-black font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 transition-colors whitespace-nowrap inline-flex items-center gap-1 shadow-2xs" title="Ver copias en venta en otros países"><span>OFERTAS (${worldCount || '↗'})</span><span class="material-symbols-outlined text-[12px]">open_in_new</span></a>`
        : `<a href="https://www.discogs.com/release/${w ? w.id : ''}" target="_blank" class="border border-hairline-dark hover:border-pitch-black bg-pure-white text-pitch-black font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 transition-colors whitespace-nowrap inline-flex items-center gap-1 shadow-2xs" title="Ver ficha técnica en Discogs"><span>FICHA DISCOGS</span><span class="material-symbols-outlined text-[12px]">open_in_new</span></a>`;

      return `
        <div class="not-for-sale-row flex items-center justify-between p-3 border border-hairline-light bg-pure-white hover:border-pitch-black transition-all shadow-2xs font-mono" data-category="${isBlocked ? 'blocked' : 'zero'}">
          <div class="not-for-sale-info flex items-center gap-3 min-w-0 flex-1">
            <div class="not-for-sale-cover w-11 h-11 border border-hairline-dark bg-bone shrink-0 overflow-hidden relative shadow-2xs" style="background-image: url('${(w && w.image) ? w.image : ''}'); background-size: cover; background-position: center;">
              ${(!w || !w.image) ? `<span class="flex items-center justify-center h-full text-muted-graphite"><span class="material-symbols-outlined text-lg">album</span></span>` : ''}
            </div>
            <div class="not-for-sale-text text-left min-w-0 flex-1">
              <span class="not-for-sale-title font-sans font-extrabold text-xs uppercase tracking-tight text-pitch-black block truncate" title="${escapeHTML(w ? w.title : '')}">${escapeHTML(w ? w.title : 'Desconocido')}</span>
              <span class="not-for-sale-artist text-[10px] text-muted-graphite uppercase tracking-wider block truncate mt-0.5" title="${escapeHTML(w ? w.artist : '')}">${escapeHTML(w ? w.artist : 'Desconocido')}</span>
              ${badgeHtml}
            </div>
          </div>
          <div class="shrink-0 ml-2">
            ${discogsBtn}
          </div>
        </div>
      `;
    };
    
    // Group listings by releaseId for quick cheapest calculation
    const listingsByRelease = new Map();
    allListings.forEach(l => {
      const p = typeof l.priceVal === 'number' ? l.priceVal : (parseFloat(l.priceVal) || 0);
      if (p <= 0) return;
      const relIdStr = String(l.releaseId);
      if (!listingsByRelease.has(relIdStr)) {
        listingsByRelease.set(relIdStr, []);
      }
      listingsByRelease.get(relIdStr).push(l);
    });

    // For each release in Wantlist with at least one listing, find its CHEAPEST entry copy (fair comparison in USD)
    const releaseEntryPrices = [];
    
    allWants.forEach(w => {
      const relListings = listingsByRelease.get(String(w.id));
      if (!relListings || relListings.length === 0) return;
      
      let cheapestListing = null;
      let cheapestUSD = Infinity;
      
      relListings.forEach(l => {
        let rate = CURRENCY_MAP[l.currency]?.rate || 1.0;
        let priceVal = typeof l.priceVal === 'number' ? l.priceVal : (parseFloat(l.priceVal) || 0);
        
        // Auto-heal small JPY values from legacy cache (e.g. 3.92 JPY -> $3.92 USD) so they aren't treated as $0.02 USD
        if (l.currency === 'JPY' && priceVal < 100) {
          rate = 1.0;
        }
        
        const priceUSD = priceVal * rate;
        if (priceUSD > 0 && priceUSD < cheapestUSD) {
          cheapestUSD = priceUSD;
          cheapestListing = l;
        }
      });
      
      if (cheapestListing) {
        releaseEntryPrices.push({
          want: w,
          listing: cheapestListing,
          priceUSD: cheapestUSD
        });
      }
    });

    // Top 5 cheapest releases by their lowest entry price
    const top5Cheapest = [...releaseEntryPrices]
      .sort((a, b) => a.priceUSD - b.priceUSD)
      .slice(0, 5);

    // Top 5 most expensive releases (Objetos de Lujo) by their lowest entry price
    const top5Expensive = [...releaseEntryPrices]
      .sort((a, b) => b.priceUSD - a.priceUSD)
      .slice(0, 5);
    
    // Safe want count extractor
    const getWantCount = (item) => {
      if (!item || item.wantCount == null) return 0;
      const parsed = typeof item.wantCount === 'number'
        ? item.wantCount
        : parseFloat(String(item.wantCount).replace(/,/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    };

    // Find community wants metrics
    const wantsWithStats = allWants.filter(w => getWantCount(w) > 0);
    
    let top5MostWanted = [];
    let top5LeastWanted = [];
    
    if (wantsWithStats.length > 0) {
      top5MostWanted = [...wantsWithStats]
        .sort((a, b) => getWantCount(b) - getWantCount(a))
        .slice(0, 5);

      top5LeastWanted = [...wantsWithStats]
        .sort((a, b) => getWantCount(a) - getWantCount(b))
        .slice(0, 5);
    }
    
    // Render Cheapest html list
    let cheapestListHtml = '';
    if (top5Cheapest.length > 0) {
      top5Cheapest.forEach((x, idx) => {
        const l = x.listing;
        const w = x.want || allWants.find(item => String(item.id) === String(l.releaseId)) || { title: 'Unknown', artist: 'Unknown', image: '' };
        cheapestListHtml += `
          <div class="stats-album-layout flex items-center justify-between py-2.5 border-b border-hairline-light font-mono">
            <div class="stats-album-cover w-11 h-11 border border-hairline-dark bg-bone shrink-0 shadow-2xs" style="background-image: url('${(w && w.image) ? w.image : ''}'); background-size: cover; background-position: center;"></div>
            <div class="stats-album-info ml-3 flex-1 min-w-0 text-left">
              <span class="font-sans font-bold text-xs uppercase tracking-tight text-pitch-black block truncate" title="${escapeHTML(w ? w.title : '')}">${idx + 1}. ${escapeHTML(w ? w.title : 'Desconocido')}</span>
              <span class="text-[10px] text-muted-graphite uppercase tracking-wider block truncate mt-0.5" title="${escapeHTML(w ? w.artist : '')}">${escapeHTML(w ? w.artist : 'Desconocido')}</span>
              <div class="flex items-center justify-between mt-1.5 flex-wrap gap-2">
                <span class="font-mono font-bold text-xs text-emerald-700">${formatPrice(l.priceVal, l.currency)}</span>
                <span class="text-[9px] text-muted-graphite uppercase">👤 ${escapeHTML(l.sellerName || 'Vendedor')} (${escapeHTML(l.shipsFrom || 'N/A')})</span>
                <a href="${l.listingUrl || (l.listingId ? 'https://www.discogs.com/sell/item/' + l.listingId : 'https://www.discogs.com/release/' + l.releaseId)}" target="_blank" class="border border-hairline-dark hover:border-pitch-black bg-pure-white text-pitch-black text-[9px] font-mono font-bold uppercase px-2 py-0.5 transition-colors shadow-2xs">Ver Oferta ↗</a>
              </div>
            </div>
          </div>
        `;
      });
    } else {
      cheapestListHtml = `<p class="font-mono text-xs text-muted-graphite py-4">No se encontraron ofertas para calcular precios.</p>`;
    }

    // Render Expensive html list
    let expensiveListHtml = '';
    if (top5Expensive.length > 0) {
      top5Expensive.forEach((x, idx) => {
        const l = x.listing;
        const w = x.want || allWants.find(item => String(item.id) === String(l.releaseId)) || { title: 'Unknown', artist: 'Unknown', image: '' };
        expensiveListHtml += `
          <div class="stats-album-layout flex items-center justify-between py-2.5 border-b border-hairline-light font-mono">
            <div class="stats-album-cover w-11 h-11 border border-hairline-dark bg-bone shrink-0 shadow-2xs" style="background-image: url('${(w && w.image) ? w.image : ''}'); background-size: cover; background-position: center;"></div>
            <div class="stats-album-info ml-3 flex-1 min-w-0 text-left">
              <span class="font-sans font-bold text-xs uppercase tracking-tight text-pitch-black block truncate" title="${escapeHTML(w ? w.title : '')}">${idx + 1}. ${escapeHTML(w ? w.title : 'Desconocido')}</span>
              <span class="text-[10px] text-muted-graphite uppercase tracking-wider block truncate mt-0.5" title="${escapeHTML(w ? w.artist : '')}">${escapeHTML(w ? w.artist : 'Desconocido')}</span>
              <div class="flex items-center justify-between mt-1.5 flex-wrap gap-2">
                <span class="font-mono font-bold text-xs text-prada-blue">${formatPrice(l.priceVal, l.currency)}</span>
                <span class="text-[9px] text-muted-graphite uppercase">👤 ${escapeHTML(l.sellerName || 'Vendedor')} (${escapeHTML(l.shipsFrom || 'N/A')})</span>
                <a href="${l.listingUrl || (l.listingId ? 'https://www.discogs.com/sell/item/' + l.listingId : 'https://www.discogs.com/release/' + l.releaseId)}" target="_blank" class="border border-hairline-dark hover:border-pitch-black bg-pure-white text-pitch-black text-[9px] font-mono font-bold uppercase px-2 py-0.5 transition-colors shadow-2xs">Ver Oferta ↗</a>
              </div>
            </div>
          </div>
        `;
      });
    } else {
      expensiveListHtml = `<p class="font-mono text-xs text-muted-graphite py-4">No se encontraron ofertas para calcular precios.</p>`;
    }

    // Render Popularity html list
    let popularityListHtml = '';
    if (wantsWithStats.length > 0) {
      let mostWantedHtml = '';
      top5MostWanted.forEach((w, idx) => {
        mostWantedHtml += `
          <div class="flex items-center justify-between text-xs p-2.5 bg-ivory-warm border border-hairline-light mb-1.5 font-mono">
            <div class="min-w-0 flex-1 mr-2">
              <a href="https://www.discogs.com/release/${w.id}" target="_blank" class="font-sans font-bold text-xs uppercase tracking-tight text-pitch-black block truncate hover:text-prada-red transition-colors" title="Abrir edición en Discogs (ID: ${w.id})">
                ${idx + 1}. ${escapeHTML(w.title)}
              </a>
              <span class="text-[10px] text-muted-graphite uppercase tracking-wider block truncate mt-0.5" title="${escapeHTML(w.artist)}">${escapeHTML(w.artist)}</span>
            </div>
            <a href="https://www.discogs.com/release/${w.id}" target="_blank" class="shrink-0" title="Ver en Discogs">
              <strong class="text-prada-red text-xs font-mono font-bold">${getWantCount(w).toLocaleString()} wants ↗</strong>
            </a>
          </div>
        `;
      });

      let leastWantedHtml = '';
      top5LeastWanted.forEach((w, idx) => {
        leastWantedHtml += `
          <div class="flex items-center justify-between text-xs p-2.5 bg-ivory-warm border border-hairline-light mb-1.5 font-mono">
            <div class="min-w-0 flex-1 mr-2">
              <a href="https://www.discogs.com/release/${w.id}" target="_blank" class="font-sans font-bold text-xs uppercase tracking-tight text-pitch-black block truncate hover:text-prada-blue transition-colors" title="Abrir edición en Discogs (ID: ${w.id})">
                ${idx + 1}. ${escapeHTML(w.title)}
              </a>
              <span class="text-[10px] text-muted-graphite uppercase tracking-wider block truncate mt-0.5" title="${escapeHTML(w.artist)}">${escapeHTML(w.artist)}</span>
            </div>
            <a href="https://www.discogs.com/release/${w.id}" target="_blank" class="shrink-0" title="Ver en Discogs">
              <strong class="text-prada-blue text-xs font-mono font-bold">${getWantCount(w).toLocaleString()} wants ↗</strong>
            </a>
          </div>
        `;
      });

      popularityListHtml = `
        <div class="flex flex-col gap-4 font-mono">
          <div>
            <span class="text-[10px] text-prada-red font-bold uppercase tracking-wider block mb-2">[ TOP 5 MÁS DESEADO DE TU LISTA ]</span>
            ${mostWantedHtml}
          </div>
          
          <div>
            <span class="text-[10px] text-prada-blue font-bold uppercase tracking-wider block mb-2">[ TOP 5 RAREZA / MENOS QUERIDO ]</span>
            ${leastWantedHtml}
          </div>
        </div>
      `;
    } else {
      popularityListHtml = `
        <p class="font-mono text-xs text-muted-graphite py-2 leading-relaxed">
          Los contadores de <em>wants/haves</em> se completan automáticamente al analizar los discos o con sesión iniciada en Discogs.
        </p>
      `;
    }
    
    // Render layout
    let html = `
      <!-- Top Sub-View Header & Navigation Bar -->
      <div class="flex items-center justify-between mb-6 pb-3 border-b border-hairline-light flex-wrap gap-3 font-mono">
        <button type="button" class="btn-back-to-sellers border border-hairline-dark bg-pure-white hover:bg-pitch-black hover:text-pure-white text-pitch-black font-mono text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs">
          <span class="material-symbols-outlined text-[15px]">arrow_back</span>
          <span>VOLVER A VENDEDORES MARKETPLACE</span>
        </button>
        <span class="text-[10px] text-muted-graphite uppercase tracking-widest">[ ANÁLISIS DE CATÁLOGO / MÉTRICAS ]</span>
      </div>

      <!-- Top metrics bar -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 font-mono">
        <div class="stats-card-rich p-4 relative shadow-[4px_4px_0px_rgba(0,0,0,0.04)]">
          <div class="absolute top-0 left-0 right-0 h-1 bg-prada-emerald"></div>
          <span class="text-[10px] text-muted-graphite uppercase tracking-widest font-bold block mb-1">DISPONIBLES PARA TI</span>
          <span class="font-sans font-black text-2xl text-prada-emerald block">${wantsForSale.length} / ${totalWantsCount}</span>
          <span class="text-[10px] text-muted-graphite block mt-1 uppercase font-semibold">ENVÍAN A ${escapeHTML(buyerCountryVal)}</span>
        </div>
        
        <div class="stats-card-rich p-4 relative shadow-[4px_4px_0px_rgba(0,0,0,0.04)]">
          <div class="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
          <span class="text-[10px] text-amber-700 uppercase tracking-widest font-bold block mb-1">🌍 EN VENTA (SIN ENVÍO A TI)</span>
          <span class="font-sans font-black text-2xl text-amber-600 block">${wantsBlockedByShipping.length}</span>
          <span class="text-[10px] text-muted-graphite block mt-1 uppercase font-semibold">HAY COPIAS EN OTROS PAÍSES</span>
        </div>

        <div class="stats-card-rich p-4 relative shadow-[4px_4px_0px_rgba(0,0,0,0.04)]">
          <div class="absolute top-0 left-0 right-0 h-1 bg-prada-red"></div>
          <span class="text-[10px] text-prada-red uppercase tracking-widest font-bold block mb-1">🚫 TOTALMENTE AGOTADOS</span>
          <span class="font-sans font-black text-2xl text-prada-red block">${wantsTrulyUnavailable.length}</span>
          <span class="text-[10px] text-muted-graphite block mt-1 uppercase font-semibold">0 COPIAS EN TODO DISCOGS</span>
        </div>
        
        <div class="stats-card-rich p-4 relative shadow-[4px_4px_0px_rgba(0,0,0,0.04)]">
          <div class="absolute top-0 left-0 right-0 h-1 bg-prada-blue"></div>
          <span class="text-[10px] text-prada-blue uppercase tracking-widest font-bold block mb-1">TOTAL DE OFERTAS</span>
          <span class="font-sans font-black text-2xl text-prada-blue block">${allListings.length}</span>
          <span class="text-[10px] text-muted-graphite block mt-1 uppercase font-semibold">COPIAS APTAS PARA COMPRA</span>
        </div>
      </div>
      
      <div class="stats-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- COLUMN 1: PRICE EXTREMES & POPULARITY -->
        <div class="flex flex-col gap-6">
          
          <!-- CHEAPEST VINYL -->
          <div class="stats-card-rich relative shadow-[4px_4px_0px_rgba(0,0,0,0.04)]">
            <div class="absolute top-0 left-0 right-0 h-1 bg-prada-emerald"></div>
            <div class="stats-card-badge text-prada-emerald bg-emerald-50 border-prada-emerald/30">[ MÁS ECONÓMICO ]</div>
            <h3 class="font-sans font-extrabold text-base uppercase tracking-tight text-pitch-black mb-4">💰 TOP 5 MÁS ACCESIBLES</h3>
            ${cheapestListHtml}
          </div>
          
          <!-- MOST EXPENSIVE VINYL -->
          <div class="stats-card-rich relative shadow-[4px_4px_0px_rgba(0,0,0,0.04)]">
            <div class="absolute top-0 left-0 right-0 h-1 bg-prada-blue"></div>
            <div class="stats-card-badge text-prada-blue bg-blue-50 border-prada-blue/30">[ OBJETO DE COLECCIÓN ]</div>
            <h3 class="font-sans font-extrabold text-base uppercase tracking-tight text-pitch-black mb-4">💎 TOP 5 OBJETOS DE LUJO</h3>
            ${expensiveListHtml}
          </div>
          
          <!-- COMMUNITY POPULARITY -->
          <div class="stats-card-rich relative shadow-[4px_4px_0px_rgba(0,0,0,0.04)]">
            <div class="absolute top-0 left-0 right-0 h-1 bg-prada-red"></div>
            <h3 class="font-sans font-extrabold text-base uppercase tracking-tight text-pitch-black mb-4">📈 PREFERENCIAS DE DIGGERS (COMUNIDAD)</h3>
            ${popularityListHtml}
          </div>
        </div>
        
        <!-- COLUMN 2: NOT FOR SALE / RESTRICTED SHIPPING -->
        <div class="flex flex-col gap-6">
          <div class="stats-card-rich flex-grow relative shadow-[4px_4px_0px_rgba(0,0,0,0.04)]">
            <div class="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
            <div class="mb-4">
              <h3 class="font-sans font-extrabold text-base uppercase tracking-tight text-pitch-black">⚠️ DISCOS SIN STOCK DIRECTO (${wantsNotForSale.length})</h3>
              <p class="font-mono text-xs text-muted-graphite mt-1 leading-relaxed">
                Filtra entre vinilos con <strong>stock existente sin envío</strong> a ${escapeHTML(buyerCountryVal)} y vinilos <strong>agotados a nivel mundial</strong>.
              </p>
            </div>

            <!-- Filter tabs -->
            <div class="not-for-sale-tabs flex gap-2 mb-3 flex-wrap font-mono">
              <button type="button" class="not-for-sale-tab-btn active" data-filter="all">
                TODOS (${wantsNotForSale.length})
              </button>
              <button type="button" class="not-for-sale-tab-btn" data-filter="blocked">
                🌍 NO ENVÍAN A ${escapeHTML(buyerCountryVal)} (${wantsBlockedByShipping.length})
              </button>
              <button type="button" class="not-for-sale-tab-btn" data-filter="zero">
                🚫 AGOTADOS MUNDIALMENTE (${wantsTrulyUnavailable.length})
              </button>
            </div>
            
            <div class="not-for-sale-list max-h-[560px] overflow-y-auto flex flex-col gap-2">
              ${wantsNotForSale.length > 0 ? (
                [...wantsBlockedByShipping.map(w => renderNotForSaleItem(w, true)),
                 ...wantsTrulyUnavailable.map(w => renderNotForSaleItem(w, false))].join('')
              ) : `
                <p class="font-mono text-xs text-muted-graphite p-8 text-center bg-ivory-warm border border-hairline-dark">
                  ✓ ¡Excelente! Todos los discos de tu lista tienen al menos una copia disponible para comprar hoy.
                </p>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
    
    statsView.innerHTML = html;

    // Attach navigation & filter listeners
    statsView.querySelectorAll('.btn-back-to-sellers').forEach(btn => {
      btn.addEventListener('click', () => switchTab('sellers'));
    });

    statsView.querySelectorAll('.not-for-sale-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        statsView.querySelectorAll('.not-for-sale-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        statsView.querySelectorAll('.not-for-sale-row').forEach(row => {
          if (filter === 'all' || row.dataset.category === filter) {
            row.style.display = 'flex';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });
  } catch (err) {
    console.error('[calculateAndRenderStats Error]', err);
    statsView.innerHTML = `
      <div class="stats-card-rich" style="text-align: center; padding: 40px;">
        <span class="material-symbols-outlined text-4xl text-amber-500 mb-2">bar_chart</span>
        <h3 style="font-size: 16px; font-weight: 700; color: var(--on-surface);">No se pudieron calcular las estadísticas</h3>
        <p style="font-size: 12px; color: var(--tertiary); margin: 8px 0 16px;">Ocurrió un detalle al procesar los datos de tu lista: ${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

// ==========================================
// EXPORT FOR GOOGLE SHEETS / EXCEL FUNCTIONS
// ==========================================

function openExportSheetsModal() {
  const exportSheetsModal = document.getElementById('export-sheets-modal');
  if (!exportSheetsModal) return;
  
  const exportCountAll = document.getElementById('export-count-all');
  const exportCountPriority = document.getElementById('export-count-priority');
  const exportCountOffers = document.getElementById('export-count-offers');
  const radioExportOffers = document.getElementById('radio-export-offers');
  const exportScopeOffersLabel = document.getElementById('export-scope-offers-label');
  
  const allWantsCount = state.wants ? state.wants.length : 0;
  const priorityCount = state.wants ? state.wants.filter(w => w.isPriority).length : 0;
  const offersCount = state.allListings ? state.allListings.length : 0;
  
  if (exportCountAll) exportCountAll.textContent = allWantsCount;
  if (exportCountPriority) exportCountPriority.textContent = priorityCount;
  if (exportCountOffers) exportCountOffers.textContent = offersCount;
  
  if (radioExportOffers && exportScopeOffersLabel) {
    if (offersCount > 0) {
      radioExportOffers.disabled = false;
      exportScopeOffersLabel.style.opacity = '1';
    } else {
      radioExportOffers.disabled = true;
      exportScopeOffersLabel.style.opacity = '0.5';
    }
  }
  
  const toastMsg = document.getElementById('export-toast-msg');
  if (toastMsg) toastMsg.style.display = 'none';
  
  exportSheetsModal.style.display = 'flex';
  exportSheetsModal.classList.add('open');
}

function closeExportSheetsModal() {
  const exportSheetsModal = document.getElementById('export-sheets-modal');
  if (exportSheetsModal) {
    exportSheetsModal.classList.remove('open');
    exportSheetsModal.style.display = 'none';
  }
}

// ==========================================
// PERSONALIZATION & SETTINGS MODAL FUNCTIONS
// ==========================================

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  // Populate fields from current state or localStorage
  const useCacheSaved = localStorage.getItem('use_scan_cache') !== 'false';
  const turboRadio = document.getElementById('settings-cache-turbo');
  const liveRadio = document.getElementById('settings-cache-live');
  if (turboRadio && liveRadio) {
    turboRadio.checked = useCacheSaved;
    liveRadio.checked = !useCacheSaved;
  }

  const rememberSaved = localStorage.getItem('remember_scan_cache_choice') === 'true';
  const rememberCheckbox = document.getElementById('settings-remember-cache');
  if (rememberCheckbox) rememberCheckbox.checked = rememberSaved;

  const minMatchesSelect = document.getElementById('settings-min-matches');
  const filterMinMatchesEl = document.getElementById('filter-min-matches');
  if (minMatchesSelect) {
    minMatchesSelect.value = localStorage.getItem('filter_min_matches') || (filterMinMatchesEl ? filterMinMatchesEl.value : '2');
  }

  const minCondSelect = document.getElementById('settings-min-condition');
  const filterMinCondEl = document.getElementById('filter-min-condition');
  if (minCondSelect) {
    minCondSelect.value = localStorage.getItem('filter_min_condition') || (filterMinCondEl ? filterMinCondEl.value : 'VG+');
  }

  const minRatingSelect = document.getElementById('settings-min-rating');
  const filterRatingEl = document.getElementById('filter-rating');
  if (minRatingSelect) {
    minRatingSelect.value = localStorage.getItem('filter_min_rating') || (filterRatingEl ? filterRatingEl.value : '99');
  }

  const currSelect = document.getElementById('settings-currency');
  const displayCurrEl = document.getElementById('display-currency');
  if (currSelect) {
    currSelect.value = localStorage.getItem('display_currency') || (displayCurrEl ? displayCurrEl.value : 'USD');
  }

  const countrySelect = document.getElementById('settings-country');
  const buyerCountryEl = document.getElementById('buyer-country');
  if (countrySelect) {
    countrySelect.value = localStorage.getItem('buyer_country') || (buyerCountryEl ? buyerCountryEl.value : 'Uruguay');
  }

  const rateInput = document.getElementById('settings-rate-uyu');
  if (rateInput) {
    rateInput.value = localStorage.getItem('custom_uyu_rate') || '40';
  }

  const currentDensity = localStorage.getItem('wants_grid_density') || 'standard';
  updateSettingsDensityUI(currentDensity);

  modal.style.display = 'flex';
  modal.classList.add('open');

  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('SETTINGS_MODAL_OPEN', 'Usuario abrió el panel de personalización');
    }
  } catch (e) {}
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
}

function updateSettingsDensityUI(density) {
  const stdBtn = document.getElementById('settings-density-standard');
  const compBtn = document.getElementById('settings-density-compact');
  if (!stdBtn || !compBtn) return;

  if (density === 'compact') {
    stdBtn.className = 'px-3 py-1 font-bold text-[10px] uppercase cursor-pointer bg-pure-white text-muted-graphite hover:text-pitch-black';
    compBtn.className = 'px-3 py-1 font-bold text-[10px] uppercase cursor-pointer bg-pitch-black text-pure-white';
  } else {
    stdBtn.className = 'px-3 py-1 font-bold text-[10px] uppercase cursor-pointer bg-pitch-black text-pure-white';
    compBtn.className = 'px-3 py-1 font-bold text-[10px] uppercase cursor-pointer bg-pure-white text-muted-graphite hover:text-pitch-black';
  }
}

function applySettingsFromModal() {
  // Cache mode
  const turboRadio = document.getElementById('settings-cache-turbo');
  const isTurbo = turboRadio ? turboRadio.checked : true;
  localStorage.setItem('use_scan_cache', isTurbo ? 'true' : 'false');
  syncCacheState(isTurbo);

  const rememberCheckbox = document.getElementById('settings-remember-cache');
  if (rememberCheckbox) {
    localStorage.setItem('remember_scan_cache_choice', rememberCheckbox.checked ? 'true' : 'false');
  }

  // Min matches
  const minMatchesSelect = document.getElementById('settings-min-matches');
  const filterMinMatchesEl = document.getElementById('filter-min-matches');
  if (minMatchesSelect) {
    localStorage.setItem('filter_min_matches', minMatchesSelect.value);
    if (filterMinMatchesEl) filterMinMatchesEl.value = minMatchesSelect.value;
  }

  // Min condition
  const minCondSelect = document.getElementById('settings-min-condition');
  const filterMinCondEl = document.getElementById('filter-min-condition');
  if (minCondSelect) {
    localStorage.setItem('filter_min_condition', minCondSelect.value);
    if (filterMinCondEl) filterMinCondEl.value = minCondSelect.value;
  }

  // Min rating
  const minRatingSelect = document.getElementById('settings-min-rating');
  const filterRatingEl = document.getElementById('filter-rating');
  if (minRatingSelect) {
    localStorage.setItem('filter_min_rating', minRatingSelect.value);
    if (filterRatingEl) filterRatingEl.value = minRatingSelect.value;
  }

  // Currency
  const currSelect = document.getElementById('settings-currency');
  const displayCurrEl = document.getElementById('display-currency');
  if (currSelect) {
    localStorage.setItem('display_currency', currSelect.value);
    if (displayCurrEl) displayCurrEl.value = currSelect.value;
  }

  // Country
  const countrySelect = document.getElementById('settings-country');
  const buyerCountryEl = document.getElementById('buyer-country');
  if (countrySelect) {
    localStorage.setItem('buyer_country', countrySelect.value);
    if (buyerCountryEl) buyerCountryEl.value = countrySelect.value;
  }

  // Custom UYU Rate
  const rateInput = document.getElementById('settings-rate-uyu');
  if (rateInput) {
    const val = parseFloat(rateInput.value) || 40;
    localStorage.setItem('custom_uyu_rate', String(val));
    if (CURRENCY_MAP.UYU) {
      CURRENCY_MAP.UYU.rate = 1 / val;
    }
  }

  // Density
  const compBtn = document.getElementById('settings-density-compact');
  const isCompact = compBtn && compBtn.classList.contains('bg-pitch-black');
  setGridDensity(isCompact ? 'compact' : 'standard');

  // Re-render results if any
  if (state.groupedSellers && state.groupedSellers.length > 0) {
    renderResults();
    if (typeof calculateAndRenderStats === 'function') calculateAndRenderStats();
  }

  showToast('Ajustes y preferencias guardados con éxito', 'success');

  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('SETTINGS_SAVED', 'Ajustes de personalización actualizados', {
        cacheMode: isTurbo ? 'turbo' : 'live',
        currency: currSelect?.value,
        country: countrySelect?.value,
        minCondition: minCondSelect?.value,
        uyuRate: rateInput?.value
      });
    }
  } catch (e) {}

  closeSettingsModal();
}

function clearScanCacheAction() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('marketplace_cache_') || key.startsWith('discogs_cache_') || key.startsWith('scan_session_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('remember_scan_cache_choice');

  showToast(`Caché liberado: ${keysToRemove.length} elementos eliminados`, 'info');

  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('CACHE_PURGED', `Caché de escaneo purgado (${keysToRemove.length} entradas)`, { itemsRemoved: keysToRemove.length });
    }
  } catch (e) {}
}

function resetDefaultSettingsAction() {
  localStorage.removeItem('use_scan_cache');
  localStorage.removeItem('remember_scan_cache_choice');
  localStorage.removeItem('filter_min_matches');
  localStorage.removeItem('filter_min_condition');
  localStorage.removeItem('filter_min_rating');
  localStorage.removeItem('custom_uyu_rate');
  localStorage.removeItem('wants_grid_density');

  if (CURRENCY_MAP.UYU) CURRENCY_MAP.UYU.rate = 0.025;

  const turboRadio = document.getElementById('settings-cache-turbo');
  if (turboRadio) turboRadio.checked = true;
  const rememberCheckbox = document.getElementById('settings-remember-cache');
  if (rememberCheckbox) rememberCheckbox.checked = false;
  const minMatches = document.getElementById('settings-min-matches');
  if (minMatches) minMatches.value = '2';
  const minCond = document.getElementById('settings-min-condition');
  if (minCond) minCond.value = 'VG+';
  const minRating = document.getElementById('settings-min-rating');
  if (minRating) minRating.value = '99';
  const rateInput = document.getElementById('settings-rate-uyu');
  if (rateInput) rateInput.value = '40';

  updateSettingsDensityUI('standard');
  setGridDensity('standard');

  showToast('Ajustes restablecidos a sus valores predeterminados', 'info');
}

function escapeCSVCell(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/"/g, '""');
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes(';')) {
    str = `"${str}"`;
  }
  return str;
}

function generateWantsTSV(items) {
  const headers = ['Artista', 'Título', 'Año', 'Prioritario (★)', 'Discogs ID', 'Imagen Cover', 'URL Discogs'];
  const rows = items.map(item => [
    item.artist || '',
    item.title || '',
    item.year || '',
    item.isPriority ? '★ SÍ' : 'NO',
    item.id || '',
    item.image || '',
    `https://www.discogs.com/release/${item.id}`
  ]);
  
  return [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
}

function generateWantsCSV(items) {
  const headers = ['Artista', 'Título', 'Año', 'Prioritario (★)', 'Discogs ID', 'URL Discogs'];
  const rows = items.map(item => [
    escapeCSVCell(item.artist || ''),
    escapeCSVCell(item.title || ''),
    escapeCSVCell(item.year || ''),
    escapeCSVCell(item.isPriority ? 'SÍ' : 'NO'),
    escapeCSVCell(item.id || ''),
    escapeCSVCell(`https://www.discogs.com/release/${item.id}`)
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return '\uFEFF' + csvContent;
}

function generateOffersCSV(listings) {
  const headers = ['Vendedor', 'País Vendedor', 'Reputación Vendedor', 'Artista', 'Título', 'Estado Vinilo', 'Estado Tapa', 'Precio', 'Moneda', 'Envío Estimado USD', 'Total Estimado USD', 'Link Oferta'];
  const rows = listings.map(l => [
    escapeCSVCell(l.sellerName || ''),
    escapeCSVCell(l.sellerCountry || ''),
    escapeCSVCell(l.sellerRating ? `${l.sellerRating}%` : ''),
    escapeCSVCell(l.artist || ''),
    escapeCSVCell(l.releaseTitle || ''),
    escapeCSVCell(l.condition || ''),
    escapeCSVCell(l.sleeveCondition || ''),
    escapeCSVCell(l.price || 0),
    escapeCSVCell(l.currency || 'USD'),
    escapeCSVCell((l.shippingVal || 0).toFixed(2)),
    escapeCSVCell((l.totalPrice || l.price || 0).toFixed(2)),
    escapeCSVCell(l.listingUrl || `https://www.discogs.com/release/${l.releaseId}`)
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return '\uFEFF' + csvContent;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('Clipboard API failed, trying fallback:', e);
    }
  }
  
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (e) {
    if (textarea.parentNode) document.body.removeChild(textarea);
    return false;
  }
}

function downloadFile(content, fileName, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

async function handleCopySheetsAction() {
  const scopeRadio = document.querySelector('input[name="export-scope"]:checked');
  const scope = scopeRadio ? scopeRadio.value : 'all';
  
  let textToCopy = '';
  if (scope === 'offers' && state.allListings && state.allListings.length > 0) {
    const headers = ['Vendedor', 'País', 'Reputación', 'Artista', 'Título', 'Estado Vinilo', 'Precio', 'Envío USD', 'Total USD', 'Link Oferta'];
    const rows = state.allListings.map(l => [
      l.sellerName || '', l.sellerCountry || '', l.sellerRating ? `${l.sellerRating}%` : '',
      l.artist || '', l.releaseTitle || '', l.condition || '', l.price || 0,
      (l.shippingVal || 0).toFixed(2), (l.totalPrice || l.price || 0).toFixed(2),
      l.listingUrl || ''
    ]);
    textToCopy = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
  } else {
    let targetWants = state.wants || [];
    if (scope === 'priority') {
      targetWants = targetWants.filter(w => w.isPriority);
    }
    if (targetWants.length === 0) {
      alert('No hay discos en esta selección para exportar.');
      return;
    }
    textToCopy = generateWantsTSV(targetWants);
  }
  
  const success = await copyTextToClipboard(textToCopy);
  if (success) {
    const toastMsg = document.getElementById('export-toast-msg');
    if (toastMsg) {
      toastMsg.style.display = 'block';
      setTimeout(() => { toastMsg.style.display = 'none'; }, 5000);
    }
  } else {
    alert('No se pudo copiar automáticamente. Podés usar la opción de Descargar CSV.');
  }
}

function handleDownloadCsvAction() {
  const scopeRadio = document.querySelector('input[name="export-scope"]:checked');
  const scope = scopeRadio ? scopeRadio.value : 'all';
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('EXPORT_CSV', `Usuario exportó datos a CSV: tipo '${scope}'`, {
        scope,
        username: state.username
      });
    }
  } catch (e) {}
  
  const usernameStr = state.username ? state.username : 'discogs';
  const dateStr = new Date().toISOString().slice(0, 10);
  
  if (scope === 'offers' && state.allListings && state.allListings.length > 0) {
    const csvData = generateOffersCSV(state.allListings);
    downloadFile(csvData, `Discogs_Marketplace_Ofertas_${usernameStr}_${dateStr}.csv`);
  } else {
    let targetWants = state.wants || [];
    if (scope === 'priority') {
      targetWants = targetWants.filter(w => w.isPriority);
    }
    if (targetWants.length === 0) {
      alert('No hay discos en esta selección para exportar.');
      return;
    }
    const csvData = generateWantsCSV(targetWants);
    const scopeName = scope === 'priority' ? 'Prioritarios' : 'Wantlist';
    downloadFile(csvData, `Discogs_${scopeName}_${usernameStr}_${dateStr}.csv`);
  }
}

// ===============================================
// TAB SWITCHING FUNCTION
// ===============================================

function switchTab(tabName, pushHistory = false) {
  state.currentTab = tabName;
  currentAppView = `results-${tabName}`;
  updateForwardAndBackButtons();
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('TAB_SWITCH', `Pestaña cambiada a: ${tabName}`, { tab: tabName, username: state.username });
    }
  } catch (e) {}
  const tabBtnSellers = document.getElementById('tab-btn-sellers');
  const tabBtnLocal = document.getElementById('tab-btn-local');
  const tabBtnStats = document.getElementById('tab-btn-stats');
  const btnBackToWants = document.getElementById('btn-back-to-wants');
  const resultsGrid = document.getElementById('results-grid');
  const statsView = document.getElementById('stats-view');
  const localView = document.getElementById('local-view');
  const smartPurchaseCard = document.getElementById('smart-purchase-card');

  // Update button active styling
  const buttons = [
    { name: 'sellers', el: tabBtnSellers },
    { name: 'local', el: tabBtnLocal },
    { name: 'stats', el: tabBtnStats }
  ];

  let activeBtnEl = null;

  buttons.forEach(({ name, el }) => {
    if (!el) return;
    const isActive = tabName === name;
    el.classList.toggle('active', isActive);
    if (isActive) {
      activeBtnEl = el;
      el.className = 'bg-prada-blue-night text-pure-white px-4 py-1.5 font-semibold border-b-2 border-prada-red tracking-wider cursor-pointer';
    } else {
      el.className = 'px-4 py-1.5 text-muted-graphite hover:text-pitch-black hover:border-hairline-dark border border-transparent transition-all font-medium cursor-pointer';
    }
  });

  if (btnBackToWants) {
    btnBackToWants.className = 'px-4 py-2 text-muted-graphite hover:text-pitch-black hover:border-hairline-dark border border-transparent transition-all font-semibold cursor-pointer';
    btnBackToWants.classList.remove('active');
  }

  // Update animated motion indicator position immediately
  if (activeBtnEl) {
    requestAnimationFrame(() => {
      if (typeof motionMoveTabIndicator === 'function') {
        motionMoveTabIndicator(activeBtnEl);
      } else if (window.Motion && typeof window.Motion.moveTabIndicator === 'function') {
        window.Motion.moveTabIndicator(activeBtnEl);
      }
    });
  }

  if (resultsGrid) {
    resultsGrid.style.display = tabName === 'sellers' ? 'grid' : 'none';
    if (tabName === 'sellers') {
      resultsGrid.classList.remove('scroll-reveal');
      resultsGrid.classList.add('visible');
      resultsGrid.style.opacity = '1';
    }
  }
  const resultsViewWrapper = document.getElementById('results-view-wrapper');
  if (resultsViewWrapper) {
    resultsViewWrapper.style.display = tabName === 'sellers' ? 'flex' : 'none';
  }
  if (smartPurchaseCard) smartPurchaseCard.style.display = tabName === 'sellers' ? 'block' : 'none';
  if (statsView) {
    statsView.style.display = tabName === 'stats' ? 'flex' : 'none';
    if (tabName === 'stats') {
      statsView.classList.remove('scroll-reveal');
      statsView.classList.add('visible');
      statsView.style.opacity = '1';
    }
  }
  if (localView) {
    localView.style.display = tabName === 'local' ? 'block' : 'none';
    if (tabName === 'local') {
      localView.classList.remove('scroll-reveal');
      localView.classList.add('visible');
      localView.style.opacity = '1';
    }
  }

  if (tabName === 'stats' && typeof calculateAndRenderStats === 'function') {
    calculateAndRenderStats();
  }
  if (tabName === 'local' && typeof renderLocalMatches === 'function') {
    renderLocalMatches();
  }

  if (pushHistory) {
    try {
      window.history.pushState({ view: `results-${tabName}` }, '', '');
    } catch (e) {}
  }
}

// ===============================================
// LOCAL SELLER SHEET IMPORT & MATCHING FUNCTIONS
// ===============================================

function openWishlistSheetModal(matrix = null) {
  currentSheetTarget = 'wishlist';
  const localSheetModal = document.getElementById('local-sheet-modal');
  if (!localSheetModal) return;

  const badge = document.getElementById('local-modal-badge');
  const title = document.getElementById('local-modal-title');
  const desc = document.getElementById('local-modal-desc');
  const runBtn = document.getElementById('btn-run-local-match');

  if (badge) badge.textContent = '[ IMPORTACIÓN DE WISHLIST / PLANILLA ]';
  if (title) title.textContent = 'Mapear Columnas de tu Lista de Deseos';
  if (desc) desc.textContent = 'Asigna las columnas de Artista y Título para importar tus discos y chequear vendedores al instante.';
  if (runBtn) runBtn.innerHTML = '🚀 IMPORTAR DISCOS Y CHEQUEAR VENDEDORES';

  localSheetModal.style.display = 'flex';
  localSheetModal.classList.add('open');

  if (matrix && matrix.length > 0) {
    processParsedLocalMatrix(matrix);
  } else {
    const step1 = document.getElementById('local-step-1');
    const step2 = document.getElementById('local-step-2');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
  }
}

function handleAnalyzeOnboardSheet() {
  const pasteArea = document.getElementById('onboard-sheet-paste-area');
  const fileInput = document.getElementById('onboard-sheet-file-input');
  
  let rawText = pasteArea ? pasteArea.value : '';
  
  if (!rawText.trim() && fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const filename = file.name.toLowerCase();
    const isExcelBinary = filename.endsWith('.xlsx') || filename.endsWith('.xls');
    
    const reader = new FileReader();
    
    if (isExcelBinary && typeof XLSX !== 'undefined') {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          openWishlistSheetModal(matrix);
        } catch (err) {
          console.error('Error al parsear Excel XLSX:', err);
          alert('No se pudo leer el archivo Excel (.xlsx).');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        openWishlistSheetModal(parseSheetText(e.target.result));
      };
      reader.readAsText(file);
    }
    return;
  }
  
  if (rawText.trim()) {
    openWishlistSheetModal(parseSheetText(rawText));
    return;
  }
  
  // If nothing pasted, open step 1 for user to paste or select file
  openWishlistSheetModal();
}

function openLocalSheetModal() {
  currentSheetTarget = 'local_catalog';
  const localSheetModal = document.getElementById('local-sheet-modal');
  if (!localSheetModal) return;

  const badge = document.getElementById('local-modal-badge');
  const title = document.getElementById('local-modal-title');
  const desc = document.getElementById('local-modal-desc');
  const runBtn = document.getElementById('btn-run-local-match');

  if (badge) badge.textContent = '[ CATÁLOGO LOCAL / SHEETS ]';
  if (title) title.textContent = 'Cruzar Planilla Local (Drive / Excel)';
  if (desc) desc.textContent = 'Copia el stock de disquerías locales uruguayas para encontrar coincidencias inmediatas con tu Wantlist.';
  if (runBtn) runBtn.innerHTML = '🔍 Cruzar con mi Wantlist';

  localSheetModal.style.display = 'flex';
  localSheetModal.classList.add('open');
  const step1 = document.getElementById('local-step-1');
  const step2 = document.getElementById('local-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
}

function closeLocalSheetModal() {
  const localSheetModal = document.getElementById('local-sheet-modal');
  if (localSheetModal) {
    localSheetModal.classList.remove('open');
    localSheetModal.style.display = 'none';
  }
}

function parseSheetText(text) {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  
  const sample = lines[0];
  let delimiter = '\t';
  if (sample.includes('\t')) {
    delimiter = '\t';
  } else if (sample.includes(';')) {
    delimiter = ';';
  } else if (sample.includes(',')) {
    delimiter = ',';
  }

  return lines.map(line => {
    return line.split(delimiter).map(cell => cell.trim().replace(/^"(.*)"$/, '$1'));
  });
}

function handleAnalyzeLocalSheet() {
  const pasteArea = document.getElementById('local-sheet-paste-area');
  const fileInput = document.getElementById('local-sheet-file-input');
  
  let rawText = pasteArea ? pasteArea.value : '';
  
  if (!rawText.trim() && fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const filename = file.name.toLowerCase();
    const isExcelBinary = filename.endsWith('.xlsx') || filename.endsWith('.xls');
    
    const reader = new FileReader();
    
    if (isExcelBinary && typeof XLSX !== 'undefined') {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          processParsedLocalMatrix(matrix);
        } catch (err) {
          console.error('Error al parsear Excel XLSX:', err);
          alert('No se pudo leer el archivo Excel (.xlsx). Asegúrate de que no esté protegido con contraseña o corrupto.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        processParsedLocalMatrix(parseSheetText(e.target.result));
      };
      reader.readAsText(file);
    }
    return;
  }
  
  if (!rawText.trim()) {
    alert('Por favor pegá el contenido de las celdas de la planilla o seleccioná un archivo Excel (.xlsx) o CSV.');
    return;
  }
  
  processParsedLocalMatrix(parseSheetText(rawText));
}

// Filter out trailing completely empty columns produced by copying empty cells in Google Sheets/Excel
function trimEmptyColumns(matrix) {
  if (!matrix || matrix.length === 0) return matrix;
  let maxCol = -1;
  const sampleRows = matrix.slice(0, 100);
  for (const row of sampleRows) {
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
        if (c > maxCol) maxCol = c;
        break;
      }
    }
  }
  if (maxCol === -1) return matrix;
  return matrix.map(row => row.slice(0, maxCol + 1));
}

// Detect whether Row 0 or Row 1 is the actual table header
function detectHeaderRowOffset(matrix) {
  if (!matrix || matrix.length < 2) return 0;
  const headerKeywords = ['titulo', 'title', 'artist', 'artista', 'link', 'genero', 'genre', 'estado', 'condition', 'precio', 'price', 'año', 'year', 'detalles', 'url', 'discogs', 'formato', 'format', '$', 'u$d', 'usd'];
  
  const scoreRow = (row) => {
    if (!row || !row.length) return 0;
    let matches = 0;
    row.forEach(cell => {
      const lower = String(cell || '').toLowerCase().trim();
      if (headerKeywords.some(kw => lower === kw || (kw.length > 2 && lower.includes(kw)))) {
        matches++;
      }
    });
    return matches;
  };

  const score0 = scoreRow(matrix[0]);
  const score1 = scoreRow(matrix[1]);
  
  // If row 1 has 2+ keywords and clearly outscores row 0, row 1 is the real header
  if (score1 >= 2 && score1 > score0) {
    return 1;
  }
  return 0;
}

function processParsedLocalMatrix(rawMatrix) {
  if (!rawMatrix || rawMatrix.length === 0) {
    alert('No se pudieron detectar filas válidas en el texto proporcionado.');
    return;
  }
  
  // 1. Trim trailing phantom empty columns
  let matrix = trimEmptyColumns(rawMatrix);
  
  // 2. Detect if row 0 was junk/single-cell metadata and row 1 is the real header
  const headerOffset = detectHeaderRowOffset(matrix);
  if (headerOffset > 0) {
    matrix = matrix.slice(headerOffset);
  }
  
  state.localSheetRows = matrix;
  
  const step1 = document.getElementById('local-step-1');
  const step2 = document.getElementById('local-step-2');
  const detectedRowsCount = document.getElementById('local-detected-rows-count');
  
  if (detectedRowsCount) {
    const dataRowCount = Math.max(0, matrix.length - 1);
    detectedRowsCount.textContent = `${dataRowCount} vinilos / ${matrix[0].length} columnas detectadas`;
  }
  
  renderLocalMappingTable(matrix);
  
  if (step1) step1.style.display = 'none';
  if (step2) step2.style.display = 'block';
}

function renderLocalMappingTable(matrix) {
  const table = document.getElementById('local-mapping-table');
  if (!table || matrix.length === 0) return;
  
  const colCount = Math.max(...matrix.slice(0, 5).map(row => row.length));
  const firstRow = matrix[0];
  
  const candidateMappings = autoDetectColumnTypes(matrix);
  
  let html = '<thead><tr>';
  for (let c = 0; c < colCount; c++) {
    const headerName = firstRow[c] || `Columna ${c + 1}`;
    const selectedType = candidateMappings[c] || 'ignore';
    const isAssigned = selectedType !== 'ignore';
    
    html += `
      <th class="p-3 border-b-2 border-hairline-dark bg-surface-low text-left font-mono" style="min-width: 175px; width: 175px; max-width: 175px; vertical-align: top;">
        <div class="flex items-center justify-between gap-1 mb-1">
          <span class="text-[9px] font-bold uppercase tracking-wider text-muted-graphite">COLUMNA ${c + 1}</span>
          ${isAssigned ? '<span class="text-[8.5px] font-bold px-1 bg-prada-red text-pure-white shadow-xs">ACTIVA</span>' : ''}
        </div>
        <div class="font-sans font-bold text-xs uppercase text-pitch-black truncate mb-2" title="${escapeHTML(headerName)}">${escapeHTML(headerName)}</div>
        <select class="col-mapper-select w-full ${isAssigned ? 'border-2 border-prada-red bg-prada-red-bg text-prada-red font-extrabold' : 'border border-hairline-dark bg-pure-white text-pitch-black font-bold'} font-mono text-[10.5px] uppercase py-1.5 pl-2 pr-6 focus:outline-none cursor-pointer shadow-xs transition-colors" data-col="${c}" style="appearance: none; background-image: url('data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'%231a1a1a\\'%3E%3Cpath stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M19 9l-7 7-7-7\\'%3E%3C/path%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 6px center; background-size: 11px;">
          <option value="ignore" ${selectedType === 'ignore' ? 'selected' : ''}>-- Ignorar --</option>
          <option value="artist" ${selectedType === 'artist' ? 'selected' : ''}>🎤 Artista</option>
          <option value="title" ${selectedType === 'title' ? 'selected' : ''}>🎵 Título / Álbum</option>
          <option value="price" ${selectedType === 'price' ? 'selected' : ''}>💰 Precio</option>
          <option value="discogs_id" ${selectedType === 'discogs_id' ? 'selected' : ''}>🆔 ID / Link Discogs</option>
          <option value="condition" ${selectedType === 'condition' ? 'selected' : ''}>⭐ Estado / Grado</option>
          <option value="format" ${selectedType === 'format' ? 'selected' : ''}>💿 Formato</option>
        </select>
      </th>
    `;
  }
  html += '</tr></thead><tbody>';
  
  // Preview up to 6 rows of actual vinyl data (starting from row 1)
  const previewRows = matrix.slice(1, 7);
  previewRows.forEach((row, idx) => {
    html += `<tr class="border-b border-hairline-light ${idx % 2 === 0 ? 'bg-pure-white' : 'bg-ivory-warm/40'} hover:bg-surface-low transition-colors">`;
    for (let c = 0; c < colCount; c++) {
      const cellText = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';
      html += `
        <td class="p-2.5 font-mono text-[11px] text-pitch-black truncate border-r border-hairline-light/40" style="min-width: 175px; width: 175px; max-width: 175px;" title="${escapeHTML(cellText)}">
          ${cellText ? escapeHTML(cellText) : '<span class="text-muted-graphite/50">—</span>'}
        </td>
      `;
    }
    html += '</tr>';
  });
  
  html += '</tbody>';
  table.innerHTML = html;

  // Add reactive style updates when the user switches any dropdown
  table.querySelectorAll('.col-mapper-select').forEach(select => {
    select.addEventListener('change', () => {
      const isAct = select.value !== 'ignore';
      if (isAct) {
        select.className = 'col-mapper-select w-full border-2 border-prada-red bg-prada-red-bg text-prada-red font-extrabold font-mono text-[10.5px] uppercase py-1.5 pl-2 pr-6 focus:outline-none cursor-pointer shadow-xs transition-colors';
      } else {
        select.className = 'col-mapper-select w-full border border-hairline-dark bg-pure-white text-pitch-black font-bold font-mono text-[10.5px] uppercase py-1.5 pl-2 pr-6 focus:outline-none cursor-pointer shadow-xs transition-colors';
      }
    });
  });
}

function autoDetectColumnTypes(matrix) {
  if (!matrix || matrix.length === 0) return {};
  const header = matrix[0].map(h => String(h || '').toLowerCase().trim());
  const colCount = Math.max(...matrix.slice(0, 5).map(r => r.length));
  const mapping = {};
  
  const sampleData = matrix.slice(1, 6);
  
  for (let c = 0; c < colCount; c++) {
    const h = header[c] || '';
    const hasDiscogsLink = sampleData.some(r => String(r[c] || '').includes('discogs.com/release/'));
    const hasUrl = sampleData.some(r => String(r[c] || '').startsWith('http'));
    
    if (h.includes('artist') || h.includes('banda') || h.includes('autor') || h.includes('interprete')) {
      mapping[c] = 'artist';
    } else if (h.includes('title') || h.includes('titulo') || h.includes('album') || h.includes('disco')) {
      mapping[c] = 'title';
    } else if (h.includes('link') || h.includes('url') || hasDiscogsLink) {
      mapping[c] = 'discogs_id';
    } else if (h.includes('precio') || h.includes('price') || h.includes('costo') || h === '$' || h.includes('usd') || h.includes('u$d') || h.includes('uyu')) {
      if (!Object.values(mapping).includes('price')) {
        mapping[c] = 'price';
      }
    } else if (h.includes('format') || h.includes('formato') || h.includes('tipo')) {
      mapping[c] = 'format';
    } else if (h.includes('estado') || h.includes('condic') || h.includes('grade') || h.includes('media')) {
      mapping[c] = 'condition';
    } else if (h.includes('discogs') || h.includes('release') || h.includes('id')) {
      mapping[c] = 'discogs_id';
    }
  }
  
  if (!Object.values(mapping).includes('artist') && !Object.values(mapping).includes('title')) {
    if (colCount >= 1) mapping[0] = 'artist';
    if (colCount >= 2) mapping[1] = 'title';
  }
  
  return mapping;
}

function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function handleRunLocalMatch() {
  const selects = document.querySelectorAll('.col-mapper-select');
  const mapping = {};
  selects.forEach(select => {
    const colIdx = parseInt(select.getAttribute('data-col'), 10);
    mapping[colIdx] = select.value;
  });
  
  if (!Object.values(mapping).includes('artist') && !Object.values(mapping).includes('title') && !Object.values(mapping).includes('discogs_id')) {
    alert('Debes asignar al menos una columna de Artista, Título o Discogs ID.');
    return;
  }
  
  // IF USER IS IMPORTING THEIR WISHLIST FROM SPREADSHEET:
  if (currentSheetTarget === 'wishlist') {
    const rows = state.localSheetRows;
    const startIndex = rows.length > 1 ? 1 : 0;
    const importedWants = [];
    
    for (let r = startIndex; r < rows.length; r++) {
      const row = rows[r];
      let artist = '';
      let title = '';
      let price = '';
      let format = '';
      let condition = '';
      let discogsId = null;
      
      Object.keys(mapping).forEach(colIdx => {
        const idx = parseInt(colIdx, 10);
        const val = (row[idx] !== undefined && row[idx] !== null) ? String(row[idx]).trim() : '';
        const field = mapping[colIdx];
        if (field === 'artist') artist = val;
        else if (field === 'title') title = val;
        else if (field === 'price') price = val;
        else if (field === 'format') format = val;
        else if (field === 'condition') condition = val;
        else if (field === 'discogs_id') {
          const idMatch = val.match(/\d{4,9}/);
          if (idMatch) discogsId = parseInt(idMatch[0], 10);
        }
      });
      
      if (!artist && !title && !discogsId) continue;
      
      importedWants.push({
        id: discogsId || (Date.now() + r),
        artist: artist || 'Desconocido',
        title: title || (discogsId ? `Disco #${discogsId}` : `Vinilo #${r}`),
        year: '',
        format: format || 'Vinyl',
        condition: condition || '',
        priceLimit: price || '',
        notes: 'Importado de planilla',
        isPriority: false,
        thumb: '',
        forSaleCount: 0
      });
    }

    if (importedWants.length === 0) {
      alert('No se encontraron filas con datos de vinilos válidos.');
      return;
    }

    state.wants = importedWants;
    localStorage.setItem('discogs_wants', JSON.stringify(importedWants));
    if (metricWantsCount) metricWantsCount.textContent = state.wants.length;
    
    closeLocalSheetModal();
    if (typeof calculateAndRenderStats === 'function') calculateAndRenderStats();
    if (typeof enrichWantlistStats === 'function') enrichWantlistStats();
    showWantlistManager();
    
    showToast(`¡${importedWants.length} vinilos importados a tu lista de deseos!`, 'success');
    log(`Wishlist importada desde planilla: ${importedWants.length} vinilos cargados.`, 'success');

    // Automatically prompt to scan/check sellers without split screen
    setTimeout(() => {
      openScanCacheModal();
    }, 450);
    return;
  }

  if (!state.wants || state.wants.length === 0) {
    alert('Primero debes cargar tu Lista de Deseos (Wantlist) de Discogs.');
    return;
  }
  
  const matches = [];
  const wants = state.wants;
  const rows = state.localSheetRows;
  
  const startIndex = rows.length > 1 ? 1 : 0;
  
  for (let r = startIndex; r < rows.length; r++) {
    const row = rows[r];
    
    let sellerArtist = '';
    let sellerTitle = '';
    let sellerPrice = '';
    let sellerFormat = '';
    let sellerCondition = '';
    let sellerDiscogsId = null;
    
    Object.keys(mapping).forEach(colIdx => {
      const idx = parseInt(colIdx, 10);
      const val = row[idx] || '';
      const field = mapping[colIdx];
      
      if (field === 'artist') sellerArtist = val;
      else if (field === 'title') sellerTitle = val;
      else if (field === 'price') sellerPrice = val;
      else if (field === 'format') sellerFormat = val;
      else if (field === 'condition') sellerCondition = val;
      else if (field === 'discogs_id') {
        const idMatch = val.match(/\d{5,9}/);
        if (idMatch) sellerDiscogsId = parseInt(idMatch[0], 10);
      }
    });
    
    const normSellerArtist = normalizeText(sellerArtist);
    const normSellerTitle = normalizeText(sellerTitle);
    const normCombined = `${normSellerArtist} ${normSellerTitle}`;
    
    if (!normSellerArtist && !normSellerTitle && !sellerDiscogsId) continue;
    
    for (const want of wants) {
      let isMatch = false;
      let matchScore = 0;
      let matchReason = '';
      
      if (sellerDiscogsId && sellerDiscogsId === want.id) {
        isMatch = true;
        matchScore = 100;
        matchReason = '🆔 Coincidencia por Discogs ID';
      } else {
        const normWantArtist = normalizeText(want.artist);
        const normWantTitle = normalizeText(want.title);
        
        if (normSellerArtist && normSellerTitle && normWantArtist === normSellerArtist && normWantTitle === normSellerTitle) {
          isMatch = true;
          matchScore = 98;
          matchReason = '🎯 Coincidencia exacta de Artista y Título';
        } 
        else if (normSellerTitle && normWantArtist && normWantTitle && normSellerTitle.includes(normWantArtist) && normSellerTitle.includes(normWantTitle)) {
          isMatch = true;
          matchScore = 90;
          matchReason = '🔍 Coincidencia de Artista y Título en columna';
        }
        else if (normWantArtist && normWantTitle) {
          const normWantCombined = `${normWantArtist} ${normWantTitle}`;
          if (normCombined && (normCombined.includes(normWantCombined) || normWantCombined.includes(normCombined))) {
            isMatch = true;
            matchScore = 85;
            matchReason = '✨ Coincidencia difusa de nombre';
          } else {
            const wantWords = normWantCombined.split(' ').filter(w => w.length > 2);
            const sellerWords = normCombined.split(' ').filter(w => w.length > 2);
            if (wantWords.length > 0 && sellerWords.length > 0) {
              const shared = wantWords.filter(w => sellerWords.includes(w));
              const ratio = shared.length / wantWords.length;
              if (ratio >= 0.75 && shared.length >= 2) {
                isMatch = true;
                matchScore = Math.round(ratio * 90);
                matchReason = `💡 Coincidencia parcial (${Math.round(ratio * 100)}% palabras clave)`;
              }
            }
          }
        }
      }
      
      if (isMatch) {
        matches.push({
          wantItem: want,
          sellerArtist,
          sellerTitle,
          sellerPrice,
          sellerFormat,
          sellerCondition,
          matchScore,
          matchReason,
          rawRow: row
        });
        break;
      }
    }
  }
  
  state.localMatches = matches;
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('LOCAL_MATCHING_COMPLETED', `Cotejo local finalizado: ${matches.length} coincidencias encontradas`, {
        totalRows: rows.length,
        matchCount: matches.length,
        username: state.username
      });
    }
  } catch (e) {}
  closeLocalSheetModal();
  
  const tabBtnLocal = document.getElementById('tab-btn-local');
  const badgeLocalCount = document.getElementById('badge-local-count');
  
  if (tabBtnLocal) tabBtnLocal.style.display = 'inline-flex';
  if (badgeLocalCount) {
    badgeLocalCount.textContent = matches.length;
    badgeLocalCount.style.display = 'inline-block';
  }
  
  switchTab('local');
  log(`Cruce con planilla local completado. ¡Encontradas ${matches.length} coincidencias!`, 'success');
}

function renderLocalMatches() {
  const localView = document.getElementById('local-view');
  if (!localView) return;
  
  const matches = state.localMatches || [];
  
  if (matches.length === 0) {
    localView.innerHTML = `
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-hairline-light flex-wrap gap-2">
        <button type="button" class="btn-back-to-sellers border border-hairline-dark bg-pure-white hover:bg-pitch-black hover:text-pure-white text-pitch-black font-mono text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs">
          <span class="material-symbols-outlined text-[15px]">arrow_back</span>
          <span>VOLVER A VENDEDORES MARKETPLACE</span>
        </button>
        <span class="font-mono text-[10px] text-muted-graphite uppercase tracking-widest">COINCIDENCIAS CON CATÁLOGO LOCAL</span>
      </div>
      <div class="border-2 border-dashed border-hairline-dark bg-pure-white p-10 sm:p-14 text-center max-w-xl mx-auto my-8 shadow-xs">
        <div class="text-4xl mb-3">🇺🇾</div>
        <h3 class="font-sans font-extrabold text-lg uppercase tracking-tight text-pitch-black mb-2">SIN COINCIDENCIAS LOCALES CARGADAS</h3>
        <p class="font-mono text-xs text-muted-graphite max-w-md mx-auto mb-6 leading-relaxed">
          Pegá las celdas o subí el archivo del catálogo de cualquier disquería local (Google Sheets o Excel) para cruzarlo automáticamente con tu Wantlist.
        </p>
        <button id="btn-open-local-modal-empty" class="bg-pitch-black hover:bg-prada-red text-pure-white font-mono font-bold text-xs uppercase tracking-wider px-6 py-3 transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2">
          <span class="material-symbols-outlined text-[16px]">cloud_download</span>
          <span>CARGAR PLANILLA LOCAL</span>
        </button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-open-local-modal-empty');
    if (btnEmpty) btnEmpty.addEventListener('click', openLocalSheetModal);
    
    localView.querySelectorAll('.btn-back-to-sellers').forEach(btn => {
      btn.addEventListener('click', () => switchTab('sellers'));
    });
    return;
  }
  
  const priorityMatchesCount = matches.filter(m => m.wantItem && m.wantItem.isPriority).length;
  
  let html = `
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-hairline-light flex-wrap gap-2">
      <button type="button" class="btn-back-to-sellers border border-hairline-dark bg-pure-white hover:bg-pitch-black hover:text-pure-white text-pitch-black font-mono text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs">
        <span class="material-symbols-outlined text-[15px]">arrow_back</span>
        <span>VOLVER A VENDEDORES MARKETPLACE</span>
      </button>
      <span class="font-mono text-[10px] text-muted-graphite uppercase tracking-widest">COINCIDENCIAS CON CATÁLOGO LOCAL</span>
    </div>

    <!-- Editorial Hero Strip -->
    <div class="border-2 border-hairline-dark bg-pure-white p-6 mb-6 relative shadow-[4px_4px_0px_rgba(0,0,0,0.06)] flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
      <div class="absolute top-0 left-0 right-0 h-1 bg-prada-red"></div>
      <div class="flex flex-col gap-1 pt-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-mono tracking-wider uppercase bg-prada-red text-pure-white px-2 py-0.5 font-bold shadow-xs">
            CATÁLOGO LOCAL
          </span>
          <span class="text-[11px] font-mono uppercase text-prada-blue font-semibold border border-blue-200 bg-blue-50 px-2 py-0.5">
            🇺🇾 URUGUAY / DRIVE
          </span>
        </div>
        <h2 class="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-tight mt-1 text-pitch-black">
          COINCIDENCIAS EN DISQUERÍA LOCAL
        </h2>
        <p class="font-mono text-xs text-muted-graphite mt-0.5">
          SE ENCONTRARON <span class="font-bold text-prada-red">${matches.length} VINILOS</span> DE TU WANTLIST EN LA PLANILLA (${priorityMatchesCount} MARCADOS COMO FAVORITOS ★).
        </p>
      </div>
      <div class="flex items-center gap-3 shrink-0 flex-wrap">
        <button id="btn-reopen-local-modal" class="border-2 border-pitch-black text-pitch-black hover:bg-surface-low font-mono font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex items-center gap-2 shadow-xs">
          <span class="material-symbols-outlined text-[15px]">sync</span>
          <span>CARGAR OTRA PLANILLA</span>
        </button>
        <button id="btn-copy-local-matches" class="bg-emerald-700 hover:bg-emerald-800 text-pure-white font-mono font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex items-center gap-2 shadow-xs">
          <span class="material-symbols-outlined text-[15px]">content_copy</span>
          <span>COPIAR LISTA DE PEDIDO</span>
        </button>
      </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
  `;
  
  matches.forEach(m => {
    const item = m.wantItem || {};
    const hasImage = !!item.image;
    const isPri = !!item.isPriority;
    
    html += `
      <div class="border-2 ${isPri ? 'border-prada-red shadow-[4px_4px_0px_rgba(224,43,32,0.1)]' : 'border-hairline-dark hover:border-pitch-black shadow-[4px_4px_0px_rgba(0,0,0,0.04)]'} bg-pure-white p-5 flex flex-col justify-between relative transition-all group">
        ${isPri ? `
          <span class="absolute top-3 right-3 text-[9px] font-mono font-bold uppercase tracking-wider bg-prada-red text-pure-white px-2 py-0.5 shadow-xs">
            ★ FAVORITO
          </span>
        ` : ''}
        
        <div>
          <div class="flex gap-3.5 mb-4">
            <div class="w-14 h-14 border border-hairline-dark bg-stone-100 shrink-0 overflow-hidden relative shadow-xs">
              ${hasImage ? `
                <img src="${item.image}" referrerpolicy="no-referrer" class="w-full h-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                <div class="w-full h-full hidden items-center justify-center bg-stone-100 text-stone-400">
                  <span class="material-symbols-outlined text-lg">album</span>
                </div>
              ` : `
                <div class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                  <span class="material-symbols-outlined text-xl">album</span>
                </div>
              `}
            </div>
            <div class="min-w-0 flex-1 ${isPri ? 'pr-20' : ''}">
              <p class="font-sans font-extrabold text-sm uppercase tracking-tight text-pitch-black truncate" title="${escapeHTML(item.title || '')}">
                ${escapeHTML(item.title || 'Desconocido')}
              </p>
              <p class="font-mono text-xs text-prada-blue font-bold uppercase tracking-wider truncate mb-1.5" title="${escapeHTML(item.artist || '')}">
                ${escapeHTML(item.artist || 'Varios Artistas')}
              </p>
              <span class="inline-block text-[9px] font-mono uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 font-bold">
                ${escapeHTML(m.matchReason || 'Coincidencia')}
              </span>
            </div>
          </div>
          
          <div class="border border-hairline-dark bg-ivory-warm p-3 flex flex-col gap-2 font-mono text-xs shadow-xs">
            <div class="flex items-start justify-between gap-2">
              <span class="text-[9px] uppercase tracking-wider text-muted-graphite font-semibold shrink-0">PLANILLA:</span>
              <span class="font-bold text-pitch-black truncate text-right text-[11px]" title="${escapeHTML(m.sellerArtist || '')} - ${escapeHTML(m.sellerTitle || '')}">
                ${escapeHTML(m.sellerArtist || '')} - ${escapeHTML(m.sellerTitle || '')}
              </span>
            </div>
            <div class="flex items-center justify-between border-t border-hairline-light pt-2">
              <span class="text-[9px] uppercase tracking-wider text-muted-graphite font-semibold">PRECIO LOCAL:</span>
              <span class="font-extrabold text-prada-red text-sm">
                ${escapeHTML(m.sellerPrice || 'CONSULTAR')}
              </span>
            </div>
            ${m.sellerFormat || m.sellerCondition ? `
              <div class="flex items-center justify-between border-t border-hairline-light pt-1.5 text-[10px] text-muted-graphite">
                <span>${escapeHTML(m.sellerFormat || '')}</span>
                <span class="font-bold text-pitch-black">${escapeHTML(m.sellerCondition || '')}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  localView.innerHTML = html;
  
  const btnReopen = document.getElementById('btn-reopen-local-modal');
  const btnCopyMatches = document.getElementById('btn-copy-local-matches');
  if (btnReopen) btnReopen.addEventListener('click', openLocalSheetModal);
  if (btnCopyMatches) btnCopyMatches.addEventListener('click', copyLocalMatchesToClipboard);
  
  localView.querySelectorAll('.btn-back-to-sellers').forEach(btn => {
    btn.addEventListener('click', () => switchTab('sellers'));
  });
}

async function copyLocalMatchesToClipboard() {
  const matches = state.localMatches || [];
  if (matches.length === 0) return;
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('ORDER_COPIED_WHATSAPP', `Pedido para WhatsApp copiado: ${matches.length} vinilos coincidentes`, {
        matchCount: matches.length,
        username: state.username
      });
    }
  } catch (e) {}
  
  const textLines = ['¡Hola! Me interesan los siguientes vinilos de su catálogo:', ''];
  matches.forEach((m, idx) => {
    const star = m.wantItem.isPriority ? ' (★ Favorito)' : '';
    textLines.push(`${idx + 1}. ${m.sellerArtist || m.wantItem.artist} - ${m.sellerTitle || m.wantItem.title} ${m.sellerPrice ? `[${m.sellerPrice}]` : ''}${star}`);
  });
  textLines.push('', '¿Siguen disponibles? ¡Muchas gracias!');
  
  const success = await copyTextToClipboard(textLines.join('\n'));
  if (success) {
    alert('¡Copiada la lista de pedido al portapapeles! Pegala directamente en WhatsApp o Instagram para enviarla a la disquería.');
  }
}

// Hash routing handler for quick popup actions
function checkUrlHashAction() {
  const hash = (window.location.hash || '').toLowerCase();
  if (hash === '#local') {
    switchTab('local');
  } else if (hash === '#stats') {
    switchTab('stats');
  }
}
window.addEventListener('hashchange', checkUrlHashAction);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkUrlHashAction);
} else {
  setTimeout(checkUrlHashAction, 200);
}

// Position the account dropdown using fixed coordinates computed from the user card's
// bounding rect. This ensures the panel is never clipped by any parent overflow
// or stacking context (e.g. sticky navbar with backdrop-blur).
function positionUserDropdown() {
  if (!userCard || !inputFallback) return;

  const rect = userCard.getBoundingClientRect();
  const dropdownWidth = 320;
  const margin = 8; // gap between card bottom and dropdown top
  const edgePadding = 14; // min distance from viewport edges

  const top = rect.bottom + margin;

  // Prefer right-aligned (right edge of dropdown = right edge of card),
  // but clamp so dropdown never overflows the left viewport edge.
  let right = window.innerWidth - rect.right;
  const leftIfRightAligned = window.innerWidth - right - dropdownWidth;
  if (leftIfRightAligned < edgePadding) {
    // Shift right value so left edge stays within viewport
    right = window.innerWidth - dropdownWidth - edgePadding;
  }
  // Clamp right so dropdown doesn't overflow right edge either
  right = Math.max(edgePadding, right);

  inputFallback.style.top = top + 'px';
  inputFallback.style.right = right + 'px';
  inputFallback.style.left = 'auto';

  // Re-trigger the open animation
  inputFallback.style.animation = 'none';
  // Force reflow
  void inputFallback.offsetHeight;
  inputFallback.style.animation = '';
}

// Re-position on window resize if dropdown is open
window.addEventListener('resize', () => {
  if (inputFallback && inputFallback.style.display === 'block') {
    positionUserDropdown();
  }
});



