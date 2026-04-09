require("dotenv").config();
const https = require("https");
const nodemailer = require("nodemailer");

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SHEET_ID = "1BhpaPXNG548mnOLBlJf-AxsOtDKK3xS1OTZDpo8qeXs";

const TEAM = [
  { name: "Anirudh",  gid: "1284989482" },
  { name: "Sakshi",   gid: "39177903"   },
  { name: "Prem",     gid: "1251584438" },
  { name: "Sonali",   gid: "1216748043" },
];

// ─── SERVICE SELECTION (CLI args) ──────────────────────────────────────────
// node work-history.js --email | --telegram | --all (default: both)
const args = process.argv.slice(2);
const doEmail    = args.includes("--email")    || args.includes("--all") || args.length === 0;
const doTelegram = args.includes("--telegram") || args.includes("--all") || args.length === 0;

// ─── TODAY'S DATE ──────────────────────────────────────────────────────────
function getTodayPatterns() {
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2, "0");
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const yy   = String(yyyy).slice(2);
  return [
    `${dd}/${mm}/${yyyy}`, // 26/03/2026
    `${dd}/${mm}/${yy}`,   // 26/03/26
    `${dd}-${mm}-${yyyy}`, // 26-03-2026
  ];
}

// ─── 1. FETCH ONE MEMBER'S SHEET ───────────────────────────────────────────
function fetchMemberSheet(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        https.get(res.headers.location, (res2) => {
          let raw = "";
          res2.on("data", (c) => (raw += c));
          res2.on("end", () => resolve(raw));
        }).on("error", reject);
        return;
      }
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve(raw));
    }).on("error", reject);
  });
}

// ─── 2. CHECK IF UPDATED TODAY ─────────────────────────────────────────────
function checkUpdatedToday(rawCsv, patterns) {
  for (const pattern of patterns) {
    if (rawCsv.includes(pattern)) return { updated: true, matchedDate: pattern };
  }
  // Also find the last date in the sheet for context
  const matches = rawCsv.match(/\d{2}\/\d{2}\/\d{2,4}/g);
  const lastDate = matches ? matches[matches.length - 1] : "unknown";
  return { updated: false, lastDate };
}

// ─── 3. FORMAT MESSAGE ─────────────────────────────────────────────────────
function formatMessage(results) {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  let msg = `📋 *Work History Check*\n`;
  msg += `🗓 Date: ${today}\n\n`;

  const updated    = results.filter((r) => r.updated);
  const notUpdated = results.filter((r) => !r.updated);

  if (updated.length > 0) {
    msg += `✅ *Updated Today (${updated.length}/${results.length}):*\n`;
    updated.forEach((r) => (msg += `  • ${r.name}\n`));
  }

  if (notUpdated.length > 0) {
    msg += `\n❌ *Not Updated (${notUpdated.length}/${results.length}):*\n`;
    notUpdated.forEach((r) => {
      msg += `  • ${r.name}`;
      if (r.lastDate) msg += ` _(last: ${r.lastDate})_`;
      msg += `\n`;
    });
  }

  if (notUpdated.length === 0) {
    msg += `\n🎉 All team members updated their work history today!`;
  } else {
    msg += `\n⚠️ Please remind: ${notUpdated.map((r) => r.name).join(", ")} to update.`;
  }

  return msg;
}

// ─── 4. SEND EMAIL ─────────────────────────────────────────────────────────
async function sendEmailNotification(message) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Support multiple comma-separated recipients
  const recipients = process.env.EMAIL_TO.split(",").map((e) => e.trim()).join(", ");
  const plainText  = message.replace(/\*/g, "").replace(/_/g, "");

  await transporter.sendMail({
    from:    process.env.EMAIL_USER,
    to:      recipients,
    subject: `📋 Work History Check — ${new Date().toLocaleDateString("en-IN")}`,
    text:    plainText,
  });

  console.log("📧 Email sent successfully.");
}

// ─── 5. SEND TELEGRAM ──────────────────────────────────────────────────────
function sendTelegramNotification(message) {
  return new Promise((resolve, reject) => {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const path   = `/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}&parse_mode=Markdown`;

    https.get({ hostname: "api.telegram.org", path }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const json = JSON.parse(data);
        if (json.ok) { console.log("✈️  Telegram message sent."); resolve(); }
        else reject(new Error(`Telegram error: ${json.description}`));
      });
    }).on("error", reject);
  });
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Starting Work History Checker...");
  const patterns = getTodayPatterns();
  console.log(`📅 Checking for today's dates: ${patterns.join(" | ")}\n`);

  try {
    // Fetch all sheets in parallel
    const results = await Promise.all(
      TEAM.map(async (member) => {
        try {
          const raw = await fetchMemberSheet(member.gid);
          const check = checkUpdatedToday(raw, patterns);
          console.log(`  ${check.updated ? "✅" : "❌"} ${member.name}: ${check.updated ? "Updated" : `Not updated (last: ${check.lastDate})`}`);
          return { name: member.name, ...check };
        } catch (err) {
          console.log(`  ⚠️  ${member.name}: Failed to fetch (${err.message})`);
          return { name: member.name, updated: false, lastDate: "fetch error" };
        }
      })
    );

    const message = formatMessage(results);

    console.log("\n─────────────────────────────");
    console.log(message.replace(/\*/g, "").replace(/_/g, ""));
    console.log("─────────────────────────────\n");

    const tasks = [];
    if (doEmail)    tasks.push(sendEmailNotification(message));
    if (doTelegram) tasks.push(sendTelegramNotification(message));

    await Promise.all(tasks);
    console.log("✅ All notifications sent!\n");
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  }
}

main();
