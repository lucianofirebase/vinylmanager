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
  
  // STRICT RULE: Free shipping threshold ONLY exists if official Discogs ASP banner was detected
  // "solo condiciona a partir de este Detección de la barra oficial de Discogs (ASP Banner): si no tiene este no tiene envio gratis."
  const thresholdObj = seller?.aspBannerThreshold || (seller?.freeShippingThreshold?.scope === 'asp_banner' ? seller.freeShippingThreshold : null);

  if (thresholdObj && thresholdObj.amount > 0) {
    let thresholdInSellerCurrency = thresholdObj.amount;
    if (thresholdObj.currency && seller.currency && thresholdObj.currency !== seller.currency) {
      const threshRate = CURRENCY_MAP[thresholdObj.currency]?.rate || 1.0;
      const sellerRate = CURRENCY_MAP[seller.currency]?.rate || 1.0;
      thresholdInSellerCurrency = (thresholdInSellerCurrency / threshRate) * sellerRate;
    }
    if (currentSubtotal >= thresholdInSellerCurrency) {
      return 0; // Free shipping threshold unlocked!
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
    if (seller.officialShippingCurrency && seller.currency && seller.officialShippingCurrency !== seller.currency) {
      const offRate = CURRENCY_MAP[seller.officialShippingCurrency]?.rate || 1.0;
      const selRate = CURRENCY_MAP[seller.currency]?.rate || 1.0;
      baseOfficial = (baseOfficial / offRate) * selRate;
    }
    return baseOfficial + (listCount - 1) * extraItemInSellerCurrency;
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

function detectCurrencyInContext(text, fallbackCurrency = 'USD') {
  if (!text) return fallbackCurrency;
  const upper = text.toUpperCase();
  if (upper.includes('EUR') || upper.includes('€')) return 'EUR';
  if (upper.includes('GBP') || upper.includes('£')) return 'GBP';
  if (upper.includes('USD') || upper.includes('$')) return 'USD';
  if (upper.includes('JPY') || upper.includes('¥')) return 'JPY';
  if (upper.includes('CAD') || upper.includes('CA$')) return 'CAD';
  if (upper.includes('AUD') || upper.includes('AU$')) return 'AUD';
  return fallbackCurrency;
}

const OFFICIAL_ASP_BANNER_REGEX = /(?:(?!(?:ofrece|offers|bietet|offre))\b([a-zA-Z0-9_\-\.]{1,50})\s+)?(?:ofrece|offers|bietet|offre)\s+(?:env[íi]o\s+(?:gratuito|gratis)|free\s+shipping|kostenlosen?\s+versand|frais\s+de\s+port\s+gratuits?|la\s+livraison\s+gratuite|spedizione\s+gratuita)\s+(?:en\s+pedidos\s+(?:de(?:\s+m[áa]s\s+de)?|a\s+partir\s+de)?|on\s+orders\s+(?:of|over|from)|for\s+orders\s+(?:of|over)|f[üu]r\s+bestellungen\s+ab|ab|d[èe]s|pour\s+les\s+commandes\s+de|per\s+ordini\s+di)\s*(?:[€$£¥]\s*|\b(?:eur|usd|gbp|cad|aud)\b\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/i;

const OFFICIAL_ASP_BANNER_GLOBAL_REGEX = /(?:(?!(?:ofrece|offers|bietet|offre))\b([a-zA-Z0-9_\-\.]{1,50})\s+)?(?:ofrece|offers|bietet|offre)\s+(?:env[íi]o\s+(?:gratuito|gratis)|free\s+shipping|kostenlosen?\s+versand|frais\s+de\s+port\s+gratuits?|la\s+livraison\s+gratuite|spedizione\s+gratuita)\s+(?:en\s+pedidos\s+(?:de(?:\s+m[áa]s\s+de)?|a\s+partir\s+de)?|on\s+orders\s+(?:of|over|from)|for\s+orders\s+(?:of|over)|f[üu]r\s+bestellungen\s+ab|ab|d[èe]s|pour\s+les\s+commandes\s+de|per\s+ordini\s+di)\s*(?:[€$£¥]\s*|\b(?:eur|usd|gbp|cad|aud)\b\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/gi;

const ASP_CACHE_PREFIX = 'discogs_asp_banner_v12_';
const ASP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SELLER_ID_CACHE_PREFIX = 'discogs_seller_id_';

// Cleanup legacy cache keys on load (purge all entries older than v12 which were fetched without country filtering)
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith('discogs_asp_banner_') && !k.startsWith('discogs_asp_banner_v12_')) {
      localStorage.removeItem(k);
    }
  }
} catch (e) {}

function getCachedAspBanner(sellerName, buyerCountryVal = null) {
  if (!sellerName) return undefined;
  const cleanSeller = sellerName.trim();
  const buyer = buyerCountryVal || (typeof buyerCountry !== 'undefined' && buyerCountry ? buyerCountry.value : (typeof state !== 'undefined' && state && state.buyerCountry ? state.buyerCountry : 'Uruguay')) || 'Uruguay';
  const cacheKey = `${ASP_CACHE_PREFIX}${cleanSeller.toLowerCase()}_${buyer.toLowerCase()}`;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return undefined;
    const data = JSON.parse(raw);
    if (data && (Date.now() - data.timestamp < ASP_CACHE_TTL_MS)) {
      if (data.threshold) return data.threshold;
      if (data.hasBanner === false) return null; // Verified no banner
    }
  } catch (e) {}
  return undefined;
}

