import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { neonService } from './db/neonService.js';
import {
  User,
  UserRole,
  Company,
  Job,
  JobStatus,
  WorkMode,
  EmploymentType,
  InterviewRegistration,
  ApplicationStatus,
  InterviewStatus,
  ProctoringEvent,
  TranscriptItem,
  QuestionRecord,
  CandidateCompetency,
  CandidateReport,
  RecruiterReport,
  EmailLog,
  AIAssistanceRisk,
  QuestionType,
  QuestionDifficulty,
  RecruiterProfile,
  TechnicalAssessment,
  AssessmentSubmission,
  HRInterviewSchedule,
  JobOffer,
  RecruiterNotification,
  RecruiterActivityLog,
  IntegrityViolationRecord,
  PipelineHistoryItem,
  RoundType,
} from '../src/types/index.js';

export interface DatabaseSchema {
  users: User[];
  candidateProfiles: any[];
  recruiters: RecruiterProfile[];
  companies: Company[];
  jobs: Job[];
  interviewRegistrations: InterviewRegistration[];
  otpRecords: {
    id: string;
    email: string;
    otp: string;
    expiresAt: number;
    attempts: number;
    verified: boolean;
    purpose?: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
    createdAt: string;
  }[];
  interviews: any[];
  interviewQuestions: QuestionRecord[];
  interviewTranscripts: TranscriptItem[];
  candidateCompetencies: {
    id: string;
    interviewId: string;
    candidateId: string;
    competencies: CandidateCompetency[];
  }[];
  coveredConcepts: {
    id: string;
    interviewId: string;
    conceptName: string;
    depthLevel: number;
  }[];
  proctoringEvents: ProctoringEvent[];
  malpracticeEvents: any[];
  aiAssistanceSignals: any[];
  candidateReports: CandidateReport[];
  recruiterReports: RecruiterReport[];
  emailLogs: EmailLog[];
  sessions: UserSession[];
  assessments: TechnicalAssessment[];
  assessmentSubmissions: AssessmentSubmission[];
  hrInterviews: HRInterviewSchedule[];
  offers: JobOffer[];
  recruiterNotifications: RecruiterNotification[];
  recruiterActivities: RecruiterActivityLog[];
  integrityViolations: IntegrityViolationRecord[];
}

export interface UserSession {
  token: string;
  userId: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Initial clean database schema (Zero fake/mock data; only real user records)
function getInitialSeedData(): DatabaseSchema {
  return {
    users: [],
    candidateProfiles: [],
    recruiters: [],
    companies: [],
    jobs: [],
    interviewRegistrations: [],
    otpRecords: [],
    interviews: [],
    interviewQuestions: [],
    interviewTranscripts: [],
    candidateCompetencies: [],
    coveredConcepts: [],
    proctoringEvents: [],
    malpracticeEvents: [],
    aiAssistanceSignals: [],
    candidateReports: [],
    recruiterReports: [],
    emailLogs: [],
    sessions: [],
    assessments: [],
    assessmentSubmissions: [],
    hrInterviews: [],
    offers: [],
    recruiterNotifications: [],
    recruiterActivities: [],
    integrityViolations: [],
  };
}

class DatabaseService {
  public data: DatabaseSchema;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadDatabase();
    if (!this.data.sessions) {
      this.data.sessions = [];
    }
    if (!this.data.recruiters) this.data.recruiters = [];
    if (!this.data.assessments) this.data.assessments = [];
    // Ensure all existing assessments have strictly unique IDs and exactly one assessment per job
    const initialJobIds = new Set<string>();
    const initialAsmtIds = new Set<string>();
    this.data.assessments = this.data.assessments.filter(a => {
      if (!a.jobId || initialJobIds.has(a.jobId)) return false;
      initialJobIds.add(a.jobId);
      if (initialAsmtIds.has(a.id) || a.id === 'asmt_700000000000') {
        a.id = 'asmt_' + a.jobId.replace(/-/g, '');
      }
      initialAsmtIds.add(a.id);
      return true;
    });

    if (!this.data.assessmentSubmissions) this.data.assessmentSubmissions = [];
    if (!this.data.hrInterviews) this.data.hrInterviews = [];
    if (!this.data.offers) this.data.offers = [];
    if (!this.data.recruiterNotifications) this.data.recruiterNotifications = [];
    if (!this.data.recruiterActivities) this.data.recruiterActivities = [];
    if (!this.data.integrityViolations) this.data.integrityViolations = [];

