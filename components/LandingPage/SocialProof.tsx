import React from 'react';
import { SOCIAL_PROOF_CONTENT } from './data';

const SocialProof: React.FC = () => {
  const personas = ['Engenharia de Produto', 'Compras Técnicas', 'Licitações Públicas', 'Suprimentos Corporativos', 'Qualidade e Compliance'];

  return (
    <section className="py-10 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">
          {SOCIAL_PROOF_CONTENT.label}
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {personas.map((persona) => (
            <span key={persona} className="px-4 py-2 rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
              {persona}
            </span>
          ))}
        </div>

        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-200">
            {SOCIAL_PROOF_CONTENT.metrics.map((metric, idx) => (
              <div key={idx} className="text-center px-4">
                <div className={`text-3xl font-extrabold ${metric.color || 'text-slate-900'}`}>{metric.value}</div>
                <div className="text-xs text-slate-500 font-bold uppercase mt-2 tracking-wide">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
