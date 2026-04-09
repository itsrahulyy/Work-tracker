const { getConfig } = require("./config");
const { sendEmail } = require("./email");
const { buildJobs } = require("./reminders");
const { sendWhatsappBatch } = require("./wati");

function parseCliArgs(argv) {
  const options = {
    dryRun: false,
    jobs: [],
  };

  argv.forEach((arg) => {
    if (arg === "--dry-run") {
      options.dryRun = true;
      return;
    }

    if (arg.startsWith("--job=")) {
      options.jobs.push(arg.split("=", 2)[1]);
    }
  });

  return options;
}

async function runReminderFlow(options = {}) {
  const config = getConfig();
  const jobs = await buildJobs(config, options.jobs || []);
  const summaries = [];

  console.log("Starting reminder runner...");
  console.log(`Timezone: ${config.timezone}`);
  console.log(`Mode: ${options.dryRun ? "dry-run" : "live"}`);

  for (const job of jobs) {
    console.log(`\n--- ${job.key} ---`);
    console.log(job.message.replace(/\*/g, "").replace(/_/g, ""));

    const [emailResult, whatsappResults] = await Promise.all([
      sendEmail(config.email, job.subject, job.message, { dryRun: options.dryRun }),
      sendWhatsappBatch(config.wati, config.notificationRecipients || config.team, job.message, {
        dryRun: options.dryRun,
        template: job.watiTemplate || null,
      }),
    ]);

    let followUpResults = [];
    if (job.followUpMessage && Array.isArray(job.followUpTargets) && job.followUpTargets.length > 0) {
      console.log(`Sending direct work-history reminders to ${job.followUpTargets.length} member(s).`);
      followUpResults = await sendWhatsappBatch(config.wati, job.followUpTargets, job.followUpMessage, {
        dryRun: options.dryRun,
      });
    }

    summaries.push({
      job: job.key,
      subject: job.subject,
      email: emailResult,
      whatsapp: whatsappResults,
      followUps: followUpResults,
    });
  }

  return {
    dryRun: Boolean(options.dryRun),
    jobs: summaries,
  };
}

module.exports = {
  parseCliArgs,
  runReminderFlow,
};
