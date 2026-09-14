import React, { useState, useEffect } from 'react';
import { getTransactions, getGlobalPlatformData } from '../../../services/api';
import { Transaction, TenantSummary } from '../../../types';

const GlobalInvoicesModule: React.FC = () => {
    const PAGE_SIZE = 20;
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [tenants, setTenants] = useState<Record<string, string>>({}); // Map ID -> Name
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch all transactions
                const txs = await getTransactions();

                // Fetch tenants to map IDs to Names
                const platformData = await getGlobalPlatformData();
                const tenantMap: Record<string, string> = {};
                platformData.tenants.forEach(t => {
                    tenantMap[t.id] = t.name;
                });

                setTransactions(txs);
                setTenants(tenantMap);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredTransactions = transactions.filter(tx => {
        const tenantName = tenants[tx.tenantId] || 'Desconhecido';
        const search = searchTerm.toLowerCase();
        return (
            tenantName.toLowerCase().includes(search) ||
            tx.description.toLowerCase().includes(search) ||
            tx.id.toLowerCase().includes(search)
        );
    });

    useEffect(() => {
        setPage(1);
    }, [searchTerm, transactions.length]);

    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + PAGE_SIZE);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Histórico Financeiro Global</h2>
                    <p className="text-slate-500">Registro completo de faturas, recargas e movimentações de todos os tenants.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Buscar por cliente, descrição ou ID..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-xs font-bold text-slate-500 uppercase">Total Movimentado:</span>
                    <span className="text-sm font-mono font-bold text-slate-700">
                        R$ {filteredTransactions.reduce((acc, curr) => acc + (curr.amount > 0 ? 0 : Math.abs(curr.amount)), 0).toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Data / Hora</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Organização (Tenant)</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Descrição</th>
                            <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase">Tokens / Valor</th>
                            <th className="px-6 py-3 text-center font-bold text-slate-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Carregando histórico...</td></tr>
                        ) : filteredTransactions.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
                        ) : (
                            paginatedTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                        <div className="font-medium">{new Date(tx.date).toLocaleDateString()}</div>
                                        <div className="text-xs text-slate-400">{new Date(tx.date).toLocaleTimeString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{tenants[tx.tenantId] || 'Tenant Removido'}</div>
                                        <div className="text-xs font-mono text-slate-400">{tx.tenantId}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-slate-700 font-medium">{tx.description}</span>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-mono font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Processado
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {!loading && filteredTransactions.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                            Exibindo {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredTransactions.length)} de {filteredTransactions.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <span className="text-sm text-slate-600 min-w-[110px] text-center">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GlobalInvoicesModule;

