const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

const TICKET_TYPES = [
  { label: 'ETA (PPO/PST)', value: 'eta_ppo', description: 'Check ETA of order/item' },
  { label: 'ETA (UREQ)', value: 'eta_ureq', description: 'Check ETA for UREQ orders' },
  { label: 'Restock', value: 'restock', description: 'Check restock status' },
  { label: 'Revive', value: 'revive', description: 'Check revive/late preorder' },
  { label: 'New Item', value: 'new_item', description: 'Request new pre-order' },
  { label: 'Kompensasi', value: 'kompen', description: 'Report defect/damage' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create a purchasing ticket'),

  async execute(interaction) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_type_select')
      .setPlaceholder('Select ticket type...')
      .addOptions(TICKET_TYPES);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: 'What type of ticket do you want to create?',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};
