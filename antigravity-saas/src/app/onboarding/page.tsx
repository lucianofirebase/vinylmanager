'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  ChevronRight, 
  ChevronLeft, 
  User as UserIcon, 
  Sparkles, 
  Check, 
  Upload, 
  Camera, 
  Loader2,
  Music,
  AlertCircle,
  Disc,
  RefreshCw,
  Phone,
  ChevronDown,
  Store,
  Headphones,
  ShoppingBag,
  MapPin,
  Coins
} from 'lucide-react';



const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #f43f5e, #fb7185)',
  'linear-gradient(135deg, #6366f1, #a5b4fc)',
  'linear-gradient(135deg, #a855f7, #c084fc)',
  'linear-gradient(135deg, #10b981, #34d399)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
  'linear-gradient(135deg, #3b82f6, #60a5fa)',
];

export default function OnboardingPage() {
  const { user, userData, refreshUserData } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  // Role selection
  const [userRole, setUserRole] = useState<'vendedor' | 'coleccionista' | 'ambos' | null>(null);
  const isSeller = userRole === 'vendedor' || userRole === 'ambos';

  // Total steps depends on role: collectors skip showroom config step
  // Steps: 1=welcome, 2=role, 3=username(+store if seller), 4=avatar, 5=showroom(seller)/discogs(collector), 6=discogs(seller)
  const TOTAL_STEPS = isSeller ? 6 : 5;

  // Form states
  const [username, setUsername] = useState('');
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [avatarType, setAvatarType] = useState<'preset' | 'upload'>('preset');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);
  const [discogsUsername, setDiscogsUsername] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeBio, setStoreBio] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [isPublicStore, setIsPublicStore] = useState(true);
  const [hasPhysicalStore, setHasPhysicalStore] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const [storeAddress, setStoreAddress] = useState('');

  // Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, status: '' });
  const [syncDone, setSyncDone] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Ref for Wake Lock to keep screen awake on mobile
  const wakeLockRef = React.useRef<any>(null);

  const requestWakeLock = async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock active');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Screen Wake Lock released');
      } catch (err) {
        console.warn('Wake Lock release failed:', err);
      }
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && (isSyncing || isSubmitting)) {
        await requestWakeLock();
      }
    };

    if (isSyncing || isSubmitting) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch((e: any) => console.warn(e));
      }
    };
  }, [isSyncing, isSubmitting]);

  // Prefill username if possible
  useEffect(() => {
    if (user?.displayName && !username) {
      const generated = user.displayName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 15);
      setUsername(generated);
    }
  }, [user]);

  // Username validation debounced
  useEffect(() => {
    if (step !== 3 || !username) {
      setIsUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    
    // Regexp check
    const isValid = /^[a-z0-9_]{3,15}$/.test(cleanUsername);
    if (!isValid) {
      setIsUsernameAvailable(false);
      setUsernameError('El nombre debe tener entre 3 y 15 caracteres y solo letras, números o guiones bajos.');
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
            setUsernameError('Este nombre de usuario ya está en uso.');
          }
        } else {
          setIsUsernameAvailable(true);
        }
      } catch (err) {
        console.error('Error comprobando nombre de usuario:', err);
      } finally {
        setIsUsernameChecking(false);
      }
    }, 600);

    return () => clearTimeout(checkTimeout);
  }, [username, step, user]);

  const handleNext = () => {
    // Step 2: role must be selected
    if (step === 2 && !userRole) return;
    // Step 3: username must be valid
    if (step === 3 && (!isUsernameAvailable || isUsernameChecking)) return;

    // Auto-fill defaults for Store Name / Bio when seller advances past step 3
    if (step === 3 && isSeller) {
      if (!storeName.trim()) setStoreName(`Tienda de ${username}`);
      if (!storeBio.trim()) setStoreBio('¡Bienvenido a mi showroom de vinilos!');
    }

    setDirection(1);
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setDirection(-1);
    setStep((prev) => prev - 1);
  };

  // Sync logic
  const handleSyncDiscogs = async () => {
    if (!user || !discogsUsername.trim()) return;

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0, status: `Buscando colección de @${discogsUsername}...` });

    // Activar bloqueo de suspensión de pantalla
    await requestWakeLock();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos de tiempo de espera

    try {
      const res = await fetch(
        `https://api.discogs.com/users/${discogsUsername.trim()}/collection/folders/0/releases?per_page=100&sort=added&sort_order=desc`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error("No se pudo acceder a tu colección. ¿Es pública?");
      }

      const data = await res.json();
      const releases = data.releases || [];
      const total = releases.length;

      if (total === 0) {
        setSyncProgress({ current: 0, total: 0, status: 'La colección está vacía o no tiene álbumes públicos.' });
        setIsSyncing(false);
        setSyncDone(true);
        await releaseWakeLock();
        return;
      }

      setSyncProgress({ current: 0, total, status: 'Importando...' });

      let addedCount = 0;

      for (let i = 0; i < releases.length; i++) {
        const rel = releases[i];
        const info = rel.basic_information;

        const newItem = {
          artist: info.artists[0]?.name || 'Unknown',
          title: info.title || 'Unknown',
          label: info.labels && info.labels.length > 0 ? info.labels[0].name : '',
          year: info.year ? info.year.toString() : '',
          catno: info.labels && info.labels.length > 0 ? info.labels[0].catno : '',
          cover: info.cover_image || '',
          format: info.formats && info.formats.length > 0 ? info.formats[0].name : 'Vinyl',
          price: 0,
          qty: 1,
          grade: 'VG+',
          gradeCover: 'VG+',
          status: 'coleccion',
          dateAdded: new Date().toISOString(),
          discogsId: rel.id,
          url: `https://www.discogs.com/release/${rel.id}`,
          genres: info.genres || [],
          styles: info.styles || []
        };

        const stockCol = collection(db, 'users', user.uid, 'stock');
        await addDoc(stockCol, newItem);

        addedCount++;

        const remainingItems = total - (i + 1);
        const estSec = Math.round(remainingItems * 0.9);
        const mins = Math.floor(estSec / 60);
        const secs = estSec % 60;
        const timeStr = estSec > 0 ? (mins > 0 ? ` (~${mins}m ${secs}s restantes)` : ` (~${secs}s restantes)`) : '';

        setSyncProgress({ 
          current: i + 1, 
          total, 
          status: `Guardando ${i + 1} de ${total}...${timeStr}` 
        });

        // Throttle - Aumentamos el delay a 800ms para evitar límites de la API de Discogs y mostrar el progreso
        await new Promise((r) => setTimeout(r, 800));
      }

      setSyncProgress({ 
        current: total, 
        total, 
        status: `¡Listo! ${addedCount} discos sincronizados.` 
      });
      setSyncDone(true);
    } catch (err: any) {
      console.error(err);
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setSyncProgress({ current: 0, total: 0, status: 'Tiempo de espera agotado al conectar con Discogs (15s).' });
      } else {
        setSyncProgress({ current: 0, total: 0, status: `Error: ${err.message || 'No se pudo sincronizar.'}` });
      }
    } finally {
      setIsSyncing(false);
      await releaseWakeLock();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('La imagen es demasiado grande. El límite es de 10MB.');
      return;
    }
    setAvatarError(null);

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const MAX = 400; // avatar: small square, no need for full res
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.80);
          setUploadedAvatar(compressed);
          setAvatarType('upload');
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };



  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const cleanUsername = username.trim().toLowerCase();
    const finalAvatar = avatarType === 'upload' ? uploadedAvatar : GRADIENT_PRESETS[selectedPresetIdx];

    try {
      // 1. Guardar y reservar el nombre de usuario
      await setDoc(doc(db, 'usernames', cleanUsername), {
        uid: user.uid,
        username: cleanUsername,
      });

      // 2. Actualizar perfil de usuario
      await setDoc(doc(db, 'users', user.uid), {
        username: cleanUsername,
        avatar: finalAvatar,
        avatarType: avatarType,
        discogsUsername: discogsUsername.trim() || null,
        role: userRole || 'coleccionista',
        // Seller-specific fields (empty for pure collectors)
        currency: isSeller ? currency : 'USD',
        whatsappPhone: isSeller ? (whatsappPhone.trim() || null) : null,
        isPublicStore: isSeller ? isPublicStore : false,
        storeName: isSeller ? (storeName.trim() || `Tienda de ${cleanUsername}`) : null,
        storeBio: isSeller ? (storeBio.trim() || '¡Bienvenido a mi showroom de vinilos!') : null,
        storeAddress: (isSeller && hasPhysicalStore) ? (storeAddress.trim() || null) : null,
        onboardingComplete: true,
        tutorialCompleted: false,
        updatedAt: new Date(),
      }, { merge: true });

      // 3. Forzar refresco
      await refreshUserData();

      // 4. Redirigir al dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error al finalizar onboarding:', err);
      setSubmitError(err.message || 'Hubo un error al guardar tu perfil. Por favor, vuelve a intentarlo.');
      setIsSubmitting(false);
    }
  };

  // Slides animation config
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 100 : -100,
      opacity: 0
    })
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#030712] overflow-hidden bg-grid-pattern py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Floating Orbs */}
      <div className="absolute top-10 left-10 w-80 h-80 rounded-full bg-indigo-500/10 blur-[90px] animate-orb-slow-1 pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-purple-500/10 blur-[110px] animate-orb-slow-2 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-xl z-10 flex flex-col items-center">
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-800/40 h-1.5 rounded-full mb-8 overflow-hidden border border-white/5">
          <motion.div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Wizard Card */}
        <div className="w-full glass-card rounded-3xl p-8 sm:p-10 relative overflow-hidden min-h-[460px] flex flex-col justify-between">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

          {isSubmitting && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center rounded-3xl p-8">
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-6" />
              <h3 className="text-2xl font-bold text-white mb-2">Configurando tu entorno...</h3>
              <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                Estamos personalizando tu experiencia VinylStock y guardando tus datos en la base de datos.
              </p>
            </div>
          )}
          
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, cubicBezier: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              {/* STEP 1: WELCOME SCREEN */}
              {step === 1 && (
                <div className="flex flex-col items-center text-center justify-center flex-1 py-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
                    <Sparkles className="w-8 h-8 animate-pulse" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">
                    ¡Te damos la bienvenida a VinylStock!
                  </h2>
                  <p className="text-gray-400 max-w-sm text-base leading-relaxed mb-6">
                    Comencemos a personalizar tu nuevo centro de control. Solo tomará un par de minutos configurar tu perfil único.
                  </p>
                  <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-200/90 text-sm max-w-md">
                    Tu correo <strong className="text-white">{user?.email}</strong> ya está verificado y listo.
                  </div>
                </div>
              )}

              {/* STEP 2: SELECCIÓN DE ROL */}
              {step === 2 && (
                <div className="flex flex-col flex-1 py-2 space-y-5">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">¿Cómo vas a usar VinylStock?</h3>
                    <p className="text-gray-400 text-xs">
                      Esto nos ayuda a mostrarte solo lo que necesitás. Podés cambiarlo después desde tu configuración.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        id: 'vendedor' as const,
                        icon: Store,
                        title: 'Vendedor',
                        desc: 'Quiero vender mis discos y gestionar mi tienda con precios, stock y catálogo público.',
                        accent: 'indigo',
                      },
                      {
                        id: 'coleccionista' as const,
                        icon: Headphones,
                        title: 'Coleccionista',
                        desc: 'Quiero organizar y catalogar mi colección personal. Sin tienda por ahora.',
                        accent: 'purple',
                      },
                      {
                        id: 'ambos' as const,
                        icon: ShoppingBag,
                        title: 'Vendedor + Coleccionista',
                        desc: 'Tengo discos para vender y también una colección personal que gestionar.',
                        accent: 'emerald',
                      },
                    ].map(({ id, icon: Icon, title, desc, accent }) => {
                      const isSelected = userRole === id;
                      const colors: Record<string, string> = {
                        indigo: isSelected ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-white/5 bg-white/3 hover:border-indigo-500/30 hover:bg-indigo-500/5',
                        purple: isSelected ? 'border-purple-500/60 bg-purple-500/10' : 'border-white/5 bg-white/3 hover:border-purple-500/30 hover:bg-purple-500/5',
                        emerald: isSelected ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/5 bg-white/3 hover:border-emerald-500/30 hover:bg-emerald-500/5',
                      };
                      const iconColors: Record<string, string> = {
                        indigo: isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-400',
                        purple: isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-400',
                        emerald: isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-gray-400',
                      };
                      return (
                        <div
                          key={id}
                          onClick={() => setUserRole(id)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer select-none transition-all duration-200 ${colors[accent]}`}
                        >
                          <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${iconColors[accent]}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">{title}</div>
                            <div className="text-[10px] text-gray-400 leading-relaxed mt-0.5">{desc}</div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: USERNAME + STORE NAME (conditional) */}
              {step === 3 && (
                <div className="flex flex-col flex-1 py-2 space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Tu Identidad en VinylStock</h3>
                    <p className="text-gray-400 text-xs">
                      {isSeller
                        ? 'Elegí tu nombre de usuario y personalizá cómo se verá tu tienda.'
                        : 'Elegí tu nombre de usuario único para acceder a tu colección.'}
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
                    {/* Username input */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Nombre de Usuario (Único)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="ej: mi_tienda_discos"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className="w-full !pl-11 !pr-12 input-premium text-sm font-medium"
                          autoFocus
                        />
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          {isUsernameChecking && (
                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                          )}
                          {!isUsernameChecking && isUsernameAvailable === true && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                          {!isUsernameChecking && isUsernameAvailable === false && (
                            <span className="text-red-400 text-xs font-bold">En uso</span>
                          )}
                        </div>
                      </div>
                      <div className="min-h-[16px]">
                        {usernameError && (
                          <p className="text-red-400 text-[10px] flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {usernameError}
                          </p>
                        )}
                        {!isUsernameChecking && isUsernameAvailable === true && (
                          <p className="text-emerald-400 text-[10px] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            ¡Excelente! El nombre de usuario está disponible.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Store Name + Bio — only for sellers */}
                    {isSeller && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Nombre de la Tienda / Showroom</label>
                          <input
                            type="text"
                            placeholder={username ? `Tienda de ${username}` : 'Ej: Disquería Melómano'}
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            className="w-full input-premium text-sm font-medium"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Breve Biografía / Descripción</label>
                          <textarea
                            placeholder="Ej: Joyas de rock progresivo y jazz, en formato físico."
                            value={storeBio}
                            onChange={(e) => setStoreBio(e.target.value)}
                            rows={2}
                            className="w-full input-premium text-sm font-medium resize-none py-2"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: PROFILE PICTURE */}
              {step === 4 && (
                <div className="flex flex-col flex-1 py-2">
                  <h3 className="text-2xl font-bold text-white mb-2">Tu imagen de perfil</h3>
                  <p className="text-gray-400 text-xs mb-6">
                    Elige una paleta de color para tu avatar o sube una imagen personalizada para identificarte.
                  </p>

                  <div className="flex flex-col items-center md:flex-row gap-6 mb-4">
                    {/* Preview Avatar Box */}
                    <div className="relative w-28 h-28 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner bg-slate-900/60">
                      {avatarType === 'preset' ? (
                        <div 
                          className="w-full h-full flex items-center justify-center text-3xl font-bold text-white select-none animate-pulse-slow"
                          style={{ background: GRADIENT_PRESETS[selectedPresetIdx] }}
                        >
                          {username ? username.charAt(0).toUpperCase() : 'V'}
                        </div>
                      ) : (
                        uploadedAvatar && (
                          <img src={uploadedAvatar} alt="Uploaded Avatar" className="w-full h-full object-cover animate-fade-in" />
                        )
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/60 p-1.5 rounded-lg border border-white/10">
                        <Camera className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    </div>

                    {/* Controls options */}
                    <div className="flex-1 w-full space-y-4">
                      <div>
                        <span className="text-xs text-gray-400 block mb-2 font-medium">Avatares prediseñados</span>
                        <div className="flex flex-wrap gap-2.5">
                          {GRADIENT_PRESETS.map((grad, idx) => (
                            <button
                              key={idx}
                              onClick={() => { setAvatarType('preset'); setSelectedPresetIdx(idx); }}
                              className={`w-8 h-8 rounded-full border transition-all ${
                                avatarType === 'preset' && selectedPresetIdx === idx 
                                  ? 'border-indigo-400 scale-110 shadow-lg shadow-indigo-500/20' 
                                  : 'border-transparent hover:scale-105'
                              }`}
                              style={{ background: grad }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block mb-2 font-medium">O sube un archivo personalizado</span>
                        <label className="flex items-center gap-2 cursor-pointer btn-secondary-premium py-2 px-3 text-xs w-fit select-none">
                          <Upload className="w-4 h-4 text-indigo-400" />
                          <span>Seleccionar imagen</span>
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                        {avatarError && (
                          <p className="text-red-400 text-[10px] mt-2 font-semibold flex items-center gap-1.5 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{avatarError}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: CONFIG SHOWROOM (sellers) or DISCOGS (collectors) */}
              {step === 5 && isSeller && (
                <div className="flex flex-col flex-1 py-2 space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Configuración del Showroom</h3>
                    <p className="text-gray-400 text-xs">
                      Define tu moneda preferida, tu número de contacto para ventas y si deseas activar tu showroom público.
                    </p>
                  </div>
                  <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Divisa Preferida</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                          <Coins className="w-4 h-4 text-indigo-400" />
                        </div>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="w-full !pl-11 pr-10 input-premium text-sm font-medium appearance-none cursor-pointer bg-[#0b0f19]"
                        >
                          <option value="USD" className="bg-[#0f172a] text-white">Dólar Estadounidense (USD - $)</option>
                          <option value="EUR" className="bg-[#0f172a] text-white">Euro (EUR - €)</option>
                          <option value="UYU" className="bg-[#0f172a] text-white">Peso Uruguayo (UYU - $ UYU)</option>
                          <option value="ARS" className="bg-[#0f172a] text-white">Peso Argentino (ARS - $ ARS)</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500">Moneda por defecto para mostrar los precios en tu catálogo.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Número de WhatsApp (Ventas)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                          <Phone className="w-4 h-4 text-indigo-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Ej: 5491112345678 (código país + código área + número)"
                          value={whatsappPhone}
                          onChange={(e) => setWhatsappPhone(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full !pl-11 input-premium text-sm font-medium"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500">Los clientes te enviarán mensajes directos a este número para comprar discos.</p>
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-900/50">
                      <div className="pr-4">
                        <h4 className="text-xs font-bold text-white mb-0.5">Catálogo Público Activo</h4>
                        <p className="text-[10px] text-gray-500">Permite a los visitantes ver tu stock disponible desde tu enlace único sin iniciar sesión.</p>
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

                    {/* Tienda Física Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-slate-900/50">
                        <div className="pr-4">
                          <h4 className="text-xs font-bold text-white mb-0.5">¿Tenés tienda física?</h4>
                          <p className="text-[10px] text-gray-500">Configurá la ubicación física para que tus compradores la vean en tu catálogo.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={hasPhysicalStore}
                            onChange={(e) => setHasPhysicalStore(e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                      </div>

                      {hasPhysicalStore && (
                        <div className="space-y-1.5 animate-fade-in">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ubicación Física de la Tienda</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                              <MapPin className="w-4 h-4 text-indigo-400" />
                            </div>
                            <input
                              type="text"
                              placeholder="Ej: Sarandí 700, Montevideo, Uruguay"
                              value={storeAddress}
                              onChange={(e) => setStoreAddress(e.target.value)}
                              className="w-full !pl-11 input-premium text-sm font-medium"
                              required={hasPhysicalStore}
                            />
                          </div>
                          {storeAddress.trim() && (
                            <div className="mt-3 rounded-2xl overflow-hidden border border-white/5 bg-slate-900/40 animate-fade-in">
                              <div className="flex items-center justify-between p-3 border-b border-white/5 bg-slate-950/20">
                                <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{storeAddress.trim()}</span>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress.trim())}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                                >
                                  Ver en Google Maps →
                                </a>
                              </div>
                              {mapLoadError ? (
                                <div className="p-4 text-xs text-red-400">Mapa no disponible. Desactiva los bloqueadores de anuncios o verifica tu conexión.</div>
                              ) : (
                                <iframe
                                  src={`https://maps.google.com/maps?q=${encodeURIComponent(storeAddress.trim())}&output=embed`}
                                  width="100%"
                                  height="150"
                                  style={{ border: 0 }}
                                  allowFullScreen
                                  loading="lazy"
                                  referrerPolicy="no-referrer-when-downgrade"
                                  className="block"
                                  onError={() => setMapLoadError(true)}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5 (collector) or 6 (seller): DISCOGS */}
              {((step === 5 && !isSeller) || (step === 6 && isSeller)) && (
                <div className="flex flex-col flex-1 py-2 space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Integración con Discogs</h3>
                    <p className="text-gray-400 text-xs">
                      Importa automáticamente tus discos desde tu colección de Discogs directamente a tu inventario de VinylStock.
                    </p>
                  </div>
                  <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1 flex flex-col justify-center">
                    {!isSyncing && !syncDone ? (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Usuario de Discogs (Opcional)</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                              <Disc className="w-4 h-4 text-indigo-400" />
                            </div>
                            <input
                              type="text"
                              placeholder="Tu nombre de usuario de Discogs"
                              value={discogsUsername}
                              onChange={(e) => setDiscogsUsername(e.target.value)}
                              className="w-full !pl-11 input-premium text-sm font-medium"
                            />
                          </div>
                        </div>
                        {discogsUsername.trim() ? (
                          <button
                            onClick={handleSyncDiscogs}
                            className="btn-premium py-3 px-6 text-xs w-full flex items-center justify-center gap-2 mt-2 transition-all font-semibold uppercase tracking-wider"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Conectar y Sincronizar Colección
                          </button>
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 text-center text-xs text-gray-500 italic mt-2">
                            Podés omitir este paso si no tenés cuenta en Discogs o preferís hacerlo más tarde desde la configuración.
                          </div>
                        )}
                      </>
                    ) : isSyncing ? (
                      <div className="w-full text-center space-y-4 py-4">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10 max-w-xs mx-auto">
                          <div 
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-indigo-300 font-semibold">{syncProgress.status}</p>
                      </div>
                    ) : syncDone && (
                      <div className="w-full text-center space-y-4 py-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                          <Check className="w-6 h-6" />
                        </div>
                        <h4 className="text-emerald-400 font-bold text-sm">¡Colección sincronizada!</h4>
                        <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">{syncProgress.status}</p>
                        <button
                          onClick={() => { setSyncDone(false); setDiscogsUsername(''); }}
                          className="text-[10px] text-gray-500 hover:text-white underline transition-colors"
                        >
                          Conectar otra cuenta
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}


            </motion.div>
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-6">
            {step > 1 && !isSyncing ? (
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="btn-secondary-premium flex items-center gap-1.5 py-2.5 px-4 text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={handleNext}
                disabled={
                  (step === 2 && !userRole) ||
                  (step === 3 && (!isUsernameAvailable || isUsernameChecking)) ||
                  (step === 5 && isSeller && hasPhysicalStore && !storeAddress.trim()) ||
                  isSyncing
                }
                className="btn-premium flex items-center gap-1.5 py-2.5 px-5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Continuar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              !isSubmitting && (
                <button
                  onClick={handleSubmit}
                  className="btn-premium py-2.5 px-6 text-sm flex items-center gap-2"
                >
                  <span>Finalizar y Entrar</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

