import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api, type ApiError } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'delivery_agent' | 'billing_staff' | 'read_only';
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuthProvider(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check session on mount
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ user: User }>('/api/auth/me')
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        // Not authenticated — that's fine
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const data = await api.post<{ user: User }>('/api/auth/login', { email, password });
      setUser(data.user);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Login failed');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore logout errors
    }
    setUser(null);
  }, []);

  return { user, loading, error, login, logout };
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
