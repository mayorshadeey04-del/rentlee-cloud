import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, 
  port: parseInt(process.env.SMTP_PORT), 
  secure: true, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  // We keep this just so Render doesn't use the broken IPv6 route
  family: 4, 
  // 👇 Adds detailed network logging to your Render dashboard
  logger: true,
  debug: true 
});

export default transporter;