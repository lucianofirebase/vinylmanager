/**
 * Vinyl Stock Manager • UI Renderers Module (js/renderers.js)
 * Seller rankings directory, Wantlist crate cards, animated counters, statistics & toasts
 */

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


// Render loaded wants list inside Wantlist Manager for marking favorites (★)
// Pagination state for Wantlist Manager
let wantsCurrentPage = 1;
let wantsPageSize = 48; // default 48 per page; can be 24, 48, 96, or 'all'

function renderWantsListInManager(resetPage = false) {
  if (resetPage) wantsCurrentPage = 1;
  updatePriorityFilterUI();
  const wantsListGrid = document.getElementById('wants-list-grid');
  const paginationBar = document.getElementById('wants-pagination-bar') || wantsPaginationBar;
  if (!wantsListGrid) return;
  
  wantsListGrid.innerHTML = '';
  const searchVal = (wantsSearchInput ? wantsSearchInput.value : '').toLowerCase().trim();
  
  const filteredWants = state.wants.filter(w => {
    if (!searchVal) return true;
    return (w.title || '').toLowerCase().includes(searchVal) || (w.artist || '').toLowerCase().includes(searchVal);
  });

  if (filteredWants.length === 0) {
    wantsListGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--tertiary); padding: 30px;" class="text-body-md font-mono text-xs uppercase text-muted-graphite">No se encontraron vinilos en la búsqueda.</p>`;
    if (paginationBar) {
      paginationBar.style.display = 'none';
      paginationBar.innerHTML = '';
    }
    return;
  }

  // Calculate pagination metrics
  const totalItems = filteredWants.length;
  const isAll = wantsPageSize === 'all';
  const pageSizeNum = isAll ? totalItems : (parseInt(wantsPageSize, 10) || 48);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / pageSizeNum));

  if (wantsCurrentPage > totalPages) wantsCurrentPage = totalPages;
  if (wantsCurrentPage < 1) wantsCurrentPage = 1;

  const startIndex = isAll ? 0 : (wantsCurrentPage - 1) * pageSizeNum;
  const endIndex = isAll ? totalItems : Math.min(startIndex + pageSizeNum, totalItems);
  const itemsToRender = filteredWants.slice(startIndex, endIndex);

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

  // Render Archival Pagination Bar
  if (paginationBar) {
    renderWantsPaginationBar(paginationBar, totalItems, totalPages, startIndex, endIndex);
  }

  // Patch star burst microanimations after render
  if (window.Motion) {
    requestAnimationFrame(() => window.Motion.patchStarCards());
  }
}

