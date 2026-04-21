const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("./config");
const sheets = require("./sheets");

const TASK_DONE_BUTTON_PREFIX = "task-done:";

const TASK_REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 menit
const OVERDUE_REMINDER_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 jam

function nowInTimezone() {
  return new Date();
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: config.timezone,
  }).format(date);
}

function parseDeadline(deadlineStr) {
  // Format: DD/MM HH:MM
  const regex = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/;
  const match = deadlineStr.trim().match(regex);

  if (!match) {
    return { error: "Format deadline salah. Gunakan DD/MM HH:MM (contoh: 25/12 17:30)" };
  }

  const [, day, month, hour, minute] = match;
  const now = nowInTimezone();
  const currentYear = now.getFullYear();

  const deadline = new Date(
    Date.UTC(currentYear, Number.parseInt(month, 10) - 1, Number.parseInt(day, 10), Number.parseInt(hour, 10), Number.parseInt(minute, 10))
  );

  // Convert dari UTC ke timezone lokal
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localDeadline = new Date(deadline.getTime() + tzOffset);

  if (localDeadline <= now) {
    return { error: "Deadline tidak boleh di waktu yang sudah lewat." };
  }

  return { date: localDeadline };
}

function getRemainingTime(deadline) {
  const now = nowInTimezone();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { overdue: true, hours: Math.abs(diffMs) / (1000 * 60 * 60) };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    overdue: false,
    hours,
    minutes,
    totalMinutes: Math.floor(diffMs / (1000 * 60)),
  };
}

function formatRemainingTime(deadline) {
  const remaining = getRemainingTime(deadline);

  if (remaining.overdue) {
    const hoursOverdue = Math.floor(remaining.hours);
    if (hoursOverdue >= 1) {
      return `sudah lewat ${hoursOverdue} jam yang lalu`;
    }
    const minutesOverdue = Math.floor(remaining.hours * 60);
    return `sudah lewat ${minutesOverdue} menit yang lalu`;
  }

  if (remaining.hours >= 24) {
    const days = Math.floor(remaining.hours / 24);
    const hour = deadline.getHours().toString().padStart(2, "0");
    const minute = deadline.getMinutes().toString().padStart(2, "0");
    return `${days} hari lagi, besok jam ${hour}:${minute}`;
  }

  if (remaining.hours >= 1) {
    return `${remaining.hours} jam ${remaining.minutes} menit lagi`;
  }

  return `${remaining.minutes} menit lagi`;
}

function generateNextTaskId(existingTasks) {
  if (!existingTasks || existingTasks.length === 0) {
    return "T001";
  }

  const maxId = existingTasks.reduce((max, task) => {
    const num = parseInt(task.taskId.replace("T", ""), 10);
    return num > max ? num : max;
  }, 0);

  return `T${String(maxId + 1).padStart(3, "0")}`;
}

function isAdminUser(userId) {
  if (config.adminUserIds.length === 0) {
    return true;
  }
  return config.adminUserIds.includes(userId);
}

async function sendDirectMessage(userId, payload) {
  try {
    const user = await global.client?.users.fetch(userId);
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

function createTaskDoneButtonRow(taskId, disabled = false) {
  const button = new ButtonBuilder()
    .setCustomId(`${TASK_DONE_BUTTON_PREFIX}${taskId}`)
    .setLabel("Selesai")
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);

  return new ActionRowBuilder().addComponents(button);
}

async function sendLog(title, fields = []) {
  if (!global.client) {
    return;
  }

  try {
    const logChannel = await global.client.channels.fetch(config.logChannelId);
    if (!logChannel || !logChannel.isTextBased()) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2b9f6a)
      .setTitle(title)
      .setTimestamp(new Date())
      .addFields(fields);

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Gagal kirim log:", error);
  }
}

