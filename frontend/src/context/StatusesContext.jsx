import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { PRODUCT_STATUSES as FALLBACK } from '../lib/api';
import { useAuth } from './AuthContext';

const StatusesContext = createContext({ statuses: FALLBACK, builtin: FALLBACK, custom: [], protected: ['Pending', 'Delivered'], refresh: () => {} });

export function StatusesProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState({ statuses: FALLBACK, builtin: FALLBACK, custom: [], protected: ['Pending', 'Delivered'] });

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/statuses');
      setData(r.data);
    } catch (e) { /* keep fallback */ }
  }, []);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  return (
    <StatusesContext.Provider value={{ ...data, refresh }}>
      {children}
    </StatusesContext.Provider>
  );
}

export function useStatuses() { return useContext(StatusesContext); }
