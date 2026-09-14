
import React, { useState, useEffect } from 'react';
import { getSystemHealth, toggleMaintenanceMode, clearSystemCache } from '../../../services/api';
import { SystemHealth } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const HealthCenterModule: React.FC = () => {
    const { addToast } = useToast();
    const [health, setHealth] = useState<SystemHealth | null>(null);

    const loadHealth = () => getSystemHealth().then(setHealth);

    useEffect(() => { loadHealth(); }, []);

    const handleMaintenance = async () => {
        if (!health) return;
        await toggleMaintenanceMode(!health.maintenanceMode);
        addToast(`Modo manutenção ${!health.maintenanceMode ? 'ATIVADO' : 'DESATIVADO'}`, 'warning');
        loadHealth();
    };

    const handleClearCache = async () => {
        await clearSystemCache('all');
        addToast("Cache do sistema limpo com sucesso.", 'success');
    };

    if (!health) return <div>Carregando status...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Monitoramento de Infraestrutura</h2>
                    <p className="text-slate-500">Status dos serviços, latência e controles de emergência.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleClearCache} className="px-4 py-2 border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm">Limpar Cache</button>
                    <button onClick={handleMaintenance} className={`px-4 py-2 rounded font-bold text-sm text-white ${health.maintenanceMode ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'}`}>
                        {health.maintenanceMode ? 'DESATIVAR MANUTENÇÃO' : 'ATIVAR MANUTENÇÃO'}
                    </button>
                </div>
            </div>

            {/* SERVER VITALS */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg></div>
                    <div>
                        <div className="text-xs text-slate-500 font-bold uppercase">CPU Load</div>
                        <div className="text-2xl font-bold text-slate-800">{health.cpuLoad}%</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg></div>
                    <div>
                        <div className="text-xs text-slate-500 font-bold uppercase">RAM Usage</div>
                        <div className="text-2xl font-bold text-slate-800">{health.memoryUsage}%</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                    <div>
                        <div className="text-xs text-slate-500 font-bold uppercase">Active Threads</div>
                        <div className="text-2xl font-bold text-slate-800">{health.activeThreads}</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                    <div>
                        <div className="text-xs text-slate-500 font-bold uppercase">Error Rate</div>
                        <div className="text-2xl font-bold text-slate-800">{health.errorRate}%</div>
                    </div>
                </div>
            </div>

            {/* SERVICES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {health.services.map(svc => (
                    <div key={svc.name} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-slate-700">{svc.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${svc.status === 'operational' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {svc.status}
                            </span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-2xl font-bold text-slate-900">{svc.latency}ms</div>
                                <div className="text-xs text-slate-400">Latência Atual</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-slate-700">{svc.uptime}%</div>
                                <div className="text-xs text-slate-400">Uptime (30d)</div>
                            </div>
                        </div>
                        {/* Fake Sparkline */}
                        <div className="mt-4 flex items-end gap-1 h-8">
                            {svc.history.map((val, i) => (
                                <div key={i} style={{ height: `${Math.min(100, val)}%` }} className={`flex-1 rounded-t-sm ${val > 80 ? 'bg-red-300' : 'bg-emerald-200'}`}></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">Informações do Banco de Dados</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between border-b py-2">
                        <span className="text-slate-500">Tamanho do DB</span>
                        <span className="font-mono font-bold">{health.dbSize}</span>
                    </div>
                    <div className="flex justify-between border-b py-2">
                        <span className="text-slate-500">Último Backup</span>
                        <span className="font-mono">{health.lastBackup ? new Date(health.lastBackup).toLocaleString() : 'N/A'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HealthCenterModule;
