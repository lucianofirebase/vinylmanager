'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  User as UserIcon,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Disc,
  MessageSquare,
  HelpCircle,
  RefreshCw,
  FileSpreadsheet,
  TrendingUp,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const { userData, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getUserRole = (ud: typeof userData) => {
    if (!ud) return 'coleccionista';
    if ((ud as any).role) return (ud as any).role;
    return (ud as any).storeName || (ud as any).isPublicStore !== undefined ? 'ambos' : 'coleccionista';
  };
  const userRole = getUserRole(userData);
  const isSeller = userRole === 'vendedor' || userRole === 'ambos';

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Discogs Matcher', path: '/dashboard/discogs-matcher', icon: Sparkles },
    ...(isSeller ? [
      { name: 'Historial de Ventas', path: '/dashboard/ventas', icon: TrendingUp },
      { name: 'WhatsApp Marketing', path: '/whatsapp', icon: MessageSquare },
    ] : []),
    { name: 'Explorar Tiendas', path: '/explorar', icon: Compass },
    { name: 'Configuración', path: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  // Avatar renderer helper
  const renderAvatar = (sizeClass = "w-10 h-10") => {
    if (!userData) return null;
    const initial = userData.username ? userData.username.charAt(0).toUpperCase() : 'V';
    
    if (userData.avatar && userData.avatar.startsWith('linear-gradient')) {
      return (
        <div 
          className={`${sizeClass} rounded-xl flex items-center justify-center font-bold text-white shadow-md select-none text-sm`}
          style={{ background: userData.avatar }}
        >
          {initial}
        </div>
      );
    }

    if (userData.avatar && userData.avatar.startsWith('data:image')) {
      return (
        <img 
          src={userData.avatar} 
          alt="Avatar" 
          className={`${sizeClass} rounded-xl object-cover border border-white/10`} 
        />
      );
    }

    // Fallback if something went wrong
    return (
      <div className={`${sizeClass} rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white`}>
        {initial}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex relative overflow-hidden bg-grid-pattern">
      {/* Background blobs */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none" />

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex shrink-0 flex-col border-r border-white/5 glass-panel h-screen sticky top-0 z-20 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64 lg:w-72'}`}>
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 bg-[#0f172a] border border-white/10 rounded-full p-1 text-gray-400 hover:text-white z-50 hover:bg-white/5 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand header */}
        <Link href="/dashboard" className={`h-16 border-b border-white/5 flex items-center select-none hover:bg-white/5 transition-all cursor-pointer ${isCollapsed ? 'justify-center px-0' : 'px-6 gap-3'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Disc className="w-4.5 h-4.5 text-white animate-spin-slow" strokeWidth={1.5} />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-white tracking-tight leading-none text-base truncate">VinylStock</h1>
              <span className="text-[10px] text-indigo-400 font-medium tracking-widest uppercase">Pro Edition</span>
            </div>
          )}
        </Link>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 border-l-2 border-indigo-500 text-white shadow-sm shadow-indigo-500/5' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                } ${item.name === 'Configuración' ? 'mt-auto' : ''} ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                title={item.name}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-indigo-400' : 'text-gray-400'}`} />
                {!isCollapsed && <span>{item.name === 'Configuración' ? '' : item.name}</span>}
                {!isCollapsed && item.name === 'Configuración' && <span>Configuración</span>}
              </Link>
            );
          })}

          {(pathname === '/dashboard') && (
            <div className="pt-4 mt-2 border-t border-white/5 flex flex-col gap-1.5">
              <button
                onClick={() => window.dispatchEvent(new Event('openSyncDiscogs'))}
                className={`flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white hover:bg-white/5 ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                title="Sincronizar Discogs"
              >
                <RefreshCw className="w-4.5 h-4.5 text-indigo-400" />
                {!isCollapsed && <span>Sincronizar Discogs</span>}
              </button>
              <button
                onClick={() => window.dispatchEvent(new Event('openImportExcel'))}
                className={`flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white hover:bg-white/5 ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                title="Importar Excel"
              >
                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" />
                {!isCollapsed && <span>Importar Excel</span>}
              </button>
              <button
                onClick={() => window.dispatchEvent(new Event('openTutorial'))}
                className={`flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white hover:bg-white/5 ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                title="Ver Tutorial"
              >
                <HelpCircle className="w-4.5 h-4.5 text-gray-400" />
                {!isCollapsed && <span>Ayuda / Tutorial</span>}
              </button>
            </div>
          )}
        </nav>
        {/* System Status Mockup */}
        {!isCollapsed && (
          <div className="px-4 pb-6 space-y-4 select-none">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Estado del Sistema</h4>
            
            <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5 space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-400 font-medium">Almacenamiento</span>
                  <span className="text-[10px] font-bold text-gray-500">14MB / 100MB</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '14%' }}></div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500 font-medium">Última Sync Discogs</span>
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Hoy 14:00
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Card */}
        <div className={`border-t border-white/5 bg-slate-900/30 flex flex-col gap-3 ${isCollapsed ? 'p-3 items-center' : 'p-4'}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            {renderAvatar(isCollapsed ? "w-10 h-10 shrink-0" : "w-10 h-10")}
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-white truncate leading-snug">
                  @{userData?.username || 'usuario'}
                </p>
                <p className="text-[11px] text-gray-500 truncate leading-none">
                  {userData?.email}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/10 transition-all ${isCollapsed ? 'px-0' : 'px-3'}`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden w-full h-16 border-b border-white/5 glass-panel fixed top-0 inset-x-0 z-30 px-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-all cursor-pointer">
            <div className="w-7.5 h-7.5 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-md">
              <Disc className="w-3.5 h-3.5 text-white animate-spin-slow" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-white tracking-tight text-sm">VinylStock</span>
          </Link>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-300"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Drawer (AnimatePresence) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />
            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-80 glass-panel border-l border-white/10 z-50 md:hidden flex flex-col"
            >
              <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between">
                <span className="font-bold text-white text-sm">Navegación</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive 
                          ? 'bg-indigo-600/20 border-l-2 border-indigo-500 text-white' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      } ${item.path === '/settings' ? 'mt-auto' : ''}`}
                    >
                      <Icon className="w-4.5 h-4.5 text-gray-400" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
                
                {pathname === '/dashboard' && (
                  <div className="pt-4 border-t border-white/5 flex flex-col gap-1.5 mt-2 mb-auto">
                    <button
                      onClick={() => { setMobileMenuOpen(false); window.dispatchEvent(new Event('openTutorial')); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                    >
                      <HelpCircle className="w-4.5 h-4.5" />
                      <span>Tutorial</span>
                    </button>
                    <button
                      onClick={() => { setMobileMenuOpen(false); window.dispatchEvent(new Event('openSyncDiscogs')); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white hover:bg-white/5"
                    >
                      <RefreshCw className="w-4.5 h-4.5" />
                      <span>Sincronizar Discogs</span>
                    </button>
                    <button
                      onClick={() => { setMobileMenuOpen(false); window.dispatchEvent(new Event('openImportExcel')); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <FileSpreadsheet className="w-4.5 h-4.5" />
                      <span>Importar Excel</span>
                    </button>
                  </div>
                )}
              </nav>

              {/* User details */}
              <div className="p-5 border-t border-white/5 bg-slate-900/30 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {renderAvatar("w-10 h-10")}
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">
                      @{userData?.username || 'usuario'}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {userData?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16 h-screen overflow-y-auto">
        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
