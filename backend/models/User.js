const { pool } = require('../config/database')

async function findByIdentifier(identifier) {
  const field = identifier.includes('@') ? 'email' : 'username'
  const value = field === 'email' ? identifier.toLowerCase() : identifier
  const [rows] = await pool.execute(`SELECT id, username, email, password, role FROM users WHERE ${field} = ? LIMIT 1`, [value])
  return rows[0] || null
}

async function findById(id) {
  const [rows] = await pool.execute('SELECT id, username, email, password, role FROM users WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
}

async function upsertByEmail({ username, email, password, role = 'admin' }) {
  await pool.execute(
    `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE username = VALUES(username), password = VALUES(password), role = VALUES(role)`,
    [username, email.toLowerCase(), password, role],
  )
}

module.exports = { findByIdentifier, findById, upsertByEmail }
