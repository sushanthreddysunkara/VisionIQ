const { pool, isMockMode, mockUsers } = require('../config/database')

async function findByIdentifier(identifier) {
  const cleanId = String(identifier || '').trim()
  if (!cleanId) return null

  if (isMockMode()) {
    const term = cleanId.toLowerCase()
    return mockUsers.find((u) => u.email.toLowerCase() === term || u.username.toLowerCase() === term) || null
  }

  const isEmail = cleanId.includes('@')
  const field = isEmail ? 'email' : 'username'
  const value = cleanId.toLowerCase()

  const [rows] = await pool.execute(
    `SELECT id, username, email, password, role FROM users WHERE LOWER(${field}) = LOWER(?) LIMIT 1`,
    [value],
  )
  return rows[0] || null
}

async function findById(id) {
  if (isMockMode()) {
    return mockUsers.find((u) => String(u.id) === String(id)) || null
  }
  const [rows] = await pool.execute('SELECT id, username, email, password, role FROM users WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
}

async function upsertByEmail({ username, email, password, role = 'admin' }) {
  const targetEmail = String(email || '').trim().toLowerCase()
  const cleanUsername = String(username || '').trim()

  if (isMockMode()) {
    const existingIndex = mockUsers.findIndex((u) => u.email.toLowerCase() === targetEmail)
    if (existingIndex >= 0) {
      mockUsers[existingIndex] = { ...mockUsers[existingIndex], username: cleanUsername, password, role }
    } else {
      mockUsers.push({ id: mockUsers.length + 1, username: cleanUsername, email: targetEmail, password, role })
    }
    return
  }

  await pool.execute(
    `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE username = VALUES(username), password = VALUES(password), role = VALUES(role)`,
    [cleanUsername, targetEmail, password, role],
  )
}

module.exports = { findByIdentifier, findById, upsertByEmail }
