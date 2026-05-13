const { google } = require("googleapis");
const config = require("./config");

function isSheetsConfigured() {
  if (String(process.env.GSHEET_DISABLE || "").trim() === "1") {
    return false;
  }
  return Boolean(config.spreadsheetId && config.googleServiceAccountEmail && config.googlePrivateKey);
}

const NETWORK_ERROR_COOLDOWN_MS = 60 * 1000;
let sheetsNetworkBackoffUntil = 0;

function getErrorCode(error) {
  if (!error) return "";
  return (
    error.code ||
    error.errno ||
    error?.cause?.code ||
    error?.cause?.errno ||
    error?.errors?.[0]?.reason ||
    ""
  );
}

function isNetworkResolutionError(error) {
  const code = String(getErrorCode(error) || "").toUpperCase();
  return code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENETUNREACH";
}

function isTransientNetworkError(error) {
  const code = String(getErrorCode(error) || "").toUpperCase();
  return (
    isNetworkResolutionError(error) ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH"
  );
}

function formatSheetsError(error) {
  const code = getErrorCode(error);
  const message = error?.message || String(error);
  return code ? `${code}: ${message}` : message;
}

function isInvalidRangeError(error) {
  return error?.code === 400 && typeof error?.message === "string" && error.message.includes("Unable to parse range");
}

function logSheetsNetworkHelpOnce(error) {
  if (!isNetworkResolutionError(error)) return;
  if (Date.now() < sheetsNetworkBackoffUntil) return;

  console.error(
    [
      "[Google Sheets] Tidak bisa resolve host Google API (DNS).",
      "Cek koneksi internet/DNS di server (mis. `nslookup sheets.googleapis.com`).",
      "Jika pakai proxy/VPS corporate, set `HTTPS_PROXY`/`HTTP_PROXY` atau allowlist domain `googleapis.com`.",
    ].join(" "),
  );
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

async function withSheets(actionLabel, fn, fallbackValue) {
  if (!sheetsClient) {
    return fallbackValue;
  }

  if (Date.now() < sheetsNetworkBackoffUntil) {
    return fallbackValue;
  }

  try {
    return await fn();
  } catch (error) {
    if (isInvalidRangeError(error)) {
      console.warn(
        `Tab/range Google Sheets tidak valid. Cek nama tab dan env vars: GSHEET_TAB_NAME/GSHEET_TASK_TAB_NAME/GSHEET_WEEKLY_RECAP_TAB_NAME/GSHEET_LOGBOOK_HISTORY_TAB_NAME.`,
      );
      return fallbackValue;
    }

    if (isTransientNetworkError(error)) {
      logSheetsNetworkHelpOnce(error);
      sheetsNetworkBackoffUntil = Date.now() + NETWORK_ERROR_COOLDOWN_MS;
      console.warn(`[Google Sheets] ${actionLabel} gagal sementara (${formatSheetsError(error)}). Skip dulu 60 detik.`);
      return fallbackValue;
    }

    console.error(`[Google Sheets] ${actionLabel} gagal (${formatSheetsError(error)})`);
    return fallbackValue;
  }
}

async function ensureHeaderRow() {
  if (!sheetsClient) {
    console.log("Google Sheets tidak terkonfigurasi, skip ensureHeaderRow");
    return;
  }

  const range = `${config.spreadsheetTabName}!A1:L1`;
  console.log(`Mengecek header di tab ${config.spreadsheetTabName}...`);

  const current = await withSheets(
    "ensureHeaderRow(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range,
      }),
    null,
  );

  if (!current) {
    return;
  }

  const hasHeader = Array.isArray(current.data.values) && current.data.values.length > 0;
  if (hasHeader) {
    console.log("Header shift_checkins sudah ada");
    return;
  }

  const updated = await withSheets(
    "ensureHeaderRow(values.update)",
    () =>
      sheetsClient.spreadsheets.values.update({
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
      }),
    null,
  );

  if (updated) {
    console.log("Header shift_checkins berhasil dibuat");
  }
}

async function ensureTaskLogHeaderRow() {
  if (!sheetsClient) {
    console.log("Google Sheets tidak terkonfigurasi, skip ensureTaskLogHeaderRow");
    return;
  }

  const range = `${config.spreadsheetTaskTabName}!A1:K1`;
  const current = await withSheets(
    "ensureTaskLogHeaderRow(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range,
      }),
    null,
  );

  if (!current) {
    return;
  }

  const hasHeader = Array.isArray(current.data.values) && current.data.values.length > 0;
  if (hasHeader) {
    return;
  }

  await withSheets("ensureTaskLogHeaderRow(values.update)", () =>
    sheetsClient.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            "task_id",
            "discord_id",
            "nama",
            "task_desc",
            "deadline",
            "status",
            "created_by",
            "created_at",
            "done_at",
            "last_reminded",
            "cancelled_at",
          ],
        ],
      },
    }),
  );
}

