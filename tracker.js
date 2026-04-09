require("dotenv").config();

const { parseCliArgs, runReminderFlow } = require("./lib/runner");

async function main() {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    await runReminderFlow(options);
    console.log("\nDone.");
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

main();
