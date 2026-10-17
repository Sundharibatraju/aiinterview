import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Globe,
  Laptop,
  ShieldCheck,
  Info,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { InterviewRegistration, RoundStatus } from '../types/index';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

interface TechnicalAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: InterviewRegistration | null;
  onAssessmentCompleted?: () => void;
  onProceedToInterview?: (code: string) => void;
}

export const TechnicalAssessmentModal: React.FC<TechnicalAssessmentModalProps> = ({
  isOpen,
  onClose,
  registration,
  onAssessmentCompleted,
  onProceedToInterview,
}) => {
  const { user } = useAuth();
  const { showSuccess } = useNotification();
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  if (!isOpen || !registration) return null;

  const candidateEmail = registration.candidate?.email || user?.email || 'your registered email';
  const techCode = registration.technicalAssessmentCode || registration.interviewCode || 'N/A';
  const jobTitle = registration.job?.title || 'Selected Role';
  const companyName = registration.job?.company?.name || 'Hiring Organization';

  // Check if Round 2 is already qualified or rejected
  const r2 = registration.roundProgression?.find(
    r => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT'
  );
  const isR2Qualified = r2?.status === RoundStatus.QUALIFIED;
  const isR2Rejected = r2?.status === RoundStatus.REJECTED;
  const isAttemptCompleted = Boolean(
    (registration.attemptCount && registration.attemptCount >= 1) ||
    registration.technicalAssessmentCompleted ||
    isR2Qualified ||
    isR2Rejected
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(techCode);
    setCopiedCode(true);
    showSuccess('12-digit Technical Assessment Code copied to clipboard!', 'Code Copied');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleSyncStatus = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/candidate/sync-assessment/${registration.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.success && data.registration) {
        const r2Updated = data.registration.roundProgression?.find(
          (r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT'
        );
        if (r2Updated?.status === 'QUALIFIED') {
          showSuccess(
            `Exam verified! Your score of ${r2Updated.score}% qualifies you. Round 3 AI Interview is now unlocked!`,
            'Round 2 Cleared'
          );
          if (onAssessmentCompleted) onAssessmentCompleted();
        } else if (r2Updated?.status === 'REJECTED') {
          const isMalpractice = (r2Updated.score != null && r2Updated.score >= (r2Updated.minQualifyingScore || 60)) ||
            r2Updated.feedback?.toLowerCase().includes('malpractice') ||
            data.registration?.interviewStatus === 'MALPRACTICE_TERMINATED';
          if (isMalpractice) {
            setSyncStatusMsg(`Exam result found: Scored ${r2Updated.score || 0}%, but submission was disqualified by anti-malpractice proctoring protocols.`);
          } else {
            setSyncStatusMsg(`Exam result found: Score ${r2Updated.score || 0}% did not meet qualifying cutoff (${r2Updated.minQualifyingScore || 60}%).`);
          }
        } else {
          setSyncStatusMsg('Exam still in progress or not yet submitted on the external portal. Finish the test first, then click here.');
        }
      } else {
        setSyncStatusMsg('No submission found yet on the external portal. Complete the test on your browser first.');
      }
    } catch {
      setSyncStatusMsg('Could not check status right now. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-fadeIn my-auto">
        {/* Top Header */}
        <div className="px-6 py-5 bg-linear-to-r from-purple-700 via-indigo-700 to-blue-700 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[11px] font-bold tracking-wider uppercase text-purple-100 flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              Round 2 • External Technical Assessment
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Technical Assessment Portal Notice
          </h3>
          <p className="text-purple-100 text-xs mt-1">
            Official examination schedule &amp; browser access instructions for <strong className="text-white">{jobTitle}</strong> at <strong className="text-white">{companyName}</strong>.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* If already cleared */}
          {isR2Qualified ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Round 2 Technical Assessment Cleared!</h4>
                <p className="text-xs text-emerald-800">
                  You have already successfully qualified Round 2 ({r2?.score != null ? `Score: ${r2.score}%` : 'Cutoff Met'}). Your Stage 3 AI Technical Interview is unlocked and ready to attend.
                </p>
                {onProceedToInterview && (
                  <button
                    onClick={() => {
                      onClose();
                      onProceedToInterview(registration.interviewCode);
                    }}
                    className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Proceed to AI Technical Interview</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : isR2Rejected ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm">
                  {r2?.score != null && r2.score >= (r2.minQualifyingScore || 60)
                    ? 'Disqualified by Anti-Malpractice Proctoring Protocol'
                    : 'Technical Assessment Cutoff Not Met'}
                </h4>
                <p className="text-xs text-rose-800">
                  {r2?.score != null && r2.score >= (r2.minQualifyingScore || 60)
                    ? `Candidate scored ${r2.score}% (Cutoff was ${r2.minQualifyingScore || 60}%), but the session was flagged and disqualified by proctoring violations: ${r2?.feedback || 'Webcam or window blur violation detected'}.`
                    : (r2?.feedback || 'The candidate score for this assessment was below the required qualifying cutoff threshold.')}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* PRIMARY USER MESSAGE (Exact wording requested by user) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 text-amber-950 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm sm:text-base">
                  <span className="w-7 h-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                    <Laptop className="w-4 h-4" />
                  </span>
                  <span>Exam is Scheduled on Another Portal</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-amber-900/90 leading-relaxed pl-9">
                  The Technical Assessment for this opportunity is not taken on this website. The exam is scheduled on the external assessment portal. Please check your registered email ID and navigate to the browser to clear it.
                </p>
              </div>

              {/* Assessment Credentials Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Registered Email ID */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Registered Email Address</span>
                  </div>
                  <p className="font-mono text-xs sm:text-sm font-bold text-slate-900 break-all select-all">
                    {candidateEmail}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Check your inbox &amp; spam folder for the link
                  </span>
                </div>

                {/* 12-Digit Assessment Code */}
                <div className="p-3.5 bg-purple-50/70 rounded-2xl border border-purple-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-purple-700 text-[11px] font-bold uppercase tracking-wider">
                      <Code2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>12-Digit Assessment Code</span>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-2 py-0.5 text-[10px] font-bold text-purple-700 bg-white border border-purple-300 hover:bg-purple-100 rounded-md transition flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-sm sm:text-base font-black text-purple-950 tracking-wider select-all">
                    {techCode}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    Required to login into the external examination portal
                  </span>
                </div>
              </div>

              {/* Direct Link Button: TO write the technical Assesment -> Click Here */}
              <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 text-center space-y-2">
                <a
                  href="https://technicalassesment-1081785547021.asia-southeast1.run.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-indigo-500/25 transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>TO write the technical Assesment -&gt; Click Here</span>
                </a>
                <p className="text-[11px] text-slate-500">
                  Direct exam portal link:{' '}
                  <a
                    href="https://technicalassesment-1081785547021.asia-southeast1.run.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 font-semibold underline"
                  >
                    https://technicalassesment-1081785547021.asia-southeast1.run.app/
                  </a>
                </p>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>How to Complete Your Technical Assessment:</span>
                </span>

                <ol className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      <strong>Open your email inbox:</strong> Check for the official assessment invitation sent to <span className="font-mono text-indigo-700 font-bold">{candidateEmail}</span>.
                    </span>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      <strong>Navigate in your browser:</strong> Click the secure external examination link in a desktop browser (Google Chrome, Microsoft Edge, or Firefox).
                    </span>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      <strong>Authenticate &amp; Clear:</strong> Enter your email along with your 12-digit assessment code (<span className="font-mono font-bold text-slate-900">{techCode}</span>) and complete your MCQs and coding challenges.
                    </span>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      <strong>Automatic Synchronization:</strong> Upon passing the qualifying score, your status will instantly update to <em>Qualified</em> on this portal to unlock Round 3 (AI Technical Interview).
                    </span>
                  </li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Anti-cheating proctored external session</span>
          </div>

          {syncStatusMsg && (
            <div className="w-full p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!isR2Qualified && (
              <>
                <button
                  type="button"
                  onClick={handleSyncStatus}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Check if your exam submission on the external portal has been cleared"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Checking Results...' : 'Verify Exam Clearance'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Code Copied' : 'Copy Assessment Code'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
            >
              Understood, Close Notice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
