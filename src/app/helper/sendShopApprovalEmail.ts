import nodemailer from 'nodemailer';
import logger from '../../utils/logger';
import config from './../../config/index';

interface ShopApprovalEmailParams {
  email: string;
  shopName: string;
  shopOwnerName: string;
  status: 'APPROVED' | 'REJECTED';
}

export const sendShopApprovalEmail = async ({
  email,
  shopName,
  shopOwnerName,
  status,
}: ShopApprovalEmailParams): Promise<void> => {
  try {
    logger.info(`📧 Attempting to send shop ${status} email to: ${email}`);

    const transporter = nodemailer.createTransport({
      host: config.mail_host || 'smtp-relay.brevo.com',
      port: Number(config.mail_port) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: config.mail_user,
        pass: config.mail_pass,
      },
    });

    // Verify transporter configuration
    await transporter.verify();
    logger.info('✅ SMTP connection verified successfully');

    const fromEmail = config.SMTP_FROM_EMAIL || config.mail_user;
    const fromName = 'Daily Miles';
    const from = `"${fromName}" <${fromEmail}>`;

    const isApproved = status === 'APPROVED';
    const statusColor = isApproved ? '#28a745' : '#dc3545';
    const statusText = isApproved ? 'Approved' : 'Rejected';
    const emoji = isApproved ? '🎉' : '❌';

    const mailOptions = {
      from,
      to: email,
      subject: `${emoji} Your Shop ${statusText} - Daily Miles`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Shop ${statusText} - Daily Miles</title>
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
            .status-box {
              display: inline-block;
              background-color: ${statusColor};
              color: #ffffff;
              border-radius: 8px;
              padding: 15px 30px;
              font-size: 20px;
              font-weight: bold;
              margin: 20px 0;
            }
            .shop-name {
              font-size: 22px;
              color: #667eea;
              font-weight: bold;
              margin: 15px 0;
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
              <p>Hello ${shopOwnerName},</p>
              ${isApproved ? `
                <p>
                  Congratulations! We're excited to inform you that your shop has been approved.
                </p>
                <div class="shop-name">${shopName}</div>
                <div class="status-box">${emoji} ${statusText}</div>
                <p>
                  Your shop is now live and visible to customers. You can start creating deals and attracting customers!
                </p>
                <p>
                  <strong>Next Steps:</strong><br/>
                  - Create attractive deals for your customers<br/>
                  - Keep your shop information updated<br/>
                  - Respond to customer inquiries promptly
                </p>
              ` : `
                <p>
                  We regret to inform you that your shop application has been reviewed.
                </p>
                <div class="shop-name">${shopName}</div>
                <div class="status-box">${emoji} ${statusText}</div>
                <p>
                  Unfortunately, your shop does not meet our current guidelines. Please review our shop requirements and feel free to reapply.
                </p>
                <p>
                  If you have questions or need assistance, please contact our support team.
                </p>
              `}
            </div>
            <div class="footer">
              <p>&copy; 2025 Daily Miles. All rights reserved.</p>
              <p>
                Need help? <a href="mailto:support@dailymiles.com">Contact Support</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`✅ Shop ${status} email sent successfully to ${email}`);
    console.log('Email sent successfully:', { messageId: result.messageId });
  } catch (error: any) {
    logger.error(`❌ Error sending shop approval email to ${email}:`, error);
    console.error('Email sending failed:', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    // Don't throw error to prevent blocking shop approval process
    // Just log the error
  }
};
