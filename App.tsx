
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ComparisonResponse, AuthSession, Transaction, ComparisonJob, PlanType, PlanDefinition } from './types';
import LandingPage from './components/LandingPage/index';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

import {
  getSession,
  logout,
  getWalletBalance,
  getTenantTransactions,
  createComparisonJob,
  updateJobStatus,
  updateJobResult,
  getJobDetails,
  initializeMockDB,
  getPlans,
  cleanupStaleJobs,
  getPublicConfig
} from './services/api';

const LoginScreen = lazy(() =>
  import('./components/AuthScreens').then((mod) => ({ default: mod.LoginScreen }))
);
const RegisterScreen = lazy(() =>
  import('./components/AuthScreens').then((mod) => ({ default: mod.RegisterScreen }))
);
const ForgotPasswordScreen = lazy(() =>
  import('./components/AuthScreens').then((mod) => ({ default: mod.ForgotPasswordScreen }))
);
const FileUploader = lazy(() => import('./components/FileUploader'));
const ComparisonResult = lazy(() => import('./components/ComparisonResult'));
const ProcessingModal = lazy(() => import('./components/ProcessingModal'));
const SaaSLayout = lazy(() => import('./components/SaaSLayout'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const JobList = lazy(() => import('./components/JobList'));
const AuditLogViewer = lazy(() => import('./components/AuditLogViewer'));
const BillingView = lazy(() => import('./components/BillingView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const TeamView = lazy(() => import('./components/TeamView'));
const DeveloperSettings = lazy(() => import('./components/DeveloperSettings'));
const PlatformAdmin = lazy(() => import('./components/PlatformAdmin/index'));

const ViewLoader: React.FC = () => (
  <div className="w-full min-h-[140px] flex items-center justify-center text-slate-400 text-sm">Carregando...</div>
);


type AppView = 'dashboard' | 'jobs' | 'create' | 'audit' | 'billing' | 'result' | 'settings' | 'team' | 'platform_admin' | 'developers';
type AuthView = 'landing' | 'login' | 'register' | 'recover';

const AppContent: React.FC = () => {
  const { addToast } = useToast();
  const { t, language } = useLanguage();
  const [session, setSession] = useState<AuthSession | null>(() => {
    const s = getSession();
    if (s && (!s.user || !s.tenant || !s.token)) {
      console.warn('Inconsistent session detected. Forcing logout.');
      try { logout(); } catch {}
      return null;
    }
    return s;
  });
  const [currentPlan, setCurrentPlan] = useState<PlanDefinition | null>(null);
  const [authView, setAuthView] = useState<AuthView>('landing');
  const [view, setView] = useState<AppView>(() => {
    const existing = getSession();
    return existing?.user?.role === 'PLATFORM_ADMIN' ? 'platform_admin' : 'dashboard';
  });

  const [referenceInputType, setReferenceInputType] = useState<'file' | 'text'>('file');
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referenceText, setReferenceText] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [candidateFiles, setCandidateFiles] = useState<File[]>([]);
  const [complianceFiles, setComplianceFiles] = useState<File[]>([]);

  // Set Folder Mode to TRUE by default as per user request for "folder access"
  const [isFolderMode, setIsFolderMode] = useState(true);

  const [selectedRefIndex, setSelectedRefIndex] = useState<number>(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [viewedJobResult, setViewedJobResult] = useState<ComparisonResponse | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [progressState, setProgressState] = useState({ percent: 0, message: '...' });

  const hasReference = referenceInputType === 'file'
    ? referenceFiles.length > 0
    : (referenceText.trim() !== '' && referenceName.trim() !== '');
  const hasCandidates = candidateFiles.length > 0;
  const canSubmit = hasReference && hasCandidates && !isSubmitting;

  const handleLogout = () => {
    logout();
    setSession(null);
    setAuthView('landing');
    setView('dashboard');
  };

  useEffect(() => {
    // Session integrity check. If the session object is there but malformed, log out.
    if (session && (!session.user || !session.tenant || !session.token)) {
      console.warn('Inconsistent session detected. Forcing logout.');
      handleLogout();
    }
  }, [session]);

  useEffect(() => {
    const applyPublicConfig = () => {
      Promise.resolve(getPublicConfig ? getPublicConfig() : null)
        .then((cfg) => {
          if (!cfg) return;
          localStorage.setItem('comparaia_config', JSON.stringify(cfg));
          window.dispatchEvent(new Event('comparaia_config_updated'));
          if (cfg.branding?.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', cfg.branding.primaryColor);
          }
          if (cfg.branding?.secondaryColor) {
            document.documentElement.style.setProperty('--secondary-color', cfg.branding.secondaryColor);
          }
        })
        .catch(() => null);
    };

    if ('requestIdleCallback' in window) {
      const idleId = (window as any).requestIdleCallback(applyPublicConfig, { timeout: 1500 });
      return () => (window as any).cancelIdleCallback?.(idleId);
    }

    const timeoutId = (window as Window).setTimeout(applyPublicConfig, 300);
    return () => (window as Window).clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!session || !session.user || !session.tenant) return;

    initializeMockDB();
    cleanupStaleJobs();

    if (session.user.role !== 'PLATFORM_ADMIN' && session.tenant.slug !== 'MASTER') {
      refreshBilling(session.tenant.id).catch(() => null);
    }

    getPlans().then((plans) => {
      const found = plans.find((p) => p.id === session.tenant?.plan);
      if (found) setCurrentPlan(found);
    });
  }, [session]);

  const refreshBilling = async (tenantId: string) => {
    try {
      const bal = await getWalletBalance(tenantId);
      setTokenBalance(bal);
      const txs = await getTenantTransactions(tenantId);
      setTransactions(Array.isArray(txs) ? txs : []);
    } catch {
      // Ignore tenant billing errors to avoid breaking admin context
    }
  };

  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // URL to view mapping - must match SaaSLayout VIEW_ROUTES
  const URL_TO_VIEW: Record<string, AppView> = {
    '/dashboard': 'dashboard',
    '/comparativos': 'jobs',
    '/novo-comparativo': 'create',
    '/auditoria': 'audit',
    '/planos': 'billing',
    '/configuracoes': 'settings',
    '/equipe': 'team',
    '/desenvolvedores': 'developers',
    '/admin/dashboard': 'platform_admin',
    '/jobs': 'jobs',
    '/create': 'create',
    '/audit': 'audit',
    '/billing': 'billing',
    '/settings': 'settings',
    '/team': 'team',
    '/developers': 'developers',
  };

  const resolveViewFromPath = (path: string): AppView | null => {
    if (URL_TO_VIEW[path]) return URL_TO_VIEW[path];
    if (path.startsWith('/admin')) return 'platform_admin';
    return null;
  };

  // Sync URL -> view on initial load and session change
  useEffect(() => {
    const path = window.location.pathname;
    if (!session) {
      if (path === '/login') setAuthView('login');
      else if (path === '/register') setAuthView('register');
      else if (path === '/recover-password') setAuthView('recover');
      return;
    }
    const resolved = resolveViewFromPath(path);
    if (resolved) {
      if (resolved === 'platform_admin' && session.user.role !== 'PLATFORM_ADMIN') {
        setView('dashboard');
        window.history.replaceState(null, '', '/dashboard');
      } else {
        setView(resolved);
      }
    }
  }, [session]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      const resolved = resolveViewFromPath(path);
      if (resolved && session) {
        if (resolved === 'platform_admin' && session.user.role !== 'PLATFORM_ADMIN') {
          setView('dashboard');
        } else {
          setView(resolved);
        }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [session]);

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    if (newSession.user.role !== 'PLATFORM_ADMIN' && newSession.tenant?.slug !== 'MASTER') {
      refreshBilling(newSession.tenant.id).catch(() => null);
    }

    if (newSession.user.role === 'PLATFORM_ADMIN') {
      setView('platform_admin');
      window.history.pushState(null, '', '/admin/dashboard');
    } else {
      setView('dashboard');
      window.history.pushState(null, '', '/dashboard');
    }

    addToast(`${t('common.welcome')}, ${newSession.user.name}!`, 'success');
  };

  const handleSubmitJob = async () => {
    if (!session) return;
    setIsSubmitting(true);
    setProgressState({ percent: 0, message: t('analysis.executing') });

    try {
      const refInput = referenceInputType === 'file'
        ? { type: 'file' as const, file: referenceFiles[selectedRefIndex] }
        : { type: 'text' as const, content: referenceText, name: referenceName };

      const newJob = await createComparisonJob(session, refInput, candidateFiles, language);
      refreshBilling(session.tenant.id);

      setIsSubmitting(false);
      setReferenceFiles([]);
      setCandidateFiles([]);
      setComplianceFiles([]);
      setView('jobs');
    } catch (e: any) {
      setIsSubmitting(false);
      addToast(e.message, 'error');
    }
  };

  const handleViewJob = async (jobId: string) => {
    setSelectedJobId(jobId);
    setViewedJobResult(null);
    setIsLoadingDetails(true);
    setProgressState({ percent: 10, message: "Buscando dados no servidor..." });

    try {
      // Simulação de progresso para a busca de detalhes (UX)
      const steps = [
        { p: 30, m: "Autenticando acesso ao relatório..." },
        { p: 60, m: "Recuperando matriz técnica..." },
        { p: 90, m: "Preparando visualização..." }
      ];

      for (const step of steps) {
        await new Promise(r => setTimeout(r, 400));
        setProgressState({ percent: step.p, message: step.m });
      }

      const job = await getJobDetails(jobId);
      if (job?.status === 'COMPLETED' && job.result) {
        setViewedJobResult(job.result);
        setView('result');
      } else if (job?.status === 'FAILED') {
        addToast(`Este relatório falhou: ${job.error}`, 'error');
        setView('jobs');
      } else if (job?.status === 'PROCESSING') {
        addToast("Este relatório ainda está sendo processado pela IA.", "warning");
        setView('jobs');
      }
    } catch (err) {
      addToast('Erro ao carregar detalhes do comparativo.', 'error');
      setView('jobs');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  if (!session) {
    if (authView === 'landing') return <LandingPage onLogin={() => setAuthView('login')} onRegister={() => setAuthView('register')} />;
    if (authView === 'login') {
      return (
        <Suspense fallback={<ViewLoader />}>
          <LoginScreen onSuccess={handleLoginSuccess} onSwitch={() => setAuthView('register')} onForgotPassword={() => {
            setAuthView('recover');
            window.history.pushState(null, '', '/recover-password');
          }} />
        </Suspense>
      );
    }
    if (authView === 'recover') {
      return (
        <Suspense fallback={<ViewLoader />}>
          <ForgotPasswordScreen onBackToLogin={() => {
            setAuthView('login');
            window.history.pushState(null, '', '/login');
          }} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<ViewLoader />}>
        <RegisterScreen onSuccess={handleLoginSuccess} onSwitch={() => setAuthView('login')} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ViewLoader />}>
      <SaaSLayout session={session} currentPlan={currentPlan} tokenBalance={tokenBalance} onLogout={handleLogout} onChangeView={setView} currentView={view}>
        <ProcessingModal isOpen={isSubmitting || isLoadingDetails} progress={progressState.percent} message={progressState.message} />

      {view === 'dashboard' && <Dashboard session={session} onNewComparison={() => setView('create')} onViewJob={handleViewJob} onViewAllJobs={() => setView('jobs')} />}
      {view === 'jobs' && <JobList tenantId={session.tenant.id} onSelectJob={handleViewJob} onNewJob={() => setView('create')} />}
      {view === 'audit' && <AuditLogViewer tenantId={session.tenant.id} />}
      {view === 'billing' && <BillingView tokenBalance={tokenBalance} transactions={transactions} tenantId={session.tenant.id} onRefresh={() => refreshBilling(session.tenant.id)} />}
      {view === 'settings' && <SettingsView session={session} onUpdateSession={() => setSession(getSession())} />}
      {view === 'team' && <TeamView tenantId={session.tenant.id} currentUser={session.user} />}
      {view === 'developers' && <DeveloperSettings session={session} onChangeView={setView} />}
      {view === 'platform_admin' && session.user.role === 'PLATFORM_ADMIN' && <PlatformAdmin onExit={() => setView('dashboard')} />}

      {view === 'result' && (
        <div className="animate-fade-in">
          <button
            onClick={() => { setView('jobs'); setSelectedJobId(null); setViewedJobResult(null); }}
            className="mb-6 text-slate-400 hover:text-indigo-600 text-xs font-black uppercase flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {t('analysis.historyBack')}
          </button>

          {viewedJobResult && (
            <ComparisonResult data={viewedJobResult} jobId={selectedJobId || undefined} onReset={() => setView('create')} tenant={session.tenant} />
          )}
        </div>
      )}

      {view === 'create' && (
        <div className="max-w-6xl mx-auto space-y-10 animate-fade-in py-6">
          <div className="text-center">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{t('analysis.newTitle')}</h2>
            <p className="text-slate-500 mt-2">{t('analysis.context')} <span className="font-bold text-indigo-600">{session.tenant.sector}</span></p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all">
              <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm">1</span>
                {t('analysis.step1')}
              </h3>
              <FileUploader label="" files={referenceFiles} onFilesSelected={setReferenceFiles} selectionMode="single" selectedIndex={selectedRefIndex} onSelectionChange={setSelectedRefIndex} allowTextMode={true} inputType={referenceInputType} onInputTypeChange={setReferenceInputType} textName={referenceName} onTextNameChange={setReferenceName} textValue={referenceText} onTextValueChange={setReferenceText} />
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all flex flex-col relative overflow-hidden">
              {/* Destaque para o modo pasta */}
              {isFolderMode && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">MODO PASTA</div>}

              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm">2</span>
                  {t('analysis.step2')}
                </h3>
                <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-black uppercase">
                  <button onClick={() => setIsFolderMode(false)} className={`px-3 py-1 rounded-lg ${!isFolderMode ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{t('analysis.fileMode')}</button>
                  <button onClick={() => setIsFolderMode(true)} className={`px-3 py-1 rounded-lg ${isFolderMode ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{t('analysis.folderMode')}</button>
                </div>
              </div>
              <FileUploader label="" files={candidateFiles} onFilesSelected={setCandidateFiles} multiple={true} directory={isFolderMode} />
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all">
              <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-slate-400 text-white flex items-center justify-center text-sm">3</span>
                {t('analysis.step3')}
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed font-medium">{t('analysis.complianceDesc')}</p>
              <FileUploader label="" files={complianceFiles} onFilesSelected={setComplianceFiles} multiple={false} variant="secondary" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 pt-10">
            <button onClick={handleSubmitJob} disabled={!canSubmit} className={`px-16 py-5 rounded-[2rem] font-black text-2xl shadow-2xl transition-all flex items-center gap-5 transform active:scale-95 ${canSubmit ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/40' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {t('analysis.executing')}
                </>
              ) : (
                t('analysis.generateBtn')
              )}
            </button>
          </div>
        </div>
      )}
      </SaaSLayout>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </LanguageProvider>
  );
};

export default App;
