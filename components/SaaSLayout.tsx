
import React, { useState } from 'react';
import { AuthSession, UserRole, PlanDefinition } from '../types';
import Logo from './Logo';
import { inviteUser } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from './LanguageSelector';

type AppView = 'dashboard' | 'jobs' | 'create' | 'audit' | 'billing' | 'settings' | 'result' | 'team' | 'platform_admin' | 'developers';

interface SaaSLayoutProps {
  session: AuthSession;
  currentPlan?: PlanDefinition | null;
  tokenBalance: number;
  onLogout: () => void;
  onChangeView: (view: AppView) => void;
  currentView: string;
  children: React.ReactNode;
}

const SaaSLayout: React.FC<SaaSLayoutProps> = ({
  session,
  currentPlan,
  tokenBalance,
  onLogout,
  onChangeView,
  currentView,
  children
}) => {
  const { t } = useLanguage();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  if (currentView === 'platform_admin') {
    return <div className="animate-fade-in h-full">{children}</div>;
  }


  // View <-> URL route mapping
  const VIEW_ROUTES: Record<string, string> = {
    dashboard: '/dashboard',
    jobs: '/comparativos',
    create: '/novo-comparativo',
    audit: '/auditoria',
    billing: '/planos',
    settings: '/configuracoes',
    team: '/equipe',
    developers: '/desenvolvedores',
    platform_admin: '/admin/dashboard',
  };

  const handleNavigation = (view: AppView) => {
    if (view === currentView) return;
    setIsNavigating(true);
    const route = VIEW_ROUTES[view] || '/' + view;
    window.history.pushState(null, '', route);
    setTimeout(() => {
      onChangeView(view);
      setIsNavigating(false);
    }, 600);
  };


  const navItemClass = (view: string) => `
    px-3 py-2 rounded-md text-sm font-black transition-colors cursor-pointer select-none uppercase tracking-tighter
    ${currentView === view
      ? 'bg-indigo-600 text-white shadow-md'
      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}
  `;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" data-testid="saas-layout">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm transition-all duration-200" data-testid="saas-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          <div className="flex items-center gap-6">
            <div
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={() => handleNavigation('dashboard')}
            >
              <Logo className="w-9 h-9 transition-transform group-hover:scale-105" />
              <div className="flex flex-col leading-none hidden md:flex">
                <span className="text-lg font-black text-slate-900 tracking-tighter">COMPARA</span>
                <span className="text-[10px] font-black text-emerald-600 tracking-[0.3em]">IA</span>
              </div>
            </div>

            <div className="hidden md:flex h-6 w-px bg-slate-300 mx-2"></div>

            <nav className="hidden md:flex ml-2 space-x-1 items-center">
              <button onClick={() => handleNavigation('dashboard')} className={navItemClass('dashboard')}>
                {t('nav.overview')}
              </button>
              <button onClick={() => handleNavigation('jobs')} className={navItemClass('jobs')}>
                {t('nav.myComparisons')}
              </button>
              <button onClick={() => handleNavigation('create')} className={navItemClass('create')}>
                {t('nav.newAnalysis')}
              </button>

              {/* PLATFORM ADMIN BUTTON */}
              {session?.user?.role === 'PLATFORM_ADMIN' && (
                <button
                  onClick={() => handleNavigation('platform_admin')}
                  className={`px-3 py-2 rounded-md text-sm font-black transition-colors cursor-pointer select-none uppercase tracking-tighter flex items-center gap-2 ${currentView === 'platform_admin' ? 'bg-red-600 text-white shadow-md' : 'text-red-600 hover:bg-red-50'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                  {t('nav.admin')}
                </button>
              )}

              {(session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN') && (
                <>
                  <button onClick={() => handleNavigation('team')} className={navItemClass('team')}>
                    {t('nav.team')}
                  </button>
                  {currentPlan?.features.auditLog && (
                    <button onClick={() => handleNavigation('audit')} className={navItemClass('audit')}>
                      {t('nav.audit')}
                    </button>
                  )}
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* NOVO: SELETOR DE IDIOMA */}
            <LanguageSelector />

            <div
              onClick={() => handleNavigation('billing')}
              className={`
                 group cursor-pointer flex items-center px-4 py-1.5 rounded-xl border transition-all duration-200 select-none shadow-sm
                 ${currentView === 'billing'
                  ? 'bg-indigo-600 border-indigo-700 text-white'
                  : 'bg-white border-slate-200 hover:border-indigo-300'}
               `}
            >
              <span className={`text-[10px] font-black uppercase mr-1 ${currentView === 'billing' ? 'text-indigo-200' : 'text-slate-400'}`}>TKS:</span>
              <span className="text-sm font-black">
                {tokenBalance}
              </span>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                onBlur={() => setTimeout(() => setIsUserMenuOpen(false), 200)}
                className="h-9 w-9 bg-slate-900 rounded-xl text-white font-black flex items-center justify-center border-2 border-white shadow-lg overflow-hidden hover:scale-105 transition-all focus:outline-none"
              >
                {session?.user?.name.charAt(0).toUpperCase()}
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-12 mt-2 w-56 bg-white rounded-2xl shadow-2xl py-2 border border-slate-100 focus:outline-none z-50 animate-fade-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                    <div className="text-xs font-black text-slate-900 truncate">{session?.user?.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{session?.tenant?.name}</div>
                  </div>

                  {session?.user?.role === 'PLATFORM_ADMIN' && (
                    <button onClick={() => handleNavigation('platform_admin')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center border-b border-slate-100">
                      {t('nav.admin')}
                    </button>
                  )}

                  {(session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN') && (
                    <>
                      <button onClick={() => handleNavigation('settings')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center">
                        {t('nav.settings')}
                      </button>
                      <button onClick={() => handleNavigation('developers')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center">
                        {t('nav.devs')}
                      </button>
                    </>
                  )}
                  <button onClick={() => handleNavigation('billing')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">{t('nav.billing')}</button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button onClick={onLogout} className="w-full text-left px-4 py-2.5 text-xs font-black text-red-500 hover:bg-red-50 flex items-center transition-colors">
                    {t('common.logout')}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ease-in-out relative">
        {isNavigating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in bg-white/90 backdrop-blur-sm z-50 rounded-lg min-h-[500px]">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
            <h3 className="text-indigo-900 font-black text-lg mb-2 uppercase tracking-tight">{t('common.loading')}</h3>
          </div>
        ) : (
          <div key={currentView} className="animate-fade-in min-h-[500px]">
            {children}
          </div>
        )}
      </main>
    </div>
  );
};

export default SaaSLayout;
