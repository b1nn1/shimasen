// index.js
const { 
  Client, 
  GatewayIntentBits, 
  Collection,
  PermissionFlagsBits,
  REST,
  Routes
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// Import handlers
const { handleTicketInteractions, initializeTicketCounter } = require('./utils/ticketHandler.js');
const { handleStickyMessage } = require('./utils/stickySystem.js');
const { findAutoresponder, getEmbed, loadOrders } = require('./utils/dataManager.js');
const { buildPreviewEmbed, handleEmbedEdit, handleEmbedModal } = require('./utils/embedSystem.js');

// Initialize REST client for v2 messages
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// Load commands from ./commands folder
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.warn(`⚠️ Skipped loading ${file}: missing data or execute`);
  }
}

// Message handling for autoresponders and sticky messages
client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;

  try {
    // Check for autoresponder match
    const autoresponder = findAutoresponder(message.content, message.channel.id);
    if (autoresponder) {
      let responseContent = autoresponder.response || '';
      let responseEmbed = null;

      // If autoresponder has an embed name, load it
      if (autoresponder.embedName) {
        const embedData = getEmbed(autoresponder.embedName);
        if (embedData) {
          responseEmbed = buildPreviewEmbed(embedData);
        }
      }

      // Send response
      await message.reply({
        content: responseContent || undefined,
        embeds: responseEmbed ? [responseEmbed] : []
      });
    }

    // Handle sticky messages
    await handleStickyMessage(client, message);

  } catch (error) {
    console.error('Error in messageCreate handler:', error);
  }
});

