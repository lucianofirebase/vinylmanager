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
  'UYU': { symbol: '$', code: 'UYU', rate: 0.025 },
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

function formatPrice(val, currencyCode) {
  const info = CURRENCY_MAP[currencyCode] || { symbol: '$', code: currencyCode || 'USD' };
  return `${info.code} ${info.symbol}${val.toFixed(2)}`;
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
const filterMinMatches = document.getElementById('filter-min-matches');
const filterCountry = document.getElementById('filter-country');
const filterRating = document.getElementById('filter-rating');
const sortBy = document.getElementById('sort-by');
const filterPriorityOnly = document.getElementById('filter-priority-only');

// Add Event Listeners on Load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
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
  wizardNext1Btn.addEventListener('click', () => goToWizardStep(2));
  wizardNext2Btn.addEventListener('click', () => goToWizardStep(3));
  wizardBack2Btn.addEventListener('click', () => goToWizardStep(1));
  wizardBack3Btn.addEventListener('click', () => goToWizardStep(2));
  wizardSyncBtn.addEventListener('click', loadWantlist);
  wizardSaveUsernameBtn.addEventListener('click', saveWizardManualUsername);
  
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


  filterMinMatches.addEventListener('change', renderResults);
  filterCountry.addEventListener('change', renderResults);
  filterRating.addEventListener('change', renderResults);
  sortBy.addEventListener('change', renderResults);
  filterPriorityOnly.addEventListener('change', renderResults);
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

// Dynamic lock/unlock filters section
function toggleFiltersState(enabled) {
  filterMinMatches.disabled = !enabled;
  filterCountry.disabled = !enabled;
  filterRating.disabled = !enabled;
  sortBy.disabled = !enabled;
  filterPriorityOnly.disabled = !enabled;
  
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

// Initialize Application and detect user session
async function initApp() {
  log('Iniciando Discogs Wishlist Matcher...');
  
  // Lock filters initially until results exist
  toggleFiltersState(false);
  
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
  connectionStatus.textContent = 'Sesión no detectada';
  connectionStatus.style.color = '#ef4444';
  usernameDisplay.textContent = 'Invitado';
  userAvatar.textContent = '?';
  userAvatar.style.background = '#374151';
  inputFallback.style.display = 'block';
  
  // Try retrieving from local storage
  const saved = localStorage.getItem('discogs_username');
  if (saved) {
    manualUsername.value = saved;
    if (wizardManualUsername) {
      wizardManualUsername.value = saved;
    }
  }
  
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
  console.log(`[DirectFetch] Iniciando fetch directo para URL: ${url}`);
  try {
    const response = await fetch(url);
    console.log(`[DirectFetch] Status respuesta: ${response.status} para URL: ${url}`);
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
}

// Fetch helper using the content script proxy to bypass Cloudflare
async function fetchThroughTab(url) {
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
          setTimeout(() => {
            console.log(`[ProxyFetch] Nueva pestaña proxy creada (ID: ${tab.id})`);
            resolve(tab);
          }, 3500);
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
        
        const jsonText = await fetchDirect(`https://api.discogs.com/users/${state.username}/wants?page=${page}&per_page=100`);
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
        
        const html = await fetchThroughTab(`https://www.discogs.com/wantlist?user=${state.username}&limit=250&page=${page}`);
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
    alert(`No pudimos cargar la Wantlist. Detalle: ${error.message}`);
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
  let rows = doc.querySelectorAll('.shortcut_navigable, tr.shortcut_navigable, tr');
  
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
    }
    
    // Check if we can get the cover image
    const img = row.querySelector('img[data-src], img[src]');
    let image = '';
    if (img) {
      image = img.getAttribute('data-src') || img.getAttribute('src') || '';
    }
    
    wants.push({
      id,
        title,
      artist,
      year: '',
      image,
      wantCount: null,
      haveCount: null
    });
  });
  
  return wants;
}

