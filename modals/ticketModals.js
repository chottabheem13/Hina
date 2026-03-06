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
      .setLabel(field.label);

    if (field.description) {
      label.setDescription(field.description);
    }

    if (field.type === 'select') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(field.id)
        .setPlaceholder(field.placeholder || 'Make a selection')
        .setRequired(field.required ?? true);

      for (const option of field.options) {
        const optionBuilder = new StringSelectMenuOptionBuilder()
          .setLabel(option.label)
          .setValue(option.value);
        if (option.description) {
          optionBuilder.setDescription(option.description);
        }
        selectMenu.addOptions(optionBuilder);
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

// Helper to create staff select field
function createStaffField(staffOptions) {
  if (!staffOptions || staffOptions.length === 0) {
    return null;
  }
  return {
    id: 'assigned_to',
    label: 'Assign To',
    description: 'Select staff to handle this ticket',
    type: 'select',
    placeholder: 'Select staff...',
    options: staffOptions,
  };
}

const modals = {
  eta_ppo: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select the priority level (optional, defaults to Normal)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'item_id', label: 'Item ID', description: 'Enter the item ID (optional)', required: false, placeholder: 'Enter item ID' },
      { id: 'order_id', label: 'Order ID', description: 'Enter the order ID', placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Notes', description: 'Additional notes (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_eta_ppo', 'Purchasing Ticket - ETA (General)', fields);
  },

  eta_ureq: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select the priority level (optional, defaults to Normal)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'order_id', label: 'Order ID', description: 'Enter the order ID', placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Notes', description: 'Additional notes (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_eta_ureq', 'Purchasing Ticket - ETA (UREQ)', fields);
  },

  restock: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select the priority level (optional, defaults to Normal)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'item_id', label: 'Item ID', description: 'Enter the item ID', placeholder: 'Enter item ID' },
      { id: 'order_id', label: 'Order ID', description: 'Enter the order ID (optional)', required: false, placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Notes', description: 'Additional notes (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_restock', 'Purchasing Ticket - Restock Request', fields);
  },

  revive: (staffOptions = []) => {
    const fields = [
      { id: 'item_id', label: 'Item ID', description: 'Enter the item ID', placeholder: 'Enter item ID' },
      { id: 'notes', label: 'Notes', description: 'Additional notes (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional notes...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_revive', 'Purchasing Ticket - Revive', fields);
  },

  new_item_preorder: (staffOptions = []) => {
    const fields = [
      { id: 'notes', label: 'Item Description', description: 'Describe the pre-order item you want', style: TextInputStyle.Paragraph, placeholder: 'Describe the item...' },
      { id: 'link', label: 'Link (optional)', description: 'Provide a link if available', required: false, placeholder: 'https://...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_new_item_preorder', 'Purchasing Ticket - New DB Request', fields);
  },


  kompen: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select the priority level (optional, defaults to Normal)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'order_id', label: 'Order ID', description: 'Enter the order ID', placeholder: 'Enter order ID' },
      { id: 'notes', label: 'Description', description: 'Describe the defect or damage', style: TextInputStyle.Paragraph, placeholder: 'Describe the defect/damage...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_kompen', 'Purchasing Ticket - Kompensasi', fields);
  },
};

const closeTicketModal = () =>
  createModal('modal_close_ticket', 'Close Ticket', [
    {
      id: 'rating',
      label: 'Rating',
      description: 'Rate your experience from 1 to 5',
      type: 'select',
      placeholder: 'Select a rating...',
      options: [
        { label: '⭐', value: '1', description: 'Tidak puas' },
        { label: '⭐⭐', value: '2', description: 'Kurang puas' },
        { label: '⭐⭐⭐', value: '3', description: 'Cukup' },
        { label: '⭐⭐⭐⭐', value: '4', description: 'Puas' },
        { label: '⭐⭐⭐⭐⭐', value: '5', description: 'Sangat puas' },
      ],
    },
    { id: 'feedback', label: 'Feedback', description: 'Share your feedback (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'How was your experience?' },
  ]);

const createFeedbackModal = (feedbackId, assigneeId, assigneeName, current, total) =>
  createModal(`modal_feedback_${feedbackId}_${assigneeId}`, `Rate ${assigneeName} (${current}/${total})`, [
    {
      id: 'rating',
      label: 'Rating',
      description: `Rate ${assigneeName}'s service from 1 to 5`,
      type: 'select',
      placeholder: 'Select a rating...',
      options: [
        { label: '⭐', value: '1', description: 'Tidak puas' },
        { label: '⭐⭐', value: '2', description: 'Kurang puas' },
        { label: '⭐⭐⭐', value: '3', description: 'Cukup' },
        { label: '⭐⭐⭐⭐', value: '4', description: 'Puas' },
        { label: '⭐⭐⭐⭐⭐', value: '5', description: 'Sangat puas' },
      ],
    },
    { id: 'feedback', label: 'Feedback', description: 'Share your feedback (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: `How was ${assigneeName}'s service?` },
  ]);

module.exports = { modals, closeTicketModal, createFeedbackModal };
