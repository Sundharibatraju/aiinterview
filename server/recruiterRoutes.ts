import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { emailService } from './email.js';
import { geminiService } from './gemini.js';
import { neonService } from './db/neonService.js';
import {
  UserRole,
  ApplicationStatus,
  InterviewStatus,
  JobStatus,
  WorkMode,
  EmploymentType,
  QuestionDifficulty,
  Job,
  RecruiterProfile,
  Company,
  TechnicalAssessment,
  AssessmentSubmission,
  HRInterviewSchedule,
  JobOffer,
  RecruiterNotification,
  RecruiterActivityLog,
  IntegrityViolationRecord,
  PipelineHistoryItem,
  RoundType,
  RoundStatus,
} from '../src/types/index.js';

export const recruiterRouter = Router();

// Middleware: ensure recruiter or admin role
export const requireRecruiter = (req: any, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: 'Recruiter access required' });
  }
  next();
};

recruiterRouter.use(requireRecruiter);

// Helper to get recruiter's jobs or jobs belonging to recruiter's company
function getRecruiterJobs(req: any): Job[] {
  const allJobs = db.getJobs();
  if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.RECRUITER) return allJobs;

  const recruiterProfile = db.getRecruiterProfile(req.user.id);
  const companyId = recruiterProfile?.companyId;

  const filtered = allJobs.filter(j => j.recruiterId === req.user.id || (companyId && j.companyId === companyId));
  return filtered.length > 0 ? filtered : allJobs;
}

// Helper to check if job is owned by recruiter
function isJobOwnedByRecruiter(jobId: string, req: any): boolean {
  if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.RECRUITER) return true;
  const job = db.getJobById(jobId);
  if (!job) return false;

  if (job.recruiterId === req.user.id) return true;
  const recruiterProfile = db.getRecruiterProfile(req.user.id);
  if (recruiterProfile?.companyId && job.companyId === recruiterProfile.companyId) return true;

  return false;
}

// -------------------------------------------------------------
// 1. RECRUITER PROFILE & COMPANY MANAGEMENT
// -------------------------------------------------------------

