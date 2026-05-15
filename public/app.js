// Configuración
let API_URL = `${window.location.origin}/api`;
const DISCOGS_KEY = 'kTXBUunaWzBTXwJZlRga';
const DISCOGS_SECRET = 'uZxBlMTEDrEMcPblPAoQChIrhlZivIwz';

// --- SISTEMA DE FEEDBACK PRO ---
const logger = (msg, type = 'info') => {
    const emoji = { info: '💡', success: '✅', error: '❌', search: '🔍', action: '⚡' };
    const styles = {
        info: 'color: #94a3b8',
        success: 'color: #22c55e; font-weight: bold',
        error: 'color: #ef4444; font-weight: bold',
        search: 'color: #38bdf8',
        action: 'color: #fbbf24'
    };
    console.log(`%c${emoji[type] || '🔔'} ${msg}`, styles[type] || styles.info);
    
    // Si es éxito o error importante, mostramos un Toast (burbuja flotante)
    if (type === 'success' || type === 'error' || type === 'action') {
        showToast(msg, type);
    }
};

function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }, 100);
}

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

logger("Vinyl Manager v2.0 - PRO - Iniciando...", 'info');

let currentStock = [];
let searchResults = [];

// DOM Elements
const stockList = document.getElementById('stock-list');
const btnSearch = document.getElementById('btn-search');
const inputSearch = document.getElementById('discogs-search');
const modal = document.getElementById('disc-modal');
const closeModal = document.querySelector('.close-modal');
const btnConfirmAdd = document.getElementById('btn-confirm-add');
const waPreview = document.getElementById('wa-preview');

let currentViewMode = 'list'; // grid, list, details

// Elementos de Filtro
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
let selectedProfilePic = '';

const PREDEFINED_AVATARS = [
    '💿', '🎧', '🎸', '🎹', '📻', '🎙️', '🎶', '🎷'
];

const filterText = document.getElementById('filter-text');
const filterStatus = document.getElementById('filter-status');
const filterSort = document.getElementById('filter-sort');
const filterFormat = document.getElementById('filter-format');

const DEFAULT_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23334155'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z'/%3E%3C/svg%3E";

let selectedIds = new Set();
const bulkBar = document.getElementById('bulk-actions-bar');
const bulkCountText = document.getElementById('bulk-count');
const btnSelectAll = document.getElementById('btn-select-all');

// Debounce para filtros (Performance Pro)
let filterTimeout;
[filterText, filterStatus, filterSort, filterFormat].forEach(el => {
    if (el) el.addEventListener('input', () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => renderStock(), 300);
    });
});

let currentUser = null;
let discogsUser = '';

// Cargar ajustes y datos de perfil
async function loadUserSettings() {
    if (!currentUser) return;
    
    // Datos de Firebase Auth
    profileEmail.value = currentUser.email;
    profileNameInput.value = currentUser.displayName || '';
    
    // Inicializar Avatares
    renderAvatarSelector();

    try {
        const res = await fetch(`${API_URL}/settings`);
        const settings = await res.json();
        
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
    } catch (e) { console.log("Error cargando ajustes", e); }
}

btnSaveProfile.addEventListener('click', async () => {
    const newName = profileNameInput.value.trim();
    const newDiscogs = profileDiscogsUser.value.trim();

    if (!newName) return alert("El nombre no puede estar vacío");

    try {
        setSyncStatus('syncing');
        // 1. Guardar en Firestore (Ajustes)
        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                discogsUser: newDiscogs,
                displayName: newName,
                photoURL: selectedProfilePic
            })
        });

        discogsUser = newDiscogs;
        
        // 2. Actualizar UI local inmediatamente
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
            } catch (err) { logger("Error al procesar foto", 'error'); }
        }
    });
}

// Lógica de Sincronización
btnSyncDiscogs.addEventListener('click', () => {
    if (!discogsUser) return alert("Primero guarda tu usuario de Discogs arriba ⬆️");
    syncModal.classList.remove('hidden');
    startDiscogsSync();
});

