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

// DOM Elements
const logoVinyl = document.getElementById('logo-vinyl');
const connectionStatus = document.getElementById('connection-status');
const usernameDisplay = document.getElementById('username-display');
const userAvatar = document.getElementById('user-avatar');
const inputFallback = document.getElementById('input-fallback');
const manualUsername = document.getElementById('manual-username');
const saveUsernameBtn = document.getElementById('save-username-btn');
const loadWantsBtn = document.getElementById('load-wants-btn');
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
  
  // Controls
  loadWantsBtn.addEventListener('click', loadWantlist);
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
        
        const jsonText = await fetchThroughTab(`https://api.discogs.com/users/${state.username}/wants?page=${page}&per_page=100`);
        console.log(`[WantlistAPI] Respuesta recibida para página ${page}. Parseando JSON...`);
        const data = JSON.parse(jsonText);
        
        if (data && data.wants && data.wants.length > 0) {
          console.log(`[WantlistAPI] Página ${page} parseada con éxito. Encontrados ${data.wants.length} vinilos deseados.`);
          const pageWants = data.wants.map(item => ({
            id: item.id,
            title: item.basic_information.title,
            artist: item.basic_information.artists.map(a => a.name).join(', '),
            year: item.basic_information.year,
            image: item.basic_information.cover_image || item.basic_information.thumb || ''
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
    
  } catch (error) {
    log(`Error al cargar Wantlist: ${error.message}`, 'error');
    alert(`No pudimos cargar la Wantlist. Detalle: ${error.message}`);
    loadWantsBtn.textContent = '1. Cargar Lista de Deseos';
    loadWantsBtn.disabled = false;
    
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
      image
    });
  });
  
  return wants;
}
// Step 2: Start Marketplace Scan
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
  
  try {
    for (let i = startIndex; i < state.wants.length; i++) {
      if (state.cancelRequested) {
        log('Escaneo cancelado por el usuario.', 'error');
        break;
      }
      
      const item = state.wants[i];
      const progress = Math.round(((i + 1) / state.wants.length) * 100);
      
      // Update UI Progress
      statusTitle.textContent = `Escaneando disco ${i + 1} de ${state.wants.length}`;
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
      
      // Try fetching from chrome.storage.local cache first
      if (useCacheCheckbox && useCacheCheckbox.checked && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          const cacheKey = `release_${item.id}`;
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
              isFromCache = true;
            }
          }
        } catch (cacheErr) {
          console.warn('Error reading from cache:', cacheErr);
        }
      }
      
      if (isFromCache && parsedListings) {
        log(`[Caché] Cargadas ${parsedListings.length} copias en venta para este disco (guardado hace ${Math.round(cacheAgeHours * 10) / 10}h).`, 'success');
        state.allListings.push(...parsedListings);
        
        // Update stats on-the-fly
        const uniqueSellers = new Set(state.allListings.map(l => l.sellerName));
        metricSellersCount.textContent = uniqueSellers.size;
        metricMatchesCount.textContent = state.allListings.length;
        
        // Save scan session progress
        saveScanSession(i);
        
        // Skip fetch and delay when using cached data
        continue;
      }
      
      log(`Escaneando (${i + 1}/${state.wants.length}): ${item.artist} - ${item.title}...`);
      
      try {
        const url = `https://www.discogs.com/sell/release/${item.id}?limit=100`;
        const html = await fetchThroughTab(url);
        parsedListings = parseReleaseHTML(html, item.id);
        
        log(`Encontradas ${parsedListings.length} copias en venta para este disco.`);
        state.allListings.push(...parsedListings);
        
        // Save to cache
        if (useCacheCheckbox && useCacheCheckbox.checked && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          try {
            const cacheKey = `release_${item.id}`;
            const cacheVal = {
              timestamp: Date.now(),
              listings: parsedListings
            };
            chrome.storage.local.set({ [cacheKey]: cacheVal });
          } catch (cacheErr) {
            console.warn('Error saving to cache:', cacheErr);
          }
        }
        
        // Update stats on-the-fly
        const uniqueSellers = new Set(state.allListings.map(l => l.sellerName));
        metricSellersCount.textContent = uniqueSellers.size;
        metricMatchesCount.textContent = state.allListings.length;
        
        // Save scan session progress
        saveScanSession(i);
        
      } catch (e) {
        log(`Error al escanear release ${item.id}: ${e.message}`, 'error');
      }
      
      // Polite delay between requests to avoid overloading or rate limits (1.2 seconds)
      await new Promise(resolve => setTimeout(resolve, 1200));
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
      
      // 4. Price & Currency
      const convertedPriceEl = row.querySelector('.converted_price');
      const priceEl = row.querySelector('.price, .item_price, .price_value');
      
      let priceText = '';
      let priceVal = 0;
      let currency = '$';
      let source = 'original';
      
      if (convertedPriceEl) {
        source = 'converted_price';
        priceText = convertedPriceEl.textContent.trim();
        // Split by tax/shipping keywords to remove extra text containing periods
        const cleanText = priceText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible)/i)[0].trim();
        const cleanPrice = cleanText.replace(/[^\d.,]/g, '');
        let numStr = cleanPrice;
        if (cleanPrice.includes(',') && !cleanPrice.includes('.')) {
          numStr = cleanPrice.replace(',', '.');
        } else if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
          numStr = cleanPrice.replace(/,/g, '');
        }
        priceVal = parseFloat(numStr) || 0;
      } else {
        const priceValAttr = priceEl?.getAttribute('data-pricevalue');
        priceText = priceEl ? priceEl.textContent.trim() : '';
        if (priceValAttr) {
          source = 'data-pricevalue';
          priceVal = parseFloat(priceValAttr);
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
      }
      
      // Better currency detection (match standard ISO codes or symbols)
      const currencyMatch = priceText.match(/\b(UYU|ARS|CLP|COP|MXN|BRL|NZD|ZAR|CHF|SEK|NOK|DKK|USD|EUR|GBP|CAD|AUD|JPY)\b/i);
      if (currencyMatch) {
        const parsedCode = currencyMatch[1].toUpperCase();
        if (parsedCode === 'USD') currency = '$';
        else if (parsedCode === 'EUR') currency = '€';
        else if (parsedCode === 'GBP') currency = '£';
        else if (parsedCode === 'JPY') currency = '¥';
        else currency = parsedCode + ' '; // e.g. "ARS " or "CLP "
      } else {
        if (priceText.includes('€')) currency = '€';
        else if (priceText.includes('£')) currency = '£';
        else if (priceText.includes('A$')) currency = 'A$';
        else if (priceText.includes('CA$')) currency = 'C$';
        else if (priceText.includes('¥')) currency = '¥';
        else if (priceText.includes('$')) currency = '$';
      }
      
      // 5. Shipping
      const shippingEl = row.querySelector('.item_shipping, .shipping');
      let shippingText = shippingEl ? shippingEl.textContent.trim() : '';
      let shippingVal = 0;
      let rawShippingText = shippingText;
      
      if (shippingText) {
        // Prioritize converted shipping in parentheses, e.g. "(about $12.00)"
        const matchConverted = shippingText.match(/\(([^)]*\d[^)]*)\)/);
        if (matchConverted) {
          shippingText = matchConverted[1];
        }
        
        const cleanText = shippingText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible)/i)[0].trim();
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
  
  return listings;
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
    
    // Apply shipping base & increments depending on location
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
    const costA = getSingleSellerTotalCost(a);
    const costB = getSingleSellerTotalCost(b);
    return costA - costB;
  });
  
  const bestSellerA = candidatesA[0];

  // Calculate Option B: Best average cost per disc (Efficiency, minimum of 3 discs)
  const eligibleB = filteredSellers.filter(s => s.listings.length >= 3);
  let bestSellerB = null;
  if (eligibleB.length > 0) {
    const candidatesB = [...eligibleB].map(s => {
      const totalCost = getSingleSellerTotalCost(s);
      const avgCost = totalCost / s.listings.length;
      return { seller: s, totalCost, avgCost };
    }).sort((a, b) => a.avgCost - b.avgCost);
    
    bestSellerB = candidatesB[0].seller;
  } else {
    // Fallback to any seller with lowest average cost
    const candidatesB = [...filteredSellers].map(s => {
      const totalCost = getSingleSellerTotalCost(s);
      const avgCost = totalCost / s.listings.length;
      return { seller: s, totalCost, avgCost };
    }).sort((a, b) => a.avgCost - b.avgCost);
    bestSellerB = candidatesB[0]?.seller || null;
  }

  if (!bestSellerA) {
    smartPurchaseCard.style.display = 'none';
    return;
  }

  // Helper functions for costs
  function getSingleSellerTotalCost(seller) {
    const subtotal = seller.listings.reduce((sum, l) => sum + l.priceVal, 0);
    const listCount = seller.listings.length;
    const isDomestic = seller.isDomestic;
    const isEUToEU = seller.isEUToEU;
    
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
    
    const shippingValues = seller.listings.map(l => l.shippingVal).filter(v => v > 0);
    let estShipping = 0;
    if (shippingValues.length > 0) {
      const maxShipping = Math.max(...shippingValues);
      estShipping = maxShipping + (listCount - 1) * extraItemCost;
    } else {
      estShipping = baseShippingPrice + (listCount - 1) * extraItemCost;
    }
    return subtotal + estShipping;
  }

  function getSingleSellerShippingSavings(seller, allSellers) {
    let individualShippingCost = 0;
    seller.listings.forEach(l => {
      let cheapestListing = null;
      let cheapestSellerForRel = null;
      allSellers.forEach(s => {
        const relListing = s.listings.find(x => x.releaseId === l.releaseId);
        if (relListing) {
          if (!cheapestListing || relListing.priceVal < cheapestListing.priceVal) {
            cheapestListing = relListing;
            cheapestSellerForRel = s;
          }
        }
      });
      
      if (cheapestListing && cheapestSellerForRel) {
        const isDomestic = cheapestSellerForRel.isDomestic;
        const isEUToEU = cheapestSellerForRel.isEUToEU;
        let baseShippingPrice = 6.00;
        if (isDomestic) {
          baseShippingPrice = 4.50;
        } else if (isEUToEU) {
          baseShippingPrice = 9.50;
        } else {
          baseShippingPrice = 24.00;
        }
        const estShipping = cheapestListing.shippingVal > 0 ? cheapestListing.shippingVal : baseShippingPrice;
        individualShippingCost += estShipping;
      }
    });
    
    const listCount = seller.listings.length;
    const isDomestic = seller.isDomestic;
    const isEUToEU = seller.isEUToEU;
    
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
    
    const shippingValues = seller.listings.map(l => l.shippingVal).filter(v => v > 0);
    let estShipping = 0;
    if (shippingValues.length > 0) {
      const maxShipping = Math.max(...shippingValues);
      estShipping = maxShipping + (listCount - 1) * extraItemCost;
    } else {
      estShipping = baseShippingPrice + (listCount - 1) * extraItemCost;
    }
    
    return Math.max(0, individualShippingCost - estShipping);
  }

  function renderCard(title, description, badgeText, seller, badgeColor) {
    const totalCost = getSingleSellerTotalCost(seller);
    const subtotal = seller.listings.reduce((sum, l) => sum + l.priceVal, 0);
    const shippingCost = totalCost - subtotal;
    const currencySymbol = seller.currency || '$';
    
    let albumsHtml = '';
    seller.listings.forEach(l => {
      const wantInfo = state.wants.find(w => w.id === l.releaseId) || { title: 'Unknown', artist: 'Unknown' };
      albumsHtml += `
        <div class="smart-album-row">
          <span class="smart-album-title" title="${wantInfo.title} - ${wantInfo.artist}">💿 ${wantInfo.title}</span>
          <span class="smart-album-price">${l.currency}${l.priceVal.toFixed(2)}</span>
        </div>
      `;
    });
    
    return `
      <div class="smart-option-card">
        <div class="smart-option-badge" style="background: ${badgeColor}">${badgeText}</div>
        <div class="smart-option-header">
          <h3>${title}</h3>
          <p>${description}</p>
        </div>
        
        <div class="smart-option-seller">
          <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px;">
            <a href="#" class="smart-option-seller-name" data-scroll-to="${seller.name}" style="display: block; font-weight: 700; color: var(--color-purple); text-decoration: none;">
              👤 ${seller.name}
            </a>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
              📍 ${seller.shipsFrom} • ${seller.rating}% pos.
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 15px; font-weight: 800; color: #fff;">${currencySymbol}${totalCost.toFixed(2)}</div>
            <div style="font-size: 10px; color: var(--text-muted)">Envío: ${currencySymbol}${shippingCost.toFixed(2)}</div>
          </div>
        </div>
        
        <div class="smart-option-albums-list">
          ${albumsHtml}
        </div>
        
        <div class="smart-option-footer" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
            <span>Discos cubiertos:</span>
            <span style="color:#fff; font-weight:700;">${seller.listings.length} de ${state.wants.length}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
            <span>Promedio por disco:</span>
            <span style="color:var(--color-amber); font-weight:700;">${currencySymbol}${(totalCost / seller.listings.length).toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Render cards side-by-side or as single card if it's the exact same seller
  let cardsHtml = '';
  if (bestSellerB && bestSellerA.name === bestSellerB.name) {
    cardsHtml = `
      <div style="width: 100%; display: flex; justify-content: center;">
        ${renderCard(
          "Ganador Absoluto",
          "Esta tienda es la mejor opción tanto por catálogo como por precio promedio de los discos.",
          "★ RECOMENDADO ★",
          bestSellerA,
          "linear-gradient(135deg, var(--color-purple) 0%, #ec4899 100%)"
        )}
      </div>
    `;
  } else {
    cardsHtml = `
      <div class="smart-options-container">
        ${renderCard(
          "Opción A: Compra Máxima",
          "Ideal si querés consolidar el máximo de tu lista en un solo paquete y envío.",
          "Máximo Catálogo",
          bestSellerA,
          "var(--color-purple)"
        )}
        ${bestSellerB ? renderCard(
          "Opción B: Compra Eficiente",
          "Ideal si querés priorizar el menor precio promedio por disco (mínimo 3 discos).",
          "Mejor Precio",
          bestSellerB,
          "var(--color-amber)"
        ) : ''}
      </div>
    `;
  }

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
    return;
  }
  
  // Render Smart Purchase recommendation card
  renderSmartPurchase(filtered);
  
  emptyState.style.display = 'none';
  noResultsState.style.display = 'none';
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
          <td class="listing-price-cell">${list.currency}${list.priceVal.toFixed(2)}</td>
          <td class="listing-shipping-cell">+ ${list.currency}${list.shippingVal.toFixed(2)} envío</td>
          <td>
            <a href="${list.listingUrl}" target="_blank" class="btn-listing-link">Ver Oferta</a>
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
            <span class="total-value-normal">${seller.currency}${seller.subtotal.toFixed(2)}</span>
          </div>
          
          <div class="total-group" title="Envío estimado según ubicación (${seller.isDomestic ? 'Nacional' : (seller.isEUToEU ? 'UE a UE' : 'Internacional')})">
            <span class="total-label">Envío (${seller.isDomestic ? 'Nac.' : (seller.isEUToEU ? 'UE' : 'Int.')})</span>
            <span class="total-value-normal" style="color: var(--text-muted); font-weight: 500;">${seller.currency}${seller.estimatedShipping.toFixed(2)}</span>
          </div>
          
          <div class="total-group">
            <span class="total-label">Total Estimado</span>
            <span class="total-value-highlight">${seller.currency}${seller.totalPrice.toFixed(2)}</span>
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
