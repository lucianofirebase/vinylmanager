// Discogs Matcher Pro - Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  const popupUsername = document.getElementById('popup-username');
  const popupStatusLabel = document.getElementById('popup-status-label');

  // Detect username from cookies or saved localStorage
  detectUserSession(popupUsername, popupStatusLabel);

  // Track popup open
  if (window.Telemetry) {
    window.Telemetry.track('POPUP_OPENED', 'Usuario abrió popup de la extensión');
  }

  // Main Dashboard Action (re-uses existing tab or opens new one)
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      if (window.Telemetry) {
        window.Telemetry.track('POPUP_CLICK_DASHBOARD', 'Usuario hizo clic en Abrir Dashboard desde popup');
      }
      openOrFocusTab('dashboard.html');
    });
  }
});

function openOrFocusTab(targetPath) {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    const fullTarget = chrome.runtime.getURL(targetPath);
    const basePath = chrome.runtime.getURL('dashboard.html');

    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs && tabs.find(t => t.url && t.url.startsWith(basePath));
      if (existingTab && existingTab.id) {
        chrome.tabs.update(existingTab.id, { active: true, url: fullTarget });
        if (existingTab.windowId) {
          chrome.windows.update(existingTab.windowId, { focused: true });
        }
      } else {
        chrome.tabs.create({ url: fullTarget });
      }
    });
  } else {
    window.open(targetPath, '_blank');
  }
}

async function detectUserSession(userEl, statusEl) {
  const dot = document.getElementById('popup-status-dot');

  // Check if user explicitly disconnected for testing
  try {
    const isDisconnected = localStorage.getItem('discogs_session_disconnected') === 'true';
    if (isDisconnected) {
      if (userEl) userEl.textContent = 'INVITADO';
      if (statusEl) {
        statusEl.textContent = 'MODO PRUEBA';
        statusEl.style.color = '#71717A';
      }
      if (dot) {
        dot.style.background = '#A1A1AA';
        dot.style.boxShadow = 'none';
      }
      return;
    }
  } catch (e) {}

  // 1. Try chrome.storage / localStorage
  try {
    const saved = localStorage.getItem('discogs_username');
    if (saved && userEl) {
      userEl.textContent = saved;
      if (statusEl) statusEl.textContent = 'ACTIVO';
      if (dot) {
        dot.style.background = '#10B981';
        dot.style.boxShadow = '0 0 6px rgba(16, 185, 129, 0.4)';
      }
      return;
    }
  } catch (e) {
    // Ignore localStorage sandbox restrictions
  }

  // 2. Try chrome.cookies for active Discogs session
  if (typeof chrome !== 'undefined' && chrome.cookies) {
    try {
      chrome.cookies.getAll({ domain: 'discogs.com' }, (cookies) => {
        if (!cookies || !cookies.length) {
          if (userEl) userEl.textContent = 'SIN SESIÓN';
          if (statusEl) {
            statusEl.textContent = 'DESCONECTADO';
            statusEl.style.color = '#E02B20';
          }
          if (dot) {
            dot.style.background = '#E02B20';
            dot.style.boxShadow = 'none';
          }
          return;
        }
        for (const cookie of cookies) {
          if (cookie.name === 'username' || cookie.name === 'discogs_user') {
            const username = decodeURIComponent(cookie.value);
            if (username && userEl) {
              userEl.textContent = username;
              if (statusEl) statusEl.textContent = 'ACTIVO';
              if (dot) {
                dot.style.background = '#10B981';
                dot.style.boxShadow = '0 0 6px rgba(16, 185, 129, 0.4)';
              }
              return;
            }
          }
        }
        if (userEl) userEl.textContent = 'SIN SESIÓN';
        if (statusEl) {
          statusEl.textContent = 'DESCONECTADO';
          statusEl.style.color = '#E02B20';
        }
        if (dot) {
          dot.style.background = '#E02B20';
          dot.style.boxShadow = 'none';
        }
      });
    } catch (e) {
      console.warn('Cookie access error:', e);
    }
  }
}
