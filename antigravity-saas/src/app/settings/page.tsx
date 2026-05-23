'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardShell from '../../components/DashboardShell';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User as UserIcon, 
  Check, 
  Loader2, 
  Upload, 
  Camera, 
  Save, 
  AlertCircle,
  Settings as SettingsIcon,
  Sparkles,
  Music,
  LineChart,
  Cpu,
  Coins,
  Compass,
  ChevronDown,
  Phone,
  MapPin,
  X,
  Trash2
} from 'lucide-react';

const INTERESTS_PRESETS = [
  { id: 'vinyls', label: 'Coleccionismo de Vinilos', icon: Music, desc: 'Gestión y catalogación de discos' },
  { id: 'analytics', label: 'Analíticas y Estadísticas', icon: LineChart, desc: 'Seguimiento del valor de colección' },
  { id: 'automation', label: 'Automatizaciones', icon: Cpu, desc: 'Flujos de trabajo y alertas automáticas' },
  { id: 'finance', label: 'Finanzas & Precios', icon: Coins, desc: 'Historial de compras y valoración' },
  { id: 'community', label: 'Exploración y Comunidad', icon: Compass, desc: 'Compartir colecciones y descubrir música' },
];

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #f43f5e, #fb7185)',
  'linear-gradient(135deg, #6366f1, #a5b4fc)',
  'linear-gradient(135deg, #a855f7, #c084fc)',
  'linear-gradient(135deg, #10b981, #34d399)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
  'linear-gradient(135deg, #3b82f6, #60a5fa)',
];

