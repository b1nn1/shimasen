// utils/ticketHandler.js - PART 1: Imports and Helper Functions
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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  AttachmentBuilder,
  REST,
  Routes
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { addOrder } = require('./dataManager.js');

// Initialize REST client
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// Store ticket counters per guild
const ticketCounters = new Map();

// Store ticket data temporarily for Note & Process
const ticketDataMap = new Map();

// Helper: Send Components V2 Message
async function sendV2Message(channelId, payload) {
  return await rest.post(Routes.channelMessages(channelId), { body: payload });
}

// Payment method messages
const MOP_MESSAGES = {
  'ca': '_ _⠀⠀⠀⠀⠀⠀**cashapp**⠀⠀⠀⠀𓈒⠀⠀⠀⠀:: \n⠀⠀⠀::⠀⠀⠀⠀⠀https://cash.app/$bradist \n⠀⠀⠀⠀⠀⠀⠀∿⠀⠀⠀⠀⠀⠀𓏏⠀⠀⠀⠀⠀⠀⊹ \n-# ⠀⠀⠀⠀⠀⠀⠀⠀send payment + screenshot',
  'pp': '_ _⠀⠀⠀⠀⠀⠀**paypal**⠀⠀⠀⠀𓈒⠀⠀⠀⠀:: \n⠀⠀⠀::⠀⠀⠀⠀⠀https://www.paypal.me/bradisteele \n⠀⠀⠀⠀⠀⠀⠀∿⠀⠀⠀⠀⠀⠀𓏏⠀⠀⠀⠀⠀⠀⊹ \n-# ⠀⠀⠀⠀⠀⠀⠀⠀send payment + screenshot',
  'paypal': '_ _⠀⠀⠀⠀⠀⠀**paypal**⠀⠀⠀⠀𓈒⠀⠀⠀⠀:: \n⠀⠀⠀::⠀⠀⠀⠀⠀https://www.paypal.me/bradisteele \n⠀⠀⠀⠀⠀⠀⠀∿⠀⠀⠀⠀⠀⠀𓏏⠀⠀⠀⠀⠀⠀⊹ \n-# ⠀⠀⠀⠀⠀⠀⠀⠀send payment + screenshot',
  'ltc': '_ _⠀⠀⠀⠀⠀⠀**litecoin**⠀⠀⠀⠀𓈒⠀⠀⠀⠀:: \n⠀⠀⠀::⠀⠀⠀⠀⠀MPeLdvZTCXAaUBHZGTEEtCdvSkwEHcgjdL \n⠀⠀⠀⠀⠀⠀⠀∿⠀⠀⠀⠀⠀⠀𓏏⠀⠀⠀⠀⠀⠀⊹ \n-# ⠀⠀⠀⠀⠀⠀⠀⠀send payment + tx hash'
};

/**
 * Get next ticket number for a guild
 */
function getNextTicketNumber(guildId) {
  const current = ticketCounters.get(guildId) || 0;
  const next = current + 1;
  ticketCounters.set(guildId, next);
  return next;
}

/**
 * Initialize ticket counter from existing channels
 */
function initializeTicketCounter(guild) {
  const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
  if (!TICKET_CATEGORY_ID) return;

  const ticketChannels = guild.channels.cache.filter(
    channel => channel.parentId === TICKET_CATEGORY_ID && 
    channel.name.startsWith('ticket-')
  );

  let highestNumber = 0;
  ticketChannels.forEach(channel => {
    const match = channel.name.match(/^ticket-(\d+)-/);
    if (match) {
      const number = parseInt(match[1]);
      if (number > highestNumber) highestNumber = number;
    }
  });

  ticketCounters.set(guild.id, highestNumber);
}

/**
 * Get MOP message based on payment method
 */
function getMOPMessage(paymentMethod) {
  const lower = paymentMethod.toLowerCase();

  if (lower.includes('ca') || lower.includes('cashapp')) {
    return MOP_MESSAGES['ca'];
  }
  if (lower.includes('pp') || lower.includes('paypal')) {
    return MOP_MESSAGES['pp'];
  }
  if (lower.includes('ltc') || lower.includes('litecoin')) {
    return MOP_MESSAGES['ltc'];
  }

  return `_ _⠀⠀⠀⠀⠀⠀**payment info**⠀⠀⠀⠀𓈒⠀⠀⠀⠀:: \n⠀⠀⠀::⠀⠀⠀⠀⠀${paymentMethod} \n⠀⠀⠀⠀⠀⠀⠀∿⠀⠀⠀⠀⠀⠀𓏏⠀⠀⠀⠀⠀⠀⊹ \n-# ⠀⠀⠀⠀⠀⠀⠀⠀contact staff for payment details`;
}

