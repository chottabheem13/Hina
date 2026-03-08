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

      // Set min and max values if provided
      if (field.minValues !== undefined) selectMenu.setMinValues(field.minValues);
      if (field.maxValues !== undefined) selectMenu.setMaxValues(field.maxValues);

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
    minValues: 1,
    maxValues: Math.min(staffOptions.length, 10),
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

  // Multimedia tickets - Digital Design sub-types
  kolase: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Brief description...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_kolase', 'Multimedia Ticket - Kolase', fields);
  },

  singpost: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Brief description...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Additional requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional output requirements...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_singpost', 'Multimedia Ticket - Singpost', fields);
  },

  announcement: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Brief description...' },
      { id: 'additional', label: 'Additional', description: 'Additional requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional requirements...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_announcement', 'Multimedia Ticket - Announcement', fields);
  },

  monthly_design: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Brief description...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Additional requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional output requirements...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_monthly_design', 'Multimedia Ticket - Monthly Design', fields);
  },

  other: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select priority (optional)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'link', label: 'Link', description: 'Reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Your requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Brief description...' },
      { id: 'additional', label: 'Additional', description: 'Additional & output requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional info, output specs, etc...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_other', 'Multimedia Ticket - Other', fields);
  },

  // Single Printing sub-types
  store_design: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your store design requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your store design request...' },
      { id: 'size', label: 'Size', description: 'Specify the size', placeholder: 'e.g., 2x3 meters, A1, etc.' },
      { id: 'additional_output', label: 'Additional Output', description: 'Additional output requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional output requirements...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_store_design', 'Multimedia Ticket - Store Design', fields);
  },

  standee: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link', placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your standee requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your standee request...' },
      { id: 'size', label: 'Size', description: 'Specify the size (optional)', required: false, placeholder: 'e.g., 160x60cm, etc.' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_standee', 'Multimedia Ticket - Standee', fields);
  },

  banner: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your banner requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your banner request...' },
      { id: 'size', label: 'Size', description: 'Specify the size', placeholder: 'e.g., 3x1 meters, etc.' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_banner', 'Multimedia Ticket - Banner', fields);
  },

  wallpaper: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your wallpaper requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your wallpaper request...' },
      { id: 'size', label: 'Size', description: 'Specify the size', placeholder: 'e.g., 1920x1080, etc.' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_wallpaper', 'Multimedia Ticket - Wallpaper', fields);
  },

  other_print: (staffOptions = []) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Describe your request...' },
      { id: 'size', label: 'Size', description: 'Specify the size (optional)', required: false, placeholder: 'e.g., A4, custom, etc.' },
      { id: 'additional_output', label: 'Additional Output', description: 'Additional requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional info...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_other_print', 'Multimedia Ticket - Other Printing', fields);
  },

  // Offset Printing sub-types
  brosur: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size & QTY', description: 'Specify size and quantity', placeholder: 'e.g., A5 - 1000 pcs' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_brosur', 'Multimedia Ticket - Brosur', fields);
  },

  kipas: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size & QTY', description: 'Specify size and quantity', placeholder: 'e.g., 30cm - 500 pcs' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_kipas', 'Multimedia Ticket - Kipas', fields);
  },

  postcard: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size & QTY', description: 'Specify size and quantity', placeholder: 'e.g., 10x15cm - 200 pcs' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_postcard', 'Multimedia Ticket - Postcard', fields);
  },

  sticker: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size & QTY', description: 'Specify size and quantity', placeholder: 'e.g., 5cm - 1000 pcs' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_sticker', 'Multimedia Ticket - Sticker', fields);
  },

  paper_bag: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size & QTY', description: 'Specify size and quantity', placeholder: 'e.g., Medium - 500 pcs' },
      { id: 'additional_output', label: 'Additional Output', description: 'Additional requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional requirements...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_paper_bag', 'Multimedia Ticket - Paper Bag', fields);
  },

  dus_kyou: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size & QTY', description: 'Specify size and quantity', placeholder: 'e.g., 10x10x5cm - 200 pcs' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_dus_kyou', 'Multimedia Ticket - Dus Kyou', fields);
  },

  other_offset: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Provide reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size & QTY', description: 'Specify size and quantity (optional)', required: false, placeholder: 'e.g., Custom - 100 pcs' },
      { id: 'additional_output', label: 'Additional Output', description: 'Additional requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional requirements...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_other_offset', 'Multimedia Ticket - Other Offset', fields);
  },

  // Promotional Design sub-types
  thematic_sale: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select priority level (optional, defaults to Normal)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'link', label: 'Link Reference', description: 'Reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Your requirements (Hero Link wajib)', style: TextInputStyle.Paragraph, placeholder: 'Describe your request (include Hero Link)...' },
      { id: 'deadline_info', label: 'Deadline / Info', description: 'Deadline, size/placement, additional info', style: TextInputStyle.Paragraph, placeholder: 'Deadline: DD/MM/YYYY, Size/Placement, additional info...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_thematic_sale', 'Multimedia Ticket - Thematic Sale', fields);
  },

  sp_sale: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select priority level (optional, defaults to Normal)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'link', label: 'Link Reference', description: 'Reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Your requirements (Hero Link wajib)', style: TextInputStyle.Paragraph, placeholder: 'Describe your request (include Hero Link)...' },
      { id: 'deadline_info', label: 'Deadline / Info', description: 'Deadline, size/placement, additional info', style: TextInputStyle.Paragraph, placeholder: 'Deadline: DD/MM/YYYY, Size/Placement, additional info...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_sp_sale', 'Multimedia Ticket - SP Sale', fields);
  },

  campaign: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select priority level (optional, defaults to Normal)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'link', label: 'Link Reference', description: 'Reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'deadline_info', label: 'Deadline / Info', description: 'Deadline, size/placement, additional info', style: TextInputStyle.Paragraph, placeholder: 'Deadline: DD/MM/YYYY, Size/Placement, additional info...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_campaign', 'Multimedia Ticket - Campaign', fields);
  },

  give_away: (staffOptions = []) => {
    const fields = [
      {
        id: 'priority',
        label: 'Priority',
        description: 'Select priority level (optional, defaults to Normal)',
        type: 'select',
        placeholder: 'Normal',
        required: false,
        options: [
          { label: 'Normal', value: 'normal', description: 'Standard priority' },
          { label: 'Urgent', value: 'urgent', description: 'High priority' },
        ]
      },
      { id: 'link', label: 'Link Reference', description: 'Reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'deadline_info', label: 'Deadline / Info', description: 'Deadline, size/placement, additional info', style: TextInputStyle.Paragraph, placeholder: 'Deadline: DD/MM/YYYY, Size/Placement, additional info...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_give_away', 'Multimedia Ticket - Give Away', fields);
  },

  // Event Design sub-types
  event: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'deadline_info', label: 'Deadline / Info', description: 'Deadline, size/scope, additional info', style: TextInputStyle.Paragraph, placeholder: 'Deadline: DD/MM/YYYY, Size/Scope, additional info...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_event', 'Multimedia Ticket - Event', fields);
  },

  project: (staffOptions = []) => {
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
      { id: 'link', label: 'Link Reference', description: 'Reference link (optional)', required: false, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, placeholder: 'Describe your request...' },
      { id: 'deadline_info', label: 'Deadline / Info', description: 'Deadline, size/scope, additional info (optional)', required: false, style: TextInputStyle.Paragraph, placeholder: 'Deadline: DD/MM/YYYY, Size/Scope, additional info...' },
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_project', 'Multimedia Ticket - Project', fields);
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
