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
    document.getElementById('settings-modal'),
    document.getElementById('add-collection-modal'),
    document.getElementById('quick-inspector-modal')
  ];
  let closedAny = false;
  modals.forEach(m => {
    if (m && (m.style.display === 'flex' || m.style.display === 'block')) {
      m.style.display = 'none';
      closedAny = true;
    }
  });

  // Stop YouTube iframe audio playback immediately on modal close
  const ytIframe = document.getElementById('inspector-youtube-iframe');
  if (ytIframe) ytIframe.src = '';

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

  const countrySelect = document.getElementById('settings-country');
  const buyerCountryEl = document.getElementById('buyer-country');
  const savedCountry = localStorage.getItem('buyer_country') || (buyerCountryEl ? buyerCountryEl.value : 'Uruguay');
  if (countrySelect) {
    countrySelect.value = savedCountry;
  }

  const currSelect = document.getElementById('settings-currency');
  const displayCurrEl = document.getElementById('display-currency');
  const savedCurrency = localStorage.getItem('display_currency') || (displayCurrEl ? displayCurrEl.value : (typeof getCurrencyForCountry === 'function' ? getCurrencyForCountry(savedCountry) : 'USD'));
  if (currSelect) {
    currSelect.value = savedCurrency;
  }

  // Update dynamic exchange rate UI for the current currency
  updateSettingsExchangeRateUI(currSelect ? currSelect.value : savedCurrency);

  // Setup change listeners inside settings modal if not already initialized
  if (countrySelect && !countrySelect.dataset.listenerAttached) {
    countrySelect.dataset.listenerAttached = 'true';
    countrySelect.addEventListener('change', () => {
      const newCountry = countrySelect.value;
      if (typeof getCurrencyForCountry === 'function') {
        const matchingCurr = getCurrencyForCountry(newCountry);
        if (currSelect && currSelect.value !== 'original') {
          currSelect.value = matchingCurr;
        }
        updateSettingsExchangeRateUI(currSelect ? currSelect.value : matchingCurr);
      }
    });
  }

  if (currSelect && !currSelect.dataset.listenerAttached) {
    currSelect.dataset.listenerAttached = 'true';
    currSelect.addEventListener('change', () => {
      const activeCurr = currSelect.value === 'original' && countrySelect && typeof getCurrencyForCountry === 'function'
        ? getCurrencyForCountry(countrySelect.value)
        : currSelect.value;
      updateSettingsExchangeRateUI(activeCurr);
    });
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

function updateSettingsExchangeRateUI(currencyCode) {
  const rateContainer = document.getElementById('settings-rate-container');
  const rateTitle = document.getElementById('settings-rate-title');
  const rateSubtitle = document.getElementById('settings-rate-subtitle');
  const rateSymbol = document.getElementById('settings-rate-symbol');
  const rateInput = document.getElementById('settings-rate-uyu');
  if (!rateInput) return;

  const curr = (currencyCode === 'original') ? 'USD' : (currencyCode || 'USD');
  const currInfo = CURRENCY_MAP[curr] || { symbol: '$', code: curr, name: curr };

  if (curr === 'USD') {
    if (rateContainer) rateContainer.style.display = 'flex';
    if (rateTitle) rateTitle.textContent = 'Cotización Dólar (USD por 1 USD):';
    if (rateSubtitle) rateSubtitle.textContent = 'Moneda base de referencia (1 USD = 1.00 USD)';
    if (rateSymbol) rateSymbol.textContent = '$';
    rateInput.value = '1.0';
    rateInput.disabled = true;
  } else {
    if (rateContainer) rateContainer.style.display = 'flex';
    if (rateTitle) rateTitle.textContent = `Cotización Dólar (${currInfo.code} por 1 USD):`;
    if (rateSubtitle) rateSubtitle.textContent = `Usado para convertir precios en ${currInfo.name || currInfo.code}`;
    if (rateSymbol) rateSymbol.textContent = currInfo.symbol || '$';
    rateInput.disabled = false;
    
    // Load persisted rate or default
    const units = typeof getCurrencyUnitsPerUSD === 'function'
      ? getCurrencyUnitsPerUSD(currInfo.code)
      : 1.0;
    rateInput.value = units;
  }
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
  let selectedCurr = 'USD';
  if (currSelect) {
    selectedCurr = currSelect.value;
    localStorage.setItem('display_currency', selectedCurr);
    if (displayCurrEl) displayCurrEl.value = selectedCurr;
    if (typeof state !== 'undefined' && state) {
      state.displayCurrency = selectedCurr;
    }
    if (typeof window !== 'undefined' && window.appStore && typeof window.appStore.setState === 'function') {
      window.appStore.setState({ displayCurrency: selectedCurr });
    }
  }

  // Country
  const countrySelect = document.getElementById('settings-country');
  const buyerCountryEl = document.getElementById('buyer-country');
  const wizardBuyerCountryEl = document.getElementById('wizard-buyer-country');
  let selectedCountry = 'Uruguay';
  let countryChanged = false;
  if (countrySelect) {
    selectedCountry = countrySelect.value;
    const currentCountry = (typeof state !== 'undefined' && state && state.buyerCountry) || localStorage.getItem('buyer_country') || (buyerCountryEl ? buyerCountryEl.value : 'Uruguay');
    if (currentCountry !== selectedCountry) {
      countryChanged = true;
    }
    localStorage.setItem('buyer_country', selectedCountry);
    if (buyerCountryEl) buyerCountryEl.value = selectedCountry;
    if (wizardBuyerCountryEl) wizardBuyerCountryEl.value = selectedCountry;
    if (typeof state !== 'undefined' && state) {
      state.buyerCountry = selectedCountry;
    }
  }

  // Custom Exchange Rate for the active currency
  const rateInput = document.getElementById('settings-rate-uyu');
  if (rateInput && !rateInput.disabled) {
    const val = parseFloat(rateInput.value);
    const activeCode = selectedCurr === 'original' && typeof getCurrencyForCountry === 'function'
      ? getCurrencyForCountry(selectedCountry)
      : selectedCurr;
      
    if (!isNaN(val) && val > 0) {
      if (typeof setCustomCurrencyRate === 'function') {
        setCustomCurrencyRate(activeCode, val);
      }
      if (typeof window !== 'undefined' && window.currencyService && typeof window.currencyService.setCustomCurrencyRate === 'function') {
        window.currencyService.setCustomCurrencyRate(activeCode, val);
      }
    }
  }

  // Density
  const compBtn = document.getElementById('settings-density-compact');
  const isCompact = compBtn && compBtn.classList.contains('bg-pitch-black');
  setGridDensity(isCompact ? 'compact' : 'standard');

  // If country changed and listings are loaded, recalculate domestic/international shipping & regroup
  if (countryChanged && typeof state !== 'undefined' && state.allListings && state.allListings.length > 0) {
    if (typeof groupListingsBySeller === 'function') {
      groupListingsBySeller();
    }
    if (typeof saveCompletedScanResults === 'function') {
      saveCompletedScanResults();
    }
  }

  // Re-render results if any
  if (typeof state !== 'undefined' && state.groupedSellers && state.groupedSellers.length > 0) {
    if (typeof renderResults === 'function') renderResults();
    if (typeof calculateAndRenderStats === 'function') calculateAndRenderStats();
  }

  // Re-render wantlist manager if open
  const wantsModal = document.getElementById('wants-manager-modal');
  if (wantsModal && (wantsModal.classList.contains('open') || wantsModal.style.display !== 'none')) {
    if (typeof renderWantsListInManager === 'function') {
      renderWantsListInManager();
    }
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
  if (typeof clearScanCache === 'function') {
    clearScanCache();
  } else if (typeof window !== 'undefined' && typeof window.clearScanCache === 'function') {
    window.clearScanCache();
  } else {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('marketplace_cache_') || key.startsWith('discogs_cache_') || key.startsWith('scan_session_') || key.startsWith('discogs_asp_banner_') || key.startsWith('discogs_completed_scan_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('remember_scan_cache_choice');
    showToast(`Caché liberado: ${keysToRemove.length} elementos eliminados`, 'info');
  }

  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('CACHE_PURGED', 'Caché de escaneo purgado');
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
  localStorage.removeItem('custom_rate_UYU');
  localStorage.removeItem('rate_UYU');
  localStorage.removeItem('wants_grid_density');
  localStorage.removeItem('display_currency');
  localStorage.removeItem('buyer_country');

  if (typeof CURRENCY_MAP !== 'undefined' && CURRENCY_MAP.UYU) CURRENCY_MAP.UYU.rate = 0.025;
  if (typeof window !== 'undefined' && window.currencyService && window.currencyService.currencyMap && window.currencyService.currencyMap.UYU) {
    window.currencyService.currencyMap.UYU.rate = 0.025;
  }

  const turboRadio = document.getElementById('settings-cache-turbo');
  if (turboRadio) turboRadio.checked = true;
  const rememberCheckbox = document.getElementById('settings-remember-cache');
  if (rememberCheckbox) rememberCheckbox.checked = false;
  if (typeof syncCacheState === 'function') syncCacheState(true);

  const minMatches = document.getElementById('settings-min-matches');
  if (minMatches) minMatches.value = '2';
  const filterMinMatchesEl = document.getElementById('filter-min-matches');
  if (filterMinMatchesEl) filterMinMatchesEl.value = '2';

  const minCond = document.getElementById('settings-min-condition');
  if (minCond) minCond.value = 'VG+';
  const filterMinCondEl = document.getElementById('filter-min-condition');
  if (filterMinCondEl) filterMinCondEl.value = 'VG+';

  const minRating = document.getElementById('settings-min-rating');
  if (minRating) minRating.value = '99';
  const filterRatingEl = document.getElementById('filter-rating');
  if (filterRatingEl) filterRatingEl.value = '99';

  const countrySelect = document.getElementById('settings-country');
  if (countrySelect) countrySelect.value = 'Uruguay';
  const buyerCountryEl = document.getElementById('buyer-country');
  if (buyerCountryEl) buyerCountryEl.value = 'Uruguay';
  if (typeof state !== 'undefined' && state) {
    state.buyerCountry = 'Uruguay';
  }

  const currSelect = document.getElementById('settings-currency');
  if (currSelect) currSelect.value = 'USD';
  const displayCurrEl = document.getElementById('display-currency');
  if (displayCurrEl) displayCurrEl.value = 'USD';
  if (typeof state !== 'undefined' && state) {
    state.displayCurrency = 'USD';
  }
  if (typeof window !== 'undefined' && window.appStore && typeof window.appStore.setState === 'function') {
    window.appStore.setState({ displayCurrency: 'USD' });
  }

  const rateInput = document.getElementById('settings-rate-uyu');
  if (rateInput) rateInput.value = '40';
  if (typeof updateSettingsExchangeRateUI === 'function') {
    updateSettingsExchangeRateUI('USD');
  }

  updateSettingsDensityUI('standard');
  setGridDensity('standard');

  if (typeof state !== 'undefined' && state.allListings && state.allListings.length > 0) {
    if (typeof groupListingsBySeller === 'function') groupListingsBySeller();
    if (typeof saveCompletedScanResults === 'function') saveCompletedScanResults();
  }
  if (typeof state !== 'undefined' && state.groupedSellers && state.groupedSellers.length > 0) {
    if (typeof renderResults === 'function') renderResults();
    if (typeof calculateAndRenderStats === 'function') calculateAndRenderStats();
  }

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

function generateWantsTSV(items = (state.wants || [])) {
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

function generateWantsCSV(items = (state.wants || [])) {
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

function generateOffersCSV(listings = (state.allListings || [])) {
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






function openScanCacheModal(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const scanCacheModal = document.getElementById('scan-cache-modal');
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
  } catch (err) {}

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
}
window.openScanCacheModal = openScanCacheModal;

function closeScanCacheModal() {
  const scanCacheModal = document.getElementById('scan-cache-modal');
  if (scanCacheModal) {
    scanCacheModal.classList.remove('open');
    scanCacheModal.style.display = 'none';
  }
}
window.closeScanCacheModal = closeScanCacheModal;
window.openExportSheetsModal = openExportSheetsModal;
window.closeExportSheetsModal = closeExportSheetsModal;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.updateSettingsExchangeRateUI = updateSettingsExchangeRateUI;
window.closeAllModals = closeAllModals;

// ==========================================
// QUICK INSPECTOR & YOUTUBE AUDIO PREVIEW
// ==========================================

const GOLDMINE_DESCRIPTIONS = {
  'M': 'Mint (M): Disco absolutamente nuevo, precintado o sin ninguna reproducción.',
  'NM': 'Near Mint (NM): Prácticamente perfecto. Sin marcas perceptibles, reproduce sin ruidos de fondo.',
  'VG+': 'Very Good Plus (VG+): Mínimas señales de uso superficiales. No afecta la reproducción; sonido claro.',
  'VG': 'Very Good (VG): Marcas visibles y ruido superficial suave en partes lentas, sin saltos.',
  'G+': 'Good Plus (G+): Desgaste moderado, ruido de fondo constante pero reproduce completo.',
  'G': 'Good (G): Desgaste pronunciado, posibles saltos o ruidos notorios.',
  'F': 'Fair (F): Estado muy deteriorado.',
  'P': 'Poor (P): Disco rayado o inutilizado.',
  'GENERIC': 'Funda genérica de distribuidora.'
};

const inspectorReleaseCache = new Map();

async function openQuickInspector(sellerName, releaseId, listingId = null) {
  const modal = document.getElementById('quick-inspector-modal');
  if (!modal) return;

  // 1. Look up seller and listing
  const seller = (state.groupedSellers || []).find(s => s.name === sellerName);
  let listing = null;
  if (seller && seller.listings) {
    listing = seller.listings.find(l => (listingId && String(l.listingId) === String(listingId)) || String(l.releaseId) === String(releaseId));
  }
  if (!listing && state.allListings) {
    listing = state.allListings.find(l => (listingId && String(l.listingId) === String(listingId)) || String(l.releaseId) === String(releaseId));
  }

  // 2. Look up wantlist metadata
  const wantInfo = (state.wants || []).find(w => String(w.id) === String(releaseId)) || {};

  // Resolve Title, Artist, Image, Year, Label
  const title = wantInfo.title || listing?.releaseTitle || listing?.title || 'Disco sin título';
  const artist = wantInfo.artist || listing?.releaseArtist || listing?.artist || 'Artista Desconocido';
  const rawCover = wantInfo.image || wantInfo.cover || listing?.image || '';
  const coverUrl = typeof upgradeDiscogsImageUrl === 'function' ? upgradeDiscogsImageUrl(rawCover) : rawCover;
  const year = wantInfo.year || listing?.year || '—';
  const formats = wantInfo.formats || 'Vinilo';
  const labels = wantInfo.labels || [wantInfo.label, wantInfo.catno].filter(Boolean).join(' • ') || 'Marketplace Item';

  // Populate basic header
  const titleEl = document.getElementById('inspector-release-title');
  const artistEl = document.getElementById('inspector-release-artist');
  const coverEl = document.getElementById('inspector-cover-img');
  const yearEl = document.getElementById('inspector-year-badge');
  const formatEl = document.getElementById('inspector-format-badge');
  const labelEl = document.getElementById('inspector-release-label');

  if (titleEl) titleEl.textContent = title;
  if (artistEl) artistEl.textContent = artist;
  if (coverEl) {
    coverEl.src = coverUrl;
    coverEl.style.display = coverUrl ? 'block' : 'none';
    if (coverEl.nextElementSibling) coverEl.nextElementSibling.style.display = coverUrl ? 'none' : 'flex';
  }
  if (yearEl) yearEl.textContent = year;
  if (formatEl) formatEl.textContent = formats;
  if (labelEl) labelEl.textContent = labels;

  // Goldmine condition
  const mediaCond = (listing?.mediaCondition || 'VG+').toUpperCase();
  const sleeveCond = (listing?.sleeveCondition || 'Generic').toUpperCase();
  const mediaGradeEl = document.getElementById('inspector-media-grade');
  const sleeveGradeEl = document.getElementById('inspector-sleeve-grade');
  const mediaDescEl = document.getElementById('inspector-media-desc');
  const sleeveDescEl = document.getElementById('inspector-sleeve-desc');

  if (mediaGradeEl && typeof renderGoldmineTag === 'function') {
    mediaGradeEl.innerHTML = renderGoldmineTag(mediaCond, false);
  }
  if (sleeveGradeEl && typeof renderGoldmineTag === 'function') {
    sleeveGradeEl.innerHTML = renderGoldmineTag(sleeveCond, true);
  }

  const findDesc = (cond) => {
    for (const [k, desc] of Object.entries(GOLDMINE_DESCRIPTIONS)) {
      if (cond.includes(k)) return desc;
    }
    return `Condición reportada: ${cond}`;
  };
  if (mediaDescEl) mediaDescEl.textContent = findDesc(mediaCond);
  if (sleeveDescEl) sleeveDescEl.textContent = findDesc(sleeveCond);

  // Seller comments
  const commentsBox = document.getElementById('inspector-comments-box');
  if (commentsBox) {
    const rawComments = (listing?.comments || '').trim();
    if (rawComments) {
      commentsBox.innerHTML = `“${escapeHTML(rawComments)}”`;
      commentsBox.classList.remove('text-muted-graphite', 'italic');
      commentsBox.classList.add('text-pitch-black');
    } else {
      commentsBox.innerHTML = `<em>El vendedor no incluyó notas específicas para esta copia.</em>`;
      commentsBox.classList.remove('text-pitch-black');
      commentsBox.classList.add('text-muted-graphite', 'italic');
    }
  }

  // Seller offer & pricing
  const sellerNameEl = document.getElementById('inspector-seller-name');
  const sellerMetaEl = document.getElementById('inspector-seller-meta');
  const itemPriceEl = document.getElementById('inspector-item-price');
  const btnOffer = document.getElementById('inspector-btn-discogs-offer');

  const sName = sellerName || listing?.sellerName || 'Tienda';
  const shipsFrom = seller?.shipsFrom || listing?.shipsFrom || 'Internacional';
  const rating = seller?.rating !== undefined ? seller.rating : (listing?.rating || 100);
  const ratingCount = seller?.ratingCount || listing?.ratingCount || 0;

  if (sellerNameEl) sellerNameEl.textContent = sName;
  if (sellerMetaEl) sellerMetaEl.textContent = `Envíos desde ${shipsFrom} • ${rating}% positivo (${ratingCount.toLocaleString()} votos)`;
  if (itemPriceEl && listing) {
    itemPriceEl.textContent = formatPrice(listing.priceVal, listing.currency);
  }
  if (btnOffer) {
    const targetUrl = listing?.listingUrl || (listing?.listingId ? `https://www.discogs.com/sell/item/${listing.listingId}` : `https://www.discogs.com/release/${releaseId}`);
    btnOffer.href = targetUrl;
  }

  // YouTube search button fallback
  const ytSearchBtn = document.getElementById('inspector-yt-search-btn');
  if (ytSearchBtn) {
    ytSearchBtn.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title} vinyl`)}`;
  }

  // Render initial Genres & Styles from wantInfo if already present
  renderInspectorGenres(wantInfo.genres, wantInfo.styles);

  // Prepare YouTube Player state
  const iframe = document.getElementById('inspector-youtube-iframe');
  const placeholder = document.getElementById('inspector-player-placeholder');
  const nowPlaying = document.getElementById('inspector-now-playing');
  const videoCountEl = document.getElementById('inspector-video-count');
  const videosList = document.getElementById('inspector-videos-list');

  if (iframe) iframe.src = '';
  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
      <span class="material-symbols-outlined text-4xl text-prada-red animate-pulse">headphones</span>
      <span id="inspector-player-status" class="text-xs uppercase font-mono font-bold tracking-wider">Cargando pistas de audio...</span>
    `;
  }
  if (nowPlaying) nowPlaying.textContent = 'Buscando canciones y pistas de audio...';
  if (videoCountEl) videoCountEl.textContent = '0';
  if (videosList) videosList.innerHTML = '<p class="text-[10px] text-muted-graphite p-2 font-mono">Buscando en Discogs...</p>';

  // Open modal smoothly
  modal.style.display = 'flex';

  // Fetch full release details asynchronously (cached)
  loadReleaseAudioAndGenres(releaseId, artist, title);
}

function extractYouTubeId(uri) {
  if (!uri) return '';
  const match = uri.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

function playInspectorVideo(videoId, title) {
  const iframe = document.getElementById('inspector-youtube-iframe');
  const placeholder = document.getElementById('inspector-player-placeholder');
  const nowPlaying = document.getElementById('inspector-now-playing');

  if (nowPlaying) nowPlaying.textContent = title;
  if (placeholder) placeholder.style.display = 'none';

  if (iframe && videoId) {
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
  }
}

function renderInspectorGenres(genres = [], styles = []) {
  const container = document.getElementById('inspector-genres-container');
  if (!container) return;

  const allTags = [
    ...(Array.isArray(genres) ? genres : []),
    ...(Array.isArray(styles) ? styles : [])
  ];

  if (allTags.length === 0) {
    container.innerHTML = `<span class="text-[9px] text-muted-graphite font-mono uppercase px-1">GÉNERO: VINILO / SIN ESPECIFICAR</span>`;
    return;
  }

  container.innerHTML = allTags.map(tag => `
    <span class="px-2 py-0.5 bg-pure-white border border-hairline-dark text-pitch-black text-[9px] font-mono font-bold uppercase tracking-wider shadow-2xs hover:border-prada-red transition-colors cursor-default">
      ${escapeHTML(tag)}
    </span>
  `).join('');
}

async function loadReleaseAudioAndGenres(releaseId, artist, title) {
  if (!releaseId) return;

  let releaseData = inspectorReleaseCache.get(String(releaseId));

  if (!releaseData) {
    try {
      const url = `https://api.discogs.com/releases/${releaseId}`;
      let rawJson = '';
      if (typeof fetchDirect === 'function') {
        rawJson = await fetchDirect(url);
      } else if (typeof fetchThroughTab === 'function') {
        rawJson = await fetchThroughTab(url);
      } else {
        const resp = await fetch(url);
        rawJson = await resp.text();
      }

      if (rawJson) {
        releaseData = JSON.parse(rawJson);
        inspectorReleaseCache.set(String(releaseId), releaseData);
      }
    } catch (e) {
      console.warn(`[Inspector] No se pudieron cargar detalles de release ${releaseId}:`, e.message);
    }
  }

  // Update Genres & Styles from release
  if (releaseData) {
    renderInspectorGenres(releaseData.genres, releaseData.styles);
  }

  // Process Videos
  const iframe = document.getElementById('inspector-youtube-iframe');
  const placeholder = document.getElementById('inspector-player-placeholder');
  const nowPlaying = document.getElementById('inspector-now-playing');
  const videoCountEl = document.getElementById('inspector-video-count');
  const videosList = document.getElementById('inspector-videos-list');

  const videos = (releaseData && Array.isArray(releaseData.videos)) ? releaseData.videos : [];
  if (videoCountEl) videoCountEl.textContent = String(videos.length);

  if (videos.length > 0) {
    // Populate video list
    if (videosList) {
      videosList.innerHTML = videos.map((v, i) => {
        const vId = extractYouTubeId(v.uri);
        const vTitle = v.title || `Pista #${i + 1}`;
        const durationStr = v.duration ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : '';
        return `
          <button type="button" class="btn-select-video w-full text-left p-2 border border-hairline-light bg-pure-white hover:border-prada-red hover:bg-red-50/30 flex items-center justify-between gap-2 transition-colors cursor-pointer group" data-video-id="${escapeHTML(vId)}" data-video-title="${escapeHTML(vTitle)}">
            <div class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-[15px] text-muted-graphite group-hover:text-prada-red shrink-0">play_circle</span>
              <span class="text-[11px] font-sans text-pitch-black truncate group-hover:text-prada-red font-semibold">${escapeHTML(vTitle)}</span>
            </div>
            ${durationStr ? `<span class="text-[9px] font-mono text-muted-graphite shrink-0">${durationStr}</span>` : ''}
          </button>
        `;
      }).join('');

      // Add click listeners to video items
      videosList.querySelectorAll('.btn-select-video').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const vId = btn.getAttribute('data-video-id');
          const vTitle = btn.getAttribute('data-video-title');
          playInspectorVideo(vId, vTitle);
          videosList.querySelectorAll('.btn-select-video').forEach(b => b.classList.remove('border-prada-red', 'bg-red-50/50'));
          btn.classList.add('border-prada-red', 'bg-red-50/50');
        });
      });
    }

    // Play first video automatically
    const firstVid = videos[0];
    const firstVidId = extractYouTubeId(firstVid.uri);
    if (firstVidId) {
      playInspectorVideo(firstVidId, firstVid.title || `${artist} - ${title}`);
      const firstBtn = videosList?.querySelector('.btn-select-video');
      if (firstBtn) firstBtn.classList.add('border-prada-red', 'bg-red-50/50');
    }
  } else {
    // No videos found
    if (placeholder) {
      placeholder.style.display = 'flex';
      placeholder.innerHTML = `
        <span class="material-symbols-outlined text-3xl text-muted-graphite">music_off</span>
        <span class="text-xs uppercase font-mono font-bold text-pure-white">Sin audio oficial en Discogs</span>
        <span class="text-[10px] text-muted-graphite font-sans text-center max-w-[280px]">Esta edición no cuenta con pistas de audio cargadas en Discogs.</span>
        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title} vinyl`)}" target="_blank" class="mt-2 px-3 py-1.5 bg-prada-red hover:bg-prada-red-dark text-pure-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
          <span>Buscar en YouTube</span>
          <span class="material-symbols-outlined text-[13px]">open_in_new</span>
        </a>
      `;
    }
    if (nowPlaying) nowPlaying.textContent = 'Sin audio oficial en Discogs';
    if (videosList) videosList.innerHTML = '<p class="text-[10px] text-muted-graphite p-3 font-mono text-center">No hay pistas asociadas a este release.</p>';
  }
}

function closeQuickInspector() {
  const modal = document.getElementById('quick-inspector-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  // Stop YouTube audio immediately
  const iframe = document.getElementById('inspector-youtube-iframe');
  if (iframe) {
    iframe.src = '';
  }
}
window.closeQuickInspector = closeQuickInspector;
window.openQuickInspector = openQuickInspector;

// Initialize Inspector Close Handlers
document.addEventListener('DOMContentLoaded', () => {
  const btnCloseInspector = document.getElementById('btn-close-inspector-modal');
  const btnCloseInspectorBottom = document.getElementById('btn-close-inspector-modal-bottom');
  const inspectorModal = document.getElementById('quick-inspector-modal');

  if (btnCloseInspector) btnCloseInspector.addEventListener('click', closeQuickInspector);
  if (btnCloseInspectorBottom) btnCloseInspectorBottom.addEventListener('click', closeQuickInspector);

  if (inspectorModal) {
    inspectorModal.addEventListener('click', (e) => {
      if (e.target === inspectorModal) {
        closeQuickInspector();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const inspectorModal = document.getElementById('quick-inspector-modal');
      if (inspectorModal && inspectorModal.style.display !== 'none') {
        closeQuickInspector();
      }
    }
  });
});

// Global capture listener for broken image covers (replaces inline onerror without CSP violation)
window.addEventListener('error', (e) => {
  if (e.target && e.target.tagName === 'IMG' && e.target.nextElementSibling) {
    e.target.style.display = 'none';
    e.target.nextElementSibling.style.display = 'flex';
  }
}, true);

