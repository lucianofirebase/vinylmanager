/**
 * Vinyl Stock Manager • Application Controller (js/app.js)
 * Session authentication, view navigation, mobile bar synchronization, event listeners & initialization
 */

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


// Note: log(message, type) and logEventCount are declared in elements.js for global availability across all modules.


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
  
  if (typeof window.goToOnboardChoiceStep === 'function') {
    window.goToOnboardChoiceStep();
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
  const selectedCountry = buyerCountry ? buyerCountry.value : 'Uruguay';
  log(`Ubicación de envío de comprador actualizada a: ${selectedCountry}`, 'info');
  if (state.allListings && state.allListings.length > 0) {
    groupListingsBySeller();
    renderResults();
  }
  if (typeof calculateAndRenderStats === 'function') {
    calculateAndRenderStats();
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

  // Note: openScanCacheModal and closeScanCacheModal are globally managed in modals.js
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
  // Note: setGridDensity is globally managed in renderers.js

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



window.navigateToView = navigateToView;
window.switchTab = switchTab;
window.updateForwardAndBackButtons = updateForwardAndBackButtons;
window.updateUserDropdownInfo = updateUserDropdownInfo;
window.disconnectUserSession = disconnectUserSession;
