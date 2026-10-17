import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { directGoogleSignIn } from '../utils/googleAuth';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
  role?: 'CANDIDATE' | 'RECRUITER';
  onSwitchToLogin?: () => void;
  defaultEmail?: string;
  defaultName?: string;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  mode,
  role = 'CANDIDATE',
  onSwitchToLogin,
}) => {
  const { googleLogin } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGoogleAuth = async () => {
    setError(null);
    setIsAuthenticating(true);

    await directGoogleSignIn({
      onStart: () => setIsAuthenticating(true),
      onSuccess: async (profile) => {
        const res = await googleLogin(
          profile.email,
          profile.name,
          mode,
          role,
          profile.picture,
          profile.sub
        );
        setIsAuthenticating(false);
        if (res.success) {
          onClose();
        } else {
          setError(res.error || 'Authentication could not be completed.');
        }
      },
      onError: (err) => {
        setIsAuthenticating(false);
        setError(err);
      },
      onCancel: () => {
        setIsAuthenticating(false);
      },
    });
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Auto-trigger Google account popup when modal opens
      startGoogleAuth();
    } else {
      setIsAuthenticating(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-8 relative transition-all">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
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
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {mode === 'register' ? 'Register with Google' : 'Sign in with Google'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {role === 'RECRUITER'
              ? 'Connect your enterprise recruiter account directly with Google'
              : 'Directly authenticate with your verified Google account'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action button */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={startGoogleAuth}
            disabled={isAuthenticating}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs border border-slate-300 hover:border-slate-400 shadow-sm transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                <span>Select Google Account on Browser</span>
              </>
            )}
          </button>
        </div>

        {mode === 'register' && onSwitchToLogin && (
          <div className="text-center mt-5 text-xs text-slate-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToLogin();
              }}
              className="text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Sign In Instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
