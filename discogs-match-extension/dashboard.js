// State management
let state = {
  username: '',
  wants: [],
  allListings: [],
  groupedSellers: [],
  isScanning: false,
  cancelRequested: false,
  proxyTabId: null
};

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

function formatPrice(val, currencyCode, overrideDisplayCurrency = null) {
  const displayCurrencySelect = document.getElementById('display-currency');
  const displayCurr = overrideDisplayCurrency || (displayCurrencySelect ? displayCurrencySelect.value : 'UYU');
  
  if (displayCurr === 'original' || !displayCurr) {
    const info = CURRENCY_MAP[currencyCode] || { symbol: '$', code: currencyCode || 'USD' };
    if (info.code === info.symbol) {
      return `${info.code} ${val.toFixed(2)}`;
    }
    return `${info.code} ${info.symbol}${val.toFixed(2)}`;
  }
  
  // Convert val from currencyCode to USD first
  const sourceRate = CURRENCY_MAP[currencyCode]?.rate || 1.0;
  const valInUSD = val * sourceRate;
  
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

// Retries any async function if it throws a 429 Rate Limit error
async function retryOnRateLimit(fn, retries = 3, initialDelay = 2000) {
  let delay = initialDelay;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.message.includes('429') || error.message.toLowerCase().includes('too many requests');
      if (isRateLimit && attempt < retries) {
        log(`[Límite Excedido 429] Demasiadas peticiones. Esperando ${delay / 1000}s para reintentar (intento ${attempt}/${retries})...`, 'action');
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5; // Exponential backoff
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
const emptyState = document.getElementById('empty-state');
const resultsGrid = document.getElementById('results-grid');
const noResultsState = document.getElementById('no-results-state');

// Wantlist Manager Elements
const wantlistManager = document.getElementById('wantlist-manager');
const wantsSearchInput = document.getElementById('wants-search-input');
const wantsListGrid = document.getElementById('wants-list-grid');
const managerStartScanBtn = document.getElementById('manager-start-scan-btn');

// Location Elements
const buyerCountry = document.getElementById('buyer-country');
const wizardBuyerCountry = document.getElementById('wizard-buyer-country');

// Onboarding Wizard Elements
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
  
  // Tab Navigation switching
  const tabBtnSellers = document.getElementById('tab-btn-sellers');
  const tabBtnStats = document.getElementById('tab-btn-stats');
  if (tabBtnSellers && tabBtnStats) {
    tabBtnSellers.addEventListener('click', () => switchTab('sellers'));
    tabBtnStats.addEventListener('click', () => switchTab('stats'));
  }
  
  // Controls
  loadWantsBtn.addEventListener('click', loadWantlist);
  if (refreshWantsBtn) {
    refreshWantsBtn.addEventListener('click', refreshWantlistIncremental);
  }
  startScanBtn.addEventListener('click', startMarketplaceScan);
  cancelScanBtn.addEventListener('click', cancelScan);
  saveUsernameBtn.addEventListener('click', saveManualUsername);
  clearCacheBtn.addEventListener('click', clearScanCache);
  
  // Onboarding Wizard Navigation
  wizardNext1Btn.addEventListener('click', () => {
    const manualVal = wizardManualUsername ? wizardManualUsername.value.trim() : '';
    if (manualVal && !state.username) {
      localStorage.setItem('discogs_username', manualVal);
      setLoggedInUser(manualVal);
      log(`Usuario '${manualVal}' guardado automáticamente al continuar.`, 'success');
    }
    goToWizardStep(2);
  });
  wizardNext2Btn.addEventListener('click', () => goToWizardStep(3));
  wizardBack2Btn.addEventListener('click', () => goToWizardStep(1));
  wizardBack3Btn.addEventListener('click', () => goToWizardStep(2));
  wizardSyncBtn.addEventListener('click', loadWantlist);
  wizardSaveUsernameBtn.addEventListener('click', saveWizardManualUsername);
  
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
  wantsSearchInput.addEventListener('input', filterWantsInManager);
  managerStartScanBtn.addEventListener('click', startMarketplaceScan);
  
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
  }
  filterMinMatches.addEventListener('change', renderResults);
  if (filterMinCondition) {
    filterMinCondition.addEventListener('change', renderResults);
  }
  filterCountry.addEventListener('change', renderResults);
  filterRating.addEventListener('change', renderResults);
  sortBy.addEventListener('change', renderResults);
  filterPriorityOnly.addEventListener('change', renderResults);
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

// Dynamic lock/unlock filters section
function toggleFiltersState(enabled) {
  const displayCurrencySelect = document.getElementById('display-currency');
  if (displayCurrencySelect) displayCurrencySelect.disabled = !enabled;
  filterMinMatches.disabled = !enabled;
  if (filterMinCondition) filterMinCondition.disabled = !enabled;
  filterCountry.disabled = !enabled;
  filterRating.disabled = !enabled;
  sortBy.disabled = !enabled;
  filterPriorityOnly.disabled = !enabled;
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

// Onboarding Wizard navigation helper
function goToWizardStep(stepNum) {
  const stepPane1 = document.getElementById('step-pane-1');
  const stepPane2 = document.getElementById('step-pane-2');
  const stepPane3 = document.getElementById('step-pane-3');
  const dot1 = document.getElementById('dot-1');
  const dot2 = document.getElementById('dot-2');
  const dot3 = document.getElementById('dot-3');

  if (stepPane1) stepPane1.style.display = stepNum === 1 ? 'block' : 'none';
  if (stepPane2) stepPane2.style.display = stepNum === 2 ? 'block' : 'none';
  if (stepPane3) stepPane3.style.display = stepNum === 3 ? 'block' : 'none';

  if (dot1) dot1.classList.toggle('active', stepNum >= 1);
  if (dot2) dot2.classList.toggle('active', stepNum >= 2);
  if (dot3) dot3.classList.toggle('active', stepNum >= 3);
}

// Show Wantlist Manager section when wants are loaded
function showWantlistManager() {
  const emptyState = document.getElementById('empty-state');
  const wantlistManager = document.getElementById('wantlist-manager');
  
  if (emptyState) emptyState.style.display = 'none';
  if (wantlistManager) {
    wantlistManager.style.display = 'block';
    renderWantsListInManager();
  }
}

// Render loaded wants list inside Wantlist Manager for marking favorites (★)
function renderWantsListInManager() {
  const wantsListGrid = document.getElementById('wants-list-grid');
  if (!wantsListGrid) return;
  
  wantsListGrid.innerHTML = '';
  const searchVal = (wantsSearchInput ? wantsSearchInput.value : '').toLowerCase().trim();
  
  const filteredWants = state.wants.filter(w => {
    if (!searchVal) return true;
    return (w.title || '').toLowerCase().includes(searchVal) || (w.artist || '').toLowerCase().includes(searchVal);
  });

  if (filteredWants.length === 0) {
    wantsListGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No se encontraron vinilos en la búsqueda.</p>`;
    return;
  }

  filteredWants.forEach(item => {
    const card = document.createElement('div');
    card.className = `want-manager-card ${item.isPriority ? 'priority' : ''}`;
    card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glow); border-radius: 10px; margin-bottom: 8px;';
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
        <div style="width: 36px; height: 36px; border-radius: 6px; overflow: hidden; background: #1a2035; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          ${item.image ? `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '💿'}
        </div>
        <div style="min-width: 0;">
          <p style="font-weight: 700; color: #fff; font-size: 13px; margin: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHTML(item.title)}</p>
          <p style="font-size: 11px; color: var(--color-purple); margin: 2px 0 0 0; text-transform: uppercase; font-weight: 600;">${escapeHTML(item.artist)}</p>
        </div>
      </div>
      <button class="btn-star ${item.isPriority ? 'active' : ''}" data-id="${item.id}" style="background: none; border: none; font-size: 20px; cursor: pointer; color: ${item.isPriority ? '#f5c518' : '#4b5563'}; transition: transform 0.2s;" title="Destacar como favorito">
        ★
      </button>
    `;

    const starBtn = card.querySelector('.btn-star');
    if (starBtn) {
      starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.isPriority = !item.isPriority;
        starBtn.style.color = item.isPriority ? '#f5c518' : '#4b5563';
        card.classList.toggle('priority', item.isPriority);
      });
    }

    wantsListGrid.appendChild(card);
  });
}

function filterWantsInManager() {
  renderWantsListInManager();
}

// Initialize Application and detect user session
async function initApp() {
  log('Iniciando Discogs Wishlist Matcher...');
  
  // Check GPU Hardware Acceleration
  checkHardwareAcceleration();
  
  // Lock filters initially until results exist
  toggleFiltersState(false);
  
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
    const detectedUser = await detectDiscogsSession();
    if (detectedUser) {
      setLoggedInUser(detectedUser);
    } else {
      showFallbackLogin();
    }
  } catch (error) {
    console.error('Session detection error:', error);
    showFallbackLogin();
  }
}

// Write message to dashboard log section
function log(message, type = 'info') {
  console.log(`[Log] ${message}`);
  if (statusLogs) {
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    if (type === 'error') p.style.color = '#ef4444';
    if (type === 'success') p.style.color = '#10b981';
    statusLogs.appendChild(p);
    statusLogs.scrollTop = statusLogs.scrollHeight;
  }
}

// Show manual input fallback if session detection fails
function showFallbackLogin() {
  // Try retrieving from local storage
  const saved = localStorage.getItem('discogs_username');
  if (saved) {
    manualUsername.value = saved;
    if (wizardManualUsername) {
      wizardManualUsername.value = saved;
    }
    setLoggedInUser(saved);
    return;
  }

  connectionStatus.textContent = 'Sesión no detectada';
  connectionStatus.style.color = '#ef4444';
  usernameDisplay.textContent = 'Invitado';
  userAvatar.textContent = '?';
  userAvatar.style.background = '#374151';
  inputFallback.style.display = 'block';
  
  // Update wizard detection status
  if (wizardDetectionStatus) {
    wizardDetectionStatus.innerHTML = `
      <span class="pulse-indicator orange"></span>
      <span>Por favor ingresa tu usuario</span>
    `;
    wizardNext1Btn.disabled = true;
  }
  
  if (wizardInputFallback) {
    wizardInputFallback.style.display = 'flex';
  }
}

// Save manual username configuration
function saveManualUsername() {
  const username = manualUsername.value.trim();
  if (username) {
    localStorage.setItem('discogs_username', username);
    setLoggedInUser(username);
    log(`Usuario '${username}' guardado manualmente.`, 'success');
  }
}

// Set user layout as logged in
function setLoggedInUser(username) {
  state.username = username;
  connectionStatus.textContent = 'Conectado a Discogs';
  connectionStatus.style.color = '#10b981';
  usernameDisplay.textContent = username;
  userAvatar.textContent = username.substring(0, 2).toUpperCase();
  userAvatar.style.background = 'linear-gradient(135deg, var(--color-purple) 0%, var(--color-purple-dark) 100%)';
  inputFallback.style.display = 'none';
  loadWantsBtn.disabled = false;
  
  // Enable onboarding next step
  if (wizardDetectionStatus) {
    wizardDetectionStatus.innerHTML = `
      <span class="pulse-indicator green"></span>
      <span>¡Sesión detectada: ${username}!</span>
    `;
    wizardNext1Btn.disabled = false;
  }
  
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
      console.error(`[DirectFetch] Error en fetch directo para URL: ${url}:`, error.message);
      throw error;
    }
  });
}

// Fetch helper using the content script proxy to bypass Cloudflare
async function fetchThroughTab(url) {
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
        fetchDirect(url)
          .then(resolve)
          .catch(err => {
            console.error(`[ProxyFetch] Falló fallback directo tras timeout:`, err.message);
            reject(err);
          });
      }, 10000);

      console.log(`[ProxyFetch] Enviando mensaje fetchUrl a pestaña ${activeProxyTab.id} para URL: ${url}`);
      chrome.tabs.sendMessage(activeProxyTab.id, { action: "fetchUrl", url }, (response) => {
        if (!timeoutId) {
          console.log(`[ProxyFetch] Respuesta tardía recibida de pestaña ${activeProxyTab.id} para ${url} (ya venció timeout)`);
          return; 
        }
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          console.error(`[ProxyFetch] Error de comunicación con pestaña ${activeProxyTab.id}:`, chrome.runtime.lastError.message);
          fetchDirect(url)
            .then(resolve)
            .catch(err => {
              console.error(`[ProxyFetch] Falló fallback directo tras error de canal:`, err.message);
              reject(err);
            });
        } else if (response && response.success) {
          console.log(`[ProxyFetch] Respuesta exitosa recibida de pestaña proxy para URL: ${url} (${response.html ? response.html.length : 0} bytes)`);
          resolve(response.html);
        } else {
          const errMsg = response ? response.error : "Unknown same-origin fetch error";
          console.error(`[ProxyFetch] La pestaña proxy retornó error para ${url}:`, errMsg);
          reject(new Error(errMsg));
        }
      });
    });
  });
}

// Step 1: Load Wants List from Discogs API
async function loadWantlist() {
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
        const jsonText = await fetchDirect(`https://api.discogs.com/users/${state.username}/wants?page=${page}&per_page=100${tokenParam}`);
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
            haveCount: (item.basic_information.community && item.basic_information.community.have) || 0
          }));
          
          loadedWants.push(...pageWants);
          totalPages = data.pagination.pages;
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
      
      do {
        log(`Cargando página ${page} del raspado HTML...`);
        if (wizardSyncText) wizardSyncText.textContent = `Cargando página ${page} (Web)...`;
        
        let html = '';
        try {
          html = await fetchThroughTab(`https://www.discogs.com/user/${state.username}/wants?limit=250&page=${page}`);
        } catch (tabErr) {
          console.warn(`[WantlistHTML] Falló /user/${state.username}/wants, intentando /mywants...`, tabErr);
          html = await fetchThroughTab(`https://www.discogs.com/mywants?limit=250&page=${page}`);
        }
        
        const pageWants = parseWantlistHTML(html);
        
        if (pageWants.length > 0) {
          loadedWants.push(...pageWants);
          // If fewer than 250 items, it means we reached the end
          if (pageWants.length < 250) {
            hasMore = false;
          } else {
            page++;
            // Polite delay to avoid rate limits
            await new Promise(r => setTimeout(r, 1200));
          }
        } else {
          hasMore = false;
        }
      } while (hasMore);
      
      if (loadedWants.length > 0) {
        log(`Wantlist cargada con éxito a través de raspado HTML (${loadedWants.length} discos).`, 'success');
      } else {
        throw new Error('No se encontraron discos en la Wantlist usando ninguno de los dos métodos.');
      }
    }
    
    state.wants = loadedWants;
    metricWantsCount.textContent = state.wants.length;
    
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
    
  } catch (error) {
    log(`Error al cargar Wantlist: ${error.message}`, 'error');
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
    const releaseLink = row.querySelector('a[href*="/release/"]');
    if (!releaseLink) return;
    
    const href = releaseLink.getAttribute('href');
    const match = href.match(/\/release\/(\d+)/);
    if (!match) return;
    
    const id = parseInt(match[1], 10);
    
    // Avoid duplicates
    if (wants.some(w => w.id === id)) return;
    
    // Parse title & artist from text
    // E.g., "Daft Punk - Discovery (CD, Album)"
    let text = releaseLink.textContent.trim();
    let artist = 'Unknown Artist';
    let title = 'Unknown Title';
    
    const parts = text.split(' - ');
    if (parts.length > 1) {
      artist = parts[0].trim();
      // Remove formats in parentheses at the end of the title
      title = parts.slice(1).join(' - ').split('(')[0].trim();
    } else {
      title = text.split('(')[0].trim();
      const artistEl = row.querySelector('.artist, [class*="artist"], a[href*="/artist/"]');
      if (artistEl) {
        artist = artistEl.textContent.trim();
      }
    }
    
    // Check if we can get the cover image
    const img = row.querySelector('img[data-src], img[src]');
    let image = '';
    if (img) {
      image = img.getAttribute('data-src') || img.getAttribute('src') || '';
    }

    // Extract want/have counts from row if present
    let rowWantCount = null;
    let rowHaveCount = null;
    const rowText = row.textContent.toLowerCase();
    const wantMatch = rowText.match(/(\d[\d.,]*)\s*(?:quieren|wants?)/i) || rowText.match(/(?:quieren|wants?)\S*\s*:?\s*(\d[\d.,]*)/i);
    if (wantMatch) rowWantCount = parseInt(wantMatch[1].replace(/[^\d]/g, ''), 10);
    const haveMatch = rowText.match(/(\d[\d.,]*)\s*(?:tienen|haves?)/i) || rowText.match(/(?:tienen|haves?)\S*\s*:?\s*(\d[\d.,]*)/i);
    if (haveMatch) rowHaveCount = parseInt(haveMatch[1].replace(/[^\d]/g, ''), 10);
    
    wants.push({
      id,
      title,
      artist,
      year: '',
      image,
      wantCount: rowWantCount,
      haveCount: rowHaveCount
    });
  });
  
  return wants;
}