// GET /api/recruiter/profile
recruiterRouter.get('/profile', (req: any, res: Response) => {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let profile = db.getRecruiterProfile(req.user.id);
    let company: Company | undefined;

    if (profile?.companyId) {
      company = db.getCompanyById(profile.companyId);
    }

    if (!profile) {
      // Create initial profile if missing
      profile = {
        id: 'rec_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        userId: user.id,
        companyId: company?.id || 'comp_' + Math.random().toString(36).substring(2, 9),
        designation: 'Senior Technical Recruiter',
        department: 'Human Resources & Talent Acquisition',
        fullName: user.name,
        email: user.email,
        emailNotifications: true,
        interviewNotifications: true,
        applicationNotifications: true,
        assessmentNotifications: true,
        offerNotifications: true,
      };
      db.setRecruiterProfile(profile);
    }

    // Calculate dynamic profile completion percentage
    const completionFields = [
      user.name,
      user.email,
      profile.phone,
      profile.designation,
      profile.department,
      profile.city,
      profile.state,
      profile.country,
      profile.linkedIn,
      profile.summary,
      profile.recruitmentExperienceYears,
      profile.hiringSpecialties && profile.hiringSpecialties.length > 0,
      company?.name,
      company?.industry,
      company?.description,
      company?.website,
    ];
    const filledCount = completionFields.filter(Boolean).length;
    const completionPercentage = Math.round((filledCount / completionFields.length) * 100);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      profile,
      company,
      completionPercentage,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/recruiter/profile
recruiterRouter.patch('/profile', (req: any, res: Response) => {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = req.body;
    // Security check: Never allow role modification
    delete updates.role;
    delete updates.id;
    delete updates.userId;

    if (updates.name && updates.name.trim()) {
      user.name = updates.name.trim();
      db.saveDatabase();
    }

    let profile = db.getRecruiterProfile(req.user.id);
    if (!profile) {
      profile = {
        id: 'rec_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        userId: user.id,
        companyId: updates.companyId || 'comp_' + Math.random().toString(36).substring(2, 9),
        designation: updates.designation || 'Technical Recruiter',
      };
    }

    const updatedProfile: RecruiterProfile = {
      ...profile,
      ...updates,
      userId: user.id,
      email: user.email,
    };

    db.setRecruiterProfile(updatedProfile);

    // Activity log
    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'PROFILE_UPDATED',
      details: 'Updated recruiter personal and recruitment preferences',
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/recruiter/company
recruiterRouter.get('/company', (req: any, res: Response) => {
  try {
    const profile = db.getRecruiterProfile(req.user.id);
    let company: Company | undefined;
    if (profile?.companyId) {
      company = db.getCompanyById(profile.companyId);
    }
    if (!company) {
      // Find or create company
      const companies = db.getCompanies();
      company = companies[0];
    }
    return res.json(company || null);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// PATCH /api/recruiter/company
recruiterRouter.patch('/company', (req: any, res: Response) => {
  try {
    const profile = db.getRecruiterProfile(req.user.id);
    let companyId = profile?.companyId;

    if (!companyId) {
      companyId = 'comp_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const newCompany: Company = {
        id: companyId,
        name: req.body.name || 'Company Name',
        description: req.body.description || '',
        industry: req.body.industry || 'Technology',
        location: req.body.location || 'Remote',
        website: req.body.website,
        logoUrl: req.body.logoUrl,
        companySize: req.body.companySize,
        headquarters: req.body.headquarters,
        companyType: req.body.companyType,
        foundedYear: req.body.foundedYear,
      };
      db.createCompany(newCompany);
      if (profile) {
        db.setRecruiterProfile({ ...profile, companyId });
      }
      return res.json({ success: true, company: newCompany });
    }

    const updated = db.updateCompany(companyId, req.body);
    return res.json({ success: true, company: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update company' });
  }
});

// POST /api/recruiter/change-password
recruiterRouter.post('/change-password', async (req: any, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    db.saveDatabase();

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'PASSWORD_CHANGED',
      details: 'Recruiter updated their account password',
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// -------------------------------------------------------------
// 2. METRICS & ANALYTICS
// -------------------------------------------------------------

// GET /api/recruiter/metrics
recruiterRouter.get('/metrics', (req: any, res: Response) => {
  try {
    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const allRegistrations = db.getRegistrations();
    const myRegistrations = allRegistrations.filter(r => jobIds.has(r.jobId));

    const activeJobs = jobs.filter(j => j.status === JobStatus.ACTIVE || j.status === JobStatus.PUBLISHED).length;
    const totalApplications = myRegistrations.length;
    const shortlisted = myRegistrations.filter(r => r.status === ApplicationStatus.SHORTLISTED || r.selectedForStage).length;
    const rejected = myRegistrations.filter(r => r.status === ApplicationStatus.REJECTED || r.overallPipelineStatus === 'REJECTED').length;

    // Pipeline counts
    const inPipeline = myRegistrations.filter(r => r.status !== ApplicationStatus.REJECTED && r.overallPipelineStatus !== 'REJECTED').length;
    const stage1Count = myRegistrations.filter(r => (!r.currentRoundNumber || r.currentRoundNumber === 1)).length;
    const stage2Count = myRegistrations.filter(r => r.currentRoundNumber === 2).length;
    const stage3Count = myRegistrations.filter(r => r.currentRoundNumber === 3).length;
    const stage4Count = myRegistrations.filter(r => r.currentRoundNumber === 4).length;
    const stage5Count = myRegistrations.filter(r => r.currentRoundNumber === 5).length;

    // Assessment & Interview metrics
    const assessmentsPending = myRegistrations.filter(r => r.currentRoundNumber === 2 && !r.scores?.technicalScore).length;
    const upcomingInterviews = myRegistrations.filter(r => r.currentRoundNumber === 4 || r.interviewStatus === InterviewStatus.SCHEDULED).length;
    const completedInterviews = myRegistrations.filter(r => r.interviewStatus === InterviewStatus.COMPLETED || (r.scores?.aiInterviewScore && r.scores.aiInterviewScore > 0)).length;
    const offersCount = db.getOffers().filter(o => jobIds.has(o.jobId)).length;
    const malpracticeFlagged = myRegistrations.filter(r => r.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED).length;

    return res.json({
      activeJobs,
      totalApplications,
      candidatesInPipeline: inPipeline,
      stage1Count,
      stage2Count,
      stage3Count,
      stage4Count,
      stage5Count,
      shortlisted,
      rejected,
      assessmentsPending,
      upcomingInterviews,
      completedInterviews,
      offersCount,
      malpracticeFlagged,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to calculate metrics' });
  }
});

// GET /api/recruiter/analytics
recruiterRouter.get('/analytics', (req: any, res: Response) => {
  try {
    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const allRegistrations = db.getRegistrations();
    const myRegistrations = allRegistrations.filter(r => jobIds.has(r.jobId));

    const total = myRegistrations.length;
    const selected = myRegistrations.filter(r => r.selectedForStage).length;
    const rejected = myRegistrations.filter(r => r.status === ApplicationStatus.REJECTED || r.overallPipelineStatus === 'REJECTED').length;

    // Applications per job breakdown
    const jobBreakdown = jobs.map(j => {
      const apps = myRegistrations.filter(r => r.jobId === j.id);
      return {
        jobId: j.id,
        title: j.title,
        status: j.status,
        openings: j.openings || 1,
        applicationsCount: apps.length,
        selectedCount: apps.filter(r => r.selectedForStage).length,
        rejectedCount: apps.filter(r => r.status === ApplicationStatus.REJECTED).length,
      };
    });

    // Stage conversion funnel (4-stage streamlined pipeline without HR round)
    const stageFunnel = [
      { stage: 1, name: 'Resume Screening', count: myRegistrations.filter(r => !r.currentRoundNumber || r.currentRoundNumber === 1).length },
      { stage: 2, name: 'Technical Assessment', count: myRegistrations.filter(r => r.currentRoundNumber === 2).length },
      { stage: 3, name: 'AI Interview', count: myRegistrations.filter(r => r.currentRoundNumber === 3).length },
      { stage: 4, name: 'Final Review & Offer', count: myRegistrations.filter(r => r.currentRoundNumber === 4).length },
    ];

    // Scores summary
    const scoredCandidates = myRegistrations.filter(r => r.scores?.overallScore || r.atsScore);
    const avgScore = scoredCandidates.length > 0
      ? Math.round(scoredCandidates.reduce((sum, r) => sum + (r.scores?.overallScore || r.atsScore || 0), 0) / scoredCandidates.length)
      : 0;

    return res.json({
      totalApplications: total,
      selectionRate: total > 0 ? Math.round((selected / total) * 100) : 0,
      rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0,
      averageCandidateScore: avgScore,
      jobBreakdown,
      stageFunnel,
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === JobStatus.ACTIVE || j.status === JobStatus.PUBLISHED).length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// -------------------------------------------------------------
// 3. JOB POSTING & MANAGEMENT
// -------------------------------------------------------------

// GET /api/recruiter/jobs
recruiterRouter.get('/jobs', (req: any, res: Response) => {
  try {
    const jobs = getRecruiterJobs(req);
    const allRegistrations = db.data.interviewRegistrations || [];

    const enrichedJobs = jobs.map(job => {
      const apps = allRegistrations.filter(r => r.jobId === job.id);
      const activeApps = apps.filter(r => r.status !== ApplicationStatus.REJECTED && r.overallPipelineStatus !== 'REJECTED');
      const selected = apps.filter(r => r.selectedForStage);
      const completedInterviews = apps.filter(r => r.interviewStatus === InterviewStatus.COMPLETED);

      return {
        ...job,
        applicationsCount: apps.length,
        activeApplicationsCount: activeApps.length,
        selectedCount: selected.length,
        completedInterviewsCount: completedInterviews.length,
      };
    });

    return res.json(enrichedJobs);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

// POST /api/recruiter/jobs
recruiterRouter.post('/jobs', (req: any, res: Response) => {
  try {
    const {
      title,
      jobCode,
      department,
      description,
      responsibilities,
      openings,
      requiredSkills,
      preferredSkills,
      qualification,
      experience,
      experienceRequirements,
      educationRequirements,
      location,
      country,
      state,
      city,
      workMode,
      employmentType,
      experienceLevel,
      minPackage,
      maxPackage,
      currency,
      payFrequency,
      deadline,
      candidateLimit,
      atsThreshold,
      requiresAssessment,
      requiresAiInterview,
      requiresHrInterview,
      requiresFinalReview,
      durationMinutes,
      numQuestions,
      numTechnicalQuestions,
      numCodingQuestions,
      numMcqQuestions,
      interviewConfig,
      status,
      additionalInformation,
    } = req.body;

    if (!title || !description || !location) {
      return res.status(400).json({ error: 'Title, description, and location are required' });
    }

    const profile = db.getRecruiterProfile(req.user.id);
    let companyId = profile?.companyId;
    if (!companyId) {
      const comp = db.getCompanies()[0];
      companyId = comp?.id || 'comp_default';
    }

    const newJob: Job = {
      id: 'job_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      companyId,
      recruiterId: req.user.id,
      title: title.trim(),
      jobCode: jobCode?.trim() || `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
      department: department?.trim() || 'Engineering',
      description: description.trim(),
      responsibilities: responsibilities || '',
      openings: openings ? Number(openings) : 1,
      salaryPackage: `${minPackage || 10} - ${maxPackage || 25} ${currency || 'LPA'}`,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
      qualification: qualification || 'Bachelor of Engineering / Technology',
      experience: experience || '1-3 years',
      experienceRequirements: experienceRequirements || '',
      educationRequirements: educationRequirements || '',
      location: location || 'Remote',
      country: country || 'India',
      state: state || '',
      city: city || location,
      workMode: workMode || WorkMode.REMOTE,
      employmentType: employmentType || EmploymentType.FULL_TIME,
      experienceLevel: experienceLevel || 'Mid-Level',
      minPackage: Number(minPackage) || 10,
      maxPackage: Number(maxPackage) || 25,
      currency: currency || 'INR',
      payFrequency: payFrequency || 'Per Annum',
      deadline: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      candidateLimit: candidateLimit ? Number(candidateLimit) : 500,
      atsThreshold: atsThreshold ? Number(atsThreshold) : 60,
      requiresAssessment: requiresAssessment !== undefined ? Boolean(requiresAssessment) : true,
      requiresAiInterview: requiresAiInterview !== undefined ? Boolean(requiresAiInterview) : true,
      requiresHrInterview: requiresHrInterview !== undefined ? Boolean(requiresHrInterview) : true,
      requiresFinalReview: requiresFinalReview !== undefined ? Boolean(requiresFinalReview) : true,
      durationMinutes: durationMinutes ? Number(durationMinutes) : 45,
      numQuestions: numQuestions ? Number(numQuestions) : 5,
      numTechnicalQuestions: numTechnicalQuestions ? Number(numTechnicalQuestions) : undefined,
      numCodingQuestions: numCodingQuestions ? Number(numCodingQuestions) : undefined,
      numMcqQuestions: numMcqQuestions ? Number(numMcqQuestions) : undefined,
      interviewConfig: interviewConfig || undefined,
      status: status || JobStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      additionalInformation: additionalInformation || '',
      rounds: [
        { roundNumber: 1, name: 'Resume Screening', roundType: RoundType.RESUME_SCREENING, description: 'Resume screening and ATS matching', evaluationCriteria: ['Keywords', 'Experience'], minQualifyingScore: atsThreshold ? Number(atsThreshold) : 60, instructions: 'Automated resume screening' },
        { roundNumber: 2, name: 'Technical Assessment', roundType: RoundType.TECHNICAL_ASSESSMENT, description: 'Domain & coding test', evaluationCriteria: ['Correctness', 'Speed'], minQualifyingScore: 70, instructions: 'Complete online assessment' },
        { roundNumber: 3, name: 'AI Interview', roundType: RoundType.AI_INTERVIEW, description: 'Adaptive conversational technical interview', evaluationCriteria: ['Technical mastery', 'Problem solving'], minQualifyingScore: 70, instructions: 'Camera and mic required' },
        { roundNumber: 4, name: 'Final Review & Offer', roundType: RoundType.FINAL_REVIEW, description: 'Executive decision and formal offer', evaluationCriteria: ['Leadership review'], minQualifyingScore: 80, instructions: 'Final review by hiring manager' },
      ],
    };

    db.createJob(newJob);

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'JOB_CREATED',
      jobId: newJob.id,
      jobTitle: newJob.title,
      details: `Created job opening "${newJob.title}" with code ${newJob.jobCode}`,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, job: newJob });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create job' });
  }
});

// GET /api/recruiter/jobs/:id
recruiterRouter.get('/jobs/:id', (req: any, res: Response) => {
  try {
    const job = db.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isJobOwnedByRecruiter(job.id, req)) {
      return res.status(403).json({ error: 'Access denied to this job posting' });
    }

    const allRegistrations = db.getRegistrations().filter(r => r.jobId === job.id);
    return res.json({
      ...job,
      applicationsCount: allRegistrations.length,
      selectedCount: allRegistrations.filter(r => r.selectedForStage).length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

// Handler for updating a recruiter job (PUT or PATCH)
const handleRecruiterJobUpdate = async (req: any, res: Response) => {
  try {
    const job = db.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isJobOwnedByRecruiter(job.id, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = { ...req.body };
    delete updates.id;
    delete updates.companyId;
    delete updates.recruiterId;

    const updated = await db.updateJobAsync(job.id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'JOB_UPDATED',
      jobId: job.id,
      jobTitle: job.title,
      details: `Updated job posting details for "${job.title}"`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, job: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update job' });
  }
};

// PATCH & PUT /api/recruiter/jobs/:id
recruiterRouter.patch('/jobs/:id', handleRecruiterJobUpdate);
recruiterRouter.put('/jobs/:id', handleRecruiterJobUpdate);

// POST /api/recruiter/jobs/:id/status
recruiterRouter.post('/jobs/:id/status', async (req: any, res: Response) => {
  try {
    const job = db.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isJobOwnedByRecruiter(job.id, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status } = req.body;
    if (!status || !Object.values(JobStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid job status' });
    }

    const updated = await db.updateJobAsync(job.id, {
      status,
      updatedAt: new Date().toISOString(),
    });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'JOB_STATUS_CHANGED',
      jobId: job.id,
      jobTitle: job.title,
      details: `Changed job "${job.title}" status to ${status}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, job: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to change job status' });
  }
});

// POST /api/recruiter/jobs/:id/duplicate
recruiterRouter.post('/jobs/:id/duplicate', (req: any, res: Response) => {
  try {
    const original = db.getJobById(req.params.id);
    if (!original) return res.status(404).json({ error: 'Job not found' });
    if (!isJobOwnedByRecruiter(original.id, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const cloned: Job = {
      ...original,
      id: 'job_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      title: `${original.title} (Copy)`,
      jobCode: `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
      status: JobStatus.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createJob(cloned);

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'JOB_DUPLICATED',
      jobId: cloned.id,
      jobTitle: cloned.title,
      details: `Duplicated job "${original.title}" to new draft "${cloned.title}"`,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, job: cloned });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to duplicate job' });
  }
});

// DELETE /api/recruiter/jobs/:id
recruiterRouter.delete('/jobs/:id', async (req: any, res: Response) => {
  try {
    const job = db.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!isJobOwnedByRecruiter(job.id, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = await db.deleteJob(job.id);
    if (!deleted) return res.status(500).json({ error: 'Failed to delete job' });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'JOB_DELETED',
      jobId: job.id,
      jobTitle: job.title,
      details: `Deleted job posting "${job.title}"`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, message: 'Job deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete job' });
  }
});

// -------------------------------------------------------------
// 4. PIPELINE MANAGEMENT & STAGES
// -------------------------------------------------------------

// Helper to enrich registration with candidate details and calculated scores
function enrichRegistration(reg: any) {
  const candidateUser = db.findUserById(reg.candidateId);
  const candidateProfile = db.getCandidateProfile(reg.candidateId);
  const job = db.getJobById(reg.jobId);
  const report = db.getRecruiterReport(reg.id) || db.getCandidateReport(reg.id);
  const submissions = db.getAssessmentSubmissions();
  const submission = submissions.find(
    s => s.registrationId === reg.id || (s.candidateId === reg.candidateId && s.jobId === reg.jobId)
  );
  const rawQuestions = db.getQuestionsForInterview(reg.id) || [];
  const rawTranscripts = db.getTranscriptsForInterview(reg.id) || [];

  const jobCutoff = job?.rounds?.[0]?.minQualifyingScore || (job as any)?.minQualifyingScore || 65;

  // Round 1 ATS details directly from DB
  const round1Score = reg.roundProgression?.find((r: any) => r.roundNumber === 1 || r.roundType === 'RESUME_SCREENING')?.score;
  const atsScore = reg.atsScore ?? reg.scores?.atsScore ?? round1Score ?? null;
  const isQualifiedRound1 = Boolean(
    reg.clearedResumeScreening === true ||
    (atsScore != null && Number(atsScore) >= jobCutoff) ||
    reg.roundProgression?.find((r: any) => r.roundNumber === 1 || r.roundType === 'RESUME_SCREENING')?.status === 'QUALIFIED' ||
    (reg.currentRoundNumber || 1) >= 2
  );

  // Round 2 Technical assessment scores directly from DB submission
  const aptitudeScore = (submission as any)?.aptitudeScore ?? reg.scores?.aptitudeScore ?? reg.aptitudeScore ?? null;
  const codingScore = (submission as any)?.codingScore ?? reg.scores?.codingScore ?? reg.codingScore ?? null;
  const r2Score = reg.roundProgression?.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')?.score;
  const technicalTotalScore = submission?.percentage ?? submission?.score ?? reg.technicalAssessmentScore ?? reg.scores?.technicalScore ?? r2Score ?? null;

  // Round 3 AI Interview score directly from DB report
  const r3Score = reg.roundProgression?.find((r: any) => r.roundNumber === 3 || r.roundType === 'AI_TECHNICAL_INTERVIEW')?.score;
  const aiInterviewScore = (report as any)?.overallScore ?? reg.scores?.aiInterviewScore ?? r3Score ?? null;

  const hasAttendedInterview = Boolean(
    reg.interviewStatus === InterviewStatus.COMPLETED ||
    reg.interviewStatus === 'COMPLETED' ||
    reg.interviewStatus === InterviewStatus.IN_PROGRESS ||
    reg.interviewStatus === 'IN_PROGRESS' ||
    reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED ||
    reg.interviewStatus === 'MALPRACTICE_TERMINATED' ||
    report != null ||
    (rawQuestions.length > 0 && rawQuestions.some((q: any) => q.candidateAnswer && q.candidateAnswer.trim().length > 0)) ||
    reg.roundProgression?.find((r: any) => r.roundNumber === 3 || r.roundType === 'AI_TECHNICAL_INTERVIEW')?.status === 'QUALIFIED' ||
    (aiInterviewScore != null && Number(aiInterviewScore) > 0)
  );

  // Pure DB scores
  const scores = {
    atsScore,
    skillsMatch: reg.scores?.skillsMatch ?? reg.skillsMatch ?? reg.atsDetails?.scoreBreakdown?.keywordSkillMatchScore ?? null,
    experienceMatch: reg.scores?.experienceMatch ?? reg.experienceMatch ?? reg.atsDetails?.scoreBreakdown?.experienceRelevanceScore ?? null,
    aptitudeScore,
    codingScore,
    technicalScore: technicalTotalScore,
    assessmentPercentage: technicalTotalScore,
    aiInterviewScore,
    communicationScore: (report as any)?.communicationScore ?? reg.scores?.communicationScore ?? null,
    problemSolvingScore: (report as any)?.technicalScore ?? reg.scores?.problemSolvingScore ?? null,
    overallScore: reg.scores?.overallScore ?? null,
  };

  if (scores.overallScore == null) {
    const validScores = [scores.atsScore, scores.technicalScore, scores.aiInterviewScore].filter(
      s => typeof s === 'number' && !isNaN(s)
    );
    scores.overallScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null;
  }

  const currentRound = reg.currentRoundNumber || 1;

  // Structure questions asked in AI interview strictly from DB
  const aiInterviewQuestions = ((report as any)?.questionsAsked && (report as any).questionsAsked.length > 0)
    ? (report as any).questionsAsked.map((q: any, idx: number) => ({
        index: idx + 1,
        question: q.question,
        candidateAnswer: q.candidateAnswer || '',
        technicalCorrectness: q.technicalCorrectness != null ? (typeof q.technicalCorrectness === 'number' ? `${q.technicalCorrectness}%` : q.technicalCorrectness) : null,
        conceptCoverage: q.conceptCoverage != null ? (typeof q.conceptCoverage === 'number' ? `${q.conceptCoverage}%` : q.conceptCoverage) : null,
        feedback: q.feedback || '',
        type: q.type || 'TECHNICAL',
      }))
    : rawQuestions.map((q: any, idx: number) => {
        let candAns = q.candidateAnswer || '';
        if (!candAns && rawTranscripts.length > 0) {
          const candidateSpoken = rawTranscripts.filter(t => t.speaker?.toLowerCase().includes('candidate') || t.speaker?.toLowerCase().includes('user'));
          if (candidateSpoken[idx]) {
            candAns = candidateSpoken[idx].message;
          }
        }
        return {
          index: idx + 1,
          question: q.questionText,
          candidateAnswer: candAns,
          technicalCorrectness: q.technicalCorrectness != null ? `${q.technicalCorrectness}%` : null,
          conceptCoverage: q.conceptCoverage != null ? `${q.conceptCoverage}%` : null,
          feedback: q.feedback || '',
          type: q.questionType || 'TECHNICAL',
        };
      });

  return {
    ...reg,
    currentRoundNumber: currentRound,
    clearedResumeScreening: isQualifiedRound1,
    hasAttendedInterview,
    atsCutoff: jobCutoff,
    selectedForStage: Boolean(reg.selectedForStage),
    candidate: candidateUser
      ? {
          id: candidateUser.id,
          name: candidateUser.name || (candidateUser as any).fullName || 'Candidate',
          email: candidateUser.email,
          role: candidateUser.role,
        }
      : undefined,
    candidateProfile,
    job: job
      ? {
          id: job.id,
          title: job.title,
          jobCode: job.jobCode,
          location: job.location,
          salaryPackage: job.salaryPackage,
          description: job.description,
          company: job.company,
        }
      : undefined,
    scores,
    assessmentSubmission: submission ? {
      ...submission,
      aptitudeScore,
      codingScore,
      totalScore: technicalTotalScore,
    } : undefined,
    aiInterviewQuestions,
    aiInterviewReport: report,
    report,
  };
}

// GET /api/recruiter/pipeline
recruiterRouter.get('/pipeline', async (req: any, res: Response) => {
  try {
    await neonService.syncAssessmentSubmissions().catch(() => {});

    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const allRegistrations = db.getRegistrations();
    const jobIdFilter = req.query.jobId as string;

    const myRegistrations = allRegistrations
      .filter(r => jobIds.has(r.jobId))
      .filter(r => (!jobIdFilter || r.jobId === jobIdFilter))
      .map(enrichRegistration);

    const stages = [
      {
        stageNumber: 1,
        name: 'Resume Screening',
        description: 'Initial resume parsing and automated ATS qualifications.',
        totalCandidates: myRegistrations.filter(r => r.currentRoundNumber === 1 && r.status !== ApplicationStatus.REJECTED).length,
        selectedCount: myRegistrations.filter(r => r.currentRoundNumber === 1 && r.selectedForStage && r.status !== ApplicationStatus.REJECTED).length,
        pendingCount: myRegistrations.filter(r => r.currentRoundNumber === 1 && !r.selectedForStage && r.status !== ApplicationStatus.REJECTED).length,
        rejectedCount: myRegistrations.filter(r => r.currentRoundNumber === 1 && r.status === ApplicationStatus.REJECTED).length,
      },
      {
        stageNumber: 2,
        name: 'Technical Assessment',
        description: 'Core programming, domain skills, and coding assessment.',
        totalCandidates: myRegistrations.filter(r => r.currentRoundNumber === 2 && r.status !== ApplicationStatus.REJECTED).length,
        selectedCount: myRegistrations.filter(r => r.currentRoundNumber === 2 && r.selectedForStage && r.status !== ApplicationStatus.REJECTED).length,
        pendingCount: myRegistrations.filter(r => r.currentRoundNumber === 2 && !r.selectedForStage && r.status !== ApplicationStatus.REJECTED).length,
        rejectedCount: myRegistrations.filter(r => r.currentRoundNumber === 2 && r.status === ApplicationStatus.REJECTED).length,
      },
      {
        stageNumber: 3,
        name: 'AI Interview',
        description: 'Comprehensive adaptive AI vocal interview with real-time proctoring.',
        totalCandidates: myRegistrations.filter(r => r.currentRoundNumber === 3 && r.status !== ApplicationStatus.REJECTED).length,
        selectedCount: myRegistrations.filter(r => r.currentRoundNumber === 3 && r.selectedForStage && r.status !== ApplicationStatus.REJECTED).length,
        pendingCount: myRegistrations.filter(r => r.currentRoundNumber === 3 && !r.selectedForStage && r.status !== ApplicationStatus.REJECTED).length,
        rejectedCount: myRegistrations.filter(r => r.currentRoundNumber === 3 && r.status === ApplicationStatus.REJECTED).length,
      },
      {
        stageNumber: 4,
        name: 'Final Review & Offer',
        description: 'Leadership final review, compensation negotiations, and formal offer dispatch.',
        totalCandidates: myRegistrations.filter(r => r.currentRoundNumber === 4 && r.status !== ApplicationStatus.REJECTED).length,
        selectedCount: myRegistrations.filter(r => r.currentRoundNumber === 4 && r.selectedForStage && r.status !== ApplicationStatus.REJECTED).length,
        pendingCount: myRegistrations.filter(r => r.currentRoundNumber === 4 && !r.selectedForStage && r.status !== ApplicationStatus.REJECTED).length,
        rejectedCount: myRegistrations.filter(r => r.currentRoundNumber === 4 && r.status === ApplicationStatus.REJECTED).length,
      },
    ];

    return res.json({
      totalCandidates: myRegistrations.length,
      stages,
      jobs: jobs.map(j => ({ id: j.id, title: j.title })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// GET /api/recruiter/pipeline/stage/:stageNumber
recruiterRouter.get('/pipeline/stage/:stageNumber', (req: any, res: Response) => {
  try {
    const stageNum = parseInt(req.params.stageNumber, 10);
    if (isNaN(stageNum) || stageNum < 1 || stageNum > 5) {
      return res.status(400).json({ error: 'Invalid stage number (1-5)' });
    }

    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const allRegistrations = db.getRegistrations();
    const jobIdFilter = req.query.jobId as string;
    const search = ((req.query.search as string) || '').toLowerCase().trim();

    let candidatesInStage = allRegistrations
      .filter(r => jobIds.has(r.jobId))
      .filter(r => (!jobIdFilter || r.jobId === jobIdFilter))
      .filter(r => (r.currentRoundNumber || 1) === stageNum)
      .filter(r => r.status !== ApplicationStatus.REJECTED)
      .map(enrichRegistration);

    if (search) {
      candidatesInStage = candidatesInStage.filter(c => {
        const name = (c.candidate?.name || '').toLowerCase();
        const email = (c.candidate?.email || '').toLowerCase();
        const code = (c.interviewCode || '').toLowerCase();
        const skills = (c.candidateProfile?.skills || []).join(' ').toLowerCase();
        return name.includes(search) || email.includes(search) || code.includes(search) || skills.includes(search);
      });
    }

    const selectedCandidates = candidatesInStage.filter(c => c.selectedForStage);
    const notSelectedCandidates = candidatesInStage.filter(c => !c.selectedForStage);

    return res.json({
      stageNumber: stageNum,
      totalCount: candidatesInStage.length,
      selectedCandidates,
      notSelectedCandidates,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch stage candidates' });
  }
});

// POST /api/recruiter/applications/:id/select
recruiterRouter.post('/applications/:id/select', (req: any, res: Response) => {
  try {
    const regId = req.params.id;
    const reg = db.getRegistrationById(regId);
    if (!reg) return res.status(404).json({ error: 'Application not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied to this candidate application' });
    }

    const currentStage = reg.currentRoundNumber || 1;
    const candidate = db.findUserById(reg.candidateId);
    const job = db.getJobById(reg.jobId);
    const recruiterUser = db.findUserById(req.user.id);

    // Update registration
    reg.selectedForStage = true;
    reg.selectedAt = new Date().toISOString();
    reg.selectedBy = req.user.id;
    reg.status = ApplicationStatus.SHORTLISTED;

    // Record timeline history
    const historyItem: PipelineHistoryItem = {
      id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      fromStage: currentStage,
      toStage: currentStage,
      action: 'SELECTED',
      movedBy: req.user.id,
      movedByName: recruiterUser?.name || 'Recruiter',
      timestamp: new Date().toISOString(),
      notes: `Selected candidate in Stage ${currentStage}`,
    };

    if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
    reg.stageMovementHistory.push(historyItem);
    db.saveDatabase();

    // Create Notification
    db.createRecruiterNotification({
      id: 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      type: 'CANDIDATE_SELECTED',
      title: 'Candidate Selected',
      message: `${candidate?.name || 'Candidate'} was selected in Stage ${currentStage} for ${job?.title || 'job'}.`,
      read: false,
      relatedId: reg.id,
      candidateName: candidate?.name,
      jobTitle: job?.title,
      createdAt: new Date().toISOString(),
    });

    // Activity log
    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'CANDIDATE_SELECTED',
      candidateId: reg.candidateId,
      candidateName: candidate?.name,
      jobId: reg.jobId,
      jobTitle: job?.title,
      details: `Selected ${candidate?.name} in Stage ${currentStage}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, application: enrichRegistration(reg) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to select candidate' });
  }
});

// POST /api/recruiter/applications/:id/deselect
recruiterRouter.post('/applications/:id/deselect', (req: any, res: Response) => {
  try {
    const regId = req.params.id;
    const reg = db.getRegistrationById(regId);
    if (!reg) return res.status(404).json({ error: 'Application not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied to this candidate application' });
    }

    const currentStage = reg.currentRoundNumber || 1;
    const candidate = db.findUserById(reg.candidateId);
    const job = db.getJobById(reg.jobId);
    const recruiterUser = db.findUserById(req.user.id);

    reg.selectedForStage = false;
    reg.selectedAt = undefined;
    reg.selectedBy = undefined;

    const historyItem: PipelineHistoryItem = {
      id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      fromStage: currentStage,
      toStage: currentStage,
      action: 'RESET',
      movedBy: req.user.id,
      movedByName: recruiterUser?.name || 'Recruiter',
      timestamp: new Date().toISOString(),
      notes: `Deselected candidate in Stage ${currentStage}`,
    };

    if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
    reg.stageMovementHistory.push(historyItem);
    db.saveDatabase();

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'CANDIDATE_DESELECTED',
      candidateId: reg.candidateId,
      candidateName: candidate?.name,
      jobId: reg.jobId,
      jobTitle: job?.title,
      details: `Deselected ${candidate?.name} in Stage ${currentStage}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, application: enrichRegistration(reg) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to deselect candidate' });
  }
});

// Helper function to send stage-specific notification email
async function sendStageProgressionEmail(candidate: any, job: any, reg: any, nextStage: number) {
  if (!candidate?.email) return;

  if (nextStage === 2) {
    // Stage 1 -> Stage 2: Resume Screening Cleared -> Technical Assessment Invitation
    await emailService.sendResumePassedEmail({
      toEmail: candidate.email,
      candidateName: candidate.name || 'Candidate',
      companyName: job?.company?.name || 'Talent Acquisition Team',
      jobTitle: job?.title || 'Job Opening',
      technicalAssessmentCode: reg.technicalAssessmentCode || reg.interviewCode,
      interviewCode: reg.interviewCode,
      assessmentUrl: 'https://technicalassesment-1081785547021.asia-southeast1.run.app/',
    }).catch(err => console.error('[Email Dispatch] Stage 2 resume passed invite failed:', err));
  } else if (nextStage === 3) {
    // Stage 2 -> Stage 3: Technical Assessment Cleared -> Send Congratulations & Access Code!
    await emailService.sendTechnicalAssessmentClearedEmail({
      toEmail: candidate.email,
      candidateName: candidate.name,
      jobTitle: job?.title || 'Job Opening',
      companyName: job?.company?.name || 'Talent Acquisition Team',
      score: reg.technicalAssessmentScore || reg.scores?.technicalScore || 85,
      interviewCode: reg.interviewCode,
      nextSectionName: 'Stage 3: AI Technical Voice Interview',
    }).catch(err => console.error('[Email Dispatch] Stage 3 invite failed:', err));
  } else if (nextStage === 4) {
    // Stage 3 -> Stage 4: Final Selection & Offer (HR round removed)
    await emailService.sendEmail({
      toEmail: candidate.email,
      subject: `🎉 Congratulations: Shortlisted for Final Review & Offer (Stage 4) – ${job?.title || 'Job Opening'}`,
      template: 'OTHER',
      preview: `You have successfully cleared the AI Technical Interview and are shortlisted for Final Review & Offer!`,
      content: `Dear ${candidate.name},\n\nCongratulations! The recruitment team was highly impressed with your AI Technical Interview performance for "${job?.title}".\n\nYou have officially progressed to Stage 4: Final Review & Offer.\n\nOur hiring team is currently preparing your formal compensation package and offer letter. You will receive the complete offer documents directly in your candidate portal and via email shortly.\n\nWarm regards,\nTalent Acquisition & Leadership Team`,
    }).catch(err => console.error('[Email Dispatch] Stage 4 invite failed:', err));
  }
}

// POST /api/recruiter/applications/:id/move-stage
recruiterRouter.post('/applications/:id/move-stage', async (req: any, res: Response) => {
  try {
    const regId = req.params.id;
    const reg = db.getRegistrationById(regId);
    if (!reg) return res.status(404).json({ error: 'Application not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const currentStage = reg.currentRoundNumber || 1;
    if (currentStage >= 4) {
      return res.status(400).json({ error: 'Candidate is already in the final stage (Stage 4).' });
    }

    // Must be selected first or explicitly requested to auto-select
    if (!reg.selectedForStage && !req.body.force) {
      return res.status(400).json({
        error: 'Candidate must be selected in the current stage before advancing to the next stage.',
        requiresSelection: true,
      });
    }

    const nextStage = currentStage + 1;
    const candidate = db.findUserById(reg.candidateId);
    const job = db.getJobById(reg.jobId);
    const recruiterUser = db.findUserById(req.user.id);

    // Update round progression array
    if (!reg.roundProgression) reg.roundProgression = [];
    const prevRound = reg.roundProgression.find(r => r.roundNumber === currentStage);
    if (prevRound) {
      prevRound.status = RoundStatus.QUALIFIED;
      prevRound.completedAt = new Date().toISOString();
    } else {
      reg.roundProgression.push({
        roundNumber: currentStage,
        roundName: `Stage ${currentStage}`,
        roundType: RoundType.CUSTOM,
        status: RoundStatus.QUALIFIED,
        completedAt: new Date().toISOString(),
      });
    }

    const nextRound = reg.roundProgression.find(r => r.roundNumber === nextStage);
    if (nextRound) {
      nextRound.status = RoundStatus.IN_PROGRESS;
    } else {
      reg.roundProgression.push({
        roundNumber: nextStage,
        roundName: `Stage ${nextStage}`,
        roundType: RoundType.CUSTOM,
        status: RoundStatus.IN_PROGRESS,
      });
    }

    // Advance stage
    reg.currentRoundNumber = nextStage;
    reg.selectedForStage = false; // Reset selection for the newly entered stage
    reg.selectedAt = undefined;
    reg.selectedBy = undefined;
    if (reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED || reg.interviewStatus === InterviewStatus.TERMINATED) {
      reg.interviewStatus = InterviewStatus.READY_TO_ATTEND;
    }
    if (reg.overallPipelineStatus === 'REJECTED') {
      reg.overallPipelineStatus = 'IN_PROGRESS';
    }

    // Record movement history
    const historyItem: PipelineHistoryItem = {
      id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      fromStage: currentStage,
      toStage: nextStage,
      action: 'MOVED_STAGE',
      movedBy: req.user.id,
      movedByName: recruiterUser?.name || 'Recruiter',
      timestamp: new Date().toISOString(),
      notes: `Advanced from Stage ${currentStage} to Stage ${nextStage}`,
    };

    if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
    reg.stageMovementHistory.push(historyItem);
    db.saveDatabase();

    // Stage progression email notification to candidate
    if (candidate?.email) {
      await sendStageProgressionEmail(candidate, job, reg, nextStage);
    }

    // Notification for Recruiter
    db.createRecruiterNotification({
      id: 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      type: 'STAGE_MOVED',
      title: 'Candidate Advanced Stage',
      message: `${candidate?.name || 'Candidate'} was moved from Stage ${currentStage} to Stage ${nextStage} for ${job?.title}.`,
      read: false,
      relatedId: reg.id,
      candidateName: candidate?.name,
      jobTitle: job?.title,
      createdAt: new Date().toISOString(),
    });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'CANDIDATE_MOVED_STAGE',
      candidateId: reg.candidateId,
      candidateName: candidate?.name,
      jobId: reg.jobId,
      jobTitle: job?.title,
      details: `Advanced candidate from Stage ${currentStage} to Stage ${nextStage}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: `Successfully advanced candidate to Stage ${nextStage}`,
      application: enrichRegistration(reg),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to move candidate to next stage' });
  }
});

// POST /api/recruiter/applications/:id/reject
recruiterRouter.post('/applications/:id/reject', async (req: any, res: Response) => {
  try {
    const regId = req.params.id;
    const reg = db.getRegistrationById(regId);
    if (!reg) return res.status(404).json({ error: 'Application not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { reason, category, sendEmail } = req.body;
    const currentStage = reg.currentRoundNumber || 1;
    const candidate = db.findUserById(reg.candidateId);
    const job = db.getJobById(reg.jobId);
    const recruiterUser = db.findUserById(req.user.id);

    reg.status = ApplicationStatus.REJECTED;
    reg.overallPipelineStatus = 'REJECTED';
    reg.selectedForStage = false;
    reg.rejectedAt = new Date().toISOString();
    reg.rejectedBy = req.user.id;
    reg.rejectionReason = reason || 'Candidate did not meet criteria for this round.';
    reg.rejectionCategory = category || 'General Criteria';

    const historyItem: PipelineHistoryItem = {
      id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      fromStage: currentStage,
      toStage: currentStage,
      action: 'REJECTED',
      movedBy: req.user.id,
      movedByName: recruiterUser?.name || 'Recruiter',
      timestamp: new Date().toISOString(),
      reason: reg.rejectionReason,
      notes: `Rejected in Stage ${currentStage}. Reason: ${reg.rejectionReason}`,
    };

    if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
    reg.stageMovementHistory.push(historyItem);
    db.saveDatabase();

    // Send polite rejection email if requested
    if (sendEmail && candidate?.email) {
      await emailService.sendEmail({
        toEmail: candidate.email,
        subject: `Update regarding your application for ${job?.title || 'Job Opening'}`,
        template: 'OTHER',
        preview: `Thank you for your interest in the ${job?.title} role.`,
        content: `Dear ${candidate.name},\n\nThank you for taking the time to participate in our recruitment process for "${job?.title}".\n\nWhile we were impressed with your background and qualifications, we have decided to proceed with other candidates whose experience more closely aligns with our current requirements.\n\nWe appreciate your interest in joining our team and wish you the very best in your job search.\n\nSincerely,\nTalent Acquisition Team`,
      }).catch(err => console.error('[Email Dispatch] Rejection email failed:', err));
    }

    db.createRecruiterNotification({
      id: 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      type: 'CANDIDATE_REJECTED',
      title: 'Candidate Application Rejected',
      message: `${candidate?.name || 'Candidate'} was rejected in Stage ${currentStage} for ${job?.title}.`,
      read: false,
      relatedId: reg.id,
      candidateName: candidate?.name,
      jobTitle: job?.title,
      createdAt: new Date().toISOString(),
    });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'CANDIDATE_REJECTED',
      candidateId: reg.candidateId,
      candidateName: candidate?.name,
      jobId: reg.jobId,
      jobTitle: job?.title,
      details: `Rejected candidate in Stage ${currentStage}: ${reg.rejectionReason}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, application: enrichRegistration(reg) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reject candidate' });
  }
});

// POST /api/recruiter/applications/:id/final-selection/confirm
// Confirms candidate selection, marks as Selected, and sends Selection Offer Email with company name, description & package details
recruiterRouter.post('/applications/:id/final-selection/confirm', async (req: any, res: Response) => {
  try {
    const regId = req.params.id;
    const reg = db.getRegistrationById(regId);
    if (!reg) return res.status(404).json({ error: 'Candidate application record not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied to this candidate application' });
    }

    const { companyName, jobTitle, description, packageDetails, startDate, location, additionalNotes } = req.body;
    const candidate = db.findUserById(reg.candidateId);
    const job = db.getJobById(reg.jobId);
    const recruiterUser = db.findUserById(req.user.id);

    const finalCompanyName = companyName || job?.company?.name || 'Hiring Organization';
    const finalJobTitle = jobTitle || job?.title || 'Selected Role';
    const finalPackage = packageDetails || job?.salaryPackage || (job?.minPackage ? `${job.currency || 'INR'} ${(job.minPackage / 100000).toFixed(1)}L - ${(job.maxPackage / 100000).toFixed(1)}L PA` : 'Competitive CTC as per industry standard');
    const finalDescription = description || job?.description || 'Role responsibilities and key deliverables.';

    reg.status = ApplicationStatus.SELECTED;
    reg.overallPipelineStatus = 'SELECTED';
    reg.selectedForStage = true;
    reg.selectedAt = new Date().toISOString();
    reg.selectedBy = req.user.id;
    (reg as any).finalSelectionDecision = 'CONFIRMED';
    (reg as any).confirmedPackage = finalPackage;

    const historyItem: PipelineHistoryItem = {
      id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      fromStage: reg.currentRoundNumber || 4,
      toStage: reg.currentRoundNumber || 4,
      action: 'SELECTED',
      movedBy: req.user.id,
      movedByName: recruiterUser?.name || 'Recruiter',
      timestamp: new Date().toISOString(),
      notes: `Final Selection Confirmed by ${recruiterUser?.name || 'Recruiter'}. Package: ${finalPackage}`,
    };
    if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
    reg.stageMovementHistory.push(historyItem);

    db.updateRegistration(reg.id, reg);
    db.saveDatabase();

    // Send official Selection Offer Email to candidate
    if (candidate?.email) {
      await emailService.sendCandidateSelectedEmail({
        toEmail: candidate.email,
        candidateName: candidate.name || (candidate as any).fullName || 'Candidate',
        companyName: finalCompanyName,
        jobTitle: finalJobTitle,
        packageDetails: finalPackage,
        description: finalDescription,
        startDate: startDate || (job ? new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] : undefined),
        location: location || job?.location,
        additionalNotes: additionalNotes,
      }).catch(err => console.error('[Email Dispatch] Selection Offer email failed:', err));
    }

    db.createRecruiterNotification({
      id: 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      type: 'CANDIDATE_SELECTED',
      title: 'Selection Offer Dispatched',
      message: `Candidate ${candidate?.name || 'Candidate'} was officially confirmed and offered ${finalJobTitle} at ${finalCompanyName}.`,
      read: false,
      relatedId: reg.id,
      candidateName: candidate?.name,
      jobTitle: finalJobTitle,
      createdAt: new Date().toISOString(),
    });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'OFFER_EXTENDED',
      candidateId: reg.candidateId,
      candidateName: candidate?.name,
      jobId: reg.jobId,
      jobTitle: finalJobTitle,
      details: `Selection offer dispatched to ${candidate?.email || 'candidate'} with package ${finalPackage}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: `Candidate ${candidate?.name || 'Candidate'} successfully confirmed! Official Selection Offer email sent to ${candidate?.email || 'candidate'}.`,
      application: enrichRegistration(reg),
    });
  } catch (err: any) {
    console.error('Final confirm error:', err);
    return res.status(500).json({ error: 'Failed to confirm candidate selection' });
  }
});

// POST /api/recruiter/applications/:id/final-selection/hold
// Puts candidate on Hold during Final Review & Selection
recruiterRouter.post('/applications/:id/final-selection/hold', async (req: any, res: Response) => {
  try {
    const regId = req.params.id;
    const reg = db.getRegistrationById(regId);
    if (!reg) return res.status(404).json({ error: 'Candidate application record not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { notes } = req.body;
    const candidate = db.findUserById(reg.candidateId);
    const recruiterUser = db.findUserById(req.user.id);

    reg.status = ApplicationStatus.ON_HOLD || ('ON_HOLD' as any);
    reg.overallPipelineStatus = 'ON_HOLD' as any;
    reg.selectedForStage = false;
    (reg as any).finalSelectionDecision = 'HOLD';
    (reg as any).holdNotes = notes || 'Candidate on Hold pending hiring committee comparison.';

    const historyItem: PipelineHistoryItem = {
      id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      fromStage: reg.currentRoundNumber || 4,
      toStage: reg.currentRoundNumber || 4,
      action: 'ON_HOLD',
      movedBy: req.user.id,
      movedByName: recruiterUser?.name || 'Recruiter',
      timestamp: new Date().toISOString(),
      notes: notes || 'Candidate placed on Hold during Final Review & Selection.',
    };
    if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
    reg.stageMovementHistory.push(historyItem);

    db.updateRegistration(reg.id, reg);
    db.saveDatabase();

    return res.json({
      success: true,
      message: `Candidate ${candidate?.name || 'Candidate'} placed on Hold.`,
      application: enrichRegistration(reg),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to put candidate on hold' });
  }
});

// POST /api/recruiter/applications/:id/final-selection/remove
// Removes candidate from Final Review, marks as Rejected, and sends formal Rejection Email
recruiterRouter.post('/applications/:id/final-selection/remove', async (req: any, res: Response) => {
  try {
    const regId = req.params.id;
    const reg = db.getRegistrationById(regId);
    if (!reg) return res.status(404).json({ error: 'Candidate application record not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { reason, feedback, sendEmail = true } = req.body;
    const candidate = db.findUserById(reg.candidateId);
    const job = db.getJobById(reg.jobId);
    const recruiterUser = db.findUserById(req.user.id);

    reg.status = ApplicationStatus.REJECTED;
    reg.overallPipelineStatus = 'REJECTED';
    reg.selectedForStage = false;
    reg.rejectedAt = new Date().toISOString();
    reg.rejectedBy = req.user.id;
    reg.rejectionReason = reason || feedback || 'Not selected in Final Review.';
    (reg as any).finalSelectionDecision = 'REMOVED';

    const historyItem: PipelineHistoryItem = {
      id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      fromStage: reg.currentRoundNumber || 4,
      toStage: reg.currentRoundNumber || 4,
      action: 'REJECTED',
      movedBy: req.user.id,
      movedByName: recruiterUser?.name || 'Recruiter',
      timestamp: new Date().toISOString(),
      notes: `Removed in Final Review: ${reg.rejectionReason}`,
    };
    if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
    reg.stageMovementHistory.push(historyItem);

    db.updateRegistration(reg.id, reg);
    db.saveDatabase();

    if (sendEmail && candidate?.email) {
      await emailService.sendCandidateRejectedEmail({
        toEmail: candidate.email,
        candidateName: candidate.name || (candidate as any).fullName || 'Candidate',
        companyName: job?.company?.name || 'Hiring Organization',
        jobTitle: job?.title || 'Applied Position',
        reason: reason,
        feedback: feedback,
      }).catch(err => console.error('[Email Dispatch] Final rejection email failed:', err));
    }

    return res.json({
      success: true,
      message: `Candidate ${candidate?.name || 'Candidate'} removed and formal rejection email dispatched.`,
      application: enrichRegistration(reg),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to remove candidate' });
  }
});

// POST /api/recruiter/pipeline/bulk-action
recruiterRouter.post('/pipeline/bulk-action', async (req: any, res: Response) => {
  try {
    const { action, registrationIds, reason, category, sendEmail } = req.body;
    if (!action || !Array.isArray(registrationIds) || registrationIds.length === 0) {
      return res.status(400).json({ error: 'Action and array of registrationIds are required' });
    }

    const results: any[] = [];
    for (const regId of registrationIds) {
      const reg = db.getRegistrationById(regId);
      if (!reg || !isJobOwnedByRecruiter(reg.jobId, req)) continue;

      const currentStage = reg.currentRoundNumber || 1;
      const recruiterUser = db.findUserById(req.user.id);

      if (action === 'SELECT') {
        reg.selectedForStage = true;
        reg.selectedAt = new Date().toISOString();
        reg.selectedBy = req.user.id;
        reg.status = ApplicationStatus.SHORTLISTED;
        if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
        reg.stageMovementHistory.push({
          id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          fromStage: currentStage,
          toStage: currentStage,
          action: 'SELECTED',
          movedBy: req.user.id,
          movedByName: recruiterUser?.name || 'Recruiter',
          timestamp: new Date().toISOString(),
        });
        results.push({ id: reg.id, success: true, action: 'SELECT' });
      } else if (action === 'DESELECT') {
        reg.selectedForStage = false;
        reg.selectedAt = undefined;
        reg.selectedBy = undefined;
        if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
        reg.stageMovementHistory.push({
          id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          fromStage: currentStage,
          toStage: currentStage,
          action: 'RESET',
          movedBy: req.user.id,
          movedByName: recruiterUser?.name || 'Recruiter',
          timestamp: new Date().toISOString(),
        });
        results.push({ id: reg.id, success: true, action: 'DESELECT' });
      } else if (action === 'MOVE_STAGE') {
        if (currentStage < 5) {
          const nextStage = currentStage + 1;
          reg.currentRoundNumber = nextStage;
          reg.selectedForStage = false;
          if (reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED || reg.interviewStatus === InterviewStatus.TERMINATED) {
            reg.interviewStatus = InterviewStatus.READY_TO_ATTEND;
          }
          if (reg.overallPipelineStatus === 'REJECTED') {
            reg.overallPipelineStatus = 'IN_PROGRESS';
          }
          if (Array.isArray(reg.roundProgression)) {
            const prev = reg.roundProgression.find(r => r.roundNumber === currentStage);
            if (prev) {
              prev.status = RoundStatus.QUALIFIED;
              prev.completedAt = new Date().toISOString();
            }
            const nxt = reg.roundProgression.find(r => r.roundNumber === nextStage);
            if (nxt) {
              nxt.status = RoundStatus.IN_PROGRESS;
            }
          }
          db.saveDatabase();
          if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
          reg.stageMovementHistory.push({
            id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            fromStage: currentStage,
            toStage: nextStage,
            action: 'MOVED_STAGE',
            movedBy: req.user.id,
            movedByName: recruiterUser?.name || 'Recruiter',
            timestamp: new Date().toISOString(),
          });
          results.push({ id: reg.id, success: true, action: 'MOVE_STAGE', nextStage });

          // Send stage-specific email
          const candidate = db.findUserById(reg.candidateId);
          const job = db.getJobById(reg.jobId);
          if (candidate) {
            sendStageProgressionEmail(candidate, job, reg, nextStage).catch(err =>
              console.error('[Bulk Action] Stage email error:', err)
            );
          }
        }
      } else if (action === 'REJECT') {
        reg.status = ApplicationStatus.REJECTED;
        reg.overallPipelineStatus = 'REJECTED';
        reg.selectedForStage = false;
        reg.rejectedAt = new Date().toISOString();
        reg.rejectedBy = req.user.id;
        reg.rejectionReason = reason || 'Rejected via bulk action';
        if (!reg.stageMovementHistory) reg.stageMovementHistory = [];
        reg.stageMovementHistory.push({
          id: 'hist_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          fromStage: currentStage,
          toStage: currentStage,
          action: 'REJECTED',
          movedBy: req.user.id,
          movedByName: recruiterUser?.name || 'Recruiter',
          timestamp: new Date().toISOString(),
          reason: reg.rejectionReason,
        });
        results.push({ id: reg.id, success: true, action: 'REJECT' });
      }
    }

    db.saveDatabase();

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'BULK_ACTION_' + action,
      details: `Executed bulk action ${action} on ${results.length} candidates`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, count: results.length, results });
  } catch (err: any) {
    return res.status(500).json({ error: 'Bulk action failed' });
  }
});

// -------------------------------------------------------------
// 5. CANDIDATE DIRECTORY & DETAILS VIEW
// -------------------------------------------------------------

// GET /api/recruiter/candidates
recruiterRouter.get('/candidates', async (req: any, res: Response) => {
  try {
    await neonService.syncAssessmentSubmissions().catch(() => {});

    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const allRegistrations = db.getRegistrations();

    const jobId = req.query.jobId as string;
    const stage = req.query.stage ? parseInt(req.query.stage as string, 10) : undefined;
    const status = req.query.status as string;
    const search = ((req.query.search as string) || '').toLowerCase().trim();
    const scoreFilter = req.query.scoreFilter as string; // '90+' | '80+' | '70+' | '<70'
    const sort = (req.query.sort as string) || 'newest';

    let list = allRegistrations
      .filter(r => jobIds.has(r.jobId))
      .filter(r => (!jobId || r.jobId === jobId))
      .filter(r => (stage === undefined || (r.currentRoundNumber || 1) === stage))
      .filter(r => {
        if (!status || status === 'ALL') return true;
        if (status === 'SELECTED') return r.selectedForStage && r.status !== ApplicationStatus.REJECTED;
        if (status === 'NOT_SELECTED') return !r.selectedForStage && r.status !== ApplicationStatus.REJECTED;
        if (status === 'REJECTED' || status === 'DISQUALIFIED') return r.status === ApplicationStatus.REJECTED;
        if (status === 'IN_PROGRESS') return r.status !== ApplicationStatus.REJECTED && !r.selectedForStage;
        return r.status === status;
      })
      .map(enrichRegistration);

    if (search) {
      list = list.filter(c => {
        const name = (c.candidate?.name || '').toLowerCase();
        const email = (c.candidate?.email || '').toLowerCase();
        const code = (c.interviewCode || '').toLowerCase();
        const skills = (c.candidateProfile?.skills || []).join(' ').toLowerCase();
        const jobTitle = (c.job?.title || '').toLowerCase();
        return name.includes(search) || email.includes(search) || code.includes(search) || skills.includes(search) || jobTitle.includes(search);
      });
    }

    if (scoreFilter) {
      list = list.filter(c => {
        const score = c.scores?.overallScore || c.atsScore || 0;
        if (scoreFilter === '90+') return score >= 90;
        if (scoreFilter === '80+') return score >= 80 && score < 90;
        if (scoreFilter === '70+') return score >= 70 && score < 80;
        if (scoreFilter === '<70') return score < 70;
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (sort === 'score_desc') return (b.scores?.overallScore || 0) - (a.scores?.overallScore || 0);
      if (sort === 'score_asc') return (a.scores?.overallScore || 0) - (b.scores?.overallScore || 0);
      if (sort === 'name_asc') return (a.candidate?.name || '').localeCompare(b.candidate?.name || '');
      if (sort === 'name_desc') return (b.candidate?.name || '').localeCompare(a.candidate?.name || '');
      if (sort === 'oldest') return new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
      return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime();
    });

    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve candidates' });
  }
});

// GET /api/recruiter/candidates/:id
recruiterRouter.get('/candidates/:id', (req: any, res: Response) => {
  try {
    const reg = db.getRegistrationById(req.params.id);
    if (!reg) return res.status(404).json({ error: 'Candidate application record not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied to this candidate' });
    }

    const enriched = enrichRegistration(reg);
    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch candidate details' });
  }
});

// POST /api/recruiter/candidates/:id/evaluate-ats
// HardCore AI ATS Resume Evaluation on demand by recruiter
recruiterRouter.post('/candidates/:id/evaluate-ats', async (req: any, res: Response) => {
  try {
    const reg = db.getRegistrationById(req.params.id);
    if (!reg) return res.status(404).json({ error: 'Candidate application record not found' });
    if (!isJobOwnedByRecruiter(reg.jobId, req)) {
      return res.status(403).json({ error: 'Access denied to evaluate this candidate' });
    }

    const job = db.getJobById(reg.jobId);
    if (!job) return res.status(404).json({ error: 'Target job not found' });

    const candidateUser = db.findUserById(reg.candidateId);
    const candidateProfile = db.getCandidateProfile(reg.candidateId);

    const jobCutoff = job.rounds?.[0]?.minQualifyingScore || (job as any).minQualifyingScore || 65;

    // Call HardCore Gemini ATS evaluation
    const atsResult = await geminiService.evaluateResumeAts({
      jobTitle: job.title,
      jobDescription: job.description,
      eligibilityCriteria: job.eligibilityCriteria,
      requiredSkills: job.requiredSkills || [],
      requiredCertifications: job.requiredCertifications || [],
      experienceRequirements: job.experienceRequirements || job.experience,
      minQualifyingScore: jobCutoff,
      candidateName: candidateUser?.name || (candidateUser as any)?.fullName || 'Candidate',
      candidateEducation: candidateProfile?.education,
      candidateSkills: candidateProfile?.skills || [],
      candidateCertifications: candidateProfile?.certifications || [],
      candidateExperienceYears: candidateProfile?.experienceYears || 0,
      candidateProjects: candidateProfile?.projects || [],
      resumeText: candidateProfile?.resumeText,
    });

    // Strictly enforce cutoff requirement: ATS Score must be >= the Job Cutoff
    const isQualified = atsResult.atsScore >= jobCutoff;
    atsResult.isQualified = isQualified;

    // Update database record with fresh HardCore evaluation
    reg.atsScore = atsResult.atsScore;
    reg.atsFeedback = atsResult.feedback;
    reg.atsDetails = atsResult;
    reg.clearedResumeScreening = isQualified;
    if (isQualified) {
      if ((reg.currentRoundNumber || 1) < 2) {
        reg.currentRoundNumber = 2;
      }
    }

    // Update round progression record for Round 1
    if (reg.roundProgression && reg.roundProgression.length > 0) {
      reg.roundProgression = reg.roundProgression.map((rp: any) => {
        if (rp.roundNumber === 1 || rp.roundType === 'RESUME_SCREENING') {
          return {
            ...rp,
            score: atsResult.atsScore,
            feedback: atsResult.feedback,
            status: isQualified ? RoundStatus.QUALIFIED : RoundStatus.REJECTED,
          };
        }
        return rp;
      });
    }

    if (!reg.scores) reg.scores = {} as any;
    reg.scores.atsScore = atsResult.atsScore;
    reg.scores.skillsMatch = atsResult.scoreBreakdown?.keywordSkillMatchScore || reg.scores.skillsMatch;
    reg.scores.experienceMatch = atsResult.scoreBreakdown?.experienceRelevanceScore || reg.scores.experienceMatch;

    db.updateRegistration(reg.id, reg);

    return res.json({
      success: true,
      message: 'HardCore AI ATS resume evaluation completed successfully',
      atsResult,
      candidate: enrichRegistration(reg),
    });
  } catch (err: any) {
    console.error('Recruiter ATS evaluation error:', err);
    return res.status(500).json({ error: 'Failed to run HardCore ATS resume analysis' });
  }
});

// -------------------------------------------------------------
// 6. TECHNICAL ASSESSMENTS (STAGE 2)
// -------------------------------------------------------------

// GET /api/recruiter/assessments
recruiterRouter.get('/assessments', (req: any, res: Response) => {
  try {
    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const assessments = db.getAssessments().filter(a => jobIds.has(a.jobId) || a.recruiterId === req.user.id);
    return res.json(assessments);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// POST /api/recruiter/assessments
recruiterRouter.post('/assessments', (req: any, res: Response) => {
  try {
    const {
      jobId,
      title,
      description,
      durationMinutes,
      passingScore,
      difficulty,
      skillsTested,
      questions,
      antiCheatingEnabled,
      isPublished,
    } = req.body;

    if (!jobId || !title) {
      return res.status(400).json({ error: 'Job ID and assessment title are required' });
    }
    if (!isJobOwnedByRecruiter(jobId, req)) {
      return res.status(403).json({ error: 'Access denied for this job' });
    }

    const job = db.getJobById(jobId);
    const newAssessment: TechnicalAssessment = {
      id: 'asmt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      jobId,
      companyId: job?.companyId || 'comp_default',
      recruiterId: req.user.id,
      title: title.trim(),
      description: description || 'Technical knowledge and programming assessment',
      durationMinutes: durationMinutes ? Number(durationMinutes) : 45,
      passingScore: passingScore ? Number(passingScore) : 70,
      difficulty: difficulty || QuestionDifficulty.MEDIUM,
      skillsTested: Array.isArray(skillsTested) ? skillsTested : ['JavaScript', 'Data Structures'],
      questions: Array.isArray(questions) && questions.length > 0 ? questions : [
        {
          id: 'q1',
          questionText: 'What is the time complexity of searching an element in a balanced binary search tree?',
          type: 'MULTIPLE_CHOICE',
          options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
          correctOptionIndex: 1,
          marks: 10,
          skillsTested: ['Data Structures'],
        },
        {
          id: 'q2',
          questionText: 'Which JavaScript method creates a new array populated with the results of calling a provided function on every element?',
          type: 'MULTIPLE_CHOICE',
          options: ['forEach()', 'map()', 'filter()', 'reduce()'],
          correctOptionIndex: 1,
          marks: 10,
          skillsTested: ['JavaScript'],
        },
      ],
      negativeMarking: false,
      randomization: true,
      attemptLimit: 1,
      antiCheatingEnabled: antiCheatingEnabled !== undefined ? Boolean(antiCheatingEnabled) : true,
      isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createAssessment(newAssessment);

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'ASSESSMENT_CREATED',
      jobId,
      jobTitle: job?.title,
      details: `Created technical assessment "${newAssessment.title}" with ${newAssessment.questions.length} questions`,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, assessment: newAssessment });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// GET /api/recruiter/assessments/:id
recruiterRouter.get('/assessments/:id', (req: any, res: Response) => {
  try {
    const assessment = db.getAssessmentById(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (!isJobOwnedByRecruiter(assessment.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json(assessment);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

// PATCH /api/recruiter/assessments/:id
recruiterRouter.patch('/assessments/:id', (req: any, res: Response) => {
  try {
    const assessment = db.getAssessmentById(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (!isJobOwnedByRecruiter(assessment.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = db.updateAssessment(assessment.id, req.body);
    return res.json({ success: true, assessment: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update assessment' });
  }
});

// DELETE /api/recruiter/assessments/:id
recruiterRouter.delete('/assessments/:id', (req: any, res: Response) => {
  try {
    const assessment = db.getAssessmentById(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (!isJobOwnedByRecruiter(assessment.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    db.deleteAssessment(assessment.id);
    return res.json({ success: true, message: 'Assessment deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete assessment' });
  }
});

// GET /api/recruiter/assessments/:id/submissions
recruiterRouter.get('/assessments/:id/submissions', (req: any, res: Response) => {
  try {
    const assessment = db.getAssessmentById(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (!isJobOwnedByRecruiter(assessment.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const submissions = db.getAssessmentSubmissions(assessment.jobId).filter(s => s.assessmentId === assessment.id);
    const enriched = submissions.map(s => {
      const user = db.findUserById(s.candidateId);
      return {
        ...s,
        candidateName: user?.name,
        candidateEmail: user?.email,
      };
    });

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch assessment submissions' });
  }
});

// -------------------------------------------------------------
// 7. HR INTERVIEWS (STAGE 4)
// -------------------------------------------------------------

// GET /api/recruiter/hr-interviews
recruiterRouter.get('/hr-interviews', (req: any, res: Response) => {
  try {
    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const interviews = db.getHRInterviews().filter(h => jobIds.has(h.jobId));
    return res.json(interviews);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve HR interviews' });
  }
});

// POST /api/recruiter/hr-interviews
recruiterRouter.post('/hr-interviews', async (req: any, res: Response) => {
  try {
    const {
      registrationId,
      candidateId,
      jobId,
      interviewerName,
      interviewerEmail,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      meetingLink,
      interviewLocation,
      interviewType,
      notes,
    } = req.body;

    if (!registrationId || !candidateId || !jobId || !scheduledDate || !scheduledTime) {
      return res.status(400).json({ error: 'Candidate, Job, Date, and Time are required to schedule HR interview' });
    }
    if (!isJobOwnedByRecruiter(jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const candidate = db.findUserById(candidateId);
    const job = db.getJobById(jobId);

    const newSchedule: HRInterviewSchedule = {
      id: 'hr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      registrationId,
      candidateId,
      candidateName: candidate?.name || 'Candidate',
      candidateEmail: candidate?.email || '',
      jobId,
      jobTitle: job?.title || 'Job Opening',
      recruiterId: req.user.id,
      interviewerName: interviewerName || 'HR Interviewer',
      interviewerEmail,
      scheduledDate,
      scheduledTime,
      durationMinutes: durationMinutes ? Number(durationMinutes) : 45,
      meetingLink: meetingLink || 'https://meet.google.com/interview-' + Math.random().toString(36).substring(2, 8),
      interviewLocation,
      interviewType: interviewType || 'ONLINE',
      notes,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createHRInterview(newSchedule);

    // Send calendar invite email to candidate
    if (candidate?.email) {
      await emailService.sendEmail({
        toEmail: candidate.email,
        subject: `HR Interview Invitation: ${job?.title} – ${scheduledDate} at ${scheduledTime}`,
        template: 'OTHER',
        preview: `Your HR interview has been scheduled for ${scheduledDate} at ${scheduledTime}.`,
        content: `Dear ${candidate.name},\n\nYou are invited to attend an HR Interview for the position of "${job?.title}".\n\nDate: ${scheduledDate}\nTime: ${scheduledTime}\nDuration: ${newSchedule.durationMinutes} minutes\nMeeting Link: ${newSchedule.meetingLink}\nInterviewer: ${newSchedule.interviewerName}\n\nPlease join 5 minutes prior to the scheduled time.\n\nBest regards,\nTalent Acquisition Team`,
      }).catch(err => console.error('[Email Dispatch] HR invite failed:', err));
    }

    // Notification
    db.createRecruiterNotification({
      id: 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      type: 'INTERVIEW_SCHEDULED',
      title: 'HR Interview Scheduled',
      message: `HR Interview scheduled with ${candidate?.name} on ${scheduledDate} at ${scheduledTime}.`,
      read: false,
      relatedId: newSchedule.id,
      candidateName: candidate?.name,
      jobTitle: job?.title,
      createdAt: new Date().toISOString(),
    });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'HR_INTERVIEW_SCHEDULED',
      candidateId,
      candidateName: candidate?.name,
      jobId,
      jobTitle: job?.title,
      details: `Scheduled HR interview on ${scheduledDate} at ${scheduledTime}`,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, schedule: newSchedule });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to schedule HR interview' });
  }
});

// POST /api/recruiter/hr-interviews/:id/evaluate
recruiterRouter.post('/hr-interviews/:id/evaluate', (req: any, res: Response) => {
  try {
    const interview = db.getHRInterviewById(req.params.id);
    if (!interview) return res.status(404).json({ error: 'HR interview schedule not found' });
    if (!isJobOwnedByRecruiter(interview.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { hrScore, communicationScore, behavioralScore, teamAlignmentScore, notes, recommendation } = req.body;

    const evaluation = {
      hrScore: Number(hrScore) || 80,
      communicationScore: Number(communicationScore) || 80,
      behavioralScore: Number(behavioralScore) || 80,
      teamAlignmentScore: Number(teamAlignmentScore) || 80,
      notes: notes || '',
      recommendation: recommendation || 'HIRE',
      completedAt: new Date().toISOString(),
    };

    const updated = db.updateHRInterview(interview.id, {
      status: 'COMPLETED',
      evaluation,
    });

    // Update candidate application scores
    const reg = db.getRegistrationById(interview.registrationId);
    if (reg) {
      if (!reg.scores) reg.scores = {};
      reg.scores.hrScore = evaluation.hrScore;
      reg.scores.communicationScore = evaluation.communicationScore;
      reg.scores.behavioralScore = evaluation.behavioralScore;
      reg.scores.teamAlignmentScore = evaluation.teamAlignmentScore;

      // Recalculate overall score
      const validScores = [reg.scores.atsScore, reg.scores.technicalScore, reg.scores.aiInterviewScore, reg.scores.hrScore].filter(
        s => typeof s === 'number' && !isNaN(s)
      );
      if (validScores.length > 0) {
        reg.scores.overallScore = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
      }
      db.saveDatabase();
    }

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'HR_EVALUATION_SUBMITTED',
      candidateId: interview.candidateId,
      candidateName: interview.candidateName,
      jobId: interview.jobId,
      jobTitle: interview.jobTitle,
      details: `Submitted HR evaluation with score ${evaluation.hrScore}% (${evaluation.recommendation})`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, schedule: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to submit evaluation' });
  }
});

// -------------------------------------------------------------
// 8. JOB OFFERS (STAGE 5)
// -------------------------------------------------------------

// GET /api/recruiter/offers
recruiterRouter.get('/offers', (req: any, res: Response) => {
  try {
    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const offers = db.getOffers().filter(o => jobIds.has(o.jobId));
    return res.json(offers);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve offers' });
  }
});

// POST /api/recruiter/offers
recruiterRouter.post('/offers', (req: any, res: Response) => {
  try {
    const {
      registrationId,
      candidateId,
      jobId,
      positionTitle,
      salary,
      currency,
      payFrequency,
      employmentType,
      startDate,
      offerExpiryDate,
      benefits,
      location,
      additionalTerms,
    } = req.body;

    if (!registrationId || !candidateId || !jobId || !salary || !startDate) {
      return res.status(400).json({ error: 'Registration, candidate, job, salary, and start date are required' });
    }
    if (!isJobOwnedByRecruiter(jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const candidate = db.findUserById(candidateId);
    const job = db.getJobById(jobId);
    const company = job?.companyId ? db.getCompanyById(job.companyId) : undefined;

    const newOffer: JobOffer = {
      id: 'ofr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      registrationId,
      candidateId,
      candidateName: candidate?.name || 'Candidate',
      candidateEmail: candidate?.email || '',
      jobId,
      jobTitle: job?.title || 'Job Opening',
      companyId: job?.companyId || 'comp_default',
      companyName: company?.name || 'Acme Corp',
      recruiterId: req.user.id,
      positionTitle: positionTitle || job?.title || 'Software Engineer',
      salary: Number(salary),
      currency: currency || 'INR',
      payFrequency: payFrequency || 'Annual',
      employmentType: employmentType || EmploymentType.FULL_TIME,
      startDate,
      offerExpiryDate: offerExpiryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      benefits: Array.isArray(benefits) ? benefits : ['Comprehensive Health Insurance', 'Annual Performance Bonus', 'Remote Work Allowance'],
      location: location || job?.location || 'Remote',
      additionalTerms: additionalTerms || '',
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createOffer(newOffer);

    // Link offer to registration
    const reg = db.getRegistrationById(registrationId);
    if (reg) {
      reg.offerId = newOffer.id;
      db.saveDatabase();
    }

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'OFFER_DRAFT_CREATED',
      candidateId,
      candidateName: candidate?.name,
      jobId,
      jobTitle: job?.title,
      details: `Created draft offer of ${newOffer.currency} ${newOffer.salary.toLocaleString()} for ${newOffer.positionTitle}`,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, offer: newOffer });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create job offer' });
  }
});

// POST /api/recruiter/offers/:id/send
recruiterRouter.post('/offers/:id/send', async (req: any, res: Response) => {
  try {
    const offer = db.getOfferById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (!isJobOwnedByRecruiter(offer.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = db.updateOffer(offer.id, {
      status: 'SENT',
      sentAt: new Date().toISOString(),
    });

    // Update application status
    const reg = db.getRegistrationById(offer.registrationId);
    if (reg) {
      reg.status = ApplicationStatus.SHORTLISTED;
      reg.overallPipelineStatus = 'OFFERED';
      db.saveDatabase();
    }

    // Send formal offer email
    if (offer.candidateEmail) {
      const emailContent = `Dear ${offer.candidateName},

Congratulations! We are thrilled to offer you the position of ${offer.positionTitle} with ${offer.companyName}.

OFFER DETAILS:
------------------------------------------
Position: ${offer.positionTitle}
Compensation: ${offer.currency} ${offer.salary.toLocaleString()} (${offer.payFrequency})
Employment Type: ${offer.employmentType}
Expected Start Date: ${offer.startDate}
Location: ${offer.location}
Offer Valid Until: ${offer.offerExpiryDate}

KEY BENEFITS:
${offer.benefits.map(b => `• ${b}`).join('\n')}

${offer.additionalTerms ? `ADDITIONAL TERMS:\n${offer.additionalTerms}\n` : ''}
Please review this offer and let us know if you accept by replying to this email or accessing your candidate portal before ${offer.offerExpiryDate}.

We look forward to welcoming you to the team!

Warm regards,
${offer.companyName} Recruitment Team`;

      await emailService.sendEmail({
        toEmail: offer.candidateEmail,
        subject: `Formal Job Offer: ${offer.positionTitle} at ${offer.companyName}`,
        template: 'OTHER',
        preview: `Congratulations! ${offer.companyName} is pleased to extend you an offer for ${offer.positionTitle}.`,
        content: emailContent,
      }).catch(err => console.error('[Email Dispatch] Offer dispatch failed:', err));
    }

    db.createRecruiterNotification({
      id: 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      type: 'STAGE_MOVED',
      title: 'Job Offer Sent',
      message: `Formal job offer was sent to ${offer.candidateName} for ${offer.positionTitle}.`,
      read: false,
      relatedId: offer.id,
      candidateName: offer.candidateName,
      jobTitle: offer.jobTitle,
      createdAt: new Date().toISOString(),
    });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'OFFER_SENT',
      candidateId: offer.candidateId,
      candidateName: offer.candidateName,
      jobId: offer.jobId,
      jobTitle: offer.jobTitle,
      details: `Sent formal offer of ${offer.currency} ${offer.salary.toLocaleString()} to ${offer.candidateName}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, offer: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to send offer' });
  }
});

// POST /api/recruiter/offers/:id/withdraw
recruiterRouter.post('/offers/:id/withdraw', (req: any, res: Response) => {
  try {
    const offer = db.getOfferById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (!isJobOwnedByRecruiter(offer.jobId, req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = db.updateOffer(offer.id, {
      status: 'WITHDRAWN',
      withdrawnAt: new Date().toISOString(),
      notes: req.body.reason || 'Offer withdrawn by recruiter',
    });

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'OFFER_WITHDRAWN',
      candidateId: offer.candidateId,
      candidateName: offer.candidateName,
      jobId: offer.jobId,
      jobTitle: offer.jobTitle,
      details: `Withdrew job offer for ${offer.candidateName}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, offer: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to withdraw offer' });
  }
});

// -------------------------------------------------------------
// 9. EMAIL MANAGEMENT & BULK ACTIONS
// -------------------------------------------------------------

// GET /api/recruiter/email-templates
recruiterRouter.get('/email-templates', (req: any, res: Response) => {
  const templates = [
    {
      id: 'tmpl_resume_shortlisted',
      stage: 'Stage 1: Resume Screening',
      type: 'RESUME_SHORTLISTED',
      name: 'Resume Shortlisted',
      subject: 'Great news! Your application for {{jobTitle}} is shortlisted',
      body: `Hi {{candidateName}},\n\nWe have reviewed your resume and profile for the {{jobTitle}} role. We are pleased to inform you that you have been shortlisted for the next stage!\n\nOur team will share the next steps and assessment instructions with you shortly.\n\nBest regards,\nTalent Acquisition Team`,
    },
    {
      id: 'tmpl_assessment_invite',
      stage: 'Stage 2: Technical Assessment',
      type: 'ASSESSMENT_INVITATION',
      name: 'Technical Assessment Invitation',
      subject: 'Invitation to Technical Assessment – {{jobTitle}}',
      body: `Hi {{candidateName}},\n\nYou are invited to complete the online Technical Assessment for the {{jobTitle}} opening.\n\nDuration: 45 Minutes\nPlease ensure you have a stable internet connection.\nAssessment Link: {{assessmentLink}}\nAccess Code: {{interviewCode}}\n\nGood luck!\nTalent Acquisition Team`,
    },
    {
      id: 'tmpl_ai_interview_invite',
      stage: 'Stage 3: AI Interview',
      type: 'AI_INTERVIEW_INVITATION',
      name: 'AI Vocal Interview Invitation',
      subject: 'Ready for your AI Interview: {{jobTitle}}',
      body: `Hi {{candidateName}},\n\nCongratulations on clearing the technical assessment! You are now invited to participate in the AI Interview round for {{jobTitle}}.\n\nInterview Access Code: {{interviewCode}}\nPortal: {{portalLink}}\n\nPlease ensure your camera and microphone are operational.\n\nBest regards,\nRecruitment Team`,
    },
    {
      id: 'tmpl_formal_offer',
      stage: 'Stage 4: Final Review & Offer',
      type: 'FORMAL_OFFER',
      name: 'Formal Job Offer',
      subject: 'Formal Job Offer: {{positionTitle}} at {{companyName}}',
      body: `Dear {{candidateName}},\n\nWe are delighted to extend a formal offer of employment for the position of {{positionTitle}}.\n\nSalary: {{salary}}\nStart Date: {{startDate}}\nLocation: {{location}}\n\nPlease review the attached terms and confirm your acceptance.\n\nWarm regards,\nLeadership & Hiring Committee`,
    },
  ];
  return res.json(templates);
});

// POST /api/recruiter/send-email
recruiterRouter.post('/send-email', async (req: any, res: Response) => {
  try {
    const { registrationId, candidateId, subject, body } = req.body;
    if (!candidateId || !subject || !body) {
      return res.status(400).json({ error: 'Candidate ID, subject, and body are required' });
    }

    const candidate = db.findUserById(candidateId);
    if (!candidate?.email) {
      return res.status(404).json({ error: 'Candidate email address not found' });
    }

    const emailLog = await emailService.sendEmail({
      toEmail: candidate.email,
      subject,
      template: 'OTHER',
      preview: body.substring(0, 120),
      content: body,
    });

    if (registrationId) {
      const reg = db.getRegistrationById(registrationId);
      if (reg) {
        if (!reg.candidateEmailsReceived) reg.candidateEmailsReceived = [];
        reg.candidateEmailsReceived.push({
          id: emailLog.id,
          toEmail: candidate.email,
          subject,
          template: 'OTHER',
          senderName: 'Recruitment Team',
          sentAt: new Date().toISOString(),
          status: 'SENT',
          fullContent: body,
          payloadPreview: body.substring(0, 100),
        });
        db.saveDatabase();
      }
    }

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'EMAIL_SENT',
      candidateId,
      candidateName: candidate.name,
      details: `Sent email "${subject}" to ${candidate.email}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, message: 'Email sent successfully', emailLog });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// POST /api/recruiter/bulk-email
recruiterRouter.post('/bulk-email', async (req: any, res: Response) => {
  try {
    const { candidateIds, subject, body } = req.body;
    if (!Array.isArray(candidateIds) || candidateIds.length === 0 || !subject || !body) {
      return res.status(400).json({ error: 'Array of candidateIds, subject, and body are required' });
    }

    let successCount = 0;
    for (const cid of candidateIds) {
      const candidate = db.findUserById(cid);
      if (!candidate?.email) continue;

      const personalizedBody = body
        .replace(/{{candidateName}}/g, candidate.name)
        .replace(/{{candidateEmail}}/g, candidate.email);

      await emailService.sendEmail({
        toEmail: candidate.email,
        subject,
        template: 'OTHER',
        preview: personalizedBody.substring(0, 120),
        content: personalizedBody,
      }).catch(err => console.error('[Bulk Email] Failed for:', candidate.email, err));

      successCount++;
    }

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'BULK_EMAIL_SENT',
      details: `Sent bulk email "${subject}" to ${successCount} candidates`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, sentCount: successCount });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to dispatch bulk email' });
  }
});

// -------------------------------------------------------------
// 10. NOTIFICATIONS & AUDIT ACTIVITIES
// -------------------------------------------------------------

// GET /api/recruiter/notifications
recruiterRouter.get('/notifications', (req: any, res: Response) => {
  try {
    const notifications = db.getRecruiterNotifications(req.user.id);
    return res.json(notifications);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/recruiter/notifications/:id/read
recruiterRouter.patch('/notifications/:id/read', (req: any, res: Response) => {
  try {
    const success = db.markNotificationRead(req.params.id, req.user.id);
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// POST /api/recruiter/notifications/read-all
recruiterRouter.post('/notifications/read-all', (req: any, res: Response) => {
  try {
    const notifs = db.getRecruiterNotifications(req.user.id);
    notifs.forEach(n => (n.read = true));
    db.saveDatabase();
    return res.json({ success: true, updatedCount: notifs.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// GET /api/recruiter/activities
recruiterRouter.get('/activities', (req: any, res: Response) => {
  try {
    const activities = db.getRecruiterActivities(req.user.id, 100);
    return res.json(activities);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// -------------------------------------------------------------
// 11. MALPRACTICE & INTEGRITY VIOLATIONS
// -------------------------------------------------------------

// GET /api/recruiter/integrity-violations
recruiterRouter.get('/integrity-violations', (req: any, res: Response) => {
  try {
    const jobs = getRecruiterJobs(req);
    const jobIds = new Set(jobs.map(j => j.id));
    const allRegistrations = db.getRegistrations();
    const reports = db.getAllRecruiterReports();

    // Collect proctoring flags from registrations, reports, and dedicated records
    const stored = db.getIntegrityViolations().filter(v => jobIds.has(v.jobId));
    const dynamicViolations: IntegrityViolationRecord[] = [];

    allRegistrations.filter(r => jobIds.has(r.jobId)).forEach(reg => {
      if (reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED || (reg.attemptCount && reg.attemptCount > reg.maxAttempts)) {
        const c = db.findUserById(reg.candidateId);
        const j = db.getJobById(reg.jobId);
        if (!stored.some(s => s.registrationId === reg.id)) {
          dynamicViolations.push({
            id: 'viol_' + reg.id,
            registrationId: reg.id,
            candidateId: reg.candidateId,
            candidateName: c?.name || 'Candidate',
            candidateEmail: c?.email || '',
            jobId: reg.jobId,
            jobTitle: j?.title || 'Job Opening',
            violationType: 'Malpractice Terminated / Multiple Face Detection',
            severity: 'CRITICAL',
            status: 'REVIEW_REQUIRED',
            timestamp: reg.registeredAt || new Date().toISOString(),
            evidence: 'Webcam feed and tab-switch monitor flagged suspicious activity.',
          });
        }
      }
    });

    reports.forEach(rep => {
      const reg = allRegistrations.find(r => r.id === rep.interviewId);
      if (reg && jobIds.has(reg.jobId) && rep.proctoringFlags && rep.proctoringFlags.length > 0) {
        if (!stored.some(s => s.registrationId === reg.id) && !dynamicViolations.some(d => d.registrationId === reg.id)) {
          const c = db.findUserById(reg.candidateId);
          const j = db.getJobById(reg.jobId);
          dynamicViolations.push({
            id: 'viol_rep_' + rep.interviewId,
            registrationId: reg.id,
            candidateId: reg.candidateId,
            candidateName: c?.name || 'Candidate',
            candidateEmail: c?.email || '',
            jobId: reg.jobId,
            jobTitle: j?.title || 'Job Opening',
            violationType: rep.proctoringFlags[0],
            severity: 'MEDIUM',
            status: 'REVIEW_REQUIRED',
            timestamp: new Date().toISOString(),
            evidence: `${rep.proctoringFlags.length} proctoring anomaly events detected during AI interview session.`,
          });
        }
      }
    });

    return res.json([...stored, ...dynamicViolations]);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch integrity violations' });
  }
});

// POST /api/recruiter/integrity-violations/:id/review
recruiterRouter.post('/integrity-violations/:id/review', (req: any, res: Response) => {
  try {
    const { status, recruiterNotes } = req.body;
    if (!status || !['CONFIRMED', 'DISMISSED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be CONFIRMED or DISMISSED' });
    }

    const violationId = req.params.id;
    let existing = db.data.integrityViolations?.find(v => v.id === violationId);

    if (!existing) {
      // Create record if reviewing a dynamically computed violation
      const regId = violationId.replace('viol_rep_', '').replace('viol_', '');
      const reg = db.getRegistrationById(regId);
      const c = reg ? db.findUserById(reg.candidateId) : undefined;
      const j = reg ? db.getJobById(reg.jobId) : undefined;

      existing = {
        id: violationId,
        registrationId: regId,
        candidateId: reg?.candidateId || '',
        candidateName: c?.name || 'Candidate',
        candidateEmail: c?.email || '',
        jobId: reg?.jobId || '',
        jobTitle: j?.title || 'Job Opening',
        violationType: 'Proctoring Anomaly',
        severity: 'HIGH',
        status: status as any,
        timestamp: new Date().toISOString(),
        recruiterNotes,
        reviewedBy: req.user.id,
        reviewedAt: new Date().toISOString(),
      };
      db.createIntegrityViolation(existing);
    } else {
      existing = db.updateIntegrityViolation(existing.id, {
        status: status as any,
        recruiterNotes,
        reviewedBy: req.user.id,
        reviewedAt: new Date().toISOString(),
      });
    }

    db.logRecruiterActivity({
      id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      recruiterId: req.user.id,
      action: 'INTEGRITY_VIOLATION_REVIEWED',
      details: `Reviewed integrity violation as ${status}: ${recruiterNotes || 'No notes'}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, violation: existing });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to review violation' });
  }
});
