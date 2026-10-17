import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Mail, CheckCircle2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onVerifiedSuccess: () => void;
}

export const OtpModal: React.FC<OtpModalProps> = ({
  isOpen,
  onClose,
  email,
  onVerifiedSuccess,
}) => {
  const { setAuthData } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setIsLoading(false);
        return;
      }

      setAuthData(data.token, data.user);
      setSuccessMsg('Email verified successfully! Activating your candidate portal...');
      setTimeout(() => {
        setIsLoading(false);
        onClose();
        onVerifiedSuccess();
      }, 1000);
    } catch (err) {
      setError('Connection failure during verification.');
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not resend code');
      } else {
        setSuccessMsg('A new 6-digit code has been dispatched to your email.');
        setTimeLeft(600);
      }
    } catch (err) {
      setError('Failed to resend code');
    } finally {
      setIsLoading(false);
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

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-3">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Verify Your Email</h2>
          <p className="text-xs text-slate-500 mt-1">
            We sent a 6-digit verification code to <span className="font-semibold text-slate-800">{email}</span>
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

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">
              Enter 6-Digit OTP Code
            </label>
            <input
              type="text"
              maxLength={6}
              autoFocus
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full tracking-[0.6em] text-center font-mono text-2xl py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition font-bold text-slate-900"
            />
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1">
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

          {/* Section 8 Mandate: Interview Do's and Don'ts checklist */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left text-xs space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Autonomous Interview Integrity Standards</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="space-y-1">
                <span className="font-semibold text-emerald-700 block">Do's:</span>
                <p className="text-slate-600">• Working camera &amp; mic</p>
                <p className="text-slate-600">• Quiet environment</p>
                <p className="text-slate-600">• Answer independently</p>
                <p className="text-slate-600">• Stable internet connection</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-rose-700 block">Don'ts:</span>
                <p className="text-slate-600">• Switch tabs or windows</p>
                <p className="text-slate-600">• External AI assistance</p>
                <p className="text-slate-600">• Share access code or OTP</p>
                <p className="text-slate-600">• Leave camera view</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? 'Verifying...' : 'Verify OTP & Activate Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
