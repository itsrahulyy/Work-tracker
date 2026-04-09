const DEFAULT_WORK_SHEET_ID = "1BhpaPXNG548mnOLBlJf-AxsOtDKK3xS1OTZDpo8qeXs";
const DEFAULT_VIDEO_SHEET_ID = "1uKLCI2Fk7LeESe_duiHvC0opwuKGZeGOhXkQgGJLMR8";
const DEFAULT_VIDEO_GID = "618981706";

function parseList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTeamMembers() {
  return [
    { name: "Anirudh", gid: "1284989482", phone: process.env.WATI_ANIRUDH || "" },
    { name: "Sakshi", gid: "39177903", phone: process.env.WATI_SAKSHI || "" },
    { name: "Prem", gid: "1251584438", phone: process.env.WATI_PREM || "" },
    { name: "Sonali", gid: "1216748043", phone: process.env.WATI_SONALI || "" },
  ];
}

function getNotificationRecipients(trackedMembers) {
  const recipients = trackedMembers.map((member) => ({
    name: member.name,
    phone: member.phone,
  }));

  if (process.env.WATI_RAHUL) {
    recipients.push({ name: "Rahul", phone: process.env.WATI_RAHUL });
  }

  return recipients;
}

function getConfig() {
  const team = getTeamMembers();

  return {
    timezone: process.env.APP_TIMEZONE || "Asia/Calcutta",
    workSheetId: process.env.GOOGLE_WORK_SHEET_ID || DEFAULT_WORK_SHEET_ID,
    videoSheetId: process.env.GOOGLE_VIDEO_SHEET_ID || DEFAULT_VIDEO_SHEET_ID,
    videoSheetGid: process.env.GOOGLE_VIDEO_SHEET_GID || DEFAULT_VIDEO_GID,
    email: {
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "",
      to: parseList(process.env.EMAIL_TO),
    },
    wati: {
      apiUrl: process.env.WATI_API_URL || process.env.WATI_API_ENDPOINT || "",
      apiToken: process.env.WATI_API_TOKEN || "",
      directPath: process.env.DIRECT_MSG_API_ENDPOINT || "/api/v2/sendSessionMessage",
      templatePath: process.env.WATI_TEMPLATE_API_ENDPOINT || "/api/v2/sendTemplateMessage",
      templateReminder1: process.env.WATI_TEMPLATE_REMINDER_1 || "",
      templateReminder2: process.env.WATI_TEMPLATE_REMINDER_2 || "",
    },
    team,
    notificationRecipients: getNotificationRecipients(team),
  };
}

module.exports = {
  getConfig,
};
