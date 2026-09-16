require('dotenv').config()

const cors = require('cors')
const express = require('express')
const authRoutes = require('./routes/authRoutes')
const { initializeDatabase } = require('./config/database')

const app = express()
const port = process.env.PORT || 5000

if (!process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD || !process.env.MYSQL_DATABASE || !process.env.JWT_SECRET) {
  throw new Error('MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, and JWT_SECRET must be set in backend/.env')
}

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())
app.get('/api/health', (req, res) => res.json({ success: true, message: 'VisionIQ API is running.' }))
app.use('/api/auth', authRoutes)

async function startServer() {
  await initializeDatabase()
  app.listen(port, () => console.log(`VisionIQ API listening on port ${port}`))
}

startServer().catch((error) => {
  console.error('Unable to start server:', error.code || error.message || error)
  process.exit(1)
})