function setCachedAspBanner(sellerName, buyerCountryVal, threshold) {
  if (!sellerName) return;
  const cleanSeller = sellerName.trim();
  const buyer = buyerCountryVal || (typeof buyerCountry !== 'undefined' && buyerCountry ? buyerCountry.value : (typeof state !== 'undefined' && state && state.buyerCountry ? state.buyerCountry : 'Uruguay')) || 'Uruguay';
  const cacheKey = `${ASP_CACHE_PREFIX}${cleanSeller.toLowerCase()}_${buyer.toLowerCase()}`;
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      hasBanner: Boolean(threshold),
      threshold: threshold || null
    }));
  } catch (e) {}
}

/**
 * Parse official Discogs shipping policies JSON endpoint:
 * https://api.discogs.com/v3/marketplace/shipping/policies?seller_id=${seller_id}&country=${country}
 */
function parseShippingPoliciesJson(data, buyerCountryVal = 'Uruguay') {
  if (!data || !Array.isArray(data.policies)) return null;
  const buyerLower = (buyerCountryVal || 'uruguay').toLowerCase();

  // Find policy that covers the buyer's country
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
}

/**
 * Resolve Discogs seller numeric ID from username if not present on marketplace row
 */
async function resolveSellerId(sellerName) {
  if (!sellerName) return null;
  const cleanSeller = sellerName.trim();
  const cacheKey = `${SELLER_ID_CACHE_PREFIX}${cleanSeller.toLowerCase()}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsedId = parseInt(cached, 10);
      if (parsedId > 0) return parsedId;
    }
  } catch (e) {}

  try {
    const userUrl = `https://api.discogs.com/users/${encodeURIComponent(cleanSeller)}`;
    let userJsonStr = null;
    if (typeof fetchThroughTab === 'function') {
      try {
        userJsonStr = await fetchThroughTab(userUrl);
      } catch (tabErr) {}
    }
    if (!userJsonStr && typeof fetchDirect === 'function') {
      try {
        userJsonStr = await fetchDirect(userUrl);
      } catch (dirErr) {}
    }
    if (!userJsonStr) {
      try {
        const resp = await fetch(userUrl, { headers: { 'Accept': 'application/json' } });
        if (resp.ok) userJsonStr = await resp.text();
      } catch (fErr) {}
    }

    if (userJsonStr) {
      const userData = typeof userJsonStr === 'object' ? userJsonStr : JSON.parse(userJsonStr);
      if (userData && userData.id) {
        const id = parseInt(userData.id, 10);
        if (id > 0) {
          try {
            localStorage.setItem(cacheKey, String(id));
          } catch (e) {}
          return id;
        }
      }
    }
  } catch (e) {
    console.warn(`[DEBUG ASP] Error resolviendo sellerId para ${cleanSeller}:`, e);
  }
  return null;
}