    // Initialize Neon DB connection and hydrate existing data
    neonService.init().then(async () => {
      const remoteData = await neonService.loadAllFromNeon();
      if (remoteData) {
        if (remoteData.users.length === 0 && remoteData.jobs.length === 0) {
          console.log('[Neon Sync] Neon DB is empty. Seeding initial companies, users, and jobs into Neon...');
          for (const company of this.data.companies) {
            await neonService.saveCompany(company).catch(() => {});
          }
          for (const user of this.data.users) {
            await neonService.saveUser(user).catch(() => {});
          }
          for (const job of this.data.jobs) {
            await neonService.saveJob(job).catch(() => {});
          }
          if (Array.isArray(this.data.candidateProfiles)) {
            for (const profile of this.data.candidateProfiles) {
              await neonService.saveCandidateProfile(profile).catch(() => {});
            }
          }
          console.log('[Neon Sync] Successfully seeded initial data to Neon DB!');
        } else {
          // Merge or populate users
          remoteData.users.forEach(ru => {
            const idx = this.data.users.findIndex(u => u.email.toLowerCase() === ru.email.toLowerCase());
            if (idx !== -1) {
              this.data.users[idx] = { ...this.data.users[idx], ...ru };
            } else {
              this.data.users.push(ru);
            }
          });

          // Merge companies
          remoteData.companies.forEach(rc => {
            if (!this.data.companies.some(c => c.id === rc.id || c.name === rc.name)) {
              this.data.companies.push(rc);
            }
          });

          // Merge or update jobs from Neon
          remoteData.jobs.forEach(rj => {
            const idx = this.data.jobs.findIndex(j => j.id === rj.id);
            if (idx !== -1) {
              this.data.jobs[idx] = { ...this.data.jobs[idx], ...rj };
            } else {
              this.data.jobs.unshift(rj);
            }
          });

          // Merge candidate profiles from Neon
          if (Array.isArray(remoteData.candidateProfiles)) {
            remoteData.candidateProfiles.forEach(rp => {
              const idx = this.data.candidateProfiles.findIndex(p => p.userId === rp.userId);
              if (idx !== -1) {
                this.data.candidateProfiles[idx] = { ...this.data.candidateProfiles[idx], ...rp };
              } else {
                this.data.candidateProfiles.push(rp);
              }
            });
          }

          // Merge assessments from Neon
          if (Array.isArray(remoteData.assessments)) {
            if (!this.data.assessments) this.data.assessments = [];
            remoteData.assessments.forEach(ra => {
              if (ra.id === 'asmt_700000000000' && ra.jobId) {
                ra.id = 'asmt_' + ra.jobId.replace(/-/g, '');
              }
              const idx = this.data.assessments.findIndex(a => a.id === ra.id || a.jobId === ra.jobId);
              if (idx !== -1) {
                this.data.assessments[idx] = { ...this.data.assessments[idx], ...ra, id: ra.id || this.data.assessments[idx].id };
              } else {
                this.data.assessments.push(ra);
              }
            });
          }

          // Merge assessment submissions from Neon
          if (Array.isArray(remoteData.assessmentSubmissions)) {
            if (!this.data.assessmentSubmissions) this.data.assessmentSubmissions = [];
            remoteData.assessmentSubmissions.forEach(rs => {
              const idx = this.data.assessmentSubmissions.findIndex(
                s => s.id === rs.id || (s.registrationId && s.registrationId === rs.registrationId)
              );
              if (idx !== -1) {
                this.data.assessmentSubmissions[idx] = { ...this.data.assessmentSubmissions[idx], ...rs };
              } else {
                this.data.assessmentSubmissions.push(rs);
              }
            });
          }

          // Merge interview registrations from Neon
          if (Array.isArray(remoteData.interviewRegistrations)) {
            if (!this.data.interviewRegistrations) this.data.interviewRegistrations = [];
            remoteData.interviewRegistrations.forEach(rr => {
              const idx = this.data.interviewRegistrations.findIndex(
                r => r.id === rr.id || (rr.technicalAssessmentCode && r.technicalAssessmentCode === rr.technicalAssessmentCode)
              );
              if (idx !== -1) {
                const local = this.data.interviewRegistrations[idx];
                const r2Remote = Array.isArray(rr.roundProgression)
                  ? rr.roundProgression.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')
                  : undefined;
                const r2Local = Array.isArray(local.roundProgression)
                  ? local.roundProgression.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')
                  : undefined;
                const techScore = rr.technicalAssessmentScore ?? local.technicalAssessmentScore ?? r2Remote?.score ?? r2Local?.score;
                const scores = (rr.scores && Object.keys(rr.scores).length > 0) ? rr.scores : local.scores;
                const roundProg = Array.isArray(rr.roundProgression) ? rr.roundProgression : local.roundProgression;
                const subCount = this.data.assessmentSubmissions?.filter(
                  (s: any) => s.registrationId === rr.id || (s.candidateId === rr.candidateId && s.jobId === rr.jobId)
                ).length || 0;
                const resolvedAttemptCount = Math.max(local.attemptCount || 0, rr.attemptCount || 0, subCount, local.technicalAssessmentCompleted ? 1 : 0);

                this.data.interviewRegistrations[idx] = {
                  ...local,
                  ...rr,
                  attemptCount: resolvedAttemptCount,
                  roundProgression: roundProg,
                  technicalAssessmentScore: techScore,
                  scores: scores || (techScore != null ? { technicalScore: techScore, assessmentPercentage: techScore, overallScore: techScore } : undefined),
                };
              } else {
                this.data.interviewRegistrations.push(rr);
              }
            });
          }
        }

        // Ensure all jobs have a valid 12-digit technicalAssessmentCode and technical assessments configured
        if (!this.data.assessments) this.data.assessments = [];
        const alphaChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        for (const job of this.data.jobs) {
          if (!job.technicalAssessmentCode) {
            if ((job as any).metadata?.technicalAssessmentCode) {
              job.technicalAssessmentCode = (job as any).metadata.technicalAssessmentCode;
            } else {
              const regWithCode = this.data.interviewRegistrations?.find(r => r.jobId === job.id && r.technicalAssessmentCode);
              if (regWithCode?.technicalAssessmentCode) {
                job.technicalAssessmentCode = regWithCode.technicalAssessmentCode;
              } else if (job.id === 'cffc4ae4-b480-4608-bf6a-67f3af4d31a1') {
                job.technicalAssessmentCode = 'KG9STR5BF7QF';
              } else {
                let code = '';
                for (let i = 0; i < 12; i++) {
                  code += alphaChars.charAt(Math.floor(Math.random() * alphaChars.length));
                }
                job.technicalAssessmentCode = code;
              }
            }
          }
          if (!job.metadata) job.metadata = {};
          job.metadata.technicalAssessmentCode = job.technicalAssessmentCode;
          let asmt = this.data.assessments.find(a => a.jobId === job.id);
          if (!asmt) {
            const questions = (job.technicalAssessmentQuestions && job.technicalAssessmentQuestions.length > 0)
              ? job.technicalAssessmentQuestions
              : [
                  {
                    id: 'mcq_1_' + job.id.slice(0, 6),
                    questionText: `Which architectural pattern is best suited for low-latency asynchronous processing in ${job.title}?`,
                    type: 'MULTIPLE_CHOICE' as const,
                    options: ['Event-Driven Reactive Architecture with Queues', 'Monolithic Blocking Polling', 'Direct Client-Side File Mutex', 'Synchronous Cascade HTTP Calls'],
                    correctOptionIndex: 0,
                    marks: 5,
                    skillsTested: ['System Design', 'Scalability'],
                  },
                  {
                    id: 'mcq_2_' + job.id.slice(0, 6),
                    questionText: 'What is the average time complexity of Hash Map lookup vs Binary Search Tree search?',
                    type: 'MULTIPLE_CHOICE' as const,
                    options: ['O(1) vs O(log N)', 'O(log N) vs O(1)', 'O(N) vs O(N)', 'O(1) vs O(N)'],
                    correctOptionIndex: 0,
                    marks: 5,
                    skillsTested: ['Data Structures & Algorithms', 'Technical Aptitude'],
                  },
                  {
                    id: 'mcq_3_' + job.id.slice(0, 6),
                    questionText: 'Which property in ACID guarantees that multiple transactions occur concurrently without conflict?',
                    type: 'MULTIPLE_CHOICE' as const,
                    options: ['Isolation', 'Atomicity', 'Consistency', 'Durability'],
                    correctOptionIndex: 0,
                    marks: 5,
                    skillsTested: ['Database Internals', 'Transaction Integrity'],
                  },
                  {
                    id: 'code_1_' + job.id.slice(0, 6),
                    questionText: 'Implement a function `solve(nums, target)` that finds the contiguous subarray with the maximum sum and returns that sum (Kadane\'s Algorithm).',
                    type: 'CODING' as const,
                    marks: 25,
                    skillsTested: ['Dynamic Programming', 'Algorithms', 'Arrays'],
                    codingLanguage: 'javascript',
                    codingTemplate: 'function solve(nums, target) {\n  let maxSoFar = nums[0];\n  let currMax = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    currMax = Math.max(nums[i], currMax + nums[i]);\n    maxSoFar = Math.max(maxSoFar, currMax);\n  }\n  return maxSoFar;\n}',
                    testCases: [
                      { input: '[-2, 1, -3, 4, -1, 2, 1, -5, 4], 0', expectedOutput: '6', isHidden: false, explanation: '[4, -1, 2, 1] has largest sum = 6' },
                      { input: '[1], 0', expectedOutput: '1', isHidden: false, explanation: '[1] has sum 1' },
                      { input: '[5, 4, -1, 7, 8], 0', expectedOutput: '23', isHidden: false, explanation: 'Entire array sum is 23' },
                      { input: '[-1, -2, -3, -4], 0', expectedOutput: '-1', isHidden: true },
                      { input: '[2, -1, 2, 3, 4, -5], 0', expectedOutput: '10', isHidden: true },
                      { input: '[10, -2, 3, -4, 20], 0', expectedOutput: '27', isHidden: true },
                      { input: '[-5, 8, -2, 5, -1, 6], 0', expectedOutput: '16', isHidden: true },
                      { input: '[0, 0, 0, 0], 0', expectedOutput: '0', isHidden: true },
                    ],
                  },
                ];

            asmt = {
              id: 'asmt_' + job.id.replace(/-/g, ''),
              jobId: job.id,
              companyId: job.companyId,
              recruiterId: job.recruiterId || 'system',
              title: `${job.title} - Technical Assessment`,
              description: `Stage 2 Technical Assessment with aptitude questions and live coding challenges with 3 shown and 5 hidden test cases.`,
              durationMinutes: 45,
              passingScore: 70,
              difficulty: QuestionDifficulty.MEDIUM,
              skillsTested: job.requiredSkills?.length ? job.requiredSkills : ['Algorithms', 'Software Engineering'],
              antiCheatingEnabled: true,
              negativeMarking: false,
              randomization: false,
              attemptLimit: 1,
              isPublished: true,
              questions,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            this.data.assessments.push(asmt);
          }
          await neonService.saveAssessment(asmt).catch(() => {});
        }

        this.saveDatabase();
        console.log(`[Database Sync] Synced from Neon DB: ${this.data.users.length} users, ${this.data.jobs.length} jobs, ${this.data.assessments.length} assessments.`);
      }
    }).catch(err => {
      console.warn('[Neon Sync] Background hydration error:', err.message);
    });
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Failed to create data dir:', err);
      }
    }
  }

  private loadDatabase(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.users && parsed.jobs) {
          return parsed;
        }
      } catch (err) {
        console.warn('Could not read existing database file, initializing seed:', err);
      }
    }
    const seed = getInitialSeedData();
    this.saveDatabase(seed);
    return seed;
  }

  private saveTimeout: NodeJS.Timeout | null = null;

  public saveDatabase(dataToSave?: DatabaseSchema) {
    const toWrite = dataToSave || this.data;
    try {
      this.ensureDataDir();
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(() => {
        this.saveTimeout = null;
        fs.promises.writeFile(DB_FILE, JSON.stringify(toWrite, null, 2), 'utf-8').catch(err => {
          console.error('Failed to write database file asynchronously:', err);
        });
      }, 30);
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  public saveDatabaseSync(dataToSave?: DatabaseSchema) {
    const toWrite = dataToSave || this.data;
    try {
      this.ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(toWrite, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file synchronously:', err);
    }
  }

  // Users
  public getUsers() {
    return this.data.users;
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public createUser(user: User): User {
    this.data.users.push(user);
    this.saveDatabase();
    neonService.saveUser(user).catch(err => {
      console.error('[Neon DB] createUser error:', err.message);
    });
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveDatabase();
      neonService.saveUser(this.data.users[idx]).catch(err => {
        console.error('[Neon DB] updateUser error:', err.message);
      });
      return this.data.users[idx];
    }
    return undefined;
  }

  // Candidate profile
  public getCandidateProfile(userId: string) {
    return this.data.candidateProfiles.find(p => p.userId === userId);
  }

  public setCandidateProfile(profile: any) {
    const idx = this.data.candidateProfiles.findIndex(p => p.userId === profile.userId);
    let result;
    if (idx !== -1) {
      this.data.candidateProfiles[idx] = { ...this.data.candidateProfiles[idx], ...profile };
      result = this.data.candidateProfiles[idx];
    } else {
      this.data.candidateProfiles.push(profile);
      result = profile;
    }
    this.saveDatabase();
    neonService.saveCandidateProfile(result).catch(err => {
      console.error('[Neon DB] saveCandidateProfile error:', err.message);
    });
    return result;
  }

  // OTP Records
  public createOtp(email: string, otp: string, explicitUserId?: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD' = 'VERIFY_EMAIL'): any {
    const cleanEmail = email.toLowerCase().trim();
    // Invalidate existing pending OTPs for this email and purpose
    this.data.otpRecords = this.data.otpRecords.filter(
      r => !(r.email.toLowerCase() === cleanEmail && (r.purpose || 'VERIFY_EMAIL') === purpose)
    );

    const record = {
      id: 'otp_' + Math.random().toString(36).substr(2, 9),
      email: cleanEmail,
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
      verified: false,
      purpose,
      createdAt: new Date().toISOString(),
    };

    const user = this.findUserByEmail(cleanEmail);
    const userId = explicitUserId || user?.id;

    this.data.otpRecords.push(record);
    this.saveDatabase();
    neonService.saveEmailVerification(record.email, record.otp, record.expiresAt, userId).catch(err => {
      console.error('[Neon DB] saveEmailVerification error:', err.message);
    });
    return record;
  }

  public verifyOtp(email: string, otp: string): { valid: boolean; message: string } {
    const cleanEmail = email.toLowerCase().trim();
    const record = this.data.otpRecords.find(
      r => r.email.toLowerCase() === cleanEmail && !r.verified && (r.purpose || 'VERIFY_EMAIL') === 'VERIFY_EMAIL'
    );

    if (!record) {
      return { valid: false, message: 'No active verification code found for this email.' };
    }

    if (Date.now() > record.expiresAt) {
      return { valid: false, message: 'Verification code has expired. Please request a new code.' };
    }

    if (record.attempts >= 5) {
      return { valid: false, message: 'Maximum attempts reached. Please request a new code.' };
    }

    record.attempts += 1;

    if (record.otp !== otp.trim()) {
      this.saveDatabase();
      return { valid: false, message: 'Invalid verification code. Please check and try again.' };
    }

    record.verified = true;
    this.saveDatabase();
    neonService.markEmailVerificationUsed(email, otp).catch(err => {
      console.error('[Neon DB] markEmailVerificationUsed error:', err.message);
    });
    neonService.updateUserStatus(email, true, 'ACTIVE').catch(err => {
      console.error('[Neon DB] updateUserStatus error:', err.message);
    });
    return { valid: true, message: 'Email verified successfully.' };
  }

  public verifyResetPasswordOtp(email: string, otp: string): { valid: boolean; message: string } {
    const cleanEmail = email.toLowerCase().trim();
    const record = this.data.otpRecords.find(
      r => r.email.toLowerCase() === cleanEmail && !r.verified && r.purpose === 'RESET_PASSWORD'
    );

    if (!record) {
      return { valid: false, message: 'No active password reset OTP found for this email.' };
    }

    if (Date.now() > record.expiresAt) {
      return { valid: false, message: 'Password reset OTP has expired. Please request a new code.' };
    }

    if (record.attempts >= 5) {
      return { valid: false, message: 'Maximum attempts exceeded. Please request a new code.' };
    }

    record.attempts += 1;

    if (record.otp !== otp.trim()) {
      this.saveDatabase();
      return { valid: false, message: 'Invalid password reset OTP. Please check and try again.' };
    }

    record.verified = true;
    this.saveDatabase();
    return { valid: true, message: 'OTP verified successfully.' };
  }

  // Jobs
  public getJobs(): Job[] {
    // Enrich with company object
    return this.data.jobs.map(job => {
      const comp = this.data.companies.find(c => c.id === job.companyId);
      return { ...job, company: comp };
    });
  }

  public getJobById(id: string): Job | undefined {
    const job = this.data.jobs.find(j => j.id === id);
    if (!job) return undefined;
    const comp = this.data.companies.find(c => c.id === job.companyId);
    return { ...job, company: comp };
  }

  public createJob(job: Job): Job {
    if (!job.technicalAssessmentCode) {
      const alphaChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = '';
      for (let i = 0; i < 12; i++) {
        code += alphaChars.charAt(Math.floor(Math.random() * alphaChars.length));
      }
      job.technicalAssessmentCode = code;
    }
    if (!job.metadata) job.metadata = {};
    job.metadata.technicalAssessmentCode = job.technicalAssessmentCode;
    this.data.jobs.unshift(job);
    this.saveDatabase();
    neonService.saveJob(job).catch(err => {
      console.error('[Neon DB] createJob error:', err.message);
    });
    return job;
  }

  public async createJobAsync(job: Job): Promise<Job> {
    if (!job.technicalAssessmentCode) {
      const alphaChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = '';
      for (let i = 0; i < 12; i++) {
        code += alphaChars.charAt(Math.floor(Math.random() * alphaChars.length));
      }
      job.technicalAssessmentCode = code;
    }
    if (!job.metadata) job.metadata = {};
    job.metadata.technicalAssessmentCode = job.technicalAssessmentCode;
    this.data.jobs.unshift(job);
    this.saveDatabase();
    neonService.saveJob(job).catch((err: any) => {
      console.error('[Neon DB] createJobAsync error:', err.message);
    });
    return job;
  }

  public updateJob(id: string, updates: Partial<Job>): Job | undefined {
    const idx = this.data.jobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      this.data.jobs[idx] = {
        ...this.data.jobs[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.saveDatabase();
      neonService.saveJob(this.data.jobs[idx]).catch(err => {
        console.error('[Neon DB] updateJob error:', err.message);
      });
      return this.getJobById(id);
    }
    return undefined;
  }

  public async updateJobAsync(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const idx = this.data.jobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      this.data.jobs[idx] = {
        ...this.data.jobs[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.saveDatabase();
      try {
        await neonService.saveJob(this.data.jobs[idx]);
      } catch (err: any) {
        console.error('[Neon DB] updateJobAsync error:', err.message);
      }
      return this.getJobById(id);
    }
    return undefined;
  }

  // Companies
  public getCompanies(): Company[] {
    return this.data.companies;
  }

  public createCompany(company: Company): Company {
    this.data.companies.push(company);
    this.saveDatabase();
    neonService.saveCompany(company).catch(err => {
      console.error('[Neon DB] createCompany error:', err.message);
    });
    return company;
  }

  // Registrations & Dynamic Status Engine
  public computeRegistrationStatus(reg: InterviewRegistration): 'Completed' | 'Attend Interview' | 'Continue Interview' | 'Not Started' | 'Expired' {
    if (reg.interviewStatus === InterviewStatus.COMPLETED) {
      return 'Completed';
    }
    if (reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED || reg.interviewStatus === InterviewStatus.TERMINATED) {
      return 'Expired';
    }

    const now = Date.now();

    // Check custom interview schedule window if defined
    if (reg.interviewStartDate && reg.interviewStartTime) {
      const startDateTime = new Date(`${reg.interviewStartDate}T${reg.interviewStartTime}`).getTime();
      if (!isNaN(startDateTime) && now < startDateTime) {
        return 'Not Started';
      }
    }

    if (reg.interviewEndDate && reg.interviewEndTime) {
      const endDateTime = new Date(`${reg.interviewEndDate}T${reg.interviewEndTime}`).getTime();
      if (!isNaN(endDateTime) && now > endDateTime) {
        return 'Expired';
      }
    }

    // Check expiresAt fallback
    if (reg.expiresAt) {
      const expTime = new Date(reg.expiresAt).getTime();
      if (!isNaN(expTime) && now > expTime) {
        return 'Expired';
      }
    }

    // Check maximum attempts (strictly 1 attempt per policy)
    const attempts = reg.attemptCount || 0;
    const maxAttempts = reg.maxAttempts || 1;
    if (attempts >= maxAttempts && reg.interviewStatus !== InterviewStatus.IN_PROGRESS) {
      return 'Expired';
    }

    // Check if in progress or has prior unfinished attempt
    if (reg.interviewStatus === InterviewStatus.IN_PROGRESS || (attempts > 0 && attempts < maxAttempts)) {
      return 'Continue Interview';
    }

    return 'Attend Interview';
  }

  private enrichRegistration(reg: InterviewRegistration): InterviewRegistration {
    const job = this.getJobById(reg.jobId);
    const cand = this.findUserById(reg.candidateId);
    const subCount = this.data.assessmentSubmissions?.filter(
      (s: any) => s.registrationId === reg.id || (s.candidateId === reg.candidateId && s.jobId === reg.jobId)
    ).length || 0;
    const attemptCount = Math.min(
      Math.max(reg.attemptCount ?? 0, subCount, reg.technicalAssessmentCompleted ? 1 : 0),
      1
    );
    const maxAttempts = 1;
    const computedStatus = this.computeRegistrationStatus({ ...reg, attemptCount, maxAttempts });

    // Sync database interviewStatus if expired
    if (computedStatus === 'Expired' && reg.interviewStatus !== InterviewStatus.COMPLETED && reg.interviewStatus !== InterviewStatus.MALPRACTICE_TERMINATED) {
      reg.interviewStatus = InterviewStatus.EXPIRED;
    }

    // Resolve actual scores from submission, roundProgression, or existing scores
    const r2 = Array.isArray(reg.roundProgression)
      ? reg.roundProgression.find((r: any) => r.roundNumber === 2 || r.roundType === RoundType.TECHNICAL_ASSESSMENT)
      : undefined;
    const sub = this.data.assessmentSubmissions?.find(
      (s: any) => s.registrationId === reg.id || (s.candidateId === reg.candidateId && s.jobId === reg.jobId)
    );
    const resolvedTechScore = reg.scores?.technicalScore ?? reg.technicalAssessmentScore ?? r2?.score ?? sub?.score ?? sub?.percentage;
    const r1 = Array.isArray(reg.roundProgression)
      ? reg.roundProgression.find((r: any) => r.roundNumber === 1)
      : undefined;
    const resolvedAtsScore = reg.scores?.atsScore ?? reg.atsScore ?? r1?.score;

    const scores = {
      ...(reg.scores || {}),
      atsScore: resolvedAtsScore,
      technicalScore: resolvedTechScore,
      assessmentPercentage: resolvedTechScore,
      overallScore: reg.scores?.overallScore ?? resolvedTechScore ?? resolvedAtsScore,
    };

    // Filter out HR interview round completely and ensure clean 4-stage pipeline
    let cleanProgression = reg.roundProgression;
    if (Array.isArray(reg.roundProgression)) {
      cleanProgression = reg.roundProgression
        .filter((r: any) => r.roundType !== RoundType.HR_INTERVIEW && !String(r.roundName || '').toLowerCase().includes('hr interview'))
        .map((r: any) => {
          if (r.roundNumber === 5) {
            return { ...r, roundNumber: 4 };
          }
          return r;
        });
    }

    let cleanJob = job;
    if (job && Array.isArray(job.rounds)) {
      cleanJob = {
        ...job,
        rounds: job.rounds
          .filter((r: any) => r.roundType !== RoundType.HR_INTERVIEW && !String(r.name || '').toLowerCase().includes('hr interview'))
          .map((r: any) => {
            if (r.roundNumber === 5) {
              return { ...r, roundNumber: 4 };
            }
            return r;
          }),
      };
    }

    return {
      ...reg,
      job: cleanJob,
      candidate: cand,
      roundProgression: cleanProgression,
      currentRoundNumber: Math.min(reg.currentRoundNumber || 1, 4),
      technicalAssessmentScore: resolvedTechScore,
      scores,
      attemptCount,
      maxAttempts,
      computedStatus,
    };
  }

  public getRegistrations(): InterviewRegistration[] {
    return this.data.interviewRegistrations.map(reg => this.enrichRegistration(reg));
  }

  public getRegistrationById(id: string): InterviewRegistration | undefined {
    const reg = this.data.interviewRegistrations.find(r => r.id === id);
    if (!reg) return undefined;
    return this.enrichRegistration(reg);
  }

  public findRegistrationByCode(code: string): InterviewRegistration | undefined {
    const cleanCode = code.toUpperCase().trim();
    const reg = this.data.interviewRegistrations.find(
      r => r.interviewCode.toUpperCase().trim() === cleanCode
    );
    if (!reg) return undefined;
    return this.enrichRegistration(reg);
  }

  public findRegistrationByTechnicalAssessmentCode(code: string): InterviewRegistration | undefined {
    const cleanCode = code.toUpperCase().trim();
    // 1. Direct match on registration code
    let reg = this.data.interviewRegistrations.find(
      r => (r.technicalAssessmentCode && r.technicalAssessmentCode.toUpperCase().trim() === cleanCode) ||
           r.interviewCode.toUpperCase().trim() === cleanCode
    );
    if (reg) return this.enrichRegistration(reg);

    // 2. Match on job's technicalAssessmentCode
    const job = this.data.jobs.find(
      j => (j.technicalAssessmentCode && j.technicalAssessmentCode.toUpperCase().trim() === cleanCode) ||
           ((j as any).metadata?.technicalAssessmentCode && (j as any).metadata.technicalAssessmentCode.toUpperCase().trim() === cleanCode) ||
           (j.jobCode && j.jobCode.toUpperCase().trim() === cleanCode)
    );
    if (job) {
      reg = this.data.interviewRegistrations.find(r => r.jobId === job.id);
      if (reg) return this.enrichRegistration(reg);
    }

    return undefined;
  }

  public async findRegistrationByTechnicalAssessmentCodeAsync(code: string): Promise<InterviewRegistration | undefined> {
    const cleanCode = code.toUpperCase().trim();
    // 1. Check in-memory first
    const existing = this.findRegistrationByTechnicalAssessmentCode(cleanCode);
    if (existing) return existing;

    // 2. Query Neon directly
    try {
      const neonReg = await neonService.getRegistrationByTechnicalCode(cleanCode);
      if (neonReg) {
        const parseJsonSafe = (val: any) => {
          if (!val) return undefined;
          if (typeof val === 'object') return val;
          try { return JSON.parse(val); } catch { return undefined; }
        };

        const reg: InterviewRegistration = {
          id: neonReg.id,
          candidateId: neonReg.candidate_id,
          jobId: neonReg.job_id,
          companyId: neonReg.company_id,
          interviewCode: neonReg.interview_code,
          technicalAssessmentCode: neonReg.technical_assessment_code,
          status: neonReg.status,
          interviewStatus: neonReg.interview_status,
          currentRoundNumber: Number(neonReg.current_round_number) || 1,
          atsScore: Number(neonReg.ats_score) || 0,
          roundProgression: parseJsonSafe(neonReg.round_progression) || [],
          atsDetails: parseJsonSafe(neonReg.ats_details) || {},
          registeredAt: neonReg.registered_at ? new Date(neonReg.registered_at).toISOString() : new Date().toISOString(),
          expiresAt: neonReg.expires_at ? new Date(neonReg.expires_at).toISOString() : undefined,
          attemptCount: 0,
          maxAttempts: 1,
        };

        const existingIdx = this.data.interviewRegistrations.findIndex(r => r.id === reg.id);
        if (existingIdx !== -1) {
          this.data.interviewRegistrations[existingIdx] = reg;
        } else {
          this.data.interviewRegistrations.push(reg);
        }
        this.saveDatabase();
        return this.enrichRegistration(reg);
      }
    } catch (e: any) {
      console.warn('[Neon Sync] findRegistrationByTechnicalAssessmentCodeAsync query error:', e.message);
    }

    // 3. Check if code belongs to a job in Neon
    try {
      const neonJob = await neonService.getJobByTechnicalCode(cleanCode);
      if (neonJob) {
        // Find existing registration for this job
        const jobReg = this.data.interviewRegistrations.find(r => r.jobId === neonJob.id);
        if (jobReg) return this.enrichRegistration(jobReg);
      }
    } catch (e: any) {}

    return undefined;
  }

  public findJobByTechnicalAssessmentCode(code: string): Job | undefined {
    const cleanCode = code.toUpperCase().trim();
    return this.data.jobs.find(
      j => (j.technicalAssessmentCode && j.technicalAssessmentCode.toUpperCase().trim() === cleanCode) ||
           ((j as any).metadata?.technicalAssessmentCode && (j as any).metadata.technicalAssessmentCode.toUpperCase().trim() === cleanCode) ||
           (j.jobCode && j.jobCode.toUpperCase().trim() === cleanCode)
    );
  }

  public async findJobByTechnicalAssessmentCodeAsync(code: string): Promise<Job | undefined> {
    const cleanCode = code.toUpperCase().trim();
    const existing = this.findJobByTechnicalAssessmentCode(cleanCode);
    if (existing) return existing;

    try {
      const neonJob = await neonService.getJobByTechnicalCode(cleanCode);
      if (neonJob) {
        return this.getJobById(neonJob.id);
      }
    } catch (e) {}

    return undefined;
  }

  public createRegistration(reg: InterviewRegistration): InterviewRegistration {
    const enriched: InterviewRegistration = {
      ...reg,
      attemptCount: reg.attemptCount ?? 0,
      maxAttempts: reg.maxAttempts ?? 1,
    };
    this.data.interviewRegistrations.push(enriched);
    this.saveDatabase();
    neonService.saveRegistration(enriched).catch(err => {
      console.error('[Neon DB] createRegistration error:', err.message);
    });
    return this.enrichRegistration(enriched);
  }

  public updateRegistration(id: string, updates: Partial<InterviewRegistration>): InterviewRegistration | undefined {
    const idx = this.data.interviewRegistrations.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.data.interviewRegistrations[idx] = { ...this.data.interviewRegistrations[idx], ...updates };
      this.saveDatabase();
      neonService.saveRegistration(this.data.interviewRegistrations[idx]).catch(() => {});
      return this.data.interviewRegistrations[idx];
    }
    return undefined;
  }

  // Proctoring Events
  public addProctoringEvent(event: ProctoringEvent): ProctoringEvent {
    this.data.proctoringEvents.push(event);
    this.saveDatabase();
    neonService.saveProctoringEvent(event).catch(() => {});
    return event;
  }

  public getProctoringEventsForInterview(interviewId: string): ProctoringEvent[] {
    return this.data.proctoringEvents.filter(e => e.interviewId === interviewId);
  }

  // Transcripts
  public addTranscriptItem(item: TranscriptItem): TranscriptItem {
    this.data.interviewTranscripts.push(item);
    this.saveDatabase();
    neonService.saveTranscript(item).catch(() => {});
    return item;
  }

  public getTranscriptsForInterview(interviewId: string): TranscriptItem[] {
    return this.data.interviewTranscripts.filter(t => t.interviewId === interviewId);
  }

  // Questions
  public addQuestionRecord(question: QuestionRecord): QuestionRecord {
    this.data.interviewQuestions.push(question);
    this.saveDatabase();
    return question;
  }

  public updateQuestionRecord(id: string, updates: Partial<QuestionRecord>): QuestionRecord | undefined {
    const idx = this.data.interviewQuestions.findIndex(q => q.id === id);
    if (idx !== -1) {
      this.data.interviewQuestions[idx] = { ...this.data.interviewQuestions[idx], ...updates };
      this.saveDatabase();
      return this.data.interviewQuestions[idx];
    }
    return undefined;
  }

  public getQuestionsForInterview(interviewId: string): QuestionRecord[] {
    return this.data.interviewQuestions.filter(q => q.interviewId === interviewId);
  }

  // Reports
  public saveCandidateReport(report: CandidateReport) {
    const idx = this.data.candidateReports.findIndex(r => r.interviewId === report.interviewId);
    if (idx !== -1) {
      this.data.candidateReports[idx] = report;
    } else {
      this.data.candidateReports.push(report);
    }
    this.saveDatabase();
    return report;
  }

  public getCandidateReport(interviewId: string): CandidateReport | undefined {
    return this.data.candidateReports.find(r => r.interviewId === interviewId);
  }

  public saveRecruiterReport(report: RecruiterReport) {
    const idx = this.data.recruiterReports.findIndex(r => r.interviewId === report.interviewId);
    if (idx !== -1) {
      this.data.recruiterReports[idx] = report;
    } else {
      this.data.recruiterReports.push(report);
    }
    this.saveDatabase();
    return report;
  }

  public getRecruiterReport(interviewId: string): RecruiterReport | undefined {
    return this.data.recruiterReports.find(r => r.interviewId === interviewId);
  }

  public getAllRecruiterReports(): RecruiterReport[] {
    return this.data.recruiterReports;
  }

  // Email Logs
  public addEmailLog(log: EmailLog): EmailLog {
    this.data.emailLogs.unshift(log);
    this.saveDatabase();
    return log;
  }

  public getEmailLogs(limit = 50): EmailLog[] {
    return this.data.emailLogs.slice(0, limit);
  }

  // Non-JWT Session Authentication
  public createSession(userId: string, email: string, role: string): UserSession {
    if (!this.data.sessions) {
      this.data.sessions = [];
    }
    const token = 'sess_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
    const session: UserSession = {
      token,
      userId,
      email,
      role,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    this.data.sessions.push(session);
    this.saveDatabase();
    neonService.saveSession(session).catch(err => {
      console.error('[Neon DB] saveSession error:', err.message);
    });
    return session;
  }

  public findSessionByToken(token: string): UserSession | undefined {
    if (!this.data.sessions) {
      this.data.sessions = [];
    }
    const session = this.data.sessions.find(s => s.token === token);
    if (!session) return undefined;
    if (Date.now() > session.expiresAt) {
      this.deleteSession(token);
      return undefined;
    }
    return session;
  }

  public deleteSession(token: string): void {
    if (!this.data.sessions) return;
    this.data.sessions = this.data.sessions.filter(s => s.token !== token);
    this.saveDatabase();
  }

  // Recruiter Profiles
  public getRecruiterProfile(userId: string): RecruiterProfile | undefined {
    return this.data.recruiters?.find(r => r.userId === userId);
  }

  public setRecruiterProfile(profile: RecruiterProfile): RecruiterProfile {
    if (!this.data.recruiters) this.data.recruiters = [];
    const idx = this.data.recruiters.findIndex(r => r.userId === profile.userId);
    if (idx !== -1) {
      this.data.recruiters[idx] = { ...this.data.recruiters[idx], ...profile };
    } else {
      this.data.recruiters.push(profile);
    }
    this.saveDatabase();
    return profile;
  }

  // Company management
  public getCompanyById(id: string): Company | undefined {
    return this.data.companies?.find(c => c.id === id);
  }

  public updateCompany(id: string, updates: Partial<Company>): Company | undefined {
    const idx = this.data.companies.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.data.companies[idx] = { ...this.data.companies[idx], ...updates };
      this.saveDatabase();
      neonService.saveCompany(this.data.companies[idx]).catch(err => {
        console.error('[Neon DB] updateCompany error:', err.message);
      });
      return this.data.companies[idx];
    }
    return undefined;
  }

  // Job management helpers
  public async deleteJob(id: string): Promise<boolean> {
    return this.deleteJobAsync(id);
  }

  public async deleteJobAsync(id: string): Promise<boolean> {
    const idx = this.data.jobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      this.data.jobs.splice(idx, 1);

      // Clean up associated registrations
      if (this.data.interviewRegistrations) {
        this.data.interviewRegistrations = this.data.interviewRegistrations.filter(r => r.jobId !== id);
      }
      // Clean up associated assessments
      if (this.data.assessments) {
        this.data.assessments = this.data.assessments.filter(a => a.jobId !== id);
      }
      // Clean up associated submissions
      if (this.data.assessmentSubmissions) {
        this.data.assessmentSubmissions = this.data.assessmentSubmissions.filter(s => s.jobId !== id);
      }
      // Clean up associated interviews
      if (this.data.interviews) {
        this.data.interviews = this.data.interviews.filter(i => i.jobId !== id);
      }

      this.saveDatabase();
      try {
        await neonService.deleteJob(id);
      } catch (err: any) {
        console.error('[Neon DB] deleteJob error:', err.message);
      }
      return true;
    }

    // If not found in local cache, still attempt deletion in Neon DB to prune orphaned records
    try {
      await neonService.deleteJob(id);
      return true;
    } catch (err: any) {
      console.error('[Neon DB] deleteJob fallback error:', err.message);
      return false;
    }
  }

  // Technical Assessments
  public getAssessments(recruiterId?: string, jobId?: string): TechnicalAssessment[] {
    if (!this.data.assessments) this.data.assessments = [];
    const seenJobIds = new Set<string>();
    const seenAsmtIds = new Set<string>();
    const uniqueAssessments: TechnicalAssessment[] = [];

    for (const a of this.data.assessments) {
      if (jobId && a.jobId !== jobId) continue;
      if (recruiterId && a.recruiterId !== recruiterId) continue;
      if (seenJobIds.has(a.jobId) || seenAsmtIds.has(a.id)) continue;
      seenJobIds.add(a.jobId);
      seenAsmtIds.add(a.id);
      uniqueAssessments.push(a);
    }
    return uniqueAssessments;
  }

  public getAssessmentById(id: string): TechnicalAssessment | undefined {
    return this.data.assessments?.find(a => a.id === id);
  }

  public createAssessment(assessment: TechnicalAssessment): TechnicalAssessment {
    if (!this.data.assessments) this.data.assessments = [];
    this.data.assessments.push(assessment);
    this.saveDatabase();
    neonService.saveAssessment(assessment).catch(err => {
      console.error('[Neon DB] saveAssessment error:', err.message);
    });
    return assessment;
  }

  public updateAssessment(id: string, updates: Partial<TechnicalAssessment>): TechnicalAssessment | undefined {
    if (!this.data.assessments) this.data.assessments = [];
    const idx = this.data.assessments.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.data.assessments[idx] = { ...this.data.assessments[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveDatabase();
      neonService.saveAssessment(this.data.assessments[idx]).catch(err => {
        console.error('[Neon DB] updateAssessment error:', err.message);
      });
      return this.data.assessments[idx];
    }
    return undefined;
  }

  public deleteAssessment(id: string): boolean {
    if (!this.data.assessments) return false;
    const idx = this.data.assessments.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.data.assessments.splice(idx, 1);
      this.saveDatabase();
      neonService.deleteAssessment(id).catch(err => {
        console.error('[Neon DB] deleteAssessment error:', err.message);
      });
      return true;
    }
    return false;
  }

  public async deleteAssessmentAsync(id: string): Promise<boolean> {
    if (!this.data.assessments) return false;
    const idx = this.data.assessments.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.data.assessments.splice(idx, 1);
      this.saveDatabase();
      try {
        await neonService.deleteAssessment(id);
      } catch (err: any) {
        console.error('[Neon DB] deleteAssessmentAsync error:', err.message);
      }
      return true;
    }
    return false;
  }

  // Assessment Submissions
  public getAssessmentSubmissions(jobId?: string, candidateId?: string): AssessmentSubmission[] {
    if (!this.data.assessmentSubmissions) this.data.assessmentSubmissions = [];
    return this.data.assessmentSubmissions.filter(s => {
      if (jobId && s.jobId !== jobId) return false;
      if (candidateId && s.candidateId !== candidateId) return false;
      return true;
    });
  }

  public createAssessmentSubmission(sub: AssessmentSubmission): AssessmentSubmission {
    if (!this.data.assessmentSubmissions) this.data.assessmentSubmissions = [];
    this.data.assessmentSubmissions.push(sub);
    this.saveDatabase();
    neonService.saveAssessmentSubmission(sub).catch(() => {});
    return sub;
  }

  // HR Interviews
  public getHRInterviews(jobId?: string, recruiterId?: string): HRInterviewSchedule[] {
    if (!this.data.hrInterviews) this.data.hrInterviews = [];
    return this.data.hrInterviews.filter(h => {
      if (jobId && h.jobId !== jobId) return false;
      if (recruiterId && h.recruiterId !== recruiterId) return false;
      return true;
    });
  }

  public getHRInterviewById(id: string): HRInterviewSchedule | undefined {
    return this.data.hrInterviews?.find(h => h.id === id);
  }

  public createHRInterview(interview: HRInterviewSchedule): HRInterviewSchedule {
    if (!this.data.hrInterviews) this.data.hrInterviews = [];
    this.data.hrInterviews.push(interview);
    this.saveDatabase();
    return interview;
  }

  public updateHRInterview(id: string, updates: Partial<HRInterviewSchedule>): HRInterviewSchedule | undefined {
    if (!this.data.hrInterviews) this.data.hrInterviews = [];
    const idx = this.data.hrInterviews.findIndex(h => h.id === id);
    if (idx !== -1) {
      this.data.hrInterviews[idx] = { ...this.data.hrInterviews[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveDatabase();
      return this.data.hrInterviews[idx];
    }
    return undefined;
  }

  // Offers
  public getOffers(jobId?: string, recruiterId?: string): JobOffer[] {
    if (!this.data.offers) this.data.offers = [];
    return this.data.offers.filter(o => {
      if (jobId && o.jobId !== jobId) return false;
      if (recruiterId && o.recruiterId !== recruiterId) return false;
      return true;
    });
  }

  public getOfferById(id: string): JobOffer | undefined {
    return this.data.offers?.find(o => o.id === id);
  }

  public createOffer(offer: JobOffer): JobOffer {
    if (!this.data.offers) this.data.offers = [];
    this.data.offers.push(offer);
    this.saveDatabase();
    return offer;
  }

  public updateOffer(id: string, updates: Partial<JobOffer>): JobOffer | undefined {
    if (!this.data.offers) this.data.offers = [];
    const idx = this.data.offers.findIndex(o => o.id === id);
    if (idx !== -1) {
      this.data.offers[idx] = { ...this.data.offers[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveDatabase();
      return this.data.offers[idx];
    }
    return undefined;
  }

  // Recruiter Notifications
  public getRecruiterNotifications(recruiterId: string): RecruiterNotification[] {
    if (!this.data.recruiterNotifications) this.data.recruiterNotifications = [];
    return this.data.recruiterNotifications.filter(n => n.recruiterId === recruiterId);
  }

  public createRecruiterNotification(notif: RecruiterNotification): RecruiterNotification {
    if (!this.data.recruiterNotifications) this.data.recruiterNotifications = [];
    this.data.recruiterNotifications.unshift(notif);
    this.saveDatabase();
    return notif;
  }

  public markNotificationRead(id: string, recruiterId: string): boolean {
    if (!this.data.recruiterNotifications) return false;
    const n = this.data.recruiterNotifications.find(item => item.id === id && item.recruiterId === recruiterId);
    if (n) {
      n.read = true;
      this.saveDatabase();
      return true;
    }
    return false;
  }

  // Recruiter Activity Logs
  public getRecruiterActivities(recruiterId: string, limit = 50): RecruiterActivityLog[] {
    if (!this.data.recruiterActivities) this.data.recruiterActivities = [];
    return this.data.recruiterActivities
      .filter(a => a.recruiterId === recruiterId)
      .slice(0, limit);
  }

  public logRecruiterActivity(activity: RecruiterActivityLog): RecruiterActivityLog {
    if (!this.data.recruiterActivities) this.data.recruiterActivities = [];
    this.data.recruiterActivities.unshift(activity);
    this.saveDatabase();
    return activity;
  }

  // Malpractice / Integrity Violations
  public getIntegrityViolations(jobId?: string): IntegrityViolationRecord[] {
    if (!this.data.integrityViolations) this.data.integrityViolations = [];
    return this.data.integrityViolations.filter(v => {
      if (jobId && v.jobId !== jobId) return false;
      return true;
    });
  }

  public createIntegrityViolation(violation: IntegrityViolationRecord): IntegrityViolationRecord {
    if (!this.data.integrityViolations) this.data.integrityViolations = [];
    this.data.integrityViolations.unshift(violation);
    this.saveDatabase();
    return violation;
  }

  public updateIntegrityViolation(id: string, updates: Partial<IntegrityViolationRecord>): IntegrityViolationRecord | undefined {
    if (!this.data.integrityViolations) this.data.integrityViolations = [];
    const idx = this.data.integrityViolations.findIndex(v => v.id === id);
    if (idx !== -1) {
      this.data.integrityViolations[idx] = { ...this.data.integrityViolations[idx], ...updates };
      this.saveDatabase();
      return this.data.integrityViolations[idx];
    }
    return undefined;
  }
}

export const db = new DatabaseService();
