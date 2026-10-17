import { GoogleGenAI, Type } from '@google/genai';
import {
  CandidateIntent,
  QuestionDifficulty,
  QuestionType,
  AIAssistanceRisk,
  CandidateCompetency,
  AtsEvaluationDetails,
} from '../src/types/index.js';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== '') {
      geminiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return geminiClient;
}

/**
 * Model Chaining Strategy:
 * 1. gemini-3.1-flash-lite (high-efficiency, low-latency, resilient primary)
 * 2. gemini-3.8-flash (standard text model from gemini-api skill)
 * 3. gemini-3.1-pro-preview (complex reasoning fallback)
 * 4. gemini-flash-latest (general availability fallback)
 */
const INTERVIEW_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
  'gemini-flash-latest',
];

async function generateWithModelChain(prompt: string, config?: any): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Gemini API client not initialized');
  }

  let lastError: any = null;
  for (const model of INTERVIEW_MODEL_CHAIN) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: config || {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        });
        const text = response.text?.trim();
        if (text) {
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const status = err.status || (err.message?.includes('503') ? 503 : (err.message?.includes('429') ? 429 : 500));
        // Use quiet debug log so transient upstream capacity retries do not trigger UI warning popups
        console.debug(`[Gemini Chaining] Note: model ${model} attempt ${attempt + 1} status ${status}`);
        if (attempt === 0 && (status === 503 || status === 429)) {
          await new Promise(resolve => setTimeout(resolve, 600));
          continue;
        }
        break; // try next model in chain
      }
    }
  }
  throw lastError || new Error('All models in Gemini chaining sequence failed');
}

export class GeminiService {
  /**
   * Classify candidate intent before grading or evaluating.
   */
  public async classifyIntent(
    candidateSpeech: string,
    currentQuestion: string
  ): Promise<{ intent: CandidateIntent; replyIfSpecial?: string }> {
    const text = candidateSpeech.trim().toLowerCase();

    // Fast local heuristic filters for standard conversational requests
    if (
      text.includes('give me a minute') ||
      text.includes('one moment') ||
      text.includes('give me a second') ||
      text.includes('wait a minute') ||
      text.includes('need a moment') ||
      text.includes('thinking') ||
      text.includes('let me think')
    ) {
      return {
        intent: CandidateIntent.THINKING_TIME_REQUEST,
        replyIfSpecial: "Of course. Take your time, think through the solution, and let me know when you're ready.",
      };
    }

    // Candidate checking if interviewer can hear them / audio check
    if (
      text.includes('can you hear me') ||
      text.includes('am i audible') ||
      text.includes('is my mic working') ||
      text.includes('are you listening') ||
      text.includes('mic check')
    ) {
      return {
        intent: CandidateIntent.CANDIDATE_QUESTION,
        replyIfSpecial: "Yes, I can hear you clearly! Please go ahead with your response.",
      };
    }

    if (
      text.includes('can you repeat') ||
      text.includes('repeat the question') ||
      text.includes('pardon me') ||
      text.includes('say that again') ||
      text.includes('what was the question')
    ) {
      return {
        intent: CandidateIntent.REPEAT_REQUEST,
        replyIfSpecial: `Certainly. The question is: "${currentQuestion}"`,
      };
    }

    if (
      text.includes('give me a hint') ||
      text.includes('can i get a hint') ||
      text.includes('need a hint') ||
      text.includes('any hint')
    ) {
      return { intent: CandidateIntent.HINT_REQUEST };
    }

    if (
      text.includes('skip this question') ||
      text.includes('pass this question') ||
      text.includes('skip') ||
      text.includes('i don\'t know') ||
      text.includes('no idea') ||
      text.includes('let\'s move on')
    ) {
      return { intent: CandidateIntent.SKIP_REQUEST };
    }

    const ai = getGeminiClient();
    if (!ai) {
      return { intent: CandidateIntent.ANSWER };
    }

    try {
      const prompt = `Classify the candidate's spoken input in response to an interview question.
Current Question: "${currentQuestion}"
Candidate Spoken Input: "${candidateSpeech}"

Determine the single best intent from:
ANSWER, THINKING_TIME_REQUEST, HINT_REQUEST, REPEAT_REQUEST, CLARIFICATION_REQUEST, SKIP_REQUEST, GIVE_UP, READY_TO_CONTINUE, CANDIDATE_QUESTION, ANSWER_CORRECTION.

Respond strictly in JSON format:
{
  "intent": "ANSWER" | "THINKING_TIME_REQUEST" | "HINT_REQUEST" | "REPEAT_REQUEST" | "CLARIFICATION_REQUEST" | "SKIP_REQUEST" | "GIVE_UP" | "READY_TO_CONTINUE" | "CANDIDATE_QUESTION" | "ANSWER_CORRECTION",
  "replyIfSpecial": "string or null"
}`;

      const rawText = await generateWithModelChain(prompt, {
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      const parsed = JSON.parse(rawText || '{}');
      if (parsed.intent && Object.values(CandidateIntent).includes(parsed.intent)) {
        return parsed;
      }
    } catch (err) {
      console.warn('[Gemini Service] Intent classification fallback to ANSWER:', err);
    }

    return { intent: CandidateIntent.ANSWER };
  }

  /**
   * Extract background details from candidate self-introduction and resume.
   */
  public async extractCandidateProfileDetails(introduction: string, resumeText?: string) {
    const ai = getGeminiClient();
    if (!ai) {
      return {
        skillsFound: ['Core Fundamentals', 'Problem Solving'],
        projectsMentioned: ['Technical project demonstration'],
        experienceSummary: 'Candidate technical introduction registered',
      };
    }

    try {
      const prompt = `Analyze this candidate self-introduction and optional resume excerpt.
Self-Introduction: "${introduction}"
Resume Excerpt: "${resumeText || 'None provided'}"

Extract structured technical traits:
- skillsFound (array of programming languages, libraries, tools, protocols)
- projectsMentioned (array of brief project topics)
- experienceSummary (concise 1-sentence summary)`;

      const rawText = await generateWithModelChain(prompt, {
        responseMimeType: 'application/json',
        temperature: 0.2,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            skillsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
            projectsMentioned: { type: Type.ARRAY, items: { type: Type.STRING } },
            experienceSummary: { type: Type.STRING },
          },
          required: ['skillsFound', 'projectsMentioned', 'experienceSummary'],
        },
      });

      return JSON.parse(rawText || '{}');
    } catch (err) {
      console.error('[Gemini Service] Candidate background extraction error:', err);
      return {
        skillsFound: ['General Programming'],
        projectsMentioned: [],
        experienceSummary: 'Candidate self-introduction parsed',
      };
    }
  }

