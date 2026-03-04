require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

const ticketCommand = require('./commands/ticket');
const { modals, createFeedbackModal } = require('./modals/ticketModals');
const db = require('./database/db');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// Pending tickets waiting for user assignment
const pendingTickets = new Map();

// Cache of active tickets (threadId -> ticket data)
const activeTickets = new Map();

// Role IDs for each ticket type
const TICKET_ROLES = {
  modal_eta_ppo: ['1300285037241045073'],
  modal_eta_ureq: ['1336223205601316936'],
  modal_revive: ['1300285037241045073', '1337705127703871488'],
  modal_restock: ['1337705127703871488'],
  modal_new_item: ['1300285037241045073'],
};

// User IDs for specific ticket types (not roles)
const TICKET_USERS = {
  modal_kompen: ['392321900577161219', '421215427696394241'],
};

client.commands = new Collection();
client.commands.set(ticketCommand.data.name, ticketCommand);

// Register slash commands
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const commands = [ticketCommand.data.toJSON()];

  try {
    // Register globally (use GUILD_ID for faster testing)
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
        { body: commands }
      );
      console.log('Registered commands to guild');
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('Registered commands globally');
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
  }

  // Restore buttons on existing open tickets
  await restoreButtons(client);
});

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) {
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Error executing command', flags: MessageFlags.Ephemeral });
        }
      }
    }
  }

  // Select menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_select') {
    const ticketType = interaction.values[0];
    const modalFn = modals[ticketType];

    if (modalFn) {
      await interaction.showModal(modalFn());
    }
  }

  // Button click - Close Ticket
  if (interaction.isButton() && interaction.customId.startsWith('close_ticket_')) {
    const thread = interaction.channel;

    // Get assignees from the ticket embed
    const messages = await thread.messages.fetch({ limit: 5 });
    const ticketMessage = messages.find((m) => m.embeds.length > 0 && m.author.id === interaction.client.user.id);

    let assigneeIds = [];
    if (ticketMessage) {
      const assignedField = ticketMessage.embeds[0]?.fields?.find((f) => f.name === 'Assigned To');
      if (assignedField) {
        const mentionRegex = /<@!?(\d+)>/g;
        let match;
        while ((match = mentionRegex.exec(assignedField.value)) !== null) {
          assigneeIds.push(match[1]);
        }
      }
    }

    if (assigneeIds.length === 0) {
      // No assignees, just close
      await interaction.reply({ content: 'Closing ticket...', flags: MessageFlags.Ephemeral });
      await thread.setArchived(true);
      return;
    }

    // Store pending feedback for multiple assignees
    const feedbackId = Date.now().toString(36);
    const ticketData = activeTickets.get(thread.id);
    pendingTickets.set(`feedback_${feedbackId}`, {
      threadId: thread.id,
      threadName: thread.name,
      ticketId: ticketData?.ticketId || null,
      assigneeIds,
      currentIndex: 0,
      userId: interaction.user.id,
    });

    // Show modal for first assignee
    const firstAssignee = await interaction.guild.members.fetch(assigneeIds[0]).catch(() => null);
    const assigneeName = firstAssignee?.displayName || 'Staff';

    const { createFeedbackModal } = require('./modals/ticketModals');
    await interaction.showModal(createFeedbackModal(feedbackId, assigneeIds[0], assigneeName, 1, assigneeIds.length));
  }

  // Button click - Next Feedback
  if (interaction.isButton() && interaction.customId.startsWith('next_feedback_')) {
    const parts = interaction.customId.split('_');
    const feedbackId = parts[2];
    const assigneeId = parts[3];

    const pendingFeedback = pendingTickets.get(`feedback_${feedbackId}`);
    if (!pendingFeedback) {
      await interaction.reply({ content: 'Feedback session expired.', flags: MessageFlags.Ephemeral });
      return;
    }

    const assignee = await interaction.guild.members.fetch(assigneeId).catch(() => null);
    const assigneeName = assignee?.displayName || 'Staff';

    const { createFeedbackModal } = require('./modals/ticketModals');
    await interaction.showModal(createFeedbackModal(
      feedbackId,
      assigneeId,
      assigneeName,
      pendingFeedback.currentIndex + 1,
      pendingFeedback.assigneeIds.length
    ));
  }

  // Modal submissions
  if (interaction.isModalSubmit()) {
    const modalId = interaction.customId;

    // Individual feedback modal submission
    if (modalId.startsWith('modal_feedback_')) {
      const parts = modalId.split('_');
      const feedbackId = parts[2];
      const assigneeId = parts[3];

      const pendingFeedback = pendingTickets.get(`feedback_${feedbackId}`);
      if (!pendingFeedback) {
        await interaction.reply({ content: 'Feedback session expired.', flags: MessageFlags.Ephemeral });
        return;
      }

      const rating = interaction.fields.getTextInputValue('rating');
      const feedback = interaction.fields.getTextInputValue('feedback');

      // Get assignee name for database
      const assignee = await interaction.guild.members.fetch(assigneeId).catch(() => null);
      const assigneeName = assignee?.displayName || assignee?.user.username || 'Staff';

      // Insert feedback into database
      try {
        await db.insertRow('purchasing_ticket_feedbacks', {
          ticket_id: pendingFeedback.ticketId,
          assignee_id: assigneeId,
          assignee_name: assigneeName,
          rating: parseInt(rating) || 1,
          feedback: feedback || null,
          submitted_by: interaction.user.id,
          submitted_by_name: interaction.user.displayName || interaction.user.username,
          created_at: db.getWibTime(),
        });
      } catch (err) {
        console.error('Failed to insert feedback into database:', err.message);
      }

      // Send feedback for this assignee
      const feedbackChannel = interaction.guild.channels.cache.get(process.env.CHANNEL_FEEDBACK);
      if (feedbackChannel) {
        const feedbackEmbed = new EmbedBuilder()
          .setTitle('Ticket Feedback')
          .setColor(0x808080)
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .addFields(
            { name: 'Thread', value: pendingFeedback.threadName, inline: true },
            { name: 'Assigned To', value: `<@${assigneeId}>`, inline: true },
            { name: 'Rating', value: `${'⭐'.repeat(parseInt(rating) || 0)} (${rating}/5)`, inline: true },
            { name: 'Feedback', value: feedback || 'No feedback provided' }
          )
          .setTimestamp();
        await feedbackChannel.send({ embeds: [feedbackEmbed] });
      }

      // Move to next assignee
      pendingFeedback.currentIndex++;

      if (pendingFeedback.currentIndex < pendingFeedback.assigneeIds.length) {
        // Show button to rate next assignee
        const nextAssigneeId = pendingFeedback.assigneeIds[pendingFeedback.currentIndex];
        const nextAssignee = await interaction.guild.members.fetch(nextAssigneeId).catch(() => null);
        const nextName = nextAssignee?.displayName || 'Staff';

        const nextButton = new ButtonBuilder()
          .setCustomId(`next_feedback_${feedbackId}_${nextAssigneeId}`)
          .setLabel(`Rate ${nextName} (${pendingFeedback.currentIndex + 1}/${pendingFeedback.assigneeIds.length})`)
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(nextButton);

        await interaction.reply({
          content: `Feedback submitted! Click below to rate the next staff member.`,
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        // All feedback collected, close the thread
        pendingTickets.delete(`feedback_${feedbackId}`);

        const thread = interaction.channel;

        await interaction.reply({ content: 'Thank you for your feedback! Closing ticket...', flags: MessageFlags.Ephemeral });

        // Update ticket status in database
        try {
          await db.updateRows('purchasing_tickets',
            { id: pendingFeedback.ticketId },
            { status: 'closed', closed_at: db.getWibTime() }
          );
        } catch (err) {
          console.error('Failed to update ticket status:', err.message);
        }

        // Remove all members from thread (except bot)
        const members = await thread.members.fetch();
        for (const [memberId] of members) {
          if (memberId !== interaction.client.user.id) {
            await thread.members.remove(memberId).catch(() => {});
          }
        }

        // Archive the thread
        await thread.setArchived(true);

        // Remove from active cache
        activeTickets.delete(thread.id);
      }
      return;
    }

    // Ticket creation modals
    const fields = {};
    interaction.fields.fields.forEach((field) => {
      fields[field.customId] = field.value;
    });

    // Get users for this ticket type
    const staffMembers = new Map();

    // Check for direct user IDs first
    const userIds = TICKET_USERS[modalId] || [];
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) {
        staffMembers.set(member.id, member);
      }
    }

    // Check for role IDs
    const roleIds = TICKET_ROLES[modalId] || [];
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

    // If still empty from roles, try fetching
    if (staffMembers.size === 0 && roleIds.length > 0) {
      try {
        const fetched = await interaction.guild.members.fetch({ limit: 100 });
        for (const roleId of roleIds) {
          fetched.filter((m) => m.roles.cache.has(roleId) && !m.user.bot)
            .forEach((member) => staffMembers.set(member.id, member));
        }
      } catch (e) {
        console.log('Member fetch failed:', e.message);
      }
    }

    if (staffMembers.size === 0) {
      await interaction.reply({ content: 'No staff available for this ticket type. Try again later.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Store pending ticket data
    const ticketId = Date.now().toString(36);
    pendingTickets.set(ticketId, {
      modalId,
      fields,
      userId: interaction.user.id,
      user: interaction.user,
      guildId: interaction.guild.id,
    });

    // Create user select menu
    const options = Array.from(staffMembers.values())
      .slice(0, 25) // Discord max 25 options
      .map((member) => ({
        label: member.displayName,
        value: member.id,
        description: member.user.tag,
      }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`assign_ticket_${ticketId}`)
      .setPlaceholder('Select staff to assign...')
      .setMinValues(1)
      .setMaxValues(Math.min(options.length, 10))
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: 'Select staff to assign to this ticket:',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  // User assignment select menu
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('assign_ticket_')) {
    const ticketId = interaction.customId.replace('assign_ticket_', '');
    const ticketData = pendingTickets.get(ticketId);

    if (!ticketData) {
      await interaction.reply({ content: 'Ticket expired. Please create a new one.', flags: MessageFlags.Ephemeral });
      return;
    }

    pendingTickets.delete(ticketId);

    // Defer the reply immediately to prevent interaction timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { modalId, fields, user } = ticketData;
    const assignedUserIds = interaction.values;

    const embed = createTicketEmbed(modalId, fields, user);
    const channelId = getChannelForTicket(modalId);
    const targetChannel = interaction.guild.channels.cache.get(channelId);

    if (!targetChannel) {
      await interaction.editReply({ content: 'Target channel not found' });
      return;
    }

    // Create thread name
    const typeShort = {
      modal_eta_ppo: 'ETA',
      modal_eta_ureq: 'ETA-UREQ',
      modal_restock: 'RESTOCK',
      modal_revive: 'REVIVE',
      modal_new_item: 'NEW',
      modal_kompen: 'KOMPEN',
    };
    const nameParts = [typeShort[modalId]];
    if (fields.item_id) nameParts.push(fields.item_id);
    if (fields.order_id) nameParts.push(fields.order_id);
    nameParts.push(user.username);
    const threadName = nameParts.join('-').substring(0, 100);

    // Create thread
    const thread = await targetChannel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440,
      reason: `Ticket by ${user.tag}`,
    });

    // Insert into database using thread ID as the primary key
    const ticketDbData = {
      id: thread.id,
      type: modalId.replace('modal_', ''),
      status: 'open',
      priority: fields.priority?.toLowerCase() === 'urgent' ? 'urgent' : 'normal',
      item_id: fields.item_id ? parseInt(fields.item_id) : null,
      order_id: fields.order_id ? parseInt(fields.order_id) : null,
      notes: fields.notes || null,
      created_by: user.id,
      created_by_name: user.displayName || user.username,
      assigned_to: JSON.stringify(assignedUserIds.map(id => ({ id, name: '' }))),
    };

    // Remove null fields that might cause API issues
    if (!ticketDbData.item_id) delete ticketDbData.item_id;
    if (!ticketDbData.order_id) delete ticketDbData.order_id;
    if (!ticketDbData.notes) delete ticketDbData.notes;
    if (!ticketDbData.priority) delete ticketDbData.priority;

    try {
      await db.insertRow('purchasing_tickets', ticketDbData);
    } catch (err) {
      console.error('Failed to insert ticket into database:', err.message);
    }

    // Cache the ticket data
    activeTickets.set(thread.id, {
      ticketId: thread.id,
      ...ticketDbData,
    });

    // Add assigned staff to embed
    const assignedMentions = assignedUserIds.map((id) => `<@${id}>`).join(', ');
    embed.addFields({ name: 'Assigned To', value: assignedMentions });

    const closeButton = new ButtonBuilder()
      .setCustomId(`close_ticket_${user.id}`)
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    await thread.send({ embeds: [embed], components: [row] });

    // Add ticket creator and assigned users to thread
    await thread.members.add(user.id);
    for (const userId of assignedUserIds) {
      await thread.members.add(userId).catch(() => {});
    }

    await interaction.editReply({
      content: `Ticket created: ${thread}`,
      components: [],
    });
  }
});

