import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  FileText, 
  Users, 
  Box, 
  BarChart3, 
  Settings, 
  LogOut, 
  Bell, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Filter,
  Plus,
  Search,
  Activity,
  History,
  AlertCircle,
  Menu,
  X,
  CreditCard,
  Building,
  Palette,
  Calendar,
  TrendingUp
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, safeParseDate, safeParseNumber } from './lib/utils';
import { apiCall, getApiUrl, setApiUrl } from './services/api';
import type { Page, User, ThemeSettings, FontStyle, Notification, AuditLogEntry } from './types';

// Modules
import LiftingModule from './components/LiftingModule';
import PIModule from './components/PIModule';
import CustomersModule from './components/CustomersModule';
import ProductsModule from './components/ProductsModule';
import ReportsModule from './components/ReportsModule';
import { LedgerModule } from './components/LedgerModule';
import ArchiveModule from './components/ArchiveModule';
import UsersModule from './components/UsersModule';
import LogReportModule from './components/LogReportModule';

import { THEME_PRESETS } from './constants';

// --- Constants ---
const FONT_MAP: Record<FontStyle, string> = {
  sans: '"Inter", sans-serif',
  serif: '"Playfair Display", serif',
  mono: '"JetBrains Mono", monospace',
  display: '"Outfit", sans-serif'
};

const DEFAULT_THEME: ThemeSettings = {
  themeId: 'slate-light',
  primaryColor: '#0d1b3e',
  accentColor: '#f59e0b',
  fontFamily: 'sans',
  borderRadius: 'large'
};

const RADIUS_MAP: Record<ThemeSettings['borderRadius'], string> = {
  none: '0px',
  small: '0.5rem',
  medium: '1rem',
  large: '2rem',
  full: '9999px'
};

// Register ChartJS plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
);

// --- Defaults ---
ChartJS.defaults.font.family = 'Arial, sans-serif';
ChartJS.defaults.color = '#718096';

