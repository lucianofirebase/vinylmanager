/**
 * Vinyl Stock Manager • Marketplace Parser Module (js/parser.js)
 * DOMParser for Discogs marketplace listings, pricing formats, seller metrics & shipping tiers
 */

// Helper to calculate estimated shipping for a seller based on matches count (accounting for weight tiers & per-disc increments)
function calculateSellerShipping(seller, listingsList) {
  const listCount = listingsList.length;
  if (listCount === 0) return 0;
  
  // Base & Incremental shipping rates in USD
  let baseShippingUSD = 6.00;
  let extraItemUSD = 1.50;
  
  if (seller.isDomestic) {
    baseShippingUSD = 4.50;
    extraItemUSD = 1.00; // ~$1.00 per additional item domestic
  } else if (seller.isEUToEU) {
    baseShippingUSD = 9.50;
    extraItemUSD = 1.50; // ~$1.50 per additional item EU
  } else {
    // International / Overseas (handles weight steps ~230g e.g. Royal Mail / USPS / DHL weight brackets)
    baseShippingUSD = 22.00;
    extraItemUSD = 2.00; // ~$2.00 USD (~£1.60 GBP / ~€1.85 EUR per additional LP)
  }
  
  // Convert estimated rates from USD to seller's currency
  const currencyInfo = CURRENCY_MAP[seller.currency] || { rate: 1.0 };
  const conversionFactor = 1.0 / (currencyInfo.rate || 1.0);
  
  const baseShippingInSellerCurrency = baseShippingUSD * conversionFactor;
  const extraItemInSellerCurrency = extraItemUSD * conversionFactor;
  
  // Check if seller offers free shipping over threshold and subtotal meets or exceeds it
  const currentSubtotal = listingsList.reduce((sum, item) => sum + (item.priceVal || 0), 0);
  if (seller && seller.freeShippingThreshold && seller.freeShippingThreshold.amount > 0) {
    let thresholdInSellerCurrency = seller.freeShippingThreshold.amount;
    if (seller.freeShippingThreshold.currency && seller.currency && seller.freeShippingThreshold.currency !== seller.currency) {
      const threshRate = CURRENCY_MAP[seller.freeShippingThreshold.currency]?.rate || 1.0;
      const sellerRate = CURRENCY_MAP[seller.currency]?.rate || 1.0;
      thresholdInSellerCurrency = (thresholdInSellerCurrency / threshRate) * sellerRate;
    }
    if (currentSubtotal >= thresholdInSellerCurrency) {
      return 0; // Free shipping threshold unlocked!
    }
  }

  // Check if we parsed actual shipping costs from listings
  const shippingValues = listingsList.map(l => l.shippingVal).filter(v => v > 0);
  if (shippingValues.length > 0) {
    const maxShipping = Math.max(...shippingValues);
    return maxShipping + (listCount - 1) * extraItemInSellerCurrency;
  } else {
    return baseShippingInSellerCurrency + (listCount - 1) * extraItemInSellerCurrency;
  }
}


function parseWantlistHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const wants = [];
  
  // Find all row elements
  let rows = doc.querySelectorAll('.shortcut_navigable, tr.shortcut_navigable, tr, .want_item, .release-card, [class*="want"]');
  if (rows.length === 0) {
    // Universal fallback: target all release links directly
    rows = doc.querySelectorAll('a[href*="/release/"]');
  }
  
  rows.forEach(row => {
    // Find all release links in row, prioritizing those with non-empty text
    const allLinks = Array.from(row.matches && row.matches('a[href*="/release/"]') ? [row] : row.querySelectorAll('a[href*="/release/"]'));
    const releaseLink = allLinks.find(a => (a.textContent || '').trim().length > 0) || allLinks[0];
    if (!releaseLink) return;
    
    const href = releaseLink.getAttribute('href') || '';
    const match = href.match(/\/release\/(\d+)/);
    if (!match) return;
    
    const id = parseInt(match[1], 10);
    
    // Avoid duplicates
    if (wants.some(w => w.id === id)) return;
    
    // Check specific sub-elements in Discogs table
    const artistEl = row.querySelector('.artist, [class*="artist"], a[href*="/artist/"]');
    const titleEl = row.querySelector('.item_description, .title, [class*="title"], [class*="release-title"]');
    
    let text = (releaseLink.textContent || '').trim();
    let artist = artistEl ? artistEl.textContent.trim() : '';
    let title = titleEl ? titleEl.textContent.trim() : '';
    
    // If not found in specific cells, parse from text
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
    
    // Clean trailing market copies info if present
    artist = artist.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
    title = title.replace(/\s*\d+\s*(?:en venta|for sale)\s*(?:desde|from)\s*.*$/i, '').trim();
    
    // Check if we can get the cover image
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

    // Extract want/have counts from row if present
    let rowWantCount = null;
    let rowHaveCount = null;
    const rowText = row.textContent.toLowerCase();
    const wantMatch = rowText.match(/(\d[\d.,]*)\s*(?:quieren|wants?)/i) || rowText.match(/(?:quieren|wants?)\S*\s*:?\s*(\d[\d.,]*)/i);
    if (wantMatch) rowWantCount = parseInt(wantMatch[1].replace(/[^\d]/g, ''), 10);
    const haveMatch = rowText.match(/(\d[\d.,]*)\s*(?:tienen|haves?)/i) || rowText.match(/(?:tienen|haves?)\S*\s*:?\s*(\d[\d.,]*)/i);
    if (haveMatch) rowHaveCount = parseInt(haveMatch[1].replace(/[^\d]/g, ''), 10);

    // Extract for sale count from row text (e.g. "3 en venta desde US$33,78" or "9 for sale from")
    let rowForSaleCount = 0;
    const forSaleMatch = rowText.match(/(\d[\d.,]*)\s*(?:en venta|for sale)/i);
    if (forSaleMatch) {
      rowForSaleCount = parseInt(forSaleMatch[1].replace(/[^\d]/g, ''), 10) || 0;
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
}


function parseLocalePrice(cleanPrice, currency) {
  if (!cleanPrice) return 0;
  
  // Non-decimal currencies (JPY, UYU, ARS, CLP, COP): remove all dots and commas
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
      // e.g. 1,250 EUR (thousands)
      return parseFloat(cleanPrice.replace(',', '')) || 0;
    }
    // Single comma decimal: 25,50 -> 25.50
    return parseFloat(cleanPrice.replace(',', '.')) || 0;
  } else if (hasDot && !hasComma) {
    const parts = cleanPrice.split('.');
    if (parts[1] && parts[1].length === 3 && (currency === 'EUR' || currency === 'BRL')) {
      // e.g. 1.250 EUR (thousands)
      return parseFloat(cleanPrice.replace('.', '')) || 0;
    }
    return parseFloat(cleanPrice) || 0;
  }
  
  return parseFloat(cleanPrice) || 0;
}


