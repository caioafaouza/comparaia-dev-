import React from 'react';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      id: 1,
      title: 'Envie os documentos',
      desc: 'Suba o item de referência e os candidatos em PDF para iniciar a análise técnica.',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
      )
    },
    {
      id: 2,
      title: 'IA estrutura os critérios',
      desc: 'A plataforma normaliza unidades, organiza evidências e identifica divergências por parâmetro.',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
      )
    },
    {
      id: 3,
      title: 'Decida com segurança',
      desc: 'Receba a matriz de aderência, recomendação técnica e relatório em PDF para apoiar a aprovação.',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <span className="text-indigo-600 font-bold tracking-widest uppercase text-xs bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Workflow</span>
          <h2 className="mt-4 text-3xl md:text-4xl font-extrabold text-slate-900">Da solicitação ao relatório técnico em minutos</h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">Reduza esforço manual e aumente consistência técnica no processo de compra.</p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 border-t-2 border-dashed border-indigo-200 z-0 transform translate-y-4" />

          {steps.map((step, index) => (
            <div key={step.id} className="relative z-10 flex flex-col items-center text-center group">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-100 group-hover:border-indigo-500 group-hover:shadow-indigo-500/20 transition-all duration-300 z-10 relative">
                  <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-inner transform group-hover:scale-110 transition-transform">
                    {step.icon}
                  </div>
                </div>
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-sm border-4 border-white shadow-sm">
                  {index + 1}
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
              <p className="text-slate-500 leading-relaxed max-w-xs text-sm">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
