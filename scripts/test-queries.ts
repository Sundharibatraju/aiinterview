import { postgresService } from '../server/db/postgresEngine.js';

async function main() {
  console.log('Testing Postgres Execution Engine...');
  try {
    await postgresService.initialize();

    console.log('\n--- 1. Querying Users ---');
    const users = postgresService.query('SELECT id, full_name, email, role, account_status FROM users;');
    console.table(users);

    console.log('\n--- 2. Querying Jobs ---');
    const jobs = postgresService.query('SELECT id, title, job_code, status, minimum_package, maximum_package FROM jobs;');
    console.table(jobs);

    console.log('\n--- 3. Querying Applications per Job ---');
    const apps = postgresService.query(`
      SELECT 
        j.job_code,
        j.title,
        COUNT(ja.id) as total_applications
      FROM jobs j
      LEFT JOIN job_applications ja ON j.id = ja.job_id
      GROUP BY j.id, j.job_code, j.title;
    `);
    console.table(apps);

    console.log('\n--- 4. Querying Shortlisted Candidates ---');
    const shortlisted = postgresService.query(`
      SELECT 
        u.full_name,
        u.email,
        j.title as job_title,
        rd.decision,
        rd.notes
      FROM recruiter_decisions rd
      JOIN interviews i ON rd.interview_id = i.id
      JOIN candidate_profiles cp ON i.candidate_id = cp.id
      JOIN users u ON cp.user_id = u.id
      JOIN jobs j ON i.job_id = j.id
      WHERE rd.decision = 'SHORTLIST';
    `);
    console.table(shortlisted);

    console.log('\nAll queries executed with 100% success!');
  } catch (err) {
    console.error('Error testing queries:', err);
    process.exit(1);
  }
}

main();
