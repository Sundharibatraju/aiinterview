-- =====================================================================
-- PRODUCTION REPORTING & ANALYTICAL SQL QUERIES (SECTION 49)
-- Platform: AI INTERVIEWER – AUTONOMOUS RECRUITMENT & ASSESSMENT
-- =====================================================================

-- ---------------------------------------------------------------------
-- QUERY 1: Applications per Job (with breakdown by status)
-- ---------------------------------------------------------------------
SELECT 
    j.id AS job_id,
    j.job_code,
    j.title AS job_title,
    c.name AS company_name,
    COUNT(ja.id) AS total_applications,
    COUNT(CASE WHEN ja.status = 'APPLIED' THEN 1 END) AS count_applied,
    COUNT(CASE WHEN ja.status = 'INTERVIEW_READY' THEN 1 END) AS count_interview_ready,
    COUNT(CASE WHEN ja.status = 'INTERVIEW_COMPLETED' THEN 1 END) AS count_interview_completed,
    COUNT(CASE WHEN ja.status = 'SHORTLISTED' THEN 1 END) AS count_shortlisted,
    COUNT(CASE WHEN ja.status = 'REJECTED' THEN 1 END) AS count_rejected,
    COUNT(CASE WHEN ja.status = 'WITHDRAWN' THEN 1 END) AS count_withdrawn
FROM jobs j
JOIN companies c ON j.company_id = c.id
LEFT JOIN job_applications ja ON j.id = ja.job_id
GROUP BY j.id, j.job_code, j.title, c.name
ORDER BY total_applications DESC, j.created_at DESC;

-- ---------------------------------------------------------------------
-- QUERY 2: Completed Interviews per Job
-- ---------------------------------------------------------------------
SELECT 
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
ORDER BY total_completed_interviews DESC;

-- ---------------------------------------------------------------------
-- QUERY 3: Candidates Waiting for Interview (Eligible & Ready)
-- ---------------------------------------------------------------------
SELECT 
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
  AND (ir.code_expires_at IS NULL OR ir.code_expires_at > NOW())
ORDER BY ir.registered_at ASC;

-- ---------------------------------------------------------------------
-- QUERY 4: Shortlisted Candidates
-- ---------------------------------------------------------------------
SELECT 
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
ORDER BY rd.decided_at DESC;

-- ---------------------------------------------------------------------
-- QUERY 5: Malpractice Terminated & Warning Flagged Interviews
-- ---------------------------------------------------------------------
SELECT 
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
ORDER BY i.created_at DESC;

-- ---------------------------------------------------------------------
-- QUERY 6: Candidates by Competency Level Breakdown
-- ---------------------------------------------------------------------
SELECT 
    cc.topic,
    cc.subtopic,
    cc.competency,
    COUNT(DISTINCT cc.candidate_id) AS candidate_count,
    ROUND(AVG(cc.internal_score), 2) AS average_score,
    MIN(cc.internal_score) AS min_score,
    MAX(cc.internal_score) AS max_score
FROM candidate_competencies cc
GROUP BY cc.topic, cc.subtopic, cc.competency
ORDER BY cc.topic, average_score DESC;

-- ---------------------------------------------------------------------
-- QUERY 7: Interview Completion Rate by Job
-- ---------------------------------------------------------------------
SELECT 
    j.id AS job_id,
    j.title AS job_title,
    COUNT(i.id) AS total_interviews_started,
    COUNT(CASE WHEN i.status = 'COMPLETED' THEN 1 END) AS completed_count,
    COUNT(CASE WHEN i.status = 'MALPRACTICE_TERMINATED' THEN 1 END) AS malpractice_count,
    COUNT(CASE WHEN i.status IN ('IN_PROGRESS', 'READY') THEN 1 END) AS in_progress_count,
    ROUND(
        (COUNT(CASE WHEN i.status = 'COMPLETED' THEN 1 END)::numeric / 
         NULLIF(COUNT(i.id), 0)) * 100, 
        2
    ) AS completion_rate_percentage
FROM jobs j
JOIN interviews i ON j.id = i.job_id
GROUP BY j.id, j.title
ORDER BY completion_rate_percentage DESC;