// --- Main App Component ---
export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isAppInitialized, setIsAppInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const saved = localStorage.getItem('theme');
    try {
      return saved ? JSON.parse(saved) : DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.themeId);
    
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--font-main-family', FONT_MAP[theme.fontFamily]);
    root.style.setProperty('--radius-value', RADIUS_MAP[theme.borderRadius]);
    
    // Also update ChartJS defaults if needed
    ChartJS.defaults.color = theme.primaryColor + '80'; // 80 is 50% opacity in hex
    
    localStorage.setItem('theme', JSON.stringify(theme));
  }, [theme]);

  // Auto-login check (simulated for now, could use localStorage)
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    setIsLoggedIn(true);
    localStorage.setItem('user', JSON.stringify(userData));
    // logAction isn't available yet since user state hasn't updated in the same tick if we call it here, 
    // but the effect below will handle initial login logging
  };

  useEffect(() => {
    if (isLoggedIn && user) {
      logAction('Login', `User ${user.username} successfully authenticated from ${window.location.origin}`);
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    if (user) logAction('Logout', `User ${user.username} session terminated`);
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('user');
  };

  // Simulated Notification Engine
  const addNotification = (title: string, message: string, type: Notification['type'] = 'info') => {
    const newNote: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      type,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNote, ...prev]);
    setToasts(prev => [...prev, newNote]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newNote.id));
    }, 5000);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const [unreadCount, setUnreadCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // --- Handlers ---
  const logAction = (action: string, details: string) => {
    if (!user) return;
    const entry: AuditLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.username,
      userName: user.name,
      action,
      details,
      timestamp: new Date()
    };
    setAuditLogs(prev => [entry, ...prev]);

    // Save to Google Sheets
    apiCall('addGenericRow', {
      sheetName: 'user_logs',
      data: {
        TIMESTAMP: new Date().toISOString(),
        USERNAME: user.username,
        ACTION: action,
        MODULE: currentPage,
        DETAILS: details
      }
    }).catch(console.error);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-main font-['DM_Sans'] flex flex-col">
      {/* Quick Add Modal */}
      <QuickAddModal 
        isOpen={isQuickAddOpen} 
        onClose={() => setIsQuickAddOpen(false)} 
        onAdd={(pi) => {
          logAction('Create PI', `System manual entry of PI# ${pi.PI_NO} for ${pi.CUSTOMER_NAME}`);
          addNotification("PI Created", `Proforma Invoice ${pi.PI_NO} successfully recorded.`, "success");
        }}
      />

      {/* Top Navigation - Replaces Sidebar */}
      <Header 
        activePage={currentPage} 
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
        user={user}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        unreadCount={unreadCount}
        notifications={notifications}
        onMarkRead={markAllAsRead}
        onQuickAdd={() => setIsQuickAddOpen(true)}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Toast Notifications Overlay */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-80 p-4 rounded-2xl shadow-2xl border-l-4 pointer-events-auto flex gap-3 backdrop-blur-xl bg-white/90",
                toast.type === 'success' ? "border-teal-500" : 
                toast.type === 'error' ? "border-rose-500" : 
                toast.type === 'warning' ? "border-amber-500" : "border-primary"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                toast.type === 'success' ? "bg-teal-50 text-teal-600" : 
                toast.type === 'error' ? "bg-rose-50 text-rose-600" : 
                toast.type === 'warning' ? "bg-amber-50 text-amber-600" : "bg-primary/5 text-primary"
              )}>
                {toast.type === 'success' ? <Activity size={20} /> : <AlertCircle size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Status Notification</div>
                <div className="text-sm font-black text-slate-900 mb-0.5">{toast.title}</div>
                <div className="text-xs font-bold text-slate-500 line-clamp-2">{toast.message}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">
        <div className="w-full">
          {/* Breadcrumbs */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Yajur Lifting / Portal</div>
              <h2 className="text-2xl font-black text-primary uppercase lg:text-3xl tracking-tight mt-1">
                {currentPage === 'dashboard' ? 'Insight Dashboard' : `${currentPage.replace('-', ' ')} Module`}
              </h2>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-custom text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-all">
                <Download size={14} /> Export PDF
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-custom text-xs font-bold shadow-lg shadow-indigo-900/10 hover:opacity-90 transition-all"
              >
                <Activity size={14} /> Refresh Data
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {currentPage === 'dashboard' ? (
              <Dashboard user={user} onNotify={addNotification} onLog={logAction} onNavigate={setCurrentPage} />
            ) : currentPage === 'lifting' ? (
              <LiftingModule onNotify={addNotification} onLog={logAction} />
            ) : currentPage === 'pi' ? (
              <PIModule onNotify={addNotification} onLog={logAction} />
            ) : currentPage === 'customers' ? (
              <CustomersModule onNotify={addNotification} onLog={logAction} />
            ) : currentPage === 'products' ? (
              <ProductsModule onNotify={addNotification} onLog={logAction} />
            ) : currentPage === 'reports' ? (
              <ReportsModule onNotify={addNotification} onLog={logAction} />
            ) : currentPage === 'ledger' ? (
              <LedgerModule onNotify={addNotification} />
            ) : currentPage === 'archive' ? (
              <ArchiveModule onNotify={addNotification} />
            ) : currentPage === 'users' ? (
              <UsersModule onNotify={addNotification} onLog={logAction} user={user} />
            ) : currentPage === 'log-report' ? (
              <LogReportModule />
            ) : currentPage === 'settings' ? (
              user?.role === 'admin' ? (
                <SettingsPage theme={theme} onThemeChange={setTheme} />
              ) : (
                <div className="bg-white rounded-custom p-12 text-center border border-slate-200">
                  <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
                  <h3 className="text-xl font-black text-primary uppercase">Access Restricted</h3>
                  <p className="text-sm text-slate-400 mt-2">Administrative privileges required to access global settings module.</p>
                  <button onClick={() => setCurrentPage('dashboard')} className="mt-8 px-8 py-3 bg-slate-100 rounded-xl text-xs font-black uppercase">Return home</button>
                </div>
              )
            ) : currentPage === 'audit-log' ? (
              <AuditLogPage logs={auditLogs} />
            ) : (
              <PlaceholderModule page={currentPage} onBack={() => setCurrentPage('dashboard')} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest border-t border-slate-200">
        © 2026 Yajur Lifting • Enterprise Asset Portal v2.1
      </footer>
    </div>
  );
}

// --- Header (Top Navigation) ---
interface HeaderProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  user: User | null;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  unreadCount?: number;
  notifications?: Notification[];
  onMarkRead?: () => void;
  onQuickAdd?: () => void;
  theme: ThemeSettings;
  onThemeChange: (theme: ThemeSettings) => void;
}

function Header({ 
  activePage, 
  onNavigate, 
  onLogout, 
  user, 
  isMobileMenuOpen, 
  setIsMobileMenuOpen, 
  unreadCount = 0, 
  notifications = [], 
  onMarkRead, 
  onQuickAdd,
  theme,
  onThemeChange
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const isAdmin = user?.role === 'admin';

  const hasAccess = (pageId: string) => {
    if (isAdmin) return true;
    if (!user?.models) return true; // Default fallback to all if models array is not set on older accounts
    try {
        const userModelsStr = Array.isArray(user.models) ? user.models : [];
        const models = typeof user.models === 'string' ? JSON.parse(user.models) : userModelsStr;
        return models.includes(pageId);
    } catch(e) {
        return true;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, hidden: !hasAccess('dashboard') },
    { id: 'lifting', label: 'Lifting', icon: <Truck size={18} />, hidden: !hasAccess('lifting') },
    { id: 'archive', label: 'Archive', icon: <History size={18} />, hidden: !hasAccess('archive') },
    { id: 'ledger', label: 'Ledger', icon: <FileText size={18} />, hidden: !hasAccess('ledger') },
    { id: 'pi', label: 'Proforma', icon: <FileText size={18} />, hidden: !hasAccess('pi') },
    { id: 'customers', label: 'Customers', icon: <Users size={18} />, hidden: !hasAccess('customers') },
    { id: 'products', label: 'Products', icon: <Box size={18} />, hidden: !hasAccess('products') },
    { id: 'reports', label: 'Analytics', icon: <BarChart3 size={18} />, hidden: !hasAccess('reports') },
    { id: 'users', label: 'Users', icon: <Users size={18} />, hidden: !isAdmin && !hasAccess('users') },
    { id: 'log-report', label: 'Log Report', icon: <History size={18} />, hidden: !isAdmin && !hasAccess('log-report') },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} />, hidden: !isAdmin },
  ].filter(i => !i.hidden) as { id: Page; label: string; icon: React.ReactNode }[];

  return (
    <header className="sticky top-0 z-50 bg-primary text-white border-b border-white/10 shadow-xl">
      <div className="w-full px-4 h-18 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 pr-6 border-r border-white/10">
            <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center font-black text-xs text-white border-2 border-primary shadow-lg">
              {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
            </div>
            <button 
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-400 transition-colors" 
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-custom text-sm font-black transition-all",
                  activePage === item.id 
                    ? "bg-accent text-white shadow-lg shadow-accent/20" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {item.icon}
                <span className="uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Actions (Notifications & Theme Picker) */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 relative">
            <button 
                onClick={() => setShowThemePicker(!showThemePicker)}
                className="p-2 text-slate-400 hover:text-white transition-colors relative"
                title="Theme Presets"
            >
                <Palette size={18} />
            </button>

            {/* Theme Picker Panel */}
            <AnimatePresence>
                {showThemePicker && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full mt-4 right-0 w-64 bg-surface-card rounded-2xl shadow-2xl border border-border-main py-4 overflow-hidden z-[60]"
                >
                    <div className="px-6 mb-4 flex items-center justify-between">
                        <h4 className="text-xs font-black text-text-main uppercase tracking-widest">Color Plates</h4>
                    </div>
                    <div className="px-4 grid grid-cols-1 gap-2">
                        {THEME_PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    onThemeChange({ ...theme, themeId: p.id, primaryColor: p.primary, accentColor: p.accent });
                                    setShowThemePicker(false);
                                }}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-xl transition-all border",
                                    theme.themeId === p.id 
                                        ? "bg-accent/10 border-accent/20" 
                                        : "border-transparent hover:bg-surface-muted"
                                )}
                            >
                                <div className="flex -space-x-1.5 shrink-0">
                                    <div className="w-5 h-5 rounded-full border border-surface-card shadow-sm" style={{ backgroundColor: p.primary }} />
                                    <div className="w-5 h-5 rounded-full border border-surface-card shadow-sm" style={{ backgroundColor: p.accent }} />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-black text-text-main uppercase tracking-tight">{p.name}</div>
                                    <div className="text-xs font-bold text-text-dim uppercase">{p.type} mode</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>
                )}
            </AnimatePresence>

            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && onMarkRead) onMarkRead();
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors relative"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 border-2 border-primary rounded-full text-xs font-black flex items-center justify-center animate-bounce">
                  {unreadCount}
                </div>
              )}
            </button>

            {/* Notifications Panel */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full mt-4 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 py-4 overflow-hidden z-[60]"
                >
                  <div className="px-6 mb-4 flex items-center justify-between">
                    <h4 className="text-xs font-black text-primary uppercase tracking-widest">Recent Activity</h4>
                    <span className="text-[11px] font-bold text-text-dim bg-surface-muted px-2 py-0.5 rounded-full uppercase">Real-time</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-border-main">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div key={n.id} className="p-4 hover:bg-surface-muted transition-colors flex gap-3">
                          <div className={cn("w-1 h-1 rounded-full mt-1.5 shrink-0", n.read ? "bg-border-main" : "bg-accent")} />
                          <div>
                            <div className="text-sm font-black text-text-main">{n.title}</div>
                            <div className="text-xs text-text-dim font-bold mt-0.5">{n.message}</div>
                            <div className="text-[11px] text-text-dim font-bold uppercase mt-1.5">{formatDate(n.timestamp)}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-6 py-8 text-center text-xs font-bold text-text-dim uppercase tracking-widest">
                        Perfect Status • No Alerts
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-primary animate-in slide-in-from-top duration-200">
          <div className="p-4 grid grid-cols-2 gap-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-custom text-xs font-bold transition-all border",
                  activePage === item.id 
                    ? "bg-accent border-accent text-white" 
                    : "bg-white/5 border-transparent text-slate-400"
                )}
              >
                {item.icon}
                <span className="uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

// --- Skeleton Components ---
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse bg-surface-muted rounded-lg", className)} {...props} />
  );
}

