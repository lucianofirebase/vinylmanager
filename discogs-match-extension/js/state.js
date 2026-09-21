/**
 * Vinyl Stock Manager • State & Utility Module (js/state.js)
 * Global state, currency maps, formatting and text/goldmine utilities
 */

// Global App View State
var currentAppView = 'wizard-1';
window.currentAppView = currentAppView;

// State management
let state = {
  username: '',
  wants: [],
  allListings: [],
  groupedSellers: [],
  isScanning: false,
  cancelRequested: false,
  proxyTabId: null,
  localSheetRows: [],
  localMatches: []
};

// Detect whether running inside a Chrome extension context or as a plain web page.
// In web mode (GitHub Pages, local file, etc.) chrome.tabs / chrome.cookies are unavailable.
const IS_EXTENSION = (typeof chrome !== 'undefined' && !!chrome.tabs && !!chrome.runtime?.id);

const CURRENCY_MAP = {
  'EUR': { symbol: '€', code: 'EUR', rate: 1.08 },
  'USD': { symbol: '$', code: 'USD', rate: 1.0 },
  'GBP': { symbol: '£', code: 'GBP', rate: 1.28 },
  'JPY': { symbol: '¥', code: 'JPY', rate: 0.0065 },
  'UYU': { symbol: '$U', code: 'UYU', rate: 0.025 },
  'ARS': { symbol: '$', code: 'ARS', rate: 0.001 },
  'AUD': { symbol: 'A$', code: 'AUD', rate: 0.67 },
  'CAD': { symbol: 'CA$', code: 'CAD', rate: 0.73 },
  'CHF': { symbol: 'CHF', code: 'CHF', rate: 1.12 },
  'SEK': { symbol: 'kr', code: 'SEK', rate: 0.095 },
  'NOK': { symbol: 'kr', code: 'NOK', rate: 0.093 },
  'DKK': { symbol: 'kr', code: 'DKK', rate: 0.14 },
  'NZD': { symbol: 'NZ$', code: 'NZD', rate: 0.61 },
  'BRL': { symbol: 'R$', code: 'BRL', rate: 0.18 },
  'MXN': { symbol: 'Mex$', code: 'MXN', rate: 0.055 },
  'CLP': { symbol: '$', code: 'CLP', rate: 0.0011 },
  'COP': { symbol: '$', code: 'COP', rate: 0.00025 }
};

// Load custom UYU rate if saved in personalization settings
const savedCustomUyuRate = parseFloat(localStorage.getItem('custom_uyu_rate'));
if (savedCustomUyuRate > 0 && CURRENCY_MAP.UYU) {
  CURRENCY_MAP.UYU.rate = 1 / savedCustomUyuRate;
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
  return `<span class="border ${bg} px-2 py-0.5 text-[9px] font-mono uppercase shadow-2xs">${escapeHTML(displayCond || (isSleeve ? 'GENÉRICA' : 'VG+'))}</span>`;
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
  // Discogs uses imgproxy on i.discogs.com with HMAC-SHA256 signatures in the URL path.
  // Modifying dimensions or quality (/h:600/w:600/ or /q:90/) invalidates the cryptographic signature,
  // causing Cloudflare/imgproxy to reject the request with HTTP 403 Forbidden.
  // Therefore, URLs on i.discogs.com must be preserved exactly as generated and signed by Discogs.
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

// Expose on global window for clean cross-module access
window.state = state;
window.IS_EXTENSION = IS_EXTENSION;
window.CURRENCY_MAP = CURRENCY_MAP;
window.syncCacheState = syncCacheState;
window.formatPrice = formatPrice;
window.escapeHTML = escapeHTML;
window.getCountryFlag = getCountryFlag;
window.renderGoldmineTag = renderGoldmineTag;
window.getConditionRank = getConditionRank;
window.upgradeDiscogsImageUrl = upgradeDiscogsImageUrl;
window.normalizeText = normalizeText;
