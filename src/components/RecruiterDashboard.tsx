import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  Search,
  ArrowRight,
  Clock,
  ShieldAlert,
  Calendar,
  GitMerge,
  Mail,
  MapPin,
  ChevronRight,
  Filter,
  Sparkles,
  Edit3,
  Trash2,
  Code2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Job,
  ApplicationStatus,
  InterviewStatus,
  RecruiterReport,
} from '../types/index';
import { RecruiterReportModal } from './RecruiterReportModal';
import { CandidateComparisonModal } from './CandidateComparisonModal';
import { RecruiterPipelineBoard } from './RecruiterPipelineBoard';
import { UpdateCandidateRoundModal } from './UpdateCandidateRoundModal';
import { RecruiterEmailModal } from './RecruiterEmailModal';
import { PostJobModal } from './PostJobModal';
import { RecruiterIntegrityCenter } from './RecruiterIntegrityCenter';
import { RecruiterAssessments } from './RecruiterAssessments';
import { AtsEvaluationModal } from './AtsEvaluationModal';
import { useNotification } from '../context/NotificationContext';

interface RecruiterDashboardProps {
  onJobCreated?: (newJob?: Job) => void;
  externalJobs?: Job[];
}

export const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ onJobCreated, externalJobs }) => {
  const { user, token } = useAuth();
  const { showError, showSuccess } = useNotification();

  // Metrics
  const [metrics, setMetrics] = useState({
    activeJobs: 0,
    totalApplications: 0,
    interviewsReady: 0,
    interviewsCompleted: 0,
    shortlisted: 0,
    malpracticeFlagged: 0,
  });

  // State
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Job[]>(externalJobs || []);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'pipeline' | 'assessments' | 'candidates' | 'integrity'>('jobs');

  // Candidate Directory Filters
  const [searchCandidate, setSearchCandidate] = useState('');
  const [filterJobId, setFilterJobId] = useState<string>('ALL');
  const [filterStage, setFilterStage] = useState<number | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Selected candidate for report modal
  const [selectedReport, setSelectedReport] = useState<RecruiterReport | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Comparison selection
  const [selectedForComparison, setSelectedForComparison] = useState<RecruiterReport[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Post Job Modal & Job Management
  const [isPostJobOpen, setIsPostJobOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeletingJob, setIsDeletingJob] = useState(false);

  // Synchronize with externalJobs prop if provided
  useEffect(() => {
    if (externalJobs !== undefined) {
      setJobs(externalJobs);
    }
  }, [externalJobs]);

  // Open in a new tab when clicked; pass active session so new tab never asks for sign in
  const handleOpenPostJobTab = () => {
    setJobToEdit(null);
    try {
      const searchParams = new URLSearchParams();
      searchParams.set('view', 'post-job');
      if (token) {
        searchParams.set('sessionToken', token);
      }
      if (user) {
        searchParams.set('sessionUser', encodeURIComponent(JSON.stringify(user)));
      }
      const url = `${window.location.origin}${window.location.pathname}?${searchParams.toString()}`;
      const newTab = window.open(url, '_blank');
      if (newTab) {
        newTab.focus();
        return;
      }
    } catch (e) {
      console.warn('Could not open in new tab, falling back to modal:', e);
    }
    // Fallback if popup blocker prevented opening
    setIsPostJobOpen(true);
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    setIsDeletingJob(true);
    try {
      const res = await fetch(`/api/jobs/${jobToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showSuccess(`Job "${jobToDelete.title}" and its pipeline were deleted successfully.`, 'Job Deleted');
        if (selectedJob?.id === jobToDelete.id) {
          setSelectedJob(null);
        }
        setJobToDelete(null);
        fetchDashboardData();
        if (onJobCreated) {
          onJobCreated();
        }
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to delete job', 'Delete Error');
      }
    } catch (err) {
      showError('Network error while deleting job opening.', 'Delete Error');
    } finally {
      setIsDeletingJob(false);
    }
  };

  // Candidate Scheduling Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedCandidateForSchedule, setSelectedCandidateForSchedule] = useState<any | null>(null);
  const [schedStartDate, setSchedStartDate] = useState('');
  const [schedStartTime, setSchedStartTime] = useState('09:00');
  const [schedEndDate, setSchedEndDate] = useState('');
  const [schedEndTime, setSchedEndTime] = useState('18:00');
  const [isScheduling, setIsScheduling] = useState(false);

  // Candidate Pipeline Round Update Modal
  const [selectedCandidateForRoundUpdate, setSelectedCandidateForRoundUpdate] = useState<any | null>(null);
  const [isUpdateRoundOpen, setIsUpdateRoundOpen] = useState(false);

  // Direct Recruiter Email Modal
  const [selectedCandidateForEmail, setSelectedCandidateForEmail] = useState<any | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // ATS Evaluation Dossier Modal
  const [selectedCandidateForAts, setSelectedCandidateForAts] = useState<any | null>(null);

  // Real-time synchronization: cross-tab storage event, periodic refresh & focus sync
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 3500);

    const handleFocus = () => {
      fetchDashboardData();
    };

    const handleNewJob = (job: Job) => {
      if (!job) return;
      setJobs(prev => [job, ...prev.filter(j => j.id !== job.id)]);
      setSelectedJob(job);
      if (onJobCreated) onJobCreated(job);
      showSuccess(`New opportunity "${job.title}" published and synchronized immediately!`, 'Opportunity Live');
      fetchDashboardData();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ai_job_posted_event' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data?.job) {
            handleNewJob(data.job);
          }
        } catch {}
      }
    };

    const handleMessage = (e: MessageEvent) => {
      if ((e.data?.type === 'JOB_CREATED' || e.data?.type === 'ai_job_posted_event') && e.data?.job) {
        handleNewJob(e.data.job);
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('ai_job_channel');
      bc.onmessage = (e) => {
        if ((e.data?.type === 'JOB_CREATED' || e.data?.type === 'ai_job_posted_event') && e.data?.job) {
          handleNewJob(e.data.job);
        }
      };
    } catch {}

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleMessage);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
      if (bc) {
        bc.close();
      }
    };
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Load Recruiter's jobs & candidates in parallel
      const [jobsRes, candRes] = await Promise.all([
        fetch('/api/recruiter/jobs', { headers }),
        fetch('/api/recruiter/candidates', { headers }),
      ]);

      let jobsData: Job[] = [];
      if (jobsRes.ok) {
        jobsData = await jobsRes.json();
      } else {
        // Fallback to active jobs list if recruiter endpoint fails
        const fallbackRes = await fetch('/api/jobs');
        if (fallbackRes.ok) {
          jobsData = await fallbackRes.json();
        }
      }

      if (Array.isArray(jobsData)) {
        setJobs(jobsData);
      }

      const activeJobsCount = jobsData.length;
      if (selectedJob) {
        const updated = jobsData.find((j: Job) => j.id === selectedJob.id);
        if (updated) setSelectedJob(updated);
      }

      if (candRes.ok) {
        const candData = await candRes.json();
        setCandidates(candData);

        // Calculate KPI metrics
        const total = candData.length;
        const ready = candData.filter((c: any) => c.interviewStatus === InterviewStatus.READY_TO_ATTEND).length;
        const completed = candData.filter((c: any) => c.interviewStatus === InterviewStatus.COMPLETED).length;
        const shortlisted = candData.filter((c: any) => c.status === ApplicationStatus.SHORTLISTED || c.selectedForStage).length;
        const malpractice = candData.filter((c: any) => c.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED).length;

        setMetrics({
          activeJobs: activeJobsCount,
          totalApplications: total,
          interviewsReady: ready,
          interviewsCompleted: completed,
          shortlisted: shortlisted,
          malpracticeFlagged: malpractice,
        });
      }
    } catch (err) {
      console.error('Failed to load recruiter dashboard telemetry:', err);
    }
  };

  const handleOpenReport = async (interviewId: string) => {
    try {
      const res = await fetch(`/api/reports/${interviewId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedReport(data);
        setIsReportOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch candidate report:', err);
    }
  };

  const handleOpenScheduleModal = (cand: any) => {
    setSelectedCandidateForSchedule(cand);
    setSchedStartDate(cand.interviewStartDate || new Date().toISOString().split('T')[0]);
    setSchedStartTime(cand.interviewStartTime || '09:00');
    setSchedEndDate(cand.interviewEndDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setSchedEndTime(cand.interviewEndTime || '18:00');
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidateForSchedule) return;

    setIsScheduling(true);
    try {
      const res = await fetch(`/api/recruiter/applications/${selectedCandidateForSchedule.id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: schedStartDate,
          startTime: schedStartTime,
          endDate: schedEndDate,
          endTime: schedEndTime,
        }),
      });

      setIsScheduling(false);
      if (res.ok) {
        setIsScheduleModalOpen(false);
        fetchDashboardData();
        showSuccess('Candidate interview scheduled & notification email dispatched!', 'Interview Scheduled');
      } else {
        const d = await res.json();
        showError(d.error || 'Failed to update schedule', 'Scheduling Error');
      }
    } catch (err) {
      setIsScheduling(false);
      showError('Error updating schedule. Please check your connection.', 'Connection Error');
    }
  };

  const toggleCompare = (report: RecruiterReport) => {
    if (!report) return;
    if (selectedForComparison.some(c => c.interviewId === report.interviewId)) {
      setSelectedForComparison(prev => prev.filter(c => c.interviewId !== report.interviewId));
    } else {
      if (selectedForComparison.length >= 2) {
        setSelectedForComparison([selectedForComparison[1], report]);
      } else {
        setSelectedForComparison(prev => [...prev, report]);
      }
    }
  };

  const handleSelectJobForPipeline = (job: Job) => {
    setSelectedJob(job);
    setActiveTab('pipeline');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Candidate Directory Filtering
  const filteredCandidates = useMemo(() => {
    return candidates.filter(cand => {
      const name = (cand.candidate?.fullName || cand.candidate?.name || '').toLowerCase();
      const jobTitle = (cand.job?.title || '').toLowerCase();
      const code = (cand.interviewCode || cand.id || '').toLowerCase();
      const email = (cand.candidate?.email || '').toLowerCase();
      const q = searchCandidate.toLowerCase().trim();

      const nameMatch = !q || name.includes(q) || jobTitle.includes(q) || code.includes(q) || email.includes(q);
      const stageMatch = filterStage === 'ALL' || (cand.currentRoundNumber || 1) === filterStage;
      const jobMatch = filterJobId === 'ALL' || cand.jobId === filterJobId;

      const isDisqualified = cand.status === ApplicationStatus.REJECTED;
      const isSelected = Boolean(cand.selectedForStage) && !isDisqualified;
      const isNotSelected = !cand.selectedForStage && !isDisqualified;

      let statusMatch = true;
      if (filterStatus === 'SELECTED') statusMatch = isSelected;
      else if (filterStatus === 'NOT_SELECTED') statusMatch = isNotSelected;
      else if (filterStatus === 'DISQUALIFIED') statusMatch = isDisqualified;
      else if (filterStatus !== 'ALL') {
        statusMatch = cand.status === filterStatus || cand.interviewStatus === filterStatus;
      }

      return nameMatch && stageMatch && jobMatch && statusMatch;
    });
  }, [candidates, searchCandidate, filterStage, filterJobId, filterStatus]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Enterprise Recruitment Command</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">Recruiter Portal</h1>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-800">{user?.fullName}</span>. Manage job pipelines, candidate evaluations, and stage progression.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedForComparison.length === 2 && (
            <button
              onClick={() => setIsComparisonOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Compare Selected (2)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleOpenPostJobTab}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Post New Opportunity</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Active Jobs</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{jobs.length}</span>
          <span className="text-[10px] text-blue-600 font-semibold mt-1 inline-block">Hiring Pipeline</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Applications</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{metrics.totalApplications}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">All Candidates</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Interviews Ready</span>
          <span className="text-2xl font-extrabold text-blue-600 mt-1 block">{metrics.interviewsReady}</span>
          <span className="text-[10px] text-blue-600 font-semibold mt-1 inline-block">Access Codes Issued</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Completed</span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">{metrics.interviewsCompleted}</span>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 inline-block">Dossiers Generated</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Selected Pool</span>
          <span className="text-2xl font-extrabold text-indigo-600 mt-1 block">{metrics.shortlisted}</span>
          <span className="text-[10px] text-indigo-600 font-semibold mt-1 inline-block">Qualified Candidates</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Malpractice Flagged</span>
          <span className="text-2xl font-extrabold text-rose-600 mt-1 block">{metrics.malpracticeFlagged}</span>
          <span className="text-[10px] text-rose-600 font-semibold mt-1 inline-block">Integrity Violations</span>
        </div>
      </div>

      {/* Recruiter Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {/* 1. Jobs – Main Entry Point */}
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 px-3.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'jobs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Jobs ({jobs.length})</span>
        </button>

        {/* 2. Pipeline Board */}
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`pb-3 px-3.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'pipeline'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GitMerge className="w-4 h-4" />
          <span>
            Pipeline Board
            {selectedJob ? ` – ${selectedJob.title}` : ''}
          </span>
        </button>

        {/* 3. Technical Assessments */}
        <button
          onClick={() => setActiveTab('assessments')}
          className={`pb-3 px-3.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'assessments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>Technical Assessments</span>
        </button>

        {/* 4. Candidate Directory */}
        <button
          onClick={() => setActiveTab('candidates')}
          className={`pb-3 px-3.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'candidates'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Candidate Directory ({candidates.length})</span>
        </button>

        {/* 5. Integrity Center */}
        <button
          onClick={() => setActiveTab('integrity')}
          className={`pb-3 px-3.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'integrity'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Integrity Center</span>
        </button>
      </div>

      {/* TAB 1: JOBS (Main Entry Point for Recruitment) */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">Job Opportunities</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select a job below to open its isolated 5-stage recruitment pipeline board.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {jobs.length} Job{jobs.length !== 1 ? 's' : ''} Posted
            </span>
          </div>

          {jobs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Job Opportunities Posted</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Publish your first job opportunity to launch the autonomous screening and interview pipeline.
              </p>
              <button
                onClick={handleOpenPostJobTab}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Post New Opportunity</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {jobs.map(job => {
                const applicantCount = candidates.filter(c => c.jobId === job.id).length;
                const activeInPipeline = candidates.filter(c => c.jobId === job.id && c.status !== ApplicationStatus.REJECTED).length;

                return (
                  <div
                    key={job.id}
                    onClick={() => handleSelectJobForPipeline(job)}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between cursor-pointer group"
                  >
                    <div>
                      {/* Top Row: Department & Status */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {job.department || 'Engineering'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          job.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {job.status || 'ACTIVE'}
                        </span>
                      </div>

                      {/* Job Title & Job ID */}
                      <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          ID: {job.jobCode || job.id}
                        </span>
                        {job.technicalAssessmentCode && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded flex items-center gap-1" title="12-digit Technical Assessment Code for this job & questions">
                            <span className="text-purple-400">Exam Code:</span> {job.technicalAssessmentCode}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {job.location} ({job.workMode || 'Remote'})
                        </span>
                      </div>

                      {/* Key Job Metrics Badges */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 font-medium block">Openings</span>
                          <span className="font-bold text-slate-800 text-sm">{job.openings || 1} Position{job.openings !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="bg-blue-50/60 p-2 rounded-xl">
                          <span className="text-[10px] text-blue-600 font-medium block">Total Applicants</span>
                          <span className="font-bold text-blue-800 text-sm">{applicantCount} Candidates</span>
                        </div>
                      </div>

                      {/* 5-Stage Preview Chips */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          5-Stage Evaluation Pipeline
                        </span>
                        <div className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[9px] font-semibold rounded">
                            1. Screening
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[9px] font-semibold rounded">
                            2. Tech Test
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[9px] font-semibold rounded">
                            3. AI Voice
                          </span>
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-semibold rounded border border-emerald-200">
                            4. Final Offer
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Metadata & Actions */}
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedJob(job);
                            setActiveTab('assessments');
                          }}
                          title="View Technical Assessments for this job"
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Assessments</span>
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setJobToEdit(job);
                            setIsPostJobOpen(true);
                          }}
                          title="Edit Job Opening, Questions & Rounds"
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setJobToDelete(job);
                          }}
                          title="Delete Job Opening"
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Delete</span>
                        </button>
                      </div>
                      <div className="px-3 py-1.5 bg-blue-600 group-hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition">
                        <span>Pipeline Board</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PIPELINE BOARD (Job Specific) */}
      {activeTab === 'pipeline' && (
        <>
          {selectedJob ? (
            <RecruiterPipelineBoard
              job={selectedJob}
              allCandidates={candidates}
              token={token}
              onBackToJobs={() => {
                setSelectedJob(null);
                setActiveTab('jobs');
              }}
              onOpenReport={handleOpenReport}
              onOpenSendEmail={cand => {
                setSelectedCandidateForEmail(cand);
                setIsEmailModalOpen(true);
              }}
              onRefreshData={fetchDashboardData}
              onNavigateToAssessments={() => setActiveTab('assessments')}
              onEditJob={j => {
                setJobToEdit(j);
                setIsPostJobOpen(true);
              }}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center">
              <Briefcase className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900">Select a Job Opportunity</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
                Each job maintains an isolated 5-stage recruitment pipeline. Choose a job below to view and manage its candidates:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                {jobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJobForPipeline(job)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition text-left cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                      {job.department || 'Engineering'}
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">{job.title}</span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {candidates.filter(c => c.jobId === job.id).length} Applicants • ID: {job.jobCode || job.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 3: TECHNICAL ASSESSMENTS */}
      {activeTab === 'assessments' && (
        <RecruiterAssessments
          token={token}
          jobs={jobs}
          selectedJob={selectedJob}
          onSelectJob={setSelectedJob}
          onEditJob={job => {
            setJobToEdit(job);
            setIsPostJobOpen(true);
          }}
        />
      )}

      {/* TAB 3: CANDIDATE DIRECTORY (Across All Jobs) */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchCandidate}
                onChange={e => setSearchCandidate(e.target.value)}
                placeholder="Search candidates by name, email, role, or access code..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Select Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Job Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Job:</span>
                <select
                  value={filterJobId}
                  onChange={e => setFilterJobId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Jobs ({jobs.length})</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Stage:</span>
                <select
                  value={filterStage}
                  onChange={e => setFilterStage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Stages</option>
                  <option value={1}>Stage 1 – Resume Screening</option>
                  <option value={2}>Stage 2 – Technical Assessment</option>
                  <option value={3}>Stage 3 – AI Voice Interview</option>
                  <option value={4}>Stage 4 – Final Selection / Offer</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Status:</span>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SELECTED">Selected for Stage</option>
                  <option value="NOT_SELECTED">Pending / Not Selected</option>
                  <option value="DISQUALIFIED">Disqualified / Rejected</option>
                  <option value={InterviewStatus.COMPLETED}>Interview Completed</option>
                  <option value={InterviewStatus.READY_TO_ATTEND}>Ready to Attend</option>
                  <option value={InterviewStatus.MALPRACTICE_TERMINATED}>Malpractice Terminated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Candidate Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Candidate</th>
                    <th className="p-3.5">Job Opportunity</th>
                    <th className="p-3.5">Current Stage</th>
                    <th className="p-3.5 text-center">Screening (ATS)</th>
                    <th className="p-3.5 text-center">Tech Score</th>
                    <th className="p-3.5 text-center">AI Voice</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        No candidates match the specified search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map(cand => {
                      const rep = cand.report as RecruiterReport | undefined;
                      const isDisqualified = cand.status === ApplicationStatus.REJECTED;
                      const isSelected = Boolean(cand.selectedForStage) && !isDisqualified;
                      const stageNum = cand.currentRoundNumber || 1;

                      const stageNames: Record<number, string> = {
                        1: '1. Resume Screening',
                        2: '2. Technical Test',
                        3: '3. AI Interview',
                        4: '4. Final Selection / Offer',
                      };

                      return (
                        <tr key={cand.id} className="hover:bg-slate-50/80 transition">
                          {/* Candidate Name & Code */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{cand.candidate?.fullName || cand.candidate?.name}</div>
                            <div className="text-[11px] text-slate-400">{cand.candidate?.email}</div>
                            <span className="text-[10px] text-blue-600 font-mono font-semibold">
                              ID: {cand.interviewCode || cand.id}
                            </span>
                          </td>

                          {/* Opportunity */}
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-800">{cand.job?.title}</div>
                            <div className="text-[11px] text-slate-400">{cand.job?.department || 'Engineering'}</div>
                          </td>

                          {/* Current Stage */}
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 block max-w-fit">
                              {stageNames[stageNum] || `Stage ${stageNum}`}
                            </span>
                          </td>

                          {/* Screening ATS */}
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedCandidateForAts(cand)}
                              title="Click to view Confidential AI ATS Dossier & Breakdown"
                              className="font-bold text-slate-800 hover:text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              {(() => {
                                const candAts = cand.scores?.atsScore ?? cand.atsScore ?? (cand.roundProgression?.find((r: any) => r.roundNumber === 1)?.score);
                                return <span>{candAts != null ? `${candAts}%` : '—'}</span>;
                              })()}
                              <Sparkles className="w-3 h-3 text-blue-500 opacity-60" />
                            </button>
                          </td>

                          {/* Tech Score */}
                          <td className="p-3.5 text-center">
                            <span className="font-semibold text-slate-700">
                              {(() => {
                                const candTech = cand.scores?.technicalScore ?? cand.technicalAssessmentScore ?? (cand.roundProgression?.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')?.score);
                                return candTech != null ? `${candTech}%` : '—';
                              })()}
                            </span>
                          </td>

                          {/* AI Voice Score */}
                          <td className="p-3.5 text-center">
                            {rep ? (
                              <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full text-[11px]">
                                {rep.overallScore}%
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-3.5 text-center">
                            {isDisqualified ? (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
                                Disqualified
                              </span>
                            ) : isSelected ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                                Selected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                                In Review
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Open Job Pipeline Button */}
                              {cand.job && (
                                <button
                                  onClick={() => handleSelectJobForPipeline(cand.job)}
                                  title="Go to Job Pipeline Board"
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <GitMerge className="w-3 h-3 text-slate-500" />
                                  <span>Job Board</span>
                                </button>
                              )}

                              {/* View ATS Dossier */}
                              <button
                                onClick={() => setSelectedCandidateForAts(cand)}
                                title="View AI ATS Resume Screening Dossier"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                              >
                                <Sparkles className="w-4 h-4 text-blue-600" />
                              </button>

                              {/* Email */}
                              <button
                                onClick={() => {
                                  setSelectedCandidateForEmail(cand);
                                  setIsEmailModalOpen(true);
                                }}
                                title="Send Direct Email to Candidate"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                              >
                                <Mail className="w-4 h-4" />
                              </button>

                              {/* View Report */}
                              {cand.interviewId && (
                                <button
                                  onClick={() => handleOpenReport(cand.interviewId)}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold shadow-xs transition cursor-pointer"
                                >
                                  Report
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INTEGRITY CENTER */}
      {activeTab === 'integrity' && (
        <RecruiterIntegrityCenter
          token={token}
          onOpenReport={handleOpenReport}
        />
      )}

      {/* Report Modal */}
      <RecruiterReportModal
        report={selectedReport}
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onActionComplete={fetchDashboardData}
      />

      {/* Candidate Comparison Modal */}
      <CandidateComparisonModal
        candidates={selectedForComparison}
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
      />

      {/* Post / Edit Opportunity Modal */}
      <PostJobModal
        isOpen={isPostJobOpen}
        onClose={() => {
          setIsPostJobOpen(false);
          setJobToEdit(null);
        }}
        token={token || ''}
        jobToEdit={jobToEdit}
        onJobCreated={(newJob?: Job) => {
          if (newJob) {
            setJobs(prev => {
              const exists = prev.some(j => j.id === newJob.id);
              if (exists) return prev.map(j => j.id === newJob.id ? newJob : j);
              return [newJob, ...prev];
            });
            setSelectedJob(newJob);
            setActiveTab('jobs');
            setMetrics(prev => ({ ...prev, activeJobs: prev.activeJobs + 1 }));
          }
          fetchDashboardData();
          if (onJobCreated) onJobCreated(newJob);
        }}
      />

      {/* Delete Job Confirmation Modal */}
      {jobToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Job Opening</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete the job opening{' '}
              <strong className="text-slate-900 font-bold">"{jobToDelete.title}"</strong> (Code: {jobToDelete.jobCode || jobToDelete.id})? This will also remove all configured technical assessment questions and candidates in its pipeline.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-5 border-t border-slate-100 mt-5">
              <button
                type="button"
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingJob}
                onClick={handleDeleteJob}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingJob ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Candidate Round Status Modal */}
      <UpdateCandidateRoundModal
        isOpen={isUpdateRoundOpen}
        onClose={() => setIsUpdateRoundOpen(false)}
        candidateRegistration={selectedCandidateForRoundUpdate}
        token={token || ''}
        onUpdated={fetchDashboardData}
      />

      {/* Direct Recruiter Email Modal */}
      <RecruiterEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        candidateRegistration={selectedCandidateForEmail}
        token={token || ''}
        onEmailSent={fetchDashboardData}
      />

      {/* HardCore AI ATS Evaluation Dossier Modal */}
      {selectedCandidateForAts && (
        <AtsEvaluationModal
          isOpen={Boolean(selectedCandidateForAts)}
          onClose={() => setSelectedCandidateForAts(null)}
          candidate={selectedCandidateForAts}
          onAtsUpdated={(updatedCandidate) => {
            setSelectedCandidateForAts(updatedCandidate);
            fetchDashboardData();
          }}
        />
      )}

      {/* Candidate Schedule Modal */}
      {isScheduleModalOpen && selectedCandidateForSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Schedule Candidate Interview</h2>
                <p className="text-xs text-slate-500">
                  {selectedCandidateForSchedule.candidate?.fullName} ({selectedCandidateForSchedule.interviewCode})
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={schedStartDate}
                    onChange={e => setSchedStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={schedStartTime}
                    onChange={e => setSchedStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={schedEndDate}
                    onChange={e => setSchedEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={schedEndTime}
                    onChange={e => setSchedEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isScheduling}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isScheduling ? 'Saving...' : 'Save & Notify Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
