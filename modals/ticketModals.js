const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');

function createModal(customId, title, fields) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

  const labelComponents = fields.map(field => {
    const label = new LabelBuilder()
      .setLabel(field.label)
      .setDescription(field.description || '');

    if (field.type === 'select') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(field.id)
        .setPlaceholder(field.placeholder || 'Make a selection')
        .setRequired(field.required ?? true);

      for (const option of field.options) {
        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(option.label)
            .setValue(option.value)
            .setDescription(option.description || '')
        );
      }
      label.setStringSelectMenuComponent(selectMenu);
    } else {
      const textInput = new TextInputBuilder()
        .setCustomId(field.id)
        .setPlaceholder(field.placeholder || '')
        .setRequired(field.required ?? true)
        .setStyle(field.style || TextInputStyle.Short);

      if (field.maxLength) textInput.setMaxLength(field.maxLength);
      label.setTextInputComponent(textInput);
    }

    return label;
  });

  modal.addLabelComponents(...labelComponents);

  return modal;
}

const modals = {
  eta_ppo: () =>
    createModal('modal_eta_ppo', 'ETA Ticket (PPO/PST)', [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select the priority level for this request',
        type: 'select',
        placeholder: 'Select priority',
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'item_id', label: 'Item ID', description: 'Enter the item ID', placeholder: 'Enter item ID' },
      { id: 'order_id', label: 'Order ID', description: 'Enter the order ID', placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Notes', description: 'Additional notes (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ]),

  eta_ureq: () =>
    createModal('modal_eta_ureq', 'ETA Ticket (UREQ)', [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select the priority level for this request',
        type: 'select',
        placeholder: 'Select priority',
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'order_id', label: 'Order ID', description: 'Enter the order ID', placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Notes', description: 'Additional notes (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ]),

  restock: () =>
    createModal('modal_restock', 'Restock Ticket', [
      { id: 'item_id', label: 'Item ID', placeholder: 'Enter item ID' },
      { id: 'order_id', label: 'Order ID', placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Notes', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ]),

  revive: () =>
    createModal('modal_revive', 'Revive Ticket', [
      { id: 'item_id', label: 'Item ID', placeholder: 'Enter item ID' },
      { id: 'notes', label: 'Notes', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ]),

  new_item: () =>
    createModal('modal_new_item', 'New Item Request', [
      { id: 'notes', label: 'Item Description', style: TextInputStyle.Paragraph, placeholder: 'Describe the item...' },
      { id: 'link', label: 'Link (optional)', required: false, placeholder: 'https://...' },
    ]),

  kompen: () =>
    createModal('modal_kompen', 'Kompensasi Ticket', [
      { id: 'notes', label: 'Description', style: TextInputStyle.Paragraph, placeholder: 'Describe the defect/damage...' },
    ]),
};

const closeTicketModal = () =>
  createModal('modal_close_ticket', 'Close Ticket', [
    { id: 'rating', label: 'Rating (1-5)', placeholder: '1, 2, 3, 4, or 5', maxLength: 1 },
    { id: 'feedback', label: 'Feedback', style: TextInputStyle.Paragraph, required: false, placeholder: 'How was your experience?' },
  ]);

const createFeedbackModal = (feedbackId, assigneeId, assigneeName, current, total) =>
  createModal(`modal_feedback_${feedbackId}_${assigneeId}`, `Rate ${assigneeName} (${current}/${total})`, [
    { id: 'rating', label: 'Rating (1-5)', placeholder: '1, 2, 3, 4, or 5', maxLength: 1 },
    { id: 'feedback', label: 'Feedback', style: TextInputStyle.Paragraph, required: false, placeholder: `How was ${assigneeName}'s service?` },
  ]);

module.exports = { modals, closeTicketModal, createFeedbackModal };