/**
 * Generate HTML transcript
 */
async function generateTranscript(channel, ticketData) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMessages = Array.from(messages.values()).reverse();

    const templatePath = path.join(__dirname, 'transcriptTemplate.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    html = html.replace(/{{TICKET_NAME}}/g, channel.name);
    html = html.replace(/{{TICKET_NUMBER}}/g, ticketData.ticketNumber || '???');
    html = html.replace(/{{CUSTOMER_TAG}}/g, ticketData.customerTag || 'Unknown');
    html = html.replace(/{{CUSTOMER_ID}}/g, ticketData.customerId || 'Unknown');
    html = html.replace(/{{CREATED_DATE}}/g, ticketData.createdDate || 'Unknown');
    html = html.replace(/{{CLOSED_DATE}}/g, new Date().toLocaleString());
    html = html.replace(/{{CLOSED_BY}}/g, ticketData.closedBy || 'Unknown');
    html = html.replace(/{{ITEM_TYPE}}/g, ticketData.itemType || 'N/A');
    html = html.replace(/{{QUANTITY}}/g, ticketData.quantity || 'N/A');
    html = html.replace(/{{PAYMENT_METHOD}}/g, ticketData.paymentMethod || 'N/A');

    let messagesHtml = '';
    for (const msg of sortedMessages) {
      const isBot = msg.author.bot;
      const botClass = isBot ? 'bot-message' : '';
      const botTag = isBot ? '<span class="bot-tag">BOT</span>' : '';

      let attachmentsHtml = '';
      if (msg.attachments.size > 0) {
        for (const attachment of msg.attachments.values()) {
          if (attachment.contentType?.startsWith('image/')) {
            attachmentsHtml += `
              <div class="attachment">
                <div class="attachment-label">Attachment:</div>
                <img src="${attachment.url}" alt="attachment" class="attachment-image-placeholder">
              </div>
            `;
          } else {
            attachmentsHtml += `
              <div class="attachment">
                <div class="attachment-file">
                  <div class="file-icon">📎</div>
                  <div class="file-info">
                    <a href="${attachment.url}" class="file-name" target="_blank">${attachment.name}</a>
                    <div class="file-size">${Math.round(attachment.size / 1024)} KB</div>
                  </div>
                </div>
              </div>
            `;
          }
        }
      }

      messagesHtml += `
        <div class="message-container ${botClass}">
          <div class="message-top-bar">
            <div class="message-author-box">
              <img src="${msg.author.displayAvatarURL()}" alt="avatar" class="author-avatar">
              <span class="author-name">${msg.author.username}${botTag}</span>
            </div>
            <span class="message-timestamp">${msg.createdAt.toLocaleString()}</span>
          </div>
          <div class="message-body">
            ${msg.content || '<em>No text content</em>'}
            ${attachmentsHtml}
          </div>
        </div>
      `;
    }

    html = html.replace('{{MESSAGES}}', messagesHtml);

    return html;
  } catch (error) {
    console.error('Error generating transcript:', error);
    return null;
  }
}
    // PART 2: Main Handler - Create Ticket Button and Ticket Modal Submission (FIXED)
// PART 2: Main Handler - Create Ticket Button and Ticket Modal Submission (WITH V2 FLAG)

/**
 * Main handler for ticket interactions
 */
