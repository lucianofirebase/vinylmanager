/**
 * Vinyl Stock Manager • Local Sheet Importer Module (js/local.js)
 * Copy-paste parser from Google Drive / Excel, interactive column mapper and local stock matcher
 */

// ===============================================
// LOCAL SELLER SHEET IMPORT & MATCHING FUNCTIONS
// ===============================================

function openWishlistSheetModal(matrix = null) {
  currentSheetTarget = 'wishlist';
  const localSheetModal = document.getElementById('local-sheet-modal');
  if (!localSheetModal) return;

  const badge = document.getElementById('local-modal-badge');
  const title = document.getElementById('local-modal-title');
  const desc = document.getElementById('local-modal-desc');
  const runBtn = document.getElementById('btn-run-local-match');

  if (badge) badge.textContent = '[ IMPORTACIÓN DE WISHLIST / PLANILLA ]';
  if (title) title.textContent = 'Mapear Columnas de tu Lista de Deseos';
  if (desc) desc.textContent = 'Asigna las columnas de Artista y Título para importar tus discos y chequear vendedores al instante.';
  if (runBtn) runBtn.innerHTML = '🚀 IMPORTAR DISCOS Y CHEQUEAR VENDEDORES';

  localSheetModal.style.display = 'flex';
  localSheetModal.classList.add('open');

  if (matrix && matrix.length > 0) {
    processParsedLocalMatrix(matrix);
  } else {
    const step1 = document.getElementById('local-step-1');
    const step2 = document.getElementById('local-step-2');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
  }
}

function handleAnalyzeOnboardSheet() {
  const pasteArea = document.getElementById('onboard-sheet-paste-area');
  const fileInput = document.getElementById('onboard-sheet-file-input');
  
  let rawText = pasteArea ? pasteArea.value : '';
  
  if (!rawText.trim() && fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const filename = file.name.toLowerCase();
    const isExcelBinary = filename.endsWith('.xlsx') || filename.endsWith('.xls');
    
    const reader = new FileReader();
    
    if (isExcelBinary && typeof XLSX !== 'undefined') {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          openWishlistSheetModal(matrix);
        } catch (err) {
          console.error('Error al parsear Excel XLSX:', err);
          alert('No se pudo leer el archivo Excel (.xlsx).');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        openWishlistSheetModal(parseSheetText(e.target.result));
      };
      reader.readAsText(file);
    }
    return;
  }
  
  if (rawText.trim()) {
    openWishlistSheetModal(parseSheetText(rawText));
    return;
  }
  
  // If nothing pasted, open step 1 for user to paste or select file
  openWishlistSheetModal();
}

function openLocalSheetModal() {
  currentSheetTarget = 'local_catalog';
  const localSheetModal = document.getElementById('local-sheet-modal');
  if (!localSheetModal) return;

  const badge = document.getElementById('local-modal-badge');
  const title = document.getElementById('local-modal-title');
  const desc = document.getElementById('local-modal-desc');
  const runBtn = document.getElementById('btn-run-local-match');

  if (badge) badge.textContent = '[ CATÁLOGO LOCAL / SHEETS ]';
  if (title) title.textContent = 'Cruzar Planilla Local (Drive / Excel)';
  if (desc) desc.textContent = 'Copia el stock de disquerías locales uruguayas para encontrar coincidencias inmediatas con tu Wantlist.';
  if (runBtn) runBtn.innerHTML = '🔍 Cruzar con mi Wantlist';

  localSheetModal.style.display = 'flex';
  localSheetModal.classList.add('open');
  const step1 = document.getElementById('local-step-1');
  const step2 = document.getElementById('local-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
}

function closeLocalSheetModal() {
  const localSheetModal = document.getElementById('local-sheet-modal');
  if (localSheetModal) {
    localSheetModal.classList.remove('open');
    localSheetModal.style.display = 'none';
  }
}

function parseSheetText(text) {
  if (!text || !text.trim()) return [];
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
}

function handleAnalyzeLocalSheet() {
  const pasteArea = document.getElementById('local-sheet-paste-area');
  const fileInput = document.getElementById('local-sheet-file-input');
  
  let rawText = pasteArea ? pasteArea.value : '';
  
  if (!rawText.trim() && fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const filename = file.name.toLowerCase();
    const isExcelBinary = filename.endsWith('.xlsx') || filename.endsWith('.xls');
    
    const reader = new FileReader();
    
    if (isExcelBinary && typeof XLSX !== 'undefined') {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          processParsedLocalMatrix(matrix);
        } catch (err) {
          console.error('Error al parsear Excel XLSX:', err);
          alert('No se pudo leer el archivo Excel (.xlsx). Asegúrate de que no esté protegido con contraseña o corrupto.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        processParsedLocalMatrix(parseSheetText(e.target.result));
      };
      reader.readAsText(file);
    }
    return;
  }
  
  if (!rawText.trim()) {
    alert('Por favor pegá el contenido de las celdas de la planilla o seleccioná un archivo Excel (.xlsx) o CSV.');
    return;
  }
  
  processParsedLocalMatrix(parseSheetText(rawText));
}

// Filter out trailing completely empty columns produced by copying empty cells in Google Sheets/Excel
function trimEmptyColumns(matrix) {
  if (!matrix || matrix.length === 0) return matrix;
  let maxCol = -1;
  const sampleRows = matrix.slice(0, 100);
  for (const row of sampleRows) {
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
        if (c > maxCol) maxCol = c;
        break;
      }
    }
  }
  if (maxCol === -1) return matrix;
  return matrix.map(row => row.slice(0, maxCol + 1));
}

