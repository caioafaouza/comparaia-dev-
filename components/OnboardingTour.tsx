
import React, { useState, useEffect } from 'react';

interface OnboardingTourProps {
  onComplete: () => void;
  onStartAction: () => void; // Ação para levar à tela de criação
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, onStartAction }) => {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('comparaia_onboarding_completed');
    if (!hasSeenOnboarding) {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    localStorage.setItem('comparaia_onboarding_completed', 'true');
    setIsVisible(false);
    onComplete();
  };

  const handleStartNow = () => {
    localStorage.setItem('comparaia_onboarding_completed', 'true');
    setIsVisible(false);
    onStartAction();
  };

  if (!isVisible) return null;

  const steps = [
    {
      title: "Bem-vindo ao COMPARA IA",
      description: "Sua plataforma de engenharia de compras. Aqui, transformamos datasheets complexos e propostas técnicas em decisões baseadas em dados.",
      icon: (
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 mb-6">
           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        </div>
      ),
      actionLabel: "Conhecer a Plataforma"
    },
    {
      title: "Validação com Rigor Técnico",
      description: "Nosso motor de IA normaliza unidades (ex: CV para kW) e identifica desvios de especificações automaticamente, garantindo conformidade técnica.",
      icon: (
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 mb-6">
           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
      ),
      actionLabel: "Próximo"
    },
    {
      title: "Controle de ROI e Eficiência",
      description: "Acompanhe no Dashboard quantas horas de engenharia foram poupadas e o valor financeiro gerado pela agilidade no processo de compras.",
      icon: (
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 mb-6">
           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
        </div>
      ),
      actionLabel: "Próximo"
    },
    {
      title: "Vamos começar?",
      description: "Faça o upload do seu primeiro datasheet de referência e compare com propostas de fornecedores agora mesmo.",
      icon: (
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 mb-6">
           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        </div>
      ),
      isFinal: true,
      actionLabel: "Criar Primeira Análise"
    }
  ];

  const currentContent = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative">
        {/* Background Pattern */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-600 to-blue-800 opacity-10"></div>
        
        <div className="p-8 relative pt-12 flex flex-col items-center text-center">
          {/* Close Button (Skip) */}
          <button 
            onClick={handleFinish}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider"
          >
            Pular Intro
          </button>

          {currentContent.icon}

          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            {currentContent.title}
          </h2>
          
          <p className="text-slate-500 leading-relaxed mb-8">
            {currentContent.description}
          </p>

          {/* Dots Indicator */}
          <div className="flex gap-2 mb-8">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-2 rounded-full transition-all duration-300 ${idx === step ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'}`}
              ></div>
            ))}
          </div>

          <div className="w-full flex gap-3">
             {!currentContent.isFinal ? (
               <button 
                 onClick={handleNext}
                 className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
               >
                 {currentContent.actionLabel}
               </button>
             ) : (
               <button 
                 onClick={handleStartNow}
                 className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 {currentContent.actionLabel}
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
