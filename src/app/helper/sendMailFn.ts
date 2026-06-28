import nodemailer from "nodemailer";

import logger from "../../utils/logger";



// Create pooled Brevo transporter
export const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.BREVO_HOST,
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASSWORD, // Brevo SMTP Key
  },
});

// Verify SMTP connection
transporter.verify((error) => {
  if (error) {
    logger.error("❌ Brevo SMTP Connection Error:", error);
    console.error("❌ Brevo SMTP Connection Error:", error);
  } else {
    logger.info("✅ Brevo SMTP Server is ready to send emails");
    console.log("✅ Brevo SMTP Server is ready to send emails");
  }
});

const sendEmailFn = async (
  email: string,
  otp: string | undefined
): Promise<void> => {
  try {
    logger.info(`📧 Attempting to send OTP email to: ${email}`);

    console.log("Brevo Config:", {
      host: process.env.BREVO_HOST,
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASSWORD
        ? "***" + process.env.BREVO_PASSWORD.slice(-4)
        : "NOT SET",
    });

    const fromEmail = process.env.BREVO_EMAIL;
    const fromName = "Daily Miles";

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: "Daily Miles OTP Verification",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>OTP Verification - Daily Miles</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff;
              text-align: center;
              padding: 30px 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 30px 20px;
              text-align: center;
            }
            .content p {
              font-size: 16px;
              color: #333333;
              margin: 10px 0;
            }
            .otp-box {
              display: inline-block;
              background-color: #f9f9f9;
              border: 2px dashed #667eea;
              border-radius: 8px;
              padding: 20px 40px;
              font-size: 32px;
              font-weight: bold;
              color: #667eea;
              margin: 20px 0;
              letter-spacing: 5px;
            }
            .footer {
              background-color: #f4f4f4;
              text-align: center;
              padding: 20px;
              font-size: 14px;
              color: #888888;
            }
            .footer a {
              color: #667eea;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Daily Miles</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>
                Thank you for registering with <strong>Daily Miles</strong>.
                Use the OTP below to verify your account:
              </p>
              <div class="otp-box">${otp}</div>
              <p>This OTP is valid for <strong>5 minutes</strong>.</p>
              <p>
                If you did not request this, please ignore this email or contact
                our support team.
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Daily Miles. All rights reserved.</p>
              <p>
                Need help?
                <a href="mailto:support@dailymiles.com">Contact Support</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const result = await transporter.sendMail(mailOptions);

    logger.info(`✅ OTP email sent successfully to ${email}`);

    console.log("📨 Email sent:", {
      messageId: result.messageId,
      response: result.response,
    });
  } catch (error: any) {
    logger.error(`❌ Error sending email to ${email}:`, error);

    console.error("Email sending failed:", {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });

    throw new Error("Failed to send email via Brevo");
  }
};

export default sendEmailFn;
export { sendEmailFn };