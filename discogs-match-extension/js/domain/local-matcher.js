/**
 * Vinyl Stock Manager • Domain Local Matcher (js/domain/local-matcher.js)
 * Parsing and fuzzy matching algorithms for cross-referencing local record store catalogs (Sheets / Excel).
 * Pure data transformation without direct DOM side-effects.
 */

(function(global) {
  'use strict';

  function normalizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const LocalMatcher = {
    normalizeText,

    parseSheetText(text) {
      if (!text || typeof text !== 'string' || !text.trim()) return [];
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) return [];

      const sample = lines[0];
      let delimiter = '\t';
      if (sample.includes('\t')) {
        delimiter = '\t';
      } else if (sample.includes(';')) {
        delimiter = ';';
      } else if (sample.includes(',')) {
        delimiter = ',';
      }

      return lines.map(line => {
        return line.split(delimiter).map(cell => cell.trim().replace(/^"(.*)"$/, '$1'));
      });
    },

    matchLocalCatalog(wants, rows, mapping) {
      if (!Array.isArray(wants) || !Array.isArray(rows) || !mapping) {
        return [];
      }

      const matches = [];
      const startIndex = rows.length > 1 ? 1 : 0;

      for (let r = startIndex; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        let sellerArtist = '';
        let sellerTitle = '';
        let sellerPrice = '';
        let sellerFormat = '';
        let sellerCondition = '';
        let sellerDiscogsId = null;

        Object.keys(mapping).forEach(colIdx => {
          const idx = parseInt(colIdx, 10);
          const val = row[idx] || '';
          const field = mapping[colIdx];

          if (field === 'artist') sellerArtist = val;
          else if (field === 'title') sellerTitle = val;
          else if (field === 'price') sellerPrice = val;
          else if (field === 'format') sellerFormat = val;
          else if (field === 'condition') sellerCondition = val;
          else if (field === 'discogs_id') {
            const idMatch = String(val).match(/\d{5,9}/);
            if (idMatch) sellerDiscogsId = parseInt(idMatch[0], 10);
          }
        });

        const normSellerArtist = normalizeText(sellerArtist);
        const normSellerTitle = normalizeText(sellerTitle);
        const normCombined = `${normSellerArtist} ${normSellerTitle}`;

        if (!normSellerArtist && !normSellerTitle && !sellerDiscogsId) continue;

        for (const want of wants) {
          let isMatch = false;
          let matchScore = 0;
          let matchReason = '';

          if (sellerDiscogsId && sellerDiscogsId === want.id) {
            isMatch = true;
            matchScore = 100;
            matchReason = '🆔 Coincidencia por Discogs ID';
          } else {
            const normWantArtist = normalizeText(want.artist);
            const normWantTitle = normalizeText(want.title);

            if (normSellerArtist && normSellerTitle && normWantArtist === normSellerArtist && normWantTitle === normSellerTitle) {
              isMatch = true;
              matchScore = 98;
              matchReason = '🎯 Coincidencia exacta de Artista y Título';
            } else if (normSellerTitle && normWantArtist && normWantTitle && normSellerTitle.includes(normWantArtist) && normSellerTitle.includes(normWantTitle)) {
              isMatch = true;
              matchScore = 90;
              matchReason = '🔍 Coincidencia de Artista y Título en columna';
            } else if (normWantArtist && normWantTitle) {
              const normWantCombined = `${normWantArtist} ${normWantTitle}`;
              if (normCombined && (normCombined.includes(normWantCombined) || normWantCombined.includes(normCombined))) {
                isMatch = true;
                matchScore = 85;
                matchReason = '✨ Coincidencia difusa de nombre';
              } else {
                const wantWords = normWantCombined.split(' ').filter(w => w.length > 2);
                const sellerWords = normCombined.split(' ').filter(w => w.length > 2);
                if (wantWords.length > 0 && sellerWords.length > 0) {
                  const shared = wantWords.filter(w => sellerWords.includes(w));
                  const ratio = shared.length / wantWords.length;
                  if (ratio >= 0.75 && shared.length >= 2) {
                    isMatch = true;
                    matchScore = Math.round(ratio * 90);
                    matchReason = `💡 Coincidencia parcial (${Math.round(ratio * 100)}% palabras clave)`;
                  }
                }
              }
            }
          }

          if (isMatch) {
            matches.push({
              wantItem: want,
              sellerArtist,
              sellerTitle,
              sellerPrice,
              sellerFormat,
              sellerCondition,
              matchScore,
              matchReason,
              rawRow: row
            });
            break;
          }
        }
      }

      return matches;
    }
  };

  global.LocalMatcher = LocalMatcher;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalMatcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
