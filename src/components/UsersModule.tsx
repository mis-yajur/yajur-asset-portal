import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Shield, User as UserIcon, Activity, CheckCircle, XCircle } from 'lucide-react';
import { apiCall } from '../services/api';
import { cn } from '../lib/utils';
import type { User } from '../types';

export default function UsersModule({ onNotify, onLog, user }: { onNotify: (t: string, m: string, type?: any) => void, onLog: (a: string, d: string) => void, user: User | null }) {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUserItem, setCurrentUserItem] = useState<any>(null);

    const ALL_MODELS = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'lifting', label: 'Lifting' },
        { id: 'archive', label: 'Archive' },
        { id: 'ledger', label: 'Ledger' },
        { id: 'pi', label: 'Proforma (PI)' },
        { id: 'customers', label: 'Customers' },
        { id: 'products', label: 'Products' },
        { id: 'reports', label: 'Analytics/Reports' },
        { id: 'users', label: 'User Management' },
        { id: 'log-report', label: 'Log Report' }
    ];

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const res = await apiCall('getGenericData', { sheetName: 'users' });
            if (res.success) {
                setUsers(res.data || []);
            }
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const toggleModel = (modelId: string) => {
        const currentModels = Array.isArray(currentUserItem?.MODELS) 
            ? currentUserItem.MODELS 
            : [];
            
        let newModels;
        if (currentModels.includes(modelId)) {
            newModels = currentModels.filter((m: string) => m !== modelId);
        } else {
            newModels = [...currentModels, modelId];
        }
        setCurrentUserItem({ ...currentUserItem, MODELS: newModels });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const itemToSave = { ...currentUserItem };
            if (Array.isArray(itemToSave.MODELS)) {
                itemToSave.MODELS = JSON.stringify(itemToSave.MODELS);
            }
            if (!itemToSave.ROLE) itemToSave.ROLE = 'user';
            if (!itemToSave.STATUS) itemToSave.STATUS = 'ACTIVE';

            // Check if username already exists for new user block
            if (!currentUserItem.isEdit) {
                const existing = users.find(u => u.USERNAME === itemToSave.USERNAME);
                if (existing) {
                    onNotify("Error", "Username already exists.", "error");
                    return;
                }
            }

            const action = currentUserItem.isEdit ? 'updateGenericRow' : 'addGenericRow';
            const res = await apiCall(action, { 
                sheetName: 'users',
                keyField: 'USERNAME',
                data: itemToSave 
            });

            if (res.success) {
                onNotify("Success", `User ${itemToSave.USERNAME} saved successfully.`, "success");
                onLog(currentUserItem.isEdit ? 'Edit User' : 'Create User', `User: ${itemToSave.USERNAME}`);
                loadUsers();
                setIsModalOpen(false);
            } else {
                onNotify("Error", res.error || "Failed to save.", "error");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const parseModels = (models: any) => {
        if (Array.isArray(models)) return models;
        if (typeof models === 'string') {
            try { return JSON.parse(models); } catch(e) { return []; }
        }
        return [];
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                        <Users size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-primary uppercase tracking-tight">User Management</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase">Manage Access & Permissions</p>
                    </div>
                </div>
                <button 
                    onClick={() => {
                        setCurrentUserItem({
                            USERNAME: '',
                            NAME: '',
                            PASSWORD: '',
                            ROLE: 'user',
                            STATUS: 'ACTIVE',
                            MODELS: [],
                            isEdit: false
                        });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-accent/20 hover:opacity-90 active:scale-95 transition-all"
                >
                    <Plus size={14} /> Add User
                </button>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Accessible Modules</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((u, i) => {
                                const selectedModels = parseModels(u.MODELS);
                                return (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xs">
                                                {(u.NAME || u.USERNAME || 'U').substring(0,2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-slate-900">{u.NAME}</div>
                                                <div className="text-[10px] font-bold text-slate-500">{u.USERNAME}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={cn(
                                            "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                                            u.STATUS === 'ACTIVE' ? "bg-teal-100 text-teal-700" : "bg-rose-100 text-rose-700"
                                        )}>
                                            {u.STATUS || 'ACTIVE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-black text-slate-600 uppercase">{u.ROLE}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {u.ROLE === 'admin' ? (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Has All Access</span>
                                            ) : selectedModels.length > 0 ? (
                                                selectedModels.map((m: string) => (
                                                    <span key={m} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold uppercase">{m}</span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-rose-400 font-bold">No access</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => {
                                                setCurrentUserItem({
                                                    ...u,
                                                    MODELS: parseModels(u.MODELS),
                                                    isEdit: true
                                                });
                                                setIsModalOpen(true);
                                            }}
                                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-white hover:bg-indigo-50 rounded-lg shadow-sm border border-slate-200"
                                        >
                                            <Edit size={14} />
                                        </button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* User Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-primary uppercase tracking-tight">
                                    {currentUserItem?.isEdit ? 'Edit User' : 'New User'}
                                </h3>
                                <p className="text-xs font-bold text-slate-500 uppercase mt-1">Configure credentials & modules</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                                <Activity size={24} className="rotate-45" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Username (Login ID)</label>
                                    <input 
                                        type="text" 
                                        required 
                                        disabled={currentUserItem?.isEdit}
                                        value={currentUserItem?.USERNAME || ''}
                                        onChange={e => setCurrentUserItem({...currentUserItem, USERNAME: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:border-accent/40 outline-none disabled:opacity-50" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={currentUserItem?.NAME || ''}
                                        onChange={e => setCurrentUserItem({...currentUserItem, NAME: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:border-accent/40 outline-none" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={currentUserItem?.PASSWORD || ''}
                                        onChange={e => setCurrentUserItem({...currentUserItem, PASSWORD: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:border-accent/40 outline-none" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Account Status</label>
                                    <select 
                                        value={currentUserItem?.STATUS || 'ACTIVE'}
                                        onChange={e => setCurrentUserItem({...currentUserItem, STATUS: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:border-accent/40 outline-none" 
                                    >
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="INACTIVE">INACTIVE</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
                                    <select 
                                        value={currentUserItem?.ROLE || 'user'}
                                        onChange={e => setCurrentUserItem({...currentUserItem, ROLE: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:border-accent/40 outline-none" 
                                        disabled={user?.username === currentUserItem?.USERNAME && user?.role === 'admin'}
                                    >
                                        <option value="user">USER</option>
                                        <option value="admin">ADMIN</option>
                                    </select>
                                </div>
                            </div>

                            {currentUserItem?.ROLE !== 'admin' && (
                                <div>
                                    <label className="text-xs font-black text-primary uppercase tracking-widest mb-3 block border-b border-slate-100 pb-2">Module Access Assignment</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {ALL_MODELS.map(m => {
                                            const isChecked = (currentUserItem?.MODELS || []).includes(m.id);
                                            return (
                                                <div 
                                                    key={m.id}
                                                    onClick={() => toggleModel(m.id)}
                                                    className={cn(
                                                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                                        isChecked ? "border-accent bg-accent/5" : "border-slate-200 bg-white hover:bg-slate-50"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-5 h-5 rounded flex items-center justify-center shrink-0 border",
                                                        isChecked ? "bg-accent border-accent text-white" : "border-slate-300 text-transparent"
                                                    )}>
                                                        <CheckCircle size={14} />
                                                    </div>
                                                    <span className={cn("text-xs font-bold uppercase tracking-tight", isChecked ? "text-slate-900" : "text-slate-500")}>
                                                        {m.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl text-sm font-black text-slate-500 hover:bg-slate-100 uppercase tracking-widest transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-3 rounded-xl bg-accent text-white text-sm font-black shadow-lg shadow-accent/30 uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
                                    Save User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