closeSync.addEventListener('click', () => syncModal.classList.add('hidden'));

async function startDiscogsSync() {
    const status = document.getElementById('sync-status');
    const bar = document.getElementById('sync-progress-bar');
    const log = document.getElementById('sync-log');
    log.innerHTML = '';
    bar.style.width = '0%';
    
    status.innerText = `Buscando colección de ${discogsUser}...`;
    
    try {
        // Obtenemos la colección (carpeta 0 = All)
        const res = await fetch(`https://api.discogs.com/users/${discogsUser}/collection/folders/0/releases?per_page=100&sort=added&sort_order=desc`);
        if (!res.ok) throw new Error("No se pudo acceder a la colección. ¿Es pública?");
        
        const data = await res.json();
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
            
            // Check duplicados
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

                await fetch(`${API_URL}/stock`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newItem)
                });
                
                addedCount++;
                addSyncLog(`✅ Agregado: ${info.artists[0].name} - ${info.title}`);
            }

            const percent = Math.round(((i + 1) / total) * 100);
            bar.style.width = `${percent}%`;
            status.innerText = `Procesando ${i + 1} de ${total}...`;
            
            // Anti-RateLimit
            await new Promise(r => setTimeout(r, 500));
        }

        status.innerText = `¡Listo! ${addedCount} nuevos, ${skippedCount} saltados.`;
        loadStock();
    } catch (e) {
        status.innerText = "Error: " + e.message;
    }
}

function addSyncLog(msg, type = 'add') {
    const log = document.getElementById('sync-log');
    const div = document.createElement('div');
    div.style.color = type === 'skip' ? '#94a3b8' : '#22c55e';
    div.innerText = msg;
    log.prepend(div);
}

// --- NAVEGACIÓN ENTRE SECCIONES ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!btn.dataset.section) return;
        
        logger(`Cambiando a sección: ${btn.dataset.section}`, 'action');
        
        // Actualizar nav activo
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Mostrar sección correcta y ocultar el resto
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(`${btn.dataset.section}-section`);
        if (target) target.classList.remove('hidden');
        
        // Si entramos a WhatsApp, generamos la previsualización
        if (btn.id === 'nav-whatsapp') updateWAPreview();
    });
});

// --- SELECTOR DE VISTAS (Grid / List) ---
document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
        logger(`Cambiando modo de vista a: ${btn.dataset.view}`, 'action');
        document.querySelectorAll('.btn-view').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentViewMode = btn.dataset.view;
        renderStock(); // Volvemos a dibujar el inventario con el nuevo estilo
    });
});

// Elementos de reserva (Movidos para evitar conflicto)
let statusSelect, reservationFields;
function initReservationLogic() {
    statusSelect = document.getElementById('input-status');
    reservationFields = document.getElementById('reservation-fields');
    statusSelect.addEventListener('change', (e) => {
        if (e.target.value === 'reservado') {
            reservationFields.classList.remove('hidden');
        } else {
            reservationFields.classList.add('hidden');
        }
    });
}

// --- FUNCIÓN DE CARGA INICIAL ---
// Trae los datos desde nuestra base de datos local (db.json)
let isInitialLoadDone = false;
async function loadStock(force = false) {
    if (isInitialLoadDone && !force) return;
    isInitialLoadDone = true;
    logger("Cargando inventario desde el servidor...", 'info');
    try {
        const res = await fetch(`${API_URL}/stock`);
        if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
        
        currentStock = await res.json();
        logger(`Inventario cargado: ${currentStock.length} discos`, 'success');
        
        try {
            renderStock();
        } catch (renderError) {
            console.error("Error al renderizar los discos:", renderError);
            logger("Error visual al mostrar los discos. Revisá la consola (F12).", 'error');
        }
    } catch (err) {
        console.error("Error de conexión/carga:", err);
        logger(`No se pudo cargar el inventario: ${err.message}`, 'error');
    }
}


