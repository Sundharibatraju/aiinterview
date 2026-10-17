import React, { useState } from 'react';
import { X, CheckCircle2, Clock, Lock, AlertTriangle, ArrowRight, ShieldCheck, Sparkles, KeyRound, PlayCircle, FileText, ChevronRight, Award, UserCheck, Calendar, Code2, ExternalLink } from 'lucide-react';
import { InterviewRegistration, RoundStatus, RoundType } from '../types/index';

interface CandidatePipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: InterviewRegistration | null;
  onAttendInterview: (code: string) => void;
  onViewReport: (registrationId: string) => void;
  onAttendAssessment?: (registration: InterviewRegistration) => void;
}

export const CandidatePipelineModal: React.FC<CandidatePipelineModalProps> = ({
  isOpen,
  onClose,
  registration,
  onAttendInterview,
  onViewReport,
  onAttendAssessment,
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'communications'>('pipeline');

  if (!isOpen || !registration) return null;

  const job = registration.job;
  const progression = registration.roundProgression || [];
  const currentRoundNum = registration.currentRoundNumber || 1;
  const emails = registration.candidateEmailsReceived || [];

  const getRoundStatusBadge = (status: RoundStatus) => {
    switch (status) {
      case RoundStatus.QUALIFIED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Qualified
          </span>
        );
      case RoundStatus.IN_PROGRESS:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Active Stage
          </span>
        );
      case RoundStatus.NEEDS_REVIEW:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Under Committee Review
          </span>
        );
      case RoundStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Did Not Qualify
          </span>
        );
      case RoundStatus.ON_HOLD:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            On Hold
          </span>
        );
      case RoundStatus.LOCKED:
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            Locked
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl p-6 sm:p-8 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Information */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                Recruitment Pipeline
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">{job?.company?.name || 'Enterprise'}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">{job?.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracking your application lifecycle through automated screening, AI technical interviews, and final selection.
            </p>
          </div>

          {/* Access Codes */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Interview Code</span>
                <span className="text-xs font-black font-mono text-slate-900 select-all">{registration.interviewCode}</span>
              </div>
            </div>

            {/* 12-Digit Alphanumeric Technical Assessment Code - Shown when Resume is Passed */}
            {progression.find(r => r.roundNumber === 1 || r.roundType === RoundType.RESUME_SCREENING)?.status === RoundStatus.QUALIFIED && (
              <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl flex items-center gap-2.5 animate-fadeIn">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-purple-700 block uppercase tracking-wider">12-Digit Technical Code</span>
                  <span className="text-xs font-black font-mono text-purple-950 select-all">{registration.technicalAssessmentCode || registration.interviewCode}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pipeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>5-Stage Progression ({progression.length || 5} Rounds)</span>
          </button>
          <button
            onClick={() => setActiveTab('communications')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'communications'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Recruiter Emails &amp; Messages ({emails.length})</span>
          </button>
        </div>

        {/* Content Area */}
        {activeTab === 'pipeline' ? (
          <div className="mt-6 space-y-4">
            {/* Resume Screening Summary Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-900">Application &amp; Resume Review</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      Round 1 Screening
                    </span>
                  </div>
                  <p className="text-xs text-blue-800/80 mt-1 max-w-xl">
                    Your resume and submitted profile credentials are authenticated and evaluated against role prerequisites.
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span className="text-[10px] text-slate-500 block">Round 1 Outcome</span>
                <span className={`text-xs font-bold ${progression.find(r => r.roundNumber === 1)?.status === RoundStatus.QUALIFIED ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {progression.find(r => r.roundNumber === 1)?.status === RoundStatus.QUALIFIED ? 'Screening Cleared' : 'In Review / Evaluated'}
                </span>
              </div>
            </div>

            {/* Rounds List */}
            <div className="space-y-3">
              {progression.map((round, idx) => {
                const isCurrent = round.roundNumber === currentRoundNum;
                const isRound2Assessment = round.roundType === RoundType.TECHNICAL_ASSESSMENT || round.roundNumber === 2;
                const isRound3Ai = round.roundType === RoundType.AI_INTERVIEW || round.roundNumber === 3;
                const isCompleted = round.status === RoundStatus.QUALIFIED;
                const isLocked = round.status === RoundStatus.LOCKED;
                const isRound1Screening = round.roundNumber === 1 || round.roundType === RoundType.RESUME_SCREENING;

                return (
                  <div
                    key={round.roundNumber}
                    className={`p-5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'border-blue-500 bg-white shadow-md ring-1 ring-blue-500/20'
                        : isLocked
                        ? 'border-slate-200 bg-slate-50/60 opacity-75'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : isCurrent
                              ? 'bg-blue-600 text-white shadow-sm'
                              : isLocked
                              ? 'bg-slate-200 text-slate-500'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : `R${round.roundNumber}`}
                        </div>

                        <div>
                          <div className="flex items-center gap-2.5">
                            <h4 className="text-sm font-bold text-slate-900">{round.roundName}</h4>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {round.roundType}
                            </span>
                          </div>

                          {round.feedback && (
                            <p className="text-xs text-slate-600 mt-1">
                              <span className="font-semibold text-slate-700">Status Notes: </span>
                              {round.feedback}
                            </p>
                          )}

                          {!isRound1Screening && round.minQualifyingScore != null && (
                            <span className="text-[11px] text-slate-500 mt-0.5 block">
                              Min Qualifying Cutoff: <strong className="text-slate-700">{round.minQualifyingScore}%</strong>
                              {round.score != null && (
                                <> • Score Achieved: <strong className={round.score >= round.minQualifyingScore ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{round.score}%</strong></>
                              )}
                            </span>
                          )}

                          {round.status === RoundStatus.REJECTED && round.feedback && (
                            <span className="text-[11px] text-rose-600 font-medium mt-1 block">
                              {round.feedback}
                            </span>
                          )}

                          {isRound2Assessment && progression.find(r => r.roundNumber === 1 || r.roundType === RoundType.RESUME_SCREENING)?.status === RoundStatus.QUALIFIED && (
                            <span className="text-[11px] font-mono text-purple-700 font-bold mt-1 block">
                              12-Digit Assessment Code: {registration.technicalAssessmentCode || registration.interviewCode}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
                        {getRoundStatusBadge(round.status)}

                        {/* If Technical Assessment (Round 2) and active, show external portal direction */}
                        {isRound2Assessment && (round.status === RoundStatus.IN_PROGRESS || isCurrent) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href="https://technicalassesment-1081785547021.asia-southeast1.run.app/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                              title="Click to write the technical assessment"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>TO write the technical Assesment -&gt; Click Here</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                if (onAttendAssessment) onAttendAssessment(registration);
                              }}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold rounded-lg border border-purple-200 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                              title="View external exam instructions and 12-digit assessment code"
                            >
                              <Code2 className="w-3.5 h-3.5 text-purple-600" />
                              <span>Instructions</span>
                            </button>
                          </div>
                        )}

                        {/* If Round 2 completed, show status */}
                        {isRound2Assessment && (round.status === RoundStatus.QUALIFIED || round.status === RoundStatus.REJECTED) && (() => {
                          const isMalpracticeDisqualified = round.status === RoundStatus.REJECTED && (
                            (round.score != null && round.score >= (round.minQualifyingScore || 60)) ||
                            round.feedback?.toLowerCase().includes('malpractice') ||
                            registration.interviewStatus === 'MALPRACTICE_TERMINATED'
                          );
                          return (
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 ${
                              round.status === RoundStatus.QUALIFIED
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              <Code2 className="w-3.5 h-3.5" />
                              <span>
                                {round.status === RoundStatus.QUALIFIED
                                  ? 'Cutoff Cleared'
                                  : isMalpracticeDisqualified
                                  ? 'Malpractice Disqualified'
                                  : 'Cutoff Not Met'}
                              </span>
                            </span>
                          );
                        })()}

                        {/* If AI Technical Interview and active, show Attend button (gated on Round 2 qualification) */}
                        {isRound3Ai && (round.status === RoundStatus.IN_PROGRESS || isCurrent) && (() => {
                          const r2 = progression.find(r => r.roundNumber === 2 || r.roundType === RoundType.TECHNICAL_ASSESSMENT);
                          const r2Qualified = r2 ? r2.status === RoundStatus.QUALIFIED : true;

                          if (!r2Qualified) {
                            return (
                              <span className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5" title="Pass Round 2 Technical Assessment first">
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Locked: Clear Round 2 First</span>
                              </span>
                            );
                          }

                          return (
                            <button
                              onClick={() => {
                                onClose();
                                onAttendInterview(registration.interviewCode);
                              }}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Attend AI Interview</span>
                            </button>
                          );
                        })()}

                        {/* If AI interview completed, show report button */}
                        {isRound3Ai && (round.status === RoundStatus.QUALIFIED || round.status === RoundStatus.NEEDS_REVIEW || round.status === RoundStatus.REJECTED) && (
                          <button
                            onClick={() => {
                              onClose();
                              onViewReport(registration.id);
                            }}
                            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>View Report</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {emails.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No recruiter communications yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Updates, interview invitations, and status changes sent by the recruitment team will appear here.
                </p>
              </div>
            ) : (
              emails.map(email => (
                <div key={email.id} className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{email.subject}</h4>
                        <span className="text-[10px] text-slate-500">From: {email.senderName}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(email.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-3 whitespace-pre-wrap leading-relaxed">
                    {email.body}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close Pipeline View
          </button>
        </div>
      </div>
    </div>
  );
};
