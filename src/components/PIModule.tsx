import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import autoTable from 'jspdf-autotable';
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
  ChevronRight,
  IndianRupee,
  Archive,
  CalendarDays,
  CheckCircle,
  Mail,
  X
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
  const [liftingMap, setLiftingMap] = useState<Record<string, { assigned: number, delivered: number }>>({});
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
         const map: Record<string, { assigned: number, delivered: number }> = {};
         lifts.forEach((l: any) => {
            const piNo = String(l.PI_NO || '').trim();
            if (!map[piNo]) map[piNo] = { assigned: 0, delivered: 0 };
            map[piNo].assigned += (Number(l.TARGET_KG) || 0);
            map[piNo].delivered += (Number(l.DELIVERED_KG) || 0);
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

  const handleArchive = async (piNo: string) => {
    if (!window.confirm(`Are you sure you want to move PI ${piNo} and all its lifting entries to the archive? This will remove them from the active list.`)) return;
    
    setIsLoading(true);
    try {
      const res = await apiCall('archivePI', { PI_NO: piNo });
      if (res.success) {
        onNotify('Archived', `PI ${piNo} moved to Resolution Matrix`, 'success');
        onLog('Archive PI', `PI: ${piNo}`);
        await loadData();
      } else {
        onNotify('Error', res.error || 'Archiving failed', 'error');
      }
    } catch (error) {
      onNotify('Error', 'Archive request failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
    const piNo = (currentPI?.PI_NO || '').trim();
    
    if (!piNo) {
      onNotify('Validation Error', 'PI Sequence ID is required', 'error');
      return;
    }

    setIsLoading(true);
    onNotify('Info', 'Preparing data for synchronization...', 'info');
    
    try {
      const isEdit = piData.some(p => String(p.PI_NO || '').trim().toLowerCase() === piNo.toLowerCase());
      const action = isEdit ? 'updatePI' : 'addPI';
      
      const items = Array.isArray(currentPI?.ITEMS) ? currentPI.ITEMS : [];
      let totalQty = 0;
      let totalAmountBeforeTax = 0;
      
      items.forEach(item => {
          const q = Number(item.QUANTITY_KG) || 0;
          const r = Number(item.RATE_PER_UNIT) || 0;
          totalQty += q;
          totalAmountBeforeTax += (q * r);
      });
      
      const deliveryCharges = Number(currentPI?.DELIVERY_CHARGES) || 0;
      const cgstPct = Number(currentPI?.CGST_PERCENT) || 0;
      const sgstPct = Number(currentPI?.SGST_PERCENT) || 0;
      const igstPct = Number(currentPI?.IGST_PERCENT) || 5;
      const otherCharges = Number(currentPI?.OTHER_CHARGES) || 0;
      
      const taxBase = totalAmountBeforeTax + deliveryCharges;
      const totalAmount = taxBase + (taxBase * cgstPct / 100) + (taxBase * sgstPct / 100) + (taxBase * igstPct / 100) + otherCharges;

      // Ensure INVOICE_DATE is set
      const invoiceDate = currentPI?.INVOICE_DATE || new Date().toISOString().split('T')[0];

      const payload = {
        ...currentPI,
        PI_NO: piNo,
        INVOICE_DATE: invoiceDate,
        CUSTOMER_NAME: currentPI?.CUSTOMER_NAME || 'GENERAL ACCOUNT',
        ITEM_TOTAL: totalAmountBeforeTax,
        NET_AMOUNT: totalAmount,
        QUANTITY_KG: totalQty,
        RATE_PER_UNIT: items.length > 0 ? items[0].RATE_PER_UNIT : 0,
        PRODUCT_QUALITY: items.length > 0 ? items[0].PRODUCT_QUALITY : '',
        UNIT_COUNT: items.length > 0 ? items[0].UNIT_COUNT : 0,
        ITEMS: JSON.stringify(items),
        SELLER_NAME: 'Yajur Lifting',
        SELLER_GSTIN: '19AAECS2882B3ZB',
        SELLER_CIN: 'U17100WB1980PLC032918',
        CERT_NO: 'BVFR14492922',
        STATUS: currentPI?.STATUS || 'RUNNING',
        CREATED_AT: currentPI?.CREATED_AT || new Date().toISOString()
      };

      console.log(`[PIModule] Submitting ${action}:`, payload);
      const res = await apiCall(action, payload);
      
      if (res.success) {
        onNotify('Success', `PI record ${piNo} successfully ${isEdit ? 'updated' : 'created'}`, 'success');
        onLog(isEdit ? 'Update PI' : 'Add PI', `ID: ${piNo}, Qty: ${totalQty}kg`);
        setIsModalOpen(false);
        setCurrentEntry(null);
        await loadData();
      } else {
        console.error('[PIModule] Sync failed:', res.error);
        onNotify('Sync Error', res.error || 'The system could not process this PI record.', 'error');
      }
    } catch (error) {
      console.error('[PIModule] Fatal sync error:', error);
      onNotify('Critical Error', 'Communication with the fiscal mainframe failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const calcPITotal = (qty: number, rate: number) => {
    const total = qty * rate;
    return total;
  };

  const [pdfGenerationStatus, setPdfGenerationStatus] = useState<{loading: boolean, pi: any | null, pdfUrl: string | null, pdfId: string | null}>({loading: false, pi: null, pdfUrl: null, pdfId: null});

  const generatePIPdf = async (pi: any) => {
    setPdfGenerationStatus({ loading: true, pi, pdfUrl: null, pdfId: null });
    onNotify('Info', 'Generating PDF using template on backend...', 'info');
    try {
      // Use Google Apps Script backend to generate the PDF instead of client-side html2pdf
      const res = await apiCall('generatePdfFromTemplate', pi);
      
      if (res.success || res.pdfUrl) {
         setPdfGenerationStatus({ loading: false, pi, pdfUrl: res.pdfUrl || res.pdfDownloadUrl, pdfId: res.pdfId });
         onNotify('Success', 'PDF generated and saved to Drive successfully', 'success');
         onLog('Export PDF', `Generated PI ${pi.PI_NO} via Drive`);
      } else {
         throw new Error(res.error || 'Failed to generate PDF');
      }
    } catch (error: any) {
      console.error(error);
      setPdfGenerationStatus({ loading: false, pi: null, pdfUrl: null, pdfId: null });
      onNotify('Error', 'Failed to generate PDF on server. Check console for details.', 'error');
    }
  };

  const sendEmail = async (pdfId: string, piNo: string) => {
    onNotify('Info', 'Sending email...', 'info');
    try {
      // pdfId is now the Google Drive File ID
      const res = await apiCall('sendEmailWithPdf', { pdfId: pdfId, emailTo: 'mis@yajurfibres.com', PI_NO: piNo });
      if(res.success || res === "Email sent to mis@yajurfibres.com") {
        onNotify('Success', 'Email sent successfully to mis@yajurfibres.com', 'success');
        onLog('Email PDF', `Emailed PI ${piNo}`);
      } else {
        onNotify('Error', res.error || 'Failed to send email', 'error');
      }
    } catch (error) {
      console.error(error);
      onNotify('Error', 'Failed to send email', 'error');
    }
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
                    AUTHORIZED_SIGNATORY: 'Director',
                    ITEMS: [{ PRODUCT_QUALITY: '', QUANTITY_KG: 0, RATE_PER_UNIT: 0, UNIT_COUNT: 0 }]
                }); 
                setIsModalOpen(true); 
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={16} /> Create PI
          </button>
        </div>
      </div>

      {/* Table of PIs */}
      <div className="bg-surface-card rounded-[2rem] border border-border-main shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b-2 border-border-main">
                <th className="py-4 text-[11px] font-black text-text-dim uppercase tracking-widest px-5 bg-surface-muted/30">PI Sequence</th>
                <th className="py-4 text-[11px] font-black text-text-dim uppercase tracking-widest px-5 bg-surface-muted/30">Party & Quality</th>
                <th className="py-4 text-[11px] font-black text-text-dim uppercase tracking-widest px-5 text-right bg-surface-muted/30">Contract</th>
                <th className="py-4 text-[11px] font-black text-text-dim uppercase tracking-widest px-8 text-center bg-surface-muted/30 w-1/4">Clearance</th>
                <th className="py-4 text-[11px] font-black text-text-dim uppercase tracking-widest px-5 text-right bg-surface-muted/30">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-6"><div className="h-4 bg-slate-100 rounded w-3/4"></div></td>
                    <td className="px-5 py-6"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                    <td className="px-5 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    <td className="px-5 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    <td className="px-5 py-6"><div className="h-4 bg-slate-100 rounded w-1/4 ml-auto"></div></td>
                  </tr>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map(pi => {
                  const piNo = String(pi.PI_NO || '').trim();
                  const totalDelivered = liftingMap[piNo]?.delivered || 0;
                  const progress = (totalDelivered / (pi.QUANTITY_KG || 1)) * 100;
                  const remaining = (pi.QUANTITY_KG || 0) - totalDelivered;
                  const isPracticallyComplete = remaining <= 100 && remaining > 0;

                  return (
                    <tr key={pi.PI_NO} className="hover:bg-primary/5 transition-colors group">
                      <td className="px-5 py-4 align-top">
                        <div className="font-black text-sm text-primary uppercase">{pi.PI_NO}</div>
                        <div className="text-[10px] font-bold text-text-dim mt-1 uppercase tracking-widest flex items-center gap-1">
                            <CalendarDays size={10} /> {formatDate(pi.INVOICE_DATE)}
                        </div>
                        <div className="mt-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-block",
                              pi.STATUS === 'COMPLETE' || isPracticallyComplete ? "bg-teal-100 text-teal-700" : "bg-blue-100 text-blue-700"
                            )}>
                                {isPracticallyComplete ? 'NEAR COMPLETE' : pi.STATUS}
                            </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="text-sm font-black text-text-main uppercase">{pi.CUSTOMER_NAME}</div>
                        <div className="text-[11px] font-bold text-text-dim uppercase flex items-center gap-1 mt-1 border border-border-main w-fit px-2 py-0.5 rounded-lg bg-surface-base">
                            <Tag size={10} /> {pi.PRODUCT_QUALITY}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-right">
                        <div className="text-sm font-black text-primary">{pi.QUANTITY_KG?.toLocaleString()}kg</div>
                        <div className="text-[10px] font-black text-text-dim mt-1.5 flex items-center justify-end gap-0.5">
                            <IndianRupee size={10} /> {pi.NET_AMOUNT?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-8 py-4 align-top">
                        <div className="flex flex-col items-center">
                          <div className="flex justify-between w-full text-[10px] font-black uppercase mb-1.5">
                            <span className="text-teal-600">{totalDelivered.toLocaleString()}kg Del</span>
                            <span className={remaining > 0 ? "text-rose-600" : "text-text-dim"}>{remaining > 0 ? `${remaining.toLocaleString()}kg Bal` : 'Fulfilled'}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-700",
                                pi.STATUS === 'COMPLETE' || isPracticallyComplete ? "bg-teal-500" : progress >= 50 ? "bg-accent" : "bg-primary"
                              )}
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => generatePIPdf(pi)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Download Proforma PDF"
                          >
                            <Download size={14} />
                          </button>
                          {(pi.STATUS === 'COMPLETE' || isPracticallyComplete) && (
                            <button 
                              onClick={() => handleArchive(pi.PI_NO)}
                              className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                              title="Move to Archive"
                            >
                              <Archive size={14} />
                            </button>
                          )}
                          <button onClick={() => { 
                              let parsedItems = pi.ITEMS;
                              if (typeof parsedItems === 'string') {
                                  try { parsedItems = JSON.parse(parsedItems); } catch(e) {}
                              }
                              if (!parsedItems || !Array.isArray(parsedItems)) {
                                  parsedItems = [{
                                      PRODUCT_QUALITY: pi.PRODUCT_QUALITY || '',
                                      QUANTITY_KG: pi.QUANTITY_KG || 0,
                                      RATE_PER_UNIT: pi.RATE_PER_UNIT || 0,
                                      UNIT_COUNT: pi.UNIT_COUNT || 0,
                                  }];
                              }
                              setCurrentEntry({ ...pi, ITEMS: parsedItems }); 
                              setIsModalOpen(true); 
                          }} className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-all" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(pi.PI_NO)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                   <td colSpan={5} className="py-16 text-center">
                     <div className="flex flex-col items-center justify-center">
                        <FileText size={40} className="text-border-main mb-3" />
                        <p className="text-text-dim text-xs font-bold uppercase tracking-widest">Vault Empty • No PI Transactions</p>
                     </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

      {/* PDF Action Modal */}
      {pdfGenerationStatus.loading || pdfGenerationStatus.pdfUrl ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-md" onClick={() => {
              if(!pdfGenerationStatus.loading) setPdfGenerationStatus({loading: false, pi: null, pdfUrl: null, pdfId: null});
          }} />
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="bg-primary text-white p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">PDF Export</h3>
                    </div>
                    {!pdfGenerationStatus.loading && (
                        <button onClick={() => setPdfGenerationStatus({loading: false, pi: null, pdfUrl: null, pdfId: null})} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>
             </div>
             
             <div className="p-8 text-center space-y-6">
                {pdfGenerationStatus.loading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-accent rounded-full animate-spin mb-4" />
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest">Generating Secure PDF...</h4>
                        <p className="text-xs font-bold text-text-dim mt-2">Connecting to Fiscal Mainframe</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="w-20 h-20 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle size={32} />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-primary uppercase tracking-tight">Ready for Dispatch</h4>
                            <p className="text-xs font-bold text-text-dim mt-1 uppercase tracking-widest">{pdfGenerationStatus.pi?.PI_NO}</p>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <a 
                                href={pdfGenerationStatus.pdfUrl || '#'} 
                                target="_blank" 
                                rel="noreferrer"
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <FileText size={16} /> Open Document Link
                            </a>
                            <button 
                                onClick={() => pdfGenerationStatus.pdfId && sendEmail(pdfGenerationStatus.pdfId, pdfGenerationStatus.pi?.PI_NO)}
                                className="w-full bg-accent hover:bg-indigo-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                            >
                                <Mail size={16} /> Email to mis@yajurfibres.com
                            </button>
                            <a 
                                href={`https://wa.me/?text=Please%20find%20the%20Proforma%20Invoice%20attached`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                            >
                                Send via WhatsApp
                            </a>
                        </div>
                    </div>
                )}
             </div>
          </div>
        </div>
      ) : null}

      {/* PI Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 md:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-slate-50 w-full max-w-[1400px] h-full max-h-[1000px] md:rounded-[2rem] shadow-2xl relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-slate-900/5">
             <div className="bg-slate-900 text-slate-100 p-6 md:p-8 shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent"></div>
                <div className="flex items-center justify-between relative z-10">
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-md">Proforma Generation</h3>
                        <p className="text-[10px] text-indigo-200/80 font-bold uppercase tracking-widest mt-1">Fiscal Document Interface</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors">
                        <Activity size={28} className="rotate-45" />
                    </button>
                </div>

                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 relative z-10 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-inner shadow-black/20">
                    <div>
                        <div className="text-[10px] font-black text-indigo-300/80 uppercase mb-1">Seller Identity</div>
                        <div className="text-sm font-black text-white drop-shadow-sm">Yajur Lifting</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-indigo-300/80 uppercase mb-1">Tax Fingerprint</div>
                        <div className="text-sm font-black text-white line-clamp-1 drop-shadow-sm">19AAECS2882B3ZB</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-indigo-300/80 uppercase mb-1">Corporate CIN</div>
                        <div className="text-sm font-black text-white line-clamp-1 truncate drop-shadow-sm">U17100WB1980PLC032918</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-indigo-300/80 uppercase mb-1">Certificate Stat</div>
                        <div className="text-sm font-black text-white drop-shadow-sm">BVFR14492922</div>
                    </div>
                </div>
             </div>

             <form onSubmit={handleSave} className="p-4 md:p-8 space-y-6 md:space-y-8 flex-1 overflow-y-auto bg-slate-50/50">
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
                        <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-accent/40 transition-all">
                          <input 
                              placeholder="Name or leave blank for 'Digitally Signed'"
                              className="w-full bg-transparent px-4 py-3 text-sm font-bold outline-none"
                              value={(currentPI?.AUTHORIZED_SIGNATORY?.startsWith('data:image') || currentPI?.AUTHORIZED_SIGNATORY?.startsWith('http')) ? 'Signature Image Attached' : (currentPI?.AUTHORIZED_SIGNATORY || '')}
                              onChange={e => setCurrentEntry({ ...currentPI, AUTHORIZED_SIGNATORY: e.target.value })}
                              disabled={(currentPI?.AUTHORIZED_SIGNATORY?.startsWith('data:image') || currentPI?.AUTHORIZED_SIGNATORY?.startsWith('http'))}
                          />
                          {(currentPI?.AUTHORIZED_SIGNATORY?.startsWith('data:image') || currentPI?.AUTHORIZED_SIGNATORY?.startsWith('http')) && (
                            <button 
                              type="button" 
                              onClick={() => setCurrentEntry({ ...currentPI, AUTHORIZED_SIGNATORY: '' })}
                              className="px-3 text-red-500 hover:bg-red-50"
                            >
                              <X size={16} />
                            </button>
                          )}
                          <label className="bg-slate-100 hover:bg-slate-200 px-4 py-3 border-l border-slate-200 cursor-pointer flex items-center justify-center">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-600">Upload</span>
                            <input 
                               type="file" 
                               accept="image/*" 
                               className="hidden" 
                               onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (!file) return;
                                 const reader = new FileReader();
                                 reader.onload = (ev) => {
                                   if (ev.target?.result) {
                                     // Create an image to resize it before saving (keep base64 small)
                                     const img = new Image();
                                     img.onload = () => {
                                       const canvas = document.createElement('canvas');
                                       const MAX_WIDTH = 200;
                                       const scaleSize = MAX_WIDTH / img.width;
                                       canvas.width = MAX_WIDTH;
                                       canvas.height = img.height * scaleSize;
                                       const ctx = canvas.getContext('2d');
                                       ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                                       const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                                       setCurrentEntry({ ...currentPI, AUTHORIZED_SIGNATORY: compressedBase64 });
                                     };
                                     img.src = ev.target.result as string;
                                   }
                                 };
                                 reader.readAsDataURL(file);
                               }}
                            />
                          </label>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 ring-1 ring-slate-100 p-6 rounded-3xl bg-slate-50/30">
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest border-b border-border-main pb-2">Consignee (Bill To)</h4>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Party Name</label>
                                <input 
                                    required
                                    list="customer-list"
                                    placeholder="Enter Customer Name"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                    value={currentPI?.CUSTOMER_NAME || ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        const selectedCustomer = customers.find(c => c.PARTY_NAME === val);
                                        if (selectedCustomer) {
                                            const addressParts = [
                                                selectedCustomer.ADDRESS1, 
                                                selectedCustomer.ADDRESS2, 
                                                selectedCustomer.ADDRESS3
                                            ].filter(Boolean);
                                            const addressStr = addressParts.join('\n');
                                            setCurrentEntry({
                                                ...currentPI,
                                                CUSTOMER_NAME: selectedCustomer.PARTY_NAME,
                                                CUSTOMER_ADDRESS: addressStr,
                                                CUSTOMER_GST_NO: selectedCustomer.GSTIN || ''
                                            });
                                        } else {
                                            setCurrentEntry({ ...currentPI, CUSTOMER_NAME: val });
                                        }
                                    }}
                                />
                                <datalist id="customer-list">
                                    {customers.map((c, i) => (
                                        <option key={`cust-${i}`} value={c.PARTY_NAME} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Billing Address</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Enter complete address"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40 resize-none"
                                    value={currentPI?.CUSTOMER_ADDRESS || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, CUSTOMER_ADDRESS: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GSTIN</label>
                                <input 
                                    placeholder="ex: 09AAFCA1542F1Z0"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40 uppercase"
                                    value={currentPI?.CUSTOMER_GST_NO || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, CUSTOMER_GST_NO: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-border-main pb-2">
                          <h4 className="text-sm font-black text-primary uppercase tracking-widest">Delivery (Ship To)</h4>
                          <button 
                            type="button" 
                            className="text-[10px] font-black text-accent uppercase hover:underline"
                            onClick={() => setCurrentEntry({
                              ...currentPI,
                              DELIVERY_NAME: currentPI?.CUSTOMER_NAME || '',
                              DELIVERY_ADDRESS: currentPI?.CUSTOMER_ADDRESS || '',
                              DELIVERY_GST_NO: currentPI?.CUSTOMER_GST_NO || ''
                            })}
                          >
                            Copy Consignee
                          </button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Party Name</label>
                                <input 
                                    list="customer-list"
                                    placeholder="Leave blank if same as consignee"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                    value={currentPI?.DELIVERY_NAME || ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        const selectedCustomer = customers.find(c => c.PARTY_NAME === val);
                                        if (selectedCustomer) {
                                            const addressParts = [
                                                selectedCustomer.ADDRESS1, 
                                                selectedCustomer.ADDRESS2, 
                                                selectedCustomer.ADDRESS3
                                            ].filter(Boolean);
                                            const addressStr = addressParts.join('\n');
                                            setCurrentEntry({
                                                ...currentPI,
                                                DELIVERY_NAME: selectedCustomer.PARTY_NAME,
                                                DELIVERY_ADDRESS: addressStr,
                                                DELIVERY_GST_NO: selectedCustomer.GSTIN || ''
                                            });
                                        } else {
                                            setCurrentEntry({ ...currentPI, DELIVERY_NAME: val });
                                        }
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Address</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Enter delivery address"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40 resize-none"
                                    value={currentPI?.DELIVERY_ADDRESS || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, DELIVERY_ADDRESS: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery GSTIN</label>
                                <input 
                                    placeholder="ex: 09AAFCA1542F1Z0"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40 uppercase"
                                    value={currentPI?.DELIVERY_GST_NO || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, DELIVERY_GST_NO: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 ring-1 ring-slate-100 p-6 rounded-3xl bg-slate-50/30">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-border-main pb-2">
                            <h4 className="text-sm font-black text-primary uppercase tracking-widest">Products</h4>
                            {Array.isArray(currentPI?.ITEMS) && currentPI.ITEMS.length < 7 && (
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const items = Array.isArray(currentPI?.ITEMS) ? [...currentPI.ITEMS] : [];
                                        items.push({ PRODUCT_QUALITY: '', QUANTITY_KG: 0, RATE_PER_UNIT: 0, UNIT_COUNT: 0 });
                                        setCurrentEntry({ ...currentPI, ITEMS: items });
                                    }}
                                    className="text-[10px] font-black text-accent uppercase hover:underline"
                                >
                                    + Add Item
                                </button>
                            )}
                        </div>
                        
                        {(Array.isArray(currentPI?.ITEMS) ? currentPI.ITEMS : []).map((item, index) => (
                            <div key={index} className="grid grid-cols-1 gap-4 p-4 bg-white rounded-2xl border border-slate-100 relative group">
                                {index > 0 && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const items = [...(currentPI?.ITEMS as any[])];
                                            items.splice(index, 1);
                                            setCurrentEntry({ ...currentPI, ITEMS: items });
                                        }}
                                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                                <div className="space-y-2 pr-6">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Product Quality / Detail {index + 1}</label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40 h-fit"
                                            value=""
                                            onChange={e => {
                                                const items = [...(currentPI?.ITEMS as any[])];
                                                items[index] = { ...items[index], PRODUCT_QUALITY: e.target.value };
                                                setCurrentEntry({ ...currentPI, ITEMS: items });
                                            }}
                                        >
                                            <option value="">Quick Select</option>
                                            {products.map(p => (
                                                <option key={p.QLTY_CODE} value={p.QLTY_NAME}>{p.QLTY_NAME} ({p.QLTY_CODE})</option>
                                            ))}
                                        </select>
                                        <textarea 
                                            required={index === 0}
                                            rows={2}
                                            placeholder="e.g. FLAX YARN - 6 LEA NATURAL&#10;UNPOLISHED IN HANK FORM"
                                            className="w-2/3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40 resize-none uppercase"
                                            value={item.PRODUCT_QUALITY}
                                            onChange={e => {
                                                const items = [...(currentPI?.ITEMS as any[])];
                                                items[index] = { ...items[index], PRODUCT_QUALITY: e.target.value };
                                                setCurrentEntry({ ...currentPI, ITEMS: items });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Unit/Box</label>
                                        <input 
                                            type="number"
                                            placeholder="133.00"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                            value={item.UNIT_COUNT || ''}
                                            onChange={e => {
                                                const items = [...(currentPI?.ITEMS as any[])];
                                                items[index] = { ...items[index], UNIT_COUNT: Number(e.target.value) };
                                                setCurrentEntry({ ...currentPI, ITEMS: items });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Quantity ( in Kg.)</label>
                                        <input 
                                            required={index === 0}
                                            type="number"
                                            placeholder="5000"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                            value={item.QUANTITY_KG || ''}
                                            onChange={e => {
                                                const items = [...(currentPI?.ITEMS as any[])];
                                                items[index] = { ...items[index], QUANTITY_KG: Number(e.target.value) };
                                                setCurrentEntry({ ...currentPI, ITEMS: items });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center">
                                            Rate/Kg
                                            <select 
                                                className="ml-2 bg-transparent text-accent font-bold outline-none cursor-pointer"
                                                value={currentPI?.CURRENCY || 'Rs'}
                                                onChange={e => setCurrentEntry({...currentPI, CURRENCY: e.target.value})}
                                            >
                                                <option value="Rs">in Rs.</option>
                                                <option value="$">in Dollar ($)</option>
                                                <option value="€">in Euro (€)</option>
                                            </select>
                                        </label>
                                        <input 
                                            required={index === 0}
                                            type="number"
                                            placeholder="245.50"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                            value={item.RATE_PER_UNIT || ''}
                                            onChange={e => {
                                                const items = [...(currentPI?.ITEMS as any[])];
                                                items[index] = { ...items[index], RATE_PER_UNIT: Number(e.target.value) };
                                                setCurrentEntry({ ...currentPI, ITEMS: items });
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 ring-1 ring-slate-100 p-6 rounded-3xl bg-slate-50/30">
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest border-b border-border-main pb-2">Terms & Notes</h4>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Terms</label>
                                <input 
                                    list="payment-terms-list"
                                    placeholder="e.g. 100% advance before dispatch."
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                    value={currentPI?.PAYMENT_TERMS || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, PAYMENT_TERMS: e.target.value })}
                                />
                                <datalist id="payment-terms-list">
                                    <option value="100% advance before dispatch." />
                                </datalist>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Note</label>
                                <input 
                                    list="note-list"
                                    placeholder="e.g. The above quoted price is ex-factory"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                    value={currentPI?.NOTE || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, NOTE: e.target.value })}
                                />
                                <datalist id="note-list">
                                    <option value="The above quoted price is ex-factory" />
                                </datalist>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest border-b border-border-main pb-2">Dispatch Detail</h4>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Consignment Note</label>
                                <input 
                                    placeholder=""
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                    value={currentPI?.CONSIGNMENT_NOTE || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, CONSIGNMENT_NOTE: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vehicle No.</label>
                                  <input 
                                      placeholder=""
                                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                      value={currentPI?.VEHICLE_NO || ''}
                                      onChange={e => setCurrentEntry({ ...currentPI, VEHICLE_NO: e.target.value })}
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transport Mode</label>
                                  <input 
                                      list="transport-mode-list"
                                      placeholder="e.g. Through Jain Carrying Transport (By Road)"
                                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                      value={currentPI?.TRANSPORT_MODE || ''}
                                      onChange={e => setCurrentEntry({ ...currentPI, TRANSPORT_MODE: e.target.value })}
                                  />
                                  <datalist id="transport-mode-list">
                                      <option value="Through Jain Carrying Transport  (By Road)" />
                                  </datalist>
                              </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 ring-1 ring-slate-100 p-6 rounded-3xl bg-slate-50/30">
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest border-b border-border-main pb-2">Fiscal Impact (Taxes & Charges)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Charges</label>
                                <input 
                                    placeholder="0.00"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                    value={currentPI?.DELIVERY_CHARGES || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, DELIVERY_CHARGES: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CGST (%)</label>
                                <input 
                                    placeholder="0"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                    value={currentPI?.CGST_PERCENT || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, CGST_PERCENT: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SGST (%)</label>
                                <input 
                                    placeholder="0"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                    value={currentPI?.SGST_PERCENT || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, SGST_PERCENT: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IGST (%)</label>
                                <input 
                                    placeholder="5"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                    value={currentPI?.IGST_PERCENT || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, IGST_PERCENT: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Other Charges</label>
                                <input 
                                    placeholder="0.00"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                                    value={currentPI?.OTHER_CHARGES || ''}
                                    onChange={e => setCurrentEntry({ ...currentPI, OTHER_CHARGES: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden mt-8">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-transparent"></div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 shadow-inner shadow-black/20 ring-1 ring-white/10">
                            <CreditCard size={28} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-indigo-200/70 uppercase tracking-widest drop-shadow-sm">Aggregated Fiscal Impact</div>
                            <div className="text-3xl font-black text-white num-font tracking-tight leading-none mt-1 drop-shadow-md">₹{
                                (() => {
                                    const items = Array.isArray(currentPI?.ITEMS) ? currentPI.ITEMS : [];
                                    let totalAmt = 0;
                                    items.forEach((it: any) => {
                                        totalAmt += (Number(it.QUANTITY_KG) || 0) * (Number(it.RATE_PER_UNIT) || 0);
                                    });
                                    const taxBase = totalAmt + (Number(currentPI?.DELIVERY_CHARGES) || 0);
                                    const cgst = taxBase * (Number(currentPI?.CGST_PERCENT) || 0) / 100;
                                    const sgst = taxBase * (Number(currentPI?.SGST_PERCENT) || 0) / 100;
                                    const igstPct = currentPI?.IGST_PERCENT !== undefined ? Number(currentPI.IGST_PERCENT) : 5;
                                    const igst = taxBase * igstPct / 100;
                                    const otherCharges = Number(currentPI?.OTHER_CHARGES) || 0;
                                    const net = taxBase + cgst + sgst + igst + otherCharges;
                                    return net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                })()
                            }</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-8 py-4 bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-300 hover:bg-white/20 hover:text-white transition-all shadow-sm"
                        >
                            Abort
                        </button>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                "px-10 py-4 bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all",
                                isLoading && "opacity-50 cursor-not-allowed scale-100"
                            )}
                        >
                            {isLoading ? 'Processing...' : 'Verify & Dispatch'}
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