// Step 2: Scan Single Release (Utility)
async function scanSingleRelease(item, index, totalWants) {
  const buyerCountryVal = (buyerCountry ? buyerCountry.value : 'Uruguay').trim().toLowerCase();
  const progress = Math.round(((index + 1) / totalWants) * 100);
  
  // Update UI Progress
  statusTitle.textContent = `Escaneando disco ${index + 1} de ${totalWants}`;
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
      
      if (cacheData) {
        const now = Date.now();
        cacheAgeHours = (now - cacheData.timestamp) / (1000 * 60 * 60);
        if (cacheAgeHours < 24) {
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
    log(`[Caché] Cargadas ${parsedListings.length} copias en venta para este disco (guardado hace ${Math.round(cacheAgeHours * 10) / 10}h).`, 'success');
    return { listings: parsedListings, communityStats: communityStats, isFromCache: true };
  }
  
  log(`Escaneando (${index + 1}/${totalWants}): ${item.artist} - ${item.title}...`);
  
  try {
    const url = `https://www.discogs.com/sell/release/${item.id}?limit=100`;
    const html = await fetchThroughTab(url);
    const result = parseReleaseHTML(html, item.id);
    parsedListings = result.listings;
    communityStats = result.communityStats;
    
    log(`Encontradas ${parsedListings.length} copias en venta para este disco.`);
    
    // Save to cache
    if (useCacheCheckbox && useCacheCheckbox.checked && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const cacheKey = `release_${item.id}_${buyerCountryVal}`;
        const cacheVal = {
          timestamp: Date.now(),
          listings: parsedListings,
          communityStats: communityStats
        };
        chrome.storage.local.set({ [cacheKey]: cacheVal });
      } catch (cacheErr) {
        console.warn('Error saving to cache:', cacheErr);
      }
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
  
  try {
    for (let i = startIndex; i < state.wants.length; i++) {
      if (state.cancelRequested) {
        log('Escaneo cancelado por el usuario.', 'error');
        break;
      }
      
      const item = state.wants[i];
      const result = await scanSingleRelease(item, i, state.wants.length);
      state.allListings.push(...result.listings);
      
      // Update community stats on the want item!
      if (result.communityStats) {
        if (result.communityStats.wantCount !== null) item.wantCount = result.communityStats.wantCount;
        if (result.communityStats.haveCount !== null) item.haveCount = result.communityStats.haveCount;
      }
      
      // Update stats on-the-fly
      const uniqueSellers = new Set(state.allListings.map(l => l.sellerName));
      metricSellersCount.textContent = uniqueSellers.size;
      metricMatchesCount.textContent = state.allListings.length;
      
      // Save scan session progress
      saveScanSession(i);
      
      // Skip fetch and delay when using cached data
      if (!result.isFromCache) {
        await new Promise(resolve => setTimeout(resolve, 1200));
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
      
      for (let i = 0; i < newlyAddedWants.length; i++) {
        if (state.cancelRequested) {
          log('Actualización incremental cancelada por el usuario.', 'error');
          break;
        }
        
        const item = newlyAddedWants[i];
        const result = await scanSingleRelease(item, i, newlyAddedWants.length);
        state.allListings.push(...result.listings);
        
        // Update community stats on the want item!
        if (result.communityStats) {
          if (result.communityStats.wantCount !== null) item.wantCount = result.communityStats.wantCount;
          if (result.communityStats.haveCount !== null) item.haveCount = result.communityStats.haveCount;
        }
        
        const uniqueSellers = new Set(state.allListings.map(l => l.sellerName));
        metricSellersCount.textContent = uniqueSellers.size;
        metricMatchesCount.textContent = state.allListings.length;
        
        if (!result.isFromCache) {
          await new Promise(resolve => setTimeout(resolve, 1200));
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


// Cancel current scan
function cancelScan() {
  state.cancelRequested = true;
  cancelScanBtn.textContent = 'Cancelando...';
  log('Solicitando cancelación del escaneo...');
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
    const haveEl = doc.querySelector('a[href*="#collection"]');
    if (haveEl) {
      const num = parseInt(haveEl.textContent.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num)) haveCount = num;
    }
    
    const wantEl = doc.querySelector('a[href*="#wantlist"]');
    if (wantEl) {
      const num = parseInt(wantEl.textContent.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num)) wantCount = num;
    }
    
    if (haveCount === null || wantCount === null) {
      // Fallback: search anywhere in body text for "lo tienen: X" or "lo quieren: Y" or English equivalents
      const bodyText = doc.body ? doc.body.textContent : '';
      
      const haveMatch = bodyText.match(/(?:lo tienen|have|haves|haben|possèdent)\s*:\s*([\d.,\s]+)/i);
      if (haveMatch) {
        const num = parseInt(haveMatch[1].replace(/[^\d]/g, ''), 10);
        if (!isNaN(num)) haveCount = num;
      }
      
      const wantMatch = bodyText.match(/(?:lo quieren|want|wants|wollen|veulent)\s*:\s*([\d.,\s]+)/i);
      if (wantMatch) {
        const num = parseInt(wantMatch[1].replace(/[^\d]/g, ''), 10);
        if (!isNaN(num)) wantCount = num;
      }
    }
  } catch (err) {
    console.warn('Error parsing community stats:', err);
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
      let priceText = priceEl ? priceEl.textContent.trim() : '';
      let priceVal = 0;
      let currency = 'USD';
      let source = 'original';
      
      const priceValAttr = priceEl?.getAttribute('data-pricevalue');
      if (priceValAttr) {
        source = 'data-pricevalue';
        priceVal = parseFloat(priceValAttr) || 0;
      } else if (priceText) {
        source = 'price_element_text';
        const cleanText = priceText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible)/i)[0].trim();
        const cleanPrice = cleanText.replace(/[^\d.,]/g, '');
        let numStr = cleanPrice;
        if (cleanPrice.includes(',') && !cleanPrice.includes('.')) {
          numStr = cleanPrice.replace(',', '.');
        } else if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
          numStr = cleanPrice.replace(/,/g, '');
        }
        priceVal = parseFloat(numStr) || 0;
      }
      
      // Detect the original currency code from the original price text
      if (priceText.includes('€')) currency = 'EUR';
      else if (priceText.includes('£')) currency = 'GBP';
      else if (priceText.includes('¥')) currency = 'JPY';
      else if (priceText.includes('A$')) currency = 'AUD';
      else if (priceText.includes('CA$') || priceText.includes('C$')) currency = 'CAD';
      else if (priceText.includes('NZ$')) currency = 'NZD';
      else if (priceText.includes('R$')) currency = 'BRL';
      else if (priceText.includes('Mex$')) currency = 'MXN';
      else {
        const isoMatch = priceText.match(/\b(UYU|ARS|CLP|COP|MXN|BRL|NZD|ZAR|CHF|SEK|NOK|DKK|USD|EUR|GBP|CAD|AUD|JPY)\b/i);
        if (isoMatch) {
          currency = isoMatch[1].toUpperCase();
        } else if (priceText.includes('$')) {
          currency = 'USD';
        } else {
          currency = 'USD'; // default fallback
        }
      }
      
      // 5. Shipping (Parse original shipping cost to match the original currency of the price)
      const shippingEl = row.querySelector('.item_shipping, .shipping');
      let shippingText = shippingEl ? shippingEl.textContent.trim() : '';
      let shippingVal = 0;
      let rawShippingText = shippingText;
      
      if (shippingText) {
        // We split by parenthesis first to avoid parsing the converted parentheses value
        const cleanText = shippingText.split(/\(|(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible)/i)[0].trim();
        const cleanShipping = cleanText.replace(/[^\d.,]/g, '');
        let numStr = cleanShipping;
        if (cleanShipping.includes(',') && !cleanShipping.includes('.')) {
          numStr = cleanShipping.replace(',', '.');
        } else if (cleanShipping.includes(',') && cleanShipping.includes('.')) {
          numStr = cleanShipping.replace(/,/g, '');
        }
        shippingVal = parseFloat(numStr) || 0;
      }

      // Detailed price and shipping logs to the console as requested by the user
      console.log(
        `%c[Precio & Envío Log]%c\n` +
        `• Release: ${releaseId}\n` +
        `• Vendedor: ${sellerName}\n` +
        `• Origen Precio: ${source}\n` +
        `• Texto Precio Original: "${priceText}"\n` +
        `• Valor de Precio Parseado: ${priceVal}\n` +
        `• Moneda Detectada: "${currency}"\n` +
        `• Texto Envío Original: "${rawShippingText}"\n` +
        `• Valor de Envío Parseado: ${shippingVal}`,
        'color: #9f7aea; font-weight: bold;', 'color: #fff;'
      );
      
      // 6. Condition
      const conditionEl = row.querySelector('.item_condition, .condition');
      let mediaCondition = 'VG+';
      let sleeveCondition = 'VG';
      
      if (conditionEl) {
        const text = conditionEl.textContent.trim();
        const grades = text.match(/\b(M|NM|VG\+|VG|G\+|G|F|P)\b/g);
        if (grades && grades.length > 0) {
          mediaCondition = grades[0];
          if (grades.length > 1) sleeveCondition = grades[1];
        } else {
          if (text.includes('Near Mint')) mediaCondition = 'NM';
          else if (text.includes('Mint')) mediaCondition = 'M';
          else if (text.includes('Very Good Plus')) mediaCondition = 'VG+';
          else if (text.includes('Very Good')) mediaCondition = 'VG';
          else if (text.includes('Good Plus')) mediaCondition = 'G+';
          else if (text.includes('Good')) mediaCondition = 'G';
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
    communityStats: { haveCount, wantCount }
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
    
    // Apply shipping base & increments depending on location (values in USD)
    let baseShippingPrice = 6.00;
    let extraItemCost = 1.50;
    
    if (isDomestic) {
      baseShippingPrice = 4.50;
      extraItemCost = 1.00;
    } else if (isEUToEU) {
      baseShippingPrice = 9.50;
      extraItemCost = 2.00;
    } else {
      // International shipping (e.g. Europe/USA to Uruguay)
      baseShippingPrice = 24.00;
      extraItemCost = 3.50;
    }

    // Convert estimated rates from USD to seller's currency
    const currencyInfo = CURRENCY_MAP[seller.currency] || { rate: 1.0 };
    const conversionFactor = 1.0 / currencyInfo.rate;
    baseShippingPrice = baseShippingPrice * conversionFactor;
    extraItemCost = extraItemCost * conversionFactor;
    
    // Check if we parsed actual shipping costs from listings
    const shippingValues = seller.listings.map(l => l.shippingVal).filter(v => v > 0);
    let estimatedShipping = 0;
    
    if (shippingValues.length > 0) {
      const maxShipping = Math.max(...shippingValues);
      estimatedShipping = maxShipping + (listCount - 1) * extraItemCost;
    } else {
      // Fallback to estimated base shipping
      estimatedShipping = baseShippingPrice + (listCount - 1) * extraItemCost;
    }
    
    const totalPrice = subtotal + estimatedShipping;
    
    return {
      ...seller,
      matchCount: listCount,
      subtotal: parseFloat(subtotal.toFixed(2)),
      estimatedShipping: parseFloat(estimatedShipping.toFixed(2)),
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      isDomestic,
      isEUToEU
    };
  });
  
  console.log('Grouped sellers with location-based shipping:', state.groupedSellers);
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
          const listCount = assignedListings.length;
          const isDomestic = s.isDomestic;
          const isEUToEU = s.isEUToEU;
          
          let baseShippingPrice = 6.00;
          let extraItemCost = 1.50;
          
          if (isDomestic) {
            baseShippingPrice = 4.50;
            extraItemCost = 1.00;
          } else if (isEUToEU) {
            baseShippingPrice = 9.50;
            extraItemCost = 2.00;
          } else {
            baseShippingPrice = 24.00;
            extraItemCost = 3.50;
          }
          
          const shippingValues = assignedListings.map(l => l.shippingVal).filter(v => v > 0);
          let estimatedShipping = 0;
          if (shippingValues.length > 0) {
            const maxShipping = Math.max(...shippingValues);
            estimatedShipping = maxShipping + (listCount - 1) * extraItemCost;
          } else {
            estimatedShipping = baseShippingPrice + (listCount - 1) * extraItemCost;
          }
          
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
          <span class="smart-album-title" title="${wantInfo.title} - ${wantInfo.artist}">💿 ${wantInfo.title}</span>
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
            <span style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;" title="${seller.name}">${seller.name}</span>
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
              <span>📍 ${seller.shipsFrom} • ⭐ ${seller.rating}% pos.</span>
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
              <a href="#" class="btn-action-sm smart-option-seller-name" data-scroll-to="${seller.name}" style="margin-top: 8px; display: block; text-align: center; text-decoration: none; padding: 6px; font-size: 10px;">
                Ver detalles y WhatsApp ↓
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
  
  // Priority items filtering setup
  const priorityIds = state.wants.filter(w => w.isPriority).map(w => w.id);
  const priorityFilterActive = filterPriorityOnly.checked && priorityIds.length > 0;
  
  // Filter list
  let filtered = state.groupedSellers.filter(seller => {
    // 1. Matches limit
    if (seller.matchCount < minMatches) return false;
    
    // 2. Rating limit
    if (seller.rating < minRating) return false;
    
    // 3. Country filter
    if (countryFilter !== 'all') {
      const loc = seller.shipsFrom.toLowerCase();
      if (countryFilter === 'Europe') {
        const euroCountries = ['spain', 'germany', 'france', 'italy', 'united kingdom', 'uk', 'netherlands', 'belgium', 'austria', 'switzerland', 'sweden', 'norway', 'portugal', 'greece', 'poland', 'ireland'];
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
      }
    }
    
    // 4. Priority items filter
    if (priorityFilterActive) {
      const hasPriorityItem = seller.listings.some(l => priorityIds.includes(l.releaseId));
      if (!hasPriorityItem) return false;
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
    
    // Generate inner listing table
    let listingsHtml = '';
    seller.listings.forEach(list => {
      // Find wants info
      const wantInfo = state.wants.find(w => w.id === list.releaseId) || { title: 'Unknown Title', artist: 'Unknown Artist' };
      const isPriority = priorityIds.includes(list.releaseId);
      const starHtml = isPriority ? `<span class="priority-star-badge" title="Disco prioritario">★</span>` : '';
      
      listingsHtml += `
        <tr>
          <td class="listing-title-cell">
            <a href="https://www.discogs.com/release/${list.releaseId}" target="_blank" class="listing-title-link">
              ${starHtml}${wantInfo.title}
            </a>
            <span class="listing-artist">${wantInfo.artist}</span>
          </td>
          <td>
            <span class="badge-condition ${list.mediaCondClass}">${list.mediaCondition}</span>
          </td>
          <td class="listing-price-cell">${formatPrice(list.priceVal, list.currency)}</td>
          <td class="listing-shipping-cell">+ ${formatPrice(list.shippingVal, list.currency)} envío</td>
          <td>
            <a href="${list.listingUrl || (list.listingId ? 'https://www.discogs.com/sell/item/' + list.listingId : 'https://www.discogs.com/release/' + list.releaseId)}" target="_blank" class="btn-listing-link">Ver Oferta</a>
          </td>
        </tr>
      `;
    });
    
    card.innerHTML = `
      <div class="seller-info-row">
        <div class="seller-meta">
          <div class="seller-name-container">
            <a href="https://www.discogs.com/seller/${seller.name}/profile" target="_blank" class="seller-name">${seller.name}</a>
            <span class="rating-badge">${seller.rating}%</span>
          </div>
          <div class="seller-location-rating">
            <span>📍 ${seller.shipsFrom}</span>
            ${shippingTypeBadge}
            <span>⭐ ${seller.ratingCount.toLocaleString()} calificaciones</span>
          </div>
        </div>
        
        <div class="seller-totals">
          <div class="total-group">
            <span class="total-label">Coincidencias</span>
            <span class="total-value-normal">${seller.matchCount} de ${state.wants.length}</span>
          </div>
          
          <div class="total-group">
            <span class="total-label">Subtotal</span>
            <span class="total-value-normal">${formatPrice(seller.subtotal, seller.currency)}</span>
          </div>
          
          <div class="total-group" title="Envío estimado según ubicación (${seller.isDomestic ? 'Nacional' : (seller.isEUToEU ? 'UE a UE' : 'Internacional')})">
            <span class="total-label">Envío (${seller.isDomestic ? 'Nac.' : (seller.isEUToEU ? 'UE' : 'Int.')})</span>
            <span class="total-value-normal" style="color: var(--text-muted); font-weight: 500;">${formatPrice(seller.estimatedShipping, seller.currency)}</span>
          </div>
          
          <div class="total-group">
            <span class="total-label">Total Estimado</span>
            <span class="total-value-highlight">${formatPrice(seller.totalPrice, seller.currency)}</span>
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

// Clear the storage-based scan cache
async function clearScanCache() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(k => k.startsWith('release_'));
      if (keysToRemove.length === 0) {
        log('La caché de escaneo ya está vacía.', 'info');
        alert('La caché de escaneo ya está vacía.');
        return;
      }
      chrome.storage.local.remove(keysToRemove, () => {
        log(`Caché de escaneo limpiada con éxito (${keysToRemove.length} elementos eliminados).`, 'success');
        alert(`¡Caché de escaneo limpiada con éxito!\nSe eliminaron ${keysToRemove.length} discos guardados.`);
      });
    });
  } else {
    alert('La API de almacenamiento local no está disponible en este entorno.');
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
  
  // Find cheapest and most expensive copies (fair comparison in USD)
  let cheapestListing = null;
  let cheapestUSD = Infinity;
  
  let expensiveListing = null;
  let expensiveUSD = -1;
  
  state.allListings.forEach(l => {
    const rate = CURRENCY_MAP[l.currency]?.rate || 1.0;
    const priceUSD = l.priceVal * rate;
    
    if (priceUSD < cheapestUSD && l.priceVal > 0) {
      cheapestUSD = priceUSD;
      cheapestListing = l;
    }
    if (priceUSD > expensiveUSD && l.priceVal > 0) {
      expensiveUSD = priceUSD;
      expensiveListing = l;
    }
  });
  
  const cheapestWant = cheapestListing ? state.wants.find(w => w.id === cheapestListing.releaseId) : null;
  const expensiveWant = expensiveListing ? state.wants.find(w => w.id === expensiveListing.releaseId) : null;
  
  // Find community wants metrics
  const wantsWithStats = state.wants.filter(w => w.wantCount !== undefined && w.wantCount !== null && w.wantCount > 0);
  
  let leastWanted = null;
  let mostWanted = null;
  
  if (wantsWithStats.length > 0) {
    const sortedWants = [...wantsWithStats].sort((a, b) => a.wantCount - b.wantCount);
    leastWanted = sortedWants[0];
    mostWanted = sortedWants[sortedWants.length - 1];
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
          <h3>💰 Más Económico</h3>
          ${cheapestListing && cheapestWant ? `
            <div class="stats-album-layout">
              <div class="stats-album-cover" style="background-image: url('${cheapestWant.image || ''}')"></div>
              <div class="stats-album-info">
                <span class="stats-album-title" title="${cheapestWant.title}">${cheapestWant.title}</span>
                <span class="stats-album-artist" title="${cheapestWant.artist}">${cheapestWant.artist}</span>
                <span class="stats-price-highlight">${formatPrice(cheapestListing.priceVal, cheapestListing.currency)}</span>
                <span class="stats-seller-info">Estado: <span class="badge-condition ${cheapestListing.mediaCondClass}" style="display: inline; font-size: 9px; padding: 2px 4px; vertical-align: middle;">${cheapestListing.mediaCondition}</span></span>
                <span class="stats-seller-info">👤 Vendedor: <strong>${cheapestListing.sellerName}</strong> (📍 ${cheapestListing.shipsFrom})</span>
                <a href="${cheapestListing.listingUrl || (cheapestListing.listingId ? 'https://www.discogs.com/sell/item/' + cheapestListing.listingId : 'https://www.discogs.com/release/' + cheapestListing.releaseId)}" target="_blank" class="btn-search-discogs-sm" style="margin-top: 8px; width: fit-content; text-align: center;">Ver Oferta</a>
              </div>
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-muted); margin: 10px 0;">No se encontraron ofertas para calcular precios.</p>
          `}
        </div>
        
        <!-- MOST EXPENSIVE VINYL -->
        <div class="stats-card-rich">
          <div class="stats-card-badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">El más costoso</div>
          <h3>💎 Objeto de Lujo</h3>
          ${expensiveListing && expensiveWant ? `
            <div class="stats-album-layout">
              <div class="stats-album-cover" style="background-image: url('${expensiveWant.image || ''}')"></div>
              <div class="stats-album-info">
                <span class="stats-album-title" title="${expensiveWant.title}">${expensiveWant.title}</span>
                <span class="stats-album-artist" title="${expensiveWant.artist}">${expensiveWant.artist}</span>
                <span class="stats-price-highlight" style="color: #c084fc;">${formatPrice(expensiveListing.priceVal, expensiveListing.currency)}</span>
                <span class="stats-seller-info">Estado: <span class="badge-condition ${expensiveListing.mediaCondClass}" style="display: inline; font-size: 9px; padding: 2px 4px; vertical-align: middle;">${expensiveListing.mediaCondition}</span></span>
                <span class="stats-seller-info">👤 Vendedor: <strong>${expensiveListing.sellerName}</strong> (📍 ${expensiveListing.shipsFrom})</span>
                <a href="${expensiveListing.listingUrl || (expensiveListing.listingId ? 'https://www.discogs.com/sell/item/' + expensiveListing.listingId : 'https://www.discogs.com/release/' + expensiveListing.releaseId)}" target="_blank" class="btn-search-discogs-sm" style="margin-top: 8px; width: fit-content; text-align: center; background: rgba(192, 132, 252, 0.1); border-color: rgba(192, 132, 252, 0.3); color: #c084fc;">Ver Oferta</a>
              </div>
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-muted); margin: 10px 0;">No se encontraron ofertas para calcular precios.</p>
          `}
        </div>
        
        <!-- COMMUNITY POPULARITY -->
        <div class="stats-card-rich">
          <h3>📈 Preferencias de Diggers</h3>
          ${wantsWithStats.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <!-- MOST WANTED -->
              ${mostWanted ? `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 10px; border-radius: 8px;">
                  <span style="font-size: 9px; color: var(--color-amber); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">🔥 EL MÁS DESEADO DE TU LISTA</span>
                  <strong style="color: #fff; font-size: 13px; display: block;">${mostWanted.title}</strong>
                  <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">${mostWanted.artist}</span>
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span style="color: var(--text-muted);">Lo quieren en Discogs:</span>
                    <strong style="color: #fff;">${mostWanted.wantCount.toLocaleString()} coleccionistas</strong>
                  </div>
                </div>
              ` : ''}
              
              <!-- LEAST WANTED -->
              ${leastWanted ? `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 10px; border-radius: 8px;">
                  <span style="font-size: 9px; color: #a855f7; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">❄️ EL MENOS QUERIDO / RAREZA OSCURA</span>
                  <strong style="color: #fff; font-size: 13px; display: block;">${leastWanted.title}</strong>
                  <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">${leastWanted.artist}</span>
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span style="color: var(--text-muted);">Lo quieren en Discogs:</span>
                    <strong style="color: #fff;">${leastWanted.wantCount.toLocaleString()} coleccionistas</strong>
                  </div>
                </div>
              ` : ''}
            </div>
          ` : `
            <p style="font-size: 12px; color: var(--text-muted); margin: 10px 0; line-height: 1.4;">
              ⚠️ <strong>Datos de popularidad de comunidad no disponibles.</strong><br>
              Esto ocurre porque la lista se cargó por raspado web (no API) o no hay conectividad. Intente loguearse en Discogs para cargarla mediante API.
            </p>
          `}
        </div>
      </div>
      
      <!-- COLUMN 2: NOT FOR SALE (AGOTADOS) -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="stats-card-rich" style="flex-grow: 1;">
          <h3>⚠️ Discos sin stock (Agotados en venta)</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin: -10px 0 12px 0; line-height: 1.4;">
            Estos vinilos de tu lista de deseos no disponen de copias publicadas actualmente en el Marketplace de Discogs.
          </p>
          
          <div class="not-for-sale-list">
            ${wantsNotForSale.length > 0 ? wantsNotForSale.map(w => `
              <div class="not-for-sale-row">
                <div class="not-for-sale-info">
                  <div class="not-for-sale-cover" style="background-image: url('${w.image || ''}')">
                    ${!w.image ? `<span style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 100%;">💿</span>` : ''}
                  </div>
                  <div class="not-for-sale-text">
                    <span class="not-for-sale-title" title="${w.title}">${w.title}</span>
                    <span class="not-for-sale-artist" title="${w.artist}">${w.artist}</span>
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
