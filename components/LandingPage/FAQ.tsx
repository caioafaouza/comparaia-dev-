import React, { useState } from 'react';
import { FAQ_ITEMS } from './data';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 bg-white border-t border-slate-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-4">Perguntas frequentes</h2>
        <p className="text-center text-slate-500 mb-12">Respostas objetivas para avaliar aderência do COMPARA IA ao seu processo.</p>

        <div className="space-y-4">
          {FAQ_ITEMS.map((faq, i) => (
            <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 hover:border-indigo-200 bg-slate-50/50">
              <button onClick={() => toggle(i)} className="w-full flex justify-between items-center p-6 text-left focus:outline-none">
                <span className={`font-bold text-lg ${openIndex === i ? 'text-indigo-600' : 'text-slate-800'}`}>{faq.q}</span>
                <span className={`transform transition-transform duration-300 ${openIndex === i ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </span>
              </button>

              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${openIndex === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-6 pt-0 text-slate-600 leading-relaxed border-t border-slate-100/50">{faq.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
