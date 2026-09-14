import React, { useState } from 'react';
import { createCRMLead } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const ContactForm: React.FC = () => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createCRMLead({
        contactName: formData.name,
        companyName: formData.company,
        email: formData.email,
        notes: `Mensagem da Landing Page: ${formData.message}`,
        status: 'NEW',
        value: 0,
        probability: 10
      });

      setIsSuccess(true);
      addToast('Solicitação recebida! Nossa equipe entrará em contato.', 'success');
      setFormData({ name: '', email: '', company: '', message: '' });
    } catch {
      addToast('Erro ao enviar mensagem. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-indigo-900 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-10 right-10 w-96 h-96 bg-purple-500 rounded-full blur-[100px]" />
        <div className="absolute bottom-10 left-10 w-64 h-64 bg-emerald-500 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6">Quer aplicar no seu cenário real?</h2>
            <p className="text-lg text-indigo-200 mb-8 leading-relaxed">
              Envie sua demanda e agende uma demonstração orientada ao seu processo de compras técnicas.
            </p>

            <ul className="space-y-6">
              <li className="flex items-start">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center mt-1">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-bold text-white">Demonstração orientada</h4>
                  <p className="text-indigo-200 text-sm">Mostramos o fluxo com base nos tipos de documentos que sua equipe analisa.</p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center mt-1">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-bold text-white">Plano de adoção</h4>
                  <p className="text-indigo-200 text-sm">Ajudamos a montar o rollout para engenharia, compras e gestão.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10">
            {isSuccess ? (
              <div className="text-center py-12 animate-fade-in">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Solicitação enviada</h3>
                <p className="text-slate-500">Recebemos seus dados. Nosso time entrará em contato pelo e-mail informado.</p>
                <button onClick={() => setIsSuccess(false)} className="mt-6 text-indigo-600 font-bold hover:underline">Enviar nova solicitação</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Falar com especialista</h3>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Nome completo</label>
                  <input type="text" name="name" id="name" required className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" placeholder="Seu nome" value={formData.name} onChange={handleChange} />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">E-mail corporativo</label>
                  <input type="email" name="email" id="email" required className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" placeholder="voce@empresa.com" value={formData.email} onChange={handleChange} />
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
                  <input type="text" name="company" id="company" required className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" placeholder="Nome da sua empresa" value={formData.company} onChange={handleChange} />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">Mensagem (opcional)</label>
                  <textarea name="message" id="message" rows={3} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none" placeholder="Contexto da sua operação" value={formData.message} onChange={handleChange} />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isSubmitting ? 'Enviando...' : 'Solicitar contato'}
                </button>

                <p className="text-xs text-center text-slate-400 mt-4">Ao enviar, sua solicitação é registrada no CRM da plataforma para atendimento do time comercial.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
