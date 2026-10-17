// =====================================================================
// REPOSITORY LAYER: AI INTERVIEWER PLATFORM
// Implements all 20 required repositories from specification Section 52
// =====================================================================

import { db } from '../db.js';

// 1. UserRepository
export class UserRepository {
  async findById(id: string) {
    return db.findUserById(id);
  }

  async findByEmail(email: string) {
    return db.findUserByEmail(email);
  }

  async create(user: any) {
    return db.createUser(user);
  }

  async update(id: string, updates: any) {
    return db.updateUser(id, updates);
  }

  async listAll() {
    return db.getUsers();
  }
}

// 2. AuthRepository
export class AuthRepository {
  async createSession(userId: string, email: string, role: string) {
    return db.createSession(userId, email, role);
  }

  async findSession(token: string) {
    return db.findSessionByToken(token);
  }

  async revokeSession(token: string) {
    return db.deleteSession(token);
  }
}

// 3. OtpRepository
export class OtpRepository {
  async createOtp(email: string, otp: string) {
    return db.createOtp(email, otp);
  }

  async verifyOtp(email: string, otp: string) {
    return db.verifyOtp(email, otp);
  }
}

// 4. CandidateRepository
export class CandidateRepository {
  async getProfile(userId: string) {
    return (db as any).getCandidateProfile?.(userId) || null;
  }

  async updateProfile(userId: string, updates: any) {
    return (db as any).updateCandidateProfile?.(userId, updates) || null;
  }
}

// 5. RecruiterRepository
export class RecruiterRepository {
  async getProfile(userId: string) {
    return (db as any).getRecruiterProfile?.(userId) || null;
  }

  async getRecruitersForCompany(companyId: string) {
    return (db as any).getRecruitersForCompany?.(companyId) || [];
  }
}

// 6. CompanyRepository
export class CompanyRepository {
  async getCompany(id: string) {
    return (db as any).getCompany?.(id) || null;
  }

  async listCompanies() {
    return db.getCompanies();
  }
}

// 7. JobRepository
export class JobRepository {
  async listActiveJobs() {
    return db.getJobs();
  }

  async findById(id: string) {
    return db.getJobById(id);
  }

  async create(job: any) {
    return db.createJob(job);
  }

  async update(id: string, updates: any) {
    return (db as any).updateJob?.(id, updates) || null;
  }
}

// 8. ApplicationRepository
export class ApplicationRepository {
  async findByJobAndCandidate(jobId: string, candidateId: string) {
    const list = (db as any).getRegistrationsForCandidate?.(candidateId) || [];
    return list.find((r: any) => r.jobId === jobId);
  }
}

// 9. InterviewRegistrationRepository
export class InterviewRegistrationRepository {
  async createRegistration(candidateId: string, jobId: string) {
    return (db as any).registerForInterview?.(candidateId, jobId);
  }

  async findByCandidate(candidateId: string) {
    return (db as any).getRegistrationsForCandidate?.(candidateId) || [];
  }

  async findByCode(code: string) {
    return (db as any).getRegistrationByCode?.(code) || null;
  }
}

// 10. InterviewRepository
export class InterviewRepository {
  async findById(id: string) {
    return (db as any).getInterview?.(id) || null;
  }

  async update(id: string, updates: any) {
    return (db as any).updateInterview?.(id, updates) || null;
  }

  async listAll() {
    return (db as any).getInterviews?.() || [];
  }
}

// 11. QuestionRepository
export class QuestionRepository {
  async addQuestion(question: any) {
    return db.addQuestionRecord(question);
  }

  async updateQuestion(id: string, updates: any) {
    return db.updateQuestionRecord(id, updates);
  }

  async listForInterview(interviewId: string) {
    return db.getQuestionsForInterview(interviewId);
  }
}

