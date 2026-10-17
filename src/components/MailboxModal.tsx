import React, { useState, useEffect } from 'react';
import { X, Mail, Clock, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { EmailLog } from '../types/index';

interface MailboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export const MailboxModal: React.FC<MailboxModalProps> = ({ isOpen, onClose, userEmail }) => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, userEmail]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const url = userEmail ? `/api/mailbox?email=${encodeURIComponent(userEmail)}` : '/api/mailbox';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
        if (data.length > 0 && !selectedLog) {
          setSelectedLog(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch mailbox logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[650px] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Transactional Mail Delivery Feed</h2>
              <p className="text-xs text-slate-500">Live dispatched verification OTPs, interview registration codes & assessment reports</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: List of Mails */}
          <div className="w-1/3 border-r border-slate-200 overflow-y-auto bg-slate-50/50 p-3 space-y-2">
            {isLoading && logs.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">Checking delivery queue...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-500">
                <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No messages recorded for this mailbox yet.
              </div>
            ) : (
              logs.map(log => {
                const isSelected = selectedLog?.id === log.id;
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      isSelected
                        ? 'bg-white border-blue-500 shadow-sm'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold tracking-wide text-blue-600 uppercase">
                        {log.template.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 line-clamp-1">{log.subject}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-2 mt-1">{log.payloadPreview}</div>
                    <div className="text-[10px] text-slate-400 mt-2">To: {log.toEmail}</div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Mail Details */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {selectedLog ? (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle className="w-3.5 h-3.5" /> Dispatched Successfully
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(selectedLog.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-3">{selectedLog.subject}</h3>
                  <div className="text-xs text-slate-500 mt-1">
                    Recipient: <span className="font-medium text-slate-800">{selectedLog.toEmail}</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 whitespace-pre-line font-mono text-xs leading-relaxed text-slate-800">
                  {selectedLog.fullContent || selectedLog.payloadPreview}
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>
                    Verified AI Interviewer delivery audit. This copy represents the exact automated payload dispatched to the candidate.
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Select a message from the left to preview content.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
