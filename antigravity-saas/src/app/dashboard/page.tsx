'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardShell from '../../components/DashboardShell';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, 
  TrendingUp, 
  Clock, 
  Sparkles, 
  Grid, 
  List, 
  Search, 
  Plus, 
  Trash2, 
  Check, 
  FileSpreadsheet, 
  RefreshCw, 
  X, 
  Edit2, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  CheckSquare, 
  Square, 
  ChevronDown, 
  Loader2,
  AlertCircle,
  Instagram,
  ArrowLeft,
  Camera,
  Link as LinkIcon,
  Disc,
  FileText,
  Calendar,
  Layers,
  HelpCircle,
  Store,
  Archive,
  DollarSign,
  Share2
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, repairTextEncoding, getDiscogsIdFromCoverUrl } from '../../lib/utils';
import InstagramCardGenerator from '../../components/InstagramCardGenerator';
import AudioPreviewPlayer from '../../components/AudioPreviewPlayer';
import TutorialModal from '../../components/TutorialModal';

// Discogs credentials from previous legacy configuration
const DISCOGS_KEY = 'kTXBUunaWzBTXwJZlRga';
const DISCOGS_SECRET = 'uZxBlMTEDrEMcPblPAoQChIrhlZivIwz';

interface VinylItem {
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
}

