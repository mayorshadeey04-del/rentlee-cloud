import transporter from '../config/nodemailer.js';
import {
  verificationEmailTemplate,
  passwordSetupEmailTemplate,
  passwordResetEmailTemplate,
  emailChangeVerificationTemplate,
  tenantNotificationTemplate
} from './email.templates.js';

// Helper to get consistent Frontend URL
const FRONTEND_BASE_URL = 'https://rentlee-cloud.vercel.app';

// ============================================
// SEND VERIFICATION EMAIL
// ============================================
export const sendVerificationEmail = async (email, code, firstName) => {
  try {
    const template = verificationEmailTemplate(firstName, code);

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Verify Your Email - Rentlee',
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// ============================================
// SEND PASSWORD SETUP EMAIL (Fixed setupUrl & from address)
// ============================================
export const sendPasswordSetupEmail = async (email, token, firstName, role) => {
  try {
    // Fixed path to match your Vercel structure
    const setupUrl = `${FRONTEND_BASE_URL}/set-password.html?token=${token}`;
    const template = passwordSetupEmailTemplate(firstName, setupUrl, role);

    const mailOptions = {
      from: process.env.SENDER_EMAIL, // Use your verified sender email
      to: email,
      subject: 'Set Up Your Rentlee Account',
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password setup email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password setup email:', error);
    throw new Error('Failed to send password setup email');
  }
};

// ============================================
// SEND PASSWORD RESET EMAIL (Fixed resetUrl variable name)
// ============================================
export const sendPasswordResetEmail = async (email, token, firstName) => {
  try {
    // Fixed: Named it resetUrl so the template can actually find it
    const resetUrl = `${FRONTEND_BASE_URL}/set-password.html?token=${token}`;
    const template = passwordResetEmailTemplate(firstName, resetUrl);

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Reset Your Password - Rentlee',
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// ============================================
// SEND EMAIL CHANGE VERIFICATION
// ============================================
export const sendEmailChangeVerification = async (email, code, firstName) => {
  try {
    const template = emailChangeVerificationTemplate(firstName, code);

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Verify Your New Email - Rentlee',
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Error sending email change verification:', error);
    throw new Error('Failed to send email change verification');
  }
};

// ============================================
// SEND DYNAMIC TENANT EMAIL
// ============================================
export const sendDynamicTenantEmail = async (email, subject, htmlBody) => {
  try {
    const template = tenantNotificationTemplate(subject, htmlBody);

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: subject,
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error(`Failed to send dynamic email to ${email}:`, error);
  }
};

export default {
  sendVerificationEmail,
  sendPasswordSetupEmail,
  sendPasswordResetEmail,
  sendEmailChangeVerification,
  sendDynamicTenantEmail
};