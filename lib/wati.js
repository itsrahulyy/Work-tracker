const { postJson } = require("./http");

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || "").replace(/\/+$/, "");
}

function normalizePath(path) {
  if (!path) {
    return "/sendSessionMessage";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function stripFormatting(message) {
  return message.replace(/\*/g, "").replace(/_/g, "");
}

function buildTemplateUrl(watiConfig, phone) {
  const baseUrl = normalizeBaseUrl(watiConfig.apiUrl);
  const templatePath = normalizePath(watiConfig.templatePath);

  // WATI tenant URLs often look like:
  // https://host/{tenant}/api/v1
  // For absolute API paths like /api/v2/sendTemplateMessage, preserve the
  // tenant prefix and replace only the trailing /api/vN portion.
  if (/^\/api\//i.test(templatePath)) {
    const url = new URL(baseUrl);
    const tenantPrefix = url.pathname.replace(/\/api\/v\d+\/?$/i, "");
    return `${url.origin}${tenantPrefix}${templatePath}?whatsappNumber=${encodeURIComponent(phone)}`;
  }

  return `${baseUrl}${templatePath}?whatsappNumber=${encodeURIComponent(phone)}`;
}

function buildBroadcastName(templateName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${templateName || "reminder"}-${stamp}`;
}

function buildWorkHistoryTemplateParameters(member, templateContext) {
  const missing = templateContext.missingNames || [];
  return [
    { name: "date", value: templateContext.date || "" },
    { name: "users1", value: templateContext.updatedNames || "None" },
    { name: "user1", value: missing[0] || "-" },
    { name: "user2", value: missing[1] || "-" },
    { name: "user3", value: missing[2] || "-" },
    { name: "users_name", value: member.name || "" },
  ];
}

async function sendTemplateMessage(watiConfig, member, templateConfig, options = {}) {
  if (options.dryRun) {
    console.log(`   [dry-run] whatsapp template -> ${member.name} (${member.phone || "no phone"}) [${templateConfig.name}]`);
    return { member: member.name, dryRun: true, mode: "template" };
  }

  if (!member.phone) {
    return { member: member.name, skipped: true, reason: "missing phone", mode: "template" };
  }

  if (!watiConfig.apiUrl || !watiConfig.apiToken) {
    return { member: member.name, skipped: true, reason: "missing WATI config", mode: "template" };
  }

  const response = await postJson(
    buildTemplateUrl(watiConfig, member.phone),
    {
      template_name: templateConfig.name,
      broadcast_name: buildBroadcastName(templateConfig.name),
      parameters: buildWorkHistoryTemplateParameters(member, templateConfig.context || {}),
    },
    { Authorization: `Bearer ${watiConfig.apiToken}` }
  );

  let parsed = null;
  try {
    parsed = JSON.parse(response.body);
  } catch (error) {
    parsed = null;
  }

  if (response.statusCode >= 400) {
    return {
      member: member.name,
      skipped: false,
      success: false,
      reason: parsed && (parsed.info || parsed.message) ? parsed.info || parsed.message : `HTTP ${response.statusCode}`,
      raw: response.body,
      mode: "template",
    };
  }

  return {
    member: member.name,
    skipped: false,
    success: parsed ? parsed.result !== false : true,
    reason: parsed && (parsed.info || parsed.message) ? parsed.info || parsed.message : "",
    raw: response.body,
    mode: "template",
  };
}

async function sendSessionMessage(watiConfig, member, message, options = {}) {
  if (options.dryRun) {
    console.log(`   [dry-run] whatsapp -> ${member.name} (${member.phone || "no phone"})`);
    return { member: member.name, dryRun: true };
  }

  if (!member.phone) {
    return { member: member.name, skipped: true, reason: "missing phone" };
  }

  if (!watiConfig.apiUrl || !watiConfig.apiToken) {
    return { member: member.name, skipped: true, reason: "missing WATI config" };
  }

  const targetUrl = `${normalizeBaseUrl(watiConfig.apiUrl)}${normalizePath(watiConfig.directPath)}/${member.phone}`;
  const response = await postJson(
    targetUrl,
    { messageText: stripFormatting(message) },
    { Authorization: `Bearer ${watiConfig.apiToken}` }
  );

  let parsed = null;
  try {
    parsed = JSON.parse(response.body);
  } catch (error) {
    parsed = null;
  }

  if (response.statusCode >= 400) {
    return {
      member: member.name,
      skipped: false,
      success: false,
      reason: parsed && parsed.info ? parsed.info : `HTTP ${response.statusCode}`,
      raw: response.body,
    };
  }

  return {
    member: member.name,
    skipped: false,
    success: parsed ? parsed.result !== false : true,
    reason: parsed && parsed.info ? parsed.info : "",
    raw: response.body,
  };
}

async function sendWhatsappBatch(watiConfig, members, message, options = {}) {
  const activeMembers = members.filter((member) => member.phone);

  if (activeMembers.length === 0) {
    console.log("   WhatsApp skipped: no phone numbers configured.");
    return [];
  }

  const results = await Promise.all(
    activeMembers.map((member) => {
      if (options.template && options.template.name) {
        return sendTemplateMessage(watiConfig, member, options.template, options);
      }
      return sendSessionMessage(watiConfig, member, message, options);
    })
  );

  results.forEach((result) => {
    if (result.dryRun) {
      return;
    }

    if (result.success === false) {
      console.log(`   WATI ${result.member}: ${result.reason || "failed"}`);
      if (result.raw) {
        console.log(`   WATI ${result.member} raw: ${String(result.raw).slice(0, 500)}`);
      }
      return;
    }

    if (!result.skipped) {
      console.log(`   WhatsApp ${result.mode === "template" ? "template" : "message"} sent to ${result.member}.`);
    }
  });

  return results;
}

module.exports = {
  sendWhatsappBatch,
};
