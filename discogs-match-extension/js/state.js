/**
 * Vinyl Stock Manager • State & Utility Module (js/state.js)
 * Global state, currency maps, country configs, formatting and text/goldmine utilities
 */

// Global App View State
var currentAppView = 'wizard-1';
window.currentAppView = currentAppView;

// State management
let state = {
  username: '',
  wants: [],
  collection: [],
  allListings: [],
  groupedSellers: [],
  isScanning: false,
  cancelRequested: false,
  proxyTabId: null,
  localSheetRows: [],
  localMatches: []
};

// Detect whether running inside a Chrome extension context or as a plain web page.
const IS_EXTENSION = (typeof chrome !== 'undefined' && !!chrome.tabs && !!chrome.runtime?.id);

const CURRENCY_MAP = {
  'EUR': { symbol: '€', code: 'EUR', rate: 1.087, name: 'Euros' },
  'USD': { symbol: '$', code: 'USD', rate: 1.0, name: 'Dólares estadounidenses' },
  'GBP': { symbol: '£', code: 'GBP', rate: 1.282, name: 'Libras esterlinas' },
  'JPY': { symbol: '¥', code: 'JPY', rate: 0.00645, name: 'Yenes japoneses' },
  'UYU': { symbol: '$U', code: 'UYU', rate: 0.025, name: 'Pesos uruguayos' },
  'ARS': { symbol: '$', code: 'ARS', rate: 0.0008, name: 'Pesos argentinos' },
  'AUD': { symbol: 'A$', code: 'AUD', rate: 0.667, name: 'Dólares australianos' },
  'CAD': { symbol: 'CA$', code: 'CAD', rate: 0.73, name: 'Dólares canadienses' },
  'CHF': { symbol: 'CHF', code: 'CHF', rate: 1.124, name: 'Francos suizos' },
  'SEK': { symbol: 'kr', code: 'SEK', rate: 0.0952, name: 'Coronas suecas' },
  'NOK': { symbol: 'kr', code: 'NOK', rate: 0.093, name: 'Coronas noruegas' },
  'DKK': { symbol: 'kr', code: 'DKK', rate: 0.14, name: 'Coronas danesas' },
  'NZD': { symbol: 'NZ$', code: 'NZD', rate: 0.61, name: 'Dólares neozelandeses' },
  'BRL': { symbol: 'R$', code: 'BRL', rate: 0.1818, name: 'Reales brasileños' },
  'MXN': { symbol: 'Mex$', code: 'MXN', rate: 0.0513, name: 'Pesos mexicanos' },
  'CLP': { symbol: '$', code: 'CLP', rate: 0.00106, name: 'Pesos chilenos' },
  'COP': { symbol: '$', code: 'COP', rate: 0.000244, name: 'Pesos colombianos' }
};

