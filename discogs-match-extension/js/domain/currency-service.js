(function(global) {
  'use strict';

  const CURRENCY_MAP = global.CURRENCY_MAP || {
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

  const COUNTRY_CONFIG = global.COUNTRY_CONFIG || {
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
    aliases: ['colombia', 'bogota', 'medellin', 'cali', 'co']
  },
  'Mexico': {
    name: 'México',
    currency: 'MXN',
    currencyName: 'Pesos Mexicanos',
    symbol: 'Mex$',
    defaultUnitsPerUSD: 19.5,
    flag: '🇲🇽',
    aliases: ['mexico', 'méxico', 'cdmx', 'guadalajara', 'monterrey', 'mx']
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
    aliases: ['italy', 'italia', 'roma', 'rome', 'milano', 'milan', 'napoli', 'it']
  },
  'Netherlands': {
    name: 'Países Bajos',
    currency: 'EUR',
    currencyName: 'Euros',
    symbol: '€',
    defaultUnitsPerUSD: 0.92,
    flag: '🇳🇱',
    aliases: ['netherlands', 'holland', 'países bajos', 'amsterdam', 'rotterdam', 'nl']
  },
  'Japan': {
    name: 'Japón',
    currency: 'JPY',
    currencyName: 'Yenes',
    symbol: '¥',
    defaultUnitsPerUSD: 155.0,
    flag: '🇯🇵',
    aliases: ['japan', 'japón', 'japon', 'tokyo', 'osaka', 'kyoto', 'jp']
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
  'Norway': {
    name: 'Noruega',
    currency: 'NOK',
    currencyName: 'Coronas Noruegas',
    symbol: 'kr',
    defaultUnitsPerUSD: 10.75,
    flag: '🇳🇴',
    aliases: ['norway', 'noruega', 'norge', 'oslo', 'no']
  },
  'Denmark': {
    name: 'Dinamarca',
    currency: 'DKK',
    currencyName: 'Coronas Danesas',
    symbol: 'kr',
    defaultUnitsPerUSD: 7.14,
    flag: '🇩🇰',
    aliases: ['denmark', 'dinamarca', 'danmark', 'copenhagen', 'kobenhavn', 'dk']
  },
  'New Zealand': {
    name: 'Nueva Zelanda',
    currency: 'NZD',
    currencyName: 'Dólares Neozelandeses',
    symbol: 'NZ$',
    defaultUnitsPerUSD: 1.64,
    flag: '🇳🇿',
    aliases: ['new zealand', 'nueva zelanda', 'auckland', 'wellington', 'nz']
  },
  'Other': {
    name: 'Otro / Internacional',
    currency: 'USD',
    currencyName: 'Dólares',
    symbol: '$',
    defaultUnitsPerUSD: 1.0,
    flag: '🌐',
    aliases: ['other', 'otro', 'internacional', 'international', 'world']
  }
};

class CurrencyService {
  constructor() {
    this.currencyMap = CURRENCY_MAP;
    this.countryConfig = COUNTRY_CONFIG;
  }

  getCountryFlag(country) {
    if (!country) return '🌐';
    const c = country.toLowerCase();
    if (c.includes('other') || c.includes('otro') || c.includes('internacional') || c.includes('international') || c.includes('world')) return '🌐';
    if (c.includes('germany') || c.includes('alemania') || c.includes('deutschland')) return '🇩🇪';
    if (c.includes('united kingdom') || c.includes('reino unido') || c.includes('uk') || c.includes('great britain')) return '🇬🇧';
    if (c.includes('united states') || c.includes('estados unidos') || c.includes('usa') || c.includes('ee.uu')) return '🇺🇸';
    if (c.includes('spain') || c.includes('españa')) return '🇪🇸';
    if (c.includes('france') || c.includes('francia')) return '🇫🇷';
    if (c.includes('italy') || c.includes('italia')) return '🇮🇹';
    if (c.includes('netherlands') || c.includes('países bajos') || c.includes('holanda') || c.includes('amsterdam') || c.includes('rotterdam')) return '🇳🇱';
    if (c.includes('japan') || c.includes('japón') || c.includes('japon') || c.includes('tokyo')) return '🇯🇵';
    if (c.includes('uruguay') || c.includes('montevideo')) return '🇺🇾';
    if (c.includes('argentina') || c.includes('buenos aires')) return '🇦🇷';
    if (c.includes('brazil') || c.includes('brasil')) return '🇧🇷';
    if (c.includes('chile') || c.includes('santiago')) return '🇨🇱';
    if (c.includes('colombia') || c.includes('bogota') || c.includes('bogotá')) return '🇨🇴';
    if (c.includes('mexico') || c.includes('méxico')) return '🇲🇽';
    if (c.includes('hungary') || c.includes('hungría')) return '🇭🇺';
    if (c.includes('austria')) return '🇦🇹';
    if (c.includes('switzerland') || c.includes('suiza') || c.includes('schweiz')) return '🇨🇭';
    if (c.includes('canada') || c.includes('canadá')) return '🇨🇦';
    if (c.includes('australia')) return '🇦🇺';
    if (c.includes('belgium') || c.includes('bélgica')) return '🇧🇪';
    if (c.includes('sweden') || c.includes('suecia') || c.includes('sverige')) return '🇸🇪';
    if (c.includes('norway') || c.includes('noruega') || c.includes('norge')) return '🇳🇴';
    if (c.includes('denmark') || c.includes('dinamarca') || c.includes('danmark')) return '🇩🇰';
    if (c.includes('new zealand') || c.includes('nueva zelanda')) return '🇳🇿';
    if (c.includes('poland') || c.includes('polonia')) return '🇵🇱';
    return '📍';
  }

  getCurrencyForCountry(countryName) {
    if (!countryName) return 'USD';
    const config = this.countryConfig[countryName];
    if (config) return config.currency;
    const lower = countryName.toLowerCase().trim();
    for (const [cName, cfg] of Object.entries(this.countryConfig)) {
      if (cName.toLowerCase() === lower || (cfg.aliases && cfg.aliases.includes(lower))) {
        return cfg.currency;
      }
    }
    return 'USD';
  }

  getCurrencyUnitsPerUSD(currencyCode, countryName = null) {
    if (!currencyCode || currencyCode === 'USD') return 1.0;
    try {
      const stored = localStorage.getItem(`rate_${currencyCode}`) || localStorage.getItem(`custom_rate_${currencyCode}`) || (currencyCode === 'UYU' ? localStorage.getItem('custom_uyu_rate') : null);
      if (stored) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch (e) {}

    if (countryName && this.countryConfig[countryName]) {
      return this.countryConfig[countryName].defaultUnitsPerUSD;
    }
    for (const cfg of Object.values(this.countryConfig)) {
      if (cfg.currency === currencyCode) {
        return cfg.defaultUnitsPerUSD;
      }
    }
    if (this.currencyMap[currencyCode] && this.currencyMap[currencyCode].rate > 0) {
      return +(1.0 / this.currencyMap[currencyCode].rate).toFixed(4);
    }
    return 1.0;
  }

  setCustomCurrencyRate(currencyCode, unitsPerUSD) {
    const val = parseFloat(unitsPerUSD);
    if (!isNaN(val) && val > 0) {
      try {
        localStorage.setItem(`rate_${currencyCode}`, val.toString());
        localStorage.setItem(`custom_rate_${currencyCode}`, val.toString());
        if (currencyCode === 'UYU') {
          localStorage.setItem('custom_uyu_rate', val.toString());
        }
      } catch (e) {}
      if (this.currencyMap[currencyCode]) {
        this.currencyMap[currencyCode].rate = 1.0 / val;
      }
      if (typeof CURRENCY_MAP !== 'undefined' && CURRENCY_MAP[currencyCode]) {
        CURRENCY_MAP[currencyCode].rate = 1.0 / val;
      }
      return true;
    }
    return false;
  }

  convertToUSD(amount, fromCurrency = 'USD') {
    if (typeof amount !== 'number' || isNaN(amount)) return 0;
    const cleanFrom = (fromCurrency || 'USD').toUpperCase().trim();
    if (cleanFrom === 'USD') return amount;
    const rate = this.currencyMap[cleanFrom] ? this.currencyMap[cleanFrom].rate : 1.0;
    return amount * rate;
  }

  convert(amount, fromCurrency, targetCurrency) {
    if (typeof amount !== 'number' || isNaN(amount)) return 0;
    const cleanFrom = (fromCurrency || 'USD').toUpperCase().trim();
    const cleanTarget = (targetCurrency || 'USD').toUpperCase().trim();
    if (cleanFrom === cleanTarget) return amount;
    const inUSD = this.convertToUSD(amount, cleanFrom);
    if (cleanTarget === 'USD') return inUSD;
    const unitsPerUSD = this.getCurrencyUnitsPerUSD(cleanTarget);
    return inUSD * unitsPerUSD;
  }

  formatPrice(amount, fromCurrency = 'USD', targetCurrencyOverride = null) {
    if (amount === undefined || amount === null || isNaN(amount)) return '—';

    let targetCurrency = targetCurrencyOverride;
    if (!targetCurrency) {
      if (typeof appStore !== 'undefined') {
        targetCurrency = appStore.get('displayCurrency') || 'USD';
      } else if (typeof state !== 'undefined' && state.displayCurrency) {
        targetCurrency = state.displayCurrency;
      } else {
        targetCurrency = 'USD';
      }
    }

    const isNoCents = ['CLP', 'COP', 'JPY', 'ARS', 'UYU'].includes(targetCurrency);

    if (amount === 0) {
      if (targetCurrency === 'original') {
        const info = this.currencyMap[fromCurrency] || { symbol: '$' };
        return `${info.symbol}0.00`;
      }
      const info = this.currencyMap[targetCurrency] || { symbol: '$' };
      return isNoCents ? `${info.symbol}0` : `${info.symbol}0.00`;
    }

    if (targetCurrency === 'original') {
      const info = this.currencyMap[fromCurrency] || { symbol: fromCurrency + ' ' };
      return `${info.symbol}${amount.toFixed(2)}`;
    }

    const converted = this.convert(amount, fromCurrency, targetCurrency);
    const info = this.currencyMap[targetCurrency] || { symbol: targetCurrency + ' ' };

    if (isNoCents) {
      return `${info.symbol}${Math.round(converted).toLocaleString('es-UY')}`;
    }
    return `${info.symbol}${converted.toFixed(2)}`;
  }
}

const currencyService = new CurrencyService();

// Static helpers on class
CurrencyService.getCurrencyRate = (curr) => (CURRENCY_MAP[curr]?.rate || 1.0);
CurrencyService.formatPrice = (amount, from, target) => currencyService.formatPrice(amount, from, target);
CurrencyService.convertPrice = (amount, from, target) => currencyService.convert(amount, from, target);
CurrencyService.getCountryFlag = (country) => currencyService.getCountryFlag(country);
CurrencyService.detectCurrencyInContext = (text, fallback) => {
  if (!text) return fallback || 'USD';
  const upper = text.toUpperCase();

  // Multi-character and unambiguous currency tokens first
  if (upper.includes('EUR') || upper.includes('€')) return 'EUR';
  if (upper.includes('GBP') || upper.includes('£')) return 'GBP';
  if (upper.includes('JPY') || upper.includes('¥')) return 'JPY';
  if (upper.includes('CAD') || upper.includes('CA$')) return 'CAD';
  if (upper.includes('AUD') || upper.includes('AU$')) return 'AUD';
  if (upper.includes('BRL') || upper.includes('R$')) return 'BRL';
  if (upper.includes('UYU') || upper.includes('$U')) return 'UYU';
  if (upper.includes('MXN') || upper.includes('MEX$')) return 'MXN';
  if (upper.includes('ARS') || upper.includes('AR$')) return 'ARS';
  if (upper.includes('CLP') || upper.includes('CL$')) return 'CLP';
  if (upper.includes('COP') || upper.includes('COL$')) return 'COP';
  if (upper.includes('CHF')) return 'CHF';
  if (upper.includes('SEK')) return 'SEK';
  if (upper.includes('NOK')) return 'NOK';
  if (upper.includes('DKK')) return 'DKK';
  if (upper.includes('NZD') || upper.includes('NZ$')) return 'NZD';

  // Generic USD dollar check as fallback
  if (upper.includes('USD') || upper.includes('$')) return 'USD';

  return fallback || 'USD';
};

  if (typeof global !== 'undefined') {
    global.CURRENCY_MAP = CURRENCY_MAP;
    global.COUNTRY_CONFIG = COUNTRY_CONFIG;
    global.CurrencyService = CurrencyService;
    global.currencyService = currencyService;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrencyService;
    module.exports.CURRENCY_MAP = CURRENCY_MAP;
    module.exports.COUNTRY_CONFIG = COUNTRY_CONFIG;
    module.exports.CurrencyService = CurrencyService;
    module.exports.currencyService = currencyService;
  }
})(typeof window !== 'undefined' ? window : globalThis);