// Detect whether Row 0 or Row 1 is the actual table header
function detectHeaderRowOffset(matrix) {
  if (!matrix || matrix.length < 2) return 0;
  const headerKeywords = ['titulo', 'title', 'artist', 'artista', 'link', 'genero', 'genre', 'estado', 'condition', 'precio', 'price', 'año', 'year', 'detalles', 'url', 'discogs', 'formato', 'format', '$', 'u$d', 'usd'];
  
  const scoreRow = (row) => {
    if (!row || !row.length) return 0;
    let matches = 0;
    row.forEach(cell => {
      const lower = String(cell || '').toLowerCase().trim();
      if (headerKeywords.some(kw => lower === kw || (kw.length > 2 && lower.includes(kw)))) {
        matches++;
      }
    });
    return matches;
  };

  const score0 = scoreRow(matrix[0]);
  const score1 = scoreRow(matrix[1]);
  
  // If row 1 has 2+ keywords and clearly outscores row 0, row 1 is the real header
  if (score1 >= 2 && score1 > score0) {
    return 1;
  }
  return 0;
}

function processParsedLocalMatrix(rawMatrix) {
  if (!rawMatrix || rawMatrix.length === 0) {
    alert('No se pudieron detectar filas válidas en el texto proporcionado.');
    return;
  }
  
  // 1. Trim trailing phantom empty columns
  let matrix = trimEmptyColumns(rawMatrix);
  
  // 2. Detect if row 0 was junk/single-cell metadata and row 1 is the real header
  const headerOffset = detectHeaderRowOffset(matrix);
  if (headerOffset > 0) {
    matrix = matrix.slice(headerOffset);
  }
  
  state.localSheetRows = matrix;
  
  const step1 = document.getElementById('local-step-1');
  const step2 = document.getElementById('local-step-2');
  const detectedRowsCount = document.getElementById('local-detected-rows-count');
  
  if (detectedRowsCount) {
    const dataRowCount = Math.max(0, matrix.length - 1);
    detectedRowsCount.textContent = `${dataRowCount} vinilos / ${matrix[0].length} columnas detectadas`;
  }
  
  renderLocalMappingTable(matrix);
  
  if (step1) step1.style.display = 'none';
  if (step2) step2.style.display = 'block';
}

