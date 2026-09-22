/**
 * Vinyl Stock Manager • Scanner Engine Module (js/scanner.js)
 * Batch marketplace scanning orchestration, radar canvas visualization, session resumption & cache
 */

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





var radarAnimFrameId = null;
window.radarAnimFrameId = null;

function startRadarShaderCanvas() {
  const canvas = document.getElementById('scan-radar-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let angle = 0;
  let laserY = 0;
  let laserDirection = 1;
  let animTick = 0;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.offsetWidth || 800;
    const h = rect.height || canvas.offsetHeight || 520;
    
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);
    return { width: w, height: h };
  }

  function draw() {
    const { width, height } = resizeCanvas();
    ctx.clearRect(0, 0, width, height);

    animTick++;
    angle += 0.015;

    // 1. Architectural Swiss Grid with Micro-Crosshairs (+)
    const gridSize = 42;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.032)';
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let x = gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let y = gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Micro-crosshairs (+) at key intersections
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    for (let x = gridSize * 2; x < width - gridSize; x += gridSize * 3) {
      for (let y = gridSize * 2; y < height - gridSize; y += gridSize * 3) {
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + 3, y);
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x, y + 3);
        ctx.stroke();
      }
    }

    // 2. Concentric Acoustic Vinyl Grooves (Centered behind the turntable)
    // Find turntable element position relative to canvas for exact concentric alignment
    const turntable = document.getElementById('loading-turntable-container');
    let centerX = width * 0.5;
    let centerY = height * 0.40;

    if (turntable) {
      const tRect = turntable.getBoundingClientRect();
      const cRect = canvas.getBoundingClientRect();
      if (tRect.width > 0 && cRect.width > 0) {
        centerX = (tRect.left - cRect.left) + (tRect.width * 0.5);
        centerY = (tRect.top - cRect.top) + (tRect.height * 0.5);
      }
    }

    // Smooth acoustic soundwaves radiating outward
    const waveBase = (animTick * 0.4) % 40;
    for (let r = 40 + waveBase; r <= Math.max(width, height) * 0.75; r += 40) {
      const maxR = Math.max(width, height) * 0.7;
      const progress = r / maxR;
      const alpha = Math.max(0, 0.075 * (1 - progress));

      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 3. Subtle Circular Precision Reticle around the record
    ctx.beginPath();
    ctx.arc(centerX, centerY, 155, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(224, 43, 32, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Small rotating compass ticks on the reticle
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle * 0.5);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(150, 0);
      ctx.lineTo(160, 0);
      ctx.strokeStyle = 'rgba(224, 43, 32, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // 4. Razor-sharp Prada Red Laser Scan Sweep (Gliding smoothly up and down)
    laserY += 1.2 * laserDirection;
    if (laserY >= height - 30) {
      laserY = height - 30;
      laserDirection = -1;
    } else if (laserY <= 30) {
      laserY = 30;
      laserDirection = 1;
    }

    // Laser vertical gradient tail
    const laserTailH = 28;
    const laserGrad = ctx.createLinearGradient(0, laserY - (laserDirection * laserTailH), 0, laserY);
    laserGrad.addColorStop(0, 'rgba(224, 43, 32, 0)');
    laserGrad.addColorStop(1, 'rgba(224, 43, 32, 0.08)');

    ctx.fillStyle = laserGrad;
    ctx.fillRect(gridSize, Math.min(laserY, laserY - (laserDirection * laserTailH)), width - (gridSize * 2), laserTailH);

    // Sharp 1px laser beam
    ctx.beginPath();
    ctx.moveTo(gridSize, laserY);
    ctx.lineTo(width - gridSize, laserY);
    ctx.strokeStyle = 'rgba(224, 43, 32, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Laser endpoint pins
    ctx.fillStyle = '#E02B20';
    ctx.fillRect(gridSize - 2, laserY - 2, 4, 4);
    ctx.fillRect(width - gridSize - 2, laserY - 2, 4, 4);

    // 5. Technical Telemetry Micro-Typography (Corner Data)
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillText('DISCOGS ARCHIVE SCANNER // RADAR v2.4', gridSize + 4, 20);
    ctx.fillText('33⅓ RPM • HI-FI LATAM PROXY', width - gridSize - 155, 20);

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
      const turntableVinyl = document.getElementById('turntable-vinyl') || document.getElementById('loading-turntable-container');
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
    const turntableVinyl = document.getElementById('turntable-vinyl') || document.getElementById('loading-turntable-container');
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




// ==========================================
// Discogs User Collection (Purchased Records) Sync
// ==========================================

async function syncDiscogsCollection(silent = false) {
  const user = (state.username || localStorage.getItem('discogs_username') || '').trim();
  if (!user) {
    if (typeof showToast === 'function') {
      showToast('Ingresa o conecta tu usuario de Discogs para sincronizar tu colección.', 'warning');
    }
    return [];
  }

  if (typeof showToast === 'function' && !silent) {
    showToast(`🔄 Sincronizando colección de '${user}' desde Discogs...`, 'info', 4000);
  }
  log(`Iniciando sincronización de discos comprados (colección) de @${user}...`);

  const syncBtn = document.getElementById('btn-sync-collection');
  const syncBtnIcon = syncBtn ? syncBtn.querySelector('.material-symbols-outlined') : null;
  if (syncBtn) {
    syncBtn.disabled = true;
    if (syncBtnIcon) syncBtnIcon.classList.add('animate-spin');
  }

  let fetchedReleases = [];
  const savedToken = localStorage.getItem('discogs_token') || '';
  const tokenParam = savedToken ? `&token=${encodeURIComponent(savedToken)}` : '';

  try {
    let page = 1;
    let totalPages = 1;

    do {
      log(`Cargando página ${page} de colección oficial de Discogs...`);
      const endpoint = `https://api.discogs.com/users/${encodeURIComponent(user)}/collection/folders/0/releases?page=${page}&per_page=100&sort=added&sort_order=desc${tokenParam}`;
      
      let jsonText = '';
      try {
        jsonText = await fetchThroughTab(endpoint);
      } catch (proxyErr) {
        console.log(`[CollectionAPI] Proxy error, intentando fetchDirect...`, proxyErr.message);
        jsonText = await fetchDirect(endpoint);
      }

      const data = JSON.parse(jsonText);
      if (data && data.releases && data.releases.length > 0) {
        totalPages = (data.pagination && data.pagination.pages) ? data.pagination.pages : 1;
        
        const pageItems = data.releases.map(item => {
          const info = item.basic_information || {};
          const artistsStr = (info.artists && info.artists.length > 0)
            ? info.artists.map(a => a.name).join(', ')
            : 'Artista Desconocido';
          const formatsStr = (info.formats && info.formats.length > 0)
            ? info.formats.map(f => f.name + (f.descriptions ? ` (${f.descriptions.join(', ')})` : '')).join(', ')
            : 'Vinyl';
          const labelsStr = (info.labels && info.labels.length > 0)
            ? info.labels.map(l => l.name + (l.catno ? ` - ${l.catno}` : '')).join(', ')
            : '';

          return {
            id: item.id || info.id,
            instance_id: item.instance_id || null,
            title: (info.title || 'Sin Título').trim(),
            artist: artistsStr.trim(),
            year: info.year || '',
            image: info.cover_image || info.thumb || '',
            format: formatsStr,
            label: labelsStr,
            dateAdded: item.date_added || new Date().toISOString(),
            rating: item.rating || 0,
            notes: (item.notes && item.notes.length > 0) ? item.notes.map(n => n.value).join('; ') : ''
          };
        });

        fetchedReleases.push(...pageItems);
        page++;

        if (page <= totalPages) {
          await new Promise(r => setTimeout(r, 1100));
        }
      } else {
        break;
      }
    } while (page <= totalPages);

    log(`Colección de Discogs sincronizada vía API con éxito (${fetchedReleases.length} discos).`, 'success');
  } catch (apiErr) {
    console.warn('[CollectionSync] Error en API Discogs, intentando raspado web de colección...', apiErr.message);
    log(`Aviso API: ${apiErr.message}. Intentando raspado HTML de colección...`, 'warning');
    
    try {
      let page = 1;
      let hasMore = true;
      const seenIds = new Set();

      while (hasMore && page <= 5) { // up to 5 pages web fallback
        const collectionWebUrl = `https://www.discogs.com/user/${encodeURIComponent(user)}/collection?page=${page}&limit=50`;
        let html = '';
        try {
          html = await fetchThroughTab(collectionWebUrl);
        } catch (e) {
          html = await fetchDirect(collectionWebUrl);
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rows = doc.querySelectorAll('table.cards_list tr, .collection-table tr, tr[data-release-id]');
        
        let foundThisPage = 0;
        rows.forEach(tr => {
          const relId = tr.getAttribute('data-release-id') || tr.querySelector('a[href*="/release/"]')?.getAttribute('href')?.match(/\/release\/(\d+)/)?.[1];
          if (!relId || seenIds.has(relId)) return;
          seenIds.add(relId);

          const titleEl = tr.querySelector('.title, .release_title, a[href*="/release/"]');
          const artistEl = tr.querySelector('.artist, .artist_title');
          const imgEl = tr.querySelector('img.thumbnail, img[src*="discogs-images"]');
          const formatEl = tr.querySelector('.format');
          const yearEl = tr.querySelector('.year');

          fetchedReleases.push({
            id: relId,
            title: titleEl ? titleEl.textContent.trim() : 'Sin Título',
            artist: artistEl ? artistEl.textContent.trim() : 'Artista',
            year: yearEl ? yearEl.textContent.trim() : '',
            image: imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || '') : '',
            format: formatEl ? formatEl.textContent.trim() : 'Vinyl',
            label: '',
            dateAdded: new Date().toISOString(),
            rating: 0,
            notes: ''
          });
          foundThisPage++;
        });

        if (foundThisPage === 0 || !doc.querySelector('.pagination_next, a[rel="next"]')) {
          hasMore = false;
        } else {
          page++;
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    } catch (scrapingErr) {
      console.error('[CollectionSync] Falló también el raspado HTML:', scrapingErr);
    }
  }

  // Merge with existing local collection to keep any manual notes/additions
  const currentCollection = state.collection || loadUserCollection(user) || [];
  const currentMap = new Map();
  currentCollection.forEach(item => {
    if (item.id) currentMap.set(String(item.id), item);
  });

  // Add/update with newly fetched releases
  fetchedReleases.forEach(newItem => {
    const existing = currentMap.get(String(newItem.id));
    if (existing) {
      // Retain custom user fields like pricePaid or custom notes
      currentMap.set(String(newItem.id), {
        ...newItem,
        pricePaid: existing.pricePaid || null,
        notes: existing.notes || newItem.notes || ''
      });
    } else {
      currentMap.set(String(newItem.id), newItem);
    }
  });

  const merged = Array.from(currentMap.values());
  state.collection = merged;
  saveUserCollection(merged, user);

  if (syncBtn) {
    syncBtn.disabled = false;
    if (syncBtnIcon) syncBtnIcon.classList.remove('animate-spin');
  }

  if (typeof showToast === 'function') {
    showToast(`✓ ¡Colección sincronizada! ${merged.length} discos comprados registrados.`, 'success', 4000);
  }

  // Re-render collection view if currently visible
  if (typeof renderCollectionView === 'function') {
    renderCollectionView(true);
  }

  // Also re-render wants list to update any "[COMPRADO]" status badges
  if (typeof renderWantsListInManager === 'function' && document.getElementById('wantlist-manager')?.style.display !== 'none') {
    renderWantsListInManager();
  }

  return merged;
}

window.startMarketplaceScan = startMarketplaceScan;
window.loadWantlist = loadWantlist;
window.syncDiscogsCollection = syncDiscogsCollection;
