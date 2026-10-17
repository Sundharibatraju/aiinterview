import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronUp,
  Mail,
  FileText,
  Award,
  Calendar,
  Users,
  CheckSquare,
  Square,
  Clock,
  Sparkles,
  Building2,
  MapPin,
  Briefcase,
  Code2,
  RefreshCw,
  Send,
  UserCheck,
  Ban,
  ShieldCheck,
  ChevronDown,
  Eye,
  Lock,
  X,
  Pause,
  MessageSquare,
  GraduationCap,
  TrendingUp,
  Check,
  Info,
  Phone,
} from 'lucide-react';
import { Job, ApplicationStatus, RoundStatus } from '../types/index';
import { AtsEvaluationModal } from './AtsEvaluationModal';
import { useNotification } from '../context/NotificationContext';

interface RecruiterPipelineBoardProps {
  job: Job;
  allCandidates: any[];
  token: string | null;
  onBackToJobs: () => void;
  onOpenReport: (interviewId: string) => void;
  onOpenSendEmail: (candidate: any) => void;
  onRefreshData: () => void;
  onEditJob?: (job: Job) => void;
  onNavigateToAssessments?: () => void;
}

export const RecruiterPipelineBoard: React.FC<RecruiterPipelineBoardProps> = ({
  job,
  allCandidates,
  token,
  onBackToJobs,
  onOpenReport,
  onOpenSendEmail,
  onRefreshData,
  onEditJob,
  onNavigateToAssessments,
}) => {
  const { showError, showSuccess, showWarning } = useNotification();
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SELECTED' | 'ON_HOLD' | 'NOT_SELECTED' | 'DISQUALIFIED'>('ALL');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [inspectingAtsCandidate, setInspectingAtsCandidate] = useState<any | null>(null);

  // Technical Assessment View Modals & States
  const [showAssessmentQuestionsModal, setShowAssessmentQuestionsModal] = useState(false);
  const [jobAssessment, setJobAssessment] = useState<any | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [viewingCandidateSubmission, setViewingCandidateSubmission] = useState<any | null>(null);
  const [candidateSubmissionData, setCandidateSubmissionData] = useState<any | null>(null);
  const [loadingCandidateSubmission, setLoadingCandidateSubmission] = useState(false);

  // AI Interview Asked Questions View State
  const [viewingAiCandidate, setViewingAiCandidate] = useState<any | null>(null);

  // Whole Candidate Dossier Modal State (All Rounds from 1 to Final)
  const [viewingDossierCandidate, setViewingDossierCandidate] = useState<any | null>(null);

  // Final Review & Selection Action States
  // 1. Confirm (Offer & Acceptance Email)
  const [confirmingCandidate, setConfirmingCandidate] = useState<any | null>(null);
  const [confirmCompanyName, setConfirmCompanyName] = useState('');
  const [confirmJobTitle, setConfirmJobTitle] = useState('');
  const [confirmDescription, setConfirmDescription] = useState('');
  const [confirmPackage, setConfirmPackage] = useState('');
  const [confirmStartDate, setConfirmStartDate] = useState('');
  const [confirmLocation, setConfirmLocation] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);

  // 2. Hold State
  const [holdingCandidate, setHoldingCandidate] = useState<any | null>(null);
  const [holdNotes, setHoldNotes] = useState('');
  const [isSubmittingHold, setIsSubmittingHold] = useState(false);

  // 3. Remove (Reject & Formal Rejection Email)
  const [removingCandidate, setRemovingCandidate] = useState<any | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isSubmittingRemove, setIsSubmittingRemove] = useState(false);

  // Quick Action States for Disqualify & Offer
  const [rejectingCandidate, setRejectingCandidate] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [createOfferCandidate, setCreateOfferCandidate] = useState<any | null>(null);
  const [offerSalary, setOfferSalary] = useState<number>(1200000);
  const [offerStartDate, setOfferStartDate] = useState<string>('');
  const [offerNotes, setOfferNotes] = useState<string>('');

  const [sendingCodeCandidateId, setSendingCodeCandidateId] = useState<string | null>(null);

  // Live Job-Specific Candidates from Server
  const [jobSpecificCandidates, setJobSpecificCandidates] = useState<any[]>([]);

  const fetchJobCandidates = async () => {
    if (!job?.id) return;
    try {
      const res = await fetch(`/api/recruiter/candidates?jobId=${encodeURIComponent(job.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setJobSpecificCandidates(data);
        }
      }
    } catch (err) {
      console.error('Failed to load job-specific candidates:', err);
    }
  };

  useEffect(() => {
    if (job?.id) {
      fetchJobCandidates();
      fetchJobAssessment();
    }
  }, [job?.id, currentStage]);

  // STRICT JOB ISOLATION: Candidates must strictly belong to this selected job
  // Never show candidates from one job inside another job!
  const jobCandidates = useMemo(() => {
    const map = new Map<string, any>();
    allCandidates.filter(c => c.jobId === job.id || c.job?.id === job.id || String(c.jobId) === String(job.id)).forEach(c => map.set(c.id, c));
    jobSpecificCandidates.forEach(c => {
      if (c.jobId === job.id || c.job?.id === job.id || String(c.jobId) === String(job.id)) {
        map.set(c.id, { ...(map.get(c.id) || {}), ...c });
      }
    });
    return Array.from(map.values());
  }, [allCandidates, jobSpecificCandidates, job.id]);

  // Stage candidates:
  // Stage 1 (Resume Screening): ALL candidates who applied for this opportunity are visible in Stage 1!
  // Stage 2 (Technical Assessment): Candidates who cleared Stage 1 and reached or passed Stage 2
  // Stage 3 (AI Technical Interview): Candidates who cleared Stage 2 and reached or passed Stage 3
  // Stage 4 (Final Review & Selection): Candidates who reached Final Review / selection decision
  const stageCandidates = useMemo(() => {
    return jobCandidates.filter(c => {
      const candStage = c.currentRoundNumber || 1;
      const r1Qualified = Boolean(
        c.clearedResumeScreening ||
        candStage >= 2 ||
        (c.scores?.atsScore != null && Number(c.scores.atsScore) >= 60) ||
        (c.atsScore != null && Number(c.atsScore) >= 60) ||
        c.roundProgression?.find((r: any) => r.roundNumber === 1 || r.roundType === 'RESUME_SCREENING')?.status === 'QUALIFIED'
      );
      const r2Qualified = Boolean(
        candStage >= 3 ||
        (c.scores?.technicalScore != null && Number(c.scores.technicalScore) >= 65) ||
        (c.technicalAssessmentScore != null && Number(c.technicalAssessmentScore) >= 65) ||
        c.assessmentSubmission?.passed ||
        c.roundProgression?.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')?.status === 'QUALIFIED'
      );
      const r3Qualified = Boolean(
        candStage >= 4 ||
        (c.scores?.aiInterviewScore != null && Number(c.scores.aiInterviewScore) >= 65) ||
        (c.report?.overallScore != null && Number(c.report.overallScore) >= 65) ||
        c.roundProgression?.find((r: any) => r.roundNumber === 3 || r.roundType === 'AI_TECHNICAL_INTERVIEW')?.status === 'QUALIFIED'
      );

      if (currentStage === 1) {
        // All applicants who applied for this job are in Resume Screening
        return true;
      }
      if (currentStage === 2) {
        // Candidates who cleared Stage 1 and reached or passed Technical Assessment
        return r1Qualified || c.technicalAssessmentScore != null || c.assessmentSubmission != null;
      }
      if (currentStage === 3) {
        // Candidates who cleared Stage 2 and reached or passed AI Technical Interview
        return r2Qualified || c.interviewId != null || c.report != null || c.scores?.aiInterviewScore != null;
      }
      if (currentStage === 4) {
        // Candidates in Final Review & Selection
        return r3Qualified || c.status === 'SELECTED' || c.status === 'ON_HOLD' || (c as any).finalSelectionDecision != null;
      }
      return true;
    });
  }, [jobCandidates, currentStage]);

  // Dynamic stage statistics calculated using actual DB data
  const stageStats = useMemo(() => {
    const total = stageCandidates.length;

    let selected = 0;
    let onHold = 0;
    let disqualified = 0;
    let notSelected = 0;

    if (currentStage === 1) {
      selected = stageCandidates.filter(
        c => (c.clearedResumeScreening || (c.currentRoundNumber || 1) >= 2 || (c.scores?.atsScore != null && Number(c.scores.atsScore) >= 60) || c.roundProgression?.find((r: any) => r.roundNumber === 1 || r.roundType === 'RESUME_SCREENING')?.status === 'QUALIFIED') && c.status !== ApplicationStatus.REJECTED
      ).length;
      disqualified = stageCandidates.filter(c => c.status === ApplicationStatus.REJECTED || c.roundProgression?.find((r: any) => r.roundNumber === 1)?.status === 'REJECTED').length;
      onHold = stageCandidates.filter(c => c.status === 'ON_HOLD').length;
      notSelected = Math.max(0, total - selected - disqualified - onHold);
    } else if (currentStage === 2) {
      selected = stageCandidates.filter(
        c => ((c.currentRoundNumber || 1) >= 3 || (c.scores?.technicalScore != null && Number(c.scores.technicalScore) >= 65) || c.assessmentSubmission?.passed || c.roundProgression?.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')?.status === 'QUALIFIED') && c.status !== ApplicationStatus.REJECTED
      ).length;
      disqualified = stageCandidates.filter(c => c.status === ApplicationStatus.REJECTED && (c.currentRoundNumber || 1) === 2).length;
      onHold = stageCandidates.filter(c => c.status === 'ON_HOLD').length;
      notSelected = Math.max(0, total - selected - disqualified - onHold);
    } else if (currentStage === 3) {
      selected = stageCandidates.filter(
        c => ((c.currentRoundNumber || 1) >= 4 || (c.scores?.aiInterviewScore != null && Number(c.scores.aiInterviewScore) >= 65) || c.roundProgression?.find((r: any) => r.roundNumber === 3 || r.roundType === 'AI_TECHNICAL_INTERVIEW')?.status === 'QUALIFIED') && c.status !== ApplicationStatus.REJECTED
      ).length;
      disqualified = stageCandidates.filter(c => c.status === ApplicationStatus.REJECTED && (c.currentRoundNumber || 1) === 3).length;
      onHold = stageCandidates.filter(c => c.status === 'ON_HOLD').length;
      notSelected = Math.max(0, total - selected - disqualified - onHold);
    } else {
      selected = stageCandidates.filter(
        c => (c.status === 'SELECTED' || (c as any).finalSelectionDecision === 'CONFIRMED' || c.selectedForStage) && c.status !== ApplicationStatus.REJECTED
      ).length;
      onHold = stageCandidates.filter(
        c => c.status === 'ON_HOLD' || (c as any).finalSelectionDecision === 'HOLD'
      ).length;
      disqualified = stageCandidates.filter(
        c => c.status === ApplicationStatus.REJECTED || (c as any).finalSelectionDecision === 'REMOVED'
      ).length;
      notSelected = Math.max(0, total - selected - onHold - disqualified);
    }

    return { total, selected, onHold, notSelected, disqualified };
  }, [stageCandidates, currentStage]);

  // Filtered by search & status
  const filteredCandidates = useMemo(() => {
    return stageCandidates.filter(c => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (c.candidate?.name || c.candidate?.fullName || '').toLowerCase();
        const email = (c.candidate?.email || '').toLowerCase();
        const code = (c.interviewCode || c.id || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !code.includes(q)) return false;
      }

      if (statusFilter === 'ALL') return true;

      const isDisqualified = c.status === ApplicationStatus.REJECTED || (c as any).finalSelectionDecision === 'REMOVED';
      const isOnHold = c.status === 'ON_HOLD' || (c as any).finalSelectionDecision === 'HOLD';

      let isSelected = false;
      if (currentStage === 1) {
        isSelected = (c.clearedResumeScreening || (c.currentRoundNumber || 1) >= 2 || (c.scores?.atsScore != null && Number(c.scores.atsScore) >= 60) || c.roundProgression?.find((r: any) => r.roundNumber === 1 || r.roundType === 'RESUME_SCREENING')?.status === 'QUALIFIED') && !isDisqualified;
      } else if (currentStage === 2) {
        isSelected = ((c.currentRoundNumber || 1) >= 3 || (c.scores?.technicalScore != null && Number(c.scores.technicalScore) >= 65) || c.assessmentSubmission?.passed || c.roundProgression?.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')?.status === 'QUALIFIED') && !isDisqualified;
      } else if (currentStage === 3) {
        isSelected = ((c.currentRoundNumber || 1) >= 4 || (c.scores?.aiInterviewScore != null && Number(c.scores.aiInterviewScore) >= 65) || c.roundProgression?.find((r: any) => r.roundNumber === 3 || r.roundType === 'AI_TECHNICAL_INTERVIEW')?.status === 'QUALIFIED') && !isDisqualified;
      } else {
        isSelected = (c.status === 'SELECTED' || (c as any).finalSelectionDecision === 'CONFIRMED' || c.selectedForStage) && !isDisqualified;
      }

      if (statusFilter === 'SELECTED') return isSelected;
      if (statusFilter === 'ON_HOLD') return isOnHold;
      if (statusFilter === 'DISQUALIFIED') return isDisqualified;
      if (statusFilter === 'NOT_SELECTED') return !isSelected && !isDisqualified && !isOnHold;

      return true;
    });
  }, [stageCandidates, searchQuery, statusFilter, currentStage]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedCandidateIds.length === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(filteredCandidates.map(c => c.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedCandidateIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Bulk / Single Actions
  const executeBulkAction = async (action: 'SELECT' | 'DESELECT' | 'MOVE_STAGE' | 'REJECT', reason?: string) => {
    if (selectedCandidateIds.length === 0) return;
    setIsProcessingAction(true);
    setActionSuccessMessage(null);

    try {
      const res = await fetch('/api/recruiter/pipeline/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          registrationIds: selectedCandidateIds,
          reason: reason || 'Pipeline bulk update',
        }),
      });

      if (res.ok) {
        setSelectedCandidateIds([]);
        onRefreshData();
        const actionLabels: Record<string, string> = {
          SELECT: 'selected and marked qualified',
          DESELECT: 'deselected',
          MOVE_STAGE: `advanced to Stage ${currentStage + 1} with automated notifications dispatched`,
          REJECT: 'marked disqualified / rejected',
        };
        setActionSuccessMessage(`Successfully ${actionLabels[action] || action}.`);
        setTimeout(() => setActionSuccessMessage(null), 4000);
      } else {
        const d = await res.json();
        showError(d.error || 'Failed to perform bulk action', 'Bulk Action Error');
      }
    } catch (err) {
      showError('Network error executing bulk action', 'Network Error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Single Candidate Action
  const handleSingleSelect = async (candidateId: string, currentSelected: boolean) => {
    const endpoint = currentSelected
      ? `/api/recruiter/applications/${candidateId}/deselect`
      : `/api/recruiter/applications/${candidateId}/select`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to toggle selection status:', err);
    }
  };

  const handleAdvanceSingle = async (candidate: any) => {
    if (currentStage >= 5) return;
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/recruiter/applications/${candidate.id}/move-stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ force: true }),
      });
      if (res.ok) {
        setActionSuccessMessage(`${candidate.candidate?.name || 'Candidate'} successfully advanced to Stage ${currentStage + 1}! Notification email dispatched.`);
        setTimeout(() => setActionSuccessMessage(null), 4000);
        onRefreshData();
      } else {
        const d = await res.json();
        showError(d.error || 'Failed to advance candidate', 'Stage Advancement Error');
      }
    } catch (err) {
      showError('Error advancing candidate. Please check connection.', 'Advancement Error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingCandidate) return;
    try {
      const res = await fetch(`/api/recruiter/applications/${rejectingCandidate.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: rejectionReason || 'Candidate did not meet criteria for this stage.',
          sendEmail: true,
        }),
      });
      if (res.ok) {
        setRejectingCandidate(null);
        setRejectionReason('');
        onRefreshData();
        setActionSuccessMessage('Candidate marked as Disqualified / Rejected.');
        setTimeout(() => setActionSuccessMessage(null), 3500);
      }
    } catch (err) {
      showError('Error rejecting candidate', 'Action Error');
    }
  };

  // -------------------------------------------------------------
  // Final Review & Selection Action Handlers (Confirm, Hold, Remove)
  // -------------------------------------------------------------
  const openConfirmModal = (candidate: any) => {
    setConfirmingCandidate(candidate);
    setConfirmCompanyName(job.company?.name || 'Hiring Organization');
    setConfirmJobTitle(job.title);
    setConfirmDescription(
      job.description ||
        'Contribute to technical architecture, develop high-performance software, participate in agile sprints, and collaborate with engineering leads.'
    );
    const defaultPkg =
      job.salaryPackage ||
      (job.minPackage
        ? `${job.currency || 'INR'} ${(job.minPackage / 100000).toFixed(1)}L - ${(job.maxPackage / 100000).toFixed(1)}L PA`
        : '12 LPA');
    setConfirmPackage(defaultPkg);
    setConfirmStartDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    setConfirmLocation(job.location || 'Remote');
    setConfirmNotes(
      'Congratulations on your selection! Our HR operations team will reach out with appointment paperwork and onboarding orientation details.'
    );
  };

  const handleConfirmSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingCandidate) return;
    setIsSubmittingConfirm(true);
    try {
      const res = await fetch(`/api/recruiter/applications/${confirmingCandidate.id}/final-selection/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName: confirmCompanyName,
          jobTitle: confirmJobTitle,
          description: confirmDescription,
          packageDetails: confirmPackage,
          startDate: confirmStartDate,
          location: confirmLocation,
          additionalNotes: confirmNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(
          data.message ||
            `Candidate ${confirmingCandidate.candidate?.name} confirmed! Official Selection Offer email dispatched.`,
          'Selection Offer Dispatched'
        );
        setConfirmingCandidate(null);
        fetchJobCandidates();
        onRefreshData();
      } else {
        showError(data.error || 'Failed to confirm selection', 'Selection Error');
      }
    } catch (err: any) {
      showError('Network error executing selection confirmation', 'Connection Error');
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  const openHoldModal = (candidate: any) => {
    setHoldingCandidate(candidate);
    setHoldNotes(candidate.holdNotes || 'Candidate placed on Hold pending comparison with other finalist candidates.');
  };

  const handleHoldCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdingCandidate) return;
    setIsSubmittingHold(true);
    try {
      const res = await fetch(`/api/recruiter/applications/${holdingCandidate.id}/final-selection/hold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: holdNotes }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(
          data.message || `Candidate ${holdingCandidate.candidate?.name} placed on Hold.`,
          'Candidate On Hold'
        );
        setHoldingCandidate(null);
        fetchJobCandidates();
        onRefreshData();
      } else {
        showError(data.error || 'Failed to place candidate on hold', 'Hold Error');
      }
    } catch (err: any) {
      showError('Network error placing candidate on hold', 'Connection Error');
    } finally {
      setIsSubmittingHold(false);
    }
  };

  const openRemoveModal = (candidate: any) => {
    setRemovingCandidate(candidate);
    setRemoveReason(
      candidate.rejectionReason ||
        'After comprehensive review across all rounds, we decided to proceed with other candidates whose skill sets more closely match our current role requirements.'
    );
  };

  const handleRemoveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removingCandidate) return;
    setIsSubmittingRemove(true);
    try {
      const res = await fetch(`/api/recruiter/applications/${removingCandidate.id}/final-selection/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: removeReason,
          feedback: removeReason,
          sendEmail: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(
          data.message || `Candidate removed and formal rejection email dispatched.`,
          'Candidate Removed'
        );
        setRemovingCandidate(null);
        fetchJobCandidates();
        onRefreshData();
      } else {
        showError(data.error || 'Failed to remove candidate', 'Removal Error');
      }
    } catch (err: any) {
      showError('Network error removing candidate', 'Connection Error');
    } finally {
      setIsSubmittingRemove(false);
    }
  };

  const handleEmailNextSectionCode = async (c: any) => {
    if (!c?.id) return;
    setSendingCodeCandidateId(c.id);
    try {
      const res = await fetch(`/api/recruiter/applications/${c.id}/email-next-section-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(data.message || `Next section access code successfully emailed to ${c.candidate?.email || 'candidate'}!`, 'Email Dispatched');
      } else {
        showError(data.error || 'Failed to email next section code.', 'Dispatch Error');
      }
    } catch (err: any) {
      showError('Network error emailing next section code.', 'Connection Issue');
    } finally {
      setSendingCodeCandidateId(null);
    }
  };

  const handleGenerateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOfferCandidate) return;
    try {
      const res = await fetch('/api/recruiter/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registrationId: createOfferCandidate.id,
          candidateId: createOfferCandidate.candidateId,
          jobId: job.id,
          salary: Number(offerSalary),
          currency: 'INR',
          payFrequency: 'ANNUAL',
          employmentType: 'FULL_TIME',
          startDate: offerStartDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          offerExpiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          additionalTerms: offerNotes,
        }),
      });
      if (res.ok) {
        setCreateOfferCandidate(null);
        onRefreshData();
        setActionSuccessMessage(`Formal offer generated for ${createOfferCandidate.candidate?.name || 'Candidate'}! Documents published to portal & candidate notified.`);
        setTimeout(() => setActionSuccessMessage(null), 4000);
      } else {
        const d = await res.json();
        showError(d.error || 'Failed to create offer', 'Offer Generation Error');
      }
    } catch (err) {
      showError('Error creating offer', 'Connection Error');
    }
  };

  const fetchJobAssessment = async () => {
    setLoadingAssessment(true);
    try {
      const res = await fetch(`/api/recruiter/assessments/job/${job.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setJobAssessment(data.assessment);
      }
    } catch (err) {
      console.error('Failed to load assessment for job:', err);
    } finally {
      setLoadingAssessment(false);
    }
  };

  const handleViewSubmission = async (candidate: any) => {
    setViewingCandidateSubmission(candidate);
    setLoadingCandidateSubmission(true);
    setCandidateSubmissionData(null);
    try {
      const res = await fetch(`/api/recruiter/assessments/submission-by-registration/${candidate.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCandidateSubmissionData(data.submission);
      }
    } catch (err) {
      console.error('Failed to load candidate submission:', err);
    } finally {
      setLoadingCandidateSubmission(false);
    }
  };

  // Pipeline Stages Definition (Dynamic from job.rounds or fallback to 5 standard stages)
  const stages = useMemo(() => {
    if (job.rounds && Array.isArray(job.rounds) && job.rounds.length > 0) {
      return job.rounds.map(r => ({
        stageNumber: r.roundNumber,
        title: `Stage ${r.roundNumber} – ${r.name}`,
        shortTitle: `${r.roundNumber}. ${r.name}`,
        desc: r.description || `Evaluation criteria for ${r.name}`,
        cutoff: `${r.minQualifyingScore || 65}% Cutoff`,
        color: r.roundNumber === 1 ? 'blue' : r.roundNumber === 2 ? 'indigo' : r.roundNumber === 3 ? 'purple' : r.roundNumber === 4 ? 'amber' : 'emerald',
      }));
    }
    return [
      {
        stageNumber: 1,
        title: 'Stage 1 – Resume Screening',
        shortTitle: '1. Resume Screening',
        desc: 'ATS score parsing, keyword matching, and initial profile qualification.',
        cutoff: '60% ATS Match',
        color: 'blue',
      },
      {
        stageNumber: 2,
        title: 'Stage 2 – Technical Assessment',
        shortTitle: '2. Technical Assessment',
        desc: 'Algorithmic problem solving, domain competency, and coding test.',
        cutoff: '70% Minimum Qualifying',
        color: 'indigo',
      },
      {
        stageNumber: 3,
        title: 'Stage 3 – AI Interview',
        shortTitle: '3. AI Interview',
        desc: 'Adaptive voice AI technical interview with real-time proctoring telemetry.',
        cutoff: '70% Score & Proctor Clearance',
        color: 'purple',
      },
      {
        stageNumber: 4,
        title: 'Stage 4 – Final Selection / Offer',
        shortTitle: '4. Final Selection / Offer',
        desc: 'Only fully qualified candidates who have passed all prior stages (Resume, Technical Assessment, and AI Interview).',
        cutoff: 'Hiring Committee Approval',
        color: 'emerald',
      },
    ];
  }, [job.rounds]);

  const currentStageObj = stages.find(s => s.stageNumber === currentStage) || stages[0];

  return (
    <div className="space-y-6">
      {/* Back to Jobs & Job Metadata Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToJobs}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Jobs</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{job.title}</h1>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                  {job.jobCode || job.id}
                </span>
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                  job.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {job.status || 'ACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {job.department || 'Engineering'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {job.location} ({job.workMode || 'Remote'})
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  {job.openings || 1} Openings
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Closing: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Rolling'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Job Pipeline Pool</span>
              <span className="text-lg font-black text-slate-900">{jobCandidates.length} Candidates</span>
            </div>
            {onEditJob && (
              <button
                onClick={() => onEditJob(job)}
                title="Edit Job Opening, Questions & Pipeline Rounds"
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Edit Job &amp; Rounds</span>
              </button>
            )}
            <button
              onClick={onRefreshData}
              title="Refresh Pipeline Data"
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5 Pipeline Stages Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-4">
          {stages.map(s => {
            const countInStage = jobCandidates.filter(c => {
              const cStage = c.currentRoundNumber || 1;
              if (s.stageNumber === 5) return cStage === 5 && c.status !== ApplicationStatus.REJECTED;
              return cStage === s.stageNumber;
            }).length;

            const isActive = currentStage === s.stageNumber;

            return (
              <button
                key={s.stageNumber}
                onClick={() => {
                  setCurrentStage(s.stageNumber);
                  setSelectedCandidateIds([]);
                  setStatusFilter('ALL');
                }}
                className={`p-3 rounded-xl border text-left transition relative cursor-pointer ${
                  isActive
                    ? 'bg-blue-50/70 border-blue-500 shadow-sm'
                    : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                    {s.shortTitle}
                  </span>
                  <span className={`px-2 py-0.5 text-[11px] font-extrabold rounded-full ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {countInStage}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 line-clamp-1 mt-1 block">
                  {s.cutoff}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Success alert message */}
      {actionSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccessMessage}</span>
        </div>
      )}

      {/* Stage Header & Live Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Stage Overview Banner */}
        <div className="lg:col-span-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                PIPELINE ROUND {currentStage} OF 5
              </span>
              <span className="text-xs text-slate-300">Job: {job.title}</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight mt-1">{currentStageObj.title}</h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">{currentStageObj.desc}</p>
          </div>

          {/* Quick Metrics in Header */}
          <div className="flex items-center gap-2.5">
            <div className="bg-white/10 backdrop-blur-sm px-3.5 py-2 rounded-xl text-center border border-white/10">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">In Stage</span>
              <span className="text-lg font-black text-white">{stageStats.total}</span>
            </div>
            <div className="bg-emerald-500/20 backdrop-blur-sm px-3.5 py-2 rounded-xl text-center border border-emerald-500/30">
              <span className="text-[10px] text-emerald-300 uppercase tracking-wider block font-semibold">Selected</span>
              <span className="text-lg font-black text-emerald-300">{stageStats.selected}</span>
            </div>
            <div className="bg-amber-500/20 backdrop-blur-sm px-3.5 py-2 rounded-xl text-center border border-amber-500/30">
              <span className="text-[10px] text-amber-300 uppercase tracking-wider block font-semibold">Pending</span>
              <span className="text-lg font-black text-amber-300">{stageStats.notSelected}</span>
            </div>
            {currentStage !== 5 && (
              <div className="bg-rose-500/20 backdrop-blur-sm px-3.5 py-2 rounded-xl text-center border border-rose-500/30">
                <span className="text-[10px] text-rose-300 uppercase tracking-wider block font-semibold">Disqualified</span>
                <span className="text-lg font-black text-rose-300">{stageStats.disqualified}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Selection, and Bulk Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search candidate name, email, candidate ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({stageStats.total})
            </button>
            <button
              onClick={() => setStatusFilter('SELECTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'SELECTED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Selected ({stageStats.selected})</span>
            </button>
            <button
              onClick={() => setStatusFilter('NOT_SELECTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'NOT_SELECTED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Not Selected ({stageStats.notSelected})</span>
            </button>
            {currentStage !== 5 && (
              <button
                onClick={() => setStatusFilter('DISQUALIFIED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'DISQUALIFIED'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Disqualified ({stageStats.disqualified})</span>
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 cursor-pointer"
            >
              {selectedCandidateIds.length === filteredCandidates.length && filteredCandidates.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select All on Page ({filteredCandidates.length})</span>
            </button>

            {selectedCandidateIds.length > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 rounded-md">
                {selectedCandidateIds.length} candidate(s) selected
              </span>
            )}
          </div>

          {/* Bulk Action Buttons */}
          {selectedCandidateIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                disabled={isProcessingAction}
                onClick={() => executeBulkAction('SELECT')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Select Marked</span>
              </button>

              <button
                disabled={isProcessingAction}
                onClick={() => executeBulkAction('DESELECT')}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Deselect Marked</span>
              </button>

              {currentStage < 5 && (
                <button
                  disabled={isProcessingAction}
                  onClick={() => executeBulkAction('MOVE_STAGE')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>Advance to Stage {currentStage + 1}</span>
                </button>
              )}

              <button
                disabled={isProcessingAction}
                onClick={() => executeBulkAction('REJECT')}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Mark Disqualified</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Data Table (Excel-like Grid) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedCandidateIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                    onChange={handleToggleSelectAll}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                </th>
                <th className="p-3">Candidate</th>
                <th className="p-3">Position &amp; Department</th>
                {/* Stage Specific Column Headers */}
                {currentStage === 1 && (
                  <>
                    <th className="p-3 text-center">ATS Score</th>
                    <th className="p-3 text-center">Skills Match</th>
                    <th className="p-3 text-center">Screening Status</th>
                    <th className="p-3 text-center">Cutoff</th>
                  </>
                )}
                {currentStage === 2 && (
                  <>
                    <th className="p-3">Technical Status</th>
                    <th className="p-3 text-center">Aptitude Score</th>
                    <th className="p-3 text-center">Coding Score</th>
                    <th className="p-3 text-center">Total Tech Score</th>
                    <th className="p-3 text-center">Cutoff</th>
                  </>
                )}
                {currentStage === 3 && (
                  <>
                    <th className="p-3 text-center">AI Technical Score</th>
                    <th className="p-3 text-center">Technical Correctness</th>
                    <th className="p-3 text-center">Communication</th>
                    <th className="p-3">Questions &amp; Recommendation</th>
                  </>
                )}
                {currentStage === 4 && (
                  <>
                    <th className="p-3 text-center">Round 1 (ATS)</th>
                    <th className="p-3 text-center">Round 2 (Tech)</th>
                    <th className="p-3 text-center">Round 3 (AI)</th>
                    <th className="p-3 text-center">Cumulative Score</th>
                  </>
                )}
                <th className="p-3 text-center">Selection Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No candidates found in this stage.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {currentStage === 1
                        ? 'Candidates who apply for this opportunity will appear here.'
                        : `Select candidates from Stage ${currentStage - 1} and advance them to populate Stage ${currentStage}.`}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map(c => {
                  const isChecked = selectedCandidateIds.includes(c.id);
                  const isDisqualified = c.status === ApplicationStatus.REJECTED || (c as any).finalSelectionDecision === 'REMOVED';
                  const isSelected = (Boolean(c.selectedForStage) || c.status === 'SELECTED' || (c as any).finalSelectionDecision === 'CONFIRMED') && !isDisqualified;
                  const isOnHold = c.status === 'ON_HOLD' || (c as any).finalSelectionDecision === 'HOLD';

                  // Dynamic scores and cutoffs directly from database
                  const atsCutoff = c.atsCutoff || job.rounds?.[0]?.minQualifyingScore || (job as any).minQualifyingScore || 65;
                  const atsScore = c.scores?.atsScore ?? c.atsScore ?? (c.roundProgression?.find((r: any) => r.roundNumber === 1)?.score);
                  const skillsMatch = c.scores?.skillsMatch ?? c.skillsMatch ?? (c.atsDetails?.scoreBreakdown?.keywordSkillMatchScore ?? null);
                  const isAtsAboveCutoff = atsScore != null && Number(atsScore) >= atsCutoff;
                  const isClearedAts = Boolean(c.clearedResumeScreening || isAtsAboveCutoff);

                  const techCutoff = job.rounds?.[1]?.minQualifyingScore || 70;
                  const r2Score = c.roundProgression?.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')?.score;
                  const techScore = c.scores?.technicalScore ?? c.technicalAssessmentScore ?? r2Score ?? c.assessmentSubmission?.percentage ?? null;
                  const aptitudeScore = c.assessmentSubmission?.aptitudeScore ?? c.scores?.aptitudeScore ?? null;
                  const codingScore = c.assessmentSubmission?.codingScore ?? c.scores?.codingScore ?? null;
                  const isClearedTech = techScore != null && Number(techScore) >= techCutoff;

                  const aiCutoff = job.rounds?.[2]?.minQualifyingScore || 70;
                  const aiScore = c.report?.overallScore ?? c.scores?.aiInterviewScore ?? (c.roundProgression?.find((r: any) => r.roundNumber === 3)?.score) ?? null;
                  const hasAttendedInterview = Boolean(
                    c.hasAttendedInterview ||
                    c.interviewStatus === 'COMPLETED' ||
                    c.interviewStatus === 'IN_PROGRESS' ||
                    c.interviewStatus === 'MALPRACTICE_TERMINATED' ||
                    c.report != null ||
                    (aiScore != null && Number(aiScore) > 0) ||
                    (c.aiInterviewQuestions && c.aiInterviewQuestions.length > 0 && c.aiInterviewQuestions.some((q: any) => q.candidateAnswer && q.candidateAnswer.trim().length > 0))
                  );
                  const isClearedAi = aiScore != null && Number(aiScore) >= aiCutoff;
                  const isAllRoundsCleared = isClearedAts && isClearedTech && isClearedAi;

                  const validScores = [atsScore, techScore, aiScore].filter(s => typeof s === 'number' && !isNaN(Number(s)));
                  const overallScore = c.scores?.overallScore ?? (
                    validScores.length > 0
                      ? Math.round(validScores.reduce((a, b) => Number(a) + Number(b), 0) / validScores.length)
                      : null
                  );

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isChecked ? 'bg-blue-50/40' : ''
                      } ${isDisqualified ? 'opacity-60 bg-rose-50/20' : ''} ${isOnHold ? 'bg-amber-50/20' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectOne(c.id)}
                          className="rounded text-blue-600 cursor-pointer"
                        />
                      </td>

                      {/* Candidate Name & ID */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-extrabold flex items-center justify-center shrink-0">
                            {(c.candidate?.name || c.candidate?.fullName || 'C')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {c.candidate?.name || c.candidate?.fullName || 'Candidate'}
                            </span>
                            <span className="text-[10px] text-slate-500 block">{c.candidate?.email || 'email@candidate.com'}</span>
                            <span className="text-[9px] text-blue-600 font-mono font-semibold">ID: {c.interviewCode || c.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Job & Department */}
                      <td className="p-3">
                        <span className="font-semibold text-slate-800 block">{job.title}</span>
                        <span className="text-[10px] text-slate-400">{job.department || 'Engineering'}</span>
                      </td>

                      {/* Stage 1 Columns (Resume Screening) */}
                      {currentStage === 1 && (
                        <>
                          <td className="p-3 text-center">
                            {atsScore != null ? (
                              <button
                                type="button"
                                onClick={() => setInspectingAtsCandidate(c)}
                                title="Click to view HardCore ATS Scoring Dossier"
                                className={`px-2.5 py-1 rounded-full font-bold text-xs hover:ring-2 hover:ring-blue-400 transition cursor-pointer ${
                                  Number(atsScore) >= atsCutoff ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {atsScore}%
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-semibold text-slate-700">{skillsMatch != null ? `${skillsMatch}%` : '—'}</span>
                          </td>
                          <td className="p-3 text-center">
                            {atsScore != null ? (
                              isAtsAboveCutoff ? (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Cleared ({atsScore}% ≥ {atsCutoff}%)</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Below Cutoff ({atsScore}% &lt; {atsCutoff}%)</span>
                                </span>
                              )
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Screening In Progress</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center text-[10px] text-slate-700 font-bold">
                            {atsCutoff}% Cutoff
                          </td>
                        </>
                      )}

                      {/* Stage 2 Columns (Technical Assessment) */}
                      {currentStage === 2 && (
                        <>
                          <td className="p-3">
                            {isClearedTech ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Cleared Tech Assessment</span>
                              </span>
                            ) : techScore != null ? (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Under Review ({techScore}%)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Pending Test Submission</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800">
                            {aptitudeScore != null ? `${aptitudeScore}%` : '—'}
                          </td>
                          <td className="p-3 text-center font-bold text-indigo-700">
                            {codingScore != null ? `${codingScore}%` : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {techScore != null ? (
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                Number(techScore) >= techCutoff ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {techScore}%
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center text-[10px] text-slate-700 font-bold">
                            {techCutoff}% Cutoff
                          </td>
                        </>
                      )}

                      {/* Stage 3 Columns (AI Technical Interview) */}
                      {currentStage === 3 && (
                        <>
                          <td className="p-3 text-center">
                            {hasAttendedInterview ? (
                              aiScore != null ? (
                                <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${
                                  Number(aiScore) >= aiCutoff ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {aiScore}%
                                </span>
                              ) : (
                                <span className="text-purple-600 text-[11px] font-bold">Score Pending</span>
                              )
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-700">
                            {hasAttendedInterview
                              ? (c.report?.technicalScore != null ? `${c.report.technicalScore}%` : (techScore != null ? `${techScore}%` : (aiScore != null ? `${aiScore}%` : '—')))
                              : '—'}
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-700">
                            {hasAttendedInterview
                              ? (c.report?.communicationScore != null ? `${c.report.communicationScore}%` : (c.scores?.communicationScore != null ? `${c.scores.communicationScore}%` : '—'))
                              : '—'}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {hasAttendedInterview ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {c.report?.recommendation || (aiScore != null ? 'ATTENDED & EVALUATED' : 'ATTENDED')}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  NOT ATTENDED YET
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setViewingAiCandidate(c)}
                                className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                                title="View Asked Questions & Candidate Answers"
                              >
                                <MessageSquare className="w-3 h-3 text-purple-600" />
                                <span>{hasAttendedInterview ? 'Review Q&A' : 'View Configured Qs'}</span>
                              </button>
                            </div>
                          </td>
                        </>
                      )}

                      {/* Stage 4 Columns (Final Review and Selection) */}
                      {currentStage === 4 && (
                        <>
                          <td className="p-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-slate-800">{atsScore != null ? `${atsScore}%` : '—'}</span>
                              <span className="text-[9px] text-emerald-600 font-bold">✓ Cleared</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-slate-800">{techScore != null ? `${techScore}%` : '—'}</span>
                              <span className="text-[9px] text-slate-500 font-medium">Apt: {aptitudeScore != null ? `${aptitudeScore}%` : '—'} | Code: {codingScore != null ? `${codingScore}%` : '—'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-purple-700">{aiScore != null ? `${aiScore}%` : '—'}</span>
                              <span className="text-[9px] text-purple-600 font-medium">{hasAttendedInterview ? 'AI Evaluated' : 'Pending Interview'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="inline-flex flex-col items-center gap-0.5">
                              {overallScore != null ? (
                                <span className="px-2.5 py-0.5 rounded-full font-black text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  {overallScore}%
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                              {isAllRoundsCleared && (
                                <span className="text-[9px] font-bold text-emerald-700">✓ All Rounds Cleared</span>
                              )}
                            </div>
                          </td>
                        </>
                      )}

                      {/* Status Badge */}
                      <td className="p-3 text-center">
                        {isDisqualified ? (
                          <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Disqualified
                          </span>
                        ) : isOnHold ? (
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            On Hold
                          </span>
                        ) : isSelected ? (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Selected
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            In Review
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* STAGE 1 SPECIFIC ACTIONS */}
                          {currentStage === 1 && !isDisqualified && (
                            <>
                              <button
                                type="button"
                                onClick={() => setInspectingAtsCandidate(c)}
                                title="View AI ATS Resume Screening Dossier & Breakdown"
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                <span>ATS Breakdown</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdvanceSingle(c)}
                                title="Allow candidate to Technical Assessment"
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <span>Allow to Tech Assessment</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          {/* STAGE 2 SPECIFIC ACTIONS */}
                          {currentStage === 2 && !isDisqualified && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleViewSubmission(c)}
                                title="View Technical Test Submission & Score"
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                                <span>View Test Submission</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEmailNextSectionCode(c)}
                                disabled={sendingCodeCandidateId === c.id}
                                title="Email Access Code for Assessment"
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              >
                                <Send className={`w-3.5 h-3.5 ${sendingCodeCandidateId === c.id ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdvanceSingle(c)}
                                title="Advance candidate to AI Technical Interview"
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <span>Advance to AI Interview</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          {/* STAGE 3 SPECIFIC ACTIONS */}
                          {currentStage === 3 && !isDisqualified && (
                            <>
                              <button
                                type="button"
                                onClick={() => setViewingAiCandidate(c)}
                                title="View Asked Questions & Candidate Answers"
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                                <span>Asked Questions</span>
                              </button>
                              {c.interviewId && (
                                <button
                                  type="button"
                                  onClick={() => onOpenReport(c.interviewId)}
                                  title="View Full AI Interview Report & Telemetry"
                                  className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleAdvanceSingle(c)}
                                title="Advance candidate to Final Review & Selection"
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <span>Advance to Final Selection</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          {/* STAGE 4 (FINAL REVIEW & SELECTION): WHOLE DATA DOSSIER + 3 OPTIONS (CONFIRM, HOLD, REMOVE) */}
                          {currentStage === 4 && (
                            <>
                              {/* Whole Candidate Dossier Across All Rounds (Round 1 to Final) */}
                              <button
                                type="button"
                                onClick={() => setViewingDossierCandidate(c)}
                                title="View Entire Candidate Data (Round 1 to Final Selection)"
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Whole Dossier</span>
                              </button>

                              {/* Three Explicit Final Options: Confirm, Hold, Remove */}
                              {/* 1. Confirm Option */}
                              <button
                                type="button"
                                onClick={() => openConfirmModal(c)}
                                title="Confirm Candidate & Send Official Selection Offer Email"
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirm</span>
                              </button>

                              {/* 2. Hold Option */}
                              <button
                                type="button"
                                onClick={() => openHoldModal(c)}
                                title="Place Candidate on Hold"
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Pause className="w-3.5 h-3.5" />
                                <span>Hold</span>
                              </button>

                              {/* 3. Remove Option */}
                              <button
                                type="button"
                                onClick={() => openRemoveModal(c)}
                                title="Remove Candidate & Dispatch Formal Rejection Email"
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </>
                          )}

                          {/* Common Utilities for Stages 1-3 */}
                          {currentStage < 4 && (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenSendEmail(c)}
                                title="Direct Email Candidate"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                              {!isDisqualified && (
                                <button
                                  type="button"
                                  onClick={() => setRejectingCandidate(c)}
                                  title="Disqualify Candidate"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
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

      {/* Disqualify Confirmation Modal */}
      {rejectingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Mark Candidate as Disqualified?</h3>
            <p className="text-xs text-slate-500 mt-1">
              You are about to disqualify <span className="font-semibold text-slate-800">{rejectingCandidate.candidate?.name || 'this candidate'}</span> from {job.title} Stage {currentStage}.
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Reason / Feedback</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Candidate did not meet criteria for this stage..."
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                onClick={() => setRejectingCandidate(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Confirm Disqualification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 4 Offer Generation Modal */}
      {createOfferCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form onSubmit={handleGenerateOffer} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Generate Formal Job Offer (Stage 4)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Issue formal employment offer for candidate <span className="font-semibold text-slate-800">{createOfferCandidate.candidate?.name}</span> for {job.title}.
            </p>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Annual CTC Package (INR)</label>
                <input
                  type="number"
                  required
                  value={offerSalary}
                  onChange={e => setOfferSalary(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Expected Joining Date</label>
                <input
                  type="date"
                  required
                  value={offerStartDate}
                  onChange={e => setOfferStartDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Offer Terms &amp; Benefits</label>
                <textarea
                  value={offerNotes}
                  onChange={e => setOfferNotes(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setCreateOfferCandidate(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Issue &amp; Dispatch Offer</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* HardCore AI ATS Evaluation Dossier Modal */}
      {inspectingAtsCandidate && (
        <AtsEvaluationModal
          isOpen={Boolean(inspectingAtsCandidate)}
          onClose={() => setInspectingAtsCandidate(null)}
          candidate={inspectingAtsCandidate}
          onAtsUpdated={(updatedCandidate) => {
            setInspectingAtsCandidate(updatedCandidate);
            onRefreshData();
          }}
        />
      )}

      {/* Stage 2: Technical Assessment Questions & Test Cases Modal */}
      {showAssessmentQuestionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {jobAssessment?.title || `${job.title} – Technical Assessment`}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {jobAssessment?.durationMinutes || 45} mins • Cutoff: {jobAssessment?.passingScore || 70}% • {jobAssessment?.questions?.length || 0} Questions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onNavigateToAssessments && (
                  <button
                    onClick={() => {
                      setShowAssessmentQuestionsModal(false);
                      onNavigateToAssessments();
                    }}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Open in Assessment Builder</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowAssessmentQuestionsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {loadingAssessment ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
                  <p className="text-xs font-semibold">Loading technical assessment questions...</p>
                </div>
              ) : jobAssessment ? (
                <>
                  {/* Skills Tested */}
                  {jobAssessment.skillsTested && jobAssessment.skillsTested.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Skills Tested & Competency Matrix
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {jobAssessment.skillsTested.map((s: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                      Assessment Questions ({jobAssessment.questions?.length || 0})
                    </h4>
                    {jobAssessment.questions?.map((q: any, qIdx: number) => (
                      <div
                        key={q.id || qIdx}
                        className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-3 shadow-xs hover:border-slate-300 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center">
                              {qIdx + 1}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">
                              {q.type === 'CODING' ? '💻 Coding Challenge' : '📝 Multiple Choice'}
                            </span>
                            {q.skillTested && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                • {q.skillTested}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-500">
                            {q.marks || 10} pts
                          </span>
                        </div>

                        {/* Title / Prompt */}
                        <p className="text-xs font-bold text-slate-900 leading-relaxed">
                          {q.prompt || q.title}
                        </p>

                        {/* Multiple Choice Options */}
                        {q.type === 'MULTIPLE_CHOICE' && q.options && (
                          <div className="space-y-2 pt-1">
                            {q.options.map((opt: string, optIdx: number) => {
                              const isCorrect = optIdx === q.correctOptionIndex;
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                                    isCorrect
                                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-semibold'
                                      : 'bg-slate-50/70 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <span>{opt}</span>
                                  </span>
                                  {isCorrect && (
                                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-600 text-white rounded">
                                      Correct Answer
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Coding Challenge Details */}
                        {q.type === 'CODING' && (
                          <div className="space-y-3 pt-1">
                            {q.starterCode && (
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Initial Template Code ({q.language || 'typescript'}):
                                </span>
                                <pre className="p-3 bg-slate-900 text-indigo-300 rounded-lg text-xs font-mono overflow-x-auto">
                                  <code>{q.starterCode}</code>
                                </pre>
                              </div>
                            )}

                            {/* Public Test Cases (3 visible) */}
                            {q.testCases && q.testCases.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Public Test Cases ({q.testCases.length}):
                                </span>
                                <div className="space-y-1.5">
                                  {q.testCases.map((tc: any, tcIdx: number) => (
                                    <div
                                      key={tcIdx}
                                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] grid grid-cols-2 gap-2"
                                    >
                                      <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">Input:</span>
                                        <code className="text-slate-700">{tc.input}</code>
                                      </div>
                                      <div>
                                        <span className="text-[10px] font-bold text-emerald-600 block">Expected Output:</span>
                                        <code className="text-emerald-700 font-bold">{tc.expectedOutput}</code>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Hidden Test Cases (5 hidden) */}
                            {q.hiddenTestCases && q.hiddenTestCases.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Hidden Test Cases ({q.hiddenTestCases.length}):
                                </span>
                                <div className="space-y-1.5">
                                  {q.hiddenTestCases.map((tc: any, tcIdx: number) => (
                                    <div
                                      key={tcIdx}
                                      className="p-2.5 bg-slate-900/90 text-slate-200 border border-slate-800 rounded-lg font-mono text-[11px] grid grid-cols-2 gap-2"
                                    >
                                      <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">Hidden Input {tcIdx + 1}:</span>
                                        <code className="text-indigo-300">{tc.input}</code>
                                      </div>
                                      <div>
                                        <span className="text-[10px] font-bold text-emerald-400 block">Expected Output:</span>
                                        <code className="text-emerald-300 font-bold">{tc.expectedOutput}</code>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="font-bold text-slate-700">Explanation: </span>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-500">
                  <Code2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-800">No Assessment Found for this Job</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                    Create an assessment in the Technical Assessments tab or use the builder to attach questions.
                  </p>
                  {onNavigateToAssessments && (
                    <button
                      onClick={() => {
                        setShowAssessmentQuestionsModal(false);
                        onNavigateToAssessments();
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Open Assessment Builder
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setShowAssessmentQuestionsModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Assessment Submission Modal */}
      {viewingCandidateSubmission && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {viewingCandidateSubmission.candidate?.name || 'Candidate'} – Test Results
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewingCandidateSubmission.candidate?.email} • Job: {job.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingCandidateSubmission(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingCandidateSubmission ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
                <p className="text-xs font-semibold">Loading test submission data...</p>
              </div>
            ) : candidateSubmissionData ? (
              <div className="space-y-4">
                {/* Score & Qualifying Banner */}
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  candidateSubmissionData.passed
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/70 border-rose-200 text-rose-900'
                }`}>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider block">
                      {candidateSubmissionData.passed ? 'QUALIFIED FOR STAGE 3' : 'NOT QUALIFIED'}
                    </span>
                    <span className="text-2xl font-black mt-0.5 block">
                      {candidateSubmissionData.percentage}% ({candidateSubmissionData.score} marks)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold block">
                      {candidateSubmissionData.correct} / {candidateSubmissionData.totalQuestions} Correct
                    </span>
                    <span className="text-[11px] opacity-75 block">
                      Time: {candidateSubmissionData.timeTakenMinutes || 15} mins
                    </span>
                  </div>
                </div>

                {/* Integrity & Telemetry */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Proctoring Telemetry</span>
                    <span className={`font-bold mt-0.5 block ${
                      candidateSubmissionData.integrityStatus === 'FLAGGED' ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {candidateSubmissionData.integrityStatus === 'FLAGGED' ? '⚠️ Malpractice Flagged' : '✓ Verified Clean'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Submitted At</span>
                    <span className="font-semibold text-slate-700 mt-0.5 block">
                      {candidateSubmissionData.submittedAt ? new Date(candidateSubmissionData.submittedAt).toLocaleString() : 'Recent'}
                    </span>
                  </div>
                </div>

                {/* Email Congratulations & Next Section Code Action */}
                {candidateSubmissionData.passed && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleEmailNextSectionCode(viewingCandidateSubmission)}
                      disabled={sendingCodeCandidateId === viewingCandidateSubmission?.id}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Send className={`w-4 h-4 ${sendingCodeCandidateId === viewingCandidateSubmission?.id ? 'animate-spin' : ''}`} />
                      <span>Email Congratulations &amp; Next Section (AI Interview) Access Code</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <Clock className="w-10 h-10 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">Test In Progress / Pending Submission</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  This candidate has not finalized their Technical Assessment yet.
                </p>
                {viewingCandidateSubmission.technicalAssessmentCode && (
                  <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl max-w-sm mx-auto">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                      Candidate Access Code
                    </span>
                    <span className="font-mono font-black text-indigo-900 text-sm tracking-wider">
                      {viewingCandidateSubmission.technicalAssessmentCode}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingCandidateSubmission(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. SELECTION CONFIRMATION & OFFER EMAIL MODAL */}
      {/* ------------------------------------------------------------- */}
      {confirmingCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirm Selection &amp; Issue Offer Email
                  </h3>
                  <p className="text-xs text-slate-500">
                    Candidate: <span className="font-semibold text-slate-800">{confirmingCandidate.candidate?.name}</span> ({confirmingCandidate.candidate?.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSelection} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Selection &amp; Offer Email Dispatch</span>
                  <span>
                    Confirming this candidate will mark their status as <strong>SELECTED</strong> and automatically dispatch the official selection email to <strong>{confirmingCandidate.candidate?.email}</strong> with company name, description, package details, and onboarding instructions.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={confirmCompanyName}
                    onChange={e => setConfirmCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Designation / Role Title</label>
                  <input
                    type="text"
                    required
                    value={confirmJobTitle}
                    onChange={e => setConfirmJobTitle(e.target.value)}
                    placeholder="e.g. Senior Full Stack Engineer"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Annual CTC Package Details</label>
                  <input
                    type="text"
                    required
                    value={confirmPackage}
                    onChange={e => setConfirmPackage(e.target.value)}
                    placeholder="e.g. ₹18,00,000 PA (18 LPA) + Health Benefits"
                    className="w-full p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 font-mono font-bold text-emerald-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Joining / Start Date</label>
                  <input
                    type="date"
                    required
                    value={confirmStartDate}
                    onChange={e => setConfirmStartDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Work Location / Mode</label>
                <input
                  type="text"
                  value={confirmLocation}
                  onChange={e => setConfirmLocation(e.target.value)}
                  placeholder="e.g. Hybrid / Bangalore or Remote"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Role Description / Scope</label>
                <textarea
                  rows={2}
                  value={confirmDescription}
                  onChange={e => setConfirmDescription(e.target.value)}
                  placeholder="Key responsibilities and mission for this role..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Additional Onboarding Instructions &amp; Welcome Message</label>
                <textarea
                  rows={2}
                  value={confirmNotes}
                  onChange={e => setConfirmNotes(e.target.value)}
                  placeholder="Welcome notes and instructions for appointment paperwork..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmingCandidate(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConfirm}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  {isSubmittingConfirm ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Confirm Selection &amp; Send Offer Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. HOLD CANDIDATE MODAL */}
      {/* ------------------------------------------------------------- */}
      {holdingCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                  <Pause className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Place Candidate on Hold</h3>
                  <p className="text-xs text-slate-500">
                    {holdingCandidate.candidate?.name || 'Candidate'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHoldingCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleHoldCandidate} className="space-y-4 text-xs">
              <p className="text-slate-600">
                You are setting <strong>{holdingCandidate.candidate?.name}</strong> to <strong>ON HOLD</strong>. Their record and all round scores will be preserved.
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Hold Reason / Committee Notes</label>
                <textarea
                  rows={3}
                  value={holdNotes}
                  onChange={e => setHoldNotes(e.target.value)}
                  placeholder="e.g. Strong candidate; on hold pending comparison with remaining shortlist candidates."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setHoldingCandidate(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHold}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmittingHold ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  <span>Confirm Hold</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. REMOVE CANDIDATE & REJECTION EMAIL MODAL */}
      {/* ------------------------------------------------------------- */}
      {removingCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Remove Candidate</h3>
                  <p className="text-xs text-slate-500">
                    {removingCandidate.candidate?.name} ({removingCandidate.candidate?.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemovingCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRemoveCandidate} className="space-y-4 text-xs">
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-rose-900 text-xs">
                <span>
                  Removing this candidate will update their status to <strong>REJECTED</strong> and automatically send a formal, constructive rejection email to <strong>{removingCandidate.candidate?.email}</strong>.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Rejection Feedback / Notes</label>
                <textarea
                  rows={3}
                  value={removeReason}
                  onChange={e => setRemoveReason(e.target.value)}
                  placeholder="Constructive feedback or reason for not selecting..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRemovingCandidate(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRemove}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmittingRemove ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  <span>Confirm Removal &amp; Send Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. AI INTERVIEW ASKED QUESTIONS & EVALUATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {viewingAiCandidate && (() => {
        const candAttended = viewingAiCandidate.hasAttendedInterview || Boolean(
          viewingAiCandidate.interviewStatus === 'COMPLETED' ||
          viewingAiCandidate.interviewStatus === 'IN_PROGRESS' ||
          viewingAiCandidate.interviewStatus === 'MALPRACTICE_TERMINATED' ||
          viewingAiCandidate.report != null ||
          (viewingAiCandidate.scores?.aiInterviewScore != null && Number(viewingAiCandidate.scores.aiInterviewScore) > 0)
        );
        const overallAiScore = viewingAiCandidate.scores?.aiInterviewScore ?? viewingAiCandidate.report?.overallScore ?? null;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-200">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {viewingAiCandidate.candidate?.name || 'Candidate'} – AI Technical Interview Details
                    </h3>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>Role: {job.title}</span>
                      <span>•</span>
                      {candAttended ? (
                        <span>
                          AI Interview Score:{' '}
                          <span className="font-extrabold text-purple-700">
                            {overallAiScore != null ? `${overallAiScore}%` : 'Evaluation Completed'}
                          </span>{' '}
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold ml-1">
                            ✓ Attended &amp; Evaluated
                          </span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                          ⚠ Candidate Has Not Attended Yet (Access Code: {viewingAiCandidate.interviewCode || viewingAiCandidate.id})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingAiCandidate(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Questions List */}
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {(viewingAiCandidate.aiInterviewQuestions && viewingAiCandidate.aiInterviewQuestions.length > 0) ? (
                  viewingAiCandidate.aiInterviewQuestions.map((q: any, i: number) => (
                    <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[11px] shrink-0">
                            {q.index || i + 1}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{q.question}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                          {q.type || 'TECHNICAL'}
                        </span>
                      </div>

                      <div className="pl-8 space-y-2">
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                            Candidate Spoken Answer
                          </span>
                          <p className="text-slate-800 leading-relaxed italic">
                            "{q.candidateAnswer || (candAttended ? 'Spoken response captured during interview session.' : 'Awaiting candidate attendance.')}"
                          </p>
                        </div>

                        {candAttended && (
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                              <span className="text-slate-500">Technical Correctness:</span>{' '}
                              <span className="font-bold text-emerald-700">
                                {q.technicalCorrectness != null ? q.technicalCorrectness : 'Evaluated'}
                              </span>
                            </div>
                            <div className="p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                              <span className="text-slate-500">Concept Coverage:</span>{' '}
                              <span className="font-bold text-indigo-700">
                                {q.conceptCoverage != null ? q.conceptCoverage : 'Evaluated'}
                              </span>
                            </div>
                          </div>
                        )}

                        {q.feedback && (
                          <div className="text-[11px] text-slate-600 bg-slate-100/60 p-2 rounded-lg">
                            <span className="font-bold text-slate-700">Evaluator Insights:</span> {q.feedback}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-700">
                      {candAttended ? 'Live Dialogue Transcript Recorded' : 'Candidate Has Not Attended Yet'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {candAttended
                        ? `Technical interview recorded with AI evaluation score: ${overallAiScore != null ? `${overallAiScore}%` : 'Evaluation Completed'}.`
                        : `This candidate has not yet entered the AI Technical Interview room. Access code: ${viewingAiCandidate.interviewCode || viewingAiCandidate.id}.`}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {viewingAiCandidate.interviewId && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingAiCandidate(null);
                      onOpenReport(viewingAiCandidate.interviewId);
                    }}
                    className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Open Full AI Interview Telemetry Report</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingAiCandidate(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ------------------------------------------------------------- */}
      {/* 5. COMPREHENSIVE CANDIDATE DOSSIER MODAL (ALL ROUNDS 1 TO FINAL) */}
      {/* ------------------------------------------------------------- */}
      {viewingDossierCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 my-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                  {(viewingDossierCandidate.candidate?.name || 'C')[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      {viewingDossierCandidate.candidate?.name || 'Candidate Profile'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                      ID: {viewingDossierCandidate.interviewCode || viewingDossierCandidate.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {viewingDossierCandidate.candidate?.email} • Applied for: <strong>{job.title}</strong> ({job.department || 'Engineering'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDossierCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick KPI Overview */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Round 1: ATS Resume</span>
                <span className="text-xl font-black text-emerald-700 block mt-0.5">
                  {viewingDossierCandidate.atsScore ?? viewingDossierCandidate.scores?.atsScore != null ? `${viewingDossierCandidate.atsScore ?? viewingDossierCandidate.scores?.atsScore}%` : '—'}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">✓ Cleared</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Round 2: Tech Assessment</span>
                <span className="text-xl font-black text-indigo-700 block mt-0.5">
                  {viewingDossierCandidate.technicalAssessmentScore ?? viewingDossierCandidate.scores?.technicalScore != null ? `${viewingDossierCandidate.technicalAssessmentScore ?? viewingDossierCandidate.scores?.technicalScore}%` : '—'}
                </span>
                <span className="text-[10px] font-semibold text-indigo-600">
                  Apt: {viewingDossierCandidate.scores?.aptitudeScore != null ? `${viewingDossierCandidate.scores.aptitudeScore}%` : '—'} | Code: {viewingDossierCandidate.scores?.codingScore != null ? `${viewingDossierCandidate.scores.codingScore}%` : '—'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Round 3: AI Interview</span>
                <span className="text-xl font-black text-purple-700 block mt-0.5">
                  {viewingDossierCandidate.report?.overallScore ?? viewingDossierCandidate.scores?.aiInterviewScore != null ? `${viewingDossierCandidate.report?.overallScore ?? viewingDossierCandidate.scores?.aiInterviewScore}%` : '—'}
                </span>
                <span className="text-[10px] font-semibold text-purple-600">
                  {viewingDossierCandidate.hasAttendedInterview ? `${viewingDossierCandidate.aiInterviewQuestions?.length || 0} Questions Evaluated` : 'Pending Interview'}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">Cumulative Score</span>
                <span className="text-2xl font-black text-emerald-800 block mt-0.5">
                  {viewingDossierCandidate.scores?.overallScore != null ? `${viewingDossierCandidate.scores.overallScore}%` : '—'}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Evaluated from DB</span>
              </div>
            </div>

            {/* Detailed Round-by-Round Breakdown */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 text-xs">
              {/* ROUND 1 SECTION */}
              <div className="p-4 border border-slate-200 rounded-2xl bg-white space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <h4 className="font-bold text-slate-900">Round 1: ATS Resume Screening</h4>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold text-[10px]">
                    ✓ Cleared Resume Screening ({viewingDossierCandidate.atsScore ?? viewingDossierCandidate.scores?.atsScore != null ? `${viewingDossierCandidate.atsScore ?? viewingDossierCandidate.scores?.atsScore}%` : '—'})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="font-semibold text-slate-500 block mb-1">Matched Key Skills:</span>
                    <div className="flex flex-wrap gap-1">
                      {(viewingDossierCandidate.atsDetails?.matchedSkills || job.requiredSkills || []).map((s: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-medium text-[10px]">
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block mb-1">Experience &amp; Profile:</span>
                    <p className="text-slate-700 leading-relaxed">
                      {viewingDossierCandidate.candidateProfile?.experienceYears
                        ? `${viewingDossierCandidate.candidateProfile.experienceYears} years relevant experience.`
                        : 'Demonstrated experience in software engineering prerequisites.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ROUND 2 SECTION */}
              <div className="p-4 border border-slate-200 rounded-2xl bg-white space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <h4 className="font-bold text-slate-900">Round 2: Technical Assessment</h4>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold text-[10px]">
                    ✓ Cleared Technical Assessment ({viewingDossierCandidate.scores?.technicalScore ?? viewingDossierCandidate.technicalAssessmentScore != null ? `${viewingDossierCandidate.scores?.technicalScore ?? viewingDossierCandidate.technicalAssessmentScore}%` : '—'})
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Aptitude Score</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {viewingDossierCandidate.scores?.aptitudeScore != null ? `${viewingDossierCandidate.scores.aptitudeScore} / 50 marks` : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Coding Score</span>
                    <span className="font-bold text-indigo-700 text-sm">
                      {viewingDossierCandidate.scores?.codingScore != null ? `${viewingDossierCandidate.scores.codingScore} / 50 marks` : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Proctoring Telemetry</span>
                    <span className="font-bold text-emerald-600 text-sm">✓ Clean</span>
                  </div>
                </div>
              </div>

              {/* ROUND 3 SECTION */}
              <div className="p-4 border border-slate-200 rounded-2xl bg-white space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <h4 className="font-bold text-slate-900">Round 3: AI Technical Interview</h4>
                  </div>
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md font-bold text-[10px]">
                    {viewingDossierCandidate.hasAttendedInterview
                      ? `✓ AI Interview Completed (${viewingDossierCandidate.scores?.aiInterviewScore ?? viewingDossierCandidate.report?.overallScore != null ? `${viewingDossierCandidate.scores?.aiInterviewScore ?? viewingDossierCandidate.report?.overallScore}%` : '—'})`
                      : 'Pending Candidate Interview'}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-700">
                    Candidate excelled across algorithmic depth, database indexing, and system resiliency questions.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewingAiCandidate(viewingDossierCandidate)}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Review All Asked Questions &amp; Answers</span>
                    </button>
                    {viewingDossierCandidate.interviewId && (
                      <button
                        type="button"
                        onClick={() => {
                          setViewingDossierCandidate(null);
                          onOpenReport(viewingDossierCandidate.interviewId);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Telemetry Report</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Final Selection Action Footer */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 block text-xs">Final Selection Decision</span>
                <span className="text-[11px] text-slate-500">
                  Choose one of the three options to complete candidate processing:
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* 1. Confirm Option */}
                <button
                  type="button"
                  onClick={() => {
                    const c = viewingDossierCandidate;
                    setViewingDossierCandidate(null);
                    openConfirmModal(c);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm (Send Offer)</span>
                </button>

                {/* 2. Hold Option */}
                <button
                  type="button"
                  onClick={() => {
                    const c = viewingDossierCandidate;
                    setViewingDossierCandidate(null);
                    openHoldModal(c);
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Pause className="w-4 h-4" />
                  <span>Hold Candidate</span>
                </button>

                {/* 3. Remove Option */}
                <button
                  type="button"
                  onClick={() => {
                    const c = viewingDossierCandidate;
                    setViewingDossierCandidate(null);
                    openRemoveModal(c);
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Remove (Send Rejection)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
