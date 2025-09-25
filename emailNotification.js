// emailNotification.js
// Sends email messages using SMTP

const nodemailer = require('nodemailer');

/**
 * Send an email message using SMTP
 * @param {Object} smtpSettings - SMTP configuration { host, port, secure, user, pass, from }
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string} subject - Email subject
 * @param {string} text - Email body (plain text)
 * @param {string} [html] - Email body (HTML, optional)
 * @returns {Promise<Object>} - Nodemailer response
 */
async function sendEmailNotification(smtpSettings, to, subject, text, html) {
  const transporter = nodemailer.createTransport({
    host: smtpSettings.smtp_host,
    port: smtpSettings.smtp_port,
    secure: smtpSettings.smtp_secure || false,
    auth: {
      user: smtpSettings.smtp_user,
      pass: smtpSettings.smtp_pass
    }
  });

  const mailOptions = {
    from: smtpSettings.smtp_from,
    to,
    subject,
    text,
    ...(html ? { html } : {})
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendEmailNotification };
