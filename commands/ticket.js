const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Setup the ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('<a:00:1452143202428780544>')
        );

      // Send visible message with button in the channel where command was run
      await interaction.channel.send({
        components: [row],
      });

      // Acknowledge the command with an ephemeral reply
      await interaction.reply({ content: '✅ Ticket panel sent!', ephemeral: true });

    } catch (error) {
      console.error('🎫 Error in ticket command:', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Failed to send ticket panel.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Failed to send ticket panel.', ephemeral: true });
      }
    }
  }
};
