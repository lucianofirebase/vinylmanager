// firebase-init.js - Versión REST (Bypass AdBlock)
// Inicializa Firebase Auth para el login, pero usa fetch estándar para los datos.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

let currentUid = null;

// ------ Helpers REST API (Bypass AdBlock) ------

function unwrapFirestore(doc) {
    const fields = doc.fields || {};
    const item = { id: doc.name.split('/').pop() };
    for (const key in fields) {
        const val = fields[key];
        if (val.stringValue !== undefined) item[key] = val.stringValue;
        else if (val.doubleValue !== undefined) item[key] = parseFloat(val.doubleValue);
        else if (val.integerValue !== undefined) item[key] = parseInt(val.integerValue);
        else if (val.booleanValue !== undefined) item[key] = val.booleanValue;
        else if (val.arrayValue) {
            item[key] = val.arrayValue.values ? val.arrayValue.values.map(v => v.stringValue || v.integerValue || v.doubleValue) : [];
        }
    }
    return item;
}

function wrapFirestore(item) {
    const fields = {};
    for (const key in item) {
        if (key === 'id') continue;
        const val = item[key];
        if (Array.isArray(val)) {
            fields[key] = { arrayValue: { values: val.map(v => ({ stringValue: String(v) })) } };
        } else if (typeof val === 'number') {
            if (Number.isInteger(val) && key !== 'price') fields[key] = { integerValue: val };
            else fields[key] = { doubleValue: val };
        } else if (typeof val === 'boolean') {
            fields[key] = { booleanValue: val };
        } else {
            fields[key] = { stringValue: String(val || '') };
        }
    }
    return { fields };
}

async function fsLoadStock(uid) {
    // Añadimos pageSize=1000 para traer todo y un timestamp para evitar la caché del navegador
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${uid}/stock?pageSize=1000&key=${FIREBASE_CONFIG.apiKey}&t=${Date.now()}`;
    try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.documents || []).map(unwrapFirestore);
    } catch (err) {
        console.error("Error cargando stock:", err);
        return [];
    }
}

async function fsAddItem(uid, item) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${uid}/stock?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wrapFirestore(item))
    });
    const doc = await res.json();
    return unwrapFirestore(doc);
}

async function fsUpdateItem(uid, docId, item) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${uid}/stock/${docId}?key=${FIREBASE_CONFIG.apiKey}`;
    await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wrapFirestore(item))
    });
}

async function fsDeleteItem(uid, docId) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${uid}/stock/${docId}?key=${FIREBASE_CONFIG.apiKey}`;
    await fetch(url, { method: 'DELETE' });
}

// ------ Override fetch (Misma lógica pero llamando a las funciones REST) ------
const originalFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
    if (typeof url !== 'string') return originalFetch(url, options);

    if (url.includes('/api/settings')) {
        const settingsUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${currentUid}/settings/main?key=${FIREBASE_CONFIG.apiKey}`;
        if (options.method === 'POST') {
            const body = JSON.parse(options.body);
            await originalFetch(settingsUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wrapFirestore(body))
            });
            return new Response(JSON.stringify(body));
        } else {
            const res = await originalFetch(settingsUrl);
            if (res.status === 404) return new Response(JSON.stringify({}));
            const doc = await res.json();
            return new Response(JSON.stringify(unwrapFirestore(doc)));
        }
    }

    if (!url.includes('/api/stock')) {
        return originalFetch(url, options);
    }
    if (!currentUid) throw new Error('No hay usuario autenticado');

    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    const urlParts = url.split('/');
    const docId = urlParts[urlParts.length - 1] !== 'stock' ? urlParts[urlParts.length - 1] : null;

    try {
        if (method === 'GET') {
            const items = await fsLoadStock(currentUid);
            return new Response(JSON.stringify(items), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'POST') {
            const saved = await fsAddItem(currentUid, body);
            return new Response(JSON.stringify(saved), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'PUT' && docId) {
            await fsUpdateItem(currentUid, docId, body);
            return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'DELETE' && docId) {
            await fsDeleteItem(currentUid, docId);
            return new Response(null, { status: 204 });
        }
    } catch (err) {
        console.error("Error en operación Firestore:", err);
        return new Response(JSON.stringify({error: err.message}), { status: 500 });
    }
    return originalFetch(url, options);
};

// ------ UI Auth & State ------
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const btnLogin = document.getElementById('btn-google-login');
const btnLogout = document.getElementById('btn-logout');

btnLogin.addEventListener('click', () => signInWithPopup(auth, provider));
btnLogout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUid = user.uid;
        console.log('%c🔑 UID:', 'color:#38bdf8;font-weight:bold', user.uid);
        
        document.getElementById('user-name').textContent = user.displayName || 'Usuario';
        document.getElementById('user-avatar').src = user.photoURL || '';
        document.getElementById('user-role').textContent = (user.uid === ADMIN_UID) ? '👑 Administrador' : '🎵 Vendedor';

        loginScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        
        // Despachamos evento para app.js
        document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user } }));
    } else {
        currentUid = null;
        document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null } }));
        loginScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
});
