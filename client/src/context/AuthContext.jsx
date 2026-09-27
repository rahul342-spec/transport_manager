import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onLogout = () => { setUser(null); setBusiness(null); };
    window.addEventListener('tm:logout', onLogout);
    if (!getToken()) {
      setReady(true);
    } else {
      api('/auth/me')
        .then((r) => { setUser(r.user); setBusiness(r.business); })
        .catch(() => setToken(null))
        .finally(() => setReady(true));
    }
    return () => window.removeEventListener('tm:logout', onLogout);
  }, []);

  const accept = (r) => {
    setToken(r.token);
    setUser(r.user);
    setBusiness(r.business);
  };

  const value = {
    user,
    business,
    ready,
    setBusiness,
    login: async (email, password) => accept(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (form) => accept(await api('/auth/register', { method: 'POST', body: form })),
    logout: () => { setToken(null); setUser(null); setBusiness(null); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
