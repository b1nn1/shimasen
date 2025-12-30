// commands/sendv2.js
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, REST, Routes } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendv2')
    .setDescription('Send a Components V2 message')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of message to send')
        .setRequired(true)
        .addChoices(
          { name: 'Custom JSON', value: 'custom' },
          { name: 'Test Message', value: 'test' }
        )
    ),

  async execute(interaction) {
    console.log('=== SENDV2 COMMAND EXECUTED ===');
    console.log('User:', interaction.user.tag);

    const type = interaction.options.getString('type');
    console.log('Type selected:', type);

    if (type === 'custom') {
      console.log('Showing modal...');
      const modal = new ModalBuilder()
        .setCustomId('sendv2_modal')
        .setTitle('Send Components V2 Message');

      const jsonInput = new TextInputBuilder()
        .setCustomId('json_payload')
        .setLabel('JSON Payload')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Paste your Components V2 JSON here...')
        .setRequired(true)
        .setMaxLength(4000);

      modal.addComponents(new ActionRowBuilder().addComponents(jsonInput));

      try {
        await interaction.showModal(modal);
        console.log('✅ Modal shown successfully');
      } catch (error) {
        console.error('❌ Error showing modal:', error);
        await interaction.reply({ content: '❌ Failed to show modal', ephemeral: true });
      }
      return;
    } 

    if (type === 'test') {
      const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

      try {
        await rest.post(Routes.channelMessages(interaction.channelId), {
          body: {
            flags: 32768,
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 1,
                    components: [
                      {
                        type: 2,
                        style: 1,
                        label: "Test Button",
                        custom_id: "test_button"
                      }
                    ]
                  }
                ]
              },
              {
                type: 10,
                content: "✅ This is a test Components V2 message!"
              }
            ]
          }
        });

        await interaction.reply({ content: '✅ Test message sent!', ephemeral: true });
      } catch (error) {
        console.error('Error sending V2 message:', error);
        await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
      }
    }
  }
};

// Handle modal submission for custom JSON
// Add this to your main index.js interaction handler:
/*
if (interaction.isModalSubmit() && interaction.customId === 'sendv2_modal') {
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
}
*/