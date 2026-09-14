
import React, { useState, useEffect } from 'react';
import { User, UserRole, PlanDefinition } from '../types';
import { getTenantUsers, createTenantUser, updateUser, deleteTenantUser, getTenantDetailsDeep, getPlans } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface TeamViewProps {
    tenantId: string;
    currentUser: User;
}

const TeamView: React.FC<TeamViewProps> = ({ tenantId, currentUser }) => {
    const { addToast } = useToast();
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [currentPlan, setCurrentPlan] = useState<PlanDefinition | null>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'MEMBER' as UserRole,
        status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, tenantDetailsResponse, allPlans] = await Promise.all([
                getTenantUsers(tenantId),
                getTenantDetailsDeep(tenantId),
                getPlans()
            ]);
            setUsers(usersData);

            // Assuming getTenantDetailsDeep returns { tenant: TenantObject }
            if (tenantDetailsResponse) {
                const plan = allPlans.find(p => p.id === tenantDetailsResponse.plan);
                if (plan) setCurrentPlan(plan);
            }
        } catch (err) {
            addToast(t('common.loading'), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [tenantId]);

    const handleOpenCreate = () => {
        if (currentPlan && users.length >= currentPlan.limits.maxUsers) {
            addToast(`${t('team.planUsage')} (${currentPlan.limits.maxUsers}).`, 'error');
            return;
        }
        setEditingUser(null);
        setFormData({ name: '', email: '', role: 'MEMBER', status: 'ACTIVE' });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status || 'ACTIVE'
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (userToDelete: User) => {
        if (userToDelete.id === currentUser.id) {
            addToast(t('common.logout'), 'error');
            return;
        }
        if (confirm(`${t('common.delete')} ${userToDelete.name}?`)) {
            try {
                await deleteTenantUser(userToDelete.id);
                addToast(t('common.confirm'), 'success');
                loadData();
            } catch (err: any) {
                addToast(err.message, 'error');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await updateUser(editingUser.id, formData);
                addToast(t('common.save'), 'success');
            } else {
                await createTenantUser(formData);
                addToast(t('team.newMember'), 'success');
            }
            setIsModalOpen(false);
            loadData();
        } catch (err: any) {
            addToast(err.message, 'error');
        }
    };

    const maxUsers = currentPlan?.limits.maxUsers || 1;
    const usagePercent = Math.min(100, (users.length / maxUsers) * 100);
    const isFull = users.length >= maxUsers;

    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{t('team.title')}</h2>
                    <p className="text-slate-500">{t('team.subtitle')}</p>
                </div>
                <div className="flex items-center gap-4">
                    {currentPlan && (
                        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col w-48">
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                                <span>{t('team.planUsage')} {currentPlan.name}</span>
                                <span className={isFull ? 'text-red-600' : 'text-slate-700'}>{users.length} / {maxUsers}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${usagePercent}%` }}></div>
                            </div>
                        </div>
                    )}

                    <button onClick={handleOpenCreate} disabled={isFull} className={`px-4 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all ${isFull ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        {t('team.addMember')}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">{t('common.name')} / {t('common.email')}</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">{t('common.role')}</th>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase">{t('common.status')}</th>
                            <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={4} className="p-6 text-center text-slate-500">{t('common.loading')}</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={4} className="p-6 text-center text-slate-500">{t('jobs.empty')}</td></tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold mr-3">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{user.name} {user.id === currentUser.id && <span className="text-xs text-slate-400 font-normal">({t('common.welcome')})</span>}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-slate-100 text-slate-700">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${user.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            {user.status === 'ACTIVE' ? t('common.active') : t('common.inactive')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => handleOpenEdit(user)} className="text-indigo-600 hover:text-indigo-900 font-medium text-xs uppercase">{t('common.edit')}</button>
                                        {user.id !== currentUser.id && (
                                            <button onClick={() => handleDelete(user)} className="text-red-500 hover:text-red-700 font-medium text-xs uppercase">{t('common.delete')}</button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-lg">
                                {editingUser ? t('team.editMember') : t('team.newMember')}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('team.fullName')}</label>
                                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('team.corporateEmail')}</label>
                                <input type="email" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={!!editingUser} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('team.permissions')}</label>
                                    <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}>
                                        <option value="MEMBER">Member</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="OWNER">Owner</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('common.status')}</label>
                                    <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}>
                                        <option value="ACTIVE">{t('common.active')}</option>
                                        <option value="INACTIVE">{t('common.inactive')}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 mt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">{t('common.cancel')}</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm">
                                    {editingUser ? t('team.saveChanges') : t('team.addMember')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamView;
