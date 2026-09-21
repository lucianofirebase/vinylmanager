/**
 * Vinyl Stock Manager • Modals & Personalization Module (js/modals.js)
 * Tabular export dialogs (CSV/TSV), user personalization settings, dropdown positioning
 */

// ==========================================
// UNIFIED SCREEN & NAVIGATION MANAGER
// ==========================================

var currentAppView = window.currentAppView || 'wizard-1';

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