async function assignTask({ assignedBy, assignedByName, targetUser, description, deadlineStr, reply }) {
  const parsed = parseDeadline(deadlineStr);
  if (parsed.error) {
    await reply({ content: `❌ ${parsed.error}`, ephemeral: true });
    return;
  }

  const existingTasks = await sheets.getAllTasks();
  const taskId = generateNextTaskId(existingTasks);

  const now = nowInTimezone();
  const createdAt = now.toISOString();
  const deadlineFormatted = formatDateTime(parsed.date);

  const task = {
    taskId,
    discordId: targetUser.id,
    nama: targetUser.username,
    taskDesc: description,
    deadline: deadlineFormatted,
    status: "pending",
    createdBy: assignedByName,
    createdAt,
    doneAt: "",
    lastReminded: "",
    cancelledAt: "",
  };

  await sheets.createTask(task);

  // Kirim DM ke member yang di-assign
  const dmEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📋 Task Baru!")
    .addFields(
      { name: "ID", value: taskId, inline: true },
      { name: "Dari", value: assignedByName, inline: true },
      { name: "Deadline", value: deadlineFormatted, inline: false },
      { name: "Deskripsi", value: description, inline: false }
    )
    .setFooter({ text: "Klik tombol Selesai kalau sudah selesai." })
    .setTimestamp(new Date());

  await sendDirectMessage(targetUser.id, {
    embeds: [dmEmbed],
    components: [createTaskDoneButtonRow(taskId)],
  });

  // Konfirmasi ke admin
  const confirmEmbed = new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("✅ Task Berhasil Diassign")
    .addFields(
      { name: "Task ID", value: taskId, inline: true },
      { name: "Assignee", value: `${targetUser.username}`, inline: true },
      { name: "Deadline", value: deadlineFormatted, inline: false },
      { name: "Deskripsi", value: description, inline: false }
    )
    .setTimestamp(new Date());

  await reply({ embeds: [confirmEmbed], ephemeral: true });

  await sendLog("📝 Task Baru Dibuat", [
    { name: "Task ID", value: taskId, inline: true },
    { name: "Assignee", value: `${targetUser.username} (${targetUser.id})`, inline: true },
    { name: "Dibuat Oleh", value: assignedByName, inline: true },
    { name: "Deadline", value: deadlineFormatted },
    { name: "Deskripsi", value: description },
  ]);
}

