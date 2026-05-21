export function formatCurrency(price: number, currencyCode?: string | null): string {
  const currency = currencyCode || 'USD';
  const formattedPrice = price.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  switch (currency) {
    case 'EUR':
      return `€${formattedPrice}`;
    case 'UYU':
      return `$ ${formattedPrice} UYU`;
    case 'ARS':
      return `$ ${formattedPrice} ARS`;
    case 'USD':
    default:
      return `$${formattedPrice}`;
  }
}

export function fixMojibake(text: string): string {
  if (!text) return text;
  try {
    // Detect typical UTF-8 bytes interpreted as ISO-8859-1 (mojibake)
    // e.g. "Ã±" (c3 b1) or "Ãº" (c3 ba)
    if (/[\u00C0-\u00DF][\u0080-\u00BF]/.test(text)) {
      return decodeURIComponent(escape(text));
    }
  } catch (e) {
    // Return original if escape/decode fails
  }
  return text;
}

export function repairSpanishText(text: string): string {
  if (!text) return text;

  let repaired = text;

  // Dictionary of common replacements for spaces that should be accented vowels or ñ
  const replacements: [RegExp, string][] = [
    // Whole words / common prefixes/suffixes
    [/\bM\ssica\b/gi, "Música"],
    [/\bM\ssico\b/gi, "Músico"],
    [/\bM\ssicos\b/gi, "Músicos"],
    [/\bg\ nero\b/gi, "género"],
    [/\bg\ neros\b/gi, "géneros"],
    [/\bcanci\ n\b/gi, "canción"],
    [/\bcanciones\b/gi, "canciones"],
    [/\bOlimare\sos\b/gi, "Olimareños"],
    [/\bcl\ sico\b/gi, "clásico"],
    [/\bcl\ sicos\b/gi, "clásicos"],
    [/\bcl\ sica\b/gi, "clásica"],
    [/\bcl\ sicas\b/gi, "clásicas"],
    [/\bEspa\sa\b/gi, "España"],
    [/\bespa\sol\b/gi, "español"],
    [/\bespa\sola\b/gi, "española"],
    [/\ba\sos\b/gi, "años"],
    [/\bdise\so\b/gi, "diseño"],
    [/\bedici\ n\b/gi, "edición"],
    [/\bediciones\b/gi, "ediciones"],
    [/\bgrabaci\ n\b/gi, "grabación"],
    [/\bproducci\ n\b/gi, "producción"],
    [/\bcompila\si\sn\b/gi, "compilación"],
    [/\bcompila\sn\b/gi, "compilación"],
    [/\bpe\sa\b/gi, "peña"],
    [/\bse\sal\b/gi, "señal"],
    [/\bcari\so\b/gi, "cariño"],
    [/\bsue\so\b/gi, "sueño"],
    [/\bni\so\b/gi, "niño"],
    [/\bni\sa\b/gi, "niña"],
    [/\bse\ sor\b/gi, "señor"],
    [/\bse\ sora\b/gi, "señora"],
    [/\bvi\ sa\b/gi, "viña"],
    [/\bca\ sa\b/gi, "caña"],
    [/\bOrqu\ sesta\b/gi, "Orquesta"],
    [/\bSinf\ snica\b/gi, "Sinfónica"],
    [/\bSinf\ snico\b/gi, "Sinfónico"],
    [/\bFilarm\ snica\b/gi, "Filarmónica"],
    [/\bint\ rprete\b/gi, "intérprete"],
    [/\bint\ rpretes\b/gi, "intérpretes"],
    [/\bart\ stico\b/gi, "artístico"],
    [/\bart\ stica\b/gi, "artística"],
    [/\baut\ ntico\b/gi, "auténtico"],
    [/\baut\ ntica\b/gi, "auténtica"],
    [/\bd\ cada\b/gi, "década"],
    [/\bC\ mara\b/gi, "Cámara"],
    [/\bc\ mara\b/gi, "cámara"],
    [/\bAsociacion\b/g, "Asociación"],
    [/\basociacion\b/g, "asociación"],
    
    // Inline character patterns
    [/Olimare\sos/gi, "Olimareños"],
    [/M\ssica/gi, "Música"],

    // General single-letter space corruptions
    // Match consonant-space-wordsegment
    // e.g. M sica -> Música, g nero -> género, l rica -> lírica
    // Letter must be an invalid single-letter word in Spanish: BCDFGHJKLMNPQRSTVWXZ (capital or lower)
    // Plus "i" (since "i" is not a word)
    [/(\b[bcdfghijklmnpqrstvwxzBCDFGHIJKLMNPQRSTVWXZ])\s(sica)\b/gi, "$1ú$2"], // M sica -> Música
    [/(\b[bcdfghijklmnpqrstvwxzBCDFGHIJKLMNPQRSTVWXZ])\s(nero)\b/gi, "$1é$2"], // g nero -> género
    [/(\b[bcdfghijklmnpqrstvwxzBCDFGHIJKLMNPQRSTVWXZ])\s(rica)\b/gi, "$1í$2"], // l rica -> lírica
    
    // Match wordsegment-space-single-consonant
    // e.g. canci n -> canción, edici n -> edición, grabaci n -> grabación, a n -> aún
    [/([Cc]anci)\s([Nn])\b/g, "$1ó$2"],
    [/([Ee]dici)\s([Nn])\b/g, "$1ó$2"],
    [/([Gg]rabaci)\s([Nn])\b/g, "$1ó$2"],
    [/([Pp]roducci)\s([Nn])\b/g, "$1ó$2"],
    [/([Cc]ompilaci)\s([Nn])\b/g, "$1ó$2"],
    [/([Cc]ompila)\s([Nn])\b/g, "$1ó$2"],
    [/([Ss]inf)\s(nica)\b/gi, "$1ó$2"],
    [/([Ff]ilarm)\s(nica)\b/gi, "$1ó$2"],
    [/([Aa])\s(os)\b/gi, "$1ñ$2"], // a os -> años
    [/([Ee]spa)\s(ol)\b/gi, "$1ñ$2"], // espa ol -> español
    [/([Ee]spa)\s(ola)\b/gi, "$1ñ$2"], // espa ola -> española
    [/([Ee]spa)\s(a)\b/gi, "$1ñ$2"], // espa a -> españa
  ];

  for (const [regex, replacement] of replacements) {
    repaired = repaired.replace(regex, replacement);
  }

  return repaired;
}

