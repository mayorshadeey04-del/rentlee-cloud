import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,             // 👈 Back to your original, working port!
  secure: true,          // 👈 Must be true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  family: 4              // 👈 The shield keeping Render's IPv6 bugs away
});

export default transporter;