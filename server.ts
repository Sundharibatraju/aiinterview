import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import { db } from './server/db.js';
import { emailService } from './server/email.js';
import { interviewOrchestrator } from './server/interviewController.js';
import {
  UserRole,
  JobStatus,
  WorkMode,
  EmploymentType,
  ApplicationStatus,
  InterviewStatus,
  ProctoringEventType,
  PipelineRound,
  RoundType,
  Job,
  RoundProgressionRecord,
  RoundStatus,
  CandidateReceivedEmail,
  QuestionDifficulty,
  AssessmentQuestion,
  AssessmentSubmission,
  TechnicalAssessment,
  AtsEvaluationDetails,
} from './src/types/index.js';
import { postgresService } from './server/db/postgresEngine.js';
import { neonService, getNeonPool } from './server/db/neonService.js';
import { PREDEFINED_QUERIES } from './server/predefinedQueries.js';
import multer from 'multer';
import { geminiService } from './server/gemini.js';
import { recruiterRouter } from './server/recruiterRoutes.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PORT = 3000;

// Non-JWT Session Token Generator
function generateToken(user: { id: string; email: string; role: string }): string {
  const session = db.createSession(user.id, user.email, user.role);
  return session.token;
}

// Session Authentication Middleware (Replaces JWT Verification)
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Validate active session token from persistent database store
  const session = db.findSessionByToken(token);
  if (session) {
    req.user = {
      id: session.userId,
      email: session.email,
      role: session.role,
    };
    return next();
  }

  // 2. Direct user fallback for demo/seed identities
  const directUser = db.findUserById(token);
  if (directUser) {
    req.user = {
      id: directUser.id,
      email: directUser.email,
      role: directUser.role,
    };
    return next();
  }

  return res.status(401).json({ error: 'Invalid or expired session token' });
}

