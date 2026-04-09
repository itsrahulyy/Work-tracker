const { fetchMemberSheetCsv, fetchSheetTable } = require("./googleSheets");

const FOLLOW_UP_MESSAGE = "Your work history is not updated. Please update it.";
const LEAVE_KEYWORDS = /\b(?:leave|leaves|on leave|sick leave|medical leave|half day|half-day|pto|holiday|comp off|week off)\b/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDateForTimezone(date, timeZone, options) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    ...options,
  }).format(date);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getTodayPatterns(timeZone) {
  const now = new Date();
  const day = formatDateForTimezone(now, timeZone, { day: "2-digit" });
  const dayNumber = String(Number(day));
  const month = formatDateForTimezone(now, timeZone, { month: "2-digit" });
  const monthNumber = String(Number(month));
  const year = formatDateForTimezone(now, timeZone, { year: "numeric" });
  const shortYear = year.slice(-2);
  const monthShort = formatDateForTimezone(now, timeZone, { month: "short" });
  const monthLong = formatDateForTimezone(now, timeZone, { month: "long" });
  const dayVariants = [day, dayNumber];
  const monthVariants = [month, monthNumber];
  const numericPatterns = [];

  for (const dayValue of dayVariants) {
    for (const monthValue of monthVariants) {
      numericPatterns.push(`${dayValue}/${monthValue}/${year}`);
      numericPatterns.push(`${dayValue}/${monthValue}/${shortYear}`);
      numericPatterns.push(`${dayValue}-${monthValue}-${year}`);
    }
  }

  return Array.from(
    new Set([
      ...numericPatterns,
      `${day} ${monthShort} ${year}`,
      `${dayNumber} ${monthShort} ${year}`,
      `${day} ${monthLong} ${year}`,
      `${dayNumber} ${monthLong} ${year}`,
      `${day} ${monthShort}, ${year}`,
      `${dayNumber} ${monthShort}, ${year}`,
      `${day} ${monthLong}, ${year}`,
      `${dayNumber} ${monthLong}, ${year}`,
    ].map(normalizeText))
  );
}

function todayLabel(timeZone) {
  return formatDateForTimezone(new Date(), timeZone, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatWorkMessage(results, timeZone) {
  const updated = results.filter((item) => item.updated);
  const skipped = results.filter((item) => item.skipped);
  const missing = results.filter((item) => !item.updated && !item.skipped);
  const checkedCount = updated.length + missing.length;
  const checkedLabel = checkedCount > 0 ? checkedCount : 1;

  let message = `📋 *Work History Check*\n🗓 ${todayLabel(timeZone)}\n\n`;

  if (updated.length > 0) {
    message += `✅ *Updated (${updated.length}/${checkedLabel}):*\n`;
    message += `${updated.map((item) => `  • ${item.name}`).join("\n")}\n`;
  }

  if (skipped.length > 0) {
    message += `\n⏭️ *Skipped - On Leave (${skipped.length}):*\n`;
    message += `${skipped.map((item) => `  • ${item.name}`).join("\n")}\n`;
  }

  if (missing.length > 0) {
    message += `\n❌ *Not Updated (${missing.length}/${checkedLabel}):*\n`;
    message += `${missing.map((item) => `  • ${item.name} _(last: ${item.lastDate})_`).join("\n")}\n`;
  }

  message += missing.length === 0
    ? "\n🎉 All team members updated today."
    : `\n⚠️ Please remind: ${missing.map((item) => item.name).join(", ")}`;

  return message;
}

function buildWorkHistoryTemplateContext(results, timeZone) {
  const updated = results.filter((item) => item.updated).map((item) => item.name);
  const missing = results.filter((item) => !item.updated && !item.skipped).map((item) => item.name);

  return {
    date: todayLabel(timeZone),
    updatedNames: updated.length > 0 ? updated.join(", ") : "None",
    missingNames: missing,
  };
}

function parseVideoRows(table) {
  const headers = table.cols.map((col) => (col.label || "").trim().toUpperCase());
  const indexes = {
    state: headers.findIndex((header) => header === "STATE"),
    city: headers.findIndex((header) => header === "CITY"),
    done: headers.findIndex((header) => header === "VIDEO DONE"),
  };

  if (indexes.city === -1 || indexes.done === -1) {
    throw new Error(`Missing required video columns. Found: ${headers.filter(Boolean).join(", ")}`);
  }

  const grouped = {};
  let lastState = null;

  for (const row of table.rows) {
    const getValue = (index, options = {}) => {
      if (index === -1) {
        return null;
      }
      const cell = row.c[index];
      if (!cell) {
        return null;
      }
      const candidate = options.preferFormatted ? cell.f ?? cell.v : cell.v ?? cell.f;
      return candidate == null || candidate === "" ? null : candidate;
    };

    const rawState = getValue(indexes.state);
    const cleanState = rawState
      ? String(rawState)
          .split(/[\n\r]+/)
          .map((item) => item.trim())
          .filter(Boolean)[0] || null
      : null;

    if (cleanState) {
      lastState = cleanState;
    }

    const city = getValue(indexes.city);
    const rawDone = getValue(indexes.done, { preferFormatted: true });

    if (!city || rawDone == null) {
      continue;
    }

    if (/^total$/i.test(String(city).trim())) {
      continue;
    }

    const parsed = parseVideoDoneValue(String(rawDone).trim());
    if (!parsed) {
      continue;
    }

    const stateKey = lastState || "Parks";
    const cityKey = String(city).trim();

    if (!grouped[stateKey]) {
      grouped[stateKey] = {};
    }

    if (!grouped[stateKey][cityKey]) {
      grouped[stateKey][cityKey] = { done: 0, total: 0 };
    }

    grouped[stateKey][cityKey].done += parsed.done;
    grouped[stateKey][cityKey].total += parsed.total;
  }

  return grouped;
}

function parseVideoDoneValue(value) {
  const slashMatch = value.match(/^(\d+)\s*(?:\/|of)\s*(\d+)$/i);
  if (slashMatch) {
    return {
      done: Number.parseInt(slashMatch[1], 10),
      total: Number.parseInt(slashMatch[2], 10),
    };
  }

  if (/^\d+$/.test(value)) {
    const count = Number.parseInt(value, 10);
    return { done: count, total: count };
  }

  if (/^(true|yes)$/i.test(value)) {
    return { done: 1, total: 1 };
  }

  if (/^(false|no)$/i.test(value)) {
    return { done: 0, total: 1 };
  }

  return null;
}

function formatVideoMessage(grouped, timeZone) {
  const states = Object.keys(grouped).sort();
  let message = `📊 *Park Video Status*\n🗓 ${todayLabel(timeZone)}\n`;

  if (states.length === 0) {
    return `${message}\n⚠️ No video data found.`;
  }

  const singleState = states.length === 1 && states[0] === "Parks";

  for (const state of states) {
    message += singleState ? "\n" : `\n*${state}*\n`;

    for (const city of Object.keys(grouped[state]).sort()) {
      const counts = grouped[state][city];
      const percentage = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
      const icon = percentage === 100 ? "✅" : percentage >= 50 ? "🟡" : "🔴";
      message += `  ${icon} ${city}: ${counts.done}/${counts.total} (${percentage}%)\n`;
    }
  }

  return message;
}

function getCellText(cell) {
  if (!cell) {
    return "";
  }
  return cell.f ?? cell.v ?? "";
}

function getTableRows(table) {
  return (table.rows || []).map((row) => (row.c || []).map(getCellText));
}

function rowContainsToday(row, patterns) {
  return row.some((value) => {
    const normalized = normalizeText(value);
    return normalized && patterns.some((pattern) => normalized.includes(pattern));
  });
}

function rowContainsLeave(row) {
  return row.some((value) => LEAVE_KEYWORDS.test(String(value || "")));
}

function extractLastKnownDate(raw) {
  const matches = String(raw || "").match(
    /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4})\b/g
  );
  return matches ? matches[matches.length - 1] : "unknown";
}

