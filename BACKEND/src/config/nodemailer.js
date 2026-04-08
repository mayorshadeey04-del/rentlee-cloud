import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,             // Use TLS port
  secure: false,         // Must be false for port 587
  requireTLS: true,      // Force secure connection
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // Bypass cloud certificate blocks
  },
  family: 4              // 👈 CRITICAL: Forces IPv4 to prevent ENETUNREACH
});

export default transporter;