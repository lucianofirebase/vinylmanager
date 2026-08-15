// app.js - Módulo Orchestrador Principal de la Aplicación Web (Vinyl Manager)

import {
    fetchUserSettings,
    saveUserSettings,
    fetchStockItems,
    saveStockItem,
    sellStockItem,
    deleteStockItem,
    fetchDiscogsCollection,
    searchDiscogsDatabase
} from './js/api.js';

import { logger, showToast, customConfirm, escapeHTML } from './js/ui-utils.js';
import { compressImage } from './js/image-utils.js';
import { getGradeText, getFormatIcon, generateWhatsAppText } from './js/whatsapp.js';
import { parseExcelPaste, renderImportTablePreview, runBulkImport } from './js/importer.js';

// --- CONFIGURACIÓN Y ESTADO DE LA APP ---
let currentStock = [];
let searchResults = [];
let selectedIds = new Set();
let selectedPhotos = [];
let selectedDisc = null;
let editingId = null;
let currentViewMode = 'list'; // grid, list, details
let currentUser = null;
let discogsUser = '';
let selectedProfilePic = '';

const PREDEFINED_AVATARS = ['💿', '🎧', '🎸', '🎹', '📻', '🎙️', '🎶', '🎷'];
const DEFAULT_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23334155'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z'/%3E%3C/svg%3E";

// DOM Elements
const stockList = document.getElementById('stock-list');
const btnSearch = document.getElementById('btn-search');
const inputSearch = document.getElementById('discogs-search');
const modal = document.getElementById('disc-modal');
const closeModal = document.querySelector('.close-modal');
const btnConfirmAdd = document.getElementById('btn-confirm-add');
const waPreview = document.getElementById('wa-preview');

const btnSaveProfile = document.getElementById('btn-save-profile');
const profileNameInput = document.getElementById('profile-name-input');
const profileEmail = document.getElementById('profile-email');
const profilePicLarge = document.getElementById('profile-pic-large');
const profileDiscogsUser = document.getElementById('profile-discogs-user');

const btnSyncDiscogs = document.getElementById('btn-sync-discogs');
const syncModal = document.getElementById('sync-modal');
const closeSync = document.getElementById('close-sync');

const profilePicInput = document.getElementById('input-profile-file');
const avatarSelector = document.getElementById('avatar-selector');

const filterText = document.getElementById('filter-text');
const filterStatus = document.getElementById('filter-status');
const filterSort = document.getElementById('filter-sort');
const filterFormat = document.getElementById('filter-format');

const bulkBar = document.getElementById('bulk-actions-bar');
const bulkCountText = document.getElementById('bulk-count');
const btnSelectAll = document.getElementById('btn-select-all');

const suggestionsDropdown = document.getElementById('search-suggestions');

logger("Vinyl Manager v2.0 - PRO - Iniciando...", 'info');

// --- SISTEMA DE NAVEGACIÓN ---
function switchSection(sectionId) {
    const btn = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (btn) {
        btn.click();
    } else {
        // Fallback manual si no se encuentra el botón
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(`${sectionId}-section`);
        if (target) target.classList.remove('hidden');
    }
}

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!btn.dataset.section) return;
        
        logger(`Cambiando a sección: ${btn.dataset.section}`, 'action');
        
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(`${btn.dataset.section}-section`);
        if (target) target.classList.remove('hidden');
        
        if (btn.id === 'nav-whatsapp') updateWAPreview();
    });
});

// Selector de vista (Grid / List)
document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
        logger(`Cambiando modo de vista a: ${btn.dataset.view}`, 'action');
        document.querySelectorAll('.btn-view').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentViewMode = btn.dataset.view;
        renderStock();
    });
});

function setSyncStatus(status) {
    const el = document.getElementById('sync-indicator');
    if (!el) return;
    const icon = el.querySelector('.sync-icon');
    const text = el.querySelector('.sync-text');
    
    if (status === 'syncing') {
        el.className = 'sync-status syncing';
        icon.textContent = '⏳';
        text.textContent = 'Sincronizando...';
    } else {
        el.className = 'sync-status synced';
        icon.textContent = '☁️';
        text.textContent = 'Sincronizado';
    }
}

// --- AJUSTES Y PERFIL DE USUARIO ---
async function loadUserSettingsData() {
    if (!currentUser) return;
    
    profileEmail.value = currentUser.email;
    profileNameInput.value = currentUser.displayName || '';
    
    renderAvatarSelector();

    try {
        const settings = await fetchUserSettings();
        if (settings.profilePic) {
            selectedProfilePic = settings.profilePic;
            profilePicLarge.src = settings.profilePic;
        } else {
            selectedProfilePic = currentUser.photoURL || '';
            profilePicLarge.src = selectedProfilePic || DEFAULT_COVER;
        }

        if (settings.discogsUser) {
            discogsUser = settings.discogsUser;
            profileDiscogsUser.value = discogsUser;
        }
    } catch (e) {
        console.error("Error cargando ajustes", e);
    }
}

