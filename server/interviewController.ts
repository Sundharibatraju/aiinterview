import { db } from './db.js';
import { geminiService } from './gemini.js';
import { emailService } from './email.js';
import {
  InterviewStatus,
  ApplicationStatus,
  QuestionDifficulty,
  QuestionType,
  ProctoringEventType,
  ProctoringEvent,
  QuestionRecord,
  CandidateIntent,
  AIAssistanceRisk,
} from '../src/types/index.js';

interface ActiveSession {
  registrationId: string;
  candidateId: string;
  jobId: string;
  companyId: string;
  status: InterviewStatus;
  startedAt: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentDifficulty: QuestionDifficulty;
  currentHintLevel: number;
  warningCount: number;
  candidateIntroduction?: string;
  extractedBackground?: any;
  questions: QuestionRecord[];
  questionStartTime: number;
  lastPerformance?: 'STRONG' | 'PARTIAL' | 'WEAK';
  coveredConcepts: string[];
}

class InterviewOrchestrator {
  private activeSessions: Map<string, ActiveSession> = new Map();

  /**
   * Validate candidate access code before entering lobby/interview.
   * Enforces all 12 backend verification checks:
   * 1. candidate exists & is verified
   * 2. code valid
   * 3. code belongs to candidate
   * 4. code belongs to job
   * 5. registration active & job active
   * 6. access period valid
   * 7. interview not completed / blocked
   */
  public validateAccessCode(code: string, candidateEmail: string): {
    success: boolean;
    message: string;
    registration?: any;
    job?: any;
    company?: any;
    isTechnicalCode?: boolean;
  } {
    const user = db.findUserByEmail(candidateEmail);
    if (!user) {
      return { success: false, message: 'Account not found. Please register first.' };
    }
    if (!user.isVerified) {
      return { success: false, message: 'Email verification required before accessing interviews.' };
    }

    let reg = db.findRegistrationByCode(code);
    let isTechnicalCode = false;
    if (!reg) {
      reg = db.findRegistrationByTechnicalAssessmentCode(code);
      if (reg) isTechnicalCode = true;
    }
    if (!reg) {
      return { success: false, message: 'Invalid access code. Please check your registration confirmation email.' };
    }

    if (reg.candidateId !== user.id) {
      return { success: false, message: 'This interview access code was issued to a different candidate.' };
    }

    if (reg.interviewStatus === InterviewStatus.COMPLETED) {
      return { success: false, message: 'This interview has already been completed.' };
    }

    if (reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED || reg.interviewStatus === InterviewStatus.TERMINATED) {
      return { success: false, message: 'This interview session was terminated due to integrity policy violations.' };
    }

    const attempts = reg.attemptCount || 0;
    const maxAttempts = reg.maxAttempts || 1;
    if (attempts >= maxAttempts && reg.interviewStatus !== InterviewStatus.IN_PROGRESS) {
      return { success: false, message: 'Only 1 interview attempt is permitted. Your single allowed attempt has already been utilized.' };
    }

    // Schedule window checks
    const now = Date.now();
    if (reg.interviewStartDate && reg.interviewStartTime) {
      const startDateTime = new Date(`${reg.interviewStartDate}T${reg.interviewStartTime}`).getTime();
      if (!isNaN(startDateTime) && now < startDateTime) {
        return {
          success: false,
          message: `This interview is not open yet. Scheduled start: ${reg.interviewStartDate} at ${reg.interviewStartTime}.`,
        };
      }
    }

    if (reg.interviewEndDate && reg.interviewEndTime) {
      const endDateTime = new Date(`${reg.interviewEndDate}T${reg.interviewEndTime}`).getTime();
      if (!isNaN(endDateTime) && now > endDateTime) {
        return {
          success: false,
          message: `This interview access period expired on ${reg.interviewEndDate} at ${reg.interviewEndTime}.`,
        };
      }
    }

    if (reg.expiresAt && new Date(reg.expiresAt).getTime() < now) {
      return { success: false, message: 'This interview registration access window has expired.' };
    }

    const job = db.getJobById(reg.jobId);
    if (!job || job.status !== 'ACTIVE') {
      return { success: false, message: 'The job opportunity for this interview is no longer active.' };
    }

    // Strict Pipeline Rule: Candidate can only access AI Interview after passing Technical Assessment
    const round2 = Array.isArray(reg.roundProgression)
      ? reg.roundProgression.find(r => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')
      : undefined;
    if (round2) {
      if (round2.status === 'REJECTED') {
        const isMalpractice = (round2.score != null && round2.score >= (round2.minQualifyingScore || 60)) ||
          round2.feedback?.toLowerCase().includes('malpractice') ||
          (reg.interviewStatus as any) === InterviewStatus.MALPRACTICE_TERMINATED;
        const achieved = round2.score != null ? `${round2.score}%` : 'below cutoff';
        const cutoff = round2.minQualifyingScore != null ? `${round2.minQualifyingScore}%` : 'cutoff';
        const message = isMalpractice
          ? `Application Disqualified: Scored ${achieved} on Technical Assessment, but session was terminated by anti-malpractice proctoring protocols (${round2.feedback || 'Integrity violations detected'}). Candidate is not eligible for the AI Interview.`
          : `Application Rejected: You scored ${achieved} on the Round 2 Technical Assessment (Qualifying cutoff was ${cutoff}). You did not qualify to attend the AI Interview in this portal.`;
        return {
          success: false,
          message,
        };
      }
      if (round2.status !== 'QUALIFIED') {
        return {
          success: false,
          isTechnicalCode,
          registration: reg,
          message: isTechnicalCode
            ? 'This is your 12-digit Technical Assessment code. Please complete the Round 2 Technical Assessment before proceeding to the Round 3 AI Interview.'
            : 'AI Interview Locked: You must first complete the Technical Assessment in the Assessment Portal with your registered email and 12-digit code, and satisfy the qualifying score cutoff.',
        };
      }
    }

    return {
      success: true,
      message: 'Access granted.',
      registration: reg,
      job,
      company: job.company,
    };
  }

  /**
   * Start or resume interview session.
   */
  public async startInterview(registrationId: string): Promise<{
    session: ActiveSession;
    firstQuestion: QuestionRecord;
    spokenGreeting: string;
  }> {
    const reg = db.getRegistrationById(registrationId);
    if (!reg) throw new Error('Registration not found');

    const job = db.getJobById(reg.jobId);
    if (!job) throw new Error('Job not found');

    const candidate = db.findUserById(reg.candidateId);
    const candidateName = candidate ? candidate.fullName.split(' ')[0] : 'there';
    const profile = db.getCandidateProfile(reg.candidateId);

    // Strict Pipeline Rule: Candidate can only start AI Interview after clearing Technical Assessment
    const round2 = Array.isArray(reg.roundProgression)
      ? reg.roundProgression.find(r => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')
      : undefined;
    if (round2) {
      if (round2.status === 'REJECTED') {
        const isMalpractice = (round2.score != null && round2.score >= (round2.minQualifyingScore || 60)) ||
          round2.feedback?.toLowerCase().includes('malpractice') ||
          (reg.interviewStatus as any) === InterviewStatus.MALPRACTICE_TERMINATED;
        const achieved = round2.score != null ? `${round2.score}%` : 'below cutoff';
        const cutoff = round2.minQualifyingScore != null ? `${round2.minQualifyingScore}%` : 'cutoff';
        const message = isMalpractice
          ? `Application Disqualified: Scored ${achieved} on Technical Assessment, but session was terminated by anti-malpractice proctoring protocols (${round2.feedback || 'Integrity violations detected'}). Candidate is not eligible for the AI Interview.`
          : `Application Rejected: Scored ${achieved} on Technical Assessment (Cutoff: ${cutoff}). Candidate is not qualified for the AI Interview.`;
        throw new Error(message);
      }
      if (round2.status !== 'QUALIFIED') {
        throw new Error('AI Interview Locked: You must first pass the Technical Assessment in the external Assessment Portal before accessing the AI Interview.');
      }
    }

    // Check existing or initialize
    let session = this.activeSessions.get(registrationId);
    const isResuming = !!session;

    if (!session) {
      // Check attempt limit
      const currentAttempts = reg.attemptCount || 0;
      const maxAttempts = reg.maxAttempts || 1;
      if (currentAttempts >= maxAttempts && reg.interviewStatus !== InterviewStatus.IN_PROGRESS) {
        throw new Error('Only 1 interview attempt is permitted. You have already completed your single allowed attempt.');
      }

      // Check if resuming from database persisted state
      const existingQuestions = db.getQuestionsForInterview(registrationId);
      const isAlreadyStarted = reg.interviewStatus === InterviewStatus.IN_PROGRESS && existingQuestions.length > 0;

      // Only increment attempt count if this is a fresh attempt
      const newAttempts = isAlreadyStarted ? currentAttempts : currentAttempts + 1;
      db.updateRegistration(registrationId, {
        attemptCount: newAttempts,
        interviewStatus: InterviewStatus.IN_PROGRESS,
      });

      session = {
        registrationId,
        candidateId: reg.candidateId,
        jobId: reg.jobId,
        companyId: reg.companyId,
        status: InterviewStatus.IN_PROGRESS,
        startedAt: Date.now(),
        currentQuestionIndex: isAlreadyStarted ? existingQuestions.length : 1,
        totalQuestions: job.numQuestions || 5,
        currentDifficulty: isAlreadyStarted
          ? (existingQuestions[existingQuestions.length - 1]?.difficulty || QuestionDifficulty.EASY)
          : QuestionDifficulty.EASY,
        currentHintLevel: 0,
        warningCount: 0,
        questions: isAlreadyStarted ? existingQuestions : [],
        questionStartTime: Date.now(),
        coveredConcepts: isAlreadyStarted ? existingQuestions.map(q => q.conceptTested) : [],
      };
      this.activeSessions.set(registrationId, session);
    } else {
      session.status = InterviewStatus.IN_PROGRESS;
      db.updateRegistration(registrationId, { interviewStatus: InterviewStatus.IN_PROGRESS });
    }

    // Section 32 & Requirement 9/10:
    // First core interview question is self-introduction, customized with resume details if available
    const resumeSkillsSnippet = profile?.skills && profile.skills.length > 0
      ? ` with skills in ${profile.skills.slice(0, 3).join(', ')}`
      : '';

    const introQuestionText = `Hello ${candidateName}, welcome to your technical interview for the ${job.title} position at ${job.company?.name || 'our company'}. We reviewed your background${resumeSkillsSnippet}. To begin, please introduce yourself, tell me about your technical journey, and highlight key projects you have built.`;

    const introQuestion: QuestionRecord = {
      id: `q_${registrationId}_1`,
      interviewId: registrationId,
      questionIndex: 1,
      questionText: introQuestionText,
      questionType: QuestionType.CONCEPTUAL,
      difficulty: QuestionDifficulty.EASY,
      conceptTested: 'Technical Background & Introduction',
      expectedKeyPoints: ['Education/Experience', 'Primary programming skills', 'Core projects demonstrated'],
      hintsUsed: 0,
    };

    if (session.questions.length === 0) {
      session.questions.push(introQuestion);
      session.questionStartTime = Date.now();
      db.addQuestionRecord(introQuestion);

      // Record AI opening transcript
      db.addTranscriptItem({
        id: 'tr_' + Math.random().toString(36).substr(2, 9),
        interviewId: registrationId,
        speaker: 'AI',
        message: introQuestion.questionText,
        timestamp: new Date().toISOString(),
        questionIndex: 1,
      });
    }

    const currentQ = session.questions[session.currentQuestionIndex - 1] || introQuestion;

    return {
      session,
      firstQuestion: currentQ,
      spokenGreeting: currentQ.questionText,
    };
  }

  /**
   * Handle candidate speech input (STT transcript).
   */
  public async handleCandidateSpeech(params: {
    registrationId: string;
    candidateSpeech: string;
  }): Promise<{
    interviewerResponse: string;
    status: InterviewStatus;
    questionIndex: number;
    totalQuestions: number;
    currentQuestion?: QuestionRecord;
    isInterviewFinished: boolean;
    progressiveHint?: string;
    intent: CandidateIntent;
  }> {
    const session = this.activeSessions.get(params.registrationId);
    if (!session) throw new Error('No active session found for this registration');

    const reg = db.getRegistrationById(params.registrationId);
    const job = reg ? db.getJobById(reg.jobId) : undefined;
    const candidate = reg ? db.findUserById(reg.candidateId) : undefined;
    const candidateName = candidate ? candidate.fullName.split(' ')[0] : 'there';

    const currentQuestion = session.questions[session.currentQuestionIndex - 1];
    if (!currentQuestion) throw new Error('Current question out of bounds');

    const elapsedSeconds = Math.max(3, Math.round((Date.now() - session.questionStartTime) / 1000));

    // 1. Log Candidate speech to transcript
    db.addTranscriptItem({
      id: 'tr_' + Math.random().toString(36).substr(2, 9),
      interviewId: params.registrationId,
      speaker: 'CANDIDATE',
      message: params.candidateSpeech,
      timestamp: new Date().toISOString(),
      questionIndex: session.currentQuestionIndex,
    });

    // 2. Intent Detection
    const intentResult = await geminiService.classifyIntent(params.candidateSpeech, currentQuestion.questionText);

    // Handle conversational intents (thinking time, repetition, hints, audio check)
    if (intentResult.intent === CandidateIntent.CANDIDATE_QUESTION) {
      const reply = intentResult.replyIfSpecial || `Yes ${candidateName}, I can hear you clearly! Please go ahead with your response.`;
      db.addTranscriptItem({
        id: 'tr_' + Math.random().toString(36).substr(2, 9),
        interviewId: params.registrationId,
        speaker: 'AI',
        message: reply,
        timestamp: new Date().toISOString(),
        intent: CandidateIntent.CANDIDATE_QUESTION,
      });
      return {
        interviewerResponse: reply,
        status: session.status,
        questionIndex: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        currentQuestion,
        isInterviewFinished: false,
        intent: CandidateIntent.CANDIDATE_QUESTION,
      };
    }

    if (intentResult.intent === CandidateIntent.THINKING_TIME_REQUEST) {
      const reply = intentResult.replyIfSpecial || `Of course, ${candidateName}. Take your time. Tell me when you're ready.`;
      db.addTranscriptItem({
        id: 'tr_' + Math.random().toString(36).substr(2, 9),
        interviewId: params.registrationId,
        speaker: 'AI',
        message: reply,
        timestamp: new Date().toISOString(),
        intent: CandidateIntent.THINKING_TIME_REQUEST,
      });
      return {
        interviewerResponse: reply,
        status: session.status,
        questionIndex: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        currentQuestion,
        isInterviewFinished: false,
        intent: CandidateIntent.THINKING_TIME_REQUEST,
      };
    }

    if (intentResult.intent === CandidateIntent.REPEAT_REQUEST) {
      const reply = `Certainly, ${candidateName}. The question is: "${currentQuestion.questionText}"`;
      db.addTranscriptItem({
        id: 'tr_' + Math.random().toString(36).substr(2, 9),
        interviewId: params.registrationId,
        speaker: 'AI',
        message: reply,
        timestamp: new Date().toISOString(),
        intent: CandidateIntent.REPEAT_REQUEST,
      });
      return {
        interviewerResponse: reply,
        status: session.status,
        questionIndex: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        currentQuestion,
        isInterviewFinished: false,
        intent: CandidateIntent.REPEAT_REQUEST,
      };
    }

    if (intentResult.intent === CandidateIntent.HINT_REQUEST) {
      session.currentHintLevel = Math.min(3, session.currentHintLevel + 1);
      currentQuestion.hintsUsed = session.currentHintLevel;

      let hintText = '';
      if (session.currentHintLevel === 1) {
        hintText = `Here is a general direction: consider the architectural separation of concerns and how memory or state transitions are handled in this flow.`;
      } else if (session.currentHintLevel === 2) {
        hintText = `Focus specifically on ${currentQuestion.conceptTested}. Think about edge conditions when multiple callers or high loads occur.`;
      } else {
        hintText = `Consider how standard industry implementations maintain consistency: review tradeoffs between throughput, locks, and recovery.`;
      }

      db.addTranscriptItem({
        id: 'tr_' + Math.random().toString(36).substr(2, 9),
        interviewId: params.registrationId,
        speaker: 'AI',
        message: hintText,
        timestamp: new Date().toISOString(),
        intent: CandidateIntent.HINT_REQUEST,
      });

      return {
        interviewerResponse: hintText,
        status: session.status,
        questionIndex: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        currentQuestion,
        isInterviewFinished: false,
        progressiveHint: hintText,
        intent: CandidateIntent.HINT_REQUEST,
      };
    }

    // 3. Process candidate's answer
    // If this was Question 1 (self introduction), parse candidate's background
    if (session.currentQuestionIndex === 1) {
      session.candidateIntroduction = params.candidateSpeech;
      const candidateProfile = db.getCandidateProfile(session.candidateId);
      const extracted = await geminiService.extractCandidateProfileDetails(
        params.candidateSpeech,
        candidateProfile?.resumeText
      );
      session.extractedBackground = extracted;
    }

    // Private evaluation via Gemini
    const evalResult = await geminiService.evaluateAnswer({
      questionText: currentQuestion.questionText,
      conceptTested: currentQuestion.conceptTested,
      expectedKeyPoints: currentQuestion.expectedKeyPoints,
      candidateAnswer: params.candidateSpeech,
      currentDifficulty: session.currentDifficulty,
      hintLevel: session.currentHintLevel,
      responseTimeSeconds: elapsedSeconds,
    });

    currentQuestion.candidateAnswer = params.candidateSpeech;
    currentQuestion.technicalCorrectness = evalResult.technicalCorrectness;
    currentQuestion.conceptCoverage = evalResult.conceptCoverage;
    currentQuestion.feedback = evalResult.privateFeedback;
    currentQuestion.responseTimeSeconds = elapsedSeconds;
    session.lastPerformance = evalResult.performanceRating;
    session.currentDifficulty = evalResult.recommendedNextDifficulty;
    session.coveredConcepts.push(currentQuestion.conceptTested);

    db.updateQuestionRecord(currentQuestion.id, currentQuestion);

    // Check if more questions remain
    if (session.currentQuestionIndex < session.totalQuestions) {
      session.currentQuestionIndex += 1;
      session.currentHintLevel = 0;
      session.questionStartTime = Date.now();

      // Determine if a deep follow-up probe should be launched
      const isPriorityQuestion = currentQuestion.questionType === QuestionType.PRIORITY_EVALUATION;
      const hadIncompleteAnswer = evalResult.performanceRating === 'WEAK' || evalResult.performanceRating === 'PARTIAL';
      const existingFollowUps = session.questions.filter(q => q.questionType === QuestionType.FOLLOW_UP).length;
      const triggerFollowUp = (isPriorityQuestion || hadIncompleteAnswer) && existingFollowUps < 2;

      // Dynamic question generation with recruiter configuration & NO DUPLICATES
      const nextQData = await geminiService.generateNextQuestion({
        jobTitle: job?.title || 'Software Engineer',
        jobDescription: job?.description || '',
        requiredSkills: job?.requiredSkills || [],
        preferredSkills: job?.preferredSkills || [],
        candidateBackground: `${session.candidateIntroduction || ''}. Skills: ${session.extractedBackground?.skillsFound?.join(', ') || ''}`,
        askedQuestions: session.questions.map(q => ({
          questionText: q.questionText,
          conceptTested: q.conceptTested,
        })),
        currentDifficulty: session.currentDifficulty,
        questionNumber: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        lastAnswerPerformance: evalResult.performanceRating,
        minPackage: job?.minPackage,
        maxPackage: job?.maxPackage,
        packageCurrency: job?.currency || 'INR',
        customQuestions: job?.interviewConfig?.customQuestions,
        targetFocusTopics: job?.interviewConfig?.targetFocusTopics,
        evaluationExpectations: job?.interviewConfig?.evaluationExpectations,
        isFollowUp: triggerFollowUp,
        previousQuestionText: currentQuestion.questionText,
        previousCandidateAnswer: currentQuestion.candidateAnswer,
        previousConcept: currentQuestion.conceptTested,
      });

      const nextQuestion: QuestionRecord = {
        id: `q_${params.registrationId}_${session.currentQuestionIndex}`,
        interviewId: params.registrationId,
        questionIndex: session.currentQuestionIndex,
        questionText: nextQData.questionText,
        questionType: nextQData.questionType,
        difficulty: nextQData.difficulty,
        conceptTested: nextQData.conceptTested,
        expectedKeyPoints: nextQData.expectedKeyPoints,
        hintsUsed: 0,
      };

      session.questions.push(nextQuestion);
      db.addQuestionRecord(nextQuestion);

      const combinedSpoken = `${evalResult.spokenInterviewerResponse} Now, ${nextQuestion.questionText}`;

      db.addTranscriptItem({
        id: 'tr_' + Math.random().toString(36).substr(2, 9),
        interviewId: params.registrationId,
        speaker: 'AI',
        message: combinedSpoken,
        timestamp: new Date().toISOString(),
        questionIndex: session.currentQuestionIndex,
      });

      return {
        interviewerResponse: combinedSpoken,
        status: session.status,
        questionIndex: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        currentQuestion: nextQuestion,
        isInterviewFinished: false,
        intent: CandidateIntent.ANSWER,
      };
    } else {
      // Final question answered - Finish interview
      const finished = await this.finalizeInterview(params.registrationId, 'VERIFIED_CLEAN');
      const closingStatement = `Congratulations on completing your technical interview, ${candidateName}! Thank you for your time, dedication, and thoughtful responses today. Your technical answers and problem-solving approaches have been recorded, and your detailed assessment report will be delivered to your registered email shortly. We truly appreciate your effort and wish you the very best in your career journey!`;

      db.addTranscriptItem({
        id: 'tr_' + Math.random().toString(36).substr(2, 9),
        interviewId: params.registrationId,
        speaker: 'AI',
        message: closingStatement,
        timestamp: new Date().toISOString(),
      });

      return {
        interviewerResponse: closingStatement,
        status: InterviewStatus.COMPLETED,
        questionIndex: session.totalQuestions,
        totalQuestions: session.totalQuestions,
        isInterviewFinished: true,
        intent: CandidateIntent.ANSWER,
      };
    }
  }

  /**
   * Record a proctoring event and apply strict warning/malpractice rules.
   * Section 28:
   * First violation: WARNING 1
   * Second violation: MALPRACTICE_TERMINATED
   */
  public async recordProctoringEvent(params: {
    registrationId: string;
    eventType: ProctoringEventType;
    metadata?: string;
  }): Promise<{
    warningIssued: boolean;
    terminated: boolean;
    warningNumber: number;
    warningCount: number;
    message: string;
  }> {
    const session = this.activeSessions.get(params.registrationId);
    const reg = db.getRegistrationById(params.registrationId);
    if (!reg) return { warningIssued: false, terminated: false, warningNumber: 0, warningCount: 0, message: 'Session not found' };

    const warningNum = (session?.warningCount || 0) + 1;
    if (session) {
      session.warningCount = warningNum;
    }

    const event: ProctoringEvent = {
      id: 'proc_' + Math.random().toString(36).substr(2, 9),
      interviewId: params.registrationId,
      candidateId: reg.candidateId,
      eventType: params.eventType,
      severity: warningNum === 1 ? 'MEDIUM' : 'CRITICAL',
      timestamp: new Date().toISOString(),
      metadata: params.metadata || 'Observed session anomaly',
      warningNumber: warningNum,
    };

    db.addProctoringEvent(event);

    if (warningNum === 1) {
      return {
        warningIssued: true,
        terminated: false,
        warningNumber: 1,
        warningCount: 1,
        message: 'WARNING 1 – Interview Integrity Violation Detected. Leaving the interview screen or switching tabs is not allowed. Further violations will terminate your interview session.',
      };
    } else {
      // Second violation: TERMINATE IMMEDIATELY FOR MALPRACTICE
      if (session) {
        session.status = InterviewStatus.MALPRACTICE_TERMINATED;
      }
      await this.finalizeInterview(params.registrationId, 'TERMINATED_MALPRACTICE');

      return {
        warningIssued: false,
        terminated: true,
        warningNumber: 2,
        warningCount: 2,
        message: 'INTERVIEW TERMINATED – Reason: MALPRACTICE. Repeated interview integrity violations were detected. The recruitment team has been notified and will review this session recording.',
      };
    }
  }

  /**
   * Finalize interview, generate Candidate Report & Recruiter Report,
   * persist to database, and dispatch automated candidate email.
   */
  public async finalizeInterview(
    registrationId: string,
    integrityStatus: 'VERIFIED_CLEAN' | 'FLAGS_OBSERVED' | 'TERMINATED_MALPRACTICE'
  ) {
    const session = this.activeSessions.get(registrationId);
    const reg = db.getRegistrationById(registrationId);
    if (!reg) return;

    const job = db.getJobById(reg.jobId);
    const candidate = db.findUserById(reg.candidateId);
    const company = job?.company;

    const finalStatus =
      integrityStatus === 'TERMINATED_MALPRACTICE'
        ? InterviewStatus.MALPRACTICE_TERMINATED
        : InterviewStatus.COMPLETED;

    db.updateRegistration(registrationId, {
      interviewStatus: finalStatus,
      status: integrityStatus === 'TERMINATED_MALPRACTICE' ? ApplicationStatus.UNDER_REVIEW : ApplicationStatus.INTERVIEW_READY,
    });

    const transcripts = db.getTranscriptsForInterview(registrationId);
    const questions = db.getQuestionsForInterview(registrationId);
    const proctoringEvents = db.getProctoringEventsForInterview(registrationId);

    const durationMinutes = session
      ? Math.max(2, Math.round((Date.now() - session.startedAt) / 60000))
      : 15;

    const { candidateReport, recruiterReport } = await geminiService.generateFinalReports({
      interviewId: registrationId,
      candidateName: candidate?.fullName || 'Candidate',
      candidateEmail: candidate?.email || '',
      companyName: company?.name || 'Company',
      jobTitle: job?.title || 'Role',
      durationMinutes,
      transcripts,
      questions,
      proctoringEventsCount: proctoringEvents.length,
      integrityStatus,
    });

    if (candidateReport && candidateReport.id) {
      db.saveCandidateReport(candidateReport);
    }
    if (recruiterReport && recruiterReport.id) {
      recruiterReport.proctoringEvents = proctoringEvents;
      recruiterReport.warningsIssued = session?.warningCount || 0;
      db.saveRecruiterReport(recruiterReport);
    }

    // Update Round 3 (AI Interview) progression in the candidate's registration pipeline
    const scoreObtained = recruiterReport?.overallScore ?? 70;
    const isMalpractice = integrityStatus === 'TERMINATED_MALPRACTICE';
    
    if (reg.roundProgression && reg.roundProgression.length > 0) {
      const updatedProgression = reg.roundProgression.map(r => {
        if (r.roundType === 'AI_INTERVIEW' || r.roundNumber === 3) {
          const passed = !isMalpractice && scoreObtained >= (r.minQualifyingScore || 70);
          return {
            ...r,
            status: isMalpractice ? 'REJECTED' : passed ? 'QUALIFIED' : 'NEEDS_REVIEW',
            score: scoreObtained,
            feedback: isMalpractice ? 'Terminated for repeated malpractice' : (recruiterReport?.finalRecommendation || 'Technical evaluation completed'),
            completedAt: new Date().toISOString(),
          };
        }
        return r;
      });

      // Find next round
      const aiRoundIndex = updatedProgression.findIndex(r => r.roundType === 'AI_INTERVIEW' || r.roundNumber === 3);
      let nextRound = reg.currentRoundNumber || 3;
      let overallStatus = reg.overallPipelineStatus || 'IN_PROGRESS';

      if (isMalpractice) {
        overallStatus = 'REJECTED';
      } else if (aiRoundIndex !== -1 && updatedProgression[aiRoundIndex].status === 'QUALIFIED') {
        if (aiRoundIndex + 1 < updatedProgression.length) {
          updatedProgression[aiRoundIndex + 1].status = 'IN_PROGRESS';
          nextRound = updatedProgression[aiRoundIndex + 1].roundNumber;
        } else {
          overallStatus = 'QUALIFIED';
        }
      }

      db.updateRegistration(registrationId, {
        roundProgression: updatedProgression as any,
        currentRoundNumber: nextRound,
        overallPipelineStatus: overallStatus as any,
      });
    }

    // Send final candidate email
    if (candidate && candidateReport && candidateReport.id) {
      await emailService.sendReportEmail({
        toEmail: candidate.email,
        candidateName: candidate.fullName,
        companyName: company?.name || 'Recruitment Team',
        jobTitle: job?.title || 'Open Position',
        overallSummary: candidateReport.overallSummary,
        strongAreas: candidateReport.strongAreas || ['System Architecture'],
        areasToImprove: candidateReport.areasToImprove || ['Distributed Consistency'],
        learningRecommendations: candidateReport.learningRecommendations || ['Review system design whitepapers'],
      });
    }

    this.activeSessions.delete(registrationId);
  }

  public getSession(registrationId: string): ActiveSession | undefined {
    return this.activeSessions.get(registrationId);
  }
}

export const interviewOrchestrator = new InterviewOrchestrator();
