
import React, { useState, useEffect } from 'react';
import { getGlobalLogs } from '../../../services/api';
import { GlobalLog } from '../../../types';

const LogsModule: React.FC = () => {
    const [logs, setLogs] = useState<GlobalLog[]>([]);

    useEffect(() => {
        getGlobalLogs().then(setLogs);
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Logs Globais do Sistema</h2>
                <p className="text-slate-500">Rastreabilidade completa de eventos de API, Workers e Autenticação.</p>
            </div>

            <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden font-mono text-xs">
                <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                    <span className="text-slate-300 font-bold">system.log</span>
                    <span className="text-slate-500">tail -f</span>
                </div>
                <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto text-slate-300">
                    {logs.map(log => (
                        <div key={log.id} className="flex gap-4 hover:bg-white/5 p-1 rounded">
                            <span className="text-slate-500 w-36 shrink-0">{new Date(log.timestamp).toISOString().split('T')[1].replace('Z', '')}</span>
                            <span className={`w-16 font-bold shrink-0 ${log.level === 'INFO' ? 'text-blue-400' : log.level === 'WARN' ? 'text-yellow-400' : 'text-red-500'}`}>{log.level}</span>
                            <span className="w-20 text-purple-400 shrink-0">[{log.service}]</span>
                            <span className="flex-1 text-slate-200">{log.message}</span>
                            {log.metadata && <span className="text-slate-600">{log.metadata}</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LogsModule;
