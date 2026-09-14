
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, PlanDefinition, PlanType, PaymentGatewayConfig, TokenPackage } from '../types';
import { getPlans, getTenantDetailsDeep, upgradeTenantPlan, getPaymentGateways, getTokenPackages, purchaseTokenPackage, getBillingOrderStatus } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface BillingViewProps {
    tokenBalance: number;
    transactions: Transaction[];
    tenantId: string;
    onRefresh: () => void;
}

const BillingView: React.FC<BillingViewProps> = ({ tokenBalance, transactions, tenantId, onRefresh }) => {
    const TRANSACTIONS_PER_PAGE = 15;
    const { addToast } = useToast();
    const { t } = useLanguage();
    const [plans, setPlans] = useState<PlanDefinition[]>([]);
    const [packages, setPackages] = useState<TokenPackage[]>([]);
    const [currentPlanId, setCurrentPlanId] = useState<PlanType>('STARTER');
    const [showCheckout, setShowCheckout] = useState(false);
    const [selectedItemForCheckout, setSelectedItemForCheckout] = useState<{ type: 'plan' | 'package', item: PlanDefinition | TokenPackage } | null>(null);
    const [returnProcessing, setReturnProcessing] = useState(false);
    const [txPage, setTxPage] = useState(1);

    // Gateway Info
    const [activeGateway, setActiveGateway] = useState<PaymentGatewayConfig | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        getPlans().then(setPlans);
        getTokenPackages().then(setPackages);
        getTenantDetailsDeep(tenantId).then(data => {
            if (data) setCurrentPlanId(data.plan as PlanType);
        });
        getPaymentGateways().then(gateways => {
            // Find default active gateway or first active
            const defaultGw = gateways.find(g => g.active && g.isDefault) || gateways.find(g => g.active);
            setActiveGateway(defaultGw || null);
        });
    }, [tenantId]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('status');
        const orderId = params.get('orderId');
        if (!status) return;

        const clearPaymentParams = () => {
            const url = new URL(window.location.href);
            url.searchParams.delete('status');
            url.searchParams.delete('orderId');
            const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
            window.history.replaceState({}, document.title, cleanUrl);
        };

        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const resolveReturn = async () => {
            setReturnProcessing(true);
            try {
                if (status === 'success' && orderId) {
                    let lastStatus: string | null = null;
                    for (let attempt = 0; attempt < 6; attempt += 1) {
                        const order = await getBillingOrderStatus(orderId, true);
                        lastStatus = order?.status || null;

                        if (lastStatus === 'PAID') {
                            addToast('Pagamento confirmado. Créditos atualizados com sucesso.', 'success');
                            onRefresh();
                            clearPaymentParams();
                            return;
                        }

                        if (lastStatus === 'FAILED' || lastStatus === 'CANCELLED') {
                            addToast('Pagamento não foi aprovado pelo gateway.', 'error');
                            onRefresh();
                            clearPaymentParams();
                            return;
                        }

                        await wait(1500);
                    }

                    if (lastStatus === 'PENDING' || !lastStatus) {
                        addToast('Pagamento recebido. Aguardando confirmação final do gateway.', 'info');
                    }
                    onRefresh();
                    clearPaymentParams();
                    return;
                }

                if (status === 'pending') {
                    addToast('Pagamento pendente de confirmação.', 'info');
                } else if (status === 'failure') {
                    addToast('Pagamento cancelado ou recusado.', 'error');
                } else {
                    addToast('Retorno do pagamento recebido.', 'info');
                }
                onRefresh();
            } catch (error: any) {
                addToast(error?.message || 'Falha ao confirmar status do pagamento.', 'error');
                onRefresh();
            } finally {
                clearPaymentParams();
                setReturnProcessing(false);
            }
        };

        resolveReturn();
    }, [addToast, onRefresh, tenantId]);

    useEffect(() => {
        setTxPage(1);
    }, [transactions]);

    const totalTxPages = Math.max(1, Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE));
    const safeTxPage = Math.min(txPage, totalTxPages);
    const paginatedTransactions = useMemo(() => {
        const start = (safeTxPage - 1) * TRANSACTIONS_PER_PAGE;
        return transactions.slice(start, start + TRANSACTIONS_PER_PAGE);
    }, [transactions, safeTxPage]);

    const handleUpgradeClick = (plan: PlanDefinition) => {
        if (!activeGateway) {
            addToast(t('common.error') + ": Gateway unavailable.", 'error');
            return;
        }
        setSelectedItemForCheckout({ type: 'plan', item: plan });
        setShowCheckout(true);
    };

    const handleBuyPackage = (pkg: TokenPackage) => {
        if (!activeGateway) {
            addToast(t('common.error') + ": Gateway unavailable.", 'error');
            return;
        }
        setSelectedItemForCheckout({ type: 'package', item: pkg });
        setShowCheckout(true);
    };

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);

        try {
            if (!selectedItemForCheckout) return;

            // Call API
            let response;
            if (selectedItemForCheckout.type === 'plan') {
                const plan = selectedItemForCheckout.item as PlanDefinition;
                response = await upgradeTenantPlan(tenantId, plan.id as PlanType, window.location.pathname);
            } else {
                const pkg = selectedItemForCheckout.item as TokenPackage;
                response = await purchaseTokenPackage(tenantId, pkg.id, window.location.pathname);
            }

            if (response && response.initPoint) {
                window.location.href = response.initPoint;
                return; // Redirecting...
            } else if (response && response.success) {
                // Free plan or instantaneous
                addToast(t('common.success'), 'success');
                setShowCheckout(false);
                onRefresh();
            }

        } catch (err: any) {
            addToast(err.message, 'error');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">{t('billing.title')}</h2>
                <p className="text-slate-500">{t('billing.subtitle')}</p>
            </div>

            {/* Wallet Summary */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{t('billing.tokenBalance')}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-extrabold ${tokenBalance < 100 ? 'text-red-600' : 'text-slate-900'}`}>
                            {tokenBalance}
                        </span>
                        <span className="text-slate-500 font-medium">{t('billing.available')}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{t('billing.currentPlan')}: <span className="font-bold text-indigo-600">{currentPlanId}</span></p>
                </div>
            </div>

            {/* Pricing Table */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => {
                    const isCurrent = plan.id === currentPlanId;
                    return (
                        <div key={plan.id} className={`relative p-6 rounded-2xl border flex flex-col ${isCurrent ? 'border-indigo-600 bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                            {isCurrent && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">{t('common.active').toUpperCase()}</div>}

                            <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                            <div className="mt-4 mb-6">
                                <span className="text-3xl font-extrabold text-slate-900">R$ {plan.price}</span>
                                <span className="text-slate-500 text-sm">/{t('billing.month')}</span>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                <li className="flex items-center text-sm text-slate-600">
                                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    {plan.limits.monthlyTokens} {t('billing.tokensMonth')}
                                </li>
                                <li className="flex items-center text-sm text-slate-600">
                                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    {t('team.permissions')}: {plan.limits.maxUsers} {t('billing.users')}
                                </li>
                                <li className="flex items-center text-sm text-slate-600">
                                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    {plan.features.whiteLabel ? t('billing.whiteLabel') : t('billing.noCustom')}
                                </li>
                            </ul>

                            <button
                                onClick={() => handleUpgradeClick(plan)}
                                disabled={isCurrent}
                                className={`w-full py-2.5 rounded-lg font-bold transition-all ${isCurrent ? 'bg-indigo-200 text-indigo-700 cursor-default' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'}`}
                            >
                                {isCurrent ? t('billing.currentPlan') : t('billing.selectPlan')}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Token Packages Section */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    {t('billing.packagesTitle')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {packages.map(pkg => (
                        <div key={pkg.id} className="p-6 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between hover:border-indigo-300 transition-all shadow-sm group">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-800">{pkg.name}</h4>
                                    <div className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full">
                                        +{pkg.tokens}
                                    </div>
                                </div>
                                <div className="text-2xl font-extrabold text-slate-900 mb-1">R$ {pkg.price.toFixed(2)}</div>
                                <p className="text-xs text-slate-500">{t('billing.oneTime')}</p>
                            </div>
                            <button
                                onClick={() => handleBuyPackage(pkg)}
                                className="mt-4 w-full py-2 bg-white border-2 border-slate-900 text-slate-900 rounded-lg font-bold text-sm hover:bg-slate-900 hover:text-white transition-colors"
                            >
                                {t('billing.buyNow')}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Transaction History Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-sm font-bold text-slate-700">{t('billing.historyTitle')}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.date')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.description')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.value')}</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {transactions.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">{t('jobs.empty')}</td></tr>
                            ) : (
                                paginatedTransactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                            {new Date(tx.date).toLocaleDateString()} <span className="text-xs">{new Date(tx.date).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-900 font-medium">
                                            {tx.description}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                {t('common.confirm')}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {transactions.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                            Exibindo {((safeTxPage - 1) * TRANSACTIONS_PER_PAGE) + 1}-
                            {Math.min(safeTxPage * TRANSACTIONS_PER_PAGE, transactions.length)} de {transactions.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setTxPage(p => Math.max(1, p - 1))}
                                disabled={safeTxPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <span className="text-sm text-slate-600 min-w-[90px] text-center">
                                Página {safeTxPage} de {totalTxPages}
                            </span>
                            <button
                                onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                                disabled={safeTxPage >= totalTxPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* CHECKOUT MODAL */}
            {showCheckout && selectedItemForCheckout && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 backdrop-blur-sm p-4 pt-6 md:pt-10 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[92vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">{t('billing.checkoutTitle')}</h3>
                            <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-slate-600">×</button>
                        </div>

                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                <div>
                                    <div className="text-sm text-indigo-800 font-medium">
                                        {selectedItemForCheckout.type === 'plan' ? t('billing.selectPlan') + ':' : t('billing.buyNow') + ':'}
                                    </div>
                                    <div className="text-xl font-bold text-indigo-900">{selectedItemForCheckout.item.name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-indigo-900">R$ {selectedItemForCheckout.item.price}</div>
                                    <div className="text-xs text-indigo-700">
                                        {selectedItemForCheckout.type === 'plan' ? `/${t('billing.month')}` : ''}
                                    </div>
                                </div>
                            </div>

                            <div className="text-center mb-6 text-slate-600">
                                <p>Você será redirecionado para o <strong>Mercado Pago</strong> para finalizar o pagamento de forma segura.</p>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleCheckout}
                                    disabled={processing || returnProcessing}
                                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
                                >
                                    {processing ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            {t('billing.processing')}
                                        </>
                                    ) : returnProcessing ? (
                                        <>Validando retorno...</>
                                    ) : (
                                        <>Ir para Pagamento (Mercado Pago)</>
                                    )}
                                </button>
                                <p className="text-center text-xs text-slate-400 mt-3 flex items-center justify-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    Processado via <strong>Mercado Pago</strong> (Ambiente Seguro)
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingView;


