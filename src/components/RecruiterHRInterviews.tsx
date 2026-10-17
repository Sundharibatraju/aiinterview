import React, { useState, useEffect } from 'react';
import { Calendar, Video, Clock, User, CheckCircle2, AlertCircle, Plus, FileText, ChevronRight, X, ExternalLink, Award, MapPin } from 'lucide-react';
import { HRInterviewSchedule, Job } from '../types/index';
import { useNotification } from '../context/NotificationContext';

interface RecruiterHRInterviewsProps {
  token: string | null;
  jobs: Job[];
  candidates: any[];
  onRefreshCandidates?: () => void;
}

export const RecruiterHRInterviews: React.FC<RecruiterHRInterviewsProps> = ({
  token,
  jobs,
  candidates,
  onRefreshCandidates,
}) => {
  const { showError, showSuccess, showWarning } = useNotification();
  const [interviews, setInterviews] = useState<HRInterviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [selectedInterviewForEval, setSelectedInterviewForEval] = useState<HRInterviewSchedule | null>(null);

  // Schedule form state
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id || '');
  const [interviewerName, setInterviewerName] = useState('Lead People Partner');
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [meetingLink, setMeetingLink] = useState('https://meet.google.com/xyz-recr-ais');
  const [interviewLocation, setInterviewLocation] = useState('Google Meet / Video Call');
  const [interviewType, setInterviewType] = useState<'VIDEO' | 'PHONE' | 'IN_PERSON'>('VIDEO');
  const [notes, setNotes] = useState('');

  // Evaluation form state
  const [hrScore, setHrScore] = useState(85);
  const [communicationScore, setCommunicationScore] = useState(85);
  const [behavioralScore, setBehavioralScore] = useState(80);
  const [teamAlignmentScore, setTeamAlignmentScore] = useState(90);
  const [recommendation, setRecommendation] = useState<'STRONGLY_HIRE' | 'HIRE' | 'HOLD' | 'REJECT' | 'CONSIDER' | 'DO_NOT_HIRE'>('HIRE');
  const [evalNotes, setEvalNotes] = useState('');
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  useEffect(() => {
    fetchInterviews();
  }, [token]);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recruiter/hr-interviews', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInterviews(data);
      }
    } catch (err) {
      console.error('Failed to fetch HR interviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = candidates.find(c => c.candidateId === selectedCandidateId || c.candidate?.id === selectedCandidateId);
    if (!cand) {
      showWarning('Please select a candidate before proceeding.', 'Candidate Required');
      return;
    }

    try {
      const res = await fetch('/api/recruiter/hr-interviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registrationId: cand.id,
          candidateId: cand.candidateId,
          jobId: cand.jobId,
          interviewerName,
          interviewerEmail,
          scheduledDate,
          scheduledTime,
          durationMinutes: Number(durationMinutes),
          meetingLink,
          interviewLocation,
          interviewType,
          notes,
        }),
      });

      if (res.ok) {
        setIsScheduleOpen(false);
        fetchInterviews();
        if (onRefreshCandidates) onRefreshCandidates();
        showSuccess('HR Interview successfully scheduled & calendar invite dispatched!', 'Interview Scheduled');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to schedule HR interview', 'Scheduling Error');
      }
    } catch (err) {
      console.error('Failed to schedule HR interview:', err);
      showError('Network error while scheduling HR interview.', 'Connection Issue');
    }
  };

  const handleOpenEvaluation = (interview: HRInterviewSchedule) => {
    setSelectedInterviewForEval(interview);
    if (interview.evaluation) {
      setHrScore(interview.evaluation.hrScore || 85);
      setCommunicationScore(interview.evaluation.communicationScore || 85);
      setBehavioralScore(interview.evaluation.behavioralScore || 80);
      setTeamAlignmentScore(interview.evaluation.teamAlignmentScore || 90);
      setRecommendation(interview.evaluation.recommendation || 'HIRE');
      setEvalNotes(interview.evaluation.notes || '');
    } else {
      setHrScore(85);
      setCommunicationScore(85);
      setBehavioralScore(80);
      setTeamAlignmentScore(90);
      setRecommendation('HIRE');
      setEvalNotes('');
    }
    setIsEvaluationOpen(true);
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterviewForEval) return;

    try {
      setIsSubmittingEval(true);
      const res = await fetch(`/api/recruiter/hr-interviews/${selectedInterviewForEval.id}/evaluate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hrScore: Number(hrScore),
          communicationScore: Number(communicationScore),
          behavioralScore: Number(behavioralScore),
          teamAlignmentScore: Number(teamAlignmentScore),
          recommendation,
          notes: evalNotes,
        }),
      });

      if (res.ok) {
        setIsEvaluationOpen(false);
        fetchInterviews();
        if (onRefreshCandidates) onRefreshCandidates();
      }
    } catch (err) {
      console.error('Failed to submit evaluation:', err);
    } finally {
      setIsSubmittingEval(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <span>HR &amp; Cultural Interviews (Stage 4)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Schedule live panel conversations, coordinate video rooms, and log standardized behavioral and culture-fit scorecards.
          </p>
        </div>
        <button
          onClick={() => setIsScheduleOpen(true)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule HR Session</span>
        </button>
      </div>

      {/* Interviews Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading HR interviews...</div>
      ) : interviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No HR Interviews Scheduled Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Candidates who clear the Stage 3 AI interview can be scheduled for live behavioral, leadership, and cultural discussions with your HR team.
          </p>
          <button
            onClick={() => setIsScheduleOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule First Interview</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Candidate &amp; Role</th>
                  <th className="p-4">Scheduled Slot</th>
                  <th className="p-4">Meeting Link / Location</th>
                  <th className="p-4">Interviewer</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">HR Scorecard</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {interviews.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{item.candidateName}</div>
                      <div className="text-[10px] text-slate-500">{item.candidateEmail}</div>
                      <div className="text-[11px] text-slate-600 font-semibold mt-0.5">{item.jobTitle}</div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>{item.scheduledDate}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{item.scheduledTime} ({item.durationMinutes} mins)</span>
                      </div>
                    </td>

                    <td className="p-4">
                      {item.meetingLink ? (
                        <a
                          href={item.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-[11px]"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Meeting Room</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {item.interviewLocation || 'In-Person'}
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{item.interviewerName}</div>
                      <div className="text-[10px] text-slate-400">{item.interviewerEmail || 'HR Department'}</div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="p-4">
                      {item.evaluation ? (
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-900 block">
                            Score: {item.evaluation.hrScore}%
                          </span>
                          <span className="text-[10px] font-semibold text-indigo-600 block">
                            {item.evaluation.recommendation}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Pending Scorecard</span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenEvaluation(item)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 font-bold rounded-lg text-xs transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>{item.evaluation ? 'Edit Scorecard' : 'Evaluate'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Schedule HR Interview</h3>
                <p className="text-xs text-slate-500">Configure round 4 cultural and leadership panel</p>
              </div>
              <button
                onClick={() => setIsScheduleOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleInterview} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Candidate</label>
                <select
                  value={selectedCandidateId}
                  onChange={e => setSelectedCandidateId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 outline-none focus:border-amber-500"
                  required
                >
                  <option value="">-- Choose an applicant --</option>
                  {candidates.map(cand => (
                    <option key={cand.id} value={cand.candidateId}>
                      {cand.candidate?.fullName || cand.candidate?.name} - {cand.job?.title} (Stage {cand.currentRoundNumber || 1})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Interviewer Name</label>
                  <input
                    type="text"
                    value={interviewerName}
                    onChange={e => setInterviewerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Interviewer Email</label>
                  <input
                    type="email"
                    value={interviewerEmail}
                    onChange={e => setInterviewerEmail(e.target.value)}
                    placeholder="partner@company.com"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Meeting Link (Google Meet / Zoom)</label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={e => setMeetingLink(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Preparation Notes / Focus Areas</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Discuss leadership experiences and salary expectations..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition cursor-pointer"
                >
                  Confirm &amp; Send Calendar Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evaluation Scorecard Modal */}
      {isEvaluationOpen && selectedInterviewForEval && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">HR Scorecard &amp; Evaluation</h3>
                <p className="text-xs text-slate-500">
                  Rating for {selectedInterviewForEval.candidateName} ({selectedInterviewForEval.jobTitle})
                </p>
              </div>
              <button
                onClick={() => setIsEvaluationOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Overall HR Score (0-100): {hrScore}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={hrScore}
                    onChange={e => setHrScore(Number(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Communication: {communicationScore}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={communicationScore}
                    onChange={e => setCommunicationScore(Number(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Behavioral &amp; Ethics: {behavioralScore}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={behavioralScore}
                    onChange={e => setBehavioralScore(Number(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Team &amp; Culture Alignment: {teamAlignmentScore}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={teamAlignmentScore}
                    onChange={e => setTeamAlignmentScore(Number(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Final HR Recommendation</label>
                <select
                  value={recommendation}
                  onChange={e => setRecommendation(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white outline-none focus:border-amber-500 font-bold"
                >
                  <option value="STRONGLY_HIRE">STRONGLY HIRE (Exceptional cultural fit)</option>
                  <option value="HIRE">HIRE (Recommended for offer)</option>
                  <option value="CONSIDER">CONSIDER (Conditional on team dynamics)</option>
                  <option value="DO_NOT_HIRE">DO NOT HIRE (Cultural or behavioral mismatch)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Interviewer Notes &amp; Observations</label>
                <textarea
                  value={evalNotes}
                  onChange={e => setEvalNotes(e.target.value)}
                  placeholder="Record summary feedback, strengths, and areas to observe..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEvaluationOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEval}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition cursor-pointer"
                >
                  {isSubmittingEval ? 'Saving...' : 'Submit HR Scorecard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