function renderLocalMappingTable(matrix) {
  const table = document.getElementById('local-mapping-table');
  if (!table || matrix.length === 0) return;
  
  const colCount = Math.max(...matrix.slice(0, 5).map(row => row.length));
  const firstRow = matrix[0];
  
  const candidateMappings = autoDetectColumnTypes(matrix);
  
  let html = '<thead><tr>';
  for (let c = 0; c < colCount; c++) {
    const headerName = firstRow[c] || `Columna ${c + 1}`;
    const selectedType = candidateMappings[c] || 'ignore';
    const isAssigned = selectedType !== 'ignore';
    
    html += `
      <th class="p-3 border-b-2 border-hairline-dark bg-surface-low text-left font-mono" style="min-width: 175px; width: 175px; max-width: 175px; vertical-align: top;">
        <div class="flex items-center justify-between gap-1 mb-1">
          <span class="text-[9px] font-bold uppercase tracking-wider text-muted-graphite">COLUMNA ${c + 1}</span>
          ${isAssigned ? '<span class="text-[8.5px] font-bold px-1 bg-prada-red text-pure-white shadow-xs">ACTIVA</span>' : ''}
        </div>
        <div class="font-sans font-bold text-xs uppercase text-pitch-black truncate mb-2" title="${escapeHTML(headerName)}">${escapeHTML(headerName)}</div>
        <select class="col-mapper-select w-full ${isAssigned ? 'border-2 border-prada-red bg-prada-red-bg text-prada-red font-extrabold' : 'border border-hairline-dark bg-pure-white text-pitch-black font-bold'} font-mono text-[10.5px] uppercase py-1.5 pl-2 pr-6 focus:outline-none cursor-pointer shadow-xs transition-colors" data-col="${c}" style="appearance: none; background-image: url('data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'%231a1a1a\\'%3E%3Cpath stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M19 9l-7 7-7-7\\'%3E%3C/path%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 6px center; background-size: 11px;">
          <option value="ignore" ${selectedType === 'ignore' ? 'selected' : ''}>-- Ignorar --</option>
          <option value="artist" ${selectedType === 'artist' ? 'selected' : ''}>🎤 Artista</option>
          <option value="title" ${selectedType === 'title' ? 'selected' : ''}>🎵 Título / Álbum</option>
          <option value="price" ${selectedType === 'price' ? 'selected' : ''}>💰 Precio</option>
          <option value="discogs_id" ${selectedType === 'discogs_id' ? 'selected' : ''}>🆔 ID / Link Discogs</option>
          <option value="condition" ${selectedType === 'condition' ? 'selected' : ''}>⭐ Estado / Grado</option>
          <option value="format" ${selectedType === 'format' ? 'selected' : ''}>💿 Formato</option>
        </select>
      </th>
    `;
  }
  html += '</tr></thead><tbody>';
  
  // Preview up to 6 rows of actual vinyl data (starting from row 1)
  const previewRows = matrix.slice(1, 7);
  previewRows.forEach((row, idx) => {
    html += `<tr class="border-b border-hairline-light ${idx % 2 === 0 ? 'bg-pure-white' : 'bg-ivory-warm/40'} hover:bg-surface-low transition-colors">`;
    for (let c = 0; c < colCount; c++) {
      const cellText = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';
      html += `
        <td class="p-2.5 font-mono text-[11px] text-pitch-black truncate border-r border-hairline-light/40" style="min-width: 175px; width: 175px; max-width: 175px;" title="${escapeHTML(cellText)}">
          ${cellText ? escapeHTML(cellText) : '<span class="text-muted-graphite/50">—</span>'}
        </td>
      `;
    }
    html += '</tr>';
  });
  
  html += '</tbody>';
  table.innerHTML = html;

  // Add reactive style updates when the user switches any dropdown
  table.querySelectorAll('.col-mapper-select').forEach(select => {
    select.addEventListener('change', () => {
      const isAct = select.value !== 'ignore';
      if (isAct) {
        select.className = 'col-mapper-select w-full border-2 border-prada-red bg-prada-red-bg text-prada-red font-extrabold font-mono text-[10.5px] uppercase py-1.5 pl-2 pr-6 focus:outline-none cursor-pointer shadow-xs transition-colors';
      } else {
        select.className = 'col-mapper-select w-full border border-hairline-dark bg-pure-white text-pitch-black font-bold font-mono text-[10.5px] uppercase py-1.5 pl-2 pr-6 focus:outline-none cursor-pointer shadow-xs transition-colors';
      }
    });
  });
}

