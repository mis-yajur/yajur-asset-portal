import React, { useState, useMemo } from 'react';
import { Download, FileSpreadsheet, Search, User, FileText, Info, ArrowUpRight, ArrowDownRight, Printer, IndianRupee } from 'lucide-react';
import { PI as PIData, Lifting as LiftingData } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiCall } from '../services/api';

interface LedgerModuleProps {
  onNotify: (t: string, m: string, s: 'success' | 'error' | 'info' | 'warning') => void;
}

export function LedgerModule({ onNotify }: LedgerModuleProps) {
  const [activeTab, setActiveTab] = useState<'party' | 'stock'>('party');
  const [search, setSearch] = useState('');
  const [piData, setPiData] = useState<PIData[]>([]);
  const [liftingData, setLiftingData] = useState<LiftingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [piRes, liftRes, arcPiRes, arcLiftRes] = await Promise.all([
          apiCall('getPIData'),
          apiCall('getLiftingData'),
          apiCall('getArchivePI'),
          apiCall('getArchiveLifting')
        ]);
        
        const allPis = [...(piRes.data || []), ...(arcPiRes.data || [])];
        const allLifts = [...(liftRes.data || []), ...(arcLiftRes.data || [])];

        setPiData(allPis);
        
        const parsedData = allLifts.map((item: any) => {
          let historyStr = item.HISTORY || item.history || item.History || item.DELIVERY_HISTORY || item.NOTES;
          let history = historyStr;
          if (typeof history === 'string') {
            try { history = JSON.parse(historyStr); } catch (e) { history = []; }
          }
          return { ...item, HISTORY: Array.isArray(history) ? history : [] };
        });
        setLiftingData(parsedData);
      } catch (err) {
        onNotify('Error', 'Failed to fetch ledger data', 'error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [onNotify]);

  // Calculate Ledger Rows
  const ledgerEntries = useMemo(() => {
    const stockEntries: any[] = [];
    const partyEntries: any[] = [];

    const piMap = new Map<string, any>();
    piData.forEach(pi => {
      const piKey = (pi.PI_NO || '').trim();
      if (!piKey) return;
      piMap.set(piKey, pi);

      const rate = Number(pi.RATE_PER_UNIT) || 0;
      const lifts = liftingData.filter(l => (l.PI_NO || '').trim().toUpperCase() === piKey.toUpperCase());

      // Skip General Account / Internal accounts as requested
      const isGeneral = (name: string) => String(name || '').trim().toUpperCase() === 'GENERAL ACCOUNT';

      if (lifts.length > 0) {
        lifts.forEach(lift => {
          if (isGeneral(lift.ACCOUNT)) return;
          const targetQty = Number(lift.TARGET_KG) || 0;

          // Party Ledger Entry (Split by account)
          partyEntries.push({
            date: pi.CREATED_AT || pi.PI_DATE || pi.DATE || new Date().toISOString(),
            type: 'PI Target Lifting',
            account: lift.ACCOUNT,
            piNo: piKey,
            qty: targetQty,
            rate: rate,
            debitAmt: 0,
            creditAmt: 0,
            isInitial: true,
            remarks: `Target set for ${pi.PRODUCT_QUALITY}`
          });
        });
      } else if (!isGeneral(pi.CUSTOMER_NAME)) {
        const targetQty = Number(pi.QUANTITY_KG) || 0;
        partyEntries.push({
          date: pi.CREATED_AT || pi.PI_DATE || pi.DATE || new Date().toISOString(),
          type: 'PI Target Lifting',
          account: pi.CUSTOMER_NAME,
          piNo: piKey,
          qty: targetQty,
          rate: rate,
          debitAmt: 0,
          creditAmt: 0,
          isInitial: true,
          remarks: `Target set for ${pi.PRODUCT_QUALITY}`
        });
      }

      // Stock Ledger Entry: Inward (Production) - Use PI total as base
      const totalPiQty = Number(pi.QUANTITY_KG) || 0;
      stockEntries.push({
        date: pi.CREATED_AT || pi.PI_DATE || pi.DATE || new Date().toISOString(),
        type: 'Stock Prepared',
        account: pi.CUSTOMER_NAME || 'Factory / Master',
        piNo: piKey,
        qtyIn: totalPiQty,
        qtyOut: 0,
        rate: rate,
        amount: 0,
        remarks: `PI Created: ${pi.PRODUCT_QUALITY || ''}`
      });
    });

    liftingData.forEach(lift => {
      const piKey = (lift.PI_NO || '').trim();
      const piInfo = piMap.get(piKey) || {};
      const rate = Number(piInfo.RATE_PER_UNIT || lift.RATE) || 0;

      const history = Array.isArray(lift.HISTORY) ? lift.HISTORY : [];
      let mappedDeliveries = history.map(h => ({
        date: h.deliveryDate || h.timestamp,
        type: 'Delivery (Sales)',
        account: lift.ACCOUNT,
        piNo: piKey,
        qtyOut: Number(h.quantityKg) || 0,
        rate: rate,
        amount: (Number(h.quantityKg) || 0) * rate,
        remarks: `Invoice / Dispatch`
      }));

      // If there are legacy lifted amounts not in history
      if (mappedDeliveries.length === 0 && Number(lift.DELIVERED_KG) > 0) {
        mappedDeliveries.push({
          date: lift.LAST_DELIVERY_DATE || lift.DATE || new Date().toISOString(),
          type: 'Legacy Delivery',
          account: lift.ACCOUNT,
          piNo: piKey,
          qtyOut: Number(lift.DELIVERED_KG) || 0,
          rate: rate,
          amount: (Number(lift.DELIVERED_KG) || 0) * rate,
          remarks: `Legacy Delivery Record`
        });
      }

      mappedDeliveries.forEach(d => {
         // Stock Ledger Entry: Outward (Sales)
         stockEntries.push({
           date: d.date,
           type: d.type,
           account: d.account,
           piNo: d.piNo,
           qtyIn: 0,
           qtyOut: d.qtyOut,
           rate: d.rate,
           amount: d.amount,
           remarks: `Sold to ${d.account}`
         });

         // Party Ledger Entry: Sales (Debit for Party)
         partyEntries.push({
           date: d.date,
           type: d.type,
           account: d.account,
           piNo: d.piNo,
           qty: d.qtyOut,
           rate: d.rate,
           debitAmt: d.amount,
           creditAmt: 0,
           remarks: `Delivery against PI ${d.piNo}`
         });
      });
    });

    stockEntries.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      // Sort by date (ignoring time for consistent grouping)
      dateA.setHours(0,0,0,0);
      dateB.setHours(0,0,0,0);
      
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
      
      // On same day, Target (Inward) comes first
      if (a.type?.toLowerCase().includes('target') || a.type?.toLowerCase().includes('prepared')) return -1;
      if (b.type?.toLowerCase().includes('target') || b.type?.toLowerCase().includes('prepared')) return 1;
      
      return 0;
    });
    partyEntries.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      dateA.setHours(0,0,0,0);
      dateB.setHours(0,0,0,0);
      
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
      
      if (a.isInitial) return -1;
      if (b.isInitial) return 1;
      
      return 0;
    });
    
    return { stockEntries, partyEntries };
  }, [piData, liftingData]);

  // Filter based on Tab
  const filteredLedger = useMemo(() => {
    const { stockEntries, partyEntries } = ledgerEntries;

    if (activeTab === 'party') {
      let list = partyEntries;
      if (search) {
        list = list.filter(e => 
          (e.account && e.account.toLowerCase().includes(search.toLowerCase())) ||
          (e.piNo && e.piNo.toLowerCase().includes(search.toLowerCase()))
        );
      }
      
      const byCustomer: Record<string, any[]> = {};
      list.forEach(e => {
        if (!byCustomer[e.account]) byCustomer[e.account] = [];
        byCustomer[e.account].push(e);
      });
      
      const res: any[] = [];
      Object.keys(byCustomer).sort().forEach(acc => {
        let runningPriceBal = 0;
        let runningQtyBal = 0;
        
        byCustomer[acc].forEach(entry => {
          if (entry.isInitial) {
             runningPriceBal += (entry.qty * entry.rate);
             runningQtyBal += entry.qty;
          } else {
             // Reductions for deliveries
             runningPriceBal -= entry.debitAmt;
             runningQtyBal -= entry.qty;
          }
          res.push({ 
            ...entry, 
            balanceAmt: runningPriceBal, 
            balanceQty: runningQtyBal,
            group: acc 
          });
        });
        
        // Push a summary row for party
        res.push({
           isSummary: true,
           group: acc,
           balanceAmt: runningPriceBal,
           balanceQty: runningQtyBal
        });
      });
      return res;
    } else {
      let list = stockEntries;
      if (search) {
        list = list.filter(e => 
          (e.account && e.account.toLowerCase().includes(search.toLowerCase())) ||
          (e.piNo && e.piNo.toLowerCase().includes(search.toLowerCase()))
        );
      }
      
      const byPI: Record<string, any[]> = {};
      list.forEach(e => {
        if (!byPI[e.piNo]) byPI[e.piNo] = [];
        byPI[e.piNo].push(e);
      });
      
      const res: any[] = [];
      Object.keys(byPI).sort().forEach(pi => {
        let balQty = 0;
        byPI[pi].forEach(entry => {
          balQty += entry.qtyIn - entry.qtyOut;
          res.push({ ...entry, balanceQty: balQty, group: pi });
        });
      });
      return res;
    }
  }, [ledgerEntries, activeTab, search]);

  const syncToSheet = async () => {
    try {
      const rows = filteredLedger
        .filter(e => !e.isSummary)
        .map(e => ({
          ID: Math.random().toString(36).substr(2, 9).toUpperCase(),
          DATE: new Date(e.date).toLocaleString(),
          PI_NO: e.piNo || '',
          ACCOUNT: e.account || '',
          TYPE: e.type || '',
          QTY: e.qty || 0,
          RATE: e.rate || 0,
          DELIVERED_AMT: e.debitAmt || 0,
          PRICE_BALANCE: e.balanceAmt || 0,
          QTY_BALANCE: e.balanceQty || 0,
          REMARKS: e.remarks || '',
          // Aliases for historical compatibility with old sheet headers
          DEBIT_TARGET: e.isInitial ? e.qty : 0,
          CREDIT_DELIVERED: e.isInitial ? 0 : e.debitAmt,
          BALANCE: e.balanceAmt
        }));

      // onNotify('Info', 'Initiating connection to mainframe...', 'info');
      const res = await apiCall('syncLedger', { rows });
      if (res.success) {
        // onNotify('Success', 'Ledger Sheet Synchronized Successfully', 'success');
      } else {
        onNotify('Error', 'Sync Failure: ' + res.error, 'error');
      }
    } catch (err) {
      onNotify('Error', 'Remote System Communication Error', 'error');
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Ledger Report (${activeTab === 'party' ? 'Party/Financial' : 'PI/Stock'})`, 14, 20);
    
    let tableData = [];
    let head = [];
    if (activeTab === 'party') {
      head = [['Account', 'Date', 'Type', 'PI Ref', 'Qty', 'Rate', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)']];
      tableData = filteredLedger.filter(e => !e.isSummary).map(e => [
        e.group,
        new Date(e.date).toLocaleDateString(),
        e.type,
        e.piNo,
        e.qty + ' kg',
        '₹' + (e.rate || 0),
        e.debitAmt?.toFixed(2),
        e.creditAmt?.toFixed(2),
        e.balanceAmt?.toFixed(2)
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
      headers = ['Account', 'Date', 'Type', 'PI No', 'Qty', 'Rate', 'Debit Amount', 'Credit Amount', 'Balance Amount', 'Remarks'];
      rows = filteredLedger.filter(e => !e.isSummary).map(e => [
        `"${e.group}"`, `"${new Date(e.date).toLocaleDateString()}"`, `"${e.type}"`, `"${e.piNo}"`, e.qty, e.rate, e.debitAmt, e.creditAmt, e.balanceAmt, `"${e.remarks}"`
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
                    {activeTab === 'party' && (
                       <div className="px-3 py-1 bg-white border border-border-main rounded text-xs font-bold text-text-dim uppercase">
                          Current Outstanding: <span className="text-red-500 font-black ml-1">
                             ₹{Math.abs(items.find(i => i.isSummary)?.balanceAmt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </span>
                       </div>
                    )}
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-border-main text-xs uppercase text-text-dim tracking-wider font-extrabold">
                        <th className="p-4">Date</th>
                        <th className="p-4">Particulars / Type</th>
                        <th className="p-4">Reference</th>
                        
                        {activeTab === 'stock' ? (
                          <>
                            <th className="p-4 bg-green-50/30 text-green-600 text-right">Inward (Kg)</th>
                            <th className="p-4 bg-red-50/30 text-red-600 text-right">Outward (Kg)</th>
                            <th className="p-4 text-right text-primary-main">Balance (Kg)</th>
                          </>
                        ) : (
                          <>
                            <th className="p-4 text-right">Delivered Qty</th>
                            <th className="p-4 text-right">Rate</th>
                            <th className="p-4 bg-red-50/30 text-red-600 text-right">Delivered Amt</th>
                            <th className="p-4 text-right text-primary-main">Price Balance</th>
                            <th className="p-4 text-right text-indigo-600 font-black">Qty Balance</th>
                          </>
                        )}
                        
                      </tr>
                    </thead>
                    <tbody className="text-sm font-semibold text-text-main divide-y divide-border-main/50">
                      {(items as any[]).map((entry, idx) => {
                        if (entry.isSummary) return null; // Used for closing balance display
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-text-dim">{new Date(entry.date).toLocaleDateString()}</td>
                            <td className="p-4 capitalize">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${entry.type.includes('Delivery') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                                {entry.type}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-xs text-text-dim">
                               {activeTab === 'stock' ? entry.account : entry.piNo}
                            </td>
                            
                            {activeTab === 'stock' ? (
                              <>
                                <td className="p-4 text-right">
                                  {entry.qtyIn > 0 ? <span className="text-green-600 font-bold">{entry.qtyIn.toLocaleString()}</span> : '-'}
                                </td>
                                <td className="p-4 text-right">
                                  {entry.qtyOut > 0 ? <span className="text-red-500 font-bold">{entry.qtyOut.toLocaleString()}</span> : '-'}
                                </td>
                                <td className="p-4 text-right">
                                  <span className="bg-primary-main text-white px-2 py-1 rounded font-bold">{entry.balanceQty.toLocaleString()}</span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-4 text-right font-bold">
                                  {entry.isInitial ? entry.qty.toLocaleString() : entry.qty.toLocaleString()}
                                </td>
                                <td className="p-4 text-right">
                                  ₹{entry.rate}
                                </td>
                                <td className="p-4 text-right">
                                  {entry.debitAmt > 0 ? <div className="text-red-500 font-bold">₹{entry.debitAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}</div> : '₹0.00'}
                                </td>
                                <td className="p-4 text-right text-primary-main font-black">
                                  ₹{Math.abs(entry.balanceAmt).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </td>
                                <td className="p-4 text-right">
                                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg font-black text-xs uppercase tracking-tighter">
                                    {Math.abs(entry.balanceQty).toLocaleString()} kg
                                  </span>
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
