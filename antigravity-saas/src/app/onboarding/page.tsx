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
  LineChart,
  Cpu,
  Coins,
  Compass,
  AlertCircle,
  Disc,
  RefreshCw
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

export default function OnboardingPage() {
  const { user, userData, refreshUserData } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  // Form states
  const [username, setUsername] = useState('');
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [avatarType, setAvatarType] = useState<'preset' | 'upload'>('preset');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [discogsUsername, setDiscogsUsername] = useState('');
  
  // Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, status: '' });
  const [syncDone, setSyncDone] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    if (step !== 2 || !username) {
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
    if (step === 2 && (!isUsernameAvailable || isUsernameChecking)) return;
    
    setDirection(1);
    
    // Si pasamos del paso 4 (Discogs) y NO hay usuario, saltamos el paso 5 (Sync)
    if (step === 4 && !discogsUsername.trim()) {
      setStep(6);
    } else {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setDirection(-1);
    
    // Si volvemos del paso 6 (Intereses) y no hay usuario, volvemos al paso 4
    if (step === 6 && !discogsUsername.trim()) {
      setStep(4);
    } else {
      setStep((prev) => prev - 1);
    }
  };

  // Sync logic
  const handleSyncDiscogs = async () => {
    if (!user || !discogsUsername.trim()) return;

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0, status: `Buscando colección de @${discogsUsername}...` });

    try {
      const res = await fetch(`https://api.discogs.com/users/${discogsUsername.trim()}/collection/folders/0/releases?per_page=100&sort=added&sort_order=desc`);
      if (!res.ok) {
        throw new Error("No se pudo acceder a tu colección. ¿Es pública?");
      }

      const data = await res.json();
      const releases = data.releases || [];
      const total = releases.length;

      if (total === 0) {
        setSyncProgress({ current: 0, total: 0, status: 'La colección está vacía.' });
        setIsSyncing(false);
        setSyncDone(true);
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
          url: `https://www.discogs.com/release/${rel.id}`
        };

        const stockCol = collection(db, 'users', user.uid, 'stock');
        await addDoc(stockCol, newItem);

        addedCount++;

        setSyncProgress({ 
          current: i + 1, 
          total, 
          status: `Guardando ${i + 1} de ${total}...` 
        });

        // Throttle
        await new Promise((r) => setTimeout(r, 400));
      }

      setSyncProgress({ 
        current: total, 
        total, 
        status: `¡Listo! ${addedCount} discos sincronizados.` 
      });
      setSyncDone(true);
    } catch (err: any) {
      console.error(err);
      setSyncProgress({ current: 0, total: 0, status: 'Hubo un error al intentar sincronizar.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('La imagen es demasiado grande. El límite es de 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedAvatar(reader.result as string);
        setAvatarType('upload');
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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
        interests: selectedInterests,
        discogsUsername: discogsUsername.trim() || null,
        onboardingComplete: true,
        tutorialCompleted: false, // New users start with tutorial pending
        updatedAt: new Date(),
      }, { merge: true });

      // 3. Forzar refresco
      await refreshUserData();

      // 4. Redirigir al dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error al finalizar onboarding:', err);
      setSubmitError('Hubo un error al guardar tu perfil. Por favor, vuelve a intentarlo.');
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
            animate={{ width: `${(step / 7) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Wizard Card */}
        <div className="w-full glass-card rounded-3xl p-8 sm:p-10 relative overflow-hidden min-h-[460px] flex flex-col justify-between">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
          
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

              {/* STEP 2: USERNAME */}
              {step === 2 && (
                <div className="flex flex-col flex-1 py-2">
                  <h3 className="text-2xl font-bold text-white mb-2">Crea tu identificador único</h3>
                  <p className="text-gray-400 text-sm mb-6">
                    Elige un nombre de usuario que representará tu cuenta dentro de la plataforma.
                  </p>

                  <div className="relative mt-2">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      placeholder="nombre_usuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full !pl-12 !pr-12 input-premium text-lg tracking-wide font-medium"
                      autoFocus
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      {isUsernameChecking && (
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                      )}
                      {!isUsernameChecking && isUsernameAvailable === true && (
                        <Check className="w-5 h-5 text-emerald-400" />
                      )}
                      {!isUsernameChecking && isUsernameAvailable === false && (
                        <span className="text-red-400 text-sm font-semibold">Uso</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 min-h-[24px]">
                    {usernameError && (
                      <p className="text-red-400 text-xs flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {usernameError}
                      </p>
                    )}
                    {!isUsernameChecking && isUsernameAvailable === true && (
                      <p className="text-emerald-400 text-xs">
                        ¡Excelente! El nombre de usuario está disponible.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: PROFILE PICTURE */}
              {step === 3 && (
                <div className="flex flex-col flex-1 py-2">
                  <h3 className="text-2xl font-bold text-white mb-2">Tu imagen de perfil</h3>
                  <p className="text-gray-400 text-sm mb-6">
                    Elige una paleta de color para tu avatar o sube una imagen personalizada.
                  </p>

                  <div className="flex flex-col items-center md:flex-row gap-6 mb-4">
                    {/* Preview Avatar Box */}
                    <div className="relative w-28 h-28 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner bg-slate-900/60">
                      {avatarType === 'preset' ? (
                        <div 
                          className="w-full h-full flex items-center justify-center text-3xl font-bold text-white select-none"
                          style={{ background: GRADIENT_PRESETS[selectedPresetIdx] }}
                        >
                          {username ? username.charAt(0).toUpperCase() : 'V'}
                        </div>
                      ) : (
                        uploadedAvatar && (
                          <img src={uploadedAvatar} alt="Uploaded Avatar" className="w-full h-full object-cover" />
                        )
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/60 p-1.5 rounded-lg border border-white/10">
                        <Camera className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    </div>

                    {/* Controls options */}
                    <div className="flex-1 w-full space-y-4">
                      {/* Gradient Selector Carousel */}
                      <div>
                        <span className="text-xs text-gray-400 block mb-2 font-medium">Avatares prediseñados</span>
                        <div className="flex flex-wrap gap-2.5">
                          {GRADIENT_PRESETS.map((grad, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setAvatarType('preset');
                                setSelectedPresetIdx(idx);
                              }}
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

                      {/* Custom Upload button */}
                      <div>
                        <span className="text-xs text-gray-400 block mb-2 font-medium">O sube un archivo personalizado</span>
                        <label className="flex items-center gap-2 cursor-pointer btn-secondary-premium py-2 px-3 text-xs w-fit select-none">
                          <Upload className="w-4 h-4 text-indigo-400" />
                          <span>Seleccionar imagen</span>
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
                </div>
              )}

              {/* STEP 4: DISCOGS INTEGRATION */}
              {step === 4 && (
                <div className="flex flex-col flex-1 py-2">
                  <h3 className="text-2xl font-bold text-white mb-2">Conecta tu cuenta de Discogs</h3>
                  <p className="text-gray-400 text-sm mb-6">
                    Si tienes una cuenta de Discogs, ingrésala aquí. En el futuro, esto nos permitirá sincronizar automáticamente tu colección y obtener los valores de mercado.
                    <br /><br />
                    <span className="italic text-gray-500">Puedes omitir este paso si no tienes cuenta o quieres hacerlo más adelante.</span>
                  </p>

                  <div className="relative mt-2">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                      <Disc className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      placeholder="Usuario de Discogs (opcional)"
                      value={discogsUsername}
                      onChange={(e) => setDiscogsUsername(e.target.value)}
                      className="w-full !pl-12 input-premium text-lg tracking-wide font-medium"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* STEP 5: SYNC DISCOGS */}
              {step === 5 && (
                <div className="flex flex-col flex-1 py-2 items-center justify-center text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">Sincroniza tu colección ahora</h3>
                  <p className="text-gray-400 text-sm mb-6 max-w-sm">
                    Podemos importar tu colección de Discogs directamente a tu inventario. Esto puede tardar un par de minutos si tu colección es grande.
                  </p>

                  <div className="flex flex-col items-center justify-center w-full max-w-sm space-y-4">
                    {isSyncing ? (
                      <div className="w-full text-center space-y-4">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10">
                          <div 
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-indigo-300 font-semibold">{syncProgress.status}</p>
                      </div>
                    ) : syncDone ? (
                      <div className="w-full text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                          <Check className="w-6 h-6" />
                        </div>
                        <p className="text-emerald-400 font-bold text-sm">{syncProgress.status}</p>
                        <button
                          onClick={handleNext}
                          className="btn-premium py-2 px-6 text-sm"
                        >
                          Continuar
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={handleSyncDiscogs}
                          className="btn-premium py-3 px-6 text-sm w-full flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Sincronizar ahora
                        </button>
                        <button
                          onClick={handleNext}
                          className="py-2 text-sm text-gray-500 hover:text-white transition-colors"
                        >
                          Omitir por ahora
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 6: INTERESTS */}
              {step === 6 && (
                <div className="flex flex-col flex-1 py-2">
                  <h3 className="text-2xl font-bold text-white mb-2">Tus preferencias</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Selecciona las áreas que deseas priorizar dentro de tu panel (puedes elegir varias).
                  </p>

                  <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {INTERESTS_PRESETS.map((item) => {
                      const IconComponent = item.icon;
                      const isSelected = selectedInterests.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleInterest(item.id)}
                          className={`flex items-center gap-3.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                            isSelected 
                              ? 'bg-indigo-500/10 border-indigo-500/40 text-white' 
                              : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/10'
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-400'}`}>
                            <IconComponent className="w-4.5 h-4.5" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-semibold">{item.label}</div>
                            <div className="text-xs text-gray-400">{item.desc}</div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 7: FINALIZING */}
              {step === 7 && (
                <div className="flex flex-col items-center text-center justify-center flex-1 py-4">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-6" />
                      <h3 className="text-2xl font-bold text-white mb-2">Configurando tu entorno...</h3>
                      <p className="text-gray-400 text-sm max-w-xs">
                        Estamos personalizando tu experiencia VinylStock y asegurando tus credenciales.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-6">
                        <Check className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">¡Todo listo para despegar!</h3>
                      <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-6">
                        Hemos guardado tus preferencias y preparado tu panel. Haz clic abajo para iniciar sesión por primera vez.
                      </p>

                      {submitError && (
                        <div className="mb-4 text-red-400 text-xs bg-red-500/10 border border-red-500/25 p-3 rounded-lg max-w-xs">
                          {submitError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-6">
            {step > 1 && step < 7 && !(step === 5 && isSyncing) && !(step === 5 && syncDone) ? (
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="btn-secondary-premium flex items-center gap-1.5 py-2.5 px-4 text-sm"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
                <span>Atrás</span>
              </button>
            ) : (
              <div />
            )}

            {step < 7 && step !== 5 ? (
              <button
                onClick={handleNext}
                disabled={step === 2 && (!isUsernameAvailable || isUsernameChecking)}
                className="btn-premium flex items-center gap-1.5 py-2.5 px-5 text-sm"
              >
                <span>Continuar</span>
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            ) : step === 7 ? (
              !isSubmitting && (
                <button
                  onClick={handleSubmit}
                  className="btn-premium py-2.5 px-6 text-sm flex items-center gap-2"
                >
                  <span>Entrar al Dashboard</span>
                  <ChevronRight className="w-4.5 h-4.5" />
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
