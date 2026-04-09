const nodemailer = require("nodemailer");

function buildTransport(emailConfig) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });
}

async function sendEmail(emailConfig, subject, message, options = {}) {
  if (options.dryRun) {
    console.log(`   [dry-run] email -> ${emailConfig.to.join(", ") || "no recipients"}`);
    return { skipped: false, dryRun: true };
  }

  if (!emailConfig.user || !emailConfig.pass || emailConfig.to.length === 0) {
    console.log("   Email skipped: missing EMAIL_USER / EMAIL_PASS / EMAIL_TO.");
    return { skipped: true };
  }

  const transporter = buildTransport(emailConfig);
  const text = message.replace(/\*/g, "").replace(/_/g, "");

  await transporter.sendMail({
    from: emailConfig.from,
    to: emailConfig.to.join(", "),
    subject,
    text,
  });

  console.log(`   Email sent to ${emailConfig.to.length} recipient(s).`);
  return { skipped: false };
}

module.exports = {
  sendEmail,
};
