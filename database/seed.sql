-- =====================================================================
-- SEED DATA: AI INTERVIEWER PLATFORM
-- Adheres to strict one-email-one-account and referential integrity
-- Valid RFC 4122 hex UUIDs
-- =====================================================================

-- 1. Insert Core Skills
INSERT INTO skills (id, name, normalized_name) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Java', 'java'),
    ('10000000-0000-0000-0000-000000000002', 'Spring Boot', 'spring boot'),
    ('10000000-0000-0000-0000-000000000003', 'React', 'react'),
    ('10000000-0000-0000-0000-000000000004', 'Node.js', 'node.js'),
    ('10000000-0000-0000-0000-000000000005', 'PostgreSQL', 'postgresql'),
    ('10000000-0000-0000-0000-000000000006', 'Python', 'python'),
    ('10000000-0000-0000-0000-000000000007', 'SQL', 'sql'),
    ('10000000-0000-0000-0000-000000000008', 'AWS', 'aws'),
    ('10000000-0000-0000-0000-000000000009', 'Docker', 'docker'),
    ('10000000-0000-0000-0000-000000000010', 'Git', 'git')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Demo Company
INSERT INTO companies (id, name, slug, description, website_url, logo_url, industry, company_size, headquarters, is_verified) VALUES
    ('20000000-0000-0000-0000-000000000001',
     'TechNova Systems',
     'technova-systems',
     'TechNova Systems engineers high-throughput distributed platforms and AI-driven enterprise infrastructure.',
     'https://technova.example.com',
     'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=128&h=128&fit=crop&crop=faces',
     'Enterprise Cloud & AI Software',
     '500-1000 employees',
     'Chennai, India',
     TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 3. Insert Users (1 Recruiter, 2 Candidates)
INSERT INTO users (id, full_name, email, password_hash, role, account_status, email_verified, auth_provider) VALUES
    ('30000000-0000-0000-0000-000000000001',
     'Priya Sharma',
     'recruiter@technova.com',
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'RECRUITER',
     'ACTIVE',
     TRUE,
     'LOCAL'),
    ('30000000-0000-0000-0000-000000000002',
     'Dhanush Sundhar',
     'dhanush@example.com',
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'CANDIDATE',
     'ACTIVE',
     TRUE,
     'LOCAL'),
    ('30000000-0000-0000-0000-000000000003',
     'Ananya Rao',
     'ananya.rao@example.com',
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'CANDIDATE',
     'ACTIVE',
     TRUE,
     'LOCAL')
ON CONFLICT (email) DO NOTHING;

-- 4. Insert Recruiter Profile
INSERT INTO recruiter_profiles (id, user_id, company_id, designation, work_email, phone, is_company_admin) VALUES
    ('40000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000001',
     'Principal Technical Talent Partner',
     'recruiter@technova.com',
     '+91 98765 11223',
     TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Insert Candidate Profiles
INSERT INTO candidate_profiles (id, user_id, phone, date_of_birth, college_name, degree, department, graduation_year, current_location, experience_years, headline, summary, primary_skill) VALUES
    ('50000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',
     '+91 98765 43210',
     '2001-05-14',
     'Anna University, College of Engineering Guindy',
     'B.Tech',
     'Information Technology',
     2023,
     'Chennai, India',
     2.5,
     'Backend Java & Spring Boot Specialist',
     'Passionate backend engineer with extensive experience building resilient distributed microservices, transaction queues, and relational data layers.',
     'Java'),
    ('50000000-0000-0000-0000-000000000002',
     '30000000-0000-0000-0000-000000000003',
     '+91 97654 32109',
     '2002-08-20',
     'National Institute of Technology, Trichy',
     'B.E.',
     'Computer Science & Engineering',
     2024,
     'Bengaluru, India',
     1.0,
     'Full Stack React & Node.js Developer',
     'Full stack builder proficient in modern TypeScript, React 19 component architectures, and RESTful Node microservices.',
     'React')
ON CONFLICT (user_id) DO NOTHING;

-- 6. Insert Candidate Skills
INSERT INTO candidate_skills (id, candidate_id, skill_id, self_reported_level, years_experience, source) VALUES
    ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'STRONG', 2.5, 'RESUME'),
    ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'STRONG', 2.0, 'RESUME'),
    ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'GOOD', 2.0, 'SELF_DECLARED'),
    ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'VERY_STRONG', 1.5, 'RESUME'),
    ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'GOOD', 1.0, 'SELF_DECLARED')
