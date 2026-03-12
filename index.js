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
const warehouseCommand = require('./commands/warehouse-ticket');
const { modals, createFeedbackModal, createEditTicketModal, createWarehouseFeedbackModal } = require('./modals/ticketModals');
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
  modal_eta_ppo: ['1300285037241045073', '1337705127703871488'],
  modal_eta_ureq: ['1336223205601316936'],
  modal_revive: ['1204414544550821978'],
  modal_restock: ['1204414544550821978'],
  // Digital Design
  mulmed_announcement: ['1336185533965144148'],
  mulmed_other: ['1336185533965144148'],
  // Single Printing
  mulmed_store_design: ['1336185533965144148'],
  mulmed_standee: ['1336185533965144148'],
  mulmed_banner: ['1336185533965144148'],
  mulmed_wallpaper: ['1336185533965144148'],
  mulmed_other_print: ['1336185533965144148'],
  // Offset Printing
  mulmed_brosur: ['1336185533965144148'],
  mulmed_kipas: ['1336185533965144148'],
  mulmed_postcard: ['1336185533965144148'],
  mulmed_sticker: ['1336185533965144148'],
  mulmed_paper_bag: ['1336185533965144148'],
  mulmed_dus_kyou: ['1336185533965144148'],
  mulmed_other_offset: ['1336185533965144148'],
  // Promotional Design
  mulmed_thematic_sale: ['1336185533965144148'],
  mulmed_sp_sale: ['1336185533965144148'],
  mulmed_campaign: ['1336185533965144148'],
  mulmed_give_away: ['1336185533965144148'],
  // Event Design
  mulmed_event: ['1336185533965144148'],
  mulmed_project: ['1336185533965144148'],
  // Foto Fisik
  mulmed_foto_fisik: [],
  // Warehouse tickets
  wh_cek_fisik: ['1204414986815012906'], // Will use ROLE_WH_OPERATION from env
  wh_pindah_fisik: ['1204414986815012906'], // Will use ROLE_WH_OPERATION from env
  wh_pick: ['1204414986815012906'], // Will use ROLE_WH_OPERATION from env
  wh_stock_mgmt: ['1481152177492852840'], // Will use ROLE_WH_SUPERVISOR from env
};

