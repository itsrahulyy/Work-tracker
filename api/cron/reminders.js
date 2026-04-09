require("dotenv").config();

const { runReminderFlow } = require("../../lib/runner");

module.exports = async (req, res) => {
  try {
    const dryRun = String(req.query.dryRun || "").toLowerCase() === "true";
    const job = req.query.job ? [String(req.query.job)] : [];
    const result = await runReminderFlow({ dryRun, jobs: job });

    res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};
