// utils/deliveryUtils.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

// In-memory storage of deliveries by interaction id
const deliveryMap = new Map();

/**
 * Send delivery DM to customer
 * @param {Object} interaction - Discord interaction
 */
async function sendDelivery(interaction) {
  const customer = interaction.options.getUser('customer');
  const itemType = interaction.options.getString('item_type');
  const item_name = interaction.options.getString('item_name');
  const link_1 = interaction.options.getString('link_1');
  const quantity = interaction.options.getString('quantity');
  const item_2 = interaction.options.getString('item_2'); // optional
  const link_2 = interaction.options.getString('link_2'); // optional
  const item_3 = interaction.options.getString('item_3'); // optional
  const link_3 = interaction.options.getString('link_3'); // optional

  // Debug info
  console.log('=== DEBUG INFO ===');
  console.log('All options:', interaction.options.data);
  console.log('Customer:', customer?.tag);
  console.log('Item type:', itemType);
  console.log('Items:', { item_name, link_1, item_2, link_2, item_3, link_3 });
  console.log('==================');

  if (!customer) {
    return await interaction.reply({
      content: '❌ Could not find the specified customer.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // Store delivery info keyed by interaction id for button lookup
  deliveryMap.set(interaction.id, { item_name, link_1, item_2, link_2, item_3, link_3 });

  const buttonCustomId = `reveal_items_${interaction.id}`;

  const messageContent = `#　❥　˚　<a:003_butterfly:1387315637818490934>    𖨂　ᴥ　__new alert__!!　❏
    𓎟𓎟　.　𓎟𓎟　.　𓎟𓎟
    （✿ ˘˘）ʿ　⑅　<a:029_Pyellowflower2:1387391948217651261>     　✧　**${quantity}x ${itemType}** fell from the sky!!  
    ⤷　<a:glitters:1403228878885093457>　⊹　˚　__[vouch](https://discord.com/channels/1306843108704649236/1333171861743341568)__ to activate warranty!　☻
    （✿ ˘˘）ʿ　⑅　<a:a8_mail:1317116823539417230> 　✧　 **thank you for buying with us!**
    𓎟𓎟　.　𓎟𓎟　.　𓎟𓎟`;

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buttonCustomId)
      .setLabel('items!')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await customer.send({
      content: messageContent,
      components: [buttonRow],
    });
    await interaction.reply({
      content: `✅ Delivery sent to ${customer}! They can click the button to reveal items.`
    });
  } catch (error) {
    console.error('DM failed:', error);
    let errorMessage = '❌ Could not send the DM. ';
    if (error.code === 50007) {
      errorMessage += 'The user has DMs disabled or blocked the bot.';
    } else if (error.code === 10013) {
      errorMessage += 'Unknown user.';
    } else {
      errorMessage += "Please check if they have messages enabled and haven't blocked the bot.";
    }
    await interaction.reply({
      content: errorMessage,
      flags: MessageFlags.Ephemeral,
    });
  }
}

module.exports = { sendDelivery, deliveryMap };