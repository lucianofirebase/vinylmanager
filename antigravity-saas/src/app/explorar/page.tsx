'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import DashboardShell from '../../components/DashboardShell';
import { motion } from 'framer-motion';
import { Search, Store, Disc, MapPin, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface PublicStore {
  uid: string;
  username: string;
  storeName?: string;
  storeBio?: string;
  storeAddress?: string;
  avatar?: string;
  avatarType?: string;
}

export default function ExplorarPage() {
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('isPublicStore', '==', true),
          limit(50)
        );
        const snap = await getDocs(q);
        const result: PublicStore[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          if (d.username) {
            result.push({
              uid: doc.id,
              username: d.username,
              storeName: d.storeName,
              storeBio: d.storeBio,
              storeAddress: d.storeAddress,
              avatar: d.avatar,
              avatarType: d.avatarType,
            });
          }
        });
        setStores(result);
      } catch (err) {
        console.error('Error fetching public stores:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  const filtered = stores.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.storeName || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q)
    );
  });

  const renderAvatar = (store: PublicStore, sizeClass = 'w-12 h-12') => {
    const initial = store.username?.charAt(0).toUpperCase() || 'V';
    if (store.avatar?.startsWith('linear-gradient')) {
      return (
        <div
          className={`${sizeClass} rounded-xl flex items-center justify-center font-bold text-white text-base shrink-0`}
          style={{ background: store.avatar }}
        >
          {initial}
        </div>
      );
    }
    if (store.avatar?.startsWith('data:image')) {
      return <img src={store.avatar} alt="" className={`${sizeClass} rounded-xl object-cover border border-white/10 shrink-0`} />;
    }
    return (
      <div className={`${sizeClass} rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-base shrink-0`}>
        {initial}
      </div>
    );
  };

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span className="text-indigo-400">🏪</span>
              <span>Explorar Tiendas</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Descubrí colecciones y tiendas de discos de otros usuarios de VinylStock.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar tienda o usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 input-premium text-sm"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white/5 rounded-full w-3/4" />
                    <div className="h-2 bg-white/5 rounded-full w-1/2" />
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full w-full" />
                <div className="h-2 bg-white/5 rounded-full w-5/6" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Store className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No se encontraron tiendas</h3>
            <p className="text-gray-500 text-sm max-w-xs">
              {searchQuery ? `No hay tiendas que coincidan con "${searchQuery}".` : 'Aún no hay tiendas públicas registradas.'}
            </p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {filtered.map((store, i) => (
              <motion.div
                key={store.uid}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/${store.username}`}
                  className="block glass-card rounded-2xl p-5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all duration-200 group border border-white/5 h-full"
                >
                  <div className="flex items-start gap-3.5 mb-3">
                    {renderAvatar(store)}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate group-hover:text-indigo-300 transition-colors">
                        {store.storeName || store.username}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">@{store.username}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                  </div>

                  {store.storeBio && (
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3">
                      {store.storeBio}
                    </p>
                  )}

                  {store.storeAddress && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <MapPin className="w-3 h-3 text-indigo-400/60 shrink-0" />
                      <span className="truncate">{store.storeAddress}</span>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-indigo-400/60">
                    <Disc className="w-3 h-3" />
                    <span>Ver catálogo completo</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </DashboardShell>
  );
}
