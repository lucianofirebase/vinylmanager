// js/api.js - Capa de Servicios de Red y Acceso a API de Firestore y Discogs

export const API_URL = `${window.location.origin}/api`;
export const DISCOGS_KEY = 'kTXBUunaWzBTXwJZlRga';
export const DISCOGS_SECRET = 'uZxBlMTEDrEMcPblPAoQChIrhlZivIwz';

export async function fetchUserSettings() {
    const res = await fetch(`${API_URL}/settings`);
    if (!res.ok) throw new Error(`Settings fetch failed: ${res.status}`);
    return res.json();
}

export async function saveUserSettings(settings) {
    const res = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error(`Settings save failed: ${res.status}`);
    return res.json();
}

export async function fetchStockItems() {
    const res = await fetch(`${API_URL}/stock`);
    if (!res.ok) throw new Error(`Stock fetch failed: ${res.status}`);
    return res.json();
}

export async function saveStockItem(item, editingId = null) {
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_URL}/stock/${editingId}` : `${API_URL}/stock`;
    
    const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error(`Stock save failed: ${res.status}`);
    return res.ok;
}

export async function sellStockItem(id, item) {
    const res = await fetch(`${API_URL}/stock/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error(`Stock sell failed: ${res.status}`);
    return res.ok;
}

export async function deleteStockItem(docId) {
    const res = await fetch(`${API_URL}/stock/${docId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Stock delete failed: ${res.status}`);
    return res.ok;
}

export async function fetchDiscogsCollection(username) {
    const res = await fetch(`https://api.discogs.com/users/${username}/collection/folders/0/releases?per_page=100&sort=added&sort_order=desc`);
    if (!res.ok) throw new Error(`Discogs collection fetch failed: ${res.status}`);
    return res.json();
}

export async function searchDiscogsDatabase(query) {
    const res = await fetch(`https://api.discogs.com/database/search?q=${query}&key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
    if (!res.ok) throw new Error(`Discogs database search failed: ${res.status}`);
    return res.json();
}

export async function searchDiscogsDatabaseWithFormat(query, formatFilter) {
    const res = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&format=${formatFilter}&key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
    if (!res.ok) throw new Error(`Discogs search with format failed: ${res.status}`);
    return res.json();
}

export async function fetchDiscogsResourceDetails(url) {
    const res = await fetch(`${url}?key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
    if (!res.ok) throw new Error(`Discogs details fetch failed: ${res.status}`);
    return res.json();
}

export async function fetchDiscogsReleaseDetails(id) {
    const res = await fetch(`https://api.discogs.com/releases/${id}?key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
    if (!res.ok) throw new Error(`Discogs release detail fetch failed: ${res.status}`);
    return res.json();
}

export async function fetchDiscogsMasterDetails(id) {
    const res = await fetch(`https://api.discogs.com/masters/${id}?key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
    if (!res.ok) throw new Error(`Discogs master detail fetch failed: ${res.status}`);
    return res.json();
}