export default function SettingsPage() {
  const { user, userData, refreshUserData, logout } = useAuth();

  const getUserRole = (ud: typeof userData) => {
    if (!ud) return 'coleccionista';
    if ((ud as any).role) return (ud as any).role;
    return (ud as any).storeName || (ud as any).isPublicStore !== undefined ? 'ambos' : 'coleccionista';
  };
  const isSeller = getUserRole(userData) !== 'coleccionista';

  const [username, setUsername] = useState('');
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [avatarType, setAvatarType] = useState<'preset' | 'upload'>('preset');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [discogsUsername, setDiscogsUsername] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  
  // Store Settings
  const [isPublicStore, setIsPublicStore] = useState(true);
  const [storeName, setStoreName] = useState('');
  const [storeBio, setStoreBio] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeTheme, setStoreTheme] = useState<'midnight' | 'retro-amber' | 'acid-neon' | 'mono-classic'>('midnight');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete Account States
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Pre-populate settings from AuthContext
  useEffect(() => {
    if (userData) {
      setUsername(userData.username || '');
      setDiscogsUsername(userData.discogsUsername || '');
      setCurrency(userData.currency || 'USD');
      setWhatsappPhone(userData.whatsappPhone || '');
      
      setIsPublicStore(userData.isPublicStore ?? false);
      setStoreName(userData.storeName || '');
      setStoreBio(userData.storeBio || '');
      setStoreAddress((userData as any)?.storeAddress || '');
      setStoreTheme((userData as any)?.storeTheme || 'midnight');
      
      if (userData.avatarType === 'upload') {
        setAvatarType('upload');
        setUploadedAvatar(userData.avatar || null);
      } else {
        setAvatarType('preset');
        const idx = GRADIENT_PRESETS.indexOf(userData.avatar || '');
        if (idx !== -1) {
          setSelectedPresetIdx(idx);
        }
      }
      
      setSelectedInterests(userData.interests || []);
    }
  }, [userData]);

  // Username validation
  useEffect(() => {
    if (!userData || !username) return;

    const cleanUsername = username.trim().toLowerCase();

    // If it's the current username, it is available immediately
    if (cleanUsername === userData.username) {
      setIsUsernameAvailable(true);
      setUsernameError(null);
      return;
    }
    
    // Regexp check
    const isValid = /^[a-z0-9_]{3,15}$/.test(cleanUsername);
    if (!isValid) {
      setIsUsernameAvailable(false);
      setUsernameError('El nombre debe tener entre 3 y 15 caracteres (letras, números o guiones bajos).');
      return;
    }

    setUsernameError(null);
    setIsUsernameChecking(true);

    const checkTimeout = setTimeout(async () => {
      try {
        const docRef = doc(db, 'usernames', cleanUsername);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const ownerUid = docSnap.data().uid;
          if (ownerUid === user?.uid) {
            setIsUsernameAvailable(true);
          } else {
            setIsUsernameAvailable(false);
            setUsernameError('Este nombre de usuario ya está reservado.');
          }
        } else {
          setIsUsernameAvailable(true);
        }
      } catch (err) {
        console.error('Error validation username:', err);
      } finally {
        setIsUsernameChecking(false);
      }
    }, 600);

    return () => clearTimeout(checkTimeout);
  }, [username, user, userData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const MAX = 400; // avatar: small square, no need for full res
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.80);
        setUploadedAvatar(compressed);
        setAvatarType('upload');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    if (isUsernameChecking || isUsernameAvailable === false) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const cleanUsername = username.trim().toLowerCase();
    const finalAvatar = avatarType === 'upload' ? uploadedAvatar : GRADIENT_PRESETS[selectedPresetIdx];

    try {
      // 1. If username changed, reserve the new one and remove the old one
      if (cleanUsername !== userData.username) {
        // Reserve new
        await setDoc(doc(db, 'usernames', cleanUsername), {
          uid: user.uid,
          username: cleanUsername,
        });

        // Release old
        if (userData.username) {
          await deleteDoc(doc(db, 'usernames', userData.username));
        }
      }

      // 2. Update user profile document
      await setDoc(doc(db, 'users', user.uid), {
        username: cleanUsername,
        discogsUsername: discogsUsername.trim() || null,
        currency: currency,
        whatsappPhone: whatsappPhone.trim(),
        avatar: finalAvatar,
        avatarType: avatarType,
        interests: selectedInterests,
        isPublicStore: isPublicStore,
        storeName: storeName.trim(),
        storeBio: storeBio.trim(),
        storeAddress: storeAddress.trim() || null,
        storeTheme: storeTheme,
        updatedAt: new Date(),
      }, { merge: true });

      // 3. Refresh context
      await refreshUserData();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setSaveError('Ocurrió un error al guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccountClick = () => {
    setDeleteConfirmUsername('');
    setDeleteError(null);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteAccountConfirm = async () => {
    if (!user || !userData) return;
    if (deleteConfirmUsername !== userData.username) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // 1. Reautenticar con Google para evitar el error 'auth/requires-recent-login'
      try {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      } catch (reauthErr: any) {
        console.error('Error during reauthentication:', reauthErr);
        // Si el usuario cierra el popup o falla, abortar el borrado físico de la base de datos
        setDeleteError('Para eliminar tu cuenta, debes reautenticarte con Google. Por favor intenta de nuevo.');
        setIsDeleting(false);
        return;
      }

      // 2. Delete username reservation
      if (userData.username) {
        try {
          const usernameDocRef = doc(db, 'usernames', userData.username);
          const usernameDocSnap = await getDoc(usernameDocRef);
          if (usernameDocSnap.exists()) {
            await deleteDoc(usernameDocRef);
          }
        } catch (e) {
          console.warn("Fallo al borrar usernames o ya borrado", e);
        }
      }

      // 3. Fetch and delete all stock items
      try {
        const stockRef = collection(db, 'users', user.uid, 'stock');
        const stockSnap = await getDocs(stockRef);
        if (!stockSnap.empty) {
          const batch = writeBatch(db);
          stockSnap.forEach((d) => {
            batch.delete(doc(db, 'users', user.uid, 'stock', d.id));
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn("Fallo al borrar stock o ya borrado", e);
      }

      // 4. Fetch and delete all sales items (if any exist)
      try {
        const salesRef = collection(db, 'users', user.uid, 'sales');
        const salesSnap = await getDocs(salesRef);
        if (!salesSnap.empty) {
          const batch = writeBatch(db);
          salesSnap.forEach((d) => {
            batch.delete(doc(db, 'users', user.uid, 'sales', d.id));
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn("Fallo al borrar sales o ya borrado", e);
      }

      // 5. Delete the main user doc in Firestore
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          await deleteDoc(userDocRef);
        }
      } catch (e) {
        console.warn("Fallo al borrar doc de usuario o ya borrado", e);
      }

      // 6. Delete the authentication user in Firebase Auth
      await user.delete();

      // Cierre de sesión explícito y limpieza de almacenamiento en navegador
      try {
        await logout();
      } catch (e) {
        console.error("Error during logout", e);
      }
      
      try {
        localStorage.clear();
        sessionStorage.clear();
        
        // Limpiar todas las cookies
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      } catch (e) {
        console.error("Error cleaning storage/cookies", e);
      }

      // Redirección física dura a la raíz de la web
      window.location.href = window.location.origin;
    } catch (err: any) {
      console.error('Error deleting account:', err);
      if (err.code === 'auth/requires-recent-login') {
        setDeleteError('Por seguridad, esta acción requiere haber iniciado sesión recientemente. Por favor cierra sesión, vuelve a ingresar e intenta nuevamente.');
      } else {
        setDeleteError('Ocurrió un error al eliminar tu cuenta. Por favor intenta de nuevo.');
      }
      setIsDeleting(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 select-none">
            <SettingsIcon className="w-8 h-8 text-indigo-400" />
            <span>Configuración de Cuenta</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Personaliza tu identidad y tus intereses en VinylStock.
          </p>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1: Info and Avatar */}
          <div className="glass-card rounded-2xl p-6 lg:col-span-1 space-y-6 flex flex-col items-center text-center">
            <div className="relative w-32 h-32 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner bg-slate-900/60 mt-4">
              {avatarType === 'preset' ? (
                <div 
                  className="w-full h-full flex items-center justify-center text-4xl font-bold text-white select-none"
                  style={{ background: GRADIENT_PRESETS[selectedPresetIdx] }}
                >
                  {username ? username.charAt(0).toUpperCase() : 'V'}
                </div>
              ) : (
                uploadedAvatar && (
                  <img src={uploadedAvatar} alt="Uploaded Avatar" className="w-full h-full object-cover" />
                )
              )}
              <div className="absolute bottom-1.5 right-1.5 bg-black/60 p-2 rounded-lg border border-white/10">
                <Camera className="w-4 h-4 text-gray-300" />
              </div>
            </div>

            <div className="w-full space-y-4">
              {/* Presets */}
              <div>
                <span className="text-xs text-gray-400 block mb-2 font-medium">Temas de Avatar</span>
                <div className="flex justify-center gap-2">
                  {GRADIENT_PRESETS.map((grad, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAvatarType('preset');
                        setSelectedPresetIdx(idx);
                      }}
                      className={`w-7 h-7 rounded-full border transition-all ${
                        avatarType === 'preset' && selectedPresetIdx === idx 
                          ? 'border-indigo-400 scale-110 shadow-md shadow-indigo-500/20' 
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ background: grad }}
                    />
                  ))}
                </div>
              </div>

              {/* Upload image button */}
              <div>
                <label className="flex items-center justify-center gap-2 cursor-pointer btn-secondary-premium py-2 px-3 text-xs w-full select-none">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Subir foto de perfil</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Details form */}
          <div className="glass-card rounded-2xl p-6 lg:col-span-2 space-y-6">
            <h3 className="text-lg font-bold text-white mb-2 border-b border-white/5 pb-2">Información del Perfil</h3>
            
            {/* Username Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Nombre de Usuario</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <UserIcon className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="nombre_usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full !pl-10 !pr-10 input-premium font-medium"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  {isUsernameChecking && (
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  )}
                  {!isUsernameChecking && isUsernameAvailable === true && (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
              </div>
              
              <div className="min-h-[20px]">
                {usernameError && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {usernameError}
                  </p>
                )}
                {isUsernameAvailable === true && username !== userData?.username && (
                  <p className="text-emerald-400 text-xs">El nombre de usuario está disponible.</p>
                )}
              </div>
            </div>

            {/* Discogs User Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Usuario de Discogs</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Music className="w-5 h-5 text-indigo-400" />
                </div>
                <input
                  type="text"
                  placeholder="Tu usuario de Discogs"
                  value={discogsUsername}
                  onChange={(e) => setDiscogsUsername(e.target.value)}
                  className="w-full !pl-10 !pr-10 input-premium font-medium"
                />
              </div>
              <p className="text-[10px] text-gray-500">Vincula tu cuenta de Discogs para poder sincronizar tu colección e importar vinilos automáticamente.</p>
            </div>

            {/* Preferencia de Moneda */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Preferencia de Moneda</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Coins className="w-5 h-5 text-indigo-400" />
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full !pl-10 pr-10 input-premium font-medium appearance-none cursor-pointer bg-[#0b0f19]"
                >
                  <option value="USD" className="bg-[#0f172a] text-white">Dólar Estadounidense (USD - $)</option>
                  <option value="EUR" className="bg-[#0f172a] text-white">Euro (EUR - €)</option>
                  <option value="UYU" className="bg-[#0f172a] text-white">Peso Uruguayo (UYU - $ UYU)</option>
                  <option value="ARS" className="bg-[#0f172a] text-white">Peso Argentino (ARS - $ ARS)</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-gray-500">Selecciona la moneda por defecto para mostrar los precios y generar listas de WhatsApp.</p>
            </div>

            {/* Número de WhatsApp */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Número de WhatsApp (Ventas)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Phone className="w-5 h-5 text-indigo-400" />
                </div>
                <input
                  type="text"
                  placeholder="Ej: 5491112345678 (código de país + área + número, sin espacios ni '+')"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full !pl-10 !pr-10 input-premium font-medium"
                />
              </div>
              <p className="text-[10px] text-gray-500">El número con el que los compradores se contactarán contigo al ver tus vinilos públicos. Incluye código internacional (ej. 54 para Argentina, 598 para Uruguay, sin el signo "+").</p>
            </div>

            {/* Tienda Pública Toggle */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Tu Tienda Pública</label>
              
              <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-slate-900/50">
                <div className="pr-4">
                  <h4 className="text-sm font-bold text-white mb-1">Tienda Pública Activada</h4>
                  <p className="text-[10px] text-gray-500">Permite que cualquier persona pueda ver tu stock disponible desde tu enlace de perfil sin iniciar sesión.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={isPublicStore}
                    onChange={(e) => setIsPublicStore(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>

              {isPublicStore && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Nombre de la Tienda (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: Vinyl Club Buenos Aires"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full input-premium font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Descripción o Biografía (Opcional)</label>
                    <textarea
                      placeholder="Ej: Envíos a todo el país. Discos sellados y usados de primera calidad."
                      value={storeBio}
                      onChange={(e) => setStoreBio(e.target.value)}
                      className="w-full input-premium font-medium min-h-[80px] resize-none"
                    />
                  </div>

                  {isSeller && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ubicación Física de la Tienda</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                          <MapPin className="w-4 h-4 text-indigo-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Ej: Sarandi 700, Montevideo, Uruguay"
                          value={storeAddress}
                          onChange={(e) => setStoreAddress(e.target.value)}
                          className="w-full !pl-11 input-premium text-sm font-medium"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500">Se mostrará en tu tienda pública con un mapa de Google Maps.</p>
                    </div>
                  )}

                  {/* Showroom Themes card selector */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Tema del Showroom</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: 'midnight', label: 'Midnight', desc: 'Índigo y Violeta', bg: 'bg-[#030712]', border: 'border-indigo-500/30', accent: 'bg-indigo-500' },
                        { id: 'retro-amber', label: 'Retro Amber', desc: 'Ámbar Vintage', bg: 'bg-[#0b0c10]', border: 'border-amber-500/30', accent: 'bg-amber-500' },
                        { id: 'acid-neon', label: 'Acid Neon', desc: 'Cyberpunk/Lime', bg: 'bg-[#020504]', border: 'border-lime-500/30', accent: 'bg-lime-500' },
                        { id: 'mono-classic', label: 'Mono Classic', desc: 'Slate Elegante', bg: 'bg-[#0f172a]', border: 'border-slate-500/30', accent: 'bg-slate-400' },
                      ].map((themeOpt) => {
                        const isSelected = storeTheme === themeOpt.id;
                        return (
                          <div
                            key={themeOpt.id}
                            onClick={() => setStoreTheme(themeOpt.id as any)}
                            className={`flex flex-col p-3 rounded-xl border cursor-pointer select-none text-left transition-all ${
                              isSelected 
                                ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/50' 
                                : 'bg-[#0b0f19] border-white/5 hover:border-white/10 hover:bg-[#0f1524]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-white">{themeOpt.label}</span>
                              <div className={`w-2.5 h-2.5 rounded-full ${themeOpt.accent}`} />
                            </div>
                            <span className="text-[9px] text-gray-400 leading-none">{themeOpt.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Email Address (disabled representation) */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Correo Electrónico (Google)</label>
              <input
                type="text"
                value={user?.email || ''}
                disabled
                className="w-full input-premium opacity-50 cursor-not-allowed select-all"
              />
              <p className="text-[10px] text-gray-500">Tu dirección de correo electrónico está vinculada a tu cuenta de Google Auth y no se puede modificar.</p>
            </div>

            {/* Interests checklist */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Áreas de Interés</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {INTERESTS_PRESETS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedInterests.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleInterest(item.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                        isSelected 
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-white' 
                          : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form actions and responses */}
            <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                {saveSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>¡Cambios guardados con éxito!</span>
                  </motion.div>
                )}
                {saveError && (
                  <div className="text-red-400 text-sm font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>{saveError}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving || isUsernameChecking || isUsernameAvailable === false}
                className="btn-premium flex items-center justify-center gap-2 py-2.5 px-6 text-sm shrink-0"
              >
                {isSaving ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <Save className="w-4.5 h-4.5" />
                )}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </form>

        {/* Zona de Peligro: Eliminar Cuenta */}
        <div className="mt-8 glass-card rounded-2xl border border-red-500/10 bg-red-950/5 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span>Zona de Peligro: Eliminar Cuenta</span>
              </h3>
              <p className="text-gray-405 text-xs mt-1">
                Esta acción es permanente. Se eliminará tu perfil de usuario, tu nombre de usuario reservado, todo tu stock e historial de ventas. No se puede deshacer.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteAccountClick}
              className="px-5 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold text-xs transition-all whitespace-nowrap self-start sm:self-center"
            >
              Eliminar Cuenta
            </button>
          </div>
        </div>

        {/* MODAL: CONFIRM DELETION */}
        <AnimatePresence>
          {isDeleteConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#0f172a] w-full max-w-md rounded-3xl relative border border-red-500/20 z-10 overflow-hidden shadow-2xl"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/5 relative bg-red-950/10">
                  <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 animate-pulse" />
                    <span>¿Eliminar tu cuenta?</span>
                  </h3>
                  <button 
                    onClick={() => setIsDeleteConfirmOpen(false)}
                    className="absolute right-6 top-6 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Para confirmar que deseas eliminar tu cuenta de forma permanente, por favor escribe tu nombre de usuario <span className="text-red-400 font-bold">@{userData?.username}</span> a continuación:
                  </p>

                  <input
                    type="text"
                    placeholder="Escribe tu nombre de usuario"
                    value={deleteConfirmUsername}
                    onChange={(e) => setDeleteConfirmUsername(e.target.value)}
                    className="w-full input-premium text-sm font-semibold border-red-500/20 focus:border-red-500/50 focus:ring-red-500/50"
                  />

                  {deleteError && (
                    <p className="text-red-400 text-xs font-semibold flex items-center gap-1.5 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{deleteError}</span>
                    </p>
                  )}

                  {/* Buttons */}
                  <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsDeleteConfirmOpen(false)}
                      className="btn-secondary-premium px-4 py-2 text-xs"
                      disabled={isDeleting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccountConfirm}
                      disabled={deleteConfirmUsername !== userData?.username || isDeleting}
                      className="px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-950/40 disabled:text-red-400/50 text-white font-bold transition-all"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Eliminar Permanentemente</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
