import React, { useState, useEffect } from 'react';
import { History, Search, Download, Filter, User, Activity } from 'lucide-react';
import { apiCall } from '../services/api';
import { cn, formatDate } from '../lib/utils';

export default function LogReportModule() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');

    useEffect(() => {
        const loadLogs = async () => {
            setIsLoading(true);
            try {
                const res = await apiCall('getGenericData', { sheetName: 'user_logs' });
                if (res.success && res.data) {
                    // Sort descending by timestamp
                    const sorted = res.data.sort((a: any, b: any) => new Date(b.TIMESTAMP).getTime() - new Date(a.TIMESTAMP).getTime());
                    setLogs(sorted);
                }
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };
        loadLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const strLog = JSON.stringify(log).toLowerCase();
        const matchesSearch = strLog.includes(searchTerm.toLowerCase());
        const matchesModule = moduleFilter ? log.MODULE === moduleFilter : true;
        return matchesSearch && matchesModule;
    });

    const uniqueModules = [...new Set(logs.map(l => l.MODULE).filter(Boolean))];

    const exportCsv = () => {
        const headers = ["TIMESTAMP", "USERNAME", "ACTION", "MODULE", "DETAILS"];
        const rows = filteredLogs.map(l => [
            `"${l.TIMESTAMP}"`,
            `"${l.USERNAME}"`,
            `"${l.ACTION}"`,
            `"${l.MODULE}"`,
            `"${(l.DETAILS || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
        link.click();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <History size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-primary uppercase tracking-tight">System Audit Log</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase">Track User Actions & Changes</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={exportCsv}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                    >
                        <Download size={14} /> Export CSV
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search logs..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-accent/40 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select 
                            value={moduleFilter}
                            onChange={(e) => setModuleFilter(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:border-accent/40 outline-none appearance-none"
                        >
                            <option value="">All Modules</option>
                            {uniqueModules.map((m: any) => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center justify-end text-xs font-bold text-slate-400 uppercase">
                        Showing {filteredLogs.length} Records
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-x-auto relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center p-12 text-slate-400">Loading logs...</div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                            <Activity size={48} className="text-slate-200 mb-4" />
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No Logs Found</h3>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10">
                                    <th className="px-6 py-4 whitespace-nowrap">Timestamp</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Module</th>
                                    <th className="px-6 py-4 w-1/3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLogs.map((log, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-xs font-black text-slate-600">{formatDate(log.TIMESTAMP)}</div>
                                            <div className="text-[10px] font-bold text-slate-400">{new Date(log.TIMESTAMP).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[9px] font-black uppercase">
                                                    {(log.USERNAME || 'U').substring(0, 2)}
                                                </div>
                                                <div className="text-xs font-black text-primary">{log.USERNAME}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                                                log.ACTION?.includes('Create') || log.ACTION?.includes('Add') ? "bg-teal-50 text-teal-600 border border-teal-100" :
                                                log.ACTION?.includes('Edit') || log.ACTION?.includes('Update') ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                                log.ACTION?.includes('Delete') || log.ACTION?.includes('Archive') ? "bg-rose-50 text-rose-600 border border-rose-100" :
                                                "bg-slate-100 text-slate-600 border border-slate-200"
                                            )}>
                                                {log.ACTION}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-bold text-slate-500 uppercase">{log.MODULE}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-slate-600 font-bold max-w-md line-clamp-2" title={log.DETAILS}>
                                                {log.DETAILS}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