export default function DashboardPage() {
  const { user, userData } = useAuth();
  
  // Real-time stock state
  const [stock, setStock] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection and layout states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewModalItem, setPreviewModalItem] = useState<VinylItem | null>(null);
  const [previewActivePhoto, setPreviewActivePhoto] = useState<string | null>(null);

  // Filter and search states
  const [activeTab, setActiveTab] = useState<'tienda' | 'coleccion'>('tienda');
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'price_asc', 'price_desc'

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VinylItem | null>(null);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [selectedDiscogsItem, setSelectedDiscogsItem] = useState<any | null>(null);
  
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isInstagramOpen, setIsInstagramOpen] = useState(false);
  const [instagramVinyl, setInstagramVinyl] = useState<VinylItem | null>(null);

  // Tutorial Modal
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isFirstTimeTutorial, setIsFirstTimeTutorial] = useState(false);
  useEffect(() => {
    const handleTutorial = () => { setIsFirstTimeTutorial(false); setIsTutorialOpen(true); };
    const handleSyncDiscogs = () => setIsSyncOpen(true);
    const handleImportExcel = () => setIsImportOpen(true);

    window.addEventListener('openTutorial', handleTutorial);
    window.addEventListener('openSyncDiscogs', handleSyncDiscogs);
    window.addEventListener('openImportExcel', handleImportExcel);

    return () => {
      window.removeEventListener('openTutorial', handleTutorial);
      window.removeEventListener('openSyncDiscogs', handleSyncDiscogs);
      window.removeEventListener('openImportExcel', handleImportExcel);
    };
  }, []);

  useEffect(() => {
    if (userData && userData.tutorialCompleted === false) {
      setIsFirstTimeTutorial(true);
      setIsTutorialOpen(true);
    }
  }, [userData]);

  const openInstagramModal = (item: VinylItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setInstagramVinyl(item);
    setIsInstagramOpen(true);
  };
  
  // Autocomplete and Discogs Search states inside Add/Edit Modal
  const [discogsSearchQuery, setDiscogsSearchQuery] = useState('');
  const [discogsSearchResults, setDiscogsSearchResults] = useState<any[]>([]);
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);

  // Form states for Add/Edit
  const [formArtist, setFormArtist] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('0');
  const [formQty, setFormQty] = useState('1');
  const [formFormat, setFormFormat] = useState('Vinyl');
  const [formGrade, setFormGrade] = useState('VG+');
  const [formGradeCover, setFormGradeCover] = useState('VG+');
  const [formLabel, setFormLabel] = useState('');
  const [formCatno, setFormCatno] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formCover, setFormCover] = useState('');
  const [formStatus, setFormStatus] = useState<'disponible' | 'coleccion' | 'reservado' | 'vendido' | 'borrador'>('disponible');
  const [photosList, setPhotosList] = useState<string[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const photoCameraInputRef = useRef<HTMLInputElement>(null);

  // Compress and convert image file to base64 for storage in Firestore
  const compressImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const MAX = 700;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  const [formUrl, setFormUrl] = useState('');
  const [formDiscogsId, setFormDiscogsId] = useState<number | undefined>(undefined);

  // Excel paste import states
  const [importPasteText, setImportPasteText] = useState('');
  const [importData, setImportData] = useState<string[][]>([]);
  const [importStep, setImportStep] = useState(1); // 1 = paste, 2 = mapping, 3 = logs
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [importLogs, setImportLogs] = useState<{ msg: string; type: 'success' | 'warning' | 'error' }[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' });
  const [isImporting, setIsImporting] = useState(false);

  // Discogs Sync states
  const [syncLogs, setSyncLogs] = useState<{ msg: string; type: 'add' | 'skip' | 'error' }[]>([]);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, status: '' });
  const [isSyncing, setIsSyncing] = useState(false);

  // Database Repair modal states
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  interface RepairedItemProposal {
    item: VinylItem;
    originalArtist: string;
    originalTitle: string;
    originalLabel: string;
    proposedArtist: string;
    proposedTitle: string;
    proposedLabel: string;
    selected: boolean;
    resolvedVia: 'discogs' | 'dictionary';
    loading: boolean;
  }
  const [repairProposals, setRepairProposals] = useState<RepairedItemProposal[]>([]);
  const [isApplyingRepairs, setIsApplyingRepairs] = useState(false);
  const [repairLogs, setRepairLogs] = useState<string[]>([]);

  const runNameRepairScan = async () => {
    setIsRepairOpen(true);
    setRepairLogs([]);
    
    // Initial scanning of items in stock
    const proposals: RepairedItemProposal[] = [];
    
    for (const item of stock) {
      const originalArtist = item.artist || '';
      const originalTitle = item.title || '';
      const originalLabel = item.label || '';
      
      const dictArtist = repairTextEncoding(originalArtist);
      const dictTitle = repairTextEncoding(originalTitle);
      const dictLabel = repairTextEncoding(originalLabel);
      
      const discogsId = item.discogsId || (item.cover ? getDiscogsIdFromCoverUrl(item.cover) : null);
      
      const needsRepair = 
        dictArtist !== originalArtist || 
        dictTitle !== originalTitle || 
        dictLabel !== originalLabel ||
        discogsId !== null;
      
      if (needsRepair) {
        proposals.push({
          item,
          originalArtist,
          originalTitle,
          originalLabel,
          proposedArtist: dictArtist,
          proposedTitle: dictTitle,
          proposedLabel: dictLabel,
          selected: dictArtist !== originalArtist || dictTitle !== originalTitle || dictLabel !== originalLabel,
          resolvedVia: 'dictionary',
          loading: discogsId !== null
        });
      }
    }
    
    setRepairProposals(proposals);
    
    // Run background Discogs fetch for proposals that have a Discogs ID
    for (let i = 0; i < proposals.length; i++) {
      const prop = proposals[i];
      const discogsId = prop.item.discogsId || (prop.item.cover ? getDiscogsIdFromCoverUrl(prop.item.cover) : null);
      
      if (discogsId) {
        try {
          // Delay to respect Discogs rate limits (1000ms)
          await new Promise(r => setTimeout(r, 1000));
          
          const res = await fetch(`https://api.discogs.com/releases/${discogsId}?key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
          if (res.ok) {
            const details = await res.json();
            const discogsArtist = details.artists ? details.artists[0].name.replace(/\s\(\d+\)$/, '') : prop.originalArtist;
            const discogsTitle = details.title || prop.originalTitle;
            const discogsLabel = details.labels && details.labels.length > 0 ? details.labels[0].name : prop.originalLabel;
            
            const hasDiff = 
              discogsArtist !== prop.originalArtist || 
              discogsTitle !== prop.originalTitle || 
              discogsLabel !== prop.originalLabel;
              
            setRepairProposals(prev => prev.map((p, idx) => {
              if (idx === i) {
                return {
                  ...p,
                  proposedArtist: discogsArtist,
                  proposedTitle: discogsTitle,
                  proposedLabel: discogsLabel,
                  resolvedVia: 'discogs',
                  selected: hasDiff,
                  loading: false
                };
              }
              return p;
            }));
          } else {
            setRepairProposals(prev => prev.map((p, idx) => {
              if (idx === i) {
                return { ...p, loading: false };
              }
              return p;
            }));
          }
        } catch (e) {
          console.error("Error fetching Discogs details for repair: ", e);
          setRepairProposals(prev => prev.map((p, idx) => {
            if (idx === i) {
              return { ...p, loading: false };
            }
            return p;
          }));
        }
      }
    }
  };

  const applyNameRepairs = async () => {
    if (!user) return;
    setIsApplyingRepairs(true);
    setRepairLogs(prev => [...prev, "Iniciando reparación de nombres..."]);
    
    let count = 0;
    const selectedProposals = repairProposals.filter(p => p.selected && !p.loading);
    
    for (const prop of selectedProposals) {
      try {
        const docRef = doc(db, 'users', user.uid, 'stock', prop.item.id);
        const updates: any = {
          artist: prop.proposedArtist,
          title: prop.proposedTitle
        };
        if (prop.proposedLabel) {
          updates.label = prop.proposedLabel;
        }
        
        const discogsId = prop.item.discogsId || (prop.item.cover ? getDiscogsIdFromCoverUrl(prop.item.cover) : null);
        if (discogsId && !prop.item.discogsId) {
          updates.discogsId = discogsId;
        }
        
        await updateDoc(docRef, updates);
        count++;
        setRepairLogs(prev => [...prev, `✅ Reparándolo: "${prop.originalArtist} - ${prop.originalTitle}" ➔ "${prop.proposedArtist} - ${prop.proposedTitle}"`]);
      } catch (err) {
        console.error("Error repairing document: ", err);
        setRepairLogs(prev => [...prev, `❌ Error en: "${prop.originalArtist} - ${prop.originalTitle}": ${(err as Error).message}`]);
      }
    }
    
    setRepairLogs(prev => [...prev, `¡Reparación finalizada! Se actualizaron ${count} discos.`]);
    setIsApplyingRepairs(false);
  };

  // Real-time listener for user stock
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'stock'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: VinylItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          artist: data.artist || 'Desconocido',
          title: data.title || 'Título Desconocido',
          price: Number(data.price) || 0,
          qty: Number(data.qty) || 1,
          format: data.format || 'Vinyl',
          grade: data.grade || 'VG+',
          gradeCover: data.gradeCover || data.grade || 'VG+',
          label: data.label || '',
          catno: data.catno || '',
          year: data.year || '',
          cover: data.cover || '',
          status: data.status || 'disponible',
          dateAdded: data.dateAdded || new Date().toISOString(),
          photos: data.photos || [],
          discogsPhotos: data.discogsPhotos || [],
          discogsId: data.discogsId || undefined,
          url: data.url || ''
        });
      });
      setStock(items);
      setLoading(false);
    }, (err) => {
      console.error("Error loading stock:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Statistics
  const tabStock = stock.filter((item) => 
    activeTab === 'tienda' 
      ? (item.status !== 'coleccion' && item.status !== 'vendido') 
      : item.status === 'coleccion'
  );

  const totalItems = tabStock.reduce((sum, item) => sum + (item.qty || 1), 0);
  const availableItems = tabStock
    .filter((i) => i.status === 'disponible')
    .reduce((sum, item) => sum + (item.qty || 1), 0);
  const totalValue = tabStock
    .filter((i) => i.status === 'disponible' || i.status === 'coleccion')
    .reduce((sum, item) => sum + (Number(item.price) || 0) * (item.qty || 1), 0);

  // Sorting and Filtering
  const filteredStock = tabStock.filter((item) => {
    const matchesSearch = 
      item.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.label && item.label.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFormat = formatFilter === 'All' || item.format === formatFilter;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;

    return matchesSearch && matchesFormat && matchesStatus;
  });

  const sortedStock = [...filteredStock].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    }
    if (sortBy === 'price_asc') {
      return a.price - b.price;
    }
    if (sortBy === 'price_desc') {
      return b.price - a.price;
    }
    return 0;
  });

  // Handle individual item selection
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
    if (selectedIds.size === sortedStock.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedStock.map(i => i.id)));
    }
  };

  // Bulk Actions
  const handleBulkSell = async () => {
    if (!user || selectedIds.size === 0) return;
    if (!confirm(`¿Estás seguro de registrar la venta de los ${selectedIds.size} discos seleccionados?`)) return;

    try {
      const batch = writeBatch(db);
      const salesCol = collection(db, 'users', user.uid, 'sales');
      
      selectedIds.forEach((id) => {
        const item = stock.find(i => i.id === id);
        if (!item) return;

        const docRef = doc(db, 'users', user.uid, 'stock', id);
        if (item.qty > 1) {
          batch.update(docRef, { qty: item.qty - 1 });
        } else {
          batch.update(docRef, { status: 'vendido' });
        }

        const newSaleRef = doc(salesCol);
        batch.set(newSaleRef, {
          vinylId: item.id,
          artist: item.artist,
          title: item.title,
          cover: item.cover,
          format: item.format,
          priceSold: Number(item.price) || 0,
          qtySold: 1,
          dateSold: new Date().toISOString()
        });
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error bulk selling:", err);
      alert("Ocurrió un error al vender en lote.");
    }
  };

  const handleSellItem = async (item: VinylItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;
    
    try {
      const batch = writeBatch(db);
      const docRef = doc(db, 'users', user.uid, 'stock', item.id);
      
      if (item.qty > 1) {
        batch.update(docRef, { qty: item.qty - 1 });
      } else {
        batch.update(docRef, { status: 'vendido' });
      }

      const salesCol = collection(db, 'users', user.uid, 'sales');
      const newSaleRef = doc(salesCol);
      batch.set(newSaleRef, {
        vinylId: item.id,
        artist: item.artist,
        title: item.title,
        cover: item.cover,
        format: item.format,
        priceSold: Number(item.price) || 0,
        qtySold: 1,
        dateSold: new Date().toISOString()
      });

      await batch.commit();

      if (previewModalItem?.id === item.id) {
        setPreviewModalItem(null);
      }

    } catch (err) {
      console.error("Error selling item:", err);
      alert("Error al registrar la venta.");
    }
  };

  const handleBulkDelete = async () => {
    if (!user || selectedIds.size === 0) return;
    if (!confirm(`¿Estás seguro de ELIMINAR permanentemente los ${selectedIds.size} discos seleccionados?`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        const docRef = doc(db, 'users', user.uid, 'stock', id);
        batch.delete(docRef);
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error bulk deleting:", err);
      alert("Ocurrió un error al eliminar en lote.");
    }
  };

  // Add/Edit Form Handlers
  const openAddModal = () => {
    setEditingItem(null);
    setSelectedDiscogsItem(null);
    setFormStep(1);
    setFormArtist('');
    setFormTitle('');
    setFormPrice('0');
    setFormQty('1');
    setFormFormat('Vinyl');
    setFormGrade('VG+');
    setFormGradeCover('VG+');
    setFormLabel('');
    setFormCatno('');
    setFormYear('');
    setFormCover('');
    setFormStatus('disponible');
    setPhotosList([]);
    setPhotoUrlInput('');
    setFailedImages(new Set());
    setFormUrl('');
    setFormDiscogsId(undefined);
    setDiscogsSearchQuery('');
    setDiscogsSearchResults([]);
    setIsAddEditOpen(true);
  };

  const openEditModal = (item: VinylItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    if (item.discogsId) {
      setSelectedDiscogsItem({
        title: item.title,
        artist: item.artist,
        cover: item.cover || '',
        year: item.year || '',
        label: item.label || '',
        catno: item.catno || '',
        id: item.discogsId
      });
    } else {
      setSelectedDiscogsItem(null);
    }
    setFormStep(2);
    setFormArtist(item.artist);
    setFormTitle(item.title);
    setFormPrice(item.price.toString());
    setFormQty(item.qty.toString());
    setFormFormat(item.format);
    setFormGrade(item.grade);
    setFormGradeCover(item.gradeCover);
    setFormLabel(item.label || '');
    setFormCatno(item.catno || '');
    setFormYear(item.year || '');
    setFormCover(item.cover || '');
    setFormStatus(item.status);
    setPhotosList(item.photos || []);
    setPhotoUrlInput('');
    setFailedImages(new Set());
    setFormUrl('');
    setFormDiscogsId(item.discogsId);
    setDiscogsSearchQuery('');
    setDiscogsSearchResults([]);
    setIsAddEditOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const data: Omit<VinylItem, 'id'> = {
      artist: repairTextEncoding(formArtist.trim()),
      title: repairTextEncoding(formTitle.trim()),
      price: Number(formPrice) || 0,
      qty: Number(formQty) || 1,
      format: formFormat,
      grade: formGrade,
      gradeCover: formGradeCover,
      label: repairTextEncoding(formLabel.trim()),
      catno: formCatno.trim(),
      year: formYear.trim(),
      cover: formCover.trim(),
      status: formStatus,
      photos: photosList,
      dateAdded: editingItem ? editingItem.dateAdded : new Date().toISOString(),
      url: formUrl.trim()
    };

    if (formDiscogsId) {
      data.discogsId = formDiscogsId;
    }

    try {
      if (editingItem) {
        // Edit existing
        const docRef = doc(db, 'users', user.uid, 'stock', editingItem.id);
        await updateDoc(docRef, data as any);

        // Switch tabs automatically if status changed between coleccion and others
        if (editingItem.status !== formStatus) {
          if (formStatus === 'coleccion') setActiveTab('coleccion');
          else if (editingItem.status === 'coleccion') setActiveTab('tienda');
        }
      } else {
        // Create new
        const stockCol = collection(db, 'users', user.uid, 'stock');
        await addDoc(stockCol, data);
        
        // Switch tab based on new item's status
        if (formStatus === 'coleccion') setActiveTab('coleccion');
        else setActiveTab('tienda');
      }
      setIsAddEditOpen(false);
    } catch (err) {
      console.error("Error saving vinyl item:", err);
      alert("Hubo un error al guardar el disco.");
    }
  };

  const handleToggleCollectionStatus = async (item: VinylItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    // Si movemos a la tienda, abrimos el modal de edición para pedir precio/cantidad
    if (item.status === 'coleccion') {
      setPreviewModalItem(null);
      openEditModal({ ...item, status: 'disponible' }, e);
      return;
    }

    // Si movemos a la colección, es directo
    try {
      const docRef = doc(db, 'users', user.uid, 'stock', item.id);
      await updateDoc(docRef, { status: 'coleccion' });
      setStock((prev) => prev.map((v) => v.id === item.id ? { ...v, status: 'coleccion' } : v));
      
      setPreviewModalItem(null);
      setActiveTab('coleccion');
    } catch (err) {
      console.error("Error al mover el item", err);
    }
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (!confirm("¿Seguro de que deseas eliminar este disco?")) return;

    try {
      const docRef = doc(db, 'users', user.uid, 'stock', id);
      await deleteDoc(docRef);
      if (previewModalItem?.id === id) setPreviewModalItem(null);
    } catch (err) {
      console.error("Error deleting vinyl item:", err);
      alert("Error al eliminar.");
    }
  };

  // Search Discogs Autocomplete
  const handleDiscogsSearch = async () => {
    if (!discogsSearchQuery.trim()) return;
    setIsSearchingDiscogs(true);
    try {
      const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(discogsSearchQuery)}&key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}&type=release`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDiscogsSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Error searching Discogs API:", err);
    } finally {
      setIsSearchingDiscogs(false);
    }
  };

  const selectDiscogsResult = async (result: any) => {
    // Fill basic fields from result
    const parts = result.title.split(' - ');
    const artist = parts[0] || '';
    const title = parts[1] || result.title;

    setFormArtist(artist);
    setFormTitle(title);
    setFormCover(result.cover_image || '');
    setFormYear(result.year || '');
    setFormDiscogsId(result.id);
    setFormUrl(`https://www.discogs.com${result.uri || ''}`);

    if (result.label && result.label.length > 0) {
      setFormLabel(result.label[0]);
    } else {
      setFormLabel('');
    }
    if (result.catno) {
      setFormCatno(result.catno);
    } else {
      setFormCatno('');
    }

    setSelectedDiscogsItem({
      title: title,
      artist: artist,
      cover: result.cover_image || '',
      year: result.year || '',
      label: result.label?.[0] || '',
      catno: result.catno || '',
      id: result.id
    });

    setDiscogsSearchResults([]);
    setDiscogsSearchQuery('');
    setFormStep(2);
  };

  // Excel Paste Import Logic
  const processImportPaste = () => {
    let text = importPasteText.trim();
    if (!text) {
      alert("Por favor, pega el contenido copiado de tu Excel primero.");
      return;
    }

    // Repair character encoding errors (like "Los Olimare os" or "M sica" or mojibake)
    const repairedText = repairTextEncoding(text);
    if (repairedText !== text) {
      text = repairedText;
      setImportPasteText(repairedText);
    }

    const lines = text.split('\n');
    const rows = lines.map((line) => line.split('\t'));
    setImportData(rows);

    // Set a default initial mapping: column 0 is artist, column 1 is title
    const initialMapping: Record<string, number> = {};
    if (rows[0] && rows[0].length > 0) initialMapping.artist = 0;
    if (rows[0] && rows[0].length > 1) initialMapping.title = 1;

    setColumnMapping(initialMapping);
    setImportStep(2);
  };

  const startExcelImport = async () => {
    if (!user) return;
    const hasBasic = columnMapping.artist !== undefined && columnMapping.title !== undefined;
    const hasUrl = columnMapping.url !== undefined;

    if (!hasBasic && !hasUrl) {
      alert("Debes asignar al menos las columnas de 'Artista' y 'Título', o la columna 'Link Discogs'.");
      return;
    }

    setIsImporting(true);
    setImportStep(3);
    setImportLogs([]);

    const total = importData.length;
    setImportProgress({ current: 0, total, status: 'Iniciando importación...' });

    for (let i = 0; i < total; i++) {
      const row = importData[i];
      let artist = columnMapping.artist !== undefined ? row[columnMapping.artist]?.trim() || 'Desconocido' : 'Desconocido';
      let title = columnMapping.title !== undefined ? row[columnMapping.title]?.trim() || 'Desconocido' : 'Desconocido';
      const url = columnMapping.url !== undefined ? row[columnMapping.url]?.trim() || '' : '';
      const price = columnMapping.price !== undefined ? parseFloat(row[columnMapping.price].replace('$', '').trim()) || 0 : 0;
      const qty = columnMapping.qty !== undefined ? parseInt(row[columnMapping.qty]) || 1 : 1;
      const grade = columnMapping.grade !== undefined ? row[columnMapping.grade]?.trim() || 'VG+' : 'VG+';
      const format = columnMapping.format !== undefined ? row[columnMapping.format]?.trim() || 'Vinyl' : 'Vinyl';

      setImportProgress({ current: i + 1, total, status: `Procesando: ${artist} - ${title}` });

      try {
        let itemData: any = null;

        // Try extracting information from Discogs link if present
        let urlArtist = '';
        let urlTitle = '';
        if (url && url.includes('discogs.com')) {
          const slugMatch = url.match(/\/(release|master)\/\d+-(.+)$/);
          if (slugMatch && slugMatch[2]) {
            const slug = slugMatch[2].replace(/-/g, ' ');
            const parts = slug.split(' ');
            urlArtist = parts[0] || '';
            urlTitle = parts.slice(1).join(' ') || '';
            if (artist === 'Desconocido') artist = urlArtist;
            if (title === 'Desconocido') title = urlTitle;
          }

          const idMatch = url.match(/\/(release|master)\/(\d+)/);
          if (idMatch) {
            const type = idMatch[1] === 'release' ? 'releases' : 'masters';
            const id = idMatch[2];
            try {
              const res = await fetch(`https://api.discogs.com/${type}/${id}?key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
              if (res.ok) {
                const details = await res.json();
                itemData = {
                  artist: details.artists ? details.artists[0].name : (urlArtist || artist),
                  title: details.title || (urlTitle || title),
                  cover: details.images && details.images.length > 0 ? details.images[0].resource_url : '',
                  year: details.year ? details.year.toString() : '',
                  label: details.labels && details.labels.length > 0 ? details.labels[0].name : '',
                  catno: details.labels && details.labels.length > 0 ? details.labels[0].catno : '',
                  discogsId: details.id
                };
              }
            } catch (e) {
              console.error(`Fallo fetch directo para link ${id}`);
            }
          }
        }

        // Search Discogs database if no details fetched yet
        if (!itemData && artist !== 'Desconocido' && title !== 'Desconocido') {
          const searchName = `${artist} ${title}`;
          const res = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(searchName)}&format=${format}&key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
          if (res.ok) {
            const searchData = await res.json();
            const bestMatch = searchData.results && searchData.results[0];
            if (bestMatch) {
              itemData = {
                artist: bestMatch.title.split(' - ')[0] || artist,
                title: bestMatch.title.split(' - ')[1] || bestMatch.title || title,
                cover: bestMatch.cover_image || '',
                year: bestMatch.year || '',
                label: bestMatch.label ? bestMatch.label[0] : '',
                catno: bestMatch.catno || '',
                discogsId: bestMatch.id
              };
            }
          }
        }

        if (!itemData) {
          itemData = { artist, title, cover: '', year: '', label: '', catno: '' };
        }

        const newItem = {
          ...itemData,
          artist: repairTextEncoding(itemData.artist || ''),
          title: repairTextEncoding(itemData.title || ''),
          label: repairTextEncoding(itemData.label || ''),
          price,
          qty,
          grade,
          gradeCover: grade,
          format,
          status: price > 0 ? 'disponible' : 'borrador',
          dateAdded: new Date().toISOString(),
          url
        };

        const stockCol = collection(db, 'users', user.uid, 'stock');
        await addDoc(stockCol, newItem);

        setImportLogs((prev) => [
          { 
            msg: `✅ Importado: ${newItem.artist} - ${newItem.title} (${newItem.format})` + 
                 (itemData.discogsId ? '' : ' [Cargado manualmente]'), 
            type: itemData.discogsId ? 'success' : 'warning' 
          },
          ...prev
        ]);

      } catch (err) {
        console.error("Error importing line: ", err);
        setImportLogs((prev) => [
          { msg: `❌ Error en fila ${i+1}: ${artist} - ${title}`, type: 'error' },
          ...prev
        ]);
      }

      // Discogs rate limit delay (1.5 seconds)
      await new Promise((r) => setTimeout(r, 1500));
    }

    setImportProgress((prev) => ({ ...prev, status: '¡Importación finalizada!' }));
    setIsImporting(false);
  };

  const closeImportModal = () => {
    setIsImportOpen(false);
    setImportPasteText('');
    setImportData([]);
    setImportStep(1);
    setImportLogs([]);
  };

  // Discogs Collection Sincronizador
  const startDiscogsSync = async () => {
    if (!user || !userData) return;
    const discogsUser = (userData as any)?.discogsUsername;

    if (!discogsUser) {
      alert("Primero debes configurar tu usuario de Discogs en la página de Configuración.");
      return;
    }

    setIsSyncing(true);
    setSyncLogs([]);
    setSyncProgress({ current: 0, total: 0, status: `Buscando colección de @${discogsUser}...` });

    try {
      const res = await fetch(`https://api.discogs.com/users/${discogsUser}/collection/folders/0/releases?per_page=100&sort=added&sort_order=desc`);
      if (!res.ok) {
        throw new Error("No se pudo acceder a tu colección. ¿Es pública en tu perfil de Discogs?");
      }

      const data = await res.json();
      const releases = data.releases || [];
      const total = releases.length;

      if (total === 0) {
        setSyncProgress({ current: 0, total: 0, status: 'La colección de Discogs está vacía.' });
        setIsSyncing(false);
        return;
      }

      setSyncProgress({ current: 0, total, status: 'Procesando colección...' });

      let addedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < releases.length; i++) {
        const rel = releases[i];
        const info = rel.basic_information;

        // Check for duplicates locally
        const exists = stock.some(
          (item) => 
            item.artist.toLowerCase() === info.artists[0].name.toLowerCase() &&
            item.title.toLowerCase() === info.title.toLowerCase()
        );

        if (exists) {
          skippedCount++;
          setSyncLogs((prev) => [
            { msg: `⏭️ Saltado (ya existe): ${info.artists[0].name} - ${info.title}`, type: 'skip' },
            ...prev
          ]);
        } else {
          const newItem = {
            artist: info.artists[0].name,
            title: info.title,
            label: info.labels && info.labels.length > 0 ? info.labels[0].name : '',
            year: info.year ? info.year.toString() : '',
            catno: info.labels && info.labels.length > 0 ? info.labels[0].catno : '',
            cover: info.cover_image || '',
            format: info.formats && info.formats.length > 0 ? info.formats[0].name : 'Vinyl',
            price: 0,
            qty: 1,
            grade: 'VG+',
            gradeCover: 'VG+',
            status: 'coleccion',
            dateAdded: new Date().toISOString(),
            discogsId: rel.id,
            url: `https://www.discogs.com/release/${rel.id}`
          };

          const stockCol = collection(db, 'users', user.uid, 'stock');
          await addDoc(stockCol, newItem);

          addedCount++;
          setSyncLogs((prev) => [
            { msg: `✅ Agregado: ${newItem.artist} - ${newItem.title}`, type: 'add' },
            ...prev
          ]);
        }

        setSyncProgress({ 
          current: i + 1, 
          total, 
          status: `Procesando ${i + 1} de ${total}... (${addedCount} agregados, ${skippedCount} saltados)` 
        });

        // Throttle to respect Discogs rate limits (500ms)
        await new Promise((r) => setTimeout(r, 500));
      }

      setSyncProgress({ 
        current: total, 
        total, 
        status: `Sincronización finalizada. Nuevos: ${addedCount}, Saltados: ${skippedCount}` 
      });

    } catch (err: any) {
      console.error("Error syncing Discogs:", err);
      setSyncLogs((prev) => [
        { msg: `❌ Error: ${err.message}`, type: 'error' },
        ...prev
      ]);
      setSyncProgress((prev) => ({ ...prev, status: 'Error al sincronizar.' }));
    } finally {
      setIsSyncing(false);
    }
  };

  const getFormatBadgeColor = (format: string) => {
    if (format === 'CD') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (format === 'Cassette') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'disponible':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'coleccion':
        return 'bg-violet-500/10 text-violet-450 border-violet-500/20';
      case 'reservado':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'vendido':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'borrador':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-transparent';
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-8 select-none">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            {userData?.isPublicStore === false && (
              <div className="mb-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-sm text-indigo-200">
                    Tu tienda está <strong className="text-white">privada</strong>. Actívala para empezar a vender.
                  </p>
                </div>
                <Link 
                  href="/settings"
                  className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-colors whitespace-nowrap"
                >
                  Activar Tienda
                </Link>
              </div>
            )}
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 select-none">
              <span className="text-indigo-400">💿</span>
              <span>Mi Inventario de Vinilos</span>
            </h2>
            <p className="text-gray-450 text-sm mt-1">
              Gestiona tu colección, stock de ventas, importaciones y sincronización en tiempo real.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => { setIsFirstTimeTutorial(false); setIsTutorialOpen(true); }}
              className="hidden md:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Ver Tutorial"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsSyncOpen(true)}
              className="hidden md:flex btn-secondary-premium py-2 px-4 text-xs font-semibold items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sincronizar Discogs</span>
            </button>
            <button 
              onClick={() => setIsImportOpen(true)}
              className="hidden md:flex btn-secondary-premium py-2 px-4 text-xs font-semibold items-center gap-2"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Importar Excel</span>
            </button>
            <button 
              onClick={async () => {
                if (!userData?.username) {
                  alert("Primero debes configurar tu nombre de usuario en Configuración.");
                  return;
                }
                const url = `${window.location.origin}/${userData.username}`;
                try {
                  await navigator.clipboard.writeText(url);
                  alert("¡Enlace copiado! " + url);
                } catch (e) {
                  console.error(e);
                }
              }}
              className="hidden md:flex btn-secondary-premium py-2 px-4 text-xs font-semibold items-center gap-2"
              title="Copiar enlace de Tienda Pública"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Compartir Tienda</span>
            </button>
            <button 
              onClick={openAddModal}
              className="btn-premium py-2 px-4.5 text-xs font-semibold flex items-center gap-2"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Añadir Disco</span>
            </button>
          </div>
        </div>

        {/* Tabs Separator */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-px mt-2">
          <button
            onClick={() => setActiveTab('tienda')}
            className={`py-2 px-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'tienda' 
                ? 'border-indigo-400 text-indigo-400' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Mi Tienda
          </button>
          <button
            onClick={() => setActiveTab('coleccion')}
            className={`py-2 px-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'coleccion' 
                ? 'border-indigo-400 text-indigo-400' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Mi Colección
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-indigo-500/10">
            <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 opacity-10 blur-xl group-hover:opacity-20 transition-all" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  <Music className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Total en Catálogo</span>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <h3 className="text-4xl font-black text-white">{totalItems} <span className="text-sm text-gray-500 font-semibold">discos</span></h3>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <TrendingUp className="w-3 h-3" />
                <span>+5% este mes</span>
              </div>
            </div>
          </div>

          {activeTab === 'tienda' && (
            <>
              <div className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-emerald-500/10">
                <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 opacity-10 blur-xl group-hover:opacity-20 transition-all" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <Check className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Disponibles Venta</span>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <h3 className="text-4xl font-black text-white">{availableItems} <span className="text-sm text-gray-500 font-semibold">items</span></h3>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3" />
                    <span>+2 recientes</span>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-amber-500/10">
                <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 opacity-10 blur-xl group-hover:opacity-20 transition-all" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Valor de Stock</span>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{formatCurrency(totalValue, userData?.currency)}</h3>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Toolbar & Filters */}
        <div className="glass-card rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/5 select-none">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por artista, álbum o sello..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 focus:border-indigo-500/50 rounded-xl text-sm font-medium focus:outline-none transition-all placeholder:text-gray-500"
              />
            </div>

            {/* Format Filter */}
            <div className="relative">
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="w-full sm:w-auto appearance-none bg-white/5 border border-white/5 focus:border-indigo-500/50 hover:bg-white/10 rounded-xl text-sm font-medium py-2 pl-4 pr-10 focus:outline-none transition-all cursor-pointer"
              >
                <option value="All" className="bg-[#0f172a] text-white">Formatos: Todos</option>
                <option value="Vinyl" className="bg-[#0f172a] text-white">Vinyl</option>
                <option value="CD" className="bg-[#0f172a] text-white">CD</option>
                <option value="Cassette" className="bg-[#0f172a] text-white">Cassette</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto appearance-none bg-white/5 border border-white/5 focus:border-indigo-500/50 hover:bg-white/10 rounded-xl text-sm font-medium py-2 pl-4 pr-10 focus:outline-none transition-all cursor-pointer"
              >
                <option value="All" className="bg-[#0f172a] text-white">Estados: Todos</option>
                <option value="disponible" className="bg-[#0f172a] text-white">Disponible</option>
                <option value="coleccion" className="bg-[#0f172a] text-white">En Colección</option>
                <option value="reservado" className="bg-[#0f172a] text-white">Reservado</option>
                <option value="borrador" className="bg-[#0f172a] text-white">Borrador</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Sort Filter */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-auto appearance-none bg-white/5 border border-white/5 focus:border-indigo-500/50 hover:bg-white/10 rounded-xl text-sm font-medium py-2 pl-4 pr-10 focus:outline-none transition-all cursor-pointer"
              >
                <option value="recent" className="bg-[#0f172a] text-white">Ordenar: Recientes</option>
                <option value="price_asc" className="bg-[#0f172a] text-white">Precio: Menor a Mayor</option>
                <option value="price_desc" className="bg-[#0f172a] text-white">Precio: Mayor a Menor</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto select-none">
            {/* View Mode */}
            <div className="flex rounded-xl bg-white/5 p-1 border border-white/5">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Selected Items Bulk Actions bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-indigo-950/65 backdrop-blur-md border border-indigo-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none"
            >
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                <span className="text-sm font-bold text-indigo-200">
                  {selectedIds.size} discos seleccionados en este lote
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBulkSell}
                  className="bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-all"
                >
                  Marcar Vendidos
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-900/60 hover:bg-red-900 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-all"
                >
                  Eliminar Selección
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-gray-400 hover:text-white text-xs font-semibold py-2 px-3 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stock Catalog List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
            <p className="text-gray-400 text-sm">Cargando catálogo en tiempo real...</p>
          </div>
        ) : sortedStock.length === 0 ? (
          <div className="glass-card rounded-2xl p-16 text-center max-w-lg mx-auto border border-white/5 space-y-4">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">Catálogo vacío</h3>
            <p className="text-gray-400 text-sm">
              No se encontraron discos que coincidan con los filtros seleccionados o no has agregado ningún vinilo todavía.
            </p>
            <button 
              onClick={openAddModal}
              className="btn-premium py-2 px-4 text-xs font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir primer vinilo</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 select-none">
            {sortedStock.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setPreviewModalItem(item);
                    setPreviewActivePhoto(item.photos?.[0] || item.discogsPhotos?.[0] || item.cover || null);
                  }}
                  className={`glass-card rounded-2xl overflow-hidden cursor-pointer border transition-all duration-300 flex flex-col group relative hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(99,102,241,0.2)] ${
                    isSelected ? 'border-indigo-500/50 bg-indigo-950/5' : 'border-white/5 hover:border-indigo-500/30'
                  }`}
                >
                  {/* Select Checkbox Indicator */}
                  <div 
                    onClick={(e) => toggleSelect(item.id, e)}
                    className="absolute top-3 left-3 z-10 w-6 h-6 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/10 hover:border-indigo-400 hover:bg-black/80 transition-all"
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
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
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
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item);
                          setIsAddEditOpen(true);
                        }}
                        className="p-3 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-xl hover:scale-110 transition-all"
                        title="Editar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
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
                            {formatCurrency(item.price, userData?.currency)}
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
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="overflow-x-auto w-full scrollbar-thin">
            <div className="glass-card rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden select-none min-w-[750px]">
            <div className="grid grid-cols-12 p-4 text-xs font-bold text-gray-500 bg-slate-950/30 border-b border-white/5 items-center">
              <div className="col-span-1 flex items-center gap-2 pl-1">
                <button 
                  onClick={toggleSelectAll} 
                  className="p-1 rounded hover:bg-white/5 transition-all text-gray-400 hover:text-white"
                >
                  {selectedIds.size === sortedStock.length ? (
                    <CheckSquare className="w-4.5 h-4.5 text-indigo-400" />
                  ) : (
                    <Square className="w-4.5 h-4.5" />
                  )}
                </button>
              </div>
              <div className="col-span-4 pl-2">Álbum / Artista</div>
              <div className="col-span-2">Formato</div>
              {activeTab === 'tienda' && <div className="col-span-2">Estado</div>}
              {activeTab === 'tienda' && <div className="col-span-2">Precio</div>}
              <div className={`text-right pr-2 ${activeTab === 'tienda' ? 'col-span-1' : 'col-span-5'}`}>Acciones</div>
            </div>

            {sortedStock.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setPreviewModalItem(item);
                    setPreviewActivePhoto(item.photos?.[0] || item.discogsPhotos?.[0] || item.cover || null);
                  }}
                  className={`grid grid-cols-12 p-3.5 items-center hover:bg-white/5 cursor-pointer text-sm font-medium ${
                    isSelected ? 'bg-indigo-950/5' : ''
                  }`}
                >
                  <div className="col-span-1 pl-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={(e) => toggleSelect(item.id, e)}
                      className="p-1 rounded hover:bg-white/5 transition-all text-gray-400 hover:text-white"
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
                        <img src={item.cover} alt="" className="w-full h-full object-cover" />
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
                      {formatCurrency(item.price, userData?.currency)}
                    </div>
                  )}

                  <div className={`text-right pr-2 flex items-center justify-end gap-1.5 ${activeTab === 'tienda' ? 'col-span-1' : 'col-span-5'}`} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleToggleCollectionStatus(item, e)}
                      title={activeTab === 'coleccion' ? "Mover a Tienda" : "Mover a Colección"}
                      className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-all"
                    >
                      {activeTab === 'coleccion' ? <Store className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                    {activeTab === 'tienda' && (
                      <>
                        <button
                          onClick={(e) => handleSellItem(item, e)}
                          title="Vender 1 Unidad"
                          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-all"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => openInstagramModal(item, e)}
                          title="Compartir en Instagram"
                          className="p-1.5 rounded-lg hover:bg-indigo-500/10 text-indigo-400 transition-all"
                        >
                          <Instagram className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => openEditModal(item, e)}
                      title="Editar vinilo"
                      className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteItem(item.id, e)}
                      title="Eliminar vinilo"
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-450 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* MODAL: ADD / EDIT VINYL */}
        <AnimatePresence>
          {isAddEditOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddEditOpen(false)}
                className="absolute inset-0 bg-black/90"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#0f172a] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl relative border border-white/10 z-10 overflow-hidden shadow-2xl shadow-black/80"
              >
                {/* Background Floating Orbs */}
                <div className="absolute top-0 left-0 w-60 h-60 rounded-full bg-indigo-500/10 blur-[60px] animate-orb-slow-1 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-purple-500/10 blur-[60px] animate-orb-slow-2 pointer-events-none" />
                
                {/* Subtle top border illumination */}
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

                <div className="relative z-10 p-6 sm:p-8 space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 select-none">
                      <span className="text-indigo-400">💿</span>
                      <span>{editingItem ? 'Editar Vinilo' : 'Añadir Nuevo Vinilo'}</span>
                    </h3>
                    <button 
                      onClick={() => setIsAddEditOpen(false)}
                      className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {formStep === 1 && !editingItem ? (
                      <motion.div
                        key="step-search"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        {/* Decorative spinning vinyl */}
                        <div className="flex flex-col items-center text-center py-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                            className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-650 to-purple-600 shadow-xl shadow-indigo-500/20 mb-4 relative select-none"
                          >
                            <span className="text-3xl">💿</span>
                            <div className="absolute w-3 h-3 rounded-full bg-[#030712] border border-white/30" />
                          </motion.div>
                          
                          <h4 className="text-2xl font-black text-white tracking-tight text-gradient-primary">
                            Buscador Discogs
                          </h4>
                          <p className="text-gray-400 text-xs mt-1 max-w-sm">
                            Auto-completa los detalles del disco al instante, o ingresa la información manualmente.
                          </p>
                        </div>

                        {/* Autocomplete / Search Discogs Bar */}
                        <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-3 shadow-inner">
                          <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block">
                            Buscar Álbum o Artista
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Ej: The Beatles Abbey Road, Pink Floyd, Daft Punk..."
                                value={discogsSearchQuery}
                                onChange={(e) => setDiscogsSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleDiscogsSearch()}
                                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-white placeholder-gray-500 transition-all"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleDiscogsSearch}
                              disabled={isSearchingDiscogs}
                              className="btn-premium py-2.5 px-5 text-xs font-bold shrink-0 flex items-center gap-2"
                            >
                              {isSearchingDiscogs ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Search className="w-3.5 h-3.5" />
                                  <span>Buscar</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Results layout */}
                          {discogsSearchResults.length > 0 && (
                            <div className="mt-4 space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1">
                                Resultados de Discogs
                              </p>
                              <div className="space-y-2">
                                {discogsSearchResults.slice(0, 5).map((res) => (
                                  <div
                                    key={res.id}
                                    onClick={() => selectDiscogsResult(res)}
                                    className="flex items-center gap-3.5 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/8 cursor-pointer transition-all duration-200 group"
                                  >
                                    {res.cover_image ? (
                                      <img
                                        src={res.cover_image}
                                        alt=""
                                        className="w-11 h-11 object-cover rounded-lg shadow-md border border-white/10 group-hover:scale-105 transition-all duration-200 shrink-0"
                                      />
                                    ) : (
                                      <div className="w-11 h-11 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center shrink-0">
                                        <Music className="w-5 h-5 text-gray-500" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-white text-xs truncate group-hover:text-indigo-300 transition-colors">
                                        {res.title}
                                      </p>
                                      <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                        {res.label?.[0] || 'Sello desconocido'} • {res.year || 'Año desconocido'}
                                      </p>
                                    </div>
                                    <Plus className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors shrink-0 ml-2" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Premium watermark tag */}
                        <div className="flex items-center justify-center gap-2 text-[10px] text-indigo-400/60 select-none py-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>VinylStock - Búsqueda en base de datos global</span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDiscogsItem(null);
                              setFormStep(2);
                            }}
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors py-2"
                          >
                            ✍️ Cargar datos manualmente
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddEditOpen(false)}
                            className="btn-secondary-premium py-2 px-5 text-xs font-semibold w-full sm:w-auto"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="step-form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-5"
                      >
                        {/* Selected Discogs item showcase */}
                        {selectedDiscogsItem ? (
                          <div className="relative p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex gap-4 items-center">
                            <div className="absolute top-2.5 right-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full tracking-wider">
                              Discogs Match
                            </div>
                            {selectedDiscogsItem.cover ? (
                              <img
                                src={selectedDiscogsItem.cover}
                                alt=""
                                className="w-14 h-14 object-cover rounded-xl border border-white/10 shadow-md shadow-black/30 shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center shrink-0">
                                <Music className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-white text-sm truncate">{selectedDiscogsItem.title}</h4>
                              <p className="text-xs text-indigo-300 font-medium truncate mt-0.5">{selectedDiscogsItem.artist}</p>
                              <p className="text-[10px] text-gray-400 mt-1 truncate">
                                {selectedDiscogsItem.label} {selectedDiscogsItem.year ? `• ${selectedDiscogsItem.year}` : ''} {selectedDiscogsItem.catno ? `• Cat: ${selectedDiscogsItem.catno}` : ''}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="pb-2 border-b border-white/5">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                              {editingItem ? 'Editando información del vinilo' : 'Cargando datos manualmente'}
                            </h4>
                          </div>
                        )}

                        {/* Actual Form */}
                        <form onSubmit={handleSaveItem} className="space-y-4">
                          {/* Basic Fields */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Artista</label>
                              <input
                                type="text"
                                value={formArtist}
                                onChange={(e) => setFormArtist(e.target.value)}
                                className="w-full input-premium py-2 text-sm"
                                placeholder="Ej: Pink Floyd"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Título del Álbum</label>
                              <input
                                type="text"
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                className="w-full input-premium py-2 text-sm"
                                placeholder="Ej: The Dark Side of the Moon"
                                required
                              />
                            </div>
                          </div>

                          {/* Commercial Grid */}
                          <div className={`grid grid-cols-2 ${formStatus === 'coleccion' ? 'sm:grid-cols-2' : 'sm:grid-cols-4'} gap-4 bg-white/2 border border-white/5 p-4 rounded-2xl`}>
                            {formStatus !== 'coleccion' && (
                              <>
                                <div className="space-y-1.5 col-span-1">
                                  <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block">
                                    Precio ({userData?.currency || 'USD'})
                                  </label>
                                  <input
                                    type="number"
                                    value={formPrice}
                                    onChange={(e) => setFormPrice(e.target.value)}
                                    className="w-full input-premium py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
                                    min="0"
                                    required
                                  />
                                </div>
                                <div className="space-y-1.5 col-span-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Cantidad</label>
                                  <input
                                    type="number"
                                    value={formQty}
                                    onChange={(e) => setFormQty(e.target.value)}
                                    className="w-full input-premium py-2 text-sm"
                                    min="1"
                                    required
                                  />
                                </div>
                              </>
                            )}
                            <div className="space-y-1.5 col-span-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Formato</label>
                              <div className="relative">
                                <select
                                  value={formFormat}
                                  onChange={(e) => setFormFormat(e.target.value)}
                                  className="w-full bg-[#111827] border border-white/10 rounded-xl py-2 px-3 pr-8 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-white appearance-none cursor-pointer"
                                >
                                  <option value="Vinyl" className="bg-[#0c101d] text-white">Vinyl</option>
                                  <option value="CD" className="bg-[#0c101d] text-white">CD</option>
                                  <option value="Cassette" className="bg-[#0c101d] text-white">Cassette</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            <div className="space-y-1.5 col-span-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Estado Venta</label>
                              <div className="relative">
                                <select
                                  value={formStatus}
                                  onChange={(e) => setFormStatus(e.target.value as any)}
                                  className="w-full bg-[#111827] border border-white/10 rounded-xl py-2 px-3 pr-8 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-white appearance-none cursor-pointer"
                                >
                                  <option value="disponible" className="bg-[#0c101d] text-white">Disponible</option>
                                  <option value="coleccion" className="bg-[#0c101d] text-white">En Colección</option>
                                  <option value="reservado" className="bg-[#0c101d] text-white">Reservado</option>
                                  <option value="borrador" className="bg-[#0c101d] text-white">Borrador</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                          </div>

                          {/* Grading & Details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/2 border border-white/5 p-4 rounded-2xl">
                            <div className="space-y-1.5 col-span-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Estado Disco</label>
                              <div className="relative">
                                <select
                                  value={formGrade}
                                  onChange={(e) => setFormGrade(e.target.value)}
                                  className="w-full bg-[#111827] border border-white/10 rounded-xl py-2 px-3 pr-8 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-white appearance-none cursor-pointer"
                                >
                                  <option value="MINT" className="bg-[#0c101d] text-white">M (Mint)</option>
                                  <option value="NM" className="bg-[#0c101d] text-white">NM (Near Mint)</option>
                                  <option value="VG+" className="bg-[#0c101d] text-white">VG+ (Very Good Plus)</option>
                                  <option value="VG" className="bg-[#0c101d] text-white">VG (Very Good)</option>
                                  <option value="G+" className="bg-[#0c101d] text-white">G+ (Good Plus)</option>
                                  <option value="G" className="bg-[#0c101d] text-white">G (Good)</option>
                                  <option value="F" className="bg-[#0c101d] text-white">F (Fair)</option>
                                  <option value="P" className="bg-[#0c101d] text-white">P (Poor)</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            <div className="space-y-1.5 col-span-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Estado Tapa</label>
                              <div className="relative">
                                <select
                                  value={formGradeCover}
                                  onChange={(e) => setFormGradeCover(e.target.value)}
                                  className="w-full bg-[#111827] border border-white/10 rounded-xl py-2 px-3 pr-8 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-white appearance-none cursor-pointer"
                                >
                                  <option value="MINT" className="bg-[#0c101d] text-white">M (Mint)</option>
                                  <option value="NM" className="bg-[#0c101d] text-white">NM (Near Mint)</option>
                                  <option value="VG+" className="bg-[#0c101d] text-white">VG+ (Very Good Plus)</option>
                                  <option value="VG" className="bg-[#0c101d] text-white">VG (Very Good)</option>
                                  <option value="G+" className="bg-[#0c101d] text-white">G+ (Good Plus)</option>
                                  <option value="G" className="bg-[#0c101d] text-white">G (Good)</option>
                                  <option value="F" className="bg-[#0c101d] text-white">F (Fair)</option>
                                  <option value="P" className="bg-[#0c101d] text-white">P (Poor)</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            <div className="space-y-1.5 col-span-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Año</label>
                              <input
                                type="text"
                                value={formYear}
                                onChange={(e) => setFormYear(e.target.value)}
                                className="w-full input-premium py-2 text-sm"
                                placeholder="Ej: 1973"
                              />
                            </div>
                            <div className="space-y-1.5 col-span-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Ref. Catálogo</label>
                              <input
                                type="text"
                                value={formCatno}
                                onChange={(e) => setFormCatno(e.target.value)}
                                className="w-full input-premium py-2 text-sm"
                                placeholder="Ej: SHVL 804"
                              />
                            </div>
                          </div>

                          {/* Technical/Advanced Fields */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Sello Discográfico</label>
                            <input
                              type="text"
                              value={formLabel}
                              onChange={(e) => setFormLabel(e.target.value)}
                              className="w-full input-premium py-2 text-sm"
                              placeholder="Ej: Harvest, EMI"
                            />
                          </div>

                          {/* Real Photos */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                              <span>Fotos Reales del Vinilo</span>
                              <span className={`font-mono ${photosList.length >= 5 ? 'text-amber-400' : 'text-gray-600'}`}>
                                {photosList.length}/5
                              </span>
                            </label>

                            {/* Upload buttons row */}
                            <div className="flex gap-2">
                              {/* Camera button */}
                              <button
                                type="button"
                                disabled={isUploadingPhoto || photosList.length >= 5}
                                onClick={() => photoCameraInputRef.current?.click()}
                                className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-white/10 bg-slate-800/40 hover:bg-slate-700/40 hover:border-indigo-500/30 transition-all text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Camera className="w-5 h-5" />
                                <span className="text-[10px] font-semibold">Cámara</span>
                              </button>

                              {/* Gallery / file button */}
                              <button
                                type="button"
                                disabled={isUploadingPhoto || photosList.length >= 5}
                                onClick={() => photoFileInputRef.current?.click()}
                                className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-white/10 bg-slate-800/40 hover:bg-slate-700/40 hover:border-indigo-500/30 transition-all text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-5 h-5" />
                                <span className="text-[10px] font-semibold">Galería</span>
                              </button>

                              {/* Hidden inputs */}
                              <input
                                ref={photoCameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={async (e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (!files.length) return;
                                  setIsUploadingPhoto(true);
                                  for (const file of files) {
                                    if (photosList.length >= 5) break;
                                    try {
                                      const b64 = await compressImageToBase64(file);
                                      setPhotosList(prev => prev.length < 5 ? [...prev, b64] : prev);
                                    } catch (err) {
                                      console.error('Error processing photo:', err);
                                    }
                                  }
                                  setIsUploadingPhoto(false);
                                  e.target.value = '';
                                }}
                              />
                              <input
                                ref={photoFileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={async (e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (!files.length) return;
                                  setIsUploadingPhoto(true);
                                  for (const file of files) {
                                    if (photosList.length >= 5) break;
                                    try {
                                      const b64 = await compressImageToBase64(file);
                                      setPhotosList(prev => prev.length < 5 ? [...prev, b64] : prev);
                                    } catch (err) {
                                      console.error('Error processing photo:', err);
                                    }
                                  }
                                  setIsUploadingPhoto(false);
                                  e.target.value = '';
                                }}
                              />
                            </div>

                            {/* Upload progress indicator */}
                            {isUploadingPhoto && (
                              <div className="flex items-center gap-2 text-xs text-indigo-400 py-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Subiendo foto...</span>
                              </div>
                            )}

                            {/* URL input (optional, collapsible) */}
                            <div className="flex gap-2">
                              <input
                                type="url"
                                placeholder="O pegar URL de foto (Imgur, etc.)"
                                value={photoUrlInput}
                                onChange={(e) => setPhotoUrlInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const trimmed = photoUrlInput.trim();
                                    if (trimmed) {
                                      if (!photosList.includes(trimmed)) {
                                        setPhotosList(prev => [...prev, trimmed]);
                                      }
                                      setPhotoUrlInput('');
                                    }
                                  }
                                }}
                                className="flex-1 input-premium py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const trimmed = photoUrlInput.trim();
                                  if (trimmed) {
                                    if (!photosList.includes(trimmed)) {
                                      setPhotosList(prev => [...prev, trimmed]);
                                    }
                                    setPhotoUrlInput('');
                                  }
                                }}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                              >
                                <LinkIcon className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Thumbnails list */}
                            {photosList.length > 0 && (
                              <div className="flex flex-wrap gap-3 pt-2">
                                {photosList.map((url, idx) => {
                                  const isFailed = failedImages.has(url);
                                  return (
                                    <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-slate-800/50 flex items-center justify-center shadow-md shrink-0">
                                      {isFailed ? (
                                        <Music className="w-5 h-5 text-gray-500" />
                                      ) : (
                                        <img
                                          src={url}
                                          alt={`Foto ${idx + 1}`}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          onError={() => {
                                            setFailedImages(prev => {
                                              const next = new Set(prev);
                                              next.add(url);
                                              return next;
                                            });
                                          }}
                                        />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setPhotosList(prev => prev.filter((_, i) => i !== idx))}
                                        className="absolute top-1 right-1 bg-black/70 hover:bg-red-650 text-white rounded-full p-0.5 transition-colors z-10"
                                        title="Eliminar foto"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Discogs Url */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Enlace de Discogs (opcional)</label>
                            <input
                              type="text"
                              placeholder="Ej: https://www.discogs.com/release/..."
                              value={formUrl}
                              onChange={(e) => setFormUrl(e.target.value)}
                              className="w-full input-premium py-2 text-sm"
                            />
                          </div>

                          {/* Actions */}
                          <div className="border-t border-white/5 pt-5 flex flex-col sm:flex-row justify-between gap-4">
                            <div>
                              {!editingItem && (
                                <button
                                  type="button"
                                  onClick={() => setFormStep(1)}
                                  className="btn-secondary-premium py-2.5 px-4 text-xs font-semibold w-full sm:w-auto flex items-center justify-center gap-2"
                                >
                                  <ArrowLeft className="w-3.5 h-3.5" />
                                  <span>Volver al buscador</span>
                                </button>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 justify-end w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => setIsAddEditOpen(false)}
                                className="btn-secondary-premium py-2.5 px-5 text-sm flex-1 sm:flex-none"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="btn-premium py-2.5 px-6 text-sm flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
                              >
                                <Check className="w-4 h-4" />
                                <span>{editingItem ? 'Guardar Cambios' : 'Añadir Disco'}</span>
                              </button>
                            </div>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: EXCEL PASTE IMPORT */}
        <AnimatePresence>
          {isImportOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={closeImportModal}
                className="absolute inset-0 bg-black"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="glass-card w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 relative border border-white/10 z-10 space-y-6"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5.5 h-5.5 text-emerald-400" />
                    <span>Importador Inteligente de Excel</span>
                  </h3>
                  <button 
                    onClick={closeImportModal}
                    className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400"
                    disabled={isImporting}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* STEP 1: PASTE DATA */}
                {importStep === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400">
                      Copia las celdas directamente desde Microsoft Excel o Google Sheets (con cabeceras o sin ellas) y pégalas en el siguiente recuadro:
                    </p>
                    <textarea
                      rows={8}
                      placeholder="Artista	Título	Link Discogs	Precio	Cantidad	Estado	Formato&#10;The Beatles	Abbey Road	https://www.discogs.com/release/...	45000	1	VG+	Vinyl..."
                      value={importPasteText}
                      onChange={(e) => setImportPasteText(e.target.value)}
                      className="w-full p-4 bg-slate-950/60 border border-white/10 focus:border-indigo-500/50 rounded-2xl text-xs font-mono focus:outline-none focus:ring-0 leading-normal"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={processImportPaste}
                        className="btn-premium py-2 px-5 text-xs font-bold"
                      >
                        Procesar Pegado
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: COLUMN MAPPING */}
                {importStep === 2 && (
                  <div className="space-y-5">
                    <p className="text-xs text-gray-450">
                      Asigna la cabecera correspondiente a cada columna de tus datos para que el importador procese correctamente cada campo:
                    </p>

                    <div className="overflow-x-auto max-h-[300px] border border-white/5 rounded-2xl">
                      <table className="min-w-full divide-y divide-white/5 text-left text-xs">
                        <thead className="bg-slate-950/40">
                          <tr>
                            {importData[0]?.map((_, colIdx) => (
                              <th key={colIdx} className="p-3">
                                <select
                                  value={
                                    Object.keys(columnMapping).find(k => columnMapping[k] === colIdx) || 'skip'
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setColumnMapping((prev) => {
                                      const next = { ...prev };
                                      // Remove old mapping for this key if exists
                                      if (value !== 'skip') {
                                        // clear keys mapping to the target colIdx
                                        Object.keys(next).forEach(k => {
                                          if (next[k] === colIdx) delete next[k];
                                        });
                                        next[value] = colIdx;
                                      } else {
                                        // find the key that was mapping to colIdx and delete it
                                        const key = Object.keys(next).find(k => next[k] === colIdx);
                                        if (key) delete next[key];
                                      }
                                      return next;
                                    });
                                  }}
                                  className="bg-indigo-950/80 text-indigo-200 border border-indigo-500/35 rounded-lg py-1 px-2.5 text-xs cursor-pointer outline-none focus:ring-0 font-bold"
                                >
                                  <option value="skip" className="bg-[#0f172a] text-white">❌ Ignorar</option>
                                  <option value="artist" className="bg-[#0f172a] text-white">👤 Artista</option>
                                  <option value="title" className="bg-[#0f172a] text-white">💿 Título</option>
                                  <option value="url" className="bg-[#0f172a] text-white">🔗 Link Discogs</option>
                                  <option value="price" className="bg-[#0f172a] text-white">💰 Precio</option>
                                  <option value="qty" className="bg-[#0f172a] text-white">🔢 Cantidad</option>
                                  <option value="grade" className="bg-[#0f172a] text-white">⭐ Estado</option>
                                  <option value="format" className="bg-[#0f172a] text-white">📻 Formato</option>
                                </select>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-slate-900/10">
                          {importData.slice(0, 5).map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-3 text-gray-400 border border-white/5 truncate max-w-[150px]">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between border-t border-white/5 pt-4">
                      <button
                        onClick={() => setImportStep(1)}
                        className="btn-secondary-premium py-2 px-4 text-xs font-semibold"
                      >
                        Atrás
                      </button>
                      <button
                        onClick={startExcelImport}
                        className="btn-premium py-2 px-5 text-xs font-bold"
                      >
                        Comenzar Importación
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: PROGRESS & LOGS */}
                {importStep === 3 && (
                  <div className="space-y-5">
                    {/* Progress details */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-gray-300">
                        <span>{importProgress.status}</span>
                        <span>{importProgress.current} / {importProgress.total}</span>
                      </div>
                      <div className="w-full bg-slate-800/40 h-2.5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Logs view */}
                    <div className="h-64 overflow-y-auto p-4 rounded-2xl bg-slate-950/90 border border-white/5 font-mono text-xs space-y-1">
                      {importLogs.map((log, index) => (
                        <div 
                          key={index}
                          className={
                            log.type === 'error' ? 'text-red-400' :
                            log.type === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                          }
                        >
                          {log.msg}
                        </div>
                      ))}
                      {importLogs.length === 0 && (
                        <div className="text-gray-600 text-center py-20 select-none">
                          Esperando el inicio de importación...
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end border-t border-white/5 pt-4">
                      <button
                        onClick={closeImportModal}
                        disabled={isImporting}
                        className="btn-premium py-2 px-5 text-xs font-bold disabled:opacity-50"
                      >
                        Finalizar & Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: DISCOGS COLECTION SYNC */}
        <AnimatePresence>
          {isSyncOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => !isSyncing && setIsSyncOpen(false)}
                className="absolute inset-0 bg-black"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="glass-card w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 relative border border-white/10 z-10 space-y-6"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-indigo-400" />
                    <span>Sincronización con la Colección de Discogs</span>
                  </h3>
                  <button 
                    onClick={() => setIsSyncOpen(false)}
                    className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400"
                    disabled={isSyncing}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-200 text-xs">
                    <Sparkles className="w-5 h-5 shrink-0 text-indigo-400" />
                    <p>
                      Esta herramienta descargará hasta 100 álbumes de tu colección pública de Discogs vinculada (cuenta: <strong className="text-white">@{ (userData as any)?.discogsUsername || 'No configurado' }</strong>). Los nuevos discos se agregarán automáticamente a tu inventario bajo la categoría <strong className="text-white">"Colección"</strong> sin alterar los precios o ítems existentes.
                    </p>
                  </div>

                  {!isSyncing && syncLogs.length === 0 && (
                    <div className="flex justify-center py-6">
                      <button
                        onClick={startDiscogsSync}
                        className="btn-premium py-2.5 px-6 text-xs font-bold flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Iniciar Sincronización</span>
                      </button>
                    </div>
                  )}

                  {/* Sync status and progress */}
                  {(isSyncing || syncLogs.length > 0) && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-gray-300">
                          <span>{syncProgress.status}</span>
                          {syncProgress.total > 0 && (
                            <span>{syncProgress.current} / {syncProgress.total}</span>
                          )}
                        </div>
                        {syncProgress.total > 0 && (
                          <div className="w-full bg-slate-800/40 h-2.5 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Logs output */}
                      <div className="h-60 overflow-y-auto p-4 rounded-2xl bg-slate-950/90 border border-white/5 font-mono text-xs space-y-1">
                        {syncLogs.map((log, index) => (
                          <div 
                            key={index}
                            className={
                              log.type === 'error' ? 'text-red-400' :
                              log.type === 'skip' ? 'text-gray-500' : 'text-emerald-400'
                            }
                          >
                            {log.msg}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/5 pt-4.5 flex justify-end">
                  <button
                    onClick={() => setIsSyncOpen(false)}
                    disabled={isSyncing}
                    className="btn-premium py-2 px-5 text-xs font-bold disabled:opacity-50"
                  >
                    Cerrar Ventana
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: DATABASE NAME REPAIR */}
        <AnimatePresence>
          {isRepairOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isApplyingRepairs && setIsRepairOpen(false)}
                className="absolute inset-0 bg-black/90"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#0f172a] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl relative border border-white/10 z-10 overflow-hidden shadow-2xl shadow-black/80"
              >
                {/* Background Floating Orbs */}
                <div className="absolute top-0 left-0 w-60 h-60 rounded-full bg-indigo-500/10 blur-[60px] animate-orb-slow-1 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-purple-500/10 blur-[60px] animate-orb-slow-2 pointer-events-none" />
                
                {/* Subtle top border illumination */}
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
                
                <div className="relative z-10 p-6 sm:p-8 space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 select-none">
                      <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <span>Reparación de Nombres y Codificación</span>
                    </h3>
                    <button 
                      onClick={() => !isApplyingRepairs && setIsRepairOpen(false)}
                      className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-all"
                      disabled={isApplyingRepairs}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Intro Alert Box */}
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-200 text-xs">
                      <AlertCircle className="w-5 h-5 shrink-0 text-indigo-400" />
                      <p className="leading-relaxed">
                        Esta herramienta detecta discos con problemas de codificación de caracteres (como tildes o la letra "ñ" con espacios en blanco o mojibake). Utilizará el diccionario inteligente y portadas vinculadas a Discogs para buscar los nombres oficiales y sugerir una corrección automática.
                      </p>
                    </div>

                    {/* Loading State or Proposals list */}
                    {repairProposals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                        <div className="text-gray-500 text-sm">Escaneando inventario y buscando correcciones...</div>
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary / Table Header */}
                        <div className="flex justify-between items-center text-xs text-gray-400 border-b border-white/5 pb-2">
                          <div>
                            Se encontraron <span className="text-indigo-400 font-bold">{repairProposals.length}</span> discos con posibles errores de caracteres.
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRepairProposals(prev => prev.map(p => ({ ...p, selected: true })))}
                              className="text-indigo-400 hover:text-indigo-300 font-semibold"
                            >
                              Seleccionar Todo
                            </button>
                            <span className="text-gray-600">|</span>
                            <button
                              onClick={() => setRepairProposals(prev => prev.map(p => ({ ...p, selected: false })))}
                              className="text-gray-400 hover:text-gray-300 font-semibold"
                            >
                              Deseleccionar Todo
                            </button>
                          </div>
                        </div>

                        {/* List / Table of Proposals */}
                        <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                          {repairProposals.map((prop, idx) => {
                            const isSelected = prop.selected;
                            return (
                              <div 
                                key={idx}
                                className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                                  isSelected 
                                    ? 'bg-indigo-500/5 border-indigo-500/20' 
                                    : 'bg-slate-800/10 border-white/5 hover:border-white/10'
                                }`}
                              >
                                {/* Checkbox */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (prop.loading) return;
                                    setRepairProposals(prev => prev.map((p, pIdx) => 
                                      pIdx === idx ? { ...p, selected: !p.selected } : p
                                    ));
                                  }}
                                  className="text-gray-400 hover:text-white transition-all shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-indigo-400" />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-600" />
                                  )}
                                </button>

                                {/* Cover Thumbnail */}
                                {prop.item.cover ? (
                                  <img 
                                    src={prop.item.cover} 
                                    alt="" 
                                    className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center shrink-0">
                                    <Music className="w-5 h-5 text-gray-600" />
                                  </div>
                                )}

                                {/* Comparisons */}
                                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  {/* Original */}
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Original</div>
                                    <div className="text-gray-400 truncate line-through">
                                      {prop.originalArtist} - {prop.originalTitle}
                                    </div>
                                    {prop.originalLabel && (
                                      <div className="text-[10px] text-gray-500 italic truncate">
                                        Sello: {prop.originalLabel}
                                      </div>
                                    )}
                                  </div>

                                  {/* Proposed */}
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                                      <span>Sugerido</span>
                                      {prop.resolvedVia === 'discogs' && (
                                        <span className="text-[9px] px-1 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20 font-sans uppercase">Discogs 💿</span>
                                      )}
                                      {prop.resolvedVia === 'dictionary' && (
                                        <span className="text-[9px] px-1 bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20 font-sans uppercase">Diccionario 📖</span>
                                      )}
                                    </div>
                                    <div className="text-emerald-400 font-semibold truncate">
                                      {prop.proposedArtist} - {prop.proposedTitle}
                                    </div>
                                    {prop.proposedLabel && (
                                      <div className="text-[10px] text-emerald-500/80 italic truncate">
                                        Sello: {prop.proposedLabel}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Loading state indicator */}
                                {prop.loading && (
                                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Logs output */}
                    {repairLogs.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="text-xs font-bold text-gray-300">Progreso de Reparación:</div>
                        <div className="h-40 overflow-y-auto p-4 rounded-2xl bg-slate-950/90 border border-white/5 font-mono text-xs space-y-1">
                          {repairLogs.map((log, index) => (
                            <div 
                              key={index}
                              className={
                                log.startsWith('❌') ? 'text-red-400' :
                                log.startsWith('✅') ? 'text-emerald-400' : 'text-gray-300'
                              }
                            >
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      {repairProposals.some(p => p.loading) && (
                        <span className="flex items-center gap-1.5 text-indigo-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Consultando Discogs para algunos discos...
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsRepairOpen(false)}
                        disabled={isApplyingRepairs}
                        className="btn-secondary-premium py-2 px-5 text-xs font-bold disabled:opacity-50"
                      >
                        {repairLogs.length > 0 ? 'Cerrar' : 'Cancelar'}
                      </button>
                      
                      {repairProposals.length > 0 && (
                        <button
                          onClick={applyNameRepairs}
                          disabled={isApplyingRepairs || repairProposals.some(p => p.loading) || !repairProposals.some(p => p.selected)}
                          className="btn-premium py-2 px-5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isApplyingRepairs ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Aplicando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Aplicar Correcciones ({repairProposals.filter(p => p.selected).length})</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: PREVIEW ITEM DETAILS */}
        <AnimatePresence>
          {previewModalItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
              onClick={() => setPreviewModalItem(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl max-h-[90vh] glass-card rounded-2xl border border-white/10 shadow-2xl overflow-y-auto overflow-x-hidden scrollbar-thin relative flex flex-col"
              >
                {/* Header Actions */}
                <div className="sticky top-0 z-20 p-4 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl flex flex-wrap gap-2 min-h-[64px]">
                  <div className="flex flex-wrap gap-2 flex-1 pr-10 items-center">
                    <button
                      onClick={(e) => { handleToggleCollectionStatus(previewModalItem, e); }}
                      className="btn-secondary-premium px-3 py-1.5 text-xs flex gap-2 items-center text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 border-transparent"
                    >
                      {activeTab === 'coleccion' ? <Store className="w-3.5 h-3.5 text-emerald-400" /> : <Archive className="w-3.5 h-3.5 text-emerald-400" />}
                      <span className="hidden sm:inline">{activeTab === 'coleccion' ? "Mover a Tienda" : "A Colección"}</span>
                    </button>
                    <button
                      onClick={(e) => { setPreviewModalItem(null); openEditModal(previewModalItem, e); }}
                      className="btn-secondary-premium px-3 py-1.5 text-xs flex gap-2 items-center"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-400" /> 
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    {previewModalItem.status !== 'coleccion' && (
                      <>
                        <button
                          onClick={(e) => { handleSellItem(previewModalItem, e); }}
                          className="btn-secondary-premium px-3 py-1.5 text-xs flex gap-2 items-center"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> 
                          <span className="hidden sm:inline">Vender</span>
                        </button>
                        <button
                          onClick={(e) => { setPreviewModalItem(null); openInstagramModal(previewModalItem, e); }}
                          className="btn-secondary-premium px-3 py-1.5 text-xs flex gap-2 items-center"
                        >
                          <Instagram className="w-3.5 h-3.5 text-indigo-400" /> 
                          <span className="hidden sm:inline">Compartir</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => { handleDeleteItem(previewModalItem.id, e); }}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold border border-red-500/20 transition-all text-xs flex items-center"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button 
                    onClick={() => setPreviewModalItem(null)}
                    className="absolute right-4 top-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Left Column: Image Viewer */}
                  <div className="md:col-span-5 space-y-4">
                    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden aspect-square flex items-center justify-center relative bg-slate-950/40 select-none">
                      {previewActivePhoto ? (
                        <img 
                          src={previewActivePhoto} 
                          alt={`${previewModalItem.title} cover`} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-600 p-8">
                          <Disc className="w-24 h-24 stroke-[1] animate-spin-slow mb-4" />
                          <span className="text-xs text-gray-500 font-medium">Sin imagen de portada</span>
                        </div>
                      )}
                      
                      {/* Format Tag */}
                      <div className="absolute top-4 left-4 bg-indigo-600/90 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border border-indigo-400/30 shadow-lg">
                        {previewModalItem.format}
                      </div>

                      {/* Condition indicators on image */}
                      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md text-[10px] font-bold text-gray-200 px-3 py-1.5 rounded-lg border border-white/10 flex gap-3 shadow-lg">
                        <span>Disco: <strong className="text-emerald-400">{previewModalItem.grade}</strong></span>
                        <span>Tapa: <strong className="text-emerald-400">{previewModalItem.gradeCover || previewModalItem.grade}</strong></span>
                      </div>
                    </div>

                    {/* Gallery Thumbnails */}
                    {(() => {
                      const allPhotos = [...(previewModalItem.photos || []), ...(previewModalItem.discogsPhotos || [])];
                      if (allPhotos.length <= 1) return null;
                      return (
                        <div className="flex gap-2 overflow-x-auto pb-2 select-none scrollbar-thin">
                          {allPhotos.map((photo, idx) => (
                            <button
                              key={idx}
                              onClick={() => setPreviewActivePhoto(photo)}
                              className={`w-16 h-16 rounded-lg overflow-hidden border shrink-0 bg-slate-900 transition-all ${
                                previewActivePhoto === photo 
                                  ? 'border-indigo-400 scale-105 shadow-md shadow-indigo-500/20' 
                                  : 'border-white/5 opacity-70 hover:opacity-100 hover:scale-95'
                              }`}
                            >
                              <img src={photo} alt="thumbnail" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Column: Information & Audio Player */}
                  <div className="md:col-span-7 space-y-6">
                    <div className="space-y-4">
                      {/* Album Header */}
                      <div>
                        <span className="text-xs font-extrabold text-indigo-400 tracking-wider uppercase">{previewModalItem.artist || 'Artista Desconocido'}</span>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-1 leading-tight">
                          {previewModalItem.title}
                        </h1>
                      </div>

                      {/* Price section */}
                      {previewModalItem.status !== 'coleccion' && (
                        <div className="flex items-baseline gap-2 pb-2">
                          <span className="text-3xl font-extrabold text-emerald-400">
                            {formatCurrency(previewModalItem.price, userData?.currency)}
                          </span>
                          {previewModalItem.status !== 'disponible' && (
                            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-2 py-0.5 rounded uppercase">
                              {previewModalItem.status}
                            </span>
                          )}
                          {previewModalItem.qty > 1 && (
                            <span className="text-xs text-gray-500 font-bold ml-2">
                              x{previewModalItem.qty} disponibles
                            </span>
                          )}
                        </div>
                      )}

                      {/* Specifications Box */}
                      <div className="glass-card rounded-xl p-4 border border-white/5 space-y-3 bg-slate-900/50">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                          <Layers className="w-4 h-4" /> Especificaciones
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-gray-500 block mb-1">Sello Discográfico:</span>
                            <span className="font-semibold text-white">{previewModalItem.label || 'Desconocido'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1">Número de Catálogo:</span>
                            <span className="font-semibold text-white">{previewModalItem.catno || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1">Año de Edición:</span>
                            <span className="font-semibold text-white flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {previewModalItem.year || 'Desconocido'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1">Formato:</span>
                            <span className="font-semibold text-white">{previewModalItem.format}</span>
                          </div>
                        </div>
                      </div>

                      {/* Links and Actions */}
                      {previewModalItem.url && (
                        <div className="pt-2">
                          <a 
                            href={previewModalItem.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white text-xs font-bold transition-all border border-white/5 hover:border-white/10"
                          >
                            <ExternalLink className="w-4 h-4 text-indigo-400" />
                            Ver página en Discogs
                          </a>
                        </div>
                      )}

                      {/* Audio Preview section */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Escuchar Grabación</span>
                        <AudioPreviewPlayer 
                          discogsId={previewModalItem.discogsId} 
                          artist={previewModalItem.artist} 
                          title={previewModalItem.title} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODAL: INSTAGRAM CARD GENERATOR */}
        <InstagramCardGenerator
          isOpen={isInstagramOpen}
          onClose={() => setIsInstagramOpen(false)}
          vinyl={instagramVinyl}
          currency={userData?.currency || 'USD'}
          shopName={userData?.username || 'mi_tienda'}
        />

        {/* MODAL: TUTORIAL */}
        <TutorialModal 
          isOpen={isTutorialOpen} 
          onClose={() => setIsTutorialOpen(false)} 
          isFirstTime={isFirstTimeTutorial} 
        />
      </div>
    </DashboardShell>
  );
}
