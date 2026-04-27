const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  channelMention,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  userMention,
} = require("discord.js");
const cron = require("node-cron");
const config = require("./config");
const sheets = require("./sheets");
const taskHandler = require("./taskHandler");
const aiHandler = require("./aiHandler");
const { SHIFT_DEFINITIONS } = require("./shiftConfig");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Expose client to taskHandler
global.client = client;

const LOGIN_RETRY_MS = 15000;
const CHECKIN_BUTTON_PREFIX = "shift-start:";
const FINISH_BUTTON_PREFIX = "shift-finish:";
const TASK_DONE_BUTTON_PREFIX = "task-done:";
const FINISH_MODAL_PREFIX = "shift-finish-modal:";
const LOGBOOK_DONE_BUTTON_PREFIX = "logbook-done:";
const FINISH_GIF_URL = "https://media1.tenor.com/m/uCHykOR2BTwAAAAd/girls-band-cry-hina.gif";

const WEEKDAY_ID_LABEL = {
  monday: "Senin",
  tuesday: "Selasa",
  wednesday: "Rabu",
  thursday: "Kamis",
  friday: "Jumat",
  saturday: "Sabtu",
  sunday: "Minggu",
};

const activeSessions = new Map();
const sessionHistoryByDay = new Map();
const logbookReportedToday = new Set();
const logbookWeeklyStats = new Map(); // Track stats per user per week
let activeLogbookDayKey = "";
let activeLogbookWeekKey = "";

function getTimeZoneDateParts(date, timeZone = config.timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    year: Number.parseInt(parts.find((part) => part.type === "year").value, 10),
    month: Number.parseInt(parts.find((part) => part.type === "month").value, 10),
    day: Number.parseInt(parts.find((part) => part.type === "day").value, 10),
    hour: Number.parseInt(parts.find((part) => part.type === "hour").value, 10),
    minute: Number.parseInt(parts.find((part) => part.type === "minute").value, 10),
    second: Number.parseInt(parts.find((part) => part.type === "second").value, 10),
  };
}

function getTimeZoneOffsetMs(date, timeZone = config.timezone) {
  const parts = getTimeZoneDateParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function createDateInTimezone(date = new Date(), timeZone = config.timezone) {
  const parts = getTimeZoneDateParts(date, timeZone);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMs);
}

function nowInTimezone() {
  return createDateInTimezone(new Date(), config.timezone);
}

function currentTimeMs() {
  return nowInTimezone().getTime();
}

/**
 * Create a Date object for today at the given time (HH:MM format) in configured timezone
 * This stays stable even if the VPS runs in a different local timezone.
 */
function createDateFromTimeLabel(timeLabel) {
  const [hour, minute] = timeLabel.split(":").map((value) => Number.parseInt(value, 10));
  const todayParts = getTimeZoneDateParts(new Date());
  const utcGuess = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, hour, minute, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess));
  return new Date(utcGuess - offsetMs);
}

/**
 * Debug function to verify time calculations are accurate
 * Returns formatted string showing current time and shift times in configured timezone
 */
function debugTimeInfo() {
  const now = new Date();
  const nowTz = formatClock(now);

  const shift1Start = createDateFromTimeLabel("09:00");
  const shift1End = createDateFromTimeLabel("12:00");
  const shift2Start = createDateFromTimeLabel("12:00");
  const shift2End = createDateFromTimeLabel("15:00");
  const shift3Start = createDateFromTimeLabel("15:00");
  const shift3End = createDateFromTimeLabel("18:00");

  return {
    currentTime: nowTz,
    currentTimeUtc: now.toISOString(),
    timezone: config.timezone,
    shifts: [
      {
        label: "Shift 1",
        start: formatClock(shift1Start),
        end: formatClock(shift1End),
        startUtc: shift1Start.toISOString(),
        endUtc: shift1End.toISOString(),
      },
      {
        label: "Shift 2",
        start: formatClock(shift2Start),
        end: formatClock(shift2End),
        startUtc: shift2Start.toISOString(),
        endUtc: shift2End.toISOString(),
      },
      {
        label: "Shift 3",
        start: formatClock(shift3Start),
        end: formatClock(shift3End),
        startUtc: shift3Start.toISOString(),
        endUtc: shift3End.toISOString(),
      },
    ],
  };
}

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function extractFinishLinkFromText(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^selesai\s+(\S+)$/i);
  if (!match) {
    return null;
  }
  return match[1];
}

function isLogbookReportMessage(messageContent) {
  const content = messageContent.toLowerCase();
  const requiredKeywords = ["isi", "logbook", "log book", "udah", "sudah", "belum", "dah"];
  return requiredKeywords.some((keyword) => content.includes(keyword));
}

function isAdminUser(userId) {
  if (config.adminUserIds.length === 0) {
    return true;
  }
  return config.adminUserIds.includes(userId);
}

function getWeekdayKey(date = nowInTimezone()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: config.timezone,
  })
    .format(date)
    .toLowerCase();
}

function todayKeyString(date = nowInTimezone()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: config.timezone,
  }).format(date);
}

function todayDateString(date = nowInTimezone()) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: config.timezone,
  }).format(date);
}

function formatClock(date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: config.timezone,
  }).format(date);
}

function syncLogbookDailyState() {
  const dayKey = todayKeyString();
  if (dayKey !== activeLogbookDayKey) {
    activeLogbookDayKey = dayKey;
    logbookReportedToday.clear();
  }
}

function getWeekRange(date = nowInTimezone()) {
  // Get Monday of current week
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(diff + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    weekStart: new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: config.timezone,
    }).format(monday),
    weekEnd: new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: config.timezone,
    }).format(sunday),
    weekNumber: getWeekNumber(monday),
    monday,
    sunday,
  };
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function syncLogbookWeeklyState() {
  const weekRange = getWeekRange();
  const weekKey = `${weekRange.weekStart}_${weekRange.weekEnd}`;

  if (weekKey !== activeLogbookWeekKey) {
    activeLogbookWeekKey = weekKey;
    logbookWeeklyStats.clear();
  }

  return weekRange;
}

function updateLogbookWeeklyStats(userId, username, submitted = true) {
  syncLogbookWeeklyState();

  if (!logbookWeeklyStats.has(userId)) {
    logbookWeeklyStats.set(userId, {
      userId,
      username,
      submittedCount: 0,
      missedCount: 0,
    });
  }

  const stats = logbookWeeklyStats.get(userId);
  if (submitted) {
    stats.submittedCount++;
  } else {
    stats.missedCount++;
  }
}

async function hasUserSubmittedLogbookToday(userId) {
  // Check in-memory first
  if (logbookReportedToday.has(userId)) {
    return true;
  }

  // Check Google Sheets logbook_history
  if (sheets.isSheetsConfigured()) {
    try {
      const today = todayDateString();
      const hasSubmitted = await sheets.hasUserSubmittedLogbookOnDate(userId, today);
      if (hasSubmitted) {
        // User sudah isi, tambahkan ke memory
        logbookReportedToday.add(userId);
        return true;
      }
    } catch (error) {
      console.error("Gagal cek logbook history:", error.message);
    }
  }

  return false;
}

async function getPendingLogbookUserIds() {
  syncLogbookDailyState();
  const pending = [];

  for (const userId of config.logbookUserIds) {
    // Skip jika sudah di memory
    if (logbookReportedToday.has(userId)) {
      continue;
    }

    // Cek di Google Sheets
    if (sheets.isSheetsConfigured()) {
      try {
        const today = todayDateString();
        const hasSubmitted = await sheets.hasUserSubmittedLogbookOnDate(userId, today);
        if (hasSubmitted) {
          // User sudah isi, tambahkan ke memory
          logbookReportedToday.add(userId);
          continue;
        }
      } catch (error) {
        console.error("Gagal cek logbook history:", error.message);
      }
    }

    // User belum isi
    pending.push(userId);
  }

  return pending;
}

function createLogbookDoneButtonRow(dayKey, disabled = false) {
  const button = new ButtonBuilder()
    .setCustomId(`${LOGBOOK_DONE_BUTTON_PREFIX}${dayKey}`)
    .setLabel("Aku udah isi")
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);

  return new ActionRowBuilder().addComponents(button);
}

function getSessionId(dayKey, shiftId) {
  return `${dayKey}:${shiftId}`;
}

function getShiftAssigneesForToday(shiftDef, weekdayKey) {
  const primaryName = shiftDef.primaryByDay[weekdayKey];
  if (!primaryName) {
    return [];
  }

  const primaryUserId = config.shiftUserIds[primaryName];
  const backupUserId = config.shiftUserIds.Eric;

  const assignees = [
    {
      name: primaryName,
      userId: primaryUserId,
      role: "Primary",
    },
  ];

  if (backupUserId && backupUserId !== primaryUserId) {
    assignees.push({
      name: "Eric",
      userId: backupUserId,
      role: "Backup",
    });
  }

  return assignees;
}