// User IDs for specific ticket types (not roles)
const TICKET_USERS = {
  // Purchasing tickets
  modal_kompen: ['392321900577161219', '421215427696394241'],
  modal_new_item_preorder: ['392321900577161219', '1155539420871667824', '628815933208657921', '651993926986629140'],
  // Multimedia tickets - direct user assignments
  mulmed_kolase: ['463834579799638056', '286790867329613824'],
  mulmed_singpost: ['463834579799638056', '915811508561272894'],
  mulmed_monthly_design: ['463834579799638056', '915811508561272894'],
  mulmed_foto_fisik: ['286790867329613824', '851340340425129994'],
  // Warehouse tickets - direct user assignments
  wh_omega: [],
  wh_delta: [],
  wh_ss: [],
  wh_op: [],
  wh_wsr: [],
  wh_pickup_pelunasan: [],
  wh_return_monitor: [],
  wh_bde: [],
  wh_dachi: [],
  wh_give_away: [],
  wh_pick_other: [],
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
client.commands.set(warehouseCommand.data.name, warehouseCommand);

// Register slash commands
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const commands = [ticketCommand.data.toJSON(), mulmedCommand.data.toJSON(), warehouseCommand.data.toJSON()];

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
        { label: 'Giveaway', value: 'give_away', description: 'Giveaway request' },
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

    if (ticketType === 'foto_fisik') {
      const modalFn = modals.foto_fisik;
      const staffMembers = new Map();

      const userIds = TICKET_USERS.mulmed_foto_fisik || [];
      for (const userId of userIds) {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && !member.user.bot) {
          staffMembers.set(member.id, member);
        }
      }

      const roleIds = TICKET_ROLES.mulmed_foto_fisik || [];
      for (const roleId of roleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role && role.members.size > 0) {
          role.members.forEach((member) => {
            if (!member.user.bot) staffMembers.set(member.id, member);
          });
        }
      }

      if (roleIds.length > 0) {
        try {
          await interaction.guild.members.fetch({ limit: 100 });
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

      const staffOptions = Array.from(staffMembers.values())
        .slice(0, 25)
        .map((member) => ({
          label: member.displayName,
          value: member.id,
          description: member.user.tag,
        }));

      await interaction.showModal(modalFn(staffOptions));
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

    // Get special note for this sub-type
    const ticketTypeKey = `mulmed_${subType}`;
    const specialNote = TICKET_SPECIAL_NOTES[ticketTypeKey] || null;

    await interaction.showModal(modalFn(staffOptions, specialNote));
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

    // Get special note for this sub-type
    const ticketTypeKey = `mulmed_${subType}`;
    const specialNote = TICKET_SPECIAL_NOTES[ticketTypeKey] || null;

    await interaction.showModal(modalFn(staffOptions, specialNote));
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

    // Get special note for this sub-type
    const ticketTypeKey = `mulmed_${subType}`;
    const specialNote = TICKET_SPECIAL_NOTES[ticketTypeKey] || null;

    await interaction.showModal(modalFn(staffOptions, specialNote));
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

    // Get special note for this sub-type
    const ticketTypeKey = `mulmed_${subType}`;
    const specialNote = TICKET_SPECIAL_NOTES[ticketTypeKey] || null;

    await interaction.showModal(modalFn(staffOptions, specialNote));
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

    // Get special note for this sub-type
    const ticketTypeKey = `mulmed_${subType}`;
    const specialNote = TICKET_SPECIAL_NOTES[ticketTypeKey] || null;

    await interaction.showModal(modalFn(staffOptions, specialNote));
  }

  // Warehouse category select (first dropdown)
  if (interaction.isStringSelectMenu() && interaction.customId === 'warehouse_category_select') {
    const category = interaction.values[0];

    let subOptions = [];

    // Cek Fisik
    if (category === 'cek_fisik') {
      subOptions = [
        { label: 'Omega', value: 'omega', description: 'Cek Fisik - Omega' },
        { label: 'Delta', value: 'delta', description: 'Cek Fisik - Delta' },
        { label: 'SS', value: 'ss', description: 'Cek Fisik - SS' },
        { label: 'OP', value: 'op', description: 'Cek Fisik - OP' },
      ];
    }
    // Pindah Fisik
    else if (category === 'pindah_fisik') {
      subOptions = [
        { label: 'WSR', value: 'wsr', description: 'Pickup Stock Request dari Store ke WH' },
        { label: 'Pickup Pelunasan', value: 'pickup_pelunasan', description: 'Pickup Order yang belum dilunasi di Toko sekaligus Pelunasan' },
        { label: 'Retur Monitor', value: 'return_monitor', description: 'Bila ada retur dari user, mohon lapor kesini' },
        { label: 'BDE', value: 'bde', description: 'Pindah Fisik untuk Conversion BDE to Ready Stock' },
      ];
    }
    // WH Pick
    else if (category === 'wh_pick') {
      subOptions = [
        { label: 'Dachi', value: 'dachi', description: 'WH Pick - Dachi' },
        { label: 'Giveaway', value: 'give_away', description: 'WH Pick - Giveaway' },
        { label: 'Other', value: 'pick_other', description: 'WH Pick - Other' },
      ];
    }
    // WH Stock Management
    else if (category === 'wh_stock_mgmt') {
      subOptions = [
        { label: 'Koreksi WS (WS Kor)', value: 'ws_kor', description: 'Tracing & Penyesuaian stock yang qtynya tidak sesuai ketika masuk di Toko' },
        { label: 'Adjust Stock (QTY)', value: 'adjust_stock_qty', description: 'Tracing & Penyesuaian qty stock yang ditemukan tidak sesuai jumlahnya' },
        { label: 'Adjust Stock (Transfer)', value: 'adjust_stock_transfer', description: 'Tracing & Penyesuaian qty stock yang ditemukan tidak sesuai letak barangnya' },
      ];
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`warehouse_subtype_${category}`)
      .setPlaceholder('Select sub type...')
      .addOptions(subOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({
      content: 'Select the specific type:',
      components: [row],
    });
  }

  // Warehouse subtype select (second dropdown) - Cek Fisik
  if (interaction.isStringSelectMenu() && interaction.customId === 'warehouse_subtype_cek_fisik') {
    const subType = interaction.values[0];
    await handleWarehouseSubType(interaction, subType, 'cek_fisik');
  }

  // Warehouse subtype select - Pindah Fisik
  if (interaction.isStringSelectMenu() && interaction.customId === 'warehouse_subtype_pindah_fisik') {
    const subType = interaction.values[0];
    await handleWarehouseSubType(interaction, subType, 'pindah_fisik');
  }

  // Warehouse subtype select - WH Pick
  if (interaction.isStringSelectMenu() && interaction.customId === 'warehouse_subtype_wh_pick') {
    const subType = interaction.values[0];
    await handleWarehouseSubType(interaction, subType, 'wh_pick');
  }

  // Warehouse subtype select - WH Stock Management
  if (interaction.isStringSelectMenu() && interaction.customId === 'warehouse_subtype_wh_stock_mgmt') {
    const subType = interaction.values[0];
    await handleWarehouseSubType(interaction, subType, 'wh_stock_mgmt');
  }

  // Button click - Close Warehouse Ticket

// Helper function to handle warehouse subtype selection
async function handleWarehouseSubType(interaction, subType, category) {
  const modalFn = modals[`wh_${subType}`];

  if (!modalFn) {
    await interaction.update({
      content: `Unknown sub-type: **${subType}**`,
      components: [],
    });
    return;
  }

  // Fetch staff members
  const staffMembers = new Map();

  // First, try TICKET_USERS (specific user assignments)
  const userIds = TICKET_USERS[`wh_${subType}`] || [];
  for (const userId of userIds) {
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (member && !member.user.bot) {
      staffMembers.set(member.id, member);
    }
  }

  // If no specific users, fallback to role
  if (staffMembers.size === 0) {
    // Check if category already has 'wh_' prefix to avoid double prefix
    let roleKey = category.startsWith('wh_') ? category : `wh_${category}`;

    // Map WH Stock Management subtypes to the same role
    if (subType === 'ws_kor' || subType === 'adjust_stock_qty' || subType === 'adjust_stock_transfer') {
      roleKey = 'wh_stock_mgmt';
    }

    const roleIds = TICKET_ROLES[roleKey] || [];

    // First, try to get from cache
    for (const rid of roleIds) {
      const role = interaction.guild.roles.cache.get(rid);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

    // If still empty from cache, fetch all members to ensure role data is loaded
    if (staffMembers.size === 0 && roleIds.length > 0) {
      try {
        await interaction.guild.members.fetch();

        for (const rid of roleIds) {
          const role = interaction.guild.roles.cache.get(rid);
          if (role) {
            role.members.forEach((member) => {
              if (!member.user.bot) staffMembers.set(member.id, member);
            });
          }
        }
      } catch (e) {
        console.log('Role member fetch failed:', e.message);
      }
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

  // Store temp data in pendingTickets for modal submission
  const tempId = Date.now().toString(36);
  pendingTickets.set(`wh_temp_${tempId}`, {
    subType,
    category,
  });

  // Pass tempId to modal function for customId suffix
  await interaction.showModal(modalFn(staffOptions, tempId));
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

    // Check if this is a multimedia or warehouse ticket
    const isMultimediaTicket = ticketMessage.embeds[0]?.title?.includes('Multimedia Ticket');
    const isWarehouseTicket = ticketMessage.embeds[0]?.title?.includes('Cek Fisik') ||
                              ticketMessage.embeds[0]?.title?.includes('Pindah Fisik') ||
                              ticketMessage.embeds[0]?.title?.includes('WH PICK') ||
                              ticketMessage.embeds[0]?.title?.includes('WH Pick') ||
                              ticketMessage.embeds[0]?.title?.includes('WH Stock Management');

    // Allow creator or assigned staff to edit for multimedia, purchasing, and warehouse tickets
    const isCreator = creatorId && interaction.user.id === creatorId;
    const isAssignee = assignedUserIds.includes(interaction.user.id);

    if (!isCreator && !isAssignee) {
      await interaction.reply({
        content: '❌ Only the ticket creator or assigned staff can edit assignees.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get ticket type from title
    const embedTitle = ticketMessage.embeds[0]?.title || '';
    let ticketTypeKey = null;

    // Warehouse ticket types (check first to avoid conflicts) - using category grouping
    if (embedTitle.includes('Cek Fisik')) ticketTypeKey = 'wh_cek_fisik';
    else if (embedTitle.includes('Pindah Fisik')) ticketTypeKey = 'wh_pindah_fisik';
    else if (embedTitle.includes('WH PICK') || embedTitle.includes('WH Pick')) ticketTypeKey = 'wh_pick';
    else if (embedTitle.includes('WS-KOR') || embedTitle.includes('Adjust Stock (QTY)') || embedTitle.includes('Adjust Stock (Transfer)')) {
      // All WH Stock Management subtypes use the same role
      ticketTypeKey = 'wh_stock_mgmt';
    }
    else if (embedTitle.includes('WH Stock Management')) ticketTypeKey = 'wh_stock_mgmt';
    // Purchasing ticket types
    else if (embedTitle.includes('ETA (General)') || embedTitle.includes('PPO') || embedTitle.includes('PST')) ticketTypeKey = 'modal_eta_ppo';
    else if (embedTitle.includes('ETA (UREQ)')) ticketTypeKey = 'modal_eta_ureq';
    else if (embedTitle.includes('Restock Request')) ticketTypeKey = 'modal_restock';
    else if (embedTitle.includes('Revive')) ticketTypeKey = 'modal_revive';
    else if (embedTitle.includes('New DB Request')) ticketTypeKey = 'modal_new_item_preorder';
    else if (embedTitle.includes('Kompensasi')) ticketTypeKey = 'modal_kompen';
    // Multimedia ticket types
    else if (embedTitle.includes('Kolase')) ticketTypeKey = 'mulmed_kolase';
    else if (embedTitle.includes('Singpost')) ticketTypeKey = 'mulmed_singpost';
    else if (embedTitle.includes('Announcement')) ticketTypeKey = 'mulmed_announcement';
    else if (embedTitle.includes('Monthly Design')) ticketTypeKey = 'mulmed_monthly_design';
    else if (embedTitle.includes('Other') && embedTitle.includes('Digital Design')) ticketTypeKey = 'mulmed_other';
    else if (embedTitle.includes('Store Design')) ticketTypeKey = 'mulmed_store_design';
    else if (embedTitle.includes('Standee')) ticketTypeKey = 'mulmed_standee';
    else if (embedTitle.includes('Banner')) ticketTypeKey = 'mulmed_banner';
    else if (embedTitle.includes('Wallpaper')) ticketTypeKey = 'mulmed_wallpaper';
    else if (embedTitle.includes('Other Printing')) ticketTypeKey = 'mulmed_other_print';
    else if (embedTitle.includes('Brosur')) ticketTypeKey = 'mulmed_brosur';
    else if (embedTitle.includes('Kipas')) ticketTypeKey = 'mulmed_kipas';
    else if (embedTitle.includes('Postcard')) ticketTypeKey = 'mulmed_postcard';
    else if (embedTitle.includes('Sticker')) ticketTypeKey = 'mulmed_sticker';
    else if (embedTitle.includes('Paper Bag')) ticketTypeKey = 'mulmed_paper_bag';
    else if (embedTitle.includes('Dus Kyou')) ticketTypeKey = 'mulmed_dus_kyou';
    else if (embedTitle.includes('Other Offset')) ticketTypeKey = 'mulmed_other_offset';
    else if (embedTitle.includes('Thematic Sale')) ticketTypeKey = 'mulmed_thematic_sale';
    else if (embedTitle.includes('SP Sale')) ticketTypeKey = 'mulmed_sp_sale';
    else if (embedTitle.includes('Campaign')) ticketTypeKey = 'mulmed_campaign';
    else if (embedTitle.includes('Give Away') && embedTitle.includes('Multimedia')) ticketTypeKey = 'mulmed_give_away';
    else if (embedTitle.includes('Event')) ticketTypeKey = 'mulmed_event';
    else if (embedTitle.includes('Project')) ticketTypeKey = 'mulmed_project';
    else if (embedTitle.includes('Foto Fisik')) ticketTypeKey = 'mulmed_foto_fisik';

    // Fetch staff members
    const staffMembers = new Map();

    const userIds = TICKET_USERS[ticketTypeKey] || [];
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) {
        staffMembers.set(member.id, member);
      }
    }

    const roleIds = TICKET_ROLES[ticketTypeKey] || [];

    // First, try to get from cache
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && role.members.size > 0) {
        role.members.forEach((member) => {
          if (!member.user.bot) staffMembers.set(member.id, member);
        });
      }
    }

    // If still empty from cache, fetch all members to ensure role data is loaded
    if (staffMembers.size === 0 && roleIds.length > 0) {
      try {
        console.log(`[DEBUG] Fetching all members for warehouse edit assignee. Role IDs: ${roleIds.join(', ')}`);
        // Fetch all members to ensure role data is loaded
        await interaction.guild.members.fetch();

        // Now check each role for members - need to fetch role again after member fetch
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          console.log(`[DEBUG] Role ${roleId}: ${role ? 'found' : 'not found'}`);
          if (role) {
            // Fetch role members explicitly
            await role.members.fetch();
            console.log(`[DEBUG] Role ${roleId} has ${role.members.size} members`);
            role.members.forEach((member) => {
              if (!member.user.bot) {
                staffMembers.set(member.id, member);
              }
            });
          }
        }
        console.log(`[DEBUG] Total staff members found: ${staffMembers.size}`);
      } catch (e) {
        console.log('Role member fetch failed:', e.message);
      }
    }

    if (staffMembers.size === 0) {
      await interaction.reply({ content: 'No staff available.', flags: MessageFlags.Ephemeral });
      return;
    }

    const staffOptions = Array.from(staffMembers.values())
      .slice(0, 25)
      .map((member) => ({
        label: member.displayName,
        value: member.id,
        description: member.user.tag,
      }));

    await interaction.showModal(createEditTicketModal(threadId, staffOptions, assignedUserIds));
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

      // Remove all members from thread (except bot)
      const members = await thread.members.fetch();
      for (const [memberId] of members) {
        if (memberId !== interaction.client.user.id) {
          try {
            await thread.members.remove(memberId);
            console.log(`Removed member ${memberId} from thread ${thread.id}`);
          } catch (err) {
            console.error(`Failed to remove member ${memberId}:`, err.message);
          }
        }
      }

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

  // Button click - Close Warehouse Ticket
  if (interaction.isButton() && interaction.customId.startsWith('close_wh_ticket_')) {
    const parts = interaction.customId.split('_');
    const threadId = parts[3];
    const creatorId = parts[4];
    const thread = interaction.channel;

    // Verify we're in the right thread
    if (thread.id !== threadId) {
      await interaction.reply({ content: 'Invalid ticket.', flags: MessageFlags.Ephemeral });
      return;
    }

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

    if (ticketMessage) {
      const assignedField = ticketMessage.embeds[0]?.fields?.find((f) => f.name === 'Assigned To');
      if (assignedField) {
        const mentionRegex = /<@!?(\d+)>/g;
        let match;
        while ((match = mentionRegex.exec(assignedField.value)) !== null) {
          assigneeIds.push(match[1]);
        }
      }
      const ticketIdField = ticketMessage.embeds[0]?.fields?.find((f) => f.name === 'Ticket ID');
      if (ticketIdField) {
        ticketIdFromEmbed = ticketIdField.value;
      }
    }

    if (assigneeIds.length === 0) {
      // No assignees, just close
      await interaction.reply({ content: 'Closing warehouse ticket...', flags: MessageFlags.Ephemeral });

      // Remove all members from thread (except bot)
      const members = await thread.members.fetch();
      for (const [memberId] of members) {
        if (memberId !== interaction.client.user.id) {
          try {
            await thread.members.remove(memberId);
            console.log(`Removed member ${memberId} from thread ${thread.id}`);
          } catch (err) {
            console.error(`Failed to remove member ${memberId}:`, err.message);
          }
        }
      }

      await thread.setArchived(true);
      return;
    }

    // Store pending feedback for multiple assignees
    const feedbackId = Date.now().toString(36);
    const ticketData = activeTickets.get(thread.id);
    pendingTickets.set(`wh_feedback_${feedbackId}`, {
      threadId: thread.id,
      threadName: thread.name,
      ticketId: ticketIdFromEmbed || ticketData?.ticketId || thread.id,
      ticketType: ticketData?.type || '',
      isWarehouse: true,
      dbPersisted: ticketData?.dbPersisted || false,
      assigneeIds,
      currentIndex: 0,
      userId: interaction.user.id,
      itemId: ticketData?.item_id || null,
      orderId: ticketData?.order_id || null,
    });

    // Show modal for first assignee
    const firstAssignee = await interaction.guild.members.fetch(assigneeIds[0]).catch(() => null);
    const assigneeName = firstAssignee?.displayName || 'Staff';

    await interaction.showModal(createWarehouseFeedbackModal(feedbackId, assigneeIds[0], assigneeName, 1, assigneeIds.length));
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

  // Button click - Next Warehouse Feedback
  if (interaction.isButton() && interaction.customId.startsWith('next_wh_feedback_')) {
    const parts = interaction.customId.split('_');
    const feedbackId = parts[3];
    const assigneeId = parts[4];

    const pendingFeedback = pendingTickets.get(`wh_feedback_${feedbackId}`);
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

    await interaction.showModal(createWarehouseFeedbackModal(
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

    // Warehouse feedback modal submission
    if (modalId.startsWith('modal_wh_feedback_')) {
      const parts = modalId.split('_');
      const feedbackId = parts[3];
      const assigneeId = parts[4];

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const pendingFeedback = pendingTickets.get(`wh_feedback_${feedbackId}`);
      if (!pendingFeedback) {
        await interaction.editReply({ content: 'Feedback session expired. Closing ticket...' });

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

      // Get field values
      const fields = {};
      interaction.fields.fields.forEach((field) => {
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

      if (pendingFeedback.dbPersisted) {
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
          console.error('Failed to insert warehouse feedback into database:', err.response?.data || err.message);
        }
      }

      // Send feedback to warehouse feedback channel
      const feedbackChannelId = process.env.CHANNEL_WHFEEDBACK;
      const feedbackChannel = interaction.guild.channels.cache.get(feedbackChannelId);
      if (feedbackChannel) {
        const threadUrl = `https://discord.com/channels/${interaction.guild.id}/${pendingFeedback.threadId}`;
        const feedbackEmbed = new EmbedBuilder()
          .setTitle('Warehouse-Ticket Feedback')
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
          .setCustomId(`next_wh_feedback_${feedbackId}_${nextAssigneeId}`)
          .setLabel(`Rate ${nextName} (${pendingFeedback.currentIndex + 1}/${pendingFeedback.assigneeIds.length})`)
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(nextButton);

        await interaction.editReply({
          content: `Feedback submitted! Click below to rate the next staff member.`,
          components: [row],
        });
      } else {
        // All feedback collected, close the thread
        pendingTickets.delete(`wh_feedback_${feedbackId}`);

        const thread = interaction.channel;

        await interaction.editReply({ content: 'Thank you for your feedback! Closing ticket...' });

        if (pendingFeedback.dbPersisted) {
          try {
            await db.updateRows('purchasing_tickets',
              { id: pendingFeedback.ticketId },
              { status: 'closed', closed_at: db.getWibTime() }
            );
          } catch (err) {
            console.error('Failed to update warehouse ticket status:', err.response?.data || err.message);
          }
        }

        // Remove all members from thread (except bot)
        const members = await thread.members.fetch();
        console.log(`Closing warehouse ticket ${thread.id} - Members to remove: ${Array.from(members.keys()).filter(id => id !== interaction.client.user.id).join(', ')}`);
        for (const [memberId] of members) {
          if (memberId !== interaction.client.user.id) {
            try {
              await thread.members.remove(memberId);
              console.log(`Removed member ${memberId} from thread ${thread.id}`);
            } catch (err) {
              if (err.code === 50001 || err.message.includes('Missing Access')) {
                console.log(`Cannot remove member ${memberId} (likely thread owner or missing permissions)`);
              } else {
                console.error(`Failed to remove member ${memberId}:`, err.message);
              }
            }
          }
        }

        // Archive the thread
        await thread.setArchived(true);

        // Remove from active cache
        activeTickets.delete(thread.id);
      }
      return;
    }

    // Individual feedback modal submission
    if (modalId.startsWith('modal_feedback_')) {
      const parts = modalId.split('_');
      const feedbackId = parts[2];
      const assigneeId = parts[3];

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const pendingFeedback = pendingTickets.get(`feedback_${feedbackId}`);
      if (!pendingFeedback) {
        await interaction.editReply({ content: 'Feedback session expired. Closing ticket...' });

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
          .setTitle(isMulmed ? 'Multimedia-Ticket Feedback' : 'Purchasing-Ticket Feedback')
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

        await interaction.editReply({
          content: `Feedback submitted! Click below to rate the next staff member.`,
          components: [row],
        });
      } else {
        // All feedback collected, close the thread
        pendingTickets.delete(`feedback_${feedbackId}`);

        const thread = interaction.channel;

        await interaction.editReply({ content: 'Thank you for your feedback! Closing ticket...' });

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
        console.log(`Closing ticket ${thread.id} - Members to remove: ${Array.from(members.keys()).filter(id => id !== interaction.client.user.id).join(', ')}`);
        for (const [memberId] of members) {
          if (memberId !== interaction.client.user.id) {
            try {
              await thread.members.remove(memberId);
              console.log(`Removed member ${memberId} from thread ${thread.id}`);
            } catch (err) {
              console.error(`Failed to remove member ${memberId}:`, err.message);
            }
          }
        }

        // Archive the thread
        await thread.setArchived(true);

        // Remove from active cache
        activeTickets.delete(thread.id);
      }
      return;
    }

    // Edit ticket modal submission - harus dicek SEBELUM ticket creation
    if (modalId.startsWith('modal_edit_ticket_')) {
      const threadId = modalId.replace('modal_edit_ticket_', '');
      const thread = interaction.channel;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Get field values
      const fields = {};
      interaction.fields.fields.forEach((field) => {
        if (field.type === 3 && field.values) {
          // Multi-select for assigned_to
          if (field.customId === 'assigned_to') {
            fields[field.customId] = field.values;
          } else {
            fields[field.customId] = field.values[0];
          }
        } else if (field.type === 4 && field.value !== undefined) {
          fields[field.customId] = field.value;
        }
      });

      const newAssigneeIds = fields.assigned_to || [];
      const editNotes = fields.edit_notes || '';

      if (newAssigneeIds.length === 0) {
        await interaction.editReply({ content: 'Please select at least one staff member.' });
        return;
      }

      // Get ticket message
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

      // Get ticket creator from embed (need this early for filtering)
      const creatorId = ticketMessage.embeds[0]?.author?.name?.match(/\((\d+)\)$/)?.[1] ||
        activeTickets.get(thread.id)?.created_by;

      // Get old assignees from BOTH thread members AND embed field
      const oldAssigneeIds = [];

      // From thread members (actual people in the thread)
      try {
        const threadMembers = await thread.members.fetch();
        threadMembers.forEach((member) => {
          // Exclude bot and ticket creator
          if (member.id !== interaction.client.user.id && member.id !== creatorId) {
            oldAssigneeIds.push(member.id);
          }
        });
      } catch (err) {
        console.error('Failed to fetch thread members:', err.message);
      }

      // Also from embed field (for backup/fallback)
      const assignedField = ticketMessage.embeds[0]?.fields?.find((f) => f.name === 'Assigned To');
      if (assignedField) {
        const mentionRegex = /<@!?(\d+)>/g;
        let match;
        while ((match = mentionRegex.exec(assignedField.value)) !== null) {
          if (!oldAssigneeIds.includes(match[1])) {
            oldAssigneeIds.push(match[1]);
          }
        }
      }

      // Remove duplicates
      const uniqueOldIds = [...new Set(oldAssigneeIds)];
      const toRemove = uniqueOldIds.filter(id => !newAssigneeIds.includes(id));

      console.log(`Edit assignee - Thread members: ${uniqueOldIds.join(', ')}, New: ${newAssigneeIds.join(', ')}`);
      console.log(`To remove: ${toRemove.join(', ') || '(none)'}`);

      // Update embed
      const oldEmbed = ticketMessage.embeds[0];
      const newEmbed = EmbedBuilder.from(oldEmbed);

      // Update Assigned To field
      const newAssignedMentions = newAssigneeIds.map((id) => `<@${id}>`).join(', ');
      const fieldIndex = newEmbed.data.fields?.findIndex((f) => f.name === 'Assigned To');
      if (fieldIndex !== -1) {
        newEmbed.data.fields[fieldIndex].value = newAssignedMentions;
      }

      // Check if this is a warehouse ticket to use correct close button format
      const isWarehouseTicket = oldEmbed.title?.includes('Cek Fisik') ||
                              oldEmbed.title?.includes('Pindah Fisik') ||
                              oldEmbed.title?.includes('WH PICK') ||
                              oldEmbed.title?.includes('WH Stock Management');

      // Recreate buttons
      const editButton = new ButtonBuilder()
        .setCustomId(`edit_assignee_${threadId}`)
        .setLabel('Edit Assignee')
        .setStyle(ButtonStyle.Secondary);

      let closeButton;
      if (isWarehouseTicket) {
        closeButton = new ButtonBuilder()
          .setCustomId(`close_wh_ticket_${threadId}_${creatorId || interaction.user.id}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger);
      } else {
        closeButton = new ButtonBuilder()
          .setCustomId(`close_ticket_${creatorId || interaction.user.id}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger);
      }

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

      // Remove old assignees from thread (skip creator as they cannot be removed from own thread)
      for (const oldId of toRemove) {
        if (oldId === creatorId) {
          console.log(`Skipping removal of creator ${oldId} from thread ${threadId}`);
          continue;
        }
        try {
          await thread.members.remove(oldId);
          console.log(`Removed assignee ${oldId} from thread ${threadId}`);
        } catch (err) {
          if (err.code === 50001 || err.message.includes('Missing Access')) {
            console.log(`Cannot remove member ${oldId} (likely thread owner or missing permissions)`);
          } else {
            console.error(`Failed to remove assignee ${oldId}:`, err.message);
          }
        }
      }

      // Add new assignees to thread
      for (const newId of newAssigneeIds) {
        try {
          await thread.members.add(newId);
          console.log(`Added assignee ${newId} to thread ${threadId}`);
        } catch (err) {
          console.error(`Failed to add assignee ${newId}:`, err.message);
        }
      }

      // Update active tickets cache
      const ticketData = activeTickets.get(thread.id);
      if (ticketData) {
        ticketData.assigned_to = JSON.stringify(newAssigneeIds.map(id => ({ id, name: '' })));
      }

      let responseContent = 'Assignee updated successfully!';
      if (editNotes) {
        responseContent += `\n\n**Edit Notes:** ${editNotes}`;
      }
      await interaction.editReply({ content: responseContent });
      return;
    }

    // Warehouse ticket creation modals
    if (modalId.startsWith('modal_wh_')) {
      const fields = {};

      interaction.fields.fields.forEach((field) => {
        if (field.type === 3 && field.values) {
          if (field.customId === 'assigned_to') {
            fields[field.customId] = field.values;
          } else {
            fields[field.customId] = field.values[0];
          }
        } else if (field.type === 4 && field.value !== undefined) {
          fields[field.customId] = field.value;
        }
      });

      // Get warehouse category and sub_type from pendingTickets
      // Extract tempId from modal customId (format: modal_wh_<subtype>_<tempId>)
      const tempId = modalId.split('_').pop();
      const tempData = pendingTickets.get(`wh_temp_${tempId}`);

      // Also extract base modalId (without tempId) for database storage
      let baseModalId = modalId;
      if (modalId.split('_').length > 3) {
        const parts = modalId.split('_');
        parts.pop(); // Remove tempId
        baseModalId = parts.join('_');
      }

      if (!tempData) {
        await interaction.reply({ content: 'Session expired. Please start over.', flags: MessageFlags.Ephemeral });
        return;
      }

      fields.wh_category = tempData.category;
      fields.wh_sub_type = tempData.subType;

      // Clean up temp data
      pendingTickets.delete(`wh_temp_${tempId}`);

      // Check if staff was assigned
      if (!fields.assigned_to || fields.assigned_to.length === 0) {
        await interaction.reply({ content: 'Please select a staff member to assign.', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const assignedUserIds = Array.isArray(fields.assigned_to) ? fields.assigned_to : [fields.assigned_to];
      const user = interaction.user;

      const embed = createWarehouseTicketEmbed(modalId, fields, user);
      const channelId = getChannelForTicket(modalId);
      const targetChannel = interaction.guild.channels.cache.get(channelId);

      if (!targetChannel) {
        await interaction.editReply({ content: 'Target channel not found' });
        return;
      }

      // Create thread name
      const subTypeLabel = {
        omega: 'OMEGA', delta: 'DELTA', ss: 'SS', op: 'OP',
        wsr: 'WSR', pickup_pelunasan: 'PICKUP', return_monitor: 'RETMON', bde: 'BDE',
        dachi: 'DACHI', give_away: 'GIVEAWAY', wh_pick_other: 'WH-PICK',
        ws_kor: 'WS-KOR', adjust_stock_qty: 'ADJ-QTY', adjust_stock_transfer: 'ADJ-XFER',
      };

      // Add item_id or order_id to thread name if available
      const identifier = fields.item_id || fields.order_id || null;
      const nameParts = [
        subTypeLabel[fields.wh_sub_type] || 'WH',
        identifier,
        user.username,
      ].filter(Boolean).join('-').substring(0, 100);

      // Create thread
      const thread = await targetChannel.threads.create({
        name: nameParts,
        autoArchiveDuration: 1440,
        reason: `Warehouse Ticket by ${user.tag}`,
      });

      // Warehouse tickets are not compatible with the purchasing DB schema.
      const ticketDbData = {
        id: thread.id,
        type: baseModalId.replace('modal_', ''),
        status: 'open',
        item_id: fields.item_id || null,
        order_id: fields.order_id || null,
        notes: fields.note || fields.notes || null,
        store_name: fields.store_name || null,
        batch: fields.batch || null,
        created_by: user.id,
        created_by_name: user.displayName || user.username,
        assigned_to: JSON.stringify(assignedUserIds.map(id => ({ id, name: '' }))),
      };

      // Remove empty fields
      if (!ticketDbData.notes) delete ticketDbData.notes;
      if (!ticketDbData.item_id) delete ticketDbData.item_id;
      if (!ticketDbData.order_id) delete ticketDbData.order_id;
      if (!ticketDbData.store_name) delete ticketDbData.store_name;
      if (!ticketDbData.batch) delete ticketDbData.batch;

      activeTickets.set(thread.id, {
        ticketId: thread.id,
        ...ticketDbData,
        whCategory: fields.wh_category,
        whSubType: fields.wh_sub_type,
        dbPersisted: false,
      });

      // Add ticket ID and assigned staff to embed
      embed.addFields({ name: 'Ticket ID', value: thread.id, inline: true });
      const assignedMentions = assignedUserIds.map((id) => `<@${id}>`).join(', ');
      embed.addFields({ name: 'Assigned To', value: assignedMentions });

      // Add edit assignee and close buttons
      const editButton = new ButtonBuilder()
        .setCustomId(`edit_assignee_${thread.id}`)
        .setLabel('Edit Assignee')
        .setStyle(ButtonStyle.Primary);

      const closeButton = new ButtonBuilder()
        .setCustomId(`close_wh_ticket_${thread.id}_${user.id}`)
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(editButton, closeButton);

      await thread.send({ embeds: [embed], components: [row] });

      await thread.members.add(user.id);
      for (const userId of assignedUserIds) {
        try {
          await thread.members.add(userId);
          console.log(`[WH Ticket] Added assignee ${userId} to thread ${thread.id}`);
        } catch (err) {
          console.error(`[WH Ticket] Failed to add assignee ${userId}:`, err.message);
          if (err.code === 50001 || err.message.includes('Missing Access')) {
            console.log(`[WH Ticket] Cannot add member ${userId} - missing permissions or thread owner`);
          }
        }
      }

      await interaction.editReply({
        content: `Warehouse ticket created: ${thread}`,
        components: [],
      });
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
      // Foto Fisik
      modal_mulmed_foto_fisik: 'FOTO-FISIK',
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
      notes: buildStoredTicketNotes(fields),
      link: fields.link || null,
      created_by: user.id,
      created_by_name: user.displayName || user.username,
      assigned_to: JSON.stringify(assignedUserIds.map(id => ({ id, name: '' }))),
    };

    // Hapus field yang kosong
    if (!ticketDbData.item_id) delete ticketDbData.item_id;
    if (!ticketDbData.order_id) delete ticketDbData.order_id;
    if (!ticketDbData.notes) delete ticketDbData.notes;
    if (!ticketDbData.priority) delete ticketDbData.priority;
    if (!ticketDbData.link) delete ticketDbData.link;

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
    if (modalId === 'modal_mulmed_wallpaper') {
      await thread.send({ content: 'Silakan kirim foto letak pemasangan wallpaper di thread ini.' });
    }

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

function createWarehouseTicketEmbed(modalId, fields, user) {
  // Remove tempId suffix from modalId if present (format: modal_wh_<subtype>_<tempId>)
  let lookupModalId = modalId;
  if (modalId.startsWith('modal_wh_') && modalId.split('_').length > 3) {
    const parts = modalId.split('_');
    parts.pop(); // Remove tempId
    lookupModalId = parts.join('_');
  }

  const typeLabels = {
    modal_wh_omega: 'Cek Fisik - Omega',
    modal_wh_delta: 'Cek Fisik - Delta',
    modal_wh_ss: 'Cek Fisik - SS',
    modal_wh_op: 'Cek Fisik - OP',
    modal_wh_wsr: 'Pindah Fisik - WSR',
    modal_wh_pickup_pelunasan: 'Pindah Fisik - Pickup Pelunasan',
    modal_wh_return_monitor: 'Pindah Fisik - Return Monitor',
    modal_wh_bde: 'Pindah Fisik - BDE',
    modal_wh_dachi: 'WH PICK - Dachi',
    modal_wh_give_away: 'WH PICK - Giveaway',
    modal_wh_pick_other: 'WH Pick Other',
    modal_wh_ws_kor: 'WH Stock Management - WS Kor',
    modal_wh_adjust_stock_qty: 'WH Stock Management - Adjust Stock (QTY)',
    modal_wh_adjust_stock_transfer: 'WH Stock Managemenet - Adjust Stock (Transfer)',
  };

  const categoryLabels = {
    cek_fisik: 'Cek Fisik',
    pindah_fisik: 'Pindah Fisik',
    wh_pick: 'WH PICK',
    wh_stock_mgmt: 'WH Stock Management',
  };

  const embed = new EmbedBuilder()
    .setTitle(`Warehouse Ticket: ${typeLabels[lookupModalId] || 'Unknown'}`)
    .setColor(0x00ff00)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setTimestamp();

  // Add category
  if (fields.wh_category) {
    embed.addFields({ name: 'Category', value: categoryLabels[fields.wh_category] || fields.wh_category, inline: true });
  }

  // Add warehouse fields based on what's available
  if (fields.item_id) {
    embed.addFields({ name: 'Item ID', value: fields.item_id, inline: true });
    embed.addFields({ name: 'Item Link', value: `https://kyou.id/items/${fields.item_id}` });
  }
  if (fields.order_id) {
    embed.addFields({ name: 'Order ID', value: fields.order_id, inline: true });
    embed.addFields({ name: 'Order Link', value: `https://old.kyou.id/admin/order/${fields.order_id}` });
  }
  if (fields.store_name) {
    const storeLabels = { alpha: 'Alpha', beta: 'Beta', gamma: 'Gamma' };
    embed.addFields({ name: 'Store Name', value: storeLabels[fields.store_name] || fields.store_name, inline: true });
  }
  if (fields.batch) embed.addFields({ name: 'Batch', value: fields.batch, inline: true });
  if (fields.note) embed.addFields({ name: 'Note', value: fields.note });
  if (fields.notes) embed.addFields({ name: 'Notes', value: fields.notes });

  return embed;
}

function createTicketEmbed(modalId, fields, user) {
  const typeLabels = {
    modal_eta_ppo: 'Purchasing Ticket - ETA (General)',
    modal_eta_ureq: 'Purchasing Ticket - ETA (UREQ)',
    modal_restock: 'Purchasing Ticket - Restock Request',
    modal_revive: 'Purchasing Ticket - Revive',
    modal_new_item_preorder: 'Purchasing Ticket - New DB Request',
    modal_kompen: 'Purchasing Ticket - Kompensasi',
    // Digital Design
    modal_mulmed_kolase: 'Multimedia Ticket - Kolase',
    modal_mulmed_singpost: 'Multimedia Ticket - Singpost',
    modal_mulmed_announcement: 'Multimedia Ticket - Announcement',
    modal_mulmed_monthly_design: 'Multimedia Ticket - Monthly Design',
    modal_mulmed_other: 'Multimedia Ticket - Other',
    // Single Printing
    modal_mulmed_store_design: 'Multimedia Ticket - Store Design',
    modal_mulmed_standee: 'Multimedia Ticket - Standee',
    modal_mulmed_banner: 'Multimedia Ticket - Banner',
    modal_mulmed_wallpaper: 'Multimedia Ticket - Wallpaper',
    modal_mulmed_other_print: 'Multimedia Ticket - Other Printing',
    // Offset Printing
    modal_mulmed_brosur: 'Multimedia Ticket - Brosur',
    modal_mulmed_kipas: 'Multimedia Ticket - Kipas',
    modal_mulmed_postcard: 'Multimedia Ticket - Postcard',
    modal_mulmed_sticker: 'Multimedia Ticket - Sticker',
    modal_mulmed_paper_bag: 'Multimedia Ticket - Paper Bag',
    modal_mulmed_dus_kyou: 'Multimedia Ticket - Dus Kyou',
    modal_mulmed_other_offset: 'Multimedia Ticket - Other Offset',
    // Promotional Design
    modal_mulmed_thematic_sale: 'Multimedia Ticket - Thematic Sale',
    modal_mulmed_sp_sale: 'Multimedia Ticket - SP Sale',
    modal_mulmed_campaign: 'Multimedia Ticket - Campaign',
    modal_mulmed_give_away: 'Multimedia Ticket - Give Away',
    // Event Design
    modal_mulmed_event: 'Multimedia Ticket - Event',
    modal_mulmed_project: 'Multimedia Ticket - Project',
    // Foto Fisik
    modal_mulmed_foto_fisik: 'Multimedia Ticket - Foto Fisik',
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

function buildStoredTicketNotes(fields) {
  const noteSections = [];

  if (fields.notes) noteSections.push(`Notes: ${fields.notes}`);
  if (fields.brief) noteSections.push(`Brief: ${fields.brief}`);
  if (fields.additional_output) noteSections.push(`Additional Output: ${fields.additional_output}`);
  if (fields.additional) noteSections.push(`Additional: ${fields.additional}`);

  if (noteSections.length === 0) {
    return null;
  }

  return noteSections.join('\n\n').slice(0, 1000);
}

function getChannelForTicket(modalId) {
  // For warehouse modals with tempId suffix (format: modal_wh_<subtype>_<tempId>)
  // Remove the tempId suffix to get the base modalId
  let lookupModalId = modalId;
  if (modalId.startsWith('modal_wh_') && modalId.split('_').length > 3) {
    const parts = modalId.split('_');
    parts.pop(); // Remove tempId
    lookupModalId = parts.join('_');
  }

  const channelMap = {
    modal_eta_ppo: process.env.CHANNEL_PPO,
    modal_eta_ureq: process.env.CHANNEL_UREQ,
    modal_restock: process.env.CHANNEL_PST,
    modal_revive: process.env.CHANNEL_REVIVE,
    modal_new_item_preorder: process.env.CHANNEL_PPO,
    modal_kompen: process.env.CHANNEL_KOMPEN,
    // Multimedia channels (with modal_ prefix)
    // Digital Design sub-types (with modal_ prefix)
    modal_mulmed_kolase: process.env.CHANNEL_KOLASE,
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
    // Foto Fisik
    modal_mulmed_foto_fisik: process.env.CHANNEL_FOFIS,
    // Warehouse channels
    modal_wh_omega: process.env.CHANNEL_CEKFISIK,
    modal_wh_delta: process.env.CHANNEL_CEKFISIK,
    modal_wh_ss: process.env.CHANNEL_CEKFISIK,
    modal_wh_op: process.env.CHANNEL_CEKFISIK,
    modal_wh_wsr: process.env.CHANNEL_PINDAHFISIK,
    modal_wh_pickup_pelunasan: process.env.CHANNEL_PINDAHFISIK,
    modal_wh_return_monitor: process.env.CHANNEL_PINDAHFISIK,
    modal_wh_bde: process.env.CHANNEL_PINDAHFISIK,
    modal_wh_dachi: process.env.CHANNEL_WHPICK,
    modal_wh_give_away: process.env.CHANNEL_WHPICK,
    modal_wh_pick_other: process.env.CHANNEL_WHPICK,
    modal_wh_ws_kor: process.env.CHANNEL_WHSTOCKMANAGEMENT,
    modal_wh_adjust_stock_qty: process.env.CHANNEL_WHSTOCKMANAGEMENT,
    modal_wh_adjust_stock_transfer: process.env.CHANNEL_WHSTOCKMANAGEMENT,
  };
  return channelMap[lookupModalId];
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
        // If missing access, mark ticket as closed and skip silently
        if (err.code === 50001 || err.message.includes('Missing Access')) {
          await db.updateRows('purchasing_tickets', { id: ticket.id }, { status: 'closed' })
            .catch(() => {});
          continue;
        }
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
