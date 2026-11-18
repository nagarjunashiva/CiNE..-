const nodemailer = require("nodemailer");

let transporter = null;
let etherealAccount = null;

// Initialize mail transporter
async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

  if (host && user && pass && pass !== "your_app_password" && user !== "your_email@gmail.com") {
    // Real configured SMTP (e.g. Gmail App Password, Sendgrid, Mailgun)
    const transportConfig = host.includes("gmail")
      ? {
          service: "gmail",
          auth: { user, pass }
        }
      : {
          host,
          port,
          secure: port === 465,
          auth: { user, pass }
        };

    transporter = nodemailer.createTransport(transportConfig);
    console.log(`[Mailer] Configured SMTP via ${host.includes("gmail") ? "Gmail Service" : host} (${user})`);
  } else {
    // Ethereal / Local Test Transporter for instant zero-config testing
    try {
      etherealAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: etherealAccount.user,
          pass: etherealAccount.pass
        }
      });
      console.log(`[Mailer] Running with Ethereal test account (${etherealAccount.user}). Emails will generate instant preview links.`);
    } catch (err) {
      console.warn("[Mailer] Could not create Ethereal account, falling back to direct JSON transport:", err.message);
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
    }
  }

  return transporter;
}

// Cinematic Dark HTML Email Shell
function wrapTemplate({ title, preheader, bodyHtml }) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body { margin: 0; padding: 0; background-color: #080909; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F5F5F5; }
      .container { max-width: 540px; margin: 40px auto; background-color: #101212; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
      .header { padding: 32px 32px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: center; }
      .logo { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF; text-decoration: none; }
      .logo-dot { color: #E5242A; }
      .content { padding: 32px; }
      .title { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #FFFFFF; }
      .text { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.72); margin: 0 0 24px; }
      .otp-box { background: rgba(229, 36, 42, 0.08); border: 1px solid rgba(229, 36, 42, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
      .otp-code { font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #FFFFFF; margin: 0; }
      .otp-hint { font-size: 12px; color: #E5242A; margin-top: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
      .footer { padding: 24px 32px; background-color: #0c0d0d; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div style="display:none;max-height:0;overflow:hidden">${preheader || title}</div>
    <div class="container">
      <div class="header">
        <span class="logo">CiNE<span class="logo-dot">..</span></span>
      </div>
      <div class="content">
        ${bodyHtml}
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} CiNE Entertainment. If you didn't request this email, please safely ignore it.
      </div>
    </div>
  </body>
  </html>
  `;
}

// Send Email Verification OTP
async function sendVerificationOtp(email, name, otp) {
  const mailer = await getTransporter();
  const from = process.env.EMAIL_FROM || '"CiNE Movies" <no-reply@cine.app>';

  const html = wrapTemplate({
    title: "Verify your CiNE Account",
    preheader: `Your verification code is ${otp}`,
    bodyHtml: `
      <h1 class="title">Welcome to CiNE, ${name}!</h1>
      <p class="text">Thank you for joining. Use the 6-digit verification code below to confirm your email and complete your registration:</p>
      <div class="otp-box">
        <p class="otp-code">${otp}</p>
        <p class="otp-hint">Valid for 15 minutes</p>
      </div>
      <p class="text" style="font-size:13px;color:rgba(255,255,255,0.5)">Do not share this code with anyone. CiNE staff will never ask for your verification code.</p>
    `
  });

  const info = await mailer.sendMail({
    from,
    replyTo: process.env.REPLY_TO || "no-reply@cine.app",
    to: email,
    subject: `Your CiNE Verification Code: ${otp}`,
    text: `Hello ${name},\n\nYour CiNE verification code is: ${otp}\nThis code expires in 15 minutes.\n\nWelcome to CiNE!`,
    html
  });

  console.log(`\n========================================`);
  console.log(`[Mailer] SENT VERIFICATION OTP TO: ${email}`);
  console.log(`[Mailer] OTP CODE: ${otp}`);
  if (etherealAccount && nodemailer.getTestMessageUrl(info)) {
    console.log(`[Mailer] Preview Email in Browser: ${nodemailer.getTestMessageUrl(info)}`);
  }
  console.log(`========================================\n`);

  return { info, previewUrl: nodemailer.getTestMessageUrl(info) || null, otp };
}

// Send Welcome Email
async function sendWelcomeEmail(email, name) {
  const mailer = await getTransporter();
  const from = process.env.EMAIL_FROM || '"CiNE Movies" <no-reply@cine.app>';

  const html = wrapTemplate({
    title: "Your CiNE Account is Ready",
    preheader: "Account verified successfully",
    bodyHtml: `
      <h1 class="title">You're all set, ${name}!</h1>
      <p class="text">Your email has been verified. You now have full access to CiNE's global movie catalog, personal watchlist sync across devices, and personalized recommendations.</p>
      <p class="text">Ready to dive in? Explore thousands of trending films, classics, and box office hits.</p>
    `
  });

  try {
    const info = await mailer.sendMail({
      from,
      replyTo: process.env.REPLY_TO || "no-reply@cine.app",
      to: email,
      subject: `Welcome to CiNE, ${name}! Your account is active`,
      text: `Welcome to CiNE, ${name}!\n\nYour account is now verified and active.\nEnjoy exploring cinema!`,
      html
    });
    return { info, previewUrl: nodemailer.getTestMessageUrl(info) || null };
  } catch (err) {
    console.warn("[Mailer] Welcome email delivery failed:", err.message);
  }
}

// Send Password Reset OTP
async function sendPasswordResetOtp(email, name, otp) {
  const mailer = await getTransporter();
  const from = process.env.EMAIL_FROM || '"CiNE Movies" <no-reply@cine.app>';

  const html = wrapTemplate({
    title: "Reset your CiNE Password",
    preheader: `Your password reset code is ${otp}`,
    bodyHtml: `
      <h1 class="title">Password Reset Request</h1>
      <p class="text">We received a request to reset your CiNE account password. Enter the code below to set a new password:</p>
      <div class="otp-box">
        <p class="otp-code">${otp}</p>
        <p class="otp-hint">Valid for 15 minutes</p>
      </div>
      <p class="text" style="font-size:13px;color:rgba(255,255,255,0.5)">If you did not request a password reset, you can safely ignore this email.</p>
    `
  });

  const info = await mailer.sendMail({
    from,
    replyTo: process.env.REPLY_TO || "no-reply@cine.app",
    to: email,
    subject: `CiNE Password Reset Code: ${otp}`,
    text: `Hello ${name},\n\nYour password reset code is: ${otp}\nThis code expires in 15 minutes.`,
    html
  });

  console.log(`\n========================================`);
  console.log(`[Mailer] SENT PASSWORD RESET OTP TO: ${email}`);
  console.log(`[Mailer] RESET CODE: ${otp}`);
  if (etherealAccount && nodemailer.getTestMessageUrl(info)) {
    console.log(`[Mailer] Preview Email in Browser: ${nodemailer.getTestMessageUrl(info)}`);
  }
  console.log(`========================================\n`);

  return { info, previewUrl: nodemailer.getTestMessageUrl(info) || null, otp };
}

module.exports = {
  getTransporter,
  sendVerificationOtp,
  sendWelcomeEmail,
  sendPasswordResetOtp
};
