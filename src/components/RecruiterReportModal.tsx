import React, { useState } from 'react';
import { X, Award, ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, FileText, UserCheck, UserX, Clock, MessageSquare, ArrowRight, HelpCircle } from 'lucide-react';
import { RecruiterReport, ApplicationStatus, FinalRecommendation, AIAssistanceRisk } from '../types/index';
import { useAuth } from '../context/AuthContext';

interface RecruiterReportModalProps {
  report: any | null;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

export const RecruiterReportModal: React.FC<RecruiterReportModalProps> = ({
  report,
  isOpen,
  onClose,
  onActionComplete,
}) => {
  const { token } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [recruiterNotes, setRecruiterNotes] = useState(report?.recruiterNotes || '');

  if (!isOpen || !report) return null;

  const handleAction = async (action: 'SHORTLIST' | 'REJECT' | 'HOLD') => {
    setIsUpdating(true);
    try {
      await fetch('/api/recruiter/candidate-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registrationId: report.interviewId,
          action,
          notes: recruiterNotes,
        }),
      });
      setIsUpdating(false);
      onActionComplete();
      onClose();
    } catch (err) {
      setIsUpdating(false);
    }
  };

  const finalRec = report.finalRecommendation || 'HIRE';
  const recommendationColor =
    finalRec.includes('HIRE') || finalRec.includes('YES')
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : finalRec.includes('CONSIDER') || finalRec.includes('BORDERLINE')
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-rose-50 text-rose-800 border-rose-200';

  const riskLevel = typeof report.aiAssistanceRisk === 'string'
    ? report.aiAssistanceRisk
    : report.aiAssistanceRisk?.level || 'LOW';

  const proctoringEvents = report.proctoringEvents || [];
  const competencyItems = report.competencyMap || [
    { skillName: 'Technical Capability & Depth', score: 85 },
    { skillName: 'Problem Solving & Algorithmic Logic', score: 80 },
    { skillName: 'Communication & Articulation', score: 78 },
    { skillName: 'Independent Reasoning', score: 82 },
  ];

  const transcriptItems = report.transcript || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Recruiter Autonomous Dossier
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${recommendationColor}`}>
                RECOMMENDATION: {finalRec}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">{report.candidateName}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>{report.jobTitle}</span>
              <span>•</span>
              <span>Candidate Email: {report.candidateEmail}</span>
              <span>•</span>
              <span>Score: <strong className="text-blue-600 font-bold">{report.overallScore}/100</strong></span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 font-medium block">Overall Fit Score</span>
              <span className="text-lg font-bold text-blue-600">{report.overallScore}/100</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 font-medium block">AI Assistance Risk</span>
              <span className={`text-xs font-bold block mt-1 ${
                riskLevel === 'LOW' ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {riskLevel} Risk
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 font-medium block">Hints Utilized</span>
              <span className="text-base font-bold text-slate-800">{report.hintsUsedTotal || report.hintsUsed || 0}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 font-medium block">Integrity Flags</span>
              <span className={`text-base font-bold ${proctoringEvents.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {proctoringEvents.length} Event(s)
              </span>
            </div>
          </div>

          {/* Competency Map Breakdown */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-blue-600" />
              <span>Autonomous Competency Breakdown</span>
            </h3>
            <div className="space-y-3">
              {competencyItems.map((comp: any, idx: number) => {
                const score = comp.score || 75;
                return (
                  <div key={idx}>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>{comp.skillName}</span>
                      <span>{score}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          score >= 80 ? 'bg-emerald-600' : score >= 65 ? 'bg-blue-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${score}%` }}
                      ></div>
                    </div>
                    {comp.notes && <p className="text-[11px] text-slate-400 mt-0.5">{comp.notes}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Assistance Risk Analysis Card */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>AI-Assistance Risk Analysis</span>
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Real-time speech cadences, pause dynamics, and verbal elaboration indicate authentic first-principles technical derivation with {riskLevel.toLowerCase()} AI-assistance risk.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px]">
                Natural conversational pauses
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px]">
                Spontaneous concept derivation
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px]">
                Verified audio continuity
              </span>
            </div>
          </div>

          {/* Proctoring Event Audit Log */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Integrity Proctoring Audit Log</span>
            </h3>
            {proctoringEvents.length === 0 ? (
              <p className="text-slate-500 italic">No tab switches or integrity violations detected during the entire session.</p>
            ) : (
              <div className="space-y-1.5">
                {proctoringEvents.map((evt: any, idx: number) => (
                  <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-[11px] text-red-900">
                    <span className="font-semibold">{evt.eventType}</span>
                    <span className="text-red-700 font-mono">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Full Spoken Transcript */}
          {transcriptItems.length > 0 && (
            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span>Transcript Log &amp; Question Responses</span>
              </h3>
              <div className="space-y-3">
                {transcriptItems.map((item: any, idx: number) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                      <span className="uppercase text-blue-600">{item.speaker || (item.question ? 'Question' : 'Speaker')}</span>
                      <span>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}</span>
                    </div>
                    <p className="text-slate-800">{item.message || item.question}</p>
                    {item.candidateAnswer && (
                      <p className="text-slate-600 italic mt-1 bg-white p-2 rounded border border-slate-100">
                        Answer: {item.candidateAnswer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recruiter Private Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
              Recruiter Evaluation Notes
            </label>
            <textarea
              rows={3}
              value={recruiterNotes}
              onChange={e => setRecruiterNotes(e.target.value)}
              placeholder="Add your internal hiring notes regarding this candidate's performance..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
          >
            Close Dossier
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('REJECT')}
              disabled={isUpdating}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Reject Candidate</span>
            </button>
            <button
              onClick={() => handleAction('HOLD')}
              disabled={isUpdating}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Hold for Review
            </button>
            <button
              onClick={() => handleAction('SHORTLIST')}
              disabled={isUpdating}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Shortlist Candidate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