// Universal Country and Currency Configuration
const COUNTRY_CONFIG = {
  'Uruguay': {
    name: 'Uruguay',
    currency: 'UYU',
    currencyName: 'Pesos Uruguayos',
    symbol: '$U',
    defaultUnitsPerUSD: 40.0,
    flag: '🇺🇾',
    aliases: ['uruguay', 'montevideo', 'uy']
  },
  'Argentina': {
    name: 'Argentina',
    currency: 'ARS',
    currencyName: 'Pesos Argentinos',
    symbol: '$',
    defaultUnitsPerUSD: 1250.0,
    flag: '🇦🇷',
    aliases: ['argentina', 'buenos aires', 'cordoba', 'rosario', 'mendoza', 'ar']
  },
  'Spain': {
    name: 'España',
    currency: 'EUR',
    currencyName: 'Euros',
    symbol: '€',
    defaultUnitsPerUSD: 0.92,
    flag: '🇪🇸',
    aliases: ['spain', 'españa', 'madrid', 'barcelona', 'valencia', 'sevilla', 'es']
  },
  'United States': {
    name: 'Estados Unidos',
    currency: 'USD',
    currencyName: 'Dólares',
    symbol: '$',
    defaultUnitsPerUSD: 1.0,
    flag: '🇺🇸',
    aliases: ['united states', 'usa', 'us', 'estados unidos', 'ee.uu', 'eeuu', 'new york', 'california', 'florida', 'texas']
  },
  'United Kingdom': {
    name: 'Reino Unido',
    currency: 'GBP',
    currencyName: 'Libras Esterlinas',
    symbol: '£',
    defaultUnitsPerUSD: 0.78,
    flag: '🇬🇧',
    aliases: ['united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales', 'gb', 'london', 'reino unido']
  },
  'Germany': {
    name: 'Alemania',
    currency: 'EUR',
    currencyName: 'Euros',
    symbol: '€',
    defaultUnitsPerUSD: 0.92,
    flag: '🇩🇪',
    aliases: ['germany', 'deutschland', 'alemania', 'berlin', 'munich', 'hamburg', 'frankfurt', 'de']
  },
  'Brazil': {
    name: 'Brasil',
    currency: 'BRL',
    currencyName: 'Reales Brasileños',
    symbol: 'R$',
    defaultUnitsPerUSD: 5.50,
    flag: '🇧🇷',
    aliases: ['brazil', 'brasil', 'são paulo', 'sao paulo', 'rio de janeiro', 'curitiba', 'br']
  },
  'Chile': {
    name: 'Chile',
    currency: 'CLP',
    currencyName: 'Pesos Chilenos',
    symbol: '$',
    defaultUnitsPerUSD: 940.0,
    flag: '🇨🇱',
    aliases: ['chile', 'santiago', 'valparaiso', 'cl']
  },
  'Colombia': {
    name: 'Colombia',
    currency: 'COP',
    currencyName: 'Pesos Colombianos',
    symbol: '$',
    defaultUnitsPerUSD: 4100.0,
    flag: '🇨🇴',
    aliases: ['colombia', 'bogota', 'bogotá', 'medellin', 'cali', 'co']
  },
  'Mexico': {
    name: 'México',
    currency: 'MXN',
    currencyName: 'Pesos Mexicanos',
    symbol: 'Mex$',
    defaultUnitsPerUSD: 19.5,
    flag: '🇲🇽',
    aliases: ['mexico', 'méxico', 'guadalajara', 'monterrey', 'cdmx', 'mx']
  },
  'France': {
    name: 'Francia',
    currency: 'EUR',
    currencyName: 'Euros',
    symbol: '€',
    defaultUnitsPerUSD: 0.92,
    flag: '🇫🇷',
    aliases: ['france', 'francia', 'paris', 'lyon', 'marseille', 'fr']
  },
  'Italy': {
    name: 'Italia',
    currency: 'EUR',
    currencyName: 'Euros',
    symbol: '€',
    defaultUnitsPerUSD: 0.92,
    flag: '🇮🇹',
    aliases: ['italy', 'italia', 'roma', 'milano', 'napoli', 'it']
  },
  'Netherlands': {
    name: 'Países Bajos',
    currency: 'EUR',
    currencyName: 'Euros',
    symbol: '€',
    defaultUnitsPerUSD: 0.92,
    flag: '🇳🇱',
    aliases: ['netherlands', 'holanda', 'países bajos', 'amsterdam', 'rotterdam', 'nl']
  },
  'Japan': {
    name: 'Japón',
    currency: 'JPY',
    currencyName: 'Yenes',
    symbol: '¥',
    defaultUnitsPerUSD: 155.0,
    flag: '🇯🇵',
    aliases: ['japan', 'japón', 'tokyo', 'osaka', 'kyoto', 'jp']
  },
  'Canada': {
    name: 'Canadá',
    currency: 'CAD',
    currencyName: 'Dólares Canadienses',
    symbol: 'CA$',
    defaultUnitsPerUSD: 1.37,
    flag: '🇨🇦',
    aliases: ['canada', 'canadá', 'toronto', 'montreal', 'vancouver', 'ca']
  },
  'Australia': {
    name: 'Australia',
    currency: 'AUD',
    currencyName: 'Dólares Australianos',
    symbol: 'A$',
    defaultUnitsPerUSD: 1.50,
    flag: '🇦🇺',
    aliases: ['australia', 'sydney', 'melbourne', 'brisbane', 'au']
  },
  'Switzerland': {
    name: 'Suiza',
    currency: 'CHF',
    currencyName: 'Francos Suizos',
    symbol: 'CHF',
    defaultUnitsPerUSD: 0.89,
    flag: '🇨🇭',
    aliases: ['switzerland', 'suiza', 'schweiz', 'zurich', 'geneva', 'ch']
  },
  'Sweden': {
    name: 'Suecia',
    currency: 'SEK',
    currencyName: 'Coronas Suecas',
    symbol: 'kr',
    defaultUnitsPerUSD: 10.5,
    flag: '🇸🇪',
    aliases: ['sweden', 'suecia', 'stockholm', 'sverige', 'se']
  },
  'Other': {
    name: 'Otro / Internacional',
    currency: 'USD',
    currencyName: 'Dólares',
    symbol: '$',
    defaultUnitsPerUSD: 1.0,
    flag: '🌐',
    aliases: []
  }
};

