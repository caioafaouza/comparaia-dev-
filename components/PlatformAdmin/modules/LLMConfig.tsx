
import React, { useState, useEffect } from 'react';
import { getGlobalConfig, getOpenAIModels, updateGlobalConfig, testAIProviderConnection } from '../../../services/api';
import { GlobalSystemConfig } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const LLMConfigModule: React.FC = () => {
    const { addToast } = useToast();
    const [config, setConfig] = useState<GlobalSystemConfig | null>(null);
    const [showKeys, setShowKeys] = useState(false);
    const [openaiModels, setOpenaiModels] = useState<string[]>([]);
    const [openaiModelsError, setOpenaiModelsError] = useState<string | null>(null);
    const [testLoading, setTestLoading] = useState(false);

    useEffect(() => {
        getGlobalConfig().then(setConfig);
    }, []);

    useEffect(() => {
        let isActive = true;
        const loadModels = async () => {
            if (!config?.openaiKey || config.openaiKey.length <= 5) {
                setOpenaiModels([]);
                setOpenaiModelsError(null);
                return;
            }
            try {
                const result = await getOpenAIModels();
                if (!isActive) return;
                const models = Array.isArray(result?.models) ? result.models : [];
                setOpenaiModels(models);
                setOpenaiModelsError(null);
            } catch (err: any) {
                if (!isActive) return;
                setOpenaiModels([]);
                setOpenaiModelsError(err?.message || 'Falha ao carregar modelos.');
            }
        };
        loadModels();
        return () => {
            isActive = false;
        };
    }, [config?.openaiKey]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (config) {
            await updateGlobalConfig(config);
            addToast("Configurações de IA salvas com sucesso.", 'success');
        }
    };

    const handleTest = async () => {
        setTestLoading(true);
        try {
            const res = await testAIProviderConnection();
            if (res.success) {
                addToast(`Conexão OK! ${res.provider} (${res.latency}ms)`, 'success');
            } else {
                addToast(`Erro: ${res.error}`, 'error');
            }
        } catch (e: any) {
            addToast(`Falha no teste: ${e.message}`, 'error');
        } finally {
            setTestLoading(false);
        }
    };

    if (!config) return <div>Carregando...</div>;

    const hasGeminiKey = config.geminiKey && config.geminiKey.length > 5;
    const hasOpenAIKey = config.openaiKey && config.openaiKey.length > 5;
    const fallbackOpenAIModels = [
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4.1',
        'gpt-4.1-mini',
        'o1',
        'o3',
        'o4'
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Configuração de LLM (IA)</h2>
                <p className="text-slate-500">Gerencie as chaves de API e modelos de Inteligência Artificial da plataforma.</p>
            </div>

            <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">

                {/* Active Provider Card */}
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-start gap-3">
                    <svg className="w-6 h-6 text-indigo-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <div className="flex-1">
                        <h4 className="font-bold text-indigo-900 text-sm">Provedor Ativo</h4>
                        <p className="text-xs text-indigo-700 mt-1 mb-2">O sistema utilizará o provedor selecionado abaixo para todas as operações de análise de datasheets e chat.</p>

                        <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">PROVEDOR PADRÃO</label>
                        <select
                            className="w-full border border-indigo-300 p-2.5 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 text-sm"
                            value={config.activeAIProvider}
                            onChange={e => setConfig({ ...config, activeAIProvider: e.target.value })}
                        >
                            <option value="Google Gemini">Google Gemini (Recomendado)</option>
                            <option value="OpenAI GPT-4">OpenAI GPT-4o</option>
                            <option value="Anthropic Claude">Anthropic Claude 3.5 Sonnet</option>
                        </select>
                    </div>
                </div>

                <div className="border-2 border-dashed border-indigo-200 p-6 rounded-xl relative">
                    <div className="absolute -top-3 left-4 bg-white px-2 text-indigo-600 font-bold text-sm">
                        Credenciais de API
                    </div>

                    <div className="flex justify-end mb-4">
                        <button
                            type="button"
                            onClick={() => setShowKeys(!showKeys)}
                            className="text-xs text-indigo-600 font-bold hover:underline"
                        >
                            {showKeys ? 'Ocultar Chaves' : 'Mostrar Chaves'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Gemini Config */}
                        <div className={`p-4 rounded-lg border transition-all ${config.activeAIProvider === 'Google Gemini' ? 'bg-white border-indigo-500 ring-4 ring-indigo-50 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="font-bold text-slate-700">Google Gemini</span>
                            </div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API KEY</label>
                            <input
                                type={showKeys ? "text" : "password"}
                                className="w-full border p-2 rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                                placeholder="AIzaSy..."
                                value={config.geminiKey || ''}
                                onChange={e => setConfig({ ...config, geminiKey: e.target.value })}
                            />

                            {/* Model Selection - Shows only if Key is present */}
                            {hasGeminiKey ? (
                                <div className="mt-3 pt-3 border-t border-slate-100 animate-fade-in">
                                    <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Modelo Disponível</label>
                                    <select
                                        className="w-full border border-indigo-200 bg-indigo-50/50 p-2 rounded text-xs font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
                                        value={config.geminiModel || 'gemini-2.5-flash'}
                                        onChange={e => setConfig({ ...config, geminiModel: e.target.value })}
                                    >
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Rápido & Econômico)</option>
                                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (Melhor Raciocínio)</option>
                                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
                                    </select>
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 mt-2 italic">Adicione a chave para selecionar o modelo.</p>
                            )}
                        </div>

                        {/* OpenAI Config */}
                        <div className={`p-4 rounded-lg border transition-all ${config.activeAIProvider.includes('OpenAI') ? 'bg-white border-indigo-500 ring-4 ring-indigo-50 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                <span className="font-bold text-slate-700">OpenAI</span>
                            </div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API KEY</label>
                            <input
                                type={showKeys ? "text" : "password"}
                                className="w-full border p-2 rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                                placeholder="sk-..."
                                value={config.openaiKey || ''}
                                onChange={e => setConfig({ ...config, openaiKey: e.target.value })}
                            />
                            <div className="mt-3 grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">OPENAI ORG (opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                                        placeholder="org_..."
                                        value={config.openaiOrg || ''}
                                        onChange={e => setConfig({ ...config, openaiOrg: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">OPENAI PROJECT (opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                                        placeholder="proj_..."
                                        value={config.openaiProject || ''}
                                        onChange={e => setConfig({ ...config, openaiProject: e.target.value })}
                                    />
                                </div>
                            </div>

                            {hasOpenAIKey ? (
                                <div className="mt-3 pt-3 border-t border-slate-100 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Modelo Disponível</label>
                                        <button
                                            type="button"
                                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                                            onClick={() => {
                                                setOpenaiModelsError(null);
                                                setOpenaiModels([]);
                                                getOpenAIModels()
                                                    .then((result) => {
                                                        const models = Array.isArray(result?.models) ? result.models : [];
                                                        setOpenaiModels(models);
                                                    })
                                                    .catch((err: any) => setOpenaiModelsError(err?.message || 'Falha ao carregar modelos.'));
                                            }}
                                        >
                                            Recarregar
                                        </button>
                                    </div>
                                    <select
                                        className="w-full border border-indigo-200 bg-indigo-50/50 p-2 rounded text-xs font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
                                        value={config.openaiModel || 'gpt-4o'}
                                        onChange={e => setConfig({ ...config, openaiModel: e.target.value })}
                                    >
                                        {(openaiModels.length ? openaiModels : fallbackOpenAIModels).map((model) => (
                                            <option key={model} value={model}>{model}</option>
                                        ))}
                                    </select>
                                    {openaiModelsError && (
                                        <p className="text-[10px] text-amber-600 mt-2">{openaiModelsError}. Usando lista padrão.</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 mt-2 italic">Adicione a chave para selecionar o modelo.</p>
                            )}
                        </div>
                    </div>

                    {/* Stability/Other Config */}
                    <div className="mt-6 p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                        <h4 className="font-bold text-slate-700 mb-3 text-sm">Outros Serviços</h4>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">STABILITY AI KEY (GERAÇÃO DE IMAGEM)</label>
                            <input
                                type={showKeys ? "text" : "password"}
                                className="w-full border p-2 rounded text-sm font-mono bg-white"
                                value={config.stabilityKey || ''}
                                onChange={e => setConfig({ ...config, stabilityKey: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Custom System Prompt Injection */}
                <div className="p-6 rounded-xl border border-slate-200 bg-slate-50">
                    <h3 className="text-sm font-bold text-slate-900 mb-2">Prompt Customizado do Sistema (System Prompt Injection)</h3>
                    <p className="text-xs text-slate-500 mb-4">
                        Este texto será anexado às instruções padrão da IA (System Instruction) para todas as análises.
                        Use para definir regras de compliance, tom de voz específico ou diretrizes corporativas obrigatórias.
                    </p>
                    <textarea
                        className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="Ex: Priorize sempre fornecedores com ISO 9001. Se houver dúvida, marque como 'Requer Validação'."
                        value={config.customSystemPrompt || ''}
                        onChange={e => setConfig({ ...config, customSystemPrompt: e.target.value })}
                    ></textarea>
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testLoading}
                        className="bg-slate-100 text-slate-700 px-4 py-2 rounded font-bold hover:bg-slate-200 border border-slate-200 flex items-center gap-2"
                    >
                        {testLoading ? (
                            <svg className="animate-spin h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        )}
                        Testar Conexão
                    </button>
                    <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700 shadow-md flex items-center gap-2 transform hover:-translate-y-0.5 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        Salvar Credenciais
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LLMConfigModule;
