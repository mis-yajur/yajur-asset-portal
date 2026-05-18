import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
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
  CalendarDays
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
      
      const qty = Number(currentPI?.QUANTITY_KG) || 0;
      const rate = Number(currentPI?.RATE_PER_UNIT) || 0;
      const amount = qty * rate;

      // Ensure INVOICE_DATE is set
      const invoiceDate = currentPI?.INVOICE_DATE || new Date().toISOString().split('T')[0];

      const payload = {
        ...currentPI,
        PI_NO: piNo,
        INVOICE_DATE: invoiceDate,
        CUSTOMER_NAME: currentPI?.CUSTOMER_NAME || 'GENERAL ACCOUNT',
        ITEM_TOTAL: amount,
        NET_AMOUNT: amount,
        QUANTITY_KG: qty,
        RATE_PER_UNIT: rate,
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
        onLog(isEdit ? 'Update PI' : 'Add PI', `ID: ${piNo}, Qty: ${qty}kg`);
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

  const generatePIPdf = (pi: any) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      
      let currentY = margin;
      
      // PROFORMA INVOICE Title
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['PROFORMA INVOICE']],
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.5, lineColor: [0,0,0], fontSize: 11 },
        theme: 'grid'
      });
      currentY = (doc as any).lastAutoTable.finalY;

      // Seller Info Block
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        body: [
          ['', "YAJUR FIBRES LIMITED\n5, MIDDLETON STREET, RUSSEL STREET AREA\nKOLKATA, PIN - 700071, WEST BENGAL, INDIA\nCONTACT NO. +91-9903862793\nE-mail : sales@yajurfibres.com\nCIN : U17100WB1980PLC032918\nGSTIN : 19AAECS2882B3ZB", "European Flax.\nPremium linen fiber\nCertificate No: BVFR14492922\n\nPROFORMA INVOICE NO : \n" + pi.PI_NO + "\nDATE : " + formatDate(pi.INVOICE_DATE || new Date())]
        ],
        columnStyles: {
          0: { cellWidth: 40, halign: 'center', valign: 'middle' }, // Logo area
          1: { cellWidth: 95, halign: 'center', fontSize: 8 },
          2: { cellWidth: 55, halign: 'left', fontSize: 9 }
        },
        theme: 'grid',
        styles: { textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.5 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY;
      
      // CONSIGNEE & DELIVERY
      const customerName = `M/s ${pi.CUSTOMER_NAME || 'KARWA YARN PVT. LTD.'}`;
      const customerAddress = pi.CUSTOMER_ADDRESS || 'GOPAL BAG, P.O. - BHULLANPUR PAC\nMANDUADIH, VARANASI, PIN - 221108\nUTTAR PRADESH';
      const customerGst = pi.CUSTOMER_GST_NO || '09AAFCA1542F1Z0';

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['CONSIGNEE', 'DELIVERY']],
        headStyles: { fillColor: [245, 245, 245], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', lineWidth: 0.5, lineColor: [0,0,0] },
        body: [
          [
            `${customerName}\n${customerAddress}\nGSTIN :\t${customerGst}`,
            `${customerName}\n${pi.DELIVERY_ADDRESS || customerAddress}\nGSTIN :\t${customerGst}`
          ]
        ],
        columnStyles: {
          0: { cellWidth: (pageWidth - 2*margin)/2, fontSize: 9 },
          1: { cellWidth: (pageWidth - 2*margin)/2, fontSize: 9 }
        },
        theme: 'grid',
        styles: { textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.5 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY;
      
      const qty = Number(pi.QUANTITY_KG) || 0;
      const rate = Number(pi.RATE_PER_UNIT) || 0;
      const total = qty * rate;
      
      // Products Table
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['SL.NO', 'PRODUCT / QUALITY', 'Unit/Box', 'Quantity\n( in Kg.)', 'Rate/Kg\n( in Rs.)', 'Total (In Rs.)']],
        headStyles: { fillColor: [245, 245, 245], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', lineWidth: 0.5, lineColor: [0,0,0], fontSize: 9 },
        body: [
          ['1', `${pi.PRODUCT_QUALITY || 'FLAX YARN - 6 LEA NATURAL'}\nUNPOLISHED IN HANK FORM`, pi.UNIT_COUNT ? pi.UNIT_COUNT.toFixed(2) : '133.00', qty.toFixed(2), rate.toFixed(2), total.toFixed(2)],
          ...Array.from({length: 6}).map(() => ['', '', '', '', '', '']) // Extra blank rows
        ],
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 65 },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 35, halign: 'right' }
        },
        theme: 'grid',
        styles: { textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.5, fontSize: 9, minCellHeight: 8 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY;
      
      const cgst = 0;
      const sgst = 0;
      const igst = total * 0.05; // 5% IGST usually
      const netAmount = total + cgst + sgst + igst;
      
      // Footer Table 1 (Totals)
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        body: [
          [{ content: 'TOTAL :', colSpan: 2 }, pi.UNIT_COUNT ? pi.UNIT_COUNT.toFixed(2) : '133.00', qty.toFixed(2), '', total.toFixed(2)],
          [{ content: 'Add : Delivery Charges\t\t\t\t\t\t\t\tTo Pay', colSpan: 5 }, '0.00'],
          [{ content: 'Total Amount Before Tax :', colSpan: 5 }, total.toFixed(2)],
          [{ content: 'Add : CGST', colSpan: 5 }, cgst.toFixed(2)],
          [{ content: 'Add : SGST', colSpan: 5 }, sgst.toFixed(2)],
          [{ content: 'Add : IGST', colSpan: 4 }, '5%', igst.toFixed(2)],
          [{ content: 'Other Charges :', colSpan: 5 }, '0.00'],
          [{ content: 'Net Amount : (In Rs.)', colSpan: 5 }, netAmount.toFixed(2)],
          [{ content: 'Payment Terms :   100% advance before dispatch.', colSpan: 6, styles: { fontStyle: 'bold' } }],
          [{ content: 'Note : The above quoted price is ex-factory', colSpan: 6, styles: { fontStyle: 'bold' } }],
          [{ content: 'Consignment Note :', colSpan: 6 }],
          [{ content: 'Vehicle No. :', colSpan: 3 }, { content: 'Transport Mode: Through Jain Carrying Transport (By Road)', colSpan: 3 }],
          [{ content: 'Bank Details\nYAJUR FIBRES LIMITED\nBANK :\t\t\tICICI BANK LTD\nBRANCH :\t\tMIDDLETON STREET, KOLKATA-71\nA/C NO :\t\t\t355051000003\nRTGS CODE :\t\tICIC0003550', colSpan: 3, styles: { cellPadding: 2 } }, { content: 'YAJUR FIBRES LIMITED\n\n\n\n\nAuthorised Signatory', colSpan: 3 }]
        ],
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 65 },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 35, halign: 'right' }
        },
        theme: 'grid',
        styles: { textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.5, fontSize: 9 }
      });
      
      // Add text at bottom
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Regd . Office : 5, MIDDLETON STREET, KOLKATA - 700071, WEST BENGAL, INDIA, M - 9903862793", margin, pageHeight - 15);
      
      doc.save(`PI_${pi.PI_NO}.pdf`);
      onNotify('Success', 'PDF generated successfully', 'success');
      onLog('Export PDF', `Generated PI ${pi.PI_NO}`);
    } catch (error) {
      console.error(error);
      onNotify('Error', 'Failed to generate PDF', 'error');
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
                          <button onClick={() => { setCurrentEntry(pi); setIsModalOpen(true); }} className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-all" title="Edit">
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
                        <div className="text-sm font-black">Yajur Lifting</div>
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

             <form onSubmit={handleSave} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
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

                <div className="grid grid-cols-1 gap-8 ring-1 ring-slate-100 p-6 rounded-3xl bg-slate-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                             <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Party Name (Customer)</label>
                             <input 
                                required
                                placeholder="Enter Customer Name"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-accent/40"
                                value={currentPI?.CUSTOMER_NAME || ''}
                                onChange={e => setCurrentEntry({ ...currentPI, CUSTOMER_NAME: e.target.value })}
                             />
                        </div>
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
                    </div>

                    <div className="space-y-6">
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
                            disabled={isLoading}
                            className={cn(
                                "px-10 py-4 bg-accent text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all",
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
