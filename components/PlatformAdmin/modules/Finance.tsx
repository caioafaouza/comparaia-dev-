
import React, { useState, useEffect } from 'react';
import { getTransactions, getGlobalPlatformData, getPaymentGateways, updatePaymentGateway, deletePaymentGateway } from '../../../services/api';
import { Transaction, PlatformMetrics, PaymentGatewayConfig, PaymentProvider } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const FinanceModule: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'gateways'>('dashboard');

    // Dashboard State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);

    // Gateway State
    const [gateways, setGateways] = useState<PaymentGatewayConfig[]>([]);
    const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayConfig | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        getTransactions().then(setTransactions);
        getGlobalPlatformData().then(setMetrics);
        loadGateways();
    }, []);

    const loadGateways = () => {
        getPaymentGateways().then(data => {
            setGateways(data);
            if (data.length > 0 && !selectedGateway) setSelectedGateway(data[0]);
        });
    };

    const handleCreateGateway = () => {
        const newGateway: PaymentGatewayConfig = {
            provider: 'STRIPE',
            name: 'Novo Gateway',
            active: false,
            isDefault: false,
            credentials: { publicKey: '', secretKey: '' },
            customInstructions: ''
        };
        setSelectedGateway(newGateway);
        setIsCreating(true);
    };

    const handleGatewaySave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGateway) return;
        try {
            await updatePaymentGateway(selectedGateway);
            addToast(`Gateway ${selectedGateway.name} salvo com sucesso.`, 'success');
            setIsCreating(false);
            loadGateways();
        } catch (err: any) { addToast('Erro ao salvar.', 'error'); }
    };

    const handleDeleteGateway = async () => {
        if (!selectedGateway) return;
        if (confirm(`Tem certeza que deseja excluir o gateway ${selectedGateway.name}?`)) {
            await deletePaymentGateway(selectedGateway.provider);
            addToast('Gateway removido.', 'success');
            setSelectedGateway(null);
            loadGateways();
        }
    };

    const activeTenants = metrics?.activeTenants ?? metrics?.totalTenants ?? 0;
    const arpu = metrics ? (metrics.mrr / (activeTenants || 1)) : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-end">
                <div><h2 className="text-2xl font-bold text-slate-900">Financeiro & Receita</h2><p className="text-slate-500">Gestão de faturamento.</p></div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md text-sm font-bold ${activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Visão Geral</button>
                    <button onClick={() => setActiveTab('gateways')} className={`px-4 py-2 rounded-md text-sm font-bold ${activeTab === 'gateways' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Gateways</button>
                </div>
            </div>

            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && metrics && (
                <div className="space-y-6">
                    {/* Metrics Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase">Receita (MRR)</div>
                            <div className="text-3xl font-extrabold text-green-600 mt-2">R$ {metrics.mrr.toLocaleString()}</div>
                            <p className="text-xs text-green-600 mt-1">▲ 12% vs mês anterior</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase">Ticket Médio (ARPU)</div>
                            <div className="text-3xl font-extrabold text-slate-900 mt-2">R$ {arpu.toFixed(0)}</div>
                            <p className="text-xs text-slate-400 mt-1">Por tenant ativo</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase">LTV Estimado</div>
                            <div className="text-3xl font-extrabold text-indigo-600 mt-2">R$ {(arpu * 12).toLocaleString()}</div>
                            <p className="text-xs text-slate-400 mt-1">Baseado em 12 meses</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold text-slate-500 uppercase">Transações (30d)</div>
                            <div className="text-3xl font-extrabold text-slate-900 mt-2">{transactions.length}</div>
                            <p className="text-xs text-slate-400 mt-1">Volume de processamento</p>
                        </div>
                    </div>

                    {/* Revenue History Chart Placeholder */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4">Crescimento de Receita (6 meses)</h3>
                        <div className="h-48 flex items-end gap-4">
                            {[45, 52, 58, 62, 70, 85].map((h, i) => (
                                <div key={i} className="flex-1 bg-indigo-50 rounded-t-lg relative group">
                                    <div
                                        className="absolute bottom-0 w-full bg-indigo-500 rounded-t-lg transition-all duration-500 hover:bg-indigo-600"
                                        style={{ height: `${h}%` }}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                            R$ {h}k
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-400 uppercase font-bold">
                            <span>Jan</span><span>Fev</span><span>Mar</span><span>Abr</span><span>Mai</span><span>Jun</span>
                        </div>
                    </div>

                    {/* Recent Transactions Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="text-sm font-bold text-slate-700">Últimas Transações</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-bold text-slate-500">Data</th>
                                        <th className="px-6 py-3 text-left font-bold text-slate-500">Tenant ID</th>
                                        <th className="px-6 py-3 text-left font-bold text-slate-500">Descrição</th>
                                        <th className="px-6 py-3 text-right font-bold text-slate-500">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {transactions.slice(0, 5).map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-3 font-mono text-xs text-slate-400">{tx.tenantId.substring(0, 8)}...</td>
                                            <td className="px-6 py-3 font-medium text-slate-800">{tx.description}</td>
                                            <td className={`px-6 py-3 text-right font-bold ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {tx.amount > 0 ? '+' : ''}{tx.amount}
                                            </td>
                                        </tr>
                                    ))}
                                    {transactions.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Sem transações recentes.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* GATEWAYS TAB */}
            {activeTab === 'gateways' && (
                <div className="grid grid-cols-12 gap-6 animate-fade-in">
                    <div className="col-span-3 space-y-4">
                        <div className="space-y-2">
                            {gateways.map(gw => (
                                <button key={gw.provider} onClick={() => { setSelectedGateway(gw); setIsCreating(false); }} className={`w-full text-left p-4 rounded-xl border transition-all ${selectedGateway?.provider === gw.provider && !isCreating ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                    <div className="font-bold text-slate-800">{gw.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">{gw.provider === 'CUSTOM' ? 'Manual' : 'Automático'} • {gw.active ? 'Ativo' : 'Inativo'}</div>
                                </button>
                            ))}
                        </div>
                        <button onClick={handleCreateGateway} className={`w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 ${isCreating ? 'border-indigo-500 text-indigo-600 bg-indigo-50' : ''}`}>+ Novo Gateway</button>
                    </div>

                    <div className="col-span-9">
                        {selectedGateway ? (
                            <form onSubmit={handleGatewaySave} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
                                <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{isCreating ? 'Novo Gateway' : `Configuração: ${selectedGateway.name}`}</h3>
                                    </div>
                                    {!isCreating && <button type="button" onClick={handleDeleteGateway} className="text-red-500 font-bold text-sm">Excluir</button>}
                                </div>

                                <div className="space-y-6 flex-1">
                                    {isCreating && (
                                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4">
                                            <label className="block text-xs font-bold text-indigo-800 uppercase mb-2">Provedor</label>
                                            <select className="w-full border border-indigo-300 rounded p-2 text-sm bg-white" value={selectedGateway.provider} onChange={e => setSelectedGateway({ ...selectedGateway, provider: e.target.value as PaymentProvider, name: e.target.value === 'CUSTOM' ? 'Pagamento Manual (Pix/Depósito)' : 'Novo Gateway' })}>
                                                <option value="STRIPE">Stripe</option>
                                                <option value="MERCADO_PAGO">Mercado Pago</option>
                                                <option value="PAGARME">Pagar.me</option>
                                                <option value="CUSTOM">Manual / Customizado</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Exibir Provedor (Read-only se editando) */}
                                    {!isCreating && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Provedor</label>
                                            <div className="w-full border p-2 rounded bg-slate-50 text-slate-700 text-sm">
                                                {selectedGateway.provider === 'MERCADO_PAGO' ? 'Mercado Pago' :
                                                    selectedGateway.provider === 'STRIPE' ? 'Stripe' :
                                                        selectedGateway.provider === 'PAGARME' ? 'Pagar.me' : 'Manual / Custom'}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome de Exibição</label>
                                        <input type="text" className="w-full border p-2 rounded" value={selectedGateway.name} onChange={e => setSelectedGateway({ ...selectedGateway, name: e.target.value })} placeholder={selectedGateway.provider === 'CUSTOM' ? "Ex: Transferência Bancária / PIX" : "Ex: Cartão de Crédito"} />
                                    </div>

                                    {/* Conditional Fields based on Provider */}
                                    {selectedGateway.provider === 'CUSTOM' ? (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Instruções de Pagamento (HTML/Texto)</label>
                                            <textarea
                                                className="w-full border p-3 rounded h-32 font-mono text-sm"
                                                value={selectedGateway.customInstructions || ''}
                                                onChange={e => setSelectedGateway({ ...selectedGateway, customInstructions: e.target.value })}
                                                placeholder="Ex: Chave PIX: 00.000.000/0001-00. Enviar comprovante para financeiro@empresa.com"
                                            ></textarea>
                                            <p className="text-[10px] text-slate-400 mt-1">Estas instruções serão exibidas ao usuário no checkout.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-6">
                                            {/* API Key / Public Key */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                                    {selectedGateway.provider === 'MERCADO_PAGO' ? 'Public Key' : 'API Key / Public Key'}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full border p-2 rounded font-mono text-sm"
                                                    value={selectedGateway.credentials.publicKey || ''}
                                                    onChange={e => setSelectedGateway({ ...selectedGateway, credentials: { ...selectedGateway.credentials, publicKey: e.target.value } })}
                                                    placeholder={selectedGateway.provider === 'MERCADO_PAGO' ? 'TEST-...' : 'pk_...'}
                                                />
                                            </div>

                                            {/* Secret Key / Access Token */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                                    {selectedGateway.provider === 'MERCADO_PAGO' ? 'Access Token (Secret Key)' : 'Secret Key'}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showKey ? "text" : "password"}
                                                        className="w-full border p-2 rounded font-mono text-sm"
                                                        value={selectedGateway.credentials.secretKey || ''}
                                                        onChange={e => setSelectedGateway({ ...selectedGateway, credentials: { ...selectedGateway.credentials, secretKey: e.target.value } })}
                                                        placeholder={selectedGateway.provider === 'MERCADO_PAGO' ? 'TEST-...' : 'sk_...'}
                                                    />
                                                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-2 text-xs text-indigo-600 font-bold hover:underline">
                                                        {showKey ? 'OCULTAR' : 'MOSTRAR'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-6 mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedGateway.active} onChange={e => setSelectedGateway({ ...selectedGateway, active: e.target.checked })} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                                            <span className="text-sm font-bold text-slate-700">Ativar Gateway</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedGateway.isDefault} onChange={e => setSelectedGateway({ ...selectedGateway, isDefault: e.target.checked })} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                                            <span className="text-sm font-bold text-slate-700">Definir como Principal</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                    <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all">Salvar</button>
                                </div>
                            </form>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">Selecione ou crie um gateway.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceModule;
