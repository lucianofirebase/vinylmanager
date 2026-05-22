'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardShell from '../../components/DashboardShell';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion } from 'framer-motion';
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
  Phone
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
  const { user, userData, refreshUserData } = useAuth();

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

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pre-populate settings from AuthContext
  useEffect(() => {
    if (userData) {
      setUsername(userData.username || '');
      setDiscogsUsername(userData.discogsUsername || '');
      setCurrency(userData.currency || 'USD');
      setWhatsappPhone(userData.whatsappPhone || '');
      
      setIsPublicStore(userData.isPublicStore ?? true);
      setStoreName(userData.storeName || '');
      setStoreBio(userData.storeBio || '');
      
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
      </div>
    </DashboardShell>
  );
}