export function repairTextEncoding(text: string): string {
  if (!text) return text;
  let result = text;
  result = fixMojibake(result);
  result = repairSpanishText(result);
  return result;
}

export function getDiscogsIdFromCoverUrl(coverUrl: string): number | null {
  if (!coverUrl || !coverUrl.includes('discogs.com')) return null;
  try {
    // Discogs cover URLs contain a base64 encoded segment representing the s3 URL
    // e.g. https://i.discogs.com/.../czM6Ly9kaXNjb2dz...
    // Let's extract the part starting with 'czM6' (which is 's3:')
    const match = coverUrl.match(/(czM6[a-zA-Z0-9_=-]+)/);
    if (match) {
      let b64 = match[1];
      const segments = coverUrl.split('/');
      const startIndex = segments.findIndex(s => s.startsWith('czM6'));
      if (startIndex !== -1) {
        // Concatenate all subsequent segments and strip extension
        b64 = segments.slice(startIndex).join('').replace(/\.[a-zA-Z]+$/, '');
      }
      
      // Clean base64 and decode
      const cleanB64 = b64.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(cleanB64);
      const idMatch = decoded.match(/\/R-(\d+)-/);
      if (idMatch && idMatch[1]) {
        return parseInt(idMatch[1]);
      }
    }
  } catch (e) {
    console.error("Error parsing cover URL for Discogs ID:", e);
  }
  return null;
}