-- ---------------------------------------------------------------------
-- QUERY 8: Average Interview Duration
-- ---------------------------------------------------------------------
SELECT 
    j.title AS job_title,
    COUNT(i.id) AS completed_session_count,
    ROUND(AVG(i.duration_seconds), 0) AS avg_duration_seconds,
    ROUND(AVG(i.duration_seconds) / 60.0, 1) AS avg_duration_minutes,
    MIN(i.duration_seconds) / 60 AS min_duration_minutes,
    MAX(i.duration_seconds) / 60 AS max_duration_minutes
FROM interviews i
JOIN jobs j ON i.job_id = j.id
WHERE i.status = 'COMPLETED' AND i.duration_seconds IS NOT NULL
GROUP BY j.title;

-- ---------------------------------------------------------------------
-- QUERY 9: Hint Dependency Analysis
-- ---------------------------------------------------------------------
SELECT 
    rep.hint_dependency,
    COUNT(i.id) AS interview_count,
    ROUND(AVG(i.hint_count), 2) AS avg_hints_used,
    ROUND(AVG(ans.technical_correctness), 2) AS avg_technical_score,
    ROUND(AVG(ans.independent_reasoning_score), 2) AS avg_independent_reasoning_score
FROM interviews i
JOIN interview_reports rep ON i.id = rep.interview_id
LEFT JOIN interview_answers ans ON i.id = ans.interview_id
GROUP BY rep.hint_dependency
ORDER BY interview_count DESC;

-- ---------------------------------------------------------------------
-- QUERY 10: Strong & Weak Skills per Candidate
-- ---------------------------------------------------------------------
SELECT 
    u.full_name AS candidate_name,
    u.email AS candidate_email,
    j.title AS evaluated_for_job,
    rep.strengths,
    rep.weaknesses,
    rep.learning_recommendations,
    rep.ai_assistance_risk
FROM interview_reports rep
JOIN interviews i ON rep.interview_id = i.id
JOIN candidate_profiles cp ON i.candidate_id = cp.id
JOIN users u ON cp.user_id = u.id
JOIN jobs j ON i.job_id = j.id
ORDER BY rep.generated_at DESC;

-- ---------------------------------------------------------------------
-- QUERY 11: AI Assistance Risk Level Distribution
-- ---------------------------------------------------------------------
SELECT 
    i.ai_assistance_risk,
    COUNT(i.id) AS interview_count,
    ROUND((COUNT(i.id)::numeric / (SELECT COUNT(*) FROM interviews)) * 100, 2) AS percentage_of_total,
    COUNT(CASE WHEN i.malpractice_flag = TRUE THEN 1 END) AS flagged_for_malpractice
FROM interviews i
GROUP BY i.ai_assistance_risk
ORDER BY 
    CASE i.ai_assistance_risk
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MODERATE' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
    END;

-- ---------------------------------------------------------------------
-- QUERY 12: Proctoring Incident Frequency Breakdown
-- ---------------------------------------------------------------------
SELECT 
    pe.event_type,
    pe.severity,
    COUNT(pe.id) AS incident_count,
    COUNT(DISTINCT pe.interview_id) AS affected_interviews,
    COUNT(CASE WHEN pe.warning_issued = TRUE THEN 1 END) AS warnings_issued
FROM proctoring_events pe
GROUP BY pe.event_type, pe.severity
ORDER BY incident_count DESC;

-- ---------------------------------------------------------------------
-- QUERY 13: Recruiter Decision Pipeline Metrics
-- ---------------------------------------------------------------------
SELECT 
    COALESCE(rd.decision, 'NOT_REVIEWED') AS decision_stage,
    COUNT(i.id) AS candidate_count,
    ROUND((COUNT(i.id)::numeric / (SELECT COUNT(*) FROM interviews WHERE status = 'COMPLETED')) * 100, 2) AS conversion_percentage
FROM interviews i
LEFT JOIN recruiter_decisions rd ON i.id = rd.interview_id
WHERE i.status = 'COMPLETED'
GROUP BY rd.decision
ORDER BY candidate_count DESC;