async function ensureWeeklyRecapHeaderRow() {
  if (!sheetsClient) {
    console.log("Google Sheets tidak terkonfigurasi, skip ensureWeeklyRecapHeaderRow");
    return;
  }

  const range = `${config.spreadsheetWeeklyRecapTabName}!A1:H1`;
  const current = await withSheets(
    "ensureWeeklyRecapHeaderRow(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range,
      }),
    null,
  );

  if (!current) {
    return;
  }

  const hasHeader = Array.isArray(current.data.values) && current.data.values.length > 0;
  if (hasHeader) {
    return;
  }

  await withSheets("ensureWeeklyRecapHeaderRow(values.update)", () =>
    sheetsClient.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            "week_start",
            "week_end",
            "week_number",
            "user_id",
            "username",
            "submitted_count",
            "missed_count",
            "compliance_rate",
          ],
        ],
      },
    }),
  );
}

async function ensureLogbookHistoryHeaderRow() {
  if (!sheetsClient) {
    console.log("Google Sheets tidak terkonfigurasi, skip ensureLogbookHistoryHeaderRow");
    return;
  }

  console.log(`Membuat header logbook history di tab ${config.spreadsheetLogbookHistoryTabName}...`);

  const range = `${config.spreadsheetLogbookHistoryTabName}!A1:F1`;
  const current = await withSheets(
    "ensureLogbookHistoryHeaderRow(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range,
      }),
    null,
  );

  if (!current) {
    return;
  }

  const hasHeader = Array.isArray(current.data.values) && current.data.values.length > 0;
  if (hasHeader) {
    console.log("Header logbook history sudah ada");
    return;
  }

  const updated = await withSheets(
    "ensureLogbookHistoryHeaderRow(values.update)",
    () =>
      sheetsClient.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values: [["timestamp_iso", "date_label", "user_id", "username", "source", "week_key"]],
        },
      }),
    null,
  );

  if (updated) {
    console.log("Header logbook history berhasil dibuat");
  }
}

async function appendShiftRecord(row) {
  if (!sheetsClient) {
    return;
  }

  await withSheets("appendShiftRecord(values.append)", () =>
    sheetsClient.spreadsheets.values.append({
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
    }),
  );
}

async function getRowsForDay(dayKey) {
  if (!sheetsClient) {
    return [];
  }

  const response = await withSheets(
    "getRowsForDay(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${config.spreadsheetTabName}!A:L`,
      }),
    null,
  );

  if (!response) {
    return [];
  }

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

async function getAllTasks() {
  if (!sheetsClient) {
    return [];
  }

  const response = await withSheets(
    "getAllTasks(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${config.spreadsheetTaskTabName}!A:K`,
      }),
    null,
  );

  if (!response) {
    return [];
  }

  const values = response.data.values || [];
  if (values.length <= 1) {
    return [];
  }

  const rows = values.slice(1);
  return rows.map((row) => ({
    taskId: row[0] || "",
    discordId: row[1] || "",
    nama: row[2] || "",
    taskDesc: row[3] || "",
    deadline: row[4] || "",
    status: row[5] || "",
    createdBy: row[6] || "",
    createdAt: row[7] || "",
    doneAt: row[8] || "",
    lastReminded: row[9] || "",
    cancelledAt: row[10] || "",
  }));
}

async function createTask(task) {
  if (!sheetsClient) {
    return;
  }

  await withSheets("createTask(values.append)", () =>
    sheetsClient.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `${config.spreadsheetTaskTabName}!A:K`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            task.taskId,
            task.discordId,
            task.nama,
            task.taskDesc,
            task.deadline,
            task.status,
            task.createdBy,
            task.createdAt,
            task.doneAt || "",
            task.lastReminded || "",
            task.cancelledAt || "",
          ],
        ],
      },
    }),
  );
}

async function updateTaskStatus(taskId, status, updateData = {}) {
  if (!sheetsClient) {
    return false;
  }

  const allTasks = await getAllTasks();
  const taskIndex = allTasks.findIndex((t) => t.taskId === taskId);

  if (taskIndex === -1) {
    return false;
  }

  const rowIndex = taskIndex + 2;
  const statusColumn = "F";
  const updates = [];

  if (status) {
    updates.push({
      range: `${config.spreadsheetTaskTabName}!${statusColumn}${rowIndex}`,
      values: [[status]],
    });
  }

  if (updateData.doneAt !== undefined) {
    updates.push({
      range: `${config.spreadsheetTaskTabName}!I${rowIndex}`,
      values: [[updateData.doneAt]],
    });
  }

  if (updateData.lastReminded !== undefined) {
    updates.push({
      range: `${config.spreadsheetTaskTabName}!J${rowIndex}`,
      values: [[updateData.lastReminded]],
    });
  }

  if (updateData.cancelledAt !== undefined) {
    updates.push({
      range: `${config.spreadsheetTaskTabName}!K${rowIndex}`,
      values: [[updateData.cancelledAt]],
    });
  }

  if (updates.length > 0) {
    for (const update of updates) {
      await withSheets("updateTaskStatus(values.update)", () =>
        sheetsClient.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: update.range,
          valueInputOption: "RAW",
          requestBody: {
            values: update.values,
          },
        }),
      );
    }
  }

  return true;
}

