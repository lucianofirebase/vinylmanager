/**
 * Vinyl Stock Manager • Purchase Optimizer Module (js/optimizer.js)
 * Multi-vendor smart purchase calculations, shipping amortizations, bento card generation
 */

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
          const estimatedShipping = calculateSellerShipping(s, assignedListings);
          
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


function calculateWishlistCompletaStats(filteredSellers, targetReleases) {
  const cheapestListingsMap = new Map();
  
  targetReleases.forEach(relId => {
    let cheapest = null;
    let cheapestUSD = Infinity;
    
    filteredSellers.forEach(seller => {
      seller.listings.forEach(l => {
        if (l.releaseId === relId) {
          const rate = CURRENCY_MAP[l.currency]?.rate || 1.0;
          const priceUSD = l.priceVal * rate;
          if (priceUSD < cheapestUSD) {
            cheapestUSD = priceUSD;
            cheapest = { listing: l, seller: seller };
          }
        }
      });
    });
    
    if (cheapest) {
      cheapestListingsMap.set(relId, cheapest);
    }
  });
  
  if (cheapestListingsMap.size === 0) return null;
  
  const sellerAssignments = new Map();
  let totalDiscsPriceUSD = 0;
  
  cheapestListingsMap.forEach((val, relId) => {
    const sellerName = val.seller.name;
    if (!sellerAssignments.has(sellerName)) {
      sellerAssignments.set(sellerName, { seller: val.seller, listings: [] });
    }
    sellerAssignments.get(sellerName).listings.push(val.listing);
    
    const rate = CURRENCY_MAP[val.listing.currency]?.rate || 1.0;
    totalDiscsPriceUSD += val.listing.priceVal * rate;
  });
  
  let totalShippingUSD = 0;
  sellerAssignments.forEach((data, sellerName) => {
    const shippingInSellerCurrency = calculateSellerShipping(data.seller, data.listings);
    const rate = CURRENCY_MAP[data.seller.currency]?.rate || 1.0;
    totalShippingUSD += shippingInSellerCurrency * rate;
  });
  
  const totalCostUSD = totalDiscsPriceUSD + totalShippingUSD;
  
  return {
    coveredCount: cheapestListingsMap.size,
    totalReleasesCount: targetReleases.length,
    discsPriceUSD: totalDiscsPriceUSD,
    shippingUSD: totalShippingUSD,
    totalCostUSD: totalCostUSD,
    sellersCount: sellerAssignments.size
  };
}


