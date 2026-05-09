import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Search, 
  Download, 
  FileText, 
  Calendar as LucideCalendar, 
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
  PieChart as PieChartIcon,
  Activity,
  ArrowUpRight,
  ChevronRight,
  Users,
  FileSpreadsheet,
  BookOpen,
  UserCheck,
  FileText as FilePdf
} from 'lucide-react';
import { apiCall } from '../services/api';
import { cn, formatDate } from '../lib/utils';
import type { Notification } from '../types';

interface ReportsModuleProps {
  onNotify: (title: string, message: string, type?: Notification['type']) => void;
  onLog: (action: string, details: string) => void;
}

export default function ReportsModule({ onNotify, onLog }: ReportsModuleProps) {
  const [reportsData, setReportsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [activeReport, setActiveReport] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await apiCall('getReports', { startDate: dateFrom, endDate: dateTo });
      if (res.success) setReportsData(res);
    } catch (error) {
      onNotify('Error', 'Intelligence feed interrupted', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  const downloadCSV = (data: any[], title: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    onNotify('Exported', `${title} report generated`, 'success');
    onLog('CSV Export', `Generated spreadsheet for ${title}`);
  };

  const downloadPDF = (data: any[], title: string, headers: string[]) => {
    if (!data.length) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('YAJUR FIBRES LIMITED', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text(title.toUpperCase(), 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 32, { align: 'center' });
    doc.text(`Period: ${formatDate(dateFrom)} to ${formatDate(dateTo)}`, 105, 38, { align: 'center' });
    
    // Table
    const tableData = data.map(item => {
        if (activeReport === 'customerWise' || title.toLowerCase().includes('customer')) {
            return [item.account || '', Number(item.totalDelivered || 0).toLocaleString() + 'kg', Number(item.totalPending || 0).toLocaleString() + 'kg'];
        }
        if (activeReport === 'piWise' || title.toLowerCase().includes('p.i.')) {
            return [item.piNo || '', Number(item.totalDelivered || 0).toLocaleString() + 'kg', Number(item.totalPending || 0).toLocaleString() + 'kg'];
        }
        if (activeReport === 'signatoryWise' || title.toLowerCase().includes('signatory')) {
            return [item.signatory || '', item.totalPI || '0', Number(item.totalQty || 0).toLocaleString() + 'kg', item.pending || '0'];
        }
        return Object.values(item).map(v => String(v || ''));
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [13, 27, 62], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    
    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    onNotify('Exported', `${title} PDF generated`, 'success');
  };

  const reportCards = [
    { id: 'customerWise', label: 'Customer-wise Lifting', icon: <Users />, color: 'blue', data: reportsData?.customerWise, headers: ['Account', 'Target (kg)', 'Delivered (kg)', 'Balance (kg)'] },
    { id: 'piWise', label: 'P.I.-wise Summary', icon: <FileSpreadsheet />, color: 'teal', data: reportsData?.piWise, headers: ['PI No.', 'Inward (kg)', 'Delivered (kg)', 'Balance (kg)'] },
    { id: 'monthWise', label: 'Month-wise Trend', icon: <LucideCalendar />, color: 'indigo', data: reportsData?.monthWise, headers: ['Period', 'Delivered (kg)', 'Pending (kg)'] },
    { id: 'signatoryWise', label: 'Signatory Report', icon: <UserCheck />, color: 'amber', data: reportsData?.signatoryWise, headers: ['Signatory', 'PI Count', 'Quality (kg)', 'Remaining'] },
    { id: 'pendingPI', label: 'Pending P.I. List', icon: <Clock />, color: 'rose', data: reportsData?.pendingPIs, headers: ['PI No.', 'Date', 'Customer', 'Quantum'] },
    { id: 'allLifting', label: 'Delivery Ledger', icon: <BookOpen />, color: 'slate', data: reportsData?.allLifting, headers: ['ID', 'Account', 'PI No.', 'Inward (kg)', 'Delivered (kg)', 'Balance (kg)'] }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Date Filters */}
      <div className="bg-white p-6 rounded-custom border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-3">
            <LucideCalendar size={18} className="text-slate-400" />
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Audit Period</span>
        </div>
        <div className="flex flex-1 gap-3 w-full md:w-auto">
            <input type="date" className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <input type="date" className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button onClick={loadData} className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all">Synchronize feed</button>
      </div>

      {/* Analytics Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCards.map(report => (
          <div key={report.id} className="bg-white rounded-custom border border-slate-200 p-8 shadow-sm group hover:shadow-lg transition-all border-l-4 border-l-transparent hover:border-l-primary flex flex-col justify-between">
            <div className="flex items-start justify-between mb-8">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-100", `bg-${report.color}-500`)}>
                   {report.icon}
                </div>
                <div className="text-right">
                    <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-1">Audit Quantum</div>
                    <div className="text-xl font-black text-primary">{report.data?.length || 0}</div>
                </div>
            </div>
            
            <div>
                <h4 className="text-base font-black text-primary uppercase tracking-tight mb-2">{report.label}</h4>
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest line-clamp-1">Operational analysis aggregated</p>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                <button 
                  onClick={() => setActiveReport(report.id)}
                  className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest hover:text-accent transition-colors"
                >
                    View Details <ChevronRight size={14} />
                </button>
                <button onClick={() => downloadCSV(report.data || [], report.label)} className="p-2 text-slate-300 hover:text-accent hover:bg-accent/5 rounded-lg transition-all" title="Download CSV">
                    <Download size={16} />
                </button>
                <button onClick={() => downloadPDF(report.data || [], report.label, report.headers)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Download PDF">
                    <FilePdf size={16} />
                </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal / Table View */}
      {activeReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-md" onClick={() => setActiveReport(null)} />
          <div className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
             <div className="bg-primary text-white p-8 flex items-center justify-between shrink-0">
                <div>
                   <h3 className="text-2xl font-black uppercase tracking-tight">{reportCards.find(r => r.id === activeReport)?.label}</h3>
                   <p className="text-xs text-slate-200 font-bold uppercase tracking-widest mt-1">Refined Transaction Audit Log</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => downloadCSV(reportCards.find(r => r.id === activeReport)?.data || [], reportCards.find(r => r.id === activeReport)?.label || '')} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={() => {
                        const r = reportCards.find(rc => rc.id === activeReport);
                        if(r) downloadPDF(r.data || [], r.label, r.headers);
                    }} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                        <FilePdf size={14} /> PDF
                    </button>
                    <button onClick={() => setActiveReport(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <Activity size={24} className="rotate-45" />
                    </button>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-2">
                <table className="w-full text-left border-collapse">
                   <thead className="sticky top-0 bg-white z-10 shadow-sm">
                      <tr>
                        {reportCards.find(r => r.id === activeReport)?.headers.map(h => (
                          <th key={h} className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{h}</th>
                        ))}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {reportCards.find(r => r.id === activeReport)?.data?.map((item: any, i: number) => {
                         const report = reportCards.find(r => r.id === activeReport);
                         return (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                               {activeReport === 'customerWise' && [
                                  <td className="px-6 py-4 text-sm font-black text-primary uppercase">{item.account}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-indigo-600">{(Number(item.totalDelivered) + Number(item.totalPending)).toLocaleString()}kg</td>,
                                  <td className="px-6 py-4 text-sm font-black text-teal-600">{Number(item.totalDelivered).toLocaleString()}kg</td>,
                                  <td className="px-6 py-4 text-sm font-black text-rose-500">{Number(item.totalPending).toLocaleString()}kg</td>
                               ]}
                               {activeReport === 'piWise' && [
                                  <td className="px-6 py-4 text-sm font-black text-primary">{item.piNo}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-indigo-600">{(Number(item.totalDelivered) + Number(item.totalPending)).toLocaleString()}kg</td>,
                                  <td className="px-6 py-4 text-sm font-black text-teal-600">{Number(item.totalDelivered).toLocaleString()}kg</td>,
                                  <td className="px-6 py-4 text-sm font-black text-rose-500">{Number(item.totalPending).toLocaleString()}kg</td>
                               ]}
                               {activeReport === 'monthWise' && [
                                  <td className="px-6 py-4 text-sm font-black text-primary uppercase">{item.period}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-teal-600">{Number(item.totalDelivered).toLocaleString()}kg</td>,
                                  <td className="px-6 py-4 text-sm font-black text-rose-500">{Number(item.totalPending).toLocaleString()}kg</td>
                               ]}
                               {activeReport === 'signatoryWise' && [
                                  <td className="px-6 py-4 text-sm font-black text-primary uppercase">{item.signatory}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-slate-500">{item.totalPI} Orders</td>,
                                  <td className="px-6 py-4 text-sm font-black text-teal-600">{Number(item.totalQty).toLocaleString()}kg</td>,
                                  <td className="px-6 py-4 text-sm font-black text-rose-500">{item.pending} Active</td>
                               ]}
                               {activeReport === 'pendingPI' && [
                                  <td className="px-6 py-4 text-sm font-black text-primary">{item.PI_NO}</td>,
                                  <td className="px-6 py-4 text-sm font-bold text-slate-400">{formatDate(item.INVOICE_DATE)}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-slate-700 uppercase">{item.CUSTOMER_NAME}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-accent">{Number(item.QUANTITY_KG).toLocaleString()}kg</td>
                               ]}
                               {activeReport === 'allLifting' && [
                                  <td className="px-6 py-4 text-xs font-black text-slate-400">{item.LIFTING_ID}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-primary uppercase">{item.ACCOUNT}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-accent">{item.PI_NO}</td>,
                                  <td className="px-6 py-4 text-sm font-black text-indigo-600">{Number(item.TARGET_KG).toLocaleString()}kg</td>,
                                  <td className="px-6 py-4 text-sm font-black text-teal-600">{Number(item.DELIVERED_KG).toLocaleString()}kg</td>,
                                  <td className="px-6 py-4 text-sm font-black text-rose-500">{Number(item.REMAINING_KG).toLocaleString()}kg</td>
                               ]}
                            </tr>
                         )
                      })}
                   </tbody>
                </table>
                {(!reportCards.find(r => r.id === activeReport)?.data?.length) && (
                   <div className="py-20 text-center flex flex-col items-center justify-center">
                      <Activity size={48} className="text-slate-100 mb-4" />
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No audit data in selected period</p>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
