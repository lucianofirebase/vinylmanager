'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import DashboardShell from '../../../components/DashboardShell';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Award,
  Calendar,
  Music,
  Disc
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { motion } from 'framer-motion';

interface SaleItem {
  id: string;
  vinylId: string;
  artist: string;
  title: string;
  cover: string;
  format: string;
  priceSold: number;
  qtySold: number;
  dateSold: string;
}

export default function VentasPage() {
  const { user, userData } = useAuth();
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const salesCol = collection(db, 'users', user.uid, 'sales');
    const q = query(salesCol, orderBy('dateSold', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: SaleItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as SaleItem);
      });
      setSales(items);
      setLoading(false);
    }, (err) => {
      console.error("Error loading sales:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Statistics
  const totalRevenue = sales.reduce((sum, item) => sum + (item.priceSold * item.qtySold), 0);
  const totalItemsSold = sales.reduce((sum, item) => sum + item.qtySold, 0);
  const highestSale = sales.length > 0 
    ? sales.reduce((prev, current) => (prev.priceSold > current.priceSold) ? prev : current)
    : null;

  return (
    <DashboardShell>
      <div className="space-y-8 select-none">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span>Historial de Ventas</span>
            </h2>
            <p className="text-gray-450 text-sm mt-2 max-w-2xl">
              Monitorea tus ingresos, descubre tus discos más vendidos y gestiona tu crecimiento.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Generado</p>
              <p className="text-2xl font-black text-white">
                {formatCurrency(totalRevenue, userData?.currency)}
              </p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/10 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Discos Vendidos</p>
              <p className="text-2xl font-black text-white">
                {totalItemsSold} <span className="text-sm font-medium text-gray-500">unidades</span>
              </p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-950/10 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
              <Award className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Venta Más Alta</p>
              {highestSale ? (
                <>
                  <p className="text-lg font-black text-white truncate">{highestSale.artist}</p>
                  <p className="text-xs text-emerald-400 font-bold">{formatCurrency(highestSale.priceSold, userData?.currency)}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Sin datos</p>
              )}
            </div>
          </div>
        </div>

        {/* Sales List */}
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 bg-slate-900/40">
            <h3 className="font-bold text-white text-sm">Registro de Ventas</h3>
          </div>
          
          {loading ? (
            <div className="p-10 flex justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : sales.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 space-y-3">
              <ShoppingBag className="w-12 h-12 opacity-20" />
              <p>Aún no tienes ventas registradas.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sales.map((sale, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={sale.id}
                  className="p-4 hover:bg-white/5 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group"
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-white/10 flex items-center justify-center relative">
                      {sale.cover ? (
                        <img src={sale.cover} alt={sale.title} className="w-full h-full object-cover" />
                      ) : (
                        <Disc className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-sm truncate group-hover:text-indigo-300 transition-colors">
                        {sale.title}
                      </p>
                      <p className="text-xs text-gray-400 truncate flex items-center gap-2">
                        <span>{sale.artist}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                        <span>{sale.format}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:gap-8 bg-slate-950/40 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
                    <div className="flex flex-col sm:items-end">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Precio</span>
                      <span className="font-black text-emerald-400">
                        {formatCurrency(sale.priceSold, userData?.currency)}
                      </span>
                    </div>
                    
                    <div className="flex flex-col sm:items-end">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Cantidad</span>
                      <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded-md text-xs">
                        x{sale.qtySold}
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Fecha</span>
                      <div className="flex items-center gap-1.5 text-xs text-gray-300">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        {new Date(sale.dateSold).toLocaleDateString('es-ES', { 
                          day: '2-digit', month: 'short', year: 'numeric' 
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
