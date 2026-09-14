
import React, { useState, useEffect } from 'react';
import { getGlobalPlatformData } from '../../../services/api';
import { PlatformMetrics } from '../../../types';
import { AdminView } from '../Layout';

interface OverviewProps {
  setView: (view: AdminView) => void;
}

const OverviewModule: React.FC<OverviewProps> = ({ setView }) => {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = () => {
    setError(null);
    setMetrics(null);
    getGlobalPlatformData()
      .then(setMetrics)
      .catch(setError);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 text-red-700 rounded-xl">
        <h3 className="font-bold">Falha ao carregar os dados da plataforma.</h3>
        <p className="text-sm mt-2 font-mono bg-red-100 p-2 rounded">{error.message}</p>
        <button onClick={fetchData} className="mt-4 bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700">
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!metrics) return <div className="p-8 text-center text-slate-400">Carregando Control Tower...</div>;
  const activeTenants = metrics.activeTenants ?? metrics.totalTenants;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Visão Geral</h2>
        <p className="text-slate-500">Acompanhamento em tempo real da saúde do negócio e operação.</p>
      </div>

      {/* BUSINESS HEALTH */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Saúde do Negócio
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-green-300 transition-colors" onClick={() => setView('finance')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">MRR (Receita)</p>
                <h4 className="text-3xl font-extrabold text-slate-900 mt-2">R$ {metrics.mrr.toLocaleString()}</h4>
              </div>
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="text-xs text-green-600 mt-4 font-bold flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              12.5% <span className="text-slate-400 font-normal ml-1">vs mês anterior</span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setView('tenants')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Empresas Ativas</p>
                <h4 className="text-3xl font-extrabold text-slate-900 mt-2">{activeTenants}</h4>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
            </div>
            <p className="text-xs text-green-600 mt-4 font-bold flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              {activeTenants} <span className="text-slate-400 font-normal ml-1">ativas no momento</span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setView('users')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Total Usuários</p>
                <h4 className="text-3xl font-extrabold text-slate-900 mt-2">{metrics.totalUsers}</h4>
              </div>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Ativos na plataforma
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-red-300 transition-colors" onClick={() => setView('tenants')}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Churn Rate</p>
                <h4 className="text-3xl font-extrabold text-slate-900 mt-2">{metrics.churnRate}%</h4>
              </div>
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              0 nos últimos 30 dias
            </p>
          </div>
        </div>
      </div>

      {/* OPERATION & IA */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          Operação & IA
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden cursor-pointer hover:shadow-xl transition-all" onClick={() => setView('llm')}>
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Provedor de IA Ativo</p>
              <h4 className="text-2xl font-bold mt-1">{metrics.activeAIProvider || 'Google Gemini'}</h4>
              <div className="flex items-center mt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                <span className="text-xs text-emerald-400">Operacional</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-end">
              <div className="text-3xl font-bold">{metrics.aiSuccessRate}%</div>
              <div className="text-xs text-slate-400">Taxa de Sucesso</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-purple-300 transition-colors" onClick={() => setView('ai-costs')}>
            <div className="flex justify-between">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Tokens Consumidos (Hoje)</p>
                <h4 className="text-3xl font-extrabold text-slate-900 mt-2">{metrics.tokensConsumedToday}</h4>
              </div>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
            </div>
            <p className="text-xs text-green-600 mt-4 font-bold flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              +24% <span className="text-slate-400 font-normal ml-1">Média: 145/hora</span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-yellow-300 transition-colors" onClick={() => setView('health')}>
            <div className="flex justify-between">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Latência Média (IA)</p>
                <h4 className="text-3xl font-extrabold text-slate-900 mt-2">{(metrics.avgLatencyMs / 1000).toFixed(1)}s</h4>
              </div>
              <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="text-xs text-red-600 mt-4 font-bold flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
              5% <span className="text-slate-400 font-normal ml-1">P95 Latency</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewModule;