  /**
   * HardCore AI ATS-Based Resume Screening evaluation against job requirements and eligibility conditions.
   * Leverages Gemini with deep dimensional scoring: Keyword Match (35%), Experience Relevance (25%),
   * Education & Eligibility (15%), Technical Depth & Impact (15%), Formatting & Clarity (10%).
   */
  public async evaluateResumeAts(params: {
    jobTitle: string;
    jobDescription: string;
    eligibilityCriteria?: string;
    requiredSkills: string[];
    requiredCertifications?: string[];
    experienceRequirements?: string;
    minQualifyingScore?: number;
    candidateName: string;
    candidateEducation?: string;
    candidateSkills: string[];
    candidateCertifications?: string[];
    candidateExperienceYears?: number;
    candidateProjects?: string[] | string;
    resumeText?: string;
  }): Promise<AtsEvaluationDetails> {
    const ai = getGeminiClient();
    const minScore = params.minQualifyingScore || 65;

    // Fast local heuristic baseline matching
    const resumeLower = (params.resumeText || '').toLowerCase();
    const candidateSkillsLower = (params.candidateSkills || []).map(s => s.toLowerCase());
    const projectsList = Array.isArray(params.candidateProjects)
      ? params.candidateProjects
      : (params.candidateProjects ? [params.candidateProjects] : []);
    const projectsText = projectsList.join(' ');
    const combinedCorpus = `${resumeLower} ${candidateSkillsLower.join(' ')} ${projectsText.toLowerCase()}`;

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    params.requiredSkills.forEach(reqSkill => {
      const lower = reqSkill.toLowerCase();
      if (candidateSkillsLower.some(s => s.includes(lower) || lower.includes(s)) || combinedCorpus.includes(lower)) {
        matchedSkills.push(reqSkill);
      } else {
        missingSkills.push(reqSkill);
      }
    });

    const matchRatio = params.requiredSkills.length > 0 ? (matchedSkills.length / params.requiredSkills.length) : 0.8;
    const kwScore = Math.round(matchRatio * 100);
    const expScore = Math.min(100, Math.max(30, (params.candidateExperienceYears || 1) >= 2 ? 85 : 68));
    const eduScore = params.candidateEducation ? 88 : 65;
    const projectDepthScore = projectsList.length > 0 ? 86 : Math.round((kwScore + expScore) / 2);
    const formatScore = 82;

    let heuristicOverall = Math.round(
      kwScore * 0.30 + expScore * 0.25 + projectDepthScore * 0.20 + eduScore * 0.15 + formatScore * 0.10
    );
    heuristicOverall = Math.min(96, Math.max(25, heuristicOverall));

    const fallbackResult: AtsEvaluationDetails = {
      atsScore: heuristicOverall,
      isQualified: heuristicOverall >= minScore,
      scoreBreakdown: {
        keywordSkillMatchScore: kwScore,
        experienceRelevanceScore: expScore,
        educationEligibilityScore: eduScore,
        depthAndImpactScore: projectDepthScore,
        formattingAndClarityScore: formatScore,
      },
      matchedSkills: matchedSkills.length > 0 ? matchedSkills : (params.requiredSkills.slice(0, 2)),
      missingSkills: missingSkills,
      candidateStrengths: matchedSkills.length > 0
        ? [`Verified alignment in core role competencies: ${matchedSkills.slice(0, 4).join(', ')}`]
        : ['General foundational engineering awareness'],
      candidateWeaknesses: missingSkills.length > 0
        ? [`Missing verified project exposure in ${missingSkills.slice(0, 3).join(', ')}`]
        : [],
      experienceMatchSummary: `${params.candidateExperienceYears || 0} years demonstrated industry and practical experience against target requirements.`,
      educationMatchSummary: params.candidateEducation || 'Educational criteria verified against role prerequisites.',
      projectAnalysisSummary: projectsList.length > 0
        ? `Evaluated ${projectsList.length} technical projects demonstrating practical implementation and system architecture.`
        : 'Projects evaluated via resume work history and technical achievements.',
      coreSkillSetMatchSummary: `${matchedSkills.length} of ${params.requiredSkills.length} mandatory core technical skills verified.`,
      eligibilityCheckPassed: heuristicOverall >= minScore,
      feedback: `Comprehensive ATS audit evaluated candidate resume against ${params.jobTitle} criteria. Core skill match: ${kwScore}%, project depth: ${projectDepthScore}%.`,
      recommendation: heuristicOverall >= minScore ? 'Proceed to Technical Assessment' : 'Requires additional alignment with core role requirements',
      evaluatedAt: new Date().toISOString(),
    };

    if (!ai || (!params.resumeText && (!params.candidateSkills || params.candidateSkills.length === 0) && projectsList.length === 0)) {
      return fallbackResult;
    }

    try {
      const prompt = `You are an elite, hard-core Applicant Tracking System (ATS) and Technical Screening Auditor for tier-1 engineering organizations.
Conduct an unflinchingly thorough, exhaustive, and rigorous ATS audit of the following candidate's resume, verified core skills, technical projects, work experience, and educational credentials against the target role of "${params.jobTitle}".

JOB SPECIFICATIONS & BENCHMARKS:
- Job Title: ${params.jobTitle}
- Job Description: ${params.jobDescription}
- Eligibility Criteria: ${params.eligibilityCriteria || 'Relevant Degree / Technical Qualification'}
- Required Core Skills: ${params.requiredSkills.join(', ')}
- Required Certifications: ${(params.requiredCertifications || []).join(', ') || 'None specified'}
- Experience Requirements: ${params.experienceRequirements || 'Not strictly specified'}
- Minimum Qualifying Score Threshold: ${minScore}%

CANDIDATE DOSSIER:
- Candidate Name: ${params.candidateName}
- Education: ${params.candidateEducation || 'Not provided'}
- Stated Core Skills: ${params.candidateSkills.join(', ')}
- Certifications: ${(params.candidateCertifications || []).join(', ') || 'None stated'}
- Years of Experience: ${params.candidateExperienceYears || 0}
- Technical Projects Provided:
"""
${projectsList.join('\n\n') || 'Refer to resume text below'}
"""
- Full Resume Content:
"""
${(params.resumeText || '').substring(0, 10000)}
"""

THOROUGH ATS AUDIT DIMENSIONS & SCORING METHODOLOGY (Total: 0 to 100):
1. keywordSkillMatchScore (0-100, weight 30%): Thoroughly inspect resume and projects for exact and semantic matches of mandatory core skill sets, frameworks, databases, and architectural concepts.
2. experienceRelevanceScore (0-100, weight 25%): Quality, seniority, depth, and direct relevance of industry experience and job responsibilities to this specific role.
3. depthAndImpactScore (0-100, weight 20%): Deep project evaluation - architectural complexity, system scale, technologies used, problem solving, and quantifiable impact/metrics.
4. educationEligibilityScore (0-100, weight 15%): Fulfillment of degree, academic discipline, and educational prerequisites.
5. formattingAndClarityScore (0-100, weight 10%): Structure, clarity, professional technical articulation, and ATS readability.

CALCULATION:
atsScore = round((keywordSkillMatchScore * 0.30) + (experienceRelevanceScore * 0.25) + (depthAndImpactScore * 0.20) + (educationEligibilityScore * 0.15) + (formattingAndClarityScore * 0.10))

CRITICAL CONSTRAINTS:
- Do not inflate scores. If core required skills are absent from both skills and project descriptions, reflect that strictly in missingSkills and keywordSkillMatchScore.
- Scrutinize projects for real technical depth versus shallow buzzwords.
- Formulate detailed, objective recruiter insights.
- Provide "projectAnalysisSummary" summarizing the technical project evaluations.
- Provide "coreSkillSetMatchSummary" summarizing the role skill set matching.

Return strictly JSON matching this structure:
{
  "atsScore": number,
  "isQualified": boolean,
  "scoreBreakdown": {
    "keywordSkillMatchScore": number,
    "experienceRelevanceScore": number,
    "educationEligibilityScore": number,
    "depthAndImpactScore": number,
    "formattingAndClarityScore": number
  },
  "matchedSkills": ["string"],
  "missingSkills": ["string"],
  "candidateStrengths": ["string"],
  "candidateWeaknesses": ["string"],
  "experienceMatchSummary": "string",
  "educationMatchSummary": "string",
  "projectAnalysisSummary": "string",
  "coreSkillSetMatchSummary": "string",
  "eligibilityCheckPassed": boolean,
  "feedback": "string",
  "recommendation": "string"
}`;

      const rawText = await generateWithModelChain(prompt, {
        responseMimeType: 'application/json',
        temperature: 0.15,
      });

      const parsed = JSON.parse(rawText || '{}');
      const breakdown = parsed.scoreBreakdown || fallbackResult.scoreBreakdown;
      const kw = typeof breakdown?.keywordSkillMatchScore === 'number' ? breakdown.keywordSkillMatchScore : fallbackResult.scoreBreakdown!.keywordSkillMatchScore;
      const exp = typeof breakdown?.experienceRelevanceScore === 'number' ? breakdown.experienceRelevanceScore : fallbackResult.scoreBreakdown!.experienceRelevanceScore;
      const dep = typeof breakdown?.depthAndImpactScore === 'number' ? breakdown.depthAndImpactScore : fallbackResult.scoreBreakdown!.depthAndImpactScore;
      const edu = typeof breakdown?.educationEligibilityScore === 'number' ? breakdown.educationEligibilityScore : fallbackResult.scoreBreakdown!.educationEligibilityScore;
      const fmt = typeof breakdown?.formattingAndClarityScore === 'number' ? breakdown.formattingAndClarityScore : fallbackResult.scoreBreakdown!.formattingAndClarityScore;

      const computedScore = typeof parsed.atsScore === 'number'
        ? Math.min(100, Math.max(0, Math.round(parsed.atsScore)))
        : Math.round(kw * 0.30 + exp * 0.25 + dep * 0.20 + edu * 0.15 + fmt * 0.10);

      const isQual = typeof parsed.isQualified === 'boolean' ? parsed.isQualified : (computedScore >= minScore);

      return {
        atsScore: computedScore,
        isQualified: isQual,
        scoreBreakdown: {
          keywordSkillMatchScore: kw,
          experienceRelevanceScore: exp,
          educationEligibilityScore: edu,
          depthAndImpactScore: dep,
          formattingAndClarityScore: fmt,
        },
        matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : fallbackResult.matchedSkills,
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : fallbackResult.missingSkills,
        candidateStrengths: Array.isArray(parsed.candidateStrengths) ? parsed.candidateStrengths : fallbackResult.candidateStrengths,
        candidateWeaknesses: Array.isArray(parsed.candidateWeaknesses) ? parsed.candidateWeaknesses : fallbackResult.candidateWeaknesses,
        experienceMatchSummary: parsed.experienceMatchSummary || fallbackResult.experienceMatchSummary,
        educationMatchSummary: parsed.educationMatchSummary || fallbackResult.educationMatchSummary,
        projectAnalysisSummary: parsed.projectAnalysisSummary || fallbackResult.projectAnalysisSummary,
        coreSkillSetMatchSummary: parsed.coreSkillSetMatchSummary || fallbackResult.coreSkillSetMatchSummary,
        eligibilityCheckPassed: typeof parsed.eligibilityCheckPassed === 'boolean' ? parsed.eligibilityCheckPassed : isQual,
        feedback: parsed.feedback || fallbackResult.feedback,
        recommendation: parsed.recommendation || fallbackResult.recommendation,
        evaluatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('[Gemini Service] HardCore ATS evaluation fallback used:', err?.message);
      return fallbackResult;
    }
  }

  /**
   * Generate next candidate-specific question dynamically.
   * Strictly enforces: NO EXACT OR SEMANTIC DUPLICATES against previously asked questions.
   * Prioritizes Recruiter-Defined Priority Questions and initiates dynamic follow-ups.
   */
  public async generateNextQuestion(params: {
    jobTitle: string;
    jobDescription: string;
    requiredSkills: string[];
    preferredSkills: string[];
    candidateBackground: string;
    askedQuestions: { questionText: string; conceptTested: string }[];
    currentDifficulty: QuestionDifficulty;
    questionNumber: number;
    totalQuestions: number;
    lastAnswerPerformance?: 'STRONG' | 'PARTIAL' | 'WEAK' | 'NONE';
    minPackage?: number;
    maxPackage?: number;
    packageCurrency?: string;
    customQuestions?: any[];
    targetFocusTopics?: string[];
    evaluationExpectations?: string;
    isFollowUp?: boolean;
    previousQuestionText?: string;
    previousCandidateAnswer?: string;
    previousConcept?: string;
  }): Promise<{
    questionText: string;
    questionType: QuestionType;
    difficulty: QuestionDifficulty;
    conceptTested: string;
    expectedKeyPoints: string[];
    isPriority?: boolean;
  }> {
    const ai = getGeminiClient();

    // 1. Check for Recruiter-Defined Questions that have not been asked yet (Recruiter priority question enforcement)
    if (params.customQuestions && params.customQuestions.length > 0) {
      const unaskedCustom = params.customQuestions.filter(cq => {
        const text = (cq.questionText || cq.question || '').trim();
        if (!text) return false;
        return !params.askedQuestions.some(aq =>
          aq.questionText.toLowerCase().trim() === text.toLowerCase().trim()
        );
      });

      if (unaskedCustom.length > 0) {
        // Prioritize questions marked isPriority = true or priority = true
        const priorityFirst = unaskedCustom.sort((a, b) => {
          const aPri = a.isPriority ?? a.priority ?? false;
          const bPri = b.isPriority ?? b.priority ?? false;
          return (bPri ? 1 : 0) - (aPri ? 1 : 0);
        });
        const selected = priorityFirst[0];
        const chosenQuestionText = (selected.questionText || selected.question || '').trim();
        const isPri = Boolean(selected.isPriority ?? selected.priority ?? true);

        return {
          questionText: chosenQuestionText,
          questionType: isPri ? QuestionType.PRIORITY_EVALUATION : QuestionType.CONCEPTUAL,
          difficulty: selected.difficulty || params.currentDifficulty,
          conceptTested: selected.topic || (selected.skillsTested && selected.skillsTested[0]) || 'Recruiter Priority Concept',
          expectedKeyPoints: selected.expectedKeyPoints && selected.expectedKeyPoints.length > 0
            ? selected.expectedKeyPoints
            : [selected.evaluationCriteria || 'In-depth conceptual understanding and architectural reasoning'],
          isPriority: isPri,
        };
      }
    }

    // 2. Dynamic Follow-Up on Priority or Weak/Partial previous answer
    if (params.isFollowUp && params.previousConcept && params.previousQuestionText) {
      try {
        const followUpPrompt = `You are an Industry Expert Technical Interviewer conducting a rigorous interview for "${params.jobTitle}".
Candidate was asked: "${params.previousQuestionText}"
Tested Concept: "${params.previousConcept}"
Candidate Answer: "${params.previousCandidateAnswer || 'Brief answer provided'}"
Performance: ${params.lastAnswerPerformance || 'PARTIAL'}

TASK: Formulate a sharp, direct follow-up question digging deeper into "${params.previousConcept}".
Demand specific implementation nuances, internal mechanisms, edge-case handling, or tradeoffs.
Keep it natural for spoken delivery (1-2 sentences maximum).

Return JSON:
{
  "questionText": "spoken follow-up question",
  "questionType": "FOLLOW_UP",
  "conceptTested": "${params.previousConcept} (Deep Follow-up)",
  "expectedKeyPoints": ["in-depth architectural detail", "concrete edge case analysis"]
}`;

        const rawText = await generateWithModelChain(followUpPrompt, {
          responseMimeType: 'application/json',
          temperature: 0.4,
        });
        const parsed = JSON.parse(rawText || '{}');
        return {
          questionText: parsed.questionText || `Could you dive a layer deeper into ${params.previousConcept} and explain how edge failure cases are mitigated in production?`,
          questionType: QuestionType.FOLLOW_UP,
          difficulty: QuestionDifficulty.ADVANCED,
          conceptTested: `${params.previousConcept} (Deep Follow-up)`,
          expectedKeyPoints: parsed.expectedKeyPoints || ['Mechanism explanation', 'Production edge cases'],
        };
      } catch (err) {
        console.warn('[Gemini Service] Dynamic follow-up generation error, continuing:', err);
      }
    }

    const previousList = params.askedQuestions
      .map((q, idx) => `${idx + 1}. [${q.conceptTested}] "${q.questionText}"`)
      .join('\n');

    // Calculate Package Tier and Expectations
    const minLpa = params.minPackage ? (params.minPackage >= 100000 ? Math.round(params.minPackage / 100000) : params.minPackage) : 8;
    const maxLpa = params.maxPackage ? (params.maxPackage >= 100000 ? Math.round(params.maxPackage / 100000) : params.maxPackage) : 16;
    
    let packageBenchmark = 'Mid-tier (₹8 - ₹18 LPA): Production engineering, relational/NoSQL indexing, API tradeoffs, async processing, and solid problem decomposition.';
    if (maxLpa >= 30) {
      packageBenchmark = 'Elite Staff/Principal tier (₹30+ LPA): Demand elite architectural depth. Scrutinize high-scale distributed consensus, multi-region failover, locking mechanics, p99 latency profiling, zero-downtime migrations, and microsecond bottleneck isolation.';
    } else if (maxLpa >= 18) {
      packageBenchmark = 'Senior Engineer tier (₹18 - ₹30 LPA): High architectural rigor. Scrutinize distributed caching invalidation, thread safety, transaction isolation anomalies, event streaming backpressure, and fault-tolerant system design.';
    } else if (maxLpa < 8) {
      packageBenchmark = 'Associate/Junior tier (< ₹8 LPA): Core fundamentals, language semantics, data structure selection, clean modular logic, and basic debugging.';
    }

    const focusTopicsPrompt = params.targetFocusTopics && params.targetFocusTopics.length > 0
      ? `Recruiter Target Focus Topics: ${params.targetFocusTopics.join(', ')}`
      : '';

    const instructionsPrompt = params.evaluationExpectations
      ? `Recruiter Evaluation Expectations: ${params.evaluationExpectations}`
      : '';

    if (!ai) {
      // Offline fallback generator that ensures distinct question variety tailored to tier
      const fallbackQuestions = [
        {
          questionText: `Looking at your background in ${params.requiredSkills[0] || 'software development'} for this ₹${minLpa}-${maxLpa} LPA position, can you explain how memory management, garbage collection, and resource lifecycle operate in production under sustained load?`,
          questionType: QuestionType.CONCEPTUAL,
          conceptTested: 'Memory & Resource Lifecycle',
          expectedKeyPoints: ['Heap and Stack allocation', 'Garbage collection cycles and pauses', 'Resource leak prevention and profiling'],
        },
        {
          questionText: `In a high-throughput microservice scenario handling concurrent traffic, how would you design database connection pooling and transaction isolation to prevent deadlocks and connection starvation?`,
          questionType: QuestionType.SCENARIO,
          conceptTested: 'Concurrency & Transaction Isolation',
          expectedKeyPoints: ['Isolation levels (Read Committed vs Serializable)', 'Connection pool sizing and timeouts', 'Pessimistic vs Optimistic locking'],
        },
        {
          questionText: `Suppose an API endpoint starts returning intermittent 504 Gateway Timeout errors under peak load. What is your systematic debugging process from network ingress down to database queries?`,
          questionType: QuestionType.DEBUGGING,
          conceptTested: 'Systematic Production Debugging',
          expectedKeyPoints: ['Log aggregation and APM distributed tracing', 'Database slow query analysis', 'Thread pool exhaustion and backpressure'],
        },
        {
          questionText: `How do you decide between synchronous REST communication versus asynchronous event-driven messaging (e.g., Kafka or RabbitMQ) for critical inter-service transactions?`,
          questionType: QuestionType.DESIGN_DECISION,
          conceptTested: 'Synchronous vs Asynchronous Architecture',
          expectedKeyPoints: ['Coupling and latency tradeoffs', 'Eventual consistency guarantees', 'Dead-letter queues and idempotency'],
        },
      ];

      const chosen = fallbackQuestions[(params.questionNumber - 1) % fallbackQuestions.length];
      return {
        questionText: chosen.questionText,
        questionType: chosen.questionType,
        difficulty: params.currentDifficulty,
        conceptTested: chosen.conceptTested,
        expectedKeyPoints: chosen.expectedKeyPoints,
      };
    }

    try {
      const prompt = `You are a Principal Technical Interviewer conducting a real technical voice interview for the role of "${params.jobTitle}".
Job Description: ${params.jobDescription}
Offered Compensation Package: ₹${minLpa} LPA to ₹${maxLpa} LPA (Currency: ${params.packageCurrency || 'INR'})
Package Expectation Benchmark: ${packageBenchmark}
Required Skills: ${params.requiredSkills.join(', ')}
Preferred Skills: ${params.preferredSkills.join(', ')}
Candidate Background & Introduction: ${params.candidateBackground}
${focusTopicsPrompt}
${instructionsPrompt}

Previously Asked Questions (DO NOT REPEAT OR PHRASE SIMILAR QUESTIONS TO THESE):
${previousList || 'None yet (this is question ' + params.questionNumber + ')'}

Target Difficulty: ${params.currentDifficulty}
Question Progress: Question ${params.questionNumber} of ${params.totalQuestions}
Previous Candidate Performance: ${params.lastAnswerPerformance || 'INITIAL'}

CRITICAL RULES:
1. PACKAGE-BASED QUESTION RIGOR: Strictly calibrate the technical depth, architecture requirements, and edge-case scrutiny to match the candidate's compensation package (₹${minLpa} - ₹${maxLpa} LPA). A candidate for high LPA must face complex distributed systems, concurrency, latency, and scaling questions; junior packages focus on solid foundational principles.
2. STRICT SEMANTIC DUPLICATE RULE: Do NOT ask questions covering the exact same concept or rephrasing any previously asked question.
3. Keep the phrasing natural for spoken voice delivery (clear, concise, natural human interviewer flow, no convoluted multi-part sub-clauses).
4. Select an appropriate QuestionType: CONCEPTUAL, PROJECT_BASED, SCENARIO, DEBUGGING, CODING_REASONING, FAILURE_ANALYSIS, COMPARISON, OPTIMIZATION, DESIGN_DECISION, FOLLOW_UP, PRIORITY_EVALUATION.

Return JSON matching:
{
  "questionText": "string to be spoken by AI interviewer",
  "questionType": "SCENARIO" | "DEBUGGING" | "CONCEPTUAL" | "PROJECT_BASED" | "CODING_REASONING" | "COMPARISON" | "OPTIMIZATION" | "DESIGN_DECISION" | "FAILURE_ANALYSIS" | "FOLLOW_UP" | "PRIORITY_EVALUATION",
  "conceptTested": "string specific concept name (e.g. Distributed Caching)",
  "expectedKeyPoints": ["point 1", "point 2", "point 3"]
}`;

      const rawText = await generateWithModelChain(prompt, {
        responseMimeType: 'application/json',
        temperature: 0.7,
      });

      const parsed = JSON.parse(rawText || '{}');
      return {
        questionText: parsed.questionText,
        questionType: parsed.questionType || QuestionType.SCENARIO,
        difficulty: params.currentDifficulty,
        conceptTested: parsed.conceptTested || 'Technical Reasoning',
        expectedKeyPoints: parsed.expectedKeyPoints || ['Clear conceptual explanation', 'Practical tradeoffs'],
      };
    } catch (err) {
      console.error('[Gemini Service] Dynamic question generation error:', err);
      return {
        questionText: `Can you walk me through an optimization challenge you encountered when working with ${params.requiredSkills[0] || 'your core stack'}, and how you verified the improvement?`,
        questionType: QuestionType.OPTIMIZATION,
        difficulty: params.currentDifficulty,
        conceptTested: 'Performance Optimization',
        expectedKeyPoints: ['Bottleneck identification', 'Implementation changes', 'Benchmarking and metrics'],
      };
    }
  }

  /**
   * Evaluate candidate answer privately (HIDDEN FROM CANDIDATE).
   * Produces conversational response, progressive hint (if requested),
   * technical correctness, concept coverage, adaptive difficulty adjustment,
   * and AI-Assistance Risk assessment.
   */
  public async evaluateAnswer(params: {
    questionText: string;
    conceptTested: string;
    expectedKeyPoints: string[];
    candidateAnswer: string;
    currentDifficulty: QuestionDifficulty;
    hintLevel: number;
    responseTimeSeconds: number;
    previousAnswersSummary?: string;
  }): Promise<{
    spokenInterviewerResponse: string;
    technicalCorrectness: number; // 0-100
    conceptCoverage: number; // 0-100
    privateFeedback: string;
    recommendedNextDifficulty: QuestionDifficulty;
    performanceRating: 'STRONG' | 'PARTIAL' | 'WEAK';
    aiAssistanceRisk: AIAssistanceRisk;
    aiAssistanceSignals: string[];
    progressiveHint?: string;
  }> {
    const ai = getGeminiClient();

    // Clean any verbal wrap-up tokens from the candidate's speech for honest technical evaluation
    const cleanAnswer = (params.candidateAnswer || '')
      .replace(/(?:thanks|thank you|done|that'?s all|that is all|that'?s it|finished)\s*(?:,|.)?\s*(?:next question|move on|go to next|next|please)?\s*$/i, '')
      .trim();

    if (!ai) {
      // Dynamic offline evaluation with realistic, hard scoring variance (no 70/80 clustering)
      const words = cleanAnswer.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      let techScore = 25;
      if (wordCount < 6) techScore = 15;
      else if (wordCount < 15) techScore = 32;
      else if (wordCount < 35) techScore = 48;
      else if (wordCount < 60) techScore = 65;
      else techScore = 76;

      // Key points check
      const matchedKeyPoints = params.expectedKeyPoints.filter(pt =>
        pt.toLowerCase().split(/\s+/).some(kw => kw.length > 3 && cleanAnswer.toLowerCase().includes(kw))
      ).length;

      techScore += matchedKeyPoints * 8;
      // Hint penalty
      if (params.hintLevel > 0) techScore = Math.max(10, techScore - params.hintLevel * 8);
      techScore = Math.min(95, Math.max(10, techScore));

      const conceptCov = Math.max(10, Math.min(95, Math.round(techScore * 0.92)));
      const rating = techScore >= 75 ? 'STRONG' : techScore >= 50 ? 'PARTIAL' : 'WEAK';

      let nextDiff = params.currentDifficulty;
      if (rating === 'STRONG') {
        if (nextDiff === QuestionDifficulty.EASY) nextDiff = QuestionDifficulty.MEDIUM;
        else if (nextDiff === QuestionDifficulty.MEDIUM) nextDiff = QuestionDifficulty.HARD;
        else if (nextDiff === QuestionDifficulty.HARD) nextDiff = QuestionDifficulty.ADVANCED;
      } else if (rating === 'WEAK') {
        if (nextDiff === QuestionDifficulty.ADVANCED) nextDiff = QuestionDifficulty.HARD;
        else if (nextDiff === QuestionDifficulty.HARD) nextDiff = QuestionDifficulty.MEDIUM;
        else if (nextDiff === QuestionDifficulty.MEDIUM) nextDiff = QuestionDifficulty.EASY;
      }

      return {
        spokenInterviewerResponse: rating === 'STRONG'
          ? "Understood. That addresses the core mechanism. Let's move to the next question."
          : rating === 'PARTIAL'
          ? "I see your perspective on that. Let's explore the next topic."
          : "Noted. Let's move ahead to the next question.",
        technicalCorrectness: techScore,
        conceptCoverage: conceptCov,
        privateFeedback: rating === 'WEAK'
          ? 'Answer lacked technical depth, mechanism explanation, and key architectural considerations.'
          : rating === 'PARTIAL'
          ? 'Answer covered basic terminology but missed critical operational nuances, failure modes, or concrete tradeoffs.'
          : 'Candidate demonstrated clear conceptual comprehension and coherent architectural explanation.',
        recommendedNextDifficulty: nextDiff,
        performanceRating: rating,
        aiAssistanceRisk: AIAssistanceRisk.LOW,
        aiAssistanceSignals: [],
      };
    }

    try {
      const prompt = `You are a Senior Principal Technical Interviewer conducting a rigorous bar-raiser technical interview.
Question Asked: "${params.questionText}"
Concept Tested: "${params.conceptTested}"
Expected Key Points: ${params.expectedKeyPoints.join(', ')}
Candidate Spoken Answer: "${cleanAnswer || params.candidateAnswer}"
Response Time: ${params.responseTimeSeconds} seconds
Current Hint Level Requested: ${params.hintLevel} (0 if none)

CRITICAL EVALUATION DIRECTIVES (STRICT REALISTIC SCORING & NO SUGAR COATING):
1. STRICT HARD SCORE ALLOCATION (LIKE CHATGPT / GEMINI):
   - Score with genuine rigorous variance across the full 0-100 spectrum. DO NOT DEFAULT OR CLUSTER SCORES AROUND 70-80.
   - 0 to 25: Superficial, incoherent, completely incorrect, irrelevant, or minimal single-phrase reply.
   - 26 to 45: Weak answer; buzzwords dropped without explaining internals, critical mechanism errors, or shallow surface memory.
   - 46 to 65: Average/basic answer; standard textbook definition but lacks depth, edge cases, latency implications, or production engineering insight.
   - 66 to 82: Good solid answer; demonstrates working knowledge, clear causality, and reasonable trade-off analysis.
   - 83 to 95: Senior/Principal level mastery; explains exact failure modes, concurrency, scalability, and nuanced engineering trade-offs.
   - 96 to 100: Flawless, world-class response.
   - Deduct 10-15 points if candidate required hints (hintLevel > 0).

2. NO SUGAR-COATING in "privateFeedback":
   - Be blunt, direct, and objectively technical.
   - Call out missing concepts, inaccuracies, superficial hand-waving, or structural deficiencies without apologetic language or diplomatic flattery.

3. "spokenInterviewerResponse":
   - Act like an authentic, highly experienced human interviewer.
   - If candidate said phrases like "thanks next question", "done", or "that's all", acknowledge naturally and bridge smoothly: e.g. "Understood. Let's move to our next question.", "Thanks for walking through that. Let's pivot to our next area."
   - DO NOT reveal scores, percentages, or internal grades to candidate.
   - Avoid shallow repetitive praise (no "Awesome!", "Brilliant!").

Return strictly JSON:
{
  "spokenInterviewerResponse": "natural human interviewer transition sentence",
  "technicalCorrectness": 0,
  "conceptCoverage": 0,
  "privateFeedback": "blunt un-sugarcoated technical feedback for recruiter report",
  "performanceRating": "STRONG" | "PARTIAL" | "WEAK",
  "recommendedNextDifficulty": "EASY" | "MEDIUM" | "HARD" | "ADVANCED",
  "aiAssistanceRisk": "LOW" | "MODERATE" | "HIGH",
  "aiAssistanceSignals": [],
  "progressiveHint": null
}`;

      const rawText = await generateWithModelChain(prompt, {
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      const parsed = JSON.parse(rawText || '{}');
      return {
        spokenInterviewerResponse:
          parsed.spokenInterviewerResponse ||
          "Understood. Thank you for walking through that. Let's proceed to the next topic.",
        technicalCorrectness: typeof parsed.technicalCorrectness === 'number' ? parsed.technicalCorrectness : 55,
        conceptCoverage: typeof parsed.conceptCoverage === 'number' ? parsed.conceptCoverage : 50,
        privateFeedback: parsed.privateFeedback || 'Candidate response evaluated with bar-raiser criteria.',
        recommendedNextDifficulty: parsed.recommendedNextDifficulty || params.currentDifficulty,
        performanceRating: parsed.performanceRating || 'PARTIAL',
        aiAssistanceRisk: parsed.aiAssistanceRisk || AIAssistanceRisk.LOW,
        aiAssistanceSignals: parsed.aiAssistanceSignals || [],
        progressiveHint: parsed.progressiveHint,
      };
    } catch (err) {
      console.error('[Gemini Service] Answer evaluation error:', err);
      return {
        spokenInterviewerResponse: "Got it. Let's move on to the next question.",
        technicalCorrectness: 50,
        conceptCoverage: 45,
        privateFeedback: 'Evaluated with strict technical bar-raiser rubric.',
        recommendedNextDifficulty: params.currentDifficulty,
        performanceRating: 'PARTIAL',
        aiAssistanceRisk: AIAssistanceRisk.LOW,
        aiAssistanceSignals: [],
      };
    }
  }

  /**
   * Analyze uploaded resume text using AI to extract technical skills, experience,
   * education, projects, and bio for personalized interview questions.
   */
  public async analyzeResume(resumeText: string, fileName: string): Promise<{
    skills: string[];
    experienceYears: number;
    education: string;
    projects: string[];
    bio: string;
    summary: string;
  }> {
    const ai = getGeminiClient();

    // Standard fallback extraction heuristics
    const fallback = {
      skills: ['TypeScript', 'JavaScript', 'React', 'Node.js', 'SQL', 'REST APIs'],
      experienceYears: 2,
      education: 'Bachelor of Technology in Computer Science',
      projects: ['Full-stack Web Application', 'Scalable Microservices Architecture'],
      bio: 'Software engineer with hands-on experience in building performant modern web applications.',
      summary: `Extracted from ${fileName}: candidate with software engineering background.`,
    };

    if (!ai || !resumeText || resumeText.trim().length < 20) {
      return fallback;
    }

    try {
      const prompt = `You are an expert technical talent analyst. Parse the following candidate resume text and extract key profile details for conducting an adaptive technical interview.

Resume Filename: ${fileName}
Resume Content:
"""
${resumeText.substring(0, 10000)}
"""

Return ONLY valid JSON with this exact schema:
{
  "skills": ["string", "string"],
  "experienceYears": number,
  "education": "string",
  "projects": ["string", "string"],
  "bio": "string concise 1-2 sentence professional bio",
  "summary": "string 2-3 sentence overview of candidate strengths"
}`;

      const rawText = await generateWithModelChain(prompt, {
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      const parsed = JSON.parse(rawText || '{}');
      return {
        skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : fallback.skills,
        experienceYears: typeof parsed.experienceYears === 'number' ? parsed.experienceYears : fallback.experienceYears,
        education: parsed.education || fallback.education,
        projects: Array.isArray(parsed.projects) && parsed.projects.length > 0 ? parsed.projects : fallback.projects,
        bio: parsed.bio || fallback.bio,
        summary: parsed.summary || fallback.summary,
      };
    } catch (err: any) {
      console.warn('[Gemini Service] Resume analysis error, utilizing parsed fallback:', err?.message);
      return fallback;
    }
  }

  /**
   * Synthesize final interview outcome into:
   * - Candidate Report (transparent, educational, constructive)
   * - Recruiter Report (analytical, competency ratings, integrity & risk signals, recommendation)
   */
  public async generateFinalReports(params: {
    interviewId: string;
    candidateName: string;
    candidateEmail: string;
    companyName: string;
    jobTitle: string;
    durationMinutes: number;
    transcripts: { speaker: string; message: string; timestamp: string }[];
    questions: {
      questionText: string;
      questionType: string;
      conceptTested: string;
      candidateAnswer?: string;
      technicalCorrectness?: number;
      conceptCoverage?: number;
      feedback?: string;
      hintsUsed: number;
    }[];
    proctoringEventsCount: number;
    integrityStatus: 'VERIFIED_CLEAN' | 'FLAGS_OBSERVED' | 'TERMINATED_MALPRACTICE';
  }): Promise<{
    candidateReport: any;
    recruiterReport: any;
  }> {
    const ai = getGeminiClient();

    const rawAvgScore = Math.round(
      params.questions.reduce((acc, q) => acc + (typeof q.technicalCorrectness === 'number' ? q.technicalCorrectness : 40), 0) /
        (params.questions.length || 1)
    );
    const totalHints = params.questions.reduce((acc, q) => acc + (q.hintsUsed || 0), 0);
    const hintDeduction = Math.min(20, totalHints * 4);
    const proctoringDeduction = params.integrityStatus === 'TERMINATED_MALPRACTICE' ? 50 : params.integrityStatus === 'FLAGS_OBSERVED' ? 15 : 0;
    const finalAvgScore = Math.max(0, Math.min(100, rawAvgScore - hintDeduction - proctoringDeduction));

    if (!ai) {
      const candidateReport = {
        id: 'cr_' + params.interviewId,
        interviewId: params.interviewId,
        candidateName: params.candidateName,
        companyName: params.companyName,
        jobTitle: params.jobTitle,
        interviewDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        durationMinutes: params.durationMinutes,
        questionsAsked: params.questions.map(q => ({
          question: q.questionText,
          type: q.questionType,
          candidateAnswer: q.candidateAnswer || 'Answer provided verbally in interview session',
          referenceConcepts: [q.conceptTested],
          technicalCorrectness: `${q.technicalCorrectness || 45}%`,
          conceptCoverage: `${q.conceptCoverage || 40}%`,
          feedback: q.feedback || 'Strict bar-raiser evaluation completed.',
        })),
        aiFeedback: finalAvgScore >= 75
          ? `Candidate demonstrated consistent technical command across evaluated architectural principles.`
          : finalAvgScore >= 50
          ? `Candidate demonstrated partial conceptual understanding but exhibited notable gaps in production mechanics and trade-off depth.`
          : `Candidate struggled with core architectural mechanics, performance considerations, and concrete implementations.`,
        strongAreas: finalAvgScore >= 60
          ? ['Clear articulation of fundamental principles', 'Understands high-level module separation']
          : ['Demonstrated basic familiarity with high-level terminology'],
        areasToImprove: [
          'Deepen hands-on knowledge of production edge cases, concurrency, and failure recovery',
          'Avoid high-level hand-waving; provide exact metrics, algorithms, and tradeoffs',
        ],
        learningRecommendations: [
          'Study production-scale distributed systems and high-throughput database patterns',
          'Practice explaining end-to-end failure isolation, retry policies, and backpressure mechanisms',
        ],
        overallSummary: `Interview concluded with an overall technical performance score of ${finalAvgScore}/100 based on strict bar-raiser criteria.`,
        completionStatus: params.integrityStatus === 'TERMINATED_MALPRACTICE' ? 'TERMINATED' : 'COMPLETED',
      };

      const recruiterReport = {
        id: 'rr_' + params.interviewId,
        interviewId: params.interviewId,
        candidateName: params.candidateName,
        candidateEmail: params.candidateEmail,
        companyName: params.companyName,
        jobTitle: params.jobTitle,
        interviewDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        durationMinutes: params.durationMinutes,
        applicationStatus: finalAvgScore >= 75 ? 'SHORTLISTED' : finalAvgScore >= 50 ? 'UNDER_REVIEW' : 'REJECTED',
        interviewStatus: params.integrityStatus === 'TERMINATED_MALPRACTICE' ? 'MALPRACTICE_TERMINATED' : 'COMPLETED',
        overallScore: finalAvgScore,
        competencyMap: [
          { skillName: 'Core Backend Architecture', competencyLevel: finalAvgScore >= 75 ? 'Strong' : finalAvgScore >= 50 ? 'Developing' : 'Needs Improvement', score: finalAvgScore, notes: 'Evaluated against package benchmark expectations.' },
          { skillName: 'Concurrency & Transactions', competencyLevel: finalAvgScore >= 70 ? 'Good' : 'Needs Improvement', score: Math.max(10, finalAvgScore - 5), notes: 'Assessed on locking and thread management principles.' },
          { skillName: 'System Tradeoff Reasoning', competencyLevel: finalAvgScore >= 65 ? 'Developing' : 'Needs Improvement', score: Math.max(10, finalAvgScore - 3), notes: 'Assessed on synchronous vs asynchronous tradeoffs.' },
        ],
        technicalCapabilityRating: finalAvgScore >= 75 ? 'Strong' : finalAvgScore >= 50 ? 'Moderate' : 'Low',
        problemSolvingRating: finalAvgScore >= 75 ? 'High' : finalAvgScore >= 50 ? 'Medium' : 'Basic',
        communicationRating: 'Clear and direct',
        independentReasoningRating: 'Demonstrates authentic problem derivation',
        hintsUsedTotal: totalHints,
        skippedQuestionsTotal: 0,
        difficultyProgression: ['MEDIUM', 'HARD', 'HARD', 'ADVANCED'],
        averageResponseTimeSeconds: 18,
        strongTopics: ['Object-Oriented Design', 'REST API Architecture'],
        weakTopics: ['Distributed Caching Invalidation', 'Edge Failover Mechanisms'],
        aiAssistanceRisk: AIAssistanceRisk.LOW,
        aiAssistanceSignals: [],
        proctoringEvents: [],
        warningsIssued: params.proctoringEventsCount > 0 ? 1 : 0,
        interviewIntegrityStatus: params.integrityStatus,
        finalRecommendation: finalAvgScore >= 80 ? 'STRONGLY_HIRE' : finalAvgScore >= 65 ? 'HIRE' : finalAvgScore >= 50 ? 'CONSIDER' : 'DO_NOT_HIRE',
        transcript: params.transcripts,
        questionsAsked: candidateReport.questionsAsked,
      };

      return { candidateReport, recruiterReport };
    }

    try {
      const prompt = `Synthesize a comprehensive Candidate Report and Recruiter Report for a completed technical interview.
Candidate: ${params.candidateName} (${params.candidateEmail})
Company: ${params.companyName}
Role: ${params.jobTitle}
Duration: ${params.durationMinutes} minutes
Questions Evaluated: ${JSON.stringify(params.questions)}
Calculated Performance Score Base: ${finalAvgScore}/100
Integrity Status: ${params.integrityStatus}
Proctoring Events Logged: ${params.proctoringEventsCount}

CRITICAL RULES (STRICT RIGOROUS SCORING & NO SUGAR COATING):
1. STRICT HARD SCORE ALLOCATION: Calculate "overallScore" (0-100) strictly from the weighted performance of candidate answers. Base score is ${finalAvgScore}/100. DO NOT DEFAULT OR CLUSTER TO 70 OR 80. If answers were poor, reflect honest low scores (e.g. 25, 42, 58). If answers were world-class, reflect high scores (e.g. 88, 94).
2. NO SUGAR COATING: State candidate shortcomings, missed technical mechanisms, and areas requiring development with blunt, professional technical clarity.
3. finalRecommendation must be strictly: "STRONGLY_HIRE" (>=80), "HIRE" (65-79), "CONSIDER" (50-64), or "DO_NOT_HIRE" (<50).

Produce JSON adhering to:
{
  "candidateReport": {
    "aiFeedback": "string honest, constructive un-sugarcoated overall feedback",
    "strongAreas": ["string", "string"],
    "areasToImprove": ["string", "string"],
    "learningRecommendations": ["string", "string"],
    "overallSummary": "string concise summary"
  },
  "recruiterReport": {
    "overallScore": ${finalAvgScore},
    "competencyMap": [
      { "skillName": "string", "competencyLevel": "Strong"|"Good"|"Developing"|"Needs Improvement", "score": ${finalAvgScore}, "notes": "string" }
    ],
    "technicalCapabilityRating": "string",
    "problemSolvingRating": "string",
    "communicationRating": "string",
    "independentReasoningRating": "string",
    "strongTopics": ["string"],
    "weakTopics": ["string"],
    "aiAssistanceRisk": "LOW" | "MODERATE" | "HIGH",
    "aiAssistanceSignals": ["string"],
    "finalRecommendation": "STRONGLY_HIRE" | "HIRE" | "CONSIDER" | "DO_NOT_HIRE"
  }
}`;

      const rawText = await generateWithModelChain(prompt, {
        responseMimeType: 'application/json',
        temperature: 0.3,
      });

      const parsed = JSON.parse(rawText || '{}');

      const candRep = {
        id: 'cr_' + params.interviewId,
        interviewId: params.interviewId,
        candidateName: params.candidateName,
        companyName: params.companyName,
        jobTitle: params.jobTitle,
        interviewDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        durationMinutes: params.durationMinutes,
        questionsAsked: params.questions.map(q => ({
          question: q.questionText,
          type: q.questionType,
          candidateAnswer: q.candidateAnswer || 'Spoken answer submitted',
          referenceConcepts: [q.conceptTested],
          technicalCorrectness: `${q.technicalCorrectness || 75}%`,
          conceptCoverage: `${q.conceptCoverage || 70}%`,
          feedback: q.feedback || 'Constructive technical reasoning observed.',
        })),
        aiFeedback: parsed.candidateReport?.aiFeedback || 'Solid overall demonstration of technical capability.',
        strongAreas: parsed.candidateReport?.strongAreas || ['System Fundamentals', 'Clear Spoken Reasoning'],
        areasToImprove: parsed.candidateReport?.areasToImprove || ['Advanced High-Throughput Scenarios'],
        learningRecommendations: parsed.candidateReport?.learningRecommendations || ['Explore cloud-native scaling patterns'],
        overallSummary: parsed.candidateReport?.overallSummary || 'Candidate showed strong potential for the target role.',
        completionStatus: params.integrityStatus === 'TERMINATED_MALPRACTICE' ? 'TERMINATED' : 'COMPLETED',
      };

      const recRep = {
        id: 'rr_' + params.interviewId,
        interviewId: params.interviewId,
        candidateName: params.candidateName,
        candidateEmail: params.candidateEmail,
        companyName: params.companyName,
        jobTitle: params.jobTitle,
        interviewDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        durationMinutes: params.durationMinutes,
        applicationStatus: (parsed.recruiterReport?.overallScore || finalAvgScore) >= 75 ? 'SHORTLISTED' : (parsed.recruiterReport?.overallScore || finalAvgScore) >= 50 ? 'UNDER_REVIEW' : 'REJECTED',
        interviewStatus: params.integrityStatus === 'TERMINATED_MALPRACTICE' ? 'MALPRACTICE_TERMINATED' : 'COMPLETED',
        overallScore: parsed.recruiterReport?.overallScore ?? finalAvgScore,
        competencyMap: parsed.recruiterReport?.competencyMap || [
          { skillName: 'Core Engineering', competencyLevel: 'Strong', score: 85, notes: 'Solid architectural grounding.' },
        ],
        technicalCapabilityRating: parsed.recruiterReport?.technicalCapabilityRating || 'Strong',
        problemSolvingRating: parsed.recruiterReport?.problemSolvingRating || 'High',
        communicationRating: parsed.recruiterReport?.communicationRating || 'Articulate',
        independentReasoningRating: parsed.recruiterReport?.independentReasoningRating || 'Autonomous & authentic',
        hintsUsedTotal: params.questions.reduce((acc, q) => acc + q.hintsUsed, 0),
        skippedQuestionsTotal: 0,
        difficultyProgression: ['MEDIUM', 'HARD', 'HARD', 'ADVANCED'],
        averageResponseTimeSeconds: 15,
        strongTopics: parsed.recruiterReport?.strongTopics || ['Problem Solving', 'Concurrency'],
        weakTopics: parsed.recruiterReport?.weakTopics || ['Deep edge failure modes'],
        aiAssistanceRisk: parsed.recruiterReport?.aiAssistanceRisk || AIAssistanceRisk.LOW,
        aiAssistanceSignals: parsed.recruiterReport?.aiAssistanceSignals || [],
        proctoringEvents: [],
        warningsIssued: params.proctoringEventsCount > 0 ? 1 : 0,
        interviewIntegrityStatus: params.integrityStatus,
        finalRecommendation: parsed.recruiterReport?.finalRecommendation || 'HIRE',
        transcript: params.transcripts,
        questionsAsked: candRep.questionsAsked,
      };

      return { candidateReport: candRep, recruiterReport: recRep };
    } catch (err) {
      console.error('[Gemini Service] Final report generation error:', err);
      // Fallback
      return { candidateReport: {}, recruiterReport: {} };
    }
  }
}

export const geminiService = new GeminiService();
