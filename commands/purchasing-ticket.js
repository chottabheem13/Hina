const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

const TICKET_TYPES = [
  { label: 'ETA (PO)', value: 'eta_ppo', description: 'Tolong cek Estimasi Order / Item (Pre-order)' },
  { label: 'ETA (UREQ)', value: 'eta_ureq', description: 'Tolong cek Estimasi Unique Request user dong' },
  { label: 'Restock', value: 'restock', description: 'Tolong cek Itemnya bisa di Restock kah?' },
  { label: 'Revive', value: 'revive', description: 'Tolong cek bisa di Revive / Late-PO kah?' },
  { label: 'New Item (Pre-order)', value: 'new_item_preorder', description: 'Mau Request Kompre Item terbaru dong' },
  { label: 'Kompensasi', value: 'kompen', description: 'Mau laporan ada cacat nih di item yang diorder user' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purchasing-ticket')
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
