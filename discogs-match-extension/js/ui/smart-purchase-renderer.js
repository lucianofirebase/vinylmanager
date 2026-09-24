/**
 * Vinyl Stock Manager • Smart Purchase Bento Renderer (js/ui/smart-purchase-renderer.js)
 * Presentation layer for Option A (Max Stock) & Option B (Best Average Price) Bento Grid.
 */

(function(global) {
  'use strict';

  function escapeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  const SmartPurchaseRenderer = {
    render(filteredSellers, wants = null) {
      const smartPurchaseCard = document.getElementById('smart-purchase-card');
      if (!smartPurchaseCard) return;

      const currentWants = wants || (global.state?.wants) || [];
      const priorityIds = currentWants.filter(w => w.isPriority).map(w => w.id);
      const filterPriorityOnly = document.getElementById('filter-priority-only');
      const priorityFilterActive = filterPriorityOnly?.checked && priorityIds.length > 0;

      let targetReleases = currentWants.map(w => w.id);
      if (priorityFilterActive) {
        targetReleases = priorityIds;
      }

      const optSvc = global.OptimizerService;
      if (!optSvc || !Array.isArray(filteredSellers) || filteredSellers.length === 0) {
        smartPurchaseCard.style.display = 'none';
        return;
      }

      const candidatesData = optSvc.calculateSmartPurchaseCandidates(filteredSellers, targetReleases, currentWants.length);
      if (!candidatesData) {
        smartPurchaseCard.style.display = 'none';
        return;
      }

      const formatPrice = global.CurrencyService?.formatPrice || global.formatPrice || ((v, c) => `${v} ${c}`);
      const getCountryFlag = global.CurrencyService?.getCountryFlag || global.getCountryFlag || (() => '🌍');
      const upgradeDiscogsImageUrl = global.DiscogsParser?.upgradeDiscogsImageUrl || global.upgradeDiscogsImageUrl || ((u) => u);

      const { sellerA, sellerB } = candidatesData;
      const sA = sellerA.seller;
      const sB = sellerB.seller;

      // Gallery generator
      function generateGalleryHtml(seller, showColor) {
        let galleryHtml = '';
        const totalListings = seller.listings.length;
        const showOverflow = totalListings > 6;
        const sliceCount = showOverflow ? 5 : Math.min(totalListings, 6);
        const itemsToRender = seller.listings.slice(0, sliceCount);

        itemsToRender.forEach(l => {
          const wantInfo = currentWants.find(w => String(w.id) === String(l.releaseId)) || {};
          const coverRaw = wantInfo.image || wantInfo.cover || wantInfo.thumb || wantInfo.coverImage || l.image || '';
          const coverImg = upgradeDiscogsImageUrl(coverRaw);
          const condTag = (l.mediaCondition || 'VG+').toUpperCase();
          const condColor = condTag.includes('M') && !condTag.includes('NM')
            ? 'bg-emerald-600'
            : (condTag.includes('NM') ? 'bg-blue-600' : 'bg-amber-600');

          const imgHtml = coverImg
            ? `<img alt="${escapeHTML(wantInfo.title || 'Vinyl')}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none group-hover/cover:scale-105 transition-transform duration-300" src="${escapeHTML(coverImg)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
               <div class="w-full h-full hidden items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`
            : `<div class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`;

          galleryHtml += `
            <div class="aspect-square bg-stone-100 border border-hairline-dark relative group/cover overflow-hidden hover:${showColor === 'red' ? 'border-prada-red' : 'border-prada-blue'} transition-all shadow-xs" title="${escapeHTML((wantInfo.artist ? wantInfo.artist + ' - ' : '') + (wantInfo.title || 'Vinilo'))}">
              ${imgHtml}
              <span class="absolute bottom-1 right-1 ${condColor} text-pure-white text-[9px] font-mono font-bold px-1.5 py-0.5 shadow-sm">${escapeHTML(condTag)}</span>
            </div>
          `;
        });

        if (showOverflow) {
          const overflowCount = totalListings - 5;
          const borderClass = showColor === 'red' ? 'border-prada-red bg-prada-red-bg text-prada-red hover:bg-prada-red' : 'border-prada-blue bg-blue-50 text-prada-blue hover:bg-prada-blue';
          galleryHtml += `
            <div class="aspect-square border-2 ${borderClass} flex flex-col items-center justify-center font-mono hover:text-white transition-all cursor-pointer shadow-xs btn-scroll-to-seller group/more" data-scroll-to="${escapeHTML(seller.name)}" title="Ver todos los ${totalListings} discos de este vendedor">
              <span class="font-extrabold text-lg leading-none group-hover/more:scale-110 transition-transform">+${overflowCount}</span>
              <span class="text-[9px] uppercase tracking-wider font-bold mt-1">DISCOS</span>
            </div>
          `;
        }
        return galleryHtml;
      }

      const galleryAHtml = generateGalleryHtml(sA, 'red');
      const galleryBHtml = generateGalleryHtml(sB, 'blue');
      const avgCostA = sellerA.avgCostPerPiece || (sellerA.totalCost / Math.max(sA.listings?.length || 1, 1));

      const bentoGridHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          <!-- CARD 01: MÁXIMO STOCK / CONSOLIDACIÓN -->
          <article class="border-2 border-prada-red/70 bg-pure-white p-6 sm:p-7 flex flex-col justify-between relative group hover:border-prada-red transition-all shadow-[4px_4px_0px_rgba(224,43,32,0.08)]">
            <div class="absolute top-0 left-0 right-0 h-1.5 bg-prada-red"></div>
            <div class="flex flex-col gap-5 pt-1">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3 sm:gap-4">
                  <span class="w-10 h-10 border-2 border-pitch-black font-mono font-bold text-base flex items-center justify-center bg-ivory-warm text-pitch-black group-hover:bg-prada-red group-hover:text-pure-white transition-colors shrink-0 shadow-xs">01</span>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-[10px] font-mono tracking-wider uppercase bg-prada-red text-pure-white px-2.5 py-1 font-bold shadow-xs">OPCIÓN 1: MAYOR CATÁLOGO EN STOCK</span>
                      <span class="text-[11px] font-mono uppercase text-prada-blue font-semibold border border-blue-200 bg-blue-50 px-2 py-0.5">${getCountryFlag(sA.shipsFrom)} ${escapeHTML(sA.shipsFrom)}</span>
                      ${sA.hasFreeShippingUnlocked ? `
                        <span class="text-[10px] font-mono tracking-wider uppercase bg-emerald-700 text-pure-white px-2 py-0.5 font-bold shadow-xs flex items-center gap-1">
                          <span class="material-symbols-outlined text-[13px]">local_shipping</span> ENVÍO GRATIS DESBLOQUEADO
                        </span>
                      ` : (sA.freeShippingThreshold && sA.freeShippingThreshold.amount > 0 ? `
                        <span class="text-[10px] font-mono tracking-wider uppercase bg-blue-700 text-pure-white px-2 py-0.5 font-bold shadow-xs flex items-center gap-1">
                          <span class="material-symbols-outlined text-[13px]">local_shipping</span> ENVÍO GRATIS &gt; ${formatPrice(sA.freeShippingThreshold.amount, sA.freeShippingThreshold.currency || sA.currency)}
                        </span>
                      ` : (sellerA.shippingCost === 0 ? `
                        <span class="text-[10px] font-mono tracking-wider uppercase bg-emerald-700 text-pure-white px-2 py-0.5 font-bold shadow-xs">ENVÍO GRATIS</span>
                      ` : ''))}
                    </div>
                    <h2 class="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-tight mt-1.5 text-pitch-black">
                      ${(sA.hasFreeShippingUnlocked || (sA.freeShippingThreshold && sA.freeShippingThreshold.amount > 0) || sellerA.shippingCost === 0)
                        ? `<mark class="highlight-matched-text" style="background:#fde047; color:#000000; font-weight:900; padding:1px 6px; text-decoration:underline; text-decoration-color:#ca8a04; text-decoration-thickness:2px;">${escapeHTML(sA.name)}</mark>`
                        : escapeHTML(sA.name)}
                      <span class="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 ml-2 align-middle inline-block">${sA.rating}% ${sA.ratingCount > 0 ? `(${sA.ratingCount.toLocaleString()} VOTOS)` : 'POSITIVO'}</span>
                    </h2>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="inline-block bg-emerald-50 border border-emerald-300 text-emerald-950 font-mono font-bold text-sm px-3 py-1 tracking-wider shadow-xs">${formatPrice(avgCostA, sA.currency)} / DISCO</span>
                  <div class="font-mono text-[11px] text-prada-red font-bold uppercase tracking-wider mt-1.5 flex items-center justify-end gap-1">
                    <span>★</span> MAYOR CATÁLOGO (${sA.listings.length} DISCOS · ${sellerA.coveragePercent}%)
                  </div>
                </div>
              </div>

              <!-- Gauge -->
              <div class="border border-hairline-light p-3.5 bg-ivory-warm">
                <div class="flex justify-between items-center text-[11px] font-mono tracking-wider mb-2 uppercase">
                  <span class="text-muted-graphite font-semibold">RESOLUCIÓN DE ARCHIVO (${sA.listings.length} / ${currentWants.length} LANZAMIENTOS)</span>
                  <span class="text-prada-red font-bold">${sellerA.coveragePercent}% RESUELTO</span>
                </div>
                <div class="w-full h-2.5 bg-surface-low overflow-hidden border border-hairline-dark">
                  <div class="h-full bg-prada-red transition-all duration-500" style="width: ${Math.min(sellerA.coveragePercent, 100)}%;"></div>
                </div>
              </div>

              <!-- Gallery -->
              <div class="flex flex-col gap-2.5">
                <div class="flex justify-between text-[11px] font-mono tracking-wider uppercase text-muted-graphite font-semibold">
                  <span>MUESTRA DE LOTE DISCOGRÁFICO</span>
                  <span class="text-prada-blue font-bold">STOCK CURADO DISPONIBLE</span>
                </div>
                <div class="grid grid-cols-6 gap-2 sm:gap-2.5">
                  ${galleryAHtml}
                </div>
              </div>

              <!-- Receipt -->
              <div class="grid grid-cols-3 border border-hairline-dark py-3 font-mono bg-ivory-warm px-3 shadow-xs">
                <div>
                  <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">SUBTOTAL DISCOS</span>
                  <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(sellerA.subtotal, sA.currency)}</span>
                </div>
                <div class="border-l border-hairline-light pl-4">
                  <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">ENVÍO CONSOLIDADO</span>
                  <span class="font-bold text-sm sm:text-base tracking-tight text-prada-blue">${sellerA.shippingCost === 0 ? '<span class="text-emerald-700">GRATIS ($0.00)</span>' : formatPrice(sellerA.shippingCost, sA.currency)}</span>
                </div>
                <div class="border-l border-hairline-light pl-4 bg-prada-red-bg px-2 py-0.5">
                  <span class="text-[10px] uppercase tracking-wider text-prada-red font-bold block">AHORRO EN FLETE</span>
                  <span class="font-bold text-base sm:text-lg tracking-tight text-prada-red">-$${sellerA.estSavings.toFixed(2)} <span class="text-[11px] font-normal">USD</span></span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 pt-5 mt-4">
              <button class="btn-scroll-to-seller flex-1 bg-prada-red text-pure-white hover:bg-prada-red-dark text-xs font-mono font-bold py-3 uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer" data-scroll-to="${escapeHTML(sA.name)}" type="button">
                <span class="material-symbols-outlined text-[16px]">inventory_2</span>
                <span>EXAMINAR LOTE (${sA.listings.length} DISCOS)</span>
              </button>
              <a class="border-2 border-pitch-black text-pitch-black hover:bg-surface-low px-5 py-3 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 font-bold cursor-pointer shrink-0" href="https://www.discogs.com/seller/${encodeURIComponent(sA.name)}/mywants" target="_blank" rel="noreferrer">
                <span>VER EN DISCOGS</span>
                <span class="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
          </article>

          <!-- CARD 02: LOTE MÁS ECONÓMICO -->
          <article class="border-2 border-prada-blue/70 bg-pure-white p-6 sm:p-7 flex flex-col justify-between relative group hover:border-prada-blue transition-all shadow-[4px_4px_0px_rgba(29,78,216,0.08)]">
            <div class="absolute top-0 left-0 right-0 h-1.5 bg-prada-blue"></div>
            <div class="flex flex-col gap-5 pt-1">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3 sm:gap-4">
                  <span class="w-10 h-10 border-2 border-pitch-black font-mono font-bold text-base flex items-center justify-center bg-ivory-warm text-pitch-black group-hover:bg-prada-blue group-hover:text-pure-white transition-colors shrink-0 shadow-xs">02</span>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-[10px] font-mono tracking-wider uppercase bg-prada-blue text-pure-white px-2.5 py-1 font-bold shadow-xs">OPCIÓN 2: LOTE MÁS ECONÓMICO</span>
                      <span class="text-[11px] font-mono uppercase text-prada-blue font-semibold border border-blue-200 bg-blue-50 px-2 py-0.5">${getCountryFlag(sB.shipsFrom)} ${escapeHTML(sB.shipsFrom)}</span>
                      ${sB.hasFreeShippingUnlocked ? `
                        <span class="text-[10px] font-mono tracking-wider uppercase bg-emerald-700 text-pure-white px-2 py-0.5 font-bold shadow-xs flex items-center gap-1">
                          <span class="material-symbols-outlined text-[13px]">local_shipping</span> ENVÍO GRATIS DESBLOQUEADO
                        </span>
                      ` : (sB.freeShippingThreshold && sB.freeShippingThreshold.amount > 0 ? `
                        <span class="text-[10px] font-mono tracking-wider uppercase bg-blue-700 text-pure-white px-2 py-0.5 font-bold shadow-xs flex items-center gap-1">
                          <span class="material-symbols-outlined text-[13px]">local_shipping</span> ENVÍO GRATIS &gt; ${formatPrice(sB.freeShippingThreshold.amount, sB.freeShippingThreshold.currency || sB.currency)}
                        </span>
                      ` : (sellerB.shippingCost === 0 ? `
                        <span class="text-[10px] font-mono tracking-wider uppercase bg-emerald-700 text-pure-white px-2 py-0.5 font-bold shadow-xs">ENVÍO GRATIS</span>
                      ` : ''))}
                    </div>
                    <h2 class="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-tight mt-1.5 text-pitch-black">
                      ${(sB.hasFreeShippingUnlocked || (sB.freeShippingThreshold && sB.freeShippingThreshold.amount > 0) || sellerB.shippingCost === 0)
                        ? `<mark class="highlight-matched-text" style="background:#fde047; color:#000000; font-weight:900; padding:1px 6px; text-decoration:underline; text-decoration-color:#ca8a04; text-decoration-thickness:2px;">${escapeHTML(sB.name)}</mark>`
                        : escapeHTML(sB.name)}
                      <span class="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 ml-2 align-middle inline-block">${sB.rating}% ${sB.ratingCount > 0 ? `(${sB.ratingCount.toLocaleString()} VOTOS)` : 'POSITIVO'}</span>
                    </h2>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="inline-block bg-emerald-50 border border-emerald-300 text-emerald-950 font-mono font-bold text-sm px-3 py-1 tracking-wider shadow-xs">${formatPrice(sellerB.avgCostPerPiece, sB.currency)} / DISCO</span>
                  <div class="font-mono text-[11px] text-emerald-800 font-bold uppercase tracking-wider mt-1.5 flex items-center justify-end gap-1">
                    <span>★</span> MENOR PRECIO PROMEDIO (${sB.listings.length} DISCOS)
                  </div>
                </div>
              </div>

              <!-- Gallery B -->
              <div class="flex flex-col gap-2.5">
                <div class="flex justify-between text-[11px] font-mono tracking-wider uppercase text-muted-graphite font-semibold">
                  <span>MUESTRA DE LOTE DISCOGRÁFICO</span>
                  <span class="text-prada-blue font-bold">STOCK MÁS ECONÓMICO</span>
                </div>
                <div class="grid grid-cols-6 gap-2 sm:gap-2.5">
                  ${galleryBHtml}
                </div>
              </div>

              <!-- Financial Metrics Grid -->
              <div class="grid grid-cols-4 border border-hairline-dark py-3 font-mono bg-ivory-warm px-3 shadow-xs">
                <div>
                  <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">MEDIA / PIEZA</span>
                  <span class="font-bold text-sm sm:text-base tracking-tight text-emerald-800">${formatPrice(sellerB.avgCostPerPiece, sB.currency)}</span>
                </div>
                <div class="border-l border-hairline-light pl-3">
                  <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">SUBTOTAL</span>
                  <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(sellerB.subtotal, sB.currency)}</span>
                </div>
                <div class="border-l border-hairline-light pl-3">
                  <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">FLETE</span>
                  <span class="font-bold text-sm sm:text-base tracking-tight text-prada-blue">${sellerB.shippingCost === 0 ? '<span class="text-emerald-700">GRATIS ($0.00)</span>' : formatPrice(sellerB.shippingCost, sB.currency)}</span>
                </div>
                <div class="border-l border-hairline-light pl-3 bg-blue-50/60 px-2 py-0.5">
                  <span class="text-[10px] uppercase tracking-wider text-prada-blue font-bold block">TOTAL LOTE</span>
                  <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(sellerB.totalCost, sB.currency)}</span>
                </div>
              </div>

              <div class="border border-emerald-300 bg-prada-emerald-bg p-3.5 flex items-start gap-2.5">
                <span class="material-symbols-outlined text-[20px] text-prada-emerald shrink-0 mt-0.5">verified</span>
                <p class="font-mono text-xs text-emerald-950 leading-relaxed font-medium">
                  ESTADO CERTIFICADO: VINILOS VERIFICADOS CON GARANTÍA DIRECTA Y PROTECCIÓN DE COMPRA EN DISCOGS MARKETPLACE.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 pt-5 mt-4">
              <button class="btn-scroll-to-seller flex-1 bg-prada-blue-night hover:bg-prada-blue text-pure-white text-xs font-mono font-bold py-3 uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer" data-scroll-to="${escapeHTML(sB.name)}" type="button">
                <span class="material-symbols-outlined text-[16px]">inventory_2</span>
                <span>EXAMINAR LOTE (${sB.listings.length} DISCOS)</span>
              </button>
              <a class="border-2 border-pitch-black text-pitch-black hover:bg-surface-low px-5 py-3 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 font-bold cursor-pointer shrink-0" href="https://www.discogs.com/seller/${encodeURIComponent(sB.name)}/mywants" target="_blank" rel="noreferrer">
                <span>VER EN DISCOGS</span>
                <span class="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
          </article>
        </div>
      `;

      smartPurchaseCard.className = 'smart-purchase-card w-full mb-8';
      smartPurchaseCard.innerHTML = bentoGridHtml;
      smartPurchaseCard.style.display = 'block';

      // Attach scroll-to listener
      smartPurchaseCard.querySelectorAll('[data-scroll-to]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const sellerName = link.getAttribute('data-scroll-to');
          if (!sellerName) return;

          if (typeof global.expandSellerCard === 'function') {
            global.expandSellerCard(sellerName);
          }

          const targetCard = document.getElementById('seller-card-' + sellerName);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      });
    }
  };

  global.SmartPurchaseRenderer = SmartPurchaseRenderer;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartPurchaseRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
