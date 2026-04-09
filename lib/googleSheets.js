const { fetchText } = require("./http");

function withCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_=${Date.now()}`;
}

function buildCsvUrl(sheetId, gid) {
  return withCacheBust(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`);
}

function buildJsonUrl(sheetId, gid) {
  return withCacheBust(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`);
}

async function fetchMemberSheetCsv(sheetId, gid) {
  return fetchText(buildCsvUrl(sheetId, gid));
}

async function fetchSheetTable(sheetId, gid) {
  const raw = await fetchText(buildJsonUrl(sheetId, gid));
  const jsonString = raw.replace(/^[^{]*/, "").replace(/\);?\s*$/, "");
  const parsed = JSON.parse(jsonString);
  if (!parsed.table) {
    throw new Error("Could not parse Google Sheets table payload.");
  }
  return parsed.table;
}

module.exports = {
  fetchMemberSheetCsv,
  fetchSheetTable,
};