ON CONFLICT DO NOTHING;

-- 7. Insert 3 Jobs
INSERT INTO jobs (id, company_id, recruiter_id, title, job_code, description, location, work_mode, employment_type, qualification, minimum_experience, maximum_experience, currency, minimum_package, maximum_package, package_period, application_deadline, estimated_interview_minutes, status, published_at) VALUES
    ('70000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000001',
     'Backend Java Developer',
     'TN-JOB-JAVA-01',
     'We are looking for an experienced Java Software Engineer to architect resilient distributed microservices, optimize database queries, and build enterprise cloud systems.',
     'Chennai, India',
     'HYBRID',
     'FULL_TIME',
     'B.Tech / M.Tech in Computer Science, IT or related software disciplines',
     1.0,
     4.0,
     'INR',
     650000.00,
     1200000.00,
     'YEAR',
     '2026-10-31 23:59:59+00',
     25,
     'ACTIVE',
     '2026-09-01 10:00:00+00'),
    ('70000000-0000-0000-0000-000000000002',
     '20000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000001',
     'Full Stack React & Node Engineer',
     'TN-JOB-FS-02',
     'Deliver scalable real-time web applications, AI agent visual interfaces, and robust Node.js microservice APIs.',
     'Bengaluru, India',
     'REMOTE',
     'FULL_TIME',
     'B.Tech / B.E. in Computer Science or equivalent software engineering background',
     2.0,
     5.0,
     'INR',
     1200000.00,
     2200000.00,
     'YEAR',
     '2026-11-15 23:59:59+00',
     30,
     'ACTIVE',
     '2026-09-03 10:00:00+00'),
    ('70000000-0000-0000-0000-000000000003',
     '20000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000001',
     'Distributed Cloud Infrastructure Engineer',
     'TN-JOB-CLOUD-03',
     'Architect Kubernetes container clusters, automated CI/CD pipelines, and high-availability database replication topologies on AWS.',
     'Hyderabad, India',
     'ONSITE',
     'FULL_TIME',
     'Bachelor or Master degree in Computer Engineering or related field',
     3.0,
     6.0,
     'INR',
     1600000.00,
     2800000.00,
     'YEAR',
     '2026-10-15 23:59:59+00',
     35,
     'ACTIVE',
     '2026-09-05 10:00:00+00')
ON CONFLICT (job_code) DO NOTHING;

-- 8. Insert Job Required Skills
INSERT INTO job_skills (id, job_id, skill_id, is_required, importance_weight, minimum_level) VALUES
    ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', TRUE, 1.50, 'GOOD'),
    ('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', TRUE, 1.25, 'GOOD'),
    ('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', TRUE, 1.00, 'DEVELOPING'),
    ('80000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', TRUE, 1.50, 'STRONG'),
    ('80000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', TRUE, 1.25, 'GOOD'),
    ('80000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000008', TRUE, 1.50, 'STRONG'),
    ('80000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000009', TRUE, 1.25, 'GOOD')
ON CONFLICT DO NOTHING;

-- 9. Insert Resumes
INSERT INTO resumes (id, candidate_id, original_filename, storage_path, mime_type, file_size, parsed_text, is_current) VALUES
    ('90000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     'Dhanush_Sundhar_Resume.pdf',
     '/uploads/resumes/dhanush_sundhar.pdf',
     'application/pdf',
     245760,
     'Dhanush Sundhar. Experienced Backend Java Engineer with 2.5 years building Spring Boot services, database query optimizations, and REST APIs.',
     TRUE),
    ('90000000-0000-0000-0000-000000000002',
     '50000000-0000-0000-0000-000000000002',
     'Ananya_Rao_Resume.pdf',
     '/uploads/resumes/ananya_rao.pdf',
     'application/pdf',
     215040,
     'Ananya Rao. Full Stack Developer with 1 year experience building scalable React and Node.js applications.',
     TRUE)
ON CONFLICT DO NOTHING;

-- 10. Insert Job Applications
INSERT INTO job_applications (id, job_id, candidate_id, resume_id, status, applied_at) VALUES
    ('a1000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     '90000000-0000-0000-0000-000000000001',
     'INTERVIEW_COMPLETED',
     '2026-09-06 10:00:00+00'),
    ('a1000000-0000-0000-0000-000000000002',
     '70000000-0000-0000-0000-000000000002',
     '50000000-0000-0000-0000-000000000002',
     '90000000-0000-0000-0000-000000000002',
     'INTERVIEW_READY',
     '2026-09-07 14:00:00+00')
