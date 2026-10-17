import React, { useState, useMemo } from 'react';
import { Bot, Briefcase, UserCheck, LogOut, Mail, Building, FileText, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/index';
import { MailboxModal } from './MailboxModal';
import { LogoutConfirmationModal } from './LogoutConfirmationModal';
import { CircularProgressBar } from './CircularProgressBar';
import { calculateProfileCompletion } from '../utils/profileValidation';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenCandidateLogin: () => void;
  onOpenCandidateRegister: () => void;
  onOpenRecruiterLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenCandidateLogin,
  onOpenCandidateRegister,
  onOpenRecruiterLogin,
}) => {
  const { user, profile, logout } = useAuth();
  const [showMailbox, setShowMailbox] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isCandidate = user?.role === UserRole.CANDIDATE;
  const isRecruiter = user?.role === UserRole.RECRUITER || user?.role === UserRole.ADMIN;

  const profileCompletion = useMemo(() => {
    return calculateProfileCompletion(user, profile);
  }, [user, profile]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-3 group text-left transition"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base tracking-tight text-slate-900">AI INTERVIEWER</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                    AUTONOMOUS
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 tracking-wide">Autonomous Recruitment Platform</p>
              </div>
            </button>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              <button
                onClick={() => onNavigate('jobs')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  currentView === 'jobs'
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Explore Jobs
              </button>

              {isCandidate && (
                <button
                  onClick={() => onNavigate('my-interviews')}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
                    currentView === 'my-interviews'
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  My Interviews
                </button>
              )}

              {isRecruiter && (
                <button
                  onClick={() => onNavigate('recruiter-dashboard')}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
                    currentView === 'recruiter-dashboard'
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  Recruiter Portal
                </button>
              )}
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Live Email Dispatch Feed button - Only visible in Recruiter Portal for recruiters */}
            {currentView === 'recruiter-dashboard' && (user?.role === UserRole.RECRUITER || user?.role === UserRole.ADMIN) && (
              <button
                onClick={() => setShowMailbox(true)}
                title="View sent OTPs, access codes & interview reports"
                className="relative p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                </span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-800">{user.fullName}</div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    {user.role}
                  </div>
                </div>

                {isCandidate && (
                  <button
                    onClick={() => onNavigate('candidate-profile')}
                    title={`Candidate Profile: ${profileCompletion.percentage}% Completed (${profileCompletion.isComplete ? 'Ready to Apply' : 'Details Pending'})`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50/50 transition cursor-pointer"
                  >
                    <CircularProgressBar
                      percentage={profileCompletion.percentage}
                      size={26}
                      strokeWidth={3}
                      showLabel={false}
                    />
                    <div className="text-left hidden sm:block">
                      <span className="text-[10px] font-bold text-slate-700 block leading-tight">Profile</span>
                      <span className={`text-[10px] font-extrabold ${profileCompletion.isComplete ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {profileCompletion.percentage}%
                      </span>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  title="Logout"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenCandidateLogin}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 transition"
                >
                  Candidate Login
                </button>
                <button
                  onClick={onOpenCandidateRegister}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
                >
                  Register
                </button>
                <button
                  onClick={onOpenRecruiterLogin}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded-lg transition"
                >
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  Recruiter Login
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Mailbox Inspector */}
      <MailboxModal
        isOpen={showMailbox}
        onClose={() => setShowMailbox(false)}
        userEmail={user?.email}
      />

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          logout();
          onNavigate('landing');
        }}
      />
    </>
  );
};