function getPendingAssignees(session) {
  return session.assignees.filter((assignee) => !session.checkins.has(assignee.userId));
}

function getPendingFinishes(session) {
  return session.assignees.filter((assignee) => session.checkins.has(assignee.userId) && !session.finishes.has(assignee.userId));
}

function isSessionExpired(session) {
  return currentTimeMs() >= session.endAt.getTime();
}

function getSessionPhaseLabel(session) {
  if (session.closed) {
    return "ditutup";
  }
  if (currentTimeMs() < getFinishReminderAt(session).getTime()) {
    return "berjalan";
  }
  if (!session.finishPhaseStarted) {
    return "mendekati selesai";
  }
  if (currentTimeMs() < session.endAt.getTime()) {
    return "menunggu waktu selesai";
  }
  if (session.finishDeadline && currentTimeMs() < session.finishDeadline.getTime()) {
    return "menunggu konfirmasi selesai";
  }
  return "melewati batas konfirmasi";
}

function canManuallyCloseSession(session) {
  return currentTimeMs() >= session.endAt.getTime();
}

function getFinishReminderLeadMs(session) {
  const configuredLeadMs = config.finishReminderLeadMinutes * 60 * 1000;
  const sessionDurationMs = Math.max(session.endAt.getTime() - session.startAt.getTime(), 60 * 1000);
  return Math.min(configuredLeadMs, sessionDurationMs);
}

function getFinishReminderAt(session) {
  return new Date(session.endAt.getTime() - getFinishReminderLeadMs(session));
}

async function beginFinishPhase(session, mode = "finish") {
  if (session.closed || session.finishPhaseStarted) {
    return false;
  }

  session.finishPhaseStarted = true;
  session.finishDeadline = new Date(session.endAt.getTime() + config.finishGraceMinutes * 60 * 1000);
  await refreshSessionMessage(session);
  await sendSessionNotification(session, mode);
  return true;
}

async function sendFinishHeadsUp(session) {
  if (session.closed || session.finishPhaseStarted || session.finishReminderSent) {
    return false;
  }

  session.finishReminderSent = true;
  await sendSessionNotification(session, "finishHeadsUp");
  return true;
}

function createStartButtonRow(session, disabled) {
  const button = new ButtonBuilder()
    .setCustomId(`${CHECKIN_BUTTON_PREFIX}${session.sessionId}`)
    .setLabel("Start")
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);

  return new ActionRowBuilder().addComponents(button);
}

function createFinishButtonRow(session, disabled) {
  const button = new ButtonBuilder()
    .setCustomId(`${FINISH_BUTTON_PREFIX}${session.sessionId}`)
    .setLabel("Selesai")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  return new ActionRowBuilder().addComponents(button);
}

function buildStatusBlock(session) {
  return session.assignees
    .map((assignee) => {
      const checkin = session.checkins.get(assignee.userId);
      const finish = session.finishes.get(assignee.userId);

      const startLabel = checkin
        ? `✅ ${formatClock(checkin.checkedInAt)} (${checkin.isLate ? "Late" : "On time"})`
        : "❌";
      const finishLabel = finish ? `✅ ${formatClock(finish.finishedAt)}` : "❌";

      return `${userMention(assignee.userId)} (${assignee.role}) | Start: ${startLabel} | Selesai: ${finishLabel}`;
    })
    .join("\n");
}

function buildSessionMessage(session, mode = "start") {
  const pending = getPendingAssignees(session);
  const pendingFinishes = getPendingFinishes(session);
  const weekdayLabel = WEEKDAY_ID_LABEL[session.weekdayKey] || session.weekdayKey;
  const headerByMode = {
    finishHeadsUp: `Reminder akhir ${session.shiftLabel} (${session.startLabel}-${session.endLabel})`,
    start: `📌 ${session.shiftLabel} Dimulai (${session.startLabel}-${session.endLabel})`,
    startReminder: `🔔 Reminder Start ${session.shiftLabel} (${session.startLabel}-${session.endLabel})`,
    finish: `🏁 ${session.shiftLabel} Berakhir (${session.startLabel}-${session.endLabel})`,
    finishReminder: `🔔 Reminder Selesai ${session.shiftLabel} (${session.startLabel}-${session.endLabel})`,
  };
  const header = headerByMode[mode] || headerByMode.start;

  const mentionStart = pending.length > 0 ? pending.map((entry) => userMention(entry.userId)).join(" ") : "-";
  const mentionFinish =
    pendingFinishes.length > 0 ? pendingFinishes.map((entry) => userMention(entry.userId)).join(" ") : "-";

  const baseLines = [
    header,
    `Hari: ${weekdayLabel}, ${session.dateLabel}`,
    `Check-in di ${channelMention(config.checkinChannelId)} dengan ketik \`start\` atau klik tombol.`,
    `Status:`,
    buildStatusBlock(session),
    `Belum start (${pending.length}): ${mentionStart}`,
    `Belum selesai (${pendingFinishes.length}): ${mentionFinish}`,
  ];

  if (mode === "finish" || mode === "finishReminder") {
    baseLines.splice(2, 1, "Klik tombol `Selesai` saat shift benar-benar sudah selesai.");
  } else if (mode === "finishHeadsUp") {
    baseLines.splice(
      2,
      1,
      `Shift hampir selesai. Siapkan link bukti, tombol \`Selesai\` aktif tepat sekitar ${formatClock(session.endAt)}.`
    );
  } else {
    baseLines.splice(3, 0, `Reminder selesai mulai sekitar ${formatClock(getFinishReminderAt(session))}.`);
  }

  return baseLines.join("\n");
}

async function sendLog(title, fields = []) {
  const logChannel = await client.channels.fetch(config.logChannelId);
  if (!logChannel || !logChannel.isTextBased()) {
    throw new Error("LOG_CHANNEL_ID tidak valid atau bukan text channel.");
  }

  const embed = new EmbedBuilder()
    .setColor(0x2b9f6a)
    .setTitle(title)
    .setTimestamp(new Date())
    .addFields(fields);

  await logChannel.send({ embeds: [embed] });
}

async function sendLogbookReminder(pendingUserIds, triggerLabel) {
  if (!config.logbookReminderChannelId) {
    return;
  }

  const reminderChannel = await client.channels.fetch(config.logbookReminderChannelId);
  if (!reminderChannel || !reminderChannel.isTextBased()) {
    throw new Error("LOGBOOK_REMINDER_CHANNEL_ID tidak valid atau bukan text channel.");
  }

  const mentions = pendingUserIds.map((id) => userMention(id)).join(" ");
  await reminderChannel.send({
    content: [
      `${mentions}`,
      `📘 Reminder isi logbook ${todayDateString()}.`,
    ].join("\n"),
    components: [createLogbookDoneButtonRow(activeLogbookDayKey || todayKeyString())],
  });

  await sendLog("📘 Reminder Logbook Terkirim", [
    { name: "Trigger", value: triggerLabel, inline: true },
    { name: "Tanggal", value: todayDateString(), inline: true },
    { name: "Target User", value: mentions || "-" },
  ]);
}

async function registerLogbookDoneByButton({ userId, userTag, buttonDayKey, reply }) {
  if (!config.logbookReportChannelId) {
    await reply("LOGBOOK_REPORT_CHANNEL_ID belum diatur.");
    return;
  }

  if (!config.logbookUserIds.includes(userId)) {
    await reply("Kamu bukan target reminder logbook.");
    return;
  }

  syncLogbookDailyState();
  if (buttonDayKey && buttonDayKey !== activeLogbookDayKey) {
    await reply("Tombol ini untuk tanggal yang berbeda. Gunakan reminder logbook terbaru.");
    return;
  }

  // Cek apakah user sudah isi logbook hari ini (dari memory atau sheets)
  const alreadySubmitted = await hasUserSubmittedLogbookToday(userId);
  if (alreadySubmitted) {
    await reply("Status logbook kamu hari ini sudah tercatat.");
    return;
  }

  logbookReportedToday.add(userId);
  updateLogbookWeeklyStats(userId, userTag, true);

  // Save to Google Sheets - Logbook History
  const weekRange = syncLogbookWeeklyState();
  await sheets.appendLogbookHistory({
    timestampIso: new Date().toISOString(),
    dateLabel: todayDateString(),
    userId,
    username: userTag,
    source: "button:aku-udah-isi",
    weekKey: weekRange.weekStart,
  }).catch((err) => {
    console.error("Gagal save logbook history ke sheets:", err.message);
  });

  const reportChannel = await client.channels.fetch(config.logbookReportChannelId);
  if (!reportChannel || !reportChannel.isTextBased()) {
    await reply("LOGBOOK_REPORT_CHANNEL_ID tidak valid atau bukan text channel.");
    return;
  }

  await reportChannel.send({
    content: `? ${userMention(userId)} sudah isi logbook (${todayDateString()}) [via tombol].`,
  });

  await sendLog("📝 Laporan Logbook Masuk", [
    { name: "User", value: `${userTag} (${userId})` },
    { name: "Tanggal", value: todayDateString(), inline: true },
    { name: "Channel", value: channelMention(config.logbookReportChannelId), inline: true },
    { name: "Sumber", value: "button:aku-udah-isi", inline: true },
  ]);

  await reply("✅ Siap, status logbook kamu sudah dikirim ke channel report.");
}

