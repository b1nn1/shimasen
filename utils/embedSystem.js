// utils/embedSystem.js
const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { 
  getEmbed, 
  setEmbed, 
  deleteEmbed, 
  loadEmbeds 
} = require('./dataManager.js');

/**
 * Build preview embed from data
 */
function buildPreviewEmbed(data) {
  const embed = new EmbedBuilder()
    .setColor(data.color || '#36393f')
    .setTitle(data.title || '')
    .setDescription(data.description || '');

  if (data.footer?.text) {
    embed.setFooter({ 
      text: data.footer.text, 
      iconURL: data.footer.icon || undefined 
    });
  }

  if (data.footer?.timestamp) {
    embed.setTimestamp();
  }

  if (data.author?.name) {
    embed.setAuthor({ 
      name: data.author.name, 
      iconURL: data.author.icon || undefined 
    });
  }

  if (data.image) embed.setImage(data.image);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  // Add fields if they exist
  if (data.fields && Array.isArray(data.fields)) {
    data.fields.forEach(field => {
      embed.addFields({
        name: field.name || 'Field',
        value: field.value || 'No value',
        inline: field.inline || false
      });
    });
  }

  return embed;
}

/**
 * Generate edit buttons for embed
 */
function getEditButtons(embedName) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_${embedName}_title`)
      .setLabel('Title')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`edit_${embedName}_description`)
      .setLabel('Description')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`edit_${embedName}_color`)
      .setLabel('Color')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`edit_${embedName}_more`)
      .setLabel('More')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Handle embed edit buttons
 */
async function handleEmbedEdit(interaction) {
  if (!interaction.isButton()) return false;

  const customId = interaction.customId;
  if (!customId.startsWith('edit_')) return false;

  const parts = customId.split('_');
  if (parts.length < 3) return false;

  const embedName = parts.slice(1, -1).join('_');
  const field = parts[parts.length - 1];

  const embedData = getEmbed(embedName);
  if (!embedData) {
    await interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
    return true;
  }

  // Handle different field types
  if (field === 'title') {
    const modal = new ModalBuilder()
      .setCustomId(`embed_modal_${embedName}_title`)
      .setTitle('Edit Embed Title');

    const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setValue(embedData.title || '')
      .setRequired(false)
      .setMaxLength(256);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (field === 'description') {
    const modal = new ModalBuilder()
      .setCustomId(`embed_modal_${embedName}_description`)
      .setTitle('Edit Embed Description');

    const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(embedData.description || '')
      .setRequired(false)
      .setMaxLength(4000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (field === 'color') {
    const modal = new ModalBuilder()
      .setCustomId(`embed_modal_${embedName}_color`)
      .setTitle('Edit Embed Color');

    const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel('Color (hex code)')
      .setStyle(TextInputStyle.Short)
      .setValue(embedData.color || '#fcdc79')
      .setPlaceholder('#fcdc79 or fcdc79')
      .setRequired(false)
      .setMaxLength(7);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (field === 'more') {
    const modal = new ModalBuilder()
      .setCustomId(`embed_modal_${embedName}_more`)
      .setTitle('Edit More Options');

    const imageInput = new TextInputBuilder()
      .setCustomId('image')
      .setLabel('Image URL')
      .setStyle(TextInputStyle.Short)
      .setValue(embedData.image || '')
      .setRequired(false);

    const thumbnailInput = new TextInputBuilder()
      .setCustomId('thumbnail')
      .setLabel('Thumbnail URL')
      .setStyle(TextInputStyle.Short)
      .setValue(embedData.thumbnail || '')
      .setRequired(false);

    const footerTextInput = new TextInputBuilder()
      .setCustomId('footer_text')
      .setLabel('Footer Text')
      .setStyle(TextInputStyle.Short)
      .setValue(embedData.footer?.text || '')
      .setRequired(false)
      .setMaxLength(2048);

    const footerIconInput = new TextInputBuilder()
      .setCustomId('footer_icon')
      .setLabel('Footer Icon URL')
      .setStyle(TextInputStyle.Short)
      .setValue(embedData.footer?.icon || '')
      .setRequired(false);

    const authorInput = new TextInputBuilder()
      .setCustomId('author')
      .setLabel('Author Name')
      .setStyle(TextInputStyle.Short)
      .setValue(embedData.author?.name || '')
      .setRequired(false)
      .setMaxLength(256);

    modal.addComponents(
      new ActionRowBuilder().addComponents(imageInput),
      new ActionRowBuilder().addComponents(thumbnailInput),
      new ActionRowBuilder().addComponents(footerTextInput),
      new ActionRowBuilder().addComponents(footerIconInput),
      new ActionRowBuilder().addComponents(authorInput)
    );
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

/**
 * Handle embed edit modals
 */
async function handleEmbedModal(interaction) {
  if (!interaction.isModalSubmit()) return false;

  const customId = interaction.customId;
  if (!customId.startsWith('embed_modal_')) return false;

  const parts = customId.split('_');
  if (parts.length < 4) return false;

  const embedName = parts.slice(2, -1).join('_');
  const field = parts[parts.length - 1];

  const embedData = getEmbed(embedName);
  if (!embedData) {
    await interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
    return true;
  }

  // Update based on field
  if (field === 'title') {
    embedData.title = interaction.fields.getTextInputValue('value');
  } else if (field === 'description') {
    embedData.description = interaction.fields.getTextInputValue('value');
  } else if (field === 'color') {
    let color = interaction.fields.getTextInputValue('value').trim();
    if (color && !color.startsWith('#')) color = '#' + color;
    embedData.color = color || '#fcdc79';
  } else if (field === 'more') {
    embedData.image = interaction.fields.getTextInputValue('image') || '';
    embedData.thumbnail = interaction.fields.getTextInputValue('thumbnail') || '';

    const footerText = interaction.fields.getTextInputValue('footer_text') || '';
    const footerIcon = interaction.fields.getTextInputValue('footer_icon') || '';
    embedData.footer = {
      text: footerText,
      icon: footerIcon,
      timestamp: embedData.footer?.timestamp || false
    };

    const authorName = interaction.fields.getTextInputValue('author') || '';
    embedData.author = {
      name: authorName,
      icon: embedData.author?.icon || ''
    };
  }

  // Save updated embed
  setEmbed(embedName, embedData);

  // Update the message with new preview
  try {
    const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
    await originalMessage.edit({
      embeds: [buildPreviewEmbed(embedData)],
      components: [getEditButtons(embedName)]
    });
    await interaction.reply({ content: '✅ Embed updated!', ephemeral: true });
  } catch (error) {
    await interaction.reply({ content: '✅ Embed saved! Preview could not be updated.', ephemeral: true });
  }

  return true;
}

/**
 * Handle embed creation command
 */
async function createEmbed(interaction, name) {
  const embeds = loadEmbeds();

  if (embeds[name]) {
    return interaction.reply({ content: '❌ An embed with that name already exists.', ephemeral: true });
  }

  const newEmbed = {
    title: '',
    description: '',
    color: '#fcdc79',
    footer: { text: '', icon: '', timestamp: false },
    author: { name: '', icon: '' },
    image: '',
    thumbnail: '',
    fields: []
  };

  setEmbed(name, newEmbed);

  await interaction.channel.send({
    content: `✨ Embed **${name}** created! Use the buttons below to edit it.`,
    embeds: [buildPreviewEmbed(newEmbed)],
    components: [getEditButtons(name)]
  });

  await interaction.reply({ content: '✅ Embed sent to channel!', ephemeral: true });
}

/**
 * Handle embed list command
 */
async function listEmbeds(interaction) {
  const embeds = loadEmbeds();
  const names = Object.keys(embeds);

  if (names.length === 0) {
    return interaction.reply({ content: '📦 No embeds saved yet.', ephemeral: true });
  }

  const list = names.map(n => `• \`${n}\``).join('\n');
  await interaction.reply({ 
    content: `📦 **Saved Embeds** (${names.length}):\n${list}`, 
    ephemeral: true 
  });
}

/**
 * Handle embed delete command
 */
async function deleteEmbedCommand(interaction, name) {
  const success = deleteEmbed(name);

  if (success) {
    await interaction.reply({ content: `🗑️ Deleted embed **${name}**.`, ephemeral: true });
  } else {
    await interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
  }
}

/**
 * Handle embed send command
 */
async function sendEmbed(interaction, name) {
  const embedData = getEmbed(name);

  if (!embedData) {
    return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
  }

  await interaction.channel.send({
    embeds: [buildPreviewEmbed(embedData)]
  });

  await interaction.reply({ content: '✅ Embed sent!', ephemeral: true });
}

module.exports = {
  buildPreviewEmbed,
  getEditButtons,
  handleEmbedEdit,
  handleEmbedModal,
  createEmbed,
  listEmbeds,
  deleteEmbedCommand,
  sendEmbed
};