let aspRateLimitCooldownUntil = 0;

function isAspRateLimited() {
  return Date.now() < aspRateLimitCooldownUntil;
}
if (typeof window !== 'undefined') {
  window.isAspRateLimited = isAspRateLimited;
}

/**
 * Maps a country name to its ISO-3166-1 alpha-2 code for use in Discogs country-filtered URLs.
 * Returns null if no mapping is found (will use unfiltered URL as fallback).
 */
function countryNameToCode(countryName) {
  if (!countryName) return null;
  const lower = countryName.toLowerCase().trim();
  const map = {
    'uruguay': 'UY', 'argentina': 'AR', 'brazil': 'BR', 'chile': 'CL', 'colombia': 'CO',
    'peru': 'PE', 'mexico': 'MX', 'united states': 'US', 'usa': 'US', 'us': 'US',
    'canada': 'CA', 'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
    'germany': 'DE', 'deutschland': 'DE', 'france': 'FR', 'spain': 'ES', 'españa': 'ES',
    'italy': 'IT', 'netherlands': 'NL', 'belgium': 'BE', 'sweden': 'SE', 'norway': 'NO',
    'denmark': 'DK', 'finland': 'FI', 'poland': 'PL', 'czech republic': 'CZ',
    'austria': 'AT', 'switzerland': 'CH', 'portugal': 'PT', 'greece': 'GR',
    'australia': 'AU', 'new zealand': 'NZ', 'japan': 'JP', 'south korea': 'KR',
    'china': 'CN', 'india': 'IN', 'russia': 'RU', 'south africa': 'ZA',
    'israel': 'IL', 'turkey': 'TR', 'indonesia': 'ID', 'philippines': 'PH',
    'thailand': 'TH', 'malaysia': 'MY', 'singapore': 'SG', 'hong kong': 'HK',
    'taiwan': 'TW', 'ukraine': 'UA', 'hungary': 'HU', 'romania': 'RO',
    'slovakia': 'SK', 'croatia': 'HR', 'slovenia': 'SI', 'serbia': 'RS',
    'bulgaria': 'BG', 'estonia': 'EE', 'latvia': 'LV', 'lithuania': 'LT',
    'ireland': 'IE', 'iceland': 'IS', 'luxembourg': 'LU', 'malta': 'MT',
    'cyprus': 'CY', 'latvia': 'LV'
  };
  return map[lower] || null;
}

/**
 * Parse the seller's storefront HTML DOM for official Discogs ASP free-shipping promo banners.
 * Looks for the dedicated banner element Discogs renders (e.g. <div class="seller-promo"> or 
 * similar promo text blocks), then falls back to regex on page text.
 * Returns threshold object or null.
 */
