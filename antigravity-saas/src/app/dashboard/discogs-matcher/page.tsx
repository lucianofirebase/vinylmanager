'use client';

import React, { useState, useEffect } from 'react';
import DashboardShell from '../../../components/DashboardShell';
import { useAuth } from '../../../context/AuthContext';
import { motion } from 'framer-motion';
import { 
  Disc, 
  Store, 
  MapPin, 
  BarChart3, 
  Download, 
  Settings, 
  Search, 
  Star, 
  HelpCircle, 
  LogOut, 
  ShoppingCart, 
  PiggyBank, 
  Crown, 
  Sparkles, 
  ExternalLink,
  ChevronDown,
  AlertTriangle,
  FileSpreadsheet,
  CloudDownload,
  ArrowRight,
  TrendingUp,
  Package
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';

export default function DiscogsMatcherPage() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'favoritos' | 'marketplace' | 'paso1' | 'stats'>('favoritos');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('Uruguay (UY)');
  const [displayCurrency, setDisplayCurrency] = useState('Dólar Estadounidense ($ USD)');

  // Mock wants with star priority state
  const [wants, setWants] = useState([
    { id: 1, title: 'DR4GO / K...', artist: 'Inner Lakes', isStarred: false, cover: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?auto=format&fit=crop&w=300&q=80' },
    { id: 2, title: 'Team Player...', artist: 'Mr. Ho (2)', isStarred: true, cover: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=300&q=80' },
    { id: 3, title: 'Pacific Standard Time', artist: 'Poolside', isStarred: false, cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80' },
    { id: 4, title: 'Watchin You', artist: 'Saeed & Palash', isStarred: true, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80' },
    { id: 5, title: 'Stopp!', artist: 'Daniela Stickroth', isStarred: false, cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80' },
    { id: 6, title: 'Der Komtur', artist: 'Ideas 4 Imitators', isStarred: false, cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=300&q=80' },
    { id: 7, title: 'Euphoria Simulator', artist: 'Guy Contact', isStarred: true, cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80' },
    { id: 8, title: 'Smooth Operator EP', artist: 'Sade', isStarred: false, cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80' },
    { id: 9, title: 'Abbey Road', artist: 'The Beatles', isStarred: false, cover: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?auto=format&fit=crop&w=300&q=80' },
    { id: 10, title: 'Discovery', artist: 'Daft Punk', isStarred: true, cover: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=300&q=80' },
    { id: 11, title: 'Blue Train', artist: 'John Coltrane', isStarred: false, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80' },
    { id: 12, title: 'Untrue', artist: 'Burial', isStarred: false, cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80' }
  ]);

  const toggleStar = (id: number) => {
    setWants(prev => prev.map(item => item.id === id ? { ...item, isStarred: !item.isStarred } : item));
  };

  const filteredWants = wants.filter(w => 
    w.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    w.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardShell>
      <div className="space-y-8">

        {/* Top App Header & Metrics Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Disc className="w-5 h-5 text-white" />
              </span>
              Discogs Matcher
            </h1>
            <p className="text-gray-400 text-sm mt-1 max-w-2xl">
              Encuentra tiendas con múltiples vinilos de tu lista de deseos para ahorrar en envíos combinados.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3 px-5 text-center min-w-[110px]">
              <span className="text-2xl font-bold text-amber-500 block">839</span>
              <span className="text-[11px] text-gray-400 font-medium">Discos Deseados</span>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3 px-5 text-center min-w-[110px]">
              <span className="text-2xl font-bold text-amber-500 block">1990</span>
              <span className="text-[11px] text-gray-400 font-medium">Vendedores Evaluados</span>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3 px-5 text-center min-w-[110px]">
              <span className="text-2xl font-bold text-amber-500 block">4783</span>
              <span className="text-[11px] text-gray-400 font-medium">Coincidencias</span>
            </div>
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex border-b border-white/10 gap-2">
          <button
            onClick={() => setActiveTab('favoritos')}
            className={`px-5 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'favoritos'
                ? 'text-amber-500 border-amber-500 bg-amber-500/10 rounded-t-xl'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            <Star className="w-4 h-4" /> Selección de Favoritos
          </button>
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`px-5 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'marketplace'
                ? 'text-amber-500 border-amber-500 bg-amber-500/10 rounded-t-xl'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            <Store className="w-4 h-4" /> Vendedores Marketplace
          </button>
          <button
            onClick={() => setActiveTab('paso1')}
            className={`px-5 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'paso1'
                ? 'text-amber-500 border-amber-500 bg-amber-500/10 rounded-t-xl'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Paso 1: Detectar Cuenta
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-5 py-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'stats'
                ? 'text-amber-500 border-amber-500 bg-amber-500/10 rounded-t-xl'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Estadísticas de Lista
          </button>
        </div>

        {/* TAB 1: SELECCIÓN DE FAVORITOS */}
        {activeTab === 'favoritos' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Marca tus discos favoritos / prioritarios</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Usa la estrella (★) para destacar los vinilos que más deseas. Podrás filtrar vendedores que tengan al menos uno de tus seleccionados.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por título o artista..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4" /> Exportar a Sheets
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-xl text-xs font-semibold hover:bg-sky-500/20 transition-all cursor-pointer">
                    <CloudDownload className="w-4 h-4" /> Cruzar con Planilla Local
                  </button>
                </div>
              </div>

              {/* 6 Column Grid matching layout design */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4">
                {filteredWants.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleStar(item.id)}
                    className={`group bg-slate-900 border rounded-xl p-3 flex flex-col items-center relative transition-all duration-300 hover:-translate-y-1 cursor-pointer select-none ${
                      item.isStarred ? 'border-amber-500/50 bg-amber-500/5 shadow-lg shadow-amber-500/10' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(item.id); }}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-slate-900/80 backdrop-blur-sm border border-white/10 hover:scale-110 transition-transform"
                    >
                      <Star className={`w-4 h-4 ${item.isStarred ? 'text-amber-400 fill-amber-400' : 'text-gray-500'}`} />
                    </button>
                    <div className="w-full aspect-square bg-slate-800 mb-3 rounded-lg overflow-hidden border border-white/5 relative">
                      <img src={item.cover} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <p className="text-xs font-semibold text-white text-center truncate w-full" title={`${item.artist} - ${item.title}`}>
                      {item.artist} - {item.title}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t border-white/10 pt-6">
                <button
                  onClick={() => setActiveTab('marketplace')}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3 px-8 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all cursor-pointer"
                >
                  Iniciar Análisis de Vendedores
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: RESULTADOS VENDEDORES MARKETPLACE */}
        {activeTab === 'marketplace' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Smart Buy Options Bento Grid */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Crown className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-bold text-white">Compra Inteligente Consolidada</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Option A */}
                <div className="bg-slate-950/80 border border-white/10 rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-amber-500" /> Opción A: Compra Máxima
                  </h3>
                  <p className="text-xs text-gray-400">Satisface la mayor cantidad de discos de tu Wantlist en una sola compra.</p>

                  <div className="bg-slate-900 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-white text-base">www.hhv.de</span>
                        <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 font-semibold px-2.5 py-0.5 rounded-full">51 discos</span>
                      </div>
                      <span className="font-bold text-amber-400 text-lg">USD $1,187.54</span>
                    </div>

                    <div className="text-xs text-gray-400 space-y-1.5 pt-2 border-t border-white/5">
                      <div className="flex justify-between"><span>Subtotal discos:</span><span>USD $1,022.75</span></div>
                      <div className="flex justify-between"><span>Gastos de envío:</span><span>USD $164.79</span></div>
                      <div className="flex justify-between font-semibold text-amber-400"><span>Promedio por disco:</span><span>USD $23.29</span></div>
                    </div>

                    <button className="w-full py-2.5 border border-amber-500/40 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/10 transition-colors cursor-pointer">
                      Ver oferta y discos ↓
                    </button>
                  </div>
                </div>

                {/* Option B */}
                <div className="bg-slate-950/80 border border-white/10 rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <PiggyBank className="w-5 h-5 text-sky-400" /> Opción B: Compra Eficiente
                  </h3>
                  <p className="text-xs text-gray-400">Prioriza los vendedores con el menor precio promedio por vinilo (mín. 3 discos).</p>

                  <div className="bg-slate-900 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-white text-base">SamLeDisquaire</span>
                        <span className="ml-2 text-xs bg-sky-500/20 text-sky-300 font-semibold px-2.5 py-0.5 rounded-full">4 discos</span>
                      </div>
                      <span className="font-bold text-sky-400 text-lg">USD $43.32</span>
                    </div>

                    <div className="text-xs text-gray-400 space-y-1.5 pt-2 border-t border-white/5">
                      <div className="flex justify-between"><span>Subtotal discos:</span><span>USD $20.30</span></div>
                      <div className="flex justify-between"><span>Gastos de envío:</span><span>USD $23.01</span></div>
                      <div className="flex justify-between font-semibold text-sky-400"><span>Promedio por disco:</span><span>USD $10.83</span></div>
                    </div>

                    <button className="w-full py-2.5 border border-sky-500/40 text-sky-400 rounded-lg text-xs font-semibold hover:bg-sky-500/10 transition-colors cursor-pointer">
                      Ver oferta y discos ↓
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Seller List */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">Todos los Vendedores</h2>
                <span className="text-xs text-gray-400">Mostrando <strong className="text-white">839</strong> resultados</span>
              </div>

              {[
                { name: 'www.hhv.de', rating: '99.5%', country: 'Germany', matches: '51 de 839', subtotal: '$1022.75', shipping: '$164.79', total: '$1187.54' },
                { name: 'decks.de', rating: '99.9%', country: 'Germany', matches: '33 de 839', subtotal: '$623.34', shipping: '$117.99', total: '$741.33' },
                { name: 'mainrecords', rating: '100%', country: 'Germany', matches: '29 de 839', subtotal: '$616.69', shipping: '$86.23', total: '$702.92' }
              ].map((seller, idx) => (
                <div key={idx} className="bg-slate-900/60 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-white text-lg">{seller.name}</h3>
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">{seller.rating}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {seller.country}</span>
                      <span className="text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">Internacional</span>
                      <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> 0 calificaciones</span>
                    </div>
                  </div>

                  <div className="flex gap-6 items-center text-right flex-wrap">
                    <div><p className="text-[11px] text-gray-400">Coincidencias</p><p className="font-semibold text-white text-sm">{seller.matches}</p></div>
                    <div><p className="text-[11px] text-gray-400">Subtotal</p><p className="font-semibold text-white text-sm">{seller.subtotal}</p></div>
                    <div><p className="text-[11px] text-gray-400">Envío</p><p className="font-semibold text-white text-sm">{seller.shipping}</p></div>
                    <div><p className="text-[11px] text-gray-400 font-bold">Total Estimado</p><p className="font-bold text-amber-400 text-lg">{seller.total}</p></div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-amber-600 transition-colors cursor-pointer">
                      Ver en Discogs
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* TAB 3: PASO 1 DETECTAR CUENTA */}
        {activeTab === 'paso1' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center py-6">
            <div className="bg-slate-900/60 border border-dashed border-white/20 rounded-2xl p-8 md:p-12 w-full max-w-2xl text-center space-y-8">
              {/* Stepper */}
              <div className="flex items-center justify-center w-full max-w-xs mx-auto relative">
                <div className="absolute h-[2px] bg-slate-800 w-full top-1/2 -translate-y-1/2 z-0"></div>
                <div className="relative z-10 flex justify-between w-full">
                  <div className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-amber-500/30">1</div>
                  <div className="h-8 w-8 rounded-full bg-slate-800 text-gray-500 flex items-center justify-center font-bold text-sm">2</div>
                  <div className="h-8 w-8 rounded-full bg-slate-800 text-gray-500 flex items-center justify-center font-bold text-sm">3</div>
                </div>
              </div>

              {/* Illustration */}
              <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center mx-auto border border-white/10 relative">
                <Disc className="w-16 h-16 text-amber-500 opacity-60" />
                <div className="absolute -right-2 -top-2 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center border border-white/10 shadow-md">
                  <Search className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Paso 1: Detectar tu cuenta de Discogs</h2>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  La extensión se conecta a tu sesión activa en Discogs para cargar tu lista de deseos de forma segura y automática.
                </p>
              </div>

              <div className="bg-slate-950/80 border border-white/10 rounded-xl p-5 max-w-md mx-auto space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="font-bold text-white text-base">¡Sesión detectada: @{userData?.username || 'Coutoff7'}!</h3>
                </div>
                <p className="text-xs text-gray-400">Asegúrate de estar logueado en discogs.com en este navegador.</p>
              </div>

              <button
                onClick={() => setActiveTab('favoritos')}
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-3 px-12 rounded-full shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all cursor-pointer"
              >
                Continuar
              </button>
            </div>
          </motion.div>
        )}

        {/* TAB 4: ESTADÍSTICAS DE LISTA */}
        {activeTab === 'stats' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Discos a la venta</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-400">760</span>
                  <span className="text-lg text-gray-400">/ 839</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Disponibles para comprar hoy</p>
              </div>

              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Agotados en Discogs</h3>
                <div className="text-3xl font-bold text-red-400">79</div>
                <p className="text-xs text-gray-400 mt-2">Sin copias listadas en venta</p>
              </div>

              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total de ofertas</h3>
                <div className="text-3xl font-bold text-amber-400">4,783</div>
                <p className="text-xs text-gray-400 mt-2">Copias raspadas del marketplace</p>
              </div>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (Top Lists) */}
              <div className="lg:col-span-7 space-y-6">
                {/* Más Económico */}
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="font-bold text-white text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" /> Más Económico (Top 5)
                    </h2>
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded uppercase tracking-wider">El Más Barato</span>
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                      <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-white/10">
                        <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=150&q=80" alt="Vinyl" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate">Saeed & Palash - Watchin You</h4>
                        <p className="text-[11px] text-gray-400 truncate">8 en venta desde US$0.50</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-bold text-emerald-400">USD $0.50</span>
                          <span className="text-[10px] text-gray-400">dustoff (CA)</span>
                        </div>
                      </div>
                      <button className="text-xs font-semibold text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg hover:bg-amber-500/10 cursor-pointer">Ver Oferta</button>
                    </div>
                  </div>
                </div>

                {/* Objeto de Lujo */}
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="font-bold text-white text-sm flex items-center gap-2">
                      <Crown className="w-4 h-4 text-purple-400" /> Objeto de Lujo (Top 5)
                    </h2>
                    <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded uppercase tracking-wider">El Más Costoso</span>
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                      <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-white/10">
                        <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=150&q=80" alt="Vinyl" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate">Daniela Stickroth - Stopp!</h4>
                        <p className="text-[11px] text-gray-400 truncate">2 en venta desde US$116.28</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-bold text-purple-400">USD $297.00</span>
                          <span className="text-[10px] text-gray-400">KARREDB9 (IE)</span>
                        </div>
                      </div>
                      <button className="text-xs font-semibold text-purple-400 border border-purple-500/30 px-3 py-1 rounded-lg hover:bg-purple-500/10 cursor-pointer">Ver Oferta</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (Agotados) */}
              <div className="lg:col-span-5">
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden h-full flex flex-col">
                  <div className="p-4 border-b border-white/10 bg-red-500/10">
                    <h2 className="font-bold text-red-400 text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Discos sin stock (Agotados)
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Estos vinilos de tu lista de deseos no disponen de copias publicadas actualmente en el Marketplace.
                    </p>
                  </div>
                  <div className="p-3 flex-1 space-y-3 overflow-y-auto max-h-96">
                    {[
                      { title: 'Ideas 4 Imitators - Der Komtur', catno: 'CBS - 655723 6', image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=150&q=80' },
                      { title: 'Guy Contact - Euphoria Simulator', catno: 'Haws - HAWS013', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=150&q=80' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-950/60 rounded-xl border border-white/5">
                        <img src={item.image} alt={item.title} className="w-10 h-10 rounded-lg object-cover opacity-60 border border-white/10" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-gray-300 truncate">{item.title}</h4>
                          <p className="text-[10px] text-gray-500">{item.catno}</p>
                        </div>
                        <button className="text-[10px] font-semibold text-gray-400 border border-white/10 px-2.5 py-1 rounded-lg hover:bg-white/5 cursor-pointer">Ver Discogs</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </DashboardShell>
  );
}
