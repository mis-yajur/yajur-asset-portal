import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Upload, 
  Pencil, 
  Trash2, 
  Activity,
  User,
  Building,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  Hash,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiCall } from '../services/api';
import { cn } from '../lib/utils';
import type { Customer, Notification } from '../types';

interface CustomersModuleProps {
  onNotify: (title: string, message: string, type?: Notification['type']) => void;
  onLog: (action: string, details: string) => void;
}

export default function CustomersModule({ onNotify, onLog }: CustomersModuleProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer> | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 200;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await apiCall('getCustomers');
      if (res.success) setCustomers(res.data || []);
    } catch (error) {
      onNotify('Error', 'Network protocol failure', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      String(c.PARTY_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(c.PARTY_CODE || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(c.EMAIL_ID || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = async (code: string) => {
    if (!window.confirm(`Dissolve association with ${code}?`)) return;
    
    setIsLoading(true);
    try {
      const res = await apiCall('deleteCustomer', { PARTY_CODE: code });
      if (res.success) {
        onNotify('Purged', 'Customer record nullified', 'success');
        onLog('Delete Customer', `Code: ${code}`);
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
    if (!currentCustomer?.PARTY_CODE || !currentCustomer?.PARTY_NAME) return;

    setIsLoading(true);
    try {
      const isEdit = customers.some(c => c.PARTY_CODE === currentCustomer.PARTY_CODE);
      const action = isEdit ? 'updateCustomer' : 'addCustomer';
      const res = await apiCall(action, currentCustomer);
      
      if (res.success) {
        onNotify('Success', `Identity ${currentCustomer.PARTY_CODE} indexed`, 'success');
        onLog(isEdit ? 'Update Customer' : 'Add Customer', `ID: ${currentCustomer.PARTY_CODE}`);
        setIsModalOpen(false);
        setCurrentCustomer(null);
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
            const res = await apiCall('bulkUploadCustomers', { customers: data });
            if (res.success) {
                onNotify('Bulk Success', `${data.length} identities mapped`, 'success');
                onLog('Bulk Upload', `Count: ${data.length} customers`);
                await loadData();
            } else {
                onNotify('Bulk Error', res.error || 'Batch processing failed', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Control Module */}
      <div className="bg-white p-6 rounded-custom border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Search by code, entity or mail..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/30 transition-all font-bold"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
            <Upload size={14} /> Batch Map
            <input type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
          </label>
          <button 
            onClick={() => { setCurrentCustomer({ CREATED_DATE: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={16} /> New Identity
          </button>
        </div>
      </div>

      {/* Customer Registry */}
      <div className="bg-white rounded-custom border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">SL</th>
                <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">Code</th>
                <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">Party Name</th>
                <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">Contact Information</th>
                <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">GSTIN / PAN</th>
                <th className="px-6 py-4 text-xs font-black text-slate-700 uppercase tracking-widest">Address</th>
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
                paginatedData.map((customer, idx) => (
                  <tr key={customer.PARTY_CODE} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-50 last:border-0">
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">{customer.SL || (currentPage-1)*itemsPerPage + idx + 1}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-black uppercase tracking-widest">{customer.PARTY_CODE}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-base font-black text-primary uppercase tracking-tight">{customer.PARTY_NAME}</div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="space-y-1">
                          {customer.EMAIL_ID && <div className="text-xs font-bold text-slate-700 lowercase flex items-center gap-1.5"><Mail size={10} className="text-slate-400" />{customer.EMAIL_ID}</div>}
                          {customer.MOBILE_NO && <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Phone size={10} className="text-slate-400" />{customer.MOBILE_NO}</div>}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col gap-0.5">
                          <div className="text-xs font-black text-slate-900 tracking-widest">{customer.GSTIN || 'N/A'}</div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase">PAN: {customer.PAN_NO || 'N/A'}</div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="text-xs font-medium text-slate-600 uppercase line-clamp-1 max-w-[200px]">
                          {[customer.ADDRESS1, customer.ADDRESS3, customer.STATE_CODE].filter(Boolean).join(', ')}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setCurrentCustomer(customer); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(customer.PARTY_CODE)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                       </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center flex flex-col items-center justify-center">
                    <Users size={48} className="text-slate-100 mb-4" />
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Isolated • No Customer Data Detected</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                Showing {Math.min(filteredCustomers.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredCustomers.length, currentPage * itemsPerPage)} of {filteredCustomers.length} records
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

      {/* Identity Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="bg-primary text-white p-8 flex items-center justify-between shrink-0">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight">Identity Mapping</h3>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Enterprise Customer Registry</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <AlertCircle size={24} className="rotate-45" />
                </button>
             </div>

             <form onSubmit={handleSave} className="p-8 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Entity Unique ID (Code)</label>
                        <input 
                            required
                            placeholder="EX: CUST001"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                            value={currentCustomer?.PARTY_CODE || ''}
                            onChange={e => setCurrentCustomer({ ...currentCustomer, PARTY_CODE: e.target.value.toUpperCase() })}
                        />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Legal Corporation Name</label>
                        <input 
                            required
                            placeholder="Full entity name as per GST registration"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                            value={currentCustomer?.PARTY_NAME || ''}
                            onChange={e => setCurrentCustomer({ ...currentCustomer, PARTY_NAME: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">GSTIN Number</label>
                        <input 
                            placeholder="15-digit Tax Identifier"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40 uppercase"
                            value={currentCustomer?.GSTIN || ''}
                            onChange={e => setCurrentCustomer({ ...currentCustomer, GSTIN: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">PAN Card</label>
                        <input 
                            placeholder="Corporate / Personal PAN"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40 uppercase"
                            value={currentCustomer?.PAN_NO || ''}
                            onChange={e => setCurrentCustomer({ ...currentCustomer, PAN_NO: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">State Logic (Code)</label>
                        <input 
                            placeholder="EX: 19 (West Bengal)"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                            value={currentCustomer?.STATE_CODE || ''}
                            onChange={e => setCurrentCustomer({ ...currentCustomer, STATE_CODE: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2 lg:col-span-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Primary Operations Address</label>
                        <textarea 
                            rows={2}
                            placeholder="Full physical address for logistics"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-accent/40"
                            value={currentCustomer?.ADDRESS1 || ''}
                            onChange={e => setCurrentCustomer({ ...currentCustomer, ADDRESS1: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Digital Mailgate</label>
                        <input 
                            type="email"
                            placeholder="billing@customer.com"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-accent/40"
                            value={currentCustomer?.EMAIL_ID || ''}
                            onChange={e => setCurrentCustomer({ ...currentCustomer, EMAIL_ID: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Vector</label>
                        <input 
                            placeholder="+91 XXXXX XXXXX"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-accent/40"
                            value={currentCustomer?.MOBILE_NO || ''}
                            onChange={e => setCurrentCustomer({ ...currentCustomer, MOBILE_NO: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Account Creation</label>
                        <input 
                            type="date"
                            readOnly
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-500 outline-none"
                            value={currentCustomer?.CREATED_DATE || ''}
                        />
                    </div>
                </div>

                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                    <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                        <Hash size={14} className="text-accent" />
                        Financial Settlement Logic
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Bank Identifier</label>
                            <input 
                                placeholder="Bank Code"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-accent/30"
                                value={currentCustomer?.BANK_CODE || ''}
                                onChange={e => setCurrentCustomer({ ...currentCustomer, BANK_CODE: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Routing Code (IFSC)</label>
                            <input 
                                placeholder="IFSC"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-accent/30 uppercase"
                                value={currentCustomer?.IFSC_CODE || ''}
                                onChange={e => setCurrentCustomer({ ...currentCustomer, IFSC_CODE: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Account Ledger Number</label>
                            <input 
                                placeholder="Settlement Account"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-accent/30"
                                value={currentCustomer?.ACC_NO || ''}
                                onChange={e => setCurrentCustomer({ ...currentCustomer, ACC_NO: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="shrink-0 flex items-center justify-between pt-6">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verify identity before commit</span>
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
                         Commit Mapping
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
