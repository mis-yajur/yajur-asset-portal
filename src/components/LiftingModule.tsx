import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Search, 
  Plus, 
  Download, 
  Pencil, 
  Trash2, 
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  History as HistoryIcon,
  PlusCircle,
  CalendarDays,
  X,
  Activity
} from 'lucide-react';
import { apiCall } from '../services/api';
import { cn, formatDate } from '../lib/utils';
import type { Lifting, PI, Notification, DeliveryRecord } from '../types';

interface LiftingModuleProps {
  onNotify: (title: string, message: string, type?: Notification['type']) => void;
  onLog: (action: string, details: string) => void;
}

export default function LiftingModule({ onNotify, onLog }: LiftingModuleProps) {
  const [liftingData, setLiftingData] = useState<Lifting[]>([]);
  const [piData, setPiData] = useState<PI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAddDeliveryModalOpen, setIsAddDeliveryModalOpen] = useState(false);
  
  const [currentEntry, setCurrentEntry] = useState<Partial<Lifting> | null>(null);
  const [selectedLifting, setSelectedLifting] = useState<Lifting | null>(null);
  const [newDelivery, setNewDelivery] = useState({ quantityKg: 0, date: new Date().toISOString().split('T')[0] });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 200;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [liftRes, piRes] = await Promise.all([
        apiCall('getLiftingData'),
        apiCall('getPIData')
      ]);
      
      if (liftRes.success) {
        const parsedData = (liftRes.data || []).map((item: any) => {
          let history = item.HISTORY;
          if (typeof history === 'string') {
            try { history = JSON.parse(history); } catch (e) { history = []; }
          }
          return { ...item, HISTORY: Array.isArray(history) ? history : [] };
        });
        setLiftingData(parsedData);
      }
      if (piRes.success) setPiData(piRes.data || []);
    } catch (error) {
      onNotify('Error', 'Failed to synchronize with mainframe', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return liftingData.filter(item => {
      const matchesSearch = 
        String(item.ACCOUNT || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.PI_NO || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.CONTACT || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !statusFilter || item.STATUS === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [liftingData, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleEdit = (entry: Lifting) => {
    setCurrentEntry(entry);
    setIsModalOpen(true);
  };

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLifting || newDelivery.quantityKg <= 0) return;

    setIsLoading(true);
    try {
      const updatedLifting = {
        ...selectedLifting,
        DELIVERED_KG: selectedLifting.DELIVERED_KG + newDelivery.quantityKg,
        REMAINING_KG: selectedLifting.REMAINING_KG - newDelivery.quantityKg,
        DELIVERY_DATE: newDelivery.date,
        LAST_QTY: newDelivery.quantityKg,
        HISTORY: JSON.stringify([
          ...(selectedLifting.HISTORY || []),
          {
            id: Math.random().toString(36).substr(2, 9),
            liftingId: selectedLifting.LIFTING_ID,
            piNo: selectedLifting.PI_NO,
            quantityKg: newDelivery.quantityKg,
            deliveryDate: newDelivery.date,
            timestamp: new Date().toISOString()
          }
        ])
      };

      const res = await apiCall('updateLifting', updatedLifting);
      if (res.success) {
        onNotify('Success', `${newDelivery.quantityKg}kg Delivery Recorded`, 'success');
        onLog('Add Delivery', `Lifting ID: ${selectedLifting.LIFTING_ID}, Qty: ${newDelivery.quantityKg}kg`);
        setIsAddDeliveryModalOpen(false);
        setNewDelivery({ quantityKg: 0, date: new Date().toISOString().split('T')[0] });
        await loadData();
      } else {
        onNotify('Error', res.error || 'Delivery record failed', 'error');
      }
    } catch (error) {
      onNotify('Error', 'Server communication failure', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lifting entry?')) return;
    
    setIsLoading(true);
    try {
      const res = await apiCall('deleteLifting', { LIFTING_ID: id });
      if (res.success) {
        onNotify('Deleted', 'Record removed from system', 'success');
        onLog('Delete Lifting', `ID: ${id}`);
        await loadData();
      } else {
        onNotify('Error', res.error || 'Delete failed', 'error');
      }
    } catch (error) {
      onNotify('Error', 'Network error during deletion', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEntry?.PI_NO || !currentEntry?.TARGET_KG) return;

    setIsLoading(true);
    try {
      const action = currentEntry.LIFTING_ID ? 'updateLifting' : 'addLifting';
      const payload = {
        ...currentEntry,
        LIFTING_ID: currentEntry.LIFTING_ID || `LIFT-${Date.now()}`,
        DELIVERY_DATE: currentEntry.DELIVERY_DATE || new Date().toISOString().split('T')[0],
        HISTORY: Array.isArray(currentEntry.HISTORY) ? JSON.stringify(currentEntry.HISTORY) : currentEntry.HISTORY
      };
      
      const res = await apiCall(action, payload);
      
      if (res.success) {
        onNotify('Success', `Lifting entry ${currentEntry.LIFTING_ID ? 'updated' : 'created'}`, 'success');
        onLog(currentEntry.LIFTING_ID ? 'Update Lifting' : 'Add Lifting', `PI: ${currentEntry.PI_NO}, Target: ${currentEntry.TARGET_KG}kg`);
        setIsModalOpen(false);
        setCurrentEntry(null);
        await loadData();
      } else {
        onNotify('Error', res.error || 'Save failed', 'error');
      }
    } catch (error) {
      onNotify('Error', 'Server communication failure', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ["Account", "Contact", "PI No.", "Target (kg)", "Delivered (kg)", "Remaining (kg)", "Status", "Delivery Date"];
    const rows = filteredData.map(l => [
      l.ACCOUNT,
      l.CONTACT || '',
      l.PI_NO,
      l.TARGET_KG,
      l.DELIVERED_KG,
      l.REMAINING_KG,
      l.STATUS,
      formatDate(l.DELIVERY_DATE)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lifting_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    onNotify('Exported', 'CSV report generated', 'success');
    onLog('CSV Export', 'Lifting data export triggered');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header Actions */}
      <div className="bg-surface-card p-4 rounded-custom border border-border-main shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
            <input 
              type="text"
              placeholder="Search account or PI..."
              className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border-main rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/30 transition-all text-text-main"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="px-4 py-2 bg-surface-muted border border-border-main rounded-xl text-sm font-bold text-text-main outline-none focus:border-accent/30 tracking-tight"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Status Map</option>
            <option value="RUNNING">Running</option>
            <option value="NOT STARTED">Not Started</option>
            <option value="COMPLETE">Complete</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setCurrentEntry({}); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={16} /> New Entry
          </button>
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-surface-card border border-border-main text-text-main rounded-xl text-xs font-black uppercase tracking-widest hover:bg-surface-muted transition-all shadow-sm"
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface-card rounded-custom border border-border-main shadow-sm overflow-hidden">
        <div className="overflow-x-auto text-text-main">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-muted/50 border-b border-border-main text-xs font-black text-text-dim uppercase tracking-widest">
                <th className="px-5 py-3">Account / PI</th>
                <th className="px-5 py-3 text-center">Lifting Metrics</th>
                <th className="px-5 py-3">Inventory Distribution</th>
                <th className="px-5 py-3">Delivery Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                       <div className="h-4 bg-slate-100 rounded w-1/4" />
                    </td>
                  </tr>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item) => {
                  const progress = (item.DELIVERED_KG / item.TARGET_KG) * 100;
                  return (
                    <tr key={item.LIFTING_ID} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-50 last:border-0">
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-base font-black text-primary uppercase leading-tight">{item.ACCOUNT}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-slate-600">PI#</span>
                            <span className="text-xs font-black text-accent tracking-widest">{item.PI_NO}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-center justify-center gap-1">
                           <div className="flex gap-4">
                              <div className="text-center">
                                <div className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">Target</div>
                                <div className="text-sm font-black text-slate-900">{item.TARGET_KG.toLocaleString()}kg</div>
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">Delivered</div>
                                <div className="text-sm font-black text-teal-600">{item.DELIVERED_KG.toLocaleString()}kg</div>
                              </div>
                           </div>
                           <div className="w-full max-w-[120px] pt-1 mt-1 border-t border-slate-100 text-center">
                             <div className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">Balance</div>
                             <div className={cn("text-sm font-black", item.REMAINING_KG < 100 ? "text-teal-600" : "text-rose-600")}>
                               {item.REMAINING_KG <= 0 ? "FULFILLED" : `${item.REMAINING_KG.toLocaleString()}kg`}
                             </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1.5 min-w-[140px]">
                           <div className="flex justify-between items-center text-xs font-black">
                             <span className="text-slate-500 uppercase">Clearance</span>
                             <span className="text-primary">{Math.min(100, Math.round(progress))}%</span>
                           </div>
                           <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                             <div 
                               className={cn(
                                 "h-full rounded-full transition-all duration-700",
                                 progress >= 100 ? "bg-teal-500" : progress >= 50 ? "bg-accent" : "bg-primary"
                               )}
                               style={{ width: `${Math.min(100, progress)}%` }}
                             />
                           </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                           <span className="text-xs font-black text-slate-900 uppercase">Cycle: {item.FREQUENCY} DAY</span>
                           <div className="flex items-center gap-1.5 mt-1.5">
                             <CalendarDays size={12} className="text-accent" />
                             <span className="text-xs font-black text-text-main">
                               {formatDate(item.DELIVERY_DATE)}
                             </span>
                           </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest",
                          item.STATUS === 'COMPLETE' ? "bg-teal-100 text-teal-700" : 
                          item.STATUS === 'RUNNING' ? "bg-blue-100 text-blue-700" : 
                          "bg-amber-100 text-amber-700"
                        )}>
                          {item.STATUS}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => { setSelectedLifting(item); setIsAddDeliveryModalOpen(true); }}
                            className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-all"
                            title="Add Delivery"
                          >
                            <PlusCircle size={16} />
                          </button>
                          <button 
                            onClick={() => { setSelectedLifting(item); setIsHistoryModalOpen(true); }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="History"
                          >
                            <HistoryIcon size={16} />
                          </button>
                          <button 
                            onClick={() => handleEdit(item)}
                            className="p-2 text-slate-500 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.LIFTING_ID)}
                            className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center flex flex-col items-center justify-center">
                    <Activity size={48} className="text-slate-100 mb-4" />
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Station Empty • No Active Vectors</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-surface-muted/50 border-t border-border-main flex items-center justify-between">
            <span className="text-xs font-black text-text-dim uppercase tracking-widest">
                Manifest {Math.min(filteredData.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredData.length, currentPage * itemsPerPage)} of {filteredData.length} entries
            </span>
            <div className="flex items-center gap-2">
                <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                    <ChevronLeft size={14} />
                </button>
                <div className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-lg">
                    <span className="text-xs font-black text-primary">{currentPage}</span>
                    <span className="text-xs font-bold text-slate-400">/</span>
                    <span className="text-xs font-bold text-slate-400">{totalPages || 1}</span>
                </div>
                <button 
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
      </div>

      {/* Main Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-surface-card w-full max-w-2xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="bg-primary text-white p-6 flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-black uppercase tracking-tight">Configuration Matrix</h3>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Terminal Production Interface</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} />
                </button>
             </div>

             <form onSubmit={handleSave} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="space-y-2">
                      <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">PI Association</label>
                      <select 
                        required
                        className="w-full bg-surface-muted border border-border-main rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-accent/40"
                        value={currentEntry?.PI_NO || ''}
                        onChange={e => {
                          const pi = piData.find(p => p.PI_NO === e.target.value);
                          setCurrentEntry({
                            ...currentEntry,
                            PI_NO: e.target.value,
                            ACCOUNT: pi?.CUSTOMER_NAME || '',
                            RUNNING_PI_KG: pi?.QUANTITY_KG || 0
                          });
                        }}
                      >
                        <option value="">Select Target PI</option>
                        {piData.filter(p => p.STATUS !== 'COMPLETE').map(p => (
                          <option key={p.PI_NO} value={p.PI_NO}>{p.PI_NO} • {p.CUSTOMER_NAME}</option>
                        ))}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Account Header</label>
                      <input 
                        readOnly
                        className="w-full bg-slate-100 border border-border-main rounded-xl px-4 py-2.5 text-sm font-black text-slate-500 outline-none"
                        value={currentEntry?.ACCOUNT || ''}
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Contact Link</label>
                      <input 
                        placeholder="Coordinator Name"
                        className="w-full bg-surface-muted border border-border-main rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-accent/40"
                        value={currentEntry?.CONTACT || ''}
                        onChange={e => setCurrentEntry({ ...currentEntry, CONTACT: e.target.value })}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-text-dim uppercase tracking-widest ml-1">Cycle Duration (Days)</label>
                      <input 
                        type="number"
                        className="w-full bg-surface-muted border border-border-main rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-accent/40"
                        value={currentEntry?.FREQUENCY || 30}
                        onChange={e => setCurrentEntry({ ...currentEntry, FREQUENCY: Number(e.target.value) })}
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Target Quantum (KG)</label>
                      <input 
                        required
                        type="number"
                        className="w-full bg-surface-muted border border-border-main rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:border-accent/40"
                        value={currentEntry?.TARGET_KG || ''}
                        onChange={e => setCurrentEntry({ ...currentEntry, TARGET_KG: Number(e.target.value) })}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Current Deliveries (KG)</label>
                      <input 
                        type="number"
                        className="w-full bg-surface-muted border border-border-main rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:border-accent/40"
                        value={currentEntry?.DELIVERED_KG || 0}
                        onChange={e => setCurrentEntry({ ...currentEntry, DELIVERED_KG: Number(e.target.value) })}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Dispatch / Delivery Date</label>
                      <input 
                        type="date"
                        className="w-full bg-surface-muted border border-border-main rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:border-accent/40"
                        value={currentEntry?.DELIVERY_DATE || ''}
                        onChange={e => setCurrentEntry({ ...currentEntry, DELIVERY_DATE: e.target.value })}
                      />
                   </div>
                </div>

                <div className="pt-6 border-t border-border-main flex items-center justify-between">
                   <span className="text-xs font-bold text-text-dim uppercase tracking-widest">Commit to mainframe?</span>
                   <div className="flex gap-3">
                      <button 
                         type="button"
                         onClick={() => setIsModalOpen(false)}
                         className="px-6 py-2.5 bg-surface-muted text-text-main rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                         Cancel
                      </button>
                      <button 
                         type="submit"
                         className="px-8 py-2.5 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                      >
                         Submit Logic
                      </button>
                   </div>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Add Delivery Modal */}
      {isAddDeliveryModalOpen && selectedLifting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={() => setIsAddDeliveryModalOpen(false)} />
          <div className="bg-surface-card w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="bg-accent text-white p-6 flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-black uppercase tracking-tight">Post Delivery</h3>
                   <p className="text-xs text-white/60 font-bold uppercase tracking-widest mt-1">{selectedLifting.ACCOUNT}</p>
                </div>
                <button onClick={() => setIsAddDeliveryModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} />
                </button>
             </div>

             <form onSubmit={handleAddDelivery} className="p-6 space-y-4">
                <div className="bg-surface-muted p-4 rounded-xl border border-border-main mb-2">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-text-dim uppercase">Pending Balance</span>
                        <span className="text-sm font-black text-rose-600">{selectedLifting.REMAINING_KG.toLocaleString()}kg</span>
                    </div>
                    <div className="text-[10px] font-bold text-text-dim text-right">Against PI: {selectedLifting.PI_NO}</div>
                </div>

                <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Dispatch Quantum (KG)</label>
                      <input 
                        required
                        autofocus
                        type="number"
                        className="w-full bg-surface-muted border border-border-main rounded-xl px-4 py-3 text-lg font-black outline-none focus:border-accent"
                        placeholder="0.00"
                        value={newDelivery.quantityKg || ''}
                        onChange={e => setNewDelivery({ ...newDelivery, quantityKg: Number(e.target.value) })}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-black text-text-dim uppercase tracking-widest ml-1">Dispatch Date</label>
                      <input 
                        required
                        type="date"
                        className="w-full bg-surface-muted border border-border-main rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:border-accent"
                        value={newDelivery.date}
                        onChange={e => setNewDelivery({ ...newDelivery, date: e.target.value })}
                      />
                   </div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button 
                        type="button" 
                        onClick={() => setIsAddDeliveryModalOpen(false)}
                        className="flex-1 py-3 bg-surface-muted text-text-main rounded-xl text-xs font-black uppercase tracking-widest"
                    >
                        Abort
                    </button>
                    <button 
                        type="submit"
                        className="flex-[2] py-3 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-accent/20"
                    >
                        Verify & Post
                    </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedLifting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
          <div className="bg-surface-card w-full max-w-2xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="bg-indigo-900 text-white p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                      <HistoryIcon size={20} />
                   </div>
                   <div>
                      <h3 className="text-lg font-black uppercase tracking-tight">Audit Trail</h3>
                      <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Refined Transaction Log for {selectedLifting.PI_NO}</p>
                   </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} />
                </button>
             </div>

             <div className="p-0 max-h-[60vh] overflow-y-auto">
                {selectedLifting.HISTORY && selectedLifting.HISTORY.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-surface-card shadow-sm">
                            <tr className="bg-surface-muted border-b border-border-main">
                                <th className="px-6 py-3 text-xs font-black text-text-dim uppercase tracking-widest">Post Date</th>
                                <th className="px-6 py-3 text-xs font-black text-text-dim uppercase tracking-widest">Entry Date</th>
                                <th className="px-6 py-3 text-xs font-black text-text-dim uppercase tracking-widest text-right">Quantum (KG)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-main">
                            {selectedLifting.HISTORY.slice().reverse().map((entry) => (
                                <tr key={entry.id} className="hover:bg-surface-muted transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-black text-text-main">{formatDate(entry.deliveryDate)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-bold text-text-dim">{new Date(entry.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-xs font-black text-teal-600">{entry.quantityKg.toLocaleString()} kg</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                            <HistoryIcon size={32} />
                        </div>
                        <h4 className="text-sm font-black text-text-main uppercase tracking-tight">No Transactions Logged</h4>
                        <p className="text-xs text-text-dim font-bold uppercase mt-1">Vector history currently empty for this lifting ID</p>
                    </div>
                )}
             </div>

             <div className="p-6 border-t border-border-main bg-surface-muted/30 flex justify-between items-center text-xs font-black text-text-dim uppercase tracking-widest">
                <span>Account: {selectedLifting.ACCOUNT}</span>
                <button onClick={() => setIsHistoryModalOpen(false)} className="px-6 py-2 bg-indigo-900 text-white rounded-lg">Close Audit</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
