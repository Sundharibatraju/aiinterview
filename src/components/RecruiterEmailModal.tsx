import React, { useState } from 'react';
import { X, Send, Mail, CheckCircle2, Sparkles, FileText } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

interface RecruiterEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateRegistration: any | null;
  token: string;
  onEmailSent: () => void;
}

export const RecruiterEmailModal: React.FC<RecruiterEmailModalProps> = ({
  isOpen,
  onClose,
  candidateRegistration,
  token,
  onEmailSent,
}) => {
  const { showError, showSuccess, showWarning } = useNotification();
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('CUSTOM');

  if (!isOpen || !candidateRegistration) return null;

  const candidateName = candidateRegistration.candidate?.fullName || 'Candidate';
  const candidateEmail = candidateRegistration.candidate?.email || '';
  const jobTitle = candidateRegistration.job?.title || 'Open Position';
  const companyName = candidateRegistration.job?.company?.name || 'Recruitment Team';

  const applyTemplate = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    switch (templateKey) {
      case 'NEXT_ROUND':
        setSubject(`Congratulations! Next Round Invitation for ${jobTitle} at ${companyName}`);
        setMessageBody(
          `Dear ${candidateName},\n\nWe are pleased to inform you that you have successfully cleared the previous evaluation round for the ${jobTitle} position at ${companyName}.\n\nOur team was impressed by your performance. We invite you to proceed to the next round in our recruitment pipeline. Please check your candidate portal to access the schedule and instructions.\n\nBest regards,\n${companyName} Talent Acquisition Team`
        );
        break;
      case 'SHORTLIST':
        setSubject(`Profile Shortlisted - ${jobTitle} at ${companyName}`);
        setMessageBody(
          `Dear ${candidateName},\n\nThank you for applying to the ${jobTitle} role. Following our evaluation, we are delighted to shortlist your profile for further interview rounds.\n\nOur hiring team will be in touch with additional details regarding upcoming interview slots.\n\nWarm regards,\n${companyName} Recruitment Panel`
        );
        break;
      case 'OFFER':
        setSubject(`Offer of Employment: ${jobTitle} - ${companyName}`);
        setMessageBody(
          `Dear ${candidateName},\n\nOn behalf of ${companyName}, it is our pleasure to extend an official employment offer for the ${jobTitle} position!\n\nYou achieved outstanding marks across all 5 evaluation rounds. We believe your technical depth and mindset make you an exceptional addition to our team.\n\nPlease review your formal offer details in the portal.\n\nCongratulations and welcome aboard,\nLeadership Team, ${companyName}`
        );
        break;
      case 'STATUS_UPDATE':
        setSubject(`Update on your application for ${jobTitle}`);
        setMessageBody(
          `Dear ${candidateName},\n\nThis is an update regarding your active application for ${jobTitle} at ${companyName}.\n\nYour recent assessment results have been logged and reviewed by the technical committee. We appreciate your engagement throughout this process.\n\nSincerely,\n${companyName} Hiring Team`
        );
        break;
      default:
        break;
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !messageBody.trim()) {
      showWarning('Please fill in both subject and message body.', 'Incomplete Email');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/recruiter/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registrationId: candidateRegistration.id,
          subject: subject.trim(),
          messageBody: messageBody.trim(),
        }),
      });

      setIsSending(false);
      if (res.ok) {
        onEmailSent();
        onClose();
        showSuccess(`Email successfully dispatched to ${candidateEmail}!`, 'Email Sent');
      } else {
        const d = await res.json();
        showError(d.error || 'Failed to dispatch email', 'Dispatch Error');
      }
    } catch (err) {
      setIsSending(false);
      showError('Network error while sending email. Please verify connection.', 'Network Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Direct Candidate Communication</h2>
            <p className="text-xs text-slate-500">
              Recipient: <strong className="text-slate-800">{candidateName}</strong> ({candidateEmail})
            </p>
          </div>
        </div>

        {/* Quick Template Selector */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Load Quick Professional Template</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyTemplate('NEXT_ROUND')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
            >
              Next Round Invite
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('SHORTLIST')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
            >
              Shortlist Notice
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('OFFER')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
            >
              Offer Announcement
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('STATUS_UPDATE')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
            >
              Status Update
            </button>
          </div>
        </div>

        <form onSubmit={handleSend} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
            <textarea
              rows={6}
              required
              value={messageBody}
              onChange={e => setMessageBody(e.target.value)}
              placeholder="Write your email message to the candidate..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 font-sans text-xs leading-relaxed"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
            This message will be dispatched directly to <strong>{candidateEmail}</strong> and logged in the candidate's recruitment mailbox.
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
              disabled={isSending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Dispatching Email...' : 'Send Email'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