// Interaction handling
client.on('interactionCreate', async interaction => {
  try {
    // ==================== SLASH COMMANDS ====================
    if (interaction.isChatInputCommand()) {
      console.log(`\n=== INTERACTION DEBUG ===`);
      console.log(`Command: ${interaction.commandName}`);
      console.log(`User: ${interaction.user.tag}`);
      console.log('Raw options:', interaction.options.data);
      console.log('========================\n');

      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.log(`❌ Command ${interaction.commandName} not found`);
        return;
      }

      await command.execute(interaction, client);
      return;
    }

    // ==================== BUTTONS ====================
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // Delivery reveal button
      if (customId.startsWith('reveal_items_')) {
        const { deliveryMap } = require('./utils/deliveryUtils.js');
        const interactionId = customId.replace('reveal_items_', '');
        const delivery = deliveryMap.get(interactionId);

        if (!delivery) {
          return interaction.reply({ content: '⚠️ Delivery data not found.', ephemeral: true });
        }

        const { item_name, link_1, item_2, link_2, item_3, link_3 } = delivery;
        let replyContent = `here are your items darling! !\n`;
        if (item_name && link_1) replyContent += `• [${item_name}](${link_1})\n`;
        if (item_2 && link_2) replyContent += `• [${item_2}](${link_2})\n`;
        if (item_3 && link_3) replyContent += `• [${item_3}](${link_3})\n`;

        await interaction.reply({ content: replyContent, ephemeral: true });
        return;
      }

      // Order status buttons (from old /order command - keeping for backwards compatibility)
      if (customId.startsWith('status_')) {
        const { updateOrderStatus } = require('./utils/dataManager.js');
        const status = customId.replace('status_', '');

        // Update status in database
        updateOrderStatus(interaction.message.id, status);

        // Update message with new status
        const newContent = interaction.message.content.replace(
          /status: \w+/,
          `status: ${status}`
        );

        await interaction.update({ content: newContent });
        return;
      }

      // Embed edit buttons
      const embedHandled = await handleEmbedEdit(interaction);
      if (embedHandled) return;

      // Ticket-related buttons (handled by ticketHandler)
      await handleTicketInteractions(client, interaction);
      return;
    }

    // ==================== SELECT MENUS ====================
    if (interaction.isStringSelectMenu()) {
      // Order status select menu (from Note & Process button)
      if (interaction.customId.startsWith('order_status_')) {
        console.log('ORDER STATUS SELECT TRIGGERED');

        try {
          const selected = interaction.values[0];
          const messageId = interaction.message.id;

          // Extract the existing data from the message components
          const currentContent = interaction.message.components[1].components[1].content;

          // Extract data using regex
          const quantityMatch = currentContent.match(/__([^_]+)__\s+`✾`/);
          const channelMatch = currentContent.match(/\(ˊᗜˋ˚\)\s+(<#\d+>)/);
          const paymentMatch = currentContent.match(/__([^_]+)__\s+`➲`/);
          const userMatch = currentContent.match(/\*\*order 4 (<@\d+>)\*\*/);

          const quantityItem = quantityMatch ? quantityMatch[1] : 'unknown';
          const channel = channelMatch ? channelMatch[1] : 'unknown';
          const payment = paymentMatch ? paymentMatch[1] : 'unknown';
          const user = userMatch ? userMatch[1] : 'unknown';

          // Rebuild the content with the new status
          const orderContent = `_ _\n_          _       <a:00sprk:1317116827393982577>       **order 4 ${user}**  ‿\n      ︵  ﹒.     **𓎢𓎟𓎟𓎡**\n        __${quantityItem}__  \`✾\`  <a:1_ramen:1322444809394458645>    :\n      ‿୨ ͡   𓌔  (ˊᗜˋ˚)  ${channel}\n      _        _ __${payment}__      \`➲\`  <:z5_hNn_cross:1452143221022130196>    : ${selected} \n      _       _**◞꒷◟ ͜ ͜ ◞ྀི◟୨୧◞ྀི◟ ͜ ͜ ◞꒷◟**\n_ _      \n_ _   `;

          // Rebuild the entire container
          const newContainer = {
            type: 17,
            components: [
              {
                type: 12,
                items: [{
                  media: {
                    url: "https://cdn.discordapp.com/attachments/1336151484869378109/1453414171025608887/image-removebg-preview_3.png"
                  }
                }]
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
                components: [{
                  type: 3,
                  custom_id: `order_status_${messageId}`,
                  placeholder: "Update Status",
                  min_values: 1,
                  max_values: 1,
                  options: [
                    { label: "⃟", value: "pending", description: "pending", default: selected === "pending" },
                    { label: "⃟", value: "paid", description: "paid", default: selected === "paid" },
                    { label: "⃟", value: "processing", description: "processing", default: selected === "processing" },
                    { label: "⃟", value: "w4v", description: "waiting for vch", default: selected === "w4v" },
                    { label: "⃟", value: "done", description: "done", default: selected === "done" }
                  ]
                }]
              }
            ]
          };

          await interaction.update({
            components: [
              { type: 10, content: "_ _\n_ _\n_ _\n_ _" },
              newContainer,
              {
                type: 12,
                items: [{
                  media: {
                    url: "https://cdn.discordapp.com/attachments/1439498545106259969/1448092580138061856/tumblr_bc4b349ba2758aaf9181602000da3050_775a5f17_640.gif"
                  }
                }]
              }
            ],
            flags: 32768
          });

          // Update database
          const { updateOrderStatus } = require('./utils/dataManager.js');
          updateOrderStatus(messageId, selected);

          console.log('Status updated successfully to:', selected);
        } catch (error) {
          console.error('Error updating order status:', error);
          await interaction.reply({ 
            content: '❌ Error updating status', 
            ephemeral: true 
          }).catch(() => {});
        }
        return;
      }

      // Orders pagination select menu
      if (interaction.customId === 'orders_page_select') {
        const page = parseInt(interaction.values[0]);

        // Re-fetch and filter orders (same logic as /admin orders)
        const orders = loadOrders();
        // Note: We can't access the original filters here, so this just shows all orders
        // In production, you might want to store filter state or use buttons instead

        const pageSize = 5;
        const totalPages = Math.ceil(orders.length / pageSize);
        const slice = orders.slice((page - 1) * pageSize, page * pageSize);

        const lines = slice.map(o =>
          `• User: <@${o.user}>, Item: ${o.item}, Amount: ${o.amount}, Payment: ${o.mop}, Status: ${o.status}`
        );

        const text = `📋 Orders page ${page}/${totalPages || 1}:\n${lines.join('\n') || 'No orders found.'}`;

        // Update select menu to show current page
        const row = interaction.message.components[0];
        row.components[0].options.forEach(opt => {
          opt.data.default = opt.data.value === page.toString();
        });

        await interaction.update({
          content: text,
          components: [row]
        });
        return;
      }

      // Admin menu actions (handled by ticketHandler)
      if (interaction.customId === 'admin_menu') {
        await handleTicketInteractions(client, interaction);
        return;
      }
    }

    // ==================== MODALS ====================
      // ==================== MODALS ====================
      if (interaction.isModalSubmit()) {
        // Send v2 message modal
        if (interaction.customId === 'sendv2_modal') {
          const jsonPayload = interaction.fields.getTextInputValue('json_payload');
          try {
            const payload = JSON.parse(jsonPayload);
            // Ensure the IS_COMPONENTS_V2 flag is set
            if (!payload.flags) {
              payload.flags = 32768;
            } else if (!(payload.flags & 32768)) {
              payload.flags |= 32768;
            }
            const { REST, Routes } = require('discord.js');
            const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
            await rest.post(Routes.channelMessages(interaction.channelId), { body: payload });
            await interaction.reply({ content: '✅ Components V2 message sent successfully!', ephemeral: true });
          } catch (error) {
            console.error('Error sending V2 message:', error);
            await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
          }
          return; // IMPORTANT: Return here so it doesn't continue
      }
      // ... rest of your code

      // Embed edit modals
      const embedModalHandled = await handleEmbedModal(interaction);
      if (embedModalHandled) return;

      // Ticket modal and admin menu modals (handled by ticketHandler)
      await handleTicketInteractions(client, interaction);
      return;
    }

  } catch (error) {
    console.error(`❌ Error handling interaction:`, error);
    const errorMessage = {
      content: 'There was an error processing this interaction.',
      ephemeral: true,
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (followUpError) {
      console.error('❌ Error sending error message:', followUpError);
    }
  }
});


// On ready
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📊 Loaded ${client.commands.size} commands`);

  client.user.setPresence({
    activities: [{ name: 'wynter shop', type: 3 }],
    status: 'dnd'
  });

  // Initialize ticket counters for all guilds
  client.guilds.cache.forEach(guild => {
    initializeTicketCounter(guild);
  });

  console.log('\n🎉 Bot is ready!');
  console.log('📋 Features enabled:');
  console.log('   • Ticket System (with admin menu, MOP autoresponder, transcripts)');
  console.log('   • Embed Builder (with live editing)');
  console.log('   • Autoresponders');
  console.log('   • Sticky Messages');
  console.log('   • Order Tracking');
  console.log('   • Activity Alerts');
  console.log('   • Components V2 Message Sender');
});

// Login
client.login(process.env.TOKEN);