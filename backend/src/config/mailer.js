
const nodemailer = require("nodemailer");

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP email configuration is incomplete.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendPasswordResetEmail(email, resetUrl) {
  const transporter = createTransporter();

  const from =
    process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: email,
    subject: "Reset your ProcureFlow password",
    text: [
      "We received a request to reset your ProcureFlow password.",
      "",
      `Open this link to choose a new password: ${resetUrl}`,
      "",
      "This link expires in 15 minutes.",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#242333">
        <h1 style="color:#4f46a5">ProcureFlow</h1>
        <h2>Password reset request</h2>
        <p>We received a request to reset your ProcureFlow password.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#4f46a5;color:#fff;padding:13px 20px;text-decoration:none;border-radius:8px">
            Reset password
          </a>
        </p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
