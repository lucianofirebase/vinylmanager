// js/importer.js - Analizador e Importador Masivo de Archivos Excel a Firestore

import { 
    saveStockItem, 
    searchDiscogsDatabaseWithFormat, 
    fetchDiscogsResourceDetails 
} from './api.js';

export function parseExcelPaste(text) {
    if (!text) return [];
    const lines = text.split('\n');
    return lines.map(line => line.split('\t'));
}

export function renderImportTablePreview(importData) {
    const options = [
        { val: 'skip', label: '❌ Ignorar' },
        { val: 'artist', label: '👤 Artista' },
        { val: 'title', label: '💿 Título' },
        { val: 'url', label: '🔗 Link Discogs' },
        { val: 'price', label: '💰 Precio' },
        { val: 'qty', label: '🔢 Cantidad' },
        { val: 'grade', label: '⭐ Estado' },
        { val: 'format', label: '📻 Formato' }
    ];

    const firstRow = importData[0] || [];
    let html = '<thead><tr>';
    firstRow.forEach((_, i) => {
        html += `<th style="padding:0.5rem;"><select class="map-select" data-col="${i}" style="background:#1a1a2e; color:white; border:1px solid var(--accent); border-radius:4px; padding:2px;">
            ${options.map(opt => `<option value="${opt.val}" ${i === 0 && opt.val === 'artist' ? 'selected' : ''} ${i === 1 && opt.val === 'title' ? 'selected' : ''}>${opt.label}</option>`).join('')}
        </select></th>`;
    });
    html += '</tr></thead><tbody>';

    importData.slice(0, 5).forEach(row => {
        html += '<tr>';
        row.forEach(cell => html += `<td style="padding: 0.5rem; border: 1px solid rgba(255,255,255,0.05); color:var(--text-secondary);">${cell}</td>`);
        html += '</tr>';
    });
    html += '</tbody>';
    return html;
}

export async function runBulkImport(importData, mapping, onProgress, onLog) {
    const total = importData.length;
    let processed = 0;

    for (let i = 0; i < total; i++) {
        const row = importData[i];
        let artist = row[mapping.artist]?.trim() || 'Desconocido';
        let title = row[mapping.title]?.trim() || 'Desconocido';
        const url = row[mapping.url]?.trim() || '';
        const price = parseFloat(row[mapping.price]) || 0;
        const qty = parseInt(row[mapping.qty]) || 1;
        const grade = row[mapping.grade]?.trim() || 'VG+';

        processed++;
        onProgress(processed, total, `Procesando: ${artist} - ${title}`);

        try {
            let itemData = null;

            // SI HAY URL: Intentamos extraer info del link primero (como backup)
            let urlArtist = '';
            let urlTitle = '';
            if (url && url.includes('discogs.com')) {
                const slugMatch = url.match(/\/(release|master)\/\d+-(.+)$/);
                if (slugMatch && slugMatch[2]) {
                    const slug = slugMatch[2].replace(/-/g, ' ');
                    const parts = slug.split(' ');
                    urlArtist = parts[0] || '';
                    urlTitle = parts.slice(1).join(' ') || '';
                    if (!artist || artist === 'Desconocido') artist = urlArtist;
                    if (!title || title === 'Desconocido') title = urlTitle;
                }
            }

            if (url && url.includes('discogs.com')) {
                const idMatch = url.match(/\/(release|master)\/(\d+)/);
                if (idMatch) {
                    const type = idMatch[1] === 'release' ? 'releases' : 'masters';
                    const id = idMatch[2];
                    
                    try {
                        const details = await fetchDiscogsResourceDetails(`https://api.discogs.com/${type}/${id}`);
                        itemData = {
                            artist: details.artists ? details.artists[0].name : (urlArtist || artist),
                            title: details.title || (urlTitle || title),
                            cover: details.images ? details.images[0].resource_url : '',
                            year: details.year || '',
                            label: details.labels ? details.labels[0].name : '',
                            catno: details.labels ? details.labels[0].catno : ''
                        };
                    } catch (e) {
                        console.error(`Fallo fetch directo para ${id}`, e);
                    }
                }
            }

            // SI NO HAY URL o falló la API: Buscamos por texto o usamos el backup de la URL
            if (!itemData) {
                const searchName = `${artist} ${title}`;
                const formatFilter = row[mapping.format] || 'Vinyl';

                if (artist !== 'Desconocido' && title !== 'Desconocido') {
                    const searchData = await searchDiscogsDatabaseWithFormat(searchName, formatFilter);
                    const bestMatch = searchData.results && searchData.results[0];
                    
                    if (bestMatch) {
                        itemData = {
                            artist: bestMatch.title.split(' - ')[0],
                            title: bestMatch.title.split(' - ')[1] || bestMatch.title,
                            cover: bestMatch.cover_image,
                            year: bestMatch.year,
                            label: bestMatch.label ? bestMatch.label[0] : '',
                            catno: bestMatch.catno
                        };
                    }
                }
            }

            if (!itemData) {
                itemData = { artist, title, cover: '', year: '', label: '', catno: '' };
            }

            const newItem = {
                ...itemData,
                price, qty, grade,
                gradeCover: grade,
                format: row[mapping.format] || 'Vinyl',
                status: price > 0 ? 'disponible' : 'borrador',
                dateAdded: new Date().toISOString()
            };

            await saveStockItem(newItem);

            if (itemData.cover) {
                onLog(`✅ Importado: ${newItem.artist} - ${newItem.title} (${newItem.format})`, 'success');
            } else {
                onLog(`⚠️ Manual (no en Discogs): ${newItem.artist} - ${newItem.title} (${newItem.format})`, 'warning');
            }
        } catch (err) {
            onLog(`❌ Error en: ${artist} - ${title}`, 'error');
        }

        // Espera de 1.5 segundos para no saturar la API de Discogs
        await new Promise(r => setTimeout(r, 1500));
    }
    
    onProgress(total, total, "¡Importación finalizada!");
}
