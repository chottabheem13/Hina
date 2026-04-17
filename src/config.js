const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const config = {
  token: requireEnv("DISCORD_TOKEN"),
  clientId: requireEnv("CLIENT_ID"),
  guildId: requireEnv("GUILD_ID"),
  reminderChannelId: requireEnv("REMINDER_CHANNEL_ID"),
  reportChannelId: requireEnv("REPORT_CHANNEL_ID"),
  logChannelId: requireEnv("LOG_CHANNEL_ID"),
  reminderUserIds: requireEnv("REMINDER_USER_IDS")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  cronExpr: (process.env.REMINDER_CRON || "0,30 18-23 * * *").trim(),
  timezone: (process.env.TIMEZONE || "Asia/Jakarta").trim(),
};

if (config.reminderUserIds.length < 1) {
  throw new Error("REMINDER_USER_IDS must contain at least one user ID.");
}

module.exports = config;
