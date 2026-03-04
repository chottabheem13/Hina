const axios = require('axios');

const API_BASE = 'https://api.kyou.id/v2/rest';
const API_KEY = process.env.API_KEY;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch data from a table
 * @param {string} table - Table name (e.g., 'purchasing_tickets')
 * @param {object} options - Query options
 * @param {number} options.limit - Max rows to return (default: 100, max: 1000)
 * @param {number} options.offset - Number of rows to skip (default: 0)
 * @returns {Promise<object>} - { data, table, count }
 */
async function getData(table, options = {}) {
  const { limit = 100, offset = 0 } = options;
  const response = await api.get(`/${table}/data`, { params: { limit, offset } });
  return response.data;
}

/**
 * Insert a single row into a table
 * @param {string} table - Table name
 * @param {object} row - Row data to insert
 * @returns {Promise<object>} - { message, table, inserted_id }
 */
async function insertRow(table, row) {
  try {
    const response = await api.post(`/${table}/data`, row);
    return response.data;
  } catch (err) {
    console.error(`DB insert error [${table}]:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Insert multiple rows into a table
 * @param {string} table - Table name
 * @param {array} rows - Array of row data to insert
 * @returns {Promise<object>} - { message, inserted, table }
 */
async function insertBatch(table, rows) {
  const response = await api.post(`/${table}/data`, { data: rows });
  return response.data;
}

/**
 * Build SQL-style WHERE clause from object
 * @param {object} where - Conditions
 * @returns {string} - SQL WHERE clause string
 */
function buildWhereClause(where) {
  const conditions = [];
  for (const [key, value] of Object.entries(where)) {
    if (typeof value === 'string') {
      conditions.push(`${key}='${value}'`);
    } else if (value === null) {
      conditions.push(`${key} IS NULL`);
    } else {
      conditions.push(`${key}=${value}`);
    }
  }
  return conditions.join(' AND ');
}

/**
 * Update rows in a table
 * @param {string} table - Table name
 * @param {object} where - Conditions for filtering rows
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} - { message, table, affected }
 */
async function updateRows(table, where, updates) {
  try {
    const whereClause = buildWhereClause(where);
    const payload = { ...updates };
    const response = await api.put(`/${table}/data?where=${encodeURIComponent(whereClause)}`, payload);
    return response.data;
  } catch (err) {
    console.error(`DB update error [${table}]:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Generate a unique ticket ID
 * @returns {string} - Ticket ID (e.g., 'TKT-abc123xyz')
 */
function generateTicketId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `TKT-${timestamp}${random}`;
}

/**
 * Get current time in UTC+7 (WIB) format
 * @returns {string} - ISO 8601 formatted date string in UTC+7
 */
function getWibTime() {
  const now = new Date();
  // Convert to UTC+7
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (3600000 * 7));
  return wib.toISOString().replace('Z', '+07:00');
}

module.exports = {
  getData,
  insertRow,
  insertBatch,
  updateRows,
  generateTicketId,
  getWibTime,
};
