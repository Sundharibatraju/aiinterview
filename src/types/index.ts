// Shared Data Types and Enums for AI Interviewer Platform

export enum UserRole {
  CANDIDATE = 'CANDIDATE',
  RECRUITER = 'RECRUITER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  LOCKED = 'LOCKED',
}

export enum JobStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
  EXPIRED = 'EXPIRED',
}

export enum WorkMode {
  ONSITE = 'Onsite',
  HYBRID = 'Hybrid',
  REMOTE = 'Remote',
}

export enum EmploymentType {
  FULL_TIME = 'Full Time',
  INTERNSHIP = 'Internship',
  CONTRACT = 'Contract',
}

export enum ApplicationStatus {
  REGISTERED = 'REGISTERED',
  WITHDRAWN = 'WITHDRAWN',
  REJECTED = 'REJECTED',
  SHORTLISTED = 'SHORTLISTED',
  INTERVIEW_READY = 'INTERVIEW_READY',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SELECTED = 'SELECTED',
  ON_HOLD = 'ON_HOLD',
}

export enum InterviewStatus {
  NOT_STARTED = 'NOT_STARTED',
  READY_TO_ATTEND = 'READY_TO_ATTEND',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED',
  MALPRACTICE_TERMINATED = 'MALPRACTICE_TERMINATED',
  EXPIRED = 'EXPIRED',
}

export enum QuestionDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  ADVANCED = 'ADVANCED',
}

export enum QuestionType {
  CONCEPTUAL = 'CONCEPTUAL',
  PROJECT_BASED = 'PROJECT_BASED',
  SCENARIO = 'SCENARIO',
  DEBUGGING = 'DEBUGGING',
  CODING_REASONING = 'CODING_REASONING',
  FAILURE_ANALYSIS = 'FAILURE_ANALYSIS',
  COMPARISON = 'COMPARISON',
  OPTIMIZATION = 'OPTIMIZATION',
  DESIGN_DECISION = 'DESIGN_DECISION',
  FOLLOW_UP = 'FOLLOW_UP',
  PRIORITY_EVALUATION = 'PRIORITY_EVALUATION',
}

export enum RoundType {
  RESUME_SCREENING = 'RESUME_SCREENING',
  TECHNICAL_ASSESSMENT = 'TECHNICAL_ASSESSMENT',
  AI_INTERVIEW = 'AI_INTERVIEW',
  HR_INTERVIEW = 'HR_INTERVIEW',
  FINAL_REVIEW = 'FINAL_REVIEW',
  CUSTOM = 'CUSTOM',
}