// Inventario cargado.

// Debounce function
function debounce(func, timeout = 500) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

const suggestionsDropdown = document.getElementById('search-suggestions');

// --- BÚSQUEDA EN DISCOGS ---
// Busca discos en la API de Discogs según el texto ingresado
async function searchDiscogs(query) {
    if (!query || query.length < 2) {
        suggestionsDropdown.classList.add('hidden');
        return;
    }
    logger(`Buscando en Discogs: "${query}"`, 'search');
    
    try {
        const res = await fetch(`https://api.discogs.com/database/search?q=${query}&key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
        const data = await res.json();
        
        if (data.results) {
            logger(`Se encontraron ${data.results.length} resultados`, 'success');
            searchResults = data.results.slice(0, 8); // Guardamos los primeros 8 resultados
            renderSuggestions(); // Dibujamos la lista
        }
    } catch (err) {
        logger("Error al conectar con Discogs", 'error');
    }
}

const processSearch = debounce((q) => searchDiscogs(q));

inputSearch.addEventListener('input', (e) => {
    processSearch(e.target.value);
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
    
    // Limpiar campos anteriores
    document.getElementById('disc-details').innerHTML = '';
    document.getElementById('input-title').value = '';
    document.getElementById('input-artist').value = '';
    document.getElementById('input-year').value = '';
    document.getElementById('input-catno').value = '';
    
    // Mostrar campos manuales, ocultar los de Discogs
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

btnSearch.addEventListener('click', () => {
    searchDiscogs(inputSearch.value);
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
    // Escondemos el formulario de precio hasta que elijan uno
    document.getElementById('btn-confirm-add').style.display = 'none';
    document.querySelectorAll('.form-group').forEach(el => el.style.display = 'none');
    
    modal.classList.remove('hidden');
}

let selectedDisc = null;

window.selectDisc = async (index) => {
    const res = searchResults[index];
    if (!res) return;

    // Intentamos traer más info y fotos del release específico
    let extraPhotos = [];
    try {
        const detailUrl = res.resource_url;
        const detailRes = await fetch(`${detailUrl}?key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
        if (detailRes.ok) {
            const details = await detailRes.json();
            // Si es un "master", a veces es mejor buscar el primer release, pero por ahora tomamos lo que haya
            if (details.images) {
                extraPhotos = details.images.map(img => img.resource_url);
            } else if (details.videos) {
                // Como extra, si no hay fotos pero hay videos, podríamos avisar, pero nos enfocamos en imágenes
            }
        }
    } catch (e) { console.log("No se pudieron traer fotos extra de Discogs", e); }

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
    
    // Si heredamos fotos, las mostramos como "Fotos de referencia"
    renderDiscogsPhotosPreview(extraPhotos);
    
    document.getElementById('disc-details').innerHTML = `
        <div class="selection-preview" style="display:flex; gap:1rem; align-items:center; background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; margin-bottom:1rem;">
            <img src="${res.cover_image}" style="width:80px; height:80px; object-fit:cover; border-radius:8px;">
            <div>
                <strong style="display:block; margin-bottom:0.2rem;">${selectedDisc.title}</strong>
                <span style="font-size:0.8rem; opacity:0.7;">${selectedDisc.artist}</span><br>
                <button onclick="showSearchResultsModal()" class="btn-action btn-edit" style="padding:4px 8px; font-size:0.7rem; margin-top:8px; width:auto;">Cambiar selección</button>
            </div>
        </div>
    `;
    
    document.getElementById('manual-fields').classList.add('hidden');
    document.querySelectorAll('.form-group').forEach(el => el.style.display = 'block');
    document.getElementById('btn-confirm-add').style.display = 'block';
    
    // Si el modal estaba cerrado (ej: venía del buscador directo), lo abrimos
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

let selectedPhotos = [];

// Manejar selección de fotos con compresión
document.getElementById('input-photos').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    selectedPhotos = [];
    const preview = document.getElementById('photos-preview');
    preview.innerHTML = '<p style="font-size:0.7rem; opacity:0.5;">Procesando imágenes...</p>';

    for (const file of files) {
        try {
            const compressedBase64 = await compressImage(file, 600); // Bajamos a 600px para máxima compatibilidad
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

function compressImage(file, maxWidth) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Bajamos calidad a 0.5 para que pesen muy poco
                resolve(canvas.toDataURL('image/jpeg', 0.5));
            };
        };
        reader.onerror = error => reject(error);
    });
}

