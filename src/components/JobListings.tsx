import React, { useState, useMemo } from 'react';
import { Search, Filter, Building2, MapPin, Clock, Calendar, CheckCircle2, ArrowRight, Award } from 'lucide-react';
import { Job, WorkMode } from '../types/index';
import { useAuth } from '../context/AuthContext';

interface JobListingsProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onRegisterJob: (job: Job) => void;
  registeredJobIds: string[];
}

export const JobListings: React.FC<JobListingsProps> = ({
  jobs,
  onSelectJob,
  onRegisterJob,
  registeredJobIds,
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>('ALL');
  const [minPackageFilter, setMinPackageFilter] = useState<number>(0);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.requiredSkills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesMode =
        selectedWorkMode === 'ALL' || job.workMode === selectedWorkMode;

      const matchesPackage =
        minPackageFilter === 0 || job.maxPackage >= minPackageFilter;

      return matchesSearch && matchesMode && matchesPackage;
    });
  }, [jobs, searchTerm, selectedWorkMode, minPackageFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Title & Search Bar */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Opportunities</h1>
            <p className="text-sm text-slate-500 mt-1">
              Select an opening to view specifications and apply for an autonomous AI technical interview.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredJobs.length}</strong> available openings
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-6 bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by job title, tech stack, or company name..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Work Mode Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {['ALL', WorkMode.REMOTE, WorkMode.HYBRID, WorkMode.ONSITE].map(mode => (
              <button
                key={mode}
                onClick={() => setSelectedWorkMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedWorkMode === mode
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode === 'ALL' ? 'All Modes' : mode}
              </button>
            ))}
          </div>

          {/* Min Package Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Min CTC:</span>
            <select
              value={minPackageFilter}
              onChange={e => setMinPackageFilter(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 outline-none focus:border-blue-500"
            >
              <option value={0}>Any Package</option>
              <option value={600000}>₹6 LPA+</option>
              <option value={1000000}>₹10 LPA+</option>
              <option value={1500000}>₹15 LPA+</option>
              <option value={2000000}>₹20 LPA+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Job Grid */}
      {jobs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Job Openings Available</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            There are currently no active job postings. Positions published by recruiters will appear here in real-time.
          </p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No matching positions found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search keywords or resetting work mode filters to view all available roles.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedWorkMode('ALL');
              setMinPackageFilter(0);
            }}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map(job => {
            const isRegistered = registeredJobIds.includes(job.id);

            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {job.company?.logoUrl ? (
                        <img
                          src={job.company.logoUrl}
                          alt={job.company.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {job.workMode}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-xs font-medium text-slate-500">{job.company?.name}</span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5 line-clamp-1">
                      {job.title}
                    </h3>
                  </div>

                  {/* Metadata Chips */}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <span>{(job.minPackage / 100000).toFixed(1)}L - {(job.maxPackage / 100000).toFixed(1)}L {job.currency || 'LPA'}</span>
                    </span>
                  </div>

                  {/* Skills */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {job.requiredSkills.map(skill => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Short snippet */}
                  <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>
                </div>

                {/* Footer and CTAs */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> ~{job.durationMinutes} mins AI Interview
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Due {job.deadline}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onSelectJob(job)}
                      className="py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                    >
                      View Details
                    </button>
                    {isRegistered ? (
                      <button
                        disabled
                        className="py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1 cursor-default"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Applied</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onRegisterJob(job)}
                        className="py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Apply</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
