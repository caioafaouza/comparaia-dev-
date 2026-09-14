
import React, { useState, useEffect } from 'react';
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookLogs, testWebhook } from '../../../services/api';
import { WebhookConfig, WebhookLog } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const WebhookModule: React.FC = () => {
    const { addToast } = useToast();
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
    const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        secret: '',
        events: [] as string[],
        active: true
    });

    // Expanded Event Definitions with Descriptions
    const EVENT_DEFINITIONS = [
        {
            category: "Processamento & Jobs",
            items: [
                { id: 'job.created', label: 'Análise Iniciada', desc: 'Disparado quando um novo job de comparação entra na fila.' },
                { id: 'job.completed', label: 'Análise Concluída', desc: 'Disparado quando a IA finaliza o processamento com sucesso.' },
                { id: 'job.failed', label: 'Falha na Análise', desc: 'Disparado em caso de erro técnico ou timeout no processamento.' }
            ]
        },
        {
            category: "Gestão de Usuários",
            items: [
                { id: 'user.created', label: 'Usuário Adicionado', desc: 'Quando um novo membro é registrado no tenant.' },
                { id: 'user.deleted', label: 'Usuário Removido', desc: 'Quando o acesso de um membro é revogado.' }
            ]
        },
        {
            category: "Financeiro & Segurança",
            items: [
                { id: 'billing.payment_failed', label: 'Falha no Pagamento', desc: 'Erro ao processar renovação de assinatura ou compra.' },
                { id: 'billing.invoice_paid', label: 'Pagamento Confirmado', desc: 'Sucesso na cobrança de fatura ou créditos.' },
                { id: 'tenant.alert', label: 'Alerta de Segurança', desc: 'Eventos críticos de sistema ou mudanças de plano.' }
            ]
        }
    ];

    useEffect(() => { loadWebhooks(); }, []);

    // Load logs whenever a webhook is selected
    useEffect(() => {
        if (selectedWebhook) {
            getWebhookLogs(selectedWebhook.id).then(setLogs);
        }
    }, [selectedWebhook]);

    const loadWebhooks = () => {
        getWebhooks().then(data => {
            setWebhooks(data);
            // Update selected if it exists in new list
            if (selectedWebhook) {
                const updated = data.find(w => w.id === selectedWebhook.id);
                if (updated) setSelectedWebhook(updated);
            }
        });
    };

    const handleCreate = () => {
        setFormData({ name: '', url: '', secret: '', events: [], active: true });
        setSelectedWebhook(null);
        setIsCreateOpen(true);
    };

    const handleEdit = (webhook: WebhookConfig) => {
        setFormData({
            name: webhook.name,
            url: webhook.url,
            secret: webhook.secret,
            events: webhook.events,
            active: webhook.active
        });
        setSelectedWebhook(webhook);
        setIsCreateOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (selectedWebhook && isCreateOpen) {
                // Update
                await updateWebhook(selectedWebhook.id, formData);
                addToast("Webhook atualizado.", 'success');
            } else {
                // Create
                await createWebhook(formData);
                addToast("Webhook criado.", 'success');
            }
            setIsCreateOpen(false);
            loadWebhooks();
        } catch (err: any) {
            addToast("Erro ao salvar webhook.", 'error');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Excluir este Webhook?")) {
            await deleteWebhook(id);
            if (selectedWebhook?.id === id) setSelectedWebhook(null);
            loadWebhooks();
            addToast("Webhook removido.", 'success');
        }
    };

    const handlePing = async () => {
        if (!selectedWebhook) return;
        setIsTesting(true);
        try {
            await testWebhook(selectedWebhook);
            addToast("Ping enviado com sucesso!", 'success');
            loadWebhooks(); // Update status/counters
            // Refresh logs
            getWebhookLogs(selectedWebhook.id).then(setLogs);
        } catch (e: any) {
            addToast(`Falha no Ping: ${e.message}`, 'error');
            loadWebhooks();
            getWebhookLogs(selectedWebhook.id).then(setLogs);
        } finally {
            setIsTesting(false);
        }
    };

    const toggleEvent = (evt: string) => {
        setFormData(prev => ({
            ...prev,
            events: prev.events.includes(evt)
                ? prev.events.filter(e => e !== evt)
                : [...prev.events, evt]
        }));
    };

    return (
        <div className="space-y-6 animate-fade-in h-[calc(100vh-140px)] flex flex-col">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Webhooks & API</h2>
                    <p className="text-slate-500">Integre eventos da plataforma com sistemas externos.</p>
                </div>
                <button onClick={handleCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Novo Webhook
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                {/* LIST */}
                <div className="col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-700 text-sm uppercase">Configurados</h3>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {webhooks.length === 0 && <p className="text-center text-slate-400 text-sm mt-10">Nenhum webhook configurado.</p>}
                        {webhooks.map(wh => (
                            <div
                                key={wh.id}
                                onClick={() => setSelectedWebhook(wh)}
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedWebhook?.id === wh.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300 hover:bg-white'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="font-bold text-slate-800">{wh.name}</div>
                                    <div className={`w-2 h-2 rounded-full mt-1.5 ${wh.active ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-1">{wh.url}</div>
                                <div className="mt-3 flex justify-between items-center">
                                    <div className="flex gap-2">
                                        {wh.lastStatus === 'FAILURE' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">Failing</span>}
                                        {wh.lastStatus === 'SUCCESS' && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">Healthy</span>}
                                    </div>
                                    <button onClick={(e) => handleDelete(wh.id, e)} className="text-slate-400 hover:text-red-500 p-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* DETAILS / LOGS */}
                <div className="col-span-8 flex flex-col h-full">
                    {selectedWebhook ? (
                        <>
                            {/* Header Panel */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{selectedWebhook.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{selectedWebhook.url}</code>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(selectedWebhook.url); addToast("URL copiada", "success"); }}
                                                className="text-indigo-600 hover:underline text-xs"
                                            >
                                                Copiar
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handlePing} disabled={isTesting} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                            {isTesting ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                                            Test Ping
                                        </button>
                                        <button onClick={() => handleEdit(selectedWebhook)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Editar</button>
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-wrap gap-2">
                                    {selectedWebhook.events.map(evt => (
                                        <span key={evt} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 font-mono">
                                            {evt}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Logs Table */}
                            <div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-0">
                                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 font-bold text-sm text-slate-700">Histórico de Entregas</div>
                                <div className="overflow-y-auto flex-1">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                        <thead className="bg-white">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Evento</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Time</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Latência</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {logs.length === 0 ? (
                                                <tr><td colSpan={4} className="p-8 text-center text-slate-400">Sem logs recentes.</td></tr>
                                            ) : (
                                                logs.map(log => (
                                                    <tr key={log.id} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${log.statusCode >= 200 && log.statusCode < 300 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {log.statusCode}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-xs">{log.event}</td>
                                                        <td className="px-6 py-4 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-xs">{log.latency}ms</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                            Selecione um webhook para ver detalhes e logs.
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                            <h3 className="font-bold text-slate-800 text-lg">{selectedWebhook ? 'Editar Webhook' : 'Novo Webhook'}</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                                <input type="text" className="w-full border rounded p-2 text-sm bg-slate-50 focus:bg-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Integração ERP" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endpoint URL</label>
                                <input type="url" className="w-full border rounded p-2 text-sm bg-slate-50 focus:bg-white" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="https://api.myerp.com/webhook" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Secret (Assinatura)</label>
                                <input type="password" className="w-full border rounded p-2 text-sm font-mono bg-slate-50 focus:bg-white" value={formData.secret} onChange={e => setFormData({ ...formData, secret: e.target.value })} placeholder="whsec_..." />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Eventos Assinados</label>
                                <div className="space-y-4 max-h-60 overflow-y-auto border border-slate-100 rounded-lg p-2 custom-scrollbar">
                                    {EVENT_DEFINITIONS.map((group, idx) => (
                                        <div key={idx} className="mb-2">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">{group.category}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {group.items.map((evt) => (
                                                    <label
                                                        key={evt.id}
                                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                                                            ${formData.events.includes(evt.id)
                                                                ? 'bg-indigo-50 border-indigo-200'
                                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="rounded text-indigo-600 focus:ring-indigo-500 mt-1"
                                                            checked={formData.events.includes(evt.id)}
                                                            onChange={() => toggleEvent(evt.id)}
                                                        />
                                                        <div>
                                                            <div className={`text-sm font-bold ${formData.events.includes(evt.id) ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                                {evt.label}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                                                {evt.desc}
                                                            </div>
                                                            <div className="text-[9px] font-mono text-slate-400 mt-1">{evt.id}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer mt-4 p-3 bg-slate-50 rounded border border-slate-200">
                                <input type="checkbox" className="rounded text-indigo-600 w-4 h-4" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} />
                                <span className="text-sm font-bold text-slate-700">Webhook Ativo</span>
                            </label>

                            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded">Cancelar</button>
                                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700 shadow-sm">Salvar Webhook</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WebhookModule;
