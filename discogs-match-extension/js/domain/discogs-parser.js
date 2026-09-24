/**
 * Vinyl Stock Manager • Domain Discogs Parser (js/domain/discogs-parser.js)
 * High-performance parser for Discogs HTML releases, wantlists, listings and pricing tiers.
 * Pure data transformation without direct DOM side-effects.
 */

(function(global) {
  'use strict';

  function upgradeDiscogsImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let clean = url.trim();
    if (clean.includes('/images/spacer.gif') || clean.includes('data:image')) return '';
    clean = clean.replace(/discogs-images\/R-\d+-\d+-\d+\.(?:jpeg|jpg|png|gif)\.jpg$/, (m) => m.replace(/\.jpg$/, ''));
    clean = clean.replace(/\/R-(?:90|150|300)-/g, '/R-600-');
    clean = clean.replace(/\/image\/R-(?:90|150|300)-/g, '/image/R-600-');
    clean = clean.replace(/\/fit-in\/\d+x\d+\//g, '/fit-in/600x600/');
    return clean;
  }

  const DiscogsParser = {
    upgradeDiscogsImageUrl,

    parseLocalePrice(cleanPrice, currency) {
      if (!cleanPrice) return 0;

      const nonDecimalCurrencies = ['JPY', 'UYU', 'ARS', 'CLP', 'COP'];
      if (nonDecimalCurrencies.includes(currency)) {
        return parseFloat(cleanPrice.replace(/[.,]/g, '')) || 0;
      }

      const hasDot = cleanPrice.includes('.');
      const hasComma = cleanPrice.includes(',');

      if (hasDot && hasComma) {
        const lastDotIndex = cleanPrice.lastIndexOf('.');
        const lastCommaIndex = cleanPrice.lastIndexOf(',');
        if (lastCommaIndex > lastDotIndex) {
          // European format: 1.250,50 -> 1250.50
          const numStr = cleanPrice.replace(/\./g, '').replace(',', '.');
          return parseFloat(numStr) || 0;
        } else {
          // US/UK format: 1,250.50 -> 1250.50
          const numStr = cleanPrice.replace(/,/g, '');
          return parseFloat(numStr) || 0;
        }
      } else if (hasComma && !hasDot) {
        const parts = cleanPrice.split(',');
        if (parts[1] && parts[1].length === 3 && currency === 'EUR') {
          return parseFloat(cleanPrice.replace(',', '')) || 0;
        }
        return parseFloat(cleanPrice.replace(',', '.')) || 0;
      } else if (hasDot && !hasComma) {
        const parts = cleanPrice.split('.');
        if (parts[1] && parts[1].length === 3 && (currency === 'EUR' || currency === 'BRL')) {
          return parseFloat(cleanPrice.replace('.', '')) || 0;
        }
        return parseFloat(cleanPrice) || 0;
      }

      return parseFloat(cleanPrice) || 0;
    },

    detectCurrencyInContext(text, fallbackCurrency = 'USD') {
      if (!text) return fallbackCurrency;
      const upper = text.toUpperCase();
      if (upper.includes('EUR') || upper.includes('€')) return 'EUR';
      if (upper.includes('GBP') || upper.includes('£')) return 'GBP';
      if (upper.includes('USD') || upper.includes('$')) return 'USD';
      if (upper.includes('JPY') || upper.includes('¥')) return 'JPY';
      if (upper.includes('CAD') || upper.includes('CA$')) return 'CAD';
      if (upper.includes('AUD') || upper.includes('AU$')) return 'AUD';
      if (upper.includes('BRL') || upper.includes('R$')) return 'BRL';
      return fallbackCurrency;
    },

    parseWantlistHTML(html) {
      if (!html) return [];
      let doc;
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        doc = parser.parseFromString(html, 'text/html');
      } else {
        return [];
      }

      const wants = [];
      let rows = doc.querySelectorAll('.shortcut_navigable, tr.shortcut_navigable, tr, .want_item, .release-card, [class*="want"]');
      if (rows.length === 0) {
        rows = doc.querySelectorAll('a[href*="/release/"]');
      }

      rows.forEach(row => {
        const allLinks = Array.from(row.matches && row.matches('a[href*="/release/"]') ? [row] : row.querySelectorAll('a[href*="/release/"]'));
        const releaseLink = allLinks.find(a => (a.textContent || '').trim().length > 0) || allLinks[0];
        if (!releaseLink) return;

        const href = releaseLink.getAttribute('href') || '';
        const match = href.match(/\/release\/(\d+)/);
        if (!match) return;

        const id = parseInt(match[1], 10);
        if (wants.some(w => w.id === id)) return;

        const artistEl = row.querySelector('.artist, [class*="artist"], a[href*="/artist/"]');
        const titleEl = row.querySelector('.item_description, .title, [class*="title"], [class*="release-title"]');

        let text = (releaseLink.textContent || '').trim();
        let artist = artistEl ? artistEl.textContent.trim() : '';
        let title = titleEl ? titleEl.textContent.trim() : '';

        if (!title && text) {
          let cleanText = text.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
          const parts = cleanText.split(/\s+[-–—]\s+/);
          if (parts.length >= 2) {
            if (!artist) artist = parts[0].trim();
            title = parts.slice(1).join(' - ').replace(/\s*\([^)]*\)\s*$/, '').trim();
          } else {
            title = cleanText.replace(/\s*\([^)]*\)\s*$/, '').trim();
          }
        } else if (title && !artist && title.includes(' - ')) {
          const parts = title.split(/\s+[-–—]\s+/);
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        if (!artist) artist = 'Desconocido';
        if (!title) title = 'Disco #' + id;

        artist = artist.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
        title = title.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();

        const img = row.querySelector('img[data-src], img[srcset], img[src]');
        let image = '';
        if (img) {
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
            if (parts.length > 0) {
              const candidate = parts[parts.length - 1].split(/\s+/)[0];
              if (candidate && (candidate.startsWith('http://') || candidate.startsWith('https://'))) {
                image = candidate;
              }
            }
          }
          if (!image) {
            image = img.getAttribute('data-src') || img.getAttribute('src') || '';
          }
          image = upgradeDiscogsImageUrl(image);
        }

        let rowWantCount = null;
        let rowHaveCount = null;
        const rowText = row.textContent.toLowerCase();
        const wantMatch = rowText.match(/(\d[\d.,]*)\s*(?:quieren|wants?)/i) || rowText.match(/(?:quieren|wants?)\S*\s*:?\s*(\d[\d.,]*)/i);
        if (wantMatch) rowWantCount = parseInt(wantMatch[1].replace(/[^\d]/g, ''), 10);
        const haveMatch = rowText.match(/(\d[\d.,]*)\s*(?:tienen|haves?)/i) || rowText.match(/(?:tienen|haves?)\S*\s*:?\s*(\d[\d.,]*)/i);
        if (haveMatch) rowHaveCount = parseInt(haveMatch[1].replace(/[^\d]/g, ''), 10);

        let rowForSaleCount = 0;
        const forSaleMatch = rowText.match(/(\d[\d.,]*)\s*(?:en venta|for sale|a la venta|disponibles|copias|items)/i) ||
                             rowText.match(/(?:en venta|for sale|a la venta|disponibles)\s*[:(]?\s*(\d[\d.,]*)/i);
        if (forSaleMatch) {
          rowForSaleCount = parseInt(forSaleMatch[1].replace(/[^\d]/g, ''), 10) || 0;
        } else {
          const sellLink = row.querySelector('a[href*="/sell/release/"], a[href*="/sell/list"]');
          if (sellLink) {
            const sMatch = sellLink.textContent.match(/(\d[\d.,]*)/);
            if (sMatch) rowForSaleCount = parseInt(sMatch[1].replace(/[^\d]/g, ''), 10) || 0;
          }
        }

        wants.push({
          id,
          title,
          artist,
          year: '',
          image,
          wantCount: rowWantCount,
          haveCount: rowHaveCount,
          forSaleCount: rowForSaleCount
        });
      });

      return wants;
    },

    parseReleaseHTML(html, releaseId, buyerCountryVal = 'Uruguay', cacheRepo = null) {
      if (!html) return { listings: [], totalWorldListings: 0, unshippableCount: 0, unshippableLocations: [], communityStats: {} };

      let doc;
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        doc = parser.parseFromString(html, 'text/html');
      } else {
        return { listings: [], totalWorldListings: 0, unshippableCount: 0, unshippableLocations: [], communityStats: {} };
      }

      const listings = [];
      let haveCount = null;
      let wantCount = null;

      try {
        const statsAnchors = doc.querySelectorAll('a[href*="/release/stats/"]');
        statsAnchors.forEach(a => {
          const cleanText = a.textContent.trim();
          const num = parseInt(cleanText.replace(/[^\d]/g, ''), 10);
          if (isNaN(num) || num <= 0) return;

          const parentText = (a.parentElement ? a.parentElement.textContent : '').toLowerCase();
          const containerText = (a.closest('tr, li, div, section') ? a.closest('tr, li, div, section').textContent : '').toLowerCase();
          const contextText = parentText + ' ' + containerText;

          if (contextText.includes('quieren') || contextText.includes('want')) {
            if (wantCount === null) wantCount = num;
          } else if (contextText.includes('tienen') || contextText.includes('have')) {
            if (haveCount === null) haveCount = num;
          }
        });

        let nextDataForSaleCount = 0;
        const nextDataScript = doc.querySelector('script#__NEXT_DATA__');
        if (nextDataScript && nextDataScript.textContent) {
          try {
            const nextData = JSON.parse(nextDataScript.textContent);
            const pProps = nextData?.props?.pageProps;
            const relData = pProps?.release || pProps?.data || pProps?.releaseData;
            if (relData) {
              if (relData.community?.want && wantCount === null) wantCount = parseInt(relData.community.want, 10);
              if (relData.community?.have && haveCount === null) haveCount = parseInt(relData.community.have, 10);
              if (relData.num_want && wantCount === null) wantCount = parseInt(relData.num_want, 10);
              if (relData.num_have && haveCount === null) haveCount = parseInt(relData.num_have, 10);
            }
            const candidateForSale = [
              relData?.num_for_sale,
              relData?.numForSale,
              relData?.community?.num_for_sale,
              relData?.community?.for_sale,
              pProps?.num_for_sale,
              pProps?.numForSale,
              pProps?.listingCount,
              pProps?.totalListings,
              pProps?.totalCount,
              pProps?.marketplace?.num_for_sale,
              pProps?.marketplace?.total,
              pProps?.statistics?.for_sale,
              pProps?.statistics?.total_for_sale
            ];
            for (const c of candidateForSale) {
              const parsed = parseInt(c, 10);
              if (!isNaN(parsed) && parsed > 0 && parsed > nextDataForSaleCount) {
                nextDataForSaleCount = parsed;
              }
            }
          } catch (e) {}
        }

        if (wantCount === null || haveCount === null) {
          const bodyText = doc.body ? doc.body.textContent : html;
          if (wantCount === null) {
            const esWantText = bodyText.match(/(\d[\d.,]*)\s*(?:miembros\s*)?quieren\s*esto/i) ||
                               bodyText.match(/(\d[\d.,]*)\s*people\s*want\s*this/i) ||
                               bodyText.match(/(?:lo quieren|quieren)\s*:\s*(\d[\d.,]*)/i);
            if (esWantText) {
              const num = parseInt(esWantText[1].replace(/[^\d]/g, ''), 10);
              if (!isNaN(num) && num > 0) wantCount = num;
            }
          }

          if (haveCount === null) {
            const esHaveText = bodyText.match(/(\d[\d.,]*)\s*(?:miembros\s*)?tienen\s*esto/i) ||
                               bodyText.match(/(\d[\d.,]*)\s*people\s*have\s*this/i) ||
                               bodyText.match(/(?:lo tienen|tienen)\s*:\s*(\d[\d.,]*)/i);
            if (esHaveText) {
              const num = parseInt(esHaveText[1].replace(/[^\d]/g, ''), 10);
              if (!isNaN(num) && num > 0) haveCount = num;
            }
          }
        }
      } catch (err) {}

      let lowPrice = null;
      let highPrice = null;
      let ratingValue = null;
      let catalogNumber = null;
      let recordLabel = null;
      let jsonLdOffersCount = 0;

      try {
        const jsonLdEls = doc.querySelectorAll('script#release_schema, script[type="application/ld+json"]');
        jsonLdEls.forEach(el => {
          try {
            const data = JSON.parse(el.textContent);
            if (!data) return;
            if (data.catalogNumber && !catalogNumber) catalogNumber = data.catalogNumber;
            if (data.recordLabel && !recordLabel) {
              if (Array.isArray(data.recordLabel) && data.recordLabel[0]?.name) {
                recordLabel = data.recordLabel[0].name;
              } else if (data.recordLabel?.name) {
                recordLabel = data.recordLabel.name;
              }
            }
            if (data.aggregateRating?.ratingValue && !ratingValue) ratingValue = parseFloat(data.aggregateRating.ratingValue);
            if (data.offers) {
              if (!lowPrice) lowPrice = parseFloat(data.offers.lowPrice) || null;
              if (!highPrice) highPrice = parseFloat(data.offers.highPrice) || null;
              if (data.offers.offerCount != null) {
                const count = parseInt(data.offers.offerCount, 10) || 0;
                if (count > jsonLdOffersCount) jsonLdOffersCount = count;
              } else if (Array.isArray(data.offers)) {
                if (data.offers.length > jsonLdOffersCount) jsonLdOffersCount = data.offers.length;
              }
            }
          } catch (itemErr) {}
        });
      } catch (ldErr) {}

      const pageAspBanners = global.ShippingEngine?.extractPageAspBanners
        ? global.ShippingEngine.extractPageAspBanners(html)
        : {};

      let rows = doc.querySelectorAll('.shortcut_navigable');
      if (rows.length === 0) {
        rows = doc.querySelectorAll('tr[class*="shortcut_navigable"], .listing_row, tr');
        rows = Array.from(rows).filter(r => r.querySelector('.seller_info, [class*="seller"]'));
      }

      const rawRowsCount = rows.length;
      let unshippableCount = 0;
      const unshippableLocations = [];

      rows.forEach(row => {
        try {
          const rowTextLower = row.textContent.toLowerCase();
          if (
            rowTextLower.includes('no disponible en') ||
            rowTextLower.includes('does not ship') ||
            rowTextLower.includes('not available in') ||
            rowTextLower.includes('no hace envíos') ||
            rowTextLower.includes('no envia a') ||
            rowTextLower.includes('no envía a')
          ) {
            unshippableCount++;
            const sellerInfoText = row.querySelector('.seller_info')?.textContent || '';
            let shipsFrom = '';
            if (sellerInfoText.toLowerCase().includes('ships from:') || sellerInfoText.toLowerCase().includes('desde:')) {
              const parts = sellerInfoText.split(/(?:Ships From:|Desde:)/i);
              if (parts.length > 1) {
                shipsFrom = parts[1].split('\n')[0].trim();
              }
            } else {
              const locationEl = row.querySelector('.seller_info li:nth-child(3), .seller_info span:nth-child(3)');
              if (locationEl) shipsFrom = locationEl.textContent.trim();
            }
            if (shipsFrom) {
              shipsFrom = shipsFrom.replace(/[\n\r]/g, '').trim();
              if (shipsFrom && !unshippableLocations.includes(shipsFrom)) {
                unshippableLocations.push(shipsFrom);
              }
            }
            return;
          }

          const sellerLink = row.querySelector('.seller_info a, a[href^="/user/"], [class*="seller"] a');
          if (!sellerLink) return;

          let sellerName = '';
          const href = sellerLink.getAttribute('href') || '';
          const sellerMatch = href.match(/\/seller\/([^/]+)\/profile/i);
          const userMatch = href.match(/\/user\/([^/?#]+)/i);

          if (sellerMatch) {
            sellerName = decodeURIComponent(sellerMatch[1]);
          } else if (userMatch) {
            sellerName = decodeURIComponent(userMatch[1]);
          } else {
            sellerName = sellerLink.textContent.trim();
          }

          if (!sellerName || sellerName.toLowerCase() === 'view seller profile' || sellerName.toLowerCase() === 'vendedor') return;

          const sellerIdAttr = row.querySelector('[data-seller-id], .show-shipping-methods, [data-seller-uid]')?.getAttribute('data-seller-id') ||
                               row.querySelector('[data-seller-uid]')?.getAttribute('data-seller-uid') ||
                               row.getAttribute('data-seller-id');
          const sellerId = sellerIdAttr ? parseInt(sellerIdAttr, 10) : null;

          const sellerInfoEl = row.querySelector('.seller_info, [class*="seller_info"], [class*="seller-info"]');
          const sellerInfoText = sellerInfoEl?.textContent || row.textContent || '';
          let rating = 100;
          let ratingCount = 0;

          const ratingMatch = sellerInfoText.match(/(\d+(?:\.\d+)?)\%/);
          if (ratingMatch) rating = parseFloat(ratingMatch[1]);

          const reviewLink = row.querySelector('a[href*="/history"], a[href*="/reviews"], a[href*="/feedback"]');
          if (reviewLink) {
            const matchNum = reviewLink.textContent.match(/([\d.,]+)/);
            if (matchNum) {
              const cleanNum = matchNum[1].replace(/[.,]/g, '');
              if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
            }
          }

          if (!ratingCount) {
            const countMatch = sellerInfoText.match(/\(([\d.,]+)\s*(?:ratings?|valoraciones|calificaciones|evaluaciones|bewertungen)?\)/i);
            if (countMatch) {
              const cleanNum = countMatch[1].replace(/[.,]/g, '');
              if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
            } else {
              const altCount = sellerInfoText.match(/(?:%[,\s]+|ratings?|valoraciones|calificaciones|evaluaciones)[:\s]*([\d.,]+)/i) ||
                               sellerInfoText.match(/([\d.,]+)\s*(?:ratings?|valoraciones|calificaciones|evaluaciones|bewertungen)/i);
              if (altCount) {
                const cleanNum = altCount[1].replace(/[.,]/g, '');
                if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
              }
            }
          }

          let shipsFrom = 'Unknown';
          const shipsFromText = sellerInfoText.toLowerCase();
          if (shipsFromText.includes('ships from:') || shipsFromText.includes('desde:')) {
            const parts = sellerInfoText.split(/(?:Ships From:|Desde:)/i);
            if (parts.length > 1) {
              shipsFrom = parts[1].split('\n')[0].trim();
            }
          } else {
            const locationEl = row.querySelector('.seller_info li:nth-child(3), .seller_info span:nth-child(3)');
            if (locationEl) shipsFrom = locationEl.textContent.trim();
          }
          shipsFrom = shipsFrom.replace(/[\n\r]/g, '').trim();

          const priceEl = row.querySelector('.price, .item_price, .price_value');
          let priceText = '';
          if (priceEl) {
            const priceClone = priceEl.cloneNode(true);
            priceClone.querySelectorAll('.converted_price, .converted-price, .converted').forEach(el => el.remove());
            priceText = priceClone.textContent.trim();
          }

          let priceVal = 0;
          let currency = 'USD';
          const upperPrice = priceText.toUpperCase();
          if (upperPrice.includes('R$') || upperPrice.includes('BRL')) currency = 'BRL';
          else if (upperPrice.includes('€') || upperPrice.includes('EUR')) currency = 'EUR';
          else if (upperPrice.includes('£') || upperPrice.includes('GBP')) currency = 'GBP';
          else if (upperPrice.includes('¥') || upperPrice.includes('JPY')) currency = 'JPY';
          else if (upperPrice.includes('MEX$') || upperPrice.includes('MXN')) currency = 'MXN';
          else if (upperPrice.includes('CA$') || upperPrice.includes('C$') || upperPrice.includes('CAD')) currency = 'CAD';
          else if (upperPrice.includes('A$') || upperPrice.includes('AUD')) currency = 'AUD';
          else if (upperPrice.includes('NZ$') || upperPrice.includes('NZD')) currency = 'NZD';
          else if (upperPrice.includes('CLP')) currency = 'CLP';
          else if (upperPrice.includes('COP')) currency = 'COP';
          else if (upperPrice.includes('ARS')) currency = 'ARS';
          else if (upperPrice.includes('UYU')) currency = 'UYU';
          else if (upperPrice.includes('SEK')) currency = 'SEK';
          else if (upperPrice.includes('NOK')) currency = 'NOK';
          else if (upperPrice.includes('DKK')) currency = 'DKK';
          else if (upperPrice.includes('CHF')) currency = 'CHF';
          else if (upperPrice.includes('ZAR')) currency = 'ZAR';
          else if (upperPrice.includes('USD') || upperPrice.includes('$')) currency = 'USD';

          const priceValAttr = priceEl?.getAttribute('data-pricevalue');
          if (priceValAttr) {
            priceVal = parseFloat(priceValAttr) || 0;
          } else if (priceText) {
            const cleanText = priceText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible|sobre|about|\()/i)[0].trim();
            const cleanPrice = cleanText.replace(/[^\d.,]/g, '');
            priceVal = DiscogsParser.parseLocalePrice(cleanPrice, currency);
          }

          if (currency === 'JPY' && priceText) {
            const cleanText = priceText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible|sobre|about|\()/i)[0].trim();
            const digitsOnly = cleanText.replace(/[^\d]/g, '');
            if (digitsOnly) priceVal = parseInt(digitsOnly, 10) || 0;
          }

          const shippingEl = row.querySelector('.item_shipping, .shipping');
          let shippingText = '';
          if (shippingEl) {
            const shippingClone = shippingEl.cloneNode(true);
            shippingClone.querySelectorAll('.converted_price, .converted-price, .converted').forEach(el => el.remove());
            shippingText = shippingClone.textContent.trim();
          }

          let shippingVal = 0;
          let isShippingEstimated = false;
          let isDirectFree = false;

          if (shippingText) {
            const upperShipping = shippingText.toUpperCase();
            const hasDigits = /\d/.test(shippingText);
            const hasCondition = /(?:pedidos|orders|over|ab\s+\d|desde|partir|compras|solo|nur|only|domestic|innerhalb)/i.test(shippingText);
            isDirectFree = !hasCondition && /^\s*(?:\+\s*)?(?:free\s+shipping|env[íi]o\s+(?:gratis|gratuito)|gratis|free|kostenloser\s+versand|livraison\s+gratuite)\s*$/i.test(shippingText.trim());

            if (isDirectFree) {
              shippingVal = 0;
              isShippingEstimated = false;
            } else if (!hasDigits) {
              isShippingEstimated = true;
              shippingVal = 0;
            } else {
              const cleanText = shippingText.split(/\(|(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible)/i)[0].trim();
              if (currency === 'JPY' || upperShipping.includes('JPY') || upperShipping.includes('¥')) {
                const digitsOnly = cleanText.replace(/[^\d]/g, '');
                shippingVal = parseInt(digitsOnly, 10) || 0;
              } else {
                const cleanShipping = cleanText.replace(/[^\d.,]/g, '');
                shippingVal = DiscogsParser.parseLocalePrice(cleanShipping, currency);
              }
            }
          } else {
            isShippingEstimated = true;
            shippingVal = 0;
          }

          const parsedThresholds = {};
          if (sellerName && pageAspBanners[sellerName.toLowerCase()]) {
            parsedThresholds.aspBannerThreshold = pageAspBanners[sellerName.toLowerCase()];
          }

          const repo = cacheRepo || global.CacheRepository;
          if (!parsedThresholds.aspBannerThreshold && sellerName && repo?.getCachedAspBanner) {
            const cachedThreshold = repo.getCachedAspBanner(sellerName, buyerCountryVal);
            if (cachedThreshold) {
              parsedThresholds.aspBannerThreshold = cachedThreshold;
            }
          }

          const freeShippingThreshold = parsedThresholds.aspBannerThreshold || null;

          const conditionEl = row.querySelector('.item_condition, .condition');
          let mediaCondition = 'VG+';
          let sleeveCondition = 'VG';

          if (conditionEl) {
            const text = conditionEl.textContent.trim();
            if (/Near Mint|\bNM\b|\bM-\b/i.test(text)) mediaCondition = 'NM';
            else if (/\bMint\b|\bM\b/i.test(text) && !/Near/i.test(text)) mediaCondition = 'M';
            else if (/Very Good Plus|VG\+|VGplus/i.test(text)) mediaCondition = 'VG+';
            else if (/Very Good|\bVG\b/i.test(text)) mediaCondition = 'VG';
            else if (/Good Plus|G\+|Gplus/i.test(text)) mediaCondition = 'G+';
            else if (/\bGood\b|\bG\b/i.test(text)) mediaCondition = 'G';
            else if (/\bFair\b|\bF\b/i.test(text)) mediaCondition = 'F';
            else if (/\bPoor\b|\bP\b/i.test(text)) mediaCondition = 'P';

            if (text.includes('(') || text.includes('/')) {
              const sleeveText = text.split(/[\(/]/)[1] || '';
              if (/Near Mint|\bNM\b|\bM-\b/i.test(sleeveText)) sleeveCondition = 'NM';
              else if (/\bMint\b|\bM\b/i.test(sleeveText) && !/Near/i.test(sleeveText)) sleeveCondition = 'M';
              else if (/Very Good Plus|VG\+|VGplus/i.test(sleeveText)) sleeveCondition = 'VG+';
              else if (/Very Good|\bVG\b/i.test(sleeveText)) sleeveCondition = 'VG';
              else if (/Good Plus|G\+|Gplus/i.test(sleeveText)) sleeveCondition = 'G+';
              else if (/\bGood\b|\bG\b/i.test(sleeveText)) sleeveCondition = 'G';
            }
          }

          let mediaCondClass = mediaCondition;
          if (mediaCondClass === 'VG+') mediaCondClass = 'VGplus';
          if (mediaCondClass === 'G+') mediaCondClass = 'Gplus';

          const itemLink = row.querySelector('a[href^="/sell/item/"]');
          const listingUrl = itemLink ? `https://www.discogs.com${itemLink.getAttribute('href')}` : '';
          const listingId = itemLink ? itemLink.getAttribute('href').split('/').pop() : '';

          listings.push({
            releaseId,
            sellerName,
            sellerId: sellerId || null,
            rating,
            ratingCount,
            shipsFrom,
            priceVal,
            shippingVal,
            currency,
            isShippingEstimated,
            isDirectFree,
            freeShippingThreshold,
            thresholds: parsedThresholds,
            mediaCondition,
            mediaCondClass,
            sleeveCondition,
            listingUrl,
            listingId
          });
        } catch (e) {}
      });

      const bodyText = doc.body ? doc.body.textContent : html;
      const bodyTextLower = bodyText.toLowerCase();

      const hasShippingBlockNotice = 
        bodyTextLower.includes('no hay artículos disponibles a la venta que se envíen a') ||
        bodyTextLower.includes('no hay articulos disponibles a la venta que se envien a') ||
        bodyTextLower.includes('no hay copias disponibles a la venta que se envíen a') ||
        bodyTextLower.includes('no hay copias disponibles a la venta que se envien a') ||
        bodyTextLower.includes('no hay artículos disponibles para enviar a') ||
        bodyTextLower.includes('no hay articulos disponibles para enviar a') ||
        bodyTextLower.includes('no se encontraron artículos que se envíen a') ||
        bodyTextLower.includes('no se encontraron articulos que se envien a') ||
        bodyTextLower.includes('no items found that ship to') ||
        bodyTextLower.includes('no items currently available for sale that ship to') ||
        bodyTextLower.includes('no items for sale that ship to') ||
        bodyTextLower.includes('no copies available that ship to') ||
        bodyTextLower.includes('no sellers currently ship to') ||
        bodyTextLower.includes('does not ship to your location') ||
        bodyTextLower.includes('does not ship to your country') ||
        bodyTextLower.includes('items available from other countries') ||
        bodyTextLower.includes('copias disponibles de otros países') ||
        bodyTextLower.includes('copias disponibles de otros paises') ||
        bodyTextLower.includes('artículos disponibles de otros países') ||
        bodyTextLower.includes('articulos disponibles de otros paises');

      let textOffersCount = 0;
      const textMatches = [
        // "Ver los 15 artículos", "Show all 15 items", "Ver todas las 15 copias"
        bodyText.match(/(?:ver|show|view)\s+(?:todos?|all)?\s*(?:los|las)?\s*(\d[\d.,]*)\s*(?:artículos|items|copias|copies|disponibles|ofertas|listings)/i),
        // "En venta: 15", "For sale: 15", "En venta (15)"
        bodyText.match(/(?:en venta|for sale|a la venta|disponibles?)\s*[:(]\s*(\d[\d.,]*)/i),
        // "15 en venta", "15 for sale", "15 a la venta", "15 copias disponibles"
        bodyText.match(/(\d[\d.,]*)\s*(?:copias?|artículos?|items?|ofertas?)?\s*(?:en venta|for sale|a la venta|disponibles?)\b/i),
        // "Mostrando 0 de 15 artículos", "Showing 0 of 15 items"
        bodyText.match(/(?:mostrando|showing)\s+\d+\s*(?:–|-|a|to)?\s*\d*\s*(?:de|of)\s*(\d[\d.,]*)/i),
        // "0 de 15 artículos", "0 of 15 items"
        bodyText.match(/\b0\s+(?:de|of)\s+(\d[\d.,]*)\s*(?:artículos|items|copias|ofertas|resultados|results|listings)/i),
        // "15 de otros países", "15 from other countries"
        bodyText.match(/(\d[\d.,]*)\s*(?:items?|copias?|artículos?)?\s*(?:de otros países|de otros paises|from other countries)/i)
      ];

      for (const tm of textMatches) {
        if (tm && tm[1]) {
          const val = parseInt(tm[1].replace(/[^\d]/g, ''), 10) || 0;
          if (val > textOffersCount) {
            textOffersCount = val;
          }
        }
      }

      // Check specific marketplace release link anchors (e.g. <a href="/sell/release/1234">15 for sale</a>)
      const sellAnchors = doc.querySelectorAll('a[href*="/sell/release/"], a[href*="ships_from="], a[href*="#marketplace"], .release_stats_for_sale, [data-testid*="for-sale"]');
      sellAnchors.forEach(a => {
        const aText = a.textContent.trim();
        const aMatch = aText.match(/(\d[\d.,]*)/);
        if (aMatch) {
          const aCount = parseInt(aMatch[1].replace(/[^\d]/g, ''), 10) || 0;
          if (aCount > textOffersCount) textOffersCount = aCount;
        }
      });

      let nextDataForSaleCount = 0;
      const nextDataScript = doc.querySelector('script#__NEXT_DATA__');
      if (nextDataScript && nextDataScript.textContent) {
        try {
          const nextData = JSON.parse(nextDataScript.textContent);
          const pProps = nextData?.props?.pageProps;
          const relData = pProps?.release || pProps?.data || pProps?.releaseData || pProps?.marketplace;
          const candidateForSale = [
            relData?.num_for_sale,
            relData?.numForSale,
            relData?.marketplace?.total,
            relData?.total,
            relData?.listingCount,
            pProps?.totalListings
          ];
          for (const cand of candidateForSale) {
            if (cand !== undefined && cand !== null) {
              const parsed = typeof cand === 'number' ? cand : parseInt(String(cand).replace(/[^\d]/g, ''), 10);
              if (!isNaN(parsed) && parsed > 0 && parsed > nextDataForSaleCount) {
                nextDataForSaleCount = parsed;
              }
            }
          }
        } catch (e) {}
      }

      let totalWorldListings = Math.max(
        rawRowsCount,
        unshippableCount,
        jsonLdOffersCount || 0,
        textOffersCount || 0,
        nextDataForSaleCount || 0
      );

      // If Discogs explicitly reported that copies exist but don't ship to buyer's country,
      // or if we detected unshippable rows/locations while having 0 valid listings:
      let isBlocked = false;
      if (hasShippingBlockNotice) {
        isBlocked = true;
        if (unshippableCount === 0) {
          unshippableCount = Math.max(1, totalWorldListings);
        }
        if (totalWorldListings === 0) {
          totalWorldListings = unshippableCount;
        }
      } else if (unshippableCount > 0 && listings.length === 0) {
        isBlocked = true;
      } else if (totalWorldListings > 0 && listings.length === 0) {
        isBlocked = true;
        if (unshippableCount === 0) {
          unshippableCount = totalWorldListings;
        }
      }

      return {
        listings,
        totalWorldListings,
        unshippableCount,
        unshippableLocations,
        isBlockedByShipping: isBlocked,
        hasShippingBlockNotice: hasShippingBlockNotice,
        communityStats: {
          haveCount,
          wantCount,
          lowPrice,
          highPrice,
          ratingValue,
          catalogNumber,
          recordLabel,
          totalOffersCount: totalWorldListings
        }
      };
    },

    groupListingsBySeller(allListings, buyerCountryVal = 'Uruguay', cacheRepo = null) {
      const sellersMap = {};
      const repo = cacheRepo || global.CacheRepository;
      const isCountryEU = global.ShippingEngine?.isCountryEU || (() => false);
      const isDomesticSeller = global.ShippingEngine?.isDomesticSeller || (() => false);
      const calculateShipping = global.ShippingEngine?.calculateSellerShipping || global.calculateSellerShipping;
      const currSvc = global.CurrencyService || {
        getCurrencyRate: (curr) => (global.CURRENCY_MAP?.[curr]?.rate || 1.0)
      };

      const isBuyerEU = isCountryEU(buyerCountryVal);

      (allListings || []).forEach(listing => {
        if (!listing) return;
        const sName = (listing.sellerName || '').trim() || 'Vendedor Desconocido';

        const rawPrice = typeof listing.priceVal === 'number' ? listing.priceVal : parseFloat(listing.priceVal);
        listing.priceVal = (!isNaN(rawPrice) && isFinite(rawPrice) && rawPrice > 0) ? rawPrice : 0;

        if (listing.currency === 'JPY' && listing.priceVal < 100) {
          listing.currency = 'USD';
        }

        if (!sellersMap[sName]) {
          const rawRating = typeof listing.rating === 'number' ? listing.rating : parseFloat(listing.rating);
          const rawRatingCount = typeof listing.ratingCount === 'number' ? listing.ratingCount : parseInt(listing.ratingCount, 10);

          const cachedThresh = (listing.thresholds && listing.thresholds.aspBannerThreshold) ||
            (repo?.getCachedAspBanner ? repo.getCachedAspBanner(sName, buyerCountryVal) : null);

          sellersMap[sName] = {
            name: sName,
            sellerId: listing.sellerId || null,
            rating: (!isNaN(rawRating) && isFinite(rawRating)) ? rawRating : 100,
            ratingCount: (!isNaN(rawRatingCount) && isFinite(rawRatingCount)) ? rawRatingCount : 0,
            shipsFrom: (listing.shipsFrom || 'Internacional').trim(),
            currency: listing.currency || 'USD',
            aspBannerThreshold: cachedThresh,
            freeShippingThreshold: cachedThresh,
            listings: []
          };
        } else {
          if (!sellersMap[sName].sellerId && listing.sellerId) {
            sellersMap[sName].sellerId = listing.sellerId;
          }
          if (!sellersMap[sName].aspBannerThreshold && listing.thresholds?.aspBannerThreshold) {
            sellersMap[sName].aspBannerThreshold = listing.thresholds.aspBannerThreshold;
            sellersMap[sName].freeShippingThreshold = listing.thresholds.aspBannerThreshold;
          }
        }

        const existing = sellersMap[sName].listings.find(l => l && String(l.releaseId) === String(listing.releaseId));
        if (existing) {
          if (listing.priceVal < existing.priceVal) {
            const idx = sellersMap[sName].listings.indexOf(existing);
            sellersMap[sName].listings[idx] = listing;
          }
        } else {
          sellersMap[sName].listings.push(listing);
        }
      });

      const grouped = Object.values(sellersMap).map(seller => {
        const listCount = (seller.listings || []).length;
        const subtotal = (seller.listings || []).reduce((sum, item) => sum + (item.priceVal || 0), 0);

        const isDomestic = isDomesticSeller(seller.shipsFrom, buyerCountryVal);
        let isEUToEU = false;
        if (!isDomestic && isBuyerEU && isCountryEU(seller.shipsFrom)) {
          isEUToEU = true;
        }

        seller.isDomestic = isDomestic;
        seller.isEUToEU = isEUToEU;
        seller.freeShippingThreshold = seller.aspBannerThreshold || null;

        let hasFreeShippingUnlocked = false;
        if (seller.freeShippingThreshold && seller.freeShippingThreshold.amount > 0) {
          let thresholdInSellerCurrency = seller.freeShippingThreshold.amount;
          if (seller.freeShippingThreshold.currency && seller.currency && seller.freeShippingThreshold.currency !== seller.currency) {
            const threshRate = currSvc.getCurrencyRate(seller.freeShippingThreshold.currency);
            const sellerRate = currSvc.getCurrencyRate(seller.currency);
            thresholdInSellerCurrency = (thresholdInSellerCurrency / threshRate) * sellerRate;
          }
          hasFreeShippingUnlocked = subtotal >= thresholdInSellerCurrency;
        }

        const estimatedShipping = calculateShipping ? calculateShipping(seller, seller.listings || []) : 0;
        const totalPrice = subtotal + estimatedShipping;

        return {
          ...seller,
          matchCount: listCount,
          subtotal: parseFloat(subtotal.toFixed(2)),
          estimatedShipping: parseFloat(estimatedShipping.toFixed(2)),
          totalPrice: parseFloat(totalPrice.toFixed(2)),
          isDomestic,
          isEUToEU,
          isShippingEstimated: (seller.listings || []).some(l => l && l.isShippingEstimated),
          freeShippingThreshold: seller.freeShippingThreshold || null,
          hasFreeShippingUnlocked
        };
      });

      grouped.sort((a, b) => {
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        return a.totalPrice - b.totalPrice;
      });

      return grouped;
    }
  };

  global.DiscogsParser = DiscogsParser;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiscogsParser;
  }
})(typeof window !== 'undefined' ? window : globalThis);
