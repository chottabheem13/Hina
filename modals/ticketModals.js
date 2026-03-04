const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

function createModal(customId, title, fields) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

  for (const field of fields) {
    const textInput = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setStyle(field.style || TextInputStyle.Short)
      .setRequired(field.required ?? true)
      .setPlaceholder(field.placeholder || '');

    if (field.maxLength) textInput.setMaxLength(field.maxLength);
    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
  }

  return modal;
}

const modals = {
  eta_ppo: () =>
    createModal('modal_eta_ppo', 'ETA Ticket (PPO/PST)', [
      { id: 'priority', label: 'Priority (urgent/normal)', placeholder: 'urgent or normal' },
      { id: 'item_id', label: 'Item ID', placeholder: 'Enter item ID' },
      { id: 'order_id', label: 'Order ID', placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Notes', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ]),

  eta_ureq: () =>
    createModal('modal_eta_ureq', 'ETA Ticket (UREQ)', [
      { id: 'priority', label: 'Priority (urgent/normal)', placeholder: 'urgent or normal' },
      { id: 'order_id', label: 'Order ID', placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Notes', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
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
