'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardShell from '../../components/DashboardShell';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { formatCurrency } from '../../lib/utils';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Copy, 
  Send, 
  Check, 
  Loader2, 
  ListFilter, 
  CheckSquare, 
  Square,
  AlertCircle
} from 'lucide-react';

interface VinylItem {
  id: string;
  artist: string;
  title: string;
  price: number;
  format?: string;
  grade?: string;
  gradeCover?: string;
  label?: string;
  photos?: string[];
  discogsPhotos?: string[];
  status?: string;
}

export default function WhatsAppMarketingPage() {
  const { user, userData } = useAuth();
  const [items, setItems] = useState<VinylItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Load available items
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'stock'),
      where('status', '==', 'disponible')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stockItems: VinylItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'coleccion') return; // Skip collection items
        
        stockItems.push({
          id: doc.id,
          artist: data.artist || 'Desconocido',
          title: data.title || 'Título Desconocido',
          price: Number(data.price) || 0,
          format: data.format || 'Vinyl',
          grade: data.grade || 'VG+',
          gradeCover: data.gradeCover || data.grade || 'VG+',
          label: data.label || '',
          photos: data.photos || [],
          discogsPhotos: data.discogsPhotos || [],
          status: data.status || 'disponible'
        });
      });
      // Sort alphabetically by artist, then title
      stockItems.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
      setItems(stockItems);
      // Select all by default
      setSelectedIds(new Set(stockItems.map(i => i.id)));
      setLoading(false);
    }, (error) => {
      console.error("Error loading stock for WhatsApp:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const getFormatIcon = (format?: string) => {
    if (format === 'CD') return '💿';
    if (format === 'Cassette') return '📼';
    return '💿';
  };

  const getGradeText = (grade: string, isCover = false) => {
    const prefix = isCover ? "Tapa " : "Disco ";
    const mapping: Record<string, string> = {
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
  };

  // Generate the formatted WhatsApp text
  const generateWhatsAppText = (): string => {
    if (selectedIds.size === 0) return "";

    let text = "🔥 *NUEVA TANDA - DISPONIBLES* 🔥\n\n";
    
    items.forEach((item) => {
      if (!selectedIds.has(item.id)) return;

      const title = (item.title || 'Título Desconocido').toString().toUpperCase();
      const artist = (item.artist || 'Artista Desconocido').toString();
      const price = item.price || 0;
      const format = item.format || 'Vinyl';
      const formatIcon = getFormatIcon(format);
      
      text += `${formatIcon} *${title}*\n`;
      text += `👤 ${artist}\n`;
      if (item.label) text += `🏷️ ${item.label}\n`;
      
      const gMedia = getGradeText(item.grade || 'VG+');
      const gCover = getGradeText(item.gradeCover || item.grade || 'VG+', true);
      text += `📀 Disco: ${gMedia} | 📁 Tapa: ${gCover}\n`;
      
      const formattedPriceText = formatCurrency(price, userData?.currency);
      text += `💰 *${formattedPriceText}*\n`;

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vinylstockmanager.web.app';
      const publicUrl = `${origin}/v?u=${user?.uid}&id=${item.id}`;
      text += `🔗 Fotos y Audio: ${publicUrl}\n\n`;
      
      text += `--------------------------\n\n`;
    });

    text += "✨ ¡Escríbeme para reservar el tuyo!\n";
    text += "🚚 Envíos a todo el país.";
    
    return text;
  };

  const whatsappText = generateWhatsAppText();

  const handleCopy = () => {
    if (!whatsappText) return;
    navigator.clipboard.writeText(whatsappText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (!whatsappText) return;
    const encoded = encodeURIComponent(whatsappText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 select-none">
              <MessageSquare className="w-8 h-8 text-[#25D366]" />
              <span>WhatsApp Marketing</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Selecciona discos de tu inventario disponible y genera el catálogo listo para grupos de WhatsApp.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
            <p className="text-gray-400 text-sm select-none">Cargando inventario disponible...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center max-w-lg mx-auto border border-white/5 space-y-4">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">No hay discos disponibles</h3>
            <p className="text-gray-400 text-sm">
              Debes agregar vinilos al catálogo con el estado <strong className="text-indigo-400">"Disponible"</strong> en tu Dashboard para generar el catálogo de WhatsApp.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left side: Selector List */}
            <div className="lg:col-span-3 flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
              <div className="glass-card rounded-2xl border border-white/5 p-4 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={toggleSelectAll} 
                      className="p-1 rounded hover:bg-white/5 transition-all text-gray-400 hover:text-white"
                    >
                      {selectedIds.size === items.length ? (
                        <CheckSquare className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <span className="text-xs font-semibold text-gray-300">
                      Seleccionados: {selectedIds.size} de {items.length}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                    Catálogo
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  <AnimatePresence>
                    {items.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          onClick={() => toggleSelectItem(item.id)}
                          className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                            isSelected 
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-white' 
                              : 'bg-white/5 border-white/5 text-gray-450 hover:bg-white/10 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="text-xl shrink-0">
                              {getFormatIcon(item.format)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold truncate pr-2">
                                {item.title.toUpperCase()}
                              </h4>
                              <p className="text-xs text-gray-400 truncate">
                                {item.artist} • {item.format} • {item.grade}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-bold text-emerald-400">
                              {formatCurrency(item.price, userData?.currency)}
                            </span>
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-indigo-500 border-indigo-500 text-white' 
                                : 'border-gray-600'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Right side: WhatsApp Live Preview */}
            <div className="lg:col-span-2 flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
              <div className="glass-card rounded-2xl border border-white/5 flex flex-col h-full overflow-hidden">
                {/* Header Mockup */}
                <div className="bg-[#075e54] px-4 py-3 shrink-0 flex items-center gap-3 select-none">
                  <div className="w-8 h-8 rounded-full bg-[#128c7e] flex items-center justify-center font-bold text-white text-sm">
                    VS
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white leading-none">Mi Grupo de Vinilos</h3>
                    <span className="text-[9px] text-[#25d366] font-semibold">en línea</span>
                  </div>
                </div>

                {/* Preview Message Area */}
                <div className="flex-1 bg-[#0b141a] p-4 overflow-y-auto flex flex-col justify-start relative bg-whatsapp-pattern">
                  {selectedIds.size === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                      <p className="text-gray-500 text-xs">
                        Selecciona al menos un disco del inventario para previsualizar el mensaje.
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-[85%] self-start bg-[#1f2c34] text-[#e9edef] rounded-xl rounded-tl-none p-3 shadow-md border border-white/5 relative">
                      {/* Tail of chat bubble */}
                      <div className="absolute -left-2.5 top-0 w-0 h-0 border-t-[8px] border-t-[#1f2c34] border-l-[10px] border-l-transparent" />
                      <pre className="white-space-pre-wrap font-sans text-xs break-words leading-relaxed select-text">
                        {whatsappText}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-white/5 bg-slate-950/40 space-y-3 shrink-0">
                  <button
                    onClick={handleCopy}
                    disabled={selectedIds.size === 0}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all btn-secondary-premium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-indigo-400" />
                        <span>Copiar al Portapapeles</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSend}
                    disabled={selectedIds.size === 0}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none shadow-md shadow-[#25d366]/10"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar a WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
