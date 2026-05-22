'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { LogIn, ShieldAlert, Sparkles, Disc } from 'lucide-react';

export default function LoginPage() {
  const { loginWithGoogle, user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Inicio de sesión cancelado por el usuario.');
      } else if (err.code === 'auth/blocked-by-popup-request') {
        setError('El navegador bloqueó la ventana emergente. Por favor, actívala para continuar.');
      } else {
        setError('Ocurrió un error al iniciar sesión. Inténtalo de nuevo.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#030712] overflow-hidden bg-grid-pattern py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Floating Orbs */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-indigo-500/10 blur-[80px] animate-orb-slow-1 pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-96 h-96 rounded-full bg-purple-500/10 blur-[100px] animate-orb-slow-2 pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-[90px] animate-orb-slow-3 pointer-events-none" />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, cubicBezier: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        <div className="glass-card rounded-2xl p-8 sm:p-10 relative overflow-hidden">
          {/* Subtle top border illumination */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25 mb-4">
              <Disc className="w-7 h-7 text-white animate-spin-slow" strokeWidth={1.5} />
            </div>
            
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-sans select-none">
              VinylStock
            </h2>
            <p className="text-gray-400 text-sm mt-1 text-center max-w-xs">
              Tu catálogo y stock de vinilos en la nube. Gestiona tus discos, precios y ventas con facilidad.
            </p>
          </div>

          {/* Call to Action & Sign In */}
          <div className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm"
              >
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-xl transition duration-200 shadow-md shadow-white/5 active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed group relative"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span className="text-sm font-sans tracking-wide">
                {isSigningIn ? 'Iniciando sesión...' : 'Continuar con Google'}
              </span>
            </button>
          </div>

          {/* Premium tag overlay */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-indigo-400/80 select-none">
            <Sparkles className="w-3.5 h-3.5" />
            <span>VinylStock - Pro Edition</span>
          </div>
        </div>

        {/* Legal / Copyright Footer */}
        <p className="text-center text-xs text-gray-500 mt-6 select-none">
          Al continuar, aceptas nuestros Términos de Servicio y Política de Privacidad.
          <br />
          &copy; {new Date().getFullYear()} VinylStock. Todos los derechos reservados.
        </p>
      </motion.div>
    </div>
  );
}
