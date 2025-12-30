// ticket.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

// Store ticket counters per guild to persist across restarts
const ticketCounters = new Map();

/**
 * Get next ticket number for a guild
 * @param {string} guildId 
 * @returns {number}
 */
function getNextTicketNumber(guildId) {
  const current = ticketCounters.get(guildId) || 0;
  const next = current + 1;
  ticketCounters.set(guildId, next);
  return next;
}

/**
 * Handles ticket-related interactions.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Interaction} interaction
 */
async function handleTicketInteractions(client, interaction) {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  // Get configuration from environment variables
  const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
  const STAFF_ROLE_IDS = process.env.STAFF_ROLE_IDS ? process.env.STAFF_ROLE_IDS.split(',').map(id => id.trim()) : [];

  // Validate required environment variables
  if (!TICKET_CATEGORY_ID) {
    console.error('TICKET_CATEGORY_ID environment variable is not set');
    return;
  }

  try {
    // Create Ticket Button - Show Modal
    if (interaction.customId === 'create_ticket') {
      // Check if user already has an open ticket first




      // Create and show the modal
      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('order at wynter shop!');

      const itemTypeInput = new TextInputBuilder()
        .setCustomId('item_type')
        .setLabel('what are you ordering?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., robux, n-tro, etc.')
        .setRequired(true)
        .setMaxLength(100);

      const quantityInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel('quantity')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('how many items do you want?')
        .setRequired(true)
        .setMaxLength(50);

      const paymentInput = new TextInputBuilder()
        .setCustomId('payment')
        .setLabel('payment')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., cashapp, paypal, etc.')
        .setRequired(true)
        .setMaxLength(100);

      const itemTypeRow = new ActionRowBuilder().addComponents(itemTypeInput);
      const quantityRow = new ActionRowBuilder().addComponents(quantityInput);
      const paymentRow = new ActionRowBuilder().addComponents(paymentInput);

      modal.addComponents(itemTypeRow, quantityRow, paymentRow);

      await interaction.showModal(modal);
    }

    // Handle Modal Submission - Create Ticket
    if (interaction.customId === 'ticket_modal') {
      // Double-check for existing ticket after modal submission




      // Get modal input values
      const itemType = interaction.fields.getTextInputValue('item_type');
      const quantity = interaction.fields.getTextInputValue('quantity');
      const payment = interaction.fields.getTextInputValue('payment');

      const ticketNumber = getNextTicketNumber(interaction.guildId);
      const channelName = `ticket-${ticketNumber}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '');

      // Base permission overwrites
      const permissionOverwrites = [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ];

      // Add staff roles if provided
      STAFF_ROLE_IDS.forEach(roleId => {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          permissionOverwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ManageMessages
            ]
          });
        }
      });

      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites
      });

      const welcomeEmbed = new EmbedBuilder()
        .setImage('https://cdn.discordapp.com/attachments/1336151484869378109/1452675018491170816/imageedit_13_6552957685.png?ex=694aac89&is=69495b09&hm=773b8874fab1a5a5dd1ef27b4873aa5215e71e2dd242c7e969bcc1c191831085&')
        .setColor(0x36393f);

      // Create order details embed with modal information
      const orderDetailsEmbed = new EmbedBuilder()
        .setTitle(`♡　𓈒ㅤ◞　　𖥔　　new order!`)
        .setDescription(
          `𓏏𓏏　　⠀ ׅ　　**item**    :   ${itemType}\n` +
          `𐔌　　◞　　𓈒ㅤ　**quantity**    :   ${quantity}\n` +
          `۶　　⠀ ׅ　　⸝⸝ 　**payment**   :   ${payment}`
        )
        .setThumbnail(interaction.user.displayAvatarURL()) // Add this line
        .setColor(0x36393f);

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('done!')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('send_message')
          .setLabel('ca (teen)')
          .setStyle(ButtonStyle.Secondary)
      );

      await channel.send({ 
        content: `${interaction.user} ${STAFF_ROLE_IDS.map(id => `<@&${id}>`).join(' ')}`, 
        embeds: [welcomeEmbed] 
      });
      await channel.send({
        content: '⠀　⠀𐐪　⠀ thanks for buying!　　  \n' +
                 '⠀　　𐙚　　read our [tos](https://discord.com/channels/1306843108704649236/1322553399908106393) 　 ₊  ◞　\n' +
                 '˙　　˳　　⁺　　wait for assistance!',
        embeds: [orderDetailsEmbed], 
        components: [actionRow]
      });

      await interaction.reply({ 
        content: `🎫 Ticket created: ${channel}`, 
        ephemeral: true 
      });
    }

    // Close Ticket Button
    if (interaction.customId === 'close_ticket') {
      // Check if user has permission to close (ticket creator or staff)
      const canClose = interaction.channel.name.includes(interaction.user.username) ||
                      interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                      STAFF_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));

      if (!canClose) {
        return await interaction.reply({ 
          content: '❌ You don\'t have permission to close this ticket.', 
          ephemeral: true 
        });
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closing')
        .setDescription('This ticket will be deleted in **5 seconds**.\nClick "Cancel" to stop.')
        .setColor(0x36393f);

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cancel_close')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      const reply = await interaction.reply({ 
        embeds: [confirmEmbed], 
        components: [confirmRow], 
        ephemeral: false 
      });

      // Set up cancellation collector
      const filter = (i) => i.customId === 'cancel_close' && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ 
        filter, 
        time: 4500 
      });

      let cancelled = false;
      collector.on('collect', async (i) => {
        cancelled = true;
        await i.update({ 
          content: '✅ Ticket closure cancelled.', 
          embeds: [], 
          components: [] 
        });
        collector.stop();
      });

      // Delete after timeout if not cancelled
      setTimeout(async () => {
        if (!cancelled && interaction.channel) {
          try {
            await interaction.channel.delete();
          } catch (error) {
            console.error('Error deleting ticket channel:', error);
          }
        }
      }, 5000);
    }

    // Send Message Button
    if (interaction.customId === 'send_message') {
      await interaction.channel.send(
        `_ _⠀⠀⠀⠀⠀⠀**teen**⠀⠀**only**⠀⠀⠀⠀𓈒⠀⠀⠀⠀:: \n` +
        `⠀⠀⠀::⠀⠀⠀⠀⠀https://cash.app/$LIMEY08 \n` +
        `⠀⠀⠀⠀⠀⠀⠀∿⠀⠀⠀⠀⠀⠀𓏏⠀⠀⠀⠀⠀⠀⊹ \n` +
        `-# ⠀⠀⠀⠀⠀⠀⠀⠀send web receipt`
      );
      await interaction.reply({ content: '✅ Payment information sent.', ephemeral: true });
    }

  } catch (error) {
    console.error('Error handling ticket interaction:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: '❌ An error occurred while processing your request.', 
        ephemeral: true 
      });
    }
  }
}

/**
 * Initialize ticket counter from existing channels (useful on bot restart)
 * @param {import('discord.js').Guild} guild 
 */
function initializeTicketCounter(guild) {
  const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

  if (!TICKET_CATEGORY_ID) {
    console.error('TICKET_CATEGORY_ID environment variable is not set');
    return;
  }

  const ticketChannels = guild.channels.cache.filter(
    channel => channel.parentId === TICKET_CATEGORY_ID && 
    channel.name.startsWith('ticket-')
  );

  let highestNumber = 0;
  ticketChannels.forEach(channel => {
    const match = channel.name.match(/^ticket-(\d+)-/);
    if (match) {
      const number = parseInt(match[1]);
      if (number > highestNumber) {
        highestNumber = number;
      }
    }
  });

  ticketCounters.set(guild.id, highestNumber);
}

module.exports = { 
  handleTicketInteractions,
  initializeTicketCounter
};