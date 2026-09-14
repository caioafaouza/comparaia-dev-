import React, { useState, useEffect } from 'react';
import Logo from '../Logo';

interface NavbarProps {
  onLogin: () => void;
  onRegister: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLogin, onRegister }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/50 py-3 shadow-sm' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <Logo className="w-8 h-8 transition-transform group-hover:scale-105" showText={true} />
        </div>

        <div className="hidden md:flex items-center space-x-1 bg-slate-100/50 p-1 rounded-full border border-slate-200/50 backdrop-blur-sm">
          <button onClick={() => scrollToSection('how-it-works')} className="px-4 py-1.5 text-sm font-medium text-slate-600 rounded-full hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all">Como funciona</button>
          <button onClick={() => scrollToSection('solutions')} className="px-4 py-1.5 text-sm font-medium text-slate-600 rounded-full hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all">Para quem é</button>
          <button onClick={() => scrollToSection('features')} className="px-4 py-1.5 text-sm font-medium text-slate-600 rounded-full hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all">Recursos</button>
          <button onClick={() => scrollToSection('pricing')} className="px-4 py-1.5 text-sm font-medium text-slate-600 rounded-full hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all">Planos</button>
          <button onClick={() => scrollToSection('contact')} className="px-4 py-1.5 text-sm font-medium text-slate-600 rounded-full hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all">Contato</button>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={onLogin} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Entrar</button>
          <button onClick={onRegister} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-indigo-600 transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2">
            Começar grátis
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="md:hidden flex items-center">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-600 p-2 focus:outline-none bg-slate-100 rounded-lg">
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white/95 backdrop-blur-xl shadow-xl border-b border-slate-100 p-6 flex flex-col gap-4 animate-fade-in">
          <div className="flex flex-col space-y-2">
            <button onClick={() => scrollToSection('how-it-works')} className="text-left text-slate-600 font-medium py-3 border-b border-slate-50 hover:text-indigo-600">Como funciona</button>
            <button onClick={() => scrollToSection('solutions')} className="text-left text-slate-600 font-medium py-3 border-b border-slate-50 hover:text-indigo-600">Para quem é</button>
            <button onClick={() => scrollToSection('features')} className="text-left text-slate-600 font-medium py-3 border-b border-slate-50 hover:text-indigo-600">Recursos</button>
            <button onClick={() => scrollToSection('pricing')} className="text-left text-slate-600 font-medium py-3 border-b border-slate-50 hover:text-indigo-600">Planos</button>
            <button onClick={() => scrollToSection('contact')} className="text-left text-slate-600 font-medium py-3 border-b border-slate-50 hover:text-indigo-600">Contato</button>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <button onClick={onLogin} className="w-full text-center py-3 text-slate-700 font-bold border border-slate-200 rounded-xl hover:bg-slate-50">Entrar</button>
            <button onClick={onRegister} className="w-full text-center py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700">Começar grátis</button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
