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
  finishReminderLeadMinutes: parsePositiveInt(process.env.FINISH_REMINDER_LEAD_MINUTES, 10),
  finishGraceMinutes: parsePositiveInt(process.env.FINISH_GRACE_MINUTES, 30),
  spreadsheetId: (process.env.GSHEET_SPREADSHEET_ID || "").trim(),
  spreadsheetTabName: (process.env.GSHEET_TAB_NAME || "shift_checkins").trim(),
  spreadsheetTaskTabName: (process.env.GSHEET_TASK_TAB_NAME || "task_log").trim(),
  spreadsheetWeeklyRecapTabName: (process.env.GSHEET_WEEKLY_RECAP_TAB_NAME || "weekly_logbook_recap").trim(),
  spreadsheetLogbookHistoryTabName: (process.env.GSHEET_LOGBOOK_HISTORY_TAB_NAME || "logbook_history").trim(),
  googleServiceAccountEmail: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim(),
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim(),
  timezone: (process.env.TIMEZONE || "Asia/Jakarta").trim(),
  // AI Assistant Configuration
  openaiApiKey: (process.env.OPENAI_API_KEY || "").trim(),
  claudeApiKey: (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || "").trim(),
  claudeBaseUrl: (process.env.ANTHROPIC_BASE_URL || "").trim(),
  aiProvider: (process.env.AI_PROVIDER || "auto").trim(), // "openai", "claude", or "auto"
  aiModel: (process.env.AI_MODEL || "qwen-plus").trim(),
  aiBaseUrl: (process.env.AI_BASE_URL || "").trim(),
  aiMaxTokens: parsePositiveInt(process.env.AI_MAX_TOKENS, 1000),
  aiTemperature: parsePositiveInt(process.env.AI_TEMPERATURE || "7", 7) / 10,
  aiConversationMemoryMinutes: parsePositiveInt(process.env.AI_CONVERSATION_MEMORY_MINUTES, 30),
  aiSystemPrompt: (process.env.AI_SYSTEM_PROMPT || "").trim(),
  aiAllowedUserIds: parseUserIds(process.env.AI_ALLOWED_USER_IDS || ""),
  aiRateLimitPerMinute: parsePositiveInt(process.env.AI_RATE_LIMIT_PER_MINUTE, 10),
  aiChatChannelId: (process.env.AI_CHAT_CHANNEL_ID || "").trim(),
};

// AI configuration validation
const hasOpenAI = Boolean(config.openaiApiKey);
const hasClaude = Boolean(config.claudeApiKey);
const provider = config.aiProvider.toLowerCase();

if (!hasOpenAI && !hasClaude) {
  console.warn("WARNING: No AI API keys set - AI features will be disabled");
} else {
  let activeProvider = provider;
  if (provider === "auto") {
    activeProvider = hasClaude ? "claude" : "openai";
  }
  console.log(`AI features enabled with provider: ${activeProvider}${provider === "auto" ? " (auto)" : ""}`);
}

module.exports = config;
