
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../i18n/translations';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const langs: { id: Language; label: string; flag: string }[] = [
    { id: 'pt', label: 'Português', flag: '🇧🇷' },
    { id: 'en', label: 'English', flag: '🇺🇸' },
    { id: 'es', label: 'Español', flag: '🇪🇸' }
  ];

  const current = langs.find(l => l.id === language);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-sm"
      >
        <span className="text-base">{current?.flag}</span>
        <span className="text-xs font-black text-slate-600 uppercase">{language}</span>
        <svg className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1 animate-fade-in overflow-hidden">
          {langs.map(lang => (
            <button
              key={lang.id}
              onClick={() => setLanguage(lang.id)}
              className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-3 transition-colors
                ${language === lang.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}
              `}
            >
              <span>{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
