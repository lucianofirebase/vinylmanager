/**
 * Vinyl Stock Manager • Network & Proxy Layer (js/network.js)
 * Background tab proxy, direct fetch, exponential backoff, rate limiting & file downloads
 */

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
