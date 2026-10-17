import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Search, Filter, Clock, Eye, Check, X, User, Briefcase, FileText } from 'lucide-react';
import { IntegrityViolationRecord } from '../types/index';

interface RecruiterIntegrityCenterProps {
  token: string | null;
  onOpenReport?: (interviewId: string) => void;
}

export const RecruiterIntegrityCenter: React.FC<RecruiterIntegrityCenterProps> = ({
  token,
  onOpenReport,
}) => {
  const [violations, setViolations] = useState<IntegrityViolationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Review modal
  const [selectedViolation, setSelectedViolation] = useState<IntegrityViolationRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'CONFIRMED' | 'DISMISSED'>('CONFIRMED');
  const [recruiterNotes, setRecruiterNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchViolations();
  }, [token]);

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recruiter/integrity-violations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setViolations(data);
      }
    } catch (err) {
      console.error('Failed to fetch violations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (violation: IntegrityViolationRecord, defaultAction: 'CONFIRMED' | 'DISMISSED') => {
    setSelectedViolation(violation);
    setReviewAction(defaultAction);
    setRecruiterNotes(violation.recruiterNotes || '');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedViolation) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/recruiter/integrity-violations/${selectedViolation.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: reviewAction,
          recruiterNotes,
        }),
      });

      if (res.ok) {
        setSelectedViolation(null);
        fetchViolations();
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = violations.filter(v => {
    if (filterSeverity !== 'ALL' && v.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && v.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = v.candidateName?.toLowerCase().includes(q);
      const matchEmail = v.candidateEmail?.toLowerCase().includes(q);
      const matchType = v.violationType?.toLowerCase().includes(q);
      const matchJob = v.jobTitle?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchType && !matchJob) return false;
    }
    return true;
  });

  const pendingCount = violations.filter(v => v.status === 'REVIEW_REQUIRED').length;
  const confirmedCount = violations.filter(v => v.status === 'CONFIRMED').length;
  const dismissedCount = violations.filter(v => v.status === 'DISMISSED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>AI Proctoring &amp; Integrity Center</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric anomaly logs, tab switching, and anti-cheating signals gathered during assessments and AI interviews.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Flagged Incidents</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{violations.length}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">All Sessions</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <span className="text-[11px] font-medium text-rose-700 block">Requires Recruiter Review</span>
          <span className="text-2xl font-extrabold text-rose-600 mt-1 block">{pendingCount}</span>
          <span className="text-[10px] text-rose-500 font-semibold mt-1 inline-block">Pending Adjudication</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Confirmed Malpractice</span>
          <span className="text-2xl font-extrabold text-red-600 mt-1 block">{confirmedCount}</span>
          <span className="text-[10px] text-red-500 font-semibold mt-1 inline-block">Auto Disqualified</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Dismissed (False Positives)</span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">{dismissedCount}</span>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 inline-block">Cleared by Recruiter</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search candidate, email, or violation type..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white outline-none focus:border-rose-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="REVIEW_REQUIRED">Review Required</option>
            <option value="CONFIRMED">Confirmed Malpractice</option>
            <option value="DISMISSED">Dismissed</option>
          </select>

          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white outline-none focus:border-rose-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading proctoring records...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ShieldAlert className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Integrity Violations Match Filters</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Candidate sessions are running cleanly with no unadjudicated biometric or proctoring flags.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Job Opening</th>
                  <th className="p-4">Violation Signal</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Detected At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Adjudicate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{item.candidateName}</div>
                      <div className="text-[10px] text-slate-400">{item.candidateEmail}</div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{item.jobTitle}</div>
                    </td>

                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{item.violationType}</span>
                      {item.evidence && (
                        <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{item.evidence}</span>
                      )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : item.severity === 'HIGH'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>

                    <td className="p-4 text-slate-500 text-[11px]">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'CONFIRMED'
                            ? 'bg-red-100 text-red-800'
                            : item.status === 'DISMISSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status === 'REVIEW_REQUIRED' ? 'Needs Review' : item.status}
                      </span>
                      {item.recruiterNotes && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1">
                          "{item.recruiterNotes}"
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onOpenReport && (
                          <button
                            onClick={() => onOpenReport(item.registrationId)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                            title="Inspect Interview Dossier"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenReview(item, 'CONFIRMED')}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Confirm</span>
                        </button>
                        <button
                          onClick={() => handleOpenReview(item, 'DISMISSED')}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Dismiss</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Adjudication Modal */}
      {selectedViolation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjudicate Proctoring Flag</h3>
                <p className="text-xs text-slate-500">Record recruiter verdict and notes</p>
              </div>
              <button
                onClick={() => setSelectedViolation(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">{selectedViolation.candidateName}</div>
                <div className="text-slate-500">Violation: {selectedViolation.violationType}</div>
                {selectedViolation.evidence && (
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 font-mono">
                    {selectedViolation.evidence}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Recruiter Verdict</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewAction('CONFIRMED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      reviewAction === 'CONFIRMED'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Confirm Malpractice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('DISMISSED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      reviewAction === 'DISMISSED'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Dismiss False Alarm</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Recruiter Audit Notes</label>
                <textarea
                  value={recruiterNotes}
                  onChange={e => setRecruiterNotes(e.target.value)}
                  placeholder="State rationale (e.g. reviewed webcam feed; tab switch confirmed accidental or confirmed intentional cheating)..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedViolation(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition cursor-pointer ${
                    reviewAction === 'CONFIRMED'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Verdict'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
