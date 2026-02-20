import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { fluxerAPI, type AuthResponse } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isIpAuthorizationRequired = (response: any): response is { ip_authorization_required: true; ticket: string; email: string } => {
  return !!response && response.ip_authorization_required === true;
};

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

const isUser = (value: any): value is User => {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.username === 'string' &&
    typeof value.email === 'string'
  );
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  captchaToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  ipAuthTicket: string | null;
  ipAuthEmail: string | null;
  setCaptchaToken: (token: string) => void;
  login: (email: string, password: string, captchaToken?: string) => Promise<any>;
  logout: () => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  pollIpAuthorization: (ticket: string) => Promise<{ completed: boolean; token?: string; user_id?: string }>;
  resendIpAuthorization: (ticket: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  captchaToken: null,
  isLoading: false,
  isInitialized: false,
  ipAuthTicket: null,
  ipAuthEmail: null,
  setCaptchaToken: () => {},
  login: async () => {},
  logout: async () => {},
  register: async () => {},
  pollIpAuthorization: async () => ({ completed: false }),
  resendIpAuthorization: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [ipAuthTicket, setIpAuthTicket] = useState<string | null>(null);
  const [ipAuthEmail, setIpAuthEmail] = useState<string | null>(null);

  // Initialize from storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('fluxer_token');
        const storedUser = await AsyncStorage.getItem('fluxer_user');
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          fluxerAPI.setToken(storedToken);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string, captchaTokenParam?: string) => {
    setIsLoading(true);
    try {
      const tokenToUse = captchaTokenParam || captchaToken;
      console.log('[AuthContext] Login attempt with captcha token:', tokenToUse ? tokenToUse.substring(0, 20) + '...' : 'none');
      
      const response = await fluxerAPI.login(email, password, tokenToUse || undefined);
      
      // Check if IP authorization is required
      if (isIpAuthorizationRequired(response)) {
        console.log('[AuthContext] IP authorization required, storing ticket and email');
        setIpAuthTicket(response.ticket);
        setIpAuthEmail(response.email);
        // Return the response so caller knows IP auth is required
        return response;
      }
      
      // Normal login response
      const authResponse = response as AuthResponse;
      console.log('[AuthContext] Login successful');
      setToken(authResponse.token);
      fluxerAPI.setToken(authResponse.token);
      setCaptchaToken(null); // Clear captcha token after successful login
      
      await AsyncStorage.setItem('fluxer_token', authResponse.token);

      // Some endpoints return only {token, user_id}. In that case, fetch the profile.
      const resolvedUserCandidate = authResponse.user || (await fluxerAPI.getCurrentUser().catch(() => null));
      if (isUser(resolvedUserCandidate)) {
        setUser(resolvedUserCandidate);
        await AsyncStorage.setItem('fluxer_user', JSON.stringify(resolvedUserCandidate));
      }
      
      return authResponse;
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('fluxer_token');
      await AsyncStorage.removeItem('fluxer_user');
    } catch (error) {
      console.error('Logout storage error:', error);
    }
    setUser(null);
    setToken(null);
    setCaptchaToken(null);
    fluxerAPI.setToken('');
  };

  const register = async (email: string, password: string, username: string) => {
    setIsLoading(true);
    try {
      const response = await fluxerAPI.register(email, password, username, captchaToken || undefined);
      if (!isUser((response as any).user)) {
        throw new Error('Registration succeeded but user profile is missing');
      }
      setUser((response as any).user);
      setToken(response.token);
      fluxerAPI.setToken(response.token);
      setCaptchaToken(null);
      
      await AsyncStorage.setItem('fluxer_token', response.token);
      await AsyncStorage.setItem('fluxer_user', JSON.stringify((response as any).user));
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const pollIpAuthorization = async (ticket: string) => {
    try {
      const result = await fluxerAPI.pollIpAuthorization(ticket);

      if (!result.completed) {
        // Not approved yet; let the caller keep polling.
        throw new Error('IP_AUTHORIZATION_REQUIRED');
      }

      if (result.token) {
        setToken(result.token);
        fluxerAPI.setToken(result.token);
        await AsyncStorage.setItem('fluxer_token', result.token);

        const resolvedUserCandidate = await fluxerAPI.getCurrentUser().catch(() => null);
        if (isUser(resolvedUserCandidate)) {
          setUser(resolvedUserCandidate);
          await AsyncStorage.setItem('fluxer_user', JSON.stringify(resolvedUserCandidate));
        }
      }

      // Clear IP auth state on completion (token may already be stored above)
      setIpAuthTicket(null);
      setIpAuthEmail(null);

      return result;
    } catch (error) {
      console.error('IP authorization polling error:', error);
      throw error;
    }
  };

  const resendIpAuthorization = async (ticket: string) => {
    try {
      await fluxerAPI.resendIpAuthorization(ticket);
      console.log('IP authorization email resent');
    } catch (error) {
      console.error('IP authorization resend error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, captchaToken, isLoading, isInitialized, ipAuthTicket, ipAuthEmail, setCaptchaToken, login, logout, register, pollIpAuthorization, resendIpAuthorization }}>
      {children}
    </AuthContext.Provider>
  );
};
