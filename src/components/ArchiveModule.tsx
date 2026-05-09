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
      const [piRes, liftRes, activePiRes, activeLiftRes] = await Promise.all([
        apiCall('getArchivePI'),
        apiCall('getArchiveLifting'),
        apiCall('getPIData'),
        apiCall('getLiftingData')
      ]);
      
      if (piRes.success && liftRes.success) {
        const archivedPis = piRes.data || [];
        const archivedLifts = liftRes.data || [];
        const activePis = activePiRes.success ? (activePiRes.data || []) : [];
        const activeLifts = activeLiftRes.success ? (activeLiftRes.data || []) : [];

        // Combine all lifting data that is considered complete or archived
        // This includes anything in the archive sheet plus anything in active sheet with <= 100kg balance
        const allLifts: any[] = [...archivedLifts];
        
        activeLifts.forEach((l: any) => {
          const bal = Number(l.TARGET_KG || 0) - Number(l.DELIVERED_KG || 0);
          // STRICT FIX: Only archive if balance is <= 100.
          // Do not trust the 'COMPLETE' status if balance is high.
          if (bal <= 100) {
            allLifts.push(l);
          }
        });

        // Deduplicate by LIFTING_ID (or equivalent unique ref)
        const uniqueLifts = Array.from(new Map(allLifts.map(item => [item.LIFTING_ID || `${item.PI_NO}-${item.ACCOUNT}`, item])).values());
        
        setLiftingData(uniqueLifts);
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

  const filteredLifts = useMemo(() => {
    return liftingData.filter(l => {
      const searchStr = `${l.LIFTING_ID} ${l.ACCOUNT} ${l.PI_NO}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [liftingData, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* List Container */}
      <div className="bg-surface-card rounded-[2.5rem] border border-border-main p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                <History size={20} />
             </div>
             <div>
                <h3 className="text-lg font-black text-primary uppercase tracking-tight">Archive Repository</h3>
                <p className="text-xs text-text-dim font-bold uppercase tracking-widest">Master Operational Archive</p>
             </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Find in Archive..."
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-accent/40 w-64"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">LIFTING_ID</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">ACCOUNT</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">PI_NO</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">TARGET_KG</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">DELIVERED_KG</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">REMAINING_KG</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">STATUS</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">LAST_DELIVERY_DATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-4 py-4 h-12 bg-slate-50/50 rounded-lg"></td>
                  </tr>
                ))
              ) : filteredLifts.length > 0 ? (
                filteredLifts.map((l, idx) => {
                  const target = Number(l.TARGET_KG || 0);
                  const delivered = Number(l.DELIVERED_KG || 0);
                  const remaining = Math.max(0, target - delivered);
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 group transition-all">
                      <td className="px-4 py-4 text-[11px] font-bold text-accent font-mono">{l.LIFTING_ID}</td>
                      <td className="px-4 py-4 text-[11px] font-black text-primary uppercase">{l.ACCOUNT}</td>
                      <td className="px-4 py-4 text-[11px] font-black text-primary">{l.PI_NO}</td>
                      <td className="px-4 py-4 text-right text-[11px] font-bold text-slate-600 font-mono">{target.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right text-[11px] font-bold text-teal-600 font-mono">{delivered.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={cn(
                          "text-[11px] font-black px-2 py-0.5 rounded-lg font-mono",
                          remaining <= 0 ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
                        )}>
                          {remaining <= 0 ? '0' : remaining.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-[10px] font-black text-teal-700 uppercase tracking-widest bg-teal-50 px-2 py-1 rounded-full border border-teal-100">
                          {l.STATUS || 'COMPLETE'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-[10px] font-bold text-slate-400">
                        {formatDate(l.LAST_DELIVERY_DATE)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-20 text-center opacity-30">
                     <History size={48} className="mx-auto mb-4" />
                     <p className="font-black uppercase tracking-[0.3em] text-[10px]">No Archived Records Found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
