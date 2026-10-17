import { Pool } from 'pg';
import crypto from 'crypto';
import {
  User,
  UserRole,
  Company,
  Job,
  JobStatus,
  InterviewRegistration,
  InterviewStatus,
  QuestionRecord,
  TranscriptItem,
  ProctoringEvent,
  RoundStatus,
} from '../../src/types/index.js';

let pool: Pool | null = null;

export function toUuid(id: string): string {
  if (!id) return crypto.randomUUID();
  const clean = String(id).trim().toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
    return clean;
  }
  const hash = crypto.createHash('md5').update('seed:' + clean).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function getNeonPool(): Pool | null {
  const dbUrl = (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  if (!pool && dbUrl) {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });

    pool.on('error', (err) => {
      console.error('[Neon DB] Unexpected pool client error:', err.message);
    });
  }
  return pool;
}

export class NeonDatabaseService {
  private isConnected = false;

  public async init(): Promise<void> {
    const p = getNeonPool();
    if (!p) {
      console.warn('[Neon DB] No DATABASE_URL provided. Operating in local mode.');
      return;
    }

    try {
      const res = await p.query('SELECT NOW() as connected_at, current_database() as db;');
      this.isConnected = true;
      console.log(`[Neon DB] Connected successfully to ${res.rows[0].db} at ${res.rows[0].connected_at}`);
      await this.ensureCascadeConstraints(p);
    } catch (err: any) {
      console.error('[Neon DB] Initial connection error:', err.message);
    }
  }

  private async ensureCascadeConstraints(p: Pool): Promise<void> {
    try {
      // 1. Ensure required columns in jobs for full persistence
      await p.query(`
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pipeline_rounds JSONB;
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_config JSONB;
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS technical_assessment_questions JSONB;
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_skills TEXT[];
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS preferred_skills TEXT[];
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS openings INTEGER DEFAULT 1;
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience VARCHAR(100);
      `).catch(e => console.warn('[Neon DB] Column ensure note:', e.message));

      // 2. Ensure cascade foreign keys so child records delete cleanly with parent
      const alterCommands = [
        `ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_job_id_fkey;
         ALTER TABLE job_applications ADD CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;`,
        `ALTER TABLE interview_registrations DROP CONSTRAINT IF EXISTS interview_registrations_job_id_fkey;
         ALTER TABLE interview_registrations ADD CONSTRAINT interview_registrations_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;`,
        `ALTER TABLE interview_registrations DROP CONSTRAINT IF EXISTS interview_registrations_application_id_fkey;
         ALTER TABLE interview_registrations ADD CONSTRAINT interview_registrations_application_id_fkey FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE;`,
        `ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_job_id_fkey;
         ALTER TABLE interviews ADD CONSTRAINT interviews_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;`,
        `ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_registration_id_fkey;
         ALTER TABLE interviews ADD CONSTRAINT interviews_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES interview_registrations(id) ON DELETE CASCADE;`,
        `ALTER TABLE interview_reports DROP CONSTRAINT IF EXISTS interview_reports_job_id_fkey;
         ALTER TABLE interview_reports ADD CONSTRAINT interview_reports_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;`,
        `ALTER TABLE interview_reports DROP CONSTRAINT IF EXISTS interview_reports_interview_id_fkey;
         ALTER TABLE interview_reports ADD CONSTRAINT interview_reports_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE;`,
        `ALTER TABLE malpractice_events DROP CONSTRAINT IF EXISTS malpractice_events_job_id_fkey;
         ALTER TABLE malpractice_events ADD CONSTRAINT malpractice_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;`,
        `ALTER TABLE malpractice_events DROP CONSTRAINT IF EXISTS malpractice_events_interview_id_fkey;
         ALTER TABLE malpractice_events ADD CONSTRAINT malpractice_events_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE;`,
        `ALTER TABLE recruiter_decisions DROP CONSTRAINT IF EXISTS recruiter_decisions_interview_id_fkey;
         ALTER TABLE recruiter_decisions ADD CONSTRAINT recruiter_decisions_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE;`,
        `ALTER TABLE interview_answers DROP CONSTRAINT IF EXISTS interview_answers_question_id_fkey;
         ALTER TABLE interview_answers ADD CONSTRAINT interview_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE CASCADE;`
      ];
      for (const cmd of alterCommands) {
        await p.query(cmd).catch(() => {});
      }
    } catch (e: any) {
      console.warn('[Neon DB] Note on constraint cascade setup:', e.message);
    }
  }

  // --- Users ---
  public async saveUser(user: User): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      // Ensure user ID is valid UUID
      const userId = user.id.includes('-') && user.id.length === 36 ? user.id : crypto.randomUUID();
      const authProvider = user.googleId ? 'GOOGLE' : 'LOCAL';
      const accountStatus = user.isVerified ? 'ACTIVE' : 'PENDING_VERIFICATION';

      await p.query(
        `INSERT INTO users (id, full_name, email, password_hash, role, account_status, email_verified, auth_provider, google_subject_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
             email_verified = EXCLUDED.email_verified,
             account_status = EXCLUDED.account_status,
             auth_provider = EXCLUDED.auth_provider,
             google_subject_id = COALESCE(EXCLUDED.google_subject_id, users.google_subject_id),
             updated_at = NOW();`,
        [
          userId,
          user.fullName,
          user.email.toLowerCase().trim(),
          user.passwordHash || 'N/A',
          user.role || 'CANDIDATE',
          accountStatus,
          user.isVerified || false,
          authProvider,
          user.googleId || null,
        ]
      );