function renderAvatarSelector() {
    if (!avatarSelector) return;
    avatarSelector.innerHTML = PREDEFINED_AVATARS.map(emoji => `
        <div class="avatar-option" onclick="selectAvatarEmoji('${emoji}')" style="cursor:pointer; font-size:1.8rem; background:rgba(255,255,255,0.05); padding:8px; border-radius:12px; min-width:50px; text-align:center;">
            ${emoji}
        </div>
    `).join('');
}

window.selectAvatarEmoji = (emoji) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '70px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 70);
    selectedProfilePic = canvas.toDataURL('image/png');
    profilePicLarge.src = selectedProfilePic;
};

if (profilePicInput) {
    profilePicInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const base64 = await compressImage(file, 200);
                selectedProfilePic = base64;
                profilePicLarge.src = base64;
                logger("Foto subida correctamente", 'success');
            } catch (err) {
                logger("Error al procesar foto", 'error');
            }
        }
    });
}

if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
        const newName = profileNameInput.value.trim();
        const newDiscogs = profileDiscogsUser.value.trim();

        if (!newName) return alert("El nombre no puede estar vacío");

        try {
            setSyncStatus('syncing');
            await saveUserSettings({
                discogsUser: newDiscogs,
                displayName: newName,
                photoURL: selectedProfilePic
            });

            discogsUser = newDiscogs;
            
            document.getElementById('user-name').textContent = newName;
            if (selectedProfilePic) {
                document.getElementById('user-avatar').src = selectedProfilePic;
                profilePicLarge.src = selectedProfilePic;
            }
            logger("¡Perfil actualizado con éxito!", 'success');
            setSyncStatus('synced');
        } catch (e) {
            setSyncStatus('synced');
            alert("Error al guardar: " + e.message);
        }
    });
}

// --- SINCRONIZACIÓN DE DISCOGS ---
if (btnSyncDiscogs) {
    btnSyncDiscogs.addEventListener('click', () => {
        if (!discogsUser) return alert("Primero guarda tu usuario de Discogs arriba ⬆️");
        syncModal.classList.remove('hidden');
        startDiscogsSync();
    });
}

if (closeSync) {
    closeSync.addEventListener('click', () => syncModal.classList.add('hidden'));
}

async function startDiscogsSync() {
    const status = document.getElementById('sync-status');
    const bar = document.getElementById('sync-progress-bar');
    const log = document.getElementById('sync-log');
    log.innerHTML = '';
    bar.style.width = '0%';
    
    status.innerText = `Buscando colección de ${discogsUser}...`;
    
    try {
        const data = await fetchDiscogsCollection(discogsUser);
        const releases = data.releases;
        const total = releases.length;
        
        if (total === 0) {
            status.innerText = "Colección vacía.";
            return;
        }

        let addedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < releases.length; i++) {
            const rel = releases[i];
            const info = rel.basic_information;
            
            const exists = currentStock.some(item => 
                item.artist.toLowerCase() === info.artists[0].name.toLowerCase() && 
                item.title.toLowerCase() === info.title.toLowerCase()
            );

            if (exists) {
                skippedCount++;
                addSyncLog(`⏭️ Saltado (ya existe): ${info.artists[0].name} - ${info.title}`, 'skip');
            } else {
                const newItem = {
                    artist: info.artists[0].name,
                    title: info.title,
                    label: info.labels ? info.labels[0].name : '',
                    year: info.year || '',
                    catno: info.labels ? info.labels[0].catno : '',
                    cover: info.cover_image || '',
                    format: info.formats ? info.formats[0].name : 'Vinyl',
                    price: 0,
                    qty: 1,
                    grade: 'VG+',
                    gradeCover: 'VG+',
                    status: 'coleccion',
                    dateAdded: new Date().toISOString(),
                    discogsId: rel.id
                };

                await saveStockItem(newItem);
                addedCount++;
                addSyncLog(`✅ Agregado: ${info.artists[0].name} - ${info.title}`);
            }

            const percent = Math.round(((i + 1) / total) * 100);
            bar.style.width = `${percent}%`;
            status.innerText = `Procesando ${i + 1} de ${total}...`;
            
            await new Promise(r => setTimeout(r, 500));
        }

        status.innerText = `¡Listo! ${addedCount} nuevos, ${skippedCount} saltados.`;
        loadStock(true);
        
        setTimeout(() => {
            syncModal.classList.add('hidden');
            if (addedCount > 0) {
                logger(`Sincronización completa: ${addedCount} discos añadidos a tu colección`, 'success');
            }
        }, 2000);
        
    } catch (e) {
        status.innerText = "Error: " + e.message;
    }
}

function addSyncLog(msg, type = 'add') {
    const log = document.getElementById('sync-log');
    if (!log) return;
    const div = document.createElement('div');
    div.style.color = type === 'skip' ? '#94a3b8' : '#22c55e';
    div.innerText = msg;
    log.prepend(div);
}

