import nodemailer, { Transporter } from 'nodemailer';
import { db } from './db.js';
import { EmailLog } from '../src/types/index.js';

export interface SendEmailOptions {
  toEmail: string;
  subject: string;
  template: 'EMAIL_OTP' | 'INTERVIEW_REGISTRATION' | 'INTERVIEW_REPORT' | 'OTHER';
  content: string;
  preview: string;
  htmlContent?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (!this.transporter) {
      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const user = process.env.SMTP_USER;
      const rawPass = process.env.SMTP_PASS || '';
      const pass = rawPass.replace(/\s+/g, '');

      if (user && pass) {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          tls: {
            rejectUnauthorized: false,
          },
        });
        console.log(`[Email Service] Nodemailer transporter initialized for ${user} via ${host}:${port}`);
      }
    }
    return this.transporter;
  }

  public async sendEmail(options: SendEmailOptions): Promise<EmailLog> {
    const log: EmailLog = {
      id: 'eml_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      toEmail: options.toEmail,
      subject: options.subject,
      template: options.template,
      status: 'SENT',
      payloadPreview: options.preview,
      sentAt: new Date().toISOString(),
      fullContent: options.content,
    };

    const transporter = this.getTransporter();
    if (transporter) {
      try {
        const fromAddress = process.env.SMTP_USER
          ? `"AI Interviewer Platform" <${process.env.SMTP_USER}>`
          : '"AI Interviewer Platform" <no-reply@aiinterviewer.com>';

        await transporter.sendMail({
          from: fromAddress,
          to: options.toEmail,
          subject: options.subject,
          text: options.content,
          html: options.htmlContent || `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap; line-height: 1.6; color: #1e293b;">${options.content}</div>`,
        });

        console.log(`[Email Service] Real SMTP email successfully sent to ${options.toEmail}: ${options.subject}`);
        log.status = 'SENT';
      } catch (err: any) {
        console.error(`[Email Service] SMTP dispatch failed to ${options.toEmail}:`, err.message);
        log.status = 'FAILED';
      }
    } else {
      console.log(`[Email Service] SMTP credentials not detected. In-memory notification saved for ${options.toEmail}`);
    }

    db.addEmailLog(log);
    return log;
  }

  public async sendGoogleWelcomeEmail(toEmail: string, candidateName: string, defaultPassword: string = 'Password123!'): Promise<EmailLog> {
    const subject = 'Welcome to AI Interviewer – Google Account Registered';
    const preview = `Your account has been connected with Google. Default password: ${defaultPassword}`;

    const content = `Welcome to AI Interviewer

Hi ${candidateName},

Your account has been successfully registered and authenticated via Google Account (${toEmail}).

ACCOUNT CREDENTIALS:
- Email: ${toEmail}
- Sign-In Method: Continue with Google OR Standard Login
- Default Password: ${defaultPassword}

You can attend AI technical interviews, upload resumes, and review your evaluation reports at any time.

Best regards,
The AI Interviewer Team`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 30px 15px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="background-color: #0f172a; padding: 24px 32px;">
                    <span style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px;">AI Interviewer</span>
                    <h1 style="color: #ffffff; margin: 8px 0 0 0; font-size: 20px; font-weight: 700;">Google Account Connected</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                      Hi <strong>${candidateName}</strong>,
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                      Your Google Account (<strong>${toEmail}</strong>) is now registered and verified for the <strong>AI Interviewer</strong> autonomous recruitment platform.
                    </p>
                    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 18px; margin: 20px 0;">
                      <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #1e3a8a;">Your Account Sign-In Details</h3>
                      <p style="margin: 4px 0; font-size: 13px; color: #1e293b;">• <strong>Email:</strong> ${toEmail}</p>
                      <p style="margin: 4px 0; font-size: 13px; color: #1e293b;">• <strong>Federation:</strong> Google Identity</p>
                      <p style="margin: 4px 0; font-size: 13px; color: #1e293b;">• <strong>Default Password:</strong> <code style="background-color: #dbeafe; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold;">${defaultPassword}</code></p>
                    </div>
                    <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                      You can log in either by clicking <strong>Continue with Google</strong> or by entering your email and password.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;

    return this.sendEmail({
      toEmail,
      subject,
      template: 'OTHER',
      content,
      preview,
      htmlContent,
    });
  }

  public async sendOtpEmail(toEmail: string, otp: string, candidateName: string): Promise<EmailLog> {
    const subject = 'Welcome to AI Interviewer – Verify Your Email';
    const preview = `Your verification OTP is ${otp}. Valid for 10 minutes.`;

    const content = `Welcome to AI Interviewer – Verify Your Email

Hi ${candidateName},

Thanks for registering with AI Interviewer.

We’re pleased to welcome you to our intelligent recruitment platform. Your account allows you to apply for eligible opportunities and attend secure AI-powered technical interviews.

Your verification OTP is:

${otp}

This OTP is valid for 10 minutes. Please do not share it with anyone.

Interview Preparation Guidelines:
Do:
• Use a working camera and microphone.
• Stay in a quiet, well-lit environment.
• Answer independently using your first-principles technical knowledge.
• Keep a stable internet connection.

Don’t:
• Switch tabs or leave the interview window.
• Use unauthorized external assistance or AI tools.
• Share credentials or verification OTP.

After successful verification, you can login and apply for jobs immediately.

Best regards,
The AI Interviewer Recruitment Team`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px;">AI Interviewer</span>
                    <h1 style="color: #ffffff; margin: 8px 0 0 0; font-size: 20px; font-weight: 700;">Account Email Verification</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                Hi <strong>${candidateName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                Thanks for creating an account on <strong>AI Interviewer</strong>. To complete your candidate registration and activate your application portal, please use the following one-time verification passcode:
              </p>

              <!-- OTP Callout Box -->
              <div style="background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;">
                <span style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Verification Code (OTP)</span>
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${otp}</span>
                <span style="font-size: 12px; color: #64748b; display: block; margin-top: 8px;">Valid for <strong>10 minutes</strong>. Never share this code with anyone.</span>
              </div>

              <!-- Rules & Guidelines -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Candidate Integrity Guidelines</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #475569;">
                  <tr>
                    <td style="padding-bottom: 8px; vertical-align: top; width: 50%;">
                      <strong style="color: #059669;">✓ DO:</strong>
                      <ul style="margin: 4px 0 0 0; padding-left: 18px; color: #334155;">
                        <li>Ensure working mic & camera</li>
                        <li>Stay in a quiet environment</li>
                        <li>Answer independently</li>
                      </ul>
                    </td>
                    <td style="padding-bottom: 8px; vertical-align: top; width: 50%;">
                      <strong style="color: #dc2626;">✗ DON'T:</strong>
                      <ul style="margin: 4px 0 0 0; padding-left: 18px; color: #334155;">
                        <li>Switch tabs during session</li>
                        <li>Use external AI or notes</li>
                        <li>Leave fullscreen lobby</li>
                      </ul>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                Once verified, you will be able to apply for active engineering positions and take autonomous voice interviews.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
              This is an automated security message from AI Interviewer Autonomous Recruitment Platform.<br>
              If you did not initiate this registration, please disregard this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendEmail({
      toEmail,
      subject,
      template: 'EMAIL_OTP',
      content,
      preview,
      htmlContent,
    });
  }

  public async sendRegistrationEmail(params: {
    toEmail: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    location: string;
    packageStr: string;
    durationMinutes: number;
    interviewCode: string;
  }): Promise<EmailLog> {
    const subject = `Interview Registration Confirmed – ${params.companyName}`;
    const preview = `Confirmed for ${params.jobTitle} at ${params.companyName}. Access Code: ${params.interviewCode}`;

    const content = `Hi ${params.candidateName},

Your registration for the ${params.jobTitle} opportunity at ${params.companyName} has been successfully confirmed.

Company: ${params.companyName}
Role: ${params.jobTitle}
Location: ${params.location}
Package: ${params.packageStr}

Interview Type:
AI Technical Interview

Duration:
~${params.durationMinutes} Minutes

Interview Access Code:
${params.interviewCode}

You will need this unique code before starting your interview. Please keep it confidential.

Before attending:
• Use a working camera and microphone.
• Use a desktop or laptop with a stable internet connection.
• Remain in a quiet location with adequate lighting.
• Answer questions independently using your authentic experience.
• Do not switch tabs or use unauthorized external assistance.

Access your interview directly in the "My Interviews" portal on AI Interviewer.

Best regards,
Talent Acquisition Team
${params.companyName}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; text-align: left;">
              <span style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px;">Registration Confirmed</span>
              <h1 style="color: #ffffff; margin: 8px 0 0 0; font-size: 20px; font-weight: 700;">${params.jobTitle}</h1>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">${params.companyName}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                Hi <strong>${params.candidateName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                Your application for <strong>${params.jobTitle}</strong> has been registered. Below is your official interview authorization code:
              </p>

              <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">Unique Interview Access Code</span>
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #166534; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${params.interviewCode}</span>
                <span style="font-size: 12px; color: #64748b; display: block; margin-top: 8px;">Estimated Duration: ~${params.durationMinutes} Minutes</span>
              </div>

              <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 13px; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px;">
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="font-weight: 600; width: 35%;">Company</td>
                  <td>${params.companyName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="font-weight: 600;">Location</td>
                  <td>${params.location}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">Package / Compensation</td>
                  <td>${params.packageStr}</td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                You may launch your session anytime before the deadline from your <strong>My Interviews</strong> portal.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
              Talent Acquisition Team • ${params.companyName} via AI Interviewer
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendEmail({
      toEmail: params.toEmail,
      subject,
      template: 'INTERVIEW_REGISTRATION',
      content,
      preview,
      htmlContent,
    });
  }

  public async sendReportEmail(params: {
    toEmail: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    overallSummary: string;
    strongAreas: string[];
    areasToImprove: string[];
    learningRecommendations: string[];
  }): Promise<EmailLog> {
    const subject = `Interview Assessment Report – ${params.jobTitle} – ${params.companyName}`;
    const preview = `Your interview report for ${params.jobTitle} at ${params.companyName} is ready.`;

    const content = `Dear ${params.candidateName},

Thank you for completing your technical interview for ${params.jobTitle} at ${params.companyName}.

Our autonomous evaluation engine has completed your candidate performance synthesis.

==============================================
INTERVIEW ASSESSMENT SUMMARY
==============================================
Status: COMPLETED
Role: ${params.jobTitle}
Company: ${params.companyName}

OVERALL SUMMARY:
${params.overallSummary}

KEY STRENGTHS:
${params.strongAreas.map(s => `• ${s}`).join('\n')}

AREAS FOR FURTHER DEVELOPMENT:
${params.areasToImprove.map(a => `• ${a}`).join('\n')}

CURATED LEARNING RECOMMENDATIONS:
${params.learningRecommendations.map(r => `• ${r}`).join('\n')}

You can view your full detailed breakdown in your AI Interviewer portal under "My Interviews".

Best regards,
Talent Assessment Team
${params.companyName}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; text-align: left;">
              <span style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px;">Evaluation Complete</span>
              <h1 style="color: #ffffff; margin: 8px 0 0 0; font-size: 20px; font-weight: 700;">Performance Assessment</h1>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">${params.jobTitle} • ${params.companyName}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                Dear <strong>${params.candidateName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                Thank you for completing your voice technical interview. Here is your autonomous evaluation summary:
              </p>

              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 6px;">Executive Evaluation</strong>
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">${params.overallSummary}</p>
              </div>

              <!-- Strengths -->
              <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #059669; text-transform: uppercase;">Key Technical Strengths</h4>
              <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
                ${params.strongAreas.map(s => `<li>${s}</li>`).join('')}
              </ul>

              <!-- Improvement -->
              <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #d97706; text-transform: uppercase;">Areas For Further Growth</h4>
              <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
                ${params.areasToImprove.map(a => `<li>${a}</li>`).join('')}
              </ul>

              <!-- Learning -->
              <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #2563eb; text-transform: uppercase;">Recommended Learning Paths</h4>
              <ul style="margin: 0 0 24px 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
                ${params.learningRecommendations.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
              Talent Assessment Team • ${params.companyName} via AI Interviewer
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendEmail({
      toEmail: params.toEmail,
      subject,
      template: 'INTERVIEW_REPORT',
      content,
      preview,
      htmlContent,
    });
  }

  public async sendPasswordResetOtpEmail(toEmail: string, otp: string, userName: string): Promise<EmailLog> {
    const subject = 'AI Interviewer – Password Reset Request';
    const preview = `Your password reset OTP is ${otp}. Valid for 10 minutes.`;

    const content = `AI Interviewer – Password Reset Request

Hi ${userName},

We received a request to reset the password for your AI Interviewer account associated with this email address.

Your Password Reset OTP is:

${otp}

This OTP is valid for 10 minutes. If you did not request a password reset, please ignore this email or contact security.

Best regards,
The AI Interviewer Security Team`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 32px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">AI Interviewer</h2>
              <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Password Reset Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                Hello <strong>${userName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                We received a request to reset your account password. Please use the following single-use verification code to set your new password:
              </p>
              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; display: inline-block;">${otp}</span>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Valid for 10 minutes • Do not share this code</p>
              </div>
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                If you did not request this change, you can safely disregard this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
              AI Interviewer Secure Authentication System
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendEmail({
      toEmail,
      subject,
      template: 'EMAIL_OTP',
      content,
      preview,
      htmlContent,
    });
  }

  public async sendScheduleNotification(toEmail: string, candidateName: string, jobTitle: string, companyName: string, interviewCode: string, startDate?: string, startTime?: string, endDate?: string, endTime?: string): Promise<EmailLog> {
    const subject = `Interview Schedule Update: ${jobTitle} at ${companyName}`;
    const preview = `Your interview has been scheduled. Code: ${interviewCode}`;
    const windowText = (startDate && startTime && endDate && endTime)
      ? `From ${startDate} ${startTime} to ${endDate} ${endTime}`
      : 'Schedule window updated by recruiter.';

    const content = `Dear ${candidateName},

Your interview schedule for ${jobTitle} at ${companyName} has been updated.

Interview Access Code: ${interviewCode}
Scheduled Window: ${windowText}

Please sign in to your dashboard to attend the interview within this scheduled window.

Best regards,
Talent Acquisition Team, ${companyName}`;

    return this.sendEmail({
      toEmail,
      subject,
      template: 'OTHER',
      content,
      preview,
    });
  }

  public async sendPipelineUpdateEmail(params: {
    toEmail: string;
    candidateName: string;
    jobTitle: string;
    companyName: string;
    roundNumber: number;
    roundName: string;
    status: string;
    feedback?: string;
    score?: number;
    interviewCode?: string;
  }): Promise<EmailLog> {
    const isSuccess = params.status === 'QUALIFIED' || params.status === 'SELECTED' || params.status === 'IN_PROGRESS';
    const subject = `Update on your application: ${params.jobTitle} at ${params.companyName} – Round ${params.roundNumber}: ${params.roundName}`;
    const preview = `Status: ${params.status}. ${params.roundName} update.`;

    // Strictly ensure ATS Score (Round 1 / Resume Screening) is NEVER exposed to candidates in email
    const isAtsScreening = params.roundNumber === 1 || (params.roundName || '').toLowerCase().includes('resume') || (params.roundName || '').toLowerCase().includes('ats');
    const scoreLine = (!isAtsScreening && typeof params.score === 'number') ? `Evaluation Score: ${params.score}%` : '';
    const feedbackLine = params.feedback ? `Notes / Status: ${params.feedback}` : '';
    const codeLine = params.interviewCode ? `Interview Code for next round: ${params.interviewCode}` : '';

    const content = `Dear ${params.candidateName},

We have an update regarding your recruitment pipeline for the role of ${params.jobTitle} at ${params.companyName}.

Round ${params.roundNumber}: ${params.roundName}
Round Status: ${params.status}
${scoreLine ? `${scoreLine}\n` : ''}${feedbackLine ? `${feedbackLine}\n` : ''}${codeLine ? `${codeLine}\n` : ''}
${isSuccess ? 'Congratulations on advancing through the pipeline! Please log into your candidate portal to view your progression.' : 'Thank you for your effort and time throughout our hiring process.'}

Best regards,
Talent Acquisition Team, ${params.companyName}`;

    return this.sendEmail({
      toEmail: params.toEmail,
      subject,
      template: 'OTHER',
      content,
      preview,
    });
  }

  public async sendTechnicalAssessmentClearedEmail(params: {
    toEmail: string;
    candidateName: string;
    jobTitle: string;
    companyName: string;
    score: number;
    passingScore?: number;
    interviewCode: string;
    nextSectionName?: string;
  }): Promise<EmailLog> {
    const passingCutoff = params.passingScore || 70;
    const nextSection = params.nextSectionName || 'Stage 3: AI Technical Voice Interview';
    const subject = `🎉 Congratulations! You Cleared the Technical Assessment – Next Section Access Code: ${params.interviewCode}`;
    const preview = `Congratulations! You scored ${params.score}% and qualified for ${nextSection}. Access code: ${params.interviewCode}`;

    const content = `Dear ${params.candidateName},

🎉 CONGRATULATIONS!

We are delighted to inform you that you have successfully CLEARED the Technical Assessment for the position of "${params.jobTitle}" at ${params.companyName}.

==================================================
ASSESSMENT RESULTS SUMMARY:
==================================================
• Status: QUALIFIED / CLEARED ✓
• Your Score: ${params.score}% (Minimum Cutoff: ${passingCutoff}%)
• Next Section: ${nextSection}

==================================================
YOUR ACCESS CODE TO ATTEND THE NEXT SECTION:
${params.interviewCode}
==================================================

INSTRUCTIONS TO ATTEND THE NEXT SECTION:
1. Log into your Candidate Portal under "My Applications" or "My Interviews".
2. Locate the "${params.jobTitle}" recruitment pipeline.
3. Click "Attend AI Interview" or navigate to the AI Technical Interview section.
4. Enter your unique 12-character access code: ${params.interviewCode}
5. Ensure your camera and microphone are tested and working before launching the session.

Please attend the next section at your earliest convenience within your allocated interview window.

We wish you great success in the upcoming round!

Warm regards,
Talent Acquisition Team
${params.companyName}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.07);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 32px 36px; text-align: left;">
              <span style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 5px 12px; border-radius: 20px;">✓ Technical Assessment Cleared</span>
              <h1 style="color: #ffffff; margin: 12px 0 0 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Congratulations, ${params.candidateName}!</h1>
              <p style="color: #dbeafe; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">${params.jobTitle} • ${params.companyName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 36px;">
              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Great news! You have successfully passed the Technical Assessment with a score of <strong>${params.score}%</strong> (qualifying cutoff: ${passingCutoff}%). You are now eligible to attend the next section of your interview process.
              </p>

              <!-- Access Code Card -->
              <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #15803d; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">Your Access Code for Next Section</span>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: 4px; padding: 8px 16px; background-color: #ffffff; border-radius: 8px; display: inline-block; border: 1px solid #bbf7d0;">
                  ${params.interviewCode}
                </div>
                <p style="font-size: 12px; color: #166534; margin: 8px 0 0 0; font-weight: 600;">
                  Next Section: ${nextSection}
                </p>
              </div>

              <!-- Next Steps -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">How to Attend the Next Section</h3>
                <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.7;">
                  <li>Log in to your <strong>Candidate Portal</strong> under "My Interviews".</li>
                  <li>Click <strong>"Attend AI Interview"</strong> next to your application.</li>
                  <li>Enter your 12-character access code: <code style="font-weight: bold; color: #1e40af;">${params.interviewCode}</code></li>
                  <li>Verify that your camera and microphone are operational before beginning.</li>
                </ol>
              </div>

              <p style="font-size: 13px; color: #64748b; margin: 0; line-height: 1.5;">
                If you have any questions or require technical assistance, please reply directly or reach out through your candidate portal.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 36px; text-align: left;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                Sent by Talent Acquisition, ${params.companyName} • Powered by AI Interviewer
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendEmail({
      toEmail: params.toEmail,
      subject,
      template: 'INTERVIEW_REGISTRATION',
      content,
      preview,
      htmlContent,
    });
  }

  public async sendDirectRecruiterEmail(params: {
    toEmail: string;
    candidateName: string;
    recruiterName: string;
    companyName: string;
    jobTitle: string;
    subject: string;
    messageBody: string;
  }): Promise<EmailLog> {
    const subject = params.subject || `Message from ${params.companyName} regarding ${params.jobTitle}`;
    const preview = params.messageBody.substring(0, 100);

    const content = `Dear ${params.candidateName},

${params.messageBody}

---
Sent by ${params.recruiterName}
Talent Acquisition, ${params.companyName}`;

    return this.sendEmail({
      toEmail: params.toEmail,
      subject,
      template: 'OTHER',
      content,
      preview,
    });
  }

  /**
   * Dispatches automated congratulations email when a candidate passes Round 1 (Resume Screening / ATS Evaluation).
   * Includes warm company greetings, congratulations on First Round selection, technical assessment instructions,
   * candidate's 12-digit assessment access code, and a styled button: "TO write the technical Assesment -> Click Here"
   * linking directly to https://technicalassesment-1081785547021.asia-southeast1.run.app/.
   */
  public async sendResumePassedEmail(params: {
    toEmail: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    technicalAssessmentCode?: string;
    interviewCode?: string;
    assessmentUrl?: string;
  }): Promise<EmailLog> {
    const techCode = params.technicalAssessmentCode || params.interviewCode || 'ASSESSMENT-CODE';
    const baseUrl = params.assessmentUrl || 'https://technicalassesment-1081785547021.asia-southeast1.run.app/';
    const directUrl = `${baseUrl.replace(/\/+$/, '')}?code=${encodeURIComponent(techCode)}&email=${encodeURIComponent(params.toEmail)}`;
    const subject = `🎉 Congratulations on First Round Selection! Technical Assessment Invitation – ${params.companyName}`;
    const preview = `Congratulations ${params.candidateName}! You passed Round 1 (Resume Screening) for ${params.jobTitle} at ${params.companyName}. Click here to write your Technical Assessment.`;

    const content = `Dear ${params.candidateName},

🎉 CONGRATULATIONS ON YOUR FIRST ROUND SELECTION!

Greetings from the entire talent acquisition and leadership team at ${params.companyName}!

We are pleased to inform you that your resume and profile have successfully CLEARED the First Round (Resume Screening / ATS Evaluation) for the position of "${params.jobTitle}".

Your demonstrated technical skills, engineering projects, and relevant background align with our hiring criteria. As a result, you have officially advanced to Round 2: Technical Assessment.

==================================================
FIRST ROUND SELECTION SUMMARY:
==================================================
• Role: ${params.jobTitle}
• Company: ${params.companyName}
• Round 1 Status: QUALIFIED & SELECTED ✓
• Next Stage: Round 2 – Technical Assessment (MCQs & Live Coding)
• Your 12-Digit Assessment Code: ${techCode}

==================================================
TO write the technical Assesment -> Click Here:
${baseUrl}
==================================================

Direct Access URL with Pre-filled Code:
${directUrl}

IMPORTANT ASSESSMENT INSTRUCTIONS:
1. Click the link above to launch the technical assessment platform.
2. Enter your registered email address (${params.toEmail}) and your 12-digit assessment code: ${techCode}
3. The assessment consists of Technical & Aptitude MCQs followed by Live Coding challenges with real-time test cases.
4. Take the test on a desktop or laptop with a reliable internet connection, working webcam, and microphone.
5. Strict Single Attempt Policy: Each candidate is granted a maximum of ONE attempt only.
6. Real-time integrity proctoring will monitor your assessment session (tab-switching or camera disconnections are strictly flagged).

We are excited about your candidacy and wish you great success in your technical assessment!

Warm regards,
Talent Acquisition Team
${params.companyName}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);">
          <!-- Header Banner with Company Greetings -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 36px 36px 32px 36px; text-align: left;">
              <span style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 6px 14px; border-radius: 20px;">
                🎉 First Round Cleared • Selected for Stage 2
              </span>
              <h1 style="color: #ffffff; margin: 14px 0 0 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.3;">
                Congratulations, ${params.candidateName}!
              </h1>
              <p style="color: #93c5fd; margin: 6px 0 0 0; font-size: 15px; font-weight: 500;">
                Greetings from ${params.companyName}
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b; line-height: 1.6;">
                Dear <strong>${params.candidateName}</strong>,
              </p>
              <p style="margin: 0 0 18px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                Greetings from the entire talent acquisition and engineering leadership team at <strong>${params.companyName}</strong>!
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                We are delighted to inform you that your resume and background have successfully <strong>PASSED</strong> our initial First Round screening for the position of <strong>${params.jobTitle}</strong>. Your technical proficiencies and accomplishments stood out, and you have officially been shortlisted for <strong>Round 2: Technical Assessment</strong>.
              </p>

              <!-- Highlight Box with Assessment Details -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; margin: 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Target Role:</td>
                    <td style="padding-bottom: 10px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${params.jobTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Hiring Organization:</td>
                    <td style="padding-bottom: 10px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${params.companyName}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">First Round Status:</td>
                    <td style="padding-bottom: 10px; font-size: 14px; font-weight: 800; color: #059669; text-align: right;">QUALIFIED &amp; SELECTED ✓</td>
                  </tr>
                  <tr>
                    <td style="padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 13px; color: #64748b;">12-Digit Assessment Code:</td>
                    <td style="padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 16px; font-family: monospace; font-weight: 800; color: #2563eb; text-align: right; letter-spacing: 1.5px;">${techCode}</td>
                  </tr>
                </table>
              </div>

              <!-- Primary Action Button: "TO write the technical Assesment -> Click Here" -->
              <div style="text-align: center; margin: 34px 0 28px 0;">
                <a href="${directUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.38); letter-spacing: 0.2px;">
                  TO write the technical Assesment -&gt; Click Here
                </a>
                <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">
                  Or access directly at: <a href="${baseUrl}" target="_blank" style="color: #2563eb; font-weight: 600; word-break: break-all;">${baseUrl}</a>
                </p>
              </div>

              <!-- Instructions Card -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 18px 20px; margin: 26px 0 18px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1e3a8a;">
                  Assessment Guidelines &amp; Requirements:
                </p>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #1e40af; line-height: 1.6;">
                  <li><strong>Single Attempt Maximum:</strong> You have strictly 1 attempt only to write your technical assessment.</li>
                  <li><strong>Hardware:</strong> Please use a desktop or laptop computer with a functioning webcam and microphone.</li>
                  <li><strong>Format:</strong> Computer Science MCQs followed by live coding challenges with automated test cases.</li>
                  <li><strong>Proctoring:</strong> Tab-switching or camera disconnections are actively monitored by anti-malpractice protocols.</li>
                </ul>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 14px; color: #475569; line-height: 1.6;">
                We look forward to reviewing your technical evaluation and wish you the best of luck in the next round!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 22px 36px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0; font-weight: 700; color: #334155;">Talent Acquisition Team</p>
              <p style="margin: 2px 0 0 0;">${params.companyName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendEmail({
      toEmail: params.toEmail,
      subject,
      template: 'OTHER',
      content,
      preview,
      htmlContent,
    });
  }
  /**
   * Dispatches official Selection Offer Email to candidate when recruiter clicks 'Confirm' in Final Review & Selection.
   * Includes congratulations header, Company Name, Job Title, Package Details / CTC, Job Description, Joining / Location details, and next steps.
   */
  public async sendCandidateSelectedEmail(params: {
    toEmail: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    packageDetails: string;
    description: string;
    startDate?: string;
    location?: string;
    additionalNotes?: string;
  }): Promise<EmailLog> {
    const subject = `🎉 Congratulations! Job Offer for ${params.jobTitle} at ${params.companyName}`;
    const preview = `Congratulations ${params.candidateName}! You have been selected for the position of ${params.jobTitle} at ${params.companyName}. Package: ${params.packageDetails}.`;

    const content = `Dear ${params.candidateName},

🎉 CONGRATULATIONS! YOU HAVE BEEN SELECTED!

We are thrilled to inform you that following your outstanding performance across all evaluation rounds — from Resume Screening to the Technical Assessment and Final Technical Interview — you have been officially SELECTED for the position of "${params.jobTitle}" at ${params.companyName}!

==================================================
OFFICIAL SELECTION & OFFER SUMMARY:
==================================================
• Organization: ${params.companyName}
• Selected Role: ${params.jobTitle}
• Compensation / Package: ${params.packageDetails}
• Expected Joining Date: ${params.startDate || 'To be communicated / 15-30 days'}
• Work Location: ${params.location || 'As specified in job listing'}

ROLE DESCRIPTION & RESPONSIBILITIES:
${params.description}

${params.additionalNotes ? `ADDITIONAL DETAILS & INSTRUCTIONS:\n${params.additionalNotes}\n` : ''}
NEXT STEPS:
Our People and Culture onboarding team will be reaching out to you shortly with formal documentation, background verification details, and your official appointment letter.

Once again, congratulations on your well-deserved achievement! We are excited to welcome you to ${params.companyName}.

Warmest regards,
Leadership & Talent Acquisition Team
${params.companyName}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.1);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%); padding: 38px 36px; text-align: left;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.22); color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; padding: 6px 14px; border-radius: 20px; backdrop-filter: blur(4px);">
                🎉 Formal Selection Offer Confirmed
              </span>
              <h1 style="color: #ffffff; margin: 16px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.25;">
                Congratulations, ${params.candidateName}!
              </h1>
              <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 15px; font-weight: 600;">
                You are officially selected for ${params.companyName}
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b; line-height: 1.6;">
                Dear <strong>${params.candidateName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.65;">
                On behalf of the leadership and recruitment committee at <strong>${params.companyName}</strong>, we are thrilled to congratulate you on your selection for the role of <strong>${params.jobTitle}</strong>.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.65;">
                Your outstanding performance across all stages — from initial resume screening, the technical coding and aptitude assessment, through the AI technical evaluation — distinguished you as an exceptional candidate.
              </p>

              <!-- Package & Offer Highlight Card -->
              <div style="background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%); border: 1.5px solid #86efac; border-radius: 16px; padding: 24px; margin: 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 12px; font-size: 13px; color: #166534; font-weight: 600;">Hiring Company:</td>
                    <td style="padding-bottom: 12px; font-size: 15px; font-weight: 800; color: #064e3b; text-align: right;">${params.companyName}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px; font-size: 13px; color: #166534; font-weight: 600;">Selected Designation:</td>
                    <td style="padding-bottom: 12px; font-size: 15px; font-weight: 800; color: #064e3b; text-align: right;">${params.jobTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px; font-size: 13px; color: #166534; font-weight: 600;">Annual Compensation / Package:</td>
                    <td style="padding-bottom: 12px; font-size: 17px; font-weight: 900; color: #047857; text-align: right; letter-spacing: 0.3px;">${params.packageDetails}</td>
                  </tr>
                  ${params.startDate ? `
                  <tr>
                    <td style="padding-bottom: 12px; font-size: 13px; color: #166534; font-weight: 600;">Expected Date of Joining:</td>
                    <td style="padding-bottom: 12px; font-size: 14px; font-weight: 700; color: #064e3b; text-align: right;">${params.startDate}</td>
                  </tr>
                  ` : ''}
                  ${params.location ? `
                  <tr>
                    <td style="padding-bottom: 12px; font-size: 13px; color: #166534; font-weight: 600;">Work Location:</td>
                    <td style="padding-bottom: 12px; font-size: 14px; font-weight: 700; color: #064e3b; text-align: right;">${params.location}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding-top: 12px; border-top: 1px dashed #86efac; font-size: 13px; color: #166534; font-weight: 600;">Final Decision:</td>
                    <td style="padding-top: 12px; border-top: 1px dashed #86efac; font-size: 14px; font-weight: 800; color: #059669; text-align: right;">SELECTED &amp; CONFIRMED ✓</td>
                  </tr>
                </table>
              </div>

              <!-- Role Overview -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                  Role Description &amp; Summary
                </h3>
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6; white-space: pre-line;">
                  ${params.description}
                </p>
              </div>

              ${params.additionalNotes ? `
              <!-- Additional Notes -->
              <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 14px; padding: 18px; margin: 20px 0;">
                <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0369a1;">
                  Additional Instructions &amp; Onboarding
                </h4>
                <p style="margin: 0; font-size: 13px; color: #0c4a6e; line-height: 1.55;">
                  ${params.additionalNotes}
                </p>
              </div>
              ` : ''}

              <p style="margin: 24px 0 0 0; font-size: 14px; color: #334155; line-height: 1.6;">
                Our HR operations team will connect with you with the formal appointment letter and onboarding schedule. We are proud to welcome you to the <strong>${params.companyName}</strong> family!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 36px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0; font-weight: 700; color: #0f172a;">Leadership &amp; Talent Acquisition Team</p>
              <p style="margin: 2px 0 0 0; color: #475569;">${params.companyName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendEmail({
      toEmail: params.toEmail,
      subject,
      template: 'OTHER',
      content,
      preview,
      htmlContent,
    });
  }

  /**
   * Dispatches formal, respectful Rejection Email to candidate when recruiter clicks 'Remove' in Final Review & Selection.
   * Includes polite acknowledgment of participation across rounds and clear status update for the specific job and company.
   */
  public async sendCandidateRejectedEmail(params: {
    toEmail: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    reason?: string;
    feedback?: string;
  }): Promise<EmailLog> {
    const subject = `Update regarding your application for ${params.jobTitle} at ${params.companyName}`;
    const preview = `Thank you for interviewing for ${params.jobTitle} at ${params.companyName}. We appreciate your time and dedication throughout our selection process.`;

    const content = `Dear ${params.candidateName},

Thank you for your interest in ${params.companyName} and for the time and effort you dedicated to our recruitment process for the position of "${params.jobTitle}".

We genuinely appreciate having had the opportunity to evaluate your profile, assess your technical competencies, and speak with you during our interview rounds.

After careful consideration and a comprehensive review of all candidates against our current technical requirements and organizational priorities, we have made the difficult decision not to move forward with your candidacy for this specific position.

${params.reason || params.feedback ? `Recruiter Feedback:\n${params.reason || params.feedback}\n` : ''}
We were impressed by your background and accomplishments, and we encourage you to apply for future opportunities with ${params.companyName} as new openings arise.

We sincerely wish you the very best in your professional journey and future career pursuits.

Warm regards,
Talent Acquisition Team
${params.companyName}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px 36px; text-align: left;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 5px 12px; border-radius: 20px;">
                Application Status Update
              </span>
              <h1 style="color: #ffffff; margin: 12px 0 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.4px;">
                ${params.companyName}
              </h1>
              <p style="color: #cbd5e1; margin: 4px 0 0 0; font-size: 14px;">
                Position: ${params.jobTitle}
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b; line-height: 1.6;">
                Dear <strong>${params.candidateName}</strong>,
              </p>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.65;">
                Thank you for your interest in <strong>${params.companyName}</strong> and for the considerable time, thought, and effort you invested in our interview rounds for the <strong>${params.jobTitle}</strong> position.
              </p>
              <p style="margin: 0 0 18px 0; font-size: 14px; color: #334155; line-height: 1.65;">
                We were fortunate to evaluate many talented individuals. After a thorough review of performance across all stages, our hiring committee has decided to proceed with other candidates whose current skill sets and project experience most closely align with our immediate project requirements.
              </p>

              ${params.reason || params.feedback ? `
              <div style="background-color: #f8fafc; border-left: 3px solid #94a3b8; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                  <strong>Note:</strong> ${params.reason || params.feedback}
                </p>
              </div>
              ` : ''}

              <p style="margin: 18px 0 0 0; font-size: 14px; color: #334155; line-height: 1.65;">
                We appreciate having had the opportunity to learn about your background, and we encourage you to keep an eye on our careers portal for future roles that match your expertise.
              </p>
              <p style="margin: 14px 0 0 0; font-size: 14px; color: #334155; line-height: 1.65;">
                We wish you every success in your ongoing job search and career development.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 22px 36px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0; font-weight: 700; color: #1e293b;">Talent Acquisition Team</p>
              <p style="margin: 2px 0 0 0;">${params.companyName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendEmail({
      toEmail: params.toEmail,
      subject,
      template: 'OTHER',
      content,
      preview,
      htmlContent,
    });
  }
}

export const emailService = new EmailService();
