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

const ticketCommand = require('./commands/purchasing-ticket');
const mulmedCommand = require('./commands/multimedia-ticket');
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
  modal_eta_ppo: [],
  modal_eta_ureq: [],
  modal_revive: [],
  modal_restock: [],
  // Digital Design
  mulmed_announcement: ['1480109703408390237'],
  mulmed_other: ['1480109703408390237'],
  // Single Printing
  mulmed_store_design: ['1480109703408390237'],
  mulmed_standee: ['1480109703408390237'],
  mulmed_banner: ['1480109703408390237'],
  mulmed_wallpaper: ['1480109703408390237'],
  mulmed_other_print: ['1480109703408390237'],
  // Offset Printing
  mulmed_brosur: ['1480109703408390237'],
  mulmed_kipas: ['1480109703408390237'],
  mulmed_postcard: ['1480109703408390237'],
  mulmed_sticker: ['1480109703408390237'],
  mulmed_paper_bag: ['1480109703408390237'],
  mulmed_dus_kyou: ['1480109703408390237'],
  mulmed_other_offset: ['1480109703408390237'],
  // Promotional Design
  mulmed_thematic_sale: ['1480109703408390237'],
  mulmed_sp_sale: ['1480109703408390237'],
  mulmed_campaign: ['1480109703408390237'],
  mulmed_give_away: ['1480109703408390237'],
  // Event Design
  mulmed_event: ['1480109703408390237'],
  mulmed_project: ['1480109703408390237'],
};

// User IDs for specific ticket types (not roles)
const TICKET_USERS = {
  // Purchasing tickets
  modal_eta_ppo: ['1317666401473007686'],
  modal_eta_ureq: ['1317666401473007686'],
  modal_revive: ['1317666401473007686'],
  modal_restock: ['1317666401473007686'],
  modal_kompen: ['1317666401473007686'],
  modal_new_item_preorder: ['1317666401473007686'],
  // Multimedia tickets - direct user assignments
  mulmed_kolase: ['1317666401473007686'],
  mulmed_singpost: ['1317666401473007686', '896347272307154955'],
  mulmed_monthly_design: ['1317666401473007686', '896347272307154955'],
};

// Special notes for multimedia tickets indicating which team members should handle each ticket type
const TICKET_SPECIAL_NOTES = {
  // Digital Design
  mulmed_announcement: 'Yudha & Farel',
  // Single Printing
  mulmed_store_design: 'Farel & Yudha',
  mulmed_standee: 'Yudha & Farel',
  mulmed_banner: 'Yudha & Farel',
  mulmed_wallpaper: 'Yudha & Farel',
  // Offset Printing
  mulmed_brosur: 'Farel & Yudha',
  mulmed_kipas: 'Farel & Yudha',
  mulmed_postcard: 'Farel & Yudha',
  mulmed_sticker: 'Farel & Yudha',
  mulmed_paper_bag: 'Farel & Yudha',
  mulmed_dus_kyou: 'Yudha & Farel',
  // Promotional Design
  mulmed_thematic_sale: 'Fatur & Tegar',
  mulmed_campaign: 'Fatur & Tegar',
  mulmed_give_away: 'Farel & Fatur',
};

client.commands = new Collection();
client.commands.set(ticketCommand.data.name, ticketCommand);
client.commands.set(mulmedCommand.data.name, mulmedCommand);

