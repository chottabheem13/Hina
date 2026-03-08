const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

const TICKET_TYPES = [
  { label: 'Digital Design', value: 'digital_design', description: 'Request digital design services' },
  { label: 'Single Printing', value: 'single_printing', description: 'Request single printing services' },
  { label: 'Offset Printing', value: 'offset_printing', description: 'Request offset printing services' },
  { label: 'Promotional Design', value: 'promotional_design', description: 'Request promotional design services' },
  { label: 'Event Design', value: 'event_design', description: 'Request event design services' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mulmed-ticket')
    .setDescription('Create a multimedia ticket'),

  async execute(interaction) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('mulmed_type_select')
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