function renderSmartPurchase(filteredSellers) {
  const smartPurchaseCard = document.getElementById('smart-purchase-card');
  if (!smartPurchaseCard) return;

  const priorityIds = state.wants.filter(w => w.isPriority).map(w => w.id);
  const priorityFilterActive = filterPriorityOnly.checked && priorityIds.length > 0;
  
  let targetReleases = state.wants.map(w => w.id);
  if (priorityFilterActive) {
    targetReleases = priorityIds;
  }
  
  const wishlistStats = calculateWishlistCompletaStats(filteredSellers, targetReleases);
  
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
    const rateA = CURRENCY_MAP[a.currency]?.rate || 1.0;
    const rateB = CURRENCY_MAP[b.currency]?.rate || 1.0;
    const costA = a.totalPrice * rateA;
    const costB = b.totalPrice * rateB;
    return costA - costB;
  });
  
  const topSellersA = candidatesA.slice(0, 3);

  // Calculate Option B: Best average cost per disc (Efficiency, minimum of 3 discs)
  const eligibleB = filteredSellers.filter(s => s.listings.length >= 3);
  let candidatesBSorted = [];
  
  const mapAndSortB = (sellersList) => {
    return [...sellersList].map(s => {
      const avgCost = s.totalPrice / s.listings.length;
      const rate = CURRENCY_MAP[s.currency]?.rate || 1.0;
      const avgCostUSD = avgCost * rate;
      return { seller: s, avgCostUSD };
    }).sort((a, b) => a.avgCostUSD - b.avgCostUSD).map(c => c.seller);
  };
  
  if (eligibleB.length > 0) {
    candidatesBSorted = mapAndSortB(eligibleB);
  } else {
    const eligibleB2 = filteredSellers.filter(s => s.listings.length >= 2);
    if (eligibleB2.length > 0) {
      candidatesBSorted = mapAndSortB(eligibleB2);
    } else {
      candidatesBSorted = mapAndSortB(filteredSellers);
    }
  }
  
  const topSellersB = candidatesBSorted.slice(0, 3);

  if (topSellersA.length === 0) {
    smartPurchaseCard.style.display = 'none';
    return;
  }

  // Helper function to render Stitch Luxury Bento Grid (Option A and Option B)
  const sellerA = topSellersA[0];
  const subtotalA = sellerA.listings.reduce((sum, l) => sum + l.priceVal, 0);
  const totalCostA = sellerA.totalPrice;
  const shippingCostA = Math.max(totalCostA - subtotalA, 0);
  const estSavingsA = Math.max((sellerA.listings.length - 1) * 18.50, 24);
  const coveragePercentA = ((sellerA.listings.length / Math.max(state.wants.length, 1)) * 100).toFixed(2);

  // 6 visual covers for Option A (up to 5 covers + 1 overflow tile if > 6)
  let galleryAHtml = '';
  const totalListingsA = sellerA.listings.length;
  const showOverflowA = totalListingsA > 6;
  const sliceCountA = showOverflowA ? 5 : Math.min(totalListingsA, 6);
  const itemsToRenderA = sellerA.listings.slice(0, sliceCountA);

  itemsToRenderA.forEach(l => {
    const wantInfo = state.wants.find(w => String(w.id) === String(l.releaseId)) || {};
    const coverRaw = wantInfo.image || wantInfo.cover || wantInfo.thumb || wantInfo.coverImage || wantInfo.cover_image || l.image || '';
    const coverImg = upgradeDiscogsImageUrl(coverRaw);
    const condTag = (l.mediaCondition || 'VG+').toUpperCase();
    const condColor = condTag.includes('M') && !condTag.includes('NM') 
      ? 'bg-emerald-600' 
      : (condTag.includes('NM') ? 'bg-blue-600' : 'bg-amber-600');
    
    const imgHtml = coverImg 
      ? `<img alt="${escapeHTML(wantInfo.title || 'Vinyl')}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none group-hover/cover:scale-105 transition-transform duration-300" src="${escapeHTML(coverImg)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
         <div class="w-full h-full hidden items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`
      : `<div class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`;
    
    galleryAHtml += `
      <div class="aspect-square bg-stone-100 border border-hairline-dark relative group/cover overflow-hidden hover:border-prada-red transition-all shadow-xs" title="${escapeHTML((wantInfo.artist ? wantInfo.artist + ' - ' : '') + (wantInfo.title || 'Vinilo'))}">
        ${imgHtml}
        <span class="absolute bottom-1 right-1 ${condColor} text-pure-white text-[9px] font-mono font-bold px-1.5 py-0.5 shadow-sm">${escapeHTML(condTag)}</span>
      </div>
    `;
  });

  if (showOverflowA) {
    const overflowCount = totalListingsA - 5;
    galleryAHtml += `
      <div class="aspect-square border-2 border-prada-red bg-prada-red-bg flex flex-col items-center justify-center text-prada-red font-mono hover:bg-prada-red hover:text-white transition-all cursor-pointer shadow-xs btn-scroll-to-seller group/more" data-scroll-to="${escapeHTML(sellerA.name)}" title="Ver todos los ${totalListingsA} discos de este vendedor">
        <span class="font-extrabold text-lg leading-none group-hover/more:scale-110 transition-transform">+${overflowCount}</span>
        <span class="text-[9px] uppercase tracking-wider font-bold mt-1">DISCOS</span>
      </div>
    `;
  }

  // Option B setup
  const sellerB = topSellersB[0] || topSellersA[1] || topSellersA[0];
  const subtotalB = sellerB.listings.reduce((sum, l) => sum + l.priceVal, 0);
  const totalCostB = sellerB.totalPrice;
  const shippingCostB = Math.max(totalCostB - subtotalB, 0);
  const avgCostPerPieceB = totalCostB / Math.max(sellerB.listings.length, 1);

  // 6 visual covers for Option B (up to 5 covers + 1 overflow tile if > 6)
  let galleryBHtml = '';
  const totalListingsB = sellerB.listings.length;
  const showOverflowB = totalListingsB > 6;
  const sliceCountB = showOverflowB ? 5 : Math.min(totalListingsB, 6);
  const itemsToRenderB = sellerB.listings.slice(0, sliceCountB);

  itemsToRenderB.forEach(l => {
    const wantInfo = state.wants.find(w => String(w.id) === String(l.releaseId)) || {};
    const coverRaw = wantInfo.image || wantInfo.cover || wantInfo.thumb || wantInfo.coverImage || wantInfo.cover_image || l.image || '';
    const coverImg = upgradeDiscogsImageUrl(coverRaw);
    const condTag = (l.mediaCondition || 'VG+').toUpperCase();
    const condColor = condTag.includes('M') && !condTag.includes('NM') 
      ? 'bg-emerald-600' 
      : (condTag.includes('NM') ? 'bg-blue-600' : 'bg-amber-600');
    
    const imgHtml = coverImg 
      ? `<img alt="${escapeHTML(wantInfo.title || 'Vinyl')}" referrerpolicy="no-referrer" class="w-full h-full object-cover select-none group-hover/cover:scale-105 transition-transform duration-300" src="${escapeHTML(coverImg)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
         <div class="w-full h-full hidden items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`
      : `<div class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400"><span class="material-symbols-outlined text-lg">album</span></div>`;
    
    galleryBHtml += `
      <div class="aspect-square bg-stone-100 border border-hairline-dark relative group/cover overflow-hidden hover:border-prada-blue transition-all shadow-xs" title="${escapeHTML((wantInfo.artist ? wantInfo.artist + ' - ' : '') + (wantInfo.title || 'Vinilo'))}">
        ${imgHtml}
        <span class="absolute bottom-1 right-1 ${condColor} text-pure-white text-[9px] font-mono font-bold px-1.5 py-0.5 shadow-sm">${escapeHTML(condTag)}</span>
      </div>
    `;
  });

  if (showOverflowB) {
    const overflowCountB = totalListingsB - 5;
    galleryBHtml += `
      <div class="aspect-square border-2 border-prada-blue bg-blue-50 flex flex-col items-center justify-center text-prada-blue font-mono hover:bg-prada-blue hover:text-white transition-all cursor-pointer shadow-xs btn-scroll-to-seller group/more" data-scroll-to="${escapeHTML(sellerB.name)}" title="Ver todos los ${totalListingsB} discos de este vendedor">
        <span class="font-extrabold text-lg leading-none group-hover/more:scale-110 transition-transform">+${overflowCountB}</span>
        <span class="text-[9px] uppercase tracking-wider font-bold mt-1">DISCOS</span>
      </div>
    `;
  }

  const bentoGridHtml = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <!-- CARD 01: MÁXIMO STOCK / CONSOLIDACIÓN (BORDE ROJO PRADA) -->
      <article class="border-2 border-prada-red/70 bg-pure-white p-6 sm:p-7 flex flex-col justify-between relative group hover:border-prada-red transition-all shadow-[4px_4px_0px_rgba(224,43,32,0.08)]">
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-prada-red"></div>
        <div class="flex flex-col gap-5 pt-1">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 sm:gap-4">
              <span class="w-10 h-10 border-2 border-pitch-black font-mono font-bold text-base flex items-center justify-center bg-ivory-warm text-pitch-black group-hover:bg-prada-red group-hover:text-pure-white transition-colors shrink-0 shadow-xs">
                01
              </span>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-mono tracking-wider uppercase bg-prada-red text-pure-white px-2.5 py-1 font-bold shadow-xs">
                    OPCIÓN 1: MAYOR CATÁLOGO EN STOCK
                  </span>
                  <span class="text-[11px] font-mono uppercase text-prada-blue font-semibold border border-blue-200 bg-blue-50 px-2 py-0.5">${getCountryFlag(sellerA.shipsFrom)} ${escapeHTML(sellerA.shipsFrom)}</span>
                </div>
                <h2 class="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-tight mt-1.5 text-pitch-black">
                  ${escapeHTML(sellerA.name)}
                  <span class="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 ml-2 align-middle inline-block">${sellerA.rating}% ${sellerA.ratingCount > 0 ? `(${sellerA.ratingCount.toLocaleString()} VOTOS)` : 'POSITIVO'}</span>
                </h2>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="inline-block bg-prada-ochre-bg border border-prada-ochre text-amber-950 font-mono font-bold text-sm px-3 py-1 tracking-wider shadow-xs">
                ${sellerA.listings.length} DISCOS EN STOCK
              </span>
              <div class="font-mono text-[11px] text-prada-red font-bold uppercase tracking-wider mt-1.5">
                ★ CONSOLIDA MÁS EN 1 ENVÍO (${coveragePercentA}%)
              </div>
            </div>
          </div>

          <!-- Wantlist Coverage Architectural Gauge -->
          <div class="border border-hairline-light p-3.5 bg-ivory-warm">
            <div class="flex justify-between items-center text-[11px] font-mono tracking-wider mb-2 uppercase">
              <span class="text-muted-graphite font-semibold">RESOLUCIÓN DE ARCHIVO (${sellerA.listings.length} / ${state.wants.length} LANZAMIENTOS)</span>
              <span class="text-prada-red font-bold">${coveragePercentA}% RESUELTO</span>
            </div>
            <div class="w-full h-2.5 bg-surface-low overflow-hidden border border-hairline-dark">
              <div class="h-full bg-prada-red transition-all duration-500" style="width: ${Math.min(coveragePercentA, 100)}%;" title="${coveragePercentA}% de tu Wantlist resuelta (${sellerA.listings.length} de ${state.wants.length} discos en stock)"></div>
            </div>
          </div>

          <!-- Covers Gallery -->
          <div class="flex flex-col gap-2.5">
            <div class="flex justify-between text-[11px] font-mono tracking-wider uppercase text-muted-graphite font-semibold">
              <span>MUESTRA DE LOTE DISCOGRÁFICO</span>
              <span class="text-prada-blue font-bold">STOCK CURADO DISPONIBLE</span>
            </div>
            <div class="grid grid-cols-6 gap-2 sm:gap-2.5">
              ${galleryAHtml}
            </div>
          </div>

          <!-- Financial Breakdown Tabular Receipt -->
          <div class="grid grid-cols-3 border border-hairline-dark py-3 font-mono bg-ivory-warm px-3 shadow-xs">
            <div>
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">SUBTOTAL DISCOS</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(subtotalA, sellerA.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-4">
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">ENVÍO CONSOLIDADO</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-prada-blue">${formatPrice(shippingCostA, sellerA.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-4 bg-prada-red-bg px-2 py-0.5">
              <span class="text-[10px] uppercase tracking-wider text-prada-red font-bold block">AHORRO EN FLETE</span>
              <span class="font-bold text-base sm:text-lg tracking-tight text-prada-red">-$${estSavingsA.toFixed(2)} <span class="text-[11px] font-normal">USD</span></span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-5 mt-4">
          <button class="btn-scroll-to-seller flex-1 bg-prada-red text-pure-white hover:bg-prada-red-dark text-xs font-mono font-bold py-3 uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer" data-scroll-to="${escapeHTML(sellerA.name)}" type="button">
            <span class="material-symbols-outlined text-[16px]">inventory_2</span>
            <span>EXAMINAR LOTE (${sellerA.listings.length} DISCOS)</span>
          </button>
          <a class="border-2 border-pitch-black text-pitch-black hover:bg-surface-low px-5 py-3 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 font-bold cursor-pointer shrink-0" href="https://www.discogs.com/seller/${encodeURIComponent(sellerA.name)}/mywants" target="_blank" rel="noreferrer" title="Abrir perfil de ${escapeHTML(sellerA.name)} en Discogs">
            <span>VER EN DISCOGS</span>
            <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </article>

      <!-- CARD 02: LOTE MÁS ECONÓMICO / MEJOR VALOR (BORDE AZUL PRADA) -->
      <article class="border-2 border-prada-blue/70 bg-pure-white p-6 sm:p-7 flex flex-col justify-between relative group hover:border-prada-blue transition-all shadow-[4px_4px_0px_rgba(29,78,216,0.08)]">
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-prada-blue"></div>
        <div class="flex flex-col gap-5 pt-1">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 sm:gap-4">
              <span class="w-10 h-10 border-2 border-pitch-black font-mono font-bold text-base flex items-center justify-center bg-ivory-warm text-pitch-black group-hover:bg-prada-blue group-hover:text-pure-white transition-colors shrink-0 shadow-xs">
                02
              </span>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-mono tracking-wider uppercase bg-prada-blue text-pure-white px-2.5 py-1 font-bold shadow-xs">
                    OPCIÓN 2: LOTE MÁS ECONÓMICO
                  </span>
                  <span class="text-[11px] font-mono uppercase text-prada-blue font-semibold border border-blue-200 bg-blue-50 px-2 py-0.5">${getCountryFlag(sellerB.shipsFrom)} ${escapeHTML(sellerB.shipsFrom)}</span>
                </div>
                <h2 class="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-tight mt-1.5 text-pitch-black">
                  ${escapeHTML(sellerB.name)}
                  <span class="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 ml-2 align-middle inline-block">${sellerB.rating}% ${sellerB.ratingCount > 0 ? `(${sellerB.ratingCount.toLocaleString()} VOTOS)` : 'POSITIVO'}</span>
                </h2>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="inline-block bg-emerald-50 border border-emerald-300 text-emerald-950 font-mono font-bold text-sm px-3 py-1 tracking-wider shadow-xs">
                ${formatPrice(avgCostPerPieceB, sellerB.currency)} / DISCO
              </span>
              <div class="font-mono text-[11px] text-emerald-800 font-bold uppercase tracking-wider mt-1.5 flex items-center justify-end gap-1">
                <span>★</span> MENOR PRECIO PROMEDIO (${sellerB.listings.length} DISCOS)
              </div>
            </div>
          </div>

          <!-- Covers Gallery for Option B -->
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
              <span class="font-bold text-sm sm:text-base tracking-tight text-emerald-800">${formatPrice(avgCostPerPieceB, sellerB.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-3">
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">SUBTOTAL</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(subtotalB, sellerB.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-3">
              <span class="text-[10px] uppercase tracking-wider text-muted-graphite font-semibold block">FLETE</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-prada-blue">${formatPrice(shippingCostB, sellerB.currency)}</span>
            </div>
            <div class="border-l border-hairline-light pl-3 bg-blue-50/60 px-2 py-0.5">
              <span class="text-[10px] uppercase tracking-wider text-prada-blue font-bold block">TOTAL LOTE</span>
              <span class="font-bold text-sm sm:text-base tracking-tight text-pitch-black">${formatPrice(totalCostB, sellerB.currency)}</span>
            </div>
          </div>

          <!-- Museum Condition Guarantee Note -->
          <div class="border border-emerald-300 bg-prada-emerald-bg p-3.5 flex items-start gap-2.5">
            <span class="material-symbols-outlined text-[20px] text-prada-emerald shrink-0 mt-0.5">verified</span>
            <p class="font-mono text-xs text-emerald-950 leading-relaxed font-medium">
              ESTADO CERTIFICADO: VINILOS VERIFICADOS CON GARANTÍA DIRECTA Y PROTECCIÓN DE COMPRA EN DISCOGS MARKETPLACE.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-5 mt-4">
          <button class="btn-scroll-to-seller flex-1 bg-prada-blue-night hover:bg-prada-blue text-pure-white text-xs font-mono font-bold py-3 uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer" data-scroll-to="${escapeHTML(sellerB.name)}" type="button">
            <span class="material-symbols-outlined text-[16px]">inventory_2</span>
            <span>EXAMINAR LOTE (${sellerB.listings.length} DISCOS)</span>
          </button>
          <a class="border-2 border-pitch-black text-pitch-black hover:bg-surface-low px-5 py-3 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 font-bold cursor-pointer shrink-0" href="https://www.discogs.com/seller/${encodeURIComponent(sellerB.name)}/mywants" target="_blank" rel="noreferrer" title="Abrir perfil de ${escapeHTML(sellerB.name)} en Discogs">
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

  // Animate bento cards and savings counter
  if (window.Motion) {
    requestAnimationFrame(() => {
      window.Motion.revealBento('#smart-purchase-card');
      // Animate savings elements
      smartPurchaseCard.querySelectorAll('.savings-amount, [data-savings]').forEach(el => {
        window.Motion.revealSavings(el.id || null);
        if (!el.id) el.classList.add('savings-highlight', 'savings-amount');
      });
      // Animate bento inner cards
      smartPurchaseCard.querySelectorAll('.bento-cell, .bento-card, .smart-purchase-option').forEach(card => {
        card.classList.add('bento-card');
      });
    });
  }

  // Attach event listeners for scrolling to and auto-expanding seller cards
  smartPurchaseCard.querySelectorAll('[data-scroll-to]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sellerName = link.getAttribute('data-scroll-to');
      if (!sellerName) return;

      // Auto-expand seller listings accordion
      if (typeof expandSellerCard === 'function') {
        expandSellerCard(sellerName);
      }

      const targetCard = document.getElementById('seller-card-' + sellerName);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
