import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, CandidateProfile } from '../types/index';

interface AuthContextType {
  user: User | null;
  token: string | null;
  profile: CandidateProfile | null;
  isLoading: boolean;
  loginCandidate: (email: string, pass: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean }>;
  loginRecruiter: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  googleLogin: (
    email: string,
    fullName?: string,
    action?: 'login' | 'register',
    role?: string,
    avatarUrl?: string,
    googleId?: string
  ) => Promise<{ success: boolean; error?: string; isPolicyIssue?: boolean; user?: any }>;
  logout: () => void;
  setAuthData: (token: string, user: User) => void;
  updateProfile: (data: Partial<CandidateProfile>) => Promise<boolean>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionToken = params.get('sessionToken');
      if (sessionToken) {
        localStorage.setItem('ai_interviewer_token', sessionToken);
        return sessionToken;
      }
      return localStorage.getItem('ai_interviewer_token');
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionUserParam = params.get('sessionUser');
      if (sessionUserParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(sessionUserParam));
          if (parsed && parsed.id) {
            localStorage.setItem('ai_interviewer_user', JSON.stringify(parsed));
            return parsed;
          }
        } catch {}
      }
      const savedUser = localStorage.getItem('ai_interviewer_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sessionToken') || params.get('sessionUser')) return false;
      const savedUser = localStorage.getItem('ai_interviewer_user');
      const savedToken = localStorage.getItem('ai_interviewer_token');
      if (savedUser && savedToken) return false;
    } catch {}
    return true;
  });

  // Clean up sessionToken and sessionUser query parameters from URL after picking them up
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let changed = false;
      if (params.has('sessionToken')) {
        params.delete('sessionToken');
        changed = true;
      }
      if (params.has('sessionUser')) {
        params.delete('sessionUser');
        changed = true;
      }
      if (changed) {
        const newSearch = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState({}, '', `${window.location.pathname}${newSearch}${window.location.hash}`);
      }
    } catch {}
  }, []);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        try {
          localStorage.setItem('ai_interviewer_user', JSON.stringify(data.user));
        } catch {}
        setProfile(data.profile || null);
      } else {
        localStorage.removeItem('ai_interviewer_token');
        localStorage.removeItem('ai_interviewer_user');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const setAuthData = (newToken: string, newUser: User) => {
    try {
      localStorage.setItem('ai_interviewer_token', newToken);
      localStorage.setItem('ai_interviewer_user', JSON.stringify(newUser));
    } catch {}
    setToken(newToken);
    setUser(newUser);
  };

  const loginCandidate = async (email: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Login failed',
          requiresVerification: data.requiresVerification,
        };
      }
      setAuthData(data.token, data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Network error during login' };
    }
  };

  const loginRecruiter = async (email: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login-recruiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Recruiter login failed' };
      }
      setAuthData(data.token, data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Connection failure' };
    }
  };

  const googleLogin = async (
    email: string,
    fullName?: string,
    action?: 'login' | 'register',
    role?: string,
    avatarUrl?: string,
    googleId?: string
  ) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, action, role, avatarUrl, googleId }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Google authorization failed',
          isPolicyIssue: res.status === 409 || (data.error && data.error.includes('Policy Issue')),
        };
      }
      setAuthData(data.token, data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: 'Google sign-in error' };
    }
  };

  const logout = () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('ai_interviewer_token');
    localStorage.removeItem('ai_interviewer_user');
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (data: Partial<CandidateProfile>) => {
    if (!token) return false;
    try {
      const res = await fetch('/api/candidate/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        setProfile(json.profile);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  const refreshAuth = async () => {
    if (token) await fetchCurrentUser(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        profile,
        isLoading,
        loginCandidate,
        loginRecruiter,
        googleLogin,
        logout,
        setAuthData,
        updateProfile,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