function parseStorefrontHtmlForBanner(html, buyer, sellerShipsFrom) {
  if (!html || html.length < 200) return null;

  try {
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(html, 'text/html');

    // 1. Check if seller explicitly does NOT ship to buyer country (hard negative)
    const bodyText = (doc.body ? doc.body.textContent : html);
    const buyerLower = buyer.toLowerCase();
    const doesNotShipPatterns = [
      /does\s+not\s+ship\s+to/i,
      /no\s+hace?\s+env[íi]os?\s+a/i,
      /no\s+envia?\s+a/i,
      /not\s+available\s+in/i,
      /no\s+disponible\s+en/i
    ];
    // Only mark as hard negative if the text mentions the buyer country explicitly
    for (const pat of doesNotShipPatterns) {
      const match = bodyText.match(pat);
      if (match) {
        const context = bodyText.slice(
          Math.max(0, (bodyText.indexOf(match[0])) - 5),
          Math.min(bodyText.length, (bodyText.indexOf(match[0])) + match[0].length + 60)
        ).toLowerCase();
        if (context.includes(buyerLower) || context.includes('uruguay') && buyerLower.includes('urug')) {
          console.log(`[DEBUG ASP] Hard negative: seller does not ship to "${buyer}"`);
          return { _hardNegative: true };
        }
      }
    }

    // 2. DOM-first: look for Discogs promo/banner elements
    const bannerSelectors = [
      '.seller-promo', '.seller-promo-banner', '[class*="seller-promo"]',
      '[class*="sellerPromo"]', '[class*="promo-banner"]', '[class*="PromoBanner"]',
      '.asp-banner', '[data-asp]', '[class*="free-shipping-banner"]',
      '[class*="freeShipping"]', '.marketplace-promo', '[class*="marketplacePromo"]'
    ];

    for (const sel of bannerSelectors) {
      const el = doc.querySelector(sel);
      if (el) {
        const bannerText = el.textContent || '';
        const parsed = parseFreeShippingThresholds(bannerText, null, buyer, sellerShipsFrom);
        if (parsed?.aspBannerThreshold) {
          console.log(`[DEBUG ASP] ✓ Banner DOM element found (${sel}):`, parsed.aspBannerThreshold);
          return parsed.aspBannerThreshold;
        }
      }
    }

    // 3. Regex on full page text (existing approach)
    const parsed = parseFreeShippingThresholds(html, null, buyer, sellerShipsFrom);
    if (parsed?.aspBannerThreshold) {
      console.log(`[DEBUG ASP] ✓ Banner found via regex on page text:`, parsed.aspBannerThreshold);
      return parsed.aspBannerThreshold;
    }
  } catch (e) {
    console.warn('[DEBUG ASP] Error parsing storefront HTML:', e.message);
  }

  return null;
}

async function checkSellerAspBanner(sellerName, buyerCountryVal = null, sellerId = null, sellerShipsFrom = null) {
  if (!sellerName) return null;
  const cleanSeller = sellerName.trim();
  const buyer = buyerCountryVal || (typeof buyerCountry !== 'undefined' && buyerCountry ? buyerCountry.value : (typeof state !== 'undefined' && state && state.buyerCountry ? state.buyerCountry : 'Uruguay')) || 'Uruguay';
  
  if (Date.now() < aspRateLimitCooldownUntil) {
    console.warn(`[DEBUG ASP] Cooldown activo por 429 (${Math.ceil((aspRateLimitCooldownUntil - Date.now()) / 1000)}s restantes). Omitiendo "${cleanSeller}".`);
    return null;
  }

  const cached = getCachedAspBanner(sellerName, buyer);
  if (cached !== undefined) {
    return cached;
  }

  console.group(`🔍 [DEBUG ASP] "${cleanSeller}" para país "${buyer}"`);

  let threshold = null;
  let fetchSucceeded = false;

  // Build country-filtered storefront URL so Discogs shows only listings/banners valid for buyer's country
  const countryCode = countryNameToCode(buyer);
  const storeBaseUrl = `https://www.discogs.com/seller/${encodeURIComponent(cleanSeller)}`;
  const storeUrl = countryCode
    ? `${storeBaseUrl}?ships_to=${encodeURIComponent(countryCode)}`
    : storeBaseUrl;

  // Scrape seller storefront page HTML (with country filter applied)
  if (typeof fetchThroughTab === 'function') {
    try {
      console.log(`[DEBUG ASP] Solicitando URL (storefront con país "${buyer}" / código "${countryCode || 'N/A'}"): ${storeUrl}`);
      const storeHtml = await fetchThroughTab(storeUrl);
      if (storeHtml && storeHtml.length > 200) {
        fetchSucceeded = true;
        const result = parseStorefrontHtmlForBanner(storeHtml, buyer, sellerShipsFrom);
        if (result && result._hardNegative) {
          // Seller explicitly does not ship to buyer's country → cache as confirmed no-banner
          console.log(`[DEBUG ASP] Seller "${cleanSeller}" confirmed does not ship to "${buyer}". Caching negative.`);
          console.groupEnd();
          setCachedAspBanner(cleanSeller, buyer, null);
          return null;
        }
        threshold = result || null;
      }
    } catch (errStore) {
      console.warn(`[DEBUG ASP] Storefront falló para ${cleanSeller}:`, errStore.message);
      if (errStore.isRateLimited || errStore.status === 429 || (errStore.message && errStore.message.includes('429'))) {
        aspRateLimitCooldownUntil = Date.now() + 30000;
        console.warn(`[DEBUG ASP] 429 Detectado en Discogs. Activando cooldown de 30 segundos.`);
      }
    }
  }

  if (threshold) {
    console.log(`[DEBUG ASP] ✓ Encontrado umbral oficial para ${cleanSeller}:`, threshold);
  } else {
    console.log(`[DEBUG ASP] ✗ Sin umbral de envío gratis oficial para ${cleanSeller} hacia ${buyer}`);
  }

  console.groupEnd();
  
  if (fetchSucceeded) {
    setCachedAspBanner(cleanSeller, buyer, threshold);
  } else {
    console.warn(`[DEBUG ASP] No se obtuvo respuesta válida para ${cleanSeller}, NO se guarda resultado negativo.`);
  }

  return threshold;
}

