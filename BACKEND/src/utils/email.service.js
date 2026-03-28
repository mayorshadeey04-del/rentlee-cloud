import transporter from '../config/nodemailer.js';
import {
  verificationEmailTemplate,
  passwordSetupEmailTemplate,
  passwordResetEmailTemplate,
  emailChangeVerificationTemplate,
  tenantNotificationTemplate
} from './email.templates.js';

// ============================================
// SEND VERIFICATION EMAIL
// Used in: signup.controller.js
// - registerLandlord() - sends code after user registers
// - resendVerification() - resends code if expired
// ============================================
export const sendVerificationEmail = async (email, code, firstName) => {
  try {
    const template = verificationEmailTemplate(firstName, code);

    const mailOptions = {
      // from: process.env.EMAIL_FROM || 'RentCare <noreply@rentcare.com>',
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Verify Your Email - RentCare',
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
// SEND PASSWORD SETUP EMAIL
// Used in: caretakers.controller.js
// - createCaretaker() - sends setup link to new caretaker
// Used in: tenants.controller.js
// - createTenant() - sends setup link to new tenant
// ============================================
export const sendPasswordSetupEmail = async (email, token, firstName, role) => {
  try {
    const setupUrl = `${process.env.FRONTEND_URL}/FRONTEND/landing/set-password.html?token=${token}`;
    const template = passwordSetupEmailTemplate(firstName, setupUrl, role);

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'RentCare <noreply@rentcare.com>',
      to: email,
      subject: 'Set Up Your RentCare Account',
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
// SEND PASSWORD RESET EMAIL
// Used in: signin.controller.js
// - forgotPassword() - sends reset link when user forgets password
// ============================================
export const sendPasswordResetEmail = async (email, token, firstName) => {
  try {
    const setupUrl = `${process.env.FRONTEND_URL}/FRONTEND/landing/set-password.html?token=${token}`;
    const template = passwordResetEmailTemplate(firstName, resetUrl);

    const mailOptions = {
      // from: process.env.EMAIL_FROM || 'RentCare <noreply@rentcare.com>',
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Reset Your Password - RentCare',
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
// Used in: signin.controller.js
// - changeEmail() - sends code to verify new email address (landlord only)
// ============================================
export const sendEmailChangeVerification = async (email, code, firstName) => {
  try {
    const template = emailChangeVerificationTemplate(firstName, code);

    const mailOptions = {
      // from: process.env.EMAIL_FROM || 'RentCare <noreply@rentcare.com>',
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Verify Your New Email - RentCare',
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email change verification sent:', info.messageId);
    return info;

  } catch (error) {
    console.error('Error sending email change verification:', error);
    throw new Error('Failed to send email change verification');
  }
};

// ============================================
// SEND DYNAMIC TENANT EMAIL (MAIL MERGE)
// Used in: tenants.controller.js - sendEmailNotice()
// ============================================
export const sendDynamicTenantEmail = async (email, subject, htmlBody) => {
  try {
    const template = tenantNotificationTemplate(subject, htmlBody);

    const mailOptions = {
      from: process.env.SENDER_EMAIL || 'Rentlee <noreply@rentlee.com>',
      to: email,
      subject: subject,
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error(`Failed to send dynamic email to ${email}:`, error);
    // We don't throw an error here so the loop doesn't crash if one email fails!
  }
};

export default {
  sendVerificationEmail,
  sendPasswordSetupEmail,
  sendPasswordResetEmail,
  sendEmailChangeVerification,
  sendDynamicTenantEmail
};