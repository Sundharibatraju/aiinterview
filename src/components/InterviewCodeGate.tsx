import React, { useState } from 'react';
import { KeyRound, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2, Lock, Code2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InterviewRegistration } from '../types/index';

interface InterviewCodeGateProps {
  initialCode?: string;
  onCodeValidated: (registration: InterviewRegistration) => void;
  onBackToInterviews: () => void;
}

export const InterviewCodeGate: React.FC<InterviewCodeGateProps> = ({
  initialCode = '',
  onCodeValidated,
  onBackToInterviews,
}) => {
  const { user, token } = useAuth();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [isTechCode, setIsTechCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsTechCode(false);
    if (!code.trim()) {
      setError('Please enter your interview access code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/interview/validate-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ interviewCode: code.trim().toUpperCase() }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        setError(data.error || 'Access validation failed');
        if (data.isTechnicalCode) {
          setIsTechCode(true);
        }
        return;
      }

      onCodeValidated(data.registration);
    } catch (err) {
      setIsLoading(false);
      setError('Network failure during verification');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        {/* Key Icon */}
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-200 shadow-sm">
          <KeyRound className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900">Enter Interview Access Code</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
          Please input the confidential 14-character alphanumeric code sent to your registered email address ({user?.email}).
        </p>

        {error && (
          <div className="mt-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col gap-2.5 text-left">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold block">Access Verification Blocked:</strong>
                {error}
              </div>
            </div>
            {isTechCode && (
              <button
                type="button"
                onClick={onBackToInterviews}
                className="mt-1 self-start px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Go to My Interviews & View External Assessment Details</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleValidate} className="mt-6 space-y-4">
          <div>
            <input
              type="text"
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. TN-JAVA-7K4M92"
              className="w-full text-center font-mono tracking-wider text-xl sm:text-2xl py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none uppercase font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-normal"
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1 text-slate-600">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Automated Verification Protocol</span>
            </div>
            <p>• Code must be assigned specifically to your verified email</p>
            <p>• Position must be actively accepting technical evaluations</p>
            <p>• Single-use session lock prevents duplicate submissions</p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? 'Verifying Credentials...' : 'Proceed to System Readiness Check'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <button
          onClick={onBackToInterviews}
          className="mt-6 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          &larr; Back to My Interviews
        </button>
      </div>
    </div>
  );
};
