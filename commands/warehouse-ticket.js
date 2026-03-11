const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warehouse-ticket')
    .setDescription('Create a warehouse ticket'),

  async execute(interaction) {
    // Main category dropdown
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('warehouse_category_select')
      .setPlaceholder('Select warehouse ticket category...')
      .addOptions([
        {
          label: 'Cek Fisik',
          value: 'cek_fisik',
          description: 'Physical stock checking',
        },
        {
          label: 'Pindah Fisik',
          value: 'pindah_fisik',
          description: 'Physical stock movement',
        },
        {
          label: 'WH PICK',
          value: 'wh_pick',
          description: 'Warehouse picking',
        },
        {
          label: 'WH Stock Management',
          value: 'wh_stock_mgmt',
          description: 'Warehouse stock management',
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
