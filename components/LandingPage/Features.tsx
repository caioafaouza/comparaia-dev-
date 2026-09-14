import React, { useState } from 'react';

const Features: React.FC = () => {
  const [inputValue, setInputValue] = useState('10 HP');
  const [convertedValue, setConvertedValue] = useState('7.46 kW');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const num = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) {
      setConvertedValue('...');
      return;
    }

    const lowerVal = val.toLowerCase();
    if (lowerVal.includes('hp') || lowerVal.includes('cv')) {
      setConvertedValue(`${(num * 0.7457).toFixed(2)} kW`);
    } else if (lowerVal.includes('psi')) {
      setConvertedValue(`${(num * 0.0689).toFixed(2)} bar`);
    } else if (lowerVal.includes('inch') || lowerVal.includes('"')) {
      setConvertedValue(`${(num * 25.4).toFixed(1)} mm`);
    } else {
      setConvertedValue('Detectando...');
    }
  };

  return (
    <section id="features" className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-16">
          <div className="text-indigo-600 font-bold uppercase tracking-wider text-sm mb-2">Recursos principais</div>
          <h2 className="text-4xl font-extrabold text-slate-900 mb-6">Construído para decisões técnicas defensáveis</h2>
          <p className="text-lg text-slate-500 leading-relaxed">
            Além da leitura de texto, a plataforma organiza critérios e evidências para dar consistência ao processo de compra.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:border-indigo-100 transition-colors relative overflow-hidden group flex flex-col md:flex-row gap-8 items-center">
            <div className="relative z-10 flex-1">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Normalização de unidades</h3>
              <p className="text-slate-500 text-sm">Converte unidades técnicas para comparação consistente entre fornecedores.</p>
              <p className="text-xs text-indigo-600 font-bold mt-4 uppercase tracking-wide">Teste no campo ao lado</p>
            </div>

            <div className="w-full md:w-[320px] bg-white rounded-2xl shadow-xl border border-slate-200 p-6 relative z-10">
              <div className="text-xs font-bold text-slate-400 uppercase mb-4 text-center">Exemplo de conversão</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Valor original</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg p-3 text-slate-700 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Ex: 10 HP, 100 PSI"
                  />
                </div>

                <div className="flex justify-center">
                  <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                    <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  </div>
                </div>

                <div className={`transition-all duration-300 ${inputValue ? 'opacity-100' : 'opacity-50'}`}>
                  <label className="block text-xs font-bold text-indigo-600 mb-1">Resultado normalizado</label>
                  <div className="w-full bg-indigo-600 rounded-lg p-3 text-white font-mono font-bold shadow-md flex justify-between items-center">
                    <span>{convertedValue}</span>
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:border-red-100 transition-colors group">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500 mb-6 group-hover:bg-red-500 group-hover:text-white transition-colors shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Alerta de divergência</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Diferenças críticas de especificação são destacadas para evitar aprovações com risco técnico.</p>
          </div>

          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:border-emerald-100 transition-colors group">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Base para negociação</h3>
            <p className="text-slate-500 text-sm leading-relaxed">Com o quadro técnico consolidado, sua equipe negocia preço com mais segurança e menos retrabalho.</p>
          </div>

          <div className="md:col-span-2 bg-slate-900 rounded-3xl p-8 border border-slate-800 text-white relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white mb-6 backdrop-blur-sm">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4" /></svg>
                </div>
                <h3 className="text-2xl font-bold mb-3">Governança e rastreabilidade</h3>
                <p className="text-slate-300 max-w-md">Módulos administrativos permitem acompanhar uso, usuários, custos e histórico operacional da plataforma.</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-xs font-mono text-slate-200 w-full md:w-auto min-w-[280px] shadow-inner">
                <div className="flex gap-2 mb-2 items-center"><span className="text-emerald-400 font-bold">✓</span> Gestão de usuários e convites</div>
                <div className="flex gap-2 mb-2 items-center"><span className="text-emerald-400 font-bold">✓</span> Logs e histórico administrativo</div>
                <div className="flex gap-2 items-center"><span className="text-emerald-400 font-bold">✓</span> Configuração de e-mails transacionais</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