async function sendDirectMessage(userId, payload) {
  try {
    const user = await client.users.fetch(userId);
    if (!user) {
      return false;
    }

    await user.send(payload);
    return true;
  } catch (error) {
    console.error(`Gagal kirim DM ke user ${userId}:`, error);
    return false;
  }
}

async function sendSessionNotification(session, mode) {
  const isFinishActionMode = mode === "finish" || mode === "finishReminder";
  const recipients = isFinishActionMode
    ? mode === "finishReminder"
      ? getPendingFinishes(session)
      : session.assignees.filter((assignee) => session.checkins.has(assignee.userId))
    : mode === "finishHeadsUp"
      ? session.assignees.filter((assignee) => session.checkins.has(assignee.userId))
    : mode === "startReminder"
      ? getPendingAssignees(session)
      : session.assignees;
  if (recipients.length === 0) {
    return;
  }

  const components = isFinishActionMode
    ? [createFinishButtonRow(session, !shouldEnableFinishAction(session))]
    : mode === "finishHeadsUp"
      ? []
      : [createStartButtonRow(session, false)];
  const payload = {
    content: buildSessionMessage(session, mode),
  };
  if (components.length > 0) {
    payload.components = components;
  }

  for (const recipient of recipients) {
    await sendDirectMessage(recipient.userId, payload);
  }
}

function getSessionMessageMode(session) {
  if (!session.finishPhaseStarted) {
    return "start";
  }

  return currentTimeMs() >= session.endAt.getTime() ? "finish" : "finishHeadsUp";
}

function shouldEnableFinishAction(session) {
  return session.finishPhaseStarted && !session.closed && currentTimeMs() >= session.endAt.getTime();
}

async function appendShiftRecordSafe(record) {
  if (!sheets.isSheetsConfigured()) {
    console.warn("⚠️ Google Sheets tidak terkonfigurasi, skip simpan shift record");
    return false;
  }

  try {
    await sheets.appendShiftRecord(record);
    return true;
  } catch (error) {
    console.error("Gagal simpan shift record ke Google Sheets:", error);
    return false;
  }
}

function archiveSession(session) {
  const history = sessionHistoryByDay.get(session.dayKey) || [];
  history.push(session);
  sessionHistoryByDay.set(session.dayKey, history);
}

async function refreshSessionMessage(session) {
  if (!session.messageId) {
    return;
  }

  try {
    const channel = await client.channels.fetch(session.channelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const message = await channel.messages.fetch(session.messageId);
    await message.edit({
      content: buildSessionMessage(session, getSessionMessageMode(session)),
      components: [
        session.finishPhaseStarted
          ? createFinishButtonRow(
              session,
              session.closed || getPendingFinishes(session).length === 0 || !shouldEnableFinishAction(session)
            )
          : createStartButtonRow(session, session.closed || getPendingAssignees(session).length === 0),
      ],
    });
  } catch (error) {
    console.error(`Gagal update status message session ${session.sessionId}:`, error);
  }
}

async function closeSession(session, reason) {
  if (session.closed) {
    return { closed: false, reason: "already_closed" };
  }

  session.closed = true;
  if (session.reminderInterval) {
    clearInterval(session.reminderInterval);
    session.reminderInterval = null;
  }
  if (session.finishPhaseTimeout) {
    clearTimeout(session.finishPhaseTimeout);
    session.finishPhaseTimeout = null;
  }
  if (session.endTimeout) {
    clearTimeout(session.endTimeout);
    session.endTimeout = null;
  }
  if (session.finishDeadlineTimeout) {
    clearTimeout(session.finishDeadlineTimeout);
    session.finishDeadlineTimeout = null;
  }

  const pendingStarts = getPendingAssignees(session);
  const pendingFinishes = getPendingFinishes(session);

  let savedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const assignee of session.assignees) {
    const start = session.checkins.get(assignee.userId);
    const finish = session.finishes.get(assignee.userId);

    // Jangan tulis log apa pun untuk user yang belum menekan start.
    if (!start) {
      skippedCount++;
      continue;
    }

    let status = "not_finished";
    let checkinAtIso = start.checkedInAt.toISOString();
    let recordSource = start.source || reason;
    if (finish) {
      status = start.isLate ? "completed_late" : "completed_on_time";
      checkinAtIso = finish.finishedAt.toISOString();
      recordSource = finish.source || start.source || reason;
    } else if (reason === "finish_window_expired") {
      recordSource = "finish_window_expired";
    }

    const saved = await appendShiftRecordSafe({
      timestampIso: new Date().toISOString(),
      dayKey: session.dayKey,
      dateLabel: session.dateLabel,
      shiftId: session.shiftId,
      shiftLabel: session.shiftLabel,
      userId: assignee.userId,
      userTag: assignee.name,
      role: assignee.role,
      status,
      checkinAtIso,
      source: recordSource,
      evidenceLink: finish ? finish.proofLink || "" : "",
    });
    if (saved) {
      savedCount++;
    } else {
      failedCount++;
    }
  }

  const closeMessage =
    pendingStarts.length === 0 && pendingFinishes.length === 0
      ? `✅ ${session.shiftLabel} selesai. Semua petugas sudah start dan klik selesai.`
      : [
          `⚠️ ${session.shiftLabel} ditutup.`,
          `Belum start: ${
            pendingStarts.length > 0 ? pendingStarts.map((assignee) => userMention(assignee.userId)).join(" ") : "-"
          }`,
          `Belum selesai: ${
            pendingFinishes.length > 0
              ? pendingFinishes.map((assignee) => userMention(assignee.userId)).join(" ")
              : "-"
          }`,
        ].join("\n");

  for (const assignee of session.assignees) {
    await sendDirectMessage(assignee.userId, { content: closeMessage });
  }

  await sendLog("🏁 Shift Ditutup", [
    { name: "Shift", value: `${session.shiftLabel} (${session.startLabel}-${session.endLabel})`, inline: true },
    { name: "Hari", value: `${WEEKDAY_ID_LABEL[session.weekdayKey] || session.weekdayKey}, ${session.dateLabel}`, inline: true },
    { name: "Alasan", value: reason, inline: true },
    {
      name: "Belum Selesai",
      value: pendingFinishes.length > 0 ? pendingFinishes.map((entry) => userMention(entry.userId)).join(" ") : "-",
    },
    { name: "Sheet", value: `✅ ${savedCount} | ❌ ${failedCount} | ⏭️ ${skippedCount}`, inline: true },
  ]);

  activeSessions.delete(session.sessionId);
  archiveSession(session);

  return { closed: true, savedCount, failedCount, skippedCount };
}

