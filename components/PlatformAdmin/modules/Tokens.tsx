
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    getTokenPackages, getPlans, adminRefillTokens,
    createPlan, updatePlan, deletePlan,
    createTokenPackage, deleteTokenPackage
} from '../../../services/api';
import { TokenPackage, PlanDefinition } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const TokensModule: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'plans' | 'packages' | 'manual'>('plans');
    const [packages, setPackages] = useState<TokenPackage[]>([]);
    const [plans, setPlans] = useState<PlanDefinition[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // --- MODAL STATES ---
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);

    // --- FORM STATES ---
    const [editingPlan, setEditingPlan] = useState<PlanDefinition | null>(null);
    const [editingPkg, setEditingPkg] = useState<TokenPackage | null>(null);

    // Support Refill State
    const [refillData, setRefillData] = useState({ tenantId: '', amount: 100 });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        getTokenPackages().then(setPackages);
        getPlans().then(setPlans);
    };

    // --- ACTIONS: PLANS ---
    const handleEditPlan = (plan: PlanDefinition) => {
        setEditingPlan({ ...plan }); // Clone
        setIsPlanModalOpen(true);
    };

    const handleNewPlan = () => {
        setEditingPlan({
            id: '',
            name: '',
            price: 0,
            currency: 'BRL',
            active: true,
            limits: { monthlyTokens: 1000, maxUsers: 1, maxStorageGB: 1, maxCandidatesPerJob: 5, maxFileSizeMB: 10 },
            features: { apiAccess: false, sso: false, whiteLabel: false, auditLog: false, prioritySupport: false, customIntegrations: false, customDomain: false }
        });
        setIsPlanModalOpen(true);
    };

    const savePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlan) return;
        setSubmitting(true);
        try {
            const isNew = !plans.find(p => p.id === editingPlan.id);
            if (isNew) await createPlan(editingPlan);
            else await updatePlan(editingPlan.id, editingPlan);

            addToast(`Plano ${isNew ? 'criado' : 'atualizado'} com sucesso!`, 'success');
            setIsPlanModalOpen(false);
            loadData();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || "Erro ao salvar plano", 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePlan = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este plano? Tenants ativos neste plano podem ser afetados.')) {
            await deletePlan(id);
            loadData();
            addToast('Plano removido.', 'success');
        }
    };

    // --- ACTIONS: PACKAGES ---
    const handleNewPkg = () => {
        setEditingPkg({ id: `pkg_${Date.now()}`, name: '', tokens: 100, price: 0, active: true });
        setIsPkgModalOpen(true);
    };

    const savePkg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPkg) return;
        setSubmitting(true);
        try {
            const exists = packages.find(p => p.id === editingPkg.id);
            if (exists) {
                await deleteTokenPackage(editingPkg.id);
            }
            await createTokenPackage(editingPkg);

            addToast('Pacote salvo com sucesso!', 'success');
            setIsPkgModalOpen(false);
            loadData();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || "Erro ao salvar pacote", 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePkg = async (id: string) => {
        if (confirm('Excluir este pacote de venda?')) {
            await deleteTokenPackage(id);
            loadData();
            addToast('Pacote removido.', 'success');
        }
    };

    // --- ACTIONS: REFILL ---
    const handleRefill = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminRefillTokens(refillData.tenantId, refillData.amount);
            addToast('Tokens adicionados com sucesso.', 'success');
            setRefillData({ tenantId: '', amount: 100 });
        } catch (err: any) {
            addToast(err.message, 'error');
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Planos & Monetização</h2>
                <p className="text-slate-500">Configure planos de assinatura, pacotes de tokens e regras de cobrança.</p>
            </div>

            {/* TABS */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setActiveTab('plans')} className={`${activeTab === 'plans' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Planos de Assinatura (SaaS)
                    </button>
                    <button onClick={() => setActiveTab('packages')} className={`${activeTab === 'packages' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Pacotes de Tokens (Avulso)
                    </button>
                    <button onClick={() => setActiveTab('manual')} className={`${activeTab === 'manual' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Recarga Manual (Suporte)
                    </button>
                </nav>
            </div>

            {/* CONTENT: PLANS */}
            {activeTab === 'plans' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={handleNewPlan} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 text-sm shadow-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            Criar Novo Plano
                        </button>
                    </div>
                    <div className="grid gap-6">
                        {plans.map(plan => (
                            <div key={plan.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group hover:border-indigo-300 transition-colors">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => handleEditPlan(plan)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded hover:bg-white border border-transparent hover:border-slate-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded hover:bg-white border border-transparent hover:border-slate-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                            {plan.name}
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">{plan.id}</span>
                                        </h3>
                                        <div className="text-2xl font-bold text-indigo-600 mt-1">R$ {plan.price} <span className="text-sm font-medium text-slate-400">/mês</span></div>
                                    </div>
                                    <div className="text-right text-xs text-slate-500 space-y-1">
                                        <div>Tokens: <strong>{plan.limits.monthlyTokens}</strong></div>
                                        <div>Usuários: <strong>{plan.limits.maxUsers}</strong></div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <span className={`${plan.features.whiteLabel ? 'text-green-600 font-bold' : 'text-slate-400 line-through'}`}>White-Label</span>
                                    <span className={`${plan.features.customDomain ? 'text-green-600 font-bold' : 'text-slate-400 line-through'}`}>Domínio Custom</span>
                                    <span className={`${plan.features.sso ? 'text-green-600 font-bold' : 'text-slate-400 line-through'}`}>SSO</span>
                                    <span className={`${plan.features.auditLog ? 'text-green-600 font-bold' : 'text-slate-400 line-through'}`}>Audit Log</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CONTENT: PACKAGES */}
            {activeTab === 'packages' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={handleNewPkg} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 text-sm shadow-sm flex items-center gap-2">
                            + Novo Pacote
                        </button>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Nome</th>
                                    <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Tokens</th>
                                    <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Preço (R$)</th>
                                    <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {packages.map(pkg => (
                                    <tr key={pkg.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900">{pkg.name}</td>
                                        <td className="px-6 py-4 font-bold text-indigo-600">{pkg.tokens}</td>
                                        <td className="px-6 py-4 font-mono text-slate-700">R$ {pkg.price.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => { setEditingPkg({ ...pkg }); setIsPkgModalOpen(true); }} className="text-indigo-600 hover:underline text-xs font-bold">Editar</button>
                                            <button onClick={() => handleDeletePkg(pkg.id)} className="text-red-500 hover:underline text-xs">Excluir</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CONTENT: MANUAL REFILL */}
            {activeTab === 'manual' && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Adicionar Créditos Manualmente</h3>
                    <p className="text-sm text-slate-500 mb-6">Use esta ferramenta para conceder créditos de cortesia, bônus de suporte ou ajustes manuais.</p>
                    <form onSubmit={handleRefill} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ID ou Slug do Tenant</label>
                            <input type="text" className="border border-slate-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-indigo-500" value={refillData.tenantId} onChange={e => setRefillData({ ...refillData, tenantId: e.target.value })} required placeholder="ex: multirede-distribuidora ou UUID" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. Tokens</label>
                            <input type="number" className="border border-slate-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-indigo-500" value={refillData.amount} onChange={e => setRefillData({ ...refillData, amount: parseInt(e.target.value) })} required />
                        </div>
                        <div className="pt-2">
                            <button type="submit" className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 w-full shadow-md">Credit Tokens</button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- MODAL PLANO --- */}
            {isPlanModalOpen && editingPlan && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto transform transition-all scale-100">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Configurar Plano</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Defina os limites e recursos deste nível de assinatura.</p>
                            </div>
                            <button onClick={() => setIsPlanModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">✕</button>
                        </div>
                        <form onSubmit={savePlan} className="p-6 space-y-8">

                            {/* SECTION 1: BASICS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">ID (Código)</label>
                                        <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all" value={editingPlan.id} onChange={e => setEditingPlan({ ...editingPlan, id: e.target.value })} required disabled={!!plans.find(p => p.id === editingPlan.id)} placeholder="ex: ENTERPRISE" />
                                        <p className="text-[10px] text-slate-400 mt-1">Identificador único do plano no sistema.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome Visível</label>
                                        <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all" value={editingPlan.name} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} required placeholder="ex: Plano Enterprise" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Preço Mensal (R$)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-slate-400">R$</span>
                                                <input type="number" className="w-full border border-slate-300 p-2.5 pl-8 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-mono" value={editingPlan.price} onChange={e => setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) })} required />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tokens Mensais</label>
                                            <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-mono" value={editingPlan.limits.monthlyTokens} onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, monthlyTokens: parseInt(e.target.value) } })} required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" checked={editingPlan.active} onChange={e => setEditingPlan({ ...editingPlan, active: e.target.checked })} />
                                            <div>
                                                <span className="block text-sm font-medium text-slate-900">Plano Ativo</span>
                                                <span className="block text-xs text-slate-500">Disponível para novas assinaturas</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* SECTION 2: LIMITS */}
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Limites & Cotas
                                </h4>
                                <div className="grid grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1.5 font-medium">Máx Usuários</label>
                                        <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" value={editingPlan.limits.maxUsers} onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, maxUsers: parseInt(e.target.value) } })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1.5 font-medium">Storage (GB)</label>
                                        <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" value={editingPlan.limits.maxStorageGB} onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, maxStorageGB: parseInt(e.target.value) } })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1.5 font-medium">Max Files/Job</label>
                                        <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" value={editingPlan.limits.maxCandidatesPerJob} onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, maxCandidatesPerJob: parseInt(e.target.value) } })} />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* SECTION 3: FEATURES */}
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg>
                                    Features Habilitadas
                                </h4>
                                <div className="grid grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-200 gap-y-3 gap-x-6 text-sm">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" checked={editingPlan.features.whiteLabel} onChange={e => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features, whiteLabel: e.target.checked } })} />
                                        <span className="group-hover:text-indigo-700 transition-colors">White-Label (Logo Custom)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" checked={editingPlan.features.apiAccess} onChange={e => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features, apiAccess: e.target.checked } })} />
                                        <span className="group-hover:text-indigo-700 transition-colors">Acesso à API</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" checked={editingPlan.features.sso} onChange={e => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features, sso: e.target.checked } })} />
                                        <span className="group-hover:text-indigo-700 transition-colors">SSO (Single Sign-On)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" checked={editingPlan.features.auditLog} onChange={e => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features, auditLog: e.target.checked } })} />
                                        <span className="group-hover:text-indigo-700 transition-colors">Audit Logs Completos</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" checked={editingPlan.features.customDomain} onChange={e => setEditingPlan({ ...editingPlan, features: { ...editingPlan.features, customDomain: e.target.checked } })} />
                                        <span className="group-hover:text-indigo-700 transition-colors">Domínio Customizado (CNAME)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setIsPlanModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors text-sm" disabled={submitting}>Cancelar</button>
                                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all text-sm flex items-center gap-2" disabled={submitting}>
                                    {submitting ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Salvando...
                                        </>
                                    ) : (
                                        'Salvar Plano'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* --- MODAL PACOTE --- */}
            {isPkgModalOpen && editingPkg && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-100">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Editar Pacote</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Configure um pacote de tokens avulso.</p>
                            </div>
                            <button onClick={() => setIsPkgModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">✕</button>
                        </div>
                        <form onSubmit={savePkg} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome do Pacote</label>
                                <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" value={editingPkg.name} onChange={e => setEditingPkg({ ...editingPkg, name: e.target.value })} required placeholder="ex: Pacote Avançado" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Quantidade de Tokens</label>
                                <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono" value={editingPkg.tokens} onChange={e => setEditingPkg({ ...editingPkg, tokens: parseInt(e.target.value) })} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Preço (R$)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400">R$</span>
                                    <input type="number" className="w-full border border-slate-300 p-2.5 pl-8 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono" value={editingPkg.price} onChange={e => setEditingPkg({ ...editingPkg, price: parseFloat(e.target.value) })} required />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setIsPkgModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors text-sm" disabled={submitting}>Cancelar</button>
                                <button type="submit" className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-md transition-all text-sm flex items-center gap-2" disabled={submitting}>
                                    {submitting ? 'Salvando...' : 'Salvar Pacote'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TokensModule;
