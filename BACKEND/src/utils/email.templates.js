export const verificationEmailTemplate = (firstName, code) => {
  return {
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background-color: #344feb; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background-color: #f9f9f9; padding: 40px 30px; }
          .code-box { 
            background-color: #fff; 
            border: 2px dashed #344feb; 
            padding: 25px; 
            text-align: center; 
            margin: 30px 0;
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #344feb;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background-color: #f0f0f0; }
          p { margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Thank you for registering with RentCare. Please verify your email address by entering the code below:</p>
            
            <div class="code-box">${code}</div>
            
            <p><strong>This code will expire in 15 minutes.</strong></p>
            <p>If you didn't create an account with RentCare, please ignore this email.</p>
            <p>Best regards,<br>The RentCare Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} RentCare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${firstName},

Thank you for registering with RentCare. 

Your verification code is: ${code}

This code will expire in 15 minutes.

If you didn't create an account with RentCare, please ignore this email.

Best regards,
The RentCare Team
    `
  };
};

// ============================================
// PASSWORD SETUP EMAIL TEMPLATE
// Used in: caretakers.controller.js - createCaretaker()
// Used in: tenants.controller.js - createTenant()
// ============================================
export const passwordSetupEmailTemplate = (firstName, setupUrl, role) => {
  return {
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background-color: #344feb; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background-color: #f9f9f9; padding: 40px 30px; }
          .button { 
            display: inline-block; 
            background-color: #344feb; 
            color: white !important; 
            padding: 15px 40px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 25px 0;
            font-weight: bold;
          }
          .button-container { text-align: center; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background-color: #f0f0f0; }
          p { margin: 15px 0; }
          strong { color: #344feb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Set Up Your RentCare Account</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>You have been added as a <strong>${role}</strong> on RentCare. To get started, please set up your password by clicking the button below:</p>
            
            <div class="button-container">
              <a href="${setupUrl}" class="button">Set Up Password</a>
            </div>
            
            <p><strong>Security Notice:</strong> This link will expire in 24 hours.</p>
            
            <p>If you didn't expect this email, please contact your administrator.</p>
            <p>Best regards,<br>The RentCare Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} RentCare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${firstName},

You have been added as a ${role} on RentCare. 

To get started, please set up your password by clicking this link:
${setupUrl}

Security Notice: This link will expire in 24 hours.

If you didn't expect this email, please contact your administrator.

Best regards,
The RentCare Team
    `
  };
};

// ============================================
// PASSWORD RESET EMAIL TEMPLATE
// Used in: signin.controller.js - forgotPassword()
// ============================================
export const passwordResetEmailTemplate = (firstName, resetUrl) => {
  return {
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background-color: #344feb; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background-color: #f9f9f9; padding: 40px 30px; }
          .button { 
            display: inline-block; 
            background-color: #344feb; 
            color: white !important; 
            padding: 15px 40px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 25px 0;
            font-weight: bold;
          }
          .button-container { text-align: center; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background-color: #f0f0f0; }
          p { margin: 15px 0; }
          strong { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password for your RentCare account. Click the button below to reset it:</p>
            
            <div class="button-container">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p><strong>Security Notice: This link will expire in 1 hour.</strong></p>
            
            <p>If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.</p>
            <p>Best regards,<br>The RentCare Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} RentCare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${firstName},

We received a request to reset your password for your RentCare account.

Click this link to reset your password:
${resetUrl}

Security Notice: This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

Best regards,
The RentCare Team
    `
  };
};

// ============================================
// EMAIL CHANGE VERIFICATION TEMPLATE
// Used in: signin.controller.js - changeEmail()
// ============================================
export const emailChangeVerificationTemplate = (firstName, code) => {
  return {
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background-color: #344feb; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background-color: #f9f9f9; padding: 40px 30px; }
          .code-box { 
            background-color: #fff; 
            border: 2px dashed #344feb; 
            padding: 25px; 
            text-align: center; 
            margin: 30px 0;
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #344feb;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background-color: #f0f0f0; }
          p { margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your New Email</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>We received a request to change your email address. Please verify your new email by entering the code below:</p>
            
            <div class="code-box">${code}</div>
            
            <p><strong>This code will expire in 15 minutes.</strong></p>
            <p>If you didn't request this change, please contact support immediately.</p>
            <p>Best regards,<br>The RentCare Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} RentCare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${firstName},

We received a request to change your email address.

Your verification code is: ${code}

This code will expire in 15 minutes.

If you didn't request this change, please contact support immediately.

Best regards,
The RentCare Team
    `
  };
};

// ============================================
// DYNAMIC TENANT NOTIFICATION TEMPLATE
// Used in: tenants.controller.js - sendEmailNotice()
// ============================================
export const tenantNotificationTemplate = (subject, htmlBody) => {
  return {
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f7f6; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
          /* ✅ BRANDED BLUE GRADIENT HEADER */
          .header { background: linear-gradient(135deg, #3B82F6 0%, #22D3EE 100%); color: white; padding: 30px 40px; text-align: left; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
          .content { padding: 40px; color: #334155; font-size: 16px; }
          .content p { margin: 0 0 20px 0; }
          .footer { background-color: #f8fafc; padding: 20px 40px; text-align: center; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subject}</h1>
          </div>
          <div class="content">
            ${htmlBody}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Rentlee Property Management. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: htmlBody.replace(/<br>/g, '\n').replace(/<[^>]*>?/gm, '')
  };
};

export default {
  verificationEmailTemplate,
  passwordSetupEmailTemplate,
  passwordResetEmailTemplate,
  emailChangeVerificationTemplate,
  tenantNotificationTemplate
};