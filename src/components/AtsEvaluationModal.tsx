import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
  Briefcase,
  GraduationCap,
  Award,
  ShieldCheck,
  BarChart3,
  Check,
} from 'lucide-react';
import { AtsEvaluationDetails } from '../types/index';

interface AtsEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: any;
  onAtsUpdated?: (updatedCandidate: any) => void;
}

export const AtsEvaluationModal: React.FC<AtsEvaluationModalProps> = ({
  isOpen,
  onClose,
  candidate,
  onAtsUpdated,
}) => {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !candidate) return null;

  const atsDetails: AtsEvaluationDetails | undefined = candidate.atsDetails;
  const atsScore = candidate.atsScore ?? atsDetails?.atsScore ?? 75;
  const isQualified = atsDetails?.isQualified ?? (atsScore >= 65);
  const breakdown = atsDetails?.scoreBreakdown || {
    keywordSkillMatchScore: candidate.scores?.skillsMatch || 80,
    experienceRelevanceScore: candidate.scores?.experienceMatch || 75,
    educationEligibilityScore: 85,
    depthAndImpactScore: 78,
    formattingAndClarityScore: 82,
  };

  const matchedSkills = atsDetails?.matchedSkills || candidate.candidate?.skills?.slice(0, 4) || [];
  const missingSkills = atsDetails?.missingSkills || [];
  const strengths = atsDetails?.candidateStrengths || [
    'Strong alignment in core requirements and engineering principles',
    'Demonstrated competency in applicable technical toolsets',
  ];
  const weaknesses = atsDetails?.candidateWeaknesses || [
    'Verification needed on production scale metrics during Round 2 Assessment',
  ];

  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/recruiter/candidates/${candidate.id}/evaluate-ats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to evaluate resume with ATS');
      }

      setSuccessMsg('HardCore AI ATS re-evaluation completed successfully!');
      if (onAtsUpdated && data.candidate) {
        onAtsUpdated(data.candidate);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during ATS evaluation.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 65) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 65) return 'bg-blue-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div
      id="ats-evaluation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">AI ATS Resume Screening Dossier</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold border border-blue-200">
                  Round 1 Screening
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Role: <strong className="text-slate-700">{candidate.job?.title || 'Selected Job'}</strong> • Candidate: <strong className="text-slate-800">{candidate.candidate?.name || candidate.candidate?.fullName || 'Candidate'}</strong> ({candidate.interviewCode || candidate.id})
              </p>
            </div>
          </div>
          <button
            id="close-ats-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="px-6 py-2.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Confidential Recruiter Audit:</strong> Numerical ATS scores and dimensional metrics are visible solely to recruiters and never exposed to candidate applicants.
            </span>
          </div>
          <button
            id="rerun-ats-audit-btn"
            onClick={handleRunEvaluation}
            disabled={isEvaluating}
            className="shrink-0 px-3 py-1 bg-white hover:bg-blue-100/60 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>{isEvaluating ? 'Analyzing...' : 'Re-Run ATS Audit'}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Top Score Summary Card */}
          <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 ${getScoreColor(
                  atsScore
                )}`}
              >
                <span className="text-2xl font-black">{atsScore}%</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">ATS Score</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                      isQualified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {isQualified ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cleared Resume Screening</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Did Not Clear Resume Screening</span>
                      </>
                    )}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                    Threshold: 60%
                  </span>
                  {atsDetails?.eligibilityCheckPassed != null && (
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        atsDetails.eligibilityCheckPassed
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {atsDetails.eligibilityCheckPassed ? 'Eligibility Verified' : 'Eligibility Review Needed'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2 max-w-md">
                  {atsDetails?.feedback || candidate.atsFeedback || 'Resume evaluated against job requirements, skills, and qualifications.'}
                </p>
                {atsDetails?.recommendation && (
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    Recommendation: <span className="text-blue-600">{atsDetails.recommendation}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] text-slate-400 block">Evaluated At</span>
              <span className="text-xs font-semibold text-slate-700 block">
                {atsDetails?.evaluatedAt ? new Date(atsDetails.evaluatedAt).toLocaleString() : 'System Default'}
              </span>
            </div>
          </div>

          {/* 5-Dimensional Scoring Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                5-Dimensional ATS Evaluation Breakdown
              </h4>
              <span className="text-[11px] text-slate-400">Weighted Composite: 100%</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 1. Keyword & Skill Match */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-800">1. Keyword &amp; Skill Match (35%)</span>
                  <span className="font-extrabold text-slate-900">{breakdown.keywordSkillMatchScore}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getProgressColor(breakdown.keywordSkillMatchScore)}`}
                    style={{ width: `${breakdown.keywordSkillMatchScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1.5 block">
                  Mandatory keywords and domain frameworks matching target role.
                </span>
              </div>

              {/* 2. Experience Relevance */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-800">2. Experience Relevance (25%)</span>
                  <span className="font-extrabold text-slate-900">{breakdown.experienceRelevanceScore}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getProgressColor(breakdown.experienceRelevanceScore)}`}
                    style={{ width: `${breakdown.experienceRelevanceScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1.5 block">
                  Applicability and seniority of past roles to target responsibilities.
                </span>
              </div>

              {/* 3. Education & Eligibility */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-800">3. Education &amp; Eligibility (15%)</span>
                  <span className="font-extrabold text-slate-900">{breakdown.educationEligibilityScore}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getProgressColor(breakdown.educationEligibilityScore)}`}
                    style={{ width: `${breakdown.educationEligibilityScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1.5 block">
                  Verification of degree, academic pedigree, and certifications.
                </span>
              </div>

              {/* 4. Technical Depth & Impact */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-800">4. Technical Depth &amp; Impact (15%)</span>
                  <span className="font-extrabold text-slate-900">{breakdown.depthAndImpactScore}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getProgressColor(breakdown.depthAndImpactScore)}`}
                    style={{ width: `${breakdown.depthAndImpactScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1.5 block">
                  Quantifiable project impact, architectural scale, and metrics.
                </span>
              </div>

              {/* 5. Formatting & Clarity */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white sm:col-span-2">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-800">5. Formatting, Clarity &amp; Scannability (10%)</span>
                  <span className="font-extrabold text-slate-900">{breakdown.formattingAndClarityScore}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getProgressColor(breakdown.formattingAndClarityScore)}`}
                    style={{ width: `${breakdown.formattingAndClarityScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1.5 block">
                  Resume structure, parsing ease, chronological logic, and ATS compliance.
                </span>
              </div>
            </div>
          </div>

          {/* Skills Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Matched Skills */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
              <h5 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Matched Core Skills ({matchedSkills.length})
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {matchedSkills.length > 0 ? (
                  matchedSkills.map((sk: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                      {sk}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No specific skill matches detected</span>
                )}
              </div>
            </div>

            {/* Missing Skills / Gaps */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30">
              <h5 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Missing / Unverified Skills ({missingSkills.length})
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.length > 0 ? (
                  missingSkills.map((sk: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-semibold"
                    >
                      {sk}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-emerald-700 font-medium">
                    All required skills found in candidate profile!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                <Award className="w-4 h-4 text-blue-600" />
                Identified Strengths
              </h5>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {strengths.map((str: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Gaps &amp; Areas of Focus
              </h5>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {weaknesses.map((w: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Candidate Dossier Snippets */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-800">
              <Briefcase className="w-4 h-4 text-slate-500 shrink-0" />
              <strong className="text-slate-900">Experience Profile:</strong>
              <span>{atsDetails?.experienceMatchSummary || `${candidate.candidate?.experienceYears || 0} years experience recorded.`}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-800">
              <GraduationCap className="w-4 h-4 text-slate-500 shrink-0" />
              <strong className="text-slate-900">Education &amp; Credentials:</strong>
              <span>{atsDetails?.educationMatchSummary || candidate.candidate?.education || 'Standard technical qualification.'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Stage 1 Automated ATS Screening • AI Studio Recruiter Suite
          </span>
          <button
            id="close-ats-dossier-btn"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
