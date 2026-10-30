const jwt = require('jsonwebtoken')
const User = require('../models/User')

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || ''
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.userId)
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized.' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' })
  }
}

module.exports = requireAuth
