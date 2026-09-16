const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

function publicUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    role: user.role,
  }
}

function createToken(user) {
  return jwt.sign(
    { userId: String(user.id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' },
  )
}

async function login(req, res) {
  const { identifier, email, username, password } = req.body || {}
  const loginIdentifier = String(identifier || email || username || '').trim()

  if (!loginIdentifier || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, message: 'Email/username and password are required.' })
  }

  const user = await User.findByIdentifier(loginIdentifier)

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' })
  }

  return res.json({
    success: true,
    message: 'Login successful',
    token: createToken(user),
    user: publicUser(user),
  })
}

function me(req, res) {
  return res.json({ success: true, user: publicUser(req.user) })
}

module.exports = { login, me }
