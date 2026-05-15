// auth.js - Capa de autenticación y base de datos Firebase

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, setDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// ---- AUTH ----
export function getCurrentUser() { return currentUser; }
export function isAdmin() { return currentUser && currentUser.uid === ADMIN_UID; }

export async function loginWithGoogle() {
    return signInWithPopup(auth, provider);
}

export async function logout() {
    return signOut(auth);
}

export function onAuthReady(callback) {
    onAuthStateChanged(auth, user => {
        currentUser = user;
        callback(user);
    });
}

// ---- FIRESTORE CRUD ----
function stockRef(uid) {
    return collection(db, "users", uid, "stock");
}

export async function fetchStock(uid) {
    const q = query(stockRef(uid), orderBy("dateAdded", "desc"));
    const snap = await getDocs(q).catch(async () => getDocs(stockRef(uid)));
    return snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
}

export async function addStockItem(uid, item) {
    item.dateAdded = item.dateAdded || new Date().toISOString();
    const ref = await addDoc(stockRef(uid), item);
    return { ...item, _docId: ref.id };
}

export async function updateStockItem(uid, docId, item) {
    const ref = doc(db, "users", uid, "stock", docId);
    await updateDoc(ref, item);
}

export async function deleteStockItem(uid, docId) {
    const ref = doc(db, "users", uid, "stock", docId);
    await deleteDoc(ref);
}
