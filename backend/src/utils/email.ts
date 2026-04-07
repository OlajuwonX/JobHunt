/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Email Utility (src/utils/email.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Handles sending transactional emails via Nodemailer + Gmail SMTP.
 *
 * WHAT IS NODEMAILER?
 *   A Node.js library for sending emails. We configure it to use Gmail's
 *   SMTP server to actually deliver the email.
 *
 * WHAT IS SMTP?
 *   Simple Mail Transfer Protocol — the standard for sending email.
 *   Gmail lets you use their SMTP server if you create an "App Password"
 *   in your Google Account settings.
 *
 * SETUP:
 *   1. Enable 2-Step Verification on your Gmail account
 *   2. Go to: Google Account → Security → App passwords
 *   3. Create an app password and paste it as SMTP_PASS in .env
 *
 * EMAILS WE SEND:
 *   - Email verification (on register)
 *   - Password reset (future)
 *   - Job alert notifications (Phase 3)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import nodemailer from 'nodemailer'

// ─── Transporter ──────────────────────────────────────────────────────────────
// The "transporter" is the configured email sender.
// We create it once and reuse it for all emails (like the Prisma singleton).

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // false = use STARTTLS (port 587), true = SSL (port 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password (not your real Gmail password)
  },
})

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Sends an email verification link to a newly registered user.
 * The user must click this link before they can log in.
 *
 * @param to    - recipient email address
 * @param token - the unique verification token stored in User.verifyToken
 */
export const sendVerificationEmail = async (to: string, token: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

  // This URL points to the Next.js page that will call /api/v1/auth/verify/:token
  const verifyUrl = `${frontendUrl}/auth/verify?token=${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"JobHunt" <noreply@jobhunt.dev>',
    to,
    subject: 'Verify your JobHunt account',
    // Plain text version (for email clients that don't render HTML)
    text: `Welcome to JobHunt! Please verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    // HTML version (shown in modern email clients)
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111; margin-bottom: 8px;">Welcome to JobHunt</h2>
        <p style="color: #555; margin-bottom: 24px;">Click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #111; color: #fff; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600;">
          Verify Email Address
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          This link expires in 24 hours. If you didn't create a JobHunt account, you can safely ignore this email.
        </p>
        <p style="color: #aaa; font-size: 12px;">Or copy this URL: ${verifyUrl}</p>
      </div>
    `,
  })
}

/**
 * Sends a password reset email.
 * Placeholder for Phase 3 — not yet implemented.
 */
export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"JobHunt" <noreply@jobhunt.dev>',
    to,
    subject: 'Reset your JobHunt password',
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Reset your password</h2>
        <p style="color: #555; margin-bottom: 24px;">We received a request to reset your password.</p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #111; color: #fff; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reset Password
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          This link expires in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
      </div>
    `,
  })
}