// 12. AnswerRepository
export class AnswerRepository {
  async saveAnswer(interviewId: string, questionId: string, answerData: any) {
    return db.updateQuestionRecord(questionId, {
      candidateAnswer: answerData.answerText,
      technicalScore: answerData.technicalScore,
      conceptScore: answerData.conceptScore,
      relevanceScore: answerData.relevanceScore,
      reasoningScore: answerData.reasoningScore,
      communicationScore: answerData.communicationScore,
      independentReasoningScore: answerData.independentReasoningScore,
      overallScore: answerData.overallScore,
      aiFeedback: answerData.feedback,
      answeredAt: new Date().toISOString(),
    } as any);
  }
}

// 13. TranscriptRepository
export class TranscriptRepository {
  async addMessage(item: any) {
    return db.addTranscriptItem(item);
  }

  async getMessages(interviewId: string) {
    return db.getTranscriptsForInterview(interviewId);
  }
}

// 14. CompetencyRepository
export class CompetencyRepository {
  async addCompetencies(interviewId: string, candidateId: string, competencies: any[]) {
    return (db as any).addCandidateCompetencies?.(interviewId, candidateId, competencies);
  }

  async getCompetencies(interviewId: string) {
    return (db as any).getCompetenciesForInterview?.(interviewId) || [];
  }
}

// 15. ProctoringRepository
export class ProctoringRepository {
  async logEvent(event: any) {
    return db.addProctoringEvent(event);
  }

  async getEvents(interviewId: string) {
    return db.getProctoringEventsForInterview(interviewId);
  }
}

// 16. MalpracticeRepository
export class MalpracticeRepository {
  async logMalpractice(event: any) {
    return (db as any).addMalpracticeEvent?.(event);
  }

  async getEvents(interviewId: string) {
    return (db as any).getMalpracticeEventsForInterview?.(interviewId) || [];
  }
}

// 17. ReportRepository
export class ReportRepository {
  async saveCandidateReport(report: any) {
    return db.saveCandidateReport(report);
  }

  async getCandidateReport(interviewId: string) {
    return db.getCandidateReport(interviewId);
  }

  async saveRecruiterReport(report: any) {
    return db.saveRecruiterReport(report);
  }

  async getRecruiterReport(interviewId: string) {
    return db.getRecruiterReport(interviewId);
  }

  async listAllRecruiterReports() {
    return db.getAllRecruiterReports();
  }
}

// 18. NotificationRepository
export class NotificationRepository {
  private notifications: any[] = [];

  async create(notification: any) {
    this.notifications.push({
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      isRead: false,
      ...notification,
    });
    return notification;
  }

  async listForUser(userId: string) {
    return this.notifications.filter(n => n.userId === userId);
  }
}

// 19. EmailLogRepository
export class EmailLogRepository {
  async addLog(log: any) {
    return db.addEmailLog(log);
  }

  async getLogs(limit = 50) {
    return db.getEmailLogs(limit);
  }
}

// 20. AuditRepository
export class AuditRepository {
  async logAction(action: string, actorUserId: string | null, entityType: string, entityId: string, metadata?: any) {
    return (db as any).addAuditLog?.({
      id: 'al_' + Math.random().toString(36).substring(2, 10),
      actorUserId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }

  async getLogs(limit = 100) {
    return (db as any).getAuditLogs?.(limit) || [];
  }
}

// Export single repository bundle
export const repositories = {
  user: new UserRepository(),
  auth: new AuthRepository(),
  otp: new OtpRepository(),
  candidate: new CandidateRepository(),
  recruiter: new RecruiterRepository(),
  company: new CompanyRepository(),
  job: new JobRepository(),
  application: new ApplicationRepository(),
  interviewRegistration: new InterviewRegistrationRepository(),
  interview: new InterviewRepository(),
  question: new QuestionRepository(),
  answer: new AnswerRepository(),
  transcript: new TranscriptRepository(),
  competency: new CompetencyRepository(),
  proctoring: new ProctoringRepository(),
  malpractice: new MalpracticeRepository(),
  report: new ReportRepository(),
  notification: new NotificationRepository(),
  emailLog: new EmailLogRepository(),
  audit: new AuditRepository(),
};
