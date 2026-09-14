
import React, { useState, useEffect } from 'react';
import { getCRMLeads, updateCRMLead, createCRMLead, deleteCRMLead } from '../../../services/api';
import { CRMLead } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const CRMModule: React.FC = () => {
    const { addToast } = useToast();
    const [leads, setLeads] = useState<CRMLead[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
    const [editingLead, setEditingLead] = useState<CRMLead | null>(null);
    const [viewingLead, setViewingLead] = useState<CRMLead | null>(null);

    // New Lead Form State (also used for edit)
    const [formData, setFormData] = useState({
        companyName: '',
        contactName: '',
        email: '',
        value: 0,
        probability: 20,
        notes: ''
    });

    useEffect(() => { loadLeads(); }, []);

    const loadLeads = () => getCRMLeads().then(setLeads);

    const handleStatusChange = async (id: string, newStatus: CRMLead['status']) => {
        await updateCRMLead(id, { status: newStatus });
        // Optimistic update
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));

        // If viewing current lead, update view state too
        if (viewingLead && viewingLead.id === id) {
            setViewingLead(prev => prev ? { ...prev, status: newStatus } : null);
        }
        addToast('Status atualizado.', 'success');
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (confirm("Remover este lead?")) {
            await deleteCRMLead(id);
            loadLeads();
            setViewingLead(null); // Close panel if open
            addToast('Lead removido.', 'success');
        }
    };

    const handleOpenCreate = () => {
        setEditingLead(null);
        setFormData({ companyName: '', contactName: '', email: '', value: 0, probability: 20, notes: '' });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (lead: CRMLead) => {
        setEditingLead(lead);
        setFormData({
            companyName: lead.companyName,
            contactName: lead.contactName,
            email: lead.email,
            value: lead.value || 0,
            probability: lead.probability || 0,
            notes: lead.notes || ''
        });
        setIsModalOpen(true);
    };

    const handleViewDetails = (lead: CRMLead) => {
        setViewingLead(lead);
    };

    const handleSubmitLead = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validações Estritas
        if (!formData.companyName.trim()) {
            return addToast('O nome da empresa é obrigatório.', 'error');
        }

        if (!formData.contactName.trim()) {
            return addToast('O nome do contato é obrigatório.', 'error');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email.trim() || !emailRegex.test(formData.email)) {
            return addToast('Informe um endereço de e-mail válido.', 'error');
        }

        try {
            if (editingLead) {
                await updateCRMLead(editingLead.id, formData);
                addToast('Lead atualizado com sucesso!', 'success');
                // Refresh view if open
                if (viewingLead && viewingLead.id === editingLead.id) {
                    setViewingLead({ ...viewingLead, ...formData });
                }
            } else {
                await createCRMLead(formData);
                addToast('Lead cadastrado com sucesso!', 'success');
            }
            setIsModalOpen(false);
            loadLeads();
        } catch (error) {
            console.error(error);
            addToast('Erro ao salvar lead. Tente novamente.', 'error');
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Drag and Drop Handlers
    const onDragStart = (e: React.DragEvent, id: string) => {
        setDraggedLeadId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const onDrop = (e: React.DragEvent, status: CRMLead['status']) => {
        e.preventDefault();
        if (draggedLeadId) {
            handleStatusChange(draggedLeadId, status);
            setDraggedLeadId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">CRM de Vendas (Enterprise)</h2>
                    <p className="text-slate-500">Pipeline de vendas e gestão de oportunidades.</p>
                </div>
                <button onClick={handleOpenCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Novo Lead
                </button>
            </div>

            <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
                {['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED'].map(status => (
                    <div
                        key={status}
                        className="bg-slate-50 p-3 rounded-xl border border-slate-200 min-h-[500px] flex flex-col w-[280px] shrink-0 transition-colors hover:bg-slate-100/50"
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, status as CRMLead['status'])}
                    >
                        <h4 className="font-bold text-slate-500 text-xs uppercase mb-3 border-b border-slate-200 pb-2 flex justify-between items-center sticky top-0 bg-slate-50 z-10">
                            {status === 'NEW' ? 'Novos Leads' : status === 'CONTACTED' ? 'Em Contato' : status === 'QUALIFIED' ? 'Qualificados' : 'Convertidos'}
                            <span className="bg-slate-200 text-slate-600 px-2 rounded-full text-[10px]">{leads.filter(l => l.status === status).length}</span>
                        </h4>

                        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                            {leads.filter(l => l.status === status).map(lead => (
                                <div
                                    key={lead.id}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, lead.id)}
                                    onClick={() => handleViewDetails(lead)}
                                    className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-sm hover:shadow-md transition-all group relative cursor-grab active:cursor-grabbing hover:border-indigo-300"
                                >
                                    <div className="font-bold text-slate-800 text-base">{lead.companyName}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        {lead.contactName}
                                    </div>

                                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                                        <div className="text-xs font-bold text-emerald-600">{lead.value ? formatCurrency(lead.value) : '-'}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{lead.probability}% Prob.</div>
                                    </div>

                                    <div className="mt-2 flex justify-end">
                                        <span className="text-[10px] text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver detalhes</span>
                                    </div>
                                </div>
                            ))}
                            {leads.filter(l => l.status === status).length === 0 && (
                                <div className="text-center text-xs text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-lg">
                                    Arraste leads para cá
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* DETAIL SIDE PANEL */}
            {viewingLead && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
                        onClick={() => setViewingLead(null)}
                    ></div>

                    {/* Panel */}
                    <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right transform transition-transform border-l border-slate-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                            <div className="flex gap-4">
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl shrink-0">
                                    {viewingLead.companyName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{viewingLead.companyName}</h3>
                                    <p className="text-slate-500 text-sm">{viewingLead.contactName}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingLead(null)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Status Bar */}
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Estágio do Pipeline</label>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    {['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED'].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => handleStatusChange(viewingLead.id, s as any)}
                                            className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${viewingLead.status === s ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Valor Estimado</label>
                                    <div className="text-lg font-bold text-slate-800">{viewingLead.value ? formatCurrency(viewingLead.value) : '-'}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Probabilidade</label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-full bg-slate-100 rounded-full h-2 max-w-[80px]">
                                            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${viewingLead.probability || 0}%` }}></div>
                                        </div>
                                        <span className="text-sm font-medium text-slate-700">{viewingLead.probability}%</span>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Contato</label>
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        <a href={`mailto:${viewingLead.email}`} className="hover:text-indigo-600 hover:underline">{viewingLead.email}</a>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline / History */}
                            <div>
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Histórico de Interações
                                </h4>
                                <div className="space-y-6 relative border-l border-slate-200 ml-2 pl-6">
                                    {/* Mock Creation Event if History is empty */}
                                    <div className="relative">
                                        <span className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white"></span>
                                        <p className="text-xs text-slate-500 mb-1">{new Date(viewingLead.createdAt).toLocaleString()}</p>
                                        <p className="text-sm text-slate-800">Lead criado no sistema.</p>
                                    </div>

                                    {viewingLead.notes && !viewingLead.interactions && (
                                        <div className="relative">
                                            <span className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-blue-300 ring-4 ring-white"></span>
                                            <p className="text-xs text-slate-500 mb-1">Nota Inicial</p>
                                            <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                                "{viewingLead.notes}"
                                            </div>
                                        </div>
                                    )}

                                    {viewingLead.interactions?.map((interaction, idx) => (
                                        <div key={idx} className="relative">
                                            <span className={`absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${interaction.type === 'CALL' ? 'bg-green-400' :
                                                    interaction.type === 'EMAIL' ? 'bg-blue-400' :
                                                        interaction.type === 'STATUS_CHANGE' ? 'bg-orange-400' : 'bg-slate-300'
                                                }`}></span>
                                            <p className="text-xs text-slate-500 mb-1">{new Date(interaction.date).toLocaleString()} • <span className="font-bold uppercase">{interaction.type}</span></p>
                                            <p className="text-sm text-slate-800">{interaction.summary}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button
                                onClick={() => { setViewingLead(null); handleOpenEdit(viewingLead); }}
                                className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-lg font-bold hover:bg-slate-50 shadow-sm transition-colors"
                            >
                                Editar
                            </button>
                            <button
                                onClick={(e) => { handleDelete(viewingLead.id, e); }}
                                className="px-4 bg-red-50 border border-red-100 text-red-600 py-2.5 rounded-lg font-bold hover:bg-red-100 hover:text-red-700 transition-colors"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE/EDIT MODAL (Center) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-lg">{editingLead ? 'Editar Lead' : 'Novo Lead'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmitLead} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empresa <span className="text-red-500">*</span></label>
                                <input type="text" className="w-full border rounded p-2 text-sm" value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} placeholder="Ex: Acme Corp" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contato <span className="text-red-500">*</span></label>
                                    <input type="text" className="w-full border rounded p-2 text-sm" value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })} placeholder="Nome" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email <span className="text-red-500">*</span></label>
                                    <input type="email" className="w-full border rounded p-2 text-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="@email.com" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Estimado (R$)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={formData.value} onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Probabilidade (%)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={formData.probability} onChange={e => setFormData({ ...formData, probability: parseInt(e.target.value) })} max={100} min={0} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas / Detalhes</label>
                                <textarea className="w-full border rounded p-2 text-sm h-20 resize-none" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Informações adicionais..." />
                            </div>

                            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 mt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm">{editingLead ? 'Atualizar' : 'Salvar Lead'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
};

export default CRMModule;
