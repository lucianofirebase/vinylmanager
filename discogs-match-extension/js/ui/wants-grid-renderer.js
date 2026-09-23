/**
 * Vinyl Stock Manager • Wants Grid Renderer (js/ui/wants-grid-renderer.js)
 * Presentation layer for the Wantlist Crate catalog, favorites (★), and archival pagination.
 */

(function(global) {
  'use strict';

  let wantsCurrentPage = 1;
  let wantsPageSize = 48;

  function escapeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  const WantsGridRenderer = {
    getCurrentPage() { return wantsCurrentPage; },
    setCurrentPage(p) { wantsCurrentPage = p; },
    getPageSize() { return wantsPageSize; },
    setPageSize(s) { wantsPageSize = s; },

    renderWantsListInManager(resetPage = false) {
      if (resetPage) wantsCurrentPage = 1;
      if (typeof global.updatePriorityFilterUI === 'function') {
        global.updatePriorityFilterUI();
      }

      const wantsListGrid = document.getElementById('wants-list-grid');
      const paginationBar = document.getElementById('wants-pagination-bar');
      if (!wantsListGrid) return;

      wantsListGrid.innerHTML = '';
      const wantsSearchInput = document.getElementById('wants-search-input');
      const searchVal = (wantsSearchInput ? wantsSearchInput.value : '').toLowerCase().trim();

      const wants = (global.appStore ? global.appStore.getState().wants : global.state?.wants) || [];
      const filteredWants = wants.filter(w => {
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

      const totalItems = filteredWants.length;
      const isAll = wantsPageSize === 'all';
      const pageSizeNum = isAll ? totalItems : (parseInt(wantsPageSize, 10) || 48);
      const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / pageSizeNum));

      if (wantsCurrentPage > totalPages) wantsCurrentPage = totalPages;
      if (wantsCurrentPage < 1) wantsCurrentPage = 1;

      const startIndex = isAll ? 0 : (wantsCurrentPage - 1) * pageSizeNum;
      const endIndex = isAll ? totalItems : Math.min(startIndex + pageSizeNum, totalItems);
      const itemsToRender = filteredWants.slice(startIndex, endIndex);

      const upgradeUrl = global.DiscogsParser?.upgradeDiscogsImageUrl || global.upgradeDiscogsImageUrl || ((u) => u);

      itemsToRender.forEach((item, index) => {
        const card = document.createElement('div');
        const isChecked = item.isPriority ? 'checked' : '';
        const starId = `star-want-${item.id || index}`;

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

        const isPurchased = typeof global.isReleasePurchased === 'function' && global.isReleasePurchased(item.id, displayTitle, displayArtist);

        card.className = `record-card record-card-animated bg-pure-white border border-hairline-dark p-2.5 flex flex-col items-center relative transition-all duration-200 hover:shadow-md cursor-pointer ${item.isPriority ? 'active-priority' : ''} ${isPurchased ? 'is-purchased-card' : ''}`;
        card.style.animationDelay = `${Math.min(index * 0.02, 0.5)}s`;
        card.dataset.title = displayTitle.toLowerCase();
        card.dataset.artist = displayArtist.toLowerCase();

        card.innerHTML = `
          <div class="record-hover-tooltip">
            <p class="font-bold mb-0.5 leading-snug">${escapeHTML(displayTitle)}</p>
            <p class="text-zinc-400 text-[10px] leading-tight">${escapeHTML(displayArtist)}</p>
          </div>
          <div class="record-card-top-actions absolute top-2 right-2 flex items-center gap-1 z-10">
            <button type="button" class="record-purchased-btn ${isPurchased ? 'active' : ''}" aria-label="Marcar como comprado" data-tooltip="${isPurchased ? 'En tu colección (Click para quitar)' : 'Marcar como ya comprado'}" data-tooltip-pos="top">
              <span class="material-symbols-outlined purchased-icon text-[15px]">${isPurchased ? 'check_circle' : 'shopping_bag'}</span>
            </button>
            <button type="button" class="record-star-btn ${item.isPriority ? 'active' : ''}" aria-label="Priorizar disco" data-tooltip="${item.isPriority ? 'Quitar de prioritarios' : 'Destacar disco favorito'}" data-tooltip-pos="top">
              <span class="material-symbols-outlined star-icon" style="font-variation-settings: 'FILL' ${item.isPriority ? 1 : 0};">star</span>
            </button>
          </div>
          <input type="checkbox" id="${starId}" class="star-checkbox sr-only" ${isChecked}>
          <div class="record-cover-wrapper w-full aspect-square bg-surface-low mb-2 overflow-hidden border border-hairline-light flex items-center justify-center relative shadow-xs">
            ${item.image ? `<img src="${upgradeUrl(item.image)}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none transition-transform duration-300 hover:scale-105" alt="${escapeHTML(displayTitle)}" loading="lazy">` : `<span class="material-symbols-outlined text-3xl text-muted-graphite">album</span>`}
            ${isPurchased ? `
              <div class="record-purchased-overlay-tag absolute bottom-1 left-1 bg-pitch-black/90 text-pure-white text-[9px] font-mono font-bold px-1.5 py-0.5 tracking-wider uppercase border border-white/20 flex items-center gap-1 shadow-sm">
                <span class="w-1.5 h-1.5 bg-emerald-400"></span> COMPRADO
              </div>
            ` : ''}
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
        const purchasedBtn = card.querySelector('.record-purchased-btn');

        if (purchasedBtn) {
          purchasedBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const currentlyPurchased = global.isReleasePurchased?.(item.id, displayTitle, displayArtist);
            if (currentlyPurchased) {
              global.unmarkPurchased?.(item.id || displayTitle);
              global.showToast?.(`Disco removido de 'Comprados': ${displayTitle}`, 'info');
            } else {
              global.markAsPurchased?.({
                id: item.id,
                title: displayTitle,
                artist: displayArtist,
                year: item.year || '',
                image: item.image || '',
                format: 'Vinyl'
              });
              global.showToast?.(`✓ ¡Añadido a 'Discos Comprados'!: ${displayTitle}`, 'success');
            }
            WantsGridRenderer.renderWantsListInManager();
          });
        }

        const toggleStar = (e) => {
          if (e) {
            e.stopPropagation();
            e.preventDefault();
          }
          item.isPriority = !item.isPriority;
          if (typeof global.updatePriorityFilterUI === 'function') {
            global.updatePriorityFilterUI();
          }
          if (starCheckbox) starCheckbox.checked = item.isPriority;
          if (starBtn) {
            starBtn.classList.toggle('active', item.isPriority);
            starBtn.setAttribute('data-tooltip', item.isPriority ? 'Quitar de prioritarios' : 'Destacar disco favorito');
            starBtn.title = item.isPriority ? 'Quitar prioridad' : 'Marcar como prioritario';
          }
          if (starIcon) {
            starIcon.style.fontVariationSettings = `'FILL' ${item.isPriority ? 1 : 0}`;
          }
          card.classList.toggle('active-priority', item.isPriority);

          if (item.isPriority && global.Motion?.starBurst) {
            global.Motion.starBurst(starBtn || card, true);
          }
        };

        if (starBtn) {
          starBtn.addEventListener('click', (e) => toggleStar(e));
        }
        card.addEventListener('click', (e) => {
          if (e.target.closest('.record-star-btn') || e.target.closest('.record-purchased-btn')) return;
          toggleStar(e);
        });

        wantsListGrid.appendChild(card);
      });

      if (paginationBar) {
        WantsGridRenderer.renderPaginationBar(paginationBar, totalItems, totalPages, startIndex, endIndex);
      }
    },

    renderPaginationBar(container, totalItems, totalPages, startIndex, endIndex) {
      if (totalItems <= 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }
      container.style.display = 'block';

      const pagesToShow = [];
      if (totalPages <= 7) {
        for (let p = 1; p <= totalPages; p++) pagesToShow.push(p);
      } else {
        pagesToShow.push(1);
        if (wantsCurrentPage > 3) pagesToShow.push('ellipsis-1');
        const windowStart = Math.max(2, wantsCurrentPage - 1);
        const windowEnd = Math.min(totalPages - 1, wantsCurrentPage + 1);
        for (let p = windowStart; p <= windowEnd; p++) {
          if (!pagesToShow.includes(p)) pagesToShow.push(p);
        }
        if (wantsCurrentPage < totalPages - 2) pagesToShow.push('ellipsis-2');
        if (!pagesToShow.includes(totalPages)) pagesToShow.push(totalPages);
      }

      const chipsHtml = pagesToShow.map(p => {
        if (typeof p === 'string' && p.startsWith('ellipsis')) {
          return `<span class="w-6 h-8 flex items-center justify-center text-muted-graphite font-mono text-xs select-none">…</span>`;
        }
        if (p === wantsCurrentPage) {
          return `<button type="button" class="w-8 h-8 flex items-center justify-center bg-pitch-black text-pure-white font-mono font-extrabold text-xs border border-pitch-black shadow-xs cursor-default relative" aria-current="page">${p}</button>`;
        }
        return `<button type="button" class="btn-wants-goto-page w-8 h-8 flex items-center justify-center bg-pure-white hover:bg-surface-low text-pitch-black font-mono font-medium text-xs border border-hairline-dark transition-colors cursor-pointer" data-page="${p}">${p}</button>`;
      }).join('');

      container.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-hairline-dark">
          <div class="font-mono text-xs text-muted-graphite">
            MOSTRANDO <strong class="text-pitch-black">${startIndex + 1}</strong>–<strong class="text-pitch-black">${endIndex}</strong> DE <strong class="text-pitch-black">${totalItems}</strong> DISCOS
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-wants-prev-page px-2 h-8 border border-hairline-dark bg-pure-white font-mono text-xs flex items-center gap-1 ${wantsCurrentPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-pitch-black hover:text-white cursor-pointer'}" ${wantsCurrentPage <= 1 ? 'disabled' : ''}>
              <span class="material-symbols-outlined text-[16px]">chevron_left</span> ANT
            </button>
            ${chipsHtml}
            <button type="button" class="btn-wants-next-page px-2 h-8 border border-hairline-dark bg-pure-white font-mono text-xs flex items-center gap-1 ${wantsCurrentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-pitch-black hover:text-white cursor-pointer'}" ${wantsCurrentPage >= totalPages ? 'disabled' : ''}>
              SIG <span class="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      `;

      container.querySelectorAll('.btn-wants-goto-page').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetP = parseInt(btn.getAttribute('data-page'), 10);
          if (targetP && targetP !== wantsCurrentPage) {
            wantsCurrentPage = targetP;
            WantsGridRenderer.renderWantsListInManager();
          }
        });
      });

      const prevBtn = container.querySelector('.btn-wants-prev-page');
      if (prevBtn && !prevBtn.disabled) {
        prevBtn.addEventListener('click', () => {
          if (wantsCurrentPage > 1) {
            wantsCurrentPage--;
            WantsGridRenderer.renderWantsListInManager();
          }
        });
      }

      const nextBtn = container.querySelector('.btn-wants-next-page');
      if (nextBtn && !nextBtn.disabled) {
        nextBtn.addEventListener('click', () => {
          if (wantsCurrentPage < totalPages) {
            wantsCurrentPage++;
            WantsGridRenderer.renderWantsListInManager();
          }
        });
      }
    }
  };

  global.WantsGridRenderer = WantsGridRenderer;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WantsGridRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
