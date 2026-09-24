/**
 * Vinyl Stock Manager • Domain Optimizer Service (js/domain/optimizer-service.js)
 * Multi-vendor smart purchase calculations, shipping amortizations, and candidate selection.
 * Pure business logic with ZERO DOM dependencies.
 */

(function(global) {
  'use strict';

  const OptimizerService = {
    /**
     * Finds the optimal combination of sellers to maximize coverage while minimizing total cost.
     */
    getSmartPurchaseCombo(filteredSellers, targetReleases, shippingCalculator = null) {
      if (!Array.isArray(filteredSellers) || filteredSellers.length === 0 || !Array.isArray(targetReleases) || targetReleases.length === 0) {
        return null;
      }

      const calcShipping = shippingCalculator || global.ShippingEngine?.calculateSellerShipping || global.calculateSellerShipping;

      // Take top 12 sellers to keep combination search space fast
      const candidates = [...filteredSellers]
        .sort((a, b) => (b.listings?.length || 0) - (a.listings?.length || 0))
        .slice(0, 12);

      let bestCombo = null;
      let maxCovered = -1;
      let minCost = Infinity;
      let bestAssignments = null;

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
          const coveredReleases = new Set();
          const assignments = {};
          combo.forEach(s => { assignments[s.name] = []; });

          targetReleases.forEach(relId => {
            let cheapestSeller = null;
            let cheapestListing = null;

            combo.forEach(s => {
              const listing = (s.listings || []).find(l => l && String(l.releaseId) === String(relId));
              if (listing) {
                if (!cheapestListing || (listing.priceVal || 0) < (cheapestListing.priceVal || 0)) {
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
          let totalComboCost = 0;
          combo.forEach(s => {
            const assignedListings = assignments[s.name];
            if (assignedListings && assignedListings.length > 0) {
              const subtotal = assignedListings.reduce((sum, l) => sum + (l.priceVal || 0), 0);
              const estimatedShipping = calcShipping ? calcShipping(s, assignedListings) : 0;
              totalComboCost += subtotal + estimatedShipping;
            }
          });

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

      const activeSellers = bestCombo.filter(s => bestAssignments[s.name]?.length > 0);

      return {
        sellers: activeSellers,
        assignments: bestAssignments,
        totalCovered: maxCovered,
        totalCost: minCost
      };
    },

    /**
     * Calculates statistics if buying all target releases from the cheapest individual listings.
     */
    calculateWishlistCompletaStats(filteredSellers, targetReleases, shippingCalculator = null) {
      if (!Array.isArray(filteredSellers) || !Array.isArray(targetReleases)) return null;

      const calcShipping = shippingCalculator || global.ShippingEngine?.calculateSellerShipping || global.calculateSellerShipping;
      const currSvc = global.CurrencyService || {
        getCurrencyRate: (curr) => (global.CURRENCY_MAP?.[curr]?.rate || 1.0)
      };

      const cheapestListingsMap = new Map();

      targetReleases.forEach(relId => {
        let cheapest = null;
        let cheapestUSD = Infinity;

        filteredSellers.forEach(seller => {
          (seller.listings || []).forEach(l => {
            if (l && String(l.releaseId) === String(relId)) {
              const rate = currSvc.getCurrencyRate(l.currency);
              const priceUSD = (l.priceVal || 0) * rate;
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

        const rate = currSvc.getCurrencyRate(val.listing.currency);
        totalDiscsPriceUSD += (val.listing.priceVal || 0) * rate;
      });

      let totalShippingUSD = 0;
      sellerAssignments.forEach((data) => {
        const shippingInSellerCurrency = calcShipping ? calcShipping(data.seller, data.listings) : 0;
        const rate = currSvc.getCurrencyRate(data.seller.currency);
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
    },

    /**
     * Calculates the two candidates (Option A: Max stock, Option B: Best average cost)
     * and their financial analytics for presentation in the Bento Grid.
     */
    calculateSmartPurchaseCandidates(filteredSellers, targetReleases, totalWantsCount = 1) {
      if (!Array.isArray(filteredSellers) || filteredSellers.length === 0 || !Array.isArray(targetReleases) || targetReleases.length === 0) {
        return null;
      }

      const currSvc = global.CurrencyService || {
        getCurrencyRate: (curr) => (global.CURRENCY_MAP?.[curr]?.rate || 1.0)
      };

      const coverableReleases = targetReleases.filter(relId =>
        filteredSellers.some(s => (s.listings || []).some(l => l && String(l.releaseId) === String(relId)))
      );

      if (coverableReleases.length === 0) return null;

      // Option A: Max Consolidation (greatest quantity of matching wants, then lowest total cost)
      const candidatesA = [...filteredSellers].sort((a, b) => {
        const lenA = a.listings?.length || 0;
        const lenB = b.listings?.length || 0;
        if (lenB !== lenA) {
          return lenB - lenA;
        }
        const rateA = currSvc.getCurrencyRate(a.currency);
        const rateB = currSvc.getCurrencyRate(b.currency);
        return (a.totalPrice * rateA) - (b.totalPrice * rateB);
      });

      const topSellersA = candidatesA.slice(0, 3);
      if (topSellersA.length === 0) return null;

      // Option B: Best average cost per disc (Efficiency, minimum of 3 discs if possible)
      const eligibleB = filteredSellers.filter(s => (s.listings?.length || 0) >= 3);
      let candidatesBSorted = [];

      const mapAndSortB = (sellersList) => {
        return [...sellersList].map(s => {
          const count = Math.max(s.listings?.length || 1, 1);
          const avgCost = s.totalPrice / count;
          const rate = currSvc.getCurrencyRate(s.currency);
          const avgCostUSD = avgCost * rate;
          return { seller: s, avgCostUSD };
        }).sort((a, b) => a.avgCostUSD - b.avgCostUSD).map(c => c.seller);
      };

      if (eligibleB.length > 0) {
        candidatesBSorted = mapAndSortB(eligibleB);
      } else {
        const eligibleB2 = filteredSellers.filter(s => (s.listings?.length || 0) >= 2);
        if (eligibleB2.length > 0) {
          candidatesBSorted = mapAndSortB(eligibleB2);
        } else {
          candidatesBSorted = mapAndSortB(filteredSellers);
        }
      }

      const topSellersB = candidatesBSorted.slice(0, 3);

      const sellerA = topSellersA[0];
      const subtotalA = (sellerA.listings || []).reduce((sum, l) => sum + (l.priceVal || 0), 0);
      const totalCostA = sellerA.totalPrice || (subtotalA + (sellerA.estimatedShipping || 0));
      const shippingCostA = Math.max(totalCostA - subtotalA, 0);
      const estSavingsA = Math.max(((sellerA.listings?.length || 1) - 1) * 18.50, 24);
      const coveragePercentA = (((sellerA.listings?.length || 0) / Math.max(totalWantsCount, 1)) * 100).toFixed(2);
      const avgCostPerPieceA = totalCostA / Math.max(sellerA.listings?.length || 1, 1);

      const sellerB = topSellersB[0] || topSellersA[1] || topSellersA[0];
      const subtotalB = (sellerB.listings || []).reduce((sum, l) => sum + (l.priceVal || 0), 0);
      const totalCostB = sellerB.totalPrice || (subtotalB + (sellerB.estimatedShipping || 0));
      const shippingCostB = Math.max(totalCostB - subtotalB, 0);
      const avgCostPerPieceB = totalCostB / Math.max(sellerB.listings?.length || 1, 1);

      return {
        sellerA: {
          seller: sellerA,
          subtotal: subtotalA,
          shippingCost: shippingCostA,
          totalCost: totalCostA,
          estSavings: estSavingsA,
          coveragePercent: coveragePercentA,
          avgCostPerPiece: avgCostPerPieceA,
          allCandidates: topSellersA
        },
        sellerB: {
          seller: sellerB,
          subtotal: subtotalB,
          shippingCost: shippingCostB,
          totalCost: totalCostB,
          avgCostPerPiece: avgCostPerPieceB,
          allCandidates: topSellersB
        }
      };
    }
  };

  global.OptimizerService = OptimizerService;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizerService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
