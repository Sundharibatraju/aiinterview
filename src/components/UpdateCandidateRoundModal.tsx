import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Clock, Award, ShieldCheck, Send } from 'lucide-react';
import { RoundStatus, RoundType } from '../types/index';
import { useNotification } from '../context/NotificationContext';

interface UpdateCandidateRoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateRegistration: any | null;
  token: string;
  onUpdated: () => void;
}

export const UpdateCandidateRoundModal: React.FC<UpdateCandidateRoundModalProps> = ({
  isOpen,
  onClose,
  candidateRegistration,
  token,
  onUpdated,
}) => {
  const { showSuccess, showError } = useNotification();
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(
    candidateRegistration?.currentRoundNumber || 1
  );
  const [newStatus, setNewStatus] = useState<RoundStatus>(RoundStatus.QUALIFIED);
  const [score, setScore] = useState<number | string>(80);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !candidateRegistration) return null;

  const candidateName = candidateRegistration.candidate?.fullName || 'Candidate';
  const jobTitle = candidateRegistration.job?.title || 'Position';
  const progression = candidateRegistration.roundProgression || [];

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/recruiter/candidate-round-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registrationId: candidateRegistration.id,
          roundNumber: Number(selectedRoundNumber),
          newStatus,
          score: score !== '' ? Number(score) : undefined,
          feedback: feedback.trim() || undefined,
        }),
      });

      setIsSubmitting(false);
      if (res.ok) {
        onUpdated();
        onClose();
        showSuccess(`Candidate round status updated to ${newStatus} & notification dispatched!`, 'Round Status Updated');
      } else {
        const d = await res.json();
        showError(d.error || 'Failed to update round status', 'Update Failed');
      }
    } catch (err) {
      setIsSubmitting(false);
      showError('Network error while updating round status. Please check your connection.', 'Network Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Manage Pipeline Progression</h2>
            <p className="text-xs text-slate-500">
              {candidateName} • {jobTitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          {/* Target Round */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Stage to Update</label>
            <select
              value={selectedRoundNumber}
              onChange={e => setSelectedRoundNumber(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 font-semibold"
            >
              {progression.length > 0 ? (
                progression.map((r: any) => (
                  <option key={r.roundNumber} value={r.roundNumber}>
                    Round {r.roundNumber}: {r.roundName} ({r.status})
                  </option>
                ))
              ) : (
                <>
                  <option value={1}>Round 1: Resume Screening</option>
                  <option value={2}>Round 2: Technical Assessment</option>
                  <option value={3}>Round 3: AI Technical Interview</option>
                  <option value={4}>Round 4: Final Review &amp; Selection</option>
                </>
              )}
            </select>
          </div>

          {/* New Status */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">New Round Evaluation Status</label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as RoundStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 font-bold"
            >
              <option value={RoundStatus.QUALIFIED}>QUALIFIED (Pass &amp; Advance to Next Round)</option>
              <option value={RoundStatus.NEEDS_REVIEW}>NEEDS_REVIEW (Committee Audit)</option>
              <option value={RoundStatus.IN_PROGRESS}>IN_PROGRESS (Currently Active)</option>
              <option value={RoundStatus.ON_HOLD}>ON_HOLD (Candidate on Hold)</option>
              <option value={RoundStatus.REJECTED}>REJECTED (Did Not Meet Cutoff)</option>
            </select>
          </div>

          {/* Score */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assigned Score (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={e => setScore(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
            />
          </div>

          {/* Feedback */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Recruiter Evaluation Notes / Feedback</label>
            <textarea
              rows={3}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Candidate demonstrated high algorithmic rigor in concurrency and database caching..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-800 flex items-start gap-2">
            <Send className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Updating status will automatically send an official notification email to the candidate and advance their recruitment pipeline tracker.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Updating...' : 'Update & Notify'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
