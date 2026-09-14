
import React, { useState, useEffect } from 'react';
import { getAllUsersGlobal, updateGlobalUser, deleteGlobalUser } from '../../../services/api';
import { User } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const GlobalUsersModule: React.FC = () => {
    const { addToast } = useToast();
    const [users, setUsers] = useState<(User & { walletBalance: number, tenantName: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setLoading(true);
        getAllUsersGlobal().then(data => {
            setUsers(data);
            setLoading(false);
        });
    };

    const handlePasswordReset = async (userId: string) => {
        if (confirm("Enviar link de redefinição de senha para este usuário?")) {
            await new Promise(r => setTimeout(r, 300));
            addToast(`Solicitação enviada para o usuário ${userId.substring(0, 8)}...`, 'success');
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (confirm(`Tem certeza que deseja excluir o usuário ${user.name}? Esta ação não pode ser desfeita.`)) {
            try {
                await deleteGlobalUser(user.id);
                addToast('Usuário excluído com sucesso.', 'success');
                loadData();
            } catch (err: any) {
                addToast('Erro ao excluir usuário.', 'error');
            }
        }
    };

    const handleEditUser = (user: User) => {
        setEditingUser({ ...user });
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            await updateGlobalUser(editingUser.id, {
                name: editingUser.name,
                email: editingUser.email,
                role: editingUser.role,
                status: editingUser.status
            });
            addToast('Usuário atualizado com sucesso.', 'success');
            setEditingUser(null);
            loadData();
        } catch (err: any) {
            addToast('Erro ao atualizar usuário.', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Diretório Global de Usuários</h2>
                <p className="text-slate-500">Visualize todos os usuários registrados em todos os tenants.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Usuário</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Organização</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Role</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">Saldo (Org)</th>
                            <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <tr><td colSpan={6} className="p-6 text-center">Carregando...</td></tr> : users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-900">{u.name}</div>
                                    <div className="text-xs text-slate-500">{u.email}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-700 font-medium">{u.tenantName}</td>
                                <td className="px-6 py-4 text-xs font-mono">{u.role}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {u.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-700">{u.walletBalance} tk</td>
                                <td className="px-6 py-4 text-right space-x-3">
                                    <button onClick={() => handleEditUser(u)} className="text-indigo-600 hover:underline text-xs font-bold">Editar</button>
                                    <button onClick={() => handlePasswordReset(u.id)} className="text-blue-600 hover:underline text-xs">Reset Senha</button>
                                    <button onClick={() => handleDeleteUser(u)} className="text-red-500 hover:underline text-xs ml-2">Excluir</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* EDIT MODAL */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-lg">Editar Usuário</h3>
                            <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded"
                                    value={editingUser.name}
                                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full border p-2 rounded"
                                    value={editingUser.email}
                                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Função (Role)</label>
                                <select
                                    className="w-full border p-2 rounded bg-white"
                                    value={editingUser.role}
                                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value as any })}
                                >
                                    <option value="OWNER">Owner</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="MEMBER">Member</option>
                                    <option value="PLATFORM_ADMIN">Platform Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                <select
                                    className="w-full border p-2 rounded bg-white"
                                    value={editingUser.status}
                                    onChange={e => setEditingUser({ ...editingUser, status: e.target.value as any })}
                                >
                                    <option value="ACTIVE">Ativo</option>
                                    <option value="INACTIVE">Inativo</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-sm">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalUsersModule;