function StatSkeleton() {
  return (
    <div className="bg-surface-card p-5 rounded-custom border border-border-main shadow-sm relative overflow-hidden">
      <div className="flex items-start justify-between">
        <Skeleton className="w-11 h-11 rounded-2xl" />
        <Skeleton className="w-16 h-4 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-24 h-6" />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex flex-col gap-2 p-3 rounded-2xl bg-surface-muted border border-border-main">
          <div className="flex justify-between">
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-16 h-3" />
          </div>
          <Skeleton className="w-full h-1" />
        </div>
      ))}
    </div>
  );
}

// --- Dashboard Sub-module ---
function Dashboard({ user, onNotify, onLog, onNavigate }: { user: User | null, onNotify: (t: string, m: string, type?: Notification['type']) => void, onLog: (a: string, d: string) => void, onNavigate: (page: Page) => void }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Dashboard Card Popups
  const [activePopup, setActivePopup] = useState<{ title: string, data: any[], type: 'monthly' | 'yearly' | 'parties' | 'pi' } | null>(null);

  const exportDashboardData = (data: any[], type: string, format: 'csv' | 'pdf') => {
    if (!data || !data.length) return;
    
    if (format === 'csv') {
      const headers = type === 'pi' 
        ? ["PI_NO", "CUSTOMER_NAME", "PRODUCT_QUALITY", "QUANTITY_KG", "STATUS"]
        : ["Label", "Delivered_KG", "Target_KG", "Pending_KG"];
      
      const rows = data.map(item => {
        if (type === 'pi') return [item.PI_NO, item.CUSTOMER_NAME, item.PRODUCT_QUALITY, item.QUANTITY_KG, item.STATUS];
        return [item.monthName || item.yearKey || item.party, item.delivered || item.totalDelivered || 0, item.target || item.totalTarget || 0, item.pending || item.totalPending || 0];
      });

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${type}_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.click();
    } else {
      // PDF Export using jsPDF
      import('jspdf').then(({ default: jsPDF }) => {
        import('jspdf-autotable').then(() => {
          const doc = new jsPDF();
          doc.setFontSize(20);
          doc.text(activePopup?.title || "Report", 14, 22);
          doc.setFontSize(11);
          doc.setTextColor(100);
          doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
          
          const headers = type === 'pi' 
            ? [["PI Number", "Customer", "Quality", "Target (kg)", "Status"]]
            : [["Label", "Delivered (kg)", "Target (kg)", "Pending (kg)"]];
          
          const rows = data.map(item => {
            if (type === 'pi') return [item.PI_NO, item.CUSTOMER_NAME, item.PRODUCT_QUALITY, item.QUANTITY_KG, item.STATUS];
            return [item.monthName || item.yearKey || item.party, (item.delivered || item.totalDelivered || 0).toLocaleString(), (item.target || item.totalTarget || 0).toLocaleString(), (item.pending || item.totalPending || 0).toLocaleString()];
          });

          (doc as any).autoTable({
            startY: 40,
            head: headers,
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [13, 27, 62] }
          });
          
          doc.save(`${type}_report.pdf`);
        });
      });
    }
  };

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');

  const toggleRow = (piNo: string) => {
    const newRows = new Set(expandedRows);
    if (newRows.has(piNo)) newRows.delete(piNo);
    else newRows.add(piNo);
    setExpandedRows(newRows);
  };

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const res = await apiCall('getDashboardData');
        
        if (res.success) {
          const activePis = res.data.pi || [];
          const activeLifts = res.data.lifting || [];
          const arcPis = res.data.archivePi || [];
          const arcLifts = res.data.archiveLifting || [];

          // Deduplicate PIs by PI_NO
          const piMap = new Map<string, any>();
          [...arcPis, ...activePis].forEach((p: any) => {
            if (p.PI_NO) piMap.set(String(p.PI_NO).trim().toUpperCase(), p);
          });
          const pis = Array.from(piMap.values());
          
          // Deduplicate Liftings by LIFTING_ID
          const liftMap = new Map<string, any>();
          [...arcLifts, ...activeLifts].forEach((l: any) => {
            if (l.LIFTING_ID) liftMap.set(String(l.LIFTING_ID).trim().toUpperCase(), l);
          });
          const lifts = Array.from(liftMap.values());
          
          let totalDeliveredAllTime = 0;
          const pendingDict: Record<string, { pending: number; target: number; delivered: number }> = {};
          const monthDict: Record<string, { delivered: number; target: number; pending: number }> = {};
          const yearDict: Record<string, { delivered: number; target: number; pending: number }> = {};

          lifts.forEach((l: any) => {
            const delivered = safeParseNumber(l.DELIVERED_KG);
            const target = safeParseNumber(l.TARGET_KG);
            // The user's tolerance logic for "Total Pending" count
            // However, stats should probably show ACTUAL pending unless it's very small
            const actualPending = Math.max(0, target - delivered);
            const isPracticallyComplete = actualPending <= 100;
            const pending = isPracticallyComplete ? 0 : actualPending;
            
            totalDeliveredAllTime += delivered;
            
            const pName = l.ACCOUNT || 'Unknown';
            if (!pendingDict[pName]) pendingDict[pName] = { pending: 0, target: 0, delivered: 0 };
            pendingDict[pName].pending += (l.STATUS === 'COMPLETE' || isPracticallyComplete ? 0 : actualPending);
            pendingDict[pName].target += target;
            pendingDict[pName].delivered += delivered;

            // Process Timeline
            const dateStr = l.LAST_DELIVERY_DATE || l.DATE || l.CREATED_AT;
            const date = safeParseDate(dateStr) || new Date();
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const yearKey = `${date.getFullYear()}`;

            if (!monthDict[monthKey]) monthDict[monthKey] = { delivered: 0, target: 0, pending: 0 };
            monthDict[monthKey].delivered += delivered;
            monthDict[monthKey].target += target;
            if (l.STATUS !== 'COMPLETE' && !isPracticallyComplete) {
               monthDict[monthKey].pending += actualPending;
            }

            if (!yearDict[yearKey]) yearDict[yearKey] = { delivered: 0, target: 0, pending: 0 };
            yearDict[yearKey].delivered += delivered;
            yearDict[yearKey].target += target;
            if (l.STATUS !== 'COMPLETE' && !isPracticallyComplete) {
              yearDict[yearKey].pending += actualPending;
            }
          });
          
          const topPendingArr = Object.keys(pendingDict)
             .map(k => ({ 
               party: k, 
               totalPending: pendingDict[k].pending,
               totalTarget: pendingDict[k].target,
               totalDelivered: pendingDict[k].delivered
             }))
             .filter(p => p.totalPending > 0)
             .sort((a,b) => b.totalPending - a.totalPending);
             
          const totalPending = topPendingArr.reduce((s, p) => s + p.totalPending, 0);
          
    const monthlyArr = Object.keys(monthDict).sort().reverse().map(k => ({
      monthKey: k,
      monthName: new Date(k + '-01').toLocaleString('default', { month: 'short', year: 'numeric' }),
      delivered: monthDict[k].delivered,
      target: monthDict[k].target,
      pending: monthDict[k].pending,
      running: monthDict[k].target - monthDict[k].delivered
    }));

    const yearlyArr = Object.keys(yearDict).sort().reverse().map(k => ({
      yearKey: k,
      delivered: yearDict[k].delivered,
      target: yearDict[k].target,
      pending: yearDict[k].pending,
      running: yearDict[k].target - yearDict[k].delivered
    }));

          const piStatusReport: Record<string, any> = {
            'RUNNING': { count: 0, delivered: 0, target: 0 },
            'COMPLETE': { count: 0, delivered: 0, target: 0 }
          };

          pis.forEach((p: any) => {
            const isComplete = String(p.STATUS).toUpperCase() === 'COMPLETE';
            const statusLabel = isComplete ? 'COMPLETE' : 'RUNNING';
            piStatusReport[statusLabel].count++;
            
            const matchingLifts = lifts.filter((l: any) => String(l.PI_NO).trim().toUpperCase() === String(p.PI_NO).trim().toUpperCase());
            const delivered = matchingLifts.reduce((sum: number, l: any) => sum + safeParseNumber(l.DELIVERED_KG), 0);
            const target = safeParseNumber(p.QUANTITY_KG);
            
            piStatusReport[statusLabel].delivered += delivered;
            piStatusReport[statusLabel].target += target;
          });

          setData({
             totalDelivered: totalDeliveredAllTime,
             monthly: { data: monthlyArr },
             yearly: { data: yearlyArr },
             topPending: { data: topPendingArr },
             pendingPIs: { data: pis.filter((p:any) => String(p.STATUS).toUpperCase() !== 'COMPLETE') },
             piSummary: { data: pis, statusReport: piStatusReport }
          });
          
          if (totalPending > 50000) {
            setTimeout(() => {
              onNotify("Critical Pending Status", "Global pending volume exceeding thresholds. Review top parties.", "warning");
            }, 2000);
          }
        }
      } catch (err) {
        console.error(err);
      }
      setIsLoading(false);
    }
    loadDashboardData();
  }, []);

  const exportToCSV = () => {
    const tableData = filteredPIs;
    if (!tableData.length) return;

    const headers = ["PI Number", "Account Name", "Material", "Target", "Delivered", "Status", "Delivery Address", "Contact Person", "Payment Terms"];
    const rows = tableData.map(pi => [
      `"${(pi.PI_NO || '').replace(/"/g, '""')}"`,
      `"${(pi.CUSTOMER_NAME || '').replace(/"/g, '""')}"`,
      `"${(pi.PRODUCT_QUALITY || '').replace(/"/g, '""')}"`,
      pi.QUANTITY_KG,
      pi.totalDelivered || 0,
      `"${(pi.STATUS || '').replace(/"/g, '""')}"`,
      `"${(pi.DELIVERY_ADDRESS || 'Plot 45, Sector 12, Industrial Area, Haridwar').replace(/"/g, '""')}"`,
      `"${(pi.CONTACT_PERSON || 'Mr. Arvind Shrivastava').replace(/"/g, '""')}"`,
      `"${(pi.PAYMENT_TERMS || 'L/C Sight').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Order_Pipeline_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onNotify("Export Success", "Table data exported to CSV successfully.", "success");
    onLog('CSV Export', `Generated spreadsheet for ${tableData.length} active order pipeline entries.`);
  };

  const [currentMonthIdx, setCurrentMonthIdx] = useState(0);
  const currentMonthData = data?.monthly?.data?.[currentMonthIdx];
  const currentYearData = data?.yearly?.data?.[0]; // Default to latest year

  const stats = [
    { 
      label: "Customer Target Lifting", 
      value: data?.piSummary?.data ? (data.piSummary.data.reduce((sum: number, p: any) => sum + (Number(p.QUANTITY_KG) || 0), 0)).toLocaleString() + " Kg" : "0 Kg", 
      icon: <Calendar size={20} />, 
      color: "bg-indigo-600",
      trend: `Running: ${data?.piSummary?.statusReport?.['RUNNING']?.target?.toLocaleString() || 0} Kg`,
      status: { label: "Target Set", color: "bg-indigo-100 text-indigo-700" }
    },
    { 
      label: "Total Delivered", 
      value: `${(data?.totalDelivered || 0).toLocaleString()} kg`, 
      icon: <Truck size={20} />, 
      color: "bg-accent",
      trend: `This Month: ${(data?.monthly?.data?.[0]?.delivered || 0).toLocaleString()} Kg`,
      status: { label: "Fulfilled", color: "bg-blue-100 text-blue-700" }
    },
    { 
      label: "Total Pending", 
      value: `${(data?.monthly?.data?.reduce((s: any, m: any) => s + (parseFloat(m.pending) || 0), 0) || 0).toLocaleString()} kg`, 
      icon: <AlertCircle size={20} />, 
      color: "bg-rose-500",
      trend: "Operational Balance",
      status: { label: "Attention", color: "bg-rose-100 text-rose-700" }
    },
    { 
      label: "Active Customers", 
      value: data?.piSummary?.data ? [...new Set(data.piSummary.data.map((p:any) => p?.CUSTOMER_NAME))].filter(Boolean).length : 0, 
      icon: <Users size={20} />, 
      color: "bg-primary",
    }
  ];

  // Filtering Logic
  const filteredPIs = useMemo(() => {
    if (!data?.pendingPIs?.data) return [];
    return data.pendingPIs.data.filter((pi: any) => {
      const matchesSearch = 
        (pi.PI_NO || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (pi.CUSTOMER_NAME || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || pi.STATUS === statusFilter;
      const matchesMaterial = !materialFilter || pi.PRODUCT_QUALITY === materialFilter;
      return matchesSearch && matchesStatus && matchesMaterial;
    });
  }, [data, searchTerm, statusFilter, materialFilter]);

  const materials = useMemo(() => {
    if (!data?.pendingPIs?.data) return [];
    return [...new Set(data.pendingPIs.data.map((p: any) => p?.PRODUCT_QUALITY).filter(Boolean))];
  }, [data]);

  return (
    <>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading 
          ? [1, 2, 3, 4].map(i => <StatSkeleton key={i} />)
          : stats.map((stat, i) => (
            <div 
              key={i} 
              onClick={() => {
                if (stat.label.includes('Deliver') || stat.label.includes('Pend')) onNavigate('lifting');
                if (stat.label.includes('PI')) onNavigate('pi');
                if (stat.label.includes('Customer')) onNavigate('customers');
              }}
              className="bg-surface-card p-5 rounded-custom border border-border-main shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer"
            >
              <div className={cn("absolute top-0 left-0 w-1.5 h-full", stat.color)} />
              <div className="flex items-start justify-between">
                <div className={cn("w-11 h-11 rounded-[calc(var(--radius-value)*0.5)] flex items-center justify-center text-white shadow-lg", stat.color)}>
                  {stat.icon}
                </div>
                {stat.status && (
                  <span className={cn("px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest", stat.status.color)}>
                    {stat.status.label}
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-1">
                <h4 className="text-xs font-black text-text-dim uppercase tracking-widest">{stat.label}</h4>
                <div className="num-font text-2xl font-black text-primary tracking-tight leading-none group-hover:scale-105 transition-transform origin-left">
                  {stat.value || "---"}
                </div>
              </div>
              {stat.trend && (
                 <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <div className={cn("w-1 h-1 rounded-full animate-ping", stat.color)} />
                  {stat.trend}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* Time-Series Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Month Wise Card */}
        <div 
          id="dashboard-card-monthly"
          onClick={() => {
            const currentMonthData = data?.monthly?.data?.[currentMonthIdx];
            if (currentMonthData) {
              // Sample drill-down data: filter total lifting by this month
              setActivePopup({ 
                title: `${currentMonthData.monthName} Lifting Analysis`, 
                data: data.monthly.data.filter((m:any) => m.monthKey === currentMonthData.monthKey),
                type: 'monthly' 
              });
            }
          }}
          className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm flex flex-col justify-between group overflow-hidden relative cursor-pointer hover:border-accent hover:shadow-lg transition-all"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Calendar size={120} className="rotate-12" />
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Calendar size={16} />
              </div>
              <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Monthly Lifting</h4>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setCurrentMonthIdx(Math.min((data?.monthly?.data?.length || 1) - 1, currentMonthIdx + 1));
                }}
                className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setCurrentMonthIdx(Math.max(0, currentMonthIdx - 1));
                }}
                className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Period</div>
            <div className="text-2xl font-black text-primary tracking-tight leading-none uppercase">{currentMonthData?.monthName || "NO DATA"}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
            <div>
              <div className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Delivered (Total)</div>
              <div className="text-sm font-black text-slate-900 num-font">{(currentMonthData?.delivered || 0).toLocaleString()} kg</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Running (Today)</div>
              <div className="text-sm font-black text-indigo-600 num-font">{(currentMonthData?.running || 0).toLocaleString()} kg</div>
            </div>
            <div className="col-span-2 pt-2">
              <div className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">Net Pending</div>
              <div className="text-sm font-black text-rose-600 num-font">{(currentMonthData?.pending || 0).toLocaleString()} kg</div>
            </div>
          </div>
          
          <button className="mt-6 w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-[10px] font-black text-primary uppercase tracking-widest transition-all">Details View</button>
        </div>

        {/* Year Wise Card */}
        <div 
          id="dashboard-card-yearly"
          onClick={() => {
            const currentYearData = data?.yearly?.data?.[0];
            if (currentYearData) {
              setActivePopup({ 
                title: `FY ${currentYearData.yearKey} Summary Report`, 
                data: data.yearly.data,
                type: 'yearly' 
              });
            }
          }}
          className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm flex flex-col justify-between group overflow-hidden relative cursor-pointer hover:border-accent hover:shadow-lg transition-all"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Activity size={120} className="-rotate-12" />
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                <TrendingUp size={16} />
              </div>
              <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Yearly Summary</h4>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fiscal Year</div>
            <div className="text-2xl font-black text-primary tracking-tight leading-none uppercase">{currentYearData?.yearKey || new Date().getFullYear()}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
            <div>
              <div className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Delivered (Total)</div>
              <div className="text-sm font-black text-slate-900 num-font">{(currentYearData?.delivered || 0).toLocaleString()} kg</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Running</div>
              <div className="text-sm font-black text-indigo-600 num-font">{(currentYearData?.running || 0).toLocaleString()} kg</div>
            </div>
          </div>
          
          <button className="mt-6 w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-[10px] font-black text-primary uppercase tracking-widest transition-all">Yearly Ledger</button>
        </div>

        {/* PI Individual Range Card */}
        <div 
          id="dashboard-card-pi-range"
          onClick={() => {
            setActivePopup({ 
              title: `Proforma Invoice Status Matrix`, 
              data: data?.piSummary?.data || [],
              type: 'pi' 
            });
          }}
          className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm flex flex-col justify-between group overflow-hidden relative cursor-pointer hover:border-accent hover:shadow-lg transition-all"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <FileText size={120} />
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <FileText size={16} />
              </div>
              <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">PI Status Range</h4>
            </div>
          </div>
          
          <div className="space-y-4">
            {[
              { id: 'RUNNING', label: 'PENDING' },
              { id: 'COMPLETE', label: 'COMPLETE' }
            ].map(statusObj => {
                const report = data?.piSummary?.statusReport?.[statusObj.id] || { count: 0, delivered: 0, target: 0 };
                const count = report.count;
                const progress = report.target > 0 ? (report.delivered / report.target) * 100 : 0;
                
                return (
                    <div key={statusObj.id} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className={statusObj.id === 'COMPLETE' ? 'text-teal-600' : 'text-amber-500'}>{statusObj.label}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400">{count} Units</span>
                                <span className={cn("text-[9px]", statusObj.id === 'COMPLETE' ? 'text-teal-500' : 'text-amber-400')}>
                                    {Math.round(progress)}%
                                </span>
                            </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={cn("h-full rounded-full transition-all duration-1000", statusObj.id === 'COMPLETE' ? 'bg-teal-500' : 'bg-amber-400')} 
                                style={{ width: `${progress}%` }} 
                            />
                        </div>
                    </div>
                )
            })}
          </div>
          
          <button className="mt-6 w-full py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-xl text-[10px] font-black text-amber-600 uppercase tracking-widest transition-all">Range Analysis</button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Trend Bar Chart */}
        <div className="xl:col-span-2 bg-surface-card rounded-custom border border-border-main p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-primary uppercase text-sm tracking-widest flex items-center gap-2">
              <BarChart3 size={18} className="text-accent" />
              Lifting Trend Analysis
            </h3>
          </div>
          <div className="h-[240px]">
             {isLoading ? (
               <div className="w-full h-full flex flex-col justify-end gap-2 p-4">
                 <div className="flex items-end h-full gap-4">
                   {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                     <Skeleton key={i} className={cn("flex-1", i % 2 === 0 ? "h-2/3" : "h-1/2")} />
                   ))}
                 </div>
               </div>
             ) : data?.monthly?.data && (
               <Bar 
                  data={{
                    labels: [...data.monthly.data].reverse().map((m: any) => m.monthName),
                    datasets: [
                      { 
                        label: 'Delivered', 
                        data: [...data.monthly.data].reverse().map((m: any) => m.delivered),
                        backgroundColor: 'rgba(20, 184, 166, 0.9)',
                        borderRadius: 6,
                        maxBarThickness: 12
                      },
                      { 
                        label: 'Pending', 
                        data: [...data.monthly.data].reverse().map((m: any) => m.pending),
                        backgroundColor: 'rgba(244, 162, 0, 0.3)',
                        borderRadius: 6,
                        maxBarThickness: 12
                      },
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                      padding: { top: 10 }
                    },
                    plugins: {
                      legend: { 
                        position: 'top',
                        align: 'end' as const,
                        onClick: (e, legendItem, legend) => {
                          const index = legendItem.datasetIndex;
                          const ci = legend.chart;
                          if (ci.isDatasetVisible(index!)) {
                            ci.hide(index!);
                            legendItem.hidden = true;
                          } else {
                            ci.show(index!);
                            legendItem.hidden = false;
                          }
                        },
                        labels: { 
                          usePointStyle: true,
                          boxWidth: 6,
                          padding: 15,
                          font: { family: 'Arial', size: 10, weight: 'bold' } 
                        }
                      },
                      tooltip: {
                        enabled: true,
                        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#0d1b3e',
                        titleFont: { size: 12, family: 'Arial', weight: 'bold' },
                        bodyFont: { size: 13, family: 'Arial' },
                        padding: 16,
                        cornerRadius: 12,
                        displayColors: true,
                        boxPadding: 8,
                        callbacks: {
                          label: function(context) {
                              let label = context.dataset.label || '';
                              if (label) {
                                  label += ': ';
                              }
                              if (context.parsed.y !== null) {
                                  label += context.parsed.y.toLocaleString() + ' kg';
                              }
                              return label;
                          }
                        }
                      }
                    },
                    scales: {
                      x: { 
                        grid: { display: false }, 
                        ticks: { font: { family: 'Arial', size: 10, weight: 'bold' }, color: '#94a3b8' } 
                      },
                      y: { 
                        beginAtZero: true, 
                        grid: { color: '#f1f5f9' },
                        border: { display: false },
                        ticks: { 
                          font: { family: 'Arial', size: 10, weight: 'bold' }, 
                          color: '#94a3b8',
                          callback: (v:any) => v >= 1000 ? (v/1000) + 'K' : v 
                        }
                      }
                    }
                  }}
              />
             )}
          </div>
        </div>

        {/* Top Parties List */}
        <div className="bg-white rounded-custom border border-slate-200 p-6 shadow-sm flex flex-col">
          <h3 className="font-black text-primary uppercase text-sm tracking-widest flex items-center gap-2 mb-6">
            <AlertCircle size={18} className="text-rose-500" />
            Top Pendings / Lifting Allocation
          </h3>
          <div className="flex-1 overflow-y-auto max-h-[300px] pr-2">
             {isLoading ? <ListSkeleton /> : (
               <div className="space-y-4">
                 {data?.topPending?.data?.slice(0, 10).map((party: any, i: number) => (
                    <div key={i} id={`top-pending-party-${i}`} className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-accent/20 transition-all group">
                      <div className="flex flex-col gap-1 mb-1">
                        <span className="text-xs font-black text-accent uppercase tracking-widest leading-relaxed">{party.party}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-1">
                        <div>
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Target Allocation</div>
                          <div className="text-sm font-black text-slate-900">{(party.totalTarget || 0).toLocaleString()} kg</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Delivered</div>
                          <div className="text-sm font-black text-teal-600">{(party.totalDelivered || 0).toLocaleString()} kg</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase mt-1">
                        <span>Pending: {party.totalPending.toLocaleString()} kg</span>
                        <span className="text-primary">{Math.min(100, Math.round(((party.totalDelivered || 0) / (party.totalTarget || 1)) * 100))}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, ((party.totalDelivered || 0) / (party.totalTarget || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                 ))}
                 {!data?.topPending?.data?.length && <div className="text-center py-10 opacity-30 font-black uppercase text-xs tracking-widest">No Pendings</div>}
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Dashboard Drill-down Modal */}
      <AnimatePresence>
        {activePopup && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivePopup(null)}
              className="absolute inset-0 bg-primary/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-5xl max-h-[85vh] rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                   <h3 className="text-2xl font-black text-primary uppercase tracking-tight">{activePopup.title}</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Operational Drill-down Analytics</p>
                </div>
                <div className="flex items-center gap-3">
                   <button 
                     onClick={() => exportDashboardData(activePopup.data, activePopup.type, 'csv')}
                     className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-105 transition-all"
                   >
                     <Download size={14} /> CSV
                   </button>
                   <button 
                     onClick={() => exportDashboardData(activePopup.data, activePopup.type, 'pdf')}
                     className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                   >
                     <FileText size={14} /> PDF
                   </button>
                   <button 
                     onClick={() => setActivePopup(null)}
                     className="p-2 text-slate-300 hover:text-slate-600 transition-colors ml-2"
                   >
                     <X size={24} />
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-8">
                 {activePopup.type === 'pi' ? (
                   <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">PI NO</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quality</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Target (kg)</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-600">
                         {activePopup.data.map((item: any, idx: number) => (
                           <tr key={idx} className="hover:bg-slate-50/50">
                             <td className="px-4 py-3 text-primary font-black">{item.PI_NO}</td>
                             <td className="px-4 py-3 uppercase">{item.CUSTOMER_NAME}</td>
                             <td className="px-4 py-3">{item.PRODUCT_QUALITY}</td>
                             <td className="px-4 py-3 text-right">{item.QUANTITY_KG?.toLocaleString()}</td>
                             <td className="px-4 py-3 text-center">
                               <span className={cn(
                                 "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter",
                                 item.STATUS === 'COMPLETE' ? "bg-teal-100 text-teal-700" : "bg-blue-100 text-blue-700"
                               )}>
                                 {item.STATUS}
                               </span>
                             </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                 ) : (
                   <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Period / Data</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Delivered (kg)</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Target (kg)</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Pending (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-600">
                         {activePopup.data.map((item: any, idx: number) => (
                           <tr key={idx} className="hover:bg-slate-50/50">
                             <td className="px-4 py-3 text-primary font-black uppercase">{item.monthName || item.yearKey || item.party}</td>
                             <td className="px-4 py-3 text-right text-teal-600">{(item.delivered || item.totalDelivered || 0).toLocaleString()}</td>
                             <td className="px-4 py-3 text-right">{(item.target || item.totalTarget || 0).toLocaleString()}</td>
                             <td className="px-4 py-3 text-right text-rose-500">{(item.pending || item.totalPending || 0).toLocaleString()}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Orders Table */}
      <div className="bg-white rounded-custom border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-primary uppercase text-base tracking-widest flex items-center gap-2">
              <History size={18} className="text-teal-500" />
              Live Order Pipeline
            </h3>
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-black uppercase">{filteredPIs.length} Total</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search PI or Account..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all w-48"
                />
             </div>

             <select 
               value={statusFilter}
               onChange={e => setStatusFilter(e.target.value)}
               className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-accent/40 transition-all"
             >
                <option value="">All Status</option>
                <option value="RUNNING">Pending</option>
                <option value="COMPLETE">Complete</option>
             </select>

             <select 
               value={materialFilter}
               onChange={e => setMaterialFilter(e.target.value)}
               className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-accent/40 transition-all max-w-[120px]"
             >
                <option value="">All Materials</option>
                {materials.map((m: any) => <option key={m} value={m}>{m}</option>)}
             </select>

             <div className="h-6 w-px bg-slate-100 mx-1" />

             <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 py-2 bg-accent/10 text-accent rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent/20 transition-all"
             >
                <Download size={12} /> CSV
             </button>
             <button className="text-xs font-black text-accent uppercase tracking-widest hover:underline px-2">View All</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">PI# Number</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Account Name</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Material</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Target</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Progress</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td className="px-6 py-5"><Skeleton className="w-16 h-4" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-32 h-4" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-24 h-4" /></td>
                    <td className="px-6 py-5 text-right"><Skeleton className="w-16 h-4 ml-auto" /></td>
                    <td className="px-6 py-5 text-right"><Skeleton className="w-24 h-4 ml-auto" /></td>
                    <td className="px-6 py-5 text-center"><Skeleton className="w-12 h-4 mx-auto" /></td>
                  </tr>
                ))
              ) : filteredPIs.length > 0 ? (
                filteredPIs.slice(0, 10).map((pi: any, i: number) => (
                  <React.Fragment key={pi.PI_NO}>
                    <tr 
                      onClick={() => toggleRow(pi.PI_NO)}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer border-l-4 border-l-transparent hover:border-l-accent"
                    >
                      <td className="px-6 py-5">
                        <div className="font-black text-primary num-font flex items-center gap-2">
                          {pi.PI_NO}
                          {expandedRows.has(pi.PI_NO) ? <ChevronRight size={14} className="rotate-90 text-accent transition-transform" /> : <ChevronRight size={14} className="text-slate-300 transition-transform" />}
                        </div>
                        <div className="text-xs text-slate-400 font-bold mt-1 serif-font">{formatDate(pi.INVOICE_DATE)}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-700 text-sm">{pi.CUSTOMER_NAME}</div>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500">{pi.PRODUCT_QUALITY}</td>
                      <td className="px-6 py-5 text-right num-font font-black text-slate-900 border-x border-slate-50">
                        {pi.QUANTITY_KG.toLocaleString()} kg
                      </td>
                      <td className="px-6 py-5 text-right num-font font-black text-rose-500 border-x border-slate-50">
                        {Math.max(0, (pi.QUANTITY_KG || 0) - (pi.totalDelivered || 0)).toLocaleString()} kg
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="num-font font-black text-teal-600 text-sm">{(pi.totalDelivered || 0).toLocaleString()} kg</div>
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-teal-500 rounded-full" 
                              style={{ width: `${(pi.totalDelivered / pi.QUANTITY_KG) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest",
                          pi.STATUS === 'COMPLETE' ? "bg-teal-100 text-teal-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {pi.STATUS}
                        </span>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedRows.has(pi.PI_NO) && (
                        <tr>
                          <td colSpan={6} className="p-0 border-none">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-slate-50/50"
                            >
                              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 border-b border-slate-100">
                                <div className="space-y-4">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Address</span>
                                    <span className="text-sm font-bold text-slate-600 leading-relaxed uppercase">
                                      {pi.DELIVERY_ADDRESS || "Plot 45, Sector 12, Industrial Area, Haridwar, Uttarakhand - 249403"}
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Logistics Mode</span>
                                    <span className="text-sm font-bold text-teal-600 uppercase">External Vendor • Truckload</span>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Contact Person</span>
                                    <span className="text-sm font-black text-slate-700 uppercase">{pi.CONTACT_PERSON || "Mr. Arvind Shrivastava"}</span>
                                    {pi.CONTACT_PHONE && <span className="text-xs font-bold text-slate-400 mt-0.5">{pi.CONTACT_PHONE}</span>}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Payment Terms</span>
                                    <span className="text-sm font-bold text-slate-600 uppercase flex items-center gap-1.5">
                                      {pi.PAYMENT_TERMS || "L/C Sight"} • <CreditCard size={12} />
                                    </span>
                                  </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                  <div className="flex justify-between items-start">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Risk Analysis</span>
                                    <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-600 text-xs font-black">LOW RISK</span>
                                  </div>
                                  <div className="mt-4">
                                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                      <span>Credit Limit Utilization</span>
                                      <span>42%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-accent rounded-full w-[42%]" />
                                    </div>
                                  </div>
                                  <button className="mt-4 w-full py-2 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all">
                                    Initialize Dispatch
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">
                    No results found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// --- Quick Add Modal ---
interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (pi: any) => void;
}

function QuickAddModal({ isOpen, onClose, onAdd }: QuickAddModalProps) {
  const [formData, setFormData] = useState({
    PI_NO: '',
    CUSTOMER_NAME: '',
    PRODUCT_QUALITY: '',
    QUANTITY_KG: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ ...formData, QUANTITY_KG: Number(formData.QUANTITY_KG), STATUS: 'RUNNING', INVOICE_DATE: new Date().toISOString().split('T')[0] });
    onClose();
    setFormData({ PI_NO: '', CUSTOMER_NAME: '', PRODUCT_QUALITY: '', QUANTITY_KG: '' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-primary/40 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative z-10 border border-slate-100"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-primary uppercase tracking-tight">Manual Injection</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">New Proforma Invoice Record</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-300 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">PI Number</label>
                <input 
                  required
                  value={formData.PI_NO}
                  onChange={e => setFormData({ ...formData, PI_NO: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent/40 font-bold placeholder:text-slate-300"
                  placeholder="EX: PI/2026/001"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Customer Name</label>
                <input 
                  required
                  value={formData.CUSTOMER_NAME}
                  onChange={e => setFormData({ ...formData, CUSTOMER_NAME: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent/40 font-bold placeholder:text-slate-300"
                  placeholder="Legal Entity Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Material</label>
                  <input 
                    required
                    value={formData.PRODUCT_QUALITY}
                    onChange={e => setFormData({ ...formData, PRODUCT_QUALITY: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent/40 font-bold placeholder:text-slate-300"
                    placeholder="GSM / Quality"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Target Quantity (KG)</label>
                  <input 
                    required
                    type="number"
                    value={formData.QUANTITY_KG}
                    onChange={e => setFormData({ ...formData, QUANTITY_KG: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent/40 font-bold placeholder:text-slate-300"
                    placeholder="5000"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-5 rounded-[1.25rem] bg-primary text-white font-black uppercase tracking-widest text-[11px] hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-900/10 mt-4"
              >
                Sync with Mainframe
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- Audit Log Page ---
function AuditLogPage({ logs }: { logs: AuditLogEntry[] }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-custom border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <History size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-primary uppercase tracking-tight">System Audit Trail</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Real-time terminal session logs</p>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-100 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 italic">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Navigator</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Action Vector</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">System Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-xs font-mono font-bold text-slate-400">{log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-xs font-bold text-slate-300 uppercase mt-0.5">{formatDate(log.timestamp)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-black text-primary uppercase">{log.userName}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{log.userId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-widest border",
                      log.action === 'Login' ? "bg-teal-50 text-teal-600 border-teal-100" :
                      log.action === 'Logout' ? "bg-rose-50 text-rose-600 border-rose-100" :
                      log.action === 'Create PI' ? "bg-amber-50 text-amber-600 border-amber-100" :
                      "bg-slate-50 text-slate-600 border-slate-100"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-500 max-w-xs">{log.details}</td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-300 font-extrabold uppercase text-xs tracking-[0.3em]">
                    Standby • No Logged Events
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

// --- Login Page ---
function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiCall('login', { username, password });
      if (res.success && res.data) {
        onLogin({
          username: res.data.USERNAME || res.data.username,
          name: res.data.NAME || res.data.name,
          role: typeof res.data.ROLE === 'string' ? res.data.ROLE.toLowerCase() : res.data.role?.toLowerCase() || 'user',
          status: res.data.STATUS || res.data.status,
          models: res.data.MODELS || res.data.models
        });
      } else {
        setError(res.error || 'Identity verification failed');
      }
    } catch (err: any) {
      setError('Connection failed. Please check backend API.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6 relative overflow-hidden font-main">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent rounded-full blur-[150px] opacity-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500 rounded-full blur-[150px] opacity-10" />
      
      <div className="w-full max-w-sm p-8 md:p-12 rounded-[2.5rem] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl relative z-10 flex flex-col items-center">
        <div className="w-18 h-18 rounded-[1.5rem] bg-accent flex items-center justify-center text-white mb-8 shadow-2xl shadow-accent/20 ring-4 ring-white/5">
          <Building size={36} />
        </div>
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white tracking-tight leading-none">YAJUR FIBRES</h1>
          <p className="text-xs font-black text-slate-500 uppercase tracking-[0.25em] mt-4">Enterprise Lifting Engine</p>
        </div>

        <div className="w-full space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Identity UID</label>
            <div className="relative group">
              <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-accent transition-colors" />
              <input 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white text-sm outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent/50 transition-all font-bold placeholder:text-slate-700"
                placeholder="User name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Access Token</label>
            <div className="relative group">
              <LogOut size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-accent transition-colors rotate-180" />
              <input 
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white text-sm outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent/50 transition-all font-bold placeholder:text-slate-700"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <div className="text-xs font-black text-rose-500 uppercase tracking-widest text-center animate-pulse">{error}</div>}

          <button 
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full py-5 rounded-[1.25rem] bg-accent text-white font-black uppercase tracking-widest text-[11px] hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-accent/20 disabled:opacity-50 disabled:grayscale flex items-center justify-center"
          >
            {isLoading ? "Validating..." : "Initiate Login"}
          </button>
        </div>


      </div>
    </div>
  );
}

// --- Placeholder for other modules ---
function PlaceholderModule({ page, onBack }: { page: string, onBack: () => void }) {
  return (
    <div className="bg-white rounded-custom border border-slate-200 p-12 shadow-sm flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-300 mb-6 border border-slate-100">
        <Activity size={40} className="animate-pulse" />
      </div>
      <h3 className="text-xl font-black text-primary uppercase tracking-tight">{page.replace('-', ' ')} Module</h3>
      <p className="text-sm text-slate-400 mt-2 max-w-sm">This system module is currently being optimized for enterprise distribution. Please check the dashboard for live updates.</p>
      <button 
        onClick={onBack}
        className="mt-8 px-8 py-3 rounded-custom bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
      >
        Return to Engine
      </button>
    </div>
  );
}

// --- Settings Page ---
interface SettingsPageProps {
  theme: ThemeSettings;
  onThemeChange: (theme: ThemeSettings) => void;
}

function SettingsPage({ theme, onThemeChange }: SettingsPageProps) {
  const [apiUrl, setLocalApiUrl] = useState(getApiUrl());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  const handleUrlSave = () => {
    setApiUrl(apiUrl);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const fonts: { id: FontStyle; label: string }[] = [
    { id: 'sans', label: 'Inter (Modern Sans)' },
    { id: 'serif', label: 'Playfair (Elegant Serif)' },
    { id: 'mono', label: 'JetBrains (Technical Mono)' },
    { id: 'display', label: 'Outfit (Bold Display)' },
  ];

  const presets = [
    { id: 'slate-light', name: 'Slate Light', primary: '#0d1b3e', accent: '#f59e0b', type: 'light' },
    { id: 'emerald-light', name: 'Emerald Light', primary: '#064e3b', accent: '#10b981', type: 'light' },
    { id: 'amber-light', name: 'Amber Light', primary: '#78350f', accent: '#f59e0b', type: 'light' },
    { id: 'midnight-dark', name: 'Midnight Dark', primary: '#3b82f6', accent: '#60a5fa', type: 'dark' },
    { id: 'deep-blue-dark', name: 'Deep Blue Dark', primary: '#38bdf8', accent: '#0ea5e9', type: 'dark' },
    { id: 'forest-dark', name: 'Forest Dark', primary: '#10b981', accent: '#059669', type: 'dark' },
  ];

  const radiusOptions: ThemeSettings['borderRadius'][] = ['none', 'small', 'medium', 'large', 'full'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* API Configuration */}
      <div className="bg-surface-card rounded-custom border border-border-main p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-primary uppercase tracking-tight">System Connectivity</h3>
            <p className="text-xs text-text-dim font-bold uppercase tracking-widest">Connect to Google Apps Script Backend</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Web App Deployment URL</label>
          <div className="flex gap-4">
            <input 
              type="text" 
              value={apiUrl}
              onChange={e => setLocalApiUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:border-accent/40"
            />
            <button 
              onClick={handleUrlSave}
              className={cn(
                "px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg",
                saveStatus === 'saved' ? "bg-teal-600 text-white shadow-teal-600/20" : "bg-primary text-white shadow-primary/20 hover:scale-[1.02]"
              )}
            >
              {saveStatus === 'saved' ? 'Endpoint Updated' : 'Sync Endpoint'}
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">
            Note: Changes will take effect immediately. Ensure your Apps Script is deployed as a Web App with access set to "Anyone".
          </p>
        </div>
      </div>

      <div className="bg-surface-card rounded-custom border border-border-main p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Settings size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-primary uppercase tracking-tight">Theme Personalization</h3>
            <p className="text-xs text-text-dim font-bold uppercase tracking-widest">Global visual distribution settings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Color Settings */}
          <div className="space-y-8">
            <div>
              <label className="text-xs font-black text-text-dim uppercase tracking-[0.2em] mb-4 block">Visual Presets (3 Light / 3 Dark)</label>
              <div className="grid grid-cols-2 gap-3">
                {presets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onThemeChange({ ...theme, themeId: p.id, primaryColor: p.primary, accentColor: p.accent })}
                    className={cn(
                      "group flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left",
                      theme.themeId === p.id ? "border-accent bg-accent/5" : "border-border-main hover:bg-surface-muted"
                    )}
                  >
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full border-2 border-surface-card shadow-sm" style={{ backgroundColor: p.primary }} />
                      <div className="w-8 h-8 rounded-full border-2 border-surface-card shadow-sm" style={{ backgroundColor: p.accent }} />
                    </div>
                    <div>
                        <span className="text-xs font-black uppercase tracking-widest text-text-main block">{p.name}</span>
                        <span className="text-xs font-bold uppercase text-text-dim">{p.type} mode</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Primary Color</label>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <input 
                    type="color" 
                    value={theme.primaryColor}
                    onChange={e => onThemeChange({ ...theme, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <span className="text-xs font-mono font-bold text-slate-600 uppercase">{theme.primaryColor}</span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pl-1">Accent Color</label>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <input 
                    type="color" 
                    value={theme.accentColor}
                    onChange={e => onThemeChange({ ...theme, accentColor: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <span className="text-xs font-mono font-bold text-slate-600 uppercase">{theme.accentColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Typography & Shape */}
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Typography Scale</label>
              <div className="grid grid-cols-1 gap-2">
                {fonts.map(f => (
                  <button
                    key={f.id}
                    onClick={() => onThemeChange({ ...theme, fontFamily: f.id })}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left",
                      theme.fontFamily === f.id ? "border-accent bg-accent/5" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <span className={cn("text-sm font-bold", f.id === 'serif' ? 'serif-font' : f.id === 'mono' ? 'font-mono' : 'font-sans')}>
                      {f.label}
                    </span>
                    {theme.fontFamily === f.id && <div className="w-2 h-2 rounded-full bg-accent" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Border Radius Factor</label>
              <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 border border-slate-100">
                {radiusOptions.map(r => (
                  <button
                    key={r}
                    onClick={() => onThemeChange({ ...theme, borderRadius: r })}
                    className={cn(
                      "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                      theme.borderRadius === r ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-4 mt-6">
                 <div className="w-12 h-12 border-2 border-accent/20 flex items-center justify-center rounded-custom bg-white">
                   <div className="w-4 h-4 bg-accent rounded-[calc(var(--radius-value)*0.25)]" />
                 </div>
                 <p className="text-xs text-slate-400 font-bold uppercase mt-2">Active Spec Example</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Settings are auto-persisted to browser storage</p>
          <button 
            onClick={() => onThemeChange(DEFAULT_THEME)}
            className="px-6 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
}
