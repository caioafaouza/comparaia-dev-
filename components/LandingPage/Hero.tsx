import React, { useState, useEffect } from 'react';
import { HERO_CONTENT } from './data';

interface HeroProps {
  onRegister: () => void;
}

const Hero: React.FC<HeroProps> = ({ onRegister }) => {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimationStep((prev) => (prev < 3 ? prev + 1 : 0));
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="pt-28 pb-20 lg:pt-44 lg:pb-36 overflow-hidden relative bg-slate-50">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[10%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-[10%] -right-[20%] w-[70%] h-[70%] bg-emerald-400/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-5xl mx-auto mb-16">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-2 animate-pulse" />
            {HERO_CONTENT.badge}
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-[1.08]">
            {HERO_CONTENT.title}
            <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-500">
              {' '}
              {HERO_CONTENT.titleHighlight}
            </span>
          </h1>

          <p
            className="mt-4 max-w-3xl mx-auto text-lg md:text-xl text-slate-600 mb-10 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: HERO_CONTENT.description }}
          />

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onRegister}
              className="group w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 text-white text-lg font-bold hover:bg-indigo-700 transition-all shadow-xl hover:shadow-indigo-500/30 transform hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              {HERO_CONTENT.ctaPrimary}
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
            <button
              onClick={scrollToHowItWorks}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-slate-700 border border-slate-200 text-lg font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 hover:border-slate-300 shadow-sm"
            >
              <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              {HERO_CONTENT.ctaSecondary}
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 font-medium">
            {HERO_CONTENT.riskReversal.map((item, idx) => (
              <span key={idx} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl perspective-1000 group">
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-emerald-500 opacity-20 blur-3xl -z-10 rounded-[2rem] group-hover:opacity-30 transition-opacity duration-1000" />

          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden transform rotate-x-6 group-hover:rotate-x-2 transition-transform duration-700 ease-out border-t-4 border-t-indigo-500">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white h-8 rounded-md border border-slate-200 flex items-center px-3 text-[11px] text-slate-400 font-mono shadow-sm truncate">
                app.comparaia.com.br/analise/relatorio-tecnico
              </div>
              <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                em processamento
              </div>
            </div>

            <div className="p-8 bg-slate-50/60 min-h-[430px] relative">
              <div className={`absolute top-24 right-10 z-20 bg-slate-900 text-white p-4 rounded-xl shadow-xl max-w-xs border border-slate-700 transition-all duration-500 transform ${animationStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <span className="text-xs font-bold text-indigo-300">Análise de aderência</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  Divergência detectada: candidato informa <strong>IP54</strong>, referência exige <strong>IP55</strong>.
                </p>
              </div>

              <div className="flex justify-between items-end mb-8">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Resultado consolidado</div>
                  <h3 className="text-2xl font-bold text-slate-900">Matriz técnica com critérios, evidências e status</h3>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">Recomendação técnica</span>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full border border-indigo-200">Exportação em PDF</span>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-4xl font-black text-indigo-600 transition-all duration-1000">{animationStep === 0 ? '—' : 'OK'}</div>
                  <div className="text-xs text-slate-500 font-bold uppercase mt-1">Validação técnica</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative">
                <div
                  className="absolute left-0 w-full h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-10 transition-all duration-[2000ms] ease-in-out"
                  style={{ top: animationStep === 0 ? '0%' : '100%', opacity: animationStep < 3 ? 1 : 0 }}
                />

                <div className="grid grid-cols-4 bg-slate-100 text-xs font-bold text-slate-600 uppercase p-4 border-b border-slate-200">
                  <div>Parâmetro</div>
                  <div>Referência</div>
                  <div className="text-indigo-700">Candidato</div>
                  <div>Status</div>
                </div>

                <div className={`grid grid-cols-4 p-4 border-b border-slate-100 text-sm items-center transition-all duration-500 ${animationStep >= 1 ? 'opacity-100' : 'opacity-0 translate-x-4'}`}>
                  <div className="font-bold text-slate-700">Potência nominal</div>
                  <div className="font-mono text-slate-500">10 CV</div>
                  <div className="font-mono text-slate-900 font-bold bg-yellow-100 px-2 rounded w-fit">7.46 kW</div>
                  <div><span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-md font-bold border border-emerald-200">Aderente</span></div>
                </div>

                <div className={`grid grid-cols-4 p-4 border-b border-slate-100 bg-red-50/30 text-sm items-center transition-all duration-500 delay-200 ${animationStep >= 2 ? 'opacity-100' : 'opacity-0 translate-x-4'}`}>
                  <div className="font-bold text-slate-700">Grau de proteção</div>
                  <div className="font-mono text-slate-500">IP55</div>
                  <div className="font-mono text-red-700 font-bold">IP54</div>
                  <div><span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-md font-bold border border-red-200">Desvio</span></div>
                </div>

                <div className={`grid grid-cols-4 p-4 text-sm items-center transition-all duration-500 delay-300 ${animationStep >= 3 ? 'opacity-100' : 'opacity-0 translate-x-4'}`}>
                  <div className="font-bold text-slate-700">Classe de eficiência</div>
                  <div className="font-mono text-slate-500">IR3/IE3</div>
                  <div className="font-mono text-slate-900 font-bold">IE3</div>
                  <div><span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-md font-bold border border-emerald-200">Aderente</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .rotate-x-6 { transform: rotateX(6deg); }
        .group-hover\\:rotate-x-2:hover { transform: rotateX(2deg); }
      `}</style>
    </section>
  );
};

export default Hero;