/**
 * Get primary currency code for a given buyer country name
 */
function getCurrencyForCountry(countryName) {
  if (!countryName) return 'USD';
  const cfg = COUNTRY_CONFIG[countryName];
  return cfg ? cfg.currency : 'USD';
}

/**
 * Get how many units of currency equal 1 USD (e.g. 1250 ARS, 40 UYU, 0.92 EUR)
 */
function getCurrencyUnitsPerUSD(code) {
  if (!code || code === 'USD') return 1.0;
  
  // Check user saved custom rate first
  const customSaved = localStorage.getItem('custom_rate_' + code);
  if (customSaved) {
    const val = parseFloat(customSaved);
    if (!isNaN(val) && val > 0) return val;
  }
  
  // Backwards compatibility for legacy custom UYU key
  if (code === 'UYU') {
    const legacyUyu = parseFloat(localStorage.getItem('custom_uyu_rate'));
    if (!isNaN(legacyUyu) && legacyUyu > 0) return legacyUyu;
  }
  
  // Find default units from COUNTRY_CONFIG or CURRENCY_MAP
  for (const country in COUNTRY_CONFIG) {
    if (COUNTRY_CONFIG[country].currency === code && COUNTRY_CONFIG[country].defaultUnitsPerUSD) {
      return COUNTRY_CONFIG[country].defaultUnitsPerUSD;
    }
  }
  
  const curr = CURRENCY_MAP[code];
  if (curr && curr.rate > 0) {
    return +(1 / curr.rate).toFixed(4);
  }
  return 1.0;
}

/**
 * Save user custom rate for a currency (units of local currency per 1 USD)
 */
function setCustomCurrencyRate(code, unitsPerUSD) {
  if (!code || code === 'USD') return;
  const num = parseFloat(unitsPerUSD);
  if (isNaN(num) || num <= 0) return;
  
  localStorage.setItem('custom_rate_' + code, String(num));
  if (code === 'UYU') {
    localStorage.setItem('custom_uyu_rate', String(num));
  }
  if (CURRENCY_MAP[code]) {
    CURRENCY_MAP[code].rate = 1 / num;
  }
}

// Load any stored custom rates on startup
Object.keys(CURRENCY_MAP).forEach(code => {
  if (code === 'USD') return;
  const saved = localStorage.getItem('custom_rate_' + code) || (code === 'UYU' ? localStorage.getItem('custom_uyu_rate') : null);
  if (saved) {
    const val = parseFloat(saved);
    if (!isNaN(val) && val > 0) {
      CURRENCY_MAP[code].rate = 1 / val;
    }
  }
});

/**
 * Universal domestic seller detection for ANY selected buyer country
 */