async function listTasks({ userId, reply }) {
  const allTasks = await sheets.getAllTasks();
  const isTargetUser = config.logbookUserIds.includes(userId);
  const isAdmin = isAdminUser(userId);

  let tasksToShow;

  if (isAdmin) {
    // Admin lihat semua task aktif
    tasksToShow = allTasks.filter((t) => t.status !== "cancelled");
  } else if (isTargetUser) {
    // Member lihat task sendiri saja
    tasksToShow = allTasks.filter((t) => t.discordId === userId && t.status !== "cancelled");
  } else {
    await reply({ content: "⛔ Kamu tidak memiliki akses untuk melihat task.", ephemeral: true });
    return;
  }

  if (tasksToShow.length === 0) {
    await reply({ content: "ℹ️ Tidak ada task aktif.", ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(isAdmin ? 0x9b59b6 : 0x3498db)
    .setTitle(isAdmin ? "📋 Semua Task Aktif" : "📋 Task Kamu")
    .setTimestamp(new Date());

  const taskLines = tasksToShow.map((task) => {
    const statusEmoji = task.status === "done" ? "✅" : task.status === "pending" ? "⏳" : "❌";
    return `${statusEmoji} **${task.taskId}**: ${task.taskDesc.substring(0, 50)}${task.taskDesc.length > 50 ? "..." : ""}
      - Deadline: ${task.deadline} | Status: ${task.status}`;
  });

  embed.setDescription(taskLines.join("\n\n"));

  await reply({ embeds: [embed], ephemeral: true });
}

async function markTaskDone({ userId, taskId, reply, disableButton = null }) {
  const task = await sheets.getTaskById(taskId);

  if (!task) {
    await reply({ content: `❌ Task \`${taskId}\` tidak ditemukan.`, ephemeral: true });
    return;
  }

  if (task.discordId !== userId) {
    await reply({ content: `❌ Task \`${taskId}\` bukan diassign ke kamu.`, ephemeral: true });
    return;
  }

  if (task.status === "done") {
    await reply({ content: `✅ Task \`${taskId}\` sudah ditandai selesai sebelumnya.`, ephemeral: true });
    return;
  }

  if (task.status === "cancelled") {
    await reply({ content: `❌ Task \`${taskId}\` sudah dibatalkan.`, ephemeral: true });
    return;
  }

  const now = nowInTimezone();
  const doneAt = now.toISOString();
  const doneAtFormatted = formatDateTime(now);

  await sheets.updateTaskStatus(taskId, "done", { doneAt });

  // Notif ke channel admin
  const notificationEmbed = new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("✅ Task Selesai")
    .addFields(
      { name: "ID", value: taskId, inline: true },
      { name: "Member", value: task.nama, inline: true },
      { name: "Selesai pada", value: doneAtFormatted, inline: false },
      { name: "Task", value: task.taskDesc, inline: false }
    )
    .setTimestamp(new Date());

  if (config.taskNotificationChannelId) {
    try {
      const notificationChannel = await global.client.channels.fetch(config.taskNotificationChannelId);
      if (notificationChannel && notificationChannel.isTextBased()) {
        await notificationChannel.send({ embeds: [notificationEmbed] });
      }
    } catch (error) {
      console.error("Gagal kirim notif task selesai:", error);
    }
  }

  await sendLog("✅ Task Ditandai Selesai", [
    { name: "Task ID", value: taskId, inline: true },
    { name: "Member", value: `${task.nama} (${task.discordId})`, inline: true },
    { name: "Selesai Pada", value: doneAtFormatted },
  ]);

  // Update button jadi disabled
  if (disableButton) {
    await reply({
      embeds: [notificationEmbed],
      components: [createTaskDoneButtonRow(taskId, true)],
    });
  } else {
    await reply({ embeds: [notificationEmbed], ephemeral: true });
  }
}

async function cancelTask({ taskId, cancelledBy, reply }) {
  const task = await sheets.getTaskById(taskId);

  if (!task) {
    await reply({ content: `❌ Task \`${taskId}\` tidak ditemukan.`, ephemeral: true });
    return;
  }

  if (task.status === "done") {
    await reply({ content: `❌ Task \`${taskId}\` sudah selesai, tidak bisa dibatalkan.`, ephemeral: true });
    return;
  }

  if (task.status === "cancelled") {
    await reply({ content: `ℹ️ Task \`${taskId}\` sudah dibatalkan sebelumnya.`, ephemeral: true });
    return;
  }

  const now = nowInTimezone();
  const cancelledAt = now.toISOString();

  await sheets.updateTaskStatus(taskId, "cancelled", { cancelledAt });

  // Notif ke member
  const dmEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("❌ Task Dibatalkan")
    .addFields(
      { name: "ID", value: taskId, inline: true },
      { name: "Task", value: task.taskDesc, inline: false },
      { name: "Dibatalkan Oleh", value: cancelledBy, inline: true }
    )
    .setFooter({ text: "Task ini sudah dibatalkan oleh admin." })
    .setTimestamp(new Date());

  await sendDirectMessage(task.discordId, { embeds: [dmEmbed] });

  await sendLog("❌ Task Dibatalkan", [
    { name: "Task ID", value: taskId, inline: true },
    { name: "Assignee", value: `${task.nama} (${task.discordId})`, inline: true },
    { name: "Dibatalkan Oleh", value: cancelledBy },
  ]);

  await reply({
    content: `✅ Task \`${taskId}\` berhasil dibatalkan.`,
    ephemeral: true,
  });
}

async function sendTaskReminders() {
  const pendingTasks = await sheets.getPendingTasks();
  const now = nowInTimezone();

  for (const task of pendingTasks) {
    // Parse deadline dari format string
    const deadlineMatch = task.deadline.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (!deadlineMatch) {
      continue;
    }

    const [, day, month, year, hour, minute] = deadlineMatch;
    const deadline = new Date(
      Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10), Number.parseInt(hour, 10), Number.parseInt(minute, 10))
    );

    // Convert dari UTC ke timezone lokal
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localDeadline = new Date(deadline.getTime() + tzOffset);

    const remaining = getRemainingTime(localDeadline);
    const lastReminded = task.lastReminded ? new Date(task.lastReminded) : null;

    // Cek apakah sudah diingatkan dalam window waktu yang sama
    const shouldRemind = (reminderType) => {
      if (!lastReminded) return true;

      const diffHours = (now.getTime() - lastReminded.getTime()) / (1000 * 60 * 60);

      // Untuk reminder H-1 dan 1 jam, jangan spam dalam 1 jam
      if (reminderType === "h_minus_1" || reminderType === "1_hour") {
        return diffHours >= 1;
      }

      // Untuk overdue, remind setiap 2 jam
      if (reminderType === "overdue") {
        return diffHours >= 2;
      }

      return true;
    };

    let reminderSent = false;

    // H-1 sebelum deadline (24 jam sebelum)
    if (remaining.totalMinutes >= 24 * 60 && remaining.totalMinutes < 25 * 60 && !remaining.overdue) {
      if (shouldRemind("h_minus_1")) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("⏰ Reminder Task - H-1")
          .addFields(
            { name: "ID", value: task.taskId, inline: true },
            { name: "Deadline", value: task.deadline, inline: true },
            { name: "Waktu Tersisa", value: formatRemainingTime(localDeadline), inline: false },
            { name: "Task", value: task.taskDesc, inline: false }
          )
          .setFooter({ text: "Klik tombol Selesai kalau sudah selesai." })
          .setTimestamp(new Date());

        await sendDirectMessage(task.discordId, {
          embeds: [dmEmbed],
          components: [createTaskDoneButtonRow(task.taskId)],
        });
        await sheets.updateTaskStatus(task.taskId, "pending", { lastReminded: now.toISOString() });
        reminderSent = true;
      }
    }

    // 1 jam sebelum deadline
    if (remaining.totalMinutes >= 55 && remaining.totalMinutes < 65 && !remaining.overdue) {
      if (shouldRemind("1_hour")) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle("⏰ Reminder Task - 1 Jam Lagi")
          .addFields(
            { name: "ID", value: task.taskId, inline: true },
            { name: "Deadline", value: task.deadline, inline: true },
            { name: "Waktu Tersisa", value: formatRemainingTime(localDeadline), inline: false },
            { name: "Task", value: task.taskDesc, inline: false }
          )
          .setFooter({ text: "Segera selesaikan, klik tombol Selesai!" })
          .setTimestamp(new Date());

        await sendDirectMessage(task.discordId, {
          embeds: [dmEmbed],
          components: [createTaskDoneButtonRow(task.taskId)],
        });
        await sheets.updateTaskStatus(task.taskId, "pending", { lastReminded: now.toISOString() });
        reminderSent = true;
      }
    }

    // Tepat saat deadline terlewat (overdue)
    if (remaining.overdue && remaining.hours < 0.5) {
      if (shouldRemind("overdue")) {
        // DM warning ke member
        const dmEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🚨 Task Overdue!")
          .addFields(
            { name: "ID", value: task.taskId, inline: true },
            { name: "Deadline", value: task.deadline, inline: true },
            { name: "Status", value: formatRemainingTime(localDeadline), inline: false },
            { name: "Task", value: task.taskDesc, inline: false }
          )
          .setFooter({ text: "Segera selesaikan dengan klik tombol Selesai!" })
          .setTimestamp(new Date());

        await sendDirectMessage(task.discordId, {
          embeds: [dmEmbed],
          components: [createTaskDoneButtonRow(task.taskId)],
        });

        // Notif ke channel admin
        const adminEmbed = new EmbedBuilder()
          .setColor(0xc0392b)
          .setTitle("🚨 Task Overdue - Warning")
          .addFields(
            { name: "Task ID", value: task.taskId, inline: true },
            { name: "Assignee", value: `${task.nama} (${task.discordId})`, inline: true },
            { name: "Deadline", value: task.deadline, inline: false },
            { name: "Task", value: task.taskDesc, inline: false }
          )
          .setTimestamp(new Date());

        if (config.taskNotificationChannelId) {
          try {
            const notificationChannel = await global.client.channels.fetch(config.taskNotificationChannelId);
            if (notificationChannel && notificationChannel.isTextBased()) {
              await notificationChannel.send({ embeds: [adminEmbed] });
            }
          } catch (error) {
            console.error("Gagal kirim notif overdue:", error);
          }
        }

        await sheets.updateTaskStatus(task.taskId, "pending", { lastReminded: now.toISOString() });
        reminderSent = true;
      }
    }

    // Setiap 2 jam setelah overdue
    if (remaining.overdue && remaining.hours >= 0.5) {
      if (shouldRemind("overdue")) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xc0392b)
          .setTitle("🚨 Task Masih Overdue!")
          .addFields(
            { name: "ID", value: task.taskId, inline: true },
            { name: "Deadline", value: task.deadline, inline: true },
            { name: "Status", value: formatRemainingTime(localDeadline), inline: false },
            { name: "Task", value: task.taskDesc, inline: false }
          )
          .setFooter({ text: "Klik tombol Selesai setelah menyelesaikan task." })
          .setTimestamp(new Date());

        await sendDirectMessage(task.discordId, {
          embeds: [dmEmbed],
          components: [createTaskDoneButtonRow(task.taskId)],
        });
        await sheets.updateTaskStatus(task.taskId, "pending", { lastReminded: now.toISOString() });
        reminderSent = true;
      }
    }
  }
}

function startTaskReminderScheduler() {
  setInterval(() => {
    sendTaskReminders().catch((error) => {
      console.error("Gagal kirim task reminders:", error);
    });
  }, TASK_REMINDER_INTERVAL_MS);

  console.log(`Task reminder scheduler aktif: setiap ${TASK_REMINDER_INTERVAL_MS / 1000 / 60} menit`);
}

async function markTaskDoneByButton({ userId, userTag, taskId, reply }) {
  await markTaskDone({
    userId,
    taskId,
    reply,
    disableButton: true,
  });
}

module.exports = {
  TASK_DONE_BUTTON_PREFIX,
  assignTask,
  listTasks,
  markTaskDone,
  markTaskDoneByButton,
  cancelTask,
  sendTaskReminders,
  startTaskReminderScheduler,
  isAdminUser,
  parseDeadline,
  formatDateTime,
  createTaskDoneButtonRow,
};