// Step 2: Scan Single Release (Utility)
async function scanSingleRelease(item, index, totalWants, timeEstText = '') {
  const buyerCountryVal = (buyerCountry ? buyerCountry.value : 'Uruguay').trim().toLowerCase();
  const progress = Math.round(((index + 1) / totalWants) * 100);
  
  // Update UI Progress
  statusTitle.textContent = `Escaneando disco ${index + 1} de ${totalWants}${timeEstText}`;
  progressBar.style.width = `${progress}%`;
  progressText.textContent = `Analizando: ${item.artist} - ${item.title}...`;
  progressPercent.textContent = `${progress}%`;

  // Update Cover Art Preview for currently scanned item
  const scanningCoverArt = document.getElementById('scanning-cover-art');
  const coverPlaceholder = document.getElementById('cover-placeholder');
  if (scanningCoverArt) {
    if (item.image) {
      scanningCoverArt.style.backgroundImage = `url('${item.image}')`;
      if (coverPlaceholder) coverPlaceholder.style.display = 'none';
    } else {
      scanningCoverArt.style.backgroundImage = '';
      if (coverPlaceholder) coverPlaceholder.style.display = 'block';
    }
  }
  
  let parsedListings = null;
  let isFromCache = false;
  let cacheAgeHours = 0;
  let communityStats = null;
  
  // Try fetching from chrome.storage.local cache first
  if (useCacheCheckbox && useCacheCheckbox.checked && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const cacheKey = `release_${item.id}_${buyerCountryVal}`;
      const cacheData = await new Promise(resolve => {
        chrome.storage.local.get([cacheKey], (result) => {
          resolve(result[cacheKey] || null);
        });
      });
      
      if (cacheData && cacheData.version === 3) {
        const now = Date.now();
        cacheAgeHours = (now - cacheData.timestamp) / (1000 * 60 * 60);
        
        // Priority items get live updates if cache is older than 2h; standard items if older than 6h
        const maxAgeAllowed = item.isPriority ? 2.0 : 6.0;
        
        if (cacheAgeHours < maxAgeAllowed) {
          parsedListings = cacheData.listings;
          communityStats = cacheData.communityStats || null;
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
    return { listings: parsedListings, communityStats: communityStats, isFromCache: true };
  }
  
  log(`Escaneando en vivo (${index + 1}/${totalWants}${timeEstText}): ${item.artist} - ${item.title}...`);
  
  try {
    const url = `https://www.discogs.com/sell/release/${item.id}?limit=100`;
    const html = await fetchThroughTab(url);
    const result = parseReleaseHTML(html, item.id);
    parsedListings = result.listings;
    communityStats = result.communityStats;
    
    // Save to cache with version 3 tag
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const cacheKey = `release_${item.id}_${buyerCountryVal}`;
      chrome.storage.local.set({
        [cacheKey]: {
          timestamp: Date.now(),
          version: 3,
          listings: parsedListings,
          communityStats: communityStats
        }
      });
    }
    
    return { listings: parsedListings, communityStats: communityStats, isFromCache: false };
  } catch (e) {
    log(`Error al escanear release ${item.id}: ${e.message}`, 'error');
    return { listings: [], communityStats: null, isFromCache: false };
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
  
  // Lock filters dynamically while scanning
  toggleFiltersState(false);
  
  if (startIndex === 0) {
    state.allListings = [];
    state.groupedSellers = [];
    statusLogs.innerHTML = '';
    log('Iniciando escaneo del marketplace...');
  } else {
    log(`Reanudando escaneo del marketplace desde el disco ${startIndex + 1}...`, 'info');
  }
  
  startScanBtn.disabled = true;
  loadWantsBtn.disabled = true;
  const refreshWantsBtn = document.getElementById('refresh-wants-btn');
  if (refreshWantsBtn) refreshWantsBtn.disabled = true;
  logoVinyl.classList.add('spinning');
  
  // Show progress panel and trigger turntable spinning
  statusCard.style.display = 'block';
  const turntableVinyl = document.getElementById('turntable-vinyl');
  if (turntableVinyl) turntableVinyl.classList.add('spinning');
  
  // Reset cover art preview
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
  
  const tabNavigation = document.getElementById('tab-navigation');
  if (tabNavigation) tabNavigation.style.display = 'none';
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

  const BATCH_SIZE = 3;
  const scanStartTime = Date.now();
  let liveScannedCount = 0;
  
  try {
    for (let i = startIndex; i < state.wants.length; i += BATCH_SIZE) {
      if (state.cancelRequested) {
        log('Escaneo cancelado por el usuario.', 'error');
        break;
      }
      
      const batchItems = state.wants.slice(i, i + BATCH_SIZE);
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
      metricSellersCount.textContent = uniqueSellers.size;
      metricMatchesCount.textContent = state.allListings.length;
      
      // Save scan session progress
      saveScanSession(Math.min(i + BATCH_SIZE - 1, state.wants.length - 1));
      
      // Short pause between live batches to respect Discogs server limits
      if (hasLiveFetch) {
        await new Promise(resolve => setTimeout(resolve, 600));
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
    log(`Error crítico durante el escaneo: ${error.message}`, 'error');
  } finally {
    state.isScanning = false;
    startScanBtn.disabled = false;
    loadWantsBtn.disabled = false;
    const refreshWantsBtn = document.getElementById('refresh-wants-btn');
    if (refreshWantsBtn) refreshWantsBtn.disabled = false;
    logoVinyl.classList.remove('spinning');
    statusCard.style.display = 'none';
    
    const turntableVinyl = document.getElementById('turntable-vinyl');
    if (turntableVinyl) turntableVinyl.classList.remove('spinning');
    
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
    } else {
      toggleFiltersState(false);
    }
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
            haveCount: (item.basic_information.community && item.basic_information.community.have) || 0
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
      const turntableVinyl = document.getElementById('turntable-vinyl');
      if (turntableVinyl) turntableVinyl.classList.add('spinning');
      logoVinyl.classList.add('spinning');
      
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
    logoVinyl.classList.remove('spinning');
    statusCard.style.display = 'none';
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

// Step 2: Scan Single Release (Utility)
async function scanSingleRelease(item, index, totalWants, timeEstText = '') {
  const buyerCountryVal = (buyerCountry ? buyerCountry.value : 'Uruguay').trim().toLowerCase();
  const progress = Math.round(((index + 1) / totalWants) * 100);
  
  // Update UI Progress
  statusTitle.textContent = `Escaneando disco ${index + 1} de ${totalWants}${timeEstText}`;
  progressBar.style.width = `${progress}%`;
  progressText.textContent = `Analizando: ${item.artist} - ${item.title}...`;
  progressPercent.textContent = `${progress}%`;

  // Update Cover Art Preview for currently scanned item
  const scanningCoverArt = document.getElementById('scanning-cover-art');
  const coverPlaceholder = document.getElementById('cover-placeholder');
  if (scanningCoverArt) {
    if (item.image) {
      scanningCoverArt.style.backgroundImage = `url('${item.image}')`;
      if (coverPlaceholder) coverPlaceholder.style.display = 'none';
    } else {
      scanningCoverArt.style.backgroundImage = '';
      if (coverPlaceholder) coverPlaceholder.style.display = 'block';
    }
  }
  
  let parsedListings = null;
  let isFromCache = false;
  let cacheAgeHours = 0;
  let communityStats = null;
  
  // Try fetching from chrome.storage.local cache first
  if (useCacheCheckbox && useCacheCheckbox.checked && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const cacheKey = `release_${item.id}_${buyerCountryVal}`;
      const cacheData = await new Promise(resolve => {
        chrome.storage.local.get([cacheKey], (result) => {
          resolve(result[cacheKey] || null);
        });
      });
      
      if (cacheData && cacheData.version === 3) {
        const now = Date.now();
        cacheAgeHours = (now - cacheData.timestamp) / (1000 * 60 * 60);
        
        // Priority items get live updates if cache is older than 2h; standard items if older than 6h
        const maxAgeAllowed = item.isPriority ? 2.0 : 6.0;
        
        if (cacheAgeHours < maxAgeAllowed) {
          parsedListings = cacheData.listings;
          communityStats = cacheData.communityStats || null;
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
    return { listings: parsedListings, communityStats: communityStats, isFromCache: true };
  }
  
  log(`Escaneando en vivo (${index + 1}/${totalWants}${timeEstText}): ${item.artist} - ${item.title}...`);
  
  try {
    const url = `https://www.discogs.com/sell/release/${item.id}?limit=100`;
    const html = await fetchThroughTab(url);
    const result = parseReleaseHTML(html, item.id);
    parsedListings = result.listings;
    communityStats = result.communityStats;

    // Fallback: If marketplace page HTML did not contain release stats, fetch release stats via API or HTML
    if (!communityStats || communityStats.wantCount === null) {
      try {
        const jsonText = await fetchDirect(`https://api.discogs.com/releases/${item.id}`);
        const relData = JSON.parse(jsonText);
        if (relData && relData.community) {
          communityStats = {
            wantCount: typeof relData.community.want === 'number' ? relData.community.want : null,
            haveCount: typeof relData.community.have === 'number' ? relData.community.have : null
          };
          console.log(`[StatsFetch 🎯] Release ${item.id} (${item.title}): Want real=${communityStats.wantCount}, Have real=${communityStats.haveCount}`);
        }
      } catch (apiErr) {
        try {
          const statsUrl = `https://www.discogs.com/release/stats/${item.id}`;
          const statsHtml = await fetchThroughTab(statsUrl);
          const statsResult = parseReleaseHTML(statsHtml, item.id);
          if (statsResult.communityStats && statsResult.communityStats.wantCount !== null) {
            communityStats = statsResult.communityStats;
          }
        } catch (statsErr) {
          console.warn(`[StatsFetch] Error al obtener /release/stats/${item.id}:`, statsErr);
        }
      }
    }
    
    // Save to cache with version 3 tag
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const cacheKey = `release_${item.id}_${buyerCountryVal}`;
      chrome.storage.local.set({
        [cacheKey]: {
          timestamp: Date.now(),
          version: 3,
          listings: parsedListings,
          communityStats: communityStats
        }
      });
    }
    
    return { listings: parsedListings, communityStats: communityStats, isFromCache: false };
  } catch (e) {
    log(`Error al escanear release ${item.id}: ${e.message}`, 'error');
    return { listings: [], communityStats: null, isFromCache: false };
  }
}

// Cancel current scan
function cancelScan() {
  state.cancelRequested = true;
  cancelScanBtn.textContent = 'Cancelando...';
  log('Solicitando cancelación del escaneo...');
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
      const sellerInfoText = row.querySelector('.seller_info')?.textContent || '';
      let rating = 100;
      let ratingCount = 0;
      
      const ratingMatch = sellerInfoText.match(/(\d+(?:\.\d+)?)\%/);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      }
      
      const countMatch = sellerInfoText.match(/\(([\d,]+)\s*(?:ratings|valoraciones)?\)/i);
      if (countMatch) {
        ratingCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
      } else {
        const fallbackCount = sellerInfoText.match(/\(([\d,]+)\)/);
        if (fallbackCount) ratingCount = parseInt(fallbackCount[1].replace(/,/g, ''), 10);
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
  
  return {
    listings: listings,
    communityStats: {
      haveCount,
      wantCount,
      lowPrice,
      highPrice,
      ratingValue,
      catalogNumber,
      recordLabel
    }
  };
}

// Group all matching listings by Seller Name
function groupListingsBySeller() {
  const sellersMap = {};
  const buyerCountryVal = buyerCountry.value || 'Uruguay';
  
  // List of European countries to check EU-to-EU shipping
  const euroCountries = ['spain', 'germany', 'france', 'italy', 'united kingdom', 'uk', 'netherlands', 'belgium', 'austria', 'switzerland', 'sweden', 'norway', 'portugal', 'greece', 'poland', 'ireland', 'spain (es)', 'deutschland', 'de', 'es'];
  
  const isCountryEU = (c) => euroCountries.some(eu => c.toLowerCase().includes(eu));
  const isBuyerEU = isCountryEU(buyerCountryVal);

  state.allListings.forEach(listing => {
    const sName = listing.sellerName;
    
    // Auto-heal listing currency if loaded from old cache before currency parser fix
    const locLower = (listing.shipsFrom || '').toLowerCase();
    if ((locLower.includes('brazil') || locLower.includes('brasil')) && listing.currency === 'USD') {
      listing.currency = 'BRL';
    } else if ((locLower.includes('germany') || locLower.includes('spain') || locLower.includes('france') || locLower.includes('italy') || locLower.includes('netherlands')) && listing.currency === 'USD') {
      listing.currency = 'EUR';
    } else if ((locLower.includes('united kingdom') || locLower.includes('uk') || locLower.includes('great britain')) && listing.currency === 'USD') {
      listing.currency = 'GBP';
    } else if (locLower.includes('japan') && listing.currency === 'USD') {
      listing.currency = 'JPY';
    }
    
    // Auto-heal small JPY values from legacy cache (e.g. 3.92 JPY -> $3.92 USD) so they aren't treated as $0.02 USD
    if (listing.currency === 'JPY' && listing.priceVal < 100) {
      listing.currency = 'USD';
    }
    
    if (!sellersMap[sName]) {
      sellersMap[sName] = {
        name: sName,
        rating: listing.rating,
        ratingCount: listing.ratingCount,
        shipsFrom: listing.shipsFrom,
        currency: listing.currency,
        listings: []
      };
    }
    
    // Avoid double listings of same release by same seller (keep cheapest copy)
    const existing = sellersMap[sName].listings.find(l => l.releaseId === listing.releaseId);
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
    const listCount = seller.listings.length;
    const subtotal = seller.listings.reduce((sum, item) => sum + item.priceVal, 0);
    
    // Determine location relationship
    const shipsFromLower = seller.shipsFrom.toLowerCase();
    const buyerLower = buyerCountryVal.toLowerCase();
    
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
    
    const estimatedShipping = calculateSellerShipping(seller, seller.listings);
    const totalPrice = subtotal + estimatedShipping;
    
    return {
      ...seller,
      matchCount: listCount,
      subtotal: parseFloat(subtotal.toFixed(2)),
      estimatedShipping: parseFloat(estimatedShipping.toFixed(2)),
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      isDomestic,
      isEUToEU,
      isShippingEstimated: seller.listings.some(l => l.isShippingEstimated)
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

  // Helper function to render a candidate row card inside the stack
  function renderCandidateCard(seller, rankIndex, totalWantsCount, optionType) {
    const rankIcons = ['🥇', '🥈', '🥉'];
    const medal = rankIcons[rankIndex] || '•';
    const totalCost = seller.totalPrice;
    const subtotal = seller.listings.reduce((sum, l) => sum + l.priceVal, 0);
    const shippingCost = totalCost - subtotal;
    
    let albumsHtml = '';
    seller.listings.forEach(l => {
      const wantInfo = state.wants.find(w => w.id === l.releaseId) || { title: 'Unknown', artist: 'Unknown' };
      albumsHtml += `
        <div class="smart-album-row">
          <span class="smart-album-title" title="${escapeHTML(wantInfo.title)} - ${escapeHTML(wantInfo.artist)}">💿 ${escapeHTML(wantInfo.title)}</span>
          <span class="smart-album-price">${formatPrice(l.priceVal, l.currency)}</span>
        </div>
      `;
    });

    const isActiveClass = rankIndex === 0 ? 'active' : '';
    const sellerUrl = seller.listings[0]?.listingUrl || (seller.listings[0]?.listingId ? 'https://www.discogs.com/sell/item/' + seller.listings[0].listingId : 'https://www.discogs.com/release/' + seller.listings[0]?.releaseId);

    return `
      <div class="smart-candidate-card ${isActiveClass}">
        <div class="smart-candidate-header">
          <div class="smart-candidate-title">
            <span style="font-size: 14px;">${medal}</span>
            <span style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;" title="${escapeHTML(seller.name)}">${escapeHTML(seller.name)}</span>
            <span class="smart-candidate-meta-badge">${seller.listings.length} discos</span>
          </div>
          <div class="smart-candidate-price">
            ${formatPrice(totalCost, seller.currency)}
            <span style="font-size: 8px; opacity: 0.6; margin-left: 2px;">▼</span>
          </div>
        </div>
        
        <div class="smart-candidate-body">
          <div class="smart-candidate-body-inner">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span>📍 ${escapeHTML(seller.shipsFrom)} • ⭐ ${seller.rating}% pos.</span>
              <a href="${sellerUrl}" target="_blank" style="color: var(--color-purple); text-decoration: none; font-weight: 600;">Ver en Discogs ↗</a>
            </div>
            
            <div class="smart-option-albums-list" style="max-height: 120px;">
              ${albumsHtml}
            </div>
            
            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; font-size: 11px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
                <span>Subtotal discos:</span>
                <span>${formatPrice(subtotal, seller.currency)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
                <span>Gastos de envío:</span>
                <span>${formatPrice(shippingCost, seller.currency)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-weight: 700; margin-top: 2px;">
                <span style="color: var(--text-muted);">Promedio por disco:</span>
                <span style="color: var(--color-amber);">${formatPrice(totalCost / seller.listings.length, seller.currency)}</span>
              </div>
              <a href="#" class="btn-scroll-to-seller" data-scroll-to="${escapeHTML(seller.name)}" style="margin-top: 10px; display: block; text-align: center; text-decoration: none; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #ffffff; background: linear-gradient(135deg, rgba(159, 122, 234, 0.3) 0%, rgba(128, 90, 213, 0.3) 100%); border: 1px solid rgba(159, 122, 234, 0.6); border-radius: 8px; transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;">
                Ver oferta y discos ↓
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  let stackHtmlA = '';
  topSellersA.forEach((seller, idx) => {
    stackHtmlA += renderCandidateCard(seller, idx, state.wants.length, 'A');
  });

  let stackHtmlB = '';
  topSellersB.forEach((seller, idx) => {
    stackHtmlB += renderCandidateCard(seller, idx, state.wants.length, 'B');
  });

  let wishlistHtml = '';
  if (wishlistStats) {
    wishlistHtml = `
      <div class="smart-option-card" style="grid-column: 1 / -1; background: rgba(159, 122, 234, 0.05); border-color: rgba(159, 122, 234, 0.25); margin-top: 16px; min-height: auto; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; width: 100%;">
          <div style="flex: 1; min-width: 250px;">
            <h3 style="margin: 0; font-family: var(--font-title); font-size: 15px; color: #fff; display: flex; align-items: center; gap: 8px;">
              🌐 Cobertura Completa (Compra Multitienda)
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: var(--text-muted); line-height: 1.4;">
              El costo estimado para conseguir la mayor cantidad posible de tu wishlist seleccionando la copia más barata disponible en el marketplace para cada disco.
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 24px; text-align: right; flex-wrap: wrap;">
            <div>
              <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Discos Cubiertos</div>
              <div style="font-size: 16px; font-weight: 800; color: #fff; margin-top: 2px;">${wishlistStats.coveredCount} de ${wishlistStats.totalReleasesCount}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Vendedores</div>
              <div style="font-size: 16px; font-weight: 800; color: #c084fc; margin-top: 2px;">${wishlistStats.sellersCount} tiendas</div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Costo Total Estimado</div>
              <div style="font-size: 20px; font-weight: 800; color: var(--color-amber); margin-top: 2px;">USD $${wishlistStats.totalCostUSD.toFixed(2)}</div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">Discos: $${wishlistStats.discsPriceUSD.toFixed(2)} | Envío: $${wishlistStats.shippingUSD.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const cardsHtml = `
    <div class="smart-options-container">
      <div class="smart-option-card" style="padding: 16px; justify-content: flex-start; min-height: auto;">
        <div class="smart-option-header" style="margin-bottom: 10px;">
          <h3 style="display: flex; align-items: center; gap: 8px;">📦 Opción A: Compra Máxima</h3>
          <p>Satisface la mayor cantidad de discos de tu Wantlist en una sola compra.</p>
        </div>
        <div class="smart-candidates-stack">
          ${stackHtmlA}
        </div>
      </div>
      
      <div class="smart-option-card" style="padding: 16px; justify-content: flex-start; min-height: auto;">
        <div class="smart-option-header" style="margin-bottom: 10px;">
          <h3 style="display: flex; align-items: center; gap: 8px;">💰 Opción B: Compra Eficiente</h3>
          <p>Prioriza los vendedores con el menor precio promedio por vinilo (mín. 3 discos).</p>
        </div>
        <div class="smart-candidates-stack">
          ${stackHtmlB}
        </div>
      </div>
      
      ${wishlistHtml}
    </div>
  `;

  smartPurchaseCard.innerHTML = `
    <div class="smart-purchase-header" style="margin-bottom: 16px;">
      <div class="smart-purchase-title-area" style="display: flex; align-items: center; gap: 12px;">
        <span class="smart-purchase-icon" style="font-size: 24px;">🏆</span>
        <div>
          <h2 style="margin: 0; font-family: var(--font-title); font-size: 18px; color: #fff;">Compra Inteligente Consolidada</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Las mejores opciones de vendedor único para consolidar tu compra sin multiplicar gastos de envío.</p>
        </div>
      </div>
    </div>
    <div class="smart-purchase-content">
      ${cardsHtml}
    </div>
  `;

  smartPurchaseCard.style.display = 'block';

  // Attach event listeners for scrolling to seller cards
  smartPurchaseCard.querySelectorAll('[data-scroll-to]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sellerName = link.getAttribute('data-scroll-to');
      const targetCard = document.getElementById('seller-card-' + sellerName);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.style.borderColor = 'var(--color-purple)';
        targetCard.style.boxShadow = '0 0 25px var(--color-purple)';
        setTimeout(() => {
          targetCard.style.borderColor = '';
          targetCard.style.boxShadow = '';
        }, 1500);
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
    emptyState.style.display = 'flex';
    resultsGrid.style.display = 'none';
    noResultsState.style.display = 'none';
    const smartCard = document.getElementById('smart-purchase-card');
    if (smartCard) smartCard.style.display = 'none';
    const tabNavigation = document.getElementById('tab-navigation');
    if (tabNavigation) tabNavigation.style.display = 'none';
    const statsView = document.getElementById('stats-view');
    if (statsView) statsView.style.display = 'none';
    toggleFiltersState(false);
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
    noResultsState.style.display = 'block';
    const smartCard = document.getElementById('smart-purchase-card');
    if (smartCard) smartCard.style.display = 'none';
    const tabNavigation = document.getElementById('tab-navigation');
    if (tabNavigation) tabNavigation.style.display = 'none';
    const statsView = document.getElementById('stats-view');
    if (statsView) statsView.style.display = 'none';
    return;
  }
  
  // Render Smart Purchase recommendation card
  renderSmartPurchase(filtered);
  
  emptyState.style.display = 'none';
  noResultsState.style.display = 'none';
  const tabNavigation = document.getElementById('tab-navigation');
  if (tabNavigation) tabNavigation.style.display = 'flex';
  const refreshWantsBtn = document.getElementById('refresh-wants-btn');
  if (refreshWantsBtn) {
    refreshWantsBtn.style.display = 'flex';
    refreshWantsBtn.disabled = false;
  }
  resultsGrid.style.display = 'grid';
  resultsGrid.innerHTML = '';
  
  // Render cards
  filtered.forEach(seller => {
    const card = document.createElement('div');
    card.className = 'seller-card';
    card.id = 'seller-card-' + seller.name;
    
    // Generate shipping type badge
    const shippingTypeBadge = seller.isDomestic 
      ? `<span class="badge-shipping domestic">Nacional</span>` 
      : (seller.isEUToEU ? `<span class="badge-shipping eu">UE a UE</span>` : `<span class="badge-shipping international">Internacional</span>`);
    
    const activeListings = seller.displayListings || seller.listings;
    const activeSubtotal = activeListings.reduce((sum, item) => sum + item.priceVal, 0);
    const activeShipping = calculateSellerShipping(seller, activeListings);
    const activeTotalPrice = activeSubtotal + activeShipping;

    // Generate inner listing table
    let listingsHtml = '';
    activeListings.forEach(list => {
      // Find wants info
      const wantInfo = state.wants.find(w => w.id === list.releaseId) || { title: 'Unknown Title', artist: 'Unknown Artist' };
      const isPriority = priorityIds.includes(list.releaseId);
      const starHtml = isPriority ? `<span class="priority-star-badge" title="Disco prioritario">★</span>` : '';
      const listShippingWarning = list.isShippingEstimated 
        ? `<span style="color: var(--color-amber); cursor: help; margin-left: 4px;" title="Envío no especificado por el vendedor. Tarifa de seguridad aplicada.">⚠️</span>` 
        : '';
      
      const conditionTitles = {
        'M': 'Mint (Nuevo / Impecable)',
        'NM': 'Near Mint (Casi nuevo sin marcas)',
        'VG+': 'Very Good Plus (Excelente estado con uso mínimo)',
        'VG': 'Very Good (Buen estado con marcas ligeras)',
        'G+': 'Good Plus (Estado aceptable con uso visible)',
        'G': 'Good (Usado con marcas evidentes)',
        'F': 'Fair (Muy usado)',
        'P': 'Poor (Dañado)'
      };
      const condTooltip = conditionTitles[list.mediaCondition] || 'Estado del vinilo';
      
      listingsHtml += `
        <tr>
          <td class="listing-title-cell">
            <a href="https://www.discogs.com/release/${list.releaseId}" target="_blank" class="listing-title-link">
              ${starHtml}${escapeHTML(wantInfo.title)}
            </a>
            <span class="listing-artist">${escapeHTML(wantInfo.artist)}</span>
          </td>
          <td>
            <span class="badge-condition ${list.mediaCondClass}" title="${condTooltip}">${escapeHTML(list.mediaCondition)}</span>
          </td>
          <td class="listing-price-cell">${formatPrice(list.priceVal, list.currency)}</td>
          <td class="listing-shipping-cell">+ ${formatPrice(list.shippingVal, list.currency)}${listShippingWarning} envío</td>
          <td>
            <a href="${list.listingUrl || (list.listingId ? 'https://www.discogs.com/sell/item/' + list.listingId : 'https://www.discogs.com/release/' + list.releaseId)}" target="_blank" class="btn-listing-link">Ver Oferta</a>
          </td>
        </tr>
      `;
    });
    
    const sellerShippingWarning = seller.isShippingEstimated 
      ? `<span class="shipping-estimate-warning" style="color: var(--color-amber); cursor: help; margin-left: 4px;" title="Envío no especificado por el vendedor para tu ubicación. Se aplicó tarifa internacional estimada de seguridad de $35 USD.">⚠️</span>` 
      : '';
    
    card.innerHTML = `
      <div class="seller-info-row">
        <div class="seller-meta">
          <div class="seller-name-container">
            <a href="https://www.discogs.com/seller/${escapeHTML(seller.name)}/profile" target="_blank" class="seller-name">${escapeHTML(seller.name)}</a>
            <span class="rating-badge">${seller.rating}%</span>
          </div>
          <div class="seller-location-rating">
            <span>📍 ${escapeHTML(seller.shipsFrom)}</span>
            ${shippingTypeBadge}
            <span>⭐ ${seller.ratingCount.toLocaleString()} calificaciones</span>
            <a href="https://www.discogs.com/seller/${encodeURIComponent(seller.name)}/shipping" target="_blank" class="btn-search-discogs-sm" style="font-size: 10px; padding: 2px 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; background: rgba(245, 197, 24, 0.1); border-color: rgba(245, 197, 24, 0.3); color: var(--color-amber); font-weight: 600;" title="Ver política y condiciones de envío oficiales del vendedor en Discogs">📜 Política de envío</a>
          </div>
        </div>
        
        <div class="seller-totals">
          <div class="total-group">
            <span class="total-label">Coincidencias</span>
            <span class="total-value-normal">${activeListings.length} de ${state.wants.length}</span>
          </div>
          
          <div class="total-group">
            <span class="total-label">Subtotal</span>
            <span class="total-value-normal">${formatPrice(activeSubtotal, seller.currency)}</span>
          </div>
          
          <div class="total-group" title="Envío estimado según ubicación (${seller.isDomestic ? 'Nacional' : (seller.isEUToEU ? 'UE a UE' : 'Internacional')})">
            <span class="total-label">Envío (${seller.isDomestic ? 'Nac.' : (seller.isEUToEU ? 'UE' : 'Int.')})</span>
            <span class="total-value-normal" style="color: var(--text-muted); font-weight: 500;">${formatPrice(activeShipping, seller.currency)}${sellerShippingWarning}</span>
          </div>
          
          <div class="total-group">
            <span class="total-label">Total Estimado</span>
            <span class="total-value-highlight">${formatPrice(activeTotalPrice, seller.currency)}${sellerShippingWarning}</span>
          </div>
        </div>
        
        <div class="seller-actions">
          <a href="https://www.discogs.com/seller/${seller.name}/mywants" target="_blank" class="btn-action-sm">Ver en Discogs</a>
          <button class="btn-collapse" data-seller="${seller.name}">▼</button>
        </div>
      </div>
      
      <div class="listings-details" id="details-${seller.name}">
        <table class="listings-table">
          <thead>
            <tr>
              <th>Álbum / Artista</th>
              <th>Estado</th>
              <th>Precio</th>
              <th>Envío Individual</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${listingsHtml}
          </tbody>
        </table>
      </div>
    `;
    
    resultsGrid.appendChild(card);
  });
  
  // Attach expand / collapse event listeners to cards
  document.querySelectorAll('.btn-collapse').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sName = e.currentTarget.getAttribute('data-seller');
      const detailsDiv = document.getElementById(`details-${sName}`);
      
      if (detailsDiv.classList.contains('expanded')) {
        detailsDiv.classList.remove('expanded');
        e.currentTarget.textContent = '▼';
      } else {
        detailsDiv.classList.add('expanded');
        e.currentTarget.textContent = '▲';
      }
    });
  });
}

// Wantlist Manager UI functions
function showWantlistManager() {
  emptyState.style.display = 'none';
  resultsGrid.style.display = 'none';
  noResultsState.style.display = 'none';
  wantlistManager.style.display = 'block';
  wantsSearchInput.value = '';
  
  if (refreshWantsBtn) {
    refreshWantsBtn.style.display = 'flex';
    refreshWantsBtn.disabled = false;
  }
  
  // Render list of wants
  renderWantsManagerList();
}

function renderWantsManagerList() {
  wantsListGrid.innerHTML = '';
  
  state.wants.forEach(item => {
    const card = document.createElement('div');
    card.className = `want-card ${item.isPriority ? 'priority' : ''}`;
    card.setAttribute('data-id', item.id);
    
    // Background style if image available
    const imgStyle = item.image ? `style="background-image: url('${item.image}')"` : '';
    
    card.innerHTML = `
      <span class="want-star ${item.isPriority ? 'active' : ''}">★</span>
      <div class="want-card-image" ${imgStyle}></div>
      <span class="want-card-title" title="${item.title}">${item.title}</span>
      <span class="want-card-artist" title="${item.artist}">${item.artist}</span>
    `;
    
    // Star toggle click handler
    card.querySelector('.want-star').addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid double trigger
      toggleWantPriority(item.id, card);
    });
    
    card.addEventListener('click', () => {
      toggleWantPriority(item.id, card);
    });
    
    wantsListGrid.appendChild(card);
  });
}

function toggleWantPriority(id, cardEl) {
  const item = state.wants.find(w => w.id === id);
  if (!item) return;
  
  item.isPriority = !item.isPriority;
  
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

function filterWantsInManager() {
  const query = wantsSearchInput.value.toLowerCase().trim();
  const cards = wantsListGrid.querySelectorAll('.want-card');
  
  cards.forEach(card => {
    const title = card.querySelector('.want-card-title').textContent.toLowerCase();
    const artist = card.querySelector('.want-card-artist').textContent.toLowerCase();
    
    if (title.includes(query) || artist.includes(query)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// Onboarding Wizard step navigation
function goToWizardStep(stepNum) {
  // Hide all panes
  document.querySelectorAll('.wizard-step-pane').forEach(pane => {
    pane.classList.remove('active');
    pane.style.display = 'none';
  });
  
  // Show target pane
  const targetPane = document.getElementById(`step-pane-${stepNum}`);
  if (targetPane) {
    targetPane.classList.add('active');
    targetPane.style.display = 'flex';
  }
  
  // Update indicator dots styling
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) {
      if (i < stepNum) {
        dot.classList.add('completed');
        dot.classList.remove('active');
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
    log(`Usuario '${username}' configurado manualmente desde el onboarding.`, 'success');
    goToWizardStep(2); // Auto advance to Step 2
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

// Switch between Sellers and Statistics tabs
function switchTab(tabName) {
  const tabBtnSellers = document.getElementById('tab-btn-sellers');
  const tabBtnStats = document.getElementById('tab-btn-stats');
  const resultsGrid = document.getElementById('results-grid');
  const smartCard = document.getElementById('smart-purchase-card');
  const statsView = document.getElementById('stats-view');
  
  if (!tabBtnSellers || !tabBtnStats) return;
  
  if (tabName === 'sellers') {
    tabBtnSellers.classList.add('active');
    tabBtnStats.classList.remove('active');
    resultsGrid.style.display = 'grid';
    if (smartCard && smartCard.innerHTML.trim() !== '') {
      smartCard.style.display = 'block';
    }
    statsView.style.display = 'none';
  } else {
    tabBtnSellers.classList.remove('active');
    tabBtnStats.classList.add('active');
    resultsGrid.style.display = 'none';
    smartCard.style.display = 'none';
    statsView.style.display = 'flex';
    calculateAndRenderStats();
    enrichWantlistStats();
  }
}

// Background helper to enrich community stats (wantCount / haveCount) for all wants directly from Discogs API
async function enrichWantlistStats() {
  if (!state.wants || state.wants.length === 0) return;
  const itemsToFetch = state.wants.filter(w => !w._statsEnriched);
  if (itemsToFetch.length === 0) return;

  console.log(`[StatsEnrich 🚀] Enriqueciendo estadísticas reales para ${itemsToFetch.length} vinilos...`);

  const BATCH_SIZE = 4;
  for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE) {
    if (state.isScanning) {
      await new Promise(r => setTimeout(r, 1000));
    }
    const chunk = itemsToFetch.slice(i, i + BATCH_SIZE);
    let updated = false;

    await Promise.all(chunk.map(async (item) => {
      try {
        const jsonText = await fetchDirect(`https://api.discogs.com/releases/${item.id}`);
        const data = JSON.parse(jsonText);
        if (data && data.community) {
          if (typeof data.community.want === 'number') item.wantCount = data.community.want;
          if (typeof data.community.have === 'number') item.haveCount = data.community.have;
          item._statsEnriched = true;
          updated = true;
        }
      } catch (err) {
        item._statsEnriched = true;
      }
    }));

    if (updated) {
      calculateAndRenderStats();
    }
    await new Promise(r => setTimeout(r, 250));
  }
}

// Calculate and render all wantlist & marketplace statistics
function calculateAndRenderStats() {
  const statsView = document.getElementById('stats-view');
  if (!statsView) return;
  
  const totalWantsCount = state.wants.length;
  
  // Find releases that are actually for sale (have at least one match)
  const wantsForSale = state.wants.filter(w => 
    state.allListings.some(l => l.releaseId === w.id)
  );
  
  // Find releases not for sale (0 matches)
  const wantsNotForSale = state.wants.filter(w => 
    !state.allListings.some(l => l.releaseId === w.id)
  );
  
  // For each release in Wantlist with at least one listing, find its CHEAPEST entry copy (fair comparison in USD)
  const releaseEntryPrices = [];
  
  state.wants.forEach(w => {
    const listingsForRelease = state.allListings.filter(l => l.releaseId === w.id && l.priceVal > 0);
    if (listingsForRelease.length > 0) {
      let cheapestListing = null;
      let cheapestUSD = Infinity;
      
      listingsForRelease.forEach(l => {
        let rate = CURRENCY_MAP[l.currency]?.rate || 1.0;
        let priceVal = l.priceVal;
        
        // Auto-heal small JPY values from legacy cache (e.g. 3.92 JPY -> $3.92 USD) so they aren't treated as $0.02 USD
        if (l.currency === 'JPY' && priceVal < 100) {
          rate = 1.0;
        }
        
        const priceUSD = priceVal * rate;
        if (priceUSD < cheapestUSD) {
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
  
  // Find community wants metrics
  const wantsWithStats = state.wants.filter(w => w.wantCount !== undefined && w.wantCount !== null && w.wantCount > 0);
  
  // Diagnostic logger for DevTools console
  const alpyren = state.wants.find(w => w.id === 32241999 || (w.title && w.title.toLowerCase().includes('musique de niche')));
  if (alpyren) {
    console.log(`%c[DIAGNOSTICO DIGGERS 🔍] Alpyren (ID: ${alpyren.id}): title="${alpyren.title}", wantCount=${alpyren.wantCount}, haveCount=${alpyren.haveCount}`, 'color: #a855f7; font-weight: bold; font-size: 13px;');
  }
  console.log(`[DIAGNOSTICO DIGGERS 📊] Total vinilos con stats: ${wantsWithStats.length} de ${state.wants.length}`);
  
  let top5MostWanted = [];
  let top5LeastWanted = [];
  
  if (wantsWithStats.length > 0) {
    // Sort descending for most wanted
    top5MostWanted = [...wantsWithStats]
      .sort((a, b) => b.wantCount - a.wantCount)
      .slice(0, 5);

    // Sort ascending for least wanted
    top5LeastWanted = [...wantsWithStats]
      .sort((a, b) => a.wantCount - b.wantCount)
      .slice(0, 5);
  }
  
  // Render Cheapest html list
  let cheapestListHtml = '';
  if (top5Cheapest.length > 0) {
    top5Cheapest.forEach((x, idx) => {
      const l = x.listing;
      const w = x.want || state.wants.find(item => item.id === l.releaseId) || { title: 'Unknown', artist: 'Unknown', image: '' };
      cheapestListHtml += `
        <div class="stats-album-layout" style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 10px; min-height: auto; display: flex; align-items: center; justify-content: space-between;">
          <div class="stats-album-cover" style="background-image: url('${w.image || ''}'); width: 44px; height: 44px; flex-shrink: 0; background-size: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);"></div>
          <div class="stats-album-info" style="margin-left: 12px; flex: 1; min-width: 0; text-align: left;">
            <span style="font-size: 12px; font-weight: 700; color: #fff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(w.title)}">${idx + 1}. ${escapeHTML(w.title)}</span>
            <span style="font-size: 10px; color: var(--text-muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(w.artist)}">${escapeHTML(w.artist)}</span>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 3px; flex-wrap: wrap; gap: 4px;">
              <span class="stats-price-highlight" style="font-size: 11px; font-weight: 800; color: var(--color-green);">${formatPrice(l.priceVal, l.currency)}</span>
              <span style="font-size: 9px; color: var(--text-dim);">👤 ${escapeHTML(l.sellerName)} (📍 ${escapeHTML(l.shipsFrom)})</span>
              <a href="${l.listingUrl || (l.listingId ? 'https://www.discogs.com/sell/item/' + l.listingId : 'https://www.discogs.com/release/' + l.releaseId)}" target="_blank" class="btn-search-discogs-sm" style="font-size: 9px; padding: 2px 6px; margin: 0; width: fit-content; text-align: center;">Ver Oferta</a>
            </div>
          </div>
        </div>
      `;
    });
  } else {
    cheapestListHtml = `<p style="font-size: 12px; color: var(--text-muted); padding: 10px 0;">No se encontraron ofertas para calcular precios.</p>`;
  }

  // Render Expensive html list
  let expensiveListHtml = '';
  if (top5Expensive.length > 0) {
    top5Expensive.forEach((x, idx) => {
      const l = x.listing;
      const w = x.want || state.wants.find(item => item.id === l.releaseId) || { title: 'Unknown', artist: 'Unknown', image: '' };
      expensiveListHtml += `
        <div class="stats-album-layout" style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 10px; min-height: auto; display: flex; align-items: center; justify-content: space-between;">
          <div class="stats-album-cover" style="background-image: url('${w.image || ''}'); width: 44px; height: 44px; flex-shrink: 0; background-size: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);"></div>
          <div class="stats-album-info" style="margin-left: 12px; flex: 1; min-width: 0; text-align: left;">
            <span style="font-size: 12px; font-weight: 700; color: #fff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(w.title)}">${idx + 1}. ${escapeHTML(w.title)}</span>
            <span style="font-size: 10px; color: var(--text-muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(w.artist)}">${escapeHTML(w.artist)}</span>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 3px; flex-wrap: wrap; gap: 4px;">
              <span class="stats-price-highlight" style="font-size: 11px; font-weight: 800; color: #c084fc;">${formatPrice(l.priceVal, l.currency)}</span>
              <span style="font-size: 9px; color: var(--text-dim);">👤 ${escapeHTML(l.sellerName)} (📍 ${escapeHTML(l.shipsFrom)})</span>
              <a href="${l.listingUrl || (l.listingId ? 'https://www.discogs.com/sell/item/' + l.listingId : 'https://www.discogs.com/release/' + l.releaseId)}" target="_blank" class="btn-search-discogs-sm" style="font-size: 9px; padding: 2px 6px; margin: 0; width: fit-content; text-align: center; background: rgba(192, 132, 252, 0.1); border-color: rgba(192, 132, 252, 0.3); color: #c084fc;">Ver Oferta</a>
            </div>
          </div>
        </div>
      `;
    });
  } else {
    expensiveListHtml = `<p style="font-size: 12px; color: var(--text-muted); padding: 10px 0;">No se encontraron ofertas para calcular precios.</p>`;
  }

  // Render Popularity html list
  let popularityListHtml = '';
  if (wantsWithStats.length > 0) {
    let mostWantedHtml = '';
    top5MostWanted.forEach((w, idx) => {
      mostWantedHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; margin-bottom: 6px; border: 1px solid rgba(255,255,255,0.03); text-align: left;">
          <div style="min-width: 0; flex: 1; margin-right: 8px;">
            <a href="https://www.discogs.com/release/${w.id}" target="_blank" style="color: #fff; font-size: 12px; font-weight: 700; text-decoration: underline; text-decoration-color: rgba(255,255,255,0.3); text-underline-offset: 2px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;" title="Abrir edición en Discogs (ID: ${w.id})">
              ${idx + 1}. ${escapeHTML(w.title)} 🔗
            </a>
            <span style="font-size: 10px; color: var(--text-muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(w.artist)}">${escapeHTML(w.artist)}</span>
          </div>
          <a href="https://www.discogs.com/release/${w.id}" target="_blank" style="text-decoration: none;" title="Ver en Discogs">
            <strong style="color: var(--color-amber); font-size: 11px; flex-shrink: 0; cursor: pointer;">${w.wantCount.toLocaleString()} wants ↗</strong>
          </a>
        </div>
      `;
    });

    let leastWantedHtml = '';
    top5LeastWanted.forEach((w, idx) => {
      leastWantedHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; margin-bottom: 6px; border: 1px solid rgba(255,255,255,0.03); text-align: left;">
          <div style="min-width: 0; flex: 1; margin-right: 8px;">
            <a href="https://www.discogs.com/release/${w.id}" target="_blank" style="color: #fff; font-size: 12px; font-weight: 700; text-decoration: underline; text-decoration-color: rgba(255,255,255,0.3); text-underline-offset: 2px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;" title="Abrir edición en Discogs (ID: ${w.id})">
              ${idx + 1}. ${escapeHTML(w.title)} 🔗
            </a>
            <span style="font-size: 10px; color: var(--text-muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(w.artist)}">${escapeHTML(w.artist)}</span>
          </div>
          <a href="https://www.discogs.com/release/${w.id}" target="_blank" style="text-decoration: none;" title="Ver en Discogs">
            <strong style="color: #a855f7; font-size: 11px; flex-shrink: 0; cursor: pointer;">${w.wantCount.toLocaleString()} wants ↗</strong>
          </a>
        </div>
      `;
    });

    popularityListHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <span style="font-size: 9px; color: var(--color-amber); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 6px; text-align: left;">🔥 EL TOP 5 MÁS DESEADO DE TU LISTA</span>
          ${mostWantedHtml}
        </div>
        
        <div>
          <span style="font-size: 9px; color: #a855f7; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 6px; text-align: left;">❄️ EL TOP 5 MENOS QUERIDO / RAREZA OSCURA</span>
          ${leastWantedHtml}
        </div>
      </div>
    `;
  } else {
    popularityListHtml = `
      <p style="font-size: 12px; color: var(--text-muted); margin: 10px 0; line-height: 1.4; text-align: left;">
        ⚠️ <strong>Datos de popularidad de comunidad no disponibles.</strong><br>
        Esto ocurre porque la lista se cargó por raspado web (no API) o no hay conectividad. Intente loguearse en Discogs para cargarla mediante API.
      </p>
    `;
  }
  
  // Render layout
  let html = `
    <!-- Top metrics bar -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 8px;">
      <div class="stats-card-rich" style="padding: 16px; min-height: auto;">
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Discos a la venta</span>
        <span style="font-size: 26px; font-weight: 800; color: var(--color-green); margin-top: 6px;">${wantsForSale.length} / ${totalWantsCount}</span>
        <span style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Disponibles para comprar hoy</span>
      </div>
      
      <div class="stats-card-rich" style="padding: 16px; min-height: auto;">
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Agotados en Discogs</span>
        <span style="font-size: 26px; font-weight: 800; color: #ef4444; margin-top: 6px;">${wantsNotForSale.length}</span>
        <span style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Sin copias listadas en venta</span>
      </div>
      
      <div class="stats-card-rich" style="padding: 16px; min-height: auto;">
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total de ofertas</span>
        <span style="font-size: 26px; font-weight: 800; color: var(--color-purple); margin-top: 6px;">${state.allListings.length}</span>
        <span style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Copias raspadas del marketplace</span>
      </div>
    </div>
    
    <div class="stats-grid">
      <!-- COLUMN 1: PRICE EXTREMES & POPULARITY -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- CHEAPEST VINYL -->
        <div class="stats-card-rich">
          <div class="stats-card-badge" style="background: rgba(16, 185, 129, 0.15); color: var(--color-green);">El más barato</div>
          <h3 style="text-align: left; margin-bottom: 16px;">💰 Más Económico (Top 5)</h3>
          ${cheapestListHtml}
        </div>
        
        <!-- MOST EXPENSIVE VINYL -->
        <div class="stats-card-rich">
          <div class="stats-card-badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">El más costoso</div>
          <h3 style="text-align: left; margin-bottom: 16px;">💎 Objeto de Lujo (Top 5)</h3>
          ${expensiveListHtml}
        </div>
        
        <!-- COMMUNITY POPULARITY -->
        <div class="stats-card-rich">
          <h3 style="text-align: left; margin-bottom: 16px;">📈 Preferencias de Diggers</h3>
          ${popularityListHtml}
        </div>
      </div>
      
      <!-- COLUMN 2: NOT FOR SALE (AGOTADOS) -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="stats-card-rich" style="flex-grow: 1;">
          <h3 style="text-align: left;">⚠️ Discos sin stock (Agotados en venta)</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin: -10px 0 12px 0; line-height: 1.4; text-align: left;">
            Estos vinilos de tu lista de deseos no disponen de copias publicadas actualmente en el Marketplace de Discogs.
          </p>
          
          <div class="not-for-sale-list">
            ${wantsNotForSale.length > 0 ? wantsNotForSale.map(w => `
              <div class="not-for-sale-row">
                <div class="not-for-sale-info">
                  <div class="not-for-sale-cover" style="background-image: url('${w.image || ''}')">
                    ${!w.image ? `<span style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 100%;">💿</span>` : ''}
                  </div>
                  <div class="not-for-sale-text" style="text-align: left;">
                    <span class="not-for-sale-title" title="${escapeHTML(w.title)}">${escapeHTML(w.title)}</span>
                    <span class="not-for-sale-artist" title="${escapeHTML(w.artist)}">${escapeHTML(w.artist)}</span>
                  </div>
                </div>
                <a href="https://www.discogs.com/sell/list?release_id=${w.id}" target="_blank" class="btn-search-discogs-sm">Ver en Discogs</a>
              </div>
            `).join('') : `
              <p style="font-size: 13px; color: var(--text-muted); padding: 30px; text-align: center;">
                🎉 ¡Excelente! Todos los discos de tu lista tienen al menos una copia en venta hoy.
              </p>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
  
  statsView.innerHTML = html;
}
