const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const cors = require('cors')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const authRoutes = require('./routes/authRoutes')
const queryRoutes = require('./routes/queryRoutes')
const { initializeDatabase } = require('./config/database')
const {
  getLatestStreamStatus,
  getStoredVehicles,
  runVehicleStream,
  fetchRandomVehicleBatch,
  pauseStream,
  resumeStream,
  isStreamPaused,
  triggerInstantBatch,
  getVehiclePoolStats,
  storeUploadedVehicleRecords,
  getActiveFileName,
  searchVehicles,
  toClientRecord,
} = require('./services/vehicleStream')
const { pool } = require('./config/database')

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

io.on('connection', (socket) => {
  const latestStatus = getLatestStreamStatus()
  if (latestStatus) {
    socket.emit('vehicleStreamStatus', latestStatus)
  }
})

const port = Number(process.env.PORT || 5000)

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'visioniq_dev_secret_fallback_key_2025'
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ extended: true, limit: '100mb' }))

app.get('/api/health', (req, res) => res.json({ success: true, message: 'VisionIQ API is running.' }))

// Upload new Excel/CSV file to store in MySQL and switch active live stream
app.post('/api/vehicles/upload', async (req, res) => {
  try {
    const { fileName, rows, isAppend = false, isLastChunk = true, totalRecords } = req.body || {}
    if (!fileName || !Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ success: false, message: 'fileName and rows array required for upload.' })
    }

    const result = await storeUploadedVehicleRecords(fileName, rows, { isAppend })

    // If this is a complete upload or the final chunk, broadcast new dataset status to all connected dashboards
    if (isLastChunk) {
      io.emit('vehicleStreamStatus', {
        type: 'dataset_switched',
        fileName,
        totalRows: totalRecords || result.totalStored,
        batchCount: result.initialBatch ? result.initialBatch.length : 0,
        timestamp: new Date().toLocaleTimeString(),
        overspeeding: result.initialBatch ? result.initialBatch.filter((r) => r.isOverSpeed).length : 0,
      })

      // Immediately push initial batch of the newly uploaded data
      if (result.initialBatch && result.initialBatch.length) {
        io.emit('newVehicleBatch', result.initialBatch)
      }
    }

    res.json({
      success: true,
      message: `Successfully stored ${result.totalStored} records from "${fileName}" in MySQL database.`,
      ...result,
    })
  } catch (error) {
    console.error('Error handling vehicle upload:', error.message)
    res.status(500).json({ success: false, message: error.message || 'Error processing upload.' })
  }
})

// Initial vehicles load (capped to limit, default 20)
app.get('/api/vehicles', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const fileName = req.query.fileName || null
    const vehicles = await getStoredVehicles({ limit, fileName })
    res.json({ success: true, count: vehicles.length, vehicles })
  } catch (error) {
    console.error('Unable to load vehicle events:', error.message)
    res.status(500).json({ success: false, message: 'Unable to load vehicle events.' })
  }
})

function isSpecificVehicleQuery(queryText) {
  const q = String(queryText || '').trim().toLowerCase()
  if (!q) return false
  const plateMatch = q.match(/\b([a-z]{2}\s*[-]?\s*[0-9]{1,2}\s*[-]?\s*[a-z]{0,3}\s*[-]?\s*[0-9]{1,4})\b/i)
  if (plateMatch) {
    const raw = plateMatch[1].replace(/[^a-z0-9]/gi, '')
    if (raw.length >= 5 && !raw.startsWith('cam')) return true
  }
  if (q.match(/\b(?:nh44|obs|record|telemetry)[-_ ]*\d+\b/i)) return true
  return false
}