// Register slash commands
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const commands = [ticketCommand.data.toJSON(), mulmedCommand.data.toJSON()];

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

  // Select menu - Ticket type selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_select') {
    const ticketType = interaction.values[0];
    const modalId = `modal_${ticketType}`;
    const modalFn = modals[ticketType];

    if (modalFn) {
      // Fetch staff members for this ticket type
      const staffMembers = new Map();

      const userIds = TICKET_USERS[modalId] || [];
      for (const userId of userIds) {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && !member.user.bot) {
          staffMembers.set(member.id, member);
        }
      }

      const roleIds = TICKET_ROLES[modalId] || [];
      for (const roleId of roleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role && role.members.size > 0) {
          role.members.forEach((member) => {
            if (!member.user.bot) staffMembers.set(member.id, member);
          });
        }
      }

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

      // Convert to options for select menu
      const staffOptions = Array.from(staffMembers.values())
        .slice(0, 25)
        .map((member) => ({
          label: member.displayName,
          value: member.id,
          description: member.user.tag,
        }));

      // Get special note for this ticket type (strip 'modal_' prefix)
      const ticketTypeKey = ticketType.startsWith('mulmed_') ? ticketType : null;
      const specialNote = ticketTypeKey ? TICKET_SPECIAL_NOTES[ticketTypeKey] || null : null;

      await interaction.showModal(modalFn(staffOptions, specialNote));
    }
  }

  // Select menu - Multimedia ticket type selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'mulmed_type_select') {
    const ticketType = interaction.values[0];

    // If Digital Design, show sub-type dropdown FIRST
    if (ticketType === 'digital_design') {
      const subOptions = [
        { label: 'Kolase', value: 'kolase', description: 'Collage design' },
        { label: 'Singpost', value: 'singpost', description: 'Singpost design' },
        { label: 'Announcement', value: 'announcement', description: 'Announcement design' },
        { label: 'Monthly Design', value: 'monthly_design', description: 'Monthly design' },
        { label: 'Other', value: 'other', description: 'Other digital design' },
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mulmed_digital_subtype_select')
        .setPlaceholder('Select sub type...')
        .addOptions(subOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.update({
        content: 'Select the type of digital design:',
        components: [row],
      });
      return;
    }

    // If Single Printing, show sub-type dropdown FIRST
    if (ticketType === 'single_printing') {
      const subOptions = [
        { label: 'Store Design', value: 'store_design', description: 'Store design request' },
        { label: 'Standee', value: 'standee', description: 'Standee design request' },
        { label: 'Banner', value: 'banner', description: 'Banner design request' },
        { label: 'Wallpaper', value: 'wallpaper', description: 'Wallpaper design request' },
        { label: 'Other', value: 'other_print', description: 'Other single printing request' },
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mulmed_single_subtype_select')
        .setPlaceholder('Select sub type...')
        .addOptions(subOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.update({
        content: 'Select the type of single printing:',
        components: [row],
      });
      return;
    }

    // If Offset Printing, show sub-type dropdown FIRST
    if (ticketType === 'offset_printing') {
      const subOptions = [
        { label: 'Brosur', value: 'brosur', description: 'Brosur request' },
        { label: 'Kipas', value: 'kipas', description: 'Kipas request' },
        { label: 'Postcard', value: 'postcard', description: 'Postcard request' },
        { label: 'Sticker', value: 'sticker', description: 'Sticker request' },
        { label: 'Paper Bag', value: 'paper_bag', description: 'Paper bag request' },
        { label: 'Dus Kyou', value: 'dus_kyou', description: 'Dus Kyou request' },
        { label: 'Other', value: 'other_offset', description: 'Other offset printing request' },
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mulmed_offset_subtype_select')
        .setPlaceholder('Select sub type...')
        .addOptions(subOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.update({
        content: 'Select the type of offset printing:',
        components: [row],
      });
      return;
    }

    // If Promotional Design, show sub-type dropdown FIRST
    if (ticketType === 'promotional_design') {
      const subOptions = [
        { label: 'Thematic Sale', value: 'thematic_sale', description: 'Thematic sale request' },
        { label: 'SP Sale', value: 'sp_sale', description: 'SP sale request' },
        { label: 'Campaign', value: 'campaign', description: 'Campaign request' },
        { label: 'Give Away', value: 'give_away', description: 'Give away request' },
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mulmed_promo_subtype_select')
        .setPlaceholder('Select sub type...')
        .addOptions(subOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.update({
        content: 'Select the type of promotional design:',
        components: [row],
      });
      return;
    }

    // If Event Design, show sub-type dropdown FIRST
    if (ticketType === 'event_design') {
      const subOptions = [
        { label: 'Event', value: 'event', description: 'Event request' },
        { label: 'Project', value: 'project', description: 'Project request' },
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mulmed_event_subtype_select')
        .setPlaceholder('Select sub type...')
        .addOptions(subOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.update({
        content: 'Select the type of event design:',
        components: [row],
      });
      return;
    }

    // For other types, check if modal exists
    const modalFn = modals[ticketType];

    if (modalFn) {
      // Fetch staff members for this ticket type
      const staffMembers = new Map();

      const userIds = TICKET_USERS[`mulmed_${ticketType}`] || [];
      for (const userId of userIds) {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && !member.user.bot) {
          staffMembers.set(member.id, member);
        }
      }

      // Convert to options for select menu
      const staffOptions = Array.from(staffMembers.values())
        .slice(0, 25)
        .map((member) => ({
          label: member.displayName,
          value: member.id,
          description: member.user.tag,
        }));

      await interaction.showModal(modalFn(staffOptions));
    } else {
      // For unknown types
      await interaction.update({
        content: `Unknown ticket type: **${ticketType}**`,
        components: [],
      });
    }
  }

  // Select menu - Digital Design sub-type selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'mulmed_digital_subtype_select') {
    const subType = interaction.values[0];
    const modalFn = modals[subType];

    if (!modalFn) {
      await interaction.update({
        content: `Unknown sub-type: **${subType}**`,
        components: [],
      });
      return;
    }

    // Fetch staff members for this sub-type
    const staffMembers = new Map();

    const userIds = TICKET_USERS[`mulmed_${subType}`] || [];
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) {
        staffMembers.set(member.id, member);
      }
    }

    // Fetch from roles - ALWAYS fetch to get all members
    const roleIds = TICKET_ROLES[`mulmed_${subType}`] || [];

    // First, try to get from cache
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

    // Then, always fetch to make sure we have all members (not just cached ones)
    if (roleIds.length > 0) {
      try {
        await interaction.guild.members.fetch({ limit: 100 });
        // After fetch, check cache again for role members
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) {
            role.members.forEach((member) => {
              if (!member.user.bot) staffMembers.set(member.id, member);
            });
          }
        }
      } catch (e) {
        console.log('Member fetch failed:', e.message);
      }
    }

    // Convert to options for select menu
    const staffOptions = Array.from(staffMembers.values())
      .slice(0, 25)
      .map((member) => ({
        label: member.displayName,
        value: member.id,
        description: member.user.tag,
      }));

    // Store sub_type in interaction for later use
    interaction.mulmedSubType = subType;

    await interaction.showModal(modalFn(staffOptions));
  }

  // Select menu - Single Printing sub-type selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'mulmed_single_subtype_select') {
    const subType = interaction.values[0];
    const modalFn = modals[subType];

    if (!modalFn) {
      await interaction.update({
        content: `Unknown sub-type: **${subType}**`,
        components: [],
      });
      return;
    }

    // Fetch staff members for this sub-type
    const staffMembers = new Map();

    const userIds = TICKET_USERS[`mulmed_${subType}`] || [];
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) {
        staffMembers.set(member.id, member);
      }
    }

    // Fetch from roles - ALWAYS fetch to get all members
    const roleIds = TICKET_ROLES[`mulmed_${subType}`] || [];

    // First, try to get from cache
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

    // Then, always fetch to make sure we have all members (not just cached ones)
    if (roleIds.length > 0) {
      try {
        await interaction.guild.members.fetch({ limit: 100 });
        // After fetch, check cache again for role members
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) {
            role.members.forEach((member) => {
              if (!member.user.bot) staffMembers.set(member.id, member);
            });
          }
        }
      } catch (e) {
        console.log('Member fetch failed:', e.message);
      }
    }

    // Convert to options for select menu
    const staffOptions = Array.from(staffMembers.values())
      .slice(0, 25)
      .map((member) => ({
        label: member.displayName,
        value: member.id,
        description: member.user.tag,
      }));

    // Store sub_type in interaction for later use
    interaction.mulmedSubType = subType;

    await interaction.showModal(modalFn(staffOptions));
  }

  // Select menu - Offset Printing sub-type selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'mulmed_offset_subtype_select') {
    const subType = interaction.values[0];
    const modalFn = modals[subType];

    if (!modalFn) {
      await interaction.update({
        content: `Unknown sub-type: **${subType}**`,
        components: [],
      });
      return;
    }

    // Fetch staff members for this sub-type
    const staffMembers = new Map();

    const userIds = TICKET_USERS[`mulmed_${subType}`] || [];
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) {
        staffMembers.set(member.id, member);
      }
    }

    // Fetch from roles - ALWAYS fetch to get all members
    const roleIds = TICKET_ROLES[`mulmed_${subType}`] || [];

    // First, try to get from cache
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

    // Then, always fetch to make sure we have all members (not just cached ones)
    if (roleIds.length > 0) {
      try {
        await interaction.guild.members.fetch({ limit: 100 });
        // After fetch, check cache again for role members
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) {
            role.members.forEach((member) => {
              if (!member.user.bot) staffMembers.set(member.id, member);
            });
          }
        }
      } catch (e) {
        console.log('Member fetch failed:', e.message);
      }
    }

    // Convert to options for select menu
    const staffOptions = Array.from(staffMembers.values())
      .slice(0, 25)
      .map((member) => ({
        label: member.displayName,
        value: member.id,
        description: member.user.tag,
      }));

    // Store sub_type in interaction for later use
    interaction.mulmedSubType = subType;

    await interaction.showModal(modalFn(staffOptions));
  }

  // Select menu - Promotional Design sub-type selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'mulmed_promo_subtype_select') {
    const subType = interaction.values[0];
    const modalFn = modals[subType];

    if (!modalFn) {
      await interaction.update({
        content: `Unknown sub-type: **${subType}**`,
        components: [],
      });
      return;
    }

    // Fetch staff members for this sub-type
    const staffMembers = new Map();

    const userIds = TICKET_USERS[`mulmed_${subType}`] || [];
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) {
        staffMembers.set(member.id, member);
      }
    }

    // Fetch from roles - ALWAYS fetch to get all members
    const roleIds = TICKET_ROLES[`mulmed_${subType}`] || [];

    // First, try to get from cache
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

    // Then, always fetch to make sure we have all members (not just cached ones)
    if (roleIds.length > 0) {
      try {
        await interaction.guild.members.fetch({ limit: 100 });
        // After fetch, check cache again for role members
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) {
            role.members.forEach((member) => {
              if (!member.user.bot) staffMembers.set(member.id, member);
            });
          }
        }
      } catch (e) {
        console.log('Member fetch failed:', e.message);
      }
    }

    // Convert to options for select menu
    const staffOptions = Array.from(staffMembers.values())
      .slice(0, 25)
      .map((member) => ({
        label: member.displayName,
        value: member.id,
        description: member.user.tag,
      }));

    // Store sub_type in interaction for later use
    interaction.mulmedSubType = subType;

    await interaction.showModal(modalFn(staffOptions));
  }

  // Select menu - Event Design sub-type selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'mulmed_event_subtype_select') {
    const subType = interaction.values[0];
    const modalFn = modals[subType];

    if (!modalFn) {
      await interaction.update({
        content: `Unknown sub-type: **${subType}**`,
        components: [],
      });
      return;
    }

    // Fetch staff members for this sub-type
    const staffMembers = new Map();

    const userIds = TICKET_USERS[`mulmed_${subType}`] || [];
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) {
        staffMembers.set(member.id, member);
      }
    }

    // Fetch from roles - ALWAYS fetch to get all members
    const roleIds = TICKET_ROLES[`mulmed_${subType}`] || [];

    // First, try to get from cache
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

    // Then, always fetch to make sure we have all members (not just cached ones)
    if (roleIds.length > 0) {
      try {
        await interaction.guild.members.fetch({ limit: 100 });
        // After fetch, check cache again for role members
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) {
            role.members.forEach((member) => {
              if (!member.user.bot) staffMembers.set(member.id, member);
            });
          }
        }
      } catch (e) {
        console.log('Member fetch failed:', e.message);
      }
    }

    // Convert to options for select menu
    const staffOptions = Array.from(staffMembers.values())
      .slice(0, 25)
      .map((member) => ({
        label: member.displayName,
        value: member.id,
        description: member.user.tag,
      }));

    // Store sub_type in interaction for later use
    interaction.mulmedSubType = subType;

    await interaction.showModal(modalFn(staffOptions));
  }

  // Button click - Edit Assignee
  if (interaction.isButton() && interaction.customId.startsWith('edit_assignee_')) {
    const threadId = interaction.customId.replace('edit_assignee_', '');
    const thread = interaction.channel;

    // Get ticket info to validate creator
    const messages = await thread.messages.fetch({ limit: 20 });
    const ticketMessage = messages.find((m) =>
      m.author.id === interaction.client.user.id &&
      m.embeds.length > 0 &&
      m.embeds[0]?.fields?.some(f => f.name === 'Ticket ID')
    );

    if (!ticketMessage) {
      await interaction.reply({ content: 'Could not find ticket message.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Get ticket creator from embed or cache
    const creatorId = ticketMessage.embeds[0]?.author?.name?.match(/\((\d+)\)$/)?.[1] ||
      activeTickets.get(thread.id)?.created_by;

    // Get assigned users from ticket embed
    const assignedField = ticketMessage.embeds[0]?.fields?.find((f) => f.name === 'Assigned To');
    const assignedUserIds = [];
    if (assignedField) {
      const mentionRegex = /<@!?(\d+)>/g;
      let match;
      while ((match = mentionRegex.exec(assignedField.value)) !== null) {
        assignedUserIds.push(match[1]);
      }
    }

    // Check if this is a multimedia ticket
    const isMultimediaTicket = ticketMessage.embeds[0]?.title?.includes('Multimedia Ticket');

    if (isMultimediaTicket) {
      // Allow creator or assigned staff to edit for multimedia tickets
      const isCreator = creatorId && interaction.user.id === creatorId;
      const isAssignee = assignedUserIds.includes(interaction.user.id);

      if (!isCreator && !isAssignee) {
        await interaction.reply({
          content: '❌ Only the ticket creator or assigned staff can edit assignees.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    } else {
      // Original behavior for purchasing tickets - only creator can edit
      if (creatorId && interaction.user.id !== creatorId) {
        await interaction.reply({
          content: '❌ Only the ticket creator can edit assignees.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // Get ticket type from title
    const embedTitle = ticketMessage.embeds[0]?.title || '';
    let modalId = null;
    if (embedTitle.includes('PPO') || embedTitle.includes('PST')) modalId = 'modal_eta_ppo';
    else if (embedTitle.includes('UREQ') && embedTitle.includes('ETA')) modalId = 'modal_eta_ureq';
    else if (embedTitle.includes('Restock')) modalId = 'modal_restock';
    else if (embedTitle.includes('Revive')) modalId = 'modal_revive';
    else if (embedTitle.includes('Pre-order')) modalId = 'modal_new_item_preorder';
    else if (embedTitle.includes('Kompensasi')) modalId = 'modal_kompen';

    // Fetch staff members
    const staffMembers = new Map();

    const userIds = TICKET_USERS[modalId] || [];
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) {
        staffMembers.set(member.id, member);
      }
    }

    const roleIds = TICKET_ROLES[modalId] || [];
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

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
      await interaction.reply({ content: 'No staff available.', flags: MessageFlags.Ephemeral });
      return;
    }

    const options = Array.from(staffMembers.values())
      .slice(0, 25)
      .map((member) => ({
        label: member.displayName,
        value: member.id,
        description: member.user.tag,
      }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`update_assignee_${threadId}`)
      .setPlaceholder('Select new assignee...')
      .setMinValues(1)
      .setMaxValues(Math.min(options.length, 10))
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: 'Select new assignee(s) for this ticket:',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  // Button click - Close Ticket
  if (interaction.isButton() && interaction.customId.startsWith('close_ticket_')) {
    const thread = interaction.channel;

    // Extract creator ID from button custom ID
    const creatorId = interaction.customId.replace('close_ticket_', '');

    // Check if the user is the ticket creator
    if (creatorId && interaction.user.id !== creatorId) {
      await interaction.reply({
        content: '❌ Only the ticket creator can close this ticket.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get assignees from the ticket embed
    const messages = await thread.messages.fetch({ limit: 20 });
    const ticketMessage = messages.find((m) =>
      m.author.id === interaction.client.user.id &&
      m.embeds.length > 0 &&
      m.embeds[0]?.fields?.some(f => f.name === 'Ticket ID')
    );

    let assigneeIds = [];
    let ticketIdFromEmbed = null;

    // Debug
    console.log('Close ticket - ticketMessage found:', !!ticketMessage);

    if (ticketMessage) {
      console.log('Embed fields:', ticketMessage.embeds[0]?.fields?.map(f => f.name));
      const assignedField = ticketMessage.embeds[0]?.fields?.find((f) => f.name === 'Assigned To');
      console.log('Assigned To field:', assignedField?.value);
      if (assignedField) {
        const mentionRegex = /<@!?(\d+)>/g;
        let match;
        while ((match = mentionRegex.exec(assignedField.value)) !== null) {
          assigneeIds.push(match[1]);
        }
      }
      // Get ticket ID from embed
      const ticketIdField = ticketMessage.embeds[0]?.fields?.find((f) => f.name === 'Ticket ID');
      if (ticketIdField) {
        ticketIdFromEmbed = ticketIdField.value;
      }
    }

    console.log('Assignee IDs found:', assigneeIds);

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
      ticketId: ticketIdFromEmbed || ticketData?.ticketId || thread.id,
      ticketType: ticketData?.type || '',
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
      await interaction.reply({ content: 'Feedback session expired. Closing ticket...', flags: MessageFlags.Ephemeral });

      // Remove all members from thread and archive it
      const thread = interaction.channel;
      if (thread?.isThread()) {
        const members = await thread.members.fetch().catch(() => null);
        if (members) {
          for (const [memberId] of members) {
            if (memberId !== interaction.client.user.id) {
              await thread.members.remove(memberId).catch(() => { });
            }
          }
        }
        await thread.setArchived(true).catch(() => { });
        activeTickets.delete(thread.id);
      }
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
        await interaction.reply({ content: 'Feedback session expired. Closing ticket...', flags: MessageFlags.Ephemeral });

        // Remove all members from thread and archive it
        const thread = interaction.channel;
        if (thread?.isThread()) {
          const members = await thread.members.fetch().catch(() => null);
          if (members) {
            for (const [memberId] of members) {
              if (memberId !== interaction.client.user.id) {
                await thread.members.remove(memberId).catch(() => { });
              }
            }
          }
          await thread.setArchived(true).catch(() => { });
          activeTickets.delete(thread.id);
        }
        return;
      }

      // Get field values (rating is select menu, feedback is text input)
      const fields = {};
      interaction.fields.fields.forEach((field) => {
        // Type 3 = Select menu, Type 4 = Text input
        if (field.type === 3 && field.values) {
          fields[field.customId] = field.values[0];
        } else if (field.type === 4 && field.value !== undefined) {
          fields[field.customId] = field.value;
        }
      });

      const rating = fields.rating;
      const feedback = fields.feedback || '';

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
      // Check if this is a multimedia ticket
      const isMulmed = pendingFeedback.ticketType?.startsWith('mulmed_') || false;
      const feedbackChannelId = isMulmed ? process.env.CHANNEL_FEEDBACKMULMED : process.env.CHANNEL_FEEDBACK;
      const feedbackChannel = interaction.guild.channels.cache.get(feedbackChannelId);
      if (feedbackChannel) {
        const threadUrl = `https://discord.com/channels/${interaction.guild.id}/${pendingFeedback.threadId}`;
        const feedbackEmbed = new EmbedBuilder()
          .setTitle('Purchasing-Ticket Feedback')
          .setColor(0x808080)
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .addFields(
            { name: 'Thread', value: `[${pendingFeedback.threadName}](${threadUrl})`, inline: true },
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
            await thread.members.remove(memberId).catch(() => { });
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
      // Type 3 = Select menu, Type 4 = Text input
      if (field.type === 3 && field.values) {
        // For assigned_to field, keep all values (multi-select)
        if (field.customId === 'assigned_to') {
          fields[field.customId] = field.values;
        } else {
          fields[field.customId] = field.values[0];
        }
      } else if (field.type === 4 && field.value !== undefined) {
        fields[field.customId] = field.value;
      }
    });

    // Add sub_type if it was stored (for digital design)
    if (interaction.mulmedSubType) {
      fields.sub_type = interaction.mulmedSubType;
    }

    // Check if staff was assigned in the modal
    if (!fields.assigned_to || fields.assigned_to.length === 0) {
      await interaction.reply({ content: 'Please select a staff member to assign.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Staff was selected in modal, create ticket directly
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const assignedUserIds = Array.isArray(fields.assigned_to) ? fields.assigned_to : [fields.assigned_to];
    const user = interaction.user;

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
      modal_new_item_preorder: 'NEW-PO',
      modal_kompen: 'KOMPEN',
      // Digital Design
      modal_mulmed_kolase: 'KOLASE',
      modal_mulmed_singpost: 'SINGPOST',
      modal_mulmed_announcement: 'ANNOUNCE',
      modal_mulmed_monthly_design: 'MONTHLY',
      modal_mulmed_other: 'OTHER-DIGI',
      // Single Printing
      modal_mulmed_store_design: 'STORE',
      modal_mulmed_standee: 'STANDEE',
      modal_mulmed_banner: 'BANNER',
      modal_mulmed_wallpaper: 'WALLPAPER',
      modal_mulmed_other_print: 'OTHER-PRINT',
      // Offset Printing
      modal_mulmed_brosur: 'BROSUR',
      modal_mulmed_kipas: 'KIPAS',
      modal_mulmed_postcard: 'POSTCARD',
      modal_mulmed_sticker: 'STICKER',
      modal_mulmed_paper_bag: 'PAPERBAG',
      modal_mulmed_dus_kyou: 'DUSKYOU',
      modal_mulmed_other_offset: 'OTHER-OFFSET',
      // Promotional Design
      modal_mulmed_thematic_sale: 'THEMATIC',
      modal_mulmed_sp_sale: 'SPSALE',
      modal_mulmed_campaign: 'CAMPAIGN',
      modal_mulmed_give_away: 'GIVEAWAY',
      // Event Design
      modal_mulmed_event: 'EVENT',
      modal_mulmed_project: 'PROJECT',
    };
    const nameParts = [typeShort[modalId] || 'TICKET'];
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
      brief: fields.brief || null,
      link: fields.link || null,
      size: fields.size || null,
      size_qty: fields.size_qty || null,
      size_placement: fields.size_placement || null,
      deadline_info: fields.deadline_info || null,
      additional_output: fields.additional_output || null,
      additional: fields.additional || null,
      created_by: user.id,
      created_by_name: user.displayName || user.username,
      assigned_to: JSON.stringify(assignedUserIds.map(id => ({ id, name: '' }))),
    };

    if (!ticketDbData.item_id) delete ticketDbData.item_id;
    if (!ticketDbData.order_id) delete ticketDbData.order_id;
    if (!ticketDbData.notes) delete ticketDbData.notes;
    if (!ticketDbData.priority) delete ticketDbData.priority;
    if (!ticketDbData.brief) delete ticketDbData.brief;
    if (!ticketDbData.link) delete ticketDbData.link;
    if (!ticketDbData.size) delete ticketDbData.size;
    if (!ticketDbData.size_qty) delete ticketDbData.size_qty;
    if (!ticketDbData.size_placement) delete ticketDbData.size_placement;
    if (!ticketDbData.deadline_info) delete ticketDbData.deadline_info;
    if (!ticketDbData.additional_output) delete ticketDbData.additional_output;
    if (!ticketDbData.additional) delete ticketDbData.additional;

    try {
      await db.insertRow('purchasing_tickets', ticketDbData);
    } catch (err) {
      console.error('Failed to insert ticket into database:', err.message);
    }

    activeTickets.set(thread.id, {
      ticketId: thread.id,
      ...ticketDbData,
    });

    // Add ticket ID and assigned staff to embed
    embed.addFields({ name: 'Ticket ID', value: thread.id, inline: true });
    const assignedMentions = assignedUserIds.map((id) => `<@${id}>`).join(', ');
    embed.addFields({ name: 'Assigned To', value: assignedMentions });

    const editButton = new ButtonBuilder()
      .setCustomId(`edit_assignee_${thread.id}`)
      .setLabel('Edit Assignee')
      .setStyle(ButtonStyle.Secondary);

    const closeButton = new ButtonBuilder()
      .setCustomId(`close_ticket_${user.id}`)
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(editButton, closeButton);

    await thread.send({ embeds: [embed], components: [row] });

    await thread.members.add(user.id);
    for (const userId of assignedUserIds) {
      await thread.members.add(userId).catch(() => { });
    }

    await interaction.editReply({
      content: `Ticket created: ${thread}`,
      components: [],
    });
  }

  // Update assignee select menu
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('update_assignee_')) {
    const threadId = interaction.customId.replace('update_assignee_', '');
    const thread = interaction.channel;
    const newAssigneeIds = interaction.values;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get ticket message - search more messages and look for ticket embed
    const messages = await thread.messages.fetch({ limit: 20 });
    const ticketMessage = messages.find((m) =>
      m.author.id === interaction.client.user.id &&
      m.embeds.length > 0 &&
      m.embeds[0]?.fields?.some(f => f.name === 'Ticket ID')
    );

    if (!ticketMessage) {
      await interaction.editReply({ content: 'Could not find ticket message.' });
      return;
    }

    // Get old assignees to remove from thread
    const oldAssigneeIds = [];
    const assignedField = ticketMessage.embeds[0]?.fields?.find((f) => f.name === 'Assigned To');
    if (assignedField) {
      const mentionRegex = /<@!?(\d+)>/g;
      let match;
      while ((match = mentionRegex.exec(assignedField.value)) !== null) {
        oldAssigneeIds.push(match[1]);
      }
    }

    // Get ticket creator from embed
    const creatorId = ticketMessage.embeds[0]?.author?.name?.match(/\((\d+)\)$/)?.[1] ||
      activeTickets.get(thread.id)?.created_by;

    // Update embed
    const oldEmbed = ticketMessage.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed);

    // Update Assigned To field
    const newAssignedMentions = newAssigneeIds.map((id) => `<@${id}>`).join(', ');
    const fieldIndex = newEmbed.data.fields?.findIndex((f) => f.name === 'Assigned To');
    if (fieldIndex !== -1) {
      newEmbed.data.fields[fieldIndex].value = newAssignedMentions;
    }

    // Recreate buttons
    const editButton = new ButtonBuilder()
      .setCustomId(`edit_assignee_${threadId}`)
      .setLabel('Edit Assignee')
      .setStyle(ButtonStyle.Secondary);

    const closeButton = new ButtonBuilder()
      .setCustomId(`close_ticket_${creatorId || interaction.user.id}`)
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(editButton, closeButton);

    await ticketMessage.edit({ embeds: [newEmbed], components: [row] });

    // Update database
    try {
      await db.updateRows('purchasing_tickets',
        { id: threadId },
        { assigned_to: JSON.stringify(newAssigneeIds.map(id => ({ id, name: '' }))) }
      );
    } catch (err) {
      console.error('Failed to update assignee in database:', err.message);
    }

    // Remove old assignees from thread (except if they're new assignees too)
    for (const oldId of oldAssigneeIds) {
      if (!newAssigneeIds.includes(oldId)) {
        await thread.members.remove(oldId).catch(() => { });
      }
    }

    // Add new assignees to thread
    for (const newId of newAssigneeIds) {
      await thread.members.add(newId).catch(() => { });
    }

    // Update active tickets cache
    const ticketData = activeTickets.get(thread.id);
    if (ticketData) {
      ticketData.assigned_to = JSON.stringify(newAssigneeIds.map(id => ({ id, name: '' })));
    }

    await interaction.editReply({ content: 'Assignee updated successfully!' });
  }
});

function createTicketEmbed(modalId, fields, user) {
  const typeLabels = {
    modal_eta_ppo: 'Purchasing Ticket - ETA (General)',
    modal_eta_ureq: 'Purchasing Ticket - ETA (UREQ)',
    modal_restock: 'Purchasing Ticket - Restock Request',
    modal_revive: 'Purchasing Ticket - Revive',
    modal_new_item_preorder: 'Purchasing Ticket - New DB Request',
    modal_kompen: 'Purchasing Ticket - Kompensasi',
    // Digital Design
    mulmed_kolase: 'Multimedia Ticket - Kolase',
    mulmed_singpost: 'Multimedia Ticket - Singpost',
    mulmed_announcement: 'Multimedia Ticket - Announcement',
    mulmed_monthly_design: 'Multimedia Ticket - Monthly Design',
    mulmed_other: 'Multimedia Ticket - Other',
    // Single Printing
    mulmed_store_design: 'Multimedia Ticket - Store Design',
    mulmed_standee: 'Multimedia Ticket - Standee',
    mulmed_banner: 'Multimedia Ticket - Banner',
    mulmed_wallpaper: 'Multimedia Ticket - Wallpaper',
    mulmed_other_print: 'Multimedia Ticket - Other Printing',
    // Offset Printing
    mulmed_brosur: 'Multimedia Ticket - Brosur',
    mulmed_kipas: 'Multimedia Ticket - Kipas',
    mulmed_postcard: 'Multimedia Ticket - Postcard',
    mulmed_sticker: 'Multimedia Ticket - Sticker',
    mulmed_paper_bag: 'Multimedia Ticket - Paper Bag',
    mulmed_dus_kyou: 'Multimedia Ticket - Dus Kyou',
    mulmed_other_offset: 'Multimedia Ticket - Other Offset',
    // Promotional Design
    mulmed_thematic_sale: 'Multimedia Ticket - Thematic Sale',
    mulmed_sp_sale: 'Multimedia Ticket - SP Sale',
    mulmed_campaign: 'Multimedia Ticket - Campaign',
    mulmed_give_away: 'Multimedia Ticket - Give Away',
    // Event Design
    mulmed_event: 'Multimedia Ticket - Event',
    mulmed_project: 'Multimedia Ticket - Project',
  };

  const embed = new EmbedBuilder()
    .setTitle(`Ticket: ${typeLabels[modalId] || 'Unknown'}`)
    .setColor(fields.priority?.toLowerCase() === 'urgent' ? 0xff0000 : 0x00ff00)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setTimestamp();

  // Always show priority, default to Normal
  const priorityValue = fields.priority || 'Normal';
  embed.addFields({ name: 'Priority', value: priorityValue, inline: true });
  if (fields.item_id) {
    embed.addFields({ name: 'Item ID', value: fields.item_id, inline: true });
    embed.addFields({ name: 'Item Link', value: `https://kyou.id/items/${fields.item_id}` });
  }
  if (fields.order_id) {
    embed.addFields({ name: 'Order ID', value: fields.order_id, inline: true });
    embed.addFields({ name: 'Order Link', value: `https://old.kyou.id/admin/order/${fields.order_id}` });
  }
  if (fields.link) embed.addFields({ name: 'Link', value: fields.link });
  if (fields.sub_type) embed.addFields({ name: 'Sub Type', value: fields.sub_type, inline: true });
  if (fields.size) embed.addFields({ name: 'Size', value: fields.size, inline: true });
  if (fields.size_qty) embed.addFields({ name: 'Size & QTY', value: fields.size_qty, inline: true });
  if (fields.size_placement) embed.addFields({ name: 'Size / Placement', value: fields.size_placement, inline: true });
  if (fields.deadline_info) embed.addFields({ name: 'Deadline / Additional Info', value: fields.deadline_info });
  if (fields.brief) embed.addFields({ name: 'Brief', value: fields.brief });
  if (fields.additional_output) embed.addFields({ name: 'Additional Output', value: fields.additional_output });
  if (fields.additional) embed.addFields({ name: 'Additional', value: fields.additional });
  if (fields.notes) embed.addFields({ name: 'Notes', value: fields.notes });

  return embed;
}

function getChannelForTicket(modalId) {
  const channelMap = {
    modal_eta_ppo: process.env.CHANNEL_PPO,
    modal_eta_ureq: process.env.CHANNEL_UREQ,
    modal_restock: process.env.CHANNEL_PST,
    modal_revive: process.env.CHANNEL_REVIVE,
    modal_new_item_preorder: process.env.CHANNEL_PPO,
    modal_kompen: process.env.CHANNEL_KOMPEN,
    // Multimedia channels (with modal_ prefix)
    // Digital Design sub-types (with modal_ prefix)
    modal_mulmed_kolase: process.env.CHANNEL_DIGITAL,
    modal_mulmed_singpost: process.env.CHANNEL_DIGITAL,
    modal_mulmed_announcement: process.env.CHANNEL_DIGITAL,
    modal_mulmed_monthly_design: process.env.CHANNEL_DIGITAL,
    modal_mulmed_other: process.env.CHANNEL_DIGITAL,
    // Single Printing sub-types (with modal_ prefix)
    modal_mulmed_store_design: process.env.CHANNEL_SINGLEPRINT,
    modal_mulmed_standee: process.env.CHANNEL_SINGLEPRINT,
    modal_mulmed_banner: process.env.CHANNEL_SINGLEPRINT,
    modal_mulmed_wallpaper: process.env.CHANNEL_SINGLEPRINT,
    modal_mulmed_other_print: process.env.CHANNEL_SINGLEPRINT,
    // Offset Printing sub-types (with modal_ prefix)
    modal_mulmed_brosur: process.env.CHANNEL_OFFSET,
    modal_mulmed_kipas: process.env.CHANNEL_OFFSET,
    modal_mulmed_postcard: process.env.CHANNEL_OFFSET,
    modal_mulmed_sticker: process.env.CHANNEL_OFFSET,
    modal_mulmed_paper_bag: process.env.CHANNEL_OFFSET,
    modal_mulmed_dus_kyou: process.env.CHANNEL_OFFSET,
    modal_mulmed_other_offset: process.env.CHANNEL_OFFSET,
    // Promotional Design sub-types (with modal_ prefix)
    modal_mulmed_thematic_sale: process.env.CHANNEL_PROMO,
    modal_mulmed_sp_sale: process.env.CHANNEL_PROMO,
    modal_mulmed_campaign: process.env.CHANNEL_PROMO,
    modal_mulmed_give_away: process.env.CHANNEL_PROMO,
    // Event Design sub-types (with modal_ prefix)
    modal_mulmed_event: process.env.CHANNEL_EVENT,
    modal_mulmed_project: process.env.CHANNEL_EVENT,
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
          // Re-render the message with edit and close buttons
          const editButton = new ButtonBuilder()
            .setCustomId(`edit_assignee_${ticket.id}`)
            .setLabel('Edit Assignee')
            .setStyle(ButtonStyle.Secondary);

          const closeButton = new ButtonBuilder()
            .setCustomId(`close_ticket_${ticket.created_by}`)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger);

          const row = new ActionRowBuilder().addComponents(editButton, closeButton);

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