const OFFICIAL_MODAL_SHIPPING_REGEX = /(?:free\s+shipping|env[íi]o\s+(?:gratuito|gratis)|kostenloser\s+versand|frais\s+de\s+port\s+gratuits?|livraison\s+gratuite|spedizione\s+gratuita)\s*:\s*[\s\S]{0,100}?\b(?:subtotal|zwischensumme|sous-total|subtotale|pedido|order)\b[\s\S]{0,80}?(?:debe\s+ser|must\s+be|doit\s+[êe]tre|muss\s+mindestens|deve\s+essere|al\s+menos|at\s+least|mindestens)[\s\S]{0,40}?(?:de\s+|d'au\s+moins\s+)?(?:[€$£¥]\s*|\b(?:eur|usd|gbp|cad|aud)\b\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/i;

const GENERAL_FREE_SHIP_REGEX = /(?:free\s+(?:(?:worldwide|international|domestic|airmail|standard|express)\s+)?(?:shipping|delivery|postage)|env[íi]o\s+(?:(?:internacional|dom[ée]stico|est[áa]ndar|express)\s+)?(?:gratis|gratuito)|port\s+gratuit|livraison\s+gratuite|kostenloser\s+versand|spedizione\s+gratuita)\s*(?:on\s+orders\s+over|for\s+orders\s+over|orders\s+over|orders\s+from|over|from|a\s+partir\s+de|en\s+pedidos\s+(?:de\s+m[áa]s\s+de|superiores\s+a|a\s+partir\s+de)?|superando\s+(?:los\s+)?|en\s+compras\s+mayores\s+a|ab|d[èe]s|oltre)\s*(?:[€$£¥]\s*|\b(?:eur|usd|gbp|cad|aud)\b\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/i;

function doesRegionMatchBuyer(regionName, buyerCountryVal) {
  if (!regionName || !buyerCountryVal) return false;
  const reg = regionName.toLowerCase().trim();
  const buyer = buyerCountryVal.toLowerCase().trim();

  // Worldwide indicators
  if (/\b(worldwide|international|internacional|all\s+countries|rest\s+of\s+(?:the\s+)?world|global|everywhere|cualquier\s+pa[íi]s|todos\s+los\s+pa[íi]ses)\b/i.test(reg)) {
    return true;
  }

  // Exact or substring match
  if (reg.includes(buyer) || buyer.includes(reg)) {
    return true;
  }

  // Common aliases
  if (buyer === 'uruguay' && /\b(uruguay|sudam[ée]rica|south\s+america|am[ée]rica\s+del\s+sur|mercosur)\b/i.test(reg)) return true;
  if ((buyer === 'united states' || buyer === 'usa' || buyer === 'us') && /\b(united\s+states|usa|u\.s\.a\.|u\.s\.|us|domestic)\b/i.test(reg)) return true;
  if ((buyer === 'united kingdom' || buyer === 'uk') && /\b(united\s+kingdom|uk|great\s+britain|gb|england)\b/i.test(reg)) return true;
  if ((buyer === 'germany' || buyer === 'deutschland') && /\b(germany|deutschland|de)\b/i.test(reg)) return true;
  if ((buyer === 'spain' || buyer === 'españa') && /\b(spain|españa|es)\b/i.test(reg)) return true;

  // Europe / EU
  const isBuyerEU = typeof isCountryEU === 'function' ? isCountryEU(buyerCountryVal) : false;
  if (isBuyerEU && /\b(europe|europa|eu|european\s+union)\b/i.test(reg)) return true;

  return false;
}

function parseFreeShippingThresholds(fullRowText, currency = 'USD', buyerCountryVal = 'Uruguay', sellerShipsFrom = '') {
  if (!fullRowText) return null;
  const buyer = (buyerCountryVal || (typeof buyerCountry !== 'undefined' && buyerCountry ? buyerCountry.value : (typeof state !== 'undefined' && state?.buyerCountry ? state.buyerCountry : 'Uruguay')) || 'Uruguay').trim();

  // Normalize text if it contains HTML tags (e.g. from raw page HTML)
  const textToMatch = fullRowText.includes('<') ? fullRowText.replace(/<[^>]+>/g, ' ') : fullRowText;

  // 1. Official Discogs Shipping Methods Modal Box (e.g. "Free Shipping: El subtotal debe ser, al menos, de 350,00 €.")
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
      const threshCur = detectCurrencyInContext(surroundingContext, currency || 'EUR');
      const val = parseLocalePrice(cleanDigits, threshCur);
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

  // 2. Official Discogs ASP Banner (Strict: requires seller action verb like "offers", "ofrece", "bietet", "offre")
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

      const threshCur = detectCurrencyInContext(surroundingContext, currency || 'EUR');
      const val = parseLocalePrice(cleanDigits, threshCur);
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

  // 3. Official Next.js __NEXT_DATA__ JSON inspection (Discogs Next.js pages)
  if (fullRowText && fullRowText.includes('__NEXT_DATA__')) {
    try {
      const jsonMatch = fullRowText.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (jsonMatch && jsonMatch[1]) {
        const nextData = JSON.parse(jsonMatch[1]);
        const searchJsonForFreeShipping = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.free_shipping_min_order_val || obj.freeShippingMinOrderValue || obj.freeShippingThreshold) {
            const val = parseFloat(obj.free_shipping_min_order_val || obj.freeShippingMinOrderValue || obj.freeShippingThreshold);
            if (val > 0) {
              return {
                amount: val,
                currency: obj.currency || obj.currencyCode || currency || 'EUR',
                scope: 'asp_banner',
                raw: `Envío gratis a partir de ${val}`
              };
            }
          }
          if (obj.free_shipping === true && typeof obj.min_order_val === 'number' && obj.min_order_val > 0) {
            return {
              amount: obj.min_order_val,
              currency: obj.currency || currency || 'EUR',
              scope: 'asp_banner',
              raw: `Envío gratis a partir de ${obj.min_order_val}`
            };
          }
          for (const k of Object.keys(obj)) {
            if (typeof obj[k] === 'object') {
              const res = searchJsonForFreeShipping(obj[k]);
              if (res) return res;
            }
          }
          return null;
        };
        const nextResult = searchJsonForFreeShipping(nextData?.props?.pageProps);
        if (nextResult) {
          return { aspBannerThreshold: nextResult };
        }
      }
    } catch (e) {}
  }

  // 4. Structured Multi-Country Shipping Sections (e.g. [b]United States[/b], [b]Canada[/b], [b]Rest of World[/b])
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
    // Priority: 1. Specific country match (e.g. "Uruguay"), 2. Regional match (e.g. "Europe"), 3. "Rest of World" fallback
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
          const threshCur = detectCurrencyInContext(matchedSection.body, currency || 'USD');
          const val = parseLocalePrice(cleanDigits, threshCur);
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
      // Section matched buyer's country, but NO free shipping was offered in that section
      return null;
    } else {
      // The seller has structured sections, but NONE of them matched buyer country
      return null;
    }
  }

  // 5. Fallback: General free shipping threshold regex for un-sectioned text
  const genMatch = textToMatch.match(GENERAL_FREE_SHIP_REGEX);
  if (genMatch) {
    const matchIndex = genMatch.index || 0;
    const surroundingContext = textToMatch.slice(
      Math.max(0, matchIndex - 60),
      Math.min(textToMatch.length, matchIndex + genMatch[0].length + 60)
    );

    const isDomestic = typeof isDomesticSeller === 'function' ? isDomesticSeller(sellerShipsFrom, buyer) : false;
    const contextLower = surroundingContext.toLowerCase();

    // Check for restrictive destination tags in the context
    const hasDomesticRestriction = /\b(us\s+only|usa\s+only|within\s+(?:the\s+)?(?:us|usa|uk)|domestic\s+only|solo\s+españa|nur\s+deutschland|continental\s+us|lower\s+48)\b/i.test(contextLower);
    const hasWorldwideExplicit = /\b(worldwide|international|internacional|all\s+countries|global|everywhere|cualquier\s+pa[íi]s|todos\s+los\s+pa[íi]ses)\b/i.test(contextLower);
    const hasBuyerMention = doesRegionMatchBuyer(surroundingContext, buyer);

    // If text states "US only" or domestic only, and seller is not domestic to buyer, reject
    if (hasDomesticRestriction && !isDomestic) {
      return null;
    }

    // If international buyer and not domestic seller: only accept if explicit worldwide/buyer mention
    if (!isDomestic && !hasWorldwideExplicit && !hasBuyerMention) {
      return null;
    }

    const rawVal = (genMatch[1] || '').trim();
    const cleanDigits = rawVal.replace(/[^\d.,]/g, '');
    if (cleanDigits) {
      const threshCur = detectCurrencyInContext(surroundingContext, currency || 'EUR');
      const val = parseLocalePrice(cleanDigits, threshCur);
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
}

function parseReleaseHTML(html, releaseId, buyerCountry = 'Uruguay', knownForSaleCount = 0) {
  if (typeof DiscogsParser !== 'undefined' && typeof DiscogsParser.parseReleaseHTML === 'function') {
    const res = DiscogsParser.parseReleaseHTML(html, releaseId, buyerCountry, (typeof cacheRepo !== 'undefined' ? cacheRepo : null));
    if (res && res.totalWorldListings === 0 && res.hasShippingBlockNotice && typeof knownForSaleCount === 'number' && knownForSaleCount > 0) {
      res.totalWorldListings = knownForSaleCount;
      if (res.unshippableCount === 0) res.unshippableCount = knownForSaleCount;
      if (res.communityStats) res.communityStats.totalOffersCount = knownForSaleCount;
    }
    return res;
  }
  return {
    listings: [],
    totalWorldListings: 0,
    unshippableCount: 0,
    unshippableLocations: [],
    isBlockedByShipping: false,
    hasShippingBlockNotice: false,
    communityStats: { haveCount: null, wantCount: null, lowPrice: null, highPrice: null, ratingValue: null, catalogNumber: null, recordLabel: null, totalOffersCount: 0 }
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
      
      const cachedThresh = (listing.thresholds && listing.thresholds.aspBannerThreshold) || getCachedAspBanner(sName, buyerCountryVal) || null;
      const cachedOfficial = (typeof state !== 'undefined' && state?.verifiedShipping && state.verifiedShipping[sName.toLowerCase()]) || 
                             (typeof shopApiClient !== 'undefined' && shopApiClient._shippingCache && shopApiClient._shippingCache.get(sName.toLowerCase())) || null;

      sellersMap[sName] = {
        name: sName,
        sellerId: listing.sellerId || null,
        rating: (!isNaN(rawRating) && isFinite(rawRating)) ? rawRating : 100,
        ratingCount: (!isNaN(rawRatingCount) && isFinite(rawRatingCount)) ? rawRatingCount : 0,
        shipsFrom: (listing.shipsFrom || 'Internacional').trim(),
        currency: listing.currency || 'USD',
        aspBannerThreshold: cachedThresh,
        freeShippingThreshold: cachedThresh,
        isShippingOfficial: Boolean(cachedOfficial?.isOfficial),
        officialShippingPrice: cachedOfficial ? cachedOfficial.shippingPrice : null,
        officialShippingCurrency: cachedOfficial ? cachedOfficial.currency : null,
        listings: []
      };
    } else {
      if (!sellersMap[sName].sellerId && listing.sellerId) {
        sellersMap[sName].sellerId = listing.sellerId;
      }
      if (!sellersMap[sName].aspBannerThreshold && listing.thresholds && listing.thresholds.aspBannerThreshold) {
        sellersMap[sName].aspBannerThreshold = listing.thresholds.aspBannerThreshold;
        sellersMap[sName].freeShippingThreshold = listing.thresholds.aspBannerThreshold;
      }
      if (!sellersMap[sName].isShippingOfficial && typeof state !== 'undefined' && state?.verifiedShipping && state.verifiedShipping[sName.toLowerCase()]) {
        const off = state.verifiedShipping[sName.toLowerCase()];
        sellersMap[sName].isShippingOfficial = true;
        sellersMap[sName].officialShippingPrice = off.shippingPrice;
        sellersMap[sName].officialShippingCurrency = off.currency;
      }
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

    // Free shipping threshold resolution:
    // 1. Authoritative cache for buyer's country takes absolute priority (handles both positive thresholds and verified negative nulls)
    // 2. Listing-level threshold detected during scan (only if domestic or matches region/worldwide)
    const cachedAspForSeller = typeof getCachedAspBanner === 'function' ? getCachedAspBanner(seller.name, buyerCountryVal) : undefined;
    let finalThresh = null;
    if (cachedAspForSeller !== undefined) {
      finalThresh = cachedAspForSeller;
    } else if (seller.aspBannerThreshold) {
      finalThresh = seller.aspBannerThreshold;
    } else {
      const listingThresh = (seller.listings || []).find(l => l && (l.freeShippingThreshold || l.thresholds?.aspBannerThreshold));
      const detectedThresh = listingThresh?.freeShippingThreshold || listingThresh?.thresholds?.aspBannerThreshold || null;
      if (detectedThresh && (isDomestic || detectedThresh.region || /(?:worldwide|international)/i.test(detectedThresh.raw || ''))) {
        finalThresh = detectedThresh;
      }
    }
    seller.aspBannerThreshold = finalThresh;
    seller.freeShippingThreshold = finalThresh;
    
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
      isShippingEstimated: seller.isShippingOfficial ? false : (seller.listings || []).some(l => l && l.isShippingEstimated),
      isShippingOfficial: Boolean(seller.isShippingOfficial),
      officialShippingPrice: seller.officialShippingPrice !== undefined ? seller.officialShippingPrice : null,
      officialShippingCurrency: seller.officialShippingCurrency || null,
      freeShippingThreshold: seller.freeShippingThreshold || null,
      hasFreeShippingUnlocked
    };
  });
  
  // Sort sellers primarily by match count descending, secondary by price ascending
  state.groupedSellers.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return a.totalPrice - b.totalPrice;
  });

  console.log('Grouped sellers with location-based shipping:', state.groupedSellers);
  populateCountryFilter();
}