// --- RENDERIZADO DEL STOCK ---
function renderStock() {
    const text = filterText.value.toLowerCase();
    const status = filterStatus.value;
    const sort = filterSort.value;
    const format = filterFormat.value;

    console.log("💡 Actualizando vista del inventario...");

    let filtered = currentStock.filter(item => {
        const title = (item.title || '').toString().toLowerCase();
        const artist = (item.artist || '').toString().toLowerCase();
        const matchText = title.includes(text) || artist.includes(text);
        const matchStatus = status === 'todos' || item.status === status;
        const matchFormat = format === 'todos' || item.format === format;
        return matchText && matchStatus && matchFormat;
    });

    // Ordenamiento
    filtered.sort((a, b) => {
        if (sort === 'artista') return a.artist.localeCompare(b.artist);
        if (sort === 'titulo') return a.title.localeCompare(b.title);
        if (sort === 'precio-asc') return (a.price || 0) - (b.price || 0);
        if (sort === 'precio-desc') return (b.price || 0) - (a.price || 0);
        return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
    });

    if (currentViewMode === 'grid') {
        stockList.className = 'stock-grid-view';
        renderGridView(filtered);
    } else {
        stockList.className = 'stock-list-view';
        renderListView(filtered);
    }
}

function renderListView(items) {
    if (items.length === 0) {
        stockList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; opacity: 0.5;">No hay discos cargados o coincidentes.</div>';
        return;
    }
    
    stockList.innerHTML = items.map(item => {
        const coverImg = item.realPhotos && item.realPhotos.length > 0 && item.useFirstPhotoAsCover ? item.realPhotos[0] : (item.cover || DEFAULT_COVER);
        const isSelected = selectedIds.has(item.id.toString());
        
        return `
        <div class="list-row card ${item.status === 'vendido' ? 'sold-out' : ''}" style="${isSelected ? 'border-color: var(--accent);' : ''}">
            <div class="row-select" onclick="toggleSelect('${item.id}', event)">
                <input type="checkbox" ${isSelected ? 'checked' : ''} style="pointer-events: none;">
            </div>
            <img class="row-cover" src="${coverImg}" alt="${escapeHTML(item.title)}" onerror="this.src='${DEFAULT_COVER}'">
            <div class="row-info">
                <div class="row-title-artist">
                    <span class="row-title" title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</span>
                    <span class="row-artist" title="${escapeHTML(item.artist)}">${escapeHTML(item.artist)}</span>
                </div>
                <div class="row-specs">
                    <span class="badge badge-format">${getFormatIcon(item.format)} ${escapeHTML(item.format || 'Vinyl')}</span>
                    <span class="badge badge-grade">📀 ${escapeHTML(item.grade || 'VG+')}</span>
                    <span class="badge badge-status badge-${item.status}">${item.status === 'coleccion' ? '⭐ Colección' : escapeHTML(item.status)}</span>
                </div>
            </div>
            <div class="row-price-actions">
                <div class="row-price">USD $${item.price || 0}</div>
                <div class="row-actions">
                    ${item.status !== 'vendido' ? `<button class="btn-action btn-sell" onclick="sellItem('${item.id}')">💰 Vender</button>` : ''}
                    <button class="btn-action btn-edit" onclick="editItem('${item.id}')">✍️ Editar</button>
                    <button class="btn-action btn-delete" onclick="deleteItem('${item.id}')">🗑️ Borrar</button>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

function renderGridView(items) {
    if (items.length === 0) {
        stockList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; opacity: 0.5;">No hay discos cargados o coincidentes.</div>';
        return;
    }
    
    stockList.innerHTML = items.map(item => {
        const coverImg = item.realPhotos && item.realPhotos.length > 0 && item.useFirstPhotoAsCover ? item.realPhotos[0] : (item.cover || DEFAULT_COVER);
        const isSelected = selectedIds.has(item.id.toString());
        
        let photosHtml = '';
        if (item.realPhotos && item.realPhotos.length > 0) {
            const carouselId = `carousel-${item.id}`;
            photosHtml = `
                <div class="photo-carousel-wrapper">
                    <button class="carousel-control prev" onclick="scrollCarousel('${carouselId}', -1)">❮</button>
                    <div id="${carouselId}" class="photo-carousel">
                        ${item.realPhotos.map(p => `<img src="${p}" class="carousel-img" alt="Foto Real">`).join('')}
                    </div>
                    <button class="carousel-control next" onclick="scrollCarousel('${carouselId}', 1)">❯</button>
                </div>
            `;
        }
        
        return `
        <div class="card ${item.status === 'sold' || item.status === 'vendido' ? 'sold-out' : ''}" style="${isSelected ? 'border-color: var(--accent);' : ''}">
            <div class="card-select-overlay" onclick="toggleSelect('${item.id}', event)">
                <input type="checkbox" ${isSelected ? 'checked' : ''} style="pointer-events: none;">
            </div>
            
            <img class="card-cover" src="${coverImg}" alt="${escapeHTML(item.title)}" onerror="this.src='${DEFAULT_COVER}'">
            
            <div class="card-info">
                <span class="card-artist" title="${escapeHTML(item.artist)}">${escapeHTML(item.artist)}</span>
                <h3 class="card-title" title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</h3>
                
                <div class="card-specs">
                    <span class="badge badge-format">${getFormatIcon(item.format)} ${escapeHTML(item.format || 'Vinyl')}</span>
                    <span class="badge badge-grade">📀 ${escapeHTML(item.grade || 'VG+')}</span>
                    <span class="badge badge-status badge-${item.status}">${item.status === 'coleccion' ? '⭐ Colección' : escapeHTML(item.status)}</span>
                </div>
                
                <div class="card-price">USD $${item.price || 0}</div>
                
                <div class="details-section">
                    ${item.label ? `<p><strong>Sello:</strong> ${escapeHTML(item.label)}</p>` : ''}
                    ${item.year ? `<p><strong>Año:</strong> ${escapeHTML(item.year)}</p>` : ''}
                    ${item.catno ? `<p><strong>Catálogo:</strong> ${escapeHTML(item.catno)}</p>` : ''}
                    ${item.gradeCover ? `<p><strong>Funda:</strong> ${escapeHTML(item.gradeCover)}</p>` : ''}
                    ${item.reservedBy ? `<p><strong>Reservado por:</strong> ${escapeHTML(item.reservedBy)}</p>` : ''}
                    ${item.reserveDate ? `<p><strong>Fecha Reserva:</strong> ${formatDateSpanish(item.reserveDate)}</p>` : ''}
                    ${item.pickupDate ? `<p><strong>Fecha Entrega:</strong> ${formatDateSpanish(item.pickupDate)}</p>` : ''}
                    
                    ${photosHtml}
                </div>
                
                <button class="btn-toggle-details" onclick="toggleDetails(this)">👁️ Ver detalles y fotos</button>
            </div>
            
            <div class="card-actions">
                ${item.status !== 'vendido' ? `<button class="btn-action btn-sell" onclick="sellItem('${item.id}')">💰 Vender</button>` : ''}
                <button class="btn-action btn-edit" onclick="editItem('${item.id}')">✍️ Editar</button>
                <button class="btn-action btn-delete" onclick="deleteItem('${item.id}')">🗑️ Borrar</button>
            </div>
        </div>
    `;
    }).join('');
}

function formatDateSpanish(dateStr) {
    if (!dateStr) return 'Sin fecha';
    try {
        const date = new Date(dateStr + 'T12:00:00');
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        let formatted = date.toLocaleDateString('es-ES', options);
        return "el " + formatted;
    } catch (e) {
        return dateStr;
    }
}

// --- EDICIÓN Y OPERACIONES ---
window.editItem = (id) => {
    const item = currentStock.find(i => i.id == id);
    if (!item) return;

    logger(`Editando disco: ${item.title}`, 'action');
    editingId = id;
    selectedDisc = { ...item };
    selectedPhotos = []; 

    document.getElementById('modal-title').textContent = "Editar Disco";
    document.getElementById('btn-confirm-add').textContent = "Guardar Cambios";
    
    document.getElementById('manual-fields').classList.remove('hidden');
    document.getElementById('input-title').value = item.title;
    document.getElementById('input-artist').value = item.artist;
    document.getElementById('input-label').value = item.label || '';
    document.getElementById('input-year').value = item.year || '';
    document.getElementById('input-catno').value = item.catno || '';
    document.getElementById('input-format').value = item.format || 'Vinyl';
    
    document.getElementById('input-price').value = item.price;
    document.getElementById('input-qty').value = item.qty || 1;
    document.getElementById('input-grade').value = item.grade;
    document.getElementById('input-grade-cover').value = item.gradeCover || item.grade;
    document.getElementById('input-status').value = item.status || 'disponible';
    
    const resFields = document.getElementById('reservation-fields');
    if (item.status === 'reservado') {
        if (resFields) resFields.classList.remove('hidden');
        document.getElementById('input-reserved-by').value = item.reservedBy || '';
        document.getElementById('input-reserve-date').value = item.reserveDate || '';
        document.getElementById('input-pickup-date').value = item.pickupDate || '';
    } else {
        if (resFields) resFields.classList.add('hidden');
    }
    
    document.getElementById('disc-details').innerHTML = `<p style="font-size:0.8rem; opacity:0.6; margin-bottom:1rem;">Editando: <strong>${item.title}</strong></p>`;
    document.getElementById('photos-preview').innerHTML = '';
    
    document.querySelectorAll('.form-group').forEach(el => el.style.display = 'block');
    document.getElementById('btn-confirm-add').style.display = 'block';
    
    modal.classList.remove('hidden');
};

window.sellItem = async (id) => {
    const item = currentStock.find(i => i.id === id);
    if (!item) return;

    const originalQty = item.qty;
    const originalStatus = item.status;

    if (item.qty > 1) {
        item.qty -= 1;
    } else {
        item.status = 'vendido';
        item.qty = 0;
    }
    renderStock();

    try {
        await sellStockItem(id, item);
    } catch (err) {
        console.error("Error al vender:", err);
        item.qty = originalQty;
        item.status = originalStatus;
        renderStock();
    }
};

window.deleteItem = async (id) => {
    const itemToDelete = currentStock.find(i => i.id == id);
    const docId = itemToDelete?._docId || id;
    
    if (await customConfirm("¿Borrar disco?", `¿Estás seguro de eliminar "${itemToDelete?.title || 'este disco'}"?`)) {
        const backupStock = [...currentStock];
        try {
            currentStock = currentStock.filter(i => i.id != id);
            renderStock();
            
            await deleteStockItem(docId);
            logger(`Disco eliminado con éxito.`, 'success');
        } catch (err) {
            currentStock = backupStock;
            renderStock();
            logger(`Error al eliminar: ${err.message}`, 'error');
        }
    }
};

// --- BÚSQUEDA Y SUGERENCIAS ---
function debounce(func, timeout = 500) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

async function searchDiscogsDB(query) {
    if (!query || query.length < 2) {
        suggestionsDropdown.classList.add('hidden');
        return;
    }
    logger(`Buscando en Discogs: "${query}"`, 'search');
    
    try {
        const data = await searchDiscogsDatabase(query);
        if (data.results) {
            logger(`Se encontraron ${data.results.length} resultados`, 'success');
            searchResults = data.results.slice(0, 8);
            renderSuggestions();
        }
    } catch (err) {
        logger("Error al conectar con Discogs", 'error');
    }
}

const processSearch = debounce((q) => searchDiscogsDB(q));

inputSearch.addEventListener('input', (e) => {
    processSearch(e.target.value);
});

btnSearch.addEventListener('click', () => {
    searchDiscogsDB(inputSearch.value);
});

function renderSuggestions() {
    suggestionsDropdown.innerHTML = `
        ${searchResults.map((res, index) => `
            <div class="suggestion-item" onclick="selectFromSuggestion(${index})">
                <img src="${res.cover_image}" alt="">
                <div class="suggestion-info">
                    <strong>${res.title}</strong>
                    <span>${res.year || ''} | ${res.country || ''} | ${res.catno || ''}</span>
                </div>
            </div>
        `).join('')}
        <div class="suggestion-item manual-trigger" onclick="startManualEntry()">
            <div class="suggestion-info">
                <strong>+ ¿No está el disco? Añadir manualmente</strong>
            </div>
        </div>
    `;
    suggestionsDropdown.classList.remove('hidden');
}

window.startManualEntry = () => {
    suggestionsDropdown.classList.add('hidden');
    selectedDisc = { isManual: true };
    
    document.getElementById('disc-details').innerHTML = '';
    document.getElementById('input-title').value = '';
    document.getElementById('input-artist').value = '';
    document.getElementById('input-label').value = '';
    document.getElementById('input-year').value = '';
    document.getElementById('input-catno').value = '';
    document.getElementById('input-price').value = '';
    
    document.getElementById('manual-fields').classList.remove('hidden');
    document.querySelectorAll('.form-group').forEach(el => el.style.display = 'block');
    document.getElementById('btn-confirm-add').style.display = 'block';
    
    modal.classList.remove('hidden');
};

window.selectFromSuggestion = (index) => {
    suggestionsDropdown.classList.add('hidden');
    document.getElementById('manual-fields').classList.add('hidden');
    selectDisc(index); 
};

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        suggestionsDropdown.classList.add('hidden');
    }
});

function showSearchResultsModal() {
    const details = document.getElementById('disc-details');
    details.innerHTML = `
        <p style="margin-bottom: 1rem;">Selecciona el resultado correcto:</p>
        <div class="search-results-grid">
            ${searchResults.map((res, index) => `
                <div class="search-item" onclick="selectDisc(${index})">
                    <img src="${res.cover_image}" alt="">
                    <div class="search-item-info">
                        <strong>${res.title}</strong>
                        <span>${res.year || 'Año desconocido'} | ${res.country || ''}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    document.getElementById('btn-confirm-add').style.display = 'none';
    document.querySelectorAll('.form-group').forEach(el => el.style.display = 'none');
    modal.classList.remove('hidden');
}
window.showSearchResultsModal = showSearchResultsModal;

window.selectDisc = async (index) => {
    const res = searchResults[index];
    if (!res) return;

    let extraPhotos = [];
    try {
        const detailUrl = res.resource_url;
        const details = await fetchDiscogsResourceDetails(detailUrl);
        if (details.images) {
            extraPhotos = details.images.map(img => img.resource_url);
        }
    } catch (e) {
        console.error("No se pudieron traer fotos extra de Discogs", e);
    }

    const parts = res.title.split(' - ');
    const artist = parts[0] ? parts[0].trim() : 'Unknown Artist';
    const title = parts[1] ? parts[1].trim() : artist;
    
    selectedDisc = {
        title: title,
        artist: artist,
        year: res.year,
        cover: res.cover_image,
        catno: res.catno || (res.barcode ? res.barcode[0] : 'N/A'),
        label: res.label ? res.label[0] : '',
        discogsPhotos: extraPhotos
    };
    
    renderDiscogsPhotosPreview(extraPhotos);
    
    document.getElementById('disc-details').innerHTML = `
        <div class="selection-preview" style="display:flex; gap:1rem; align-items:center; background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; margin-bottom:1rem;">
            <img src="${res.cover_image}" style="width:80px; height:80px; object-fit:cover; border-radius:8px;">
            <div>
                <strong style="display:block; margin-bottom:0.2rem;">${selectedDisc.title}</strong>
                <span style="font-size:0.8rem; opacity:0.7;">${selectedDisc.artist}</span><br>
                <button id="btn-change-selection" class="btn-action btn-edit" style="padding:4px 8px; font-size:0.7rem; margin-top:8px; width:auto;">Cambiar selección</button>
            </div>
        </div>
    `;
    
    // Bind dynamic click safely
    const changeBtn = document.getElementById('btn-change-selection');
    if (changeBtn) changeBtn.addEventListener('click', showSearchResultsModal);
    
    document.getElementById('manual-fields').classList.add('hidden');
    document.querySelectorAll('.form-group').forEach(el => el.style.display = 'block');
    document.getElementById('btn-confirm-add').style.display = 'block';
    
    modal.classList.remove('hidden');
};

function renderDiscogsPhotosPreview(photos) {
    const preview = document.getElementById('photos-preview');
    preview.innerHTML = photos.length > 0 ? '<p style="font-size:0.7rem; opacity:0.5; margin-bottom:5px; grid-column:1/-1;">Fotos heredadas de Discogs:</p>' : '';
    photos.slice(0, 8).forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'photo-thumb';
        img.style.opacity = '0.7';
        preview.appendChild(img);
    });
}

closeModal.onclick = () => modal.classList.add('hidden');

// Manejar fotos cargadas localmente
document.getElementById('input-photos').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    selectedPhotos = [];
    const preview = document.getElementById('photos-preview');
    preview.innerHTML = '<p style="font-size:0.7rem; opacity:0.5;">Procesando imágenes...</p>';

    for (const file of files) {
        try {
            const compressedBase64 = await compressImage(file, 600);
            selectedPhotos.push(compressedBase64);
        } catch (err) {
            console.error("Error comprimiendo:", err);
        }
    }
    renderPhotoPreviews();
});

function renderPhotoPreviews() {
    const preview = document.getElementById('photos-preview');
    preview.innerHTML = '';
    selectedPhotos.forEach(base64 => {
        const img = document.createElement('img');
        img.src = base64;
        img.className = 'photo-thumb';
        preview.appendChild(img);
    });
}

// --- CREACIÓN / MODIFICACIÓN DE DISCO ---
btnConfirmAdd.addEventListener('click', async () => {
    const price = document.getElementById('input-price').value;
    const qty = parseInt(document.getElementById('input-qty').value) || 1;
    const grade = document.getElementById('input-grade').value;
    const gradeCover = document.getElementById('input-grade-cover').value;
    const status = document.getElementById('input-status').value;

    if (!price) return alert("Por favor, pon un precio de venta");

    const finalStatus = (parseFloat(price) <= 0) ? 'borrador' : status;

    const newItem = {
        ...selectedDisc,
        price: parseFloat(price),
        qty,
        grade,
        gradeCover,
        status: finalStatus,
        format: document.getElementById('input-format').value,
        realPhotos: selectedPhotos
    };

    if (finalStatus === 'reservado') {
        newItem.reservedBy = document.getElementById('input-reserved-by').value;
        newItem.reserveDate = document.getElementById('input-reserve-date').value;
        newItem.pickupDate = document.getElementById('input-pickup-date').value;
    }

    if (editingId || selectedDisc.isManual) {
        newItem.title = document.getElementById('input-title').value || selectedDisc.title;
        newItem.artist = document.getElementById('input-artist').value || selectedDisc.artist;
        newItem.label = document.getElementById('input-label').value || selectedDisc.label;
        newItem.year = document.getElementById('input-year').value || selectedDisc.year;
        newItem.catno = document.getElementById('input-catno').value || selectedDisc.catno;
    }
    
    if (selectedPhotos.length > 0) {
        newItem.useFirstPhotoAsCover = true;
    }

    btnConfirmAdd.disabled = true;
    btnConfirmAdd.textContent = 'Guardando...';

    try {
        const success = await saveStockItem(newItem, editingId);
        if (success) {
            modal.classList.add('hidden');
            editingId = null;
            loadStock(true);
            
            inputSearch.value = '';
            document.getElementById('input-photos').value = '';
            document.getElementById('photos-preview').innerHTML = '';
            selectedPhotos = [];
        }
    } catch (err) {
        alert("Error al guardar. Puede que las fotos sean muy grandes.");
    } finally {
        btnConfirmAdd.disabled = false;
        btnConfirmAdd.textContent = editingId ? 'Guardar Cambios' : 'Guardar en Inventario';
    }
});

// --- ACCIONES MASIVAS EN LOTE ---
window.toggleSelect = (id, event) => {
    if (event) event.stopPropagation();
    const stringId = id.toString();
    if (selectedIds.has(stringId)) {
        selectedIds.delete(stringId);
    } else {
        selectedIds.add(stringId);
    }
    updateBulkBar();
    renderStock();
};

function updateBulkBar() {
    if (selectedIds.size > 0) {
        bulkBar.classList.remove('hidden');
        bulkCountText.textContent = `${selectedIds.size} seleccionados`;
    } else {
        bulkBar.classList.add('hidden');
    }
}

window.clearSelection = () => {
    selectedIds.clear();
    updateBulkBar();
    renderStock();
};

btnSelectAll.addEventListener('click', () => {
    const text = filterText.value.toLowerCase();
    const status = filterStatus.value;
    const format = filterFormat.value;

    const currentlyVisible = currentStock.filter(item => {
        const matchText = ((item.title || '') + (item.artist || '')).toLowerCase().includes(text);
        const matchStatus = status === 'todos' || item.status === status;
        const matchFormat = format === 'todos' || item.format === format;
        return matchText && matchStatus && matchFormat;
    });

    const allSelected = currentlyVisible.every(i => selectedIds.has(i.id.toString()));

    if (allSelected) {
        currentlyVisible.forEach(i => selectedIds.delete(i.id.toString()));
    } else {
        currentlyVisible.forEach(i => selectedIds.add(i.id.toString()));
    }
    
    updateBulkBar();
    renderStock();
});

window.bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const isConfirmed = await customConfirm("Borrado Masivo", `¿Estás seguro de que querés borrar ${selectedIds.size} discos permanentemente?`, "Borrar Todo");
    if (isConfirmed) {
        const ids = Array.from(selectedIds);
        logger(`Borrando ${ids.length} discos...`, 'action');
        
        currentStock = currentStock.filter(i => !selectedIds.has(i.id.toString()));
        selectedIds.clear();
        updateBulkBar();
        renderStock();

        try {
            setSyncStatus('syncing');
            let successCount = 0;
            let failCount = 0;

            for (const id of ids) {
                try {
                    await deleteStockItem(id);
                    successCount++;
                } catch (e) {
                    failCount++;
                }
            }

            if (failCount > 0) {
                logger(`Borrado parcial: ${successCount} ok, ${failCount} fallaron.`, 'error');
            } else {
                logger(`¡${successCount} discos borrados con éxito!`, 'success');
            }
            setSyncStatus('synced');
        } catch (err) {
            console.error("Fallo crítico en borrado masivo:", err);
            setSyncStatus('synced');
            loadStock(true);
        }
    }
};

window.bulkSell = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    logger(`Vendiendo ${ids.length} discos...`, 'action');

    currentStock.forEach(item => {
        if (selectedIds.has(item.id.toString())) {
            item.status = 'vendido';
            item.qty = 0;
        }
    });
    const itemsToUpdate = currentStock.filter(i => selectedIds.has(i.id.toString()));
    selectedIds.clear();
    updateBulkBar();
    renderStock();

    try {
        setSyncStatus('syncing');
        for (const item of itemsToUpdate) {
            await sellStockItem(item.id, item);
        }
        logger("Venta masiva completada", 'success');
        setSyncStatus('synced');
    } catch (err) {
        console.error("Fallo la venta masiva:", err);
        setSyncStatus('synced');
        loadStock(true);
    }
};

window.bulkWhatsApp = () => {
    if (selectedIds.size === 0) return;
    const selectedItems = currentStock.filter(i => selectedIds.has(i.id.toString()));
    renderWhatsAppPreview(selectedItems);
    switchSection('whatsapp');
    logger(`Generando catálogo para ${selectedItems.length} discos`, 'action');
};

// --- WHATSAPP MARKETING PREVIEW ---
function updateWAPreview() {
    renderWhatsAppPreview();
}

function renderWhatsAppPreview(customList = null) {
    const waPreview = document.getElementById('wa-preview');
    if (!waPreview) return;

    const items = customList || currentStock.filter(i => (i.status || 'disponible') === 'disponible');
    
    if (items.length === 0) {
        waPreview.innerHTML = '<p style="opacity:0.5; text-align:center; padding:2rem;">No hay discos seleccionados o disponibles.</p>';
        return;
    }

    const text = generateWhatsAppText(items);
    
    waPreview.innerHTML = `
        <div style="background:rgba(0,0,0,0.2); padding:1.5rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
            <pre style="white-space: pre-wrap; font-family: 'Roboto Mono', monospace; font-size:0.9rem; color:#22c55e;">${text}</pre>
        </div>
    `;
}

const sendWaBtn = document.getElementById('btn-send-wa');
if (sendWaBtn) {
    sendWaBtn.addEventListener('click', () => {
        const text = encodeURIComponent(waPreview.innerText);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    });
}

// --- RENDERING DETAIL VIEW HANDLERS ---
window.toggleDetails = (btn) => {
    const card = btn.closest('.card');
    card.classList.toggle('is-expanded');
    btn.textContent = card.classList.contains('is-expanded') ? '🔼 Ocultar detalles' : '👁️ Ver detalles y fotos';
};

window.scrollCarousel = (id, direction) => {
    const el = document.getElementById(id);
    if (!el) return;
    const scrollAmount = el.clientWidth;
    el.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
};

// --- IMPORTADOR MASIVO INTELIGENTE ---
const btnOpenImport = document.getElementById('btn-open-import');
const importModal = document.getElementById('import-modal');
const closeImport = document.getElementById('close-import');
const btnProcessPaste = document.getElementById('btn-process-paste');
const pasteArea = document.getElementById('import-paste-area');
const step1 = document.getElementById('import-step-1');
const step2 = document.getElementById('import-step-2');
const btnStartImport = document.getElementById('btn-start-import');
const importLog = document.getElementById('import-log');

let importData = [];

if (btnOpenImport) btnOpenImport.addEventListener('click', () => importModal.classList.remove('hidden'));
if (closeImport) closeImport.addEventListener('click', () => importModal.classList.add('hidden'));

if (btnProcessPaste) {
    btnProcessPaste.addEventListener('click', () => {
        const text = pasteArea.value.trim();
        if (!text) return alert("Pegá algo de texto primero");

        importData = parseExcelPaste(text);

        if (importData.length === 0) return alert("No se detectaron datos válidos");

        logger(`Analizando ${importData.length} filas del Excel...`, 'action');
        renderImportMappingGrid();
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    });
}

function renderImportMappingGrid() {
    const table = document.getElementById('import-preview-table');
    if (table) {
        table.innerHTML = renderImportTablePreview(importData);
    }
}

if (btnStartImport) {
    btnStartImport.addEventListener('click', async () => {
        const selects = document.querySelectorAll('.map-select');
        const mapping = {};
        selects.forEach(s => {
            if (s.value !== 'skip') mapping[s.value] = parseInt(s.dataset.col);
        });

        const hasBasicInfo = mapping.artist !== undefined && mapping.title !== undefined;
        const hasUrl = mapping.url !== undefined;

        if (!hasBasicInfo && !hasUrl) {
            return alert("Debes asignar al menos (Artista y Título) o el (Link de Discogs)");
        }

        step2.classList.add('hidden');
        document.getElementById('import-progress').classList.remove('hidden');

        await runBulkImport(
            importData, 
            mapping, 
            (curr, tot, txt) => {
                const bar = document.getElementById('import-progress-bar');
                const statusText = document.getElementById('import-status-text');
                const percent = Math.round((curr / tot) * 100);
                bar.style.width = `${percent}%`;
                statusText.innerText = `${txt} (${curr}/${tot})`;
            },
            (msg, type) => {
                const entry = document.createElement('div');
                if (type === 'error') entry.style.color = '#ef4444';
                else if (type === 'warning') entry.style.color = '#fbbf24';
                else entry.style.color = '#22c55e';
                
                entry.style.marginBottom = '2px';
                entry.innerText = msg;
                importLog.prepend(entry);
            }
        );

        loadStock(true);
    });
}

// --- DETECTORES DE FILTROS ---
let filterTimeout;
[filterText, filterStatus, filterSort, filterFormat].forEach(el => {
    if (el) el.addEventListener('input', () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => renderStock(), 300);
    });
});

// --- CARGA INICIAL ---
let isInitialLoadDone = false;
async function loadStock(force = false) {
    if (isInitialLoadDone && !force) return;
    isInitialLoadDone = true;
    logger("Cargando inventario desde el servidor...", 'info');
    try {
        const data = await fetchStockItems();
        currentStock = data;
        logger(`Inventario cargado: ${currentStock.length} discos`, 'success');
        
        try {
            renderStock();
        } catch (renderError) {
            console.error("Error al renderizar los discos:", renderError);
            logger("Error visual al mostrar los discos.", 'error');
        }
    } catch (err) {
        console.error("Error de conexión/carga:", err);
        logger(`No se pudo cargar el inventario: ${err.message}`, 'error');
    }
}

let statusSelect, reservationFields;
function initReservationLogic() {
    statusSelect = document.getElementById('input-status');
    reservationFields = document.getElementById('reservation-fields');
    if (statusSelect && reservationFields) {
        statusSelect.addEventListener('change', (e) => {
            if (e.target.value === 'reservado') {
                reservationFields.classList.remove('hidden');
            } else {
                reservationFields.classList.add('hidden');
            }
        });
    }
}

// Exponer en window para compatibilidad con handlers inline HTML
window.loadStock = loadStock;
window.initReservationLogic = initReservationLogic;

if (!document.getElementById('login-screen')) {
    loadStock();
    initReservationLogic();
} else {
    document.addEventListener('authStateChanged', (e) => {
        currentUser = e.detail.user;
        if (currentUser) {
            loadStock();
            loadUserSettingsData();
            initReservationLogic();
        }
    });
}

// Botón de exportación a Sheets/CSV para inventario
const btnExportExcel = document.getElementById('btn-export-excel');
if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
        exportStockToCSV();
    });
}

function exportStockToCSV() {
    if (!currentStock || currentStock.length === 0) {
        showToast("No tienes vinilos en tu inventario para exportar", "warning");
        return;
    }
    
    function escapeCSVCell(val) {
        if (val === null || val === undefined) return '';
        let str = String(val).replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes(';')) {
            str = `"${str}"`;
        }
        return str;
    }
    
    const headers = ['Artista', 'Título', 'Año', 'Formato', 'Estado Disco', 'Estado Tapa', 'Precio USD', 'Precio UYU', 'Estado Venta', 'Notas', 'Discogs ID'];
    const rows = currentStock.map(item => [
        escapeCSVCell(item.artist || ''),
        escapeCSVCell(item.title || ''),
        escapeCSVCell(item.year || ''),
        escapeCSVCell(item.format || 'Vinyl'),
        escapeCSVCell(item.mediaGrade || item.condition || ''),
        escapeCSVCell(item.sleeveGrade || item.sleeveCondition || ''),
        escapeCSVCell(item.price || 0),
        escapeCSVCell(item.priceUYU || Math.round((item.price || 0) * 40)),
        escapeCSVCell(item.status || 'Disponible'),
        escapeCSVCell(item.notes || ''),
        escapeCSVCell(item.discogsId || '')
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_Vinilos_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
    
    showToast("¡Inventario exportado a CSV para Sheets/Excel!", "success");
}