ON CONFLICT (job_id, candidate_id) DO NOTHING;

-- 11. Insert Interview Registrations (Hashed Access Codes)
INSERT INTO interview_registrations (id, application_id, candidate_id, job_id, interview_code_hash, interview_code_last4, code_expires_at, code_verified_at, registration_status) VALUES
    ('b1000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000001',
     'e2d5c3fa918b965c4015694c9657b320875e533c3f91f759600e69ffc8f35919',
     '4M92',
     '2026-09-20 23:59:59+00',
     '2026-09-07 10:00:00+00',
     'ACTIVE'),
    ('b1000000-0000-0000-0000-000000000002',
     'a1000000-0000-0000-0000-000000000002',
     '50000000-0000-0000-0000-000000000002',
     '70000000-0000-0000-0000-000000000002',
     'f81de24249a0d3198031d607212008f1b95ffab8b6aa99e19d77e4cb31cfc846',
     '9W81',
     '2026-09-25 23:59:59+00',
     NULL,
     'ACTIVE')
ON CONFLICT (application_id) DO NOTHING;

-- 12. Insert Completed Interview Session
INSERT INTO interviews (id, registration_id, candidate_id, job_id, status, started_at, completed_at, duration_seconds, current_difficulty, current_topic, question_count, hint_count, skip_count, warning_count, malpractice_flag, ai_assistance_risk, completion_reason) VALUES
    ('c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000001',
     'COMPLETED',
     '2026-09-07 10:30:00+00',
     '2026-09-07 10:52:00+00',
     1320,
     'HARD',
     'Spring Boot Microservices & Database Concurrency',
     5,
     1,
     0,
     1,
     FALSE,
     'LOW',
     'ALL_ASSESSMENT_COMPETENCIES_SATISFIED')
ON CONFLICT (registration_id) DO NOTHING;

-- 13. Insert Pre-Interview System Checks
INSERT INTO interview_system_checks (id, interview_id, microphone_permission, microphone_test_passed, microphone_match_score, camera_permission, camera_stream_active, candidate_presence_detected, speaker_test_passed, fullscreen_ready, network_check_passed, browser_supported, rules_accepted, all_checks_passed, checked_at) VALUES
    ('d1000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001',
     TRUE,
     TRUE,
     96.50,
     TRUE,
     TRUE,
     TRUE,
     TRUE,
     TRUE,
     TRUE,
     TRUE,
     TRUE,
     TRUE,
     '2026-09-07 10:28:00+00')
ON CONFLICT (interview_id) DO NOTHING;

-- 14. Insert Interview Questions
INSERT INTO interview_questions (id, interview_id, sequence_number, question_text, normalized_question, question_type, skill_id, topic, difficulty, asked_at) VALUES
    ('e1000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001',
     1,
     'Could you briefly introduce your background and talk about a mission-critical Java service you built?',
     'could you briefly introduce your background and talk about a mission-critical java service you built',
     'SELF_INTRODUCTION',
     '10000000-0000-0000-0000-000000000001',
     'Candidate Background',
     'EASY',
     '2026-09-07 10:31:00+00'),
    ('e1000000-0000-0000-0000-000000000002',
     'c1000000-0000-0000-0000-000000000001',
     2,
     'In Spring Boot, how does the Bean Lifecycle manage singleton scope across concurrent HTTP requests?',
     'in spring boot how does the bean lifecycle manage singleton scope across concurrent http requests',
     'CONCEPTUAL',
     '10000000-0000-0000-0000-000000000002',
     'Spring Framework Concurrency',
     'MEDIUM',
     '2026-09-07 10:35:00+00'),
    ('e1000000-0000-0000-0000-000000000003',
     'c1000000-0000-0000-0000-000000000001',
     3,
     'Imagine two independent transactions executing concurrent updates on a bank account balance in PostgreSQL. How would you prevent dirty reads and lost updates using isolation levels?',
     'imagine two independent transactions executing concurrent updates on a bank account balance in postgresql how would you prevent dirty reads and lost updates using isolation levels',
     'SCENARIO',
     '10000000-0000-0000-0000-000000000005',
     'Database Transaction Isolation & ACID',
     'HARD',
     '2026-09-07 10:40:00+00')
