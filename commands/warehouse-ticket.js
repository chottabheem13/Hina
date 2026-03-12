const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wh-ticket')
    .setDescription('Create a warehouse ticket'),

  async execute(interaction) {
    // Main category dropdown
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('warehouse_category_select')
      .setPlaceholder('Select warehouse ticket category...')
      .addOptions([
        {
          label: 'Cek Fisik (O/SS/D/OP)',
          value: 'cek_fisik',
          description: 'Permintaan cek fisik untuk memastikan ketersediaan stock dan mengecek kondisi stock',
        },
        {
          label: 'Pindah Fisik (WSR, Pickup, Retur & BDE)',
          value: 'pindah_fisik',
          description: 'Semua tugas yang bersifat permintaan pindah fisik',
        },
        {
          label: 'Pick Request (Dachi, GiveAway & Other)',
          value: 'wh_pick',
          description: 'Semua tugas yang bersifat permintaan keluar barang',
        },
        {
          label: 'WH Stock Management',
          value: 'wh_stock_mgmt',
          description: 'Permintaan Koreksi Stock/Stock Management/Tracing',
        },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: 'Select the type of warehouse ticket:',
      components: [row],
      ephemeral: true,
    });
  },
};