async function sendFollowupReminder(session) {
  if (session.closed) {
    return;
  }

  if (!session.finishPhaseStarted) {
    const pendingStarts = getPendingAssignees(session);
    if (pendingStarts.length > 0) {
      await sendSessionNotification(session, "startReminder");
    }
    return;
  }

  const pendingFinishes = getPendingFinishes(session);
  if (pendingFinishes.length === 0) {
    if (currentTimeMs() >= session.endAt.getTime()) {
      await closeSession(session, "all_finished");
    }
    return;
  }

  if (session.finishDeadline && currentTimeMs() >= session.finishDeadline.getTime()) {
    await closeSession(session, "finish_window_expired");
    return;
  }

  await sendSessionNotification(session, "finishReminder");
}
async function startShiftSession(shiftDef) {
  const now = nowInTimezone();
  const weekdayKey = getWeekdayKey(now);
  const dayKey = todayKeyString(now);

  const assignees = getShiftAssigneesForToday(shiftDef, weekdayKey);
  if (assignees.length === 0) {
    return { started: false, reason: "no_assignee_today" };
  }

  const sessionId = getSessionId(dayKey, shiftDef.id);
  if (activeSessions.has(sessionId)) {
    return { started: false, reason: "already_started" };
  }

  const session = {
    sessionId,
    dayKey,
    dateLabel: todayDateString(now),
    weekdayKey,
    shiftId: shiftDef.id,
    shiftLabel: shiftDef.label,
    startLabel: shiftDef.startLabel,
    endLabel: shiftDef.endLabel,
    startAt: createDateFromTimeLabel(shiftDef.startLabel),
    endAt: createDateFromTimeLabel(shiftDef.endLabel),
    channelId: null,
    messageId: null,
    assignees,
    checkins: new Map(),
    finishes: new Map(),
    finishReminderSent: false,
    finishPhaseStarted: false,
    finishDeadline: null,
    closed: false,
    reminderInterval: null,
    finishPhaseTimeout: null,
    endTimeout: null,
    finishDeadlineTimeout: null,
  };

  activeSessions.set(sessionId, session);
  await sendSessionNotification(session, "start");

  const finishHeadsUpDelayMs = Math.max(getFinishReminderAt(session).getTime() - currentTimeMs(), 0);
  session.finishPhaseTimeout = setTimeout(() => {
    sendFinishHeadsUp(session).catch((error) => {
      console.error(`Gagal kirim heads up finish untuk ${session.sessionId}:`, error);
    });
  }, finishHeadsUpDelayMs);

  const endDelayMs = Math.max(session.endAt.getTime() - currentTimeMs(), 0);
  session.endTimeout = setTimeout(() => {
    if (session.closed) {
      return;
    }

    if (!session.finishPhaseStarted) {
      beginFinishPhase(session).catch((error) => {
        console.error(`Gagal memulai fase finish untuk ${session.sessionId} saat jam shift selesai:`, error);
      });
    }

    if (getPendingFinishes(session).length === 0) {
      closeSession(session, "all_finished").catch((error) => {
        console.error(`Gagal menutup ${session.sessionId} saat jam shift selesai:`, error);
      });
    }
  }, endDelayMs);

  const finishDeadlineAt = new Date(session.endAt.getTime() + config.finishGraceMinutes * 60 * 1000);
  const finishDeadlineDelayMs = Math.max(finishDeadlineAt.getTime() - currentTimeMs(), 0);
  session.finishDeadlineTimeout = setTimeout(() => {
    if (session.closed || !session.finishPhaseStarted) {
      return;
    }

    closeSession(session, "finish_window_expired").catch((error) => {
      console.error(`Gagal menutup ${session.sessionId} setelah grace period:`, error);
    });
  }, finishDeadlineDelayMs);

  session.reminderInterval = setInterval(() => {
    sendFollowupReminder(session).catch((error) => {
      console.error(`Gagal kirim reminder ulang untuk ${session.sessionId}:`, error);
    });
  }, config.reminderRepeatMinutes * 60 * 1000);

  return { started: true, session };
}

function findAssignableSessionForUser(userId, sessionId = null) {
  const sessions = Array.from(activeSessions.values())
    .filter((session) => !session.closed && (!sessionId || session.sessionId === sessionId))
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());

  for (const session of sessions) {
    const isAssigned = session.assignees.some((assignee) => assignee.userId === userId);
    if (!isAssigned) {
      continue;
    }

    if (session.checkins.has(userId)) {
      return { session, alreadyCheckedIn: true };
    }

    if (!isSessionExpired(session)) {
      return { session, alreadyCheckedIn: false };
    }
  }

  return null;
}

async function registerCheckin({ userId, userTag, sessionId = null, source, reply }) {
  const lookup = findAssignableSessionForUser(userId, sessionId);
  if (!lookup) {
    await reply("⏳ Tidak ada shift aktif untuk akun kamu saat ini.");
    return;
  }

  const { session, alreadyCheckedIn } = lookup;
  if (alreadyCheckedIn) {
    await reply(`✅ Check-in kamu untuk ${session.shiftLabel} sudah tercatat.`);
    return;
  }

  const checkedInAt = new Date();
  const elapsedMinutes = Math.floor((checkedInAt.getTime() - session.startAt.getTime()) / 60000);
  const isLate = elapsedMinutes > config.lateAfterMinutes;

  session.checkins.set(userId, {
    checkedInAt,
    isLate,
    source,
    userTag,
  });

  await refreshSessionMessage(session);
  await sendLog("🚀 Start Shift Masuk", [
    { name: "Shift", value: `${session.shiftLabel} (${session.startLabel}-${session.endLabel})`, inline: true },
    { name: "User", value: `${userMention(userId)} (${userTag})`, inline: true },
    { name: "Status Start", value: isLate ? "Late" : "On time", inline: true },
    { name: "Sumber", value: source, inline: true },
  ]);
  await reply(
    `✅ Start ${session.shiftLabel} tercatat (${isLate ? "Late" : "On time"}). Nanti saat shift selesai, klik tombol \`Selesai\`.`
  );
}

function findCompletableSessionForUser(userId, sessionId = null) {
  const sessions = Array.from(activeSessions.values())
    .filter((session) => !session.closed && session.finishPhaseStarted && (!sessionId || session.sessionId === sessionId))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  for (const session of sessions) {
    const isAssigned = session.assignees.some((assignee) => assignee.userId === userId);
    if (!isAssigned) {
      continue;
    }

    if (!session.checkins.has(userId)) {
      continue;
    }

    if (session.finishes.has(userId)) {
      return { session, alreadyFinished: true };
    }

    return { session, alreadyFinished: false };
  }

  return null;
}

async function registerFinish({ userId, userTag, sessionId = null, source, proofLink, reply }) {
  if (!proofLink || !isValidHttpUrl(proofLink)) {
    await reply("🔗 Link bukti tidak valid. Pakai format URL lengkap, contoh: https://contoh.com/bukti");
    return;
  }

  const lookup = findCompletableSessionForUser(userId, sessionId);
  if (!lookup) {
    await reply("⏳ Belum ada shift yang bisa ditandai selesai untuk akun kamu.");
    return;
  }

  const { session, alreadyFinished } = lookup;
  if (alreadyFinished) {
    await reply(`✅ Status selesai kamu untuk ${session.shiftLabel} sudah tercatat.`);
    return;
  }

  if (currentTimeMs() < session.endAt.getTime()) {
    await reply(`⏳ ${session.shiftLabel} belum masuk waktu selesai. Coba lagi sekitar ${formatClock(session.endAt)}.`);
    return;
  }

  const finishedAt = new Date();
  session.finishes.set(userId, {
    finishedAt,
    source,
    userTag,
    proofLink,
  });

  await refreshSessionMessage(session);
  await sendLog("✅ Selesai Shift Masuk", [
    { name: "Shift", value: `${session.shiftLabel} (${session.startLabel}-${session.endLabel})`, inline: true },
    { name: "User", value: `${userMention(userId)} (${userTag})`, inline: true },
    { name: "Link Bukti", value: proofLink },
    { name: "Sumber", value: source, inline: true },
  ]);
  await reply({
    content: `✅ Selesai ${session.shiftLabel} tercatat dengan link bukti.`,
    files: [FINISH_GIF_URL],
  });

  const pendingFinishes = getPendingFinishes(session);
  if (pendingFinishes.length === 0 && currentTimeMs() >= session.endAt.getTime()) {
    await closeSession(session, "all_finished");
  }
}

function buildInMemoryRecap(dayKey) {
  const sessions = [
    ...Array.from(activeSessions.values()).filter((session) => session.dayKey === dayKey),
    ...(sessionHistoryByDay.get(dayKey) || []),
  ];

  if (sessions.length === 0) {
    return "Belum ada data shift untuk hari ini.";
  }

  const lines = [`Rekap shift ${todayDateString()}:`];

  for (const session of sessions.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
    lines.push(``);
    lines.push(`${session.shiftLabel} (${session.startLabel}-${session.endLabel})`);

    for (const assignee of session.assignees) {
      const checkin = session.checkins.get(assignee.userId);
      const finish = session.finishes.get(assignee.userId);
      if (!checkin) {
        lines.push(`❌ ${assignee.name} (${assignee.role}) - tidak hadir`);
      } else if (!finish) {
        lines.push(`⚠️ ${assignee.name} (${assignee.role}) - start (${checkin.isLate ? "Late" : "On time"}), belum selesai`);
      } else {
        lines.push(
          `✅ ${assignee.name} (${assignee.role}) - ${checkin.isLate ? "Late" : "On time"} start ${formatClock(
            checkin.checkedInAt
          )}, selesai ${formatClock(finish.finishedAt)}`
        );
      }
    }
  }

  return lines.join("\n");
}

async function generateWeeklyLogbookRecap(weekRange) {
  const allUserIds = config.logbookUserIds;
  const recapData = [];

  // Get data from Google Sheets logbook_history
  const historyData = await sheets.getLogbookHistory(weekRange.weekStart, weekRange.weekEnd);

  for (const userId of allUserIds) {
    // Count submissions from history for this user in this week
    const userHistory = historyData.filter(h => h.userId === userId);
    const submittedCount = userHistory.length;

    // Calculate missed count (days in week - submitted)
    // Assuming 7 days per week
    const missedCount = Math.max(0, 7 - submittedCount);

    // Fetch username
    let username = "-";
    try {
      const user = await client.users.fetch(userId);
      username = user.username;
    } catch (error) {
      username = `User_${userId}`;
    }

    const complianceRate = submittedCount > 0 ? Math.round((submittedCount / 7) * 100) : 0;

    recapData.push({
      weekStart: weekRange.weekStart,
      weekEnd: weekRange.weekEnd,
      weekNumber: weekRange.weekNumber,
      userId: userId,
      username: username,
      submittedCount: submittedCount,
      missedCount: missedCount,
      complianceRate: `${complianceRate}%`,
    });
  }

  return recapData;
}