function autoDetectColumnTypes(matrix) {
  if (!matrix || matrix.length === 0) return {};
  const header = matrix[0].map(h => String(h || '').toLowerCase().trim());
  const colCount = Math.max(...matrix.slice(0, 5).map(r => r.length));
  const mapping = {};
  
  const sampleData = matrix.slice(1, 6);
  
  for (let c = 0; c < colCount; c++) {
    const h = header[c] || '';
    const hasDiscogsLink = sampleData.some(r => String(r[c] || '').includes('discogs.com/release/'));
    const hasUrl = sampleData.some(r => String(r[c] || '').startsWith('http'));
    
    if (h.includes('artist') || h.includes('banda') || h.includes('autor') || h.includes('interprete')) {
      mapping[c] = 'artist';
    } else if (h.includes('title') || h.includes('titulo') || h.includes('album') || h.includes('disco')) {
      mapping[c] = 'title';
    } else if (h.includes('link') || h.includes('url') || hasDiscogsLink) {
      mapping[c] = 'discogs_id';
    } else if (h.includes('precio') || h.includes('price') || h.includes('costo') || h === '$' || h.includes('usd') || h.includes('u$d') || h.includes('uyu')) {
      if (!Object.values(mapping).includes('price')) {
        mapping[c] = 'price';
      }
    } else if (h.includes('format') || h.includes('formato') || h.includes('tipo')) {
      mapping[c] = 'format';
    } else if (h.includes('estado') || h.includes('condic') || h.includes('grade') || h.includes('media')) {
      mapping[c] = 'condition';
    } else if (h.includes('discogs') || h.includes('release') || h.includes('id')) {
      mapping[c] = 'discogs_id';
    }
  }
  
  if (!Object.values(mapping).includes('artist') && !Object.values(mapping).includes('title')) {
    if (colCount >= 1) mapping[0] = 'artist';
    if (colCount >= 2) mapping[1] = 'title';
  }
  
  return mapping;
}

function handleRunLocalMatch() {
  const selects = document.querySelectorAll('.col-mapper-select');
  const mapping = {};
  selects.forEach(select => {
    const colIdx = parseInt(select.getAttribute('data-col'), 10);
    mapping[colIdx] = select.value;
  });
  
  if (!Object.values(mapping).includes('artist') && !Object.values(mapping).includes('title') && !Object.values(mapping).includes('discogs_id')) {
    alert('Debes asignar al menos una columna de Artista, Título o Discogs ID.');
    return;
  }
  
  // IF USER IS IMPORTING THEIR WISHLIST FROM SPREADSHEET:
  if (currentSheetTarget === 'wishlist') {
    const rows = state.localSheetRows;
    const startIndex = rows.length > 1 ? 1 : 0;
    const importedWants = [];
    
    for (let r = startIndex; r < rows.length; r++) {
      const row = rows[r];
      let artist = '';
      let title = '';
      let price = '';
      let format = '';
      let condition = '';
      let discogsId = null;
      
      Object.keys(mapping).forEach(colIdx => {
        const idx = parseInt(colIdx, 10);
        const val = (row[idx] !== undefined && row[idx] !== null) ? String(row[idx]).trim() : '';
        const field = mapping[colIdx];
        if (field === 'artist') artist = val;
        else if (field === 'title') title = val;
        else if (field === 'price') price = val;
        else if (field === 'format') format = val;
        else if (field === 'condition') condition = val;
        else if (field === 'discogs_id') {
          const idMatch = val.match(/\d{4,9}/);
          if (idMatch) discogsId = parseInt(idMatch[0], 10);
        }
      });
      
      if (!artist && !title && !discogsId) continue;
      
      importedWants.push({
        id: discogsId || (Date.now() + r),
        artist: artist || 'Desconocido',
        title: title || (discogsId ? `Disco #${discogsId}` : `Vinilo #${r}`),
        year: '',
        format: format || 'Vinyl',
        condition: condition || '',
        priceLimit: price || '',
        notes: 'Importado de planilla',
        isPriority: false,
        thumb: '',
        forSaleCount: 0
      });
    }

    if (importedWants.length === 0) {
      alert('No se encontraron filas con datos de vinilos válidos.');
      return;
    }

    state.wants = importedWants;
    localStorage.setItem('discogs_wants', JSON.stringify(importedWants));
    if (metricWantsCount) metricWantsCount.textContent = state.wants.length;
    
    closeLocalSheetModal();
    if (typeof calculateAndRenderStats === 'function') calculateAndRenderStats();
    if (typeof enrichWantlistStats === 'function') enrichWantlistStats();
    showWantlistManager();
    
    showToast(`¡${importedWants.length} vinilos importados a tu lista de deseos!`, 'success');
    log(`Wishlist importada desde planilla: ${importedWants.length} vinilos cargados.`, 'success');

    // Automatically prompt to scan/check sellers without split screen
    setTimeout(() => {
      openScanCacheModal();
    }, 450);
    return;
  }

  if (!state.wants || state.wants.length === 0) {
    alert('Primero debes cargar tu Lista de Deseos (Wantlist) de Discogs.');
    return;
  }
  
  const matches = [];
  const wants = state.wants;
  const rows = state.localSheetRows;
  
  const startIndex = rows.length > 1 ? 1 : 0;
  
  for (let r = startIndex; r < rows.length; r++) {
    const row = rows[r];
    
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
        const idMatch = val.match(/\d{5,9}/);
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
        } 
        else if (normSellerTitle && normWantArtist && normWantTitle && normSellerTitle.includes(normWantArtist) && normSellerTitle.includes(normWantTitle)) {
          isMatch = true;
          matchScore = 90;
          matchReason = '🔍 Coincidencia de Artista y Título en columna';
        }
        else if (normWantArtist && normWantTitle) {
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
  
  state.localMatches = matches;
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('LOCAL_MATCHING_COMPLETED', `Cotejo local finalizado: ${matches.length} coincidencias encontradas`, {
        totalRows: rows.length,
        matchCount: matches.length,
        username: state.username
      });
    }
  } catch (e) {}
  closeLocalSheetModal();
  
  const tabBtnLocal = document.getElementById('tab-btn-local');
  const badgeLocalCount = document.getElementById('badge-local-count');
  
  if (tabBtnLocal) tabBtnLocal.style.display = 'inline-flex';
  if (badgeLocalCount) {
    badgeLocalCount.textContent = matches.length;
    badgeLocalCount.style.display = 'inline-block';
  }
  
  switchTab('local');
  log(`Cruce con planilla local completado. ¡Encontradas ${matches.length} coincidencias!`, 'success');
}

