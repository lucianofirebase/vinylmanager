'use client';

import React, { useEffect, useState } from 'react';
import { Zap, X } from 'lucide-react';

export default function GpuAccelerationBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem('dismissed_gpu_warning') === 'true') return;

      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (!gl) {
        setShowBanner(true);
        return;
      }

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        if (/swiftshader|software|llvmpipe|basic render|microsoft basic/i.test(renderer)) {
          setShowBanner(true);
        }
      }
    } catch (e) {
      // Ignore check errors
    }
  }, []);

  if (!showBanner) return null;

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('dismissed_gpu_warning', 'true');
    } catch (e) {}
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-xl bg-amber-500/10 backdrop-blur-md border border-amber-500/30 rounded-xl p-3.5 px-5 shadow-2xl flex items-center justify-between gap-4 text-white text-xs animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-amber-400 text-xs mb-0.5">Aceleración por Hardware Desactivada</h4>
          <p className="text-gray-300 text-[11px] leading-tight">
            Para mayor fluidez a 60 FPS, activa la Aceleración por Hardware en los ajustes de tu navegador (<code className="text-amber-300 font-mono">brave://settings/system</code> o <code className="text-amber-300 font-mono">chrome://settings/system</code>).
          </p>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
        title="Cerrar aviso"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
