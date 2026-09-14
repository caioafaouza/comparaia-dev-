
import React, { useState, useEffect } from 'react';
import { getApiGatewayConfig, updateApiGatewayConfig, getSystemApiKeys, createSystemApiKey, revokeSystemApiKey, getApiSpec } from '../../../services/api';
import { ApiGatewayConfig, SystemApiKey } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const ApiGatewayModule: React.FC = () => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'settings' | 'keys' | 'docs'>('settings');
    const [config, setConfig] = useState<ApiGatewayConfig | null>(null);
    const [keys, setKeys] = useState<SystemApiKey[]>([]);

    // Create Key State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newKeyData, setNewKeyData] = useState({ name: '', role: 'READ_ONLY' as 'READ_ONLY' | 'FULL_ACCESS' });
    const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        getApiGatewayConfig().then(setConfig);
        getSystemApiKeys().then(setKeys);
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (config) {
            await updateApiGatewayConfig(config);
            addToast("Configuração do Gateway salva.", 'success');
        }
    };

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await createSystemApiKey(newKeyData.name, newKeyData.role);
            setCreatedKeySecret(result.rawKey);
            setNewKeyData({ name: '', role: 'READ_ONLY' });
            loadData();
            addToast("Chave de API criada.", 'success');
        } catch (e: any) {
            addToast("Erro ao criar chave.", 'error');
        }
    };

    const handleRevokeKey = async (id: string) => {
        if (confirm("Tem certeza que deseja revogar esta chave? Sistemas integrados irão parar de funcionar.")) {
            await revokeSystemApiKey(id);
            addToast("Chave revogada.", 'success');
            loadData();
        }
    };

    const handleDownloadJson = async () => {
        const fallbackSpec = {
            openapi: "3.0.0",
            info: {
                title: "COMPARA IA Platform API",
                version: "v1",
                description: "Programmatic access to technical analysis engine."
            },
            paths: {
                "/api/v1/tenants": {
                    get: { summary: "List tenants" }
                }
            }
        };
        const spec = await getApiSpec();
        const payload = spec || fallbackSpec;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "comparaia_openapi.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addToast("Especificação OpenAPI baixada com sucesso.", "success");
    };

    const handleOpenSwagger = () => {
        // Points to the public Swagger Editor for demo purposes
        window.open("https://editor.swagger.io/?url=https://petstore.swagger.io/v2/swagger.json", "_blank");
        addToast("Swagger UI aberto em nova aba.", "info");
    };

    if (!config) return <div>Carregando...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">API Gateway & REST Config</h2>
                    <p className="text-slate-500">Controle de tráfego, segurança e credenciais de sistema.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Configurações</button>
                    <button onClick={() => setActiveTab('keys')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'keys' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Chaves de Sistema</button>
                    <button onClick={() => setActiveTab('docs')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'docs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Docs</button>
                </div>
            </div>

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
                <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="font-bold text-slate-800">Status Global da API</h3>
                            <p className="text-xs text-slate-500">Controle mestre para habilitar/desabilitar acesso externo.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            <span className="ml-3 text-sm font-medium text-slate-700">{config.enabled ? 'Ativo' : 'Inativo'}</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Versão da API</label>
                            <input type="text" className="w-full border p-2 rounded bg-slate-50 text-slate-600 cursor-not-allowed" value={config.apiVersion} disabled />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rate Limit Global (RPM)</label>
                            <input type="number" className="w-full border p-2 rounded" value={config.globalRateLimit} onChange={e => setConfig({ ...config, globalRateLimit: parseInt(e.target.value) })} />
                            <p className="text-[10px] text-slate-400 mt-1">Requisições por minuto por IP.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Timeout (ms)</label>
                            <input type="number" className="w-full border p-2 rounded" value={config.timeoutMs} onChange={e => setConfig({ ...config, timeoutMs: parseInt(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Logging Verboso</label>
                            <div className="flex items-center gap-2 mt-2">
                                <input type="checkbox" className="rounded text-indigo-600" checked={config.enableLogging} onChange={e => setConfig({ ...config, enableLogging: e.target.checked })} />
                                <span className="text-sm text-slate-700">Registrar payload de requests</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CORS Origins (Whitelist)</label>
                        <textarea
                            className="w-full border p-3 rounded font-mono text-sm h-24"
                            value={config.corsOrigins.join('\n')}
                            onChange={e => setConfig({ ...config, corsOrigins: e.target.value.split('\n') })}
                            placeholder="https://app.example.com"
                        ></textarea>
                        <p className="text-[10px] text-slate-400 mt-1">Um domínio por linha. Use '*' para permitir tudo (não recomendado).</p>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700 shadow-md">Salvar Configurações</button>
                    </div>
                </form>
            )}

            {/* TAB: SYSTEM KEYS */}
            {activeTab === 'keys' && (
                <div className="space-y-6">
                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg flex items-start gap-3">
                        <svg className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                        <div>
                            <h4 className="text-sm font-bold text-indigo-900">Chaves de Sistema (Root Access)</h4>
                            <p className="text-xs text-indigo-700 mt-1">Estas chaves possuem privilégios administrativos globais e não estão vinculadas a um tenant específico. Use-as com cuidado para integrações de CI/CD ou ferramentas de gestão externas.</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-700 text-sm">Chaves Ativas</h3>
                            <button onClick={() => setIsCreateOpen(true)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 font-bold">+ Nova Chave</button>
                        </div>
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Nome</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Prefixo</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Criado em</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {keys.map(k => (
                                    <tr key={k.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-800">{k.name}</td>
                                        <td className="px-6 py-4 font-mono text-slate-500 text-xs">{k.keyPrefix}</td>
                                        <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{k.role}</span></td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleRevokeKey(k.id)} className="text-red-600 hover:text-red-800 hover:underline text-xs font-bold">Revogar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: DOCS */}
            {activeTab === 'docs' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Referência da API</h3>
                                <p className="text-slate-500 text-sm mt-1">Documentação técnica para integração via REST.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDownloadJson}
                                    className="px-4 py-2 text-sm font-bold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    OpenAPI JSON
                                </button>
                                <button
                                    onClick={handleOpenSwagger}
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                    Swagger UI
                                </button>
                            </div>
                        </div>

                        {/* Authentication Info Block */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-8">
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Autenticação
                            </h4>
                            <p className="text-xs text-indigo-700 leading-relaxed">
                                Todas as requisições devem incluir o header <code>Authorization: Bearer YOUR_API_KEY</code>.
                                As chaves podem ser geradas na aba "Chaves de Sistema" e possuem escopos específicos (Leitura ou Acesso Total).
                            </p>
                        </div>

                        {/* Interactive Example Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Left Column: Endpoints & Description */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Endpoint Principal</label>
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm group cursor-pointer hover:border-indigo-300 transition-colors">
                                        <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">GET</span>
                                        <span className="text-slate-700">/api/v1/tenants</span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        Retorna a lista de todas as organizações (tenants) registradas na plataforma. Suporta paginação e filtros via query parameters.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Headers Obrigatórios</label>
                                    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                                                <tr>
                                                    <th className="px-4 py-2">Header</th>
                                                    <th className="px-4 py-2">Valor</th>
                                                    <th className="px-4 py-2">Descrição</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                <tr>
                                                    <td className="px-4 py-2 font-mono text-indigo-600">Authorization</td>
                                                    <td className="px-4 py-2 font-mono">Bearer &lt;token&gt;</td>
                                                    <td className="px-4 py-2 text-slate-500">Chave de API do Sistema</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 font-mono text-indigo-600">Content-Type</td>
                                                    <td className="px-4 py-2 font-mono">application/json</td>
                                                    <td className="px-4 py-2 text-slate-500">Formato de envio/resposta</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Code Snippets */}
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Exemplo de Requisição (cURL)</label>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`curl -X GET "https://api.comparaia.com/v1/tenants" \\\n-H "Authorization: Bearer sk_live_..." \\\n-H "Content-Type: application/json"`);
                                                addToast("cURL copiado!", 'success');
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            Copiar
                                        </button>
                                    </div>
                                    <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto relative group">
                                        <pre>
                                            {`curl -X GET "https://api.comparaia.com/v1/tenants" \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json"`}
                                        </pre>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Exemplo de Resposta (200 OK)</label>
                                    <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 overflow-x-auto max-h-64 custom-scrollbar">
                                        <pre>
                                            {`{
  "data": [
    {
      "id": "tenant_123",
      "name": "TechCorp Solutions",
      "status": "ACTIVE",
      "plan": "ENTERPRISE",
      "createdAt": "2023-10-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}`}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Additional Endpoints Summary */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                        <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase">Catálogo de Endpoints Disponíveis</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold w-16 text-center">POST</span>
                                    <span className="font-mono text-sm text-slate-700">/v1/tenants</span>
                                </div>
                                <span className="text-xs text-slate-400">Criar nova organização</span>
                            </div>
                            <div className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold w-16 text-center">GET</span>
                                    <span className="font-mono text-sm text-slate-700">/v1/metrics</span>
                                </div>
                                <span className="text-xs text-slate-400">Métricas globais</span>
                            </div>
                            <div className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold w-16 text-center">POST</span>
                                    <span className="font-mono text-sm text-slate-700">/v1/jobs</span>
                                </div>
                                <span className="text-xs text-slate-400">Submeter análise via API</span>
                            </div>
                            <div className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold w-16 text-center">DELETE</span>
                                    <span className="font-mono text-sm text-slate-700">/v1/users/{'{id}'}</span>
                                </div>
                                <span className="text-xs text-slate-400">Remover usuário</span>
                            </div>
                            <div className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold w-16 text-center">GET</span>
                                    <span className="font-mono text-sm text-slate-700">/v1/leads</span>
                                </div>
                                <span className="text-xs text-slate-400">Listar leads (CRM)</span>
                            </div>
                            <div className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold w-16 text-center">GET</span>
                                    <span className="font-mono text-sm text-slate-700">/v1/audit</span>
                                </div>
                                <span className="text-xs text-slate-400">Logs de auditoria</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE KEY MODAL */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-lg">Nova Chave de Sistema</h3>
                            {!createdKeySecret && <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>}
                        </div>

                        {!createdKeySecret ? (
                            <form onSubmit={handleCreateKey} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Aplicação</label>
                                    <input type="text" className="w-full border rounded p-2 text-sm" value={newKeyData.name} onChange={e => setNewKeyData({ ...newKeyData, name: e.target.value })} placeholder="Ex: GitHub Actions CI" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Permissão</label>
                                    <select className="w-full border rounded p-2 text-sm bg-white" value={newKeyData.role} onChange={e => setNewKeyData({ ...newKeyData, role: e.target.value as any })}>
                                        <option value="READ_ONLY">Read Only (Leitura)</option>
                                        <option value="FULL_ACCESS">Full Access (Admin)</option>
                                    </select>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded mr-2">Cancelar</button>
                                    <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded font-bold hover:bg-emerald-700">Gerar Chave</button>
                                </div>
                            </form>
                        ) : (
                            <div className="p-6 text-center space-y-4">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h4 className="text-lg font-bold text-slate-800">Chave Gerada com Sucesso!</h4>
                                <p className="text-sm text-slate-500">Copie a chave abaixo. Ela não será exibida novamente.</p>

                                <div className="bg-slate-100 border border-slate-200 p-3 rounded font-mono text-sm break-all text-slate-800 select-all relative group">
                                    {createdKeySecret}
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(createdKeySecret); addToast("Copiado!", 'success'); }}
                                        className="absolute right-2 top-2 bg-white border border-slate-300 rounded p-1 text-slate-500 hover:text-indigo-600 shadow-sm"
                                        title="Copiar"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </button>
                                </div>

                                <button
                                    onClick={() => { setCreatedKeySecret(null); setIsCreateOpen(false); }}
                                    className="w-full bg-slate-900 text-white py-2 rounded font-bold hover:bg-slate-800"
                                >
                                    Entendido, fechar janela
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiGatewayModule;
