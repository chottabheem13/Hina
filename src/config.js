const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parseUserMap(rawValue) {
  return rawValue
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const [namePart, idPart] = pair.split(":");
      const name = (namePart || "").trim();
      const userId = (idPart || "").trim();
      if (name && userId) {
        acc[name] = userId;
      }
      return acc;
    }, {});
}

function parsePositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt((rawValue || "").trim(), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseUserIds(rawValue) {
  return (rawValue || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

const shiftUserIds = parseUserMap(requireEnv("SHIFT_USER_IDS"));

for (const requiredName of ["Abi", "Cilla", "Sharon", "Eric"]) {
  if (!shiftUserIds[requiredName]) {
    throw new Error(`SHIFT_USER_IDS wajib memiliki mapping untuk ${requiredName}`);
  }
}

const shiftReminderChannelId = (process.env.SHIFT_REMINDER_CHANNEL_ID || process.env.REMINDER_CHANNEL_ID || "").trim();
if (!shiftReminderChannelId) {
  throw new Error("Missing required environment variable: SHIFT_REMINDER_CHANNEL_ID");
}

const logbookReminderChannelId = (process.env.LOGBOOK_REMINDER_CHANNEL_ID || "").trim();
if (logbookReminderChannelId && logbookReminderChannelId === shiftReminderChannelId) {
  throw new Error("LOGBOOK_REMINDER_CHANNEL_ID harus berbeda dari SHIFT_REMINDER_CHANNEL_ID.");
}

const taskNotificationChannelId = (process.env.TASK_NOTIFICATION_CHANNEL_ID || "").trim();

const config = {
  token: requireEnv("DISCORD_TOKEN"),
  clientId: requireEnv("CLIENT_ID"),
  guildId: requireEnv("GUILD_ID"),
  shiftReminderChannelId,
  logbookReminderChannelId,
  taskNotificationChannelId,
  checkinChannelId: (process.env.CHECKIN_CHANNEL_ID || requireEnv("REPORT_CHANNEL_ID")).trim(),
  logbookReportChannelId: (process.env.LOGBOOK_REPORT_CHANNEL_ID || process.env.REPORT_CHANNEL_ID || "").trim(),
  logChannelId: requireEnv("LOG_CHANNEL_ID"),
  shiftUserIds,
  adminUserIds: parseUserIds(process.env.ADMIN_USER_IDS),
  logbookUserIds: parseUserIds(process.env.LOGBOOK_USER_IDS || process.env.REMINDER_USER_IDS),
  logbookReminderCron: (process.env.LOGBOOK_REMINDER_CRON || "0,30 18-23 * * *").trim(),
  reminderRepeatMinutes: parsePositiveInt(process.env.REMINDER_REPEAT_MINUTES, 10),
  lateAfterMinutes: parsePositiveInt(process.env.LATE_AFTER_MINUTES, 10),
  finishGraceMinutes: parsePositiveInt(process.env.FINISH_GRACE_MINUTES, 30),
  spreadsheetId: (process.env.GSHEET_SPREADSHEET_ID || "").trim(),
  spreadsheetTabName: (process.env.GSHEET_TAB_NAME || "shift_checkins").trim(),
  spreadsheetTaskTabName: (process.env.GSHEET_TASK_TAB_NAME || "task_log").trim(),
  spreadsheetWeeklyRecapTabName: (process.env.GSHEET_WEEKLY_RECAP_TAB_NAME || "weekly_logbook_recap").trim(),
  spreadsheetLogbookHistoryTabName: (process.env.GSHEET_LOGBOOK_HISTORY_TAB_NAME || "logbook_history").trim(),
  googleServiceAccountEmail: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim(),
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim(),
  timezone: (process.env.TIMEZONE || "Asia/Jakarta").trim(),
};

module.exports = config;
