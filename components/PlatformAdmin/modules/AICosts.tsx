import React, { useEffect, useState } from 'react';
import { getAIUsageData } from '../../../services/api';
import { AICostDashboardData } from '../../../types';

type PeriodFilter = 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';

const AICostsView: React.FC = () => {
    const [data, setData] = useState<AICostDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<PeriodFilter>('30d');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const payload = await getAIUsageData({
                    period,
                    from: period === 'custom' ? fromDate : undefined,
                    to: period === 'custom' ? toDate : undefined,
                });
                setData(payload);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [period, fromDate, toDate]);

    if (loading || !data) return <div className="p-8 text-center text-slate-400">Carregando metricas de IA...</div>;

    const maxRequests = Math.max(...data.dailyUsage.map((d) => d.requests), 5);
    const kpiSuffix = data.periodLabel ? `(${data.periodLabel})` : '(30d)';

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Custos de LLM & IA</h2>
                    <p className="text-slate-500">Detalhamento de consumo de tokens e custos por provedor.</p>
                </div>
                <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Periodo</label>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                            className="border border-slate-300 rounded px-3 py-2 text-sm"
                        >
                            <option value="today">Hoje</option>
                            <option value="7d">Ultimos 7 dias</option>
                            <option value="30d">Ultimos 30 dias</option>
                            <option value="90d">Ultimos 90 dias</option>
                            <option value="month">Mes atual</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    {period === 'custom' && (
                        <>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">De</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="border border-slate-300 rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Ate</label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="border border-slate-300 rounded px-3 py-2 text-sm"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase">{`Custo Estimado ${kpiSuffix}`}</div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">US$ {data.totalCost30d.toFixed(4)}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase">{`Tokens Processados ${kpiSuffix}`}</div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">{(data.totalTokens30d / 1000).toFixed(1)}k</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase">{`Total Requests ${kpiSuffix}`}</div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">{data.totalRequests30d.toLocaleString()}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase">{`Latencia Media ${kpiSuffix}`}</div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">{data.avgLatency30d}ms</div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">Volume Diario de Requisicoes</h3>
                <div className="flex items-end gap-2 h-40 border-b border-slate-100 pb-2">
                    {data.dailyUsage.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div
                                className="w-full bg-indigo-100 rounded-t-sm group-hover:bg-indigo-300 transition-colors relative"
                                style={{ height: `${Math.min(100, (day.requests / maxRequests) * 100)}%`, minHeight: day.requests > 0 ? '4px' : '0' }}
                            >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                    {day.requests} reqs
                                </div>
                            </div>
                            <span className="text-[9px] text-slate-400 rotate-0 md:rotate-0 truncate w-full text-center">{day.date}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4">Distribuicao por Provedor</h3>
                    <div className="space-y-4">
                        {data.providerDistribution.map((p) => (
                            <div key={p.provider}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>{p.provider}</span>
                                    <span className="font-bold">{p.percentage}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div className="h-2 rounded-full" style={{ width: `${p.percentage}%`, backgroundColor: p.color }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4">Top 5 Tenants (Consumo)</h3>
                    {data.tokensByTenant.length === 0 ? (
                        <div className="text-sm text-slate-400 text-center py-4">Sem consumo registrado.</div>
                    ) : (
                        <div className="space-y-4">
                            {data.tokensByTenant.map((t) => (
                                <div key={t.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>{t.label}</span>
                                        <span className="font-bold">{t.value.toLocaleString()} tks</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div className="h-2 rounded-full" style={{ width: `${t.percentage}%`, backgroundColor: t.color }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-700">Logs Recentes de API</div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-white">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-slate-500">ID / Time</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500">Modelo</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500">Contexto</th>
                                <th className="px-6 py-3 text-left font-medium text-slate-500">Tokens (In/Out)</th>
                                <th className="px-6 py-3 text-right font-medium text-slate-500">Latencia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.recentLogs.length === 0 ? (
                                <tr><td colSpan={5} className="p-6 text-center text-slate-400">Nenhum log disponivel.</td></tr>
                            ) : (
                                data.recentLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 text-xs text-slate-500">
                                            <div className="font-mono font-bold text-indigo-600">{log.id.split('_')[1]}</div>
                                            <div>{new Date(log.timestamp).toLocaleString()}</div>
                                        </td>
                                        <td className="px-6 py-3 font-medium text-slate-700">{log.model}</td>
                                        <td className="px-6 py-3">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200">{log.context}</span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 font-mono text-xs">
                                            <span className="text-blue-600 font-bold">IN:{log.tokensIn}</span> / <span className="text-purple-600 font-bold">OUT:{log.tokensOut}</span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-slate-700">{log.latency}ms</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AICostsView;
