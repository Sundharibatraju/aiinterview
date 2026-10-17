export interface PredefinedQuery {
  id: string;
  name: string;
  category: 'Recruitment' | 'Interviews' | 'Integrity' | 'Analytics';
  description: string;
  sql: string;
}

export const PREDEFINED_QUERIES: PredefinedQuery[] = [
  {
    id: 'applications-per-job',
    name: 'Applications per Job',
    category: 'Recruitment',
    description: 'Breakdown of applications across all jobs by candidate status',
    sql: `SELECT 
    j.id AS job_id,
    j.job_code,
    j.title AS job_title,
    c.name AS company_name,
    COUNT(ja.id) AS total_applications
FROM jobs j
JOIN companies c ON j.company_id = c.id
LEFT JOIN job_applications ja ON j.id = ja.job_id
GROUP BY j.id, j.job_code, j.title, c.name
ORDER BY total_applications DESC;`,
  },
  {
    id: 'completed-interviews',
    name: 'Completed Interviews per Job',
    category: 'Interviews',
    description: 'Aggregates completed interview sessions, average duration, and question metrics',
    sql: `SELECT 
    j.id AS job_id,
    j.job_code,
    j.title AS job_title,
    c.name AS company_name,
    COUNT(i.id) AS total_completed_interviews,
    ROUND(AVG(i.duration_seconds) / 60.0, 1) AS avg_duration_minutes,
    ROUND(AVG(i.question_count), 1) AS avg_questions_answered,
    ROUND(AVG(i.hint_count), 1) AS avg_hints_used
FROM jobs j
JOIN companies c ON j.company_id = c.id
JOIN interviews i ON j.id = i.job_id AND i.status = 'COMPLETED'
GROUP BY j.id, j.job_code, j.title, c.name
ORDER BY total_completed_interviews DESC;`,
  },
  {
    id: 'candidates-waiting',
    name: 'Candidates Waiting for Interview',
    category: 'Recruitment',
    description: 'Candidates with active interview registration codes who have not yet started',
    sql: `SELECT 
    u.id AS candidate_user_id,
    u.full_name AS candidate_name,
    u.email AS candidate_email,
    cp.phone,
    cp.experience_years,
    j.title AS applied_job_title,
    c.name AS company_name,
    ir.interview_code_last4 AS code_suffix,
    ir.code_expires_at,
    ir.registered_at
FROM interview_registrations ir
JOIN candidate_profiles cp ON ir.candidate_id = cp.id
JOIN users u ON cp.user_id = u.id
JOIN jobs j ON ir.job_id = j.id
JOIN companies c ON j.company_id = c.id
LEFT JOIN interviews i ON ir.id = i.registration_id
WHERE (i.id IS NULL OR i.status = 'NOT_STARTED' OR i.status = 'READY')
  AND ir.is_code_revoked = FALSE
ORDER BY ir.registered_at ASC;`,
  },
  {
    id: 'shortlisted-candidates',
    name: 'Shortlisted Candidates',
    category: 'Recruitment',
    description: 'Candidates shortlisted by talent partners with evaluation notes and risk status',
    sql: `SELECT 
    u.full_name AS candidate_name,
    u.email AS candidate_email,
    cp.current_location,
    cp.experience_years,
    j.title AS job_title,
    c.name AS company_name,
    rep.integrity_status,
    rep.ai_assistance_risk,
    rd.decision AS recruiter_decision,
    rd.notes AS recruiter_notes,
    rd.decided_at
FROM recruiter_decisions rd
JOIN interviews i ON rd.interview_id = i.id
JOIN candidate_profiles cp ON i.candidate_id = cp.id
JOIN users u ON cp.user_id = u.id
JOIN jobs j ON i.job_id = j.id
JOIN companies c ON j.company_id = c.id
LEFT JOIN interview_reports rep ON i.id = rep.interview_id
WHERE rd.decision = 'SHORTLIST'
ORDER BY rd.decided_at DESC;`,
  },
  {
    id: 'malpractice-flagged',
    name: 'Malpractice Flagged Interviews',
    category: 'Integrity',
    description: 'Interviews flagged or terminated due to anti-cheat or integrity violations',
    sql: `SELECT 
    i.id AS interview_id,
    u.full_name AS candidate_name,
    u.email AS candidate_email,
    j.title AS job_title,
    i.status AS interview_status,
    i.warning_count,
    i.malpractice_flag,
    me.violation_type,
    me.action AS violation_action,
    me.description AS violation_description,
    me.created_at AS violation_time
FROM interviews i
JOIN candidate_profiles cp ON i.candidate_id = cp.id
JOIN users u ON cp.user_id = u.id
JOIN jobs j ON i.job_id = j.id
LEFT JOIN malpractice_events me ON i.id = me.interview_id
WHERE i.malpractice_flag = TRUE 
   OR i.status = 'MALPRACTICE_TERMINATED' 
   OR i.warning_count > 0
ORDER BY i.created_at DESC;`,
  },
  {
    id: 'candidate-competencies',
    name: 'Candidate Competencies Breakdown',
    category: 'Analytics',
    description: 'Distribution of demonstrated candidate competencies and scores by topic',
    sql: `SELECT 
    cc.topic,
    cc.subtopic,
    cc.competency,
    COUNT(DISTINCT cc.candidate_id) AS candidate_count,
    ROUND(AVG(cc.internal_score), 2) AS average_score
FROM candidate_competencies cc
GROUP BY cc.topic, cc.subtopic, cc.competency
ORDER BY cc.topic, average_score DESC;`,
  },
  {
    id: 'completion-rate',
    name: 'Interview Completion Rate',
    category: 'Analytics',
    description: 'Completion vs termination rate by job specification',
    sql: `SELECT 
    j.id AS job_id,
    j.title AS job_title,
    COUNT(i.id) AS total_interviews_started,
    COUNT(CASE WHEN i.status = 'COMPLETED' THEN 1 END) AS completed_count,
    COUNT(CASE WHEN i.status = 'MALPRACTICE_TERMINATED' THEN 1 END) AS malpractice_count
FROM jobs j
JOIN interviews i ON j.id = i.job_id
GROUP BY j.id, j.title;`,
  },
  {
    id: 'duration-metrics',
    name: 'Average Interview Duration',
    category: 'Analytics',
    description: 'Calculates mean and range of interview lengths across jobs',
    sql: `SELECT 
    j.title AS job_title,
    COUNT(i.id) AS completed_session_count,
    ROUND(AVG(i.duration_seconds), 0) AS avg_duration_seconds,
    ROUND(AVG(i.duration_seconds) / 60.0, 1) AS avg_duration_minutes
FROM interviews i
JOIN jobs j ON i.job_id = j.id
WHERE i.status = 'COMPLETED' AND i.duration_seconds IS NOT NULL
GROUP BY j.title;`,
  },
  {
    id: 'hint-dependency',
    name: 'Hint Dependency Analysis',
    category: 'Analytics',
    description: 'Correlates hint reliance with technical correctness and independent reasoning',
    sql: `SELECT 
    rep.hint_dependency,
    COUNT(i.id) AS interview_count,
    ROUND(AVG(i.hint_count), 2) AS avg_hints_used
FROM interviews i
JOIN interview_reports rep ON i.id = rep.interview_id
GROUP BY rep.hint_dependency
ORDER BY interview_count DESC;`,
  },
  {
    id: 'ai-risk-distribution',
    name: 'AI Assistance Risk Distribution',
    category: 'Integrity',
    description: 'Proportion of interviews evaluated under Low, Moderate, High, or Critical AI assistance risk',
    sql: `SELECT 
    i.ai_assistance_risk,
    COUNT(i.id) AS interview_count,
    COUNT(CASE WHEN i.malpractice_flag = TRUE THEN 1 END) AS flagged_for_malpractice
FROM interviews i
GROUP BY i.ai_assistance_risk;`,
  },
  {
    id: 'proctoring-incidents',
    name: 'Proctoring Incident Frequency',
    category: 'Integrity',
    description: 'Frequency of browser blur, tab switches, and integrity violations',
    sql: `SELECT 
    pe.event_type,
    pe.severity,
    COUNT(pe.id) AS incident_count,
    COUNT(DISTINCT pe.interview_id) AS affected_interviews,
    COUNT(CASE WHEN pe.warning_issued = TRUE THEN 1 END) AS warnings_issued
FROM proctoring_events pe
GROUP BY pe.event_type, pe.severity
ORDER BY incident_count DESC;`,
  },
  {
    id: 'recruiter-decisions-pipeline',
    name: 'Recruiter Decision Pipeline',
    category: 'Recruitment',
    description: 'Status of recruiter decisions across all completed interviews',
    sql: `SELECT 
    COALESCE(rd.decision, 'NOT_REVIEWED') AS decision_stage,
    COUNT(i.id) AS candidate_count
FROM interviews i
LEFT JOIN recruiter_decisions rd ON i.id = rd.interview_id
WHERE i.status = 'COMPLETED'
GROUP BY rd.decision
ORDER BY candidate_count DESC;`,
  },
  {
    id: 'all-users',
    name: 'All Registered Users',
    category: 'Recruitment',
    description: 'Lists all system accounts, roles, verification states, and statuses',
    sql: `SELECT id, full_name, email, role, account_status, email_verified, auth_provider, created_at FROM users ORDER BY created_at DESC;`,
  },
  {
    id: 'all-jobs',
    name: 'All Jobs and Requirements',
    category: 'Recruitment',
    description: 'Active and drafted job listings with company affiliations and salary ranges',
    sql: `SELECT 
    j.id, j.title, j.job_code, c.name AS company, j.location, j.work_mode, j.minimum_package, j.maximum_package, j.status
FROM jobs j
JOIN companies c ON j.company_id = c.id
ORDER BY j.created_at DESC;`,
  },
];
