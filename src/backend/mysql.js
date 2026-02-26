// mysql.js
// Handles phone number list in MySQL database 'tailwinds', table 'squawk_list'

const mysql = require('mysql2/promise');


function getDbConfig(settings) {
  return {
    host: settings.db_host || 'localhost',
    user: settings.db_user || 'root',
    password: settings.db_password || '',
    database: settings.db_name || 'tailwinds'
  };
}

/**
 * Add a new phone number to squawk_list
 * @param {Object} settings - The settings object
 * @param {string} phone - Phone number to add
 * @returns {Promise<boolean>} - True if added, false if error
 */
async function addPhoneNumber(settings, phone) {
  const conn = await mysql.createConnection(getDbConfig(settings));
  try {
    await conn.execute('INSERT INTO squawk_list (phone) VALUES (?)', [phone]);
    await conn.end();
    return true;
  } catch (err) {
    console.error('Error adding phone number:', err);
    await conn.end();
    return false;
  }
}

/**
 * Remove a phone number from squawk_list
 * @param {Object} settings - The settings object
 * @param {string} phone - Phone number to remove
 * @returns {Promise<boolean>} - True if removed, false if error
 */
async function removePhoneNumber(settings, phone) {
  const conn = await mysql.createConnection(getDbConfig(settings));
  try {
    await conn.execute('DELETE FROM squawk_list WHERE phone = ?', [phone]);
    await conn.end();
    return true;
  } catch (err) {
    console.error('Error removing phone number:', err);
    await conn.end();
    return false;
  }
}

async function updatePhoneFilter(settings, phone, filter) {
  const conn = await mysql.createConnection(getDbConfig(settings));
  try {
    await conn.execute('UPDATE squawk_list SET filter = ? WHERE phone = ?', [filter, phone]);
    await conn.end();
    return true;
  } catch (err) {
    console.error('Error updating phone number filter:', err);
    await conn.end();
    return false;
  }
}

/**
 * Get all phone numbers from squawk_list
 * @param {Object} settings - The settings object
 * @returns {Promise<string[]>} - Array of phone numbers
 */
async function getPhoneNumbers(settings) {
  const conn = await mysql.createConnection(getDbConfig(settings));
  try {
    const [rows] = await conn.execute('SELECT phone, filter FROM squawk_list');
    await conn.end();
    return rows;
  } catch (err) {
    console.error('Error fetching phone numbers:', err);
    await conn.end();
    return [];
  }
}

module.exports = { addPhoneNumber, removePhoneNumber, getPhoneNumbers, updatePhoneFilter };
