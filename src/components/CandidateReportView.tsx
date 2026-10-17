import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Award, BookOpen, AlertCircle, Printer, HelpCircle, Star, Sparkles, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CandidateReport } from '../types/index';

interface CandidateReportViewProps {
  registrationId: string;
  onBack: () => void;
}

export const CandidateReportView: React.FC<CandidateReportViewProps> = ({
  registrationId,
  onBack,
}) => {
  const { token } = useAuth();
  const [report, setReport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/reports/candidate/${registrationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setReport(data);
        } else {
          setError('Assessment report is still generating or not found.');
        }
      } catch (err) {
        setError('Network failure loading report');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [registrationId, token]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-4"></div>
        <h2 className="text-lg font-bold text-slate-800">Synthesizing Competency Report...</h2>
        <p className="text-xs text-slate-500 mt-1">
          Evaluating technical responses, conceptual depth, and tailored recommendations.
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Report Unavailable</h3>
        <p className="text-xs text-slate-500 mt-1">{error || 'No assessment data recorded for this interview session.'}</p>
        <button
          onClick={onBack}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
        >
          Return to My Interviews
        </button>
      </div>
    );
  }

  const strongAreas: string[] = report.strongAreas || report.strengths || [];
  const areasToImprove: string[] = report.areasToImprove || report.areasForImprovement || [];
  const recommendations: string[] = report.learningRecommendations || report.recommendations || [];
  const questionsList = report.questionsAsked || report.questionResponses || [];
  const statusStr = report.completionStatus || report.overallStatus || 'COMPLETED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top action bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Interviews</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Main Report Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        {/* Report Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Candidate Performance Assessment
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {report.candidateName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{report.jobTitle}</span>
              <span>•</span>
              <span>{report.companyName}</span>
              <span>•</span>
              <span>{report.interviewDate || new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
              {statusStr}
            </span>
          </div>
        </div>

        {/* Email Dispatched Note */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-3 text-xs text-blue-900">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            A permanent copy of this evaluation was dispatched to your verified email address upon completion.
          </span>
        </div>

        {/* Executive Feedback */}
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            AI Interviewer Evaluation Summary
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
            {report.overallSummary || report.aiFeedback}
          </p>
        </div>

        {/* Strengths & Improvement Areas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Identified Strengths</span>
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              {strongAreas.map((s, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvement Areas */}
          <div className="p-5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Growth &amp; Improvement Opportunities</span>
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              {areasToImprove.map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Questions & Responses Breakdown */}
        {questionsList.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Interview Questions &amp; Conceptual Analysis
            </h2>
            <div className="space-y-4">
              {questionsList.map((qr: any, idx: number) => (
                <div key={idx} className="p-5 bg-white rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span className="text-blue-600">Question {idx + 1}</span>
                    {qr.technicalCorrectness && (
                      <span className="text-slate-400">Score: {qr.technicalCorrectness}</span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-900">{qr.question || qr.questionText}</p>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Your Spoken Answer:
                    </span>
                    <p className="italic">{qr.candidateAnswer || '(Answer provided verbally during live session)'}</p>
                  </div>

                  {qr.referenceConcepts && (
                    <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100 text-xs text-blue-950">
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
                        Key Concepts Tested:
                      </span>
                      <p>{Array.isArray(qr.referenceConcepts) ? qr.referenceConcepts.join(', ') : qr.referenceConcepts}</p>
                    </div>
                  )}

                  {qr.feedback && (
                    <p className="text-xs text-slate-600 pt-1">
                      <strong className="text-slate-800">Evaluator Note:</strong> {qr.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations & Learning Resources */}
        {recommendations.length > 0 && (
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Recommended Learning Paths &amp; Resources</span>
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">&rarr;</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
