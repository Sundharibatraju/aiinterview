import React, { useEffect } from 'react';
import { X, CheckCircle2, ArrowRight, AlertCircle, Code2, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { InterviewRegistration, ApplicationStatus } from '../types/index';
import { useAuth } from '../context/AuthContext';

interface RegistrationSuccessModalProps {
  registration: InterviewRegistration | null;
  isOpen: boolean;
  onClose: () => void;
  onViewMyInterviews: () => void;
  onAttendNow?: (code: string) => void;
}

export const RegistrationSuccessModal: React.FC<RegistrationSuccessModalProps> = ({
  registration,
  isOpen,
  onClose,
  onViewMyInterviews,
}) => {
  const { user } = useAuth();

  const isQualified = Boolean(
    registration &&
    registration.status !== ApplicationStatus.REJECTED &&
    registration.clearedResumeScreening !== false &&
    Boolean(registration.technicalAssessmentCode)
  );

  useEffect(() => {
    if (isOpen && isQualified) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  }, [isOpen, isQualified]);

  if (!isOpen || !registration) return null;

  const jobTitle = registration.job?.title || 'the selected position';
  const userEmail = user?.email || registration.candidate?.email || 'your registered email';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-8 relative text-center">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isQualified ? (
          <>
            {/* Success Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-extrabold text-slate-900">Resume Screening Cleared!</h2>
            <p className="text-xs sm:text-sm text-slate-700 mt-2 leading-relaxed">
              Your resume met the qualifying cutoff for <span className="font-bold text-slate-900">{jobTitle}</span>.
            </p>

            {/* Technical Assessment Access Card */}
            <div className="mt-5 p-4 bg-purple-50/80 border border-purple-200 rounded-xl text-xs text-purple-900 text-left space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-purple-950">
                <Code2 className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Round 2 Technical Assessment Unlocked</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-purple-200 font-mono text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Your 12-Digit Assessment Code</span>
                <span className="text-base font-extrabold tracking-widest text-purple-700 select-all">
                  {registration.technicalAssessmentCode}
                </span>
              </div>
              <p className="text-purple-800 leading-relaxed text-[11px]">
                Your assessment code and instructions have been dispatched to <strong>{userEmail}</strong>.
              </p>
              <p className="text-purple-800 leading-relaxed text-[11px]">
                You can write your Technical Assessment under <strong>My Interviews</strong> (Strictly 1 attempt allowed).
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Cutoff Not Met Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 mb-4 border border-rose-200 shadow-sm">
              <AlertCircle className="w-8 h-8" />
            </div>

            {/* Heading */}
            <h2 className="text-xl font-extrabold text-slate-900">Resume Screening Not Cleared</h2>
            <p className="text-xs sm:text-sm text-slate-700 mt-2 leading-relaxed">
              Your application for <span className="font-bold text-slate-900">{jobTitle}</span> was evaluated against the job's required skills and eligibility criteria.
            </p>

            {/* Notice */}
            <div className="mt-5 p-4 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-900 text-left space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-950">
                <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Technical Assessment Locked (Cutoff Not Met)</span>
              </div>
              <p className="text-rose-800 leading-relaxed text-[11px]">
                Only candidates whose resume ATS score is greater than or equal to the job cutoff are eligible for the Technical Assessment.
              </p>
              <p className="text-rose-800 leading-relaxed text-[11px]">
                You did not meet the required threshold for this position and will not receive a Technical Assessment code.
              </p>
            </div>
          </>
        )}

        {/* Primary Action Button */}
        <div className="mt-6">
          <button
            onClick={() => {
              onClose();
              onViewMyInterviews();
            }}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Go to My Interviews</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

