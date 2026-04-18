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

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const LOGIN_RETRY_MS = 15000;
const CHECKIN_BUTTON_PREFIX = "shift-start:";
const FINISH_BUTTON_PREFIX = "shift-finish:";
const FINISH_MODAL_PREFIX = "shift-finish-modal:";
const LOGBOOK_DONE_BUTTON_PREFIX = "logbook-done:";

const WEEKDAY_ID_LABEL = {
  monday: "Senin",
  tuesday: "Selasa",
  wednesday: "Rabu",
  thursday: "Kamis",
  friday: "Jumat",
  saturday: "Sabtu",
  sunday: "Minggu",
};

const SHIFT_DEFINITIONS = [
  {
    id: "shift-1",
    label: "Shift 1",
    startLabel: "09:00",
    endLabel: "12:00",
    durationMinutes: 180,
    primaryByDay: {
      monday: "Abi",
      tuesday: "Cilla",
      wednesday: "Sharon",
      thursday: "Abi",
      friday: "Cilla",
      saturday: "Sharon",
      sunday: null,
    },
  },
  {
    id: "shift-2",
    label: "Shift 2",
    startLabel: "12:00",
    endLabel: "15:00",
    durationMinutes: 180,
    primaryByDay: {
      monday: "Cilla",
      tuesday: "Sharon",
      wednesday: "Cilla",
      thursday: "Cilla",
      friday: "Sharon",
      saturday: "Cilla",
      sunday: null,
    },
  },
  {
    id: "shift-3",
    label: "Shift 3",
    startLabel: "16:00",
    endLabel: "19:00",
    durationMinutes: 180,
    primaryByDay: {
      monday: "Sharon",
      tuesday: "Abi",
      wednesday: "Abi",
      thursday: "Sharon",
      friday: "Abi",
      saturday: "Abi",
      sunday: null,
    },
  },
];

const activeSessions = new Map();
const sessionHistoryByDay = new Map();
const logbookReportedToday = new Set();
let activeLogbookDayKey = "";

function nowInTimezone() {
  return new Date();
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

function getPendingLogbookUserIds() {
  syncLogbookDailyState();
  return config.logbookUserIds.filter((userId) => !logbookReportedToday.has(userId));
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
  return Date.now() >= session.endAt.getTime();
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

  if (logbookReportedToday.has(userId)) {
    await reply("Status logbook kamu hari ini sudah tercatat.");
    return;
  }

  logbookReportedToday.add(userId);

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
  const isFinishMode = mode === "finish" || mode === "finishReminder";
  const recipients = isFinishMode
    ? mode === "finishReminder"
      ? getPendingFinishes(session)
      : session.assignees.filter((assignee) => session.checkins.has(assignee.userId))
    : mode === "startReminder"
      ? getPendingAssignees(session)
      : session.assignees;
  if (recipients.length === 0) {
    return;
  }

  const components = [isFinishMode ? createFinishButtonRow(session, false) : createStartButtonRow(session, false)];
  const payload = {
    content: buildSessionMessage(session, mode),
    components,
  };

  for (const recipient of recipients) {
    await sendDirectMessage(recipient.userId, payload);
  }
}

async function appendShiftRecordSafe(record) {
  if (!sheets.isSheetsConfigured()) {
    return;
  }

  try {
    await sheets.appendShiftRecord(record);
  } catch (error) {
    console.error("Gagal simpan shift record ke Google Sheets:", error);
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
      content: buildSessionMessage(session, session.finishPhaseStarted ? "finish" : "start"),
      components: [
        session.finishPhaseStarted
          ? createFinishButtonRow(session, session.closed || getPendingFinishes(session).length === 0)
          : createStartButtonRow(session, session.closed || getPendingAssignees(session).length === 0),
      ],
    });
  } catch (error) {
    console.error(`Gagal update status message session ${session.sessionId}:`, error);
  }
}

async function closeSession(session, reason) {
  if (session.closed) {
    return;
  }

  session.closed = true;
  if (session.reminderInterval) {
    clearInterval(session.reminderInterval);
    session.reminderInterval = null;
  }

  const pendingStarts = getPendingAssignees(session);
  const pendingFinishes = getPendingFinishes(session);

  for (const assignee of session.assignees) {
    const start = session.checkins.get(assignee.userId);
    const finish = session.finishes.get(assignee.userId);

    // Jangan tulis log apa pun untuk user yang belum menekan start.
    if (!start) {
      continue;
    }

    let status = "not_finished";
    let checkinAtIso = start.checkedInAt.toISOString();
    if (finish) {
      status = start.isLate ? "completed_late" : "completed_on_time";
      checkinAtIso = finish.finishedAt.toISOString();
    }

    await appendShiftRecordSafe({
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
      source: reason,
      evidenceLink: finish ? finish.proofLink || "" : "",
    });
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
  ]);

  activeSessions.delete(session.sessionId);
  archiveSession(session);
}
async function sendFollowupReminder(session) {
  if (session.closed) {
    return;
  }

  const nowMs = Date.now();

  if (!session.finishPhaseStarted) {
    if (nowMs >= session.endAt.getTime()) {
      session.finishPhaseStarted = true;
      session.finishDeadline = new Date(nowMs + config.finishGraceMinutes * 60 * 1000);
      await sendSessionNotification(session, "finish");
      return;
    }

    const pendingStarts = getPendingAssignees(session);
    if (pendingStarts.length > 0) {
      await sendSessionNotification(session, "startReminder");
    }
    return;
  }

  const pendingFinishes = getPendingFinishes(session);
  if (pendingFinishes.length === 0) {
    await closeSession(session, "all_finished");
    return;
  }

  if (session.finishDeadline && nowMs >= session.finishDeadline.getTime()) {
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
    startAt: new Date(),
    endAt: new Date(Date.now() + shiftDef.durationMinutes * 60 * 1000),
    channelId: null,
    messageId: null,
    assignees,
    checkins: new Map(),
    finishes: new Map(),
    finishPhaseStarted: false,
    finishDeadline: null,
    closed: false,
    reminderInterval: null,
  };

  activeSessions.set(sessionId, session);
  await sendSessionNotification(session, "start");

  session.reminderInterval = setInterval(() => {
    sendFollowupReminder(session).catch((error) => {
      console.error(`Gagal kirim reminder ulang untuk ${session.sessionId}:`, error);
    });
  }, config.reminderRepeatMinutes * 60 * 1000);

  return { started: true, session };
}

