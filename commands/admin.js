// commands/admin.js
const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { loadOrders } = require('../utils/dataManager.js');
const { 
  createEmbed, 
  listEmbeds, 
  deleteEmbedCommand, 
  sendEmbed 
} = require('../utils/embedSystem.js');
const { 
  addAutoresponder, 
  loadAutoresponders, 
  deleteAutoresponder 
} = require('../utils/dataManager.js');
const { 
  setupSticky, 
  removeStickMessage, 
  viewSticky 
} = require('../utils/stickySystem.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin commands')
    .addSubcommandGroup(group =>
      group
        .setName('embed')
        .setDescription('Manage embeds')
        .addSubcommand(sub =>
          sub
            .setName('create')
            .setDescription('Create a new embed')
            .addStringOption(opt => opt.setName('name').setDescription('Embed name').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('list').setDescription('List all embeds')
        )
        .addSubcommand(sub =>
          sub
            .setName('delete')
            .setDescription('Delete an embed')
            .addStringOption(opt => opt.setName('name').setDescription('Embed name').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('send')
            .setDescription('Send an embed to this channel')
            .addStringOption(opt => opt.setName('name').setDescription('Embed name').setRequired(true))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('autoresponder')
        .setDescription('Manage autoresponders')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add an autoresponder')
            .addStringOption(opt => opt.setName('trigger').setDescription('Trigger word/phrase').setRequired(true))
            .addStringOption(opt => opt.setName('response').setDescription('Response text').setRequired(false))
            .addStringOption(opt => opt.setName('embed').setDescription('Embed name to send').setRequired(false))
            .addStringOption(opt => opt.setName('channel').setDescription('Channel ID (leave blank for all channels)').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('list').setDescription('List all autoresponders')
        )
        .addSubcommand(sub =>
          sub
            .setName('delete')
            .setDescription('Delete an autoresponder')
            .addStringOption(opt => opt.setName('id').setDescription('Autoresponder ID').setRequired(true))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('sticky')
        .setDescription('Manage sticky messages')
        .addSubcommand(sub =>
          sub
            .setName('set')
            .setDescription('Set a sticky message')
            .addStringOption(opt => opt.setName('content').setDescription('Message content').setRequired(false))
            .addStringOption(opt => opt.setName('embed').setDescription('Embed name').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('remove').setDescription('Remove sticky message from this channel')
        )
        .addSubcommand(sub =>
          sub.setName('view').setDescription('View current sticky message info')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('orders')
        .setDescription('View order logs')
        .addUserOption(opt => opt.setName('user').setDescription('Filter by user'))
        .addStringOption(opt => opt.setName('item').setDescription('Filter by item'))
        .addStringOption(opt => opt.setName('status').setDescription('Filter by status'))
        .addIntegerOption(opt => opt.setName('page').setDescription('Page number'))
    )
    .addSubcommand(sub =>
      sub
        .setName('say')
        .setDescription('Make the bot say something')
        .addStringOption(opt => opt.setName('message').setDescription('Message to say').setRequired(true))
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Message type')
            .addChoices(
              { name: 'Normal', value: 'normal' },
              { name: 'Spacer', value: 'spacer' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Update shop status')
        .addStringOption(opt =>
          opt
            .setName('state')
            .setDescription('Shop status')
            .setRequired(true)
            .addChoices(
              { name: '**opened**', value: 'open' },
              { name: '**closed**', value: 'closed' },
              { name: '**slow orders**', value: 'slow' }
            )
        )
    ),

  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    // ==================== EMBED COMMANDS ====================
    if (subcommandGroup === 'embed') {
      if (subcommand === 'create') {
        const name = interaction.options.getString('name');
        await createEmbed(interaction, name);
      } else if (subcommand === 'list') {
        await listEmbeds(interaction);
      } else if (subcommand === 'delete') {
        const name = interaction.options.getString('name');
        await deleteEmbedCommand(interaction, name);
      } else if (subcommand === 'send') {
        const name = interaction.options.getString('name');
        await sendEmbed(interaction, name);
      }
    }

    // ==================== AUTORESPONDER COMMANDS ====================
    else if (subcommandGroup === 'autoresponder') {
      if (subcommand === 'add') {
        const trigger = interaction.options.getString('trigger');
        const response = interaction.options.getString('response');
        const embedName = interaction.options.getString('embed');
        const channelId = interaction.options.getString('channel');

        if (!response && !embedName) {
          return interaction.reply({ 
            content: '❌ You must provide either a response or an embed name.', 
            ephemeral: true 
          });
        }

        addAutoresponder({
          trigger,
          response: response || '',
          embedName: embedName || null,
          channelId: channelId || null
        });

        const scope = channelId ? `in <#${channelId}>` : 'globally';
        await interaction.reply({ 
          content: `✅ Autoresponder added!\n**Trigger:** ${trigger}\n**Scope:** ${scope}`, 
          ephemeral: true 
        });
      } else if (subcommand === 'list') {
        const autoresponders = loadAutoresponders();

        if (autoresponders.length === 0) {
          return interaction.reply({ content: '📋 No autoresponders configured.', ephemeral: true });
        }

        const list = autoresponders.map(a => {
          const scope = a.channelId ? `<#${a.channelId}>` : 'Global';
          const type = a.embedName ? `Embed: ${a.embedName}` : 'Text';
          return `• **ID:** \`${a.id}\` | **Trigger:** "${a.trigger}" | **Scope:** ${scope} | **Type:** ${type}`;
        }).join('\n');

        await interaction.reply({ 
          content: `📋 **Autoresponders** (${autoresponders.length}):\n${list}`, 
          ephemeral: true 
        });
      } else if (subcommand === 'delete') {
        const id = interaction.options.getString('id');
        const success = deleteAutoresponder(id);

        if (success) {
          await interaction.reply({ content: `🗑️ Autoresponder deleted.`, ephemeral: true });
        } else {
          await interaction.reply({ content: '❌ Autoresponder not found.', ephemeral: true });
        }
      }
    }

    // ==================== STICKY COMMANDS ====================
    else if (subcommandGroup === 'sticky') {
      if (subcommand === 'set') {
        const content = interaction.options.getString('content');
        const embedName = interaction.options.getString('embed');
        await setupSticky(interaction, content, embedName);
      } else if (subcommand === 'remove') {
        await removeStickMessage(interaction);
      } else if (subcommand === 'view') {
        await viewSticky(interaction);
      }
    }

    // ==================== ORDERS COMMAND ====================
    else if (subcommand === 'orders') {
      const userFilter = interaction.options.getUser('user');
      const itemFilter = interaction.options.getString('item');
      const statusFilter = interaction.options.getString('status');
      let page = interaction.options.getInteger('page') || 1;

      const orders = loadOrders();
      let filtered = orders;

      if (userFilter) filtered = filtered.filter(o => o.user === userFilter.id);
      if (itemFilter) filtered = filtered.filter(o => o.item.toLowerCase().includes(itemFilter.toLowerCase()));
      if (statusFilter) filtered = filtered.filter(o => o.status.toLowerCase() === statusFilter.toLowerCase());

      const pageSize = 5;
      const totalPages = Math.ceil(filtered.length / pageSize);

      if (page > totalPages && totalPages !== 0) {
        return interaction.reply({
          content: `❌ Page out of range. There are only ${totalPages} pages.`,
          ephemeral: true
        });
      }

      const getPageContent = (currentPage) => {
        const slice = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        const lines = slice.map(o =>
          `• User: <@${o.user}>, Item: ${o.item}, Amount: ${o.amount}, Payment: ${o.mop}, Status: ${o.status}`
        );
        return {
          text: `📋 Orders page ${currentPage}/${totalPages || 1}:\n${lines.join('\n') || 'No orders found.'}`,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        };
      };

      const { text, hasNext, hasPrev } = getPageContent(page);

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('orders_page_select')
          .setPlaceholder(`Page ${page}/${totalPages || 1}`)
          .addOptions(
            Array.from({ length: totalPages || 1 }, (_, i) => 
              new StringSelectMenuOptionBuilder()
                .setLabel(`Page ${i + 1}`)
                .setValue((i + 1).toString())
                .setDefault(i + 1 === page)
            )
          )
      );

      await interaction.reply({
        content: text,
        components: totalPages > 1 ? [row] : [],
        ephemeral: true
      });
    }

    // ==================== SAY COMMAND ====================
    else if (subcommand === 'say') {
      const message = interaction.options.getString('message');
      const type = interaction.options.getString('type') || 'normal';

      let finalMessage = message;

      if (type === 'spacer') {
        finalMessage = "⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀\n⠀";
      }

      if (finalMessage.length > 2000) {
        return interaction.reply({
          content: `❌ Message is too long! Discord has a 2000 character limit. Your message is ${finalMessage.length} characters.`,
          ephemeral: true
        });
      }

      try {
        await interaction.reply({ content: '✅ Message sent!', ephemeral: true });
        await interaction.channel.send(finalMessage);
      } catch (error) {
        console.error('Error sending message:', error);
        await interaction.followUp({
          content: '❌ Failed to send the message.',
          ephemeral: true
        });
      }
    }

    // ==================== STATUS COMMAND ====================
    else if (subcommand === 'status') {
      const state = interaction.options.getString('state');

      const message = ` ᡣ𐭩　　　　₍　　<@&1307223869752606730> 　₎
wynter　shop　has,　${state}
check <#1452041121961218121> .
      `;

      await interaction.reply({ content: message, ephemeral: false });
    }
  }
};