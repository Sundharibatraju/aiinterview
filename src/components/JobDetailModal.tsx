import React from 'react';
import { X, Building2, MapPin, Calendar, Clock, Award, CheckCircle2, Shield, ArrowRight, Users, GitMerge, FileCheck } from 'lucide-react';
import { Job } from '../types/index';

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onRegisterForInterview: (job: Job) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isOpen,
  onClose,
  onRegisterForInterview,
}) => {
  if (!isOpen || !job) return null;

  const rounds = job.rounds || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-xs">
              {job.company?.logoUrl ? (
                <img
                  src={job.company.logoUrl}
                  alt={job.company.name}
                  className="w-full h-full object-cover rounded-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Building2 className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  {job.company?.name}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified Opportunity
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">{job.title}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {job.location} ({job.workMode})
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {job.salaryPackage || `${(job.minPackage / 100000).toFixed(1)}L - ${(job.maxPackage / 100000).toFixed(1)}L ${job.currency || 'LPA'}`}
                </span>
                <span>•</span>
                <span>{job.employmentType}</span>
                {job.openings && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {job.openings} Openings
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
          {/* Quick Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 font-medium block">Experience</span>
              <span className="font-semibold text-xs text-slate-900 mt-0.5 block">{job.experience}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 font-medium block">AI Interview Duration</span>
              <span className="font-semibold text-xs text-slate-900 mt-0.5 block">~{job.durationMinutes} Minutes</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 font-medium block">Registration Deadline</span>
              <span className="font-semibold text-xs text-slate-900 mt-0.5 block">{job.registrationClosingDate || job.deadline}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 font-medium block">Selection Process</span>
              <span className="font-semibold text-xs text-blue-600 mt-0.5 block">5-Round Pipeline</span>
            </div>
          </div>

          {/* Eligibility Criteria */}
          {job.eligibilityCriteria && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-blue-600" />
                <span>Eligibility Criteria</span>
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">{job.eligibilityCriteria}</p>
            </div>
          )}

          {/* Job Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Job Description</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-slate-100">
              {job.description}
            </p>
          </div>

          {/* Required Skills */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Required Technical Skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.map(skill => (
                <span
                  key={skill}
                  className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Required Certifications */}
          {job.requiredCertifications && job.requiredCertifications.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Required Certifications</h3>
              <div className="flex flex-wrap gap-2">
                {job.requiredCertifications.map(cert => (
                  <span
                    key={cert}
                    className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-1"
                  >
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{cert}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5-Round Recruitment Stages */}
          {rounds.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <GitMerge className="w-4 h-4 text-blue-600" />
                <span>Multi-Round Recruitment Pipeline</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {rounds.map(r => (
                  <div key={r.roundNumber} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 block">Round {r.roundNumber}</span>
                      <span className="text-xs font-bold text-slate-900 block mt-0.5">{r.name}</span>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{r.description}</p>
                    </div>
                    {r.minQualifyingScore && (
                      <span className="text-[10px] font-semibold text-slate-600 mt-2 block pt-2 border-t border-slate-200">
                        Cutoff: {r.minQualifyingScore}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Interviewer Notice */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-slate-700 space-y-1.5">
            <div className="font-bold text-blue-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Instant Automated Round 1 (Resume Screening)</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              When you apply, your profile will be screened in real-time by the automated ATS engine. If you meet the eligibility criteria, Round 2 is immediately unlocked and your confidential interview access code is delivered to your email.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition cursor-pointer"
          >
            Back to Openings
          </button>
          <button
            onClick={() => {
              onClose();
              onRegisterForInterview(job);
            }}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
          >
            <span>Apply Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
