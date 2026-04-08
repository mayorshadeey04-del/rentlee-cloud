import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,             // 👈 Switch to standard TLS port
  secure: false,         // 👈 MUST be false when using port 587
  requireTLS: true,      // 👈 Forces secure connection
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // 👈 Bypasses strict cloud certificate blocks
  }
});

export default transporter;