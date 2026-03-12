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
function createStaffField(staffOptions, specialNote = null) {
  if (!staffOptions || staffOptions.length === 0) {
    return null;
  }
  const description = specialNote
    ? `Select staff to handle this ticket (Specialist: ${specialNote})`
    : 'Select staff to handle this ticket';
  return {
    id: 'assigned_to',
    label: 'Assign To',
    description,
    type: 'select',
    placeholder: 'Select staff...',
    minValues: 1,
    maxValues: Math.min(staffOptions.length, 10),
    options: staffOptions,
  };
}

function createCustomStaffField(staffOptions, description) {
  if (!staffOptions || staffOptions.length === 0) {
    return null;
  }
  return {
    id: 'assigned_to',
    label: 'Assign To',
    description,
    type: 'select',
    placeholder: 'Select staff...',
    minValues: 1,
    maxValues: Math.min(staffOptions.length, 10),
    options: staffOptions,
  };
}

// Helper to create store name select field
function createStoreNameField(required = true) {
  return {
    id: 'store_name',
    label: 'Store Name',
    description: required ? 'Select store (required)' : 'Select store (optional)',
    type: 'select',
    placeholder: 'Select store...',
    required,
    options: [
      { label: 'Alpha', value: 'alpha', description: 'Alpha Store' },
      { label: 'Beta', value: 'beta', description: 'Beta Store' },
      { label: 'Gamma', value: 'gamma', description: 'Gamma Store' },
    ],
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
  kolase: (staffOptions = [], specialNote = null) => {
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
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_kolase', 'Multimedia Ticket - Kolase', fields);
  },

  singpost: (staffOptions = [], specialNote = null) => {
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
      { id: 'link', label: 'Link', description: 'Provide reference link', required: true, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Brief description...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Describe additional output requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional output requirements...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_singpost', 'Multimedia Ticket - Singpost', fields);
  },

  announcement: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Detailed Announcement Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Detailed announcement brief...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Describe additional output requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional output requirements...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_announcement', 'Multimedia Ticket - Announcement', fields);
  },

  monthly_design: (staffOptions = [], specialNote = null) => {
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
      { id: 'link', label: 'Visual Asset Link', description: 'Provide reference link (optional)', required: true, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Brief description...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Describe additional output requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional output requirements...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_monthly_design', 'Multimedia Ticket - Monthly Design', fields);
  },

  other: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Brief description...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Describe additional output requirements (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Additional output requirements...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_other', 'Multimedia Ticket - Other', fields);
  },

  // Single Printing sub-types
  store_design: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your store design requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Describe your store design...' },
      { id: 'size', label: 'Size', description: 'Enter the store design size', required: true, placeholder: 'Example: 120 x 200 cm' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_store_design', 'Multimedia Ticket - Store Design', fields);
  },

  standee: (staffOptions = [], specialNote = null) => {
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
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_standee', 'Multimedia Ticket - Standee', fields);
  },

  banner: (staffOptions = [], specialNote = null) => {
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
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_banner', 'Multimedia Ticket - Banner', fields);
  },

  wallpaper: (staffOptions = [], specialNote = null) => {
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
      { id: 'size', label: 'Size', description: 'Bila tidak tahu, kosongkan.', required: false, placeholder: 'Kirim foto letak pemasangan wallpapernya di thread yang terbentuk' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_wallpaper', 'Multimedia Ticket - Wallpaper', fields);
  },

  other_print: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements, size & additional output (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Describe your request including size and additional output...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_other_print', 'Multimedia Ticket - Other Printing', fields);
  },

  // Offset Printing sub-types
  brosur: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size + QTY', description: 'Enter the size and quantity', required: true, placeholder: 'Example: A4, 500 pcs' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_brosur', 'Multimedia Ticket - Brosur', fields);
  },

  kipas: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements & QTY', style: TextInputStyle.Paragraph, placeholder: 'Describe your request including quantity...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_kipas', 'Multimedia Ticket - Kipas', fields);
  },

  postcard: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size + QTY', description: 'Enter the size and quantity (optional)', required: false, placeholder: 'Example: A6, 100 pcs' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_postcard', 'Multimedia Ticket - Postcard', fields);
  },

  sticker: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size + QTY', description: 'Enter the size and quantity (optional)', required: false, placeholder: 'Example: 5 x 5 cm, 100 pcs' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_sticker', 'Multimedia Ticket - Sticker', fields);
  },

  paper_bag: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size + QTY', description: 'Enter the size and quantity (optional)', required: false, placeholder: 'Example: 30 x 40 cm, 100 pcs' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_paper_bag', 'Multimedia Ticket - Paper Bag', fields);
  },

  dus_kyou: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements', style: TextInputStyle.Paragraph, required: true, placeholder: 'Describe your request...' },
      { id: 'size_qty', label: 'Size + QTY', description: 'Enter the size and quantity (optional)', required: false, placeholder: 'Example: 30 x 40 x 10 cm, 100 pcs' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_dus_kyou', 'Multimedia Ticket - Dus Kyou', fields);
  },

  other_offset: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements, size, QTY & additional output (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Describe your request including size, quantity, and additional output...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_other_offset', 'Multimedia Ticket - Other Offset', fields);
  },

  // Promotional Design sub-types
  thematic_sale: (staffOptions = [], specialNote = null) => {
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
      { id: 'link', label: 'Link Hero Products', description: 'Reference link (optional)', required: true, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Mohon tulis brief design, dan referensi bila ada', style: TextInputStyle.Paragraph, placeholder: 'Describe your request, deadline (include Hero Link): DD/MM/YYYY, size/placement, additional info...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Tulis daftar output design yang kamu harapkan', style: TextInputStyle.Paragraph, required: false, placeholder: 'Example: Feed 1:1, story 9:16, banner website, etc...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_thematic_sale', 'Multimedia Ticket - Thematic Sale', fields);
  },

  sp_sale: (staffOptions = [], specialNote = null) => {
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
      { id: 'link', label: 'Link Reference', description: 'Reference link (optional)', required: true, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Your requirements (Hero Link wajib), deadline & info', style: TextInputStyle.Paragraph, placeholder: 'Describe your request (include Hero Link), deadline: DD/MM/YYYY, size/placement, additional info...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Tulis daftar output design yang kamu harapkan', style: TextInputStyle.Paragraph, required: false, placeholder: 'Example: Feed 1:1, story 9:16, banner website, etc...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_sp_sale', 'Multimedia Ticket - SP Sale', fields);
  },

  campaign: (staffOptions = [], specialNote = null) => {
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
      { id: 'link', label: 'Link Hero Products', description: 'Reference link', required: true, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Your requirements, deadline & info', style: TextInputStyle.Paragraph, placeholder: 'Describe your request, deadline: DD/MM/YYYY, size/placement, additional info...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Tulis daftar output design yang kamu harapkan', style: TextInputStyle.Paragraph, required: false, placeholder: 'Example: Feed 1:1, story 9:16, banner website, etc...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_campaign', 'Multimedia Ticket - Campaign', fields);
  },

  give_away: (staffOptions = [], specialNote = null) => {
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
      { id: 'link', label: 'Link Hero Products', description: 'Reference link', required: true, placeholder: 'https://...' },
      { id: 'brief', label: 'Brief', description: 'Your requirements, deadline & info', style: TextInputStyle.Paragraph, placeholder: 'Describe your request, deadline: DD/MM/YYYY, size/placement, additional info...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Tulis daftar output design yang kamu harapkan', style: TextInputStyle.Paragraph, required: false, placeholder: 'Example: Feed 1:1, story 9:16, banner website, etc...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_give_away', 'Multimedia Ticket - Give Away', fields);
  },

  // Event Design sub-types
  event: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements, deadline & info', style: TextInputStyle.Paragraph, placeholder: 'Describe your request, deadline: DD/MM/YYYY, size/scope, additional info...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Mohon tulis daftar output design yang kamu harapkan', style: TextInputStyle.Paragraph, required: false, placeholder: 'Example: Feed 1:1, story 9:16, banner website, etc...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_event', 'Multimedia Ticket - Event', fields);
  },

  project: (staffOptions = [], specialNote = null) => {
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
      { id: 'brief', label: 'Brief', description: 'Describe your requirements, deadline & info (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Describe your request, deadline: DD/MM/YYYY, size/scope, additional info...' },
      { id: 'additional_output', label: 'Additional Output', description: 'Mohon tulis daftar output design yang kamu harapkan', style: TextInputStyle.Paragraph, required: false, placeholder: 'Example: Feed 1:1, story 9:16, banner website, etc...' },
    ];
    const staffField = createStaffField(staffOptions, specialNote);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_project', 'Multimedia Ticket - Project', fields);
  },

  foto_fisik: (staffOptions = []) => {
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
    ];
    const staffField = createStaffField(staffOptions);
    if (staffField) fields.push(staffField);
    return createModal('modal_mulmed_foto_fisik', 'Multimedia Ticket - Foto Fisik', fields);
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

// Create edit ticket modal with staff selection
const createEditTicketModal = (threadId, staffOptions, currentAssigneeIds = []) => {
  const fields = [
    {
      id: 'assigned_to',
      label: 'Assign To',
      description: 'Select staff to handle this ticket',
      type: 'select',
      placeholder: 'Select staff...',
      minValues: 1,
      maxValues: Math.min(staffOptions.length, 10),
      options: staffOptions,
    },
    {
      id: 'edit_notes',
      label: 'Edit Notes',
      description: 'Reason for changes (optional)',
      style: TextInputStyle.Paragraph,
      required: false,
      placeholder: 'Explain why you are making these changes...',
    },
  ];
  return createModal(`modal_edit_ticket_${threadId}`, 'Edit Ticket Assignee', fields);
};

// ===== WAREHOUSE TICKET MODALS =====

// Cek Fisik Sub-types (Omega, Delta, SS, OP)
const wh_omega = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (required)', placeholder: 'Paste Item ID' },
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (optional)', required: false, placeholder: 'Paste Order ID' },
    { id: 'note', label: 'Note', description: 'Tulis catatan, serta nama user yang perlu difollow up', style: TextInputStyle.Paragraph, required: false, placeholder: 'Catatan tambahan untuk Omega...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Ikmal, Irwan, Rexy (Baito))');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_omega_${tempId}`, 'Cek Fisik - Omega', fields);
};

const wh_delta = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (required)', placeholder: 'Paste Item ID' },
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (optional)', required: false, placeholder: 'Paste Order ID' },
    { id: 'note', label: 'Note', description: 'Tulis catatan, serta nama user yang perlu difollow up', style: TextInputStyle.Paragraph, required: false, placeholder: 'Catatan tambahan untuk Delta...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Jonathan)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_delta_${tempId}`, 'Cek Fisik - Delta', fields);
};

