import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Upload, 
  Pencil, 
  Trash2, 
  Activity,
  Tag,
  Hash,
  Layers,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiCall } from '../services/api';
import { cn, formatDate } from '../lib/utils';
import type { Product, Notification } from '../types';

interface ProductsModuleProps {
  onNotify: (title: string, message: string, type?: Notification['type']) => void;
  onLog: (action: string, details: string) => void;
}

export default function ProductsModule({ onNotify, onLog }: ProductsModuleProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 200;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await apiCall('getProducts');
      if (res.success) setProducts(res.data || []);
    } catch (error) {
      onNotify('Error', 'Product registry offline', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      String(p.QLTY_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.QLTY_CODE || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.HSN_CODE || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = async (code: string) => {
    if (!window.confirm(`Vanish product quality ${code}?`)) return;
    
    setIsLoading(true);
    try {
      const res = await apiCall('deleteProduct', { QLTY_CODE: code });
      if (res.success) {
        onNotify('Purged', 'Product specification redacted', 'success');
        onLog('Delete Product', `Code: ${code}`);
        await loadData();
      } else {
        onNotify('Error', res.error || 'Purge failed', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct?.QLTY_CODE || !currentProduct?.QLTY_NAME) return;

    setIsLoading(true);
    try {
      const isEdit = products.some(p => p.QLTY_CODE === currentProduct.QLTY_CODE);
      const action = isEdit ? 'updateProduct' : 'addProduct';
      const res = await apiCall(action, currentProduct);
      
      if (res.success) {
        onNotify('Success', `Quality ${currentProduct.QLTY_NAME} indexed`, 'success');
        onLog(isEdit ? 'Update Product' : 'Add Product', `ID: ${currentProduct.QLTY_CODE}`);
        setIsModalOpen(false);
        setCurrentProduct(null);
        await loadData();
      } else {
        onNotify('Error', res.error || 'Indexing failed', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        
        const data = lines.slice(1).filter(l => l.trim()).map(line => {
            const values = line.split(',');
            const obj: any = {};
            headers.forEach((h, i) => {
                obj[h.trim()] = values[i]?.trim();
            });
            return obj;
        });

        setIsLoading(true);
        try {
            const res = await apiCall('bulkUploadProducts', { products: data });
            if (res.success) {
                onNotify('Bulk Success', `${data.length} specs synchronized`, 'success');
                onLog('Bulk Upload Products', `Count: ${data.length}`);
                await loadData();
            } else {
                onNotify('Bulk Error', res.error || 'Batch sync failed', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Product Control */}
      <div className="bg-white p-6 rounded-custom border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Filter by name, code or HSN..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/30 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
            <Upload size={14} /> Spec Upload
            <input type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
          </label>
          <button 
            onClick={() => { setCurrentProduct({ TYPE: 'Yarn', CREATED_DATE: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={16} /> Define Quality
          </button>
        </div>
      </div>

      {/* Specification Matrix */}
      <div className="bg-white rounded-custom border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
             <thead>
               <tr className="bg-slate-50/50 border-b border-slate-100 italic">
                 <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">SL</th>
                 <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">Type</th>
                 <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">Quality Name</th>
                 <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">Quality Code</th>
                 <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">HSN Code</th>
                 <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">Created</th>
                 <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest text-right">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {isLoading ? (
                 [1,2,3,4,5].map(i => (
                   <tr key={i} className="animate-pulse">
                     <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                   </tr>
                 ))
               ) : paginatedData.length > 0 ? (
                 paginatedData.map((product, idx) => (
                    <tr key={product.QLTY_CODE} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                     <td className="px-6 py-4 text-xs font-bold text-slate-700">{product.SL || (currentPage-1)*itemsPerPage + idx + 1}</td>
                     <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-[11px] font-black uppercase tracking-widest",
                          product.TYPE === 'Yarn' ? "bg-amber-100 text-amber-700" : 
                          product.TYPE === 'Fibre' ? "bg-teal-100 text-teal-700" : 
                          "bg-indigo-100 text-indigo-700"
                        )}>
                          {product.TYPE}
                        </span>
                     </td>
                     <td className="px-6 py-4">
                        <div className="text-base font-black text-primary uppercase tracking-tight">{product.QLTY_NAME}</div>
                     </td>
                     <td className="px-6 py-4">
                        <span className="text-xs font-black text-slate-700 tracking-widest">{product.QLTY_CODE}</span>
                     </td>
                     <td className="px-6 py-4">
                        <span className="text-xs font-black text-slate-600 tracking-widest">{product.HSN_CODE || 'N/A'}</span>
                     </td>
                     <td className="px-6 py-4 text-xs font-medium text-slate-500 uppercase">{formatDate(product.CREATED_DATE)}</td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setCurrentProduct(product); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"><Pencil size={14} /></button>
                           <button onClick={() => handleDelete(product.QLTY_CODE)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                        </div>
                     </td>
                   </tr>
                 ))
               ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center flex flex-col items-center justify-center">
                    <Package size={48} className="text-slate-100 mb-4" />
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Registry Empty • No Specs Found</p>
                  </td>
                </tr>
               )}
             </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                Exhibiting {Math.min(filteredProducts.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredProducts.length, currentPage * itemsPerPage)} of {filteredProducts.length} entries
            </span>
            <div className="flex items-center gap-2">
                <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 rounded-lg">
                    <span className="text-xs font-black text-primary">{currentPage}</span>
                    <span className="text-xs font-bold text-slate-400">/</span>
                    <span className="text-xs font-bold text-slate-400">{totalPages || 1}</span>
                </div>
                <button 
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-8 bg-primary text-white flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight">Quality Specification</h3>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Material Classification Engine</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <Activity size={24} className="rotate-45" />
                </button>
             </div>

             <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Universal Asset Code (UID)</label>
                    <input 
                        required
                        placeholder="EX: Q-1234"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-black outline-none focus:border-accent/40 uppercase"
                        value={currentProduct?.QLTY_CODE || ''}
                        onChange={e => setCurrentProduct({ ...currentProduct, QLTY_CODE: e.target.value.toUpperCase() })}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Asset Nomenclature (Name)</label>
                    <input 
                        required
                        placeholder="EX: Polyester High Tenacity Yarn"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-black outline-none focus:border-accent/40"
                        value={currentProduct?.QLTY_NAME || ''}
                        onChange={e => setCurrentProduct({ ...currentProduct, QLTY_NAME: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Logistics Class (HSN)</label>
                        <input 
                            placeholder="6-8 Digit Code"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-accent/40 tracking-widest"
                            value={currentProduct?.HSN_CODE || ''}
                            onChange={e => setCurrentProduct({ ...currentProduct, HSN_CODE: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Material Group</label>
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-black outline-none focus:border-accent/40"
                            value={currentProduct?.TYPE || 'Yarn'}
                            onChange={e => setCurrentProduct({ ...currentProduct, TYPE: e.target.value as any })}
                        >
                            <option value="Yarn">Yarn</option>
                            <option value="Fibre">Fibre</option>
                            <option value="Fabric">Fabric</option>
                            <option value="Other">Other Assets</option>
                        </select>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Master Data</span>
                   </div>
                   <div className="flex gap-3">
                      <button 
                         type="button"
                         onClick={() => setIsModalOpen(false)}
                         className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-bold"
                      >
                         Cancel
                      </button>
                      <button 
                         type="submit"
                         className="px-10 py-4 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                      >
                         Commit Quality
                      </button>
                   </div>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
