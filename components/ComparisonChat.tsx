
import React, { useState, useRef, useEffect } from 'react';
import { ComparisonResponse, ChatResponse, GroundingSource } from '../types';
import { chatWithReport } from '../services/geminiService';
import { useToast } from '../contexts/ToastContext';

interface ComparisonChatProps {
  reportData: ComparisonResponse;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  sources?: GroundingSource[];
}

const ComparisonChat: React.FC<ComparisonChatProps> = ({ reportData }) => {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'ai', text: 'Olá! Sou seu consultor técnico. Com o Google Search ativo, posso buscar preços de mercado, checar obsolescência de modelos ou encontrar fornecedores alternativos. Como posso ajudar?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      // Fix: chatWithReport expected 2 arguments, but got 3. Removed the empty array parameter as per the function signature in geminiService.ts.
      const response = await chatWithReport(reportData, userMsg.text);
      setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: 'ai', 
          text: response.text,
          sources: response.sources
      }]);
    } catch (err) {
      addToast('Erro ao consultar IA de Mercado.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all ${isOpen ? 'bg-red-500' : 'bg-indigo-600'}`}
      >
         <svg className={`w-6 h-6 text-white transition-transform ${isOpen ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[90vw] h-[550px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-fade-in">
           <div className="bg-slate-900 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <h3 className="text-white font-bold text-sm">IA de Inteligência de Mercado</h3>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-black">Google Search Ativo</span>
           </div>

           <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4 custom-scrollbar">
              {messages.map(msg => (
                 <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                       {msg.text}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {msg.sources.map((src, idx) => (
                                <a key={idx} href={src.uri} target="_blank" rel="noreferrer" className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 hover:bg-indigo-100 truncate max-w-[120px]">
                                    {src.title}
                                </a>
                            ))}
                        </div>
                    )}
                 </div>
              ))}
              {isProcessing && <div className="text-[10px] text-slate-400 font-bold animate-pulse">Pesquisando na web...</div>}
              <div ref={messagesEndRef} />
           </div>

           <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2">
              <input 
                 type="text" 
                 placeholder="Pergunte sobre preços ou modelos..." 
                 className="flex-1 bg-slate-100 border-0 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                 value={inputText}
                 onChange={e => setInputText(e.target.value)}
              />
              <button type="submit" className="p-2 bg-indigo-600 text-white rounded-full"><svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
           </form>
        </div>
      )}
    </>
  );
};

export default ComparisonChat;
