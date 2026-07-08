const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
    },
});

transporter.verify((error) => {
    if (error) {
        console.error('Error connecting to email server:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

const withLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LedgerFlow</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Ledger<span style="color:#4ade80;">Flow</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You received this email because you have an account with LedgerFlow.<br/>
                &copy; ${new Date().getFullYear()} LedgerFlow. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

const heading = (text) =>
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;">${text}</h1>`

const paragraph = (text) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${text}</p>`

const divider = () =>
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />`

const infoCard = (rows) => `
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:4px;margin:20px 0;">
    ${rows.map(([label, value, highlight]) => `
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;white-space:nowrap;">${label}</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:600;color:${highlight || '#0f172a'};text-align:right;">${value}</td>
      </tr>
    `).join('')}
  </table>
`

const badge = (text, color) =>
    `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:${color};color:#fff;">${text}</span>`

// ─── Email sending helper ─────────────────────────────────────────────────────
const sendEmail = async (to, subject, html) => {
    const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    try {
        const info = await transporter.sendMail({
            from: `"LedgerFlow" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });
        console.log('Email sent:', info.messageId);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};


async function sendRegistrationEmail(userEmail, name) {
    const html = withLayout(`
        ${heading('Welcome to LedgerFlow 🎉')}
        ${paragraph(`Hi <strong>${name}</strong>,`)}
        ${paragraph("Your account has been created. You now have access to a high-reliability, double-entry ledger system — purpose-built for accurate, tamper-proof transaction tracking.")}
        ${divider()}
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">What you can do</p>
        <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:2;color:#374151;">
          <li>Create accounts and track balances derived from ledger entries</li>
          <li>Send and receive transfers with full idempotency protection</li>
          <li>Review a complete paginated transaction history per account</li>
        </ul>
        ${divider()}
        ${paragraph('If you did not create this account, please contact support immediately.')}
        <p style="margin:0;font-size:14px;color:#374151;">— The LedgerFlow Team</p>
    `)
    await sendEmail(userEmail, 'Welcome to LedgerFlow', html)
}

async function sendTransactionEmail(userEmail, name, amount, toAccount) {
    const formattedAmount = Number(amount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
    const timestamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

    const html = withLayout(`
        ${heading('Transfer Successful')}
        ${paragraph(`Hi <strong>${name}</strong>, your transfer has been processed and the ledger has been updated.`)}
        ${infoCard([
            ['Status', badge('COMPLETED', '#16a34a')],
            ['Amount', formattedAmount, '#16a34a'],
            ['To Account', `...${String(toAccount).slice(-8)}`],
            ['Timestamp', timestamp],
        ])}
        ${divider()}
        ${paragraph('If you did not initiate this transfer, please contact support immediately — do not wait.')}
        <p style="margin:0;font-size:14px;color:#374151;">— The LedgerFlow Team</p>
    `)
    await sendEmail(userEmail, `Transfer of ${formattedAmount} successful`, html)
}

async function sendTransactionFailureEmail(userEmail, name, amount, toAccount) {
    const formattedAmount = Number(amount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
    const timestamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

    const html = withLayout(`
        ${heading('Transfer Failed')}
        ${paragraph(`Hi <strong>${name}</strong>, unfortunately your transfer could not be completed. No funds have been moved from your account.`)}
        ${infoCard([
            ['Status', badge('FAILED', '#dc2626')],
            ['Amount', formattedAmount, '#dc2626'],
            ['To Account', `...${String(toAccount).slice(-8)}`],
            ['Timestamp', timestamp],
        ])}
        ${divider()}
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
          <strong>What to do next:</strong> Please retry your transfer using a <em>new idempotency key</em>. 
          If the issue persists, contact support with the details above.
        </p>
        <p style="margin:0;font-size:14px;color:#374151;">— The LedgerFlow Team</p>
    `)
    await sendEmail(userEmail, `Transfer of ${formattedAmount} failed`, html)
}

module.exports = {
    sendRegistrationEmail,
    sendTransactionEmail,
    sendTransactionFailureEmail
};