// --- RENDERIZADO DEL INVENTARIO ---
// Dibuja todos los discos en el HTML basándose en el stock actual y los filtros
function renderStock() {
    const text = filterText.value.toLowerCase();
    const status = filterStatus.value;
    const sort = filterSort.value;

    console.log("💡 Actualizando vista del inventario...");

    // Aplicamos los filtros de búsqueda y estado
    let filtered = currentStock.filter(item => {
        const title = (item.title || '').toString().toLowerCase();
        const artist = (item.artist || '').toString().toLowerCase();
        
        const matchText = title.includes(text) || artist.includes(text);
        const matchStatus = status === 'todos' || item.status === status;
        const matchFormat = filterFormat.value === 'todos' || item.format === filterFormat.value;
        return matchText && matchStatus && matchFormat;
    });

    // Ordenamiento
    if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    if (sort === 'recent') filtered.sort((a, b) => b.id - a.id);

    // Actualizar contador dinámico
    const countFiltered = document.getElementById('count-filtered');
    const countBadge = document.getElementById('count-total-badge');
    if (countFiltered) countFiltered.textContent = filtered.length;
    if (countBadge) {
        const isFiltered = text || status !== 'todos';
        countBadge.textContent = isFiltered ? `de ${currentStock.length} totales` : '';
    }

    if (filtered.length === 0) {
        stockList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 2rem;">No se encontraron discos con esos filtros.</p>';
        return;
    }

    // Aplicar clase de vista
    stockList.className = `stock-grid view-${currentViewMode}`;

    stockList.innerHTML = filtered.map(item => `
        <div class="card ${selectedIds.has(item.id) ? 'selected' : ''}" id="card-${item.id}">
            ${currentViewMode === 'list' ? `
                <div class="card-selection" onclick="toggleSelect('${item.id}', event)">
                    <div class="checkbox ${selectedIds.has(item.id) ? 'checked' : ''}"></div>
                </div>
            ` : ''}
            <div class="card-image">
                <div class="carousel-container main-card-carousel">
                    <button class="carousel-btn prev" onclick="scrollCarousel('carousel-${item.id}', -1)">❮</button>
                    <div class="real-photos-strip" id="carousel-${item.id}">
                        <img src="${item.cover || DEFAULT_COVER}" alt="${item.title}" loading="lazy" onerror="this.src='${DEFAULT_COVER}'">
                        ${(item.photos || []).map(p => `<img src="${p}" onclick="window.open('${p}', '_blank')" title="Ver foto real">`).join('')}
                        ${(item.discogsPhotos || []).slice(0, 10).map(p => `<img src="${p}" onclick="window.open('${p}', '_blank')" title="Ver foto Discogs" style="opacity:0.8;">`).join('')}
                    </div>
                    <button class="carousel-btn next" onclick="scrollCarousel('carousel-${item.id}', 1)">❯</button>
                </div>
                <span class="badge-status status-${item.status || 'disponible'}">${(item.status || 'disponible').toUpperCase()}</span>
            </div>
            <div class="card-info">
                <h3>${item.title}</h3>
                <p class="artist">${item.artist}</p>
                <p class="meta">${item.year || 'N/A'} | ${item.catno || 'N/A'}</p>
                
                <button class="btn-toggle-details" onclick="toggleDetails(this)">
                    👁️ Ver detalles y fotos
                </button>

                <div class="expanded-info">
                    ${item.status === 'reservado' ? `
                        <div class="reservation-info">
                            <strong>👤 ${item.reservedBy}</strong>
                            <p>📅 Entrega: ${formatDateSpanish(item.pickupDate)}</p>
                        </div>
                    ` : ''}
                    ${item.label ? `<p style="font-size:0.8rem; opacity:0.7; margin-bottom:1rem;">Sello: ${item.label}</p>` : ''}
                    ${item.catno ? `<p style="font-size:0.8rem; opacity:0.5;">Catálogo: ${item.catno}</p>` : ''}
                </div>

                <div class="card-footer">
                    <div style="display:flex; flex-direction:column;">
                        <span class="price">$${item.price || 0} <small style="font-size:0.6rem; opacity:0.5;">UYU</small></span>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <span class="format-badge">${getFormatIcon(item.format)} ${item.format || 'Vinyl'}</span>
                            ${item.qty > 1 ? `<span style="font-size:0.7rem; font-weight:bold; color:var(--accent);">Stock: ${item.qty} u.</span>` : ''}
                        </div>
                    </div>
                    <div class="grade-pill">
                        <span title="Disco">💿 ${item.grade || 'N/A'}</span>
                        <span title="Funda">📁 ${item.gradeCover || item.grade || 'N/A'}</span>
                    </div>
                </div>
            </div> <!-- Cierre card-info -->
            
            <div class="card-actions">
                ${item.status !== 'vendido' ? `<button class="btn-action btn-sell" onclick="sellItem('${item.id}')">💰 Vender</button>` : ''}
                <button class="btn-action btn-edit" onclick="editItem('${item.id}')">✍️ Editar</button>
                <button class="btn-action btn-delete" onclick="deleteItem('${item.id}')">🗑️ Borrar</button>
            </div>
        </div>
    `).join('');
}

let editingId = null;

// --- EDICIÓN DE DISCO ---
// Prepara el formulario para editar un disco existente
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
    
    if (item) {
        document.getElementById('input-price').value = item.price;
        document.getElementById('input-qty').value = item.qty || 1;
        document.getElementById('input-grade').value = item.grade;
        document.getElementById('input-grade-cover').value = item.gradeCover || item.grade;
        document.getElementById('input-status').value = item.status || 'disponible';
    }
    
    // Si estaba reservado, poblar datos
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

// --- REGISTRO DE VENTA ---
// Gestiona la venta de un disco, restando stock o cambiando estado
window.sellItem = async (id) => {
    const item = currentStock.find(i => i.id === id);
    if (!item) return;

    // Actualización optimista: lo marcamos como vendido localmente
    if (item.qty > 1) {
        item.qty -= 1;
    } else {
        item.status = 'vendido';
        item.qty = 0;
    }
    renderStock();

    try {
        const res = await fetch(`${API_URL}/stock/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        // No hace falta loadStock(true) porque ya actualizamos localmente
    } catch (err) { 
        console.error("Error al vender:", err);
        loadStock(true); // Si falla, recargamos para restaurar estado
    }
};

// Borrar disco
window.deleteItem = async (id) => {
    const item = currentStock.find(i => i.id === id);
    if (!item) return;

    if (confirm(`¿Estás seguro de que querés borrar "${item.title}"?`)) {
        logger(`Borrando disco (ID: ${id}): ${item.title}`, 'action');
        
        // Actualización ultra-optimista: buscamos el índice y lo arrancamos del array
        const index = currentStock.findIndex(i => i.id === id);
        if (index > -1) {
            currentStock.splice(index, 1);
            logger(`Disco quitado de la memoria local. Quedan ${currentStock.length}`, 'success');
        }
        
        renderStock();
        
        try {
            await fetch(`${API_URL}/stock/${id}`, {
                method: 'DELETE'
            });
        } catch (err) { 
            console.error("Error al borrar:", err);
            loadStock(true); 
        }
    }
};

// --- ACCIONES MASIVAS ---

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
    const currentlyVisible = currentStock.filter(item => {
        const text = filterText.value.toLowerCase();
        const status = filterStatus.value;
        const format = filterFormat.value;
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
    if (confirm(`¿Estás seguro de que querés borrar ${selectedIds.size} discos?`)) {
        const ids = Array.from(selectedIds);
        logger(`Borrando ${ids.length} discos...`, 'action');
        
        // Optimista
        currentStock = currentStock.filter(i => !selectedIds.has(i.id));
        selectedIds.clear();
        updateBulkBar();
        renderStock();

        try {
            setSyncStatus('syncing');
            let successCount = 0;
            let failCount = 0;

            for (const id of ids) {
                try {
                    const res = await fetch(`${API_URL}/stock/${id}`, { method: 'DELETE' });
                    if (res.ok) successCount++;
                    else failCount++;
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

    // Optimista
    currentStock.forEach(item => {
        if (selectedIds.has(item.id)) {
            item.status = 'vendido';
            item.qty = 0;
        }
    });
    const itemsToUpdate = currentStock.filter(i => selectedIds.has(i.id));
    selectedIds.clear();
    updateBulkBar();
    renderStock();

    try {
        setSyncStatus('syncing');
        for (const item of itemsToUpdate) {
            await fetch(`${API_URL}/stock/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
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
    const selectedItems = currentStock.filter(i => selectedIds.has(i.id));
    renderWhatsAppPreview(selectedItems);
    switchSection('whatsapp');
    logger(`Generando catálogo para ${selectedItems.length} discos`, 'action');
};

// Añadir al Inventario (REPARADO)
btnConfirmAdd.addEventListener('click', async () => {
    const price = document.getElementById('input-price').value;
    const qty = parseInt(document.getElementById('input-qty').value) || 1;
    const grade = document.getElementById('input-grade').value;
    const gradeCover = document.getElementById('input-grade-cover').value;
    const status = document.getElementById('input-status').value;

    if (!price) return alert("Por favor, pon un precio de venta");

    // Regla: precio 0 siempre es borrador
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
        const method = editingId ? 'PUT' : 'POST';
        const url = editingId ? `${API_URL}/stock/${editingId}` : `${API_URL}/stock`;
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
        });

        if(res.ok) {
            modal.classList.add('hidden');
            editingId = null;
            loadStock(true);
            // Resetear UI
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

// Eliminar item
async function deleteItem(id) {
    if(!confirm("¿Borrar este disco?")) return;
    const item = currentStock.find(i => i.id == id);
    const docId = item._docId || id;
    await fetch(`${API_URL}/stock/${docId}`, { method: 'DELETE' });
    loadStock();
}

function getFormatIcon(format) {
    if (format === 'CD') return '💿';
    if (format === 'Cassette') return '📼';
    return '💿';
}

// Traductor de fechas para humanos
function formatDateSpanish(dateStr) {
    if (!dateStr) return 'Sin fecha';
    try {
        const date = new Date(dateStr + 'T12:00:00'); // Mediodía para evitar problemas de zona horaria
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        let formatted = date.toLocaleDateString('es-ES', options);
        return "el " + formatted;
    } catch (e) { return dateStr; }
}

// Traductor de estados para WhatsApp
function getGradeText(grade, isCover = false) {
    const prefix = isCover ? "Tapa " : "Disco ";
    const mapping = {
        'MINT': isCover ? 'Sellado' : 'Nuevo / Sellado',
        'NM': isCover ? 'Excelente (Como nuevo)' : 'igual a nuevo!!',
        'VG+': isCover ? 'Excelente' : 'Excelente',
        'VG': isCover ? 'Muy buena' : 'Muy bueno',
        'G+': isCover ? 'Buena+' : 'Bueno+',
        'G': isCover ? 'Buena' : 'Bueno',
        'F': 'Regular',
        'P': 'Pobre'
    };
    return prefix + (mapping[grade] || grade);
}

// WhatsApp Logic (Formato Profesional)
function renderWhatsAppPreview(customList = null) {
    const waPreview = document.getElementById('wa-preview');
    if (!waPreview) return;

    let text = "🔥 *NUEVA TANDA - DISPONIBLES* 🔥\n\n";
    const items = customList || currentStock.filter(i => (i.status || 'disponible') === 'disponible');
    
    if (items.length === 0) {
        waPreview.innerHTML = '<p style="opacity:0.5; text-align:center; padding:2rem;">No hay discos seleccionados o disponibles.</p>';
        return;
    }

    let totalBatch = 0;
    items.forEach(item => {
        const title = (item.title || 'Título Desconocido').toString().toUpperCase();
        const artist = (item.artist || 'Artista Desconocido').toString();
        const price = item.price || 0;
        const format = item.format || 'Vinyl';
        const formatIcon = getFormatIcon(format);
        totalBatch += Number(price);
        
        text += `${formatIcon} *${title}*\n`;
        text += `👤 ${artist}\n`;
        if (item.label) text += `🏷️ ${item.label}\n`;
        
        const gMedia = getGradeText(item.grade || 'VG+');
        const gCover = getGradeText(item.gradeCover || item.grade || 'VG+', true);
        text += `📀 Disco: ${gMedia} | 📁 Tapa: ${gCover}\n`;
        
        const photoInfo = (item.photos && item.photos.length > 0) || (item.discogsPhotos && item.discogsPhotos.length > 0) ? " 📸 *(Pide fotos)*" : "";
        text += `💰 *$${price}*${photoInfo}\n\n`;
        text += `--------------------------\n\n`;
    });

    text += "✨ ¡Escríbeme para reservar el tuyo!\n";
    text += "🚚 Envíos a todo el país.";
    
    waPreview.innerHTML = `<div style="background:rgba(0,0,0,0.2); padding:1.5rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
        <pre style="white-space: pre-wrap; font-family: 'Roboto Mono', monospace; font-size:0.9rem; color:#22c55e;">${text}</pre>
    </div>`;
}

window.toggleDetails = (btn) => {
    const card = btn.closest('.card');
    card.classList.toggle('is-expanded');
    btn.textContent = card.classList.contains('is-expanded') ? '🔼 Ocultar detalles' : '👁️ Ver detalles y fotos';
};

window.scrollCarousel = (id, direction) => {
    const el = document.getElementById(id);
    const scrollAmount = el.clientWidth;
    el.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
};

document.getElementById('btn-send-wa').addEventListener('click', () => {
    const text = encodeURIComponent(waPreview.innerText);
    window.open(`https://wa.me/?text=${text}`, '_blank');
});

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

let importData = []; // Filas procesadas del pegado

// Abrir/Cerrar Modal
btnOpenImport.addEventListener('click', () => importModal.classList.remove('hidden'));
closeImport.addEventListener('click', () => importModal.classList.add('hidden'));

// Procesar el pegado inicial
btnProcessPaste.addEventListener('click', () => {
    const text = pasteArea.value.trim();
    if (!text) return alert("Pegá algo de texto primero");

    const lines = text.split('\n');
    importData = lines.map(line => line.split('\t')); // Excel usa tabulaciones al copiar

    if (importData.length === 0) return alert("No se detectaron datos válidos");

    logger(`Analizando ${importData.length} filas del Excel...`, 'action');
    renderImportMapping();
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
});

// Dibujar tabla de mapeo
function renderImportMapping() {
    const table = document.getElementById('import-preview-table');
    const firstRow = importData[0];
    
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
    table.innerHTML = html;
}

// Iniciar importación masiva
btnStartImport.addEventListener('click', async () => {
    const selects = document.querySelectorAll('.map-select');
    const mapping = {};
    selects.forEach(s => {
        if (s.value !== 'skip') mapping[s.value] = parseInt(s.dataset.col);
    });

    // Validación: Necesitamos o (Artista + Título) o el Link de Discogs
    const hasBasicInfo = mapping.artist !== undefined && mapping.title !== undefined;
    const hasUrl = mapping.url !== undefined;

    if (!hasBasicInfo && !hasUrl) {
        return alert("Debes asignar al menos (Artista y Título) o el (Link de Discogs)");
    }

    step2.classList.add('hidden');
    document.getElementById('import-progress').classList.remove('hidden');
    
    const total = importData.length;
    let processed = 0;

    for (let i = 0; i < total; i++) {
        const row = importData[i];
        const artist = row[mapping.artist]?.trim() || 'Desconocido';
        const title = row[mapping.title]?.trim() || 'Desconocido';
        const url = row[mapping.url]?.trim() || '';
        const price = parseFloat(row[mapping.price]) || 0;
        const qty = parseInt(row[mapping.qty]) || 1;
        const grade = row[mapping.grade]?.trim() || 'VG+';

        processed++;
        updateImportProgress(processed, total, `Procesando: ${artist} - ${title}`);

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
                        const res = await fetch(`https://api.discogs.com/${type}/${id}?key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
                        if (res.ok) {
                            const details = await res.json();
                            itemData = {
                                artist: details.artists ? details.artists[0].name : (urlArtist || artist),
                                title: details.title || (urlTitle || title),
                                cover: details.images ? details.images[0].resource_url : '',
                                year: details.year || '',
                                label: details.labels ? details.labels[0].name : '',
                                catno: details.labels ? details.labels[0].catno : ''
                            };
                        }
                    } catch (e) { logger(`Fallo fetch directo para ${id}`, 'error'); }
                }
            }

            // SI NO HAY URL o falló la API: Buscamos por texto o usamos el backup de la URL
            if (!itemData) {
                const searchName = `${artist} ${title}`;
                const formatFilter = row[mapping.format] || 'Vinyl';

                if (artist !== 'Desconocido' && title !== 'Desconocido') {
                    const searchRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(searchName)}&format=${formatFilter}&key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
                    const searchData = await searchRes.json();
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

            await fetch(`${API_URL}/stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });

            if (itemData.cover) {
                addLog(`✅ Importado: ${newItem.artist} - ${newItem.title} (${newItem.format})`);
            } else {
                addLog(`⚠️ Manual (no en Discogs): ${newItem.artist} - ${newItem.title} (${newItem.format})`, 'warning');
            }
        } catch (err) {
            addLog(`❌ Error en: ${artist} - ${title}`, 'error');
        }

        // Espera de 1.5 segundos para no saturar la API de Discogs
        await new Promise(r => setTimeout(r, 1500));
    }

    updateImportProgress(total, total, "¡Importación finalizada!");
    loadStock();
});

function updateImportProgress(current, total, text) {
    const bar = document.getElementById('import-progress-bar');
    const statusText = document.getElementById('import-status-text');
    const percent = Math.round((current / total) * 100);
    bar.style.width = `${percent}%`;
    statusText.innerText = `${text} (${current}/${total})`;
}

function addLog(msg, type = 'success') {
    const entry = document.createElement('div');
    if (type === 'error') entry.style.color = '#ef4444';
    else if (type === 'warning') entry.style.color = '#fbbf24';
    else entry.style.color = '#22c55e';
    
    entry.style.marginBottom = '2px';
    entry.innerText = msg;
    importLog.prepend(entry);
}

// Exponer globalmente para que firebase-init.js la llame tras login
window.loadStock = loadStock;
window.initReservationLogic = initReservationLogic;

// Solo auto-iniciar si NO hay pantalla de login (modo legacy sin Firebase)
if (!document.getElementById('login-screen')) {
    loadStock();
    initReservationLogic();
} else {
    // Si hay Firebase, esperamos al login
    document.addEventListener('authStateChanged', (e) => {
        currentUser = e.detail.user;
        if (currentUser) {
            loadStock();
            loadUserSettings();
            initReservationLogic();
        }
    });
}


