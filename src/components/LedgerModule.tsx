import React, { useState, useMemo } from 'react';
import { Download, FileSpreadsheet, Search, User, FileText, Info, ArrowUpRight, ArrowDownRight, Printer } from 'lucide-react';
import { PIData, LiftingData } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LedgerModuleProps {
  onNotify: (t: string, m: string, s: 'success' | 'error') => void;
}

export function LedgerModule({ onNotify }: LedgerModuleProps) {
  const [activeTab, setActiveTab] = useState<'customer' | 'pi'>('customer');
  const [search, setSearch] = useState('');
  const [piData, setPiData] = useState<PIData[]>([]);
  const [liftingData, setLiftingData] = useState<LiftingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [piRes, liftRes] = await Promise.all([
          apiCall('getPIData'),
          apiCall('getLiftingData')
        ]);
        if(piRes.success) setPiData(piRes.data || []);
        if(liftRes.success) {
          const parsedData = (liftRes.data || []).map((item: any) => {
            let history = item.HISTORY;
            if (typeof history === 'string') {
              try { history = JSON.parse(history); } catch (e) { history = []; }
            }
            return { ...item, HISTORY: Array.isArray(history) ? history : [] };
          });
          setLiftingData(parsedData);
        }
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
    const entries: any[] = [];
    
    // 1. Add PI Targets
    piData.forEach(pi => {
      entries.push({
        date: pi.CREATED_AT || pi.PI_DATE || new Date().toISOString(),
        type: 'PI Generated',
        account: pi.ACCOUNT,
        piNo: pi.PI_NO,
        debit: pi.QUANTITY_KG, // Target In
        credit: 0,
        remarks: `PI Created: ${pi.QUALITY} ${pi.SHADE}`
      });
    });
    
    // 2. Add Deliveries
    liftingData.forEach(lift => {
      const history = Array.isArray(lift.HISTORY) ? lift.HISTORY : [];
      history.forEach(h => {
        entries.push({
          date: h.deliveryDate || h.timestamp,
          type: 'Delivery',
          account: lift.ACCOUNT,
          piNo: lift.PI_NO,
          debit: 0,
          credit: h.quantityKg,
          remarks: `Delivery Dispatch`
        });
      });
      // If there are legacy lifted amounts not in history
      if (history.length === 0 && lift.DELIVERED_KG > 0) {
        entries.push({
          date: lift.DELIVERY_DATE || new Date().toISOString(),
          type: 'Legacy Delivery',
          account: lift.ACCOUNT,
          piNo: lift.PI_NO,
          debit: 0,
          credit: lift.DELIVERED_KG,
          remarks: `Legacy Delivery`
        });
      }
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return entries;
  }, [piData, liftingData]);

  // Filter based on Tab
  const filteredLedger = useMemo(() => {
    let list = ledgerEntries;
    if (search) {
      list = list.filter(e => 
        (e.account && e.account.toLowerCase().includes(search.toLowerCase())) ||
        (e.piNo && e.piNo.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    if (activeTab === 'customer') {
      const byCustomer: Record<string, any[]> = {};
      list.forEach(e => {
        if (!byCustomer[e.account]) byCustomer[e.account] = [];
        byCustomer[e.account].push(e);
      });
      
      const res: any[] = [];
      Object.keys(byCustomer).sort().forEach(acc => {
        let bal = 0;
        byCustomer[acc].forEach(entry => {
          bal += entry.debit - entry.credit;
          res.push({ ...entry, balance: bal, group: acc });
        });
      });
      return res;
    } else {
      const byPI: Record<string, any[]> = {};
      list.forEach(e => {
        if (!byPI[e.piNo]) byPI[e.piNo] = [];
        byPI[e.piNo].push(e);
      });
      
      const res: any[] = [];
      Object.keys(byPI).sort().forEach(pi => {
        let bal = 0;
        byPI[pi].forEach(entry => {
          bal += entry.debit - entry.credit;
          res.push({ ...entry, balance: bal, group: pi });
        });
      });
      return res;
    }
  }, [ledgerEntries, activeTab, search]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Ledger Report (${activeTab === 'customer' ? 'Customer-wise' : 'PI-wise'})`, 14, 20);
    
    const tableData = filteredLedger.map(e => [
      e.group,
      new Date(e.date).toLocaleDateString(),
      e.type,
      e.piNo,
      e.debit ? e.debit + ' kg' : '-',
      e.credit ? e.credit + ' kg' : '-',
      e.balance + ' kg'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [[activeTab === 'customer' ? 'Account' : 'PI No', 'Date', 'Type', 'PI Reference', 'Debit (Target)', 'Credit (Delivered)', 'Balance']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] }
    });

    doc.save(`Ledger_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    onNotify('Success', 'PDF ledgers exported successfully', 'success');
  };

  const exportCSV = () => {
    const headers = ['Account/Group', 'Date', 'Type', 'PI No', 'Debit (Target Kg)', 'Credit (Delivered Kg)', 'Balance (Kg)', 'Remarks'];
    const rows = filteredLedger.map(e => [
      `"${e.group}"`,
      `"${new Date(e.date).toLocaleDateString()}"`,
      `"${e.type}"`,
      `"${e.piNo}"`,
      e.debit,
      e.credit,
      e.balance,
      `"${e.remarks}"`
    ]);
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

  // Ensure items are grouped nicely in the view
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
            <FileSpreadsheet className="w-6 h-6 mr-3 text-accent" /> Ledger Generator
          </h2>
          <p className="text-text-dim text-sm mt-1 font-semibold">Generate structured lifting ledgers directly from records.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
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

      <div className="bg-white/60 p-4 rounded-xl border border-blue-200 flex items-start space-x-3 text-sm text-blue-800">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Google Sheets Integration:</span> The ledger is generated dynamically on the fly based on your PI and Delivery records. To export this view back to your Google Sheets, click "Export CSV" and import it, or create a sheet named <strong>"Ledger"</strong> with headers: <em>Account, Date, Type, PI No, Debit (Target), Credit (Delivery), Balance, Remarks</em>.
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-border-main overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-main bg-surface-muted/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex bg-border-main p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex-1 px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center justify-center ${activeTab === 'customer' ? 'bg-white text-primary-main shadow-sm' : 'text-text-dim hover:text-text-main'}`}
            >
              <User size={14} className="mr-2" /> Customer Wise
            </button>
            <button
              onClick={() => setActiveTab('pi')}
              className={`flex-1 px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center justify-center ${activeTab === 'pi' ? 'bg-white text-primary-main shadow-sm' : 'text-text-dim hover:text-text-main'}`}
            >
              <FileText size={14} className="mr-2" /> P.I. Wise
            </button>
          </div>

          <div className="relative w-full sm:w-64 shrink-0 shadow-sm rounded-xl overflow-hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim w-4 h-4" />
            <input
              type="text"
              placeholder="Search ledgers..."
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
              {Object.entries(groupedItems).map(([groupKey, items]) => (
                <div key={groupKey} className="border border-border-main rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="bg-surface-muted p-4 border-b border-border-main">
                    <h3 className="font-black text-primary-main uppercase tracking-wider text-base flex items-center">
                      <div className="w-2 h-2 rounded-full bg-accent mr-3"></div>
                      {groupKey}
                    </h3>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-border-main text-xs uppercase text-text-dim tracking-wider font-extrabold">
                        <th className="p-4">Date</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Reference</th>
                        <th className="p-4 text-right bg-red-50/30 text-red-600">Debit (Trgt)</th>
                        <th className="p-4 text-right bg-green-50/30 text-green-600">Credit (Del)</th>
                        <th className="p-4 text-right text-primary-main">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-semibold text-text-main divide-y divide-border-main/50">
                      {items.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-text-dim">{new Date(entry.date).toLocaleDateString()}</td>
                          <td className="p-4 capitalize">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${entry.debit > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-xs">{activeTab === 'customer' ? entry.piNo : entry.account}</td>
                          <td className="p-4 text-right">
                             {entry.debit > 0 ? (
                                <div className="flex items-center justify-end text-red-600 font-bold">
                                   <ArrowDownRight size={14} className="mr-1 opacity-70" /> {entry.debit.toLocaleString()} kg
                                </div>
                             ) : '-'}
                          </td>
                          <td className="p-4 text-right">
                             {entry.credit > 0 ? (
                                <div className="flex items-center justify-end text-green-600 font-bold">
                                  <ArrowUpRight size={14} className="mr-1 opacity-70" /> {entry.credit.toLocaleString()} kg
                                </div>
                             ) : '-'}
                          </td>
                          <td className="p-4 text-right">
                             <span className="bg-primary-main text-white px-2 py-1 rounded font-bold">{entry.balance.toLocaleString()} kg</span>
                          </td>
                        </tr>
                      ))}
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
