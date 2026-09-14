
import React, { useEffect, useState } from 'react';

interface LogoProps {
  className?: string;
  variant?: 'color' | 'white';
  showText?: boolean;
  disableCustom?: boolean;
}

let cachedPublicConfig: any = null;
let publicConfigPromise: Promise<any> | null = null;

const loadPublicConfigOnce = async () => {
  if (cachedPublicConfig) return cachedPublicConfig;
  if (!publicConfigPromise) {
    publicConfigPromise = fetch('/api/config/public')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .finally(() => {
        publicConfigPromise = null;
      });
  }
  const result = await publicConfigPromise;
  if (result) cachedPublicConfig = result;
  return result;
};

const Logo: React.FC<LogoProps> = ({
  className = "w-8 h-8",
  variant = 'color',
  showText = false,
  disableCustom = false
}) => {
  const primaryColor = variant === 'color' ? '#1A202C' : '#ffffff';
  const secondaryColor = variant === 'color' ? '#10b981' : '#a7f3d0';
  const strokeColor = variant === 'color' ? '#ffffff' : '#1A202C';

  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applyConfig = (config: any) => {
      if (cancelled) return;
      const logo =
        config?.branding?.logoUrl ||
        config?.branding?.logo_url ||
        config?.logoUrl ||
        config?.logo_url ||
        null;
      setCustomLogoUrl(logo || null);
    };

    const loadLogo = async () => {
      try {
        const configStr = localStorage.getItem('comparaia_config');
        if (configStr) {
          const config = JSON.parse(configStr);
          applyConfig(config);
          return;
        }
      } catch {
        // ignore and try network
      }

      try {
        const cfg = await loadPublicConfigOnce();
        if (!cfg) return;
        if (cancelled) return;
        try {
          localStorage.setItem('comparaia_config', JSON.stringify(cfg));
          window.dispatchEvent(new Event('comparaia_config_updated'));
        } catch {
          // ignore storage errors
        }
        applyConfig(cfg);
      } catch {
        // ignore fetch errors
      }
    };

    const storageHandler = (event: StorageEvent) => {
      if (!event || event.key === 'comparaia_config') {
        loadLogo();
      }
    };

    const configHandler = () => loadLogo();

    loadLogo();
    window.addEventListener('storage', storageHandler);
    window.addEventListener('comparaia_config_updated', configHandler);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', storageHandler);
      window.removeEventListener('comparaia_config_updated', configHandler);
    };
  }, []);

  if (customLogoUrl && !disableCustom) {
      return (
          <div className="flex items-center gap-2">
              <img
                src={customLogoUrl}
                alt="Logo"
                className={`${className} object-contain`}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
              />
              {showText && (
                <div className="flex flex-col justify-center leading-none">
                  <span className={`font-black tracking-tighter text-2xl ${variant === 'color' ? 'text-slate-900' : 'text-white'}`}>
                    COMPARA
                  </span>
                  <span className={`font-black tracking-[0.3em] text-xs ${variant === 'color' ? 'text-emerald-600' : 'text-emerald-300'}`}>
                    IA
                  </span>
                </div>
              )}
          </div>
      );
  }

  return (
    <div className="flex items-center gap-3">
      <svg 
        viewBox="0 0 40 40" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className={className}
        aria-label="COMPARA IA Logo"
      >
        <rect x="8" y="8" width="8" height="24" rx="3" fill={primaryColor} />
        <rect x="24" y="8" width="8" height="24" rx="3" fill={secondaryColor} />
        <circle cx="20" cy="20" r="7" fill="white" stroke={primaryColor} strokeWidth="0.5" />
        <circle cx="20" cy="20" r="4.5" fill={primaryColor} />
        <path d="M16 20H12" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 20H24" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      
      {showText && (
        <div className="flex flex-col justify-center leading-none">
          <span className={`font-black tracking-tighter text-2xl ${variant === 'color' ? 'text-slate-900' : 'text-white'}`}>
            COMPARA
          </span>
          <span className={`font-black tracking-[0.3em] text-[10px] ${variant === 'color' ? 'text-emerald-600' : 'text-emerald-300'}`}>
            IA
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
