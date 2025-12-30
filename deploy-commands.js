// deploy-commands.js
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const commands = [
  // ==================== ADMIN COMMAND (MEGA COMMAND) ====================
  new SlashCommandBuilder()
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
              { name: '🟢 Open', value: 'open' },
              { name: '🔴 Closed', value: 'closed' },
              { name: '🟡 Slow', value: 'slow' }
            )
        )
    ),

  // ==================== ALERT COMMAND ====================
  new SlashCommandBuilder()
    .setName('alert')
    .setDescription('Alert a user and set a 1-hour timer to check for channel activity')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to alert')
        .setRequired(true)),

  // ==================== V2 W MSG COMMAND ====================
  new SlashCommandBuilder()
  .setName('sendv2')
  .setDescription('Send a Components V2 message')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Type of message to send')
      .setRequired(true)
      .addChoices(
        { name: 'Custom JSON', value: 'custom' },
        { name: 'Test Message', value: 'test' }
      )
  ),
  // ==================== TICKET COMMAND ====================
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Setup the ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
]
.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🚀 Deploying slash commands...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Slash commands deployed successfully!');
    console.log(`📊 Total commands: ${commands.length}`);
    console.log('   • /admin (with embed, autoresponder, sticky, orders, say, status)');
    console.log('   • /alert');
    console.log('   • /ticket');
  } catch (err) {
    console.error('❌ Error deploying commands:', err);
  }
})();