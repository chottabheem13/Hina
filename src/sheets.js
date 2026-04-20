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
    console.log("Google Sheets tidak terkonfigurasi, skip ensureHeaderRow");
    return;
  }

  try {
    const range = `${config.spreadsheetTabName}!A1:L1`;
    console.log(`Mengecek header di tab ${config.spreadsheetTabName}...`);

    const current = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range,
    });

    const hasHeader = Array.isArray(current.data.values) && current.data.values.length > 0;
    if (hasHeader) {
      console.log("Header shift_checkins sudah ada");
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

    console.log("Header shift_checkins berhasil dibuat");
  } catch (error) {
    if (error.code === 400 && error.message.includes("Unable to parse range")) {
      console.warn(`Tab '${config.spreadsheetTabName}' tidak ada di spreadsheet. Buat tab tersebut atau ubah GSHEET_TAB_NAME di .env`);
    } else {
      console.error("Gagal ensureHeaderRow:", error.message);
    }
  }
}

async function ensureTaskLogHeaderRow() {
  if (!sheetsClient) {
    console.log("Google Sheets tidak terkonfigurasi, skip ensureTaskLogHeaderRow");
    return;
  }

  const range = `${config.spreadsheetTaskTabName}!A1:K1`;
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
  });
}

async function ensureWeeklyRecapHeaderRow() {
  if (!sheetsClient) {
    console.log("Google Sheets tidak terkonfigurasi, skip ensureWeeklyRecapHeaderRow");
    return;
  }

  const range = `${config.spreadsheetWeeklyRecapTabName}!A1:H1`;
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
  });
}

async function ensureLogbookHistoryHeaderRow() {
  if (!sheetsClient) {
    console.log("Google Sheets tidak terkonfigurasi, skip ensureLogbookHistoryHeaderRow");
    return;
  }

  console.log(`Membuat header logbook history di tab ${config.spreadsheetLogbookHistoryTabName}...`);

  const range = `${config.spreadsheetLogbookHistoryTabName}!A1:F1`;
  const current = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
  });

  const hasHeader = Array.isArray(current.data.values) && current.data.values.length > 0;
  if (hasHeader) {
    console.log("Header logbook history sudah ada");
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
          "date_label",
          "user_id",
          "username",
          "source",
          "week_key",
        ],
      ],
    },
  });

  console.log("Header logbook history berhasil dibuat");
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

async function getAllTasks() {
  if (!sheetsClient) {
    return [];
  }

  const response = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.spreadsheetTaskTabName}!A:K`,
  });

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

  await sheetsClient.spreadsheets.values.append({
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
  });
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
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: update.range,
        valueInputOption: "RAW",
        requestBody: {
          values: update.values,
        },
      });
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

  await sheetsClient.spreadsheets.values.append({
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
  });
}

async function getWeeklyLogbookRecap(weekStart, weekEnd) {
  if (!sheetsClient) {
    return [];
  }

  const response = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.spreadsheetWeeklyRecapTabName}!A:H`,
  });

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

  try {
    console.log(`Saving logbook history: ${historyData.username} - ${historyData.dateLabel}`);

    await sheetsClient.spreadsheets.values.append({
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
    });

    console.log("Logbook history berhasil disimpan");
  } catch (error) {
    console.error("Gagal save logbook history:", error.message);
  }
}

async function getLogbookHistory(weekStart, weekEnd) {
  if (!sheetsClient) {
    return [];
  }

  const response = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.spreadsheetLogbookHistoryTabName}!A:F`,
  });

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
};
