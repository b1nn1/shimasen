// utils/stickySystem.js
const { 
  getSticky, 
  setSticky, 
  updateStickyMessageId, 
  removeSticky 
} = require('./dataManager.js');
const { getEmbed } = require('./dataManager.js');
const { buildPreviewEmbed } = require('./embedSystem.js');

// Cooldown tracking to prevent spam
const cooldowns = new Map();
const COOLDOWN_MS = 3000; // 3 second cooldown

/**
 * Handle sticky message logic when a message is sent
 */
async function handleStickyMessage(client, message) {
  // Ignore bot messages and DMs
  if (message.author.bot || !message.guild) return;

  const channelId = message.channel.id;
  const stickyData = getSticky(channelId);

  if (!stickyData) return;

  // Check cooldown
  const now = Date.now();
  const lastPost = cooldowns.get(channelId) || 0;

  if (now - lastPost < COOLDOWN_MS) {
    return; // Still in cooldown
  }

  try {
    // Delete old sticky message if it exists
    if (stickyData.lastMessageId) {
      try {
        const oldMessage = await message.channel.messages.fetch(stickyData.lastMessageId);
        await oldMessage.delete();
      } catch (error) {
        // Message might already be deleted, ignore
      }
    }

    // Build new sticky message
    let newMessage;

    if (stickyData.embedName) {
      // Use embed
      const embedData = getEmbed(stickyData.embedName);
      if (embedData) {
        const embed = buildPreviewEmbed(embedData);
        newMessage = await message.channel.send({
          content: stickyData.content || undefined,
          embeds: [embed]
        });
      } else {
        // Embed not found, send text only
        newMessage = await message.channel.send(stickyData.content || '⚠️ Sticky message (embed not found)');
      }
    } else {
      // Text only
      newMessage = await message.channel.send(stickyData.content || '⚠️ Sticky message (no content)');
    }

    // Update sticky data with new message ID
    updateStickyMessageId(channelId, newMessage.id);

    // Set cooldown
    cooldowns.set(channelId, now);

  } catch (error) {
    console.error('Error handling sticky message:', error);
  }
}

/**
 * Set up a sticky message in a channel
 */
async function setupSticky(interaction, content, embedName) {
  const channelId = interaction.channel.id;

  // Validate embed if provided
  if (embedName) {
    const embedData = getEmbed(embedName);
    if (!embedData) {
      return interaction.reply({ content: '❌ Embed not found. Create it first with `/embed_create`.', ephemeral: true });
    }
  }

  // Send initial sticky message
  let stickyMessage;

  try {
    if (embedName) {
      const embedData = getEmbed(embedName);
      const embed = buildPreviewEmbed(embedData);
      stickyMessage = await interaction.channel.send({
        content: content || undefined,
        embeds: [embed]
      });
    } else if (content) {
      stickyMessage = await interaction.channel.send(content);
    } else {
      return interaction.reply({ content: '❌ You must provide either content or an embed name.', ephemeral: true });
    }

    // Save sticky data
    setSticky(channelId, {
      content: content || '',
      embedName: embedName || null,
      lastMessageId: stickyMessage.id
    });

    await interaction.reply({ 
      content: `✅ Sticky message set! It will repost after every message in this channel.`, 
      ephemeral: true 
    });

  } catch (error) {
    console.error('Error setting up sticky:', error);
    await interaction.reply({ content: '❌ Failed to set sticky message.', ephemeral: true });
  }
}

/**
 * Remove sticky message from a channel
 */
async function removeStickMessage(interaction) {
  const channelId = interaction.channel.id;
  const stickyData = getSticky(channelId);

  if (!stickyData) {
    return interaction.reply({ content: '❌ No sticky message in this channel.', ephemeral: true });
  }

  // Try to delete the last sticky message
  if (stickyData.lastMessageId) {
    try {
      const message = await interaction.channel.messages.fetch(stickyData.lastMessageId);
      await message.delete();
    } catch (error) {
      // Message might already be deleted
    }
  }

  // Remove from database
  removeSticky(channelId);

  // Clear cooldown
  cooldowns.delete(channelId);

  await interaction.reply({ content: '✅ Sticky message removed from this channel.', ephemeral: true });
}

/**
 * View current sticky message info
 */
async function viewSticky(interaction) {
  const channelId = interaction.channel.id;
  const stickyData = getSticky(channelId);

  if (!stickyData) {
    return interaction.reply({ content: '❌ No sticky message in this channel.', ephemeral: true });
  }

  const info = [
    `📌 **Sticky Message Info**`,
    ``,
    `**Content:** ${stickyData.content || '(none)'}`,
    `**Embed:** ${stickyData.embedName || '(none)'}`,
    `**Last Message ID:** ${stickyData.lastMessageId || '(none)'}`,
    `**Created:** ${new Date(stickyData.createdAt).toLocaleString()}`
  ].join('\n');

  await interaction.reply({ content: info, ephemeral: true });
}

module.exports = {
  handleStickyMessage,
  setupSticky,
  removeStickMessage,
  viewSticky
};