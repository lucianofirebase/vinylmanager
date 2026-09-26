/**
 * Vinyl Stock Manager • Domain Shipping Engine (js/domain/shipping-engine.js)
 * Pure domain logic for Discogs shipping calculation, ASP (Automated Shipping Policy),
 * weight tiers, and free shipping thresholds. ZERO direct DOM dependencies.
 */

(function(global) {
  'use strict';

  const EURO_COUNTRIES = [
    'spain', 'germany', 'france', 'italy', 'united kingdom', 'uk',
    'netherlands', 'belgium', 'austria', 'switzerland', 'sweden',
    'norway', 'portugal', 'greece', 'poland', 'ireland', 'spain (es)',
    'deutschland', 'de', 'es'
  ];

  const OFFICIAL_ASP_BANNER_REGEX = /(?:(?!(?:ofrece|offers|bietet|offre))\b([a-zA-Z0-9_\-\.]{1,50})\s+)?(?:ofrece|offers|bietet|offre)\s+(?:env[íi]o\s+(?:gratuito|gratis)|free\s+shipping|kostenlosen?\s+versand|frais\s+de\s+port\s+gratuits?|la\s+livraison\s+gratuite|spedizione\s+gratuita)\s+(?:en\s+pedidos\s+(?:de(?:\s+m[áa]s\s+de)?|a\s+partir\s+de)?|on\s+orders\s+(?:of|over|from)|for\s+orders\s+(?:of|over)|f[üu]r\s+bestellungen\s+ab|ab|d[èe]s|pour\s+les\s+commandes\s+de|per\s+ordini\s+di)\s*(?:[€$£¥]\s*|\b(?:eur|usd|gbp|cad|aud)\b\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/i;

  const OFFICIAL_ASP_BANNER_GLOBAL_REGEX = /(?:(?!(?:ofrece|offers|bietet|offre))\b([a-zA-Z0-9_\-\.]{1,50})\s+)?(?:ofrece|offers|bietet|offre)\s+(?:env[íi]o\s+(?:gratuito|gratis)|free\s+shipping|kostenlosen?\s+versand|frais\s+de\s+port\s+gratuits?|la\s+livraison\s+gratuite|spedizione\s+gratuita)\s+(?:en\s+pedidos\s+(?:de(?:\s+m[áa]s\s+de)?|a\s+partir\s+de)?|on\s+orders\s+(?:of|over|from)|for\s+orders\s+(?:of|over)|f[üu]r\s+bestellungen\s+ab|ab|d[èe]s|pour\s+les\s+commandes\s+de|per\s+ordini\s+di)\s*(?:[€$£¥]\s*|\b(?:eur|usd|gbp|cad|aud)\b\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/gi;

  const OFFICIAL_MODAL_SHIPPING_REGEX = /(?:free\s+shipping|env[íi]o\s+(?:gratuito|gratis)|kostenloser\s+versand|frais\s+de\s+port\s+gratuits?|livraison\s+gratuite|spedizione\s+gratuita)\s*:\s*[\s\S]{0,100}?\b(?:subtotal|zwischensumme|sous-total|subtotale|pedido|order)\b[\s\S]{0,80}?(?:debe\s+ser|must\s+be|doit\s+[êe]tre|muss\s+mindestens|deve\s+essere|al\s+menos|at\s+least|mindestens)[\s\S]{0,40}?(?:de\s+|d'au\s+moins\s+)?(?:[€$£¥]\s*|\b(?:eur|usd|gbp|cad|aud)\b\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/i;

  const GENERAL_FREE_SHIP_REGEX = /(?:free\s+(?:(?:worldwide|international|domestic|airmail|standard|express)\s+)?(?:shipping|delivery|postage)|env[íi]o\s+(?:(?:internacional|dom[ée]stico|est[áa]ndar|express)\s+)?(?:gratis|gratuito)|port\s+gratuit|livraison\s+gratuite|kostenloser\s+versand|spedizione\s+gratuita)\s*(?:on\s+orders\s+over|for\s+orders\s+over|orders\s+over|orders\s+from|over|from|a\s+partir\s+de|en\s+pedidos\s+(?:de\s+m[áa]s\s+de|superiores\s+a|a\s+partir\s+de)?|superando\s+(?:los\s+)?|en\s+compras\s+mayores\s+a|ab|d[èe]s|oltre)\s*(?:[€$£¥]\s*|\b(?:eur|usd|gbp|cad|aud)\b\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/i;

  function doesRegionMatchBuyer(regionName, buyerCountryVal) {
    if (!regionName || !buyerCountryVal) return false;
    const reg = regionName.toLowerCase().trim();
    const buyer = buyerCountryVal.toLowerCase().trim();

    if (/\b(worldwide|international|internacional|all\s+countries|rest\s+of\s+(?:the\s+)?world|global|everywhere|cualquier\s+pa[íi]s|todos\s+los\s+pa[íi]ses)\b/i.test(reg)) {
      return true;
    }
    if (reg.includes(buyer) || buyer.includes(reg)) return true;
    if (buyer === 'uruguay' && /\b(uruguay|sudam[ée]rica|south\s+america|am[ée]rica\s+del\s+sur|mercosur)\b/i.test(reg)) return true;
    if ((buyer === 'united states' || buyer === 'usa' || buyer === 'us') && /\b(united\s+states|usa|u\.s\.a\.|u\.s\.|us|domestic)\b/i.test(reg)) return true;
    if ((buyer === 'united kingdom' || buyer === 'uk') && /\b(united\s+kingdom|uk|great\s+britain|gb|england)\b/i.test(reg)) return true;
    if ((buyer === 'germany' || buyer === 'deutschland') && /\b(germany|deutschland|de)\b/i.test(reg)) return true;
    if ((buyer === 'spain' || buyer === 'españa') && /\b(spain|españa|es)\b/i.test(reg)) return true;
    const isBuyerEU = ShippingEngine.isCountryEU(buyerCountryVal);
    if (isBuyerEU && /\b(europe|europa|eu|european\s+union)\b/i.test(reg)) return true;
    return false;
  }

  const ShippingEngine = {
    isCountryEU(country) {
      if (!country || typeof country !== 'string') return false;
      const lower = country.toLowerCase();
      return EURO_COUNTRIES.some(eu => lower.includes(eu));
    },

    isDomesticSeller(shipsFrom, buyerCountry) {
      if (!shipsFrom || !buyerCountry) return false;
      const shipsFromLower = String(shipsFrom).toLowerCase();
      const buyerLower = String(buyerCountry).toLowerCase();
      return shipsFromLower.includes(buyerLower) || buyerLower.includes(shipsFromLower);
    },

    calculateSellerShipping(seller, listingsList, currencyService = null) {
      const listCount = (listingsList || []).length;
      if (listCount === 0) return 0;

      const currSvc = currencyService || global.CurrencyService || {
        getCurrencyRate: (curr) => (global.CURRENCY_MAP?.[curr]?.rate || 1.0)
      };

      // Base & Incremental shipping rates in USD
      let baseShippingUSD = 6.00;
      let extraItemUSD = 1.50;

      if (seller?.isDomestic) {
        baseShippingUSD = 4.50;
        extraItemUSD = 1.00; // ~$1.00 domestic
      } else if (seller?.isEUToEU) {
        baseShippingUSD = 9.50;
        extraItemUSD = 1.50; // ~$1.50 EU
      } else {
        baseShippingUSD = 22.00;
        extraItemUSD = 2.00; // International / Overseas
      }

      // Convert estimated rates from USD to seller's currency
      const sellerCurrency = seller?.currency || 'USD';
      const sellerRate = currSvc.getCurrencyRate(sellerCurrency);
      const conversionFactor = 1.0 / (sellerRate || 1.0);

      const baseShippingInSellerCurrency = baseShippingUSD * conversionFactor;
      const extraItemInSellerCurrency = extraItemUSD * conversionFactor;

      // Check if seller offers free shipping over threshold and subtotal meets or exceeds it
      const currentSubtotal = (listingsList || []).reduce((sum, item) => sum + (item.priceVal || 0), 0);

      const thresholdObj = seller?.aspBannerThreshold || seller?.freeShippingThreshold || null;

      if (thresholdObj && thresholdObj.amount > 0) {
        let thresholdInSellerCurrency = thresholdObj.amount;
        if (thresholdObj.currency && sellerCurrency && thresholdObj.currency !== sellerCurrency) {
          const threshRate = currSvc.getCurrencyRate(thresholdObj.currency);
          thresholdInSellerCurrency = (thresholdInSellerCurrency / threshRate) * sellerRate;
        }
        if (currentSubtotal >= thresholdInSellerCurrency) {
          return 0; // Free shipping unlocked
        }
      }

      // Check if all listings in this bundle are explicitly direct free shipping
      const allListingsDirectFree = listingsList.length > 0 && listingsList.every(l => l && l.isDirectFree);
      if (allListingsDirectFree) {
        return 0;
      }

      // Check if we have an official verified shipping price from Discogs API
      if (seller?.isShippingOfficial && typeof seller.officialShippingPrice === 'number') {
        if (seller.officialShippingPrice === 0) return 0;
        let baseOfficial = seller.officialShippingPrice;
        if (seller.officialShippingCurrency && sellerCurrency && seller.officialShippingCurrency !== sellerCurrency) {
          const offRate = currSvc.getCurrencyRate(seller.officialShippingCurrency);
          baseOfficial = (baseOfficial / offRate) * sellerRate;
        }
        return baseOfficial + (listCount - 1) * extraItemInSellerCurrency;
      }

      // Check if we parsed actual shipping costs from listings
      const shippingValues = (listingsList || []).map(l => l.shippingVal).filter(v => v > 0);
      if (shippingValues.length > 0) {
        const maxShipping = Math.max(...shippingValues);
        return maxShipping + (listCount - 1) * extraItemInSellerCurrency;
      } else {
        return baseShippingInSellerCurrency + (listCount - 1) * extraItemInSellerCurrency;
      }
    },

    parseShippingPoliciesJson(data, buyerCountryVal = 'Uruguay') {
      if (!data || !Array.isArray(data.policies)) return null;
      const buyerLower = (buyerCountryVal || 'uruguay').toLowerCase();

      let targetPolicy = data.policies.find(p =>
        Array.isArray(p.countries) && p.countries.some(c => (c || '').toLowerCase() === buyerLower)
      );
      if (!targetPolicy) targetPolicy = data.policies[0];
      if (!targetPolicy) return null;

      if (targetPolicy.free_shipping) {
        const minVal = parseFloat(targetPolicy.free_shipping_min_order_val) || 0;
        const cur = data.currency || 'EUR';
        return {
          amount: minVal,
          currency: cur,
          formatted: targetPolicy.formatted_free_shipping_min_order_val || `${minVal.toFixed(2)} ${cur}`,
          raw: targetPolicy.free_shipping_description || `Envío gratuito en pedidos de ${minVal} ${cur} o más`,
          seller: null,
          scope: 'asp_banner'
        };
      }
      return null;
    },

    parseFreeShippingThresholds(fullRowText, currency = 'EUR', currencyDetector = null, buyerCountryVal = 'Uruguay', sellerShipsFrom = '') {
      if (!fullRowText) return null;

      const detectCurr = currencyDetector || (global.CurrencyService?.detectCurrencyInContext) || ((text, fb) => fb || 'EUR');
      const textToMatch = fullRowText.includes('<') ? fullRowText.replace(/<[^>]+>/g, ' ') : fullRowText;
      const buyer = (buyerCountryVal || (typeof buyerCountry !== 'undefined' && buyerCountry ? buyerCountry.value : (typeof state !== 'undefined' && state?.buyerCountry ? state.buyerCountry : 'Uruguay')) || 'Uruguay').trim();

      // 1. Official modal box
      const modalMatch = textToMatch.match(OFFICIAL_MODAL_SHIPPING_REGEX);
      if (modalMatch) {
        const rawVal = (modalMatch[1] || '').trim();
        const cleanDigits = rawVal.replace(/[^\d.,]/g, '');
        if (cleanDigits) {
          const matchIndex = modalMatch.index || 0;
          const surroundingContext = textToMatch.slice(
            Math.max(0, matchIndex - 10),
            Math.min(textToMatch.length, matchIndex + modalMatch[0].length + 25)
          );
          const threshCur = detectCurr(surroundingContext, currency || 'EUR');
          const val = global.DiscogsParser?.parseLocalePrice
            ? global.DiscogsParser.parseLocalePrice(cleanDigits, threshCur)
            : parseFloat(cleanDigits.replace(',', '.')) || 0;
          if (val > 0) {
            return {
              aspBannerThreshold: {
                amount: val,
                currency: threshCur,
                raw: modalMatch[0].trim(),
                scope: 'asp_banner'
              }
            };
          }
        }
      }

      // 2. Official Discogs ASP Banner
      const aspMatch = textToMatch.match(OFFICIAL_ASP_BANNER_REGEX);
      if (aspMatch) {
        const rawVal = (aspMatch[2] || '').trim();
        const cleanDigits = rawVal.replace(/[^\d.,]/g, '');
        if (cleanDigits) {
          const matchIndex = aspMatch.index || 0;
          const surroundingContext = textToMatch.slice(
            Math.max(0, matchIndex - 10),
            Math.min(textToMatch.length, matchIndex + aspMatch[0].length + 25)
          );
          const threshCur = detectCurr(surroundingContext, currency || 'EUR');
          const val = global.DiscogsParser?.parseLocalePrice
            ? global.DiscogsParser.parseLocalePrice(cleanDigits, threshCur)
            : parseFloat(cleanDigits.replace(',', '.')) || 0;
          if (val > 0) {
            return {
              aspBannerThreshold: {
                amount: val,
                currency: threshCur,
                raw: aspMatch[0].trim(),
                seller: aspMatch[1] ? aspMatch[1].trim() : null,
                scope: 'asp_banner'
              }
            };
          }
        }
      }

      // 3. Structured Multi-Country Shipping Sections (e.g. [b]United States[/b], [b]Canada[/b], [b]Rest of World[/b])
      const sectionRegex = /(?:\[b\]|\*\*|<h3>|^)([\w\s,&.\-–—/()]+?)(?:\[\/b\]|\*\*|<\/h3>|:)\s*\n([\s\S]*?)(?=(?:\[b\]|\*\*|<h3>|\n\n\[b\]|$))/gim;
      let secMatch;
      const sections = [];
      while ((secMatch = sectionRegex.exec(fullRowText)) !== null) {
        const header = (secMatch[1] || '').trim();
        const body = (secMatch[2] || '').trim();
        if (header && !/^(shipping\s+terms|delivery|returns|payment|grading|about\s+us|records|disclaimer)$/i.test(header)) {
          sections.push({ header, body });
        }
      }

      if (sections.length > 0) {
        let matchedSection = sections.find(s => doesRegionMatchBuyer(s.header, buyer) && !/rest\s+of\s+(?:the\s+)?world/i.test(s.header));
        if (!matchedSection) {
          matchedSection = sections.find(s => /rest\s+of\s+(?:the\s+)?world|worldwide|international/i.test(s.header));
        }

        if (matchedSection) {
          const secGenMatch = matchedSection.body.match(GENERAL_FREE_SHIP_REGEX);
          if (secGenMatch) {
            const rawVal = (secGenMatch[1] || '').trim();
            const cleanDigits = rawVal.replace(/[^\d.,]/g, '');
            if (cleanDigits) {
              const threshCur = detectCurr(matchedSection.body, currency || 'USD');
              const val = global.DiscogsParser?.parseLocalePrice
                ? global.DiscogsParser.parseLocalePrice(cleanDigits, threshCur)
                : parseFloat(cleanDigits.replace(',', '.')) || 0;
              if (val > 0) {
                return {
                  aspBannerThreshold: {
                    amount: val,
                    currency: threshCur,
                    raw: secGenMatch[0].trim(),
                    region: matchedSection.header,
                    scope: 'asp_banner'
                  }
                };
              }
            }
          }
          return null;
        } else {
          return null;
        }
      }

      // 4. Fallback: General free shipping threshold regex for un-sectioned text
      const genMatch = textToMatch.match(GENERAL_FREE_SHIP_REGEX);
      if (genMatch) {
        const matchIndex = genMatch.index || 0;
        const surroundingContext = textToMatch.slice(
          Math.max(0, matchIndex - 60),
          Math.min(textToMatch.length, matchIndex + genMatch[0].length + 60)
        );

        const isDomestic = ShippingEngine.isDomesticSeller(sellerShipsFrom, buyer);
        const contextLower = surroundingContext.toLowerCase();

        const hasDomesticRestriction = /\b(us\s+only|usa\s+only|within\s+(?:the\s+)?(?:us|usa|uk)|domestic\s+only|solo\s+españa|nur\s+deutschland|continental\s+us|lower\s+48)\b/i.test(contextLower);
        const hasWorldwideExplicit = /\b(worldwide|international|internacional|all\s+countries|global|everywhere|cualquier\s+pa[íi]s|todos\s+los\s+pa[íi]ses)\b/i.test(contextLower);
        const hasBuyerMention = doesRegionMatchBuyer(surroundingContext, buyer);

        if (hasDomesticRestriction && !isDomestic) return null;
        if (!isDomestic && !hasWorldwideExplicit && !hasBuyerMention) return null;

        const rawVal = (genMatch[1] || '').trim();
        const cleanDigits = rawVal.replace(/[^\d.,]/g, '');
        if (cleanDigits) {
          const threshCur = detectCurr(surroundingContext, currency || 'EUR');
          const val = global.DiscogsParser?.parseLocalePrice
            ? global.DiscogsParser.parseLocalePrice(cleanDigits, threshCur)
            : parseFloat(cleanDigits.replace(',', '.')) || 0;
          if (val > 0) {
            return {
              aspBannerThreshold: {
                amount: val,
                currency: threshCur,
                raw: genMatch[0].trim(),
                scope: 'asp_banner'
              }
            };
          }
        }
      }

      return null;
    },

    extractPageAspBanners(htmlOrText) {
      if (!htmlOrText) return {};
      const banners = {};
      const textToScan = htmlOrText.includes('<') ? htmlOrText.replace(/<[^>]+>/g, ' ') : htmlOrText;
      const detectCurr = global.CurrencyService?.detectCurrencyInContext || ((text, fb) => fb || 'EUR');
      const parsePrice = global.DiscogsParser?.parseLocalePrice || ((p) => parseFloat(p) || 0);

      OFFICIAL_ASP_BANNER_GLOBAL_REGEX.lastIndex = 0;
      let bMatch;
      while ((bMatch = OFFICIAL_ASP_BANNER_GLOBAL_REGEX.exec(textToScan)) !== null) {
        const sellerKey = (bMatch[1] || '').trim();
        const rawVal = (bMatch[2] || '').trim();
        const cleanDigits = rawVal.replace(/[^\d.,]/g, '');
        if (cleanDigits) {
          const cur = detectCurr(bMatch[0], 'EUR');
          const val = parsePrice(cleanDigits, cur);
          if (val > 0) {
            const bannerObj = {
              amount: val,
              currency: cur,
              raw: bMatch[0].trim(),
              seller: sellerKey || null,
              scope: 'asp_banner'
            };
            if (sellerKey) {
              banners[sellerKey.toLowerCase()] = bannerObj;
            }
          }
        }
      }
      return banners;
    }
  };

  global.ShippingEngine = ShippingEngine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShippingEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
