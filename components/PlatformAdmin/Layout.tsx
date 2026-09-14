
import React, { useState } from 'react';
import { getSession } from '../../services/api';

export type AdminView = 'overview' | 'tenants' | 'users' | 'crm' | 'finance' | 'global-invoices' | 'tokens' | 'health' | 'logs' | 'settings' | 'profile' | 'smtp' | 'database' | 'ai-costs' | 'llm' | 'webhooks' | 'api-gateway' | 'email-templates';

interface AdminLayoutProps {
  currentView: AdminView;
  onChangeView: (view: AdminView) => void;
  onExit: () => void;
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ currentView, onChangeView, onExit, children }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  React.useEffect(() => {
    // Only fetch if menu is open or on mount (to show badge)
    // For simplicity, fetch on mount and refreshing every 60s
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const session = getSession();
      if (!session?.token) return;

      const res = await fetch('/api/admin/notifications', {
        headers: { 'Authorization': `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : (data?.notifications || []));
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter((n) => !readNotificationIds.includes(n.id)).length;

  const resolveNotificationView = (n: any): AdminView => {
    const text = `${n?.title || ''} ${n?.msg || ''}`.toLowerCase();
    if (text.includes('webhook')) return 'webhooks';
    if (text.includes('empresa')) return 'tenants';
    if (text.includes('token') || text.includes('mercadopago') || text.includes('movimenta')) return 'global-invoices';
    return 'logs';
  };

  const handleNotificationClick = (n: any) => {
    const targetView = resolveNotificationView(n);
    setReadNotificationIds((prev) => (prev.includes(n.id) ? prev : [...prev, n.id]));
    setShowNotifications(false);
    onChangeView(targetView);
  };

  const markAllNotificationsAsRead = () => {
    setReadNotificationIds(safeNotifications.map((n) => n.id));
  };

  const getTimeAgo = (isoString: string) => {
    const date = new Date(isoString);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return 'Agora mesmo';
    if (diff < 60) return `${diff} min atrás`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  const navClass = (view: AdminView) => `
    w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
    ${currentView === view
      ? 'bg-indigo-600 text-white shadow-md'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
  `;

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans">
      {/* Sidebar Dark */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-10">
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-lg">Control Tower</span>
              <span className="text-[10px] text-slate-400">v2.4.0 • Enterprise</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-500 uppercase px-4 py-2 mt-2 tracking-wider">Visão Geral</div>
          <button onClick={() => onChangeView('overview')} className={navClass('overview')} data-testid="nav-dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Dashboard
          </button>

          <div className="text-[10px] font-bold text-slate-500 uppercase px-4 py-2 mt-6 tracking-wider">Operação SaaS</div>
          <button onClick={() => onChangeView('tenants')} className={navClass('tenants')} data-testid="nav-tenants">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Empresas (Tenants)
          </button>
          <button onClick={() => onChangeView('users')} className={navClass('users')} data-testid="nav-users">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Usuários
          </button>
          <button onClick={() => onChangeView('crm')} className={navClass('crm')} data-testid="nav-crm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            CRM de Vendas
          </button>

          <div className="text-[10px] font-bold text-slate-500 uppercase px-4 py-2 mt-6 tracking-wider">Economia</div>
          <button onClick={() => onChangeView('finance')} className={navClass('finance')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            Receita (MRR)
          </button>
          <button onClick={() => onChangeView('tokens')} className={navClass('tokens')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Planos & Monetização
          </button>
          <button onClick={() => onChangeView('global-invoices')} className={navClass('global-invoices')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Histórico Global
          </button>

          <div className="text-[10px] font-bold text-slate-500 uppercase px-4 py-2 mt-6 tracking-wider">Configurações & Infra</div>
          <button onClick={() => onChangeView('api-gateway')} className={navClass('api-gateway')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            API Gateway
          </button>
          <button onClick={() => onChangeView('llm')} className={navClass('llm')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Configuração LLM
          </button>
          <button onClick={() => onChangeView('webhooks')} className={navClass('webhooks')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" /></svg>
            Webhooks & API
          </button>
          <button onClick={() => onChangeView('email-templates')} className={navClass('email-templates')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Emails Transacionais
          </button>
          <button onClick={() => onChangeView('smtp')} className={navClass('smtp')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Configuração SMTP
          </button>
          <button onClick={() => onChangeView('ai-costs')} className={navClass('ai-costs')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
            Custos LLM / IA
          </button>
          <button onClick={() => onChangeView('database')} className={navClass('database')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            Infraestrutura de Dados
          </button>
          <button onClick={() => onChangeView('health')} className={navClass('health')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 01-2 2v4a2 2 0 01-2-2m-2-4h.01M17 16h.01" /></svg>
            Monitoramento
          </button>
          <button onClick={() => onChangeView('logs')} className={navClass('logs')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Logs & Auditoria
          </button>
          <button onClick={() => onChangeView('settings')} className={navClass('settings')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Configurações Gerais
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onExit}
            className="w-full mt-1 px-3 py-2 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Voltar ao App
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <div className="flex-1 max-w-lg">
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input type="text" placeholder="Busca global (Tenants, Usuários, Logs)..." className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-slate-100 focus:bg-white text-slate-900 placeholder:text-slate-400" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                onBlur={() => setTimeout(() => setShowNotifications(false), 200)}
                className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadCount > 0 && <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-fade-in origin-top-right">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm">Notificações</h3>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{unreadCount} Novas</span>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className="w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors flex gap-3"
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'critical' ? 'bg-red-500' :
                          n.type === 'success' ? 'bg-emerald-500' :
                            n.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}></div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{n.msg}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{getTimeAgo(n.time)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="p-2 text-center border-t border-slate-100">
                    <button onClick={markAllNotificationsAsRead} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 w-full py-1">Marcar todas como lidas</button>
                  </div>
                </div>
              )}
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">SA</div>
              <span className="text-sm font-medium text-slate-700">Super Admin</span>
            </div>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
