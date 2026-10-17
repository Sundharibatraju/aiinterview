import React from 'react';
import { ArrowRight, ShieldCheck, Video, Mic, CheckCircle2, Award, Clock, Sparkles, Building2, MapPin, Users } from 'lucide-react';
import { Job, UserRole } from '../types/index';
import { useAuth } from '../context/AuthContext';

interface LandingPageProps {
  onExploreJobs: () => void;
  onRecruiterLogin: () => void;
  onCandidateRegister: () => void;
  featuredJobs: Job[];
  onSelectJob: (job: Job) => void;
  onNavigate?: (view: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onExploreJobs,
  onRecruiterLogin,
  onCandidateRegister,
  featuredJobs,
  onSelectJob,
  onNavigate,
}) => {
  const { user } = useAuth();
  const isRecruiter = user?.role === UserRole.RECRUITER || user?.role === UserRole.ADMIN;
  const isCandidate = user?.role === UserRole.CANDIDATE;
  return (
    <div className="w-full bg-slate-50 text-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Generation Autonomous Talent Acquisition</span>
            </div>

            {/* Title (Section 5 requirement) */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-tight">
              Your next opportunity starts with a conversation.
            </h1>

            {/* Subtitle (Section 5 requirement) */}
            <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              AI-powered interviews designed around your skills, experience and the role you're applying for.
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onExploreJobs}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Explore Jobs</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              {isRecruiter ? (
                <button
                  onClick={() => (onNavigate ? onNavigate('recruiter-dashboard') : onRecruiterLogin())}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 hover:border-slate-400 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Recruiter Portal</span>
                </button>
              ) : isCandidate ? (
                <button
                  onClick={() => (onNavigate ? onNavigate('my-interviews') : onExploreJobs())}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 hover:border-slate-400 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>My Interviews</span>
                </button>
              ) : (
                <button
                  onClick={onRecruiterLogin}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 hover:border-slate-400 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span>Recruiter Login</span>
                </button>
              )}
            </div>

            {/* Key trust bullets under hero */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left border-t border-slate-100 pt-8 max-w-3xl mx-auto">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Adaptive Questions</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Continuous Voice</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Integrity Proctoring</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Fair Competency Scoring</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Jobs Section */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Live Openings</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Featured Job Opportunities</h2>
              <p className="text-sm text-slate-500 mt-1">
                Verified enterprise opportunities with direct AI technical assessment interviews
              </p>
            </div>
            <button
              onClick={onExploreJobs}
              className="mt-4 sm:mt-0 text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View all openings</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {featuredJobs.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Job Openings Published Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Opportunities published by recruiters appear here automatically in real time.
              </p>
              <button
                onClick={() => (isRecruiter && onNavigate ? onNavigate('recruiter-dashboard') : onRecruiterLogin())}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{isRecruiter ? 'Open Recruiter Portal' : 'Publish Opportunity (Recruiter Portal)'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredJobs.slice(0, 3).map(job => (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all p-6 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {job.company?.logoUrl ? (
                          <img
                            src={job.company.logoUrl}
                            alt={job.company.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Building2 className="w-6 h-6 text-slate-500" />
                        )}
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {job.workMode}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs font-medium text-slate-500">{job.company?.name}</div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors mt-0.5">
                        {job.title}
                      </h3>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {(job.minPackage / 100000).toFixed(1)}L - {(job.maxPackage / 100000).toFixed(1)}L {job.currency || 'LPA'}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {job.requiredSkills.slice(0, 4).map(skill => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.durationMinutes} min AI Interview</span>
                    </div>
                    <button
                      onClick={() => onSelectJob(job)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Apply</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Hiring Workflow</span>
            <h2 className="text-3xl font-bold text-slate-900 mt-1">How Autonomous Recruitment Works</h2>
            <p className="text-sm text-slate-500 mt-2">
              From verified candidate application to dynamic conversational interview and structured assessment reports
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 relative">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-base flex items-center justify-center mb-4 shadow-sm">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900">Apply & Receive Code</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Register with verified email credentials, apply to target opportunities, and receive a confidential unique alphanumeric interview code.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 relative">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-base flex items-center justify-center mb-4 shadow-sm">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900">Pre-Interview Check</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Test camera, microphone with a live spoken sentence check, audio output, full-screen mode, and accept interview integrity guidelines.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 relative">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-base flex items-center justify-center mb-4 shadow-sm">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900">Real-Time AI Voice</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Experience an interactive voice conversation with dynamic questions, progressive hints, thinking time support, and adaptive difficulty.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 relative">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-base flex items-center justify-center mb-4 shadow-sm">
                4
              </div>
              <h3 className="text-base font-bold text-slate-900">Comprehensive Report</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Receive automated candidate feedback and learning paths, while recruiters analyze competency radar maps and interview integrity signals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Enterprise Trust & Integrity</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">
                Engineered for rigorous, objective technical hiring
              </h2>
              <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
                Our interview controller balances candidate-friendly conversational guidance with strict session integrity monitoring and zero demographic bias.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Interview Integrity Monitoring</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Monitors tab focus, fullscreen status, and peripheral availability with progressive warning policies (Warning 1 &rarr; Malpractice Termination).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Dynamic Anti-Repetition Engine</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ensures candidates never receive identical question paths, adapting deep follow-ups based on live conceptual reasoning.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Privacy-First Proctoring Signals</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Camera presence verifies session focus without inferring sensitive traits or storing biometric data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recruiter Trust Summary Card */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-8 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-2">Autonomous Assessment Matrix</h3>
              <p className="text-xs text-slate-400 mb-6">Real-time candidate evaluation telemetry</p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Technical Depth & Architecture</span>
                    <span className="text-blue-400">88%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '88%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Problem-Solving & Debugging</span>
                    <span className="text-blue-400">82%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '82%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Communication & Thought Structure</span>
                    <span className="text-emerald-400">92%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">AI-Assistance Risk Factor</span>
                    <span className="text-emerald-400 font-mono">LOW (Verified Spoken Baseline)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '15%' }}></div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs text-slate-300">Proctoring Engine Online</span>
                </div>
                <button
                  onClick={onCandidateRegister}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Start Assessment
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">AI INTERVIEWER</span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs text-slate-500">Autonomous Recruitment & Assessment Platform</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Compliant with enterprise talent recruitment standards. All Gemini intelligence calls operate server-side.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <button onClick={onExploreJobs} className="hover:text-blue-600 transition cursor-pointer">
              Job Catalog
            </button>
            <button
              onClick={() => (isRecruiter && onNavigate ? onNavigate('recruiter-dashboard') : onRecruiterLogin())}
              className="hover:text-blue-600 transition cursor-pointer"
            >
              {isRecruiter ? 'Recruiter Portal' : 'Recruiter Access'}
            </button>
            <button onClick={onCandidateRegister} className="hover:text-blue-600 transition cursor-pointer">
              Candidate Register
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