function isDomesticSeller(shipsFrom, buyerCountryName) {
  if (!shipsFrom || !buyerCountryName) return false;
  if (buyerCountryName === 'Other') return false;
  
  const fromClean = shipsFrom.toLowerCase().trim();
  const buyerClean = buyerCountryName.toLowerCase().trim();
  
  // Exact match or mutual substring
  if (fromClean === buyerClean || fromClean.includes(buyerClean) || buyerClean.includes(fromClean)) {
    return true;
  }
  
  const config = COUNTRY_CONFIG[buyerCountryName];
  if (config && Array.isArray(config.aliases)) {
    for (const alias of config.aliases) {
      if (alias.length === 2) {
        // ISO 2-letter codes: ensure word boundary to avoid false positives (e.g. 'ar' inside 'denmark')
        const regex = new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`, 'i');
        if (regex.test(fromClean)) return true;
      } else {
        if (fromClean.includes(alias)) return true;
      }
    }
  }
  return false;
}

function syncCacheState(enabled) {
  const useCacheCheckbox = document.getElementById('use-cache-checkbox');
  const managerUseCacheCheckbox = document.getElementById('manager-use-cache-checkbox');
  const bottomUseCacheCheckbox = document.getElementById('bottom-use-cache-checkbox');
  const settingsTurbo = document.getElementById('settings-cache-turbo');
  const settingsDirect = document.getElementById('settings-cache-direct');
  if (useCacheCheckbox) useCacheCheckbox.checked = enabled;
  if (managerUseCacheCheckbox) managerUseCacheCheckbox.checked = enabled;
  if (bottomUseCacheCheckbox) bottomUseCacheCheckbox.checked = enabled;
  if (settingsTurbo && settingsDirect) {
    settingsTurbo.checked = enabled;
    settingsDirect.checked = !enabled;
  }
  localStorage.setItem('use_scan_cache', String(enabled));
}
window.syncCacheState = syncCacheState;

function formatPrice(val, currencyCode, overrideDisplayCurrency = null) {
  const numVal = typeof val === 'number' ? (isNaN(val) ? 0 : val) : (parseFloat(val) || 0);
  const displayCurrencySelect = document.getElementById('display-currency');
  const displayCurr = overrideDisplayCurrency || (displayCurrencySelect ? displayCurrencySelect.value : 'UYU');
  
  if (displayCurr === 'original' || !displayCurr) {
    const info = CURRENCY_MAP[currencyCode] || { symbol: '$', code: currencyCode || 'USD' };
    if (info.code === info.symbol) {
      return `${info.code} ${numVal.toFixed(2)}`;
    }
    return `${info.code} ${info.symbol}${numVal.toFixed(2)}`;
  }
  
  // Convert val from currencyCode to USD first
  const sourceRate = CURRENCY_MAP[currencyCode]?.rate || 1.0;
  const valInUSD = numVal * sourceRate;
  
  // Convert USD to displayCurr
  const targetInfo = CURRENCY_MAP[displayCurr] || { symbol: '$', code: displayCurr, rate: 1.0 };
  const valInTarget = valInUSD / (targetInfo.rate || 1.0);
  
  // Format target output
  const isNoCentsCurrency = ['UYU', 'ARS', 'CLP', 'COP', 'JPY'].includes(targetInfo.code);
  const formattedNum = isNoCentsCurrency
    ? Math.round(valInTarget).toLocaleString('es-UY')
    : valInTarget.toFixed(2);
    
  if (targetInfo.code === targetInfo.symbol) {
    return `${targetInfo.code} ${formattedNum}`;
  }
  return `${targetInfo.code} ${targetInfo.symbol}${formattedNum}`;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function getCountryFlag(country) {
  if (!country) return '🌐';
  const c = country.toLowerCase();
  if (c.includes('germany') || c.includes('alemania') || c.includes('deutschland')) return '🇩🇪';
  if (c.includes('united kingdom') || c.includes('reino unido') || c.includes('uk') || c.includes('great britain')) return '🇬🇧';
  if (c.includes('united states') || c.includes('estados unidos') || c.includes('usa') || c.includes('ee.uu')) return '🇺🇸';
  if (c.includes('spain') || c.includes('españa')) return '🇪🇸';
  if (c.includes('france') || c.includes('francia')) return '🇫🇷';
  if (c.includes('italy') || c.includes('italia')) return '🇮🇹';
  if (c.includes('netherlands') || c.includes('países bajos') || c.includes('holanda') || c.includes('amsterdam')) return '🇳🇱';
  if (c.includes('japan') || c.includes('japón') || c.includes('tokyo')) return '🇯🇵';
  if (c.includes('uruguay') || c.includes('montevideo')) return '🇺🇾';
  if (c.includes('argentina') || c.includes('buenos aires')) return '🇦🇷';
  if (c.includes('brazil') || c.includes('brasil')) return '🇧🇷';
  if (c.includes('chile') || c.includes('santiago')) return '🇨🇱';
  if (c.includes('colombia') || c.includes('bogota') || c.includes('bogotá')) return '🇨🇴';
  if (c.includes('mexico') || c.includes('méxico')) return '🇲🇽';
  if (c.includes('hungary') || c.includes('hungría')) return '🇭🇺';
  if (c.includes('austria')) return '🇦🇹';
  if (c.includes('switzerland') || c.includes('suiza')) return '🇨🇭';
  if (c.includes('canada') || c.includes('canadá')) return '🇨🇦';
  if (c.includes('australia')) return '🇦🇺';
  if (c.includes('belgium') || c.includes('bélgica')) return '🇧🇪';
  if (c.includes('sweden') || c.includes('suecia')) return '🇸🇪';
  if (c.includes('poland') || c.includes('polonia')) return '🇵🇱';
  return '📍';
}

function renderGoldmineTag(cond, isSleeve) {
  const c = (cond || '').toUpperCase().trim();
  let bg = 'border-prada-ochre/50 bg-prada-ochre-bg text-amber-950';
  if (c.includes('M') && !c.includes('NM') && !c.includes('VG')) {
    bg = 'border-prada-emerald bg-prada-emerald-bg text-emerald-900 font-bold';
  } else if (c.includes('NM')) {
    bg = 'border-prada-blue/40 bg-blue-50 text-prada-blue font-bold';
  } else if (c.includes('VG+') || c.includes('VG')) {
    bg = 'border-prada-ochre/50 bg-prada-ochre-bg text-amber-950 font-bold';
  }
  let displayCond = c;
  if (c.includes('GENERIC')) {
    bg = 'border-hairline-light bg-stone-100 text-muted-graphite';
    displayCond = 'GENÉRICA';
  }
  const typeLabel = isSleeve ? 'Funda / Portada' : 'Disco / Vinilo';
  const val = displayCond || (isSleeve ? 'GENÉRICA' : 'VG+');
  const tooltipText = `Estado Goldmine del ${typeLabel}: ${val}`;
  return `<span class="border ${bg} px-2 py-0.5 text-[9px] font-mono uppercase shadow-2xs cursor-help" data-tooltip="${escapeHTML(tooltipText)}" data-tooltip-pos="top">${escapeHTML(val)}</span>`;
}

function getConditionRank(cond) {
  const c = (cond || '').toUpperCase().trim();
  if (c === 'M' || (c.includes('MINT') && !c.includes('NEAR'))) return 6;
  if (c === 'NM' || c.includes('NEAR MINT') || c === 'M-' || c === 'NM-') return 5;
  if (c === 'VG+' || c === 'VGPLUS' || c.includes('VERY GOOD PLUS')) return 4;
  if (c === 'VG' || c.includes('VERY GOOD')) return 3;
  if (c === 'G+' || c === 'GPLUS' || c.includes('GOOD PLUS')) return 2;
  return 1;
}

function upgradeDiscogsImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('i.discogs.com')) {
    return url;
  }
  let upgraded = url;
  upgraded = upgraded.replace(/height=\d+([,&])width=\d+/i, 'height=600$1width=600');
  upgraded = upgraded.replace(/[?&]w=\d+/gi, '?w=600');
  upgraded = upgraded.replace(/[?&]h=\d+/gi, '&h=600');
  upgraded = upgraded.replace(/\/150x150\//i, '/600x600/');
  upgraded = upgraded.replace(/\/40x40\//i, '/600x600/');
  upgraded = upgraded.replace(/\/90x90\//i, '/600x600/');
  upgraded = upgraded.replace(/\/R-(?:90|150)-\d+/i, (m) => m.replace(/-(?:90|150)-/, '-'));
  return upgraded;
}

function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ==========================================
// User Purchased Collection Helpers
// ==========================================

function getCollectionStorageKey(username) {
  const userKey = (username || state.username || 'user').toLowerCase().trim();
  return `discogs_collection_cache_${userKey}`;
}

function loadUserCollection(username) {
  try {
    const key = getCollectionStorageKey(username);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.collection = parsed;
        updateCollectionBadge();
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Collection] Error loading collection from localStorage:', err);
  }
  state.collection = [];
  updateCollectionBadge();
  return [];
}

function saveUserCollection(collectionToSave, username) {
  try {
    const items = collectionToSave || state.collection || [];
    const key = getCollectionStorageKey(username);
    localStorage.setItem(key, JSON.stringify(items));
    state.collection = items;
    updateCollectionBadge();
  } catch (err) {
    console.warn('[Collection] Error saving collection to localStorage:', err);
  }
}

function updateCollectionBadge() {
  try {
    const badge = document.getElementById('badge-collection-count');
    if (badge) {
      const count = (state.collection || []).length;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  } catch (e) {}
}

function isReleasePurchased(releaseId, title, artist) {
  if (!state.collection || state.collection.length === 0) return false;
  if (releaseId) {
    const numericId = String(releaseId).replace(/[^\d]/g, '');
    const foundById = state.collection.some(item => String(item.id || item.release_id || '').replace(/[^\d]/g, '') === numericId);
    if (foundById) return true;
  }
  if (title && artist) {
    const normT = normalizeText(title);
    const normA = normalizeText(artist);
    return state.collection.some(item => {
      return normalizeText(item.title) === normT && (
        normalizeText(item.artist).includes(normA) || normA.includes(normalizeText(item.artist))
      );
    });
  }
  return false;
}

function markAsPurchased(item) {
  if (!item) return false;
  if (!state.collection) state.collection = [];
  
  const existingIdx = state.collection.findIndex(p => {
    if (item.id && p.id && String(item.id) === String(p.id)) return true;
    if (item.release_id && p.id && String(item.release_id) === String(p.id)) return true;
    return normalizeText(item.title) === normalizeText(p.title) && normalizeText(item.artist) === normalizeText(p.artist);
  });

  if (existingIdx >= 0) {
    return false; // Already purchased
  }

  const purchasedRecord = {
    id: item.id || item.release_id || Date.now(),
    instance_id: item.instance_id || null,
    title: (item.title || 'Sin Título').trim(),
    artist: (item.artist || 'Artista Desconocido').trim(),
    year: item.year || '',
    image: item.image || item.cover_image || item.thumb || '',
    format: item.format || (item.formats && item.formats[0]?.name) || 'Vinyl',
    label: item.label || (item.labels && item.labels[0]?.name) || '',
    dateAdded: new Date().toISOString(),
    rating: item.rating || 0,
    pricePaid: item.pricePaid || null,
    notes: item.notes || ''
  };

  state.collection.unshift(purchasedRecord);
  saveUserCollection();
  return true;
}

function unmarkPurchased(idOrTitle) {
  if (!state.collection) return false;
  const initialLen = state.collection.length;
  state.collection = state.collection.filter(item => {
    if (String(item.id) === String(idOrTitle)) return false;
    if (normalizeText(item.title) === normalizeText(idOrTitle)) return false;
    return true;
  });
  if (state.collection.length !== initialLen) {
    saveUserCollection();
    return true;
  }
  return false;
}

// Expose on global window for clean cross-module access
window.state = state;
window.IS_EXTENSION = IS_EXTENSION;
window.CURRENCY_MAP = CURRENCY_MAP;
window.COUNTRY_CONFIG = COUNTRY_CONFIG;
window.getCurrencyForCountry = getCurrencyForCountry;
window.getCurrencyUnitsPerUSD = getCurrencyUnitsPerUSD;
window.setCustomCurrencyRate = setCustomCurrencyRate;
window.isDomesticSeller = isDomesticSeller;
window.syncCacheState = syncCacheState;
window.formatPrice = formatPrice;
window.escapeHTML = escapeHTML;
window.getCountryFlag = getCountryFlag;
window.renderGoldmineTag = renderGoldmineTag;
window.getConditionRank = getConditionRank;
window.upgradeDiscogsImageUrl = upgradeDiscogsImageUrl;
window.normalizeText = normalizeText;
window.loadUserCollection = loadUserCollection;
window.saveUserCollection = saveUserCollection;
window.updateCollectionBadge = updateCollectionBadge;
window.isReleasePurchased = isReleasePurchased;
window.markAsPurchased = markAsPurchased;
window.unmarkPurchased = unmarkPurchased;
