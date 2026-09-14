import React from 'react';
import { PRICING_CONTENT } from './data';

interface PricingProps {
  onRegister: () => void;
}

const Pricing: React.FC<PricingProps> = ({ onRegister }) => {
  const handleEnterprise = () => {
    const contact = document.getElementById('contact');
    if (contact) {
      contact.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section id="pricing" className="py-24 bg-slate-900 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl opacity-30 pointer-events-none">
        <div className="absolute bottom-0 left-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-screen filter blur-[100px]" />
        <div className="absolute top-0 right-20 w-64 h-64 bg-emerald-500 rounded-full mix-blend-screen filter blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6">
            {PRICING_CONTENT.title}
            <br />
            <span className="text-indigo-400">{PRICING_CONTENT.titleHighlight}</span>
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">{PRICING_CONTENT.description}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
          {PRICING_CONTENT.plans.map((plan) => (
            <div
              key={plan.id}
              className={`
                p-8 rounded-3xl flex flex-col h-full
                ${plan.highlight
                  ? 'bg-gradient-to-b from-indigo-900 to-slate-900 border-2 border-indigo-500 relative transform md:-translate-y-6 shadow-2xl'
                  : 'bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:border-slate-600 transition-colors'}
              `}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">
                  {plan.tag}
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-3xl md:text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'text-indigo-200' : 'text-slate-300'}`}>{plan.period}</span>
                </div>
                <p className={`text-sm mb-6 border-b pb-6 ${plan.highlight ? 'text-indigo-200 border-indigo-500/30' : 'text-slate-300 border-slate-700'}`}>
                  {plan.description}
                </p>
                <ul className={`space-y-4 mb-8 text-sm ${plan.highlight ? 'text-white font-medium' : 'text-slate-200'}`}>
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex gap-3 items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.highlight ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      {feature.text}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={plan.id === 'enterprise' ? handleEnterprise : onRegister}
                className={`mt-auto w-full py-3 rounded-xl font-bold transition-colors ${
                  plan.highlight
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 transform hover:-translate-y-1'
                    : 'border border-slate-600 text-white hover:bg-slate-700'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">Pacotes de tokens avulsos podem complementar o plano conforme sua demanda.</p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
