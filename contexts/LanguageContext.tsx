
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('comparaia_lang');
    return (saved as Language) || 'pt';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('comparaia_lang', lang);
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  };

  const t = (path: string): string => {
    const keys = path.split('.');
    let current: any = translations[language];

    for (const key of keys) {
      if (current[key] === undefined) {
        console.warn(`Translation key not found: ${path} for language: ${language}`);
        return path;
      }
      current = current[key];
    }

    return current;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