function findAssignableSessionForUser(userId) {
  const sessions = Array.from(activeSessions.values())
    .filter((session) => !session.closed)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

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

async function registerCheckin({ userId, userTag, source, reply }) {
  const lookup = findAssignableSessionForUser(userId);
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

function findCompletableSessionForUser(userId) {
  const sessions = Array.from(activeSessions.values())
    .filter((session) => !session.closed && session.finishPhaseStarted)
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

async function registerFinish({ userId, userTag, source, proofLink, reply }) {
  if (!proofLink || !isValidHttpUrl(proofLink)) {
    await reply("🔗 Link bukti tidak valid. Pakai format URL lengkap, contoh: https://contoh.com/bukti");
    return;
  }

  const lookup = findCompletableSessionForUser(userId);
  if (!lookup) {
    await reply("⏳ Belum ada shift yang bisa ditandai selesai untuk akun kamu.");
    return;
  }

  const { session, alreadyFinished } = lookup;
  if (alreadyFinished) {
    await reply(`✅ Status selesai kamu untuk ${session.shiftLabel} sudah tercatat.`);
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
  await reply(`✅ Selesai ${session.shiftLabel} tercatat dengan link bukti.`);

  const pendingFinishes = getPendingFinishes(session);
  if (pendingFinishes.length === 0) {
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
  if (logbookReportedToday.has(message.author.id)) {
    return;
  }

  logbookReportedToday.add(message.author.id);
  await sendLog("📝 Laporan Logbook Masuk", [
    { name: "User", value: `${message.author.tag} (${message.author.id})` },
    { name: "Tanggal", value: todayDateString(), inline: true },
    { name: "Channel", value: channelMention(message.channelId), inline: true },
  ]);
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
  ].map((cmd) => cmd.toJSON());
}

async function registerSlashCommands() {
  const guild = await client.guilds.fetch(config.guildId);
  await guild.commands.set(buildAdminSlashCommands());
  console.log(`Slash command admin terdaftar di guild ${config.guildId}.`);
}

async function handleSlashCommand(interaction) {
  if (!isAdminUser(interaction.user.id)) {
    await interaction.reply({ content: "⛔ Perintah ini khusus admin.", ephemeral: true });
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

    const pendingUserIds = getPendingLogbookUserIds();
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
        return [
          `${session.shiftLabel} (${session.startLabel}-${session.endLabel})`,
          buildStatusBlock(session),
          `Pending: ${pendingCount}`,
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
          const pendingUserIds = getPendingLogbookUserIds();
          if (pendingUserIds.length === 0) {
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
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot login sebagai ${readyClient.user.tag}`);
  syncLogbookDailyState();

  if (sheets.isSheetsConfigured()) {
    try {
      await sheets.ensureHeaderRow();
      console.log("Google Sheets aktif.");
    } catch (error) {
      console.error("Gagal inisialisasi Google Sheets:", error);
    }
  } else {
    console.log("Google Sheets belum dikonfigurasi, log harian ke sheet nonaktif.");
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
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Terjadi error saat menjalankan command.", ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const isLogbookDoneButton = interaction.customId.startsWith(LOGBOOK_DONE_BUTTON_PREFIX);
    if (isLogbookDoneButton) {
      const buttonDayKey = interaction.customId.slice(LOGBOOK_DONE_BUTTON_PREFIX.length);
      await interaction.deferReply({ ephemeral: true });
      await registerLogbookDoneByButton({
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        buttonDayKey,
        reply: async (text) => {
          await interaction.editReply(text);
        },
      });
      return;
    }

    const isStartButton = interaction.customId.startsWith(CHECKIN_BUTTON_PREFIX);
    const isFinishButton = interaction.customId.startsWith(FINISH_BUTTON_PREFIX);
    if (!isStartButton && !isFinishButton) {
      return;
    }

    if (isStartButton) {
      await interaction.deferReply({ ephemeral: true });
      await registerCheckin({
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        source: "button:start",
        reply: async (text) => {
          await interaction.editReply(text);
        },
      });
      return;
    }

    const sessionId = interaction.customId.slice(FINISH_BUTTON_PREFIX.length);
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
    await interaction.showModal(modal);
    return;
  }

  if (!interaction.isModalSubmit()) {
    return;
  }

  if (!interaction.customId.startsWith(FINISH_MODAL_PREFIX)) {
    return;
  }

  const proofLink = interaction.fields.getTextInputValue("proof_link").trim();
  await interaction.deferReply({ ephemeral: true });
  await registerFinish({
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    source: "modal:selesai",
    proofLink,
    reply: async (text) => {
      await interaction.editReply(text);
    },
  });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) {
    return;
  }

  try {
    await handleLogbookReportMessage(message);
    await handleMessageCheckin(message);
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


