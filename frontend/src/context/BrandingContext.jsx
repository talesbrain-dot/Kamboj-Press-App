import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

const BrandingContext = createContext(null);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState({ app_name: 'Press Order Book', company_name: '', logo_base64: '' });

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/branding');
      setBranding({
        app_name: r.data.app_name || 'Press Order Book',
        company_name: r.data.company_name || '',
        logo_base64: r.data.logo_base64 || '',
      });
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    // refresh every 60s in case of updates
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  // update document title
  useEffect(() => {
    if (branding.app_name) document.title = branding.app_name;
  }, [branding.app_name]);

  return (
    <BrandingContext.Provider value={{ ...branding, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() { return useContext(BrandingContext); }
