import dotenv from 'dotenv';
dotenv.config();

const transporter = {
  sendMail: async (options) => {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { 
            email: process.env.SENDER_EMAIL, 
            name: "Rentlee" 
          },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Brevo API Error:", errorData);
        throw new Error('Failed to send email via Brevo');
      }

      const data = await response.json();
      console.log("Email successfully sent via Brevo HTTP API! ID:", data.messageId);
      return data;

    } catch (error) {
      console.error("Critical Email Error:", error);
      throw error;
    }
  }
};

export default transporter;