function analyzeMemberSheet(table, rawCsv, patterns) {
  const rows = getTableRows(table);
  const matchingRows = [];

  rows.forEach((row, index) => {
    if (rowContainsToday(row, patterns)) {
      matchingRows.push(index);
    }
  });

  const onLeave = matchingRows.some((index) => {
    for (let cursor = Math.max(0, index - 1); cursor <= Math.min(rows.length - 1, index + 1); cursor += 1) {
      if (rowContainsLeave(rows[cursor])) {
        return true;
      }
    }
    return false;
  });

  if (onLeave) {
    return {
      updated: false,
      skipped: true,
      lastDate: "on leave",
    };
  }

  const normalizedCsv = normalizeText(rawCsv);
  const updated = matchingRows.length > 0 || patterns.some((pattern) => normalizedCsv.includes(pattern));

  return {
    updated,
    skipped: false,
    lastDate: updated ? "updated today" : extractLastKnownDate(rawCsv),
  };
}

async function fetchMemberWorkHistoryStatus(config, member, patterns) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const [rawCsv, table] = await Promise.all([
        fetchMemberSheetCsv(config.workSheetId, member.gid),
        fetchSheetTable(config.workSheetId, member.gid),
      ]);

      const status = analyzeMemberSheet(table, rawCsv, patterns);
      if (status.updated || status.skipped || attempt === 2) {
        return {
          name: member.name,
          phone: member.phone,
          ...status,
        };
      }
    } catch (error) {
      lastError = error;
      if (attempt === 2) {
        break;
      }
    }

    await sleep(400);
  }

  return {
    name: member.name,
    phone: member.phone,
    updated: false,
    skipped: false,
    lastDate: lastError ? "fetch error" : "unknown",
  };
}

async function buildWorkHistoryJob(config) {
  const patterns = getTodayPatterns(config.timezone);
  const results = await Promise.all(config.team.map((member) => fetchMemberWorkHistoryStatus(config, member, patterns)));
  const followUpTargets = results.filter((item) => !item.updated && !item.skipped);

  return {
    key: "work-history",
    subject: `📋 Work History Check - ${todayLabel(config.timezone)}`,
    message: formatWorkMessage(results, config.timezone),
    watiTemplate: {
      name: config.wati.templateReminder1 || "work_update",
      context: buildWorkHistoryTemplateContext(results, config.timezone),
    },
    followUpMessage: FOLLOW_UP_MESSAGE,
    followUpTargets,
    results,
  };
}

async function buildVideoStatusJob(config) {
  const table = await fetchSheetTable(config.videoSheetId, config.videoSheetGid);
  const grouped = parseVideoRows(table);

  return {
    key: "video-status",
    subject: `📊 Park Video Status - ${todayLabel(config.timezone)}`,
    message: formatVideoMessage(grouped, config.timezone),
    grouped,
  };
}

async function buildJobs(config, selectedJobs) {
  const available = {
    "work-history": () => buildWorkHistoryJob(config),
    "video-status": () => buildVideoStatusJob(config),
  };

  const jobKeys = selectedJobs.length > 0 ? selectedJobs : Object.keys(available);
  const jobs = [];

  for (const jobKey of jobKeys) {
    const builder = available[jobKey];
    if (!builder) {
      throw new Error(`Unknown job: ${jobKey}`);
    }
    jobs.push(await builder());
  }

  return jobs;
}

module.exports = {
  buildJobs,
};
