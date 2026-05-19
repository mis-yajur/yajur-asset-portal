import React, { useState, useMemo } from 'react';
import { Download, FileSpreadsheet, Search, User, FileText, Info, ArrowUpRight, ArrowDownRight, Printer, IndianRupee } from 'lucide-react';
import { PI as PIData, Lifting as LiftingData } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiCall } from '../services/api';

interface LedgerModuleProps {
  onNotify: (t: string, m: string, s: 'success' | 'error' | 'info' | 'warning') => void;
}

import { syncLedgerToSheet } from '../lib/ledgerSync';

export function LedgerModule({ onNotify }: LedgerModuleProps) {
  const [activeTab, setActiveTab] = useState<'party' | 'stock'>('party');
  const [search, setSearch] = useState('');
  const [ledgerEntriesRaw, setLedgerEntriesRaw] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLedger = async () => {
      setIsLoading(true);
      try {
        console.log("Fetching ledger data...");
        const res = await apiCall('getLedger');
        console.log("Got ledger data length:", res.data?.length);
        if (!res.data || res.data.length === 0) {
           console.log("Ledger empty, syncing from PI and Lifting...");
           await syncLedgerToSheet();
           console.log("Sync complete, fetching again...");
           const res2 = await apiCall('getLedger');
           console.log("Got ledger data length after sync:", res2.data?.length);
           setLedgerEntriesRaw(res2.data || []);
        } else {
           setLedgerEntriesRaw(res.data);
        }
      } catch (err) {
        console.error("fetchLedger failed:", err);
        onNotify('Error', 'Failed to fetch ledger data', 'error');
      } finally {
        setIsLoading(false);
      }
  };

  React.useEffect(() => {
    fetchLedger();
  }, [onNotify]);


  // Calculate Ledger Rows
  const filteredLedger = useMemo(() => {
    // We already have generic rows in ledger sheet. Filter by Stock or Party based on ACCOUNT_PI prefixes
    let filtered = ledgerEntriesRaw.filter(e => {
        if (!e.ACCOUNT_PI) return false;
        if (activeTab === 'stock' && String(e.ACCOUNT_PI).startsWith('STOCK_')) return true;
        if (activeTab === 'party' && String(e.ACCOUNT_PI).startsWith('PARTY_')) return true;
        return false;
    });

    if (search) {
        filtered = filtered.filter(e => 
           (e.REMARKS && e.REMARKS.toLowerCase().includes(search.toLowerCase())) ||
           (e.ACCOUNT_PI && e.ACCOUNT_PI.toLowerCase().includes(search.toLowerCase()))
        );
    }

    let grouped: any = {};
    filtered.forEach(entry => {
       const groupKey = String(entry.ACCOUNT_PI).replace('STOCK_', '').replace('PARTY_', '');
       if (!grouped[groupKey]) grouped[groupKey] = [];
       
       const isInit = String(entry.REMARKS || '').includes('||true');
       const piInfo = String(entry.REMARKS || '').split('||')[0];
       
       grouped[groupKey].push({
           date: entry.DATE,
           type: entry.TYPE,
           piNo: activeTab === 'stock' ? groupKey : piInfo,
           account: activeTab === 'party' ? groupKey : '',
           qty: Number(entry.INWARD_TARGET_KG) || Number(entry.OUTWARD_DELIVERED_KG) || 0,
           qtyIn: Number(entry.INWARD_TARGET_KG) || 0,
           qtyOut: Number(entry.OUTWARD_DELIVERED_KG) || 0,
           isInitial: isInit,
           group: groupKey,
           id: entry.ID
       });
    });

    const res: any[] = [];
    Object.keys(grouped).sort().forEach(group => {
       let balQty = 0;
       grouped[group].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach((entry: any) => {
         if (activeTab === 'stock') {
            balQty += entry.qtyIn - entry.qtyOut;
            res.push({ ...entry, balanceQty: balQty });
         } else {
            balQty += (entry.qtyIn > 0 ? entry.qtyIn : 0) - (entry.qtyOut > 0 ? entry.qtyOut : 0);
            res.push({ ...entry, balanceQty: balQty });
         }
       });
       if (activeTab === 'party') {
           res.push({ isSummary: true, group: group, balanceQty: balQty });
       }
    });
    return res;
  }, [ledgerEntriesRaw, activeTab, search]);

  const forceAutoSync = async () => {
     try {
        setIsLoading(true);
        console.log("Forcing re-sync of ledger sheet from scratch...");
        const lifts = await apiCall('getLiftingData');
        console.log("DEBUG LIFTS", lifts.data?.slice(0, 2));
        onNotify('Info', 'Rebuilding Ledger Sheet from PI and Lifting data...', 'info');
        await syncLedgerToSheet();
        await fetchLedger();
        onNotify('Success', 'Ledger Sheet rebuilt successfully.', 'success');
     } catch (err) {
        onNotify('Error', 'Ledger rebuild failed', 'error');
     } finally {
        setIsLoading(false);
     }
  };

  const syncToSheet = async () => {
    // renamed to forceAutoSync
    await forceAutoSync();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Ledger Report (${activeTab === 'party' ? 'Party/Financial' : 'PI/Stock'})`, 14, 20);
    
    let tableData = [];
    let head = [];
    if (activeTab === 'party') {
      head = [['Account', 'Date', 'Type', 'PI Ref', 'Inward Target (Kg)', 'Outward Delivered (Kg)', 'Balance (Kg)']];
      tableData = filteredLedger.filter(e => !e.isSummary).map(e => [
        e.group,
        new Date(e.date).toLocaleDateString(),
        e.type,
        e.piNo,
        e.isInitial ? e.qty + ' kg' : '-',
        !e.isInitial ? e.qty + ' kg' : '-',
        e.balanceQty + ' kg'
      ]);
    } else {
      head = [['PI No', 'Date', 'Type', 'Account', 'Inward (Kg)', 'Outward (Kg)', 'Balance (Kg)']];
      tableData = filteredLedger.map(e => [
        e.group,
        new Date(e.date).toLocaleDateString(),
        e.type,
        e.account,
        e.qtyIn ? e.qtyIn + ' kg' : '-',
        e.qtyOut ? e.qtyOut + ' kg' : '-',
        e.balanceQty + ' kg'
      ]);
    }
    
    autoTable(doc, {
      startY: 30,
      head: head,
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] }
    });

    doc.save(`Ledger_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    onNotify('Success', 'PDF ledgers exported successfully', 'success');
  };

  const exportCSV = () => {
    let headers = [];
    let rows = [];
    if (activeTab === 'party') {
      headers = ['Account', 'Date', 'Type', 'PI No', 'Inward Target (Kg)', 'Outward Delivered (Kg)', 'Balance (Kg)', 'Remarks'];
      rows = filteredLedger.filter(e => !e.isSummary).map(e => [
        `"${e.group}"`, `"${new Date(e.date).toLocaleDateString()}"`, `"${e.type}"`, `"${e.piNo}"`, e.isInitial ? e.qty : 0, !e.isInitial ? e.qty : 0, e.balanceQty, `"${e.remarks}"`
      ]);
    } else {
      headers = ['PI No', 'Date', 'Type', 'Account', 'Qty IN (Stock)', 'Qty OUT (Delivered)', 'Balance', 'Remarks'];
      rows = filteredLedger.map(e => [
        `"${e.group}"`, `"${new Date(e.date).toLocaleDateString()}"`, `"${e.type}"`, `"${e.account}"`, e.qtyIn, e.qtyOut, e.balanceQty, `"${e.remarks}"`
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Ledger_${activeTab}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('Success', 'CSV export initiated', 'success');
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredLedger.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [filteredLedger]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-border-main">
        <div>
          <h2 className="text-2xl font-black text-primary-main tracking-tight uppercase flex items-center">
             Ledger & Analytics
          </h2>
          <p className="text-text-dim text-sm mt-1 font-semibold">Tally-style Financial accounts and PI-wise Stock tracking.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={syncToSheet}
            className="flex-1 md:flex-none justify-center px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors shadow-sm flex items-center text-sm"
          >
            <Download size={16} className="mr-2 opacity-70" /> Sync to Sheet
          </button>
          <button 
            onClick={exportCSV}
            className="flex-1 md:flex-none justify-center px-4 py-2 border border-border-main text-text-main font-bold rounded-xl hover:bg-surface-muted transition-colors flex items-center text-sm"
          >
            <Download size={16} className="mr-2 text-accent" /> Export CSV
          </button>
          
          <button 
            onClick={exportPDF}
            className="flex-1 md:flex-none justify-center px-4 py-2 bg-primary-main text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-md shadow-primary-main/20 flex items-center text-sm"
          >
            <Printer size={16} className="mr-2" /> Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-border-main overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-main bg-surface-muted/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex bg-border-main p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('party')}
              className={`flex-1 px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center justify-center ${activeTab === 'party' ? 'bg-white text-primary-main shadow-sm' : 'text-text-dim hover:text-text-main'}`}
            >
              <User size={14} className="mr-2" /> Party Ledger (Sales)
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`flex-1 px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center justify-center ${activeTab === 'stock' ? 'bg-white text-primary-main shadow-sm' : 'text-text-dim hover:text-text-main'}`}
            >
              <FileSpreadsheet size={14} className="mr-2" /> Stock Ledger (PI-Wise)
            </button>
          </div>

          <div className="relative w-full sm:w-64 shrink-0 shadow-sm rounded-xl overflow-hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-border-main rounded-xl outline-none focus:border-accent font-semibold"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="p-12 text-center text-text-dim">
               <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-20" />
               <p className="font-bold">No ledger entries found.</p>
            </div>
          ) : (
            <div className="p-6 space-y-12">
              {Object.entries(groupedItems).map(([groupKey, items]: [string, any[]]) => (
                <div key={groupKey} className="border border-border-main rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="bg-surface-muted flex p-4 border-b border-border-main items-center justify-between">
                    <h3 className="font-black text-primary-main uppercase tracking-wider text-base flex items-center">
                      <div className="w-2 h-2 rounded-full bg-accent mr-3"></div>
                      {groupKey}
                    </h3>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-green-50/30 border-b border-green-100 text-[10px] uppercase text-green-800 tracking-widest font-extrabold">
                        {activeTab === 'stock' ? (
                          <>
                            <th className="p-4">Entry Date</th>
                            <th className="p-4">Particulars / Ref</th>
                            <th className="p-4 text-center">Inward (Kg)</th>
                            <th className="p-4 text-center">Outward (Kg)</th>
                            <th className="p-4 text-center">Balance (Kg)</th>
                          </>
                        ) : (
                          <>
                            <th className="p-4">ENTRY DATE</th>
                            <th className="p-4">PARTICULARS / REF</th>
                            <th className="p-4 text-center">INWARD / TARGET</th>
                            <th className="p-4 text-center">OUTWARD (DELIVERED)</th>
                            <th className="p-4 text-center">BALANCE</th>
                          </>
                        )}
                        
                      </tr>
                    </thead>
                    <tbody className="text-sm font-semibold text-text-main divide-y divide-border-main/50">
                      {(items as any[]).map((entry, idx) => {
                        if (entry.isSummary) return null;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            {activeTab === 'stock' ? (
                              <>
                                <td className="p-4">
                                   <div className="text-xs font-black text-slate-800">{new Date(entry.date).toLocaleDateString('en-GB').replace(/\//g, '-')}</div>
                                   <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase">{new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td className="p-4">
                                   <div className="flex flex-col gap-1 items-start">
                                      <span className={`text-[10px] font-bold uppercase tracking-wider ${entry.type.includes('Delivery') ? 'text-teal-700' : 'text-indigo-700'}`}>
                                        {entry.type}
                                      </span>
                                      <span className="font-mono text-[10px] text-slate-500 font-bold">
                                        {entry.account}
                                      </span>
                                   </div>
                                </td>
                                <td className="p-4 text-center">
                                  {entry.qtyIn > 0 ? <span className="text-indigo-600 font-black text-sm">{entry.qtyIn.toLocaleString()} kg</span> : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="p-4 text-center">
                                  {entry.qtyOut > 0 ? <span className="text-teal-600 font-black text-sm">{entry.qtyOut.toLocaleString()} kg</span> : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="p-4 text-center">
                                  <span className="text-slate-900 font-black text-sm">{entry.balanceQty.toLocaleString()} kg</span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-4">
                                   <div className="flex flex-col gap-1">
                                     <div className="text-xs font-black text-slate-800 whitespace-nowrap">{new Date(entry.date).toLocaleDateString('en-GB').replace(/\//g, '-')}</div>
                                     <div className="text-[10px] font-bold text-teal-700 whitespace-nowrap">{new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                   </div>
                                </td>
                                <td className="p-4">
                                   {entry.isInitial ? (
                                      <div className="flex flex-col gap-1 items-start">
                                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Initial Allocation</span>
                                        <span className="font-mono text-[10px] text-indigo-500 font-bold tracking-widest">{entry.piNo}</span>
                                      </div>
                                   ) : (
                                     <div className="flex flex-col gap-1 items-start">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${entry.type?.includes('Delivery') ? 'text-teal-700' : 'text-slate-600'}`}>
                                          {entry.type}
                                        </span>
                                        <span className="font-mono text-[10px] text-slate-500 font-bold tracking-widest">{entry.piNo}</span>
                                     </div>
                                   )}
                                </td>
                                <td className="p-4 text-center">
                                  {entry.isInitial ? <span className="text-indigo-600 font-bold text-xs">{entry.qty.toLocaleString()} kg</span> : <span className="text-teal-600 font-bold text-xs">-</span>}
                                </td>
                                <td className="p-4 text-center">
                                  {!entry.isInitial && entry.qty > 0 ? <span className="text-teal-600 font-bold text-xs">{entry.qty.toLocaleString()} kg</span> : <span className="text-teal-600 font-bold text-xs">-</span>}
                                </td>
                                <td className="p-4 text-center">
                                   <span className="text-slate-900 font-bold text-xs">{Math.abs(entry.balanceQty).toLocaleString()} kg</span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
