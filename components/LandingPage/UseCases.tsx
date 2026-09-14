import React from 'react';

const UseCases: React.FC = () => {
  const industries = [
    {
      name: 'Construção Civil',
      items: 'Materiais, equipamentos e infraestrutura',
      color: 'bg-orange-50 text-orange-600 border-orange-100',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
    },
    {
      name: 'Indústria',
      items: 'Máquinas, motores e reposição técnica',
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    },
    {
      name: 'Tecnologia e Infra',
      items: 'Hardware, rede e ativos críticos',
      color: 'bg-purple-50 text-purple-600 border-purple-100',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3" /></svg>
    },
    {
      name: 'Licitações',
      items: 'Análise documental e aderência técnica',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586" /></svg>
    }
  ];

  return (
    <section id="solutions" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wide mb-6">
              Público-alvo
            </div>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-6 leading-tight">
              Criado para quem precisa de <span className="text-indigo-600">precisão técnica</span> antes de aprovar uma compra.
            </h2>
            <p className="text-lg text-slate-500 mb-10 leading-relaxed">
              Engenheiros, compradores, times de produto e equipes de licitação usam a plataforma para reduzir risco de especificação e acelerar a tomada de decisão.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {industries.map((ind, idx) => (
                <div key={idx} className={`flex flex-col p-5 rounded-2xl border transition-all hover:shadow-md ${ind.color} bg-white`}>
                  <div className="mb-3 opacity-90">{ind.icon}</div>
                  <h4 className="font-bold text-slate-900 text-base">{ind.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 opacity-80">{ind.items}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-12 lg:mt-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl transform rotate-2 opacity-10 blur-xl" />
            <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="bg-slate-900 p-6 flex justify-between items-center">
                <h3 className="text-white font-bold text-lg">Antes e depois do processo</h3>
                <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">Foco em decisão</span>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="p-8 bg-red-50/30">
                  <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-6">Sem plataforma</h4>
                  <ul className="space-y-6">
                    <li className="flex gap-4 items-start opacity-80"><span className="text-red-500 mt-1">✕</span><p className="text-sm text-slate-700">Consolidação manual em múltiplas planilhas.</p></li>
                    <li className="flex gap-4 items-start opacity-80"><span className="text-red-500 mt-1">✕</span><p className="text-sm text-slate-700">Risco maior de aprovar item não aderente.</p></li>
                    <li className="flex gap-4 items-start opacity-80"><span className="text-red-500 mt-1">✕</span><p className="text-sm text-slate-700">Baixa rastreabilidade de evidências técnicas.</p></li>
                  </ul>
                </div>

                <div className="p-8 bg-emerald-50/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100 rounded-full blur-2xl -mr-10 -mt-10" />
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-6">Com COMPARA IA</h4>
                  <ul className="space-y-6 relative z-10">
                    <li className="flex gap-4 items-start"><span className="text-emerald-500 font-bold mt-1">✓</span><p className="text-sm text-slate-800 font-medium">Matriz técnica pronta para revisão da equipe.</p></li>
                    <li className="flex gap-4 items-start"><span className="text-emerald-500 font-bold mt-1">✓</span><p className="text-sm text-slate-800 font-medium">Divergências destacadas item a item.</p></li>
                    <li className="flex gap-4 items-start"><span className="text-emerald-500 font-bold mt-1">✓</span><p className="text-sm text-slate-800 font-medium">Relatório final exportável em PDF.</p></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UseCases;