const wh_ss = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (required)', placeholder: 'Paste Item ID' },
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (optional)', required: false, placeholder: 'Paste Order ID' },
    { id: 'note', label: 'Note', description: 'Tulis catatan, serta nama user yang perlu difollow up', style: TextInputStyle.Paragraph, required: false, placeholder: 'Catatan tambahan untuk SS...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Ikmal, Irwan, Rexy (Baito))');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_ss_${tempId}`, 'Cek Fisik - SS', fields);
};

const wh_op = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (required)', placeholder: 'Paste Item ID' },
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (optional)', required: false, placeholder: 'Paste Order ID' },
    { id: 'note', label: 'Note', description: 'Tulis catatan, serta nama user yang perlu difollow up', style: TextInputStyle.Paragraph, required: false, placeholder: 'Catatan tambahan untuk OP...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Jonathan)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_op_${tempId}`, 'Cek Fisik - OP', fields);
};

// Pindah Fisik Sub-types
const wh_wsr = (staffOptions = [], tempId = '') => {
  const fields = [
    createStoreNameField(true),
    { id: 'batch', label: 'Batch', description: 'Sheet name', placeholder: 'Copy Sheet Name WSR Toko-mu' },
    { id: 'note', label: 'Note', description: 'Additional notes (optional)', style: TextInputStyle.Paragraph, required: false, placeholder: 'Catatan tambahan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Agmo)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_wsr_${tempId}`, 'Warehouse Ticket - WSR', fields);
};

const wh_pickup_pelunasan = (staffOptions = [], tempId = '') => {
  const fields = [
    createStoreNameField(true),
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (required)', placeholder: 'Tulis Order ID' },
    { id: 'note', label: 'Note', description: 'Tulis nama user dan sosmed untuk mempermudah follow up', style: TextInputStyle.Paragraph, required: false, placeholder: 'Catatan tambahan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Alvito)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_pickup_pelunasan_${tempId}`, 'Warehouse Ticket - Pickup Pelunasan', fields);
};

const wh_return_monitor = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (required)', placeholder: 'Tulis Order ID' },
    { id: 'note', label: 'Note', description: 'Mohon tulis apa yang harus WH lakukan ketika retur tiba', style: TextInputStyle.Paragraph, placeholder: 'Catatan / keterangan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Alvito)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_return_monitor_${tempId}`, 'Warehouse Ticket - Retur Monitor', fields);
};

const wh_bde = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'batch', label: 'Sheet Link', description: 'Mohon paste sheet link', placeholder: 'https://...' },
    { id: 'note', label: 'Note', description: 'Mohon tulis bila ada intruksi khusus untuk Pindah fisik BDE', style: TextInputStyle.Paragraph, required: false, placeholder: 'Catatan tambahan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Alvito & Agmo)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_bde_${tempId}`, 'Warehouse Ticket - BDE', fields);
};

// WH Pick Sub-types
const wh_dachi = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (required)', placeholder: 'Tulis Item ID disini, (boleh lebih dari 1)' },
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (optional)', required: false, placeholder: 'Tulis Order ID disini, kosongkan bila belum order' },
    { id: 'notes', label: 'Notes', description: 'Mohon tulis keterangan tambahan bila ada', style: TextInputStyle.Paragraph, required: false, placeholder: 'Catatan tambahan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff specialist for WH Pick - Giveaway');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_dachi_${tempId}`, 'Warehouse Ticket - Dachi', fields);
};

const wh_give_away = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (required)', placeholder: 'Tulis Item ID disini, (boleh lebih dari 1)' },
    { id: 'notes', label: 'Notes', description: 'Mohon tulis keterangan tambahan bila ada', style: TextInputStyle.Paragraph, placeholder: 'Catatan / keterangan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Irwan & Ikmal)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_give_away_${tempId}`, 'Warehouse Ticket - Giveaway', fields);
};

const wh_pick_other = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (required)', placeholder: 'Tulis Item ID disini, (boleh lebih dari 1)' },
    { id: 'notes', label: 'Notes', description: 'Mohon tulis keterangan tambahan bila ada', style: TextInputStyle.Paragraph, placeholder: 'Catatan / keterangan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Irwan & Ikmal)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_pick_other_${tempId}`, 'Warehouse Ticket - Other', fields);
};

// WH Stock Management Sub-types
const wh_ws_kor = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (Can Enter more than 1)', placeholder: 'Tulis Item ID disini' },
    { id: 'notes', label: 'Notes', description: 'Mohon tulis keterangan sedetail mungkin', style: TextInputStyle.Paragraph, placeholder: 'Catatan / keterangan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Alvito & Cindy)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_ws_kor_${tempId}`, 'Warehouse Ticket - WS Kor', fields);
};

const wh_adjust_stock_qty = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (Can be more than 1)', placeholder: 'Tulis Item ID disini' },
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (optional)', required: false, placeholder: 'Tulis Order ID disini' },
    { id: 'notes', label: 'Notes', description: 'Mohon tulis keterangan sedetail mungkin', style: TextInputStyle.Paragraph, placeholder: 'Catatan / keterangan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Alvito & Cindy)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_adjust_stock_qty_${tempId}`, 'Warehouse Ticket - Adjust Stock (QTY)', fields);
};

const wh_adjust_stock_transfer = (staffOptions = [], tempId = '') => {
  const fields = [
    { id: 'item_id', label: 'Item ID', description: 'Enter Item ID (Can be more than 1)', placeholder: 'Tulis Item ID disini' },
    { id: 'order_id', label: 'Order ID', description: 'Enter Order ID (optional)', required: false, placeholder: 'Tulis Order ID disini' },
    { id: 'notes', label: 'Notes', description: 'Mohon tulis keterangan sedetail mungkin', style: TextInputStyle.Paragraph, placeholder: 'Catatan / keterangan...' },
  ];
  const staffField = createCustomStaffField(staffOptions, 'Select staff to handle this ticket (Specialist: Alvito & Cindy)');
  if (staffField) fields.push(staffField);
  return createModal(`modal_wh_adjust_stock_transfer_${tempId}`, 'Warehouse Ticket - Adjust Stock (Transfer)', fields);
};

// Add warehouse modals to the modals object
Object.assign(modals, {
  wh_omega, wh_delta, wh_ss, wh_op,
  wh_wsr, wh_pickup_pelunasan, wh_return_monitor, wh_bde,
  wh_dachi, wh_give_away, wh_pick_other,
  wh_ws_kor, wh_adjust_stock_qty, wh_adjust_stock_transfer,
});

// Warehouse feedback modal
const createWarehouseFeedbackModal = (feedbackId, assigneeId, assigneeName, current, total) =>
  createModal(`modal_wh_feedback_${feedbackId}_${assigneeId}`, `Rate ${assigneeName} (${current}/${total})`, [
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

module.exports = { modals, closeTicketModal, createFeedbackModal, createEditTicketModal, createWarehouseFeedbackModal };
