
import React from 'react';
import Navbar from './Navbar';
import Hero from './Hero';
import SocialProof from './SocialProof';
import HowItWorks from './HowItWorks';
import UseCases from './UseCases';
import Features from './Features';
import Pricing from './Pricing';
import FAQ from './FAQ';
import ContactForm from './ContactForm';
import Footer from './Footer';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onRegister }) => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 scroll-smooth">
      <Navbar onLogin={onLogin} onRegister={onRegister} />
      <Hero onRegister={onRegister} />
      <SocialProof />
      <HowItWorks />
      <UseCases />
      <Features />
      <Pricing onRegister={onRegister} />
      <FAQ />
      <ContactForm />
      <Footer />
    </div>
  );
};

export default LandingPage;