export enum RoundStatus {
  LOCKED = 'LOCKED',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  QUALIFIED = 'QUALIFIED',
  REJECTED = 'REJECTED',
  ON_HOLD = 'ON_HOLD',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

export interface PipelineRound {
  id?: string;
  roundNumber: number;
  name: string;
  type?: RoundType;
  roundType?: RoundType;
  description: string;
  evaluationCriteria: string[];
  eligibilityConditions?: string;
  eligibilityCondition?: string;
  minQualifyingScore: number;
  instructions: string;
}

export type PipelineRoundConfig = PipelineRound;

export interface RecruiterDefinedQuestion {
  id: string;
  questionText: string;
  question?: string;
  topic: string;
  difficulty?: QuestionDifficulty;
  isPriority: boolean; // Important/Priority: triggers deep follow-up evaluation
  evaluationCriteria?: string;
  expectedKeyPoints?: string[];
}

export type RecruiterInterviewQuestion = RecruiterDefinedQuestion;

export interface InterviewPipelineConfig {
  jobId?: string;
  minDurationMinutes?: number;
  maxDurationMinutes: number;
  targetFocusTopics: string[];
  customQuestions: RecruiterDefinedQuestion[];
  instructionsForAI?: string;
  evaluationExpectations: string;
  numQuestions?: number;
  numTechnicalQuestions?: number;
  numCodingQuestions?: number;
  numMcqQuestions?: number;
}

export interface RoundProgressionRecord {
  roundNumber: number;
  roundName: string;
  roundType: RoundType;
  status: RoundStatus;
  score?: number;
  minQualifyingScore?: number;
  feedback?: string;
  evaluatedAt?: string;
  completedAt?: string;
  actionUrlOrCode?: string;
}

export interface CandidateReceivedEmail {
  id: string;
  toEmail?: string;
  subject: string;
  content?: string;
  body?: string;
  sentAt: string;
  senderName: string;
  template?: string;
  status?: string;
  payloadPreview?: string;
  fullContent?: string;
  category?: 'ROUND_QUALIFICATION' | 'INTERVIEW_INVITATION' | 'OFFER' | 'REJECTION' | 'GENERAL';
}

export enum CandidateIntent {
  ANSWER = 'ANSWER',
  THINKING_TIME_REQUEST = 'THINKING_TIME_REQUEST',
  HINT_REQUEST = 'HINT_REQUEST',
  REPEAT_REQUEST = 'REPEAT_REQUEST',
  CLARIFICATION_REQUEST = 'CLARIFICATION_REQUEST',
  SKIP_REQUEST = 'SKIP_REQUEST',
  GIVE_UP = 'GIVE_UP',
  READY_TO_CONTINUE = 'READY_TO_CONTINUE',
  CANDIDATE_QUESTION = 'CANDIDATE_QUESTION',
  ANSWER_CORRECTION = 'ANSWER_CORRECTION',
}

export enum AIAssistanceRisk {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
}

export enum FinalRecommendation {
  STRONGLY_HIRE = 'STRONGLY_HIRE',
  HIRE = 'HIRE',
  CONSIDER = 'CONSIDER',
  DO_NOT_HIRE = 'DO_NOT_HIRE',
  STRONG_YES = 'STRONG_YES',
  YES = 'YES',
  BORDERLINE = 'BORDERLINE',
  NO = 'NO',
}

export enum ProctoringEventType {
  TAB_SWITCH = 'TAB_SWITCH',
  WINDOW_BLUR = 'WINDOW_BLUR',
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT',
  CAMERA_DISABLED = 'CAMERA_DISABLED',
  MIC_DISABLED = 'MIC_DISABLED',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
  NO_FACE_DETECTED = 'NO_FACE_DETECTED',
  COPY_PASTE = 'COPY_PASTE',
  SUSPICIOUS_KEYSTROKE = 'SUSPICIOUS_KEYSTROKE',
}

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  fullName: string;
  name?: string;
  role: UserRole;
  isVerified: boolean;
  googleId?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EducationDetails {
  class10School?: string;
  class10Board?: string;
  class10Percentage?: string;
  class10Year?: string;
  
  secondaryType?: '12th' | 'Diploma'; // 12th or Diploma
  class12College?: string;
  class12Stream?: string;
  class12Percentage?: string;
  class12Year?: string;

  diplomaCollege?: string;
  diplomaBranch?: string;
  diplomaPercentage?: string;
  diplomaYear?: string;

  degreeName?: string; // B.Tech, B.E., B.Sc, BCA, etc.
  degreeSpecialization?: string; // Computer Science, etc.
  degreeCollege?: string;
  degreeCgpa?: string;
  degreeYear?: string;
}

export interface CandidateProfile {
  id: string;
  userId: string;
  phone?: string;
  location?: string;
  education?: string;
  experienceYears?: number;
  skills: string[];
  certifications?: string[];
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  resumeText?: string;
  resumeFileName?: string;
  bio?: string;
  projects?: string[];
  educationDetails?: EducationDetails;
  extractedProfile?: any;
}

export interface RecruiterProfile {
  id: string;
  userId: string;
  companyId: string;
  designation: string;
  department?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedIn?: string;
  profilePhoto?: string;
  summary?: string;
  title?: string;
  recruitmentExperienceYears?: number;
  hiringSpecialties?: string[];
  areasOfRecruitment?: string[];
  preferredLocations?: string[];
  emailNotifications?: boolean;
  interviewNotifications?: boolean;
  applicationNotifications?: boolean;
  assessmentNotifications?: boolean;
  offerNotifications?: boolean;
}

export interface Company {
  id: string;
  name: string;
  website?: string;
  logoUrl?: string;
  description: string;
  industry: string;
  location: string;
  companySize?: string;
  headquarters?: string;
  companyType?: string;
  foundedYear?: number | string;
}

export interface Job {
  id: string;
  companyId: string;
  recruiterId: string;
  title: string;
  jobCode?: string;
  department?: string;
  description: string;
  responsibilities?: string;
  openings?: number;
  salaryPackage?: string;
  registrationClosingDate?: string;
  eligibilityCriteria?: string;
  requiredSkills: string[];
  requiredCertifications?: string[];
  preferredSkills: string[];
  qualification: string;
  experience: string;
  experienceRequirements?: string;
  educationRequirements?: string;
  location: string;
  country?: string;
  state?: string;
  city?: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceLevel?: string;
  minPackage: number;
  maxPackage: number;
  currency: string;
  payFrequency?: string;
  deadline: string;
  autoCloseDate?: string;
  candidateLimit?: number;
  atsThreshold?: number;
  requiresAssessment?: boolean;
  requiresAiInterview?: boolean;
  requiresHrInterview?: boolean;
  requiresFinalReview?: boolean;
  durationMinutes: number;
  numQuestions: number;
  numTechnicalQuestions?: number;
  numCodingQuestions?: number;
  numMcqQuestions?: number;
  status: JobStatus;
  createdAt: string;
  updatedAt?: string;
  additionalInformation?: string;
  authenticityNoticeVerified?: boolean;
  technicalAssessmentQuestions?: AssessmentQuestion[];
  technicalAssessmentCode?: string; // 12-digit code linking to questions posted by recruiter
  metadata?: Record<string, any>;
  rounds?: PipelineRound[];
  interviewConfig?: InterviewPipelineConfig;
  company?: Company;
  interviewStartDate?: string;
  interviewStartTime?: string;
  interviewEndDate?: string;
  interviewEndTime?: string;
}

export interface PipelineHistoryItem {
  id: string;
  fromStage: number;
  toStage: number;
  action: 'SELECTED' | 'MOVED_STAGE' | 'REJECTED' | 'OFFER_CREATED' | 'OFFER_SENT' | 'ON_HOLD' | 'RESET';
  movedBy: string;
  movedByName?: string;
  timestamp: string;
  reason?: string;
  notes?: string;
}

export interface CandidateCumulativeScores {
  atsScore?: number;
  skillsMatch?: number;
  experienceMatch?: number;
  aptitudeScore?: number;
  codingScore?: number;
  technicalScore?: number;
  assessmentPercentage?: number;
  aiInterviewScore?: number;
  problemSolvingScore?: number;
  communicationScore?: number;
  hrScore?: number;
  behavioralScore?: number;
  teamAlignmentScore?: number;
  overallScore?: number;
}

export interface InterviewRegistration {
  id: string;
  candidateId: string;
  jobId: string;
  companyId: string;
  status: ApplicationStatus;
  interviewStatus: InterviewStatus;
  registeredAt: string;
  interviewCode: string;
  technicalAssessmentCode?: string; // 12-digit alphanumeric code for Round 2 Technical Assessment
  technicalAssessmentCompleted?: boolean;
  technicalAssessmentScore?: number;
  aptitudeScore?: number;
  codingScore?: number;
  expiresAt: string;
  job?: Job;
  candidate?: User;
  attemptCount: number;
  maxAttempts: number;
  interviewStartDate?: string;
  interviewStartTime?: string;
  interviewEndDate?: string;
  interviewEndTime?: string;
  computedStatus?: 'Completed' | 'Attend Interview' | 'Continue Interview' | 'Not Started' | 'Expired';
  currentRoundNumber?: number;
  selectedForStage?: boolean;
  isSelectedForStage?: boolean;
  selectedAt?: string;
  selectedBy?: string;
  roundProgression?: RoundProgressionRecord[];
  overallPipelineStatus?: 'IN_PROGRESS' | 'QUALIFIED' | 'REJECTED' | 'ON_HOLD' | 'SELECTED' | 'OFFERED';
  atsScore?: number;
  atsFeedback?: string;
  clearedResumeScreening?: boolean;
  skillsMatch?: number;
  experienceMatch?: number;
  educationMatch?: number;
  scores?: CandidateCumulativeScores;
  stageMovementHistory?: PipelineHistoryItem[];
  rejectionReason?: string;
  rejectionCategory?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  candidateEmailsReceived?: CandidateReceivedEmail[];
  offerId?: string;
  atsDetails?: AtsEvaluationDetails;
}

export interface AtsEvaluationDetails {
  atsScore: number;
  isQualified: boolean;
  scoreBreakdown?: {
    keywordSkillMatchScore: number;
    experienceRelevanceScore: number;
    educationEligibilityScore: number;
    depthAndImpactScore: number;
    formattingAndClarityScore: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  candidateStrengths?: string[];
  candidateWeaknesses?: string[];
  experienceMatchSummary?: string;
  educationMatchSummary?: string;
  projectAnalysisSummary?: string;
  coreSkillSetMatchSummary?: string;
  eligibilityCheckPassed: boolean;
  feedback: string;
  recommendation: string;
  evaluatedAt: string;
}

export interface TestCase {
  id?: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  explanation?: string;
}

export interface AssessmentQuestion {
  id: string;
  questionText: string;
  type: 'MULTIPLE_CHOICE' | 'CODING' | 'SHORT_ANSWER';
  options?: string[]; // 4 options for MCQs
  correctOptionIndex?: number; // Index 0-3 of correct option for MCQ
  marks: number;
  skillsTested: string[];
  // Coding question specific fields
  codingTemplate?: string;
  codingLanguage?: string;
  testCases?: TestCase[]; // List of manual test cases with input & expectedOutput
  sampleInput?: string;
  sampleOutput?: string;
  explanation?: string;
}

export interface TechnicalAssessment {
  id: string;
  jobId: string;
  companyId: string;
  recruiterId: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  difficulty: QuestionDifficulty;
  skillsTested: string[];
  questions: AssessmentQuestion[];
  technicalAssessmentCode?: string;
  negativeMarking: boolean;
  randomization: boolean;
  attemptLimit: number;
  antiCheatingEnabled: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentSubmission {
  id: string;
  assessmentId: string;
  candidateId: string;
  registrationId: string;
  jobId: string;
  score: number;
  percentage: number;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  timeTakenMinutes: number;
  passed: boolean;
  aptitudeScore?: number;
  codingScore?: number;
  integrityStatus: 'CLEAN' | 'FLAGGED';
  submittedAt: string;
  answers?: {
    questionId: string;
    selectedOption?: number;
    answerText?: string;
    isCorrect: boolean;
    marksAwarded: number;
  }[];
}

export interface HRInterviewSchedule {
  id: string;
  registrationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  recruiterId: string;
  interviewerName: string;
  interviewerEmail?: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  meetingLink: string;
  interviewLocation?: string;
  interviewType: 'ONLINE' | 'IN_PERSON' | 'PHONE';
  notes?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  evaluation?: {
    hrScore: number;
    communicationScore: number;
    behavioralScore: number;
    teamAlignmentScore: number;
    notes: string;
    recommendation: 'STRONGLY_HIRE' | 'HIRE' | 'HOLD' | 'REJECT' | 'CONSIDER' | 'DO_NOT_HIRE';
    completedAt: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface JobOffer {
  id: string;
  registrationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  recruiterId: string;
  positionTitle: string;
  salary: number;
  currency: string;
  payFrequency: string;
  employmentType: EmploymentType;
  startDate: string;
  offerExpiryDate: string;
  benefits: string[];
  location: string;
  additionalTerms?: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN';
  sentAt?: string;
  respondedAt?: string;
  withdrawnAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecruiterNotification {
  id: string;
  recruiterId: string;
  type:
    | 'NEW_APPLICATION'
    | 'CANDIDATE_SELECTED'
    | 'STAGE_MOVED'
    | 'ASSESSMENT_COMPLETED'
    | 'AI_INTERVIEW_COMPLETED'
    | 'HR_INTERVIEW_COMPLETED'
    | 'INTERVIEW_SCHEDULED'
    | 'CANDIDATE_REJECTED'
    | 'EMAIL_SENT'
    | 'OFFER_ACCEPTED'
    | 'OFFER_DECLINED'
    | 'INTEGRITY_VIOLATION';
  title: string;
  message: string;
  read: boolean;
  relatedId?: string;
  candidateName?: string;
  jobTitle?: string;
  createdAt: string;
}

export interface RecruiterActivityLog {
  id: string;
  recruiterId: string;
  action: string;
  details: string;
  candidateId?: string;
  candidateName?: string;
  jobId?: string;
  jobTitle?: string;
  timestamp: string;
}

export interface IntegrityViolationRecord {
  id: string;
  interviewId?: string;
  registrationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  violationType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'REVIEW_REQUIRED' | 'CONFIRMED' | 'DISMISSED';
  timestamp: string;
  evidence?: string;
  recruiterNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ProctoringEvent {
  id: string;
  interviewId: string;
  candidateId: string;
  eventType: ProctoringEventType;
  severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
  timestamp: string;
  metadata?: string;
  warningNumber: number;
}

export interface TranscriptItem {
  id: string;
  interviewId: string;
  speaker: 'AI' | 'CANDIDATE';
  message: string;
  timestamp: string;
  intent?: CandidateIntent;
  questionIndex?: number;
}

export interface QuestionRecord {
  id: string;
  interviewId: string;
  questionIndex: number;
  questionText: string;
  questionType: QuestionType;
  difficulty: QuestionDifficulty;
  conceptTested: string;
  expectedKeyPoints: string[];
  candidateAnswer?: string;
  technicalCorrectness?: number; // 0-100
  conceptCoverage?: number; // 0-100
  feedback?: string;
  hintsUsed: number;
  responseTimeSeconds?: number;
  aiAssistanceFlag?: boolean;
}

export interface CandidateCompetency {
  skillName: string;
  competencyLevel: 'Strong' | 'Good' | 'Developing' | 'Needs Improvement';
  score: number; // 0 - 100
  notes: string;
}

export interface CandidateReport {
  id: string;
  interviewId: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  interviewDate: string;
  durationMinutes: number;
  questionsAsked: {
    question: string;
    type: string;
    candidateAnswer: string;
    referenceConcepts: string[];
    technicalCorrectness: string;
    conceptCoverage: string;
    feedback: string;
  }[];
  aiFeedback: string;
  strongAreas: string[];
  areasToImprove: string[];
  learningRecommendations: string[];
  overallSummary: string;
  completionStatus: string;
}

export interface RecruiterReport {
  id: string;
  interviewId: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  interviewDate: string;
  durationMinutes: number;
  applicationStatus: ApplicationStatus;
  interviewStatus: InterviewStatus;
  overallScore: number; // 0 - 100
  competencyMap: CandidateCompetency[];
  technicalCapabilityRating: string;
  problemSolvingRating: string;
  communicationRating: string;
  independentReasoningRating: string;
  hintsUsedTotal: number;
  skippedQuestionsTotal: number;
  difficultyProgression: string[];
  averageResponseTimeSeconds: number;
  strongTopics: string[];
  weakTopics: string[];
  aiAssistanceRisk: AIAssistanceRisk;
  aiAssistanceSignals: string[];
  proctoringEvents: ProctoringEvent[];
  proctoringFlags?: string[];
  warningsIssued: number;
  interviewIntegrityStatus: 'VERIFIED_CLEAN' | 'FLAGS_OBSERVED' | 'TERMINATED_MALPRACTICE';
  finalRecommendation: 'STRONGLY_HIRE' | 'HIRE' | 'CONSIDER' | 'DO_NOT_HIRE';
  recruiterNotes?: string;
  transcript: TranscriptItem[];
}

export interface EmailLog {
  id: string;
  toEmail: string;
  subject: string;
  template: 'EMAIL_OTP' | 'INTERVIEW_REGISTRATION' | 'INTERVIEW_REPORT' | 'OTHER';
  status: 'SENT' | 'FAILED' | 'PENDING';
  payloadPreview: string;
  sentAt: string;
  fullContent?: string;
}
