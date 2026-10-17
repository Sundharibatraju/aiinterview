import React, { useState, useEffect, useMemo } from 'react';
import {
  Code2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Check,
  Award,
  ChevronRight,
  X,
  ExternalLink,
  ArrowLeft,
  Users,
  Search,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  Filter,
  Edit3,
} from 'lucide-react';
import { TechnicalAssessment, Job } from '../types/index';
import { useNotification } from '../context/NotificationContext';
import { EditAssessmentQuestionsModal } from './EditAssessmentQuestionsModal';

interface RecruiterAssessmentsProps {
  token: string | null;
  jobs: Job[];
  selectedJob?: Job | null;
  onSelectJob?: (job: Job | null) => void;
  onEditJob?: (job: Job) => void;
}

export const RecruiterAssessments: React.FC<RecruiterAssessmentsProps> = ({
  token,
  jobs,
  selectedJob,
  onSelectJob,
  onEditJob,
}) => {
  const { showConfirm, showSuccess, showError } = useNotification();
  const [assessments, setAssessments] = useState<TechnicalAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<TechnicalAssessment | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'results'>('list');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [submissionFilter, setSubmissionFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'FLAGGED'>('ALL');
  const [editingAssessment, setEditingAssessment] = useState<TechnicalAssessment | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'questions' | 'submissions'>('questions');

  useEffect(() => {
    fetchAssessments();
  }, [token]);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recruiter/assessments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssessments(data);
      }
    } catch (err) {
      console.error('Failed to fetch assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssessment = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Assessment?',
      message: 'Are you sure you want to permanently delete this technical assessment? Candidate submissions associated with this test will also be affected.',
      confirmLabel: 'Delete Assessment',
      cancelLabel: 'Keep Assessment',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/recruiter/assessments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAssessments(prev => prev.filter(a => a.id !== id));
        if (selectedAssessment?.id === id) {
          setSelectedAssessment(null);
          setViewMode('list');
        }
        showSuccess('Technical assessment has been removed.', 'Deleted');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to delete assessment', 'Delete Failed');
      }
    } catch (err) {
      console.error('Failed to delete assessment:', err);
      showError('Network error while deleting assessment', 'Connection Error');
    }
  };

  const handleOpenResults = async (assessment: TechnicalAssessment) => {
    setSelectedAssessment(assessment);
    setViewMode('results');
    setLoadingSubmissions(true);
    try {
      const res = await fetch(`/api/recruiter/assessments/${assessment.id}/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleSelectCard = async (assessment: TechnicalAssessment) => {
    setSelectedAssessment(assessment);
    setLoadingSubmissions(true);
    try {
      const res = await fetch(`/api/recruiter/assessments/${assessment.id}/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Filtered Assessments based on selectedJob
  const displayedAssessments = useMemo(() => {
    if (!selectedJob) return assessments;
    return assessments.filter(a => a.jobId === selectedJob.id);
  }, [assessments, selectedJob]);

  // Filtered Submissions for results view
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const name = (sub.candidateName || '').toLowerCase();
      const email = (sub.candidateEmail || '').toLowerCase();
      const q = submissionSearch.toLowerCase().trim();
      const textMatch = !q || name.includes(q) || email.includes(q);

      let statusMatch = true;
      if (submissionFilter === 'PASSED') statusMatch = Boolean(sub.passed);
      else if (submissionFilter === 'FAILED') statusMatch = !sub.passed;
      else if (submissionFilter === 'FLAGGED') statusMatch = sub.integrityStatus === 'FLAGGED';

      return textMatch && statusMatch;
    });
  }, [submissions, submissionSearch, submissionFilter]);

  // Analytics for selected assessment
  const analytics = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return { total: 0, passed: 0, passRate: 0, avgScore: 0, cleanRate: 100 };
    }
    const total = submissions.length;
    const passed = submissions.filter(s => s.passed).length;
    const passRate = Math.round((passed / total) * 100);
    const sumScore = submissions.reduce((acc, s) => acc + (s.percentage || 0), 0);
    const avgScore = Math.round(sumScore / total);
    const cleanCount = submissions.filter(s => s.integrityStatus !== 'FLAGGED').length;
    const cleanRate = Math.round((cleanCount / total) * 100);

    return { total, passed, passRate, avgScore, cleanRate };
  }, [submissions]);

  return (
    <div className="space-y-6">
      {/* If in Results View Mode */}
      {viewMode === 'results' && selectedAssessment ? (
        <div className="space-y-6">
          {/* Top Bar with Back Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('list')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                title="Back to assessments list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedAssessment.difficulty}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {jobs.find(j => j.id === selectedAssessment.jobId)?.title || 'Technical Assessment'}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">{selectedAssessment.title} Results</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenResults(selectedAssessment)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Refresh Results</span>
              </button>
            </div>
          </div>

          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold">Total Submissions</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{analytics.total}</div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Applicants evaluated in Round 2</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold">Pass Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600">
                {analytics.passRate}%
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {analytics.passed} of {analytics.total} scored ≥ {selectedAssessment.passingScore}%
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold">Average Score</span>
                <BarChart3 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-600">{analytics.avgScore}%</div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Average candidate proficiency</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold">Academic Integrity</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{analytics.cleanRate}%</div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Clean sessions with no proctor alerts</span>
            </div>
          </div>

          {/* Submissions Filter & Search */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={submissionSearch}
                  onChange={e => setSubmissionSearch(e.target.value)}
                  placeholder="Search by candidate name or email..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={submissionFilter}
                  onChange={e => setSubmissionFilter(e.target.value as any)}
                  className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Submissions ({submissions.length})</option>
                  <option value="PASSED">Passed Only</option>
                  <option value="FAILED">Failed Only</option>
                  <option value="FLAGGED">Integrity Flagged</option>
                </select>
              </div>
            </div>

            {loadingSubmissions ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading submissions...</div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No matching submissions found for this assessment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Candidate</th>
                      <th className="p-3.5 text-center">Score</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-center">Questions</th>
                      <th className="p-3.5 text-center">Time Taken</th>
                      <th className="p-3.5 text-center">Integrity Status</th>
                      <th className="p-3.5 text-right">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubmissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 block">{sub.candidateName || 'Candidate'}</span>
                          <span className="text-[11px] text-slate-500 block">{sub.candidateEmail}</span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`font-black text-sm px-2.5 py-1 rounded-full ${
                              sub.passed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {sub.percentage}%
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {sub.passed ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                              PASSED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                              FAILED
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-medium text-slate-700">
                          {sub.correct != null ? `${sub.correct} / ${sub.totalQuestions || sub.correct}` : '—'}
                        </td>
                        <td className="p-3.5 text-center text-slate-600 font-medium">
                          {sub.timeTakenMinutes ? `${sub.timeTakenMinutes} mins` : '—'}
                        </td>
                        <td className="p-3.5 text-center">
                          {sub.integrityStatus === 'FLAGGED' ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold text-[10px] inline-flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              <span>Flagged</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px] inline-flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>Clean</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right text-slate-500 font-medium text-[11px]">
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Recent'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* List View Mode */
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-indigo-600" />
                <span>Technical Assessment &amp; Evaluation (Stage 2)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Automated coding tests, MCQ domain assessments, and anti-cheating proctoring for applicants advancing to Round 2.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Configured via Job Opportunities</span>
              </span>
            </div>
          </div>

          {/* Job Filter Notification Banner */}
          {selectedJob && (
            <div className="flex items-center justify-between p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-900">Filtered by Job Opportunity:</span>
                <span className="px-2.5 py-0.5 bg-white border border-indigo-300 rounded-lg font-bold text-indigo-700 shadow-2xs">
                  {selectedJob.title}
                </span>
                <span className="text-[11px] text-indigo-600">({displayedAssessments.length} assessment{displayedAssessments.length !== 1 ? 's' : ''})</span>
              </div>
              <button
                onClick={() => onSelectJob?.(null)}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer text-xs"
              >
                <span>Show All Jobs</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Main Content */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading technical assessments...</div>
          ) : displayedAssessments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Code2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">
                {selectedJob
                  ? `No Technical Assessment Configured for ${selectedJob.title}`
                  : 'No Technical Assessments Created Yet'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                {selectedJob
                  ? 'Assessment questions are configured directly when creating or editing the job opportunity in Round 2. You can update the job now to add or modify questions.'
                  : 'Assessment questions configured in each job opportunity under Round 2 will appear here automatically.'}
              </p>
              {selectedJob && onEditJob && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => onEditJob(selectedJob)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Edit Job Assessment Questions</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Assessment List */}
              <div className="lg:col-span-2 space-y-4">
                {displayedAssessments.map((asmt, idx) => {
                  const job = jobs.find(j => j.id === asmt.jobId);
                  const isSelected = selectedAssessment?.id === asmt.id;

                  return (
                    <div
                      key={`${asmt.id}_${asmt.jobId || idx}`}
                      className={`bg-white rounded-2xl border p-5 transition cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 shadow-md ring-1 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                      onClick={() => handleSelectCard(asmt)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {asmt.difficulty}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {job?.title || 'General Test'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{asmt.title}</h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{asmt.description}</p>
                        </div>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteAssessment(asmt.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Delete assessment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Skills badges */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {asmt.skillsTested?.map(skill => (
                          <span
                            key={skill}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Stats Footer */}
                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {asmt.durationMinutes} mins
                          </span>
                          <span className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-slate-400" />
                            Pass: {asmt.passingScore}%
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {asmt.questions?.length || 0} Questions
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setEditingAssessment(asmt);
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg flex items-center gap-1 text-[11px] cursor-pointer transition shadow-2xs"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Questions</span>
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenResults(asmt);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <span>View Results</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Details & Questions / Submissions Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 h-fit shadow-xs">
                {selectedAssessment && (
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRightPanelTab('questions')}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          rightPanelTab === 'questions'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Questions ({selectedAssessment.questions?.length || 0})
                      </button>
                      <button
                        onClick={() => setRightPanelTab('submissions')}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          rightPanelTab === 'submissions'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Submissions ({submissions.length})
                      </button>
                    </div>

                    <button
                      onClick={() => setEditingAssessment(selectedAssessment)}
                      className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                )}

                {!selectedAssessment ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Click any assessment to inspect configured questions, test cases, and applicant submissions.
                  </div>
                ) : rightPanelTab === 'questions' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1">
                      <span>Stored in Database</span>
                      <button
                        onClick={() => setEditingAssessment(selectedAssessment)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-bold text-[10px] cursor-pointer"
                      >
                        + Add / Modify Questions
                      </button>
                    </div>

                    {(!selectedAssessment.questions || selectedAssessment.questions.length === 0) ? (
                      <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                        No questions found in database for this assessment.
                      </div>
                    ) : (
                      selectedAssessment.questions.map((q, qIdx) => (
                        <div key={q.id || qIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-xs">
                              Q{qIdx + 1}. {q.type === 'CODING' ? '💻 Coding Problem' : '📝 Multiple Choice'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">{q.marks || 5} Marks</span>
                          </div>
                          <p className="text-xs text-slate-700 leading-snug line-clamp-3">{q.questionText}</p>
                          {q.type === 'CODING' && q.testCases && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-1">
                              <span>3 Public Test Cases</span>
                              <span>•</span>
                              <span>5 Hidden Anti-Cheat Test Cases</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : loadingSubmissions ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading submissions...</div>
                ) : submissions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No candidates have submitted this assessment yet.
                  </div>
                ) : (
                  <div className="space-y-3 mt-2">
                    {submissions.slice(0, 5).map(sub => (
                      <div key={sub.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-xs text-slate-900">{sub.candidateName || 'Candidate'}</div>
                            <div className="text-[10px] text-slate-500">{sub.candidateEmail}</div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sub.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {sub.percentage}% {sub.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                          <span>{sub.correct != null ? `${sub.correct}/${sub.totalQuestions || sub.correct} Correct` : 'Completed'}</span>
                          <span>{sub.timeTakenMinutes || '~'} mins</span>
                          <span
                            className={`font-semibold ${
                              sub.integrityStatus === 'FLAGGED' ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {sub.integrityStatus === 'FLAGGED' ? '⚠️ Flagged' : '✓ Clean'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {submissions.length > 5 && (
                      <button
                        onClick={() => handleOpenResults(selectedAssessment)}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition text-center cursor-pointer"
                      >
                        View All {submissions.length} Submissions →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Assessment Questions Modal */}
      {editingAssessment && (
        <EditAssessmentQuestionsModal
          isOpen={Boolean(editingAssessment)}
          onClose={() => setEditingAssessment(null)}
          assessment={editingAssessment}
          token={token}
          onSaved={updated => {
            setAssessments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
            if (selectedAssessment?.id === updated.id) {
              setSelectedAssessment(updated);
            }
          }}
        />
      )}
    </div>
  );
};