async function saveWeeklyRecapToSheets(recapData) {
  if (!sheets.isSheetsConfigured()) {
    return;
  }

  try {
    for (const data of recapData) {
      await sheets.saveWeeklyLogbookRecap(data);
    }
    console.log(`Weekly recap saved to Google Sheets for ${recapData[0]?.weekStart}`);
  } catch (error) {
    console.error("Gagal save weekly recap ke Google Sheets:", error);
  }
}

async function generateAndSaveWeeklyRecap() {
  const weekRange = getWeekRange();
  const recapData = await generateWeeklyLogbookRecap(weekRange);
  await saveWeeklyRecapToSheets(recapData);
  return { weekRange, recapData };
}

async function buildSheetRecap(dayKey) {
  if (!sheets.isSheetsConfigured()) {
    return null;
  }

  const rows = await sheets.getRowsForDay(dayKey);
  if (rows.length === 0) {
    return "(Sheet) Tidak ada data tercatat hari ini.";
  }

  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.shiftId}:${row.userId}`;
    if (!grouped.has(key)) {
      grouped.set(key, row);
    }
  }

  const onTime = Array.from(grouped.values()).filter((row) => row.status === "completed_on_time").length;
  const late = Array.from(grouped.values()).filter((row) => row.status === "completed_late").length;
  const absent = Array.from(grouped.values()).filter((row) => row.status === "absent").length;
  const notFinished = Array.from(grouped.values()).filter((row) => row.status === "not_finished").length;

  return `(Sheet) Selesai On time: ${onTime} | Selesai Late: ${late} | Tidak selesai: ${notFinished} | Tidak hadir: ${absent}`;
}

async function handleMessageCheckin(message) {
  if (message.channelId !== config.checkinChannelId) {
    return;
  }

  const normalized = normalizeText(message.content);
  const finishLink = extractFinishLinkFromText(message.content);
  if (normalized === "selesai" && !finishLink) {
    await sendDirectMessage(
      message.author.id,
      { content: "Untuk selesai via teks, pakai format: `selesai https://link-bukti-kamu`." }
    );
    await message.react("⚠️").catch(() => {});
    return;
  }

  if (normalized !== "start" && !finishLink) {
    return;
  }

  if (normalized === "start") {
    await registerCheckin({
      userId: message.author.id,
      userTag: message.author.tag,
      source: "text:start",
      reply: async (text) => {
        await sendDirectMessage(message.author.id, { content: text });
        await message.react("✅").catch(() => {});
      },
    });
    return;
  }

  await registerFinish({
    userId: message.author.id,
    userTag: message.author.tag,
    source: "text:selesai",
    proofLink: finishLink,
    reply: async (text) => {
      await sendDirectMessage(message.author.id, { content: text });
      await message.react("🏁").catch(() => {});
    },
  });
}

async function handleLogbookReportMessage(message) {
  if (!config.logbookReportChannelId) {
    return;
  }

  if (message.channelId !== config.logbookReportChannelId) {
    return;
  }

  if (!config.logbookUserIds.includes(message.author.id)) {
    return;
  }

  if (!isLogbookReportMessage(message.content)) {
    return;
  }

  syncLogbookDailyState();

  // Cek apakah user sudah isi logbook hari ini (dari memory atau sheets)
  const alreadySubmitted = await hasUserSubmittedLogbookToday(message.author.id);
  if (alreadySubmitted) {
    return;
  }

  logbookReportedToday.add(message.author.id);
  updateLogbookWeeklyStats(message.author.id, message.author.tag, true);

  // Save to Google Sheets - Logbook History
  const weekRange = syncLogbookWeeklyState();
  await sheets.appendLogbookHistory({
    timestampIso: new Date().toISOString(),
    dateLabel: todayDateString(),
    userId: message.author.id,
    username: message.author.tag,
    source: "text:message",
    weekKey: weekRange.weekStart,
  }).catch((err) => {
    console.error("Gagal save logbook history ke sheets:", err.message);
  });

  await sendLog("📝 Laporan Logbook Masuk", [
    { name: "User", value: `${message.author.tag} (${message.author.id})` },
    { name: "Tanggal", value: todayDateString(), inline: true },
    { name: "Channel", value: channelMention(message.channelId), inline: true },
  ]);
}

async function handleAIChatMessage(message) {
  if (!config.aiChatChannelId) {
    return;
  }

  if (message.channelId !== config.aiChatChannelId) {
    return;
  }

  if (!aiHandler.isAIConfigured()) {
    return;
  }

  if (!aiHandler.isUserAllowed(message.author.id)) {
    return;
  }

  // Skip jika pesan kosong atau hanya command bot lain
  const content = message.content.trim();
  if (!content || content.startsWith("/")) {
    return;
  }

  try {
    // Show typing indicator
    await message.channel.sendTyping();

    const result = await aiHandler.handleAIChat({
      userId: message.author.id,
      message: content,
    });

    if (result.error) {
      await message.reply({ content: `❌ ${result.error}`, ephemeral: false });
    } else {
      const response = result.response.length > 1900 ? result.response.substring(0, 1900) + "..." : result.response;
      await message.reply({ content: `🤖 ${response}` });
    }
  } catch (error) {
    console.error("Error di AI chat channel:", error.message);
  }
}

