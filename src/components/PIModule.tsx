import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Download, 
  Pencil, 
  Trash2, 
  Activity,
  CheckCircle2,
  Clock,
  Building,
  User,
  MapPin,
  Tag,
  CreditCard,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiCall } from '../services/api';
import { cn, formatDate } from '../lib/utils';
import type { PI, Customer, Product, Notification } from '../types';

interface PIModuleProps {
  onNotify: (title: string, message: string, type?: Notification['type']) => void;
  onLog: (action: string, details: string) => void;
}

export default function PIModule({ onNotify, onLog }: PIModuleProps) {
  const [piData, setPiData] = useState<PI[]>([]);
  const [liftingMap, setLiftingMap] = useState<Record<string, { assigned: number }>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPI, setCurrentEntry] = useState<Partial<PI> | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 200;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [piRes, custRes, prodRes, liftRes] = await Promise.all([
        apiCall('getPIData'),
        apiCall('getCustomers'),
        apiCall('getProducts'),
        apiCall('getLiftingData')
      ]);
      
      if (piRes.success) setPiData(piRes.data || []);
      if (custRes.success) setCustomers(custRes.data || []);
      if (prodRes.success) setProducts(prodRes.data || []);
      if (liftRes.success) {
         const lifts = liftRes.data || [];
         const map: Record<string, { assigned: number }> = {};
         lifts.forEach((l: any) => {
            if (!map[l.PI_NO]) map[l.PI_NO] = { assigned: 0 };
            map[l.PI_NO].assigned += (Number(l.TARGET_KG) || 0);
         });
         setLiftingMap(map);
      }
    } catch (error) {
      onNotify('Error', 'Mainframe sync failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPIs = useMemo(() => {
    return piData.filter(pi => {
      const matchesSearch = 
        String(pi.PI_NO || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(pi.CUSTOMER_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(pi.PRODUCT_QUALITY || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !statusFilter || pi.STATUS === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [piData, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredPIs.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPIs.slice(start, start + itemsPerPage);
  }, [filteredPIs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete PI Record ${id}?`)) return;
    
    setIsLoading(true);
    try {
      const res = await apiCall('deletePI', { PI_NO: id });
      if (res.success) {
        onNotify('Purged', 'PI record removed correctly', 'success');
        onLog('Delete PI', `ID: ${id}`);
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
    if (!currentPI?.PI_NO || !currentPI?.CUSTOMER_NAME) return;

    setIsLoading(true);
    try {
      const isEdit = piData.some(p => p.PI_NO === currentPI.PI_NO);
      const action = isEdit ? 'updatePI' : 'addPI';
      const res = await apiCall(action, currentPI);
      
      if (res.success) {
        onNotify('Success', `PI ${currentPI.PI_NO} synchronized`, 'success');
        onLog(isEdit ? 'Update PI' : 'Add PI', `ID: ${currentPI.PI_NO}`);
        setIsModalOpen(false);
        setCurrentEntry(null);
        await loadData();
      } else {
        onNotify('Error', res.error || 'Sync failed', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const calcPITotal = (qty: number, rate: number) => {
    const total = qty * rate;
    return total;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Action Bar */}
      <div className="bg-surface-card p-6 rounded-custom border border-border-main shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
            <input 
              type="text"
              placeholder="Search PI, client or quality..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-muted border border-border-main rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/30 transition-all text-text-main"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="px-4 py-2.5 bg-surface-muted border border-border-main rounded-xl text-sm font-bold text-text-main outline-none focus:border-accent/30 tracking-tight"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Operational Status</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETE">Complete</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => { 
                setCurrentEntry({ 
                    INVOICE_DATE: new Date().toISOString().split('T')[0],
                    STATUS: 'RUNNING',
                    AUTHORIZED_SIGNATORY: 'Director'
                }); 
                setIsModalOpen(true); 
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={16} /> Create PI
          </button>
        </div>
      </div>

      {/* Grid of PIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
            [1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-surface-card rounded-custom border border-border-main p-6 h-48 animate-pulse shadow-sm" />
            ))
        ) : paginatedData.length > 0 ? (
            paginatedData.map(pi => {
                const progress = ((pi.totalDelivered || 0) / pi.QUANTITY_KG) * 100;
                return (
                    <div key={pi.PI_NO} className="bg-surface-card rounded-custom border border-border-main p-6 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between border-l-4 border-l-transparent hover:border-l-accent">
                        <div>
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h4 className="text-base font-black text-primary uppercase tracking-tight">{pi.PI_NO}</h4>
                                    <span className="text-xs font-bold text-text-dim uppercase tracking-widest">{formatDate(pi.INVOICE_DATE)}</span>
                                </div>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest",
                                    pi.STATUS === 'COMPLETE' ? "bg-teal-100 text-teal-700" : "bg-blue-100 text-blue-700"
                                )}>
                                    {pi.STATUS}
                                </span>
                            </div>

                            <div className="mb-6">
                                <div className="text-sm font-black text-text-main uppercase flex items-center gap-2">
                                    <Building size={12} className="text-text-dim" />
                                    {pi.CUSTOMER_NAME}
                                </div>
                                <div className="text-xs font-bold text-text-dim uppercase tracking-tight mt-1 flex items-center gap-2">
                                    <Tag size={10} className="text-text-dim" />
                                    {pi.PRODUCT_QUALITY}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2 bg-surface-muted p-3 rounded-2xl">
                                <div>
                                    <div className="text-[10px] font-black text-text-dim uppercase tracking-tighter">Gross Qty</div>
                                    <div className="text-sm font-black text-primary">{pi.QUANTITY_KG?.toLocaleString()}kg</div>
                                    <div className="text-[9px] font-bold text-text-dim mt-0.5">₹{pi.NET_AMOUNT?.toLocaleString()}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">Target Allocated</div>
                                    <div className="text-sm font-black text-indigo-600">
                                       {(liftingMap[pi.PI_NO]?.assigned || 0).toLocaleString()}kg
                                    </div>
                                    <div className="text-[9px] font-bold text-indigo-400 mt-0.5">
                                       Left: {Math.max(0, (pi.QUANTITY_KG || 0) - (liftingMap[pi.PI_NO]?.assigned || 0)).toLocaleString()}kg
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Delivered</div>
                                    <div className="text-sm font-black text-teal-600">{(pi.totalDelivered || 0).toLocaleString()}kg</div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[11px] font-black uppercase">
                                    <span className="text-text-dim">Inventory Clearance</span>
                                    <span className="text-primary">{Math.min(100, Math.round(progress))}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-surface-base rounded-full overflow-hidden">
                                    <div 
                                        className={cn(
                                            "h-full rounded-full transition-all duration-1000",
                                            pi.STATUS === 'COMPLETE' ? "bg-teal-500" : "bg-accent"
                                        )}
                                        style={{ width: `${Math.min(100, progress)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-border-main">
                                <span className="text-[11px] font-bold text-text-dim/50 uppercase truncate max-w-[120px]">
                                    Sig: {pi.AUTHORIZED_SIGNATORY}
                                </span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => { setCurrentEntry(pi); setIsModalOpen(true); }}
                                        className="p-2 text-slate-400 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(pi.PI_NO)}
                                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })
        ) : (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center bg-white rounded-custom border border-slate-200">
                <FileText size={48} className="text-slate-100 mb-4" />
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Vault Empty • No PI Transactions</p>
            </div>
        )}
      </div>

      {filteredPIs.length > itemsPerPage && (
        <div className="mt-8 bg-white p-4 rounded-custom border border-slate-200 flex items-center justify-between shadow-sm">
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                Showing {Math.min(filteredPIs.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredPIs.length, currentPage * itemsPerPage)} of {filteredPIs.length} P.I.s
            </span>
            <div className="flex items-center gap-2">
                <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-xs font-black text-primary">{currentPage}</span>
                    <span className="text-xs font-bold text-slate-400">/</span>
                    <span className="text-xs font-bold text-slate-400">{totalPages || 1}</span>
                </div>
                <button 
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      )}

      {/* PI Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="bg-primary text-white p-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Proforma Generation</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Fiscal Document Interface</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <Activity size={24} className="rotate-45" />
                    </button>
                </div>

                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/5 p-5 rounded-2xl border border-white/10">
                    <div>
                        <div className="text-[11px] font-black text-slate-500 uppercase mb-1">Seller Identity</div>
                        <div className="text-sm font-black">Yajur Fibres Limited</div>
                    </div>
                    <div>
                        <div className="text-[11px] font-black text-slate-500 uppercase mb-1">Tax Fingerprint</div>
                        <div className="text-sm font-black line-clamp-1">19AAECS2882B3ZB</div>
                    </div>
                    <div>
                        <div className="text-[11px] font-black text-slate-500 uppercase mb-1">Corporate CIN</div>
                        <div className="text-sm font-black line-clamp-1 truncate">U17100WB1980PLC032918</div>
                    </div>
                    <div>
                        <div className="text-[11px] font-black text-slate-500 uppercase mb-1">Certificate Stat</div>
                        <div className="text-sm font-black">BVFR14492922</div>
                    </div>
                </div>
             </div>

             <form onSubmit={handleSave} className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">PI Sequence ID</label>
                        <input 
                            required
                            placeholder="EX: PI/26/001"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40 transition-all uppercase"
                            value={currentPI?.PI_NO || ''}
                            onChange={e => setCurrentEntry({ ...currentPI, PI_NO: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Dispatch Date</label>
                        <input 
                            required
                            type="date"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                            value={currentPI?.INVOICE_DATE || ''}
                            onChange={e => setCurrentEntry({ ...currentPI, INVOICE_DATE: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Auth Signatory</label>
                        <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                            value={currentPI?.AUTHORIZED_SIGNATORY || ''}
                            onChange={e => setCurrentEntry({ ...currentPI, AUTHORIZED_SIGNATORY: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 ring-1 ring-slate-100 p-6 rounded-3xl bg-slate-50/30">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Consignee Account</label>
                            <select 
                                required
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                value={currentPI?.CUSTOMER_NAME || ''}
                                onChange={e => {
                                    const cust = customers.find(c => c.PARTY_NAME === e.target.value);
                                    setCurrentEntry({
                                        ...currentPI,
                                        CUSTOMER_NAME: e.target.value,
                                        CUSTOMER_GST_NO: cust?.GSTIN || '',
                                        DELIVERY_ADDRESS: [cust?.ADDRESS1, cust?.ADDRESS3].filter(Boolean).join(', '),
                                        DELIVERY_STATE: cust?.STATE_CODE || ''
                                    });
                                }}
                            >
                                <option value="">Map Customer</option>
                                {customers.map(c => (
                                    <option key={c.PARTY_CODE} value={c.PARTY_NAME}>{c.PARTY_NAME} ({c.PARTY_CODE})</option>
                                ))}
                            </select>
                        </div>
                        {currentPI?.CUSTOMER_NAME && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                                        <Building size={14} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-slate-400 uppercase leading-none">GST Sequence</div>
                                        <div className="text-xs font-black text-slate-700">{currentPI.CUSTOMER_GST_NO || 'UNREGISTERED'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                        <MapPin size={14} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase leading-none">Logistics Destination</div>
                                        <div className="text-[11px] font-black text-slate-700 uppercase leading-tight mt-1">{currentPI.DELIVERY_ADDRESS}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                             <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Asset Quality / Type</label>
                             <select 
                                required
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                value={currentPI?.PRODUCT_QUALITY || ''}
                                onChange={e => setCurrentEntry({ ...currentPI, PRODUCT_QUALITY: e.target.value })}
                             >
                                <option value="">Select Material Spec</option>
                                {products.map(p => (
                                    <option key={p.QLTY_CODE} value={p.QLTY_NAME}>{p.QLTY_NAME} ({p.QLTY_CODE})</option>
                                ))}
                             </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Target KG</label>
                                <input 
                                    required
                                    type="number"
                                    placeholder="5000"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                    value={currentPI?.QUANTITY_KG || ''}
                                    onChange={e => {
                                        const qty = Number(e.target.value);
                                        const rate = currentPI?.RATE_PER_UNIT || 0;
                                        setCurrentEntry({ ...currentPI, QUANTITY_KG: qty, ITEM_TOTAL: qty * rate, NET_AMOUNT: qty * rate });
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Unit Rate (₹)</label>
                                <input 
                                    required
                                    type="number"
                                    placeholder="245.50"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                    value={currentPI?.RATE_PER_UNIT || ''}
                                    onChange={e => {
                                        const rate = Number(e.target.value);
                                        const qty = currentPI?.QUANTITY_KG || 0;
                                        setCurrentEntry({ ...currentPI, RATE_PER_UNIT: rate, ITEM_TOTAL: qty * rate, NET_AMOUNT: qty * rate });
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-primary/5 p-8 rounded-[2rem] border border-primary/10">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-indigo-900/20">
                            <CreditCard size={28} />
                        </div>
                        <div>
                            <div className="text-xs font-black text-primary/40 uppercase tracking-widest">Aggregated Fiscal Impact</div>
                            <div className="text-3xl font-black text-primary num-font tracking-tight leading-none mt-1">₹{(currentPI?.NET_AMOUNT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-8 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Abort
                        </button>
                        <button 
                            type="submit"
                            className="px-10 py-4 bg-accent text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            Verify & Dispatch
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