function parseReleaseHTML(html, releaseId) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const listings = [];
  
  // Extract community stats for the release (Haves / Wants)
  let haveCount = null;
  let wantCount = null;

  try {
    // Direct selector for Discogs stats links: <a href="/release/stats/32241999">17</a>
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

    // Fallback: Check __NEXT_DATA__ JSON script tag if present
    if (wantCount === null || haveCount === null) {
      const nextDataScript = doc.querySelector('script#__NEXT_DATA__');
      if (nextDataScript && nextDataScript.textContent) {
        try {
          const nextData = JSON.parse(nextDataScript.textContent);
          const relData = nextData?.props?.pageProps?.release || nextData?.props?.pageProps?.data;
          if (relData) {
            if (relData.community?.want && wantCount === null) wantCount = parseInt(relData.community.want, 10);
            if (relData.community?.have && haveCount === null) haveCount = parseInt(relData.community.have, 10);
            if (relData.num_want && wantCount === null) wantCount = parseInt(relData.num_want, 10);
            if (relData.num_have && haveCount === null) haveCount = parseInt(relData.num_have, 10);
          }
        } catch (e) {}
      }
    }

    // Fallback: Precise regex matching on "miembros quieren esto" or "quieren esto"
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
  } catch (err) {
    console.warn('Error parsing community stats:', err);
  }

  // Extract structured JSON-LD metadata schema if available
  let lowPrice = null;
  let highPrice = null;
  let ratingValue = null;
  let catalogNumber = null;
  let recordLabel = null;

  let jsonLdOffersCount = 0;
  try {
    const jsonLdEl = doc.querySelector('script#release_schema, script[type="application/ld+json"]');
    if (jsonLdEl) {
      const data = JSON.parse(jsonLdEl.textContent);
      if (data) {
        if (data.catalogNumber) catalogNumber = data.catalogNumber;
        if (data.recordLabel && Array.isArray(data.recordLabel) && data.recordLabel[0]?.name) {
          recordLabel = data.recordLabel[0].name;
        } else if (data.recordLabel?.name) {
          recordLabel = data.recordLabel.name;
        }
        if (data.aggregateRating?.ratingValue) ratingValue = parseFloat(data.aggregateRating.ratingValue);
        if (data.offers) {
          lowPrice = parseFloat(data.offers.lowPrice) || null;
          highPrice = parseFloat(data.offers.highPrice) || null;
          if (data.offers.offerCount != null) {
            jsonLdOffersCount = parseInt(data.offers.offerCount, 10) || 0;
          } else if (Array.isArray(data.offers)) {
            jsonLdOffersCount = data.offers.length;
          }
        }
      }
    }
  } catch (ldErr) {
    console.warn('Error parsing release_schema JSON-LD:', ldErr);
  }
  
  // Find listings rows
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
      // Check if seller does not ship to buyer's location (skip them)
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
        // Capture seller location if available
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
        return; // Skip this listing
      }

      // 1. Seller Name (extracted from href to prevent issues with browser translations)
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
      
      // 2. Seller Rating and Ratings Count
      const sellerInfoEl = row.querySelector('.seller_info, [class*="seller_info"], [class*="seller-info"]');
      const sellerInfoText = sellerInfoEl?.textContent || row.textContent || '';
      let rating = 100;
      let ratingCount = 0;
      
      const ratingMatch = sellerInfoText.match(/(\d+(?:\.\d+)?)\%/);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      }
      
      // Look for reviews count in explicit review/history/feedback links first
      const reviewLink = row.querySelector('a[href*="/history"], a[href*="/reviews"], a[href*="/feedback"]');
      if (reviewLink) {
        const matchNum = reviewLink.textContent.match(/([\d.,]+)/);
        if (matchNum) {
          const cleanNum = matchNum[1].replace(/[.,]/g, '');
          if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
        }
      }
      
      if (!ratingCount) {
        // Pattern 1: With parens, e.g. (5,420 ratings), (5.420 valoraciones), (120)
        const countMatch = sellerInfoText.match(/\(([\d.,]+)\s*(?:ratings?|valoraciones|calificaciones|evaluaciones|bewertungen)?\)/i);
        if (countMatch) {
          const cleanNum = countMatch[1].replace(/[.,]/g, '');
          if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
        } else {
          // Pattern 2: Without parens, e.g. 99.5%, 1,234 ratings or 5.420 valoraciones
          const altCount = sellerInfoText.match(/(?:%[,\s]+|ratings?|valoraciones|calificaciones|evaluaciones)[:\s]*([\d.,]+)/i)
            || sellerInfoText.match(/([\d.,]+)\s*(?:ratings?|valoraciones|calificaciones|evaluaciones|bewertungen)/i);
          if (altCount) {
            const cleanNum = altCount[1].replace(/[.,]/g, '');
            if (cleanNum && !isNaN(cleanNum)) ratingCount = parseInt(cleanNum, 10);
          }
        }
      }
      
      // 3. Ships From
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
      
      // Clean shipsFrom location string
      shipsFrom = shipsFrom.replace(/[\n\r]/g, '').trim();
      
      // 4. Price & Currency (Parse original seller price to prevent double shipping addition in converted prices)
      const priceEl = row.querySelector('.price, .item_price, .price_value');
      let priceText = '';
      if (priceEl) {
        const priceClone = priceEl.cloneNode(true);
        priceClone.querySelectorAll('.converted_price, .converted-price, .converted').forEach(el => el.remove());
        priceText = priceClone.textContent.trim();
      }
      
      let priceVal = 0;
      let currency = 'USD';
      let source = 'original';
      
      // Detect the original currency code FIRST from the original price text
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
      else {
        currency = 'USD'; // default fallback
      }
      
      const priceValAttr = priceEl?.getAttribute('data-pricevalue');
      if (priceValAttr) {
        source = 'data-pricevalue';
        priceVal = parseFloat(priceValAttr) || 0;
      } else if (priceText) {
        source = 'price_element_text';
        const cleanText = priceText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible|sobre|about|\()/i)[0].trim();
        const cleanPrice = cleanText.replace(/[^\d.,]/g, '');
        priceVal = parseLocalePrice(cleanPrice, currency);
      }

      // Handle JPY non-decimal thousands separator fix for priceVal
      if (currency === 'JPY' && priceText) {
        const cleanText = priceText.split(/(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible|sobre|about|\()/i)[0].trim();
        const digitsOnly = cleanText.replace(/[^\d]/g, '');
        if (digitsOnly) priceVal = parseInt(digitsOnly, 10) || 0;
      }
      
      // 5. Shipping (Parse original shipping cost to match the original currency of the price)
      const shippingEl = row.querySelector('.item_shipping, .shipping');
      let shippingText = '';
      if (shippingEl) {
        const shippingClone = shippingEl.cloneNode(true);
        shippingClone.querySelectorAll('.converted_price, .converted-price, .converted').forEach(el => el.remove());
        shippingText = shippingClone.textContent.trim();
      }
      let shippingVal = 0;
      let rawShippingText = shippingText;
      let isShippingEstimated = false;
      
      if (shippingText) {
        const upperShipping = shippingText.toUpperCase();
        const hasDigits = /\d/.test(shippingText);
        const isFree = shippingText.toLowerCase().includes('gratis') || shippingText.toLowerCase().includes('free');
        
        if (isFree) {
          shippingVal = 0;
          isShippingEstimated = false;
        } else if (!hasDigits) {
          isShippingEstimated = true;
          shippingVal = 0; // will fall back to base shipping rate in estimate calculations
        } else {
          // We split by parenthesis first to avoid parsing the converted parentheses value
          const cleanText = shippingText.split(/\(|(?:\+tax|\+envío|\+shipping|envío|shipping|Es posible)/i)[0].trim();
          if (currency === 'JPY' || upperShipping.includes('JPY') || upperShipping.includes('¥')) {
            const digitsOnly = cleanText.replace(/[^\d]/g, '');
            shippingVal = parseInt(digitsOnly, 10) || 0;
          } else {
            const cleanShipping = cleanText.replace(/[^\d.,]/g, '');
            shippingVal = parseLocalePrice(cleanShipping, currency);
          }
        }
      } else {
        isShippingEstimated = true;
        shippingVal = 0; // will fall back to base shipping rate in estimate calculations
      }

      // 5b. Detect Free Shipping Threshold (e.g. "Free shipping on orders over $50", "Envío gratis a partir de €75")
      let freeShippingThreshold = null;
      const fullRowText = (row.textContent || '') + ' ' + (shippingText || '');
      const freeShipMatch = fullRowText.match(/(?:free\s+(?:shipping|delivery|postage)|env[íi]o\s+(?:gratis|gratuito)|port\s+gratuit|livraison\s+gratuite|kostenloser\s+versand|spedizione\s+gratuita)\s*(?:on\s+orders\s+over|for\s+orders\s+over|orders\s+over|orders\s+from|over|from|a\s+partir\s+de|en\s+pedidos\s+(?:de\s+m[áa]s\s+de|superiores\s+a)|superando\s+(?:los\s+)?|en\s+compras\s+mayores\s+a|ab|d[èe]s|oltre)\s*([^\n.,;()]+(?:[.,]\d{1,2})?)/i);

      if (freeShipMatch) {
        const rawMatch = freeShipMatch[1].trim();
        const cleanDigits = rawMatch.replace(/[^\d.,]/g, '');
        if (cleanDigits) {
          let threshCurrency = currency;
          const matchContext = freeShipMatch[0].toUpperCase();
          if (matchContext.includes('EUR') || matchContext.includes('€')) threshCurrency = 'EUR';
          else if (matchContext.includes('GBP') || matchContext.includes('£')) threshCurrency = 'GBP';
          else if (matchContext.includes('USD') || matchContext.includes('$')) threshCurrency = 'USD';
          else if (matchContext.includes('JPY') || matchContext.includes('¥')) threshCurrency = 'JPY';
          else if (matchContext.includes('CAD') || matchContext.includes('CA$')) threshCurrency = 'CAD';
          else if (matchContext.includes('AUD') || matchContext.includes('AU$')) threshCurrency = 'AUD';

          const thresholdVal = parseLocalePrice(cleanDigits, threshCurrency);
          if (thresholdVal > 0) {
            freeShippingThreshold = {
              amount: thresholdVal,
              currency: threshCurrency,
              raw: freeShipMatch[0].trim()
            };
          }
        }
      }

      // 6. Condition (Avoid regex \b boundary bug on '+')
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
      
      // Standardize VGplus and Gplus text representation for DOM classes
      let mediaCondClass = mediaCondition;
      if (mediaCondClass === 'VG+') mediaCondClass = 'VGplus';
      if (mediaCondClass === 'G+') mediaCondClass = 'Gplus';
      
      // 7. Listing URL/ID
      const itemLink = row.querySelector('a[href^="/sell/item/"]');
      const listingUrl = itemLink ? `https://www.discogs.com${itemLink.getAttribute('href')}` : '';
      const listingId = itemLink ? itemLink.getAttribute('href').split('/').pop() : '';
      
      listings.push({
        releaseId,
        sellerName,
        rating,
        ratingCount,
        shipsFrom,
        priceVal,
        shippingVal,
        currency,
        isShippingEstimated,
        freeShippingThreshold,
        mediaCondition,
        mediaCondClass,
        sleeveCondition,
        listingUrl,
        listingId
      });
    } catch (e) {
      console.error('Error parsing row:', e);
    }
  });
  
  let textOffersCount = 0;
  const bodyText = doc.body ? doc.body.textContent : html;
  const offerMatch = bodyText.match(/(\d[\d.,]*)\s*(?:en venta|for sale|items? for sale)/i);
  if (offerMatch) {
    textOffersCount = parseInt(offerMatch[1].replace(/[^\d]/g, ''), 10) || 0;
  }

  const totalWorldListings = Math.max(
    rawRowsCount,
    unshippableCount,
    jsonLdOffersCount || 0,
    textOffersCount || 0
  );

  return {
    listings: listings,
    totalWorldListings: totalWorldListings,
    unshippableCount: unshippableCount,
    unshippableLocations: unshippableLocations,
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
}


