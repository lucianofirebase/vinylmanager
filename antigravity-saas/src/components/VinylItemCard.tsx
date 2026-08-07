'use client';

import React, { memo } from 'react';
import { 
  Check, 
  CheckSquare, 
  Square, 
  Music, 
  Store, 
  Archive, 
  DollarSign, 
  Instagram, 
  Edit2, 
  Trash2 
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export interface VinylItem {
  id: string;
  artist: string;
  title: string;
  price: number;
  qty: number;
  format: string;
  grade: string;
  gradeCover: string;
  label?: string;
  catno?: string;
  year?: string;
  cover?: string;
  status: 'disponible' | 'coleccion' | 'reservado' | 'vendido' | 'borrador';
  dateAdded: string;
  photos?: string[];
  discogsPhotos?: string[];
  discogsId?: number;
  url?: string;
  genres?: string[];
  styles?: string[];
}

interface VinylItemCardProps {
  item: VinylItem;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  activeTab: 'tienda' | 'coleccion';
  currency?: string | null;
  getFormatBadgeColor: (format: string) => string;
  getStatusBadgeColor: (status: string) => string;
  onPreview: (item: VinylItem) => void;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onToggleCollectionStatus: (item: VinylItem, e: React.MouseEvent) => void;
  onSellItem?: (item: VinylItem, e: React.MouseEvent) => void;
  onOpenInstagram?: (item: VinylItem, e: React.MouseEvent) => void;
  onEdit: (item: VinylItem, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

const VinylItemCardComponent: React.FC<VinylItemCardProps> = ({
  item,
  viewMode,
  isSelected,
  activeTab,
  currency,
  getFormatBadgeColor,
  getStatusBadgeColor,
  onPreview,
  onToggleSelect,
  onToggleCollectionStatus,
  onSellItem,
  onOpenInstagram,
  onEdit,
  onDelete,
}) => {
  if (viewMode === 'grid') {
    return (
      <div
        onClick={() => onPreview(item)}
        className={`p-2 rounded-[2rem] bg-white/5 border transition-transform duration-300 ease-out cursor-pointer group flex flex-col relative hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.15)] ${
          isSelected ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/10 hover:border-indigo-500/25'
        }`}
      >
        <div className={`flex-1 flex flex-col overflow-hidden bg-[#0d1326] rounded-[calc(2rem-0.5rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/5 transition-colors duration-300 ${isSelected ? 'bg-indigo-950/20' : ''}`}>
          {/* Select Checkbox Indicator */}
          <div 
            onClick={(e) => onToggleSelect(item.id, e)}
            className="absolute top-5 left-5 z-10 w-6 h-6 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/10 hover:border-indigo-400 hover:bg-black/80 transition-colors"
          >
            {isSelected ? (
              <Check className="w-4 h-4 text-indigo-400" />
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>

          {/* Album Cover */}
          <div className="aspect-square w-full bg-slate-900 flex items-center justify-center relative overflow-hidden border-b border-white/5">
            {item.cover ? (
              <img 
                src={item.cover} 
                alt={`${item.artist} - ${item.title}`} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <Music className="w-12 h-12" />
                <span className="text-[10px] font-semibold uppercase tracking-widest">Sin Portada</span>
              </div>
            )}

            {/* Format and Status Badges */}
            <div className="absolute bottom-3 right-3 flex gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-lg backdrop-blur-md ${getFormatBadgeColor(item.format)}`}>
                {item.format}
              </span>
              {activeTab === 'tienda' && (
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider shadow-lg backdrop-blur-md ${getStatusBadgeColor(item.status)}`}>
                  {item.status}
                </span>
              )}
            </div>

            {/* Hover Quick Actions */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
              <button 
                onClick={(e) => onEdit(item, e)}
                className="p-3 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-xl hover:scale-110 transition-transform"
                title="Editar"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Details */}
          <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <h4 className="text-xs font-black text-indigo-400 tracking-wider uppercase leading-none truncate">
                {item.artist || 'Artista Desconocido'}
              </h4>
              <h3 className="text-base font-bold text-white leading-tight truncate">
                {item.title}
              </h3>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-xs text-gray-500 font-medium">
                Estado: <strong className="text-gray-300 font-semibold">{item.grade}</strong>
              </span>
              {activeTab === 'tienda' && (
                <div className="text-right">
                  <div className="text-lg font-black text-emerald-400">
                    {formatCurrency(item.price, currency)}
                  </div>
                  {item.qty > 1 && (
                    <div className="text-[10px] text-gray-500 font-bold -mt-1">
                      x{item.qty} disponibles
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LIST VIEW ROW
  return (
    <div
      onClick={() => onPreview(item)}
      className={`grid grid-cols-12 p-3.5 items-center hover:bg-white/5 cursor-pointer text-sm font-medium transition-colors duration-150 ${
        isSelected ? 'bg-indigo-950/20' : ''
      }`}
    >
      <div className="col-span-1 pl-1 flex items-center" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={(e) => onToggleSelect(item.id, e)}
          className="p-1 rounded hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
        >
          {isSelected ? (
            <CheckSquare className="w-4.5 h-4.5 text-indigo-400" />
          ) : (
            <Square className="w-4.5 h-4.5" />
          )}
        </button>
      </div>
      
      <div className="col-span-4 pl-2 flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-md bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
          {item.cover ? (
            <img src={item.cover} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <Music className="w-4 h-4 text-gray-500" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white truncate">{item.title}</p>
          <p className="text-xs text-indigo-400 font-semibold truncate uppercase">{item.artist}</p>
        </div>
      </div>

      <div className="col-span-2">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getFormatBadgeColor(item.format)}`}>
          {item.format}
        </span>
      </div>

      {activeTab === 'tienda' && (
        <div className="col-span-2">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getStatusBadgeColor(item.status)}`}>
            {item.status}
          </span>
        </div>
      )}

      {activeTab === 'tienda' && (
        <div className="col-span-2 font-black text-emerald-400">
          {formatCurrency(item.price, currency)}
        </div>
      )}

      <div className={`text-right pr-2 flex items-center justify-end gap-1.5 ${activeTab === 'tienda' ? 'col-span-1' : 'col-span-5'}`} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => onToggleCollectionStatus(item, e)}
          title={activeTab === 'coleccion' ? "Mover a Tienda" : "Mover a Colección"}
          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-colors"
        >
          {activeTab === 'coleccion' ? <Store className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
        </button>
        {activeTab === 'tienda' && (
          <>
            {onSellItem && (
              <button
                onClick={(e) => onSellItem(item, e)}
                title="Vender 1 Unidad"
                className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-colors"
              >
                <DollarSign className="w-4 h-4" />
              </button>
            )}
            {onOpenInstagram && (
              <button
                onClick={(e) => onOpenInstagram(item, e)}
                title="Compartir en Instagram"
                className="p-1.5 rounded-lg hover:bg-indigo-500/10 text-indigo-400 transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </button>
            )}
          </>
        )}
        <button
          onClick={(e) => onEdit(item, e)}
          title="Editar"
          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => onDelete(item.id, e)}
          title="Eliminar"
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-450 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const VinylItemCard = memo(VinylItemCardComponent);
export default VinylItemCard;
