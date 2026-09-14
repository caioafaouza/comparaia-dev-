import React from 'react';
import Logo from '../Logo';

const Footer: React.FC = () => {
  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer className="bg-slate-900 text-slate-300 pt-20 pb-10 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Logo className="w-8 h-8" variant="white" showText={true} />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-sm">
              Plataforma SaaS B2B para comparação técnica de itens e fornecedores com suporte à decisão para compras complexas.
            </p>
            <div className="text-xs text-slate-500">Operação multi-tenant • Gestão administrativa • Relatório técnico em PDF</div>
          </div>

          <div>
            <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Navegação</h4>
            <ul className="space-y-4 text-sm">
              <li><button onClick={() => goTo('how-it-works')} className="hover:text-indigo-400 transition-colors">Como funciona</button></li>
              <li><button onClick={() => goTo('solutions')} className="hover:text-indigo-400 transition-colors">Para quem é</button></li>
              <li><button onClick={() => goTo('features')} className="hover:text-indigo-400 transition-colors">Recursos</button></li>
              <li><button onClick={() => goTo('pricing')} className="hover:text-indigo-400 transition-colors">Planos</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Contato</h4>
            <ul className="space-y-4 text-sm">
              <li><button onClick={() => goTo('contact')} className="hover:text-indigo-400 transition-colors">Falar com especialista</button></li>
              <li><span className="text-slate-400">Suporte via plataforma</span></li>
              <li><span className="text-slate-400">São Paulo, Brasil</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <span>© 2026 COMPARA IA. Todos os direitos reservados.</span>
          <div className="flex gap-6">
            <span>Produto para operações B2B</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />Sistema online</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
