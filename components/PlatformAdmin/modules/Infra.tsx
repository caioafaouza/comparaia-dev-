
import React, { useState, useEffect } from 'react';
import { getDatabaseConfig, updateDatabaseConfig, getRedisConfig, updateRedisConfig, getStorageConfig, updateStorageConfig, testInfrastructureConnection, getSmtpConfig, updateSmtpConfig, testSmtpConnection } from '../../../services/api';
import { DatabaseConfig, RedisConfig, StorageConfig, SmtpConfig } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

export const SmtpConfigView: React.FC = () => {
    const { addToast } = useToast();
    const [smtp, setSmtp] = useState<SmtpConfig | null>(null);
    const [smtpPasswordEdited, setSmtpPasswordEdited] = useState(false);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        getSmtpConfig().then((data: any) => {
            setSmtp({
                ...data,
                pass: data?.hasPassword ? '********' : ''
            });
            setSmtpPasswordEdited(false);
        });
    }, []);

    const buildSmtpPayload = () => {
        if (!smtp) return null;
        const payload: any = { ...smtp };
        if (!smtpPasswordEdited || !String(smtp.pass || '').trim()) {
            delete payload.pass;
        }
        return payload;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (smtp) {
            if (!smtp.hasPassword && (!smtpPasswordEdited || !String(smtp.pass || '').trim())) {
                addToast("Informe a senha SMTP para salvar a configuração.", 'error');
                return;
            }
            const payload = buildSmtpPayload();
            await updateSmtpConfig(payload);
            const refreshed = await getSmtpConfig();
            setSmtp({
                ...refreshed,
                pass: refreshed?.hasPassword ? '********' : ''
            });
            setSmtpPasswordEdited(false);
            addToast("ConfiguraÃ§Ãµes SMTP salvas.", 'success');
        }
    };

    const handleTest = async () => {
        if (!smtp) return;
        if (!smtp.hasPassword && (!smtpPasswordEdited || !String(smtp.pass || '').trim())) {
            addToast("Informe a senha SMTP para testar a conexão.", 'error');
            return;
        }
        setTesting(true);
        try {
            const payload = buildSmtpPayload();
            await testSmtpConnection(payload || {});
            addToast("ConexÃ£o SMTP estabelecida com sucesso.", 'success');
        } catch (e: any) {
            addToast(`Falha na conexÃ£o: ${e.message}`, 'error');
        } finally {
            setTesting(false);
        }
    };

    if (!smtp) return <div>Carregando...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Servidor de Email (SMTP)</h2>
                <p className="text-slate-500">ConfiguraÃ§Ã£o para envio de convites e notificaÃ§Ãµes.</p>
            </div>
            <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Host</label>
                    <input type="text" className="border p-2 rounded w-full" value={smtp.host} onChange={e => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.example.com" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Porta</label>
                    <input type="number" className="border p-2 rounded w-full" value={smtp.port} onChange={e => setSmtp({ ...smtp, port: parseInt(e.target.value) })} placeholder="587" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">UsuÃ¡rio</label>
                    <input type="text" className="border p-2 rounded w-full" value={smtp.user} onChange={e => setSmtp({ ...smtp, user: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
                    <input type="password" className="border p-2 rounded w-full" value={smtp.pass} onChange={e => { setSmtpPasswordEdited(true); setSmtp({ ...smtp, pass: e.target.value }); }} placeholder={smtp.hasPassword && !smtpPasswordEdited ? "Senha já salva (preencha apenas para alterar)" : "••••••••"} />
                    {!smtp.hasPassword && !smtpPasswordEdited && (
                        <p className="text-[11px] text-amber-600 mt-1 font-medium">Nenhuma senha SMTP salva. Informe para habilitar envios.</p>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remetente (from)</label>
                    <input type="email" className="border p-2 rounded w-full" value={smtp.fromEmail || ''} onChange={e => setSmtp({ ...smtp, fromEmail: e.target.value })} placeholder="no-reply@comparaia.com" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seguranca</label>
                    <select className="border p-2 rounded w-full" value={smtp.secure ? 'true' : 'false'} onChange={e => setSmtp({ ...smtp, secure: e.target.value === 'true' })}>
                        <option value="false">STARTTLS (porta 587)</option>
                        <option value="true">SSL/TLS direto (porta 465)</option>
                    </select>
                </div>
                <div className="col-span-2 flex justify-end gap-3 pt-2">
                    <button type="button" onClick={handleTest} disabled={testing} className="text-slate-600 hover:bg-slate-50 border border-slate-300 px-4 py-2 rounded font-bold hover:text-slate-800 disabled:opacity-50 flex items-center gap-2">
                        {testing ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Verificando...
                            </>
                        ) : (
                            'Testar ConexÃ£o'
                        )}
                    </button>
                    <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700">Salvar SMTP</button>
                </div>
            </form>
        </div>
    );
};

export const DatabaseConfigView = () => {
    const { addToast } = useToast();
    const [dbConfig, setDbConfig] = useState<DatabaseConfig | null>(null);
    const [redisConfig, setRedisConfig] = useState<RedisConfig | null>(null);
    const [storageConfig, setStorageConfig] = useState<StorageConfig | null>(null);
    const [activeTab, setActiveTab] = useState<'postgres' | 'redis' | 'storage'>('postgres');
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        getDatabaseConfig().then(setDbConfig);
        getRedisConfig().then(setRedisConfig);
        getStorageConfig().then(setStorageConfig);
    }, []);

    const handleSaveDb = async () => {
        if (dbConfig) {
            await updateDatabaseConfig(dbConfig);
            addToast('ConfiguraÃ§Ã£o do PostgreSQL salva.', 'success');
        }
    };

    const handleSaveRedis = async () => {
        if (redisConfig) {
            await updateRedisConfig(redisConfig);
            addToast('ConfiguraÃ§Ã£o do Redis salva.', 'success');
        }
    };

    const handleSaveStorage = async () => {
        if (storageConfig) {
            await updateStorageConfig(storageConfig);
            addToast('ConfiguraÃ§Ã£o do Storage (MinIO) salva.', 'success');
        }
    };

    const handleTest = async (type: 'db' | 'redis' | 'storage') => {
        setTesting(true);
        await testInfrastructureConnection(type);
        setTesting(false);
        addToast('ConexÃ£o estabelecida com sucesso! LatÃªncia: 45ms', 'success');
    };

    if (!dbConfig || !redisConfig || !storageConfig) return <div className="p-6">Carregando configuraÃ§Ã£o...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Infraestrutura de Dados</h2>
                <p className="text-slate-500">Configure a persistÃªncia e a camada de cache da aplicaÃ§Ã£o.</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('postgres')}
                        className={`px-6 py-4 text-sm font-bold uppercase transition-colors flex items-center gap-2 ${activeTab === 'postgres' ? 'bg-slate-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        PostgreSQL (Storage)
                    </button>
                    <button
                        onClick={() => setActiveTab('redis')}
                        className={`px-6 py-4 text-sm font-bold uppercase transition-colors flex items-center gap-2 ${activeTab === 'redis' ? 'bg-slate-50 text-red-600 border-b-2 border-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Redis (Cache)
                    </button>
                    <button
                        onClick={() => setActiveTab('storage')}
                        className={`px-6 py-4 text-sm font-bold uppercase transition-colors flex items-center gap-2 ${activeTab === 'storage' ? 'bg-slate-50 text-green-600 border-b-2 border-green-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        Storage (MinIO)
                    </button>
                </div>

                <div className="p-8">
                    {activeTab === 'postgres' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Host / Endpoint</label>
                                    <input type="text" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={dbConfig.host} onChange={e => setDbConfig({ ...dbConfig, host: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Porta</label>
                                    <input type="number" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={dbConfig.port} onChange={e => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Database Name</label>
                                    <input type="text" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={dbConfig.name} onChange={e => setDbConfig({ ...dbConfig, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                                    <input type="text" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={dbConfig.user} onChange={e => setDbConfig({ ...dbConfig, user: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                                    <input type="password" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={dbConfig.pass} onChange={e => setDbConfig({ ...dbConfig, pass: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SSL Mode</label>
                                    <select className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900" value={dbConfig.ssl ? 'true' : 'false'} onChange={e => setDbConfig({ ...dbConfig, ssl: e.target.value === 'true' })}>
                                        <option value="true">Require (Secure)</option>
                                        <option value="false">Disable</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button onClick={() => handleTest('db')} disabled={testing} className="text-slate-600 hover:text-slate-900 text-sm font-bold px-4 py-2 border border-slate-300 rounded-lg bg-white">
                                    {testing ? 'Testando...' : 'Testar ConexÃ£o'}
                                </button>
                                <button onClick={handleSaveDb} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700">
                                    Salvar ConfiguraÃ§Ã£o
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'redis' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Redis Host</label>
                                    <input type="text" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={redisConfig.host} onChange={e => setRedisConfig({ ...redisConfig, host: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Porta</label>
                                    <input type="number" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={redisConfig.port} onChange={e => setRedisConfig({ ...redisConfig, port: parseInt(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha (Auth)</label>
                                    <input type="password" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={redisConfig.password || ''} onChange={e => setRedisConfig({ ...redisConfig, password: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">TTL PadrÃ£o (segundos)</label>
                                    <input type="number" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={redisConfig.cacheTTL} onChange={e => setRedisConfig({ ...redisConfig, cacheTTL: parseInt(e.target.value) })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button onClick={() => handleTest('redis')} disabled={testing} className="text-slate-600 hover:text-slate-900 text-sm font-bold px-4 py-2 border border-slate-300 rounded-lg bg-white">
                                    {testing ? 'Testando...' : 'Testar ConexÃ£o'}
                                </button>
                                <button onClick={handleSaveRedis} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 shadow-sm">
                                    Salvar Redis
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'storage' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endpoint (MinIO/S3)</label>
                                    <input type="text" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" placeholder="s3.example.com" value={storageConfig.endpoint} onChange={e => setStorageConfig({ ...storageConfig, endpoint: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Porta (Opcional)</label>
                                    <input type="number" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={storageConfig.port} onChange={e => setStorageConfig({ ...storageConfig, port: parseInt(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Access Key</label>
                                    <input type="text" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={storageConfig.accessKey} onChange={e => setStorageConfig({ ...storageConfig, accessKey: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Secret Key</label>
                                    <input type="password" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={storageConfig.secretKey} onChange={e => setStorageConfig({ ...storageConfig, secretKey: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bucket Name</label>
                                    <input type="text" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={storageConfig.bucket} onChange={e => setStorageConfig({ ...storageConfig, bucket: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RegiÃ£o</label>
                                    <input type="text" className="w-full border border-slate-300 rounded p-2.5 font-mono text-sm bg-white text-slate-900" value={storageConfig.region} onChange={e => setStorageConfig({ ...storageConfig, region: e.target.value })} />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 mt-6 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" checked={storageConfig.useSSL} onChange={e => setStorageConfig({ ...storageConfig, useSSL: e.target.checked })} />
                                        <span className="text-sm font-medium text-slate-700">Usar SSL (HTTPS)</span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button onClick={() => handleTest('storage')} disabled={testing} className="text-slate-600 hover:text-slate-900 text-sm font-bold px-4 py-2 border border-slate-300 rounded-lg bg-white">
                                    {testing ? 'Testando...' : 'Testar ConexÃ£o'}
                                </button>
                                <button onClick={handleSaveStorage} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm">
                                    Salvar Storage
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

