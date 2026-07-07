import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const transporter =
  env.EMAIL_DELIVERY_MODE === 'smtp'
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : nodemailer.createTransport({ jsonTransport: true });

function emailCopy(purpose, code) {
  if (purpose === 'password_reset') {
    return {
      subject: 'Reset your 34th Street password',
      text: `Your 34th Street password reset code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes. If you did not request it, ignore this email.`,
    };
  }

  return {
    subject: 'Verify your 34th Street work email',
    text: `Your 34th Street work email verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes. Never share this code.`,
  };
}

export async function sendOtpEmail({ to, code, purpose }) {
  const copy = emailCopy(purpose, code);
  const message = await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: copy.subject,
    text: copy.text,
  });

  if (env.EMAIL_DELIVERY_MODE === 'log') {
    // This branch is forbidden by environment validation in production.
    logger.info({ to, purpose, code, messageId: message.messageId }, 'Development OTP email');
  }
}

