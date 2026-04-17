const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  channelMention,
  userMention,
} = require("discord.js");
const cron = require("node-cron");
const config = require("./config");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
const LOGIN_RETRY_MS = 15000;
const reportedToday = new Set();
let activeDayKey = "";

function detectStatus(messageContent) {
  const content = messageContent.toLowerCase();

  const doneKeywords = ["udah isi", "sudah isi", "dah isi", "done", "beres", "selesai"];
  const notYetKeywords = ["belum", "belom", "ntar", "nanti", "belum isi"];

  if (doneKeywords.some((keyword) => content.includes(keyword))) {
    return "Sudah isi";
  }

  if (notYetKeywords.some((keyword) => content.includes(keyword))) {
    return "Belum isi / akan isi nanti";
  }

  return "Laporan bebas";
}

function isLogbookReportMessage(messageContent) {
  const content = messageContent.toLowerCase();
  const requiredKeywords = ["isi", "logbook", "log book", "udah", "sudah", "belum", "dah"];
  return requiredKeywords.some((keyword) => content.includes(keyword));
}

function todayDateString() {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: config.timezone,
  }).format(new Date());
}

function todayKeyString() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: config.timezone,
  }).format(new Date());
}

function syncDailyReportState() {
  const dayKey = todayKeyString();
  if (dayKey !== activeDayKey) {
    activeDayKey = dayKey;
    reportedToday.clear();
  }
}

function getPendingUserIds() {
  syncDailyReportState();
  return config.reminderUserIds.filter((userId) => !reportedToday.has(userId));
}

async function sendReminder(pendingUserIds) {
  const reminderChannel = await client.channels.fetch(config.reminderChannelId);
  if (!reminderChannel || !reminderChannel.isTextBased()) {
    throw new Error("REMINDER_CHANNEL_ID tidak valid atau bukan text channel.");
  }

  const mentions = pendingUserIds.map((id) => userMention(id)).join(" ");
  const message = [
    `${mentions}`,
    `Reminder isi logbook untuk tanggal ${todayDateString()}.`,
    `Setelah isi, kirim status di ${channelMention(config.reportChannelId)}. Contoh: "aku dah isi kak abi."`,
    "Reminder ini akan diulang tiap 30 menit sampai kamu lapor.",
  ].join("\n");

  await reminderChannel.send({ content: message });
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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot login sebagai ${readyClient.user.tag}`);
  syncDailyReportState();

  cron.schedule(
    config.cronExpr,
    async () => {
      try {
        const pendingUserIds = getPendingUserIds();
        if (pendingUserIds.length === 0) {
          return;
        }

        await sendReminder(pendingUserIds);
        await sendLog("Reminder Terkirim", [
          { name: "Tanggal", value: todayDateString(), inline: true },
          { name: "Target User", value: pendingUserIds.map((id) => userMention(id)).join(" ") },
          { name: "Channel", value: channelMention(config.reminderChannelId), inline: true },
        ]);
      } catch (error) {
        console.error("Gagal kirim reminder:", error);
      }
    },
    { timezone: config.timezone }
  );

  console.log(`Scheduler aktif: "${config.cronExpr}" (${config.timezone})`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) {
    return;
  }

  if (message.channelId !== config.reportChannelId) {
    return;
  }

  if (!config.reminderUserIds.includes(message.author.id)) {
    return;
  }

  if (!isLogbookReportMessage(message.content)) {
    await message.reply(
      "Pesan kamu belum kebaca sebagai laporan logbook. Contoh: `aku dah isi logbook` atau `aku belum isi logbook`."
    );
    return;
  }

  syncDailyReportState();
  const isFirstValidReportToday = !reportedToday.has(message.author.id);
  reportedToday.add(message.author.id);

  if (!isFirstValidReportToday) {
    await message.reply("Laporan kamu sudah pernah tercatat hari ini.");
    return;
  }

  const status = detectStatus(message.content);

  await message.reply("Maaciw dah laporan hari ini, besok jangan sampai lupa");

  await sendLog("Laporan Logbook Masuk", [
    { name: "User", value: `${message.author.tag} (${message.author.id})` },
    { name: "Status", value: status, inline: true },
    { name: "Channel", value: channelMention(message.channelId), inline: true },
    { name: "Isi Pesan", value: message.content || "-" },
  ]);
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