ON CONFLICT (interview_id, sequence_number) DO NOTHING;

-- 15. Insert Interview Answers
INSERT INTO interview_answers (id, interview_id, question_id, candidate_answer_text, speech_transcript, intent, technical_correctness, concept_coverage, relevance_score, reasoning_score, completeness_score, communication_score, independent_reasoning_score, ai_feedback, hints_used, answered_at) VALUES
    ('f1000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001',
     'e1000000-0000-0000-0000-000000000001',
     'I am Dhanush, a backend engineer with 2.5 years experience in building Spring Boot microservices. At my previous team, I engineered an order orchestration service handling over 3000 transactions per second with low latency.',
     'I am Dhanush, a backend engineer with 2.5 years experience in building Spring Boot microservices...',
     'ANSWER',
     92.00, 90.00, 95.00, 90.00, 90.00, 94.00, 95.00,
     'Clear, concise, and professionally communicated authentic background.',
     0,
     '2026-09-07 10:34:00+00'),
    ('f1000000-0000-0000-0000-000000000002',
     'c1000000-0000-0000-0000-000000000001',
     'e1000000-0000-0000-0000-000000000002',
     'Spring manages singleton beans as single shared instances inside the ApplicationContext. Because multiple worker threads execute the same bean methods simultaneously, singletons must remain strictly stateless. Shared state must be avoided or guarded with thread-safe data structures like ConcurrentHashMap or atomic primitives.',
     'Spring manages singleton beans as single shared instances...',
     'ANSWER',
     94.00, 92.00, 96.00, 95.00, 92.00, 90.00, 93.00,
     'Accurate explanation of thread-safety and stateless design patterns in Spring singletons.',
     0,
     '2026-09-07 10:39:00+00'),
    ('f1000000-0000-0000-0000-000000000003',
     'c1000000-0000-0000-0000-000000000001',
     'e1000000-0000-0000-0000-000000000003',
     'To prevent lost updates, we can use pessimistic locking via SELECT FOR UPDATE, or optimistic locking with a version column. In terms of transaction isolation, PostgreSQL does not allow dirty reads even in Read Committed. Using Repeatable Read or Serializable will detect concurrent modification conflicts and abort the second transaction safely.',
     'To prevent lost updates we can use pessimistic locking...',
     'ANSWER',
     88.00, 89.00, 90.00, 92.00, 87.00, 88.00, 90.00,
     'Strong technical grounding in row-level locking and MVCC concurrency semantics.',
     1,
     '2026-09-07 10:45:00+00')
ON CONFLICT (question_id) DO NOTHING;