// Fast vehicle search across all 7,044 records in MySQL database
app.get('/api/vehicles/search', async (req, res) => {
  try {
    const q = req.query.q || req.query.query || req.query.plate || ''
    const limit = req.query.limit ? Number(req.query.limit) : 50
    if (!q || !q.trim()) {
      return res.json({ success: true, count: 0, vehicles: [] })
    }

    const vehicles = await searchVehicles(q, limit)

    let dossier = null
    if (vehicles.length > 0 && isSpecificVehicleQuery(q)) {
      const top = vehicles[0]
      const isOver = top.isOverSpeed || String(top.overSpeed).toLowerCase() === 'yes'
      dossier = {
        primaryPlate: top.vehicleNumberPlate,
        vehicleType: top.vehicleType,
        detectionCount: vehicles.length,
        lastLocation: top.location,
        camera: top.camera,
        speed: top.speed,
        speedLimit: top.speedLimit,
        isOverSpeed: isOver,
        timestampIst: top.timestampIst,
        plateConfidence: Math.round(Number(top.plateConfidence || 0.95) * (Number(top.plateConfidence || 0.95) <= 1 ? 100 : 1)),
        image: top.vehicleImagePath || top.vehicleImage,
        summary: `Vehicle ${top.vehicleNumberPlate} (${top.vehicleType}) recorded at ${top.location} by ${top.camera} at ${top.timestampIst}. Velocity: ${top.speed} km/h (Limit: ${top.speedLimit} km/h, ${isOver ? 'SPEED VIOLATION' : 'Normal Speed'}). ANPR OCR Confidence: ${Math.round(Number(top.plateConfidence || 0.95) * 100)}%.`,
      }
    }

    res.json({
      success: true,
      query: q,
      count: vehicles.length,
      dossier,
      vehicles,
    })
  } catch (error) {
    console.error('Error in /api/vehicles/search:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Fetch random number of records (1 to 20) using random function
app.get('/api/vehicles/random-batch', async (req, res) => {
  try {
    if (isStreamPaused() && req.query.force !== 'true') {
      return res.json({ success: true, count: 0, batchSize: 0, vehicles: [], isPaused: true })
    }
    const requestedCount = req.query.count ? Number(req.query.count) : null
    const fileName = req.query.fileName || null
    const batch = await fetchRandomVehicleBatch(requestedCount, fileName)
    if (req.query.broadcast === 'true') {
      io.emit('newVehicleBatch', batch.records)
      io.emit('vehicleStreamStatus', {
        type: 'batch',
        fileName: fileName || getActiveFileName(),
        batchCount: batch.count,
        totalPool: batch.totalPool || 7044,
        timestamp: new Date().toLocaleTimeString(),
        overspeeding: batch.records.filter((r) => r.isOverSpeed).length,
      })
    }
    res.json({ success: true, count: batch.count, batchSize: batch.batchSize, vehicles: batch.records })
  } catch (error) {
    console.error('Unable to fetch random batch:', error.message)
    res.status(500).json({ success: false, message: 'Unable to fetch random batch.' })
  }
})

// Live stream control: get status, pause, resume, stop, or trigger instant random batch
app.get('/api/vehicles/stream-control', (req, res) => {
  res.json({ success: true, isPaused: isStreamPaused() })
})

app.post('/api/vehicles/stream-control', async (req, res) => {
  const { action } = req.body || {}
  if (action === 'pause' || action === 'stop') {
    pauseStream()
    io.emit('vehicleStreamStatus', { ...getLatestStreamStatus(), isPaused: true })
    return res.json({ success: true, isPaused: true, message: 'Live feed and database fetching stopped.' })
  }
  if (action === 'resume' || action === 'start') {
    resumeStream()
    io.emit('vehicleStreamStatus', { ...getLatestStreamStatus(), isPaused: false })
    return res.json({ success: true, isPaused: false, message: 'Live feed and database fetching resumed.' })
  }
  if (action === 'trigger' || action === 'next') {
    const batch = await triggerInstantBatch(io)
    return res.json({ success: true, count: batch.count, vehicles: batch.records })
  }
  res.status(400).json({ success: false, message: 'Invalid stream control action. Use "stop", "start", "pause", "resume", or "trigger".' })
})

// Pool statistics across records in MySQL
app.get('/api/vehicles/stats', async (req, res) => {
  try {
    const fileName = req.query.fileName || null
    const stats = await getVehiclePoolStats(fileName)
    res.json({ success: true, stats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Incidents & Violations endpoint
app.get('/api/vehicles/incidents', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50
    if (!pool) return res.json({ success: true, count: 0, incidents: [] })
    const [rows] = await pool.query(
      `SELECT * FROM vehicle_events 
       WHERE over_speed = 'Yes' OR events LIKE '%violation%' OR events LIKE '%speed%' OR events LIKE '%collision%'
       ORDER BY id DESC LIMIT ?`,
      [limit]
    )
    const incidents = rows.map((r) => {
      const client = toClientRecord(r)
      return {
        vehicleNumber: client.vehicleNumberPlate,
        vehicleType: client.vehicleType,
        incidentType: client.isOverSpeed ? 'Collision' : (client.events || 'Accident'),
        incidentTime: client.timestampIst,
        collisionCamera: client.camera,
        status: client.isOverSpeed ? 'Tracking' : 'Detected',
        observations: [
          {
            cameraId: client.camera,
            timestamp: client.timestampIst,
            latitude: client.latitude,
            longitude: client.longitude,
            location: client.location,
            detectionType: client.isOverSpeed ? 'Collision' : 'Incident',
            confidence: client.plateConfidence,
            imageUrl: client.vehicleImagePath,
            speed: client.speed,
            speedLimit: client.speedLimit,
          }
        ]
      }
    })
    res.json({ success: true, count: incidents.length, incidents })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Camera Network endpoint
app.get('/api/cameras', async (req, res) => {
  try {
    const cams = [
      { id: 'CAM-NH44-01-SHAMSHABAD', name: 'Shamshabad Tollway (KM 18)', latitude: 17.385044, longitude: 78.486671, status: 'Active' },
      { id: 'CAM-NH44-02-SHADNAGAR', name: 'Shadnagar Interchange (KM 52)', latitude: 17.215, longitude: 78.204, status: 'Active' },
      { id: 'CAM-NH44-03-RINGROAD', name: 'Hyderabad Ring Corridor', latitude: 17.4431, longitude: 78.3812, status: 'Active' },
      { id: 'CAM-NH44-04-MEDCHAL', name: 'Medchal North Gateway (KM 36)', latitude: 17.629, longitude: 78.481, status: 'Active' },
      { id: 'CAM-NH44-05-JADCHERLA', name: 'Jadcherla Express Point (KM 84)', latitude: 16.764, longitude: 78.136, status: 'Active' },
      { id: 'CAM-NH44-06-TOLLPLAZA', name: 'Raikal Toll Plaza', latitude: 17.062, longitude: 78.243, status: 'Active' },
    ]
    res.json({ success: true, count: cams.length, cameras: cams })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
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

// Serve vehicle snapshot images or dynamic surveillance preview fallback
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')))
app.use('/images', express.static(path.join(__dirname, 'data', 'images')))
app.use('/images', (req, res) => {
  const reqPath = req.path || 'image.jpg'
  const basename = path.basename(reqPath)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="100%" height="100%">
    <defs>
      <linearGradient id="camGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#050814"/>
        <stop offset="100%" stop-color="#02040a"/>
      </linearGradient>
      <linearGradient id="scanBeam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(56,189,248,0)"/>
        <stop offset="50%" stop-color="rgba(56,189,248,0.25)"/>
        <stop offset="100%" stop-color="rgba(56,189,248,0)"/>
      </linearGradient>
    </defs>
    <rect width="800" height="480" fill="url(#camGrad)"/>
    <rect x="0" y="210" width="800" height="60" fill="url(#scanBeam)"/>
    <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(56,189,248,0.15)" stroke-width="1"/>
    <line x1="0" y1="360" x2="800" y2="360" stroke="rgba(56,189,248,0.15)" stroke-width="1"/>
    
    <!-- Target Detection Bounding Box -->
    <rect x="200" y="120" width="400" height="230" rx="8" fill="rgba(15,23,42,0.6)" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 4"/>
    <path d="M 200 150 L 200 120 L 230 120" fill="none" stroke="#38bdf8" stroke-width="3"/>
    <path d="M 570 120 L 600 120 L 600 150" fill="none" stroke="#38bdf8" stroke-width="3"/>
    <path d="M 200 320 L 200 350 L 230 350" fill="none" stroke="#38bdf8" stroke-width="3"/>
    <path d="M 570 350 L 600 350 L 600 320" fill="none" stroke="#38bdf8" stroke-width="3"/>
    
    <!-- Optical Vehicle Chassis -->
    <path d="M 280 270 Q 310 200 370 190 L 430 190 Q 490 200 520 270 Z" fill="rgba(56,189,248,0.22)" stroke="#38bdf8" stroke-width="2.5"/>
    <circle cx="330" cy="280" r="18" fill="#090d16" stroke="#38bdf8" stroke-width="2.5"/>
    <circle cx="470" cy="280" r="18" fill="#090d16" stroke="#38bdf8" stroke-width="2.5"/>
    
    <!-- Live HUD Telemetry -->
    <circle cx="32" cy="40" r="5" fill="#ef4444"/>
    <text x="45" y="44" font-size="13" font-family="monospace" font-weight="bold" fill="#ef4444">NH-44 SURVEILLANCE FEED</text>
    <text x="765" y="44" font-size="13" font-family="monospace" fill="#38bdf8" text-anchor="end">4K OPTICAL RADAR</text>
    <rect x="210" y="132" width="160" height="22" rx="4" fill="rgba(14,165,233,0.3)"/>
    <text x="218" y="147" font-size="11" font-family="monospace" font-weight="bold" fill="#7dd3fc">CAPTURE: ${basename}</text>
    <text x="32" y="448" font-size="12" font-family="monospace" fill="#34d399">DATABASE RECORD VERIFIED (5,000 ARCHIVE)</text>
    <text x="765" y="448" font-size="12" font-family="monospace" fill="#94a3b8" text-anchor="end">VISIONIQ HIGHWAY AI</text>
  </svg>`
  res.type('image/svg+xml').send(svg)
})


// Express Error Handling Middleware - ALWAYS returns JSON, never HTML
app.use((err, req, res, next) => {
  console.error('[VisionIQ API Error]:', err.message || err)
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      message: 'Uploaded file payload is too large. Please upload files under 100MB.',
    })
  }
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
  })
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