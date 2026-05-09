import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Search, 
  Download, 
  ChevronRight,
  ChevronLeft,
  X,
  FileCheck,
  ClipboardCheck,
  History,
  Activity,
  User,
  Package
} from 'lucide-react';
import { apiCall } from '../services/api';
import { cn, formatDate } from '../lib/utils';
import type { Lifting, PI, Notification } from '../types';

interface ArchiveModuleProps {
  onNotify: (title: string, message: string, type?: Notification['type']) => void;
}

export default function ArchiveModule({ onNotify }: ArchiveModuleProps) {
  const [completePIs, setCompletePIs] = useState<any[]>([]);
  const [liftingData, setLiftingData] = useState<Lifting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'full' | 'partial'>('full');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [piRes, liftRes] = await Promise.all([
        apiCall('getPIData'),
        apiCall('getLiftingData')
      ]);
      
      if (piRes.success && liftRes.success) {
        const pis = piRes.data || [];
        const lifts = liftRes.data || [];
        
        // Match PI with its lifting entries
        const matchedPIs = pis.filter((pi: PI) => pi.STATUS === 'COMPLETE').map((pi: PI) => {
          const piLifts = lifts.filter((l: any) => l.PI_NO === pi.PI_NO);
          
          // Determine if it's fully complete or partial
          // If any lifter has 0 < balance <= 100, it's considered partial completion if the main PI is marked complete
          // Actually, let's look at the lifters themselves.
          const isFull = piLifts.every((l: any) => (Number(l.TARGET_KG) - Number(l.DELIVERED_KG)) <= 0);
          
          return {
            ...pi,
            liftingEntries: piLifts,
            completionType: isFull ? 'full' : 'partial'
          };
        });
        
        setCompletePIs(matchedPIs);
        setLiftingData(lifts);
      }
    } catch (error) {
      onNotify('Error', 'Archive data fetch failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPIs = useMemo(() => {
    return completePIs.filter(pi => {
      const matchesSearch = 
        pi.PI_NO.toLowerCase().includes(searchTerm.toLowerCase()) || 
        pi.CUSTOMER_NAME.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTab = pi.completionType === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [completePIs, searchTerm, activeTab]);

  const stats = useMemo(() => {
    return {
      full: completePIs.filter(p => p.completionType === 'full').length,
      partial: completePIs.filter(p => p.completionType === 'partial').length
    };
  }, [completePIs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats and Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={() => setActiveTab('full')}
          className={cn(
            "p-6 rounded-[2rem] border transition-all text-left flex items-center justify-between group",
            activeTab === 'full' 
              ? "bg-teal-500 border-teal-600 shadow-xl shadow-teal-500/20 text-white" 
              : "bg-white border-slate-200 text-slate-600 hover:border-teal-200"
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
              activeTab === 'full' ? "bg-white/20" : "bg-teal-50 text-teal-600"
            )}>
              <FileCheck size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">Fully Fulfilled</h3>
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-wider mt-0.5",
                activeTab === 'full' ? "text-white/70" : "text-slate-400"
              )}>Absolute Zero Balance Entries</p>
            </div>
          </div>
          <div className="text-2xl font-black">{stats.full}</div>
        </button>

        <button 
          onClick={() => setActiveTab('partial')}
          className={cn(
            "p-6 rounded-[2rem] border transition-all text-left flex items-center justify-between group",
            activeTab === 'partial' 
              ? "bg-amber-500 border-amber-600 shadow-xl shadow-amber-500/20 text-white" 
              : "bg-white border-slate-200 text-slate-600 hover:border-amber-200"
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
              activeTab === 'partial' ? "bg-white/20" : "bg-amber-50 text-amber-600"
            )}>
              <ClipboardCheck size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">Partial Complete</h3>
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-wider mt-0.5",
                activeTab === 'partial' ? "text-white/70" : "text-slate-400"
              )}>Threshold Fulfill (&#60;= 100kg)</p>
            </div>
          </div>
          <div className="text-2xl font-black">{stats.partial}</div>
        </button>
      </div>

      {/* List Container */}
      <div className="bg-surface-card rounded-[2.5rem] border border-border-main p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                <History size={20} />
             </div>
             <div>
                <h3 className="text-lg font-black text-primary uppercase tracking-tight">Resolution Matrix</h3>
                <p className="text-xs text-text-dim font-bold uppercase tracking-widest">Archived Operational Sign-offs</p>
             </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Search Archive..."
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-accent/40 w-64"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-primary transition-all">
               <Download size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-2xl" />
            ))
          ) : filteredPIs.length > 0 ? (
            filteredPIs.map(pi => (
              <div key={pi.PI_NO} className="group p-5 bg-white border border-slate-100 rounded-2xl hover:border-accent/30 hover:shadow-lg transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-accent tracking-[0.2em]">{pi.PI_NO}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(pi.INVOICE_DATE)}</span>
                    </div>
                    <h4 className="text-lg font-black text-primary uppercase leading-tight">{pi.CUSTOMER_NAME}</h4>
                    <div className="flex items-center gap-3 mt-2">
                       <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg">
                          <Package size={12} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase">{pi.PRODUCT_QUALITY}</span>
                       </div>
                       <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Operation:</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase"></span>
                       </div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Quantum: <span className="text-slate-900 font-black">{pi.QUANTITY_KG.toLocaleString()} KG</span>
                       </div>
                    </div>
                  </div>

                  <div className="flex items-center lg:justify-end gap-6 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                    <div className="text-right">
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distributed in</div>
                       <div className="text-sm font-black text-slate-900">{pi.liftingEntries?.length || 0} SECTIONS</div>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-xl border flex items-center gap-2",
                      pi.completionType === 'full' 
                        ? "bg-teal-50 border-teal-100 text-teal-600" 
                        : "bg-amber-50 border-amber-100 text-amber-600"
                    )}>
                      {pi.completionType === 'full' ? <CheckCircle2 size={16} /> : <Activity size={16} />}
                      <span className="text-[11px] font-black uppercase tracking-tight">
                        {pi.completionType === 'full' ? 'FUllY CLOSED' : 'PARTIAL CLOSED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-entries if expanded or visible */}
                <div className="mt-4 pt-4 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pi.liftingEntries.map((l: any, idx: number) => {
                    const bal = Number(l.TARGET_KG) - Number(l.DELIVERED_KG);
                    return (
                      <div key={idx} className="p-3 bg-slate-50/50 rounded-xl border border-slate-50 flex items-center justify-between">
                         <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[150px]">{l.ACCOUNT}</div>
                            <div className="text-[11px] font-bold text-slate-600">{Number(l.DELIVERED_KG).toLocaleString()} / {Number(l.TARGET_KG).toLocaleString()} KG</div>
                         </div>
                         <div className={cn(
                           "text-[10px] font-black px-2 py-1 rounded-lg uppercase",
                           bal <= 0 ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
                         )}>
                           {bal <= 0 ? '0 BAL' : `${bal}kg BAL`}
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center opacity-30">
               <History size={64} className="mb-4" />
               <p className="font-black uppercase tracking-[0.3em] text-xs">No Records Found in Archive Matrix</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