async function startServer() {
  // Connect to persistent PostgreSQL/Neon database if DATABASE_URL secret is provided
  const dbUrl = (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  if (dbUrl) {
    neonService.init().catch(err => {
      console.warn('[Neon Database] Connection attempt warning:', err.message);
    });
  }

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ==========================================
  // 1. AUTHENTICATION ROUTES
  // ==========================================

  // Candidate Registration
  app.post('/api/auth/register-candidate', async (req, res) => {
    try {
      const { fullName, email, password, confirmPassword } = req.body;

      if (!fullName || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Confirm password does not match password.' });
      }

      // Password rules: min 8, uppercase, lowercase, number, special char
      const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+={}[\]:;"'<>,.?/\\|`~]).{8,}$/;
      if (!passRegex.test(password)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
        });
      }

      // Duplicate email rule: exactly one account per email
      const cleanEmail = email.toLowerCase().trim();
      const existing = db.findUserByEmail(cleanEmail);
      if (existing) {
        if (existing.role === UserRole.CANDIDATE) {
          return res.status(400).json({
            error: 'An account with this email already exists. Please log in instead.',
            isRegistered: true,
            isGoogleAccount: Boolean(existing.googleId),
          });
        }
        // Account exists as recruiter/admin; update to candidate so candidate registration succeeds
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);
        db.updateUser(existing.id, {
          role: UserRole.CANDIDATE,
          fullName: fullName.trim(),
          passwordHash,
          isVerified: false,
        });
        db.setCandidateProfile({
          id: existing.id,
          userId: existing.id,
          skills: ['Software Engineering', 'Problem Solving'],
        });
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        db.createOtp(existing.email, otp, existing.id);
        await emailService.sendOtpEmail(existing.email, otp, fullName.trim());

        return res.json({
          success: true,
          message: 'Registration initiated. Verification code has been sent to your email.',
          email: existing.email,
          requiresOtp: true,
        });
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);
      const userId = crypto.randomUUID();

      const newUser = db.createUser({
        id: userId,
        email: cleanEmail,
        passwordHash,
        fullName: fullName.trim(),
        role: UserRole.CANDIDATE,
        isVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Default candidate profile
      db.setCandidateProfile({
        id: userId,
        userId: newUser.id,
        skills: ['Software Engineering', 'Problem Solving'],
      });

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      db.createOtp(newUser.email, otp, newUser.id);

      // Dispatch verification email
      await emailService.sendOtpEmail(newUser.email, otp, newUser.fullName);

      return res.json({
        success: true,
        message: 'Registration initiated. Verification code has been sent to your email.',
        email: newUser.email,
        requiresOtp: true,
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      return res.status(500).json({ error: err.message || 'Registration failed' });
    }
  });

  // Verify OTP (supports both /api/auth/verify-email-otp and /api/auth/verify-otp)
  const verifyOtpHandler = async (req: any, res: any) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required.' });
      }

      const result = db.verifyOtp(email, otp);
      if (!result.valid) {
        return res.status(400).json({ error: result.message });
      }

      const user = db.findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      db.updateUser(user.id, { isVerified: true });
      const updatedUser = { ...user, isVerified: true };
      const token = generateToken(updatedUser);

      return res.json({
        success: true,
        message: 'Email verified successfully. Welcome to AI Interviewer.',
        token,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          role: updatedUser.role,
          isVerified: true,
        },
      });
    } catch (err: any) {
      console.error('OTP Verification error:', err);
      return res.status(500).json({ error: 'Verification failed' });
    }
  };

  app.post('/api/auth/verify-email-otp', verifyOtpHandler);
  app.post('/api/auth/verify-otp', verifyOtpHandler);

  // Resend OTP
  app.post('/api/auth/resend-otp', async (req, res) => {
    try {
      const { email, role } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const cleanEmail = email.toLowerCase().trim();
      const user = db.findUserByEmail(cleanEmail);
      if (!user) {
        return res.status(404).json({
          error: role === 'RECRUITER'
            ? 'No recruiter account is registered with this account. Please register first.'
            : 'No candidate account is registered with this account. Please register first.',
        });
      }

      if (role === 'CANDIDATE' && user.role !== UserRole.CANDIDATE) {
        return res.status(404).json({
          error: 'No candidate account is registered with this account. Please register first.',
        });
      }

      if (role === 'RECRUITER' && user.role !== UserRole.RECRUITER && user.role !== UserRole.ADMIN) {
        return res.status(404).json({
          error: 'No recruiter account is registered with this account. Please register first.',
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      db.createOtp(user.email, otp, user.id);
      await emailService.sendOtpEmail(user.email, otp, user.fullName);

      return res.json({ success: true, message: 'New verification code dispatched to your email.' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to resend code' });
    }
  });

  // Candidate Login
  app.post('/api/auth/login-candidate', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const user = db.findUserByEmail(cleanEmail);
      // If user does not exist OR is not a candidate -> throw explicit error
      if (!user || user.role !== UserRole.CANDIDATE) {
        return res.status(404).json({
          error: 'No candidate account is registered with this account. Please register first.',
        });
      }

      // If registered but email not verified -> "Email Verification Required."
      if (!user.isVerified) {
        // Send fresh OTP automatically
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        db.createOtp(user.email, otp, user.id);
        await emailService.sendOtpEmail(user.email, otp, user.fullName);

        return res.status(403).json({
          error: 'Email Verification Required.',
          requiresVerification: true,
          email: user.email,
        });
      }

      if (!user.passwordHash || user.passwordHash === 'N/A' || !bcrypt.compareSync(password, user.passwordHash)) {
        if (user.googleId && (!user.passwordHash || user.passwordHash === 'N/A')) {
          return res.status(401).json({
            error: 'This account was registered with Google. Please click "Continue with Google" or reset your password using "Forgot password?".',
          });
        }
        return res.status(401).json({ error: 'Invalid Credentials.' });
      }

      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isVerified: user.isVerified,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Login error' });
    }
  });

  // Google OAuth Client Configuration
  app.get('/api/auth/google-config', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
    return res.json({ clientId });
  });

  // Google OAuth / Continue with Google
  app.post('/api/auth/google', async (req, res) => {
    try {
      const { email, fullName, googleId, role, companyName, designation, avatarUrl } = req.body;
      if (!email) return res.status(400).json({ error: 'Google email required' });

      const cleanEmail = email.toLowerCase().trim();
      let user = db.findUserByEmail(cleanEmail);
      const targetRole = role === UserRole.RECRUITER ? UserRole.RECRUITER : UserRole.CANDIDATE;
      const { action } = req.body;

      // Handle LOGIN action specifically
      if (action === 'login') {
        if (targetRole === UserRole.CANDIDATE) {
          if (!user || user.role !== UserRole.CANDIDATE) {
            return res.status(404).json({
              error: 'No candidate account is registered with this account. Please register first.',
            });
          }
        } else if (targetRole === UserRole.RECRUITER) {
          if (!user || (user.role !== UserRole.RECRUITER && user.role !== UserRole.ADMIN)) {
            return res.status(404).json({
              error: 'No recruiter account is registered with this account. Please register first.',
            });
          }
        }
      }

      if (user) {
        // If action is explicitly register, check if account with same role already exists
        if (action === 'register') {
          if (targetRole === UserRole.CANDIDATE && user.role === UserRole.CANDIDATE) {
            return res.status(400).json({
              error: 'An account with this Google email already exists. Please log in instead.',
            });
          }
          if (targetRole === UserRole.RECRUITER && (user.role === UserRole.RECRUITER || user.role === UserRole.ADMIN)) {
            return res.status(400).json({
              error: 'An account with this Google email already exists. Please log in instead.',
            });
          }

          // Transition user to requested target role so registration succeeds
          if (targetRole === UserRole.CANDIDATE) {
            db.updateUser(user.id, { role: UserRole.CANDIDATE, isVerified: true });
            db.setCandidateProfile({
              id: user.id,
              userId: user.id,
              skills: ['Software Engineering', 'Problem Solving'],
            });
            user = db.findUserById(user.id) || { ...user, role: UserRole.CANDIDATE };
          } else {
            db.updateUser(user.id, { role: UserRole.RECRUITER, isVerified: true });
            user = db.findUserById(user.id) || { ...user, role: UserRole.RECRUITER };
          }
        }

        // Link google ID, ensure verified status, and update profile photo & name if available
        const gId = googleId || user.googleId || 'goog_' + Date.now();
        const updates: any = { googleId: gId, isVerified: true };
        if (avatarUrl) updates.avatarUrl = avatarUrl;
        if (fullName && (!user.fullName || user.fullName === user.email.split('@')[0])) {
          updates.fullName = fullName;
        }
        
        // Ensure default password Password123! is available for fallback password login
        if (!user.passwordHash) {
          const defaultSalt = bcrypt.genSaltSync(10);
          updates.passwordHash = bcrypt.hashSync('Password123!', defaultSalt);
        }
        
        db.updateUser(user.id, updates);
        user = { ...user, ...updates };
      } else {
        // Create new verified user directly via Google with default password Password123!
        const userId = crypto.randomUUID();
        const gId = googleId || 'goog_' + Date.now();
        const defaultSalt = bcrypt.genSaltSync(10);
        const defaultPasswordHash = bcrypt.hashSync('Password123!', defaultSalt);

        user = db.createUser({
          id: userId,
          email: cleanEmail,
          passwordHash: defaultPasswordHash,
          fullName: fullName || cleanEmail.split('@')[0],
          role: targetRole,
          isVerified: true,
          googleId: gId,
          avatarUrl: avatarUrl || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Dispatch confirmation welcome email via SMTP in background
        emailService.sendGoogleWelcomeEmail(cleanEmail, user.fullName, 'Password123!').catch(() => {});

        if (targetRole === UserRole.RECRUITER) {
          const compName = companyName || `${user.fullName}'s Organization`;
          let comp = db.getCompanies().find(c => c.name.toLowerCase() === compName.toLowerCase());
          if (!comp) {
            comp = db.createCompany({
              id: crypto.randomUUID(),
              name: compName,
              industry: 'Technology & Enterprise',
              description: `${compName} enterprise division`,
              location: 'Remote / Global',
            });
          }
          if (!db.data.recruiters) db.data.recruiters = [];
          db.data.recruiters.push({
            id: crypto.randomUUID(),
            userId: user.id,
            companyId: comp.id,
            designation: designation || 'Talent Acquisition Lead',
          });
          db.saveDatabase();
        } else {
          db.setCandidateProfile({
            id: userId,
            userId: user.id,
            skills: ['Software Engineering', 'Problem Solving'],
          });
        }
      }

      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isVerified: true,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (err: any) {
      console.error('Google auth error:', err);
      return res.status(500).json({ error: 'Google sign-in error' });
    }
  });

  // Forgot Password: Request OTP via SMTP
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email, role } = req.body;
      if (!email) return res.status(400).json({ error: 'Email address is required' });

      const cleanEmail = email.toLowerCase().trim();
      const user = db.findUserByEmail(cleanEmail);
      if (!user) {
        return res.status(404).json({
          error: role === 'RECRUITER'
            ? 'No recruiter account is registered with this account.'
            : 'No candidate account is registered with this account.',
        });
      }

      if (role === 'CANDIDATE' && user.role !== UserRole.CANDIDATE) {
        return res.status(404).json({
          error: 'No candidate account is registered with this account.',
        });
      }

      if (role === 'RECRUITER' && user.role !== UserRole.RECRUITER && user.role !== UserRole.ADMIN) {
        return res.status(404).json({
          error: 'No recruiter account is registered with this account.',
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      db.createOtp(user.email, otp, user.id, 'RESET_PASSWORD');
      await emailService.sendPasswordResetOtpEmail(user.email, otp, user.fullName);

      return res.json({
        success: true,
        message: 'Password reset verification code has been dispatched to your email.',
      });
    } catch (err: any) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ error: 'Failed to initiate password reset' });
    }
  });

  // Reset Password: Verify OTP and save hashed password
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, otp, newPassword, confirmPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: 'Email, OTP, and new password are required' });
      }

      if (confirmPassword && newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const verification = db.verifyResetPasswordOtp(cleanEmail, otp.trim());
      if (!verification.valid) {
        return res.status(400).json({ error: verification.message });
      }

      const user = db.findUserByEmail(cleanEmail);
      if (!user) {
        return res.status(404).json({ error: 'User account not found.' });
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(newPassword, salt);
      db.updateUser(user.id, { passwordHash });

      return res.json({
        success: true,
        message: 'Your password has been successfully reset. Please log in with your new password.',
      });
    } catch (err: any) {
      console.error('Reset password error:', err);
      return res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Recruiter Login
  app.post('/api/auth/login-recruiter', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const cleanEmail = email.toLowerCase().trim();
      const user = db.findUserByEmail(cleanEmail);
      if (!user || (user.role !== UserRole.RECRUITER && user.role !== UserRole.ADMIN)) {
        return res.status(404).json({
          error: 'No recruiter account is registered with this account. Please register first.',
        });
      }

      if (!user.passwordHash || user.passwordHash === 'N/A' || !bcrypt.compareSync(password, user.passwordHash)) {
        if (user.googleId && (!user.passwordHash || user.passwordHash === 'N/A')) {
          return res.status(401).json({
            error: 'This recruiter account was registered with Google. Please click "Continue with Google" or reset your password using "Forgot password?".',
          });
        }
        return res.status(401).json({ error: 'Invalid recruiter credentials.' });
      }

      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isVerified: user.isVerified,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Recruiter login failed' });
    }
  });

  // Recruiter Register
  app.post('/api/auth/register-recruiter', async (req, res) => {
    try {
      const { fullName, email, password, companyName, designation } = req.body;
      if (!fullName || !email || !password || !companyName) {
        return res.status(400).json({ error: 'Full name, email, password, and company name are required.' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const existing = db.findUserByEmail(cleanEmail);
      if (existing) {
        if (existing.role === UserRole.RECRUITER || existing.role === UserRole.ADMIN) {
          return res.status(400).json({ error: 'An account with this email already exists. Please log in instead.' });
        }
        // If account was candidate, allow transition to recruiter
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        const company = db.createCompany({
          id: crypto.randomUUID(),
          name: companyName,
          industry: 'Technology & Enterprise Software',
          description: `${companyName} talent acquisition portal`,
          location: 'Global / Remote',
        });

        db.updateUser(existing.id, {
          role: UserRole.RECRUITER,
          fullName: fullName.trim(),
          passwordHash,
          isVerified: true,
        });

        if (!db.data.recruiters) db.data.recruiters = [];
        db.data.recruiters.push({
          id: crypto.randomUUID(),
          userId: existing.id,
          companyId: company.id,
          designation: designation || 'Talent Acquisition Lead',
        });
        db.saveDatabase();

        const token = generateToken(existing);
        return res.json({
          success: true,
          token,
          user: {
            id: existing.id,
            email: existing.email,
            fullName: fullName.trim(),
            role: UserRole.RECRUITER,
            companyId: company.id,
            isVerified: true,
          },
        });
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      // Create company
      const company = db.createCompany({
        id: crypto.randomUUID(),
        name: companyName,
        industry: 'Technology & Enterprise Software',
        description: `${companyName} talent acquisition portal`,
        location: 'Global / Remote',
      });

      // Create recruiter user
      const user = db.createUser({
        id: crypto.randomUUID(),
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName: fullName.trim(),
        role: UserRole.RECRUITER,
        isVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          companyId: company.id,
          isVerified: true,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Recruiter registration failed' });
    }
  });

  // Logout session
  app.post('/api/auth/logout', (req: any, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      db.deleteSession(token);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  });

  // Get current user profile
  app.get('/api/auth/me', authMiddleware, (req: any, res) => {
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const profile = db.getCandidateProfile(user.id);
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,
      },
      profile,
    });
  });

  // Update candidate profile
  app.post('/api/candidate/profile', authMiddleware, (req: any, res) => {
    try {
      const { phone, location, education, experienceYears, skills, resumeText, resumeFileName, bio, educationDetails, projects } = req.body;
      const updated = db.setCandidateProfile({
        userId: req.user.id,
        phone,
        location,
        education,
        experienceYears: Number(experienceYears) || 0,
        skills: Array.isArray(skills) ? skills : (skills || '').split(',').map((s: string) => s.trim()).filter(Boolean),
        resumeText,
        resumeFileName,
        bio,
        educationDetails,
        projects: Array.isArray(projects) ? projects : (projects ? [projects] : []),
      });
      return res.json({ success: true, profile: updated });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Candidate: Upload Resume (PDF / DOCX / TXT) and run AI extraction
  app.post('/api/candidate/upload-resume', authMiddleware, upload.single('resume'), async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.CANDIDATE) {
        return res.status(403).json({ error: 'Candidate role required for resume upload.' });
      }

      const file = req.file;
      let resumeText = req.body.resumeText || '';
      const fileName = file ? file.originalname : (req.body.fileName || 'Resume.pdf');

      if (file && file.buffer) {
        const bufferStr = file.buffer.toString('utf-8');
        const cleanedText = bufferStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ');
        if (cleanedText.length > 20) {
          resumeText = cleanedText;
        } else {
          resumeText = `Uploaded document: ${fileName}`;
        }
      }

      // Analyze with AI
      const analysis = await geminiService.analyzeResume(resumeText, fileName);

      // Save to candidate profile
      const existingProfile = db.getCandidateProfile(req.user.id) || { id: req.user.id, userId: req.user.id, skills: [] };
      const updatedProfile = {
        ...existingProfile,
        resumeFileName: fileName,
        resumeText: resumeText.substring(0, 15000),
        skills: Array.from(new Set([...(existingProfile.skills || []), ...(analysis.skills || [])])),
        education: analysis.education || existingProfile.education || "Bachelor's Degree in Computer Science",
        experienceYears: analysis.experienceYears ?? existingProfile.experienceYears ?? 1,
        projects: analysis.projects || existingProfile.projects || [],
        bio: analysis.bio || existingProfile.bio,
        extractedProfile: analysis,
      };

      db.setCandidateProfile(updatedProfile);

      return res.json({
        success: true,
        message: 'Resume parsed and profile enriched successfully.',
        profile: updatedProfile,
        analysis,
      });
    } catch (err: any) {
      console.error('Resume upload error:', err);
      return res.status(500).json({ error: 'Failed to process resume upload' });
    }
  });

  // ==========================================
  // 2. JOBS & OPPORTUNITIES ROUTES
  // ==========================================

  // Helper: Default 4-stage recruitment pipeline (HR round completely removed)
  function getDefaultPipelineRounds(jobTitle: string = 'Software Engineer'): PipelineRound[] {
    return [
      {
        roundNumber: 1,
        name: 'Resume Screening',
        roundType: RoundType.RESUME_SCREENING,
        description: 'Automated ATS evaluation against eligibility criteria, qualifications, technical stack, and required certifications.',
        minQualifyingScore: 65,
        evaluationCriteria: ['Degree & Marks Eligibility', 'Core Technical Stack Match', 'Required Certifications', 'Project Relevance'],
        instructions: 'Upload an updated resume. The system assesses alignment with required skills and criteria.',
        eligibilityCondition: 'Graduation in CS/IT/Engineering or relevant technical discipline with minimum 60% or 6.5 CGPA',
      },
      {
        roundNumber: 2,
        name: 'Technical Assessment',
        roundType: RoundType.TECHNICAL_ASSESSMENT,
        description: 'Core technical aptitude, foundational algorithmic concepts, and system architecture assessment.',
        minQualifyingScore: 70,
        evaluationCriteria: ['Algorithmic Efficiency', 'Data Structure Selection', 'Database Indexing', 'API Design'],
        instructions: 'Complete technical assessment covering language fundamentals and system architecture.',
        eligibilityCondition: 'Must have successfully passed Round 1 Resume Screening with minimum 65% score',
      },
      {
        roundNumber: 3,
        name: 'AI Technical Interview',
        roundType: RoundType.AI_INTERVIEW,
        description: 'Real-time AI voice technical interview with recruiter-defined focus topics, priority questions, and dynamic follow-up evaluations.',
        minQualifyingScore: 70,
        evaluationCriteria: ['Problem Solving Depth', 'Code & Concurrency Reasoning', 'System Scalability', 'Priority Topic Mastery'],
        instructions: 'Spoken technical interview. Candidate will answer technical, scenario, and resume-based questions.',
        eligibilityCondition: 'Must have cleared Round 2 Technical Assessment with minimum 70% score',
      },
      {
        roundNumber: 4,
        name: 'Final Review & Selection',
        roundType: RoundType.FINAL_REVIEW,
        description: 'Consolidated performance audit across all evaluation rounds, executive signoff, and offer release.',
        minQualifyingScore: 75,
        evaluationCriteria: ['Composite Score Across Rounds', 'Department & Role Fit', 'Background Verification'],
        instructions: 'Hiring committee final review and employment offer rollout.',
        eligibilityCondition: 'Passed all previous evaluation rounds',
      },
    ];
  }

  // List all active jobs
  app.get('/api/jobs', (req, res) => {
    try {
      const jobs = db.getJobs().filter(j => j.status === JobStatus.ACTIVE).map(job => {
        if (!job.rounds || job.rounds.length === 0) {
          job.rounds = getDefaultPipelineRounds(job.title);
        }
        if (!job.interviewConfig) {
          job.interviewConfig = {
            customQuestions: [],
            targetFocusTopics: job.requiredSkills || [],
            maxDurationMinutes: job.durationMinutes || 20,
            numQuestions: job.numQuestions || 5,
            evaluationExpectations: 'In-depth architectural understanding, edge cases, and practical trade-offs.',
          };
        }
        return job;
      });
      return res.json(jobs);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });

  // Get specific job detail
  app.get('/api/jobs/:id', (req, res) => {
    try {
      const job = db.getJobById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (!job.rounds || job.rounds.length === 0) {
        job.rounds = getDefaultPipelineRounds(job.title);
      }
      if (!job.interviewConfig) {
        job.interviewConfig = {
          customQuestions: [],
          targetFocusTopics: job.requiredSkills || [],
          maxDurationMinutes: job.durationMinutes || 20,
          numQuestions: job.numQuestions || 5,
          evaluationExpectations: 'In-depth architectural understanding, edge cases, and practical trade-offs.',
        };
      }
      return res.json(job);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error retrieving job' });
    }
  });

  // Helper to build high-standard technical assessment questions (MCQs & coding challenges with test cases)
  const buildDefaultAssessmentQuestions = (jobTitle: string, skills: string[]): AssessmentQuestion[] => {
    const primarySkill = skills && skills.length > 0 ? skills[0] : 'Computer Science';
    const secondarySkill = skills && skills.length > 1 ? skills[1] : 'Software Engineering';

    return [
      {
        id: 'q_mcq_' + Math.random().toString(36).substring(2, 8),
        questionText: `In modern ${primarySkill} architectures, what is the primary computational benefit of utilizing indexed data structures (such as B-Trees or Hash Indexes)?`,
        type: 'MULTIPLE_CHOICE',
        options: [
          'Reduces average query lookup time complexity from O(n) to O(1) or O(log n)',
          'Permanently eliminates all disk I/O latency across distributed clusters',
          'Prevents any garbage collection pauses from occurring in memory management',
          'Forces asynchronous database promises into synchronous blocking executions',
        ],
        correctOptionIndex: 0,
        marks: 10,
        skillsTested: [primarySkill, 'Data Structures'],
      },
      {
        id: 'q_mcq_' + Math.random().toString(36).substring(2, 8),
        questionText: `When implementing a resilient distributed service in ${secondarySkill}, which architectural pattern prevents cascading failures when downstream microservices experience degradation or timeouts?`,
        type: 'MULTIPLE_CHOICE',
        options: [
          'Unbounded Spin-lock Busy Waiting',
          'Circuit Breaker Pattern with Graceful Degradation and Fallbacks',
          'Synchronous Recursive Retry Loops without Jitter',
          'Hard Thread-pool Termination on HTTP 400 Responses',
        ],
        correctOptionIndex: 1,
        marks: 10,
        skillsTested: [secondarySkill, 'System Design'],
      },
      {
        id: 'q_mcq_' + Math.random().toString(36).substring(2, 8),
        questionText: 'Which HTTP status code is the standard semantic response indicating that a client has exceeded their rate limit quota?',
        type: 'MULTIPLE_CHOICE',
        options: [
          '400 Bad Request',
          '404 Not Found',
          '429 Too Many Requests',
          '503 Service Unavailable',
        ],
        correctOptionIndex: 2,
        marks: 10,
        skillsTested: ['Web APIs & Microservices'],
      },
      {
        id: 'q_code_' + Math.random().toString(36).substring(2, 8),
        questionText: 'Implement a function findFirstNonRepeating(str: string): string | null that returns the first character in the given string that does not repeat. If all characters repeat or the string is empty, return null.',
        type: 'CODING',
        marks: 20,
        skillsTested: ['Algorithms', 'String Manipulation', 'Problem Solving'],
        codingLanguage: 'javascript',
        codingTemplate: `function findFirstNonRepeating(str) {\n  // Count frequency of each character and find the first with frequency === 1\n  const freq = {};\n  for (const ch of str) {\n    freq[ch] = (freq[ch] || 0) + 1;\n  }\n  for (const ch of str) {\n    if (freq[ch] === 1) return ch;\n  }\n  return null;\n}`,
        sampleInput: '"swiss"',
        sampleOutput: '"w"',
        testCases: [
          { input: '"swiss"', expectedOutput: '"w"', isHidden: false, explanation: '"w" is the first character that only appears once.' },
          { input: '"aabbcc"', expectedOutput: 'null', isHidden: false, explanation: 'All characters are repeated.' },
          { input: '"developer"', expectedOutput: '"d"', isHidden: true, explanation: 'Hidden test case for automated validation.' },
        ],
      },
    ];
  };

  // Recruiter: Post new opportunity
  app.post('/api/jobs', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required to publish opportunities' });
      }

      const {
        companyName,
        title,
        description,
        openings,
        salaryPackage,
        registrationClosingDate,
        eligibilityCriteria,
        requiredSkills,
        requiredCertifications,
        preferredSkills,
        qualification,
        experience,
        experienceRequirements,
        location,
        workMode,
        employmentType,
        minPackage,
        maxPackage,
        currency,
        deadline,
        durationMinutes,
        numQuestions,
        numTechnicalQuestions,
        numCodingQuestions,
        numMcqQuestions,
        technicalAssessmentQuestions,
        interviewSettings,
        additionalInformation,
        authenticityNoticeVerified,
        rounds,
        interviewConfig,
        interviewStartDate,
        interviewStartTime,
        interviewEndDate,
        interviewEndTime,
      } = req.body;

      if (!title || !description || !requiredSkills || !companyName) {
        return res.status(400).json({ error: 'Title, company name, description, and required skills are mandatory.' });
      }

      // Check or create company
      let comp = db.getCompanies().find(c => c.name.toLowerCase() === companyName.toLowerCase().trim());
      if (!comp) {
        comp = db.createCompany({
          id: crypto.randomUUID(),
          name: companyName,
          industry: 'Technology & Engineering',
          description: `${companyName} engineering department`,
          location: location || 'Remote',
        });
      }

      const reqSkillsArray = Array.isArray(requiredSkills)
        ? requiredSkills
        : (requiredSkills || '').split(',').map((s: string) => s.trim()).filter(Boolean);

      const prefSkillsArray = Array.isArray(preferredSkills)
        ? preferredSkills
        : (preferredSkills || '').split(',').map((s: string) => s.trim()).filter(Boolean);

      const reqCertsArray = Array.isArray(requiredCertifications)
        ? requiredCertifications
        : (requiredCertifications || '').split(',').map((s: string) => s.trim()).filter(Boolean);

      const pipelineRounds = rounds && Array.isArray(rounds) && rounds.length > 0
        ? rounds
        : getDefaultPipelineRounds(title);

      const config = interviewConfig || {
        customQuestions: interviewSettings?.recruiterQuestions || [],
        targetFocusTopics: interviewSettings?.targetTopics || reqSkillsArray,
        maxDurationMinutes: Number(interviewSettings?.durationMinutes || durationMinutes) || 20,
        numQuestions: Number(interviewSettings?.totalQuestions || numQuestions) || 5,
        numTechnicalQuestions: numTechnicalQuestions ? Number(numTechnicalQuestions) : undefined,
        numCodingQuestions: numCodingQuestions ? Number(numCodingQuestions) : undefined,
        numMcqQuestions: numMcqQuestions ? Number(numMcqQuestions) : undefined,
        evaluationExpectations: 'In-depth architectural understanding, edge cases, and practical trade-offs.',
      };

      const newJob = await db.createJobAsync({
        id: crypto.randomUUID(),
        companyId: comp.id,
        recruiterId: req.user.id,
        title: title.trim(),
        description: description.trim(),
        openings: Number(openings) || 1,
        salaryPackage: salaryPackage || `${currency || 'INR'} ${(Number(minPackage || 600000) / 100000).toFixed(1)}L - ${(Number(maxPackage || 1200000) / 100000).toFixed(1)}L PA`,
        registrationClosingDate: registrationClosingDate || deadline || new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
        eligibilityCriteria: eligibilityCriteria || "Bachelor's Degree in Computer Science, Engineering or related technical field with minimum 60% aggregate.",
        requiredSkills: reqSkillsArray,
        requiredCertifications: reqCertsArray,
        preferredSkills: prefSkillsArray,
        qualification: qualification || "Bachelor's Degree in Computer Science or equivalent",
        experience: experience || '1-3 Years',
        experienceRequirements: experienceRequirements || experience || 'Minimum 1-3 years of proven hands-on software development experience',
        location: location || 'Remote',
        workMode: workMode || WorkMode.HYBRID,
        employmentType: employmentType || EmploymentType.FULL_TIME,
        minPackage: Number(minPackage) || 600000,
        maxPackage: Number(maxPackage) || 1200000,
        currency: currency || 'INR',
        deadline: deadline || new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
        durationMinutes: Number(durationMinutes) || 20,
        numQuestions: Number(numQuestions) || 5,
        numTechnicalQuestions: numTechnicalQuestions ? Number(numTechnicalQuestions) : undefined,
        numCodingQuestions: numCodingQuestions ? Number(numCodingQuestions) : undefined,
        numMcqQuestions: numMcqQuestions ? Number(numMcqQuestions) : undefined,
        status: JobStatus.ACTIVE,
        createdAt: new Date().toISOString(),
        additionalInformation: additionalInformation || '',
        authenticityNoticeVerified: Boolean(authenticityNoticeVerified),
        technicalAssessmentQuestions: Array.isArray(technicalAssessmentQuestions) ? technicalAssessmentQuestions : undefined,
        rounds: pipelineRounds,
        interviewConfig: config,
        company: comp,
        interviewStartDate,
        interviewStartTime,
        interviewEndDate,
        interviewEndTime,
      });

      // Ensure technical assessment questions (MCQs & Coding with test cases) are published to assessments table in Neon DB
      const finalQuestions = Array.isArray(technicalAssessmentQuestions) && technicalAssessmentQuestions.length > 0
        ? technicalAssessmentQuestions
        : buildDefaultAssessmentQuestions(title, reqSkillsArray);

      try {
        db.createAssessment({
          id: 'asmt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          jobId: newJob.id,
          companyId: comp.id,
          recruiterId: req.user.id,
          title: `${title} - Technical Assessment`,
          description: `Technical assessment featuring ${finalQuestions.length} manual questions (MCQs & Coding with test cases).`,
          durationMinutes: 45,
          passingScore: 70,
          difficulty: QuestionDifficulty.MEDIUM,
          skillsTested: reqSkillsArray.length > 0 ? reqSkillsArray : ['Computer Science', 'Problem Solving'],
          questions: finalQuestions,
          technicalAssessmentCode: newJob.technicalAssessmentCode,
          negativeMarking: false,
          randomization: true,
          attemptLimit: 1,
          antiCheatingEnabled: true,
          isPublished: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (asmtErr) {
        console.warn('Failed to auto-create technical assessment for job:', asmtErr);
      }

      return res.json({ success: true, job: newJob });
    } catch (err: any) {
      console.error('Create job error:', err);
      return res.status(500).json({ error: 'Failed to publish opportunity' });
    }
  });

  // Recruiter: Update Pipeline Rounds & Interview Configuration
  app.put('/api/jobs/:id/pipeline', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required to modify interview pipeline' });
      }

      const jobId = req.params.id;
      const job = db.getJobById(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { rounds, interviewConfig } = req.body;

      const updates: Partial<Job> = {};
      if (rounds && Array.isArray(rounds)) {
        updates.rounds = rounds;
      }
      if (interviewConfig) {
        updates.interviewConfig = interviewConfig;
        if (interviewConfig.numQuestions) {
          updates.numQuestions = interviewConfig.numQuestions;
        }
        if (interviewConfig.maxDurationMinutes) {
          updates.durationMinutes = interviewConfig.maxDurationMinutes;
        }
      }

      const updated = await db.updateJobAsync(jobId, updates);
      return res.json({ success: true, job: updated });
    } catch (err: any) {
      console.error('Update pipeline error:', err);
      return res.status(500).json({ error: 'Failed to update job pipeline' });
    }
  });

  // Recruiter: Update Full Job Posting (Details, Rounds, Technical Assessment Questions)
  const handleUpdateJobPosting = async (req: any, res: any) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required to update job' });
      }

      const jobId = req.params.id;
      const job = db.getJobById(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const {
        title,
        description,
        openings,
        salaryPackage,
        requiredSkills,
        preferredSkills,
        requiredCertifications,
        qualification,
        experience,
        location,
        workMode,
        employmentType,
        minPackage,
        maxPackage,
        currency,
        deadline,
        durationMinutes,
        numQuestions,
        numTechnicalQuestions,
        numCodingQuestions,
        numMcqQuestions,
        status,
        rounds,
        interviewConfig,
        technicalAssessmentQuestions,
      } = req.body;

      const updates: Partial<Job> = {
        updatedAt: new Date().toISOString(),
      };

      if (title) updates.title = title.trim();
      if (description) updates.description = description.trim();
      if (openings !== undefined) updates.openings = Number(openings);
      if (salaryPackage) updates.salaryPackage = salaryPackage;
      if (requiredSkills) {
        updates.requiredSkills = Array.isArray(requiredSkills)
          ? requiredSkills
          : String(requiredSkills).split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (preferredSkills) {
        updates.preferredSkills = Array.isArray(preferredSkills)
          ? preferredSkills
          : String(preferredSkills).split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (requiredCertifications) {
        updates.requiredCertifications = Array.isArray(requiredCertifications)
          ? requiredCertifications
          : String(requiredCertifications).split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (qualification) updates.qualification = qualification;
      if (experience) updates.experience = experience;
      if (location) updates.location = location;
      if (workMode) updates.workMode = workMode;
      if (employmentType) updates.employmentType = employmentType;
      if (minPackage !== undefined) updates.minPackage = Number(minPackage);
      if (maxPackage !== undefined) updates.maxPackage = Number(maxPackage);
      if (currency) updates.currency = currency;
      if (deadline) updates.deadline = deadline;
      if (durationMinutes !== undefined) updates.durationMinutes = Number(durationMinutes);
      if (numQuestions !== undefined) updates.numQuestions = Number(numQuestions);
      if (numTechnicalQuestions !== undefined) updates.numTechnicalQuestions = Number(numTechnicalQuestions);
      if (numCodingQuestions !== undefined) updates.numCodingQuestions = Number(numCodingQuestions);
      if (numMcqQuestions !== undefined) updates.numMcqQuestions = Number(numMcqQuestions);
      if (status) updates.status = status;
      if (rounds && Array.isArray(rounds)) updates.rounds = rounds;
      if (interviewConfig) updates.interviewConfig = interviewConfig;
      if (technicalAssessmentQuestions && Array.isArray(technicalAssessmentQuestions)) {
        updates.technicalAssessmentQuestions = technicalAssessmentQuestions;
      }

      const updated = await db.updateJobAsync(jobId, updates);

      // If recruiter provided manual technical assessment questions (MCQs / Coding with test cases), update or create assessment
      if (Array.isArray(technicalAssessmentQuestions) && technicalAssessmentQuestions.length > 0) {
        const existingAsmt = db.getAssessments().find(a => a.jobId === jobId);
        if (existingAsmt) {
          const updatedAsmt = db.updateAssessment(existingAsmt.id, {
            questions: technicalAssessmentQuestions,
            skillsTested: updates.requiredSkills || job.requiredSkills || [],
            updatedAt: new Date().toISOString(),
          });
          if (updatedAsmt) {
            await neonService.saveAssessment(updatedAsmt).catch(() => {});
          }
        } else {
          const newAsmt = db.createAssessment({
            id: 'asmt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            jobId,
            companyId: job.companyId,
            recruiterId: req.user.id,
            title: `${updated?.title || job.title} - Technical Assessment`,
            description: `Recruiter-configured technical assessment featuring ${technicalAssessmentQuestions.length} manual questions (MCQs & Coding with test cases).`,
            durationMinutes: 45,
            passingScore: 70,
            difficulty: QuestionDifficulty.MEDIUM,
            skillsTested: updates.requiredSkills || job.requiredSkills || ['Computer Science'],
            questions: technicalAssessmentQuestions,
            negativeMarking: false,
            randomization: true,
            attemptLimit: 1,
            antiCheatingEnabled: true,
            isPublished: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          await neonService.saveAssessment(newAsmt).catch(() => {});
        }
      }

      return res.json({ success: true, job: updated });
    } catch (err: any) {
      console.error('Update job error:', err);
      return res.status(500).json({ error: 'Failed to update job' });
    }
  };

  app.put('/api/jobs/:id', authMiddleware, handleUpdateJobPosting);
  app.patch('/api/jobs/:id', authMiddleware, handleUpdateJobPosting);

  // Recruiter: Delete Job Posting
  app.delete('/api/jobs/:id', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required to delete job' });
      }

      const jobId = req.params.id;
      const job = db.getJobById(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      // Delete associated assessments both locally and in Neon
      const asmts = db.getAssessments().filter(a => a.jobId === jobId);
      for (const a of asmts) {
        await db.deleteAssessmentAsync(a.id);
      }

      const deleted = await db.deleteJob(jobId);
      if (!deleted) return res.status(500).json({ error: 'Could not delete job' });

      return res.json({ success: true, message: `Job "${job.title}" deleted successfully.` });
    } catch (err: any) {
      console.error('Delete job error:', err);
      return res.status(500).json({ error: 'Failed to delete job' });
    }
  });

  // ==========================================
  // 3. REGISTRATIONS & INTERVIEW ACCESS CODES
  // ==========================================

  // Candidate registers for specific job (with Round 1 automated ATS screening!)
  app.post('/api/applications/register', authMiddleware, async (req: any, res) => {
    try {
      const { jobId } = req.body;
      if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

      const user = db.findUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Candidate account not found' });
      if (!user.isVerified) {
        return res.status(403).json({ error: 'You must verify your email address before registering for interviews.' });
      }

      const job = db.getJobById(jobId);
      if (!job || job.status !== JobStatus.ACTIVE) {
        return res.status(400).json({ error: 'This opportunity is no longer active.' });
      }

      // Check if already registered
      const existing = db
        .getRegistrations()
        .find(r => r.candidateId === user.id && r.jobId === jobId);
      if (existing) {
        return res.status(409).json({
          error: 'You have already registered for this interview opportunity.',
          existingRegistration: existing,
        });
      }

      // Strict Profile Validation: Must have 10th, 12th/Diploma, Degree, skills & resume
      const candidateProfile = db.getCandidateProfile(user.id);
      const edu = candidateProfile?.educationDetails;

      const hasPhone = Boolean(candidateProfile?.phone && candidateProfile.phone.trim().length >= 8);
      const hasLocation = Boolean(candidateProfile?.location && candidateProfile.location.trim().length >= 2);
      const has10th = Boolean(
        (edu?.class10School || edu?.class10Board) && edu?.class10Percentage && edu?.class10Year
      ) || Boolean(candidateProfile?.education && candidateProfile.education.toLowerCase().includes('10th'));

      const isDiploma = edu?.secondaryType === 'Diploma';
      const hasSecondary = isDiploma
        ? Boolean(edu?.diplomaCollege && edu?.diplomaBranch && edu?.diplomaPercentage && edu?.diplomaYear)
        : Boolean(edu?.class12College && edu?.class12Percentage && edu?.class12Year) ||
          Boolean(candidateProfile?.education && (candidateProfile.education.toLowerCase().includes('12th') || candidateProfile.education.toLowerCase().includes('diploma') || candidateProfile.education.toLowerCase().includes('intermediate')));

      const hasDegree = Boolean(
        edu?.degreeName && edu?.degreeCollege && edu?.degreeCgpa && edu?.degreeYear
      ) || Boolean(candidateProfile?.education && (
        candidateProfile.education.toLowerCase().includes('b.tech') ||
        candidateProfile.education.toLowerCase().includes('bachelor') ||
        candidateProfile.education.toLowerCase().includes('b.e') ||
        candidateProfile.education.toLowerCase().includes('b.sc') ||
        candidateProfile.education.toLowerCase().includes('bca') ||
        candidateProfile.education.toLowerCase().includes('degree')
      ));

      const hasSkills = Boolean(candidateProfile?.skills && candidateProfile.skills.length >= 2);
      const hasResume = Boolean(
        (candidateProfile?.resumeFileName && candidateProfile.resumeFileName.length > 0) ||
        (candidateProfile?.resumeText && candidateProfile.resumeText.length > 50)
      );

      const missing: string[] = [];
      if (!hasPhone) missing.push('Phone Number');
      if (!hasLocation) missing.push('Current Location');
      if (!has10th) missing.push('Class 10th Education');
      if (!hasSecondary) missing.push(isDiploma ? 'Diploma Details' : 'Class 12th / Intermediate Details');
      if (!hasDegree) missing.push('Graduation / Degree Details');
      if (!hasSkills) missing.push('Technical Skills');
      if (!hasResume) missing.push('Resume Upload');

      if (missing.length > 0) {
        return res.status(400).json({
          error: `Profile Incomplete: Please complete your ${missing.join(', ')} in your profile before registering for jobs.`,
          profileIncomplete: true,
          missingFields: missing,
        });
      }

      // Determine pipeline rounds (fallback to default 5-round pipeline)
      const jobRounds = job.rounds && job.rounds.length > 0 ? job.rounds : getDefaultPipelineRounds(job.title);
      const round1 = jobRounds[0];

      // Comprehensive HardCore ATS Resume Analysis & Scoring System
      const candidateSkills = (candidateProfile?.skills || []).map(s => s.trim().toLowerCase());
      const resumeRaw = (candidateProfile?.resumeText || '').toLowerCase();
      const projectsArray = Array.isArray(candidateProfile?.projects)
        ? candidateProfile.projects
        : (typeof candidateProfile?.projects === 'string' ? candidateProfile.projects.split('\n') : []);
      const projectsText = projectsArray.join(' ').toLowerCase();
      const candidateBio = (candidateProfile?.bio || '').toLowerCase();
      const combinedCorpus = `${resumeRaw} ${candidateSkills.join(' ')} ${projectsText} ${candidateBio}`;

      // Semantic Synonyms Map for accurate matching
      const synonymMap: Record<string, string[]> = {
        react: ['react', 'react.js', 'reactjs', 'react native', 'redux'],
        node: ['node', 'nodejs', 'node.js', 'express', 'express.js', 'expressjs'],
        typescript: ['typescript', 'ts'],
        javascript: ['javascript', 'js', 'es6', 'ecmascript'],
        python: ['python', 'py', 'django', 'fastapi', 'flask'],
        java: ['java', 'spring', 'springboot', 'spring boot'],
        cpp: ['c++', 'cpp'],
        csharp: ['c#', 'csharp', '.net', 'dotnet'],
        database: ['sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'nosql', 'redis', 'database'],
        cloud: ['aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'devops'],
        rest: ['rest', 'restful', 'api', 'graphql', 'microservices'],
        html: ['html', 'html5', 'css', 'css3', 'tailwind', 'tailwindcss', 'bootstrap'],
        ai: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'nlp', 'llm', 'genai'],
      };

      const requiredSkills = job.requiredSkills && job.requiredSkills.length > 0 ? job.requiredSkills : ['Core Technical Competency'];
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];

      requiredSkills.forEach(reqSkill => {
        const lower = reqSkill.toLowerCase().trim();
        let matched = false;

        // Direct containment in skills or corpus
        if (candidateSkills.includes(lower) || candidateSkills.some(s => s.includes(lower) || lower.includes(s))) {
          matched = true;
        } else if (combinedCorpus.includes(lower)) {
          matched = true;
        } else {
          // Check synonym mapping
          for (const [key, aliases] of Object.entries(synonymMap)) {
            if (aliases.some(a => lower.includes(a) || a.includes(lower))) {
              if (aliases.some(a => candidateSkills.includes(a) || combinedCorpus.includes(a))) {
                matched = true;
                break;
              }
            }
          }
        }

        if (matched) {
          matchedSkills.push(reqSkill);
        } else {
          missingSkills.push(reqSkill);
        }
      });

      // 1. Keyword & Skills Match Score (30% weight)
      const matchRatio = requiredSkills.length > 0 ? (matchedSkills.length / requiredSkills.length) : 0.85;
      const initialKwScore = Math.min(100, Math.max(35, Math.round(matchRatio * 100)));

      // 2. Experience Relevance Score (25% weight)
      const candExpYears = candidateProfile?.experienceYears || 0;
      let initialExpScore = 75;
      if (candExpYears >= 3) initialExpScore = 95;
      else if (candExpYears >= 1) initialExpScore = 88;
      else if (projectsArray.length >= 2) initialExpScore = 82;
      else initialExpScore = 72;

      // 3. Technical Projects Depth & Architectural Complexity (20% weight)
      let initialProjectDepthScore = 78;
      if (projectsArray.length >= 3 || projectsText.length > 300) initialProjectDepthScore = 92;
      else if (projectsArray.length >= 1 || projectsText.length > 100) initialProjectDepthScore = 84;
      else initialProjectDepthScore = Math.round((initialKwScore + initialExpScore) / 2);

      // 4. Education & Academic Eligibility Score (15% weight)
      let initialEduScore = hasDegree ? 90 : 75;
      if (edu?.degreeCgpa && Number(edu.degreeCgpa) >= 8.0) initialEduScore = 95;

      // 5. Formatting, ATS Readability & Presentation Score (10% weight)
      const initialFormatScore = candidateProfile?.resumeText && candidateProfile.resumeText.length > 200 ? 88 : 80;

      // Weighted ATS Total Calculation
      const initialAtsScore = Math.min(98, Math.max(35, Math.round(
        initialKwScore * 0.30 +
        initialExpScore * 0.25 +
        initialProjectDepthScore * 0.20 +
        initialEduScore * 0.15 +
        initialFormatScore * 0.10
      )));

      const minQualifyingCutoff = round1?.minQualifyingScore || 60;
      const isQualified = initialAtsScore >= minQualifyingCutoff;

      const initialAtsDetails: AtsEvaluationDetails = {
        atsScore: initialAtsScore,
        isQualified,
        scoreBreakdown: {
          keywordSkillMatchScore: initialKwScore,
          experienceRelevanceScore: initialExpScore,
          depthAndImpactScore: initialProjectDepthScore,
          educationEligibilityScore: initialEduScore,
          formattingAndClarityScore: initialFormatScore,
        },
        matchedSkills: matchedSkills.length > 0 ? matchedSkills : requiredSkills.slice(0, 2),
        missingSkills,
        candidateStrengths: matchedSkills.length > 0
          ? [`Demonstrated proficiency in mandatory core competencies: ${matchedSkills.slice(0, 4).join(', ')}`, `Solid technical foundation aligned with ${job.title} prerequisites`]
          : [`Demonstrated foundational technical problem-solving capabilities`],
        candidateWeaknesses: missingSkills.length > 0
          ? [`Further hands-on exposure recommended in: ${missingSkills.slice(0, 3).join(', ')}`]
          : [],
        experienceMatchSummary: `${candExpYears} years practical engineering and project experience verified against role requirements.`,
        educationMatchSummary: `${edu?.degreeName || candidateProfile?.education || 'Degree'} credentials verified against academic prerequisites.`,
        projectAnalysisSummary: projectsArray.length > 0
          ? `Evaluated ${projectsArray.length} practical technical projects demonstrating architecture and real-world implementation.`
          : 'Projects evaluated via declared skills and practical background.',
        coreSkillSetMatchSummary: `${matchedSkills.length} of ${requiredSkills.length} required core skills matched and validated.`,
        eligibilityCheckPassed: isQualified,
        feedback: `Candidate scored ${initialAtsScore}% on ATS Resume Screening against ${job.title} benchmarks (Cutoff: ${minQualifyingCutoff}%). ${isQualified ? 'Qualified to advance to Round 2 Technical Assessment.' : 'Did not meet minimum qualifying threshold.'}`,
        recommendation: isQualified ? 'Proceed to Technical Assessment' : 'Needs additional alignment with core role prerequisites',
        evaluatedAt: new Date().toISOString(),
      };

      // Initialize round progression records for all configured rounds
      const roundProgression: RoundProgressionRecord[] = jobRounds.map(r => {
        if (r.roundNumber === 1) {
          return {
            roundNumber: 1,
            roundType: r.roundType,
            roundName: r.name,
            status: isQualified ? RoundStatus.QUALIFIED : RoundStatus.REJECTED,
            score: initialAtsScore,
            feedback: `Automated screening verified against ${job.title} benchmarks.`,
            completedAt: new Date().toISOString(),
            minQualifyingScore: r.minQualifyingScore,
          };
        } else if (r.roundNumber === 2) {
          return {
            roundNumber: 2,
            roundType: r.roundType,
            roundName: r.name,
            status: isQualified ? RoundStatus.IN_PROGRESS : RoundStatus.LOCKED,
            minQualifyingScore: r.minQualifyingScore,
          };
        } else {
          return {
            roundNumber: r.roundNumber,
            roundType: r.roundType,
            roundName: r.name,
            status: RoundStatus.LOCKED,
            minQualifyingScore: r.minQualifyingScore,
          };
        }
      });

      // Generate unique alphanumeric interview access code
      const compPrefix = (job.company?.name || 'AI')
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 2)
        .toUpperCase();
      const jobPrefix = (job.title.replace(/[^a-zA-Z]/g, '').substring(0, 4) || 'TECH').toUpperCase();
      const randSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const uniqueCode = `${compPrefix}-${jobPrefix}-${randSuffix}`;

      // Technical Assessment Code for Round 2 is tied to the job (enabling candidate to attend recruiter-configured questions)
      let technicalAssessmentCode = job.technicalAssessmentCode || (job as any).metadata?.technicalAssessmentCode;
      if (!technicalAssessmentCode) {
        const alphaChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        technicalAssessmentCode = '';
        for (let i = 0; i < 12; i++) {
          technicalAssessmentCode += alphaChars.charAt(Math.floor(Math.random() * alphaChars.length));
        }
        db.updateJob(job.id, { technicalAssessmentCode });
      }

      // Single attempt only (Strictly 1 attempt, NO 3 attempts)
      const registration = db.createRegistration({
        id: crypto.randomUUID(),
        candidateId: user.id,
        jobId: job.id,
        companyId: job.companyId,
        status: isQualified ? ApplicationStatus.INTERVIEW_READY : ApplicationStatus.REJECTED,
        interviewStatus: isQualified ? InterviewStatus.READY_TO_ATTEND : InterviewStatus.COMPLETED,
        registeredAt: new Date().toISOString(),
        interviewCode: uniqueCode,
        technicalAssessmentCode: isQualified ? technicalAssessmentCode : undefined,
        expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(), // 14 days
        interviewStartDate: job.interviewStartDate,
        interviewStartTime: job.interviewStartTime,
        interviewEndDate: job.interviewEndDate,
        interviewEndTime: job.interviewEndTime,
        attemptCount: 0,
        maxAttempts: 1, // Single attempt only
        job,
        candidate: user,
        currentRoundNumber: isQualified ? 2 : 1,
        roundProgression,
        overallPipelineStatus: isQualified ? 'IN_PROGRESS' : 'REJECTED',
        atsScore: initialAtsScore,
        atsFeedback: initialAtsDetails.feedback,
        atsDetails: initialAtsDetails,
        skillsMatch: initialKwScore,
        experienceMatch: initialExpScore,
        educationMatch: initialEduScore,
        scores: {
          atsScore: initialAtsScore,
          skillsMatch: initialKwScore,
          experienceMatch: initialExpScore,
        },
        candidateEmailsReceived: [],
      });
      neonService.saveRegistration(registration).catch(() => {});

      // Sanitize registration payload for candidate (ATS score is confidential to recruiter)
      const { atsScore: _candAtsScore, atsFeedback: _candAtsFeedback, atsDetails: _candAtsDetails, ...sanitizedRegistration } = registration as any;
      const sanitizedProgression = (registration.roundProgression || []).map((r: any) => {
        if (r.roundNumber === 1 || r.roundType === 'RESUME_SCREENING') {
          const { score: _sc, ...rest } = r;
          return rest;
        }
        return r;
      });
      sanitizedRegistration.roundProgression = sanitizedProgression;
      sanitizedRegistration.technicalAssessmentCode = isQualified ? technicalAssessmentCode : undefined;

      // Send immediate HTTP response (< 30ms latency for seamless UI!)
      res.json({
        success: true,
        message: isQualified
          ? `Your application for ${job.title} has passed resume screening! Your 12-digit Technical Assessment Code is: ${technicalAssessmentCode}`
          : `Your application for ${job.title} has been submitted.`,
        registration: sanitizedRegistration,
        interviewCode: uniqueCode,
        technicalAssessmentCode: isQualified ? technicalAssessmentCode : undefined,
      });

      // Asynchronous background task: Send registration confirmation email with alphanumeric code via SMTP
      const packageStr = job.salaryPackage || `${job.currency} ${(job.minPackage / 100000).toFixed(1)}L - ${(job.maxPackage / 100000).toFixed(1)}L PA`;
      emailService.sendRegistrationEmail({
        toEmail: user.email,
        candidateName: user.fullName,
        companyName: job.company?.name || 'Hiring Team',
        jobTitle: job.title,
        location: job.location,
        packageStr,
        durationMinutes: job.durationMinutes,
        interviewCode: uniqueCode,
      }).catch(err => console.warn('Background registration email failed:', err?.message));

      if (isQualified) {
        // Resume is Passed -> Directly email candidate with Congratulations message for First Round selection,
        // Greetings by the Company Name, 12-digit code, and "TO write the technical Assesment -> Click Here" button
        emailService.sendResumePassedEmail({
          toEmail: user.email,
          candidateName: user.fullName,
          companyName: job.company?.name || 'Hiring Team',
          jobTitle: job.title,
          technicalAssessmentCode: technicalAssessmentCode,
          interviewCode: uniqueCode,
          assessmentUrl: 'https://technicalassesment-1081785547021.asia-southeast1.run.app/',
        }).catch(err => console.warn('Background resume passed email failed:', err?.message));
      } else {
        emailService.sendPipelineUpdateEmail({
          toEmail: user.email,
          candidateName: user.fullName,
          jobTitle: job.title,
          companyName: job.company?.name || 'Hiring Team',
          roundNumber: 1,
          roundName: 'Resume Screening',
          status: 'REJECTED',
          feedback: 'Thank you for your interest. After reviewing your application against current role requirements, we are unable to advance your candidacy at this time.',
          score: undefined,
        }).catch(err => console.warn('Background pipeline email failed:', err?.message));
      }

      // Asynchronous background task: Deep Gemini ATS Evaluation to enrich recruiter dossier
      geminiService.evaluateResumeAts({
        jobTitle: job.title,
        jobDescription: job.description,
        eligibilityCriteria: job.eligibilityCriteria,
        requiredSkills: job.requiredSkills || [],
        requiredCertifications: job.requiredCertifications || [],
        experienceRequirements: job.experienceRequirements || job.experience,
        minQualifyingScore: round1?.minQualifyingScore || 65,
        candidateName: user.fullName,
        candidateEducation: candidateProfile?.education || `${edu?.degreeName || ''} ${edu?.degreeCollege || ''}`,
        candidateSkills: candidateProfile?.skills || [],
        candidateCertifications: candidateProfile?.certifications || [],
        candidateExperienceYears: candidateProfile?.experienceYears || 0,
        candidateProjects: candidateProfile?.projects || [],
        resumeText: candidateProfile?.resumeText,
      }).then(deepResult => {
        const currentReg = db.getRegistrationById(registration.id);
        const updatedProgression = (currentReg?.roundProgression || registration.roundProgression || []).map((rp: any) => {
          if (rp.roundNumber === 1 || rp.roundType === 'RESUME_SCREENING') {
            return {
              ...rp,
              score: deepResult.atsScore,
              feedback: deepResult.feedback,
              status: deepResult.isQualified ? RoundStatus.QUALIFIED : rp.status,
            };
          }
          return rp;
        });

        db.updateRegistration(registration.id, {
          atsScore: deepResult.atsScore,
          atsFeedback: deepResult.feedback,
          atsDetails: deepResult,
          roundProgression: updatedProgression,
          scores: {
            ...(currentReg?.scores || {}),
            atsScore: deepResult.atsScore,
            skillsMatch: deepResult.scoreBreakdown?.keywordSkillMatchScore || currentReg?.scores?.skillsMatch,
            experienceMatch: deepResult.scoreBreakdown?.experienceRelevanceScore || currentReg?.scores?.experienceMatch,
          },
        });
      }).catch(err => console.warn('Background deep ATS audit failed:', err?.message));

    } catch (err: any) {
      console.error('Registration error:', err);
      return res.status(500).json({ error: 'Failed to complete interview registration' });
    }
  });

  // Candidate: Get pipeline status for a specific application
  app.get('/api/applications/:id/pipeline', authMiddleware, (req: any, res) => {
    try {
      const reg = db.getRegistrationById(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Registration record not found' });
      const job = db.getJobById(reg.jobId);
      return res.json({
        registrationId: reg.id,
        jobTitle: job?.title,
        companyName: job?.company?.name,
        currentRoundNumber: reg.currentRoundNumber || 1,
        overallPipelineStatus: reg.overallPipelineStatus || 'IN_PROGRESS',
        atsScore: reg.atsScore,
        atsFeedback: reg.atsFeedback,
        roundProgression: reg.roundProgression || [],
        roundsConfig: job?.rounds || getDefaultPipelineRounds(job?.title || 'Job'),
        interviewCode: reg.interviewCode,
        emailsReceived: reg.candidateEmailsReceived || [],
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch pipeline' });
    }
  });

  // Recruiter: Update Candidate Pipeline Round Status (Advance, Hold, Reject, Select)
  app.post('/api/recruiter/candidate-round-status', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }

      const { registrationId, roundNumber, newStatus, feedback, score } = req.body;
      if (!registrationId || !roundNumber || !newStatus) {
        return res.status(400).json({ error: 'registrationId, roundNumber, and newStatus are required.' });
      }

      const reg = db.getRegistrationById(registrationId);
      if (!reg) return res.status(404).json({ error: 'Candidate application not found' });

      const job = db.getJobById(reg.jobId);
      const candidateUser = db.findUserById(reg.candidateId);

      const progression: RoundProgressionRecord[] = (reg.roundProgression && reg.roundProgression.length > 0)
        ? [...reg.roundProgression]
        : (job?.rounds || getDefaultPipelineRounds(job?.title)).map(r => ({
            roundNumber: r.roundNumber,
            roundType: r.roundType,
            roundName: r.name,
            status: RoundStatus.LOCKED,
            minQualifyingScore: r.minQualifyingScore,
          }));

      const roundIdx = progression.findIndex(r => r.roundNumber === Number(roundNumber));
      if (roundIdx === -1) {
        return res.status(404).json({ error: `Round number ${roundNumber} not found in job pipeline.` });
      }

      progression[roundIdx].status = newStatus as RoundStatus;
      if (feedback !== undefined) progression[roundIdx].feedback = feedback;
      if (score !== undefined) progression[roundIdx].score = Number(score);
      progression[roundIdx].completedAt = new Date().toISOString();

      let nextRoundNum = reg.currentRoundNumber || Number(roundNumber);
      let overallStatus = reg.overallPipelineStatus || 'IN_PROGRESS';

      if (newStatus === RoundStatus.QUALIFIED) {
        if (roundIdx + 1 < progression.length) {
          progression[roundIdx + 1].status = RoundStatus.IN_PROGRESS;
          nextRoundNum = progression[roundIdx + 1].roundNumber;
        } else {
          // Last round cleared!
          overallStatus = 'QUALIFIED';
        }
      } else if (newStatus === RoundStatus.REJECTED) {
        overallStatus = 'REJECTED';
      }

      const updatedReg = db.updateRegistration(registrationId, {
        roundProgression: progression,
        currentRoundNumber: nextRoundNum,
        overallPipelineStatus: overallStatus as any,
      });
      if (updatedReg) {
        neonService.saveRegistration(updatedReg).catch(() => {});
      }

      // Dispatch notification email to candidate
      if (candidateUser?.email) {
        if (Number(roundNumber) === 1 && newStatus === RoundStatus.QUALIFIED) {
          await emailService.sendResumePassedEmail({
            toEmail: candidateUser.email,
            candidateName: candidateUser.fullName,
            jobTitle: job?.title || 'Open Position',
            companyName: job?.company?.name || 'Hiring Team',
            technicalAssessmentCode: reg.technicalAssessmentCode || reg.interviewCode,
            interviewCode: reg.interviewCode,
            assessmentUrl: 'https://technicalassesment-1081785547021.asia-southeast1.run.app/',
          });
        } else if (Number(roundNumber) === 2 && newStatus === RoundStatus.QUALIFIED) {
          const resolvedScore = score !== undefined ? Number(score) : (reg.technicalAssessmentScore || 85);
          await emailService.sendTechnicalAssessmentClearedEmail({
            toEmail: candidateUser.email,
            candidateName: candidateUser.fullName,
            jobTitle: job?.title || 'Open Position',
            companyName: job?.company?.name || 'Hiring Team',
            score: resolvedScore,
            passingScore: progression[roundIdx].minQualifyingScore || 70,
            interviewCode: reg.interviewCode,
            nextSectionName: 'Stage 3: AI Technical Voice Interview',
          });
        } else {
          await emailService.sendPipelineUpdateEmail({
            toEmail: candidateUser.email,
            candidateName: candidateUser.fullName,
            jobTitle: job?.title || 'Open Position',
            companyName: job?.company?.name || 'Hiring Team',
            roundNumber: Number(roundNumber),
            roundName: progression[roundIdx].roundName,
            status: newStatus,
            feedback,
            score: score !== undefined ? Number(score) : undefined,
            interviewCode: newStatus === RoundStatus.QUALIFIED ? reg.interviewCode : undefined,
          });
        }
      }

      return res.json({
        success: true,
        message: `Round ${roundNumber} status updated to ${newStatus}. Notification sent to candidate.`,
        registration: updatedReg,
      });
    } catch (err: any) {
      console.error('Update candidate round error:', err);
      return res.status(500).json({ error: 'Failed to update round status' });
    }
  });

  // Recruiter: Bulk Pipeline Action (Select, Deselect, Move Stage, Reject)
  app.post('/api/recruiter/pipeline/bulk-action', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }

      const { action, registrationIds, reason } = req.body;
      if (!action || !Array.isArray(registrationIds) || registrationIds.length === 0) {
        return res.status(400).json({ error: 'action and registrationIds array are required.' });
      }

      const results = [];
      const alphaChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

      for (const id of registrationIds) {
        const reg = db.getRegistrationById(id);
        if (!reg) continue;

        const job = db.getJobById(reg.jobId);
        const candidateUser = db.findUserById(reg.candidateId);
        const progression: RoundProgressionRecord[] = (reg.roundProgression && reg.roundProgression.length > 0)
          ? [...reg.roundProgression]
          : (job?.rounds || getDefaultPipelineRounds(job?.title)).map(r => ({
              roundNumber: r.roundNumber,
              roundType: r.roundType,
              roundName: r.name,
              status: RoundStatus.LOCKED,
              minQualifyingScore: r.minQualifyingScore,
            }));

        const currentStage = reg.currentRoundNumber || 1;

        if (action === 'SELECT') {
          const updated = db.updateRegistration(id, {
            selectedForStage: true,
            isSelectedForStage: true,
          });
          results.push(updated);
        } else if (action === 'DESELECT') {
          const updated = db.updateRegistration(id, {
            selectedForStage: false,
            isSelectedForStage: false,
          });
          results.push(updated);
        } else if (action === 'MOVE_STAGE') {
          if (currentStage >= 5) continue;
          const nextStage = currentStage + 1;

          const curIdx = progression.findIndex(r => r.roundNumber === currentStage);
          if (curIdx !== -1) {
            progression[curIdx].status = RoundStatus.QUALIFIED;
            progression[curIdx].completedAt = new Date().toISOString();
          }

          const nextIdx = progression.findIndex(r => r.roundNumber === nextStage);
          if (nextIdx !== -1) {
            progression[nextIdx].status = RoundStatus.IN_PROGRESS;
          }

          let techCode = reg.technicalAssessmentCode;
          if (nextStage === 2 && !techCode) {
            techCode = '';
            for (let i = 0; i < 12; i++) {
              techCode += alphaChars.charAt(Math.floor(Math.random() * alphaChars.length));
            }
          }

          const isFinal = nextStage === 5;
          const updated = db.updateRegistration(id, {
            currentRoundNumber: nextStage,
            roundProgression: progression,
            selectedForStage: false,
            isSelectedForStage: false,
            technicalAssessmentCode: techCode,
            overallPipelineStatus: isFinal ? 'QUALIFIED' : 'IN_PROGRESS',
            status: isFinal ? ApplicationStatus.SHORTLISTED : ApplicationStatus.INTERVIEW_READY,
          });

          if (candidateUser?.email) {
            const nextRoundName = progression[nextIdx]?.roundName || `Stage ${nextStage}`;
            await emailService.sendPipelineUpdateEmail({
              toEmail: candidateUser.email,
              candidateName: candidateUser.fullName,
              jobTitle: job?.title || 'Open Role',
              companyName: job?.company?.name || 'Hiring Team',
              roundNumber: nextStage,
              roundName: nextRoundName,
              status: RoundStatus.IN_PROGRESS,
              feedback: reason || `Congratulations! You have been advanced to ${nextRoundName}.`,
              interviewCode: reg.interviewCode,
            });
          }

          results.push(updated);
        } else if (action === 'REJECT') {
          const curIdx = progression.findIndex(r => r.roundNumber === currentStage);
          if (curIdx !== -1) {
            progression[curIdx].status = RoundStatus.REJECTED;
            progression[curIdx].completedAt = new Date().toISOString();
            if (reason) progression[curIdx].feedback = reason;
          }

          const updated = db.updateRegistration(id, {
            status: ApplicationStatus.REJECTED,
            overallPipelineStatus: 'REJECTED',
            isSelectedForStage: false,
            roundProgression: progression,
          });

          if (candidateUser?.email) {
            await emailService.sendPipelineUpdateEmail({
              toEmail: candidateUser.email,
              candidateName: candidateUser.fullName,
              jobTitle: job?.title || 'Open Role',
              companyName: job?.company?.name || 'Hiring Team',
              roundNumber: currentStage,
              roundName: progression[curIdx]?.roundName || `Stage ${currentStage}`,
              status: RoundStatus.REJECTED,
              feedback: reason || 'Thank you for your application. We have decided to move forward with other candidates.',
            });
          }

          results.push(updated);
        }
      }

      return res.json({
        success: true,
        action,
        count: results.length,
      });
    } catch (err: any) {
      console.error('Bulk action error:', err);
      return res.status(500).json({ error: 'Failed to execute bulk action' });
    }
  });

  // Recruiter: Single Candidate Stage Advancement
  app.post('/api/recruiter/applications/:id/move-stage', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }

      const { id } = req.params;
      const reg = db.getRegistrationById(id);
      if (!reg) return res.status(404).json({ error: 'Candidate application not found' });

      const currentStage = reg.currentRoundNumber || 1;
      if (currentStage >= 5) {
        return res.status(400).json({ error: 'Candidate is already at the final stage.' });
      }

      const nextStage = currentStage + 1;
      const job = db.getJobById(reg.jobId);
      const candidateUser = db.findUserById(reg.candidateId);

      const progression: RoundProgressionRecord[] = (reg.roundProgression && reg.roundProgression.length > 0)
        ? [...reg.roundProgression]
        : (job?.rounds || getDefaultPipelineRounds(job?.title)).map(r => ({
            roundNumber: r.roundNumber,
            roundType: r.roundType,
            roundName: r.name,
            status: RoundStatus.LOCKED,
            minQualifyingScore: r.minQualifyingScore,
          }));

      const curIdx = progression.findIndex(r => r.roundNumber === currentStage);
      if (curIdx !== -1) {
        progression[curIdx].status = RoundStatus.QUALIFIED;
        progression[curIdx].completedAt = new Date().toISOString();
      }

      const nextIdx = progression.findIndex(r => r.roundNumber === nextStage);
      if (nextIdx !== -1) {
        progression[nextIdx].status = RoundStatus.IN_PROGRESS;
      }

      const alphaChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let techCode = reg.technicalAssessmentCode;
      if (nextStage === 2 && !techCode) {
        techCode = '';
        for (let i = 0; i < 12; i++) {
          techCode += alphaChars.charAt(Math.floor(Math.random() * alphaChars.length));
        }
      }

      const isFinal = nextStage === 5;
      const updated = db.updateRegistration(id, {
        currentRoundNumber: nextStage,
        roundProgression: progression,
        selectedForStage: false,
        isSelectedForStage: false,
        technicalAssessmentCode: techCode,
        overallPipelineStatus: isFinal ? 'QUALIFIED' : 'IN_PROGRESS',
        status: isFinal ? ApplicationStatus.SHORTLISTED : ApplicationStatus.INTERVIEW_READY,
      });

      if (candidateUser?.email) {
        const nextRoundName = progression[nextIdx]?.roundName || `Stage ${nextStage}`;
        await emailService.sendPipelineUpdateEmail({
          toEmail: candidateUser.email,
          candidateName: candidateUser.fullName,
          jobTitle: job?.title || 'Open Role',
          companyName: job?.company?.name || 'Hiring Team',
          roundNumber: nextStage,
          roundName: nextRoundName,
          status: RoundStatus.IN_PROGRESS,
          feedback: `You have successfully advanced to ${nextRoundName}.`,
          interviewCode: reg.interviewCode,
        });
      }

      return res.json({ success: true, registration: updated });
    } catch (err: any) {
      console.error('Move stage error:', err);
      return res.status(500).json({ error: 'Failed to advance candidate stage' });
    }
  });

  // Recruiter: Select Candidate
  app.post('/api/recruiter/applications/:id/select', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const reg = db.getRegistrationById(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Application not found' });
      const updated = db.updateRegistration(req.params.id, {
        selectedForStage: true,
        isSelectedForStage: true,
      });
      return res.json({ success: true, registration: updated });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to select candidate' });
    }
  });

  // Recruiter: Deselect Candidate
  app.post('/api/recruiter/applications/:id/deselect', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const reg = db.getRegistrationById(req.params.id);
      if (!reg) return res.status(404).json({ error: 'Application not found' });
      const updated = db.updateRegistration(req.params.id, {
        selectedForStage: false,
        isSelectedForStage: false,
      });
      return res.json({ success: true, registration: updated });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to deselect candidate' });
    }
  });

  // Recruiter: Reject Candidate
  app.post('/api/recruiter/applications/:id/reject', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const { id } = req.params;
      const { reason, sendEmail } = req.body;
      const reg = db.getRegistrationById(id);
      if (!reg) return res.status(404).json({ error: 'Application not found' });

      const job = db.getJobById(reg.jobId);
      const candidateUser = db.findUserById(reg.candidateId);
      const currentStage = reg.currentRoundNumber || 1;
      const progression = [...(reg.roundProgression || [])];
      const curIdx = progression.findIndex(r => r.roundNumber === currentStage);
      if (curIdx !== -1) {
        progression[curIdx].status = RoundStatus.REJECTED;
        progression[curIdx].completedAt = new Date().toISOString();
        if (reason) progression[curIdx].feedback = reason;
      }

      const updated = db.updateRegistration(id, {
        status: ApplicationStatus.REJECTED,
        overallPipelineStatus: 'REJECTED',
        selectedForStage: false,
        isSelectedForStage: false,
        roundProgression: progression,
      });

      if (sendEmail && candidateUser?.email) {
        await emailService.sendPipelineUpdateEmail({
          toEmail: candidateUser.email,
          candidateName: candidateUser.fullName,
          jobTitle: job?.title || 'Open Role',
          companyName: job?.company?.name || 'Hiring Team',
          roundNumber: currentStage,
          roundName: progression[curIdx]?.roundName || `Stage ${currentStage}`,
          status: RoundStatus.REJECTED,
          feedback: reason || 'Application not selected for subsequent rounds.',
        });
      }

      return res.json({ success: true, registration: updated });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to reject candidate' });
    }
  });

  // Recruiter: Get All Assessments (optionally filter by jobId)
  app.get('/api/recruiter/assessments', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const { jobId } = req.query;
      let assessments = db.getAssessments() || [];
      if (jobId) {
        assessments = assessments.filter(a => a.jobId === jobId);
      }
      return res.json(assessments);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch assessments' });
    }
  });

  // Recruiter: Create Assessment
  app.post('/api/recruiter/assessments', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const { jobId, title, description, durationMinutes, passingScore, difficulty, skillsTested, questions, antiCheatingEnabled } = req.body;
      if (!jobId || !title) {
        return res.status(400).json({ error: 'jobId and title are required' });
      }

      const job = db.getJobById(jobId);
      const newAssessment = db.createAssessment({
        id: 'asmt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        jobId,
        companyId: job?.companyId || 'comp_default',
        recruiterId: req.user.id,
        title,
        description: description || '',
        durationMinutes: Number(durationMinutes) || 45,
        passingScore: Number(passingScore) || 70,
        difficulty: (difficulty as QuestionDifficulty) || QuestionDifficulty.MEDIUM,
        skillsTested: Array.isArray(skillsTested) ? skillsTested : ['Engineering'],
        questions: Array.isArray(questions) ? questions : [],
        negativeMarking: false,
        randomization: true,
        attemptLimit: 1,
        antiCheatingEnabled: antiCheatingEnabled !== false,
        isPublished: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (Array.isArray(questions)) {
        db.updateJobAsync(jobId, { technicalAssessmentQuestions: questions }).catch(() => {});
      }

      return res.json(newAssessment);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to create assessment' });
    }
  });

  // Recruiter: Update Assessment by ID
  app.put('/api/recruiter/assessments/:id', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const { id } = req.params;
      const { title, description, durationMinutes, passingScore, difficulty, skillsTested, questions, antiCheatingEnabled } = req.body;

      const existing = db.getAssessmentById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Assessment not found' });
      }

      const updates: Partial<TechnicalAssessment> = {
        updatedAt: new Date().toISOString(),
      };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (durationMinutes !== undefined) updates.durationMinutes = Number(durationMinutes);
      if (passingScore !== undefined) updates.passingScore = Number(passingScore);
      if (difficulty !== undefined) updates.difficulty = difficulty;
      if (skillsTested !== undefined && Array.isArray(skillsTested)) updates.skillsTested = skillsTested;
      if (questions !== undefined && Array.isArray(questions)) updates.questions = questions;
      if (antiCheatingEnabled !== undefined) updates.antiCheatingEnabled = Boolean(antiCheatingEnabled);

      const updated = db.updateAssessment(id, updates);

      // Keep job.technicalAssessmentQuestions in sync
      if (existing.jobId && Array.isArray(questions)) {
        await db.updateJobAsync(existing.jobId, {
          technicalAssessmentQuestions: questions,
        });
      }

      return res.json({ success: true, assessment: updated });
    } catch (err: any) {
      console.error('Update assessment error:', err);
      return res.status(500).json({ error: 'Failed to update assessment' });
    }
  });

  // Recruiter: Update or Create Assessment by Job ID
  app.put('/api/recruiter/assessments/job/:jobId', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const { jobId } = req.params;
      const { title, description, durationMinutes, passingScore, difficulty, skillsTested, questions, antiCheatingEnabled } = req.body;

      const job = db.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job opening not found' });
      }

      let existing = db.getAssessments().find(a => a.jobId === jobId);
      let updated: any;

      if (existing) {
        const updates: Partial<TechnicalAssessment> = {
          updatedAt: new Date().toISOString(),
        };
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (durationMinutes !== undefined) updates.durationMinutes = Number(durationMinutes);
        if (passingScore !== undefined) updates.passingScore = Number(passingScore);
        if (difficulty !== undefined) updates.difficulty = difficulty;
        if (skillsTested !== undefined && Array.isArray(skillsTested)) updates.skillsTested = skillsTested;
        if (questions !== undefined && Array.isArray(questions)) updates.questions = questions;
        if (antiCheatingEnabled !== undefined) updates.antiCheatingEnabled = Boolean(antiCheatingEnabled);

        updated = db.updateAssessment(existing.id, updates);
      } else {
        updated = db.createAssessment({
          id: 'asmt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          jobId,
          companyId: job.companyId,
          recruiterId: req.user.id,
          title: title || `${job.title} - Technical Assessment`,
          description: description || `Technical assessment configured for ${job.title}`,
          durationMinutes: Number(durationMinutes) || 45,
          passingScore: Number(passingScore) || 70,
          difficulty: difficulty || QuestionDifficulty.MEDIUM,
          skillsTested: Array.isArray(skillsTested) ? skillsTested : (job.requiredSkills || ['Computer Science']),
          questions: Array.isArray(questions) ? questions : [],
          negativeMarking: false,
          randomization: true,
          attemptLimit: 1,
          antiCheatingEnabled: antiCheatingEnabled !== false,
          isPublished: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Sync job.technicalAssessmentQuestions
      if (Array.isArray(questions)) {
        await db.updateJobAsync(jobId, {
          technicalAssessmentQuestions: questions,
        });
      }

      return res.json({ success: true, assessment: updated });
    } catch (err: any) {
      console.error('Update assessment by jobId error:', err);
      return res.status(500).json({ error: 'Failed to update assessment for job' });
    }
  });

  // Recruiter: Delete Assessment
  app.delete('/api/recruiter/assessments/:id', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const deleted = db.deleteAssessment(req.params.id);
      return res.json({ success: true, deleted });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to delete assessment' });
    }
  });

  // Recruiter: Get Assessment Submissions
  app.get('/api/recruiter/assessments/:assessmentId/submissions', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const { assessmentId } = req.params;
      const asmt = db.getAssessmentById(assessmentId);
      const submissions = asmt 
        ? db.getAssessmentSubmissions(asmt.jobId)
        : (db.getAssessmentSubmissions() || []).filter((s: any) => s.assessmentId === assessmentId);

      const populated = submissions.map(sub => {
        const candidateUser = db.findUserById(sub.candidateId);
        return {
          ...sub,
          candidateName: candidateUser?.fullName || 'Candidate',
          candidateEmail: candidateUser?.email || '',
        };
      });

      return res.json(populated);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  });

  // Recruiter: Get Assessment by Job ID
  app.get('/api/recruiter/assessments/job/:jobId', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const { jobId } = req.params;
      let assessment = db.getAssessments().find(a => a.jobId === jobId);

      // If no assessment exists yet, check job's recruiter-configured questions or generate tailored questions
      if (!assessment) {
        const job = db.getJobById(jobId);
        if (job) {
          const questions = (job.technicalAssessmentQuestions && job.technicalAssessmentQuestions.length > 0)
            ? job.technicalAssessmentQuestions
            : [
                {
                  id: 'mcq_1',
                  questionText: `Which data structure is most optimal for implementing an LRU Cache with O(1) get and put operations in ${job.title}?`,
                  type: 'MULTIPLE_CHOICE' as const,
                  options: ['Array + Linked List', 'Hash Map + Doubly Linked List', 'Binary Search Tree + Stack', 'Min-Heap + Queue'],
                  correctOptionIndex: 1,
                  marks: 5,
                  skillsTested: ['Data Structures & Algorithms', 'Technical Aptitude'],
                },
                {
                  id: 'mcq_2',
                  questionText: 'In high-scale microservices, which pattern prevents cascading downstream failures during traffic surges?',
                  type: 'MULTIPLE_CHOICE' as const,
                  options: ['Saga Pattern', 'Circuit Breaker Pattern', 'CQRS Pattern', 'Event Sourcing'],
                  correctOptionIndex: 1,
                  marks: 5,
                  skillsTested: ['System Design', 'Reliability'],
                },
                {
                  id: 'code_1',
                  questionText: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution.',
                  type: 'CODING' as const,
                  marks: 20,
                  skillsTested: ['Algorithms', 'Data Structures', 'Hash Tables'],
                  codingLanguage: 'javascript',
                  codingTemplate: 'function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const comp = target - nums[i];\n    if (map.has(comp)) {\n      return [map.get(comp), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}',
                  testCases: [
                    { input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', isHidden: false, explanation: 'nums[0] + nums[1] == 9' },
                    { input: '[3, 2, 4], 6', expectedOutput: '[1, 2]', isHidden: false, explanation: 'nums[1] + nums[2] == 6' },
                    { input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: false, explanation: 'nums[0] + nums[1] == 6' },
                    { input: '[1, 5, 8, 12, 19], 20', expectedOutput: '[0, 4]', isHidden: true },
                    { input: '[-3, 4, 3, 90], 0', expectedOutput: '[0, 2]', isHidden: true },
                    { input: '[100, 200, 500, 800], 1000', expectedOutput: '[1, 3]', isHidden: true },
                    { input: '[0, 4, 3, 0], 0', expectedOutput: '[0, 3]', isHidden: true },
                    { input: '[15, 25, 35, 45], 70', expectedOutput: '[1, 3]', isHidden: true },
                  ],
                },
              ];

          assessment = db.createAssessment({
            id: 'asmt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            jobId: job.id,
            companyId: job.companyId,
            recruiterId: job.recruiterId || req.user.id,
            title: `${job.title} - Technical Assessment`,
            description: `Recruiter-configured technical assessment featuring ${questions.length} questions (MCQs & Coding with 3 shown & 5 hidden test cases).`,
            durationMinutes: 45,
            passingScore: 70,
            difficulty: QuestionDifficulty.MEDIUM,
            skillsTested: job.requiredSkills?.length ? job.requiredSkills : ['Computer Science', 'Problem Solving'],
            questions,
            negativeMarking: false,
            randomization: true,
            attemptLimit: 1,
            antiCheatingEnabled: true,
            isPublished: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return res.json({ assessment: assessment || null });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch assessment for job' });
    }
  });

  // Recruiter: Get Candidate Assessment Submission by Registration ID
  app.get('/api/recruiter/assessments/submission-by-registration/:registrationId', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const { registrationId } = req.params;
      const subs = db.getAssessmentSubmissions() || [];
      let submission = subs.find(s => s.registrationId === registrationId);

      if (!submission) {
        const reg = db.getRegistrationById(registrationId);
        if (reg) {
          submission = subs.find(s => s.candidateId === reg.candidateId && s.jobId === reg.jobId);
        }
      }

      // If still not found, check Neon database directly
      if (!submission) {
        const p = getNeonPool();
        if (p) {
          const neonRes = await p.query(
            `SELECT * FROM assessment_submissions WHERE registration_id = $1 OR candidate_id = (SELECT candidate_id FROM interview_registrations WHERE id = $1 LIMIT 1) ORDER BY submitted_at DESC LIMIT 1;`,
            [registrationId]
          ).catch(() => ({ rows: [] }));

          if (neonRes.rows && neonRes.rows[0]) {
            const row = neonRes.rows[0];
            submission = {
              id: row.id,
              assessmentId: row.assessment_id,
              candidateId: row.candidate_id,
              registrationId: row.registration_id || registrationId,
              jobId: row.job_id,
              score: Number(row.score) || 0,
              percentage: Number(row.percentage) || 0,
              totalQuestions: 2,
              attempted: 2,
              correct: 2,
              incorrect: 0,
              timeTakenMinutes: 20,
              passed: Boolean(row.passed),
              integrityStatus: (row.integrity_status || 'CLEAN') as any,
              submittedAt: row.submitted_at,
            };
          }
        }
      }

      return res.json({ submission: submission || null });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch submission' });
    }
  });

  // Recruiter: Email Next Section Access Code to Candidate Who Cleared Technical Assessment
  app.post('/api/recruiter/applications/:id/email-next-section-code', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }

      const regId = req.params.id;
      const reg = db.getRegistrationById(regId);
      if (!reg) return res.status(404).json({ error: 'Application registration not found' });

      const candidate = db.findUserById(reg.candidateId);
      if (!candidate?.email) {
        return res.status(400).json({ error: 'Candidate has no registered email address' });
      }

      const job = db.getJobById(reg.jobId);
      const score = reg.technicalAssessmentScore || reg.scores?.technicalScore || 85;

      const emailLog = await emailService.sendTechnicalAssessmentClearedEmail({
        toEmail: candidate.email,
        candidateName: candidate.fullName || (candidate as any).name || 'Candidate',
        jobTitle: job?.title || 'Open Position',
        companyName: job?.company?.name || 'Hiring Team',
        score,
        interviewCode: reg.interviewCode,
        nextSectionName: 'Stage 3: AI Technical Voice Interview',
      });

      db.logRecruiterActivity({
        id: 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        recruiterId: req.user.id,
        action: 'EMAIL_SENT',
        candidateId: reg.candidateId,
        candidateName: candidate.fullName || (candidate as any).name,
        jobId: reg.jobId,
        jobTitle: job?.title,
        details: `Emailed next section access code (${reg.interviewCode}) to ${candidate.email}`,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: `Congratulations email with access code (${reg.interviewCode}) dispatched to ${candidate.email}!`,
        interviewCode: reg.interviewCode,
        emailLog,
      });
    } catch (err: any) {
      console.error('Email next section code error:', err);
      return res.status(500).json({ error: 'Failed to send next section code email' });
    }
  });

  // Recruiter: Send Direct Email to Candidate
  app.post('/api/recruiter/send-email', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }

      const { registrationId, subject, messageBody } = req.body;
      if (!registrationId || !subject || !messageBody) {
        return res.status(400).json({ error: 'registrationId, subject, and messageBody are required.' });
      }

      const reg = db.getRegistrationById(registrationId);
      if (!reg) return res.status(404).json({ error: 'Application not found' });

      const job = db.getJobById(reg.jobId);
      const candidateUser = db.findUserById(reg.candidateId);
      const recruiterUser = db.findUserById(req.user.id);

      if (!candidateUser?.email) {
        return res.status(400).json({ error: 'Candidate has no valid email registered.' });
      }

      const sentLog = await emailService.sendDirectRecruiterEmail({
        toEmail: candidateUser.email,
        candidateName: candidateUser.fullName,
        recruiterName: recruiterUser?.fullName || 'Recruitment Team',
        companyName: job?.company?.name || 'Company',
        jobTitle: job?.title || 'Open Position',
        subject,
        messageBody,
      });

      const emailRecord: CandidateReceivedEmail = {
        id: 'eml_' + Math.random().toString(36).substring(2, 9),
        subject,
        body: messageBody,
        senderName: recruiterUser?.fullName || 'Recruiter',
        sentAt: new Date().toISOString(),
      };

      const existingEmails = reg.candidateEmailsReceived || [];
      const updatedReg = db.updateRegistration(registrationId, {
        candidateEmailsReceived: [emailRecord, ...existingEmails],
      });

      return res.json({
        success: true,
        message: `Email dispatched successfully to ${candidateUser.email}.`,
        emailLog: sentLog,
        registration: updatedReg,
      });
    } catch (err: any) {
      console.error('Send direct email error:', err);
      return res.status(500).json({ error: 'Failed to send email to candidate' });
    }
  });

  // Recruiter: Schedule / Reschedule Candidate Interview
  app.post('/api/recruiter/schedule-interview', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required to schedule interviews.' });
      }

      const { registrationId, interviewStartDate, interviewStartTime, interviewEndDate, interviewEndTime } = req.body;
      if (!registrationId) {
        return res.status(400).json({ error: 'registrationId is required' });
      }

      const reg = db.getRegistrationById(registrationId);
      if (!reg) return res.status(404).json({ error: 'Interview registration record not found.' });

      const job = db.getJobById(reg.jobId);
      const updated = db.updateRegistration(registrationId, {
        interviewStartDate,
        interviewStartTime,
        interviewEndDate,
        interviewEndTime,
      });

      // Send schedule notification email to candidate
      const candidateUser = db.findUserById(reg.candidateId);
      if (candidateUser?.email) {
        await emailService.sendScheduleNotification(
          candidateUser.email,
          candidateUser.fullName,
          job?.title || 'Technical Role',
          job?.company?.name || 'Hiring Team',
          reg.interviewCode,
          interviewStartDate,
          interviewStartTime,
          interviewEndDate,
          interviewEndTime
        );
      }

      return res.json({
        success: true,
        message: 'Interview schedule saved successfully and candidate has been notified via email.',
        registration: updated,
      });
    } catch (err: any) {
      console.error('Schedule interview error:', err);
      return res.status(500).json({ error: 'Failed to update interview schedule' });
    }
  });

  // Candidate: Get own registered interviews
  app.get('/api/applications/my-interviews', authMiddleware, async (req: any, res) => {
    try {
      // Sync any technical assessment results completed on the external portal from Neon DB
      await neonService.syncAssessmentSubmissions(req.user.id).catch(() => {});

      const all = db.getRegistrations();
      const my = all.filter(r => r.candidateId === req.user.id);
      // Candidates should never see confidential ATS score/details or Round 1 numerical scores
      const sanitized = my.map(r => {
        const { atsScore, atsFeedback, atsDetails, ...rest } = r as any;
        const sanitizedProgression = (r.roundProgression || []).map((rp: any) => {
          if (rp.roundNumber === 1 || rp.roundType === 'RESUME_SCREENING') {
            const { score: _sc, ...rpRest } = rp;
            return rpRest;
          }
          return rp;
        });
        return {
          ...rest,
          roundProgression: sanitizedProgression,
        };
      });
      return res.json(sanitized);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch interviews' });
    }
  });

  // Candidate: Explicitly trigger synchronization of external assessment results
  app.post('/api/candidate/sync-assessment/:registrationId', authMiddleware, async (req: any, res) => {
    try {
      const { registrationId } = req.params;
      const reg = db.getRegistrationById(registrationId);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (req.user.role === UserRole.CANDIDATE && reg.candidateId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await neonService.syncAssessmentSubmissions(req.user.id);
      const updated = db.getRegistrationById(registrationId);
      return res.json({ success: true, registration: updated });
    } catch (err: any) {
      console.error('Sync assessment error:', err);
      return res.status(500).json({ error: 'Failed to sync assessment results' });
    }
  });

  // Candidate: Get Technical Assessment for Registration
  app.get('/api/candidate/assessments/:registrationId', authMiddleware, (req: any, res) => {
    try {
      const { registrationId } = req.params;
      const reg = db.getRegistrationById(registrationId);
      if (!reg) return res.status(404).json({ error: 'Application registration not found' });

      if (req.user.role === UserRole.CANDIDATE && reg.candidateId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied to this assessment' });
      }

      const job = db.getJobById(reg.jobId);
      let assessment = db.getAssessments().find(a => a.jobId === reg.jobId);

      // If no custom assessment was created yet for this job, generate a high-quality default technical assessment
      if (!assessment) {
        const skills = job?.requiredSkills?.length ? job.requiredSkills : ['Data Structures', 'JavaScript', 'Problem Solving'];
        const defaultQuestions: AssessmentQuestion[] = [
          {
            id: 'q_mcq_1',
            questionText: `In ${skills[0] || 'System Architecture'}, what is the primary computational benefit of utilizing an indexed hash map or B-Tree index?`,
            type: 'MULTIPLE_CHOICE',
            options: [
              'Reduces average search complexity to O(1) or O(log n) compared to linear O(n) scans',
              'Completely eliminates disk I/O overhead permanently across all transactions',
              'Prevents any memory allocation from occurring in the garbage collector',
              'Converts asynchronous promises into synchronous blocking operations'
            ],
            correctOptionIndex: 0,
            marks: 10,
            skillsTested: [skills[0] || 'Computer Science Fundamentals'],
          },
          {
            id: 'q_mcq_2',
            questionText: 'When designing a distributed service, which pattern prevents cascading failures when a downstream microservice is degraded or unresponsive?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Spin-lock Busy Waiting',
              'Circuit Breaker Pattern with Fallbacks',
              'Unbounded Queue Retry Loop',
              'Synchronous RPC Chaining'
            ],
            correctOptionIndex: 1,
            marks: 10,
            skillsTested: ['System Architecture', 'Distributed Systems'],
          },
          {
            id: 'q_mcq_3',
            questionText: 'Which HTTP response status code is standard and semantically correct for requesting rate limiting or throttling?',
            type: 'MULTIPLE_CHOICE',
            options: [
              '400 Bad Request',
              '404 Not Found',
              '429 Too Many Requests',
              '503 Service Unavailable'
            ],
            correctOptionIndex: 2,
            marks: 10,
            skillsTested: ['Web Protocols & APIs'],
          },
          {
            id: 'q_code_1',
            questionText: 'Write a function findFirstNonRepeating(str: string): string | null that takes a string and returns the first non-repeating character. If all characters repeat or the string is empty, return null.',
            type: 'CODING',
            marks: 20,
            skillsTested: ['Algorithms', 'String Manipulation'],
            codingLanguage: 'javascript',
            codingTemplate: `function findFirstNonRepeating(str) {\n  // Build frequency map and return first character with count === 1\n  const charMap = {};\n  for (const ch of str) {\n    charMap[ch] = (charMap[ch] || 0) + 1;\n  }\n  for (const ch of str) {\n    if (charMap[ch] === 1) return ch;\n  }\n  return null;\n}`,
            sampleInput: '"swiss"',
            sampleOutput: '"w"',
            testCases: [
              { input: '"swiss"', expectedOutput: '"w"', isHidden: false, explanation: 'w is the first character that appears once.' },
              { input: '"aabbcc"', expectedOutput: 'null', isHidden: false, explanation: 'All characters repeat.' },
              { input: '"developer"', expectedOutput: '"d"', isHidden: true, explanation: 'Hidden test case' },
            ],
          }
        ];

        assessment = db.createAssessment({
          id: 'asmt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          jobId: reg.jobId,
          companyId: reg.companyId,
          recruiterId: job?.recruiterId || 'system',
          title: `${job?.title || 'Technical Role'} - Round 2 Technical Assessment`,
          description: 'Comprehensive technical evaluation covering domain theory and algorithmic coding challenges.',
          durationMinutes: 30,
          passingScore: 70,
          difficulty: QuestionDifficulty.MEDIUM,
          skillsTested: skills,
          questions: defaultQuestions,
          negativeMarking: false,
          randomization: true,
          attemptLimit: 1,
          antiCheatingEnabled: true,
          isPublished: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Check if candidate has already submitted
      const existingSubmission = db.getAssessmentSubmissions().find(
        s => s.registrationId === reg.id && s.candidateId === req.user.id
      );

      // Sanitize questions for candidate (strip correctOptionIndex so candidate cannot cheat)
      const sanitizedQuestions = assessment.questions.map(q => {
        const { correctOptionIndex: _secret, testCases, ...safeQ } = q as any;
        const safeTestCases = (testCases || []).map((tc: any) => ({
          input: tc.input,
          expectedOutput: tc.isHidden ? '(Evaluated on submission)' : tc.expectedOutput,
          isHidden: tc.isHidden,
          explanation: tc.explanation,
        }));
        return {
          ...safeQ,
          testCases: safeTestCases,
        };
      });

      return res.json({
        success: true,
        assessment: {
          ...assessment,
          questions: sanitizedQuestions,
        },
        job: {
          id: job?.id,
          title: job?.title,
          company: job?.company,
        },
        alreadySubmitted: !!existingSubmission,
        previousSubmission: existingSubmission,
        roundProgression: reg.roundProgression,
      });
    } catch (err: any) {
      console.error('Candidate get assessment error:', err);
      return res.status(500).json({ error: 'Failed to retrieve technical assessment' });
    }
  });

  // Candidate: Submit Technical Assessment
  app.post('/api/candidate/assessments/submit', authMiddleware, async (req: any, res) => {
    try {
      const { registrationId, answers, timeTakenMinutes, violationsCount } = req.body;
      if (!registrationId || !answers) {
        return res.status(400).json({ error: 'registrationId and answers are required' });
      }

      const reg = db.getRegistrationById(registrationId);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      if (req.user.role === UserRole.CANDIDATE && reg.candidateId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied to this assessment' });
      }

      // Strictly enforce maximum 1 attempt per candidate for technical assessments
      const existingSubmission = db.getAssessmentSubmissions().find(
        s => s.registrationId === reg.id || (s.candidateId === req.user.id && s.jobId === reg.jobId)
      );
      if (existingSubmission || (reg.attemptCount && reg.attemptCount >= 1) || reg.technicalAssessmentCompleted) {
        return res.status(403).json({
          error: 'Maximum attempt limit reached. Every technical assessment allows strictly a single attempt only (1/1).',
          attemptCount: Math.max(reg.attemptCount || 1, 1),
          maxAttempts: 1,
          alreadySubmitted: true,
          previousSubmission: existingSubmission,
        });
      }

      const job = db.getJobById(reg.jobId);
      const assessment = db.getAssessments().find(a => a.jobId === reg.jobId);
      if (!assessment) return res.status(404).json({ error: 'Assessment not found for this job' });

      // Evaluate answers
      let totalMarks = 0;
      let earnedMarks = 0;
      let numCorrect = 0;
      let numIncorrect = 0;
      let aptitudeEarned = 0;
      let aptitudeTotal = 0;
      let codingEarned = 0;
      let codingTotal = 0;

      assessment.questions.forEach((q) => {
        const qMarks = q.marks || 10;
        totalMarks += qMarks;

        const userAns = answers[q.id];
        if (q.type === 'MULTIPLE_CHOICE') {
          aptitudeTotal += qMarks;
          if (userAns !== undefined && Number(userAns) === q.correctOptionIndex) {
            earnedMarks += qMarks;
            aptitudeEarned += qMarks;
            numCorrect++;
          } else {
            numIncorrect++;
          }
        } else if (q.type === 'CODING') {
          codingTotal += qMarks;
          const submittedCode = typeof userAns === 'string' ? userAns : (userAns?.code || '');
          if (submittedCode && submittedCode.trim().length > 20) {
            earnedMarks += qMarks;
            codingEarned += qMarks;
            numCorrect++;
          } else {
            numIncorrect++;
          }
        } else {
          aptitudeTotal += qMarks;
          if (userAns && String(userAns).trim().length > 0) {
            earnedMarks += qMarks;
            aptitudeEarned += qMarks;
            numCorrect++;
          } else {
            numIncorrect++;
          }
        }
      });

      const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
      const aptitudeScore = aptitudeTotal > 0 ? Math.round((aptitudeEarned / aptitudeTotal) * 100) : percentage;
      const codingScore = codingTotal > 0 ? Math.round((codingEarned / codingTotal) * 100) : percentage;
      const passingScore = assessment.passingScore || 70;
      const passed = percentage >= passingScore;

      const submission: AssessmentSubmission = {
        id: 'sub_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        assessmentId: assessment.id,
        candidateId: req.user.id,
        registrationId: reg.id,
        jobId: reg.jobId,
        score: earnedMarks,
        percentage,
        aptitudeScore,
        codingScore,
        totalQuestions: assessment.questions.length,
        attempted: Object.keys(answers).length,
        correct: numCorrect,
        incorrect: numIncorrect,
        timeTakenMinutes: Number(timeTakenMinutes) || 15,
        passed,
        integrityStatus: (violationsCount && Number(violationsCount) > 2) ? 'FLAGGED' : 'CLEAN',
        submittedAt: new Date().toISOString(),
      };

      db.createAssessmentSubmission(submission);
      neonService.saveAssessmentSubmission(submission).catch(() => {});

      // Update candidate pipeline progression
      const progression: RoundProgressionRecord[] = (reg.roundProgression && reg.roundProgression.length > 0)
        ? [...reg.roundProgression]
        : (job?.rounds || getDefaultPipelineRounds(job?.title)).map(r => ({
            roundNumber: r.roundNumber,
            roundType: r.roundType,
            roundName: r.name,
            status: RoundStatus.LOCKED,
            minQualifyingScore: r.minQualifyingScore,
          }));

      const round2Idx = progression.findIndex(r => r.roundNumber === 2 || r.roundType === RoundType.TECHNICAL_ASSESSMENT);
      if (round2Idx !== -1) {
        progression[round2Idx].status = passed ? RoundStatus.QUALIFIED : RoundStatus.REJECTED;
        progression[round2Idx].score = percentage;
        progression[round2Idx].completedAt = new Date().toISOString();
        progression[round2Idx].feedback = passed
          ? `Passed Technical Assessment with ${percentage}% score (Cutoff: ${passingScore}%). Advanced to Round 3 AI Interview.`
          : `Scored ${percentage}%, below the qualifying cutoff of ${passingScore}%.`;

        if (passed && round2Idx + 1 < progression.length) {
          progression[round2Idx + 1].status = RoundStatus.IN_PROGRESS;
        }
      }

      const nextRoundNum = passed ? 3 : 2;
      const overallStatus = passed ? 'IN_PROGRESS' : 'REJECTED';
      const updatedAttempts = 1;

      const updatedReg = db.updateRegistration(registrationId, {
        roundProgression: progression,
        currentRoundNumber: nextRoundNum,
        overallPipelineStatus: overallStatus as any,
        attemptCount: updatedAttempts,
        maxAttempts: 1,
        technicalAssessmentCompleted: true,
        technicalAssessmentScore: percentage,
        scores: {
          ...(reg.scores || {}),
          technicalScore: percentage,
          assessmentPercentage: percentage,
          aptitudeScore,
          codingScore,
        },
      });
      if (updatedReg) {
        neonService.saveInterviewRegistration(updatedReg).catch(() => {});
      }

      // Send email notification to candidate
      const candidateUser = db.findUserById(req.user.id);
      if (candidateUser?.email) {
        if (passed) {
          await emailService.sendTechnicalAssessmentClearedEmail({
            toEmail: candidateUser.email,
            candidateName: candidateUser.fullName,
            jobTitle: job?.title || 'Open Position',
            companyName: job?.company?.name || 'Hiring Team',
            score: percentage,
            passingScore,
            interviewCode: reg.interviewCode,
            nextSectionName: 'Stage 3: AI Technical Voice Interview',
          });
        } else {
          await emailService.sendPipelineUpdateEmail({
            toEmail: candidateUser.email,
            candidateName: candidateUser.fullName,
            jobTitle: job?.title || 'Open Position',
            companyName: job?.company?.name || 'Hiring Team',
            roundNumber: 2,
            roundName: 'Technical Assessment',
            status: RoundStatus.REJECTED,
            feedback: `Thank you for taking the Technical Assessment. You scored ${percentage}%, which did not meet the ${passingScore}% qualifying cutoff.`,
            score: percentage,
          });
        }
      }

      return res.json({
        success: true,
        submission,
        qualified: passed,
        percentage,
        passingScore,
        earnedMarks,
        totalMarks,
        registration: updatedReg,
      });
    } catch (err: any) {
      console.error('Submit assessment error:', err);
      return res.status(500).json({ error: 'Failed to submit technical assessment' });
    }
  });

  // =========================================================================
  // 3B. EXTERNAL TECHNICAL ASSESSMENT PORTAL INTEGRATION APIS
  // (Connects external exam portal by email & 12-digit code, provides recruiter questions,
  // and syncs pass/fail cutoff back to DB to unlock AI Interview or reject candidate)
  // =========================================================================

  // External Portal: Authenticate & Authorize Candidate Exam Session using 12-digit Technical Code (with optional Email)
  const handleExternalAssessmentAuth = async (req: any, res: any) => {
    try {
      const code = req.body?.code || req.query?.code || req.body?.assessmentCode || req.query?.assessmentCode || req.params?.code;
      const email = req.body?.email || req.query?.email;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: '12-digit technical assessment code is required.',
        });
      }

      const cleanCode = String(code).trim().toUpperCase();
      const cleanEmail = email ? String(email).trim().toLowerCase() : '';

      // 1. Find registration by 12-digit technical code or interview code
      let reg = await db.findRegistrationByTechnicalAssessmentCodeAsync(cleanCode);

      // 2. If not found by registration code directly, check if code belongs to a job
      let job: Job | undefined;
      if (reg) {
        job = db.getJobById(reg.jobId);
      }
      if (!job) {
        job = await db.findJobByTechnicalAssessmentCodeAsync(cleanCode);
        if (job && !reg) {
          // Check if candidate registration exists for this job
          if (cleanEmail) {
            const userByEmail = db.findUserByEmail(cleanEmail);
            if (userByEmail) {
              reg = db.getRegistrations().find(r => r.jobId === job!.id && r.candidateId === userByEmail.id);
            }
          }
          if (!reg) {
            reg = db.getRegistrations().find(r => r.jobId === job!.id);
          }
        }
      }

      if (!job && !reg) {
        return res.status(404).json({
          success: false,
          error: `Assessment code '${cleanCode}' is invalid or expired. Please verify your 12-digit assessment code.`,
        });
      }

      if (!job && reg) {
        job = db.getJobById(reg.jobId);
      }

      // Check job active status
      if (job && job.status !== JobStatus.ACTIVE) {
        return res.status(400).json({
          success: false,
          error: `The recruitment opportunity '${job.title}' is no longer active.`,
        });
      }

      // 3. Resolve candidate identity
      let candidateUser = cleanEmail ? db.findUserByEmail(cleanEmail) : undefined;
      if (!candidateUser && reg) {
        candidateUser = db.findUserById(reg.candidateId);
      }
      if (!candidateUser) {
        candidateUser = {
          id: reg?.candidateId || crypto.randomUUID(),
          email: cleanEmail || 'candidate@assessment.io',
          fullName: 'Assessment Candidate',
          role: UserRole.CANDIDATE,
          isVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // 4. Get recruiter-configured questions for this job
      let assessment = db.getAssessments().find(a => a.jobId === job!.id);
      let questions: any[] = [];
      if (assessment?.questions && assessment.questions.length > 0) {
        questions = assessment.questions;
      } else if (job!.technicalAssessmentQuestions && job!.technicalAssessmentQuestions.length > 0) {
        questions = job!.technicalAssessmentQuestions;
      } else {
        // Query Neon DB directly for recruiter-uploaded questions
        const neonQuestions = await neonService.getTechnicalQuestionsForJob(job!.id);
        if (neonQuestions && neonQuestions.length > 0) {
          questions = neonQuestions;
        } else {
          questions = buildDefaultAssessmentQuestions(job!.title, job!.requiredSkills || ['Computer Science']);
        }
      }

      // Check if already completed or single attempt consumed
      const round2 = Array.isArray(reg?.roundProgression)
        ? reg.roundProgression.find(r => r.roundNumber === 2 || r.roundType === RoundType.TECHNICAL_ASSESSMENT)
        : undefined;
      const existingSub = reg ? db.getAssessmentSubmissions().find(s => s.registrationId === reg.id) : undefined;
      const isAlreadySubmitted = Boolean(
        existingSub ||
        round2?.status === RoundStatus.QUALIFIED ||
        round2?.status === RoundStatus.REJECTED ||
        (reg?.attemptCount && reg.attemptCount >= 1) ||
        reg?.technicalAssessmentCompleted
      );

      return res.json({
        success: true,
        candidate: {
          id: candidateUser.id,
          name: candidateUser.fullName,
          email: candidateUser.email,
        },
        job: {
          id: job!.id,
          title: job!.title,
          companyName: job!.company?.name || 'Hiring Organization',
        },
        registrationId: reg?.id || 'reg_' + job!.id,
        technicalAssessmentCode: reg?.technicalAssessmentCode || job!.technicalAssessmentCode || cleanCode,
        durationMinutes: assessment?.durationMinutes || job!.durationMinutes || 45,
        passingScore: assessment?.passingScore || round2?.minQualifyingScore || 70,
        questionsCount: questions.length,
        questions: questions.map(q => ({
          ...q,
          correctOptionIndex: (q as any).correctOptionIndex,
          testCases: (q as any).testCases || [],
        })),
        isAlreadySubmitted,
        attemptLimitReached: isAlreadySubmitted,
        attemptCount: isAlreadySubmitted ? 1 : (reg?.attemptCount || 0),
        maxAttempts: 1,
        currentRoundStatus: round2?.status || (isAlreadySubmitted ? RoundStatus.QUALIFIED : RoundStatus.IN_PROGRESS),
        achievedScore: round2?.score ?? existingSub?.percentage ?? existingSub?.score,
      });
    } catch (err: any) {
      console.error('External assessment auth error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error authenticating candidate.' });
    }
  };

  app.post('/api/external-assessment/auth', handleExternalAssessmentAuth);
  app.get('/api/external-assessment/auth', handleExternalAssessmentAuth);
  app.get('/api/external-assessment/verify/:code', handleExternalAssessmentAuth);
  app.get('/api/external-assessment/:code', handleExternalAssessmentAuth);

  // External Portal: Submit Assessment Results (Syncs DB, checks cutoff, and unlocks AI interview or rejects)
  app.post('/api/external-assessment/sync-result', async (req: any, res) => {
    try {
      const { email, code, registrationId, percentage, score, answers, timeTakenMinutes, violationsCount } = req.body;
      if (!code && !registrationId) {
        return res.status(400).json({ success: false, error: 'Either 12-digit code or registrationId is required.' });
      }

      let reg = registrationId ? db.getRegistrationById(registrationId) : undefined;
      if (!reg && code) {
        reg = await db.findRegistrationByTechnicalAssessmentCodeAsync(String(code).trim().toUpperCase());
      }

      if (!reg) {
        return res.status(404).json({ success: false, error: 'Application registration not found.' });
      }

      // Strictly enforce maximum 1 attempt per candidate for technical assessment
      const existingSub = db.getAssessmentSubmissions().find(
        s => s.registrationId === reg.id || (s.candidateId === reg.candidateId && s.jobId === reg.jobId)
      );
      if (existingSub || (reg.attemptCount && reg.attemptCount >= 1) || reg.technicalAssessmentCompleted) {
        return res.status(403).json({
          success: false,
          error: 'Maximum attempt limit reached. Technical assessment allows strictly a single attempt only (1/1).',
          attemptCount: Math.max(reg.attemptCount || 1, 1),
          maxAttempts: 1,
          alreadySubmitted: true,
          previousScore: reg.technicalAssessmentScore ?? existingSub?.percentage ?? existingSub?.score,
        });
      }

      const job = db.getJobById(reg.jobId);
      const assessment = db.getAssessments().find(a => a.jobId === reg.jobId);
      const candidateUser = db.findUserById(reg.candidateId);

      // Determine passing cutoff
      const round2Meta = Array.isArray(reg.roundProgression)
        ? reg.roundProgression.find(r => r.roundNumber === 2 || r.roundType === RoundType.TECHNICAL_ASSESSMENT)
        : undefined;
      const passingCutoff = assessment?.passingScore || round2Meta?.minQualifyingScore || 70;
      const finalScore = Number(percentage ?? score ?? 0);
      const passed = finalScore >= passingCutoff;

      // Update candidate pipeline progression in database
      const progression: RoundProgressionRecord[] = (Array.isArray(reg.roundProgression) && reg.roundProgression.length > 0)
        ? [...reg.roundProgression]
        : (job?.rounds || getDefaultPipelineRounds(job?.title)).map(r => ({
            roundNumber: r.roundNumber,
            roundType: r.roundType,
            roundName: r.name,
            status: RoundStatus.LOCKED,
            minQualifyingScore: r.minQualifyingScore,
          }));

      const round2Idx = progression.findIndex(r => r.roundNumber === 2 || r.roundType === RoundType.TECHNICAL_ASSESSMENT);
      if (round2Idx !== -1) {
        progression[round2Idx].status = passed ? RoundStatus.QUALIFIED : RoundStatus.REJECTED;
        progression[round2Idx].score = finalScore;
        progression[round2Idx].completedAt = new Date().toISOString();
        progression[round2Idx].feedback = passed
          ? `Cleared External Technical Assessment with ${finalScore}% (Cutoff: ${passingCutoff}%). Round 3 Live AI Interview is now UNLOCKED.`
          : `Scored ${finalScore}% on External Technical Assessment, falling below the mandatory ${passingCutoff}% cutoff. Application rejected.`;

        // If candidate qualified Round 2, unlock Round 3 (AI Technical Interview)
        if (passed && round2Idx + 1 < progression.length) {
          progression[round2Idx + 1].status = RoundStatus.IN_PROGRESS;
        }
      }

      const nextRoundNum = passed ? 3 : 2;
      const overallStatus = passed ? 'IN_PROGRESS' : 'REJECTED';

      const updatedReg = db.updateRegistration(reg.id, {
        roundProgression: progression,
        currentRoundNumber: nextRoundNum,
        interviewStatus: passed ? InterviewStatus.READY_TO_ATTEND : InterviewStatus.COMPLETED,
        status: passed ? ApplicationStatus.INTERVIEW_READY : ApplicationStatus.REJECTED,
        overallPipelineStatus: overallStatus as any,
        attemptCount: 1,
        maxAttempts: 1,
        technicalAssessmentCompleted: true,
        technicalAssessmentScore: finalScore,
        scores: {
          ...(reg.scores || {}),
          technicalScore: finalScore,
          assessmentPercentage: finalScore,
        },
      });
      if (updatedReg) {
        neonService.saveInterviewRegistration(updatedReg).catch(() => {});
      }

      // Save submission record
      if (assessment) {
        const subId = 'ext_sub_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        const subRecord = {
          id: subId,
          assessmentId: assessment.id,
          candidateId: reg.candidateId,
          registrationId: reg.id,
          jobId: reg.jobId,
          score: finalScore,
          percentage: finalScore,
          totalQuestions: assessment.questions.length,
          attempted: answers ? Object.keys(answers).length : assessment.questions.length,
          correct: Math.round((finalScore / 100) * assessment.questions.length),
          incorrect: assessment.questions.length - Math.round((finalScore / 100) * assessment.questions.length),
          timeTakenMinutes: Number(timeTakenMinutes) || 30,
          passed,
          integrityStatus: ((violationsCount && Number(violationsCount) > 2) ? 'FLAGGED' : 'CLEAN') as 'FLAGGED' | 'CLEAN',
          submittedAt: new Date().toISOString(),
        };
        db.createAssessmentSubmission(subRecord);
        neonService.saveAssessmentSubmission(subRecord).catch(() => {});
      }

      // Send automated status update email to candidate
      if (candidateUser?.email) {
        if (passed) {
          emailService.sendTechnicalAssessmentClearedEmail({
            toEmail: candidateUser.email,
            candidateName: candidateUser.fullName,
            jobTitle: job?.title || 'Job Opportunity',
            companyName: job?.company?.name || 'Hiring Team',
            score: finalScore,
            passingScore: passingCutoff,
            interviewCode: reg.interviewCode,
            nextSectionName: 'Stage 3: AI Technical Voice Interview',
          }).catch(err => console.warn('Sync cleared email error:', err?.message));
        } else {
          emailService.sendPipelineUpdateEmail({
            toEmail: candidateUser.email,
            candidateName: candidateUser.fullName,
            jobTitle: job?.title || 'Job Opportunity',
            companyName: job?.company?.name || 'Hiring Team',
            roundNumber: 2,
            roundName: 'Technical Assessment',
            status: RoundStatus.REJECTED,
            feedback: `Thank you for taking the Technical Assessment. Your score of ${finalScore}% did not reach the qualifying cutoff of ${passingCutoff}%. Your application has been marked as Rejected.`,
            score: finalScore,
          }).catch(err => console.warn('Sync pipeline email error:', err?.message));
        }
      }

      return res.json({
        success: true,
        passed,
        percentage: finalScore,
        passingCutoff,
        aiInterviewUnlocked: passed,
        interviewAccessCode: passed ? reg.interviewCode : null,
        message: passed
          ? `Score ${finalScore}% meets the ${passingCutoff}% cutoff! AI Technical Interview is now UNLOCKED.`
          : `Score ${finalScore}% is below the ${passingCutoff}% cutoff. Candidate has been marked REJECTED and AI interview remains LOCKED.`,
        registration: updatedReg,
      });
    } catch (err: any) {
      console.error('External assessment sync error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error syncing assessment results.' });
    }
  });

  // ==========================================
  // 4. INTERVIEW ACCESS VALIDATION & ORCHESTRATION
  // ==========================================

  // Step 20: Validate interview access code with all 12 checks
  app.post('/api/interview/validate-access', authMiddleware, (req: any, res) => {
    try {
      const { interviewCode } = req.body;
      if (!interviewCode) return res.status(400).json({ error: 'Interview access code is required' });

      const user = db.findUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Candidate not found' });

      const validation = interviewOrchestrator.validateAccessCode(interviewCode, user.email);
      if (!validation.success) {
        return res.status(403).json({
          error: validation.message,
          isTechnicalCode: (validation as any).isTechnicalCode,
          registration: validation.registration,
        });
      }

      return res.json({
        success: true,
        message: validation.message,
        registration: validation.registration,
        job: validation.job,
        company: validation.company,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Validation process failed' });
    }
  });

  // Start Core Interview
  app.post('/api/interview/start', authMiddleware, async (req: any, res) => {
    try {
      const { registrationId } = req.body;
      if (!registrationId) return res.status(400).json({ error: 'Registration ID required' });

      const result = await interviewOrchestrator.startInterview(registrationId);
      return res.json({
        success: true,
        firstQuestion: result.firstQuestion,
        spokenGreeting: result.spokenGreeting,
        sessionStatus: result.session.status,
        questionIndex: result.session.currentQuestionIndex,
        totalQuestions: result.session.totalQuestions,
      });
    } catch (err: any) {
      console.error('Interview start error:', err);
      return res.status(500).json({ error: err.message || 'Failed to initialize interview' });
    }
  });

  // Candidate Spoken Speech / Answer Submission
  app.post('/api/interview/candidate-speech', authMiddleware, async (req: any, res) => {
    try {
      const { registrationId, candidateSpeech } = req.body;
      if (!registrationId || !candidateSpeech) {
        return res.status(400).json({ error: 'registrationId and candidateSpeech are required.' });
      }

      const response = await interviewOrchestrator.handleCandidateSpeech({
        registrationId,
        candidateSpeech,
      });

      return res.json(response);
    } catch (err: any) {
      console.error('Candidate speech processing error:', err);
      return res.status(500).json({ error: err.message || 'Failed to process speech' });
    }
  });

  // Proctoring / Integrity Event Logger (Section 27 & 28)
  app.post('/api/interview/proctoring-event', authMiddleware, async (req: any, res) => {
    try {
      const { registrationId, eventType, metadata } = req.body;
      if (!registrationId || !eventType) {
        return res.status(400).json({ error: 'registrationId and eventType required' });
      }

      const result = await interviewOrchestrator.recordProctoringEvent({
        registrationId,
        eventType: eventType as ProctoringEventType,
        metadata,
      });

      return res.json(result);
    } catch (err: any) {
      console.error('Proctoring error:', err);
      return res.status(500).json({ error: 'Failed to record proctoring signal' });
    }
  });

  // ==========================================
  // 5. REPORTS & DASHBOARD ANALYTICS
  // ==========================================

  // Candidate: Get permitted candidate report
  app.get('/api/reports/candidate/:interviewId', authMiddleware, (req: any, res) => {
    try {
      const report = db.getCandidateReport(req.params.interviewId);
      if (!report) return res.status(404).json({ error: 'Candidate report not yet generated or available' });
      return res.json(report);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error fetching candidate report' });
    }
  });

  // Dedicated Recruiter API Router
  app.use('/api/recruiter', authMiddleware, recruiterRouter);

  // Recruiter: Metrics for recruiter dashboard cards (fallback)
  app.get('/api/recruiter/metrics', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }

      const allJobs = db.getJobs();
      const allRegistrations = db.getRegistrations();
      const recruiterProfile = db.data.recruiters?.find((r: any) => r.userId === req.user.id);
      const companyId = recruiterProfile?.companyId;

      const jobs = allJobs.filter(j => {
        if (req.user.role === UserRole.ADMIN) return true;
        return j.recruiterId === req.user.id || (companyId && j.companyId === companyId);
      });

      const myJobIds = new Set(jobs.map(j => j.id));

      const registrations = allRegistrations.filter(r => {
        if (req.user.role === UserRole.ADMIN) return true;
        return myJobIds.has(r.jobId) || (companyId && r.companyId === companyId);
      });

      const activeJobs = jobs.filter(j => j.status === JobStatus.ACTIVE).length;
      const totalApplications = registrations.length;
      const interviewsReady = registrations.filter(
        r => r.computedStatus === 'Attend Interview' || r.interviewStatus === InterviewStatus.READY_TO_ATTEND
      ).length;
      const interviewsCompleted = registrations.filter(
        r => r.computedStatus === 'Completed' || r.interviewStatus === InterviewStatus.COMPLETED
      ).length;
      const shortlisted = registrations.filter(
        r => r.status === ApplicationStatus.SHORTLISTED
      ).length;
      const malpracticeFlagged = registrations.filter(
        r => r.interviewStatus === InterviewStatus.MALPRACTICE_TERMINATED
      ).length;

      return res.json({
        activeJobs,
        totalApplications,
        interviewsReady,
        interviewsCompleted,
        shortlisted,
        malpracticeFlagged,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to calculate metrics' });
    }
  });

  // Recruiter: View applicants
  app.get('/api/recruiter/candidates', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }

      const allRegistrations = db.getRegistrations();
      const allJobs = db.getJobs();
      const recruiterProfile = db.data.recruiters?.find((r: any) => r.userId === req.user.id);
      const companyId = recruiterProfile?.companyId;

      const myJobIds = new Set(
        allJobs
          .filter(j => req.user.role === UserRole.ADMIN || j.recruiterId === req.user.id || (companyId && j.companyId === companyId))
          .map(j => j.id)
      );

      const filteredRegistrations = allRegistrations.filter(reg => {
        if (req.user.role === UserRole.ADMIN) return true;
        return myJobIds.has(reg.jobId) || (companyId && reg.companyId === companyId);
      });

      const reports = db.getAllRecruiterReports();

      const enriched = filteredRegistrations.map(reg => {
        const rep = reports.find(r => r.interviewId === reg.id);
        const candidateProfile = db.getCandidateProfile(reg.candidateId);
        return {
          ...reg,
          report: rep,
          candidateProfile,
        };
      });

      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve candidates' });
    }
  });

  // Recruiter: Shortlist / Reject / Hold candidate
  app.post('/api/recruiter/candidate-action', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter authorization required' });
      }

      const { registrationId, action, notes } = req.body;
      if (!registrationId || !action) return res.status(400).json({ error: 'Missing parameters' });

      let newStatus = ApplicationStatus.UNDER_REVIEW;
      if (action === 'SHORTLIST' || action === 'ACCEPT') newStatus = ApplicationStatus.SHORTLISTED;
      if (action === 'REJECT') newStatus = ApplicationStatus.REJECTED;
      if (action === 'HOLD') newStatus = ApplicationStatus.UNDER_REVIEW;

      const updated = db.updateRegistration(registrationId, { status: newStatus });
      const rep = db.getRecruiterReport(registrationId);
      if (rep) {
        rep.applicationStatus = newStatus;
        if (notes) rep.recruiterNotes = notes;
        db.saveRecruiterReport(rep);
      }

      return res.json({ success: true, updated, action });
    } catch (err: any) {
      return res.status(500).json({ error: 'Action failed' });
    }
  });

  // Recruiter: Detailed Report
  app.get('/api/reports/recruiter/:interviewId', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }

      const report = db.getRecruiterReport(req.params.interviewId);
      if (!report) return res.status(404).json({ error: 'Report not found' });
      return res.json(report);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error fetching recruiter report' });
    }
  });

  // Recruiter: All Reports
  app.get('/api/recruiter/reports', authMiddleware, (req: any, res) => {
    try {
      if (req.user.role !== UserRole.RECRUITER && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Recruiter role required' });
      }
      const allReports = db.getAllRecruiterReports();
      const allJobs = db.getJobs();
      const allRegistrations = db.getRegistrations();
      const recruiterProfile = db.data.recruiters?.find((r: any) => r.userId === req.user.id);
      const companyId = recruiterProfile?.companyId;

      const myJobIds = new Set(
        allJobs
          .filter(j => req.user.role === UserRole.ADMIN || j.recruiterId === req.user.id || (companyId && j.companyId === companyId))
          .map(j => j.id)
      );

      const myInterviewIds = new Set(
        allRegistrations
          .filter(r => req.user.role === UserRole.ADMIN || myJobIds.has(r.jobId) || (companyId && r.companyId === companyId))
          .map(r => r.id)
      );

      const filteredReports = allReports.filter(r => req.user.role === UserRole.ADMIN || myInterviewIds.has(r.interviewId));
      return res.json(filteredReports);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });

  // ==========================================
  // 6. SENT EMAIL LOGS / MAILBOX
  // ==========================================
  app.get('/api/mailbox', (req, res) => {
    try {
      const email = req.query.email as string;
      const logs = db.getEmailLogs(50);
      if (email) {
        return res.json(logs.filter(l => l.toEmail.toLowerCase() === email.toLowerCase().trim()));
      }
      return res.json(logs);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve email logs' });
    }
  });

  // ==========================================
  // 7. POSTGRESQL DATABASE & ANALYTICAL QUERIES
  // ==========================================

  // Initialize PostgreSQL Engine with full schema and seed data
  try {
    await postgresService.initialize();
  } catch (err: any) {
    console.error('[PostgreSQL Engine] Warning: Initialization error:', err.message);
  }

  // Get Predefined Queries List with executed results
  app.get('/api/database/queries', (req, res) => {
    try {
      const results = PREDEFINED_QUERIES.map(q => {
        let rows: any[] = [];
        let executionTimeMs = 0;
        let error: string | null = null;

        const start = Date.now();
        try {
          rows = postgresService.query(q.sql);
          executionTimeMs = Date.now() - start;
        } catch (e: any) {
          error = e.message;
        }

        return {
          id: q.id,
          name: q.name,
          category: q.category,
          description: q.description,
          sql: q.sql,
          rowCount: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          sampleRows: rows,
          executionTimeMs,
          error,
        };
      });

      return res.json({
        success: true,
        engine: 'PostgreSQL In-Memory Database (pg-mem)',
        schemaVersion: '1.0.0',
        totalPredefinedQueries: results.length,
        queries: results,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to execute predefined queries', details: err.message });
    }
  });

  // Execute Custom SQL Query
  app.post('/api/database/execute', (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql || typeof sql !== 'string') {
        return res.status(400).json({ error: 'SQL query string required' });
      }

      const trimmed = sql.trim();
      const start = Date.now();
      const rows = postgresService.query(trimmed);
      const executionTimeMs = Date.now() - start;

      const columns = Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : [];

      return res.json({
        success: true,
        sql: trimmed,
        rowCount: Array.isArray(rows) ? rows.length : 1,
        columns,
        rows: Array.isArray(rows) ? rows : [rows],
        executionTimeMs,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message,
        details: err.toString(),
      });
    }
  });

  // Database Schema Tables and Summary Stats
  app.get('/api/database/tables', (req, res) => {
    try {
      const tables = [
        'users',
        'user_sessions',
        'email_verifications',
        'candidate_profiles',
        'recruiter_profiles',
        'companies',
        'skills',
        'candidate_skills',
        'jobs',
        'job_skills',
        'resumes',
        'job_applications',
        'interview_registrations',
        'interviews',
        'interview_system_checks',
        'interview_questions',
        'interview_answers',
        'interview_transcript_messages',
        'interview_hints',
        'covered_concepts',
        'candidate_competencies',
        'candidate_behavior_metrics',
        'ai_assistance_signals',
        'proctoring_events',
        'malpractice_events',
        'interview_reports',
        'recruiter_decisions',
        'email_logs',
        'audit_logs',
      ];

      const tableStats = tables.map(tableName => {
        let count = 0;
        try {
          const resRows = postgresService.query(`SELECT COUNT(*) as count FROM ${tableName};`);
          count = Number(resRows[0]?.count || 0);
        } catch (e) {
          count = 0;
        }
        return {
          tableName,
          recordCount: count,
        };
      });

      return res.json({
        database: 'PostgreSQL Relational Storage',
        totalTables: tables.length,
        tables: tableStats,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to inspect tables', details: err.message });
    }
  });

  // Full Database JSON Export Endpoint
  app.get('/api/database/dump', (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      return res.json(db.data);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to export database', details: err.message });
    }
  });

  // ==========================================
  // 8. VITE MIDDLEWARE / STATIC ASSETS
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI Interviewer Server] Running on port ${PORT}`);
  });
}

startServer();
