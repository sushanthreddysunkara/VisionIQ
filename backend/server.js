require('dotenv').config()

const cors = require('cors')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const authRoutes = require('./routes/authRoutes')
const { initializeDatabase } = require('./config/database')
const { getLatestStreamStatus, getStoredVehicles, runVehicleStream } = require('./services/vehicleStream')

const app = express()
const httpServer = http.createServer(app)
const configuredFrontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (configuredFrontendOrigins.includes('*')) return true
  return configuredFrontendOrigins.includes(origin) || /^https?:\/\/((localhost)|(127\.0\.0\.1)|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(origin)
}

const corsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
}

const io = new Server(httpServer, {
  cors: corsOptions,
})
io.on('connection', async (socket) => {
  try {
    let afterId = 0
    while (true) {
      const storedVehicles = await getStoredVehicles({ afterId, limit: Math.floor(Math.random() * 20) + 1 })
      if (!storedVehicles.length) break
      socket.emit('newVehicleBatch', storedVehicles)
      afterId = storedVehicles[storedVehicles.length - 1].id
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  } catch (error) {
    console.error('Unable to sync stored vehicle events:', error.message)
  }

  const latestStatus = getLatestStreamStatus()
  if (latestStatus) socket.emit('vehicleStreamStatus', latestStatus)
})
const port = process.env.PORT || 5000

if (!process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD || !process.env.MYSQL_DATABASE || !process.env.JWT_SECRET) {
  throw new Error('MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, and JWT_SECRET must be set in backend/.env')
}

app.use(cors(corsOptions))
app.use(express.json())
app.get('/api/health', (req, res) => res.json({ success: true, message: 'VisionIQ API is running.' }))
app.get('/api/vehicles', async (req, res) => {
  try {
    res.json({ success: true, vehicles: await getStoredVehicles() })
  } catch (error) {
    console.error('Unable to load vehicle events:', error.message)
    res.status(500).json({ success: false, message: 'Unable to load vehicle events.' })
  }
})
app.use('/api/auth', authRoutes)

async function startServer() {
  await initializeDatabase()
  const host = process.env.HOST || '0.0.0.0'
  httpServer.listen(port, host, () => console.log(`VisionIQ API listening on http://${host}:${port}`))
  runVehicleStream(io).catch((error) => console.error('Vehicle stream stopped:', error))
}

startServer().catch((error) => {
  if (error.code === 'ENOTFOUND') {
    console.error(
      `Unable to connect to MySQL: host "${process.env.MYSQL_HOST}" could not be resolved. ` +
      'Update MYSQL_HOST in backend/.env with the current database endpoint from Aiven, then restart the server.',
    )
  } else if (error.code === 'ECONNREFUSED') {
    console.error(
      `Unable to connect to MySQL at ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}. ` +
      'Check that the database is running and that the configured port is reachable.',
    )
  } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error(
      'MySQL rejected the credentials. Update MYSQL_USER and MYSQL_PASSWORD in backend/.env.',
    )
  } else {
    console.error('Unable to start server:', error.code || error.message || error)
  }
  process.exit(1)
})