function createTicketEmbed(modalId, fields, user) {
  const typeLabels = {
    modal_eta_ppo: 'ETA (PPO/PST)',
    modal_eta_ureq: 'ETA (UREQ)',
    modal_restock: 'Restock',
    modal_revive: 'Revive',
    modal_new_item: 'New Item',
    modal_kompen: 'Kompensasi',
  };

  const embed = new EmbedBuilder()
    .setTitle(`Ticket: ${typeLabels[modalId] || 'Unknown'}`)
    .setColor(fields.priority?.toLowerCase() === 'urgent' ? 0xff0000 : 0x00ff00)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setTimestamp();

  if (fields.priority) embed.addFields({ name: 'Priority', value: fields.priority, inline: true });
  if (fields.item_id) embed.addFields({ name: 'Item ID', value: fields.item_id, inline: true });
  if (fields.order_id) embed.addFields({ name: 'Order ID', value: fields.order_id, inline: true });
  if (fields.link) embed.addFields({ name: 'Link', value: fields.link });
  if (fields.notes) embed.addFields({ name: 'Notes', value: fields.notes });

  return embed;
}

function getChannelForTicket(modalId) {
  const channelMap = {
    modal_eta_ppo: process.env.CHANNEL_PPO,
    modal_eta_ureq: process.env.CHANNEL_UREQ,
    modal_restock: process.env.CHANNEL_PPO,
    modal_revive: process.env.CHANNEL_PPO,
    modal_new_item: process.env.CHANNEL_PPO,
    modal_kompen: process.env.CHANNEL_KOMPEN,
  };
  return channelMap[modalId];
}

