
import React, { useState, useEffect } from 'react';
import { getGlobalPlatformData, adminListTenants, impersonateTenant, deleteTenant, toggleTenantStatus, adminCreateTenant, getPlans, updateTenant, getSession } from '../../../services/api';
import { TenantSummary, TenantStatus, PlanDefinition } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const TenantManagerModule: React.FC = () => {
    const { addToast } = useToast();
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [plans, setPlans] = useState<PlanDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState<TenantSummary | null>(null);
    const [tenantToDelete, setTenantToDelete] = useState<TenantSummary | null>(null);

    // Search & Debounce State
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [newTenantData, setNewTenantData] = useState({
        name: '',
        admin: '',
        email: '',
        plan: '',
        password: '',
        cnpj: '',
        phone: '',
        sector: 'Indústria',
        purchaseVolume: 'R$ 100k - R$ 1M',
        customDomain: ''
    });

    const loadData = async () => {
        setLoading(true);
        try {
            let loadedTenants: TenantSummary[] | null = null;
            if (typeof adminListTenants === 'function') {
                try {
                    const res = await adminListTenants();
                    if (Array.isArray(res) && res.length > 0) {
                        loadedTenants = res;
                    }
                } catch { /* fallback */ }
            }
            if (!loadedTenants && typeof getGlobalPlatformData === 'function') {
                const data = await getGlobalPlatformData();
                if (data?.tenants) {
                    loadedTenants = data.tenants;
                }
            }
            if (loadedTenants) {
                setTenants(loadedTenants);
            }
        } catch (e) {
            console.error('Failed to load tenants', e);
        } finally {
            setLoading(false);
        }

        if (typeof getPlans === 'function') {
            try {
                const pList = await getPlans();
                if (Array.isArray(pList)) {
                    setPlans(pList);
                    if (pList.length > 0 && !newTenantData.plan) {
                        setNewTenantData(prev => ({ ...prev, plan: pList[0].id }));
                    }
                }
            } catch { /* ignore */ }
        }
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const filteredTenants = tenants.filter(t => {
        const search = debouncedSearch.toLowerCase().trim();
        if (!search) return true;

        return (
            t.name.toLowerCase().includes(search) ||
            t.id.toLowerCase().includes(search) ||
            (t.customDomain && t.customDomain.toLowerCase().includes(search)) ||
            (t.cnpj && t.cnpj.replace(/\D/g, '').includes(search.replace(/\D/g, '')))
        );
    });

    const handleImpersonate = (tenantId: string) => {
        if (confirm("ATENÇÃO: Você entrará como 'Owner' neste tenant. A sessão atual será substituída. Continuar?")) {
            addToast('Alternando contexto de organização...', 'info');
            impersonateTenant(tenantId).catch(err => addToast(err.message, 'error'));
        }
    };

    const confirmDelete = (tenant: TenantSummary) => {
        setTenantToDelete(tenant);
    };

    const performDelete = async () => {
        if (!tenantToDelete) return;
        setSubmitting(true);
        try {
            await deleteTenant(tenantToDelete.id);
            addToast("Tenant removido com sucesso.", 'success');
            setTenantToDelete(null);
            await loadData();
        } catch (err: any) {
            addToast(err.message || "Erro ao remover tenant.", 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusToggle = async (tenantId: string, current: TenantStatus) => {
        const newStatus = current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        await toggleTenantStatus(tenantId);
        addToast(`Status alterado para ${newStatus}`, 'info');
        loadData();
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await adminCreateTenant({
                name: newTenantData.name,
                adminName: newTenantData.admin,
                email: newTenantData.email,
                plan: newTenantData.plan,
                password: newTenantData.password,
                cnpj: newTenantData.cnpj,
                phone: newTenantData.phone,
                sector: newTenantData.sector,
                purchaseVolume: newTenantData.purchaseVolume,
                customDomain: newTenantData.customDomain
            });
            addToast("Tenant criado com sucesso. Credenciais geradas.", 'success');
            setIsCreateOpen(false);
            setNewTenantData({ name: '', admin: '', email: '', plan: plans[0]?.id || '', password: '', cnpj: '', phone: '', sector: 'Indústria', purchaseVolume: 'R$ 100k - R$ 1M', customDomain: '' });
            setTimeout(() => loadData(), 500);
        } catch (err: any) {
            addToast(err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTenant) return;

        try {
            await updateTenant(editingTenant.id, {
                name: editingTenant.name,
                plan: editingTenant.plan,
                status: editingTenant.status,
                cnpj: editingTenant.cnpj,
                phone: editingTenant.phone,
                sector: editingTenant.sector,
                purchaseVolume: editingTenant.purchaseVolume,
                customDomain: editingTenant.customDomain
            });
            addToast("Organização atualizada.", 'success');
            setEditingTenant(null);
            loadData();
        } catch (e: any) {
            addToast("Erro ao atualizar.", 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900" data-testid="tenants-header">Gerenciar Organizações</h2>
                    <p className="text-slate-500">Controle total sobre os tenants da plataforma.</p>
                </div>
                <button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2" data-testid="tenant-create-button">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Novo Tenant
                </button>
            </div>

            <div className="relative group">
                <input
                    type="text"
                    placeholder="Buscar organização por nome, ID, CPF/CNPJ ou domínio..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="tenant-search-input"
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            {isCreateOpen && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-fade-in">
                    <h3 className="font-bold mb-4 border-b pb-2">Registrar Nova Organização</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Empresa</label>
                                <input type="text" className="w-full border p-2 rounded" required value={newTenantData.name} onChange={e => setNewTenantData({ ...newTenantData, name: e.target.value })} placeholder="Razão Social" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF/CNPJ</label>
                                <input type="text" className="w-full border p-2 rounded" value={newTenantData.cnpj} onChange={e => setNewTenantData({ ...newTenantData, cnpj: e.target.value })} placeholder="000.000.000-00 ou 00.000.000/0001-00" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Setor</label>
                                <select className="w-full border p-2 rounded bg-white" value={newTenantData.sector} onChange={e => setNewTenantData({ ...newTenantData, sector: e.target.value })}>
                                    <option value="Construção Civil">Construção Civil</option>
                                    <option value="Indústria">Indústria</option>
                                    <option value="Hardware TI">Hardware TI</option>
                                    <option value="Hospitalar">Hospitalar</option>
                                    <option value="Serviços">Serviços</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Volume Mensal</label>
                                <select className="w-full border p-2 rounded bg-white" value={newTenantData.purchaseVolume} onChange={e => setNewTenantData({ ...newTenantData, purchaseVolume: e.target.value })}>
                                    <option value="Até R$ 100k">Até R$ 100k</option>
                                    <option value="R$ 100k - R$ 1M">R$ 100k - R$ 1M</option>
                                    <option value="R$ 1M - R$ 10M">R$ 1M - R$ 10M</option>
                                    <option value="Acima de R$ 10M">Acima de R$ 10M</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                                <input type="text" className="w-full border p-2 rounded" value={newTenantData.phone} onChange={e => setNewTenantData({ ...newTenantData, phone: e.target.value })} placeholder="(11) 99999-9999" />
                            </div>

                            <div className="md:col-span-3 border-t border-slate-100 pt-2 mt-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase">Admin Principal</h4>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                                <input type="text" className="w-full border p-2 rounded" required value={newTenantData.admin} onChange={e => setNewTenantData({ ...newTenantData, admin: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                <input type="email" className="w-full border p-2 rounded" required value={newTenantData.email} onChange={e => setNewTenantData({ ...newTenantData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
                                <input type="password" className="w-full border p-2 rounded" required value={newTenantData.password} onChange={e => setNewTenantData({ ...newTenantData, password: e.target.value })} />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Domínio Customizado (Slug)</label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">https://</span>
                                    <input type="text" className="w-full border p-2 rounded-r-md" placeholder="empresa.comparaia.com" value={newTenantData.customDomain} onChange={e => setNewTenantData({ ...newTenantData, customDomain: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">PLANO INICIAL</label>
                                <select className="w-full border p-2 rounded bg-white" value={newTenantData.plan} onChange={e => setNewTenantData({ ...newTenantData, plan: e.target.value })}>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                            <button type="button" onClick={() => setIsCreateOpen(false)} className="text-slate-500 px-4 py-2 hover:bg-slate-50 rounded">Cancelar</button>
                            <button type="submit" disabled={submitting} className="bg-emerald-600 text-white px-6 py-2 rounded font-bold hover:bg-emerald-700 shadow-sm disabled:opacity-50">
                                {submitting ? 'Provisionando...' : 'Provisionar Organização'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Empresa</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Setor / Contexto</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Plano</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">MRR</th>
                            <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={6} className="p-6 text-center text-slate-400">Carregando...</td></tr>
                        ) : filteredTenants.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-500">
                                    Nenhuma organização encontrada.
                                </td>
                            </tr>
                        ) : (
                            filteredTenants.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50 group">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{t.name}</div>
                                        <div className="text-xs text-slate-400">{t.cnpj || t.id}</div>
                                        <div className="text-[10px] text-slate-400">Slug: {t.slug || t.customDomain || t.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-700">{t.sector || '-'}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-bold">{t.purchaseVolume || 'Volume ND'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>{t.plan}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => handleStatusToggle(t.id, t.status)} className={`px-2 py-0.5 rounded text-xs font-bold ${t.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {t.status}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold text-slate-600">R$ {t.mrr}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleImpersonate(t.id)} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors">Acessar</button>
                                            <button onClick={() => setEditingTenant(t)} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">Editar</button>
                                            <button onClick={() => confirmDelete(t)} className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors">Excluir</button>
                                        </div>
                                    </td>
                                </tr>
                            )))}
                    </tbody>
                </table>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {tenantToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
                            <div className="bg-red-100 text-red-600 p-2 rounded-full">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <h3 className="font-bold text-red-900">Excluir Organização?</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 text-sm mb-4">
                                Você está prestes a excluir <strong>{tenantToDelete.name}</strong>.
                                <br /><br />
                                <span className="text-red-600 font-bold">Esta ação é irreversível!</span> Todos os dados, usuários, jobs e configurações serão permanentemente apagados.
                            </p>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setTenantToDelete(null)}
                                    className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded font-medium text-sm"
                                    disabled={submitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={performDelete}
                                    className="px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 shadow-sm text-sm flex items-center gap-2"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Excluindo...
                                        </>
                                    ) : (
                                        'Excluir Definitivamente'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT TENANT MODAL */}
            {editingTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-lg">Editar Organização</h3>
                            <button onClick={() => setEditingTenant(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleUpdateTenant} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Empresa</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={editingTenant.name}
                                        onChange={e => setEditingTenant({ ...editingTenant, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF/CNPJ</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={editingTenant.cnpj || ''}
                                        onChange={e => setEditingTenant({ ...editingTenant, cnpj: e.target.value })}
                                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={editingTenant.phone || ''}
                                        onChange={e => setEditingTenant({ ...editingTenant, phone: e.target.value })}
                                        placeholder="(31) 99999-9999"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Setor</label>
                                    <select
                                        className="w-full border p-2 rounded bg-white"
                                        value={editingTenant.sector || 'Outros'}
                                        onChange={e => setEditingTenant({ ...editingTenant, sector: e.target.value })}
                                    >
                                        <option value="Construção Civil">Construção Civil</option>
                                        <option value="Indústria">Indústria</option>
                                        <option value="Hardware TI">Hardware TI</option>
                                        <option value="Hospitalar">Hospitalar</option>
                                        <option value="Serviços">Serviços</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Volume Mensal</label>
                                    <select
                                        className="w-full border p-2 rounded bg-white"
                                        value={editingTenant.purchaseVolume || 'R$ 100k - R$ 1M'}
                                        onChange={e => setEditingTenant({ ...editingTenant, purchaseVolume: e.target.value })}
                                    >
                                        <option value="Até R$ 100k">Até R$ 100k</option>
                                        <option value="R$ 100k - R$ 1M">R$ 100k - R$ 1M</option>
                                        <option value="R$ 1M - R$ 10M">R$ 1M - R$ 10M</option>
                                        <option value="Acima de R$ 10M">Acima de R$ 10M</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Domínio Customizado (slug)</label>
                                    <div className="flex">
                                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">https://</span>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded-r-md"
                                            value={editingTenant.customDomain || ''}
                                            onChange={e => setEditingTenant({ ...editingTenant, customDomain: e.target.value })}
                                            placeholder="empresa.comparaia.com"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plano</label>
                                    <select
                                        className="w-full border p-2 rounded bg-white"
                                        value={editingTenant.plan}
                                        onChange={e => setEditingTenant({ ...editingTenant, plan: e.target.value as any })}
                                    >
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                    <select
                                        className="w-full border p-2 rounded bg-white"
                                        value={editingTenant.status}
                                        onChange={e => setEditingTenant({ ...editingTenant, status: e.target.value as any })}
                                    >
                                        <option value="ACTIVE">Ativo</option>
                                        <option value="SUSPENDED">Suspenso</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                                    <div>
                                        <p className="font-bold text-slate-500 uppercase">ID</p>
                                        <p className="font-mono text-slate-700 break-all">{editingTenant.id}</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-500 uppercase">Slug / DB</p>
                                        <p className="font-mono text-slate-700 break-all">{editingTenant.slug || editingTenant.customDomain || '—'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setEditingTenant(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-sm">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantManagerModule;
