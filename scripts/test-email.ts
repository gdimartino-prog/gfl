import 'dotenv/config';
import nodemailer from 'nodemailer';

const user = process.env.GMAIL_USER || process.env.NOTIFY_MY_EMAIL || 'gdimartino@gmail.com';
const pass = process.env.GMAIL_APP_PASSWORD;
const to = process.env.NOTIFY_MY_EMAIL || 'gdimartino@gmail.com';

async function main() {
  if (!pass) {
    console.error('ERROR: GMAIL_APP_PASSWORD is not set in .env.local');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  console.log(`Sending test email from: ${user} to: ${to}`);

  const info = await transporter.sendMail({
    from: `GFL <${user}>`,
    to,
    subject: 'GFL Test Email',
    text: 'If you received this, Gmail SMTP is working correctly from the GFL app.',
  });

  console.log('SUCCESS! Message ID:', info.messageId);
}

main().catch(console.error);
