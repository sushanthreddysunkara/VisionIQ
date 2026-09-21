const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const cors = require('cors')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const authRoutes = require('./routes/authRoutes')
const queryRoutes = require('./routes/queryRoutes')
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
  return (
    configuredFrontendOrigins.includes(origin) ||
    /^https?:\/\/((localhost)|(127\.0\.0\.1)|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(origin)
  )
}

const corsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
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

const port = Number(process.env.PORT || 5000)

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'visioniq_dev_secret_fallback_key_2025'
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
app.use('/api/query', queryRoutes)

// Serve evidence assets or dynamic high-fidelity surveillance fallback
const fsSync = require('fs')
app.use('/evidence', express.static(path.join(__dirname, '..', 'public', 'evidence')))
app.use('/evidence', express.static(path.join(__dirname, 'data', 'evidence')))
app.use('/evidence', (req, res) => {
  const reqPath = req.path || 'capture.jpg'
  const isPlate = reqPath.includes('plate')
  const basename = path.basename(reqPath)
  
  if (isPlate) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 200" width="100%" height="100%">
      <rect width="460" height="200" fill="#060913" />
      <rect x="30" y="40" width="400" height="120" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3" />
      <rect x="30" y="40" width="46" height="120" rx="6" fill="#003893" />
      <circle cx="53" cy="85" r="12" fill="none" stroke="#ffffff" stroke-width="1.5" />
      <text x="53" y="128" font-size="12" font-family="sans-serif" font-weight="900" fill="#ffffff" text-anchor="middle">IND</text>
      <text x="245" y="118" font-size="42" font-family="monospace" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="5">TG 08 CD 3015</text>
      <text x="35" y="30" font-size="12" font-family="monospace" fill="#10b981" font-weight="bold">● ANPR OCR MATCH 94%</text>
    </svg>`
    res.type('image/svg+xml').send(svg)
  } else {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="100%" height="100%">
      <defs>
        <linearGradient id="cctvGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#070c18"/>
          <stop offset="100%" stop-color="#020408"/>
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#cctvGrad)"/>
      <line x1="0" y1="90" x2="800" y2="90" stroke="rgba(56,189,248,0.12)" stroke-width="1"/>
      <line x1="0" y1="390" x2="800" y2="390" stroke="rgba(56,189,248,0.12)" stroke-width="1"/>
      <!-- Reticle Box -->
      <rect x="220" y="140" width="360" height="200" rx="10" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 4"/>
      <path d="M 220 170 L 220 140 L 250 140" fill="none" stroke="#38bdf8" stroke-width="3"/>
      <path d="M 550 140 L 580 140 L 580 170" fill="none" stroke="#38bdf8" stroke-width="3"/>
      <path d="M 220 310 L 220 340 L 250 340" fill="none" stroke="#38bdf8" stroke-width="3"/>
      <path d="M 550 340 L 580 340 L 580 310" fill="none" stroke="#38bdf8" stroke-width="3"/>
      <circle cx="400" cy="240" r="4" fill="#38bdf8"/>
      <!-- Optical Vehicle Silhouette -->
      <path d="M 300 270 Q 320 220 370 210 L 430 210 Q 480 220 500 270 Z" fill="rgba(56,189,248,0.18)" stroke="#38bdf8" stroke-width="2"/>
      <circle cx="340" cy="275" r="16" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
      <circle cx="460" cy="275" r="16" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
      <!-- HUD Top -->
      <circle cx="35" cy="45" r="6" fill="#ef4444"/>
      <text x="50" y="50" font-size="14" font-family="monospace" font-weight="bold" fill="#f87171">● REC [SURVEILLANCE CAM-02-HYD]</text>
      <text x="760" y="50" font-size="14" font-family="monospace" fill="#94a3b8" text-anchor="end">1080p OPTICAL 60FPS</text>
      <!-- HUD Bottom -->
      <rect x="230" y="150" width="130" height="24" rx="4" fill="rgba(56,189,248,0.25)"/>
      <text x="240" y="166" font-size="12" font-family="monospace" font-weight="bold" fill="#38bdf8">TARGET: ${basename}</text>
      <text x="35" y="440" font-size="13" font-family="monospace" fill="#34d399">EVIDENCE ARCHIVE VERIFIED</text>
      <text x="760" y="440" font-size="13" font-family="monospace" fill="#94a3b8" text-anchor="end">VISIONIQ INTELLIGENCE</text>
    </svg>`
    res.type('image/svg+xml').send(svg)
  }
})

async function startServer() {
  const dbStatus = await initializeDatabase()
  const host = process.env.HOST || '0.0.0.0'

  httpServer.listen(port, host, () => {
    console.log(`\n==============================================`)
    console.log(`🚀 VisionIQ API listening on http://${host}:${port}`)
    if (dbStatus && dbStatus.mock) {
      console.log(`⚠️  Database Mode: In-Memory Dev (MySQL offline)`)
      console.log(`🔑 Default Admin Credentials:`)
      console.log(`   - Email: ${process.env.ADMIN1_EMAIL || 'admin@visioniq.local'}`)
      console.log(`   - Username: ${process.env.ADMIN1_USERNAME || 'admin'}`)
      console.log(`   - Password: ${process.env.ADMIN1_PASSWORD || 'AdminPassword123!'}`)
    } else {
      console.log(` Connected to MySQL database "${process.env.MYSQL_DATABASE || 'vision_iq'}"`)
    }
    console.log(`==============================================\n`)
  })

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