      // Candidate profile if candidate
      if (user.role === UserRole.CANDIDATE || !user.role) {
        await p.query(
          `INSERT INTO candidate_profiles (id, user_id, primary_skill, created_at, updated_at)
           VALUES ($1, $1, $2, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING;`,
          [userId, 'Software Engineering']
        );
      }
      console.log(`[Neon DB] User saved to Neon console: ${user.email} (${userId})`);
    } catch (err: any) {
      console.error(`[Neon DB] Error saving user ${user.email}:`, err.message);
    }
  }

  public async updateUserStatus(email: string, verified: boolean, status: string = 'ACTIVE'): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      await p.query(
        `UPDATE users
         SET email_verified = $1, account_status = $2, updated_at = NOW()
         WHERE email = $3;`,
        [verified, status, email.toLowerCase().trim()]
      );
      console.log(`[Neon DB] Updated verification status in Neon for: ${email}`);
    } catch (err: any) {
      console.error(`[Neon DB] Error updating verification for ${email}:`, err.message);
    }
  }

  public async saveEmailVerification(email: string, otp: string, expiresAtMs: number, explicitUserId?: string): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      const cleanEmail = email.toLowerCase().trim();
      let userRes = await p.query('SELECT id FROM users WHERE email = $1;', [cleanEmail]);
      let userId: string | null = userRes.rows[0]?.id || null;

      // If user not in Neon yet, look up in local db and synchronize user first
      if (!userId) {
        try {
          const { db } = await import('../db.js');
          const localUser = db.findUserByEmail(cleanEmail);
          if (localUser) {
            await this.saveUser(localUser);
            userRes = await p.query('SELECT id FROM users WHERE email = $1;', [cleanEmail]);
            userId = userRes.rows[0]?.id || null;
          }
        } catch (syncErr: any) {
          console.warn('[Neon DB] Could not sync user before saving verification:', syncErr.message);
        }
      }

      if (!userId && explicitUserId && explicitUserId.includes('-') && explicitUserId.length === 36) {
        userId = explicitUserId;
      }

      // If still no user in users table, skip inserting to email_verifications because user_id NOT NULL and FK constraints exist
      if (!userId) {
        console.warn(`[Neon DB] Skipping email_verifications insert for ${cleanEmail}: user does not exist in users table.`);
        return;
      }

      const id = crypto.randomUUID();

      await p.query(
        `INSERT INTO email_verifications (id, user_id, email, otp_hash, expires_at, attempt_count, max_attempts, is_used, created_at)
         VALUES ($1, $2, $3, $4, TO_TIMESTAMP($5 / 1000.0), 0, 5, false, NOW());`,
        [id, userId, cleanEmail, otp, expiresAtMs]
      );
      console.log(`[Neon DB] OTP saved to Neon email_verifications table for: ${cleanEmail}`);
    } catch (err: any) {
      console.error(`[Neon DB] Error saving email verification:`, err.message);
    }
  }

  public async markEmailVerificationUsed(email: string, otp: string): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      await p.query(
        `UPDATE email_verifications
         SET is_used = true, verified_at = NOW()
         WHERE email = $1 AND otp_hash = $2 AND is_used = false;`,
        [email.toLowerCase().trim(), otp]
      );
    } catch (err: any) {
      console.error('[Neon DB] Error marking verification used:', err.message);
    }
  }

  public async saveSession(session: { token: string; userId: string; email: string; expiresAt: number }): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      const cleanEmail = session.email.toLowerCase().trim();
      let finalUserId: string | null = null;

      // 1. First priority: look up the user by email in Neon users table
      let u = await p.query('SELECT id FROM users WHERE email = $1;', [cleanEmail]);
      if (u.rows[0]?.id) {
        finalUserId = u.rows[0].id;
      }

      // 2. If not found by email, check if session.userId exists in Neon users table
      if (!finalUserId && session.userId && session.userId.includes('-') && session.userId.length === 36) {
        const uById = await p.query('SELECT id FROM users WHERE id = $1;', [session.userId]);
        if (uById.rows[0]?.id) {
          finalUserId = uById.rows[0].id;
        }
      }

      // 3. If still not in Neon, fetch from local memory and persist user to Neon first
      if (!finalUserId) {
        try {
          const { db } = await import('../db.js');
          const localUser = db.findUserByEmail(cleanEmail) || db.findUserById(session.userId);
          if (localUser) {
            await this.saveUser(localUser);
            u = await p.query('SELECT id FROM users WHERE email = $1;', [cleanEmail]);
            finalUserId = u.rows[0]?.id || null;
          }
        } catch (syncErr: any) {
          console.warn('[Neon DB] Could not sync user before saving session:', syncErr.message);
        }
      }

      // 4. If user still cannot be found in Neon users table, skip inserting to avoid foreign key violation
      if (!finalUserId) {
        console.warn(`[Neon DB] Skipping user_sessions insert for ${cleanEmail}: user does not exist in users table.`);
        return;
      }

      // 5. Keep local user id aligned with Neon user id
      try {
        const { db } = await import('../db.js');
        const localUser = db.findUserByEmail(cleanEmail);
        if (localUser && localUser.id !== finalUserId) {
          localUser.id = finalUserId;
        }
      } catch (ignore) {}

      const id = crypto.randomUUID();
      await p.query(
        `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
         VALUES ($1, $2, $3, TO_TIMESTAMP($4 / 1000.0), NOW())
         ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at;`,
        [id, finalUserId, session.token, session.expiresAt]
      );
      console.log(`[Neon DB] Session persisted to Neon user_sessions for: ${cleanEmail} (${finalUserId})`);
    } catch (err: any) {
      console.error('[Neon DB] Error saving user session:', err.message);
    }
  }

  // --- Companies & Jobs ---
  public async saveCompany(company: Company): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      const compId = company.id.includes('-') && company.id.length === 36 ? company.id : crypto.randomUUID();
      const slug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

      await p.query(
        `INSERT INTO companies (id, name, slug, description, industry, headquarters, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, description = EXCLUDED.description, industry = EXCLUDED.industry;`,
        [compId, company.name, slug, company.description || 'Talent acquisition portal', company.industry || 'Technology', company.location || 'Remote']
      );
      console.log(`[Neon DB] Company saved to Neon: ${company.name} (${compId})`);
    } catch (err: any) {
      console.error('[Neon DB] Error saving company:', err.message);
    }
  }

  public async saveJob(job: Job): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      const jobId = toUuid(job.id);
      const compId = toUuid(job.companyId);

      // Ensure company exists
      await p.query(
        `INSERT INTO companies (id, name, slug, description, industry, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = COALESCE(EXCLUDED.name, companies.name),
           updated_at = NOW();`,
        [compId, job.company?.name || 'Partner Company', 'comp-' + compId.substring(0, 8), 'Company profile', 'Technology']
      );

      // Resolve recruiter user in Neon to satisfy jobs.recruiter_id -> users(id) foreign key
      let recruiterUserId: string | null = null;
      if (job.recruiterId) {
        const rUuid = toUuid(job.recruiterId);
        const uCheck = await p.query('SELECT id FROM users WHERE id = $1;', [rUuid]);
        if (uCheck.rows[0]?.id) {
          recruiterUserId = uCheck.rows[0].id;
        } else {
          // Look up user email locally
          try {
            const { db } = await import('../db.js');
            const localUser = db.findUserById(job.recruiterId);
            if (localUser?.email) {
              const uByEmail = await p.query('SELECT id FROM users WHERE email = $1;', [localUser.email.toLowerCase().trim()]);
              if (uByEmail.rows[0]?.id) {
                recruiterUserId = uByEmail.rows[0].id;
              }
            }
          } catch (e: any) {
            console.warn('[Neon DB] Could not resolve local user for recruiterId:', e.message);
          }
        }
      }

      // If still no recruiter user, find any recruiter/admin in Neon or create one
      if (!recruiterUserId) {
        const anyRecruiter = await p.query("SELECT id FROM users WHERE role IN ('RECRUITER', 'ADMIN') LIMIT 1;");
        if (anyRecruiter.rows[0]?.id) {
          recruiterUserId = anyRecruiter.rows[0].id;
        } else {
          const newUserId = crypto.randomUUID();
          await p.query(
            `INSERT INTO users (id, full_name, email, password_hash, role, account_status, email_verified, auth_provider)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (email) DO NOTHING;`,
            [newUserId, 'Recruiter Admin', 'recruiter@technova.com', 'N/A', 'RECRUITER', 'ACTIVE', true, 'LOCAL']
          );
          recruiterUserId = newUserId;
        }
      }

      // Ensure recruiter_profiles has an entry for this user
      const rpCheck = await p.query('SELECT id FROM recruiter_profiles WHERE user_id = $1;', [recruiterUserId]);
      if (!rpCheck.rows[0]?.id) {
        const newRpId = crypto.randomUUID();
        await p.query(
          `INSERT INTO recruiter_profiles (id, user_id, company_id, designation, work_email, is_company_admin)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (id) DO NOTHING;`,
          [newRpId, recruiterUserId, compId, 'Recruitment Lead', 'talent@technova.com']
        ).catch(() => {});
      }

      const jobCode = job.jobCode || ('JOB-' + jobId.substring(0, 8).toUpperCase());
      const regCloseDate = job.registrationClosingDate
        ? (job.registrationClosingDate.includes('T') ? job.registrationClosingDate.split('T')[0] : job.registrationClosingDate)
        : null;
      const deadlineDate = job.deadline
        ? (job.deadline.includes('T') ? job.deadline.split('T')[0] : job.deadline)
        : null;

      await p.query(
        `INSERT INTO jobs (
          id, company_id, recruiter_id, title, job_code, description, location, work_mode,
          employment_type, qualification, experience, experience_requirements, eligibility_criteria,
          required_skills, preferred_skills, required_certifications,
          currency, minimum_package, maximum_package, salary_package, status, duration_minutes,
          openings, registration_closing_date, deadline,
          num_questions, num_technical_questions, num_coding_questions, num_mcq_questions,
          pipeline_rounds, interview_config, technical_assessment_questions, metadata,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20, $21, $22,
          $23, $24, $25,
          $26, $27, $28, $29,
          $30, $31, $32, $33,
          COALESCE((SELECT created_at FROM jobs WHERE id = $1), NOW()),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          job_code = COALESCE(EXCLUDED.job_code, jobs.job_code),
          description = EXCLUDED.description,
          location = EXCLUDED.location,
          work_mode = EXCLUDED.work_mode,
          employment_type = EXCLUDED.employment_type,
          qualification = EXCLUDED.qualification,
          experience = EXCLUDED.experience,
          experience_requirements = EXCLUDED.experience_requirements,
          eligibility_criteria = EXCLUDED.eligibility_criteria,
          required_skills = EXCLUDED.required_skills,
          preferred_skills = EXCLUDED.preferred_skills,
          required_certifications = EXCLUDED.required_certifications,
          currency = EXCLUDED.currency,
          minimum_package = EXCLUDED.minimum_package,
          maximum_package = EXCLUDED.maximum_package,
          salary_package = EXCLUDED.salary_package,
          openings = EXCLUDED.openings,
          registration_closing_date = EXCLUDED.registration_closing_date,
          deadline = EXCLUDED.deadline,
          duration_minutes = EXCLUDED.duration_minutes,
          num_questions = EXCLUDED.num_questions,
          num_technical_questions = EXCLUDED.num_technical_questions,
          num_coding_questions = EXCLUDED.num_coding_questions,
          num_mcq_questions = EXCLUDED.num_mcq_questions,
          status = EXCLUDED.status,
          pipeline_rounds = EXCLUDED.pipeline_rounds,
          interview_config = EXCLUDED.interview_config,
          technical_assessment_questions = EXCLUDED.technical_assessment_questions,
          metadata = EXCLUDED.metadata,
          updated_at = NOW();`,
        [
          jobId,
          compId,
          recruiterUserId,
          job.title,
          jobCode,
          job.description,
          job.location || 'Remote',
          job.workMode || 'REMOTE',
          job.employmentType || 'Full Time',
          job.qualification || "Bachelor's Degree",
          job.experience || '1-3 Years',
          job.experienceRequirements || job.experience || null,
          job.eligibilityCriteria || null,
          Array.isArray(job.requiredSkills) ? job.requiredSkills : [],
          Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
          Array.isArray(job.requiredCertifications) ? job.requiredCertifications : [],
          job.currency || 'INR',
          job.minPackage || 600000,
          job.maxPackage || 1200000,
          job.salaryPackage || null,
          job.status || 'ACTIVE',
          job.durationMinutes || 20,
          job.openings || 1,
          regCloseDate,
          deadlineDate,
          job.numQuestions || 5,
          job.numTechnicalQuestions || null,
          job.numCodingQuestions || null,
          job.numMcqQuestions || null,
          job.rounds ? JSON.stringify(job.rounds) : null,
          job.interviewConfig ? JSON.stringify(job.interviewConfig) : null,
          job.technicalAssessmentQuestions ? JSON.stringify(job.technicalAssessmentQuestions) : null,
          JSON.stringify({
            salaryPackage: job.salaryPackage,
            deadline: job.deadline,
            registrationClosingDate: job.registrationClosingDate,
            eligibilityCriteria: job.eligibilityCriteria,
            requiredCertifications: job.requiredCertifications,
            additionalInformation: job.additionalInformation,
            rounds: job.rounds,
            interviewConfig: job.interviewConfig,
            technicalAssessmentQuestions: job.technicalAssessmentQuestions,
          }),
        ]
      );
      console.log(`[Neon DB] Job saved/updated in Neon console: ${job.title} (${jobId})`);
    } catch (err: any) {
      console.error('[Neon DB] Error saving job to Neon:', err.message);
    }
  }

  public async deleteAssessment(id: string): Promise<void> {
    const p = getNeonPool();
    if (!p) return;
    try {
      await p.query('DELETE FROM assessment_submissions WHERE assessment_id = $1;', [id]).catch(() => {});
      await p.query('DELETE FROM assessments WHERE id = $1;', [id]).catch(() => {});
      await p.query('DELETE FROM technical_assessments WHERE id = $1;', [id]).catch(() => {});
      console.log(`[Neon DB] Assessment deleted: ${id}`);
    } catch (err: any) {
      console.error('[Neon DB] Error deleting assessment:', err.message);
    }
  }

  public async deleteJob(jobId: string): Promise<void> {
    const p = getNeonPool();
    if (!p || !jobId) return;

    const targetUuid = toUuid(jobId);
    const client = await p.connect();
    try {
      await client.query('BEGIN');

      // Query which tables actually exist in public schema to prevent missing relation errors
      const tablesRes = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
      );
      const existingTables = new Set(tablesRes.rows.map((r: any) => r.table_name));

      const safeDelete = async (tableName: string, sqlQuery: string, params: any[]) => {
        if (!existingTables.has(tableName)) return;
        try {
          await client.query('SAVEPOINT sp_del');
          await client.query(sqlQuery, params);
          await client.query('RELEASE SAVEPOINT sp_del');
        } catch (err: any) {
          await client.query('ROLLBACK TO SAVEPOINT sp_del').catch(() => {});
          console.warn(`[Neon DB] Safe delete on ${tableName} note:`, err.message);
        }
      };

      // 1. Delete assessment submissions & submissions details for this job
      await safeDelete('assessment_submissions', 'DELETE FROM assessment_submissions WHERE job_id = $1 OR assessment_id IN (SELECT id FROM assessments WHERE job_id = $1);', [targetUuid]);

      // 2. Delete assessments (both assessments & technical_assessments tables)
      await safeDelete('assessments', 'DELETE FROM assessments WHERE job_id = $1;', [targetUuid]);
      await safeDelete('technical_assessments', 'DELETE FROM technical_assessments WHERE job_id = $1;', [targetUuid]);

      // 3. Delete HR interviews & Job offers & Recruiter notifications referencing this job
      await safeDelete('hr_interviews', 'DELETE FROM hr_interviews WHERE job_id = $1;', [targetUuid]);
      await safeDelete('job_offers', 'DELETE FROM job_offers WHERE job_id = $1;', [targetUuid]);
      await safeDelete('recruiter_notifications', 'DELETE FROM recruiter_notifications WHERE job_id = $1;', [targetUuid]);

      // 4. Delete child records of interviews
      await safeDelete('recruiter_decisions', `DELETE FROM recruiter_decisions WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('interview_reports', `DELETE FROM interview_reports WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1) OR job_id = $1;`, [targetUuid]);
      await safeDelete('malpractice_events', `DELETE FROM malpractice_events WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1) OR job_id = $1;`, [targetUuid]);
      await safeDelete('interview_answers', `DELETE FROM interview_answers WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('interview_transcript_messages', `DELETE FROM interview_transcript_messages WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('interview_transcripts', `DELETE FROM interview_transcripts WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('interview_hints', `DELETE FROM interview_hints WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('covered_concepts', `DELETE FROM covered_concepts WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('candidate_competencies', `DELETE FROM candidate_competencies WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('candidate_behavior_metrics', `DELETE FROM candidate_behavior_metrics WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('ai_assistance_signals', `DELETE FROM ai_assistance_signals WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('proctoring_events', `DELETE FROM proctoring_events WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('interview_session_events', `DELETE FROM interview_session_events WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('question_similarity_checks', `DELETE FROM question_similarity_checks WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('interview_system_checks', `DELETE FROM interview_system_checks WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);
      await safeDelete('interview_questions', `DELETE FROM interview_questions WHERE interview_id IN (SELECT id FROM interviews WHERE job_id = $1);`, [targetUuid]);

      // 5. Delete interviews
      await safeDelete('interviews', `DELETE FROM interviews WHERE job_id = $1;`, [targetUuid]);

      // 6. Delete interview registrations and job applications
      await safeDelete('interview_registrations', `DELETE FROM interview_registrations WHERE job_id = $1;`, [targetUuid]);
      await safeDelete('job_applications', `DELETE FROM job_applications WHERE job_id = $1;`, [targetUuid]);

      // 7. Delete additional job tables if present
      await safeDelete('resume_ats_evaluations', `DELETE FROM resume_ats_evaluations WHERE job_id = $1;`, [targetUuid]);
      await safeDelete('recruiter_priority_questions', `DELETE FROM recruiter_priority_questions WHERE job_id = $1;`, [targetUuid]);
      await safeDelete('job_skills', `DELETE FROM job_skills WHERE job_id = $1;`, [targetUuid]);

      // 8. Delete job record
      const res = await client.query('DELETE FROM jobs WHERE id = $1;', [targetUuid]);
      
      await client.query('COMMIT');
      console.log(`[Neon DB] Job and all associated records deleted successfully from Neon: ${jobId} -> ${targetUuid} (rows affected: ${res.rowCount})`);
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[Neon DB] Error deleting job from Neon:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  public async saveCandidateProfile(profile: any): Promise<void> {
    const p = getNeonPool();
    if (!p || !profile?.userId) return;

    try {
      let userId = profile.userId;
      if (!userId.includes('-') || userId.length !== 36) {
        const { db } = await import('../db.js');
        const localUser = db.findUserById(profile.userId);
        if (localUser) {
          const uRes = await p.query('SELECT id FROM users WHERE email = $1;', [localUser.email.toLowerCase().trim()]);
          if (uRes.rows[0]?.id) {
            userId = uRes.rows[0].id;
          }
        }
      }

      const uCheck = await p.query('SELECT id FROM users WHERE id = $1;', [userId]);
      if (!uCheck.rows[0]?.id) {
        console.warn(`[Neon DB] Skipping candidate profile save: user ${userId} not found in Neon.`);
        return;
      }

      const profileId = userId;
      const hasResume = Boolean(profile.resumeFileName || (profile.resumeText && profile.resumeText.length > 20));

      await p.query(
        `INSERT INTO candidate_profiles (
          id, user_id, phone, current_location, experience_years, headline, summary, bio,
          primary_skill, skills, projects, resume_file_name, resume_text, resume_uploaded,
          education_details, extracted_profile, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          COALESCE((SELECT created_at FROM candidate_profiles WHERE id = $1), NOW()),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          phone = COALESCE(EXCLUDED.phone, candidate_profiles.phone),
          current_location = COALESCE(EXCLUDED.current_location, candidate_profiles.current_location),
          experience_years = COALESCE(EXCLUDED.experience_years, candidate_profiles.experience_years),
          headline = COALESCE(EXCLUDED.headline, candidate_profiles.headline),
          summary = COALESCE(EXCLUDED.summary, candidate_profiles.summary),
          bio = COALESCE(EXCLUDED.bio, candidate_profiles.bio),
          primary_skill = COALESCE(EXCLUDED.primary_skill, candidate_profiles.primary_skill),
          skills = COALESCE(EXCLUDED.skills, candidate_profiles.skills),
          projects = COALESCE(EXCLUDED.projects, candidate_profiles.projects),
          resume_file_name = COALESCE(EXCLUDED.resume_file_name, candidate_profiles.resume_file_name),
          resume_text = COALESCE(EXCLUDED.resume_text, candidate_profiles.resume_text),
          resume_uploaded = EXCLUDED.resume_uploaded,
          education_details = COALESCE(EXCLUDED.education_details, candidate_profiles.education_details),
          extracted_profile = COALESCE(EXCLUDED.extracted_profile, candidate_profiles.extracted_profile),
          updated_at = NOW();`,
        [
          profileId,
          userId,
          profile.phone || null,
          profile.location || profile.currentLocation || null,
          Number(profile.experienceYears) || 0,
          profile.headline || null,
          profile.summary || null,
          profile.bio || null,
          profile.primarySkill || 'Software Engineering',
          Array.isArray(profile.skills) ? profile.skills : [],
          Array.isArray(profile.projects) ? profile.projects : [],
          profile.resumeFileName || null,
          profile.resumeText || null,
          hasResume,
          typeof profile.educationDetails === 'object' ? JSON.stringify(profile.educationDetails) : '{}',
          typeof profile.extractedProfile === 'object' ? JSON.stringify(profile.extractedProfile) : '{}',
        ]
      );
      console.log(`[Neon DB] Candidate profile & resume persisted to Neon for user: ${userId}`);
    } catch (err: any) {
      console.error('[Neon DB] Error saving candidate profile:', err.message);
    }
  }

  public async saveAssessment(assessment: any): Promise<void> {
    const p = getNeonPool();
    if (!p) return;
    try {
      // 1. Save to primary assessments table in Neon
      await p.query(
        `INSERT INTO assessments (
          id, job_id, title, description, duration_minutes, passing_score,
          difficulty, skills_tested, anti_cheating_enabled, is_published, questions, created_at, updated_at
        )
        VALUES (
          $1::varchar, $2::uuid, $3::varchar, $4::text, $5::int, $6::int,
          $7::varchar, $8::text[], $9::boolean, $10::boolean, $11::jsonb,
          NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          duration_minutes = EXCLUDED.duration_minutes,
          passing_score = EXCLUDED.passing_score,
          difficulty = EXCLUDED.difficulty,
          skills_tested = EXCLUDED.skills_tested,
          anti_cheating_enabled = EXCLUDED.anti_cheating_enabled,
          is_published = EXCLUDED.is_published,
          questions = EXCLUDED.questions,
          updated_at = NOW();`,
        [
          assessment.id,
          assessment.jobId,
          assessment.title,
          assessment.description || '',
          assessment.durationMinutes || 45,
          assessment.passingScore || 70,
          assessment.difficulty || 'MEDIUM',
          Array.isArray(assessment.skillsTested) ? assessment.skillsTested : ['Algorithms'],
          assessment.antiCheatingEnabled !== false,
          assessment.isPublished !== false,
          JSON.stringify(assessment.questions || []),
        ]
      ).catch(e => console.warn('[Neon DB] Note saving to assessments:', e.message));

      // 2. Also ensure technical_assessments table mirror
      await p.query(
        `CREATE TABLE IF NOT EXISTS technical_assessments (
          id VARCHAR(100) PRIMARY KEY,
          job_id VARCHAR(100),
          recruiter_id VARCHAR(100),
          title TEXT,
          description TEXT,
          duration_minutes INT,
          passing_score INT,
          questions JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );`
      ).catch(() => {});

      await p.query(
        `INSERT INTO technical_assessments (id, job_id, recruiter_id, title, description, duration_minutes, passing_score, questions, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (id) DO UPDATE
         SET title = EXCLUDED.title, description = EXCLUDED.description, duration_minutes = EXCLUDED.duration_minutes, passing_score = EXCLUDED.passing_score, questions = EXCLUDED.questions, updated_at = NOW();`,
        [
          assessment.id,
          assessment.jobId,
          assessment.recruiterId || 'system',
          assessment.title,
          assessment.description || '',
          assessment.durationMinutes || 45,
          assessment.passingScore || 70,
          JSON.stringify(assessment.questions || []),
        ]
      ).catch(() => {});

      console.log(`[Neon DB] Technical assessment with questions saved to Neon: ${assessment.id} for job ${assessment.jobId}`);
    } catch (err: any) {
      console.error('[Neon DB] Error saving assessment to Neon:', err.message);
    }
  }

  // --- Registrations & Interviews ---
  public async saveRegistration(reg: InterviewRegistration): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      const regId = reg.id.includes('-') && reg.id.length === 36 ? reg.id : crypto.randomUUID();

      // 1. Resolve candidate ID in Neon users table
      let candId: string | null = null;
      if (reg.candidateId && reg.candidateId.includes('-') && reg.candidateId.length === 36) {
        const u = await p.query('SELECT id FROM users WHERE id = $1;', [reg.candidateId]);
        if (u.rows[0]?.id) candId = u.rows[0].id;
      }
      if (!candId) {
        try {
          const { db } = await import('../db.js');
          const candidateEmail = (reg as any).candidateEmail || (reg as any).email;
          const candUser = db.findUserById(reg.candidateId) || (candidateEmail ? db.findUserByEmail(candidateEmail) : null);
          if (candUser) {
            let u = await p.query('SELECT id FROM users WHERE email = $1;', [candUser.email.toLowerCase().trim()]);
            if (!u.rows[0]?.id) {
              await this.saveUser(candUser);
              u = await p.query('SELECT id FROM users WHERE email = $1;', [candUser.email.toLowerCase().trim()]);
            }
            candId = u.rows[0]?.id || null;
          }
        } catch (e) {}
      }

      // 2. Resolve job ID in Neon jobs table
      let jobId: string | null = null;
      if (reg.jobId && reg.jobId.includes('-') && reg.jobId.length === 36) {
        const j = await p.query('SELECT id FROM jobs WHERE id = $1;', [reg.jobId]);
        if (j.rows[0]?.id) jobId = j.rows[0].id;
      }
      if (!jobId) {
        try {
          const { db } = await import('../db.js');
          const localJob = db.getJobById(reg.jobId);
          if (localJob) {
            await this.saveJob(localJob);
            const j = await p.query('SELECT id FROM jobs WHERE id = $1 OR title = $2;', [localJob.id, localJob.title]);
            jobId = j.rows[0]?.id || null;
          }
        } catch (e) {}
      }

      if (!candId || !jobId) {
        console.warn(`[Neon DB] Skipping registration insert: candidate (${candId}) or job (${jobId}) missing in Neon.`);
        return;
      }

      const appId = crypto.randomUUID();

      // Ensure candidate profile
      await p.query(
        `INSERT INTO candidate_profiles (id, user_id, primary_skill)
         VALUES ($1, $1, $2)
         ON CONFLICT (id) DO NOTHING;`,
        [candId, 'Software Development']
      ).catch(() => {});

      // Job application - check existing first to avoid duplicate key error
      let actualAppId = appId;
      const existingApp = await p.query(
        `SELECT id FROM job_applications WHERE job_id = $1 AND candidate_id = $2 LIMIT 1;`,
        [jobId, candId]
      );
      if (existingApp.rows[0]?.id) {
        actualAppId = existingApp.rows[0].id;
        await p.query(
          `UPDATE job_applications SET status = 'INTERVIEW_READY', updated_at = NOW() WHERE id = $1;`,
          [actualAppId]
        ).catch(() => {});
      } else {
        try {
          const appRes = await p.query(
            `INSERT INTO job_applications (id, job_id, candidate_id, status, applied_at, updated_at)
             VALUES ($1, $2, $3, 'INTERVIEW_READY', NOW(), NOW())
             ON CONFLICT (job_id, candidate_id) DO UPDATE
             SET status = 'INTERVIEW_READY', updated_at = NOW()
             RETURNING id;`,
            [appId, jobId, candId]
          );
          actualAppId = appRes.rows[0]?.id || appId;
        } catch (conflictErr: any) {
          // Fallback if constraint naming differs
          const refetch = await p.query(
            `SELECT id FROM job_applications WHERE job_id = $1 AND candidate_id = $2 LIMIT 1;`,
            [jobId, candId]
          );
          actualAppId = refetch.rows[0]?.id || appId;
        }
      }

      // Interview registration (upsert safely into interview_registrations)
      const interviewCode = reg.interviewCode || ('INT-' + Math.random().toString(36).substring(2, 8).toUpperCase());
      const technicalAssessmentCode = (reg as any).technicalAssessmentCode || (reg as any).technical_assessment_code || ('TECH-' + interviewCode.replace(/^INT-/, ''));
      const companyId = (reg as any).companyId || null;
      let actualRegId = regId;

      const r2Score = Array.isArray((reg as any).roundProgression)
        ? (reg as any).roundProgression.find((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT')?.score
        : undefined;
      const techScore = (reg as any).technicalAssessmentScore ?? (reg as any).scores?.technicalScore ?? r2Score ?? null;
      const scoresJson = (reg as any).scores ? JSON.stringify((reg as any).scores) : (techScore != null ? JSON.stringify({ technicalScore: techScore, assessmentPercentage: techScore, overallScore: techScore }) : null);
      const roundProgJson = (reg as any).roundProgression ? JSON.stringify((reg as any).roundProgression) : null;
      const atsDetailsJson = (reg as any).atsDetails ? JSON.stringify((reg as any).atsDetails) : null;
      const overallPipelineStatus = (reg as any).overallPipelineStatus || (reg.status === 'REJECTED' ? 'REJECTED' : 'IN_PROGRESS');
      const selectedForStage = Boolean((reg as any).selectedForStage || (reg as any).isSelectedForStage);

      const codeAttempts = (reg as any).attemptCount ?? (reg as any).codeAttemptCount ?? undefined;

      const existingReg = await p.query(
        `SELECT id FROM interview_registrations WHERE application_id = $1 OR id = $2 LIMIT 1;`,
        [actualAppId, regId]
      );

      if (existingReg.rows[0]?.id) {
        actualRegId = existingReg.rows[0].id;
        await p.query(
          `UPDATE interview_registrations
           SET interview_code = $1,
               technical_assessment_code = $2,
               status = $3,
               interview_status = $4,
               current_round_number = COALESCE($5, current_round_number),
               ats_score = COALESCE($6, ats_score),
               round_progression = COALESCE($7::jsonb, round_progression),
               ats_details = COALESCE($8::jsonb, ats_details),
               technical_assessment_score = COALESCE($9, technical_assessment_score),
               scores = COALESCE($10::jsonb, scores),
               overall_pipeline_status = COALESCE($11, overall_pipeline_status),
               selected_for_stage = $12,
               code_attempt_count = COALESCE($14, code_attempt_count)
           WHERE id = $13;`,
          [
            interviewCode,
            technicalAssessmentCode,
            reg.status || 'INTERVIEW_READY',
            (reg as any).interviewStatus || 'READY_TO_ATTEND',
            (reg as any).currentRoundNumber || 1,
            (reg as any).atsScore || 0,
            roundProgJson,
            atsDetailsJson,
            techScore,
            scoresJson,
            overallPipelineStatus,
            selectedForStage,
            actualRegId,
            codeAttempts,
          ]
        ).catch((err) => {
          console.warn('[Neon DB] Error updating interview_registration:', err.message);
        });
      } else {
        try {
          const regRes = await p.query(
            `INSERT INTO interview_registrations (
              id, application_id, candidate_id, job_id, company_id,
              interview_code, technical_assessment_code,
              status, interview_status, current_round_number, ats_score,
              round_progression, ats_details, technical_assessment_score, scores,
              overall_pipeline_status, selected_for_stage, registered_at, expires_at, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW() + INTERVAL '14 days', NOW())
            ON CONFLICT (application_id) DO UPDATE
            SET interview_code = EXCLUDED.interview_code,
                technical_assessment_code = EXCLUDED.technical_assessment_code,
                status = EXCLUDED.status,
                interview_status = EXCLUDED.interview_status,
                current_round_number = EXCLUDED.current_round_number,
                ats_score = EXCLUDED.ats_score,
                round_progression = COALESCE(EXCLUDED.round_progression, interview_registrations.round_progression),
                ats_details = COALESCE(EXCLUDED.ats_details, interview_registrations.ats_details),
                technical_assessment_score = COALESCE(EXCLUDED.technical_assessment_score, interview_registrations.technical_assessment_score),
                scores = COALESCE(EXCLUDED.scores, interview_registrations.scores),
                overall_pipeline_status = COALESCE(EXCLUDED.overall_pipeline_status, interview_registrations.overall_pipeline_status),
                selected_for_stage = EXCLUDED.selected_for_stage
            RETURNING id;`,
            [
              regId,
              actualAppId,
              candId,
              jobId,
              companyId,
              interviewCode,
              technicalAssessmentCode,
              reg.status || 'INTERVIEW_READY',
              (reg as any).interviewStatus || 'READY_TO_ATTEND',
              (reg as any).currentRoundNumber || 1,
              (reg as any).atsScore || 0,
              roundProgJson || '{}',
              atsDetailsJson || '{}',
              techScore,
              scoresJson,
              overallPipelineStatus,
              selectedForStage,
            ]
          );
          actualRegId = regRes.rows[0]?.id || regId;
        } catch (regConflictErr) {
          const refetchReg = await p.query(
            `SELECT id FROM interview_registrations WHERE application_id = $1 LIMIT 1;`,
            [actualAppId]
          );
          actualRegId = refetchReg.rows[0]?.id || regId;
        }
      }

      // Interview row (upsert using registration_id into interviews)
      const intId = crypto.randomUUID();
      const existingInt = await p.query(
        `SELECT id FROM interviews WHERE registration_id = $1 LIMIT 1;`,
        [actualRegId]
      );
      if (existingInt.rows[0]?.id) {
        await p.query(
          `UPDATE interviews SET status = 'READY', current_difficulty = 'MEDIUM' WHERE id = $1;`,
          [existingInt.rows[0].id]
        ).catch(() => {});
      } else {
        await p.query(
          `INSERT INTO interviews (id, registration_id, candidate_id, job_id, status, current_difficulty, question_count, warning_count, malpractice_flag)
           VALUES ($1, $2, $3, $4, 'READY', 'MEDIUM', 0, 0, false)
           ON CONFLICT (registration_id) DO UPDATE
           SET status = 'READY';`,
          [intId, actualRegId, candId, jobId]
        ).catch(() => {});
      }

      console.log(`[Neon DB] Registration saved in Neon database: Code ${interviewCode} (Reg ${actualRegId})`);
    } catch (err: any) {
      console.error('[Neon DB] Error saving registration:', err.message);
    }
  }

  public async saveInterviewRegistration(reg: any): Promise<void> {
    return this.saveRegistration(reg);
  }

  public async saveAssessmentSubmission(sub: any): Promise<void> {
    const p = getNeonPool();
    if (!p || !sub?.id) return;
    try {
      await p.query(
        `INSERT INTO assessment_submissions (
          id, assessment_id, registration_id, candidate_id, job_id,
          answers, score, total_marks, percentage, passed, integrity_status, submitted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (id) DO UPDATE SET
          answers = EXCLUDED.answers,
          score = EXCLUDED.score,
          total_marks = EXCLUDED.total_marks,
          percentage = EXCLUDED.percentage,
          passed = EXCLUDED.passed,
          integrity_status = EXCLUDED.integrity_status,
          submitted_at = NOW();`,
        [
          sub.id,
          sub.assessmentId,
          sub.registrationId || null,
          sub.candidateId || null,
          sub.jobId || null,
          JSON.stringify(sub.answers || {}),
          Number(sub.score) || 0,
          Number(sub.totalMarks) || 0,
          Number(sub.percentage) || 0,
          Boolean(sub.passed),
          sub.integrityStatus || 'CLEAN',
        ]
      );
      console.log(`[Neon DB] Assessment submission persisted to Neon: ${sub.id}`);
    } catch (err: any) {
      console.error('[Neon DB] Error saving assessment submission:', err.message);
    }
  }

  public async syncAssessmentSubmissions(candidateId?: string): Promise<{ syncedCount: number; updatedRegistrations: string[] }> {
    const p = getNeonPool();
    if (!p) return { syncedCount: 0, updatedRegistrations: [] };

    try {
      const { db } = await import('../db.js');
      let queryText = `
        SELECT 
          s.id, s.assessment_id, s.registration_id, s.candidate_id, s.job_id,
          s.score, s.total_marks, s.percentage, s.passed, s.integrity_status, s.submitted_at
        FROM assessment_submissions s
      `;
      const queryParams: any[] = [];

      if (candidateId) {
        const cUuid = toUuid(candidateId);
        queryText += ` WHERE s.candidate_id = $1 OR s.registration_id IN (
          SELECT id FROM interview_registrations WHERE candidate_id = $1
        )`;
        queryParams.push(cUuid);
      }

      queryText += ` ORDER BY s.submitted_at DESC;`;

      const res = await p.query(queryText, queryParams);
      if (res.rows.length === 0) {
        return { syncedCount: 0, updatedRegistrations: [] };
      }

      const updatedRegistrations: string[] = [];
      const allRegs = db.getRegistrations();

      // Aggregate submissions by registration and select the best (highest score) attempt
      const bestSubmissionsByReg = new Map<string, { reg: any; row: any; scoreVal: number }>();

      for (const row of res.rows) {
        // Find matching registration in local db
        const reg = allRegs.find(r => 
          (row.registration_id && (r.id === row.registration_id || toUuid(r.id) === row.registration_id)) ||
          ((toUuid(r.candidateId) === row.candidate_id || r.candidateId === row.candidate_id) && 
           (toUuid(r.jobId) === row.job_id || r.jobId === row.job_id))
        );

        if (reg) {
          const scoreVal = row.percentage != null && !isNaN(Number(row.percentage))
            ? Number(row.percentage) 
            : Number(row.score) || 0;

          const existing = bestSubmissionsByReg.get(reg.id);
          if (!existing) {
            bestSubmissionsByReg.set(reg.id, { reg, row, scoreVal });
          } else if (scoreVal > existing.scoreVal) {
            bestSubmissionsByReg.set(reg.id, { reg, row, scoreVal });
          }
        }
      }

      for (const { reg, row, scoreVal } of bestSubmissionsByReg.values()) {
        let modified = false;

        const currentAttemptCount = reg.attemptCount ?? 0;
        if (currentAttemptCount < 1) {
          reg.attemptCount = 1;
          modified = true;
        }

        if (Array.isArray(reg.roundProgression)) {
          const r2 = reg.roundProgression.find(
            (rp: any) => rp.roundNumber === 2 || rp.roundType === 'TECHNICAL_ASSESSMENT'
          );
          if (r2) {
            const minCutoff = Number(r2.minQualifyingScore) || 60;
            const isPassed = Boolean(row.passed) || scoreVal >= minCutoff;
            const targetStatus = isPassed ? RoundStatus.QUALIFIED : RoundStatus.REJECTED;

            if (r2.status !== targetStatus || r2.score !== scoreVal) {
              r2.status = targetStatus;
              r2.score = scoreVal;
              r2.completedAt = row.submitted_at ? new Date(row.submitted_at).toISOString() : new Date().toISOString();
              r2.feedback = isPassed 
                ? `Candidate successfully cleared Technical Assessment on the external examination portal with ${scoreVal}%.` 
                : `Did not meet qualifying threshold on external assessment portal (Score: ${scoreVal}% — Cutoff: ${minCutoff}%).`;
              modified = true;
            }

            // If passed, unlock Round 3 (AI Technical Interview) and ensure interview status is ready
            if (isPassed) {
              const r3 = reg.roundProgression.find(
                (rp: any) => rp.roundNumber === 3 || rp.roundType === 'AI_INTERVIEW'
              );
              if (r3 && (r3.status === RoundStatus.LOCKED || r3.status === RoundStatus.PENDING)) {
                r3.status = RoundStatus.IN_PROGRESS;
                modified = true;
              }
              if ((reg.currentRoundNumber || 1) < 3) {
                reg.currentRoundNumber = 3;
                modified = true;
              }
              if (reg.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED || reg.interviewStatus === InterviewStatus.EXPIRED) {
                reg.interviewStatus = InterviewStatus.READY_TO_ATTEND;
                modified = true;
              }
              if (reg.overallPipelineStatus === 'REJECTED') {
                reg.overallPipelineStatus = 'IN_PROGRESS';
                modified = true;
              }
            }
          }
        }

        if (modified || reg.technicalAssessmentScore !== scoreVal) {
          reg.scores = {
            ...(reg.scores || {}),
            overallScore: scoreVal,
            technicalScore: scoreVal,
            assessmentPercentage: scoreVal,
            cleared: Boolean(row.passed) || scoreVal >= 60,
          };

          db.updateRegistration(reg.id, {
            roundProgression: reg.roundProgression,
            currentRoundNumber: reg.currentRoundNumber,
            status: reg.status,
            interviewStatus: reg.interviewStatus,
            overallPipelineStatus: reg.overallPipelineStatus,
            attemptCount: Math.max(reg.attemptCount || 1, 1),
            technicalAssessmentCompleted: true,
            technicalAssessmentScore: scoreVal,
            scores: reg.scores,
          });

          p.query(
            `UPDATE interview_registrations SET 
              code_attempt_count = GREATEST(COALESCE(code_attempt_count, 0), 1), 
              technical_assessment_score = $1, 
              interview_status = $2, 
              round_progression = $3,
              overall_pipeline_status = $4,
              scores = $5
            WHERE id = $6`,
            [
              scoreVal,
              reg.interviewStatus || 'INTERVIEW_READY',
              JSON.stringify(reg.roundProgression),
              reg.overallPipelineStatus || 'IN_PROGRESS',
              JSON.stringify(reg.scores),
              toUuid(reg.id)
            ]
          ).catch(() => {});

          updatedRegistrations.push(reg.id);
          console.log(`[Neon DB Sync] Synced best external assessment result for candidate ${reg.candidateId} (job: ${reg.jobId}): score=${scoreVal}%, attemptCount=1`);
        }
      }

      return { syncedCount: res.rows.length, updatedRegistrations };
    } catch (err: any) {
      console.error('[Neon DB Sync] Error syncing assessment submissions:', err.message);
      return { syncedCount: 0, updatedRegistrations: [] };
    }
  }

  public async saveProctoringEvent(evt: any): Promise<void> {
    const p = getNeonPool();
    if (!p || !evt?.id) return;
    try {
      await p.query(
        `INSERT INTO proctoring_events (
          id, interview_id, candidate_id, event_type, severity, warning_number, details, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
        ON CONFLICT (id) DO NOTHING;`,
        [
          evt.id,
          evt.interviewId || null,
          evt.candidateId || null,
          evt.eventType || evt.type || 'VIOLATION',
          evt.severity || 'LOW',
          Number(evt.warningNumber) || 1,
          JSON.stringify(evt.details || {}),
          evt.timestamp ? new Date(evt.timestamp) : new Date(),
        ]
      );
    } catch (err: any) {
      console.error('[Neon DB] Error saving proctoring event:', err.message);
    }
  }

  // --- Transcripts & Questions ---
  public async saveTranscript(item: TranscriptItem): Promise<void> {
    const p = getNeonPool();
    if (!p) return;

    try {
      const interviewRes = await p.query('SELECT id FROM interviews LIMIT 1;');
      const interviewId = interviewRes.rows[0]?.id;
      if (!interviewId) return;

      const id = crypto.randomUUID();
      await p.query(
        `INSERT INTO interview_transcript_messages (id, interview_id, speaker, text_content, created_at)
         VALUES ($1, $2, $3, $4, NOW());`,
        [id, interviewId, item.speaker, item.message]
      );
    } catch (err: any) {
      // Non-blocking transcript write
    }
  }

  // --- Synchronize initial data from Neon console into cache ---
  public async loadAllFromNeon(): Promise<{
    users: User[];
    companies: Company[];
    jobs: Job[];
    candidateProfiles?: any[];
    assessments?: any[];
    interviewRegistrations?: any[];
    assessmentSubmissions?: any[];
  } | null> {
    const p = getNeonPool();
    if (!p) return null;

    try {
      const usersRes = await p.query(`
        SELECT id, full_name, email, password_hash, role, email_verified, auth_provider, google_subject_id, profile_image_url, created_at, updated_at
        FROM users
        ORDER BY created_at ASC;
      `);

      const companiesRes = await p.query(`
        SELECT id, name, description, industry, headquarters, created_at
        FROM companies;
      `);

      const jobsRes = await p.query(`
        SELECT j.id, j.company_id, j.recruiter_id, j.title, j.job_code, j.description, j.location, j.work_mode, j.employment_type,
               j.qualification, j.minimum_package, j.maximum_package, j.currency, j.status, COALESCE(j.duration_minutes, 20) as duration_minutes,
               j.openings, j.experience, j.pipeline_rounds, j.interview_config, j.technical_assessment_questions,
               j.required_skills, j.preferred_skills, j.metadata,
               j.created_at, j.updated_at,
               c.name as company_name, c.industry as company_industry, c.description as company_desc, c.headquarters as company_loc
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        ORDER BY j.created_at DESC;
      `);

      const users: User[] = usersRes.rows.map(r => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        passwordHash: r.password_hash,
        role: r.role as UserRole,
        isVerified: r.email_verified,
        googleId: r.google_subject_id || undefined,
        avatarUrl: r.profile_image_url || undefined,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      }));

      const companies: Company[] = companiesRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        industry: r.industry || 'Technology',
        location: r.headquarters || 'Remote',
      }));

      const parseJsonSafe = (val: any) => {
        if (!val) return undefined;
        if (typeof val === 'object') return val;
        try {
          return JSON.parse(val);
        } catch {
          return undefined;
        }
      };

      const jobs: Job[] = jobsRes.rows.map(r => {
        const meta = parseJsonSafe(r.metadata) || {};
        const parsedRounds = parseJsonSafe(r.pipeline_rounds) || meta.rounds;
        const parsedConfig = parseJsonSafe(r.interview_config) || meta.interviewConfig;
        const parsedQuestions = parseJsonSafe(r.technical_assessment_questions) || meta.technicalAssessmentQuestions;
        const technicalAssessmentCode = meta.technicalAssessmentCode || undefined;

        return {
          id: r.id,
          companyId: r.company_id,
          recruiterId: r.recruiter_id,
          title: r.title,
          jobCode: r.job_code || undefined,
          description: r.description,
          requiredSkills: Array.isArray(r.required_skills) && r.required_skills.length > 0
            ? r.required_skills
            : (meta.requiredSkills || ['Problem Solving', 'System Design']),
          preferredSkills: Array.isArray(r.preferred_skills) ? r.preferred_skills : (meta.preferredSkills || []),
          qualification: r.qualification || "Bachelor's Degree",
          experience: r.experience || '1-3 Years',
          openings: Number(r.openings) || 1,
          location: r.location || 'Remote',
          workMode: (r.work_mode as any) || 'REMOTE',
          employmentType: (r.employment_type as any) || 'Full Time',
          minPackage: Number(r.minimum_package) || 1200000,
          maxPackage: Number(r.maximum_package) || 2400000,
          currency: r.currency || 'INR',
          salaryPackage: meta.salaryPackage || undefined,
          deadline: meta.deadline || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          durationMinutes: Number(r.duration_minutes) || 20,
          numQuestions: parsedConfig?.numQuestions || 5,
          status: (r.status as any) || 'ACTIVE',
          rounds: parsedRounds,
          interviewConfig: parsedConfig,
          technicalAssessmentQuestions: parsedQuestions,
          technicalAssessmentCode,
          metadata: meta,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
          company: {
            id: r.company_id,
            name: r.company_name || 'Cyberdyne Systems',
            industry: r.company_industry || 'Technology',
            description: r.company_desc || '',
            location: r.company_loc || 'Remote',
          },
        };
      });

      // Load candidate profiles from Neon
      const candidateProfilesRes = await p.query(`
        SELECT id, user_id, phone, current_location, experience_years, headline, summary, bio,
               primary_skill, skills, projects, resume_file_name, resume_text, resume_uploaded,
               education_details, extracted_profile, created_at, updated_at
        FROM candidate_profiles;
      `).catch(() => ({ rows: [] }));

      const candidateProfiles = candidateProfilesRes.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        phone: r.phone || '',
        location: r.current_location || '',
        experienceYears: Number(r.experience_years) || 0,
        headline: r.headline || '',
        summary: r.summary || '',
        bio: r.bio || '',
        primarySkill: r.primary_skill || 'Software Engineering',
        skills: Array.isArray(r.skills) ? r.skills : [],
        projects: Array.isArray(r.projects) ? r.projects : [],
        resumeFileName: r.resume_file_name || undefined,
        resumeText: r.resume_text || undefined,
        resumeUploaded: Boolean(r.resume_uploaded),
        educationDetails: parseJsonSafe(r.education_details) || {},
        extractedProfile: parseJsonSafe(r.extracted_profile) || {},
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      }));

      // Load assessments from Neon
      const assessmentsRes = await p.query(`
        SELECT id, job_id, title, description, duration_minutes, passing_score,
               difficulty, skills_tested, anti_cheating_enabled, is_published, questions, created_at, updated_at
        FROM assessments;
      `).catch(() => ({ rows: [] }));

      const assessments = assessmentsRes.rows.map(r => ({
        id: r.id,
        jobId: r.job_id,
        title: r.title,
        description: r.description || '',
        durationMinutes: Number(r.duration_minutes) || 45,
        passingScore: Number(r.passing_score) || 70,
        difficulty: r.difficulty || 'MEDIUM',
        skillsTested: Array.isArray(r.skills_tested) ? r.skills_tested : [],
        antiCheatingEnabled: Boolean(r.anti_cheating_enabled),
        isPublished: Boolean(r.is_published),
        questions: parseJsonSafe(r.questions) || [],
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      }));

      // Load assessment submissions from Neon
      const submissionsRes = await p.query(`
        SELECT id, assessment_id, candidate_id, registration_id, job_id,
               score, percentage, total_marks, passed, integrity_status, answers, submitted_at
        FROM assessment_submissions;
      `).catch(() => ({ rows: [] }));

      const assessmentSubmissions = submissionsRes.rows.map(r => ({
        id: r.id,
        assessmentId: r.assessment_id,
        candidateId: r.candidate_id,
        registrationId: r.registration_id,
        jobId: r.job_id,
        score: Number(r.score) || 0,
        percentage: Number(r.percentage) || 0,
        totalQuestions: 2,
        attempted: 2,
        correct: 2,
        incorrect: 0,
        timeTakenMinutes: 20,
        passed: Boolean(r.passed),
        integrityStatus: r.integrity_status || 'CLEAN',
        answers: parseJsonSafe(r.answers) || {},
        submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : new Date().toISOString(),
      }));

      // Load interview registrations from Neon
      const registrationsRes = await p.query(`
        SELECT id, application_id, candidate_id, job_id, company_id,
               interview_code, technical_assessment_code,
               status, interview_status, current_round_number, ats_score,
               round_progression, ats_details, technical_assessment_score, scores,
               overall_pipeline_status, selected_for_stage, registered_at, expires_at, created_at,
               COALESCE(code_attempt_count, 0) as code_attempt_count
        FROM interview_registrations;
      `).catch(() => ({ rows: [] }));

      const interviewRegistrations = registrationsRes.rows.map(r => {
        const subCount = assessmentSubmissions.filter(
          s => s.registrationId === r.id || (s.candidateId === r.candidate_id && s.jobId === r.job_id)
        ).length;
        const attemptsUsed = Math.min(Math.max(subCount, Number(r.code_attempt_count) || 0), 1);

        return {
          id: r.id,
          applicationId: r.application_id,
          candidateId: r.candidate_id,
          jobId: r.job_id,
          companyId: r.company_id,
          interviewCode: r.interview_code,
          technicalAssessmentCode: r.technical_assessment_code,
          status: r.status,
          interviewStatus: r.interview_status,
          currentRoundNumber: Math.min(Number(r.current_round_number) || 1, 4),
          atsScore: Number(r.ats_score) || 0,
          roundProgression: (() => {
            const raw = parseJsonSafe(r.round_progression);
            let list: any[] = [];
            if (Array.isArray(raw)) {
              list = raw;
            } else if (raw && typeof raw === 'object') {
              list = [
                { roundNumber: 1, roundType: 'RESUME_SCREENING', roundName: 'Resume Screening (ATS)', score: raw.round1Score ?? (Number(r.ats_score) || 80), status: 'QUALIFIED' },
                { roundNumber: 2, roundType: 'TECHNICAL_ASSESSMENT', roundName: 'Technical Assessment', score: raw.codingScore ?? (r.technical_assessment_score != null ? Number(r.technical_assessment_score) : 0), status: raw.cleared ? 'QUALIFIED' : 'REJECTED' },
                { roundNumber: 3, roundType: 'AI_INTERVIEW', roundName: 'AI Technical Interview', status: 'LOCKED' },
                { roundNumber: 4, roundType: 'FINAL_REVIEW', roundName: 'Final Review & Selection', status: 'LOCKED' },
              ];
            }
            // Remove HR interview round completely from pipeline and renumber Stage 5 to Stage 4
            return list
              .filter((round: any) => round.roundType !== 'HR_INTERVIEW' && !String(round.roundName || '').toLowerCase().includes('hr interview'))
              .map((round: any) => {
                if (round.roundNumber === 5) {
                  return { ...round, roundNumber: 4 };
                }
                return round;
              });
          })(),
          atsDetails: parseJsonSafe(r.ats_details) || {},
          technicalAssessmentScore: r.technical_assessment_score != null ? Number(r.technical_assessment_score) : undefined,
          scores: parseJsonSafe(r.scores) || undefined,
          overallPipelineStatus: r.overall_pipeline_status || undefined,
          selectedForStage: Boolean(r.selected_for_stage),
          registeredAt: r.registered_at ? new Date(r.registered_at).toISOString() : new Date().toISOString(),
          expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : undefined,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          attemptCount: attemptsUsed,
          maxAttempts: 1,
        };
      });

      console.log(`[Neon DB] Hydrated ${users.length} users, ${companies.length} companies, ${jobs.length} jobs, ${candidateProfiles.length} profiles, ${assessments.length} assessments, ${interviewRegistrations.length} registrations, ${assessmentSubmissions.length} submissions directly from Neon PostgreSQL!`);
      return { users, companies, jobs, candidateProfiles, assessments, interviewRegistrations, assessmentSubmissions };
    } catch (err: any) {
      console.error('[Neon DB] Error loading tables from Neon:', err.message);
      return null;
    }
  }

  // --- Dynamic Technical Assessment Lookup Helpers ---
  public async getRegistrationByTechnicalCode(code: string): Promise<any | null> {
    const p = getNeonPool();
    if (!p) return null;
    const cleanCode = code.trim().toUpperCase();
    try {
      const res = await p.query(
        `SELECT r.*,
                j.title as job_title, j.technical_assessment_questions, j.pipeline_rounds, j.metadata as job_metadata,
                u.full_name as candidate_name, u.email as candidate_email,
                c.name as company_name
         FROM interview_registrations r
         LEFT JOIN jobs j ON r.job_id = j.id
         LEFT JOIN users u ON r.candidate_id = u.id
         LEFT JOIN companies c ON r.company_id = c.id
         WHERE UPPER(r.technical_assessment_code) = $1 OR UPPER(r.interview_code) = $1
         LIMIT 1;`,
        [cleanCode]
      );
      return res.rows[0] || null;
    } catch (e: any) {
      console.warn('[Neon DB] getRegistrationByTechnicalCode error:', e.message);
      return null;
    }
  }

  public async getJobByTechnicalCode(code: string): Promise<any | null> {
    const p = getNeonPool();
    if (!p) return null;
    const cleanCode = code.trim().toUpperCase();
    try {
      const res = await p.query(
        `SELECT j.*, c.name as company_name
         FROM jobs j
         LEFT JOIN companies c ON j.company_id = c.id
         WHERE UPPER(j.metadata->>'technicalAssessmentCode') = $1
            OR UPPER(j.job_code) = $1
            OR j.id::text = $1
         LIMIT 1;`,
        [cleanCode]
      );
      return res.rows[0] || null;
    } catch (e: any) {
      return null;
    }
  }

  public async getTechnicalQuestionsForJob(jobId: string): Promise<any[] | null> {
    const p = getNeonPool();
    if (!p) return null;
    try {
      // 1. Check assessments table
      const asmtRes = await p.query(
        `SELECT questions FROM assessments WHERE job_id = $1::uuid LIMIT 1;`,
        [jobId]
      );
      if (asmtRes.rows[0]?.questions) {
        const q = typeof asmtRes.rows[0].questions === 'string'
          ? JSON.parse(asmtRes.rows[0].questions)
          : asmtRes.rows[0].questions;
        if (Array.isArray(q) && q.length > 0) return q;
      }

      // 2. Check jobs table
      const jobRes = await p.query(
        `SELECT technical_assessment_questions, metadata FROM jobs WHERE id = $1::uuid LIMIT 1;`,
        [jobId]
      );
      if (jobRes.rows[0]?.technical_assessment_questions) {
        const q = typeof jobRes.rows[0].technical_assessment_questions === 'string'
          ? JSON.parse(jobRes.rows[0].technical_assessment_questions)
          : jobRes.rows[0].technical_assessment_questions;
        if (Array.isArray(q) && q.length > 0) return q;
      }
      return null;
    } catch (e: any) {
      return null;
    }
  }
}

export const neonService = new NeonDatabaseService();
