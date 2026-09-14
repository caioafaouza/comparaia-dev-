

import React, { useState, useRef, useEffect } from 'react';
import { AuthSession, PlanType, PlanDefinition } from '../types';
import { updateTenant, getPlans, deleteTenantSelf, mockLogout } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsViewProps {
   session: AuthSession;
   onUpdateSession: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ session, onUpdateSession }) => {
   const { addToast } = useToast();
   const { t } = useLanguage();
   const fileInputRef = useRef<HTMLInputElement>(null);

   const [workspaceName, setWorkspaceName] = useState(session.tenant.name);
   const [cnpj, setCnpj] = useState(session.tenant.cnpj || '');
   const [phone, setPhone] = useState(session.tenant.phone || '');
   const [customDomain, setCustomDomain] = useState(session.tenant.customDomain || '');
   const [plan, setPlan] = useState<PlanType>(session.tenant.plan);

   const [brandColor, setBrandColor] = useState(session.tenant.brandColor || '#1A202C');
   const [logoUrl, setLogoUrl] = useState(session.tenant.logoUrl || '');
   const [saving, setSaving] = useState(false);
   const [availablePlans, setAvailablePlans] = useState<PlanDefinition[]>([]);

   // Delete Account Modal State
   const [showDeleteModal, setShowDeleteModal] = useState(false);
   const [deleteConfirmCheck, setDeleteConfirmCheck] = useState(false);
   const [deleting, setDeleting] = useState(false);
   const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);

   useEffect(() => {
      getPlans().then(setAvailablePlans);
   }, []);

   const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         if (file.size > 2 * 1024 * 1024) {
            addToast('Error: Max 2MB.', 'error');
            return;
         }
         const reader = new FileReader();
         reader.onload = (ev) => {
            if (ev.target?.result) setLogoUrl(ev.target.result as string);
         };
         reader.readAsDataURL(file);
      }
   };

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
         const response = await updateTenant(session.tenant.id, {
            name: workspaceName,
            cnpj,
            phone,
            customDomain,
            brandColor,
            logoUrl,
            plan
         });

         // PERSISTENCE FIX: Update local session storage
         if (response && response.tenant) {
            const currentSession = localStorage.getItem('comparaia_session');
            if (currentSession) {
               const parsedSession = JSON.parse(currentSession);
               parsedSession.tenant = { ...parsedSession.tenant, ...response.tenant };
               localStorage.setItem('comparaia_session', JSON.stringify(parsedSession));
            }
         }

         addToast(t('common.success'), 'success');
         onUpdateSession();
      } catch (err) {
         addToast(t('common.error'), 'error');
      } finally {
         setSaving(false);
      }
   };

   const handleDeleteAccount = async () => {
      if (!deleteConfirmCheck) return;
      setDeleting(true);
      try {
         await deleteTenantSelf();
         setShowDeleteModal(false);
         setShowDeleteSuccessModal(true);
         setTimeout(() => {
            try {
               localStorage.removeItem('comparaia_session');
               localStorage.removeItem('comparaia_last_tenant');
               mockLogout();
            } finally {
               window.location.assign('/');
            }
         }, 1200);
      } catch (err) {
         addToast('Erro ao cancelar conta.', 'error');
         setDeleting(false);
      }
   };

   const selectedPlanDef = availablePlans.find(p => p.id === plan);
   const isWhiteLabelEnabled = selectedPlanDef
      ? selectedPlanDef.features.whiteLabel
      : (plan === 'PRO' || plan === 'ENTERPRISE');

   return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
         <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h2>
            <p className="text-slate-500">{t('settings.subtitle')}</p>
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
               <h3 className="text-sm font-bold text-slate-700">{t('settings.identity')}</h3>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-8">
               {/* General Settings */}
               <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                     <label htmlFor="workspace-name" className="block text-sm font-medium text-slate-700">
                        {t('settings.companyName')}
                     </label>
                     <div className="mt-1">
                        <input
                           type="text"
                           name="workspace-name"
                           id="workspace-name"
                           value={workspaceName}
                           onChange={(e) => setWorkspaceName(e.target.value)}
                           className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
                        />
                     </div>
                  </div>

                  <div className="sm:col-span-3">
                     <label htmlFor="cnpj" className="block text-sm font-medium text-slate-700">
                        {t('settings.cnpj')}
                     </label>
                     <div className="mt-1">
                        <input
                           type="text"
                           name="cnpj"
                           id="cnpj"
                           value={cnpj}
                           onChange={(e) => setCnpj(e.target.value)}
                           className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
                           placeholder="000.000.000-00 ou 00.000.000/0001-00"
                        />
                     </div>
                  </div>

                  <div className="sm:col-span-3">
                     <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                        {t('settings.phone')}
                     </label>
                     <div className="mt-1">
                        <input
                           type="text"
                           name="phone"
                           id="phone"
                           value={phone}
                           onChange={(e) => setPhone(e.target.value)}
                           className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
                           placeholder="(11) 99999-9999"
                        />
                     </div>
                  </div>

                  <div className="sm:col-span-3">
                     <label htmlFor="custom-domain" className="block text-sm font-medium text-slate-700">
                        {t('settings.domain')}
                        {!selectedPlanDef?.features.customDomain && <span className="ml-2 text-[10px] bg-slate-200 px-1.5 rounded text-slate-500">PRO/ENT</span>}
                     </label>
                     <div className="mt-1 flex rounded-md shadow-sm">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-gray-500 sm:text-sm">
                           https://
                        </span>
                        <input
                           type="text"
                           name="custom-domain"
                           id="custom-domain"
                           value={customDomain}
                           onChange={(e) => setCustomDomain(e.target.value)}
                           disabled={!selectedPlanDef?.features.customDomain}
                           className={`flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-slate-300 border ${!selectedPlanDef?.features.customDomain ? 'bg-slate-100 cursor-not-allowed text-slate-400' : ''}`}
                           placeholder="empresa.comparaia.com"
                        />
                     </div>
                  </div>

                  <div className="sm:col-span-6">
                     <label htmlFor="plan" className="block text-sm font-medium text-slate-700">
                        {t('settings.plan')}
                     </label>
                     <div className="mt-1">
                        <select
                           id="plan"
                           value={plan}
                           onChange={(e) => setPlan(e.target.value as PlanType)}
                           className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border bg-white cursor-pointer"
                        >
                           {availablePlans.length > 0 ? availablePlans.map(p => (
                              <option key={p.id} value={p.id}>
                                 {p.name} ({p.price > 0 ? `R$ ${p.price}/${t('billing.month')}` : 'Grátis'})
                              </option>
                           )) : (
                              <>
                                 <option value="STARTER">STARTER</option>
                                 <option value="PRO">PRO</option>
                                 <option value="ENTERPRISE">ENTERPRISE</option>
                              </>
                           )}
                        </select>
                     </div>
                  </div>
               </div>

               <div className="border-t border-slate-100 pt-6">
                  <div className="flex justify-between items-center mb-4">
                     <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        {t('settings.whiteLabelTitle')}
                        {!isWhiteLabelEnabled && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded">PRO / ENT</span>}
                     </h4>
                  </div>

                  <div className={`space-y-6 ${!isWhiteLabelEnabled ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Logo Upload */}
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-2">{t('settings.logo')}</label>
                           <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-lg border border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden relative">
                                 {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                                 ) : (
                                    <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                 )}
                              </div>
                              <div>
                                 <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/png, image/jpeg, image/svg+xml"
                                    onChange={handleLogoUpload}
                                 />
                                 <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 bg-white"
                                 >
                                    {t('settings.upload')}
                                 </button>
                                 <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, SVG (Max 2MB).</p>
                              </div>
                           </div>
                        </div>

                        {/* Brand Color */}
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-2">{t('settings.brandColor')}</label>
                           <div className="flex items-center gap-3">
                              <input
                                 type="color"
                                 value={brandColor}
                                 onChange={(e) => setBrandColor(e.target.value)}
                                 className="h-10 w-16 p-1 border border-slate-300 rounded cursor-pointer"
                              />
                              <div className="flex-1">
                                 <input
                                    type="text"
                                    value={brandColor}
                                    onChange={(e) => setBrandColor(e.target.value)}
                                    className="w-full border-slate-300 rounded-md text-sm p-2 border uppercase"
                                    maxLength={7}
                                 />
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Preview */}
                     <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">{t('settings.preview')}</p>
                        <div className="bg-white border border-slate-200 p-4 rounded shadow-sm">
                           <div className="flex justify-between items-center pb-2 border-b-2" style={{ borderColor: brandColor }}>
                              <div className="h-8 w-24 bg-slate-100 flex items-center justify-center rounded">
                                 {logoUrl ? <img src={logoUrl} className="h-6 object-contain" alt="Logo" /> : <span className="text-[9px] text-slate-400">LOGO</span>}
                              </div>
                              <div className="text-right">
                                 <div className="text-[10px] font-bold" style={{ color: brandColor }}>RELATÓRIO TÉCNICO</div>
                                 <div className="text-[8px] text-slate-400">{workspaceName}</div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                     type="submit"
                     disabled={saving}
                     className="bg-indigo-600 border border-transparent rounded-md shadow-sm py-2 px-6 inline-flex justify-center text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                     {saving ? t('settings.saving') : t('settings.save')}
                  </button>
               </div>
            </form>
         </div>

         {/* DANGER ZONE */}
         <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 bg-red-50">
               <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Zona de Perigo
               </h3>
            </div>
            <div className="p-6">
               <div className="flex items-center justify-between">
                  <div>
                     <h4 className="text-sm font-bold text-slate-900">Cancelar Conta</h4>
                     <p className="text-xs text-slate-500 mt-1">
                        Isso excluirá permanentemente sua conta, usuários e todos os dados associados. Esta ação é irreversível.
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={() => setShowDeleteModal(true)}
                     className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                  >
                     Cancelar Conta
                  </button>
               </div>
            </div>
         </div>

         {/* DELETE CONFIRMATION MODAL */}
         {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-bounce-in">
                  <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex justify-between items-center">
                     <h3 className="font-bold text-red-800">Confirmar Cancelamento</h3>
                     <button onClick={() => setShowDeleteModal(false)} className="text-red-400 hover:text-red-700">✕</button>
                  </div>
                  <div className="p-6 space-y-4">
                     <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-sm text-red-800">
                        <p className="font-bold mb-2">Atenção: Ação Irreversível</p>
                        <ul className="list-disc pl-5 space-y-1">
                           <li>Todos os comparativos serão excluídos.</li>
                           <li>Todos os usuários do time perderão acesso.</li>
                           <li>Não é possível recuperar os dados após a confirmação.</li>
                        </ul>
                     </div>

                     <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                        <input
                           type="checkbox"
                           className="mt-1 w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                           checked={deleteConfirmCheck}
                           onChange={(e) => setDeleteConfirmCheck(e.target.checked)}
                        />
                        <span className="text-sm text-slate-600">
                           Entendo que esta ação excluirá permanentemente minha conta e todos os dados associados.
                        </span>
                     </label>

                     <div className="flex gap-3 pt-2">
                        <button
                           className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50"
                           onClick={() => setShowDeleteModal(false)}
                        >
                           Cancelar
                        </button>
                        <button
                           className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-red-200"
                           disabled={!deleteConfirmCheck || deleting}
                           onClick={handleDeleteAccount}
                        >
                           {deleting ? 'Cancelando...' : 'Confirmar Exclusão'}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* DELETE SUCCESS MODAL */}
         {showDeleteSuccessModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="px-6 py-4 border-b border-emerald-100 bg-emerald-50">
                     <h3 className="font-bold text-emerald-800">Conta cancelada com sucesso</h3>
                  </div>
                  <div className="p-6 space-y-4">
                     <p className="text-sm text-slate-700">
                        Sua conta foi cancelada. Voce sera desconectado e redirecionado para a pagina principal.
                     </p>
                     <div className="flex justify-end">
                        <button
                           className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700"
                           onClick={() => {
                              localStorage.removeItem('comparaia_session');
                              localStorage.removeItem('comparaia_last_tenant');
                              window.location.assign('/');
                           }}
                        >
                           Ok, sair agora
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

      </div>
   );
};

export default SettingsView;