-- 16. Insert Transcript Messages
INSERT INTO interview_transcript_messages (id, interview_id, sequence_number, speaker, message_type, text_content, intent, question_id) VALUES
    ('a2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1, 'AI', 'QUESTION', 'Could you briefly introduce your background and talk about a mission-critical Java service you built?', NULL, 'e1000000-0000-0000-0000-000000000001'),
    ('a2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 2, 'CANDIDATE', 'ANSWER', 'I am Dhanush, a backend engineer with 2.5 years experience in building Spring Boot microservices...', 'ANSWER', 'e1000000-0000-0000-0000-000000000001'),
    ('a2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 3, 'AI', 'FEEDBACK', 'Excellent summary. Let us dive into Spring core architectures.', NULL, NULL)
ON CONFLICT (interview_id, sequence_number) DO NOTHING;

-- 17. Insert Covered Concepts
INSERT INTO covered_concepts (id, interview_id, skill_id, topic, concept, understanding, confidence) VALUES
    ('b2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Spring Framework', 'Singleton Scope & Thread Concurrency', 'STRONG', 94.00),
    ('b2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'PostgreSQL Concurrency', 'MVCC & Row-Level Locking (SELECT FOR UPDATE)', 'GOOD', 88.50)
ON CONFLICT (interview_id, concept) DO NOTHING;

-- 18. Insert Candidate Competencies
INSERT INTO candidate_competencies (id, interview_id, candidate_id, skill_id, topic, subtopic, competency, internal_score, evidence_count, summary) VALUES
    ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Java Backend Engineering', 'Core Concurrency & JVM', 'STRONG', 92.50, 2, 'Demonstrated clear mental model of thread-safety, stateless service design, and multithreading.'),
    ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Relational Databases', 'ACID Transactions & Isolation', 'GOOD', 88.00, 1, 'Articulated MVCC advantages, phantom read prevention, and lock escalation strategies.')
ON CONFLICT (interview_id, topic, subtopic) DO NOTHING;

-- 19. Insert Proctoring Event & Malpractice Warning
INSERT INTO proctoring_events (id, interview_id, candidate_id, event_type, severity, event_number, details, warning_issued, malpractice_related) VALUES
    ('d2000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     'TAB_SWITCH',
     'MODERATE',
     1,
     '{"blurDurationMs": 1400, "reason": "User switched window briefly"}',
     TRUE,
     TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO malpractice_events (id, interview_id, candidate_id, job_id, triggering_proctoring_event_id, violation_number, violation_type, description, action, warning_message, interview_terminated) VALUES
    ('e2000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000001',
     'd2000000-0000-0000-0000-000000000001',
     1,
     'WINDOW_FOCUS_LOST',
     'Brief tab defocus event detected during question 2.',
     'WARNING',
     'Integrity Alert (1/2): Please stay in full-screen mode and refrain from switching tabs.',
     FALSE)
ON CONFLICT DO NOTHING;

-- 20. Insert Final Interview Report
INSERT INTO interview_reports (id, interview_id, candidate_id, job_id, technical_summary, overall_summary, strengths, weaknesses, learning_recommendations, competency_summary, hint_dependency, ai_assistance_risk, integrity_status) VALUES
    ('f2000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000001',
     'Candidate showed profound understanding of Spring Framework lifecycle, distributed systems, and PostgreSQL transaction isolation semantics.',
     'Overall, Dhanush demonstrated top-tier engineering maturity, clear independent reasoning, and excellent conversational clarity.',
     '["Strong mastery of multithreaded service design", "In-depth understanding of database transaction isolation", "Clear verbal communication and articulate problem breakdown"]',
     '["Could expand on reactive non-blocking I/O architectures with Spring WebFlux"]',
     '["Explore Project Reactor and R2DBC for reactive database streams"]',
     '{"Java": 92.5, "Spring Boot": 94.0, "PostgreSQL": 88.0}',
     'MINIMAL',
     'LOW',
     'CLEARED_WITH_SINGLE_WARNING')
ON CONFLICT (interview_id) DO NOTHING;

-- 21. Insert Recruiter Decision
INSERT INTO recruiter_decisions (id, interview_id, recruiter_id, decision, notes, decided_at) VALUES
    ('a3000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000001',
     'SHORTLIST',
     'Candidate scored high across both Spring Boot and database concurrency. Strong recommendation for final architectural interview.',
     '2026-09-08 14:00:00+00')
ON CONFLICT (interview_id) DO NOTHING;

-- 22. Insert Email Logs
INSERT INTO email_logs (id, user_id, interview_id, job_id, recipient_email, email_type, subject, status, sent_at) VALUES
    ('b3000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',
     'c1000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000001',
     'dhanush@example.com',
     'INTERVIEW_REGISTRATION',
     'Interview Registration Confirmed – TechNova Systems',
     'SENT',
     '2026-09-06 11:00:00+00'),
    ('b3000000-0000-0000-0000-000000000002',
     '30000000-0000-0000-0000-000000000002',
     'c1000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000001',
     'dhanush@example.com',
     'CANDIDATE_REPORT',
     'Interview Assessment Report – Backend Java Developer – TechNova Systems',
     'SENT',
     '2026-09-07 12:00:00+00')
ON CONFLICT DO NOTHING;

-- 23. Insert Audit Logs
INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, ip_address) VALUES
    ('c3000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'INTERVIEW_CODE_VERIFIED', 'interview_registrations', 'b1000000-0000-0000-0000-000000000001', '127.0.0.1'),
    ('c3000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'INTERVIEW_STARTED', 'interviews', 'c1000000-0000-0000-0000-000000000001', '127.0.0.1'),
    ('c3000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'INTERVIEW_COMPLETED', 'interviews', 'c1000000-0000-0000-0000-000000000001', '127.0.0.1'),
    ('c3000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'CANDIDATE_SHORTLISTED', 'interviews', 'c1000000-0000-0000-0000-000000000001', '127.0.0.1')
ON CONFLICT DO NOTHING;
