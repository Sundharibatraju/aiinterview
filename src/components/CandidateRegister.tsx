import React, { useState } from 'react';
import { X, Eye, EyeOff, ShieldCheck, Mail, Lock, User, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { directGoogleSignIn } from '../utils/googleAuth';

interface CandidateRegisterProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  onOpenOtp: (email: string) => void;
}

export const CandidateRegister: React.FC<CandidateRegisterProps> = ({
  isOpen,
  onClose,
  onSwitchToLogin,
  onOpenOtp,
}) => {
  const { googleLogin } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGoogleAccountUser, setIsGoogleAccountUser] = useState(false);

  if (!isOpen) return null;

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&#^()_\-+={}[\]:;"'<>,.?/\\|`~]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGoogleAccountUser(false);

    if (!isPasswordValid) {
      setError('Please satisfy all password security requirements.');
      return;
    }

    if (!passwordsMatch) {
      setError('Confirm password must match password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.isGoogleAccount) {
          setIsGoogleAccountUser(true);
          setError(data.error);
        } else {
          setError(data.error || 'Registration failed');
        }
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onClose();
      onOpenOtp(email);
    } catch (err) {
      setError('Connection error. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setIsGoogleLoading(true);

    await directGoogleSignIn({
      onStart: () => setIsGoogleLoading(true),
      onSuccess: async (profile) => {
        const res = await googleLogin(
          profile.email,
          profile.name,
          'register',
          'CANDIDATE',
          profile.picture,
          profile.sub
        );
        setIsGoogleLoading(false);
        if (res.success) {
          onClose();
        } else {
          setError(res.error || 'Google registration failed');
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-3">
            <User className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Candidate Registration</h2>
          <p className="text-xs text-slate-500 mt-1">Create your verified candidate account to attend AI interviews</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {isGoogleAccountUser && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Sign in with Google Now</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Your Name"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="candidate@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">One email = one account. OTP will be sent for verification.</p>
          </div>

          {/* Password with eye icon */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create strong password"
                className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password with eye icon */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Requirements Guide */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1 text-slate-600">
            <div className="font-semibold text-slate-700 mb-1">Password Security Rules:</div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                {hasMinLength && '✓'}
              </span>
              <span>Minimum 8 characters</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasUpper && hasLower ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                {hasUpper && hasLower && '✓'}
              </span>
              <span>Uppercase &amp; lowercase letters</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                {hasNumber && '✓'}
              </span>
              <span>At least one number</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasSpecial ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                {hasSpecial && '✓'}
              </span>
              <span>At least one special character</span>
            </div>
          </div>

          {/* Buttons: Verify Email */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? 'Sending Verification Code...' : 'Verify Email'}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 mx-3 text-[11px] text-slate-400 uppercase tracking-wider">or</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Continue with Google button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
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

        <div className="mt-6 text-center text-xs text-slate-500">
          Already registered?{' '}
          <button
            onClick={() => {
              onClose();
              onSwitchToLogin();
            }}
            className="text-blue-600 font-semibold hover:underline"
          >
            Please Login Instead
          </button>
        </div>
      </div>
    </div>
  );
};