function groupListingsBySeller() {
  const sellersMap = {};
  const buyerCountryVal = (buyerCountry ? buyerCountry.value : 'Uruguay') || 'Uruguay';
  
  // List of European countries to check EU-to-EU shipping
  const euroCountries = ['spain', 'germany', 'france', 'italy', 'united kingdom', 'uk', 'netherlands', 'belgium', 'austria', 'switzerland', 'sweden', 'norway', 'portugal', 'greece', 'poland', 'ireland', 'spain (es)', 'deutschland', 'de', 'es'];
  
  const isCountryEU = (c) => {
    if (!c || typeof c !== 'string') return false;
    const lower = c.toLowerCase();
    return euroCountries.some(eu => lower.includes(eu));
  };
  const isBuyerEU = isCountryEU(buyerCountryVal);

  (state.allListings || []).forEach(listing => {
    if (!listing) return;
    const sName = (listing.sellerName || '').trim() || 'Vendedor Desconocido';
    
    // Normalize and sanitize price value
    const rawPrice = typeof listing.priceVal === 'number' ? listing.priceVal : parseFloat(listing.priceVal);
    listing.priceVal = (!isNaN(rawPrice) && isFinite(rawPrice) && rawPrice > 0) ? rawPrice : 0;

    // Preserve the detected listing currency
    if (listing.currency === 'JPY' && listing.priceVal < 100) {
      listing.currency = 'USD';
    }
    
    if (!sellersMap[sName]) {
      const rawRating = typeof listing.rating === 'number' ? listing.rating : parseFloat(listing.rating);
      const rawRatingCount = typeof listing.ratingCount === 'number' ? listing.ratingCount : parseInt(listing.ratingCount, 10);
      sellersMap[sName] = {
        name: sName,
        rating: (!isNaN(rawRating) && isFinite(rawRating)) ? rawRating : 100,
        ratingCount: (!isNaN(rawRatingCount) && isFinite(rawRatingCount)) ? rawRatingCount : 0,
        shipsFrom: (listing.shipsFrom || 'Internacional').trim(),
        currency: listing.currency || 'USD',
        freeShippingThreshold: listing.freeShippingThreshold || null,
        listings: []
      };
    } else if (!sellersMap[sName].freeShippingThreshold && listing.freeShippingThreshold) {
      sellersMap[sName].freeShippingThreshold = listing.freeShippingThreshold;
    }
    
    // Avoid double listings of same release by same seller (keep cheapest copy)
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
  
  // Convert map to array and calculate metrics
  state.groupedSellers = Object.values(sellersMap).map(seller => {
    const listCount = (seller.listings || []).length;
    const subtotal = (seller.listings || []).reduce((sum, item) => sum + (item.priceVal || 0), 0);
    
    // Determine location relationship defensively using universal country matching
    let isDomestic = false;
    if (typeof isDomesticSeller === 'function') {
      isDomestic = isDomesticSeller(seller.shipsFrom, buyerCountryVal);
    } else {
      const shipsFromLower = (seller.shipsFrom || '').toLowerCase();
      const buyerLower = (buyerCountryVal || 'uruguay').toLowerCase();
      isDomestic = shipsFromLower.includes(buyerLower) || buyerLower.includes(shipsFromLower);
    }
    
    let isEUToEU = false;
    if (!isDomestic && isBuyerEU && isCountryEU(seller.shipsFrom)) {
      isEUToEU = true;
    }
    
    // Save properties to seller object
    seller.isDomestic = isDomestic;
    seller.isEUToEU = isEUToEU;
    
    let hasFreeShippingUnlocked = false;
    if (seller.freeShippingThreshold && seller.freeShippingThreshold.amount > 0) {
      let thresholdInSellerCurrency = seller.freeShippingThreshold.amount;
      if (seller.freeShippingThreshold.currency && seller.currency && seller.freeShippingThreshold.currency !== seller.currency) {
        const threshRate = CURRENCY_MAP[seller.freeShippingThreshold.currency]?.rate || 1.0;
        const sellerRate = CURRENCY_MAP[seller.currency]?.rate || 1.0;
        thresholdInSellerCurrency = (thresholdInSellerCurrency / threshRate) * sellerRate;
      }
      hasFreeShippingUnlocked = subtotal >= thresholdInSellerCurrency;
    }
    
    const estimatedShipping = calculateSellerShipping(seller, seller.listings || []);
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
  
  console.log('Grouped sellers with location-based shipping:', state.groupedSellers);
  populateCountryFilter();
}

