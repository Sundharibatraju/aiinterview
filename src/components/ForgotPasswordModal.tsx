import React, { useState, useEffect } from 'react';
import { X, KeyRound, Mail, Lock, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessReturnToLogin: () => void;
  initialEmail?: string;
  role?: 'CANDIDATE' | 'RECRUITER';
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccessReturnToLogin,
  initialEmail = '',
  role,
}) => {
  const [step, setStep] = useState<'REQUEST_OTP' | 'VERIFY_AND_RESET'>('REQUEST_OTP');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 mins

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (!isOpen) {
      setStep('REQUEST_OTP');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step !== 'VERIFY_AND_RESET') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        setError(data.error || 'Failed to request password reset code.');
        return;
      }

      setSuccessMsg('A 6-digit password reset verification code has been dispatched to your email.');
      setStep('VERIFY_AND_RESET');
      setTimeLeft(600);
    } catch (err) {
      setIsLoading(false);
      setError('Connection failure. Please check your network.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (otp.trim().length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Confirm password must match the new password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        setError(data.error || 'Failed to reset password.');
        return;
      }

      setSuccessMsg('Your password has been successfully updated! You can now log in.');
      setTimeout(() => {
        onClose();
        onSuccessReturnToLogin();
      }, 1500);
    } catch (err) {
      setIsLoading(false);
      setError('Connection failure while resetting password.');
    }
  };

  const handleResend = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      setIsLoading(false);
      if (res.ok) {
        setSuccessMsg('A fresh verification code has been sent to your email.');
        setTimeLeft(600);
      } else {
        setError(data.error || 'Could not resend code.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Network error while resending code.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {step === 'REQUEST_OTP' ? 'Reset Password' : 'Set New Password'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {step === 'REQUEST_OTP'
              ? 'Enter your registered email address to receive a secure recovery code'
              : 'Enter the code received in your email along with your new password'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'REQUEST_OTP' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? 'Sending Recovery Code...' : 'Send Recovery OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Email</label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                6-Digit Reset OTP
              </label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                required
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full tracking-[0.5em] text-center font-mono text-xl py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-bold text-slate-900"
              />
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5 px-1">
                <span>Expires in: <strong className="text-slate-800 font-mono">{formattedTime}</strong></span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Resend Code
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? 'Updating Password...' : 'Save New Password & Continue'}
            </button>
          </form>
        )}

        <div className="mt-5 text-center text-xs text-slate-500">
          Remember your password?{' '}
          <button
            onClick={() => {
              onClose();
              onSuccessReturnToLogin();
            }}
            className="text-blue-600 font-semibold hover:underline cursor-pointer"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
