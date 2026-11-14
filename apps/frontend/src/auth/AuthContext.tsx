import {
  AuthResponseDto,
  AuthUserDto,
  LoginDto,
  RegisterDto,
} from '@envioya/shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../lib/api';

interface AuthContextValue {
  user: AuthUserDto | null;
  loading: boolean;
  login: (dto: LoginDto) => Promise<AuthUserDto>;
  register: (dto: RegisterDto) => Promise<AuthUserDto>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api<AuthResponseDto>('/auth/me');
      setUser(response.usuario);
    } catch {
      // Sin sesión válida (401) o backend caído: se muestra el login.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (dto: LoginDto) => {
    const response = await api<AuthResponseDto>('/auth/login', {
      method: 'POST',
      body: dto,
    });
    setUser(response.usuario);
    return response.usuario;
  }, []);

  const register = useCallback(async (dto: RegisterDto) => {
    const response = await api<AuthResponseDto>('/auth/register', {
      method: 'POST',
      body: dto,
    });
    setUser(response.usuario);
    return response.usuario;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api<{ mensaje: string }>('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