function renderLocalMatches() {
  const localView = document.getElementById('local-view');
  if (!localView) return;
  
  const matches = state.localMatches || [];
  
  if (matches.length === 0) {
    localView.innerHTML = `
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-hairline-light flex-wrap gap-2">
        <button type="button" class="btn-back-to-sellers border border-hairline-dark bg-pure-white hover:bg-pitch-black hover:text-pure-white text-pitch-black font-mono text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs" data-tooltip="Volver al ranking consolidado de vendedores del marketplace" data-tooltip-pos="top">
          <span class="material-symbols-outlined text-[15px]">arrow_back</span>
          <span>VOLVER A VENDEDORES MARKETPLACE</span>
        </button>
        <span class="font-mono text-[10px] text-muted-graphite uppercase tracking-widest">COINCIDENCIAS CON CATÁLOGO LOCAL</span>
      </div>
      <div class="border-2 border-dashed border-hairline-dark bg-pure-white p-10 sm:p-14 text-center max-w-xl mx-auto my-8 shadow-xs">
        <div class="text-4xl mb-3">🇺🇾</div>
        <h3 class="font-sans font-extrabold text-lg uppercase tracking-tight text-pitch-black mb-2">SIN COINCIDENCIAS LOCALES CARGADAS</h3>
        <p class="font-mono text-xs text-muted-graphite max-w-md mx-auto mb-6 leading-relaxed">
          Pegá las celdas o subí el archivo del catálogo de cualquier disquería local (Google Sheets o Excel) para cruzarlo automáticamente con tu Wantlist.
        </p>
        <button id="btn-open-local-modal-empty" class="bg-pitch-black hover:bg-prada-red text-pure-white font-mono font-bold text-xs uppercase tracking-wider px-6 py-3 transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2" data-tooltip="Abrir ventana para pegar o subir planilla de stock de disquería local" data-tooltip-pos="top">
          <span class="material-symbols-outlined text-[16px]">cloud_download</span>
          <span>CARGAR PLANILLA LOCAL</span>
        </button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-open-local-modal-empty');
    if (btnEmpty) btnEmpty.addEventListener('click', openLocalSheetModal);
    
    localView.querySelectorAll('.btn-back-to-sellers').forEach(btn => {
      btn.addEventListener('click', () => switchTab('sellers'));
    });
    return;
  }
  
  const priorityMatchesCount = matches.filter(m => m.wantItem && m.wantItem.isPriority).length;
  
  let html = `
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-hairline-light flex-wrap gap-2">
      <button type="button" class="btn-back-to-sellers border border-hairline-dark bg-pure-white hover:bg-pitch-black hover:text-pure-white text-pitch-black font-mono text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs" data-tooltip="Volver al ranking consolidado de vendedores del marketplace" data-tooltip-pos="top">
        <span class="material-symbols-outlined text-[15px]">arrow_back</span>
        <span>VOLVER A VENDEDORES MARKETPLACE</span>
      </button>
      <span class="font-mono text-[10px] text-muted-graphite uppercase tracking-widest">COINCIDENCIAS CON CATÁLOGO LOCAL</span>
    </div>

    <!-- Editorial Hero Strip -->
    <div class="border-2 border-hairline-dark bg-pure-white p-6 mb-6 relative shadow-[4px_4px_0px_rgba(0,0,0,0.06)] flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
      <div class="absolute top-0 left-0 right-0 h-1 bg-prada-red"></div>
      <div class="flex flex-col gap-1 pt-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-mono tracking-wider uppercase bg-prada-red text-pure-white px-2 py-0.5 font-bold shadow-xs">
            CATÁLOGO LOCAL
          </span>
          <span class="text-[11px] font-mono uppercase text-prada-blue font-semibold border border-blue-200 bg-blue-50 px-2 py-0.5">
            🇺🇾 URUGUAY / DRIVE
          </span>
        </div>
        <h2 class="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-tight mt-1 text-pitch-black">
          COINCIDENCIAS EN DISQUERÍA LOCAL
        </h2>
        <p class="font-mono text-xs text-muted-graphite mt-0.5">
          SE ENCONTRARON <span class="font-bold text-prada-red">${matches.length} VINILOS</span> DE TU WANTLIST EN LA PLANILLA (${priorityMatchesCount} MARCADOS COMO FAVORITOS ★).
        </p>
      </div>
      <div class="flex items-center gap-3 shrink-0 flex-wrap">
        <button id="btn-reopen-local-modal" class="border-2 border-pitch-black text-pitch-black hover:bg-surface-low font-mono font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex items-center gap-2 shadow-xs" data-tooltip="Importar o mapear otra planilla de catálogo local" data-tooltip-pos="top">
          <span class="material-symbols-outlined text-[15px]">sync</span>
          <span>CARGAR OTRA PLANILLA</span>
        </button>
        <button id="btn-copy-local-matches" class="bg-emerald-700 hover:bg-emerald-800 text-pure-white font-mono font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex items-center gap-2 shadow-xs" data-tooltip="Copiar al portapapeles todos los discos coincidentes para enviar a la disquería" data-tooltip-pos="top">
          <span class="material-symbols-outlined text-[15px]">content_copy</span>
          <span>COPIAR LISTA DE PEDIDO</span>
        </button>
      </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
  `;
  
  matches.forEach(m => {
    const item = m.wantItem || {};
    const hasImage = !!item.image;
    const isPri = !!item.isPriority;
    
    html += `
      <div class="border-2 ${isPri ? 'border-prada-red shadow-[4px_4px_0px_rgba(224,43,32,0.1)]' : 'border-hairline-dark hover:border-pitch-black shadow-[4px_4px_0px_rgba(0,0,0,0.04)]'} bg-pure-white p-5 flex flex-col justify-between relative transition-all group">
        ${isPri ? `
          <span class="absolute top-3 right-3 text-[9px] font-mono font-bold uppercase tracking-wider bg-prada-red text-pure-white px-2 py-0.5 shadow-xs">
            ★ FAVORITO
          </span>
        ` : ''}
        
        <div>
          <div class="flex gap-3.5 mb-4">
            <div class="w-14 h-14 border border-hairline-dark bg-stone-100 shrink-0 overflow-hidden relative shadow-xs">
              ${hasImage ? `
                <img src="${item.image}" referrerpolicy="no-referrer" class="w-full h-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                <div class="w-full h-full hidden items-center justify-center bg-stone-100 text-stone-400">
                  <span class="material-symbols-outlined text-lg">album</span>
                </div>
              ` : `
                <div class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                  <span class="material-symbols-outlined text-xl">album</span>
                </div>
              `}
            </div>
            <div class="min-w-0 flex-1 ${isPri ? 'pr-20' : ''}">
              <p class="font-sans font-extrabold text-sm uppercase tracking-tight text-pitch-black truncate" title="${escapeHTML(item.title || '')}">
                ${escapeHTML(item.title || 'Desconocido')}
              </p>
              <p class="font-mono text-xs text-prada-blue font-bold uppercase tracking-wider truncate mb-1.5" title="${escapeHTML(item.artist || '')}">
                ${escapeHTML(item.artist || 'Varios Artistas')}
              </p>
              <span class="inline-block text-[9px] font-mono uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 font-bold">
                ${escapeHTML(m.matchReason || 'Coincidencia')}
              </span>
            </div>
          </div>
          
          <div class="border border-hairline-dark bg-ivory-warm p-3 flex flex-col gap-2 font-mono text-xs shadow-xs">
            <div class="flex items-start justify-between gap-2">
              <span class="text-[9px] uppercase tracking-wider text-muted-graphite font-semibold shrink-0">PLANILLA:</span>
              <span class="font-bold text-pitch-black truncate text-right text-[11px]" title="${escapeHTML(m.sellerArtist || '')} - ${escapeHTML(m.sellerTitle || '')}">
                ${escapeHTML(m.sellerArtist || '')} - ${escapeHTML(m.sellerTitle || '')}
              </span>
            </div>
            <div class="flex items-center justify-between border-t border-hairline-light pt-2">
              <span class="text-[9px] uppercase tracking-wider text-muted-graphite font-semibold">PRECIO LOCAL:</span>
              <span class="font-extrabold text-prada-red text-sm">
                ${escapeHTML(m.sellerPrice || 'CONSULTAR')}
              </span>
            </div>
            ${m.sellerFormat || m.sellerCondition ? `
              <div class="flex items-center justify-between border-t border-hairline-light pt-1.5 text-[10px] text-muted-graphite">
                <span>${escapeHTML(m.sellerFormat || '')}</span>
                <span class="font-bold text-pitch-black">${escapeHTML(m.sellerCondition || '')}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  localView.innerHTML = html;
  
  const btnReopen = document.getElementById('btn-reopen-local-modal');
  const btnCopyMatches = document.getElementById('btn-copy-local-matches');
  if (btnReopen) btnReopen.addEventListener('click', openLocalSheetModal);
  if (btnCopyMatches) btnCopyMatches.addEventListener('click', copyLocalMatchesToClipboard);
  
  localView.querySelectorAll('.btn-back-to-sellers').forEach(btn => {
    btn.addEventListener('click', () => switchTab('sellers'));
  });
}

async function copyLocalMatchesToClipboard() {
  const matches = state.localMatches || [];
  if (matches.length === 0) return;
  try {
    if (window.Telemetry?.track) {
      window.Telemetry.track('ORDER_COPIED_WHATSAPP', `Pedido para WhatsApp copiado: ${matches.length} vinilos coincidentes`, {
        matchCount: matches.length,
        username: state.username
      });
    }
  } catch (e) {}
  
  const textLines = ['¡Hola! Me interesan los siguientes vinilos de su catálogo:', ''];
  matches.forEach((m, idx) => {
    const star = m.wantItem.isPriority ? ' (★ Favorito)' : '';
    textLines.push(`${idx + 1}. ${m.sellerArtist || m.wantItem.artist} - ${m.sellerTitle || m.wantItem.title} ${m.sellerPrice ? `[${m.sellerPrice}]` : ''}${star}`);
  });
  textLines.push('', '¿Siguen disponibles? ¡Muchas gracias!');
  
  const success = await copyTextToClipboard(textLines.join('\n'));
  if (success) {
    alert('¡Copiada la lista de pedido al portapapeles! Pegala directamente en WhatsApp o Instagram para enviarla a la disquería.');
  }
}

