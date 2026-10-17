import React, { useState, useEffect } from 'react';
import { Send, FileText, CheckCircle2, Clock, X, Eye, Plus, Calendar, MapPin, Building2, User, ChevronRight, Award } from 'lucide-react';
import { JobOffer, Job, EmploymentType } from '../types/index';
import { useNotification } from '../context/NotificationContext';

interface RecruiterOffersProps {
  token: string | null;
  jobs: Job[];
  candidates: any[];
  onRefreshCandidates?: () => void;
}

export const RecruiterOffers: React.FC<RecruiterOffersProps> = ({
  token,
  jobs,
  candidates,
  onRefreshCandidates,
}) => {
  const { showError, showSuccess, showWarning, showConfirm } = useNotification();
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOfferForPreview, setSelectedOfferForPreview] = useState<JobOffer | null>(null);
  const [sendingOfferId, setSendingOfferId] = useState<string | null>(null);

  // Form state
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [positionTitle, setPositionTitle] = useState('');
  const [salary, setSalary] = useState(1200000);
  const [currency, setCurrency] = useState('INR');
  const [payFrequency, setPayFrequency] = useState<'ANNUAL' | 'MONTHLY' | 'HOURLY'>('ANNUAL');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(EmploymentType.FULL_TIME);
  const [startDate, setStartDate] = useState('');
  const [offerExpiryDate, setOfferExpiryDate] = useState('');
  const [benefits, setBenefits] = useState('Comprehensive Health Insurance, Stock Options, Learning Stipend, Flexible Work Policy');
  const [location, setLocation] = useState('Hybrid / Remote');
  const [additionalTerms, setAdditionalTerms] = useState('Subject to standard background verification and reference checks.');

  useEffect(() => {
    fetchOffers();
  }, [token]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recruiter/offers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOffers(data);
      }
    } catch (err) {
      console.error('Failed to load offers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateChange = (candId: string) => {
    setSelectedCandidateId(candId);
    const cand = candidates.find(c => c.candidateId === candId || c.candidate?.id === candId);
    if (cand) {
      setPositionTitle(cand.job?.title || 'Software Engineer');
      setLocation(cand.job?.location || 'Hybrid / Remote');
      // default start date in 3 weeks
      const start = new Date(Date.now() + 86400000 * 21).toISOString().split('T')[0];
      const expiry = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
      setStartDate(start);
      setOfferExpiryDate(expiry);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = candidates.find(c => c.candidateId === selectedCandidateId || c.candidate?.id === selectedCandidateId);
    if (!cand) {
      showWarning('Please select a candidate before generating an offer.', 'Candidate Required');
      return;
    }

    try {
      const benefitsList = benefits.split(',').map(b => b.trim()).filter(Boolean);
      const res = await fetch('/api/recruiter/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registrationId: cand.id,
          candidateId: cand.candidateId,
          jobId: cand.jobId,
          positionTitle: positionTitle || cand.job?.title,
          salary: Number(salary),
          currency,
          payFrequency,
          employmentType,
          startDate,
          offerExpiryDate,
          benefits: benefitsList,
          location,
          additionalTerms,
        }),
      });

      if (res.ok) {
        setIsCreateOpen(false);
        fetchOffers();
        if (onRefreshCandidates) onRefreshCandidates();
        showSuccess('Formal job offer created and staged successfully!', 'Offer Staged');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to create offer', 'Offer Creation Error');
      }
    } catch (err) {
      console.error('Failed to create offer:', err);
      showError('Network error while generating offer.', 'Connection Error');
    }
  };

  const handleSendOffer = async (offerId: string) => {
    const confirmed = await showConfirm({
      title: 'Dispatch Formal Job Offer?',
      message: 'Are you ready to dispatch this formal offer letter to the candidate via email? This will notify the candidate to review and accept the terms.',
      confirmLabel: 'Dispatch Offer',
      cancelLabel: 'Keep Draft',
      isDestructive: false,
    });
    if (!confirmed) return;

    try {
      setSendingOfferId(offerId);
      const res = await fetch(`/api/recruiter/offers/${offerId}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchOffers();
        if (onRefreshCandidates) onRefreshCandidates();
        showSuccess('Formal offer letter dispatched to candidate email successfully!', 'Offer Sent');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to dispatch offer', 'Delivery Error');
      }
    } catch (err) {
      console.error('Failed to send offer:', err);
      showError('Network error while sending offer.', 'Connection Error');
    } finally {
      setSendingOfferId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <span>Offer Management &amp; Compensation (Stage 5)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Generate formal employment contracts, configure competitive compensation packages, and monitor candidate acceptance.
          </p>
        </div>
        <button
          onClick={() => {
            if (candidates.length > 0) handleCandidateChange(candidates[0].candidateId);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Generate New Offer</span>
        </button>
      </div>

      {/* Offers List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading offers...</div>
      ) : offers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Job Offers Extended Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Once candidates pass all 4 evaluation rounds, generate standardized digital offer letters and send them directly to candidate inboxes.
          </p>
          <button
            onClick={() => {
              if (candidates.length > 0) handleCandidateChange(candidates[0].candidateId);
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate First Offer</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map(offer => (
            <div
              key={offer.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-500/50 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        offer.status === 'ACCEPTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : offer.status === 'SENT'
                          ? 'bg-blue-100 text-blue-800'
                          : offer.status === 'DECLINED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {offer.status}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">{offer.candidateName}</h4>
                    <p className="text-[11px] text-slate-500">{offer.candidateEmail}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-extrabold text-emerald-600 block">
                      {offer.currency} {offer.salary.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block capitalize">{offer.payFrequency.toLowerCase()}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Position:</span>
                    <span className="font-semibold text-slate-800">{offer.positionTitle}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Start Date:</span>
                    <span className="font-semibold text-slate-800">{offer.startDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="font-semibold text-slate-800">{offer.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Valid Until:</span>
                    <span className="font-semibold text-amber-600">{offer.offerExpiryDate}</span>
                  </div>
                </div>

                {offer.benefits && offer.benefits.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {offer.benefits.slice(0, 3).map((b, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {b}
                      </span>
                    ))}
                    {offer.benefits.length > 3 && (
                      <span className="text-[10px] text-slate-400 font-bold self-center">
                        +{offer.benefits.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedOfferForPreview(offer)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Letter</span>
                </button>

                {offer.status === 'DRAFT' && (
                  <button
                    onClick={() => handleSendOffer(offer.id)}
                    disabled={sendingOfferId === offer.id}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingOfferId === offer.id ? 'Sending...' : 'Send to Candidate'}</span>
                  </button>
                )}

                {offer.status === 'SENT' && (
                  <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Awaiting Candidate
                  </span>
                )}

                {offer.status === 'ACCEPTED' && (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Offer Accepted
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Offer Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Generate Formal Job Offer</h3>
                <p className="text-xs text-slate-500">Configure compensation package, perks, and terms</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Candidate</label>
                <select
                  value={selectedCandidateId}
                  onChange={e => handleCandidateChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">-- Choose an applicant --</option>
                  {candidates.map(cand => (
                    <option key={cand.id} value={cand.candidateId}>
                      {cand.candidate?.fullName || cand.candidate?.name} - {cand.job?.title} (Score: {cand.scores?.overallScore || cand.atsScore || 75}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Position Title</label>
                  <input
                    type="text"
                    value={positionTitle}
                    onChange={e => setPositionTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Employment Type</label>
                  <select
                    value={employmentType}
                    onChange={e => setEmploymentType(e.target.value as EmploymentType)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white outline-none focus:border-emerald-500"
                  >
                    <option value={EmploymentType.FULL_TIME}>Full Time</option>
                    <option value={EmploymentType.CONTRACT}>Contract</option>
                    <option value={EmploymentType.INTERNSHIP}>Internship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total CTC / Salary</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={e => setSalary(Number(e.target.value))}
                    step={10000}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Offer Valid Until</label>
                  <input
                    type="date"
                    value={offerExpiryDate}
                    onChange={e => setOfferExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Location / Work Mode</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Bangalore, India (Hybrid) or Fully Remote"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Benefits &amp; Perks (comma separated)</label>
                <input
                  type="text"
                  value={benefits}
                  onChange={e => setBenefits(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Additional Terms &amp; Conditions</label>
                <textarea
                  value={additionalTerms}
                  onChange={e => setAdditionalTerms(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition cursor-pointer"
                >
                  Create Offer Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offer Letter Preview Modal */}
      {selectedOfferForPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Formal Offer Letter Preview</h3>
              </div>
              <button
                onClick={() => setSelectedOfferForPreview(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6 text-xs text-slate-700 leading-relaxed font-serif bg-[#fdfdfd] border-b border-slate-200">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-sans tracking-wide">
                    {selectedOfferForPreview.companyName}
                  </h2>
                  <p className="text-xs text-slate-500 font-sans">Global Talent Acquisition</p>
                </div>
                <div className="text-right font-sans text-[11px] text-slate-500">
                  Date: {new Date(selectedOfferForPreview.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div>
                <p className="font-bold font-sans text-sm text-slate-900">
                  Dear {selectedOfferForPreview.candidateName},
                </p>
                <p className="mt-2">
                  Following your successful completion of the multi-stage recruitment and AI interview evaluation, we are delighted to offer you the full-time position of{' '}
                  <strong className="text-slate-900">{selectedOfferForPreview.positionTitle}</strong> with{' '}
                  <strong className="text-slate-900">{selectedOfferForPreview.companyName}</strong>.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-sans space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Designation</span>
                    <span className="font-bold text-slate-800">{selectedOfferForPreview.positionTitle}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Annual Compensation</span>
                    <span className="font-extrabold text-emerald-700 text-sm">
                      {selectedOfferForPreview.currency} {selectedOfferForPreview.salary.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Expected Start Date</span>
                    <span className="font-bold text-slate-800">{selectedOfferForPreview.startDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Work Location</span>
                    <span className="font-bold text-slate-800">{selectedOfferForPreview.location}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold font-sans text-xs text-slate-900 uppercase tracking-wider mb-2">
                  Key Benefits &amp; Emoluments
                </h4>
                <ul className="list-disc pl-5 space-y-1 font-sans text-xs text-slate-600">
                  {selectedOfferForPreview.benefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>

              {selectedOfferForPreview.additionalTerms && (
                <div>
                  <h4 className="font-bold font-sans text-xs text-slate-900 uppercase tracking-wider mb-1">
                    Special Conditions
                  </h4>
                  <p className="font-sans text-xs text-slate-600">{selectedOfferForPreview.additionalTerms}</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 font-sans text-[11px] text-slate-500">
                This offer is valid until <strong>{selectedOfferForPreview.offerExpiryDate}</strong>.
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedOfferForPreview(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Close Preview
              </button>
              {selectedOfferForPreview.status === 'DRAFT' && (
                <button
                  onClick={() => {
                    handleSendOffer(selectedOfferForPreview.id);
                    setSelectedOfferForPreview(null);
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Offer to Candidate</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
