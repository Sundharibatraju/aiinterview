import React, { useState } from 'react';
import { ArrowLeft, Briefcase, Plus, Sparkles, Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Job } from '../types/index';
import { PostJobModal } from './PostJobModal';
import { RecruiterLogin } from './RecruiterLogin';

interface PostJobPageProps {
  onBack: () => void;
  onJobCreated?: (newJob?: Job) => void;
}

export const PostJobPage: React.FC<PostJobPageProps> = ({ onBack, onJobCreated }) => {
  const { user, token, isLoading } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCreatedSuccess, setIsCreatedSuccess] = useState(false);

  // Directly retrieve user/token if passed via URL or stored
  const activeUser = user || (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlUser = params.get('sessionUser');
      if (urlUser) {
        return JSON.parse(decodeURIComponent(urlUser));
      }
      const saved = localStorage.getItem('ai_interviewer_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const activeToken = token || (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('sessionToken') || localStorage.getItem('ai_interviewer_token');
    } catch {
      return null;
    }
  })();

  const isRecruiter = activeUser?.role === UserRole.RECRUITER || activeUser?.role === UserRole.ADMIN;

  const handleJobCreated = (newJob?: any) => {
    setIsCreatedSuccess(true);
    if (onJobCreated) {
      onJobCreated(newJob);
    }

    // Broadcast across tabs to update the previous tab immediately
    try {
      if (newJob) {
        localStorage.setItem(
          'ai_job_posted_event',
          JSON.stringify({
            job: newJob,
            timestamp: Date.now(),
          })
        );
      }
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'JOB_CREATED', job: newJob }, '*');
      }
      const bc = new BroadcastChannel('ai_job_channel');
      bc.postMessage({ type: 'JOB_CREATED', job: newJob });
      bc.close();
    } catch (e) {
      console.warn('Cross-tab broadcast error:', e);
    }

    // Automatically close this newly opened tab and return to previous tab without delay
    setTimeout(() => {
      let wasClosed = false;
      try {
        if (window.opener) {
          window.close();
          wasClosed = true;
        }
      } catch {}
      if (!wasClosed) {
        try {
          window.close();
        } catch {}
      }
      onBack();
    }, 150);
  };

  if (isLoading && !activeUser) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center py-20">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-800">Verifying Recruiter Session...</p>
        <p className="text-xs text-slate-500 mt-1">Synchronizing active account access</p>
      </div>
    );
  }

  if (!isRecruiter) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl shadow-xs">
          <Briefcase className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Recruiter Authentication Required</h3>
        <p className="text-xs text-slate-600 mb-6 max-w-md mx-auto leading-relaxed">
          Posting new job opportunities and setting up autonomous multi-stage recruitment pipelines requires verified recruiter authorization.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Return to Homepage
          </button>
          <button
            onClick={() => setIsLoginOpen(true)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
          >
            Sign In as Recruiter
          </button>
        </div>

        <RecruiterLogin
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onSuccessRedirect={() => setIsLoginOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Action Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <button
              onClick={onBack}
              className="text-slate-500 hover:text-blue-600 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Recruiter Portal</span>
            </button>
            <span>/</span>
            <span className="text-blue-600 font-semibold">Post New Opportunity</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Publish New Opportunity
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure job openings, multi-stage pipelines, Stage 2 technical assessments (MCQs &amp; coding challenges with 3 shown and 5 hidden test cases), and AI interviewer questions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>

      {isCreatedSuccess ? (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Job Opportunity Successfully Published!</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Your opening is now live and the previous recruiter dashboard tab has been updated automatically.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                try {
                  window.close();
                } catch {}
                onBack();
              }}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
            >
              Close This Tab
            </button>
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              View in Recruiter Portal
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <PostJobModal
            isOpen={true}
            onClose={onBack}
            token={activeToken || token || ''}
            onJobCreated={handleJobCreated}
            asTab={true}
          />
        </div>
      )}
    </div>
  );
};