function renderWantsPaginationBar(container, totalItems, totalPages, startIndex, endIndex) {
  if (totalItems <= 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  container.style.display = 'block';

  // Build page numbers (smart window)
  const pagesToShow = [];
  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p++) pagesToShow.push(p);
  } else {
    pagesToShow.push(1);
    if (wantsCurrentPage > 3) {
      pagesToShow.push('ellipsis-1');
    }
    const windowStart = Math.max(2, wantsCurrentPage - 1);
    const windowEnd = Math.min(totalPages - 1, wantsCurrentPage + 1);
    for (let p = windowStart; p <= windowEnd; p++) {
      if (!pagesToShow.includes(p)) pagesToShow.push(p);
    }
    if (wantsCurrentPage < totalPages - 2) {
      pagesToShow.push('ellipsis-2');
    }
    if (!pagesToShow.includes(totalPages)) {
      pagesToShow.push(totalPages);
    }
  }

  const chipsHtml = pagesToShow.map(p => {
    if (typeof p === 'string' && p.startsWith('ellipsis')) {
      return `<span class="w-6 h-8 flex items-center justify-center text-muted-graphite font-mono text-xs select-none">…</span>`;
    }
    if (p === wantsCurrentPage) {
      return `
        <button type="button" class="w-8 h-8 flex items-center justify-center bg-pitch-black text-pure-white font-mono font-extrabold text-xs border border-pitch-black shadow-xs cursor-default relative">
          <span class="absolute top-0 left-0 right-0 h-0.5 bg-prada-red"></span>
          ${p}
        </button>
      `;
    }
    return `
      <button type="button" class="wants-page-btn w-8 h-8 flex items-center justify-center bg-pure-white hover:bg-surface-low text-pitch-black font-mono font-semibold text-xs border border-hairline-dark hover:border-pitch-black transition-colors cursor-pointer" data-page="${p}" title="Ir a la página ${p}">
        ${p}
      </button>
    `;
  }).join('');

  const sizes = [24, 48, 96, 'all'];
  const sizeChipsHtml = sizes.map(s => {
    const label = s === 'all' ? 'TODOS' : s;
    const isSelected = wantsPageSize === s || (s === 'all' && wantsPageSize === 'all');
    if (isSelected) {
      return `<span class="bg-pitch-black text-pure-white font-mono font-bold text-[10px] px-2.5 py-1 uppercase tracking-wider select-none">${label}</span>`;
    }
    return `<button type="button" class="wants-size-btn bg-pure-white hover:bg-surface-low text-pitch-black font-mono text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wider border-l border-hairline-dark transition-colors cursor-pointer" data-size="${s}">${label}</button>`;
  }).join('');

  container.innerHTML = `
    <div class="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-pure-white border border-hairline-dark font-mono shadow-xs">
      <!-- Left: Item Count & Range Info -->
      <div class="flex items-center gap-2 text-xs text-muted-graphite tracking-wide">
        <span class="inline-block w-2 h-2 bg-prada-red shrink-0 shadow-xs"></span>
        <span>MOSTRANDO <strong class="text-pitch-black font-bold font-mono">${totalItems === 0 ? 0 : startIndex + 1} - ${endIndex}</strong> DE <strong class="text-pitch-black font-bold font-mono">${totalItems}</strong> DISCOS</span>
        <span class="text-neutral-400">|</span>
        <span>PÁGINA <strong class="text-pitch-black font-bold font-mono">${wantsCurrentPage}</strong> DE <strong class="text-pitch-black font-bold font-mono">${totalPages}</strong></span>
      </div>

      <!-- Center: Navigation Buttons (Previous, Chips, Next) -->
      <div class="flex items-center gap-1.5 flex-wrap justify-center">
        <!-- First Page -->
        <button type="button" class="wants-page-btn px-2 h-8 border border-hairline-dark bg-pure-white hover:bg-surface-low text-pitch-black text-xs font-mono font-bold uppercase transition-colors hover:border-pitch-black disabled:opacity-25 disabled:pointer-events-none cursor-pointer flex items-center justify-center" data-page="1" ${wantsCurrentPage === 1 ? 'disabled' : ''} title="Primera página">
          <span class="material-symbols-outlined text-[16px] leading-none">first_page</span>
        </button>

        <!-- Previous -->
        <button type="button" class="wants-page-btn px-2.5 h-8 border border-hairline-dark bg-pure-white hover:bg-surface-low text-pitch-black text-xs font-mono font-bold uppercase transition-colors hover:border-pitch-black disabled:opacity-25 disabled:pointer-events-none cursor-pointer flex items-center gap-1" data-page="${wantsCurrentPage - 1}" ${wantsCurrentPage === 1 ? 'disabled' : ''} title="Página anterior">
          <span class="material-symbols-outlined text-[15px] leading-none">chevron_left</span>
          <span class="hidden sm:inline text-[10px] tracking-wider">ANT</span>
        </button>

        <!-- Page Chips -->
        ${chipsHtml}

        <!-- Next -->
        <button type="button" class="wants-page-btn px-2.5 h-8 border border-hairline-dark bg-pure-white hover:bg-surface-low text-pitch-black text-xs font-mono font-bold uppercase transition-colors hover:border-pitch-black disabled:opacity-25 disabled:pointer-events-none cursor-pointer flex items-center gap-1" data-page="${wantsCurrentPage + 1}" ${wantsCurrentPage === totalPages ? 'disabled' : ''} title="Página siguiente">
          <span class="hidden sm:inline text-[10px] tracking-wider">SIG</span>
          <span class="material-symbols-outlined text-[15px] leading-none">chevron_right</span>
        </button>

        <!-- Last Page -->
        <button type="button" class="wants-page-btn px-2 h-8 border border-hairline-dark bg-pure-white hover:bg-surface-low text-pitch-black text-xs font-mono font-bold uppercase transition-colors hover:border-pitch-black disabled:opacity-25 disabled:pointer-events-none cursor-pointer flex items-center justify-center" data-page="${totalPages}" ${wantsCurrentPage === totalPages ? 'disabled' : ''} title="Última página (${totalPages})">
          <span class="material-symbols-outlined text-[16px] leading-none">last_page</span>
        </button>
      </div>

      <!-- Right: Page Size Selector -->
      <div class="flex items-center gap-2 text-xs">
        <span class="text-muted-graphite uppercase text-[10px] tracking-wider font-mono hidden md:inline">VER:</span>
        <div class="inline-flex border border-hairline-dark overflow-hidden">
          ${sizeChipsHtml}
        </div>
      </div>
    </div>
  `;

  // Attach click events to page buttons
  container.querySelectorAll('.wants-page-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = parseInt(btn.dataset.page, 10);
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages && targetPage !== wantsCurrentPage) {
        wantsCurrentPage = targetPage;
        renderWantsListInManager(false);
        const scrollTarget = document.querySelector('.wantlist-toolbar') || document.getElementById('wants-list-grid');
        if (scrollTarget) {
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // Attach click events to size buttons
  container.querySelectorAll('.wants-size-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const newSize = btn.dataset.size;
      wantsPageSize = newSize === 'all' ? 'all' : (parseInt(newSize, 10) || 48);
      wantsCurrentPage = 1;
      renderWantsListInManager(false);
      const scrollTarget = document.querySelector('.wantlist-toolbar') || document.getElementById('wants-list-grid');
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function filterWantsInManager() {
  renderWantsListInManager(true);
}

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
    
    if (typeof COUNTRY_CONFIG !== 'undefined') {
      for (const countryKey in COUNTRY_CONFIG) {
        if (countryKey === 'Other') continue;
        const cfg = COUNTRY_CONFIG[countryKey];
        if (lower.includes(countryKey.toLowerCase())) {
          clean = countryKey;
          break;
        }
        if (Array.isArray(cfg.aliases)) {
          const matched = cfg.aliases.some(a => {
            if (a.length === 2) {
              return new RegExp(`(^|[^a-z])${a}([^a-z]|$)`, 'i').test(lower);
            }
            return lower.includes(a);
          });
          if (matched) {
            clean = countryKey;
            break;
          }
        }
      }
    }
    
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


function setGridDensity(density) {
  const wantsGrid = document.getElementById('wants-list-grid');
  const btnDensityCompact = document.getElementById('btn-density-compact');
  const btnDensityStandard = document.getElementById('btn-density-standard');
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
}
window.setGridDensity = setGridDensity;
window.renderResults = renderResults;
window.showToast = showToast;
window.showWantlistManager = showWantlistManager;
