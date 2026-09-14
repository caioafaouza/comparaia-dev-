
import React, { useState, useEffect, useRef } from 'react';
import { getGlobalConfig, updateGlobalConfig } from '../../../services/api';
import { GlobalSystemConfig } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const GlobalSettingsModule: React.FC = () => {
    const { addToast } = useToast();
    const [config, setConfig] = useState<GlobalSystemConfig | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getGlobalConfig().then(setConfig);
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (config) {
            await updateGlobalConfig(config);
            addToast("Configurações globais salvas.", 'success');
            // Apply theme (simulation)
            if (config.branding) {
                document.documentElement.style.setProperty('--primary-color', config.branding.primaryColor || '#4f46e5');
                document.documentElement.style.setProperty('--secondary-color', config.branding.secondaryColor || '#10b981');
            }
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB Limit
                addToast("O arquivo é muito grande (Máx 2MB).", 'error');
                return;
            }
            if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
                addToast("Formato inválido. Use PNG, JPG ou SVG.", 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result && config) {
                    setConfig({
                        ...config,
                        branding: {
                            ...config.branding,
                            logoUrl: event.target.result as string
                        }
                    });
                    addToast("Logo carregado com sucesso.", 'success');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    if (!config) return <div>Carregando...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Configurações da Plataforma</h2>
                <p className="text-slate-500">Parâmetros globais que afetam todos os tenants.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">

                {/* Branding */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase border-b pb-2 mb-4">Personalização Visual (Branding)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Logo Upload Section */}
                        <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center bg-indigo-50/30 hover:bg-indigo-50 transition-colors group cursor-pointer" onClick={triggerFileUpload}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/png, image/jpeg, image/svg+xml, image/webp"
                                onChange={handleLogoUpload}
                            />

                            {config.branding?.logoUrl ? (
                                <div className="relative w-full h-32 flex items-center justify-center mb-2">
                                    <img src={config.branding.logoUrl} alt="Global Logo" className="max-h-full max-w-full object-contain" />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                        <span className="text-white text-sm font-bold">Alterar Imagem</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                            )}

                            <p className="text-sm font-bold text-indigo-900">
                                {config.branding?.logoUrl ? 'Clique para substituir' : 'Clique para fazer upload do logo'}
                            </p>
                            <p className="text-xs text-indigo-600 mt-1">PNG, JPG, SVG (Máx 2MB)</p>
                        </div>

                        {/* Colors Configuration */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cor Primária</label>
                                <div className="flex gap-3 items-center p-2 border border-slate-200 rounded-lg bg-slate-50">
                                    <input
                                        type="color"
                                        className="h-10 w-12 rounded cursor-pointer border-0 bg-transparent p-0"
                                        value={config.branding?.primaryColor || '#4f46e5'}
                                        onChange={e => setConfig({ ...config, branding: { ...config.branding, primaryColor: e.target.value } })}
                                    />
                                    <input
                                        type="text"
                                        className="border-none bg-transparent text-sm font-mono font-bold text-slate-700 focus:ring-0 uppercase w-full"
                                        value={config.branding?.primaryColor || ''}
                                        onChange={e => setConfig({ ...config, branding: { ...config.branding, primaryColor: e.target.value } })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cor Secundária</label>
                                <div className="flex gap-3 items-center p-2 border border-slate-200 rounded-lg bg-slate-50">
                                    <input
                                        type="color"
                                        className="h-10 w-12 rounded cursor-pointer border-0 bg-transparent p-0"
                                        value={config.branding?.secondaryColor || '#10b981'}
                                        onChange={e => setConfig({ ...config, branding: { ...config.branding, secondaryColor: e.target.value } })}
                                    />
                                    <input
                                        type="text"
                                        className="border-none bg-transparent text-sm font-mono font-bold text-slate-700 focus:ring-0 uppercase w-full"
                                        value={config.branding?.secondaryColor || ''}
                                        onChange={e => setConfig({ ...config, branding: { ...config.branding, secondaryColor: e.target.value } })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* General Params */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase border-b pb-2 mb-4">Parâmetros Gerais</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Aplicação</label>
                            <input type="text" className="border p-2 rounded w-full" value={config.appName} onChange={e => setConfig({ ...config, appName: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email de Suporte</label>
                            <input type="email" className="border p-2 rounded w-full" value={config.supportEmail} onChange={e => setConfig({ ...config, supportEmail: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* Economics */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase border-b pb-2 mb-4">Economia de Tokens</h3>
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tokens de Boas-vindas</label>
                            <input type="number" className="border p-2 rounded w-full" value={config.welcomeTokens} onChange={e => setConfig({ ...config, welcomeTokens: parseInt(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Base (por Job)</label>
                            <input type="number" className="border p-2 rounded w-full" value={config.baseCostPerJob} onChange={e => setConfig({ ...config, baseCostPerJob: parseInt(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Variável (por Arquivo)</label>
                            <input type="number" className="border p-2 rounded w-full" value={config.costPerCandidate} onChange={e => setConfig({ ...config, costPerCandidate: parseInt(e.target.value) })} />
                        </div>
                    </div>
                </div>

                {/* Operation Control */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase border-b pb-2 mb-4">Controles Operacionais</h3>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between border p-3 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <div>
                                <div className="font-bold text-slate-700 text-sm">Habilitar Cadastro Público</div>
                                <div className="text-xs text-slate-500">Permitir que novos usuários criem contas sem convite.</div>
                            </div>
                            <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded" checked={config.enablePublicSignup} onChange={e => setConfig({ ...config, enablePublicSignup: e.target.checked })} />
                        </label>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mensagem de Manutenção</label>
                            <input type="text" className="border p-2 rounded w-full" value={config.maintenanceMessage} onChange={e => setConfig({ ...config, maintenanceMessage: e.target.value })} placeholder="Mensagem exibida quando o sistema estiver offline" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tamanho Máx. Upload (Global)</label>
                                <div className="flex items-center">
                                    <input type="number" className="border p-2 rounded-l w-full" value={config.maxFileSizeGlobal} onChange={e => setConfig({ ...config, maxFileSizeGlobal: parseInt(e.target.value) })} />
                                    <span className="bg-slate-100 border border-l-0 px-3 py-2 rounded-r text-slate-600 text-sm font-bold">MB</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Período de Retenção de Jobs</label>
                                <div className="flex items-center">
                                    <input type="number" className="border p-2 rounded-l w-full" value={config.jobRetentionDays || 90} onChange={e => setConfig({ ...config, jobRetentionDays: parseInt(e.target.value) })} />
                                    <span className="bg-slate-100 border border-l-0 px-3 py-2 rounded-r text-slate-600 text-sm font-bold">Dias</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Jobs antigos serão arquivados após este período.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipos de Arquivo Permitidos</label>
                                <input type="text" className="border p-2 rounded w-full bg-slate-50" value={(config.allowedFileTypes ?? []).join(', ')} disabled readOnly />
                                <span className="text-[10px] text-slate-400">Atualmente fixo em PDF.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                    <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700 shadow-md">Salvar Todas as Alterações</button>
                </div>
            </form>
        </div>
    );
};

export default GlobalSettingsModule;
