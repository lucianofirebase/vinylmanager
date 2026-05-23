'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  Instagram, 
  Image as ImageIcon, 
  RefreshCw,
  Sparkles,
  Smartphone,
  Square,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface VinylItem {
  id: string;
  artist: string;
  title: string;
  price: number;
  format: string;
  grade: string;
  gradeCover: string;
  cover?: string;
  label?: string;
  year?: string;
  genres?: string[];
  styles?: string[];
}

interface InstagramCardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  vinyl: VinylItem | null;
  currency: string;
  shopName: string;
}

export default function InstagramCardGenerator({ 
  isOpen, 
  onClose, 
  vinyl, 
  currency, 
  shopName 
}: InstagramCardGeneratorProps) {
  const [format, setFormat] = useState<'post' | 'story'>('post');
  const [copied, setCopied] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen || !vinyl) return;
    drawCanvas();
  }, [isOpen, vinyl, format]);

  const drawCanvas = () => {
    if (!vinyl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setRendering(true);
    setCanvasError(null);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setRendering(false);
      return;
    }

    // Set dimensions
    const width = format === 'post' ? 1080 : 1080;
    const height = format === 'post' ? 1080 : 1920;
    canvas.width = width;
    canvas.height = height;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    // CORS bypass using images.weserv.nl proxy
    const coverUrl = vinyl.cover || '';
    if (coverUrl) {
      if (coverUrl.includes('discogs.com') || coverUrl.startsWith('http')) {
        img.src = `https://images.weserv.nl/?url=${encodeURIComponent(coverUrl)}`;
      } else {
        img.src = coverUrl;
      }
    } else {
      // Draw placeholder if no cover
      drawGraphic(ctx, width, height, null);
    }

    img.onload = () => {
      drawGraphic(ctx, width, height, img);
    };

    img.onerror = () => {
      console.warn("Cover image failed to load via CORS. Using gradient fallback.");
      // Fallback: draw with null image (gradient only)
      drawGraphic(ctx, width, height, null);
      setCanvasError("No se pudo cargar la portada con CORS, usando fondo degradado.");
    };
  };

  const drawGraphic = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    img: HTMLImageElement | null
  ) => {
    if (!vinyl) return;

    // 1. Draw Background
    if (img) {
      // Draw blurred image cover as background
      ctx.save();
      // Draw image filling the screen
      const scale = Math.max(width / img.width, height / img.height);
      const x = (width / 2) - (img.width / 2) * scale;
      const y = (height / 2) - (img.height / 2) * scale;
      
      // Use canvas filters for blur
      ctx.filter = 'blur(40px) saturate(1.2)';
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      ctx.restore();
      
      // Dark overlay
      ctx.fillStyle = 'rgba(11, 15, 26, 0.82)';
      ctx.fillRect(0, 0, width, height);
    } else {
      // Fallback: Nice mesh gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw Decorative Card container (Glassmorphic)
    const cardMargin = format === 'post' ? 80 : 100;
    const cardWidth = width - (cardMargin * 2);
    const cardHeight = height - (cardMargin * 2);
    
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 2;
    
    // Draw rounded rect
    const radius = 40;
    ctx.beginPath();
    ctx.roundRect(cardMargin, cardMargin, cardWidth, cardHeight, radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Draw Album Artwork Centered
    const coverSize = format === 'post' ? 440 : 580;
    const coverX = (width - coverSize) / 2;
    const coverY = format === 'post' ? 140 : 260;

    ctx.save();
    // Shadow for cover
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 15;

    if (img) {
      // Draw rounded cover
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 20);
      ctx.clip();
      ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
    } else {
      // Placeholder cover
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 20);
      ctx.fill();
      
      // Draw musical note icon placeholder
      ctx.fillStyle = '#4f46e5';
      ctx.beginPath();
      ctx.arc(width / 2, coverY + (coverSize / 2), 60, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 80px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💿', width / 2, coverY + (coverSize / 2));
    }
    ctx.restore();

    // Draw cover border
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, 20);
    ctx.stroke();
    ctx.restore();

    // 4. Draw Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Artist
    const artistY = format === 'post' ? 620 : 920;
    ctx.fillStyle = '#818cf8'; // Indigo 400
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(vinyl.artist.toUpperCase(), width / 2, artistY);

    // Title
    const titleY = format === 'post' ? 665 : 975;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    
    // Wrap long titles
    const maxTextWidth = cardWidth - 80;
    const lineHeight = 58;
    const finalTitleY = wrapText(ctx, vinyl.title.toUpperCase(), width / 2, titleY, maxTextWidth, lineHeight);

    // Price
    const priceY = finalTitleY + 80;
    ctx.fillStyle = '#34d399'; // Emerald 400
    ctx.font = '900 64px sans-serif';
    ctx.fillText(formatCurrency(vinyl.price, currency), width / 2, priceY);

    // Format & Grade Info
    const detailsY = priceY + 95;
    ctx.fillStyle = '#9ca3af'; // Gray 400
    ctx.font = '500 24px sans-serif';
    
    let formatLabel = vinyl.format === 'Vinyl' ? 'Vinilo LP' : vinyl.format;
    let gradeLabel = `Disco: ${vinyl.grade} / Tapa: ${vinyl.gradeCover}`;
    ctx.fillText(`${formatLabel}  •  ${gradeLabel}`, width / 2, detailsY);

    // 5. Draw Footer branding watermark
    const footerY = format === 'post' ? height - cardMargin - 50 : height - cardMargin - 70;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`PUBLICADO EN @${shopName.toUpperCase()}`, width / 2, footerY);

    setRendering(false);
  };

  // Helper function to wrap text on canvas
  const wrapText = (
    ctx: CanvasRenderingContext2D, 
    text: string, 
    x: number, 
    y: number, 
    maxWidth: number, 
    lineHeight: number
  ): number => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY;
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !vinyl) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    
    // Create clean file name
    const safeTitle = vinyl.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.download = `vinylstock_${safeTitle}_${format}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateInstagramCaption = (): string => {
    if (!vinyl) return '';
    const formattedPrice = formatCurrency(vinyl.price, currency);
    
    return `💿 ¡NUEVO INGRESO EN CATÁLOGO! 💿\n\n` +
           `🔥 *${vinyl.title.toUpperCase()}* - ${vinyl.artist}\n\n` +
           `🏷️ Formato: ${vinyl.format === 'Vinyl' ? 'Vinilo LP' : vinyl.format}\n` +
           `💿 Estado Disco: ${vinyl.grade}\n` +
           `📁 Estado Tapa: ${vinyl.gradeCover}\n` +
           `${vinyl.label ? `🏷️ Sello: ${vinyl.label}\n` : ''}` +
           `${vinyl.year ? `📅 Año: ${vinyl.year}\n` : ''}` +
           `💰 Precio: *${formattedPrice}*\n\n` +
           `💬 ¡Escríbenos por mensaje directo o haz clic en el enlace de la bio para ver las fotos en detalle y escuchar pistas de audio!\n\n` +
           `#vinilo #vinyl #records #vinyloftheday #vinylstock #music #vinylcollector #tiendadevinilos`;
  };

  const handleCopyCaption = () => {
    const caption = generateInstagramCaption();
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !vinyl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      {/* Modal Box */}
      <div className="glass-card w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 md:p-8 relative border border-white/10 z-10 flex flex-col md:flex-row gap-8">
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Canvas Preview */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider select-none flex items-center gap-1.5 self-start">
            <Instagram className="w-4 h-4 text-pink-500" />
            <span>Previsualización del Diseño</span>
          </h3>

          {/* Wrapper to control preview scale */}
          <div className="w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative bg-slate-900 flex items-center justify-center">
            <canvas 
              ref={canvasRef} 
              className={`w-full max-h-[300px] object-contain rounded-xl ${format === 'story' ? 'aspect-[9/16]' : 'aspect-square'}`}
            />
            {rendering && (
              <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="text-[10px] text-gray-400">Renderizando canvas...</span>
              </div>
            )}
          </div>

          {canvasError && (
            <div className="w-full text-[10px] text-amber-400 bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg text-center leading-tight">
              {canvasError}
            </div>
          )}

          {/* Format selection */}
          <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5 select-none w-full max-w-[280px]">
            <button
              onClick={() => setFormat('post')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                format === 'post' 
                  ? 'bg-indigo-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>Post (1:1)</span>
            </button>
            <button
              onClick={() => setFormat('story')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                format === 'story' 
                  ? 'bg-indigo-500 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Historia (9:16)</span>
            </button>
          </div>
        </div>

        {/* Right Side: Options and Copytext */}
        <div className="w-full md:w-[350px] flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold px-2 py-0.5 rounded select-none">
                Instagram Feed & Story
              </span>
              <h2 className="text-xl font-bold text-white mt-2 leading-tight">
                Generador de Gráficos
              </h2>
              <p className="text-gray-400 text-xs mt-1">
                Descarga la gráfica autogenerada y copia el texto optimizado para promocionar tu vinilo.
              </p>
            </div>

            {/* Album details summary */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-xs space-y-1.5 select-text">
              <p className="text-gray-400">Disco seleccionado:</p>
              <h4 className="font-extrabold text-white uppercase">{vinyl.title}</h4>
              <p className="text-indigo-300 font-semibold">{vinyl.artist}</p>
              <p className="text-emerald-400 font-black">{formatCurrency(vinyl.price, currency)}</p>
            </div>

            {/* Caption Text Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs select-none">
                <span className="text-gray-400 font-medium">Copia el pie de foto (Caption):</span>
                <button 
                  onClick={handleCopyCaption}
                  className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                readOnly
                value={generateInstagramCaption()}
                className="w-full h-44 input-premium text-[11px] font-mono leading-relaxed bg-[#0b0f19] select-all cursor-text"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-4 select-none">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Gráfico (PNG)</span>
            </button>
            <button
              onClick={drawCanvas}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold btn-secondary-premium"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Regenerar Diseño</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
