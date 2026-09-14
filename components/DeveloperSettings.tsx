
import React, { useState, useEffect } from 'react';
import { AuthSession, PlanDefinition, TenantApiKey } from '../types';
import { getPlans, getTenantApiKeys, createTenantApiKey, revokeTenantApiKey } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface DeveloperSettingsProps {
    session: AuthSession;
    onChangeView: (view: any) => void;
}

const DeveloperSettings: React.FC<DeveloperSettingsProps> = ({ session, onChangeView }) => {
    const { addToast } = useToast();
    const { t } = useLanguage();
    const [currentPlan, setCurrentPlan] = useState<PlanDefinition | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiKeys, setApiKeys] = useState<TenantApiKey[]>([]);

    // Create Key State
    const [isCreating, setIsCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const plans = await getPlans();
            const plan = plans.find(p => p.id === session.tenant.plan);
            if (plan) setCurrentPlan(plan);

            if (plan?.features.apiAccess) {
                const keys = await getTenantApiKeys(session.tenant.id);
                setApiKeys(keys);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const result = await createTenantApiKey(session.tenant.id, newKeyName);
            setCreatedKey(result.rawKey);
            setNewKeyName('');
            addToast(t('devs.successTitle'), 'success');
            loadData();
        } catch (e) {
            addToast(t('common.error'), 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleRevoke = async (id: string) => {
        if (confirm(t('common.confirm') + "?")) {
            await revokeTenantApiKey(id);
            addToast(t('common.success'), 'success');
            loadData();
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">{t('common.loading')}</div>;

    // --- PLAN GATE: UPGRADE BANNER ---
    if (!currentPlan?.features.apiAccess) {
        return (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{t('devs.title')}</h2>
                    <p className="text-slate-500">{t('devs.subtitle')}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl p-10 text-center text-white relative overflow-hidden shadow-xl">
                    {/* Background Decoration */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                        <div className="absolute top-10 left-10 w-64 h-64 bg-indigo-500 rounded-full blur-[80px]"></div>
                        <div className="absolute bottom-10 right-10 w-64 h-64 bg-purple-500 rounded-full blur-[80px]"></div>
                    </div>

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/20">
                            <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                        </div>
                        <h3 className="text-3xl font-bold mb-4">Acesso Exclusivo (Pro/Enterprise)</h3>
                        <p className="text-indigo-200 text-lg mb-8">
                            Integrate directly with your ERP (SAP, Oracle, Totvs) or Procurement Portal using our REST API.
                        </p>

                        <button
                            onClick={() => onChangeView('billing')}
                            className="bg-white text-indigo-900 px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                        >
                            Upgrade Plan
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN CONTENT: API MANAGER ---
    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{t('devs.title')}</h2>
                    <p className="text-slate-500">{t('devs.subtitle')}</p>
                </div>
                <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {t('devs.active')}
                </div>
            </div>

            {/* KEYS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">

                    {/* CREATE KEY BOX */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4">{t('devs.createKey')}</h3>

                        {!createdKey ? (
                            <form onSubmit={handleCreateKey} className="flex gap-4">
                                <div className="flex-1">
                                    <label className="sr-only">{t('devs.keyName')}</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                                        placeholder={t('devs.placeholderName')}
                                        value={newKeyName}
                                        onChange={e => setNewKeyName(e.target.value)}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition-colors"
                                >
                                    {isCreating ? t('devs.generating') : t('devs.createKey')}
                                </button>
                            </form>
                        ) : (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-green-100 rounded-full text-green-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-green-900 text-sm mb-1">{t('devs.successTitle')}</h4>
                                        <p className="text-xs text-green-700 mb-3">{t('devs.successMsg')}</p>

                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 bg-white border border-green-200 p-2 rounded text-xs font-mono text-slate-700 break-all select-all">
                                                {createdKey}
                                            </code>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(createdKey); addToast(t('common.copied'), 'success'); }}
                                                className="p-2 bg-white border border-green-200 rounded text-green-600 hover:bg-green-50"
                                                title={t('common.copy')}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </button>
                                        </div>

                                        <button onClick={() => setCreatedKey(null)} className="mt-3 text-xs text-green-700 hover:text-green-900 font-bold underline">
                                            {t('devs.createAnother')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* KEY LIST */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 font-bold text-sm text-slate-700 uppercase tracking-wider">
                            {t('devs.activeKeys')}
                        </div>
                        {apiKeys.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                {t('jobs.empty')}
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-slate-100">
                                <tbody className="divide-y divide-slate-100">
                                    {apiKeys.map(key => (
                                        <tr key={key.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 text-sm">{key.name}</div>
                                                <div className="text-xs text-slate-500 font-mono mt-1">{key.keyPrefix}</div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {t('devs.createdIn')}: {new Date(key.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleRevoke(key.id)}
                                                    className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
                                                >
                                                    {t('devs.revoke')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* SIDEBAR: DOCS */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900 text-slate-300 p-6 rounded-xl shadow-lg">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            {t('devs.quickStart')}
                        </h3>
                        <p className="text-xs mb-4">
                            Use o endpoint abaixo para submeter uma análise via código.
                        </p>

                        <div className="bg-black/50 rounded-lg p-3 font-mono text-[10px] text-green-400 overflow-x-auto mb-4 border border-slate-700">
                            {`curl -X POST "https://api.comparaia.com/v1/jobs" \\
  -H "Authorization: Bearer cp_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "reference": "Motor WEG W22",
    "candidates": ["url_pdf_1", "url_pdf_2"]
  }'`}
                        </div>

                        <a href="#" className="text-xs text-indigo-400 font-bold hover:text-indigo-300 flex items-center gap-1">
                            {t('devs.docsLink')} &rarr;
                        </a>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-800 text-sm mb-2">{t('devs.planLimits')}</h4>
                        <ul className="space-y-2 text-xs text-slate-600">
                            <li className="flex justify-between">
                                <span>{t('devs.rateLimit')}:</span>
                                <span className="font-bold">100 req/min</span>
                            </li>
                            <li className="flex justify-between">
                                <span>{t('devs.simultaneous')}:</span>
                                <span className="font-bold">{currentPlan?.limits.maxCandidatesPerJob || 5}</span>
                            </li>
                            <li className="flex justify-between">
                                <span>{t('devs.history')}:</span>
                                <span className="font-bold">90 d</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeveloperSettings;
