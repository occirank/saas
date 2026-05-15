import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'occirank_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    axios.get('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      if (!res.data.valid) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    }).catch(() => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }).finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (password: string) => {
    const res = await axios.post('/api/auth/login', { password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setToken(res.data.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
