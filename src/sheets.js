const { google } = require("googleapis");
const config = require("./config");

function isSheetsConfigured() {
  return Boolean(config.spreadsheetId && config.googleServiceAccountEmail && config.googlePrivateKey);
}

function createSheetsClient() {
  if (!isSheetsConfigured()) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

const sheetsClient = createSheetsClient();

async function ensureHeaderRow() {
  if (!sheetsClient) {
    return;
  }

  const range = `${config.spreadsheetTabName}!A1:L1`;
  const current = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
  });

  const hasHeader = Array.isArray(current.data.values) && current.data.values.length > 0;
  if (hasHeader) {
    return;
  }

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          "timestamp_iso",
          "day_key",
          "date_label",
          "shift_id",
          "shift_label",
          "user_id",
          "user_tag",
          "role",
          "status",
          "checkin_at_iso",
          "source",
          "evidence_link",
        ],
      ],
    },
  });
}

async function appendShiftRecord(row) {
  if (!sheetsClient) {
    return;
  }

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `${config.spreadsheetTabName}!A:L`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          row.timestampIso,
          row.dayKey,
          row.dateLabel,
          row.shiftId,
          row.shiftLabel,
          row.userId,
          row.userTag,
          row.role,
          row.status,
          row.checkinAtIso,
          row.source,
          row.evidenceLink || "",
        ],
      ],
    },
  });
}

async function getRowsForDay(dayKey) {
  if (!sheetsClient) {
    return [];
  }

  const response = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.spreadsheetTabName}!A:L`,
  });

  const values = response.data.values || [];
  if (values.length <= 1) {
    return [];
  }

  const rows = values.slice(1);
  return rows
    .map((row) => ({
      timestampIso: row[0] || "",
      dayKey: row[1] || "",
      dateLabel: row[2] || "",
      shiftId: row[3] || "",
      shiftLabel: row[4] || "",
      userId: row[5] || "",
      userTag: row[6] || "",
      role: row[7] || "",
      status: row[8] || "",
      checkinAtIso: row[9] || "",
      source: row[10] || "",
      evidenceLink: row[11] || "",
    }))
    .filter((row) => row.dayKey === dayKey);
}

module.exports = {
  isSheetsConfigured,
  ensureHeaderRow,
  appendShiftRecord,
  getRowsForDay,
};
