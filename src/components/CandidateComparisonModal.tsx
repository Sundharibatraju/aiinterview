import React from 'react';
import { X, Award, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, User } from 'lucide-react';
import { RecruiterReport } from '../types/index';

interface CandidateComparisonModalProps {
  candidates: any[];
  isOpen: boolean;
  onClose: () => void;
}

export const CandidateComparisonModal: React.FC<CandidateComparisonModalProps> = ({
  candidates,
  isOpen,
  onClose,
}) => {
  if (!isOpen || candidates.length < 2) return null;

  const [c1, c2] = candidates;

  const getScore = (c: any) => c.overallScore || 75;
  const getRisk = (c: any) => typeof c.aiAssistanceRisk === 'string' ? c.aiAssistanceRisk : c.aiAssistanceRisk?.level || 'LOW';
  const getHints = (c: any) => c.hintsUsedTotal || c.hintsUsed || 0;
  const getProctoringCount = (c: any) => (c.proctoringEvents || []).length;
  const getRecommendation = (c: any) => c.finalRecommendation || 'HIRE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Candidate Comparison</span>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">Direct Side-by-Side Competency Benchmark</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-Side Grid */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          <div className="grid grid-cols-2 gap-6">
            {/* Candidate 1 */}
            <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  {c1.candidateName?.charAt(0) || 'C'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{c1.candidateName}</h3>
                  <span className="text-[11px] text-slate-500">{c1.jobTitle}</span>
                </div>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-blue-600">
                {getScore(c1)}/100
              </div>
              <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Overall Fit Score</div>
            </div>

            {/* Candidate 2 */}
            <div className="p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                  {c2.candidateName?.charAt(0) || 'C'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{c2.candidateName}</h3>
                  <span className="text-[11px] text-slate-500">{c2.jobTitle}</span>
                </div>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-indigo-600">
                {getScore(c2)}/100
              </div>
              <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Overall Fit Score</div>
            </div>
          </div>

          {/* Benchmark Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                  <th className="p-3 w-1/3">Evaluation Metric</th>
                  <th className="p-3 w-1/3 text-blue-800">{c1.candidateName}</th>
                  <th className="p-3 w-1/3 text-indigo-800">{c2.candidateName}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Final Recommendation</td>
                  <td className="p-3 font-bold text-emerald-600">{getRecommendation(c1)}</td>
                  <td className="p-3 font-bold text-emerald-600">{getRecommendation(c2)}</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Overall Technical Score</td>
                  <td className="p-3 font-bold">{getScore(c1)}/100</td>
                  <td className="p-3 font-bold">{getScore(c2)}/100</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">AI Assistance Risk</td>
                  <td className="p-3">
                    <span className="font-semibold text-emerald-700">{getRisk(c1)}</span> Risk
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-emerald-700">{getRisk(c2)}</span> Risk
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Hints Requested</td>
                  <td className="p-3">{getHints(c1)} hint(s)</td>
                  <td className="p-3">{getHints(c2)} hint(s)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Integrity Violation Events</td>
                  <td className="p-3 font-mono">{getProctoringCount(c1)} flags</td>
                  <td className="p-3 font-mono">{getProctoringCount(c2)} flags</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
