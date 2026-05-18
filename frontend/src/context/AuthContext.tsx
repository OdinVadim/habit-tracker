import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User, AuthResponse } from '../types';
import {
  login,
  requestRegisterOtp,
  verifyRegisterOtp,
  verifyLoginOtp,
  getMe,
} from '../services/api';

export const LOGIN_OTP_REQUIRED = 'LOGIN_OTP_REQUIRED';
export const REGISTER_OTP_REQUIRED = 'REGISTER_OTP_REQUIRED';

const PENDING_LOGIN_KEY = 'pending_login_id';
const PENDING_REGISTER_EMAIL_KEY = 'pending_register_email';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (identifier: string, password: string) => Promise<void>;
  registerStep1: (email: string, username: string, password: string) => Promise<void>;
  verifyLoginEmailOtp: (code: string) => Promise<void>;
  verifyRegisterEmailOtp: (email: string, code: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pendingLoginIdentifierRef = useRef<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser) as User);
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  function persistAuth(response: AuthResponse) {
    localStorage.setItem('auth_token', response.access_token);
    localStorage.setItem('auth_user', JSON.stringify(response.user));
    setToken(response.access_token);
    setUser(response.user);
  }

  async function handleLogin(identifier: string, password: string) {
    try {
      setIsLoading(true);
      setError(null);

      const trimmed = identifier.trim();
      pendingLoginIdentifierRef.current = trimmed;
      sessionStorage.setItem(PENDING_LOGIN_KEY, trimmed);

      const response = await login(trimmed, password);
      if (response.message === 'OTP_SENT') {
        throw new Error(LOGIN_OTP_REQUIRED);
      }
      throw new Error('Неожиданный ответ сервера');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка входа';
      if (
        message === LOGIN_OTP_REQUIRED ||
        message.includes('повторной отправкой')
      ) {
        throw new Error(LOGIN_OTP_REQUIRED);
      }
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegisterStep1(email: string, username: string, password: string) {
    try {
      setIsLoading(true);
      setError(null);

      const trimmedEmail = email.trim();
      sessionStorage.setItem(PENDING_REGISTER_EMAIL_KEY, trimmedEmail);
      await requestRegisterOtp({ email: trimmedEmail, username, password });
      throw new Error(REGISTER_OTP_REQUIRED);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка регистрации';
      if (message === REGISTER_OTP_REQUIRED) {
        throw err;
      }
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyLoginEmailOtp(code: string) {
    const identifier =
      pendingLoginIdentifierRef.current || sessionStorage.getItem(PENDING_LOGIN_KEY);
    if (!identifier) {
      const message = 'Сначала введите логин и пароль (или нажмите «У меня уже есть код»)';
      setError(message);
      throw new Error(message);
    }

    try {
      const response: AuthResponse = await verifyLoginOtp(identifier, code);
      pendingLoginIdentifierRef.current = null;
      sessionStorage.removeItem(PENDING_LOGIN_KEY);
      persistAuth(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неверный код';
      setError(message);
      throw err;
    }
  }

  async function handleVerifyRegisterEmailOtp(email: string, code: string) {
    try {
      const response: AuthResponse = await verifyRegisterOtp(email.trim(), code);
      sessionStorage.removeItem(PENDING_REGISTER_EMAIL_KEY);
      persistAuth(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неверный код';
      setError(message);
      throw err;
    }
  }

  function handleLogout() {
    pendingLoginIdentifierRef.current = null;
    sessionStorage.removeItem(PENDING_LOGIN_KEY);
    sessionStorage.removeItem(PENDING_REGISTER_EMAIL_KEY);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    if (!token) return;

    try {
      const userData = await getMe(token);
      setUser(userData);
      localStorage.setItem('auth_user', JSON.stringify(userData));
    } catch {
      handleLogout();
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login: handleLogin,
        registerStep1: handleRegisterStep1,
        verifyLoginEmailOtp: handleVerifyLoginEmailOtp,
        verifyRegisterEmailOtp: handleVerifyRegisterEmailOtp,
        logout: handleLogout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
