import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  User,
  Save,
  MapPin,
  Phone,
  GraduationCap,
  Briefcase,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Award,
  Layers,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EducationDetails, CandidateProfile } from '../types/index';
import { CircularProgressBar } from './CircularProgressBar';
import { calculateProfileCompletion } from '../utils/profileValidation';

interface CandidateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CandidateProfileModal: React.FC<CandidateProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile, token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Personal Info
  const [phone, setPhone] = useState(profile?.phone || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [customLocation, setCustomLocation] = useState('');
  const [bio, setBio] = useState(profile?.bio || '');

  // Education Details
  const existingEdu: EducationDetails = profile?.educationDetails || {};
  const [class10School, setClass10School] = useState(existingEdu.class10School || '');
  const [class10Board, setClass10Board] = useState(existingEdu.class10Board || '');
  const [class10Percentage, setClass10Percentage] = useState(existingEdu.class10Percentage || '');
  const [class10Year, setClass10Year] = useState(existingEdu.class10Year || '');

  const [secondaryType, setSecondaryType] = useState<'12th' | 'Diploma'>(existingEdu.secondaryType || '12th');
  
  // 12th
  const [class12College, setClass12College] = useState(existingEdu.class12College || '');
  const [class12Stream, setClass12Stream] = useState(existingEdu.class12Stream || '');
  const [class12Percentage, setClass12Percentage] = useState(existingEdu.class12Percentage || '');
  const [class12Year, setClass12Year] = useState(existingEdu.class12Year || '');

  // Diploma
  const [diplomaCollege, setDiplomaCollege] = useState(existingEdu.diplomaCollege || '');
  const [diplomaBranch, setDiplomaBranch] = useState(existingEdu.diplomaBranch || '');
  const [diplomaPercentage, setDiplomaPercentage] = useState(existingEdu.diplomaPercentage || '');
  const [diplomaYear, setDiplomaYear] = useState(existingEdu.diplomaYear || '');

  // Degree
  const [degreeName, setDegreeName] = useState(existingEdu.degreeName || '');
  const [degreeSpecialization, setDegreeSpecialization] = useState(existingEdu.degreeSpecialization || '');
  const [degreeCollege, setDegreeCollege] = useState(existingEdu.degreeCollege || '');
  const [degreeCgpa, setDegreeCgpa] = useState(existingEdu.degreeCgpa || '');
  const [degreeYear, setDegreeYear] = useState(existingEdu.degreeYear || '');

  // Experience, Skills & Projects
  const [experienceYears, setExperienceYears] = useState(profile?.experienceYears ?? 0);
  const [skills, setSkills] = useState((profile?.skills || []).join(', '));
  const [projects, setProjects] = useState((profile?.projects || []).join('\n'));
  const [certifications, setCertifications] = useState((profile?.certifications || []).join(', '));
  const [resumeFileName, setResumeFileName] = useState(profile?.resumeFileName || '');
  const [resumeText, setResumeText] = useState(profile?.resumeText || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Synchronize when profile or modal changes
  useEffect(() => {
    if (profile) {
      setPhone(profile.phone || '');
      const loc = profile.location || '';
      const standardLocations = ['Hyderabad', 'Chennai', 'Bangalore', 'Mysore', 'Delhi', 'Pune', 'Mumbai'];
      const matched = standardLocations.find(l => l.toLowerCase() === loc.toLowerCase());
      if (matched) {
        setLocation(matched);
        setCustomLocation('');
      } else if (loc) {
        setLocation('Others');
        setCustomLocation(loc);
      } else {
        setLocation('');
        setCustomLocation('');
      }
      setBio(profile.bio || '');
      const edu = profile.educationDetails || {};
      setClass10School(edu.class10School || '');
      setClass10Board(edu.class10Board || '');
      setClass10Percentage(edu.class10Percentage || '');
      setClass10Year(edu.class10Year || '');
      setSecondaryType(edu.secondaryType || '12th');
      setClass12College(edu.class12College || '');
      setClass12Stream(edu.class12Stream || '');
      setClass12Percentage(edu.class12Percentage || '');
      setClass12Year(edu.class12Year || '');
      setDiplomaCollege(edu.diplomaCollege || '');
      setDiplomaBranch(edu.diplomaBranch || '');
      setDiplomaPercentage(edu.diplomaPercentage || '');
      setDiplomaYear(edu.diplomaYear || '');
      setDegreeName(edu.degreeName || '');
      setDegreeSpecialization(edu.degreeSpecialization || '');
      setDegreeCollege(edu.degreeCollege || '');
      setDegreeCgpa(edu.degreeCgpa || '');
      setDegreeYear(edu.degreeYear || '');
      setExperienceYears(profile.experienceYears ?? 0);
      setSkills((profile.skills || []).join(', '));
      setProjects((profile.projects || []).join('\n'));
      setCertifications((profile.certifications || []).join(', '));
      setResumeFileName(profile.resumeFileName || '');
      setResumeText(profile.resumeText || '');
    }
  }, [profile, isOpen]);

  // Resume Upload State
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  const effectiveLocation = location === 'Others' ? (customLocation.trim() || 'Others') : location;

  // Real-time Candidate Profile preview for completion calculation
  const currentProfilePreview: CandidateProfile = useMemo(() => {
    return {
      id: profile?.id || 'temp',
      userId: user?.id || 'temp',
      phone,
      location: effectiveLocation,
      education: `${degreeName} from ${degreeCollege}`,
      experienceYears: Number(experienceYears) || 0,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      certifications: certifications.split(',').map(s => s.trim()).filter(Boolean),
      bio,
      resumeFileName,
      resumeText,
      projects: projects.split('\n').map(p => p.trim()).filter(Boolean),
      educationDetails: {
        class10School,
        class10Board,
        class10Percentage,
        class10Year,
        secondaryType,
        class12College,
        class12Stream,
        class12Percentage,
        class12Year,
        diplomaCollege,
        diplomaBranch,
        diplomaPercentage,
        diplomaYear,
        degreeName,
        degreeSpecialization,
        degreeCollege,
        degreeCgpa,
        degreeYear,
      },
    };
  }, [
    profile?.id,
    user?.id,
    phone,
    location,
    bio,
    class10School,
    class10Board,
    class10Percentage,
    class10Year,
    secondaryType,
    class12College,
    class12Stream,
    class12Percentage,
    class12Year,
    diplomaCollege,
    diplomaBranch,
    diplomaPercentage,
    diplomaYear,
    degreeName,
    degreeSpecialization,
    degreeCollege,
    degreeCgpa,
    degreeYear,
    experienceYears,
    skills,
    projects,
    certifications,
    resumeFileName,
    resumeText,
  ]);

  const completion = useMemo(() => {
    return calculateProfileCompletion(user, currentProfilePreview);
  }, [user, currentProfilePreview]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsUploadingResume(true);
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('fileName', file.name);

    try {
      const res = await fetch('/api/candidate/upload-resume', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      setIsUploadingResume(false);

      if (!res.ok) {
        setUploadErrorMsg(data.error || 'Failed to process resume');
        return;
      }

      setResumeFileName(file.name);
      if (data.rawText) {
        setResumeText(data.rawText);
      }
      setUploadSuccessMsg(`Resume "${file.name}" successfully parsed by AI!`);

      // Auto populate fields from AI analysis
      if (data.analysis) {
        if (data.analysis.skills && data.analysis.skills.length > 0) {
          const combined = Array.from(new Set([
            ...skills.split(',').map(s => s.trim()).filter(Boolean),
            ...data.analysis.skills,
          ]));
          setSkills(combined.join(', '));
        }
        if (data.analysis.experienceYears != null) {
          setExperienceYears(data.analysis.experienceYears);
        }
        if (data.analysis.education) {
          setDegreeName(data.analysis.education);
        }
        if (data.analysis.bio) {
          setBio(data.analysis.bio);
        }
      }
    } catch (err: any) {
      setIsUploadingResume(false);
      setUploadErrorMsg('Network error while uploading resume.');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveFeedback(null);

    const payload = {
      phone,
      location: effectiveLocation,
      education: `${degreeName} - ${degreeCollege}`,
      experienceYears: Number(experienceYears),
      skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      certifications: certifications.split(',').map(s => s.trim()).filter(Boolean),
      projects: projects.split('\n').map(p => p.trim()).filter(Boolean),
      bio,
      resumeFileName,
      resumeText,
      educationDetails: {
        class10School,
        class10Board,
        class10Percentage,
        class10Year,
        secondaryType,
        class12College: secondaryType === '12th' ? class12College : undefined,
        class12Stream: secondaryType === '12th' ? class12Stream : undefined,
        class12Percentage: secondaryType === '12th' ? class12Percentage : undefined,
        class12Year: secondaryType === '12th' ? class12Year : undefined,
        diplomaCollege: secondaryType === 'Diploma' ? diplomaCollege : undefined,
        diplomaBranch: secondaryType === 'Diploma' ? diplomaBranch : undefined,
        diplomaPercentage: secondaryType === 'Diploma' ? diplomaPercentage : undefined,
        diplomaYear: secondaryType === 'Diploma' ? diplomaYear : undefined,
        degreeName,
        degreeSpecialization,
        degreeCollege,
        degreeCgpa,
        degreeYear,
      },
    };

    await updateProfile(payload);
    setIsSaving(false);
    setSaveFeedback('Profile updated successfully!');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 sm:p-7 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header & Circular Progress Bar Card */}
        <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm">
                {user?.fullName?.charAt(0) || 'C'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">{user?.fullName || 'Candidate Profile'}</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Verified Candidate
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">{user?.email}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Role: Candidate Portal • Mandatory 10th, 12th/Diploma & Degree
              </p>
            </div>
          </div>

          {/* Profile Completion Circular Status Indicator */}
          <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <CircularProgressBar
              percentage={completion.percentage}
              size={68}
              strokeWidth={6}
              labelPosition="inside"
            />
            <div className="text-left">
              <span className="text-xs font-bold text-slate-900 block">Profile Completion</span>
              <span className="text-[11px] font-semibold text-blue-700 block">
                {completion.isComplete ? '100% Complete (Eligible)' : `${completion.percentage}% Filled`}
              </span>
              <span className="text-[10px] text-slate-500">
                {completion.isComplete ? 'All fields satisfied' : `${completion.missingFields.length} field(s) pending`}
              </span>
            </div>
          </div>
        </div>

        {/* Incomplete warning banner if any fields missing */}
        {!completion.isComplete && (
          <div className="mb-5 p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950 block mb-0.5">Mandatory Profile Requirements</span>
              <span className="text-[11px] text-amber-800 leading-relaxed">
                Candidates must provide Class 10th, Class 12th or Diploma, Degree details, technical skills, and resume to register for interview opportunities:
              </span>
              <ul className="list-disc list-inside mt-1 text-[11px] text-amber-900 font-medium grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                {completion.missingFields.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Resume Drag and Drop Box */}
        <div className="mb-6">
          <label className="block font-bold text-slate-800 text-xs mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Resume Document (PDF, DOCX, TXT) *</span>
            </span>
            <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Instant AI Resume Extractor
            </span>
          </label>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/60'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {isUploadingResume ? (
              <div className="flex flex-col items-center py-2">
                <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mb-2" />
                <span className="text-xs font-bold text-blue-700">AI Parsing &amp; Extracting Credentials...</span>
                <span className="text-[10px] text-slate-500">Extracting education, verified skills, and project experience</span>
              </div>
            ) : resumeFileName ? (
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-900 block truncate max-w-[280px]">
                      {resumeFileName}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resume attached for automated ATS evaluation
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-blue-600 font-bold hover:underline">Replace File</span>
              </div>
            ) : (
              <div className="flex flex-col items-center py-3">
                <Upload className="w-7 h-7 text-slate-400 mb-1" />
                <p className="text-xs font-bold text-slate-700">Click to upload or drag &amp; drop your resume</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  AI will automatically analyze your credentials for tailored interview questions &amp; ATS audit
                </p>
              </div>
            )}
          </div>

          {uploadSuccessMsg && (
            <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {uploadSuccessMsg}
            </p>
          )}
          {uploadErrorMsg && (
            <p className="text-[11px] text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {uploadErrorMsg}
            </p>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-5 text-xs">
          {/* SECTION 1: Personal & Contact */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>1. Contact &amp; Personal Info</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Location *</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 z-10" />
                  <select
                    required
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white text-xs font-semibold text-slate-800"
                  >
                    <option value="">Select Location</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Chennai">Chennai</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Mysore">Mysore</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Pune">Pune</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                {location === 'Others' && (
                  <input
                    type="text"
                    required
                    value={customLocation}
                    onChange={e => setCustomLocation(e.target.value)}
                    placeholder="Enter your location (City, State)"
                    className="w-full mt-2 px-3 py-1.5 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white text-xs"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Professional Bio / Summary</label>
              <textarea
                rows={2}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Brief professional profile, technical interests, and career objective"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          {/* SECTION 2: Class 10th Education */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>2. Class 10th / SSC Details *</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">School / Institution Name *</label>
                <input
                  type="text"
                  required
                  value={class10School}
                  onChange={e => setClass10School(e.target.value)}
                  placeholder="e.g. St. Xavier's High School"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Board of Examination *</label>
                <input
                  type="text"
                  required
                  value={class10Board}
                  onChange={e => setClass10Board(e.target.value)}
                  placeholder="e.g. CBSE / ICSE / State Board"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Year of Passing *</label>
                <input
                  type="text"
                  required
                  value={class10Year}
                  onChange={e => setClass10Year(e.target.value)}
                  placeholder="e.g. 2019"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Percentage / CGPA *</label>
                <input
                  type="text"
                  required
                  value={class10Percentage}
                  onChange={e => setClass10Percentage(e.target.value)}
                  placeholder="e.g. 92.4% or 9.4 CGPA"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Class 12th OR Diploma */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>3. Secondary Higher Education (12th or Diploma) *</span>
              </h3>

              {/* Segmented Toggle for 12th vs Diploma */}
              <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setSecondaryType('12th')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                    secondaryType === '12th'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Class 12th / Intermediate
                </button>
                <button
                  type="button"
                  onClick={() => setSecondaryType('Diploma')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                    secondaryType === 'Diploma'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Polytechnic Diploma
                </button>
              </div>
            </div>

            {secondaryType === '12th' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Junior College / School Name *</label>
                    <input
                      type="text"
                      required={secondaryType === '12th'}
                      value={class12College}
                      onChange={e => setClass12College(e.target.value)}
                      placeholder="e.g. Narayana Junior College / DPS"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Stream / Group *</label>
                    <input
                      type="text"
                      required={secondaryType === '12th'}
                      value={class12Stream}
                      onChange={e => setClass12Stream(e.target.value)}
                      placeholder="e.g. Science (MPC / PCM), Commerce, Arts"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Passing Year *</label>
                    <input
                      type="text"
                      required={secondaryType === '12th'}
                      value={class12Year}
                      onChange={e => setClass12Year(e.target.value)}
                      placeholder="e.g. 2021"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Percentage / Score *</label>
                    <input
                      type="text"
                      required={secondaryType === '12th'}
                      value={class12Percentage}
                      onChange={e => setClass12Percentage(e.target.value)}
                      placeholder="e.g. 89.5%"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Diploma Polytechnic Institute *</label>
                    <input
                      type="text"
                      required={secondaryType === 'Diploma'}
                      value={diplomaCollege}
                      onChange={e => setDiplomaCollege(e.target.value)}
                      placeholder="e.g. Government Polytechnic College"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Diploma Branch / Discipline *</label>
                    <input
                      type="text"
                      required={secondaryType === 'Diploma'}
                      value={diplomaBranch}
                      onChange={e => setDiplomaBranch(e.target.value)}
                      placeholder="e.g. Computer Engineering / Mechanical"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Passing Year *</label>
                    <input
                      type="text"
                      required={secondaryType === 'Diploma'}
                      value={diplomaYear}
                      onChange={e => setDiplomaYear(e.target.value)}
                      placeholder="e.g. 2021"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Aggregate Marks / % *</label>
                    <input
                      type="text"
                      required={secondaryType === 'Diploma'}
                      value={diplomaPercentage}
                      onChange={e => setDiplomaPercentage(e.target.value)}
                      placeholder="e.g. 84.6%"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* SECTION 4: Degree / Graduation */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              <span>4. Graduation / Degree Details *</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Degree Title *</label>
                <input
                  type="text"
                  required
                  value={degreeName}
                  onChange={e => setDegreeName(e.target.value)}
                  placeholder="e.g. B.Tech / B.E. / B.Sc / BCA / M.Tech"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specialization / Major *</label>
                <input
                  type="text"
                  required
                  value={degreeSpecialization}
                  onChange={e => setDegreeSpecialization(e.target.value)}
                  placeholder="e.g. Computer Science / Information Tech"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block font-semibold text-slate-700 mb-1">College / University *</label>
                <input
                  type="text"
                  required
                  value={degreeCollege}
                  onChange={e => setDegreeCollege(e.target.value)}
                  placeholder="e.g. National Institute of Tech"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Passing Year *</label>
                <input
                  type="text"
                  required
                  value={degreeYear}
                  onChange={e => setDegreeYear(e.target.value)}
                  placeholder="e.g. 2025"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">CGPA / Percentage *</label>
                <input
                  type="text"
                  required
                  value={degreeCgpa}
                  onChange={e => setDegreeCgpa(e.target.value)}
                  placeholder="e.g. 8.75 CGPA or 85%"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Skills & Key Projects */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              <span>5. Skills, Experience &amp; Projects</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Core Technical Skills (comma separated) *</label>
                <input
                  type="text"
                  required
                  value={skills}
                  onChange={e => setSkills(e.target.value)}
                  placeholder="Java, Spring Boot, React, Docker, Kubernetes, SQL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Years of Experience</label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={experienceYears}
                  onChange={e => setExperienceYears(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Key Technical Projects (One per line)</label>
              <textarea
                rows={2}
                value={projects}
                onChange={e => setProjects(e.target.value)}
                placeholder="High-Performance Microservices Architecture (Spring Cloud, Kafka, PostgreSQL)&#10;Real-Time Distributed Chat Application (WebSockets, Redis)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Certifications (comma separated)</label>
              <input
                type="text"
                value={certifications}
                onChange={e => setCertifications(e.target.value)}
                placeholder="AWS Certified Solutions Architect, Oracle Java SE, CKA"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          {saveFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{saveFeedback}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600">
                Readiness Score: <strong className="text-blue-700">{completion.percentage}%</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save & Update Profile'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
