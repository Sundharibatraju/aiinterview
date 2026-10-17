import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useNotification } from './context/NotificationContext';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { JobListings } from './components/JobListings';
import { JobDetailModal } from './components/JobDetailModal';
import { RegistrationSuccessModal } from './components/RegistrationSuccessModal';
import { CandidateLogin } from './components/CandidateLogin';
import { CandidateRegister } from './components/CandidateRegister';
import { OtpModal } from './components/OtpModal';
import { RecruiterLogin } from './components/RecruiterLogin';
import { MyInterviews } from './components/MyInterviews';
import { InterviewCodeGate } from './components/InterviewCodeGate';
import { PreInterviewLobby } from './components/PreInterviewLobby';
import { InterviewRoom } from './components/InterviewRoom';
import { CandidateReportView } from './components/CandidateReportView';
import { RecruiterDashboard } from './components/RecruiterDashboard';
import { CandidateProfileModal } from './components/CandidateProfileModal';
import { TechnicalAssessmentModal } from './components/TechnicalAssessmentModal';
import { PostJobPage } from './components/PostJobPage';
import { Job, InterviewRegistration, UserRole } from './types/index';

function MainApp() {
  const { user, token, isLoading } = useAuth();
  const { showError, showWarning } = useNotification();

  // Navigation view initialized from URL if opened in new tab (e.g. ?view=post-job)
  const [currentView, setCurrentView] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam) return viewParam;
      if (window.location.pathname === '/post-job') return 'post-job';
    } catch {}
    return 'landing';
  });

  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        if (viewParam) {
          setCurrentView(viewParam);
        } else if (window.location.pathname === '/post-job') {
          setCurrentView('post-job');
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<InterviewRegistration[]>([]);

  // Selected entities
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeRegistration, setActiveRegistration] = useState<InterviewRegistration | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activeCodeForGate, setActiveCodeForGate] = useState<string>('');

  // Modals
  const [isCandidateLoginOpen, setIsCandidateLoginOpen] = useState(false);
  const [isCandidateRegisterOpen, setIsCandidateRegisterOpen] = useState(false);
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [isRecruiterLoginOpen, setIsRecruiterLoginOpen] = useState(false);
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false);
  const [isRegistrationSuccessOpen, setIsRegistrationSuccessOpen] = useState(false);
  const [newlyCreatedRegistration, setNewlyCreatedRegistration] = useState<InterviewRegistration | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [assessmentRegistration, setAssessmentRegistration] = useState<InterviewRegistration | null>(null);

  // Fetch jobs in real-time from database
  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      try {
        const res = await fetch('/api/jobs');
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setJobs(data);
          }
        }
      } catch (err: any) {
        // Transient network drop during dev server reload/connection reset
        console.warn('[Jobs] Network fetch transient issue, retrying...', err?.message || err);
      }
    };

    loadJobs();
    const interval = setInterval(loadJobs, 4000);

    const handleSyncJob = (newJob: Job) => {
      if (!newJob) return;
      setJobs(prev => {
        const exists = prev.some(j => j.id === newJob.id);
        if (exists) return prev.map(j => j.id === newJob.id ? newJob : j);
        return [newJob, ...prev];
      });
      fetchJobs(newJob);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ai_job_posted_event' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data?.job) {
            handleSyncJob(data.job);
          }
        } catch {}
      }
    };

    const handleMessage = (e: MessageEvent) => {
      if ((e.data?.type === 'JOB_CREATED' || e.data?.type === 'ai_job_posted_event') && e.data?.job) {
        handleSyncJob(e.data.job);
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('ai_job_channel');
      bc.onmessage = (e) => {
        if ((e.data?.type === 'JOB_CREATED' || e.data?.type === 'ai_job_posted_event') && e.data?.job) {
          handleSyncJob(e.data.job);
        }
      };
    } catch {}

    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleMessage);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
      if (bc) {
        bc.close();
      }
    };
  }, [currentView]);

  const fetchJobs = async (newJob?: Job) => {
    if (newJob) {
      setJobs(prev => {
        const exists = prev.some(j => j.id === newJob.id);
        if (exists) return prev.map(j => j.id === newJob.id ? newJob : j);
        return [newJob, ...prev];
      });
    }
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setJobs(data);
        }
      }
    } catch (err: any) {
      console.warn('[Jobs] Network fetch transient issue:', err?.message || err);
    }
  };

  // Fetch candidate registrations if logged in
  useEffect(() => {
    if (token && user?.role === UserRole.CANDIDATE) {
      fetchMyRegistrations();
    } else {
      setMyRegistrations([]);
    }
  }, [token, user]);

  const fetchMyRegistrations = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/applications/my-interviews', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMyRegistrations(data);
        }
      }
    } catch (err: any) {
      console.warn('[Interviews] Transient fetch issue:', err?.message || err);
    }
  };

  // Register for Interview Action
  const handleRegisterJob = async (job: Job) => {
    if (!user) {
      setIsCandidateLoginOpen(true);
      return;
    }

    if (user.role !== UserRole.CANDIDATE) {
      showWarning('Recruiters cannot register for interviews. Please switch to a candidate account.', 'Registration Restricted');
      return;
    }

    try {
      const res = await fetch('/api/applications/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.profileIncomplete) {
          setIsProfileOpen(true);
        }
        showError(data.error || 'Failed to complete registration', 'Application Notice');
        return;
      }

      setNewlyCreatedRegistration(data.registration);
      setIsRegistrationSuccessOpen(true);
      fetchMyRegistrations();
    } catch (err) {
      showError('Network error while registering for position. Please check your connection and try again.', 'Connection Error');
    }
  };

  // View Routing Handlers
  const handleStartInterviewFromCode = (code: string) => {
    setActiveCodeForGate(code);
    setCurrentView('code-gate');
  };

  const handleCodeValidated = (registration: InterviewRegistration) => {
    setActiveRegistration(registration);
    setCurrentView('pre-interview');
  };

  const handleEnterInterviewRoom = () => {
    setCurrentView('interview-room');
  };

  const handleInterviewFinished = () => {
    if (activeRegistration) {
      setSelectedReportId(activeRegistration.id);
      setCurrentView('candidate-report');
      fetchMyRegistrations();
    } else {
      setCurrentView('my-interviews');
    }
  };

  const handleTerminated = () => {
    fetchMyRegistrations();
    setCurrentView('my-interviews');
  };

  const handleViewReport = (registrationId: string) => {
    setSelectedReportId(registrationId);
    setCurrentView('candidate-report');
  };

  const registeredJobIds = myRegistrations.map(r => r.jobId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Hide global header in distraction-free interview room */}
      {currentView !== 'interview-room' && (
        <Header
          currentView={currentView}
          onNavigate={view => {
            if (view === 'candidate-profile') {
              setIsProfileOpen(true);
            } else {
              setCurrentView(view);
            }
          }}
          onOpenCandidateLogin={() => setIsCandidateLoginOpen(true)}
          onOpenCandidateRegister={() => setIsCandidateRegisterOpen(true)}
          onOpenRecruiterLogin={() => setIsRecruiterLoginOpen(true)}
        />
      )}

      {/* View Router */}
      <div className="flex-1">
        {currentView === 'landing' && (
          <LandingPage
            onExploreJobs={() => setCurrentView('jobs')}
            onRecruiterLogin={() => setIsRecruiterLoginOpen(true)}
            onCandidateRegister={() => setIsCandidateRegisterOpen(true)}
            featuredJobs={jobs}
            onSelectJob={job => {
              setSelectedJob(job);
              setIsJobDetailOpen(true);
            }}
            onNavigate={setCurrentView}
          />
        )}

        {currentView === 'jobs' && (
          <JobListings
            jobs={jobs}
            onSelectJob={job => {
              setSelectedJob(job);
              setIsJobDetailOpen(true);
            }}
            onRegisterJob={handleRegisterJob}
            registeredJobIds={registeredJobIds}
          />
        )}

        {currentView === 'my-interviews' && (
          <MyInterviews
            registrations={myRegistrations}
            onAttendInterview={handleStartInterviewFromCode}
            onViewReport={handleViewReport}
            onExploreMoreJobs={() => setCurrentView('jobs')}
            onAttendAssessment={reg => {
              setAssessmentRegistration(reg);
              setIsAssessmentOpen(true);
            }}
          />
        )}

        {currentView === 'code-gate' && (
          <InterviewCodeGate
            initialCode={activeCodeForGate}
            onCodeValidated={handleCodeValidated}
            onBackToInterviews={() => setCurrentView('my-interviews')}
          />
        )}

        {currentView === 'pre-interview' && activeRegistration && (
          <PreInterviewLobby
            registration={activeRegistration}
            onEnterInterview={handleEnterInterviewRoom}
            onCancel={() => setCurrentView('my-interviews')}
          />
        )}

        {currentView === 'interview-room' && activeRegistration && (
          <InterviewRoom
            registration={activeRegistration}
            onInterviewFinished={handleInterviewFinished}
            onTerminated={handleTerminated}
          />
        )}

        {currentView === 'candidate-report' && selectedReportId && (
          <CandidateReportView
            registrationId={selectedReportId}
            onBack={() => setCurrentView('my-interviews')}
          />
        )}

        {currentView === 'recruiter-dashboard' && (
          isLoading && !user ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center py-20">
              <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-semibold text-slate-800">Loading Recruiter Portal...</p>
              <p className="text-xs text-slate-500 mt-1">Synchronizing active account access</p>
            </div>
          ) : user?.role === UserRole.RECRUITER || user?.role === UserRole.ADMIN ? (
            <RecruiterDashboard onJobCreated={fetchJobs} externalJobs={jobs} />
          ) : (
            <div className="max-w-md mx-auto my-16 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                !
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Recruiter Access Required</h3>
              <p className="text-xs text-slate-600 mb-6">
                You must be authenticated with a verified recruiter organization account to access the recruiter pipeline and evaluations.
              </p>
              <button
                onClick={() => setIsRecruiterLoginOpen(true)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer"
              >
                Sign In as Recruiter
              </button>
            </div>
          )
        )}

        {currentView === 'post-job' && (
          <PostJobPage
            onBack={() => {
              fetchJobs();
              try {
                window.close();
              } catch {}
              try {
                if (window.location.search) {
                  window.history.pushState({}, '', window.location.pathname);
                }
              } catch {}
              setCurrentView('recruiter-dashboard');
            }}
            onJobCreated={fetchJobs}
          />
        )}
      </div>

      {/* Global Modals */}
      <CandidateLogin
        isOpen={isCandidateLoginOpen}
        onClose={() => setIsCandidateLoginOpen(false)}
        onSwitchToRegister={() => {
          setIsCandidateLoginOpen(false);
          setIsCandidateRegisterOpen(true);
        }}
        onVerificationRequired={email => {
          setOtpEmail(email);
          setIsOtpOpen(true);
        }}
      />

      <CandidateRegister
        isOpen={isCandidateRegisterOpen}
        onClose={() => setIsCandidateRegisterOpen(false)}
        onSwitchToLogin={() => {
          setIsCandidateRegisterOpen(false);
          setIsCandidateLoginOpen(true);
        }}
        onOpenOtp={email => {
          setOtpEmail(email);
          setIsOtpOpen(true);
        }}
      />

      <OtpModal
        isOpen={isOtpOpen}
        onClose={() => setIsOtpOpen(false)}
        email={otpEmail}
        onVerifiedSuccess={() => {
          fetchMyRegistrations();
          if (selectedJob) {
            handleRegisterJob(selectedJob);
          }
        }}
      />

      <RecruiterLogin
        isOpen={isRecruiterLoginOpen}
        onClose={() => setIsRecruiterLoginOpen(false)}
        onSuccessRedirect={() => setCurrentView('recruiter-dashboard')}
      />

      <JobDetailModal
        job={selectedJob}
        isOpen={isJobDetailOpen}
        onClose={() => setIsJobDetailOpen(false)}
        onRegisterForInterview={handleRegisterJob}
      />

      <RegistrationSuccessModal
        registration={newlyCreatedRegistration}
        isOpen={isRegistrationSuccessOpen}
        onClose={() => setIsRegistrationSuccessOpen(false)}
        onViewMyInterviews={() => setCurrentView('my-interviews')}
        onAttendNow={code => handleStartInterviewFromCode(code)}
      />

      <CandidateProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <TechnicalAssessmentModal
        isOpen={isAssessmentOpen}
        onClose={() => setIsAssessmentOpen(false)}
        registration={assessmentRegistration}
        onAssessmentCompleted={fetchMyRegistrations}
        onProceedToInterview={code => handleStartInterviewFromCode(code)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
