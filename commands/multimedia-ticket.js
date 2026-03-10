const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

const TICKET_TYPES = [
  { label: 'Digital Design', value: 'digital_design', description: 'Kolase, Singpost, Announcement, Monthly Design' },
  { label: 'Single Printing', value: 'single_printing', description: 'Store Design, Standee, Banner, Wallpaper, Other' },
  { label: 'Offset Printing', value: 'offset_printing', description: 'Brosur, Kipas, Postcard, Sticker, Pasper Bag, Dus Kyou, Other' },
  { label: 'Promotional Design', value: 'promotional_design', description: 'Thematic Sale, Special Sale, Campaign, Give Away' },
  { label: 'Event Design', value: 'event_design', description: 'Event, Project' },
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
