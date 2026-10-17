import React, { useState } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  KeyRound,
  PlayCircle,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Hourglass,
  ShieldAlert,
  GitMerge,
  Code2,
  Lock,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { InterviewRegistration, InterviewStatus } from '../types/index';
import { CandidatePipelineModal } from './CandidatePipelineModal';

interface MyInterviewsProps {
  registrations: InterviewRegistration[];
  onAttendInterview: (code: string) => void;
  onViewReport: (registrationId: string) => void;
  onExploreMoreJobs: () => void;
  onAttendAssessment?: (registration: InterviewRegistration) => void;
}

export const MyInterviews: React.FC<MyInterviewsProps> = ({
  registrations,
  onAttendInterview,
  onViewReport,
  onExploreMoreJobs,
  onAttendAssessment,
}) => {
  const [selectedPipelineReg, setSelectedPipelineReg] = useState<InterviewRegistration | null>(null);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleOpenPipeline = (reg: InterviewRegistration) => {
    setSelectedPipelineReg(reg);
    setIsPipelineOpen(true);
  };

  const handleCopy = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">My Interviews</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Access codes, scheduling windows, and real-time status for your registered technical interviews.
          </p>
        </div>
        <button
          onClick={onExploreMoreJobs}
          className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Briefcase className="w-3.5 h-3.5 text-slate-500" />
          <span>Apply to More Jobs</span>
        </button>
      </div>

      {/* Registrations List */}
      {registrations.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No interview registrations yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Browse active enterprise opportunities and register to receive your autonomous AI technical interview access code.
          </p>
          <button
            onClick={onExploreMoreJobs}
            className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
          >
            Explore Openings Now
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {registrations.map(reg => {
            // Determine status based on computedStatus or fallback to interviewStatus
            const statusKey: string =
              reg.computedStatus ||
              (reg.interviewStatus === InterviewStatus.COMPLETED
                ? 'Completed'
                : reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED
                ? 'Terminated'
                : reg.interviewStatus === InterviewStatus.IN_PROGRESS
                ? 'Continue Interview'
                : 'Attend Interview');

            const isCompleted = statusKey === 'Completed' || reg.interviewStatus === InterviewStatus.COMPLETED;
            const isTerminated = statusKey === 'Terminated' || reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED;
            const isExpired = statusKey === 'Expired';
            const isNotStarted = statusKey === 'Not Started';
            const isContinue = statusKey === 'Continue Interview';
            const isAttend = statusKey === 'Attend Interview';

            const attemptsUsed = Math.min(reg.attemptCount ?? 0, 1);
            const maxAttempts = 1;

            const r1 = reg.roundProgression?.find(r => r.roundNumber === 1 || r.roundType === 'RESUME_SCREENING');
            const r2 = reg.roundProgression?.find(r => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT');
            const isR1Qualified = r1?.status === 'QUALIFIED';
            const isR2Qualified = r2 ? r2.status === 'QUALIFIED' : true;
            const hasR2 = Boolean(r2);
            const techCode = reg.technicalAssessmentCode || reg.interviewCode;

            const isMalpracticeDisqualified =
              r2?.status === 'REJECTED' &&
              ((r2?.score != null && r2.score >= (r2.minQualifyingScore || 60)) ||
                r2?.feedback?.toLowerCase().includes('malpractice') ||
                reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED);

            return (
              <div
                key={reg.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all flex flex-col gap-4 overflow-hidden"
              >
                {/* 1. Header Row: Logo, Job & Company Details, and Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                      {reg.job?.company?.logoUrl ? (
                        <img
                          src={reg.job.company.logoUrl}
                          alt={reg.job.company.name}
                          className="w-full h-full object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
                        <span className="font-semibold text-slate-700">{reg.job?.company?.name || 'Company'}</span>
                        {reg.job?.location && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span>{reg.job.location}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 truncate">
                        {reg.job?.title || 'Technical Assessment'}
                      </h3>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 self-start sm:self-auto">
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Response Recorded Successfully
                      </span>
                    )}
                    {isTerminated && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 shadow-2xs">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                        Malpractice Detected
                      </span>
                    )}
                    {isExpired && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Interview Expired
                      </span>
                    )}
                    {isNotStarted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        <Hourglass className="w-3.5 h-3.5 text-amber-600" />
                        Starts on {reg.interviewStartDate || 'Scheduled Date'}
                      </span>
                    )}
                    {isContinue && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        In Progress (Attempt 1 of 1)
                      </span>
                    )}
                    {isAttend && (
                      !isR1Qualified ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          Resume Cutoff Not Met
                        </span>
                      ) : r2?.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          {isMalpracticeDisqualified ? 'Disqualified for Malpractice' : 'Round 2 Not Cleared'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Ready to Attend
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* 2. Metadata Badges Row: Reg Code, Technical Code, Attempt Count, Window */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Registration Code */}
                  <div className="flex items-center gap-1 bg-blue-50 text-blue-900 px-2.5 py-1 rounded-lg border border-blue-200 font-mono text-[11px]">
                    <KeyRound className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="font-sans text-blue-600 font-medium">Reg:</span>
                    <span className="font-bold tracking-wider">{reg.interviewCode}</span>
                    <button
                      onClick={() => handleCopy(reg.interviewCode)}
                      className="ml-1 p-0.5 hover:bg-blue-100 rounded text-blue-700 cursor-pointer"
                      title="Copy registration code"
                    >
                      {copiedCode === reg.interviewCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* 12-Digit Technical Assessment Code */}
                  {isR1Qualified && (
                    <div className="flex items-center gap-1 bg-purple-50 text-purple-900 px-2.5 py-1 rounded-lg border border-purple-200 font-mono text-[11px]">
                      <Code2 className="w-3 h-3 text-purple-600 shrink-0" />
                      <span className="font-sans text-purple-600 font-medium">Tech Code (12-Digit):</span>
                      <span className="font-bold tracking-wider">{techCode}</span>
                      <button
                        onClick={() => handleCopy(techCode)}
                        className="ml-1 p-0.5 hover:bg-purple-100 rounded text-purple-700 cursor-pointer"
                        title="Copy 12-digit technical code"
                      >
                        {copiedCode === techCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}

                  {/* Single Attempt Indicator */}
                  <span
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                      attemptsUsed >= maxAttempts
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Attempt: {attemptsUsed} / {maxAttempts}
                    {attemptsUsed >= maxAttempts ? ' (Utilized)' : ' (Allowed)'}
                  </span>

                  {/* Window Schedule */}
                  {reg.interviewStartDate && (
                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200 text-[11px]">
                      <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                      Window: {reg.interviewStartDate}
                      {reg.interviewStartTime ? ` @ ${reg.interviewStartTime}` : ''}
                      {reg.interviewEndDate ? ` to ${reg.interviewEndDate}` : ''}
                    </span>
                  )}
                </div>

                {/* 3. Status Alert / Notice Banners */}
                {isTerminated && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-900">Interview Session Terminated for Integrity Violations</p>
                      <p className="mt-0.5 text-red-700">
                        Proctoring protocol detected severe malpractice infractions. No further interview attempts are permitted for this application.
                      </p>
                    </div>
                  </div>
                )}

                {!isR1Qualified && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Stage 1 Resume Screening Cutoff Not Met</p>
                      <p className="mt-0.5 text-rose-700">
                        Your resume did not meet the minimum qualifying score for this role. Only candidates who meet or exceed the resume cutoff score receive access to the Technical Assessment.
                      </p>
                    </div>
                  </div>
                )}

                {hasR2 && r2?.status === 'REJECTED' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {isMalpracticeDisqualified
                          ? `Round 2 Disqualified: Scored ${r2.score}% (Flagged by Proctoring Protocol)`
                          : `Round 2 Technical Cutoff Not Met (${r2.score != null ? `${r2.score}%` : 'Rejected'} — Cutoff: ${r2.minQualifyingScore || 60}%)`}
                      </p>
                      <p className="mt-0.5 text-rose-700">
                        {isMalpracticeDisqualified
                          ? (r2.feedback || 'The test submission was flagged and terminated due to camera disconnect or tab switching.')
                          : 'The candidate score for this assessment was below the required qualifying cutoff threshold.'}
                      </p>
                    </div>
                  </div>
                )}

                {hasR2 && isR2Qualified && !isCompleted && !isTerminated && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Round 2 Technical Assessment Cleared ({r2.score != null ? `Score: ${r2.score}%` : 'Qualified'}) — Stage 3 AI Interview is unlocked!
                    </span>
                  </div>
                )}

                {/* 4. Action Footer: Pipeline Progress & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Action: Pipeline Progress Button */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleOpenPipeline(reg)}
                      className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-semibold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <GitMerge className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Pipeline Progress</span>
                    </button>
                  </div>

                  {/* Right Actions: Test Link, Instructions, Report, Attend AI */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Take Technical Assessment CTA */}
                    {isR1Qualified && hasR2 && !isR2Qualified && attemptsUsed < maxAttempts && r2?.status !== 'REJECTED' && (
                      <>
                        <a
                          href="https://technicalassesment-1081785547021.asia-southeast1.run.app/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                          title="Click to write the technical assessment on the external platform"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>TO write the technical Assesment -&gt; Click Here</span>
                        </a>

                        <button
                          onClick={() => onAttendAssessment && onAttendAssessment(reg)}
                          className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                          title="View test instructions, guidelines, and sync options"
                        >
                          <Code2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>Instructions</span>
                        </button>
                      </>
                    )}

                    {/* View Assessment Report Button */}
                    {isCompleted && (
                      <button
                        onClick={() => onViewReport(reg.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>Assessment Report</span>
                      </button>
                    )}

                    {/* AI Interview Locked Indicator */}
                    {hasR2 && !isR2Qualified && !isCompleted && !isTerminated && (
                      <div
                        className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5"
                        title="You must pass the Round 2 Technical Assessment before gaining access to the AI Interview."
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          AI Interview Locked (
                          {r2?.status === 'REJECTED'
                            ? isMalpracticeDisqualified
                              ? 'Disqualified for Malpractice'
                              : `Cutoff Not Met: ${r2?.score ?? 0}% / ${r2?.minQualifyingScore || 60}%`
                            : 'Pass Round 2 First'}
                          )
                        </span>
                      </div>
                    )}

                    {/* Attend AI Interview Primary Button */}
                    {(isAttend || isContinue) && (isR2Qualified || !hasR2) && !isCompleted && !isTerminated && (
                      <button
                        onClick={() => onAttendInterview(reg.interviewCode)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
                      >
                        <PlayCircle className="w-4 h-4 shrink-0" />
                        <span>{isContinue ? 'Continue AI Interview' : 'Attend Round 3 AI Interview'}</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Candidate 5-Stage Recruitment Pipeline Modal */}
      <CandidatePipelineModal
        isOpen={isPipelineOpen}
        onClose={() => setIsPipelineOpen(false)}
        registration={selectedPipelineReg}
        onAttendInterview={onAttendInterview}
        onViewReport={onViewReport}
        onAttendAssessment={onAttendAssessment}
      />
    </div>
  );
};
