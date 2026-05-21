'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#030712] relative overflow-hidden">
      {/* Background Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <span className="text-xs text-gray-500 mt-4 select-none tracking-widest uppercase">Redireccionando...</span>
      </div>
    </div>
  );
}
