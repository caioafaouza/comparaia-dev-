
import React, { useEffect, useState } from 'react';
import { getDashboardMetrics } from '../services/api';
import { AuthSession, DashboardMetrics } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  session: AuthSession;
  onNewComparison: () => void;
  onViewJob: (jobId: string) => void;
  onViewAllJobs: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ session, onNewComparison, onViewJob, onViewAllJobs }) => {
  const { t, language } = useLanguage();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    if (session?.user?.role === 'PLATFORM_ADMIN' || session?.tenant?.slug === 'MASTER') {
      return;
    }
    if (session?.tenant?.id) {
      getDashboardMetrics(session.tenant.id).then(setMetrics).catch(() => null);
    }
  }, [session?.tenant?.id]);

  if (!metrics) return (
    <div className="p-12 flex flex-col items-center justify-center min-h-[500px]">
      <div className="w-16 h-16 border-[6px] border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-8"></div>
      <p className="text-slate-400 font-black uppercase tracking-[0.3em] animate-pulse">{t('common.loading')}</p>
    </div>
  );

  const formatCurrency = (value: number) => {
    const locales = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
    const currencies = { pt: 'BRL', en: 'USD', es: 'EUR' };
    return value.toLocaleString(locales[language] || 'pt-BR', {
      style: 'currency',
      currency: currencies[language] || 'BRL'
    });
  };

  const usersTotal = metrics.resourceUsage.users.total || 1;
  const usersUsed = metrics.resourceUsage.users.used || 0;
  const userUsagePercent = Math.max(0, Math.min(100, (usersUsed / usersTotal) * 100));

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6">
        <div className="text-center md:text-left">
          <div className="inline-flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] mb-3">
            <span className="w-8 h-0.5 bg-indigo-600"></span> {t('dashboard.intelligence')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">{t('dashboard.title')}</h2>
          <p className="text-slate-500 mt-4 text-lg">
            {t('dashboard.organization')}: <span className="font-black text-indigo-900 border-b-2 border-indigo-100 pb-1 break-words">{session.tenant.name}</span>
          </p>
        </div>
        <button
          onClick={onNewComparison}
          className="group bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black shadow-2xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center transform hover:-translate-y-1 active:scale-95 text-lg uppercase tracking-tighter"
        >
          <svg className="w-7 h-7 mr-3 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
          {t('dashboard.newAnalysisBtn')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group text-center">
          <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6">{t('dashboard.errorMitigation')}</h3>
          <div className="text-2xl md:text-3xl lg:text-4xl font-black text-white mb-2 tabular-nums leading-tight whitespace-nowrap">
            {formatCurrency(metrics.estimatedMoneySaved)}
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('dashboard.moneySaved')}</p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl hover:shadow-indigo-500/5 transition-all text-center">
          <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-6">{t('dashboard.efficiencyGain')}</h3>
          <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tabular-nums">{Math.round(metrics.estimatedHoursSaved)}h</div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t('dashboard.hoursSaved')}</p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl text-center">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">{t('dashboard.specNormalized')}</h3>
          <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tabular-nums">{metrics.totalCandidatesAnalyzed}</div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t('dashboard.itemsAnalyzed')}</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-blue-800 p-10 rounded-[3rem] shadow-2xl text-white flex flex-col justify-between group text-center">
          <div>
            <div className="mb-6">
              <h3 className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em]">{t('dashboard.planHealth')}</h3>
            </div>
            <p className="text-lg font-black uppercase tracking-tighter opacity-90 leading-tight">{t('dashboard.activeMembers')}</p>
          </div>
          <div className="mt-8">
            <div className="flex justify-between text-[10px] font-black mb-3">
              <span className="opacity-70 uppercase tracking-widest">{t('dashboard.capacity')}</span>
              <span className="text-emerald-300">{usersUsed} / {usersTotal}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2.5 shadow-inner">
              <div className="bg-emerald-400 h-full rounded-full transition-all duration-1000" style={{ width: `${userUsagePercent}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