function buildAdminSlashCommands() {
  return [
    new SlashCommandBuilder()
      .setName("tes-shift")
      .setDescription("Trigger manual shift tertentu")
      .addIntegerOption((option) =>
        option
          .setName("nomor")
          .setDescription("Nomor shift")
          .setRequired(true)
          .addChoices(
            { name: "Shift 1", value: 1 },
            { name: "Shift 2", value: 2 },
            { name: "Shift 3", value: 3 }
          )
      ),
    new SlashCommandBuilder().setName("tes-reminder-logbook").setDescription("Kirim reminder logbook manual"),
    new SlashCommandBuilder().setName("status-shift").setDescription("Lihat status shift aktif"),
    new SlashCommandBuilder().setName("rekap-hari-ini").setDescription("Lihat rekap shift hari ini"),
    new SlashCommandBuilder().setName("debug-time").setDescription("Cek akurasi waktu dan jadwal shift (Admin only)"),
    new SlashCommandBuilder().setName("shift-done").setDescription("Tutup shift aktif dan simpan ke sheets (Admin only)"),
    new SlashCommandBuilder()
      .setName("recap-mingguan")
      .setDescription("Lihat recap logbook mingguan (Admin only)")
      .addStringOption((option) =>
        option
          .setName("minggu")
          .setDescription("Pilih minggu (default: minggu ini)")
          .addChoices({ name: "Minggu Ini", value: "this" }, { name: "Minggu Lalu", value: "last" })
      )
      .addBooleanOption((option) =>
        option.setName("simpan").setDescription("Simpan ke Google Sheets").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("task")
      .setDescription("Manage task reminder")
      .addSubcommand((sub) =>
        sub
          .setName("assign")
          .setDescription("Assign task ke member (admin only)")
          .addUserOption((option) => option.setName("member").setDescription("Member yang di-assign").setRequired(true))
          .addStringOption((option) => option.setName("deskripsi").setDescription("Deskripsi task").setRequired(true))
          .addStringOption((option) => option.setName("deadline").setDescription("Deadline (DD/MM HH:MM)").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("Lihat semua task aktif")
          .addStringOption((option) =>
            option
              .setName("member")
              .setDescription("Lihat task member tertentu (admin only)")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("done")
          .setDescription("Mark task sebagai selesai")
          .addStringOption((option) => option.setName("task_id").setDescription("ID task (contoh: T001)").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("cancel")
          .setDescription("Batalkan task (admin only)")
          .addStringOption((option) => option.setName("task_id").setDescription("ID task (contoh: T001)").setRequired(true))
      ),
    new SlashCommandBuilder()
      .setName("ai")
      .setDescription("AI Assistant - Tanya apa aja atau chat dengan Hina AI")
      .addSubcommand((sub) =>
        sub
          .setName("ask")
          .setDescription("Tanya pertanyaan sekali tanpa memori percakapan")
          .addStringOption((option) => option.setName("prompt").setDescription("Pertanyaan atau prompt kamu").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("chat")
          .setDescription("Chat dengan AI yang ingat konteks percakapan")
          .addStringOption((option) => option.setName("message").setDescription("Pesan kamu").setRequired(true))
      )
      .addSubcommand((sub) => sub.setName("clear").setDescription("Hapus riwayat percakapan AI kamu"))
      .addSubcommand((sub) => sub.setName("tasks").setDescription("Dapatkan analisis AI untuk task-task kamu"))
      .addSubcommand((sub) => sub.setName("help").setDescription("Tampilkan bantuan AI assistant")),
  ].map((cmd) => cmd.toJSON());
}

async function registerSlashCommands() {
  const guild = await client.guilds.fetch(config.guildId);
  await guild.commands.set(buildAdminSlashCommands());
  console.log(`Slash command admin terdaftar di guild ${config.guildId}.`);
}

async function handleSlashCommand(interaction) {
  if (interaction.commandName === "task") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "assign") {
      // Admin only
      if (!taskHandler.isAdminUser(interaction.user.id)) {
        await interaction.reply({ content: "⛔ Perintah ini khusus admin.", ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser("member", true);
      const description = interaction.options.getString("deskripsi", true);
      const deadlineStr = interaction.options.getString("deadline", true);

      await taskHandler.assignTask({
        assignedBy: interaction.user.id,
        assignedByName: interaction.user.username,
        targetUser,
        description,
        deadlineStr,
        reply: (payload) => interaction.reply(typeof payload === "string" ? { content: payload, ephemeral: true } : { ...payload, ephemeral: true }),
      });
      return;
    }

    if (subcommand === "list") {
      const targetMember = interaction.options.getUser("member");

      // Jika ada parameter member, hanya admin yang bisa lihat
      if (targetMember && !taskHandler.isAdminUser(interaction.user.id)) {
        await interaction.reply({ content: "⛔ Hanya admin yang bisa melihat task member lain.", ephemeral: true });
        return;
      }

      if (targetMember) {
        // Admin melihat task member tertentu
        const allTasks = await sheets.getAllTasks();
        const memberTasks = allTasks.filter((t) => t.discordId === targetMember.id && t.status !== "cancelled");

        if (memberTasks.length === 0) {
          await interaction.reply({ content: `ℹ️ ${targetMember.username} tidak memiliki task aktif.`, ephemeral: true });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`📋 Task ${targetMember.username}`)
          .setTimestamp(new Date());

        const taskLines = memberTasks.map((task) => {
          const statusEmoji = task.status === "done" ? "✅" : "⏳";
          return `${statusEmoji} **${task.taskId}**: ${task.taskDesc.substring(0, 50)}${task.taskDesc.length > 50 ? "..." : ""}
            - Deadline: ${task.deadline}`;
        });

        embed.setDescription(taskLines.join("\n\n"));
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        // User melihat task sendiri, admin melihat semua
        await taskHandler.listTasks({
          userId: interaction.user.id,
          reply: (payload) => interaction.reply(typeof payload === "string" ? { content: payload, ephemeral: true } : { ...payload, ephemeral: true }),
        });
      }
      return;
    }

    if (subcommand === "done") {
      const taskId = interaction.options.getString("task_id", true);

      await taskHandler.markTaskDone({
        userId: interaction.user.id,
        taskId,
        reply: (payload) => interaction.reply(typeof payload === "string" ? { content: payload, ephemeral: true } : { ...payload, ephemeral: true }),
      });
      return;
    }

    if (subcommand === "cancel") {
      // Admin only
      if (!taskHandler.isAdminUser(interaction.user.id)) {
        await interaction.reply({ content: "⛔ Perintah ini khusus admin.", ephemeral: true });
        return;
      }

      const taskId = interaction.options.getString("task_id", true);

      await taskHandler.cancelTask({
        taskId,
        cancelledBy: interaction.user.username,
        reply: (payload) => interaction.reply(typeof payload === "string" ? { content: payload, ephemeral: true } : { ...payload, ephemeral: true }),
      });
      return;
    }

    // Jika sampai sini, berarti bukan subcommand task yang valid
    await interaction.reply({ content: "❌ Subcommand task tidak valid.", ephemeral: true });
    return;
  }

  // AI Assistant Commands
  if (interaction.commandName === "ai") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "ask") {
      const prompt = interaction.options.getString("prompt", true);

      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (error) {
        if (error.code === 10062 || error.code === 40060) {
          console.log("Interaction sudah expired/acknowledged, skip");
          return;
        }
        throw error;
      }

      const result = await aiHandler.handleAIAsk({
        userId: interaction.user.id,
        prompt,
      });

      if (result.error) {
        await interaction.editReply({ content: `❌ ${result.error}` });
      } else {
        const response = result.response.length > 1900 ? result.response.substring(0, 1900) + "..." : result.response;
        await interaction.editReply({ content: `🤖 **Hina AI**\n\n${response}` });
      }
      return;
    }

    if (subcommand === "chat") {
      const message = interaction.options.getString("message", true);

      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (error) {
        if (error.code === 10062 || error.code === 40060) {
          console.log("Interaction sudah expired/acknowledged, skip");
          return;
        }
        throw error;
      }

      const result = await aiHandler.handleAIChat({
        userId: interaction.user.id,
        message,
      });

      if (result.error) {
        await interaction.editReply({ content: `❌ ${result.error}` });
      } else {
        const response = result.response.length > 1900 ? result.response.substring(0, 1900) + "..." : result.response;
        await interaction.editReply({ content: `💬 **Hina AI Chat**\n\n${response}` });
      }
      return;
    }

    if (subcommand === "clear") {
      aiHandler.clearConversationHistory(interaction.user.id);
      await interaction.reply({ content: "✅ Riwayat percakapan AI kamu sudah dihapus.", ephemeral: true });
      return;
    }

    if (subcommand === "tasks") {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (error) {
        if (error.code === 10062 || error.code === 40060) {
          console.log("Interaction sudah expired/acknowledged, skip");
          return;
        }
        throw error;
      }

      const result = await aiHandler.handleAITasksSummary({
        userId: interaction.user.id,
      });

      if (result.error) {
        await interaction.editReply({ content: `❌ ${result.error}` });
      } else {
        const response = result.response.length > 1900 ? result.response.substring(0, 1900) + "..." : result.response;
        await interaction.editReply({ content: `📋 **Analisis Task AI**\n\n${response}` });
      }
      return;
    }

    if (subcommand === "help") {
      const helpEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🤖 Hina AI Assistant")
        .setDescription("AI-powered assistant buat tanya jawab dan bantu task management")
        .addFields(
          { name: "/ai ask <prompt>", value: "Tanya pertanyaan sekali tanpa konteks percakapan", inline: false },
          { name: "/ai chat <message>", value: "Chat dengan AI yang ingat percakapan (memori 30 menit)", inline: false },
          { name: "/ai clear", value: "Hapus riwayat percakapan", inline: false },
          { name: "/ai tasks", value: "Dapatkan analisis AI untuk task-task kamu", inline: false },
          { name: "Fitur", value: "• Q&A umum\n• Analisis & prioritask task\n• Info shift system\n• Guidance logbook\n• Support Indo/English", inline: false }
        )
        .setFooter({ text: `Powered by ${config.aiModel}` })
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      return;
    }

    await interaction.reply({ content: "❌ Subcommand ai tidak valid.", ephemeral: true });
    return;
  }

  // Admin-only commands below
  if (!isAdminUser(interaction.user.id)) {
    await interaction.reply({ content: "⛔ Perintah ini khusus admin.", ephemeral: true });
    return;
  }

  if (interaction.commandName === "recap-mingguan") {
    const weekOption = interaction.options.getString("minggu") || "this";
    const saveToSheets = interaction.options.getBoolean("simpan") || false;

    const now = nowInTimezone();
    let weekRange = getWeekRange(now);

    if (weekOption === "last") {
      // Get last week
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(now.getDate() - 7);
      weekRange = getWeekRange(lastWeekDate);
    }

    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      if (error.code === 10062 || error.code === 40060) {
        console.log("Interaction sudah expired/acknowledged, skip");
        return;
      }
      throw error;
    }

    const recapData = await generateWeeklyLogbookRecap(weekRange);

    // Build embed for recap
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📊 Recap Logbook Mingguan`)
      .setDescription(`Minggu: ${weekRange.weekStart} s/d ${weekRange.weekEnd}`)
      .setTimestamp(new Date());

    const recapLines = recapData.map((data) => {
      const emoji =
        Number.parseInt(data.complianceRate) >= 80
          ? "✅"
          : Number.parseInt(data.complianceRate) >= 50
            ? "⚠️"
            : "❌";
      return `${emoji} **${data.username}**: ${data.submittedCount}x isi, ${data.missedCount}x terlewat (${data.complianceRate})`;
    });

    embed.setDescription(recapLines.join("\n"));

    if (saveToSheets) {
      await saveWeeklyRecapToSheets(recapData);
      embed.addFields({ name: "💾 Status", value: "Data sudah disimpan ke Google Sheets", inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === "tes-shift") {
    const manualShiftNumber = interaction.options.getInteger("nomor", true);
    const shiftDef = SHIFT_DEFINITIONS.find((shift) => shift.id === `shift-${manualShiftNumber}`);
    if (!shiftDef) {
        await interaction.reply({ content: "❌ Shift tidak ditemukan.", ephemeral: true });
      return;
    }

    const result = await startShiftSession(shiftDef);
    if (result.started) {
      await interaction.reply({ content: `✅ ${shiftDef.label} berhasil dipicu manual.`, ephemeral: true });
      return;
    }

    if (result.reason === "already_started") {
      await interaction.reply({ content: `ℹ️ ${shiftDef.label} untuk hari ini sudah aktif.`, ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `${shiftDef.label} tidak punya petugas hari ini (kemungkinan hari Minggu/libur).`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "tes-reminder-logbook") {
    if (!config.logbookReminderChannelId || config.logbookUserIds.length === 0) {
        await interaction.reply({ content: "⚠️ Konfigurasi logbook reminder belum lengkap di .env.", ephemeral: true });
      return;
    }

    const pendingUserIds = await getPendingLogbookUserIds();
    if (pendingUserIds.length === 0) {
      await interaction.reply({ content: `Semua target logbook sudah lapor untuk ${todayDateString()}.`, ephemeral: true });
      return;
    }

    await sendLogbookReminder(pendingUserIds, "manual_slash_command");
    await interaction.reply({ content: "✅ Reminder logbook manual berhasil dikirim.", ephemeral: true });
    return;
  }

  if (interaction.commandName === "status-shift") {
    const sessions = Array.from(activeSessions.values());
    if (sessions.length === 0) {
      await interaction.reply({ content: "ℹ️ Saat ini tidak ada shift aktif.", ephemeral: true });
      return;
    }

    const statusText = sessions
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .map((session) => {
        const pendingCount = getPendingAssignees(session).length;
        const pendingFinishCount = getPendingFinishes(session).length;
        return [
          `${session.shiftLabel} (${session.startLabel}-${session.endLabel})`,
          `Fase: ${getSessionPhaseLabel(session)}`,
          buildStatusBlock(session),
          `Belum start: ${pendingCount}`,
          `Belum selesai: ${pendingFinishCount}`,
        ].join("\n");
      })
      .join("\n\n");

    await interaction.reply({ content: statusText, ephemeral: true });
    return;
  }

  if (interaction.commandName === "rekap-hari-ini") {
    const dayKey = todayKeyString();
    const inMemoryRecap = buildInMemoryRecap(dayKey);
    const sheetRecap = await buildSheetRecap(dayKey);
    const lines = [inMemoryRecap];
    if (sheetRecap) {
      lines.push("");
      lines.push(sheetRecap);
    }
    await interaction.reply({ content: lines.join("\n"), ephemeral: true });
  }

  if (interaction.commandName === "shift-done") {
    if (!taskHandler.isAdminUser(interaction.user.id)) {
      await interaction.reply({ content: "Perintah ini khusus admin.", ephemeral: true });
      return;
    }

    const sessions = Array.from(activeSessions.values()).filter((s) => !s.closed);
    if (sessions.length === 0) {
      await interaction.reply({ content: "Tidak ada shift aktif untuk ditutup.", ephemeral: true });
      return;
    }

    const eligibleSessions = sessions.filter((session) => canManuallyCloseSession(session));
    const blockedSessions = sessions.filter((session) => !canManuallyCloseSession(session));

    if (eligibleSessions.length === 0) {
      const blockedText = blockedSessions
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((session) => `${session.shiftLabel} (${session.startLabel}-${session.endLabel}) masih berjalan`)
        .join("\n");
      await interaction.reply({
        content: `Belum ada shift yang boleh ditutup manual.\n${blockedText}`,
        ephemeral: true,
      });
      return;
    }

    const results = [];
    let totalSaved = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const session of eligibleSessions) {
      const result = await closeSession(session, "manual_close");
      if (!result.closed) {
        continue;
      }

      results.push(`${session.shiftLabel} (${session.dateLabel})`);
      totalSaved += result.savedCount || 0;
      totalFailed += result.failedCount || 0;
      totalSkipped += result.skippedCount || 0;
    }

    const lines = [
      `Shift berikut telah ditutup:`,
      results.join("\n"),
      "",
      `Sheet: ${totalSaved} disimpan | ${totalFailed} gagal | ${totalSkipped} belum start`,
    ];

    if (blockedSessions.length > 0) {
      lines.push("");
      lines.push("Belum ditutup karena masih berjalan:");
      lines.push(
        blockedSessions
          .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
          .map((session) => `${session.shiftLabel} (${session.startLabel}-${session.endLabel})`)
          .join("\n")
      );
    }

    if (totalFailed > 0 || !sheets.isSheetsConfigured()) {
      lines.push("");
      lines.push(
        "Cek konfigurasi Google Sheets di .env (GSHEET_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY)"
      );
    }

    await interaction.reply({
      content: lines.join("\n"),
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "debug-time") {
    // Admin only
    if (!taskHandler.isAdminUser(interaction.user.id)) {
      await interaction.reply({ content: "⛔ Perintah ini khusus admin.", ephemeral: true });
      return;
    }

    const debugInfo = debugTimeInfo();
    const lines = [
      "🕐 **Debug Info Waktu**",
      "",
      `📍 Timezone: ${debugInfo.timezone}`,
      `🕐 Current Time: ${debugInfo.currentTime}`,
      `🌍 Current UTC: ${debugInfo.currentTimeUtc}`,
      "",
      "**Jadwal Shift:**",
    ];

    for (const shift of debugInfo.shifts) {
      lines.push(`\n${shift.label}: ${shift.start} - ${shift.end}`);
      lines.push(`  Start UTC: ${shift.startUtc}`);
      lines.push(`  End UTC: ${shift.endUtc}`);
    }

    await interaction.reply({ content: lines.join("\n"), ephemeral: true });
    return;
  }

  if (interaction.commandName === "task") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "assign") {
      // Admin only
      if (!taskHandler.isAdminUser(interaction.user.id)) {
        await interaction.reply({ content: "⛔ Perintah ini khusus admin.", ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser("member", true);
      const description = interaction.options.getString("deskripsi", true);
      const deadlineStr = interaction.options.getString("deadline", true);

      await taskHandler.assignTask({
        assignedBy: interaction.user.id,
        assignedByName: interaction.user.username,
        targetUser,
        description,
        deadlineStr,
        reply: (payload) => interaction.reply(typeof payload === "string" ? { content: payload, ephemeral: true } : { ...payload, ephemeral: true }),
      });
      return;
    }

    if (subcommand === "list") {
      const targetMember = interaction.options.getUser("member");

      // Jika ada parameter member, hanya admin yang bisa lihat
      if (targetMember && !taskHandler.isAdminUser(interaction.user.id)) {
        await interaction.reply({ content: "⛔ Hanya admin yang bisa melihat task member lain.", ephemeral: true });
        return;
      }

      if (targetMember) {
        // Admin melihat task member tertentu
        const allTasks = await sheets.getAllTasks();
        const memberTasks = allTasks.filter((t) => t.discordId === targetMember.id && t.status !== "cancelled");

        if (memberTasks.length === 0) {
          await interaction.reply({ content: `ℹ️ ${targetMember.username} tidak memiliki task aktif.`, ephemeral: true });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`📋 Task ${targetMember.username}`)
          .setTimestamp(new Date());

        const taskLines = memberTasks.map((task) => {
          const statusEmoji = task.status === "done" ? "✅" : "⏳";
          return `${statusEmoji} **${task.taskId}**: ${task.taskDesc.substring(0, 50)}${task.taskDesc.length > 50 ? "..." : ""}
            - Deadline: ${task.deadline}`;
        });

        embed.setDescription(taskLines.join("\n\n"));
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        // User melihat task sendiri, admin melihat semua
        await taskHandler.listTasks({
          userId: interaction.user.id,
          reply: (payload) => interaction.reply(typeof payload === "string" ? { content: payload, ephemeral: true } : { ...payload, ephemeral: true }),
        });
      }
      return;
    }

    if (subcommand === "done") {
      const taskId = interaction.options.getString("task_id", true);

      await taskHandler.markTaskDone({
        userId: interaction.user.id,
        taskId,
        reply: (payload) => interaction.reply(typeof payload === "string" ? { content: payload, ephemeral: true } : { ...payload, ephemeral: true }),
      });
      return;
    }

    if (subcommand === "cancel") {
      // Admin only
      if (!taskHandler.isAdminUser(interaction.user.id)) {
        await interaction.reply({ content: "⛔ Perintah ini khusus admin.", ephemeral: true });
        return;
      }

      const taskId = interaction.options.getString("task_id", true);

      await taskHandler.cancelTask({
        taskId,
        cancelledBy: interaction.user.username,
        reply: (payload) => interaction.reply(typeof payload === "string" ? { content: payload, ephemeral: true } : { ...payload, ephemeral: true }),
      });
      return;
    }

    // Unknown subcommand
    await interaction.reply({ content: "❌ Subcommand task tidak valid.", ephemeral: true });
    return;
  }

  // Command tidak dikenali
  await interaction.reply({ content: "❌ Command tidak dikenali.", ephemeral: true });
  return;
}

async function registerSchedules() {
  for (const shift of SHIFT_DEFINITIONS) {
    const [hour, minute] = shift.startLabel.split(":").map((value) => Number.parseInt(value, 10));
    const cronExpr = `${minute} ${hour} * * *`;

    cron.schedule(
      cronExpr,
      async () => {
        try {
          await startShiftSession(shift);
        } catch (error) {
          console.error(`Gagal memulai ${shift.label}:`, error);
        }
      },
      { timezone: config.timezone }
    );

    console.log(`Scheduler aktif untuk ${shift.label}: "${cronExpr}" (${config.timezone})`);
  }

  if (config.logbookReminderChannelId && config.logbookUserIds.length > 0 && config.logbookReportChannelId) {
    cron.schedule(
      config.logbookReminderCron,
      async () => {
        try {
          // Skip reminder on Sunday (hari minggu/libur)
          if (getWeekdayKey() === "sunday") {
            return;
          }

          const pendingUserIds = await getPendingLogbookUserIds();
          if (pendingUserIds.length === 0) {
            console.log("Semua user sudah isi logbook hari ini, skip reminder");
            return;
          }

          await sendLogbookReminder(pendingUserIds, "cron_schedule");
        } catch (error) {
          console.error("Gagal kirim reminder logbook terjadwal:", error);
        }
      },
      { timezone: config.timezone }
    );

    console.log(`Scheduler aktif untuk logbook: "${config.logbookReminderCron}" (${config.timezone})`);
  } else {
    console.log("Scheduler logbook nonaktif (env logbook belum lengkap).");
  }

  // Auto-save weekly recap every Monday at 00:05
  cron.schedule(
    "5 0 * * 1",
    async () => {
      try {
        console.log("Menjalinkan auto-save weekly logbook recap...");
        await generateAndSaveWeeklyRecap();
        // Reset weekly stats setelah save
        logbookWeeklyStats.clear();
      } catch (error) {
        console.error("Gagal auto-save weekly recap:", error);
      }
    },
    { timezone: config.timezone }
  );

  console.log("Scheduler aktif untuk weekly recap: Setiap Senin 00:05");

  // Start task reminder scheduler (every 30 minutes)
  taskHandler.startTaskReminderScheduler();
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot login sebagai ${readyClient.user.tag}`);
  syncLogbookDailyState();
  syncLogbookWeeklyState();

  if (sheets.isSheetsConfigured()) {
    try {
      await sheets.ensureHeaderRow();
      await sheets.ensureTaskLogHeaderRow();
      await sheets.ensureWeeklyRecapHeaderRow();
      await sheets.ensureLogbookHistoryHeaderRow();
      console.log("Google Sheets aktif.");
    } catch (error) {
      console.error("Gagal inisialisasi Google Sheets:", error);
    }
  } else {
    console.log("Google Sheets belum dikonfigurasi, log harian ke sheet nonaktif.");
  }

  // Initialize AI handler
  if (aiHandler.isAIConfigured()) {
    aiHandler.initializeAll();
    aiHandler.startCleanupScheduler();
  }

  await registerSlashCommands();
  await registerSchedules();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    try {
      await handleSlashCommand(interaction);
    } catch (error) {
      console.error("Gagal proses slash command:", error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ Terjadi error saat menjalankan command.", ephemeral: true });
        }
      } catch (replyError) {
        // Ignore jika reply gagal (interaction sudah di-acknowledge)
        console.log("Tidak bisa reply ke interaction:", replyError.message);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const isLogbookDoneButton = interaction.customId.startsWith(LOGBOOK_DONE_BUTTON_PREFIX);
    if (isLogbookDoneButton) {
      const buttonDayKey = interaction.customId.slice(LOGBOOK_DONE_BUTTON_PREFIX.length);
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (error) {
        if (error.code === 10062 || error.code === 40060) {
          console.log("Button interaction sudah expired/acknowledged, skip");
          return;
        }
        throw error;
      }
      try {
        await registerLogbookDoneByButton({
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          buttonDayKey,
          reply: async (text) => {
            try {
              await interaction.editReply(text);
            } catch (e) {
              console.log("Gagal edit reply:", e.message);
            }
          },
        });
      } catch (error) {
        console.error("Error di registerLogbookDoneByButton:", error.message);
      }
      return;
    }

    const isTaskDoneButton = interaction.customId.startsWith(TASK_DONE_BUTTON_PREFIX);
    if (isTaskDoneButton) {
      const taskId = interaction.customId.slice(TASK_DONE_BUTTON_PREFIX.length);
      try {
        await interaction.deferReply({ ephemeral: false });
      } catch (error) {
        if (error.code === 10062 || error.code === 40060) {
          console.log("Button interaction sudah expired/acknowledged, skip");
          return;
        }
        throw error;
      }
      try {
        await taskHandler.markTaskDoneByButton({
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          taskId,
          reply: async (text) => {
            try {
              await interaction.editReply(text);
            } catch (e) {
              console.log("Gagal edit reply:", e.message);
            }
          },
        });
      } catch (error) {
        console.error("Error di markTaskDoneByButton:", error.message);
      }
      return;
    }

    const isStartButton = interaction.customId.startsWith(CHECKIN_BUTTON_PREFIX);
    const isFinishButton = interaction.customId.startsWith(FINISH_BUTTON_PREFIX);
    if (!isStartButton && !isFinishButton) {
      return;
    }

    if (isStartButton) {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (error) {
        if (error.code === 10062 || error.code === 40060) {
          console.log("Button interaction sudah expired/acknowledged, skip");
          return;
        }
        throw error;
      }
      try {
        const sessionId = interaction.customId.slice(CHECKIN_BUTTON_PREFIX.length);
        await registerCheckin({
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          sessionId,
          source: "button:start",
          reply: async (text) => {
            try {
              await interaction.editReply(text);
            } catch (e) {
              console.log("Gagal edit reply:", e.message);
            }
          },
        });
      } catch (error) {
        console.error("Error di registerCheckin:", error.message);
      }
      return;
    }

    const sessionId = interaction.customId.slice(FINISH_BUTTON_PREFIX.length);
    const targetSession = activeSessions.get(sessionId);
    if (!targetSession || targetSession.closed) {
      await interaction.reply({ content: "⏳ Shift ini sudah ditutup atau tidak aktif lagi.", ephemeral: true });
      return;
    }

    if (!targetSession.finishPhaseStarted) {
      await interaction.reply({
        content: `⏳ Tombol selesai untuk ${targetSession.shiftLabel} baru aktif sekitar ${formatClock(getFinishReminderAt(targetSession))}.`,
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`${FINISH_MODAL_PREFIX}${sessionId}`)
      .setTitle("Selesaikan Shift");
    const linkInput = new TextInputBuilder()
      .setCustomId("proof_link")
      .setLabel("Link Bukti (wajib)")
      .setPlaceholder("https://...")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    const row = new ActionRowBuilder().addComponents(linkInput);
    modal.addComponents(row);
    try {
      await interaction.showModal(modal);
    } catch (error) {
      if (error.code === 10062 || error.code === 40060) {
        console.log("Interaction sudah expired/acknowledged, skip showModal");
      } else {
        console.error("Gagal show modal:", error.message);
      }
    }
    return;
  }

  if (!interaction.isModalSubmit()) {
    return;
  }

  if (!interaction.customId.startsWith(FINISH_MODAL_PREFIX)) {
    return;
  }

  const modalSessionId = interaction.customId.slice(FINISH_MODAL_PREFIX.length);
  const proofLink = interaction.fields.getTextInputValue("proof_link").trim();
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (error) {
    if (error.code === 10062 || error.code === 40060) {
      console.log("Modal interaction sudah expired/acknowledged, skip");
      return;
    }
    throw error;
  }
  try {
    await registerFinish({
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      sessionId: modalSessionId,
      source: "modal:selesai",
      proofLink,
      reply: async (text) => {
        try {
          await interaction.editReply(text);
        } catch (e) {
          console.log("Gagal edit reply:", e.message);
        }
      },
    });
  } catch (error) {
    console.error("Error di registerFinish:", error.message);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) {
    return;
  }

  try {
    await handleLogbookReportMessage(message);
    await handleMessageCheckin(message);
    await handleAIChatMessage(message);
  } catch (error) {
    console.error("Error saat memproses MessageCreate:", error);
  }
});

function shouldRetryLogin(error) {
  return error && (error.code === "UND_ERR_CONNECT_TIMEOUT" || error.code === "ECONNRESET");
}

async function startBot() {
  try {
    await client.login(config.token);
  } catch (error) {
    console.error("Gagal login bot:", error);

    if (!shouldRetryLogin(error)) {
      process.exit(1);
    }

    console.error(`Retry login dalam ${LOGIN_RETRY_MS / 1000} detik...`);
    setTimeout(() => {
      startBot().catch((nestedError) => {
        console.error("Retry login gagal:", nestedError);
      });
    }, LOGIN_RETRY_MS);
  }
}

startBot().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});