async function handleTicketInteractions(client, interaction) {
  if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

  const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
  const STAFF_ROLE_IDS = process.env.STAFF_ROLE_IDS ? process.env.STAFF_ROLE_IDS.split(',').map(id => id.trim()) : [];
  const TRANSCRIPT_CHANNEL_ID = process.env.TRANSCRIPT_CHANNEL_ID;
  const ORDER_CHANNEL_ID = process.env.ORDER_CHANNEL_ID;

  try {
    // ==================== CREATE TICKET BUTTON ====================
    if (interaction.customId === 'create_ticket') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('order from wynter');

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

      modal.addComponents(
        new ActionRowBuilder().addComponents(itemTypeInput),
        new ActionRowBuilder().addComponents(quantityInput),
        new ActionRowBuilder().addComponents(paymentInput)
      );

      await interaction.showModal(modal);
    }

    // ==================== TICKET MODAL SUBMISSION ====================
    if (interaction.customId === 'ticket_modal') {
      const itemType = interaction.fields.getTextInputValue('item_type');
      const quantity = interaction.fields.getTextInputValue('quantity');
      const payment = interaction.fields.getTextInputValue('payment');

      const ticketNumber = getNextTicketNumber(interaction.guildId);
      const channelName = `ticket-${ticketNumber}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '');

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

      // ==================== MESSAGE 1: USING COMPONENTS V2 ====================
      // NOTE: flags: 32768 is the IS_COMPONENTS_V2 flag (1 << 15)
      await sendV2Message(channel.id, {
        flags: 32768, // IS_COMPONENTS_V2 flag - REQUIRED!
        components: [
          {
            type: 17, // SECTION
            components: [
              {
                type: 1, // ACTION_ROW for buttons
                components: [
                  {
                    type: 2,
                    style: 2, // Secondary
                    label: "done",
                    custom_id: "close_ticket"
                  },
                  {
                    type: 2,
                    style: 2, // Secondary
                    label: "note + process",
                    custom_id: "note_process"
                  }
                ]
              }
            ]
          },
          {
            type: 10, // TEXT_DISPLAY (SEPARATOR)
            content: `_ _\n_ _\n_ _\n_ _\n<@${interaction.user.id}> ${STAFF_ROLE_IDS.map(id => `<@&${id}>`).join(' ')}`
          },
          {
            type: 12, // MEDIA_GALLERY
            items: [
              {
                media: {
                  url: "https://cdn.discordapp.com/attachments/1336151484869378109/1452675018491170816/imageedit_13_6552957685.png"
                }
              }
            ]
          }
        ]
      });

      // ==================== MESSAGE 2: USING COMPONENTS V2 ====================
      const orderDetailsContent = `_ _\n_ _　 ྀི༷　𓈒.   **buying**    :    ${itemType}　໑𓐇۪ ᣟ݂\n _ _　⎯⎯໑　quantity   —   ${quantity}\n _ _　 ̥՞__mop__    :   ${payment}　  𓈒　 ✿.  ྀི ݂۫\n_ _`;

      await sendV2Message(channel.id, {
        flags: 32768, // IS_COMPONENTS_V2 flag - REQUIRED!
        components: [
          {
            type: 10, // TEXT_DISPLAY (top spacing)
            content: "_ _\n_ _"
          },
          {
            type: 17, // CONTAINER (note: changed from SECTION based on JSON)
            components: [
              {
                type: 12, // MEDIA_GALLERY (top image)
                items: [
                  {
                    media: {
                      url: "https://64.media.tumblr.com/64a4b506d3eaf14a56af8f93d45bae4b/53818ac466dcb5a9-3f/s250x400/b3d2449feaef05a86f74f8c87e7673b64ec857ca.pnj"
                    }
                  }
                ]
              },
              {
                type: 9, // SECTION (text with accessory)
                components: [
                  {
                    type: 10, // TEXT_DISPLAY (order details text)
                    content: orderDetailsContent
                  }
                ],
                accessory: {
                  type: 11, // THUMBNAIL (avatar thumbnail)
                  media: {
                    url: interaction.user.displayAvatarURL()
                  }
                }
              },
              {
                type: 14, // SEPARATOR (divider)
                divider: true,
                spacing: 2
              },
              {
                type: 1, // ACTION_ROW for select menu
                components: [
                  {
                    type: 3, // STRING_SELECT
                    custom_id: "admin_menu",
                    placeholder: "admin options",
                    min_values: 1,
                    max_values: 1,
                    options: [
                      {
                        label: "⃟⃟⃟",
                        description: "add user",
                        value: "add_user",
                        emoji: { id: "1453479960705630384", name: "002topreply" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "ban user",
                        value: "ban_user",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "remove user",
                        value: "remove_user",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "receipt",
                        value: "receipt",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "deliver",
                        value: "deliver",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "lock",
                        value: "lock_ticket",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "priority",
                        value: "set_priority",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "claim",
                        value: "claim_ticket",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "mark paid",
                        value: "mark_paid",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "send template",
                        value: "send_template",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "user info",
                        value: "view_user_info",
                        emoji: { id: "1403269808799223891", name: "curv" }
                      },
                      {
                        label: "⃟⃟⃟",
                        description: "script",
                        value: "generate_transcript",
                        emoji: { id: "1453479963083935888", name: "reply" }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      });

      // Send MOP-specific message
      const mopMessage = getMOPMessage(payment);
      await channel.send(mopMessage);

      // Store ticket data for later use
      ticketDataMap.set(channel.id, {
        ticketNumber,
        customerId: interaction.user.id,
        customerTag: interaction.user.tag,
        itemType,
        quantity,
        paymentMethod: payment,
        createdDate: new Date().toLocaleString()
      });

      await interaction.reply({ 
        content: `🎫 Ticket created: ${channel}`, 
        ephemeral: true 
      });
    }

    // Continue to Part 3...
    // PART 3: Note & Process Button/Modal and Close Ticket

    // ==================== NOTE & PROCESS BUTTON ====================
    if (interaction.customId === 'note_process') {
      const modal = new ModalBuilder()
        .setCustomId('note_process_modal')
        .setTitle('Add Note & Process Order');

      const noteInput = new TextInputBuilder()
        .setCustomId('note')
        .setLabel('internal note (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Add any internal notes about this order...')
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
      await interaction.showModal(modal);
    }

    // ==================== NOTE & PROCESS MODAL ====================
    if (interaction.customId === 'note_process_modal') {
      await interaction.deferReply({ ephemeral: true });

      const note = interaction.fields.getTextInputValue('note') || 'No notes';
      const ticketData = ticketDataMap.get(interaction.channel.id);
      if (!ticketData) {
        return interaction.editReply({ content: '❌ Ticket data not found.' });
      }
      const orderChannel = await interaction.guild.channels.fetch(ORDER_CHANNEL_ID).catch(() => null);
      if (!orderChannel) {
        return interaction.editReply({ content: '❌ Order channel not found.' });
      }

      const status = 'pending';
      const orderContent = `_ _\n_          _       <a:00sprk:1317116827393982577>       **order 4 ${interaction.user}**  ‿\n      ︵  ﹒.     **𓎢𓎟𓎟𓎡**\n        __${ticketData.quantity}x ${ticketData.itemType}__  \`✾\`  <a:1_ramen:1322444809394458645>    :\n      ‿୨ ͡   𓌔  (ˊᗜˋ˚)  ${interaction.channel}\n      _        _ __${ticketData.paymentMethod}__      \`➲\`  <:z5_hNn_cross:1452143221022130196>    : ${status} \n      _       _**◞꒷◟ ͜ ͜ ◞ྀི◟୨୧◞ྀི◟ ͜ ͜ ◞꒷◟**\n_ _      \n_ _   `;

      try {
        const messagePayload = {
          flags: 32768,
          components: [
            {
              type: 10,
              content: "_ _\n_ _\n_ _\n_ _"
            },
            {
              type: 17,
              components: [
                {
                  type: 12,
                  items: [
                    {
                      media: {
                        url: "https://cdn.discordapp.com/attachments/1336151484869378109/1453414171025608887/image-removebg-preview_3.png"
                      }
                    }
                  ]
                },
                {
                  type: 10,
                  content: orderContent
                },
                {
                  type: 14,
                  spacing: 2,
                  divider: false
                },
                {
                  type: 1,
                  components: [
                    {
                      type: 3,
                      custom_id: "order_status_PLACEHOLDER",
                      placeholder: "Update Status",
                      min_values: 1,
                      max_values: 1,
                      options: [
                        { label: "⃟", value: "pending", description: "pending", default: false },
                        { label: "⃟", value: "paid", description: "paid", default: false },
                        { label: "⃟", value: "processing", description: "processing", default: false },
                        { label: "⃟", value: "w4v", description: "waiting for vch", default: false },
                        { label: "⃟", value: "done", description: "done", default: false }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              type: 12,
              items: [
                {
                  media: {
                    url: "https://cdn.discordapp.com/attachments/1439498545106259969/1448092580138061856/tumblr_bc4b349ba2758aaf9181602000da3050_775a5f17_640.gif"
                  }
                }
              ]
            }
          ]
        };

        const msg = await rest.post(Routes.channelMessages(ORDER_CHANNEL_ID), { 
          body: messagePayload 
        });

        // Update with actual message ID
        messagePayload.components[1].components[3].components[0].custom_id = `order_status_${msg.id}`;

        await rest.patch(Routes.channelMessage(ORDER_CHANNEL_ID, msg.id), { 
          body: messagePayload 
        });

        addOrder({
          user: ticketData.customerId,
          item: ticketData.itemType,
          amount: ticketData.quantity,
          mop: ticketData.paymentMethod,
          status: status,
          messageId: msg.id,
          channelId: ORDER_CHANNEL_ID,
          note
        });

        await interaction.editReply({ content: '✅ Order processed and logged!' });
      } catch (error) {
        console.error('Error processing order:', error);
        await interaction.editReply({ content: `❌ Failed to process order: ${error.message}` });
      }
    }

    // ==================== ORDER STATUS SELECT MENU ====================
    if (interaction.customId.startsWith('order_status_')) {
      console.log('SELECT MENU TRIGGERED');
      console.log('Full interaction:', JSON.stringify(interaction, null, 2));
      console.log('Custom ID:', interaction.customId);
      console.log('Selected value:', interaction.values[0]);
      console.log('Message components:', JSON.stringify(interaction.message.components, null, 2));

      await interaction.reply({ content: 'Debug: Handler triggered!', ephemeral: true });
    }
    // ==================== CLOSE TICKET ====================
    if (interaction.customId === 'close_ticket') {
      const canClose = interaction.channel.name.includes(interaction.user.username) ||
                      interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                      STAFF_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));

      if (!canClose) {
        return interaction.reply({ content: '❌ You don\'t have permission to close this ticket.', ephemeral: true });
      }

      // Generate transcript
      const ticketData = ticketDataMap.get(interaction.channel.id) || {};
      ticketData.closedBy = interaction.user.tag;

      const html = await generateTranscript(interaction.channel, ticketData);

      if (html && TRANSCRIPT_CHANNEL_ID) {
        const transcriptChannel = await interaction.guild.channels.fetch(TRANSCRIPT_CHANNEL_ID).catch(() => null);
        if (transcriptChannel) {
          const attachment = new AttachmentBuilder(Buffer.from(html), { name: `${interaction.channel.name}.html` });
          await transcriptChannel.send({ 
            content: `📄 Transcript for **${interaction.channel.name}** closed by ${interaction.user}`,
            files: [attachment] 
          });
        }
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closing')
        .setDescription('This ticket will be deleted in **5 seconds**.\nClick "Cancel" to stop.')
        .setColor(0xff6b6b);

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cancel_close')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow] });

      const filter = (i) => i.customId === 'cancel_close' && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 4500 });

      let cancelled = false;
      collector.on('collect', async (i) => {
        cancelled = true;
        await i.update({ content: '✅ Ticket closure cancelled.', embeds: [], components: [] });
        collector.stop();
      });

      setTimeout(async () => {
        if (!cancelled && interaction.channel) {
          ticketDataMap.delete(interaction.channel.id);
          try {
            await interaction.channel.delete();
          } catch (error) {
            console.error('Error deleting ticket:', error);
          }
        }
      }, 5000);
    }

    // Continue to Part 4...
    // PART 4: Admin Menu Actions

    // ==================== ADMIN MENU ====================
    if (interaction.customId === 'admin_menu') {
      const action = interaction.values[0];

      switch (action) {
        case 'add_user': {
          const modal = new ModalBuilder()
            .setCustomId('admin_add_user')
            .setTitle('Add User to Ticket');

          const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter user ID to add')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(userInput));
          await interaction.showModal(modal);
          break;
        }

        case 'ban_user': {
          const modal = new ModalBuilder()
            .setCustomId('admin_ban_user')
            .setTitle('Ban User');

          const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter user ID to ban')
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Ban reason...')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(reasonInput)
          );
          await interaction.showModal(modal);
          break;
        }

        case 'remove_user': {
          const modal = new ModalBuilder()
            .setCustomId('admin_remove_user')
            .setTitle('Remove User from Ticket');

          const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter user ID to remove')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(userInput));
          await interaction.showModal(modal);
          break;
        }

        case 'receipt': {
          const modal = new ModalBuilder()
            .setCustomId('admin_receipt')
            .setTitle('Generate Receipt');

          const orderInput = new TextInputBuilder()
            .setCustomId('order')
            .setLabel('Order')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 1000 robux')
            .setRequired(true);

          const paymentInput = new TextInputBuilder()
            .setCustomId('payment')
            .setLabel('Payment')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., $5.00 via Cashapp')
            .setRequired(true);

          const orderDateInput = new TextInputBuilder()
            .setCustomId('order_date')
            .setLabel('Order Date')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Leave blank for today')
            .setRequired(false);

          const deliveryDateInput = new TextInputBuilder()
            .setCustomId('delivery_date')
            .setLabel('Delivery Date')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Leave blank for today')
            .setRequired(false);

          const warrantyInput = new TextInputBuilder()
            .setCustomId('warranty')
            .setLabel('Warranty (yes/no)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('yes or no')
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(orderInput),
            new ActionRowBuilder().addComponents(paymentInput),
            new ActionRowBuilder().addComponents(orderDateInput),
            new ActionRowBuilder().addComponents(deliveryDateInput),
            new ActionRowBuilder().addComponents(warrantyInput)
          );
          await interaction.showModal(modal);
          break;
        }

        case 'deliver': {
          const modal = new ModalBuilder()
            .setCustomId('admin_deliver')
            .setTitle('Deliver Items to Customer');

          const itemTypeInput = new TextInputBuilder()
            .setCustomId('item_type')
            .setLabel('Item Type')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., robux, nitro')
            .setRequired(true);

          const quantityInput = new TextInputBuilder()
            .setCustomId('quantity')
            .setLabel('Quantity')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 1000')
            .setRequired(true);

          const item1Input = new TextInputBuilder()
            .setCustomId('item1')
            .setLabel('Item 1 (name|link)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Item Name|https://link.com')
            .setRequired(true);

          const item2Input = new TextInputBuilder()
            .setCustomId('item2')
            .setLabel('Item 2 (name|link) - Optional')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Item Name|https://link.com')
            .setRequired(false);

          const item3Input = new TextInputBuilder()
            .setCustomId('item3')
            .setLabel('Item 3 (name|link) - Optional')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Item Name|https://link.com')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(itemTypeInput),
            new ActionRowBuilder().addComponents(quantityInput),
            new ActionRowBuilder().addComponents(item1Input),
            new ActionRowBuilder().addComponents(item2Input),
            new ActionRowBuilder().addComponents(item3Input)
          );
          await interaction.showModal(modal);
          break;
        }

        case 'lock_ticket': {
          const everyone = interaction.guild.roles.everyone;
          const currentPerms = interaction.channel.permissionOverwrites.cache.get(everyone.id);

          if (currentPerms && currentPerms.deny.has(PermissionFlagsBits.SendMessages)) {
            // Unlock
            await interaction.channel.permissionOverwrites.edit(everyone, {
              SendMessages: null
            });
            await interaction.reply({ content: '🔓 Ticket unlocked - users can now send messages.', ephemeral: true });
          } else {
            // Lock
            await interaction.channel.permissionOverwrites.edit(everyone, {
              SendMessages: false
            });
            await interaction.reply({ content: '🔒 Ticket locked - only staff can send messages.', ephemeral: true });
          }
          break;
        }

        case 'set_priority': {
          const modal = new ModalBuilder()
            .setCustomId('admin_priority')
            .setTitle('Set Ticket Priority');

          const priorityInput = new TextInputBuilder()
            .setCustomId('priority')
            .setLabel('Priority Level')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('urgent, high, normal, or low')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(priorityInput));
          await interaction.showModal(modal);
          break;
        }

        case 'claim_ticket': {
          const ticketData = ticketDataMap.get(interaction.channel.id);
          if (ticketData) {
            ticketData.claimedBy = interaction.user.tag;
            ticketDataMap.set(interaction.channel.id, ticketData);
          }

          await interaction.channel.send(`✋ This ticket has been claimed by ${interaction.user}`);
          await interaction.reply({ content: '✅ You have claimed this ticket.', ephemeral: true });
          break;
        }

        case 'mark_paid': {
          await interaction.channel.send(`💰 Payment received and confirmed by ${interaction.user}`);
          await interaction.reply({ content: '✅ Ticket marked as paid.', ephemeral: true });
          break;
        }

        case 'send_template': {
          const modal = new ModalBuilder()
            .setCustomId('admin_template')
            .setTitle('Send Template Message');

          const templateInput = new TextInputBuilder()
            .setCustomId('template')
            .setLabel('Template Type')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('processing, ready, moreinfo, thanks')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(templateInput));
          await interaction.showModal(modal);
          break;
        }

        case 'view_user_info': {
          const ticketData = ticketDataMap.get(interaction.channel.id);
          if (!ticketData) {
            return interaction.reply({ content: '❌ No ticket data found.', ephemeral: true });
          }

          const user = await interaction.guild.members.fetch(ticketData.customerId).catch(() => null);
          if (!user) {
            return interaction.reply({ content: '❌ User not found.', ephemeral: true });
          }

          const { getOrdersByUser } = require('./dataManager.js');
          const orders = getOrdersByUser(ticketData.customerId);

          const infoEmbed = new EmbedBuilder()
            .setTitle('👤 User Information')
            .setThumbnail(user.user.displayAvatarURL())
            .addFields(
              { name: 'Username', value: user.user.tag, inline: true },
              { name: 'User ID', value: ticketData.customerId, inline: true },
              { name: 'Joined Server', value: user.joinedAt ? user.joinedAt.toLocaleDateString() : 'Unknown', inline: true },
              { name: 'Account Created', value: user.user.createdAt.toLocaleDateString(), inline: true },
              { name: 'Roles', value: user.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.name).join(', ') || 'None', inline: false },
              { name: 'Total Orders', value: orders.length.toString(), inline: true },
              { name: 'Current Order', value: `${ticketData.quantity}x ${ticketData.itemType}`, inline: false }
            )
            .setColor(0x5865f2);

          await interaction.reply({ embeds: [infoEmbed], ephemeral: true });
          break;
        }

        case 'generate_transcript': {
          const ticketData = ticketDataMap.get(interaction.channel.id) || {};
          ticketData.closedBy = interaction.user.tag;

          const html = await generateTranscript(interaction.channel, ticketData);

          if (html) {
            const attachment = new AttachmentBuilder(Buffer.from(html), { name: `${interaction.channel.name}.html` });
            await interaction.reply({ 
              content: '📄 Transcript generated!',
              files: [attachment],
              ephemeral: true
            });
          } else {
            await interaction.reply({ content: '❌ Failed to generate transcript.', ephemeral: true });
          }
          break;
        }
      }
    }

    // Continue to Part 5...
    // PART 5: Admin Modal Submissions and Module Export

        // ==================== ADMIN MODALS ====================

        // Add User Modal
        if (interaction.customId === 'admin_add_user') {
          const userId = interaction.fields.getTextInputValue('user_id');

          try {
            const user = await interaction.guild.members.fetch(userId);
            await interaction.channel.permissionOverwrites.create(user, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              AttachFiles: true,
              EmbedLinks: true
            });

            await interaction.reply({ content: `✅ Added ${user} to the ticket.`, ephemeral: true });
            await interaction.channel.send(`${user} has been added to this ticket by ${interaction.user}`);
          } catch (error) {
            await interaction.reply({ content: '❌ Could not find or add that user.', ephemeral: true });
          }
        }

        // Ban User Modal
        if (interaction.customId === 'admin_ban_user') {
          const userId = interaction.fields.getTextInputValue('user_id');
          const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';

          try {
            const user = await interaction.guild.members.fetch(userId);
            await user.ban({ reason: `Banned by ${interaction.user.tag}: ${reason}` });

            await interaction.reply({ content: `🔨 Banned ${user.user.tag}`, ephemeral: true });
            await interaction.channel.send(`${user.user.tag} has been banned. Reason: ${reason}`);
          } catch (error) {
            await interaction.reply({ content: '❌ Could not ban that user. Check permissions.', ephemeral: true });
          }
        }

        // Remove User Modal
        if (interaction.customId === 'admin_remove_user') {
          const userId = interaction.fields.getTextInputValue('user_id');

          try {
            const user = await interaction.guild.members.fetch(userId);
            await interaction.channel.permissionOverwrites.delete(user);

            await interaction.reply({ content: `✅ Removed ${user} from the ticket.`, ephemeral: true });
            await interaction.channel.send(`${user} has been removed from this ticket by ${interaction.user}`);
          } catch (error) {
            await interaction.reply({ content: '❌ Could not find or remove that user.', ephemeral: true });
          }
        }

    // Receipt Modal
    if (interaction.customId === 'admin_receipt') {
      const order = interaction.fields.getTextInputValue('order');
      const payment = interaction.fields.getTextInputValue('payment');
      const orderDate = interaction.fields.getTextInputValue('order_date') || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      const deliveryDate = interaction.fields.getTextInputValue('delivery_date') || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      const warranty = interaction.fields.getTextInputValue('warranty').toLowerCase();

      const receiptContent = `order _ _⠀⠀⠀⠀—⠀⠀ ${order}\npayment⠀⠀—⠀⠀ ${payment}\nwarranty⠀⠀—⠀⠀ ${warranty === 'yes' ? 'yes' : 'no'}\n> -# _ _ ⠀  order date ⠀ ⠀⠀ ⠀ ⠀ delivery date\n> **${orderDate} ⠀    ${deliveryDate}**`;

      await sendV2Message(interaction.channel.id, {
        flags: 32768,
        components: [
          {
            type: 10,
            content: '_ _\n_ _\n_ _'
          },
          {
            type: 17,
            components: [{
              type: 10,
              content: receiptContent
            }]
          }
        ]
      });

      await interaction.reply({ content: '✅ Receipt sent!', ephemeral: true });
    }

        // Deliver Modal
        if (interaction.customId === 'admin_deliver') {
          const itemType = interaction.fields.getTextInputValue('item_type');
          const quantity = interaction.fields.getTextInputValue('quantity');
          const item1 = interaction.fields.getTextInputValue('item1');
          const item2 = interaction.fields.getTextInputValue('item2') || null;
          const item3 = interaction.fields.getTextInputValue('item3') || null;

          const ticketData = ticketDataMap.get(interaction.channel.id);
          if (!ticketData) {
            return interaction.reply({ content: '❌ Could not find ticket data.', ephemeral: true });
          }

          const customer = await interaction.guild.members.fetch(ticketData.customerId).catch(() => null);
          if (!customer) {
            return interaction.reply({ content: '❌ Could not find customer.', ephemeral: true });
          }

          // Parse items (format: name|link)
          const parseItem = (itemStr) => {
            if (!itemStr) return null;
            const [name, link] = itemStr.split('|').map(s => s.trim());
            return { name, link };
          };

          const parsedItem1 = parseItem(item1);
          const parsedItem2 = parseItem(item2);
          const parsedItem3 = parseItem(item3);

          const { deliveryMap } = require('./deliveryUtils.js');
          const interactionId = interaction.id;

          deliveryMap.set(interactionId, {
            item_name: parsedItem1?.name,
            link_1: parsedItem1?.link,
            item_2: parsedItem2?.name,
            link_2: parsedItem2?.link,
            item_3: parsedItem3?.name,
            link_3: parsedItem3?.link
          });

          const messageContent = `#　❥　˚　<a:003_butterfly:1387315637818490934>    𖨂　ᴥ　__new alert__!!　❏
        𓎟𓎟　.　𓎟𓎟　.　𓎟𓎟
        （✿ ˘˘）ʿ　⑅　<a:029_Pyellowflower2:1387391948217651261>     　✧　**${quantity}x ${itemType}** fell from the sky!!  
        ⤷　<a:glitters:1403228878885093457>　⊹　˚　__[vouch](https://discord.com/channels/1306843108704649236/1333171861743341568)__ to activate warranty!　☻
        （✿ ˘˘）ʿ　⑅　<a:a8_mail:1317116823539417230> 　✧　 **thank you for buying with us!**
        𓎟𓎟　.　𓎟𓎟　.　𓎟𓎟`;

          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`reveal_items_${interactionId}`)
              .setLabel('items!')
              .setStyle(ButtonStyle.Secondary)
          );

          try {
            await customer.send({
              content: messageContent,
              components: [buttonRow]
            });
            await interaction.reply({ content: `✅ Delivery sent to ${customer}!`, ephemeral: true });
            await interaction.channel.send(`📦 Items delivered to ${customer} by ${interaction.user}`);
          } catch (error) {
            await interaction.reply({ content: '❌ Could not send DM. User may have DMs disabled.', ephemeral: true });
          }
        }

        // Priority Modal
        if (interaction.customId === 'admin_priority') {
          const priority = interaction.fields.getTextInputValue('priority').toLowerCase();

          const priorityEmojis = {
            urgent: '🔴',
            high: '🟠',
            normal: '🟢',
            low: '🔵'
          };

          const emoji = priorityEmojis[priority] || '⚪';

          await interaction.channel.send(`${emoji} Ticket priority set to **${priority}** by ${interaction.user}`);
          await interaction.reply({ content: `✅ Priority set to ${priority}`, ephemeral: true });
        }

        // Template Modal
        if (interaction.customId === 'admin_template') {
          const templateType = interaction.fields.getTextInputValue('template').toLowerCase();

          const templates = {
            processing: '⏳ Your order is currently being processed. Please wait patiently!',
            ready: '✅ Your order is ready! Please check your DMs for delivery.',
            moreinfo: '❓ We need more information about your order. Please provide additional details.',
            thanks: '💖 Thank you for shopping with us! Don\'t forget to vouch!'
          };

          const message = templates[templateType] || '📝 Template message sent.';

          await interaction.channel.send(message);
          await interaction.reply({ content: '✅ Template sent!', ephemeral: true });
        }

      } catch (error) {
        console.error('Error in ticket handler:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
        }
      }
    }

    // ==================== MODULE EXPORTS ====================
    module.exports = { 
      handleTicketInteractions,
      initializeTicketCounter
    };