'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, 
  Search,
  MessageSquare,
  AlertCircle,
  Loader2,
  Share2,
  X,
  Disc,
  MapPin,
  Check,
  RefreshCw,
  ShoppingBag,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import AudioPreviewPlayer from '../../components/AudioPreviewPlayer';

interface VinylItem {
  id: string;
  artist: string;
  title: string;
  price: number;
  format?: string;
  grade?: string;
  gradeCover?: string;
  label?: string;
  catno?: string;
  year?: string;
  cover?: string;
  photos?: string[];
  discogsPhotos?: string[];
  notes?: string;
  status?: string;
  discogsId?: number | null;
  qty: number;
}

interface StoreOwner {
  uid: string;
  username: string;
  storeName?: string;
  storeBio?: string;
  avatar?: string;
  avatarType?: 'preset' | 'upload';
  whatsappPhone?: string;
  currency?: string;
  isPublicStore?: boolean;
  storeTheme?: 'midnight' | 'retro-amber' | 'acid-neon' | 'mono-classic';
}

const getFormatBadgeColor = (format: string, theme?: any) => {
  switch (format.toLowerCase()) {
    case 'vinyl': return theme ? theme.badgeAccent : 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'cd': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'cassette': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

export default function StoreClient({ username }: { username: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<StoreOwner | null>(null);
  const [stock, setStock] = useState<VinylItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormat, setFilterFormat] = useState('Todos');
  
  const [previewItem, setPreviewItem] = useState<VinylItem | null>(null);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return;

    async function fetchStore() {
      try {
        setLoading(true);
        setError(null);

        // 1. Resolve username to UID
        const usernameRef = doc(db, 'usernames', username as string);
        const usernameSnap = await getDoc(usernameRef);
        
        if (!usernameSnap.exists()) {
          setError('Tienda no encontrada. Verifica que el enlace sea correcto.');
          setLoading(false);
          return;
        }

        const uid = usernameSnap.data().uid;

        // 2. Fetch User Data
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setError('El perfil de la tienda no está disponible.');
          setLoading(false);
          return;
        }

        const userData = userSnap.data();
        
        // 3. Check if store is public
        if (userData.isPublicStore === false) {
          setError('Esta tienda es privada por el momento.');
          setLoading(false);
          return;
        }

        const storeOwner: StoreOwner = {
          uid,
          username: userData.username,
          storeName: userData.storeName || '',
          storeBio: userData.storeBio || '',
          avatar: userData.avatar || '',
          avatarType: userData.avatarType || 'preset',
          whatsappPhone: userData.whatsappPhone || '',
          currency: userData.currency || 'USD',
          storeTheme: userData.storeTheme || 'midnight',
        };
        setOwner(storeOwner);

        // 4. Fetch Stock (Available & Reserved)
        const stockRef = collection(db, 'users', uid, 'stock');
        const stockSnap = await getDocs(stockRef);
        
        const items: VinylItem[] = [];
        stockSnap.forEach((doc) => {
          const data = doc.data();
          if (data.status === 'disponible' || data.status === 'reservado') {
            items.push({
              id: doc.id,
              ...data,
              qty: data.qty || 1,
            } as VinylItem);
          }
        });

        // Sort by artist
        items.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
        setStock(items);

      } catch (err) {
        console.error('Error fetching store:', err);
        setError('Ocurrió un error al cargar la tienda. Intenta nuevamente más tarde.');
      } finally {
        setLoading(false);
      }
    }

    fetchStore();
  }, [username]);

  // Filtering
  const filteredStock = stock.filter((item) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      (item.artist || '').toLowerCase().includes(term) ||
      (item.title || '').toLowerCase().includes(term) ||
      (item.label || '').toLowerCase().includes(term);
      
    const matchesFormat = filterFormat === 'Todos' || (item.format || 'Vinyl').toLowerCase() === filterFormat.toLowerCase();
    
    return matchesSearch && matchesFormat;
  });

  const [visibleCount, setVisibleCount] = useState(30);
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, filterFormat]);

  const slicedStock = filteredStock.slice(0, visibleCount);

  // Digging Pile States
  const [diggingPile, setDiggingPile] = useState<VinylItem[]>([]);
  const [isPileDrawerOpen, setIsPileDrawerOpen] = useState(false);

  // Load from localStorage on mount (once owner is available to avoid mixing piles of different shops)
  useEffect(() => {
    if (owner?.username) {
      const saved = localStorage.getItem(`diggingPile_${owner.username}`);
      if (saved) {
        try {
          setDiggingPile(JSON.parse(saved));
        } catch (e) {
          console.error('Error parsing digging pile', e);
        }
      }
    }
  }, [owner]);

  // Save to localStorage when it changes
  const savePile = (newPile: VinylItem[]) => {
    setDiggingPile(newPile);
    if (owner?.username) {
      localStorage.setItem(`diggingPile_${owner.username}`, JSON.stringify(newPile));
    }
  };

  const addToPile = (item: VinylItem) => {
    if (diggingPile.some((x) => x.id === item.id)) return;
    const newPile = [...diggingPile, item];
    savePile(newPile);
  };

  const removeFromPile = (id: string) => {
    const newPile = diggingPile.filter((x) => x.id !== id);
    savePile(newPile);
  };

  const clearPile = () => {
    savePile([]);
  };

  const isInPile = (id: string) => {
    return diggingPile.some((x) => x.id === id);
  };

  const handleSendWhatsAppOrder = () => {
    if (!owner?.whatsappPhone || diggingPile.length === 0) return;

    let itemsText = '';
    let totalSum = 0;

    diggingPile.forEach((item) => {
      itemsText += `* 💿 ${item.artist} - ${item.title} (${item.format || 'Vinyl'} | ${item.grade || 'VG+'}) - ${formatCurrency(item.price, owner.currency)}\n`;
      totalSum += item.price;
    });

    const message = `¡Hola! Me interesan estos artículos de tu catálogo en VinylStock:\n\n${itemsText}\n*Total estimado:* ${formatCurrency(totalSum, owner.currency)}\n\n¿Están disponibles? ¡Gracias!`;

    const url = `https://wa.me/${owner.whatsappPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard', err);
    }
  };

  const themeConfig = {
    midnight: {
      bg: 'bg-[#030712]',
      selectionBg: 'selection:bg-indigo-500/30',
      textAccent: 'text-indigo-400',
      textAccentHover: 'hover:text-indigo-300',
      borderAccent: 'border-indigo-500/20 hover:border-indigo-500/40',
      btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25',
      btnSecondary: 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-indigo-500/30 text-white',
      badgeAccent: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20',
      cardHoverShadow: 'hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.15)] hover:border-indigo-500/25',
      searchFocusIcon: 'group-focus-within:text-indigo-400',
      searchFocusInput: 'focus:border-indigo-500/50 focus:ring-indigo-500/50',
      activePhotoBorder: 'border-indigo-500',
      inactiveCartBtn: 'bg-white/5 text-indigo-300 border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/5',
      interestBtnShadow: 'shadow-indigo-500/20',
      floatingCartBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30',
      drawerTopIndicator: 'via-indigo-500/50',
      checkoutBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 border-indigo-500/30',
      orbs: (
        <>
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[100px] mix-blend-screen" />
        </>
      )
    },
    'retro-amber': {
      bg: 'bg-[#0c0a09]',
      selectionBg: 'selection:bg-amber-500/30',
      textAccent: 'text-amber-500',
      textAccentHover: 'hover:text-amber-400',
      borderAccent: 'border-amber-500/20 hover:border-amber-500/45',
      btnPrimary: 'bg-amber-600 hover:bg-amber-500 text-black shadow-amber-500/10 font-bold',
      btnSecondary: 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-amber-500/35 text-amber-100',
      badgeAccent: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
      cardHoverShadow: 'hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.15)] hover:border-amber-500/25',
      searchFocusIcon: 'group-focus-within:text-amber-500',
      searchFocusInput: 'focus:border-amber-500/50 focus:ring-amber-500/50',
      activePhotoBorder: 'border-amber-500',
      inactiveCartBtn: 'bg-white/5 text-amber-300 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5',
      interestBtnShadow: 'shadow-amber-500/10',
      floatingCartBtn: 'bg-amber-600 hover:bg-amber-500 text-black border-amber-400/30',
      drawerTopIndicator: 'via-amber-500/50',
      checkoutBtn: 'bg-amber-600 hover:bg-amber-500 text-black shadow-amber-500/25 border-amber-500/30',
      orbs: (
        <>
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-600/5 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-600/5 rounded-full blur-[100px] mix-blend-screen" />
        </>
      )
    },
    'acid-neon': {
      bg: 'bg-[#020504]',
      selectionBg: 'selection:bg-lime-500/30',
      textAccent: 'text-lime-400',
      textAccentHover: 'hover:text-lime-300',
      borderAccent: 'border-lime-500/20 hover:border-lime-500/40',
      btnPrimary: 'bg-lime-500 hover:bg-lime-400 text-black shadow-lime-500/15 font-bold',
      btnSecondary: 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-lime-500/30 text-lime-100',
      badgeAccent: 'bg-lime-500/20 text-lime-400 border-lime-500/20',
      cardHoverShadow: 'hover:shadow-[0_20px_40px_-15px_rgba(132,204,22,0.15)] hover:border-lime-500/25',
      searchFocusIcon: 'group-focus-within:text-lime-400',
      searchFocusInput: 'focus:border-lime-500/50 focus:ring-lime-500/50',
      activePhotoBorder: 'border-lime-500',
      inactiveCartBtn: 'bg-white/5 text-lime-300 border-lime-500/20 hover:border-lime-500/40 hover:bg-lime-500/5',
      interestBtnShadow: 'shadow-lime-500/15',
      floatingCartBtn: 'bg-lime-500 hover:bg-lime-400 text-black border-lime-400/30',
      drawerTopIndicator: 'via-lime-500/50',
      checkoutBtn: 'bg-lime-500 hover:bg-lime-400 text-black shadow-lime-500/25 border-lime-500/30',
      orbs: (
        <>
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-lime-600/5 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[100px] mix-blend-screen" />
        </>
      )
    },
    'mono-classic': {
      bg: 'bg-[#0f172a]',
      selectionBg: 'selection:bg-slate-500/30',
      textAccent: 'text-slate-200',
      textAccentHover: 'hover:text-white',
      borderAccent: 'border-slate-500/20 hover:border-slate-500/40',
      btnPrimary: 'bg-white hover:bg-gray-100 text-black shadow-slate-500/10 font-bold',
      btnSecondary: 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200',
      badgeAccent: 'bg-slate-500/20 text-slate-350 border-slate-500/20',
      cardHoverShadow: 'hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.05)] hover:border-white/15',
      searchFocusIcon: 'group-focus-within:text-slate-200',
      searchFocusInput: 'focus:border-slate-500/50 focus:ring-slate-500/50',
      activePhotoBorder: 'border-slate-200',
      inactiveCartBtn: 'bg-white/5 text-slate-350 border-slate-500/20 hover:border-slate-500/40 hover:bg-slate-500/5',
      interestBtnShadow: 'shadow-slate-500/10',
      floatingCartBtn: 'bg-white hover:bg-gray-100 text-black border-slate-400/30',
      drawerTopIndicator: 'via-slate-500/50',
      checkoutBtn: 'bg-white hover:bg-gray-100 text-black shadow-slate-500/10 border-slate-500/30',
      orbs: (
        <>
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-slate-500/5 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-zinc-600/5 rounded-full blur-[100px] mix-blend-screen" />
        </>
      )
    }
  };

  const theme = themeConfig[owner?.storeTheme || 'midnight'] || themeConfig.midnight;

  const renderAvatar = () => {
    if (!owner) return null;
    if (owner.avatarType === 'upload' && owner.avatar) {
      return <img src={owner.avatar} alt={owner.username} className="w-full h-full object-cover" />;
    }
    const initial = owner.username ? owner.username.charAt(0).toUpperCase() : 'V';
    return (
      <div 
        className="w-full h-full flex items-center justify-center font-bold text-white text-3xl"
        style={{ background: owner.avatar || 'linear-gradient(135deg, #6366f1, #a5b4fc)' }}
      >
        {initial}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Skeleton */}
          <div className="w-full h-64 md:h-80 rounded-3xl bg-slate-900/50 border border-white/5 animate-pulse mb-12 flex items-center p-8 md:p-12">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-slate-800 shrink-0" />
            <div className="ml-8 space-y-4 flex-1">
              <div className="h-10 bg-slate-800 rounded-lg w-1/3" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
              <div className="flex gap-3 pt-4">
                <div className="h-10 bg-slate-800 rounded-xl w-32" />
                <div className="h-10 bg-slate-800 rounded-xl w-32" />
              </div>
            </div>
          </div>
          
          {/* Search Skeleton */}
          <div className="w-full max-w-3xl mx-auto h-14 bg-slate-900/50 rounded-2xl mb-10 animate-pulse" />

          {/* Grid Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-slate-900/50 rounded-2xl border border-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !owner) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6 text-white relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-md w-full glass-card p-10 rounded-3xl text-center space-y-6 border border-white/5 relative z-10 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold mb-3">Oops</h2>
            <p className="text-gray-400 text-sm leading-relaxed">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} text-white ${theme.selectionBg}`}>
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {theme.orbs}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden mb-12 shadow-2xl border border-white/5">
          {/* Background Blur */}
          <div className="absolute inset-0 bg-slate-900">
            {stock.length > 0 && (stock[0].cover || stock[0].photos?.[0]) ? (
              <img 
                src={stock[0].cover || stock[0].photos?.[0]} 
                alt="Store background" 
                className="w-full h-full object-cover opacity-30 blur-2xl scale-110"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
          </div>

          <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-black/40 shadow-2xl overflow-hidden shrink-0 bg-slate-800 z-10">
              {renderAvatar()}
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-3 z-10">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-lg">
                {owner.storeName || `@${owner.username}`}
              </h1>
              {owner.storeBio && (
                <p className="text-gray-300 max-w-2xl text-lg leading-relaxed drop-shadow">
                  {owner.storeBio}
                </p>
              )}

              {(owner as any)?.storeAddress && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-white/5 bg-slate-900/40">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${theme.badgeAccent}`}>
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{(owner as any).storeAddress}</p>
                      <p className="text-[10px] text-gray-500">Ubicación de la tienda</p>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((owner as any).storeAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`ml-auto text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap ${theme.textAccent} ${theme.textAccentHover}`}
                    >
                      Ver mapa →
                    </a>
                  </div>
                  <iframe
                    src={`https://maps.google.com/maps?q=${encodeURIComponent((owner as any).storeAddress)}&output=embed`}
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="block"
                  />
                </div>
              )}
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow-lg">
                  {stock.length} Items
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow-lg">
                  Envíos a todo el país
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 z-10 w-full md:w-auto mt-4 md:mt-0">
              {owner.whatsappPhone && (
                <a
                  href={`https://wa.me/${owner.whatsappPhone}?text=${encodeURIComponent(`Hola! Vengo de tu tienda online VinylStock.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 shadow-xl whitespace-nowrap ${theme.btnPrimary} ${theme.interestBtnShadow}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Contactar</span>
                </a>
              )}
              <button 
                onClick={handleShare}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 backdrop-blur-md ${theme.btnSecondary}`}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-white" />}
                <span>{copied ? 'Copiado' : 'Compartir'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-10 space-y-4">
          <div className="relative group max-w-3xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className={`h-5 w-5 text-gray-400 transition-colors ${theme.searchFocusIcon}`} />
            </div>
            <input
              type="text"
              placeholder="Buscar por artista, título o sello..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`block w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-900/50 border border-white/10 text-white placeholder-gray-500 focus:bg-slate-900/80 focus:ring-1 transition-all shadow-xl ${theme.searchFocusInput}`}
            />
          </div>
          
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['Todos', 'Vinyl', 'CD', 'Cassette'].map(f => (
              <button 
                key={f}
                onClick={() => setFilterFormat(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filterFormat === f 
                    ? `${theme.badgeAccent} border-current`
                    : 'bg-slate-900/40 border-white/5 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Grid View */}
        {filteredStock.length === 0 ? (
          <div className="text-center py-20">
            <Disc className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-300">No se encontraron artículos</h3>
            <p className="text-gray-500 mt-2">Intenta con otra búsqueda o el vendedor no tiene stock disponible en este momento.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
             {slicedStock.map((item) => (
              <div 
                key={item.id}
                onClick={() => {
                  setPreviewItem(item);
                  setActivePhoto(item.photos?.[0] || item.discogsPhotos?.[0] || item.cover || null);
                }}
                className={`p-2 rounded-[2rem] bg-white/5 border border-white/10 hover:border-current transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer group flex flex-col relative hover:-translate-y-1 ${theme.cardHoverShadow}`}
              >
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1326] rounded-[calc(2rem-0.5rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/5 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
                  <div className="aspect-square w-full bg-slate-900 flex items-center justify-center relative overflow-hidden border-b border-white/5">
                    {/* Botón rápido Pila de Diggeo */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isInPile(item.id)) {
                          removeFromPile(item.id);
                        } else {
                          addToPile(item);
                        }
                      }}
                      className={`absolute top-3 left-3 p-2 rounded-xl border transition-all duration-300 backdrop-blur-md shadow-lg z-20 ${
                        isInPile(item.id)
                          ? `${theme.btnPrimary} scale-110`
                          : 'bg-black/50 text-gray-300 border-white/10 hover:border-white/30 hover:bg-black/70 hover:scale-105 opacity-0 group-hover:opacity-100'
                      }`}
                      title={isInPile(item.id) ? "Quitar de mi selección" : "Agregar a mi selección"}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </button>

                    {item.cover ? (
                      <img 
                        src={item.cover} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-600">
                        <Music className="w-12 h-12" />
                      </div>
                    )}

                    <div className="absolute bottom-3 right-3 flex flex-col gap-2 items-end">
                      {item.status === 'reservado' && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-lg backdrop-blur-md">
                          Reservado
                        </span>
                      )}
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-lg backdrop-blur-md ${getFormatBadgeColor(item.format || 'Vinyl', theme)}`}>
                        {item.format || 'Vinyl'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <h4 className={`text-xs font-black ${theme.textAccent} tracking-wider uppercase leading-none truncate`}>
                        {item.artist}
                      </h4>
                      <h3 className="text-base font-bold text-white leading-tight line-clamp-2">
                        {item.title}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <span className="text-xs text-gray-500 font-medium">
                        Estado: <strong className="text-gray-300">{item.grade}</strong>
                      </span>
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-400">
                          {formatCurrency(item.price, owner.currency)}
                        </span>
                        {item.qty > 1 && (
                          <span className="text-[10px] text-gray-500 font-bold block -mt-1">
                            x{item.qty} disponibles
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredStock.length > visibleCount && (
            <div className="flex justify-center mt-12">
              <button
                onClick={() => setVisibleCount((prev) => prev + 30)}
                className={`px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 border transition-all duration-300 backdrop-blur-md shadow-lg ${theme.btnSecondary}`}
              >
                <RefreshCw className="w-4 h-4 animate-spin-slow" />
                <span>Cargar más discos</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[90vh] glass-card rounded-2xl border border-white/10 shadow-2xl overflow-y-auto overflow-x-hidden relative flex flex-col"
            >
              <button 
                onClick={() => setPreviewItem(null)}
                className="absolute right-4 top-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left Column: Image Viewer */}
                <div className="md:col-span-5 space-y-4">
                  <div className="glass-card rounded-2xl border border-white/5 overflow-hidden aspect-square flex items-center justify-center relative bg-slate-950/40 select-none">
                    {activePhoto ? (
                      <img 
                        src={activePhoto} 
                        alt="cover" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <Disc className="w-24 h-24 stroke-[1] text-gray-600 animate-spin-slow" />
                    )}
                  </div>
                  
                  {/* Thumbnails */}
                  {(previewItem.photos || previewItem.discogsPhotos) && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {[...(previewItem.photos || []), ...(previewItem.discogsPhotos || [])].map((photo, i) => (
                        <button
                          key={i}
                          onClick={() => setActivePhoto(photo)}
                          className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                            activePhoto === photo ? `${theme.activePhotoBorder} scale-105` : 'border-white/5 opacity-50 hover:opacity-100'
                          }`}
                        >
                          <img src={photo} alt="thumbnail" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Details */}
                <div className="md:col-span-7 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <span className={`text-xs font-extrabold ${theme.textAccent} tracking-wider uppercase`}>
                        {previewItem.artist}
                      </span>
                      <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-1 leading-tight">
                        {previewItem.title}
                      </h1>
                    </div>
                    
                    <div className="flex items-baseline gap-2 pb-2">
                      <span className="text-3xl font-extrabold text-emerald-400">
                        {formatCurrency(previewItem.price, owner.currency)}
                      </span>
                      {previewItem.qty > 1 && (
                        <span className="text-xs text-gray-500 font-bold ml-2">x{previewItem.qty} disponibles</span>
                      )}
                    </div>

                    <div className="glass-card rounded-xl p-4 border border-white/5 space-y-3 bg-slate-900/50">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                        Especificaciones
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 block mb-1">
                            {previewItem.format === 'CD' ? 'Estado CD' : previewItem.format === 'Cassette' ? 'Estado Cassette' : 'Estado Disco'}:
                          </span>
                          <span className="font-bold text-white">{previewItem.grade || 'VG+'}</span>
                        </div>
                        {previewItem.format !== 'Cassette' && (
                          <div>
                            <span className="text-gray-500 block mb-1">Estado Tapa:</span>
                            <span className="font-bold text-white">{previewItem.gradeCover || 'VG+'}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500 block mb-1">Sello:</span>
                          <span className="font-bold text-white">{previewItem.label || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1">Año:</span>
                          <span className="font-bold text-white">{previewItem.year || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {previewItem.notes && (
                      <div className="pt-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Notas del Vendedor</span>
                        <p className="text-sm text-gray-300 leading-relaxed bg-slate-900/40 p-4 rounded-xl border border-white/5 whitespace-pre-line">
                          {previewItem.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (isInPile(previewItem.id)) {
                          removeFromPile(previewItem.id);
                        } else {
                          addToPile(previewItem);
                        }
                      }}
                      className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border transition-all duration-300 ${
                        isInPile(previewItem.id)
                          ? `${theme.btnPrimary} ${theme.interestBtnShadow}`
                          : theme.inactiveCartBtn
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        {isInPile(previewItem.id)
                          ? 'Quitar de mi selección'
                          : 'Agregar a mi selección (WhatsApp Cart)'}
                      </span>
                    </button>

                    {owner.whatsappPhone ? (
                      <a
                        href={`https://wa.me/${owner.whatsappPhone}?text=${encodeURIComponent(`Hola! Me interesa este ${previewItem.format === 'CD' ? 'CD' : previewItem.format === 'Cassette' ? 'Cassette' : 'disco'} de tu tienda pública: ${previewItem.artist} - ${previewItem.title}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 text-lg font-bold shadow-xl transition-all duration-300 ${theme.btnPrimary} ${theme.interestBtnShadow}`}
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span>Comprar ahora (WhatsApp)</span>
                      </a>
                    ) : (
                      <div className="w-full bg-slate-900/80 border border-white/5 py-4 rounded-xl flex items-center justify-center text-gray-400 font-bold text-sm">
                        El vendedor no ha configurado un número de contacto
                      </div>
                    )}
                  </div>
                  
                  {/* YouTube Player */}
                  <div className="pt-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
                      Escuchar
                    </span>
                    <AudioPreviewPlayer artist={previewItem.artist} title={previewItem.title} />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón Flotante de Selección (Pila de Diggeo) */}
      <AnimatePresence>
        {diggingPile.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => setIsPileDrawerOpen(true)}
            className={`fixed bottom-6 right-6 z-40 p-4 rounded-full border shadow-2xl flex items-center gap-2 group transition-all duration-300 ${theme.floatingCartBtn}`}
          >
            <div className="relative">
              <ShoppingBag className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-2.5 -right-2.5 bg-emerald-500 text-black text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950 animate-pulse">
                {diggingPile.length}
              </span>
            </div>
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-out font-bold text-xs whitespace-nowrap">
              Ver mi selección
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drawer de la Pila de Diggeo (WhatsApp Shopping Cart) */}
      <AnimatePresence>
        {isPileDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPileDrawerOpen(false)}
              className="fixed inset-0 bg-black z-40 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:max-w-md bg-slate-950/95 border-l border-white/10 z-50 flex flex-col shadow-2xl backdrop-blur-xl"
            >
              {/* Top Accent line */}
              <div className={`h-1.5 w-full bg-gradient-to-r from-transparent ${theme.drawerTopIndicator} to-transparent`} />

              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className={`w-5 h-5 ${theme.textAccent}`} />
                  <div>
                    <h3 className="font-extrabold text-white text-lg leading-tight">Mi Selección</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">WhatsApp Shopping Cart</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearPile}
                    title="Vaciar selección"
                    className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-red-400 hover:border-red-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsPileDrawerOpen(false)}
                    className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                {diggingPile.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                      <ShoppingBag className="w-8 h-8 text-gray-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Tu selección está vacía</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                        Navega por la tienda y agrega los discos que te interesan.
                      </p>
                    </div>
                  </div>
                ) : (
                  diggingPile.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl p-3 hover:border-white/10 transition-all group"
                    >
                      <div className="w-12 h-12 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-white/5">
                        {item.cover ? (
                          <img src={item.cover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            <Music className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate leading-tight">
                          {item.title}
                        </h4>
                        <p className={`text-[10px] font-bold ${theme.textAccent} truncate uppercase tracking-wider mt-0.5`}>
                          {item.artist}
                        </p>
                        <span className="inline-block mt-1 text-[9px] font-semibold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400">
                          {item.format || 'Vinyl'}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-emerald-400">
                          {formatCurrency(item.price, owner.currency)}
                        </p>
                        <button
                          onClick={() => removeFromPile(item.id)}
                          className="text-[10px] text-gray-500 hover:text-red-400 font-bold block mt-1 transition-colors ml-auto"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {diggingPile.length > 0 && (
                <div className="p-6 border-t border-white/5 bg-slate-950 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 font-medium">Total estimado:</span>
                    <span className="text-xl font-black text-emerald-400">
                      {formatCurrency(
                        diggingPile.reduce((acc, x) => acc + x.price, 0),
                        owner.currency
                      )}
                    </span>
                  </div>
                  <button
                    onClick={handleSendWhatsAppOrder}
                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-2.5 text-sm font-bold border transition-all duration-300 shadow-xl ${theme.checkoutBtn}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Enviar pedido por WhatsApp</span>
                  </button>
                  <p className="text-[9px] text-center text-gray-500 leading-normal">
                    Se abrirá WhatsApp con el resumen consolidado de tu pedido para coordinar con el vendedor.
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


