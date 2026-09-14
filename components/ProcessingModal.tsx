
import React, { useEffect, useState } from 'react';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: number;
  message: string;
}

const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, progress, message }) => {
  const [displayMessage, setDisplayMessage] = useState(message);

  useEffect(() => {
    if (message) {
      setDisplayMessage(message);
    }
  }, [message]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-10 border border-slate-200 relative overflow-hidden">
        
        {/* Barra de destaque superior */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-600 via-indigo-400 to-emerald-400"></div>
        
        {/* Elementos decorativos de fundo */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-60"></div>

        <div className="relative z-10">
          {/* Icone central com animação de pulso e rotação */}
          <div className="mx-auto mb-8 w-24 h-24 bg-white rounded-[2rem] shadow-xl border border-slate-100 flex items-center justify-center relative group">
             <div className="absolute inset-0 rounded-[2rem] border-4 border-indigo-50 border-t-indigo-600 animate-spin"></div>
             <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 animate-pulse">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
             </div>
          </div>

          <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">
            Inteligência em Ação
          </h3>
          
          <div className="h-12 flex items-center justify-center mb-8">
            <p className="text-slate-500 font-medium italic animate-fade-in px-4">
              {displayMessage}
            </p>
          </div>

          {/* Container da Barra de Progresso Principal */}
          <div className="relative pt-1">
            <div className="flex mb-4 items-center justify-between">
              <div>
                <span className="text-[10px] font-black inline-block py-1 px-3 uppercase rounded-full text-indigo-600 bg-indigo-100 border border-indigo-200 tracking-widest">
                  Status da Operação
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-indigo-600 tabular-nums">
                  {progress}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-2xl bg-slate-100 border border-slate-200 shadow-inner">
              <div
                style={{ width: `${progress}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-700 ease-out relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress-bar-stripes_1s_linear_infinite]"></div>
              </div>
            </div>
          </div>

          {/* Mensagem de segurança e compliance no rodapé */}
          <div className="mt-6 flex items-center justify-center gap-2 py-3 bg-slate-50 rounded-xl border border-slate-100">
             <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processamento Criptografado & Seguro</span>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes progress-bar-stripes {
          from { background-position: 1rem 0; }
          to { background-position: 0 0; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ProcessingModal;
