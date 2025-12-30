// utils/dataManager.js
const fs = require('fs');
const path = require('path');

// Data file paths
const DATA_DIR = path.join(__dirname, '../data');
const PATHS = {
  orders: path.join(DATA_DIR, 'orders.json'),
  embeds: path.join(DATA_DIR, 'embeds.json'),
  autoresponders: path.join(DATA_DIR, 'autoresponders.json'),
  sticky: path.join(DATA_DIR, 'sticky.json')
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Generic function to load JSON data
 * @param {string} filePath - Path to JSON file
 * @param {*} defaultValue - Default value if file doesn't exist
 * @returns {*} Parsed JSON data
 */
function loadData(filePath, defaultValue = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      saveData(filePath, defaultValue);
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    console.error(`Error loading data from ${filePath}:`, error);
    return defaultValue;
  }
}

/**
 * Generic function to save JSON data
 * @param {string} filePath - Path to JSON file
 * @param {*} data - Data to save
 * @returns {boolean} Success status
 */
function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error saving data to ${filePath}:`, error);
    return false;
  }
}

// ==================== ORDERS ====================

/**
 * Load all orders
 * @returns {Array} Array of order objects
 */
function loadOrders() {
  const data = loadData(PATHS.orders, []);
  return Array.isArray(data) ? data : [];
}

/**
 * Save orders
 * @param {Array} orders - Array of order objects
 * @returns {boolean} Success status
 */
function saveOrders(orders) {
  return saveData(PATHS.orders, orders);
}

/**
 * Add a new order
 * @param {Object} order - Order object
 * @returns {boolean} Success status
 */
function addOrder(order) {
  const orders = loadOrders();
  orders.push({
    ...order,
    timestamp: Date.now()
  });
  return saveOrders(orders);
}

/**
 * Update order status
 * @param {string} messageId - Message ID of the order
 * @param {string} newStatus - New status value
 * @returns {boolean} Success status
 */
function updateOrderStatus(messageId, newStatus) {
  const orders = loadOrders();
  const order = orders.find(o => o.messageId === messageId);
  if (order) {
    order.status = newStatus;
    return saveOrders(orders);
  }
  return false;
}

/**
 * Get orders by user ID
 * @param {string} userId - Discord user ID
 * @returns {Array} Array of orders
 */
function getOrdersByUser(userId) {
  const orders = loadOrders();
  return orders.filter(o => o.user === userId);
}

// ==================== EMBEDS ====================

/**
 * Load all embeds
 * @returns {Object} Object with embed name keys
 */
function loadEmbeds() {
  return loadData(PATHS.embeds, {});
}

/**
 * Save embeds
 * @param {Object} embeds - Embeds object
 * @returns {boolean} Success status
 */
function saveEmbeds(embeds) {
  return saveData(PATHS.embeds, embeds);
}

/**
 * Get a specific embed
 * @param {string} name - Embed name
 * @returns {Object|null} Embed object or null
 */
function getEmbed(name) {
  const embeds = loadEmbeds();
  return embeds[name] || null;
}

/**
 * Create or update an embed
 * @param {string} name - Embed name
 * @param {Object} embedData - Embed data
 * @returns {boolean} Success status
 */
function setEmbed(name, embedData) {
  const embeds = loadEmbeds();
  embeds[name] = embedData;
  return saveEmbeds(embeds);
}

/**
 * Delete an embed
 * @param {string} name - Embed name
 * @returns {boolean} Success status
 */
function deleteEmbed(name) {
  const embeds = loadEmbeds();
  if (embeds[name]) {
    delete embeds[name];
    return saveEmbeds(embeds);
  }
  return false;
}

// ==================== AUTORESPONDERS ====================

/**
 * Load all autoresponders
 * @returns {Array} Array of autoresponder objects
 */
function loadAutoresponders() {
  const data = loadData(PATHS.autoresponders, []);
  return Array.isArray(data) ? data : [];
}

/**
 * Save autoresponders
 * @param {Array} autoresponders - Array of autoresponder objects
 * @returns {boolean} Success status
 */
function saveAutoresponders(autoresponders) {
  return saveData(PATHS.autoresponders, autoresponders);
}

/**
 * Add a new autoresponder
 * @param {Object} autoresponder - Autoresponder object {trigger, response, embedName, channelId}
 * @returns {boolean} Success status
 */
function addAutoresponder(autoresponder) {
  const autoresponders = loadAutoresponders();
  autoresponders.push({
    id: Date.now().toString(),
    ...autoresponder
  });
  return saveAutoresponders(autoresponders);
}

/**
 * Delete an autoresponder
 * @param {string} id - Autoresponder ID
 * @returns {boolean} Success status
 */
function deleteAutoresponder(id) {
  const autoresponders = loadAutoresponders();
  const filtered = autoresponders.filter(a => a.id !== id);
  if (filtered.length !== autoresponders.length) {
    return saveAutoresponders(filtered);
  }
  return false;
}

/**
 * Find matching autoresponder for a message
 * @param {string} content - Message content
 * @param {string} channelId - Channel ID
 * @returns {Object|null} Matching autoresponder or null
 */
function findAutoresponder(content, channelId) {
  const autoresponders = loadAutoresponders();
  const lowerContent = content.toLowerCase();

  return autoresponders.find(a => {
    // Check if channel-specific or global
    if (a.channelId && a.channelId !== channelId) return false;

    // Check if trigger matches (case-insensitive)
    const lowerTrigger = a.trigger.toLowerCase();
    return lowerContent.includes(lowerTrigger);
  }) || null;
}

// ==================== STICKY MESSAGES ====================

/**
 * Load sticky messages
 * @returns {Object} Object with channel ID keys
 */
function loadSticky() {
  return loadData(PATHS.sticky, {});
}

/**
 * Save sticky messages
 * @param {Object} sticky - Sticky object
 * @returns {boolean} Success status
 */
function saveSticky(sticky) {
  return saveData(PATHS.sticky, sticky);
}

/**
 * Get sticky message for a channel
 * @param {string} channelId - Channel ID
 * @returns {Object|null} Sticky data or null
 */
function getSticky(channelId) {
  const sticky = loadSticky();
  return sticky[channelId] || null;
}

/**
 * Set sticky message for a channel
 * @param {string} channelId - Channel ID
 * @param {Object} stickyData - Sticky message data {content, embedName, lastMessageId}
 * @returns {boolean} Success status
 */
function setSticky(channelId, stickyData) {
  const sticky = loadSticky();
  sticky[channelId] = {
    ...stickyData,
    createdAt: Date.now()
  };
  return saveSticky(sticky);
}

/**
 * Update last message ID for sticky
 * @param {string} channelId - Channel ID
 * @param {string} messageId - Last message ID
 * @returns {boolean} Success status
 */
function updateStickyMessageId(channelId, messageId) {
  const sticky = loadSticky();
  if (sticky[channelId]) {
    sticky[channelId].lastMessageId = messageId;
    return saveSticky(sticky);
  }
  return false;
}

/**
 * Remove sticky message from channel
 * @param {string} channelId - Channel ID
 * @returns {boolean} Success status
 */
function removeSticky(channelId) {
  const sticky = loadSticky();
  if (sticky[channelId]) {
    delete sticky[channelId];
    return saveSticky(sticky);
  }
  return false;
}

module.exports = {
  // Orders
  loadOrders,
  saveOrders,
  addOrder,
  updateOrderStatus,
  getOrdersByUser,

  // Embeds
  loadEmbeds,
  saveEmbeds,
  getEmbed,
  setEmbed,
  deleteEmbed,

  // Autoresponders
  loadAutoresponders,
  saveAutoresponders,
  addAutoresponder,
  deleteAutoresponder,
  findAutoresponder,

  // Sticky
  loadSticky,
  saveSticky,
  getSticky,
  setSticky,
  updateStickyMessageId,
  removeSticky
};