async function getTaskById(taskId) {
  const allTasks = await getAllTasks();
  return allTasks.find((t) => t.taskId === taskId) || null;
}

async function getPendingTasks() {
  const allTasks = await getAllTasks();
  return allTasks.filter((t) => t.status === "pending");
}

async function saveWeeklyLogbookRecap(recapData) {
  if (!sheetsClient) {
    return;
  }

  await withSheets("saveWeeklyLogbookRecap(values.append)", () =>
    sheetsClient.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `${config.spreadsheetWeeklyRecapTabName}!A:H`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            recapData.weekStart,
            recapData.weekEnd,
            recapData.weekNumber,
            recapData.userId,
            recapData.username,
            recapData.submittedCount,
            recapData.missedCount,
            recapData.complianceRate,
          ],
        ],
      },
    }),
  );
}

async function getWeeklyLogbookRecap(weekStart, weekEnd) {
  if (!sheetsClient) {
    return [];
  }

  const response = await withSheets(
    "getWeeklyLogbookRecap(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${config.spreadsheetWeeklyRecapTabName}!A:H`,
      }),
    null,
  );

  if (!response) {
    return [];
  }

  const values = response.data.values || [];
  if (values.length <= 1) {
    return [];
  }

  const rows = values.slice(1);
  return rows
    .map((row) => ({
      weekStart: row[0] || "",
      weekEnd: row[1] || "",
      weekNumber: row[2] || "",
      userId: row[3] || "",
      username: row[4] || "",
      submittedCount: Number.parseInt(row[5] || "0", 10),
      missedCount: Number.parseInt(row[6] || "0", 10),
      complianceRate: row[7] || "0%",
    }))
    .filter((row) => row.weekStart === weekStart && row.weekEnd === weekEnd);
}

async function appendLogbookHistory(historyData) {
  if (!sheetsClient) {
    console.log("Google Sheets tidak terkonfigurasi, skip appendLogbookHistory");
    return;
  }

  console.log(`Saving logbook history: ${historyData.username} - ${historyData.dateLabel}`);

  const appended = await withSheets(
    "appendLogbookHistory(values.append)",
    () =>
      sheetsClient.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: `${config.spreadsheetLogbookHistoryTabName}!A:F`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [
            [
              historyData.timestampIso,
              historyData.dateLabel,
              historyData.userId,
              historyData.username,
              historyData.source,
              historyData.weekKey,
            ],
          ],
        },
      }),
    null,
  );

  if (appended) {
    console.log("Logbook history berhasil disimpan");
  }
}

async function getLogbookHistory(weekStart, weekEnd) {
  if (!sheetsClient) {
    return [];
  }

  const response = await withSheets(
    "getLogbookHistory(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${config.spreadsheetLogbookHistoryTabName}!A:F`,
      }),
    null,
  );

  if (!response) {
    return [];
  }

  const values = response.data.values || [];
  if (values.length <= 1) {
    return [];
  }

  const rows = values.slice(1);
  return rows
    .map((row) => ({
      timestampIso: row[0] || "",
      dateLabel: row[1] || "",
      userId: row[2] || "",
      username: row[3] || "",
      source: row[4] || "",
      weekKey: row[5] || "",
    }))
    .filter((row) => row.weekKey >= weekStart && row.weekKey <= weekEnd);
}

async function hasUserSubmittedLogbookOnDate(userId, dateLabel) {
  if (!sheetsClient) {
    return false;
  }

  const response = await withSheets(
    "hasUserSubmittedLogbookOnDate(values.get)",
    () =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${config.spreadsheetLogbookHistoryTabName}!A:F`,
      }),
    null,
  );

  if (!response) {
    return false;
  }

  const values = response.data.values || [];
  if (values.length <= 1) {
    return false;
  }

  const rows = values.slice(1);
  return rows.some((row) => {
    return row[2] === userId && row[1] === dateLabel;
  });
}

module.exports = {
  isSheetsConfigured,
  ensureHeaderRow,
  ensureTaskLogHeaderRow,
  ensureWeeklyRecapHeaderRow,
  ensureLogbookHistoryHeaderRow,
  appendShiftRecord,
  getRowsForDay,
  getAllTasks,
  createTask,
  updateTaskStatus,
  getTaskById,
  getPendingTasks,
  saveWeeklyLogbookRecap,
  getWeeklyLogbookRecap,
  appendLogbookHistory,
  getLogbookHistory,
  hasUserSubmittedLogbookOnDate,
};
