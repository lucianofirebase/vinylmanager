'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import AudioPreviewPlayer from '../../components/AudioPreviewPlayer';
import { 
  Music, 
  Disc, 
  MessageSquare, 
  Share2, 
  Check, 
  AlertCircle, 
  Loader2, 
  FileText, 
  ArrowLeft, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

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
  discogsId?: number | null;
  notes?: string;
  status?: string;
}

interface SellerData {
  displayName: string | null;
  username?: string;
  avatar?: string | null;
  avatarType?: 'preset' | 'upload' | null;
  currency?: string | null;
  whatsappPhone?: string;
}

function ShowcaseContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('u');
  const vinylId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vinyl, setVinyl] = useState<VinylItem | null>(null);
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!uid || !vinylId) {
      setError('Faltan parámetros en la URL. Asegúrate de ingresar con un enlace válido.');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Vinyl Document
        const vinylRef = doc(db, 'users', uid!, 'stock', vinylId!);
        const vinylSnap = await getDoc(vinylRef);

        if (!vinylSnap.exists()) {
          setError('El disco solicitado no existe o ya no está disponible.');
          setLoading(false);
          return;
        }

        const vinylData = vinylSnap.data();
        const item: VinylItem = {
          id: vinylSnap.id,
          artist: vinylData.artist || 'Desconocido',
          title: vinylData.title || 'Título Desconocido',
          price: Number(vinylData.price) || 0,
          format: vinylData.format || 'Vinyl',
          grade: vinylData.grade || 'VG+',
          gradeCover: vinylData.gradeCover || vinylData.grade || 'VG+',
          label: vinylData.label || '',
          catno: vinylData.catno || '',
          year: vinylData.year || '',
          cover: vinylData.cover || '',
          photos: vinylData.photos || [],
          discogsPhotos: vinylData.discogsPhotos || [],
          discogsId: vinylData.discogsId || null,
          notes: vinylData.notes || '',
          status: vinylData.status || 'disponible'
        };

        setVinyl(item);

        // Set default main photo
        const allPhotos = [...(item.photos || []), ...(item.discogsPhotos || [])];
        if (allPhotos.length > 0) {
          setActivePhoto(allPhotos[0]);
        } else if (item.cover) {
          setActivePhoto(item.cover);
        }

        // 2. Fetch Seller Profile
        const sellerRef = doc(db, 'users', uid!);
        const sellerSnap = await getDoc(sellerRef);
        if (sellerSnap.exists()) {
          const sData = sellerSnap.data();
          setSeller({
            displayName: sData.displayName || sData.username || 'Vendedor de VinylStock',
            username: sData.username,
            avatar: sData.avatar,
            avatarType: sData.avatarType,
            currency: sData.currency || 'USD',
            whatsappPhone: sData.whatsappPhone || ''
          });
        } else {
          setSeller({
            displayName: 'Vendedor',
            currency: 'USD'
          });
        }
      } catch (err) {
        console.error('Error fetching public vinyl details:', err);
        setError('Ocurrió un error al cargar los detalles del disco.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [uid, vinylId]);

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFormatBadge = (format?: string) => {
    if (format === 'CD') return '💿 CD';
    if (format === 'Cassette') return '📼 Cassette';
    return '💿 Vinilo';
  };

  const getConditionText = (grade: string) => {
    const mapping: Record<string, string> = {
      'MINT': 'Nuevo / Sellado (Mint)',
      'NM': 'Excelente / Casi nuevo (Near Mint)',
      'VG+': 'Excelente (Very Good Plus)',
      'VG': 'Muy bueno (Very Good)',
      'G+': 'Bueno+ (Good Plus)',
      'G': 'Bueno (Good)',
      'F': 'Regular (Fair)',
      'P': 'Pobre (Poor)'
    };
    return mapping[grade] || grade;
  };

  const buildWhatsAppMessage = () => {
    if (!vinyl) return '';
    const formattedPrice = formatCurrency(vinyl.price, seller?.currency || 'USD');
    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
    
    let text = `¡Hola! Vi este disco en tu catálogo de *VinylStock* y me interesa:\n\n`;
    text += `💿 *${vinyl.title.toUpperCase()}*\n`;
    text += `👤 Artista: *${vinyl.artist}*\n`;
    text += `💰 Precio: *${formattedPrice}*\n`;
    text += `📀 Estado Disco: ${vinyl.grade} | Tapa: ${vinyl.gradeCover}\n\n`;
    text += `👉 Enlace: ${pageUrl}`;
    
    return encodeURIComponent(text);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
        <p className="text-gray-400 text-sm select-none">Cargando catálogo...</p>
      </div>
    );
  }

  if (error || !vinyl) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 glass-card rounded-2xl border border-white/5 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Catálogo no disponible</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          {error || 'No pudimos encontrar el disco solicitado. Puede haber sido vendido o removido por el vendedor.'}
        </p>
        <div className="pt-2">
          <Link href="/login" className="btn-premium py-2 px-6 text-xs inline-block">
            Ir a VinylStock
          </Link>
        </div>
      </div>
    );
  }

  const allPhotos = [...(vinyl.photos || []), ...(vinyl.discogsPhotos || [])];
  const hasPhotos = allPhotos.length > 0;
  const whatsappMsg = buildWhatsAppMessage();
  const cleanPhone = (seller?.whatsappPhone || '').replace(/[^0-9]/g, '');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8 select-text">
      {/* Top Header Navigation */}
      <header className="flex items-center justify-between border-b border-white/5 pb-4 select-none">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💿</span>
          <span className="text-lg font-extrabold text-white tracking-tight">
            VinylStock <span className="text-indigo-400 font-medium">Showroom</span>
          </span>
        </div>
        <button
          onClick={handleShare}
          className="btn-secondary-premium py-2 px-3 text-xs flex items-center gap-2"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">¡Copiado!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 text-gray-400" />
              <span>Compartir Disco</span>
            </>
          )}
        </button>
      </header>

      {/* Main Grid content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Column: Image Viewer */}
        <div className="md:col-span-5 space-y-4">
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden aspect-square flex items-center justify-center relative bg-slate-950/40 select-none">
            {activePhoto ? (
              <img 
                src={activePhoto} 
                alt={`${vinyl.title} cover`} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-600 p-8">
                <Disc className="w-24 h-24 stroke-[1] animate-spin-slow mb-4" />
                <span className="text-xs text-gray-500 font-medium">Sin imagen de portada</span>
              </div>
            )}
            
            {/* Format Tag */}
            <div className="absolute top-4 left-4 bg-indigo-600/90 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border border-indigo-400/30">
              {getFormatBadge(vinyl.format)}
            </div>

            {/* Condition indicators on image */}
            <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-[10px] font-bold text-gray-200 px-3 py-1.5 rounded-lg border border-white/5 flex gap-3">
              <span>Disco: <strong className="text-emerald-400">{vinyl.grade}</strong></span>
              <span>Tapa: <strong className="text-emerald-400">{vinyl.gradeCover}</strong></span>
            </div>
          </div>

          {/* Gallery Thumbnails */}
          {hasPhotos && allPhotos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 select-none">
              {allPhotos.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhoto(photo)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border shrink-0 bg-slate-900 transition-all ${
                    activePhoto === photo 
                      ? 'border-indigo-400 scale-105 shadow-md shadow-indigo-500/20' 
                      : 'border-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={photo} alt="thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Information & Audio Player */}
        <div className="md:col-span-7 space-y-6">
          <div className="space-y-4">
            
            {/* Seller profile tag */}
            <div className="flex items-center gap-2 select-none">
              {seller?.avatar ? (
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: seller.avatarType === 'preset' ? seller.avatar : 'transparent' }}
                >
                  {seller.avatarType === 'upload' ? (
                    <img src={seller.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    (seller.displayName || 'V').charAt(0).toUpperCase()
                  )}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white shrink-0 font-bold">
                  {(seller?.displayName || 'V').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-semibold text-gray-400">
                Ofrecido por <strong className="text-gray-200">{seller?.displayName}</strong>
              </span>
            </div>

            {/* Album Header */}
            <div>
              <span className="text-xs font-extrabold text-indigo-400 tracking-wider uppercase">{vinyl.artist}</span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1 leading-tight uppercase">
                {vinyl.title}
              </h1>
            </div>

            {/* Price section */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400">
                {formatCurrency(vinyl.price, seller?.currency || 'USD')}
              </span>
              {vinyl.status !== 'disponible' && (
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-2 py-0.5 rounded uppercase">
                  {vinyl.status}
                </span>
              )}
            </div>

            {/* WhatsApp Contact Action */}
            <div className="pt-2 select-none">
              {cleanPhone ? (
                <a
                  href={`https://wa.me/${cleanPhone}?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 py-3.5 px-8 rounded-xl font-extrabold text-sm text-white bg-[#25D366] hover:bg-[#20ba59] hover:shadow-lg hover:shadow-[#25d366]/20 transition-all transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <MessageSquare className="w-5 h-5 fill-white/10" />
                  <span>Me interesa / Comprar por WhatsApp</span>
                </a>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-300 text-xs flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Contacto no configurado:</span> El vendedor no ha guardado su número de WhatsApp en la configuración de la cuenta. No es posible contactarlo directamente a través del botón.
                  </div>
                </div>
              )}
            </div>

            {/* Specifications Box */}
            <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-white/5 pb-2">Especificaciones del Disco</h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 block mb-1">Sello Discográfico:</span>
                  <span className="font-semibold text-white">{vinyl.label || 'Desconocido'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Número de Catálogo:</span>
                  <span className="font-semibold text-white">{vinyl.catno || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Año de Edición:</span>
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {vinyl.year || 'Desconocido'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Formato:</span>
                  <span className="font-semibold text-white">{vinyl.format || 'Vinyl'}</span>
                </div>
                <div className="col-span-2 border-t border-white/5 pt-2.5">
                  <span className="text-gray-500 block mb-1">Estado de Conservación:</span>
                  <div className="space-y-1 mt-1 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold font-mono text-[9px] w-8 text-center">{vinyl.grade}</span>
                      <span className="text-gray-300">Vinilo: {getConditionText(vinyl.grade || 'VG+')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold font-mono text-[9px] w-8 text-center">{vinyl.gradeCover}</span>
                      <span className="text-gray-300">Carátula: {getConditionText(vinyl.gradeCover || vinyl.grade || 'VG+')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {vinyl.notes && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Notas del Vendedor</span>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-300 italic leading-relaxed whitespace-pre-wrap flex gap-2">
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p>"{vinyl.notes}"</p>
                </div>
              </div>
            )}

            {/* Audio Preview section */}
            <div className="space-y-3.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Escuchar Grabación</span>
              <AudioPreviewPlayer 
                discogsId={vinyl.discogsId} 
                artist={vinyl.artist} 
                title={vinyl.title} 
              />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function ShowcasePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712]">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    }>
      <ShowcaseContent />
    </Suspense>
  );
}
