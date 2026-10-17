import React, { useState } from 'react';
import { X, Building2, Lock, Mail, User, AlertCircle, Briefcase, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { directGoogleSignIn } from '../utils/googleAuth';

interface RecruiterLoginProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRedirect: () => void;
}

export const RecruiterLogin: React.FC<RecruiterLoginProps> = ({
  isOpen,
  onClose,
  onSuccessRedirect,
}) => {
  const { loginRecruiter, googleLogin, setAuthData } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  if (!isOpen) return null;

  const handleGoogleAuth = async (mode: 'login' | 'register') => {
    setError(null);
    setIsGoogleLoading(true);

    await directGoogleSignIn({
      onStart: () => setIsGoogleLoading(true),
      onSuccess: async (profile) => {
        const res = await googleLogin(
          profile.email,
          profile.name,
          mode,
          'RECRUITER',
          profile.picture,
          profile.sub
        );
        setIsGoogleLoading(false);
        if (res.success) {
          onClose();
          onSuccessRedirect();
        } else {
          setError(res.error || 'Google recruiter authentication failed');
        }
      },
      onError: (err) => {
        setIsGoogleLoading(false);
        setError(err);
      },
      onCancel: () => {
        setIsGoogleLoading(false);
      },
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await loginRecruiter(email, password);
    setIsLoading(false);

    if (res.success) {
      onClose();
      onSuccessRedirect();
    } else {
      setError(res.error || 'Recruiter login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register-recruiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, companyName, designation }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        setError(data.error || 'Recruiter registration failed');
        return;
      }

      setAuthData(data.token, data.user);
      onClose();
      onSuccessRedirect();
    } catch (err) {
      setIsLoading(false);
      setError('Connection failure');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isRegisterMode ? 'Recruiter Registration' : 'Recruiter Portal'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isRegisterMode
              ? 'Establish company hiring portal and post active opportunities'
              : 'Sign in to review applicant assessments, telemetry, and reports'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isRegisterMode ? (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Recruiter Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="priya@company.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. TechNova Systems"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                placeholder="Senior Talent Partner"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create password"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 text-xs outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? 'Creating Account...' : 'Register Company Portal'}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="shrink-0 mx-3 text-[11px] text-slate-400 uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={() => handleGoogleAuth('register')}
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Register with Google</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="recruiter@technova.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Recruiter Portal'}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="shrink-0 mx-3 text-[11px] text-slate-400 uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={() => handleGoogleAuth('login')}
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-500">
          {isRegisterMode ? (
            <span>
              Already have recruiter access?{' '}
              <button
                onClick={() => setIsRegisterMode(false)}
                className="text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              New enterprise recruiter?{' '}
              <button
                onClick={() => setIsRegisterMode(true)}
                className="text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Register Company
              </button>
            </span>
          )}
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        initialEmail={email}
        role="RECRUITER"
        onSuccessReturnToLogin={() => {
          setForgotPasswordOpen(false);
          setIsRegisterMode(false);
        }}
      />
    </div>
  );
};