/**
 * Restore close buttons on existing open tickets
 * Fetches open tickets from database and re-renders buttons on their messages
 */
async function restoreButtons(client) {
  console.log('Restoring buttons on existing tickets...');

  try {
    // Fetch open tickets from database
    const { data: tickets } = await db.getData('purchasing_tickets', { limit: 100 });

    if (!tickets || tickets.length === 0) {
      console.log('No open tickets found');
      return;
    }

    let restored = 0;

    for (const ticket of tickets) {
      if (ticket.status !== 'open') continue;

      // Try to find the channel
      const channelId = getChannelForTicket(`modal_${ticket.type}`);
      if (!channelId) continue;

      const channel = client.channels.cache.get(channelId);
      if (!channel) continue;

      try {
        // Try to fetch the thread by ID (since ticket.id is the thread ID)
        let thread = await channel.threads.fetch(ticket.id).catch(() => null);

        // If not found directly, search active threads
        if (!thread) {
          const activeThreads = await channel.threads.fetchActive();
          thread = activeThreads.threads.get(ticket.id);
        }

        if (!thread || thread.archived) {
          // Update status in database if archived
          if (thread?.archived) {
            await db.updateRows('purchasing_tickets', { id: ticket.id }, { status: 'closed' });
          }
          continue;
        }

        // Cache the ticket
        activeTickets.set(thread.id, {
          ticketId: ticket.id,
          type: ticket.type,
          status: ticket.status,
          priority: ticket.priority,
          created_by: ticket.created_by,
          assigned_to: ticket.assigned_to,
        });

        // Fetch messages and find the ticket message
        const messages = await thread.messages.fetch({ limit: 5 });
        const ticketMessage = messages.find((m) => m.embeds.length > 0 && m.author.id === client.user.id);

        if (ticketMessage) {
          // Re-render the message with the close button
          const closeButton = new ButtonBuilder()
            .setCustomId(`close_ticket_${ticket.created_by}`)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger);

          const row = new ActionRowBuilder().addComponents(closeButton);

          await ticketMessage.edit({
            embeds: ticketMessage.embeds,
            components: [row],
          });

          restored++;
          console.log(`Restored button on ticket ${ticket.id}`);
        }
      } catch (err) {
        console.error(`Error restoring ticket ${ticket.id}:`, err.message);
      }
    }

    console.log(`Restored ${restored} ticket buttons`);
  } catch (err) {
    console.error('Failed to restore buttons:', err.message);
  }
}

client.login(process.env.DISCORD_TOKEN);

// Error handlers to prevent crashes
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.on('error', error => {
  console.error('Discord client error:', error);
});
