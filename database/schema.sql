-- =====================================================================
-- DATABASE: AI INTERVIEWER – AUTONOMOUS RECRUITMENT & ASSESSMENT PLATFORM
-- RDBMS: PostgreSQL (14+)
-- =====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. POSTGRESQL ENUMS
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'CANDIDATE',
        'RECRUITER',
        'ADMIN'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM (
        'PENDING_VERIFICATION',
        'ACTIVE',
        'LOCKED',
        'SUSPENDED',
        'DEACTIVATED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE auth_provider AS ENUM (
        'LOCAL',
        'GOOGLE'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM (
        'DRAFT',
        'ACTIVE',
        'CLOSED',
        'EXPIRED',
        'ARCHIVED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE application_status AS ENUM (
        'REGISTERED',
        'APPLIED',
        'INTERVIEW_READY',
        'INTERVIEW_COMPLETED',
        'SHORTLISTED',
        'REJECTED',
        'WITHDRAWN',
        'HOLD',
        'EXPIRED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE interview_status AS ENUM (
        'NOT_STARTED',
        'READY',
        'IN_PROGRESS',
        'COMPLETED',
        'TERMINATED',
        'MALPRACTICE_TERMINATED',
        'EXPIRED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE difficulty_level AS ENUM (
        'EASY',
        'MEDIUM',
        'HARD',
        'ADVANCED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE question_type AS ENUM (
        'SELF_INTRODUCTION',
        'CONCEPTUAL',
        'SCENARIO',
        'DEBUGGING',
        'CODING',
        'COMPARISON',
        'PROJECT_BASED',
        'FAILURE_ANALYSIS',
        'DESIGN',
        'OPTMIZATION',
        'FOLLOW_UP',
        'CLARIFICATION',
        'VERIFICATION'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE candidate_intent AS ENUM (
        'ANSWER',
        'THINKING_TIME_REQUEST',
        'HINT_REQUEST',
        'REPEAT_REQUEST',
        'CLARIFICATION_REQUEST',
        'SKIP_REQUEST',
        'GIVE_UP',
        'READY_TO_CONTINUE',
        'CANDIDATE_QUESTION',
        'ANSWER_CORRECTION'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE competency_level AS ENUM (
        'VERY_WEAK',
        'WEAK',
        'DEVELOPING',
        'GOOD',
        'STRONG',
        'VERY_STRONG'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM (
        'LOW',
        'MODERATE',
        'HIGH',
        'CRITICAL'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE proctoring_event_type AS ENUM (
        'TAB_SWITCH',
        'WINDOW_BLUR',
        'FULLSCREEN_EXIT',
        'CAMERA_DISABLED',
        'MICROPHONE_DISABLED',
        'FACE_NOT_VISIBLE',
        'MULTIPLE_PERSON_PRESENCE',
        'COPY_EVENT',
        'PASTE_EVENT',
        'NETWORK_INTERRUPTION',
        'PAGE_RELOAD',
        'SESSION_TAMPERING',
        'UNKNOWN_INTEGRITY_EVENT'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE malpractice_action AS ENUM (
        'WARNING',
        'TERMINATED',
        'REVIEW_REQUIRED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE email_type AS ENUM (
        'EMAIL_VERIFICATION',
        'WELCOME',
        'INTERVIEW_REGISTRATION',
        'INTERVIEW_REMINDER',
        'INTERVIEW_COMPLETED',
        'CANDIDATE_REPORT',
        'PASSWORD_RESET',
        'MALPRACTICE_NOTICE',
        'RECRUITER_NOTIFICATION'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE email_status AS ENUM (
        'PENDING',
        'SENT',
        'FAILED',
        'BOUNCED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE recruiter_decision AS ENUM (
        'NOT_REVIEWED',
        'SHORTLIST',
        'REJECT',
        'HOLD',
        'MANUAL_REVIEW'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =====================================================================
-- 2. CORE USERS & AUTHENTICATION
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NULL,
    role user_role NOT NULL,
    account_status account_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    auth_provider auth_provider NOT NULL DEFAULT 'LOCAL',
    google_subject_id VARCHAR(255) NULL UNIQUE,
    profile_image_url TEXT NULL,
    last_login_at TIMESTAMPTZ NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_auth CHECK (
        (auth_provider = 'LOCAL' AND password_hash IS NOT NULL) OR
        (auth_provider = 'GOOGLE')
    )
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, account_status);

-- User Sessions (Stateful Non-JWT Auth)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    ip_address INET NULL,
    user_agent TEXT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- Email Verifications (OTP)
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email CITEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_created ON email_verifications(user_id, created_at DESC);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. PROFILES & SKILLS
-- =====================================================================

CREATE TABLE IF NOT EXISTS candidate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    phone VARCHAR(20) NULL,
    date_of_birth DATE NULL,
    college_name VARCHAR(255) NULL,
    degree VARCHAR(150) NULL,
    department VARCHAR(150) NULL,
    graduation_year INTEGER NULL,
    current_location VARCHAR(255) NULL,
    experience_years NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
    headline VARCHAR(255) NULL,
    summary TEXT NULL,
    bio TEXT NULL,
    linkedin_url TEXT NULL,
    github_url TEXT NULL,
    portfolio_url TEXT NULL,
    primary_skill VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user ON candidate_profiles(user_id);

-- Detailed Candidate Education (10th, 12th/Diploma, Degree)
CREATE TABLE IF NOT EXISTS candidate_education_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    -- Class 10th
    class10_school VARCHAR(255) NULL,
    class10_board VARCHAR(100) NULL,
    class10_percentage VARCHAR(20) NULL,
    class10_year VARCHAR(10) NULL,
    -- Secondary: 12th or Diploma
    secondary_type VARCHAR(20) NULL CHECK (secondary_type IS NULL OR secondary_type IN ('12th', 'Diploma')),
    class12_college VARCHAR(255) NULL,
    class12_stream VARCHAR(100) NULL,
    class12_percentage VARCHAR(20) NULL,
    class12_year VARCHAR(10) NULL,
    diploma_college VARCHAR(255) NULL,
    diploma_branch VARCHAR(100) NULL,
    diploma_percentage VARCHAR(20) NULL,
    diploma_year VARCHAR(10) NULL,
    -- Graduation / Degree
    degree_name VARCHAR(150) NULL, -- e.g. B.Tech, B.E., BCA, B.Sc, M.Tech
    degree_specialization VARCHAR(150) NULL, -- e.g. Computer Science & Engineering
    degree_college VARCHAR(255) NULL,
    degree_cgpa VARCHAR(20) NULL,
    degree_year VARCHAR(10) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_edu_candidate ON candidate_education_details(candidate_id);

-- Candidate Certifications
CREATE TABLE IF NOT EXISTS candidate_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    certification_name VARCHAR(255) NOT NULL,
    issuing_organization VARCHAR(255) NOT NULL,
    issue_date DATE NULL,
    expiration_date DATE NULL,
    credential_id VARCHAR(150) NULL,
    credential_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) UNIQUE NOT NULL,
    normalized_name VARCHAR(120) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
    self_reported_level VARCHAR(50) NULL,
    years_experience NUMERIC(4,2) NULL CHECK (years_experience >= 0),
    source VARCHAR(30) NOT NULL DEFAULT 'SELF_DECLARED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candidate_skill_source UNIQUE (candidate_id, skill_id, source)
);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NULL,
    website_url TEXT NULL,
    logo_url TEXT NULL,
    industry VARCHAR(150) NULL,
    company_size VARCHAR(100) NULL,
    headquarters VARCHAR(255) NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recruiter Profiles
CREATE TABLE IF NOT EXISTS recruiter_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    designation VARCHAR(150) NULL,
    work_email CITEXT NULL,
    phone VARCHAR(20) NULL,
    is_company_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_company ON recruiter_profiles(company_id);

-- =====================================================================
-- 4. JOBS & RESUMES
-- =====================================================================

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    recruiter_id UUID NOT NULL REFERENCES recruiter_profiles(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    job_code VARCHAR(50) UNIQUE NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NULL,
    work_mode VARCHAR(30) NOT NULL DEFAULT 'HYBRID',
    employment_type VARCHAR(50) NOT NULL DEFAULT 'FULL_TIME',
    qualification VARCHAR(255) NULL,
    minimum_experience NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (minimum_experience >= 0),
    maximum_experience NUMERIC(4,2) NULL CHECK (maximum_experience IS NULL OR maximum_experience >= minimum_experience),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    minimum_package NUMERIC(12,2) NULL CHECK (minimum_package IS NULL OR minimum_package >= 0),
    maximum_package NUMERIC(12,2) NULL CHECK (maximum_package IS NULL OR minimum_package IS NULL OR maximum_package >= minimum_package),
    package_period VARCHAR(20) NOT NULL DEFAULT 'YEAR',
    application_deadline TIMESTAMPTZ NULL,
    interview_open_at TIMESTAMPTZ NULL,
    interview_close_at TIMESTAMPTZ NULL,
    estimated_interview_minutes INTEGER NOT NULL DEFAULT 30 CHECK (estimated_interview_minutes > 0),
    status job_status NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter ON jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_deadline ON jobs(status, application_deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_title ON jobs(title);

CREATE TABLE IF NOT EXISTS job_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    importance_weight NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (importance_weight > 0),
    minimum_level VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_job_skill UNIQUE (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NULL,
    sha256_hash VARCHAR(64) NULL,
    parsed_text TEXT NULL,
    parsed_json JSONB NULL,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_candidate ON resumes(candidate_id);

-- Resume Parsed Skills
CREATE TABLE IF NOT EXISTS resume_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    skill_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NULL, -- e.g. Frontend, Backend, Cloud, Database
    years_of_experience NUMERIC(4,2) NULL,
    proficiency_level VARCHAR(50) NULL, -- Beginner, Intermediate, Expert
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_skills_resume ON resume_skills(resume_id);

-- Resume Work Experience Records
CREATE TABLE IF NOT EXISTS resume_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    employment_type VARCHAR(50) NULL,
    location VARCHAR(150) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NULL,
    technologies_used TEXT[] NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_exp_resume ON resume_experience(resume_id);

-- Resume Education Records
CREATE TABLE IF NOT EXISTS resume_education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    institution_name VARCHAR(255) NOT NULL,
    degree VARCHAR(150) NOT NULL,
    field_of_study VARCHAR(150) NULL,
    grade_or_cgpa VARCHAR(50) NULL,
    start_year VARCHAR(10) NULL,
    end_year VARCHAR(10) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resume Projects
CREATE TABLE IF NOT EXISTS resume_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    project_title VARCHAR(255) NOT NULL,
    role VARCHAR(150) NULL,
    description TEXT NULL,
    tech_stack TEXT[] NULL,
    github_url TEXT NULL,
    live_demo_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resume ATS Evaluation & Scoring (Round 1 Screening)
CREATE TABLE IF NOT EXISTS resume_ats_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    ats_score INTEGER NOT NULL CHECK (ats_score BETWEEN 0 AND 100),
    keyword_match_score INTEGER NULL CHECK (keyword_match_score BETWEEN 0 AND 100),
    experience_relevance_score INTEGER NULL CHECK (experience_relevance_score BETWEEN 0 AND 100),
    education_eligibility_score INTEGER NULL CHECK (education_eligibility_score BETWEEN 0 AND 100),
    formatting_clarity_score INTEGER NULL CHECK (formatting_clarity_score BETWEEN 0 AND 100),
    matched_skills TEXT[] NULL,
    missing_skills TEXT[] NULL,
    strengths TEXT[] NULL,
    weaknesses TEXT[] NULL,
    is_qualified BOOLEAN NOT NULL DEFAULT FALSE,
    feedback TEXT NULL,
    recommendation VARCHAR(50) NULL, -- QUALIFIED, REJECTED, NEEDS_MANUAL_REVIEW
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ats_eval_candidate_job ON resume_ats_evaluations(candidate_id, job_id);

-- =====================================================================
-- 5. JOB APPLICATIONS & INTERVIEW REGISTRATION
-- =====================================================================

CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
    resume_id UUID NULL REFERENCES resumes(id) ON DELETE SET NULL,
    status application_status NOT NULL DEFAULT 'REGISTERED',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ NULL,
    recruiter_notes TEXT NULL,
    CONSTRAINT uq_job_candidate_application UNIQUE (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_candidate_status ON job_applications(candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_job_status ON job_applications(job_id, status);

CREATE TABLE IF NOT EXISTS interview_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    interview_code_hash TEXT NOT NULL,
    interview_code_last4 VARCHAR(8) NULL,
    technical_assessment_code VARCHAR(20) NULL, -- 12-Digit Alphanumeric Code for Round 2 Technical Assessment
    current_round_number INTEGER NOT NULL DEFAULT 1,
    overall_pipeline_status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
    code_expires_at TIMESTAMPTZ NULL,
    code_verified_at TIMESTAMPTZ NULL,
    code_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (code_attempt_count >= 0),
    max_code_attempts INTEGER NOT NULL DEFAULT 1, -- Single Attempt Only
    is_code_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    registration_status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_reg_candidate ON interview_registrations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_reg_job ON interview_registrations(job_id);
CREATE INDEX IF NOT EXISTS idx_interview_reg_tech_code ON interview_registrations(technical_assessment_code);

-- =====================================================================
-- 5B. TECHNICAL ASSESSMENTS, MCQ QUESTIONS & CODING CHALLENGES
-- =====================================================================

-- Technical Assessments (Round 2 Assessment Configurations)
CREATE TABLE IF NOT EXISTS technical_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    recruiter_id UUID NULL REFERENCES recruiter_profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
    passing_score INTEGER NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 0 AND 100),
    difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    skills_tested TEXT[] NULL,
    negative_marking BOOLEAN NOT NULL DEFAULT FALSE,
    randomization BOOLEAN NOT NULL DEFAULT TRUE,
    attempt_limit INTEGER NOT NULL DEFAULT 1,
    anti_cheating_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tech_assess_job ON technical_assessments(job_id);

-- Technical MCQ & Short Answer Questions
CREATE TABLE IF NOT EXISTS technical_mcq_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES technical_assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'MULTIPLE_CHOICE', -- MULTIPLE_CHOICE, SHORT_ANSWER
    topic VARCHAR(150) NULL,
    difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    marks INTEGER NOT NULL DEFAULT 5 CHECK (marks > 0),
    negative_marks NUMERIC(4,2) NOT NULL DEFAULT 0.00,
    skills_tested TEXT[] NULL,
    explanation TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcq_questions_assessment ON technical_mcq_questions(assessment_id);

-- Options for Multiple Choice Questions (4 Options: A, B, C, D)
CREATE TABLE IF NOT EXISTS technical_mcq_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES technical_mcq_questions(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL CHECK (option_index BETWEEN 0 AND 3), -- 0=A, 1=B, 2=C, 3=D
    option_letter VARCHAR(2) NOT NULL, -- 'A', 'B', 'C', 'D'
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mcq_question_option UNIQUE (question_id, option_index)
);

CREATE INDEX IF NOT EXISTS idx_mcq_options_question ON technical_mcq_options(question_id);

-- Recruiter Defined Priority Questions (For Live AI Interview Round 3 Prioritization)
CREATE TABLE IF NOT EXISTS recruiter_priority_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    recruiter_id UUID NULL REFERENCES recruiter_profiles(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    topic VARCHAR(150) NOT NULL,
    difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    is_priority BOOLEAN NOT NULL DEFAULT TRUE, -- Prioritized over dynamic AI generation
    evaluation_criteria TEXT NULL,
    expected_key_points TEXT[] NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_priority_job ON recruiter_priority_questions(job_id, is_priority);

-- Coding Challenges & Problems
CREATE TABLE IF NOT EXISTS coding_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NULL REFERENCES technical_assessments(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    problem_statement TEXT NOT NULL,
    difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    marks INTEGER NOT NULL DEFAULT 20 CHECK (marks > 0),
    time_limit_ms INTEGER NOT NULL DEFAULT 2000,
    memory_limit_mb INTEGER NOT NULL DEFAULT 256,
    input_format TEXT NULL,
    output_format TEXT NULL,
    constraints TEXT NULL,
    sample_input TEXT NULL,
    sample_output TEXT NULL,
    explanation TEXT NULL,
    skills_tested TEXT[] NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_questions_job ON coding_questions(job_id);

-- Starter Code Templates for Multi-Language Support
CREATE TABLE IF NOT EXISTS coding_starter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coding_question_id UUID NOT NULL REFERENCES coding_questions(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL, -- javascript, typescript, python, java, cpp
    starter_code TEXT NOT NULL,
    solution_code TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_coding_template_lang UNIQUE (coding_question_id, language)
);

-- Coding Test Cases (3 Shown Public Cases + 5 Hidden Verification Cases)
CREATE TABLE IF NOT EXISTS coding_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coding_question_id UUID NOT NULL REFERENCES coding_questions(id) ON DELETE CASCADE,
    test_case_number INTEGER NOT NULL CHECK (test_case_number > 0),
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE, -- FALSE = Shown to candidate (3 Public), TRUE = Hidden evaluation test case (5 Hidden)
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    explanation TEXT NULL,
    weight INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_coding_test_case_num UNIQUE (coding_question_id, test_case_number)
);

CREATE INDEX IF NOT EXISTS idx_coding_test_cases_question ON coding_test_cases(coding_question_id, is_hidden);

-- Assessment Submissions (Candidate Test Result)
CREATE TABLE IF NOT EXISTS assessment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES technical_assessments(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES interview_registrations(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    total_questions INTEGER NOT NULL DEFAULT 0,
    attempted INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    incorrect INTEGER NOT NULL DEFAULT 0,
    time_taken_minutes INTEGER NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    integrity_status VARCHAR(50) NOT NULL DEFAULT 'CLEAN', -- CLEAN, FLAGGED
    violations_count INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_submissions_candidate ON assessment_submissions(candidate_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_submissions_reg ON assessment_submissions(registration_id);

-- Candidate MCQ Answers Breakdown
CREATE TABLE IF NOT EXISTS assessment_mcq_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES technical_mcq_questions(id) ON DELETE CASCADE,
    selected_option_index INTEGER NULL CHECK (selected_option_index BETWEEN 0 AND 3),
    selected_option_letter VARCHAR(2) NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    marks_awarded NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    time_spent_seconds INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate Coding Submissions & Code Execution Runs
CREATE TABLE IF NOT EXISTS candidate_coding_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES assessment_submissions(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    coding_question_id UUID NOT NULL REFERENCES coding_questions(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    submitted_code TEXT NOT NULL,
    public_cases_passed INTEGER NOT NULL DEFAULT 0,
    total_public_cases INTEGER NOT NULL DEFAULT 3,
    hidden_cases_passed INTEGER NOT NULL DEFAULT 0,
    total_hidden_cases INTEGER NOT NULL DEFAULT 5,
    all_passed BOOLEAN NOT NULL DEFAULT FALSE,
    marks_awarded NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    execution_time_ms INTEGER NULL,
    memory_used_kb INTEGER NULL,
    compilation_error TEXT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_sub_candidate ON candidate_coding_submissions(candidate_id, coding_question_id);

-- Detailed Test Case Execution Results per Coding Submission
CREATE TABLE IF NOT EXISTS coding_test_case_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coding_submission_id UUID NOT NULL REFERENCES candidate_coding_submissions(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES coding_test_cases(id) ON DELETE CASCADE,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    actual_output TEXT NULL,
    execution_time_ms INTEGER NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 6. INTERVIEW SESSIONS & SYSTEM CHECKS
-- =====================================================================

CREATE TABLE IF NOT EXISTS interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES interview_registrations(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    status interview_status NOT NULL DEFAULT 'NOT_STARTED',
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    terminated_at TIMESTAMPTZ NULL,
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    current_difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    current_topic VARCHAR(150) NULL,
    question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
    hint_count INTEGER NOT NULL DEFAULT 0 CHECK (hint_count >= 0),
    skip_count INTEGER NOT NULL DEFAULT 0 CHECK (skip_count >= 0),
    warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
    malpractice_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ai_assistance_risk risk_level NOT NULL DEFAULT 'LOW',
    completion_reason VARCHAR(255) NULL,
    session_metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate_status ON interviews(candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_interviews_job_status ON interviews(job_id, status);
CREATE INDEX IF NOT EXISTS idx_interviews_started ON interviews(started_at);

CREATE TABLE IF NOT EXISTS interview_system_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
    microphone_permission BOOLEAN NOT NULL DEFAULT FALSE,
    microphone_test_passed BOOLEAN NOT NULL DEFAULT FALSE,
    microphone_match_score NUMERIC(5,2) NULL CHECK (microphone_match_score IS NULL OR (microphone_match_score >= 0 AND microphone_match_score <= 100)),
    microphone_test_sentence VARCHAR(200) NULL,
    camera_permission BOOLEAN NOT NULL DEFAULT FALSE,
    camera_stream_active BOOLEAN NOT NULL DEFAULT FALSE,
    candidate_presence_detected BOOLEAN NULL,
    speaker_test_passed BOOLEAN NOT NULL DEFAULT FALSE,
    fullscreen_ready BOOLEAN NOT NULL DEFAULT FALSE,
    network_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
    browser_supported BOOLEAN NOT NULL DEFAULT TRUE,
    rules_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    rules_accepted_at TIMESTAMPTZ NULL,
    all_checks_passed BOOLEAN NOT NULL DEFAULT FALSE,
    checked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 7. DYNAMIC QUESTIONS & ANTI-DUPLICATION
-- =====================================================================

CREATE TABLE IF NOT EXISTS interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
    question_text TEXT NOT NULL,
    normalized_question TEXT NULL,
    question_type question_type NOT NULL,
    skill_id UUID NULL REFERENCES skills(id) ON DELETE SET NULL,
    topic VARCHAR(150) NULL,
    subtopic VARCHAR(150) NULL,
    difficulty difficulty_level NOT NULL,
    parent_question_id UUID NULL REFERENCES interview_questions(id) ON DELETE SET NULL,
    is_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
    generation_source VARCHAR(50) NOT NULL DEFAULT 'GEMINI',
    reference_answer TEXT NULL,
    expected_concepts JSONB NULL,
    semantic_fingerprint TEXT NULL,
    asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_interview_question_seq UNIQUE (interview_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_lookup ON interview_questions(interview_id, topic, difficulty);

CREATE TABLE IF NOT EXISTS question_similarity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    candidate_question TEXT NOT NULL,
    existing_question_id UUID NULL REFERENCES interview_questions(id) ON DELETE SET NULL,
    similarity_score NUMERIC(5,4) NULL CHECK (similarity_score IS NULL OR (similarity_score >= 0 AND similarity_score <= 1)),
    decision VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 8. ANSWERS, TRANSCRIPTS & HINTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS interview_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_id UUID NOT NULL UNIQUE REFERENCES interview_questions(id) ON DELETE RESTRICT,
    candidate_answer_text TEXT NULL,
    speech_transcript TEXT NULL,
    intent candidate_intent NOT NULL DEFAULT 'ANSWER',
    technical_correctness NUMERIC(5,2) NULL CHECK (technical_correctness IS NULL OR (technical_correctness >= 0 AND technical_correctness <= 100)),
    concept_coverage NUMERIC(5,2) NULL CHECK (concept_coverage IS NULL OR (concept_coverage >= 0 AND concept_coverage <= 100)),
    relevance_score NUMERIC(5,2) NULL CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 100)),
    reasoning_score NUMERIC(5,2) NULL CHECK (reasoning_score IS NULL OR (reasoning_score >= 0 AND reasoning_score <= 100)),
    completeness_score NUMERIC(5,2) NULL CHECK (completeness_score IS NULL OR (completeness_score >= 0 AND completeness_score <= 100)),
    communication_score NUMERIC(5,2) NULL CHECK (communication_score IS NULL OR (communication_score >= 0 AND communication_score <= 100)),
    independent_reasoning_score NUMERIC(5,2) NULL CHECK (independent_reasoning_score IS NULL OR (independent_reasoning_score >= 0 AND independent_reasoning_score <= 100)),
    answer_state VARCHAR(50) NULL,
    ai_feedback TEXT NULL,
    internal_evaluation JSONB NULL,
    response_time_ms INTEGER NULL CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
    hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    was_skipped BOOLEAN NOT NULL DEFAULT FALSE,
    candidate_corrected_answer BOOLEAN NOT NULL DEFAULT FALSE,
    answered_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_answers_interview ON interview_answers(interview_id);

CREATE TABLE IF NOT EXISTS interview_transcript_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL CHECK (sequence_number > 0),
    speaker VARCHAR(30) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    text_content TEXT NULL,
    audio_storage_path TEXT NULL,
    intent candidate_intent NULL,
    question_id UUID NULL REFERENCES interview_questions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_interview_transcript_seq UNIQUE (interview_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_transcript_interview ON interview_transcript_messages(interview_id);

CREATE TABLE IF NOT EXISTS interview_hints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    hint_level INTEGER NOT NULL CHECK (hint_level BETWEEN 1 AND 3),
    hint_text TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 9. COMPETENCY & BEHAVIOR TRACKING
-- =====================================================================

CREATE TABLE IF NOT EXISTS covered_concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    skill_id UUID NULL REFERENCES skills(id) ON DELETE SET NULL,
    topic VARCHAR(150) NOT NULL,
    concept VARCHAR(200) NOT NULL,
    understanding competency_level NULL,
    confidence NUMERIC(5,2) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
    first_seen_question_id UUID NULL REFERENCES interview_questions(id) ON DELETE SET NULL,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_interview_covered_concept UNIQUE (interview_id, concept)
);

CREATE TABLE IF NOT EXISTS candidate_competencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
    skill_id UUID NULL REFERENCES skills(id) ON DELETE SET NULL,
    topic VARCHAR(150) NOT NULL,
    subtopic VARCHAR(150) NOT NULL DEFAULT 'General',
    competency competency_level NOT NULL,
    internal_score NUMERIC(5,2) NULL CHECK (internal_score IS NULL OR (internal_score >= 0 AND internal_score <= 100)),
    evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
    summary TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_interview_topic_subtopic UNIQUE (interview_id, topic, subtopic)
);

CREATE INDEX IF NOT EXISTS idx_competencies_interview ON candidate_competencies(interview_id);

CREATE TABLE IF NOT EXISTS candidate_behavior_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_id UUID NULL REFERENCES interview_questions(id) ON DELETE SET NULL,
    response_time_ms INTEGER NULL CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
    word_count INTEGER NULL CHECK (word_count IS NULL OR word_count >= 0),
    character_count INTEGER NULL CHECK (character_count IS NULL OR character_count >= 0),
    paste_detected BOOLEAN NOT NULL DEFAULT FALSE,
    copy_detected BOOLEAN NOT NULL DEFAULT FALSE,
    style_change_score NUMERIC(5,2) NULL CHECK (style_change_score IS NULL OR (style_change_score >= 0 AND style_change_score <= 100)),
    vocabulary_shift_score NUMERIC(5,2) NULL CHECK (vocabulary_shift_score IS NULL OR (vocabulary_shift_score >= 0 AND vocabulary_shift_score <= 100)),
    answer_similarity_score NUMERIC(5,2) NULL CHECK (answer_similarity_score IS NULL OR (answer_similarity_score >= 0 AND answer_similarity_score <= 100)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_assistance_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_id UUID NULL REFERENCES interview_questions(id) ON DELETE SET NULL,
    signal_type VARCHAR(100) NOT NULL,
    risk_level risk_level NOT NULL,
    confidence NUMERIC(5,2) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
    description TEXT NOT NULL,
    evidence JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_signals_interview ON ai_assistance_signals(interview_id);

-- =====================================================================
-- 10. PROCTORING & MALPRACTICE
-- =====================================================================

CREATE TABLE IF NOT EXISTS proctoring_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
    event_type proctoring_event_type NOT NULL,
    severity risk_level NOT NULL,
    event_number INTEGER NOT NULL CHECK (event_number > 0),
    browser_timestamp TIMESTAMPTZ NULL,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details JSONB NULL,
    warning_issued BOOLEAN NOT NULL DEFAULT FALSE,
    malpractice_related BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctoring_interview_time ON proctoring_events(interview_id, created_at);
CREATE INDEX IF NOT EXISTS idx_proctoring_type ON proctoring_events(event_type);

CREATE TABLE IF NOT EXISTS malpractice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    triggering_proctoring_event_id UUID NULL REFERENCES proctoring_events(id) ON DELETE SET NULL,
    violation_number INTEGER NOT NULL CHECK (violation_number > 0),
    violation_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    action malpractice_action NOT NULL,
    warning_message TEXT NULL,
    interview_terminated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_malpractice_interview ON malpractice_events(interview_id);

CREATE TABLE IF NOT EXISTS interview_session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 11. REPORTS & DECISIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS interview_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    technical_summary TEXT NULL,
    overall_summary TEXT NULL,
    strengths JSONB NULL,
    weaknesses JSONB NULL,
    learning_recommendations JSONB NULL,
    competency_summary JSONB NULL,
    problem_solving_summary TEXT NULL,
    communication_summary TEXT NULL,
    independent_reasoning_summary TEXT NULL,
    difficulty_progression JSONB NULL,
    hint_dependency VARCHAR(50) NULL,
    followup_performance VARCHAR(50) NULL,
    ai_assistance_risk risk_level NOT NULL DEFAULT 'LOW',
    integrity_status VARCHAR(50) NULL,
    candidate_report_path TEXT NULL,
    recruiter_report_path TEXT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recruiter_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE RESTRICT,
    recruiter_id UUID NOT NULL REFERENCES recruiter_profiles(id) ON DELETE RESTRICT,
    decision recruiter_decision NOT NULL DEFAULT 'NOT_REVIEWED',
    notes TEXT NULL,
    decided_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 12. LOGS & AUDIT TRAIL
-- =====================================================================

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    interview_id UUID NULL REFERENCES interviews(id) ON DELETE SET NULL,
    job_id UUID NULL REFERENCES jobs(id) ON DELETE SET NULL,
    recipient_email CITEXT NOT NULL,
    email_type email_type NOT NULL,
    subject VARCHAR(255) NOT NULL,
    provider_message_id VARCHAR(255) NULL,
    status email_status NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    error_message TEXT NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_status_date ON email_logs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_interview ON email_logs(interview_id);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(80) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(150) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id UUID NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs(actor_user_id, created_at);
