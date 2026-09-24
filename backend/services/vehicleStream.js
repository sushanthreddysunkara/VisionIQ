const fs = require('fs/promises')
const path = require('path')
const XLSX = require('xlsx')
const { pool } = require('../config/database')

const STREAM_INTERVAL = Number(process.env.STREAM_INTERVAL || 4000)
const DATA_DIRECTORY = path.resolve(process.env.DATA_DIRECTORY || path.join(__dirname, '..', 'data'))
const NH44_FILE_NAME = 'NH44_vehicles_5000_merged_with_images.xlsx'

let latestStreamStatus = null
let streamPaused = false

const aliases = {
  id: ['id', 'record id', 'csv record id'],
  timestamp: ['timestamp (ist)', 'timestamp ist', 'timestamp', 'date time'],
  vehicleType: ['vehicle type', 'vehicle_type', 'type'],
  numberPlate: ['vehicle number plate', 'number plate', 'license plate', 'plate'],
  plateConfidence: ['plate confidence', 'plate_confidence', 'confidence'],
  vehicleImage: ['vehicle image', 'vehicle image url', 'image'],
  speed: ['speed (km/h)', 'speed', 'speed km/h'],
  speedLimit: ['speed limit (km/h)', 'speed limit', 'speed_limit'],
  overSpeed: ['over speed', 'overspeed', 'over_speed'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lon', 'lng'],
  videoClipPath: ['video clip path', 'video path', 'video url'],
  vehicleImagePath: ['vehicle image path', 'vehicle_image_path', 'vehicle photo path'],
  plateImagePath: ['plate image path', 'plate_image_path', 'plate photo path'],
  events: ['events', 'event', 'violation', 'rule'],
}

function cleanKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function valueFor(row, candidateNames) {
  const keys = Object.keys(row || {})
  const key = keys.find((item) => candidateNames.some((candidate) => cleanKey(candidate) === cleanKey(item)))
  return key === undefined || row[key] === null || row[key] === undefined ? '' : String(row[key]).trim()
}

function numberOrNull(value) {
  if (value === '') return null
  const number = Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(number) ? number : null
}

function deriveLocation(lat, lon, idNum) {
  if (lat && lon) {
    if (lat < 17.25) return 'NH-44 - Shadnagar Interchange (KM 52)'
    if (lat < 17.40) return 'NH-44 - Shamshabad Tollway (KM 18)'
    if (lat < 17.50) return 'NH-44 - Hyderabad Ring Corridor'
    return 'NH-44 - Medchal North Gateway (KM 36)'
  }
  const locations = [
    'NH-44 - Shamshabad Tollway (KM 18)',
    'NH-44 - Shadnagar Interchange (KM 52)',
    'NH-44 - Hyderabad Ring Corridor',
    'NH-44 - Medchal North Gateway (KM 36)',
    'NH-44 - Jadcherla Express Point (KM 84)',
  ]
  return locations[(idNum || 0) % locations.length]
}

function deriveCamera(idNum) {
  const cams = [
    'CAM-NH44-01-SHAMSHABAD',
    'CAM-NH44-02-SHADNAGAR',
    'CAM-NH44-03-RINGROAD',
    'CAM-NH44-04-MEDCHAL',
    'CAM-NH44-05-JADCHERLA',
    'CAM-NH44-06-TOLLPLAZA',
  ]
  return cams[(idNum || 0) % cams.length]
}

function toClientRecord(row) {
  const idNum = Number(String(row.id || row.csv_record_id || '').replace(/\D/g, '')) || 0
  const lat = row.latitude ? Number(row.latitude) : null
  const lon = row.longitude ? Number(row.longitude) : null

  return {
    id: row.id,
    csvRecordId: row.csv_record_id,
    observationId: row.csv_record_id,
    timestampIst: row.timestamp_ist,
    timestamp: row.timestamp_ist,
    vehicleType: row.vehicle_type,
    type: row.vehicle_type,
    vehicleNumberPlate: row.vehicle_number_plate,
    numberPlate: row.vehicle_number_plate,
    plateConfidence: row.plate_confidence ? Number(row.plate_confidence) : 0.95,
    confidence: row.plate_confidence ? Number(row.plate_confidence) : 0.95,
    vehicleImage: row.vehicle_image,
    speed: row.speed ? Number(row.speed) : 0,
    speedLimit: row.speed_limit ? Number(row.speed_limit) : 60,
    overSpeed: row.over_speed,
    isOverSpeed: String(row.over_speed).toLowerCase() === 'yes',
    latitude: lat,
    longitude: lon,
    location: deriveLocation(lat, lon, idNum),
    camera: deriveCamera(idNum),
    videoClipPath: row.video_clip_path,
    vehicleImagePath: row.vehicle_image_path || row.vehicle_image,
    plateImagePath: row.plate_image_path,
    events: row.events,
    sourceFile: row.source_file,
  }
}

/**
 * Random batch function: returns a random number of records between 1 and 20
 */
function getRandomBatchSize() {
  return Math.floor(Math.random() * 20) + 1
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/**
 * Ensure the 5,000 NH-44 records are stored in MySQL
 */
async function seedNH44DatabaseIfEmpty() {
  if (!pool) return
  try {
    const [existing] = await pool.query('SELECT COUNT(*) as count FROM vehicle_events WHERE source_file = ?', [NH44_FILE_NAME])
    if (existing[0]?.count >= 5000) {
      console.log(`[Database] NH-44 dataset verified: ${existing[0].count} records ready in MySQL.`)
      return
    }

    const potentialPaths = [
      path.resolve(__dirname, '..', '..', NH44_FILE_NAME),
      path.resolve(__dirname, '..', NH44_FILE_NAME),
      path.resolve(DATA_DIRECTORY, NH44_FILE_NAME),
    ]

    const targetFile = potentialPaths.find((p) => {
      try { return require('fs').existsSync(p) } catch { return false }
    })

    if (!targetFile) {
      console.warn(`[Database Notice] ${NH44_FILE_NAME} not found on disk, skipping auto-seed.`)
      return
    }

    console.log(`[Database] Storing 5,000 records from ${targetFile} into MySQL database...`)
    const wb = XLSX.readFile(targetFile)
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)

    const BATCH_SIZE = 500
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE)
      const values = chunk.map((r, idx) => {
        const globalIndex = i + idx + 1
        const id = 'NH44-' + String(globalIndex).padStart(5, '0')
        const timestamp = r['Timestamp (IST)'] ? String(r['Timestamp (IST)']) : null
        const type = r['Vehicle Type'] ? String(r['Vehicle Type']) : 'Unknown'
        const plate = r['Vehicle Number Plate'] ? String(r['Vehicle Number Plate']) : null
        const conf = r['Plate Confidence'] !== undefined ? Number(r['Plate Confidence']) : null
        const speed = r['Speed (km/h)'] !== undefined ? Number(r['Speed (km/h)']) : null
        const speedLimit = r['Speed Limit (km/h)'] !== undefined ? Number(r['Speed Limit (km/h)']) : null
        const overSpeed = r['Over Speed'] ? String(r['Over Speed']) : (speed && speedLimit && speed > speedLimit ? 'Yes' : 'No')
        const lat = r['Latitude'] !== undefined ? Number(r['Latitude']) : null
        const lon = r['Longitude'] !== undefined ? Number(r['Longitude']) : null
        const video = r['Video Clip Path'] ? String(r['Video Clip Path']) : null
        const imgPath = r['Vehicle Image Path'] ? String(r['Vehicle Image Path']) : null
        const events = r['Events'] ? String(r['Events']) : (overSpeed === 'Yes' ? 'Overspeeding' : 'Standard detection')
        return [id, timestamp, type, plate, conf, null, speed, speedLimit, overSpeed, lat, lon, video, imgPath, null, events, NH44_FILE_NAME]
      })

      await pool.query(
        'INSERT IGNORE INTO vehicle_events (csv_record_id, timestamp_ist, vehicle_type, vehicle_number_plate, plate_confidence, vehicle_image, speed, speed_limit, over_speed, latitude, longitude, video_clip_path, vehicle_image_path, plate_image_path, events, source_file) VALUES ?',
        [values]
      )
    }
    console.log(`[Database] Successfully stored all 5,000 records from ${NH44_FILE_NAME} in MySQL.`)
  } catch (error) {
    console.error('[Database Seeding Error]:', error.message)
  }
}

let currentActiveFileName = NH44_FILE_NAME
let streamOffset = 0

function getActiveFileName() {
  return currentActiveFileName
}

/**
 * Fetch a random number of records (1 to 20) from the database sequentially
 */
async function fetchRandomVehicleBatch(forcedCount = null, requestedFileName = null) {
  const count = typeof forcedCount === 'number' && forcedCount > 0
    ? Math.min(forcedCount, 50)
    : getRandomBatchSize()

  if (!pool) {
    return { count: 0, batchSize: count, records: [] }
  }

  const targetFile = requestedFileName || currentActiveFileName

  // Sequentially progress through database for active file
  let [rows] = await pool.query(
    'SELECT * FROM vehicle_events WHERE source_file = ? OR source_file LIKE ? ORDER BY id ASC LIMIT ? OFFSET ?',
    [targetFile, `%${targetFile}%`, count, streamOffset]
  )

  if (!rows || rows.length === 0) {
    streamOffset = 0
    const [freshRows] = await pool.query(
      'SELECT * FROM vehicle_events WHERE source_file = ? OR source_file LIKE ? ORDER BY id ASC LIMIT ? OFFSET 0',
      [targetFile, `%${targetFile}%`, count]
    )
    rows = freshRows || []
  }

  streamOffset = streamOffset + rows.length

  const clientRecords = rows.map(toClientRecord)
  return {
    count: clientRecords.length,
    batchSize: count,
    records: clientRecords,
  }
}

/**
 * Stores an uploaded vehicle dataset into MySQL and switches active stream to it
 */
async function storeUploadedVehicleRecords(fileName, rows) {
  if (!pool) {
    throw new Error('Database connection is not available.')
  }
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No records found in the uploaded file.')
  }

  currentActiveFileName = fileName
  streamOffset = 0

  const CHUNK_SIZE = 250
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const values = chunk.map((r, index) => {
      const globalIdx = i + index + 1
      const id = r.csvRecordId || r.observationId || r.id || `${fileName.replace(/\.[^/.]+$/, '')}-${String(globalIdx).padStart(5, '0')}`
      const timestamp = r.timestampIst || r.timestamp || r.time || new Date().toISOString().slice(0, 19).replace('T', ' ')
      const type = r.vehicleType || r.type || 'car'
      const plate = r.vehicleNumberPlate || r.numberPlate || r.plate || ''
      const conf = r.plateConfidence || r.confidence ? Number(r.plateConfidence || r.confidence) : 0.95
      const speed = r.speed ? Number(r.speed) : Math.floor(Math.random() * 40) + 45
      const speedLimit = r.speedLimit ? Number(r.speedLimit) : 60
      const isOver = r.isOverSpeed || r.overSpeed === 'Yes' || speed > speedLimit
      const overSpeed = isOver ? 'Yes' : 'No'
      const lat = r.latitude ? Number(r.latitude) : 17.385044
      const lon = r.longitude ? Number(r.longitude) : 78.486671
      const video = r.videoClipPath || null
      const imgPath = r.vehicleImagePath || r.image || null
      const events = r.events ? String(r.events) : (isOver ? 'Overspeeding' : 'Standard detection')
      return [id, timestamp, type, plate, conf, null, speed, speedLimit, overSpeed, lat, lon, video, imgPath, null, events, fileName]
    })

    await pool.query(
      'INSERT IGNORE INTO vehicle_events (csv_record_id, timestamp_ist, vehicle_type, vehicle_number_plate, plate_confidence, vehicle_image, speed, speed_limit, over_speed, latitude, longitude, video_clip_path, vehicle_image_path, plate_image_path, events, source_file) VALUES ?',
      [values]
    )
  }

  console.log(`[Database] Successfully stored ${rows.length} records for uploaded file "${fileName}" in MySQL.`)

  // Return initial random batch (1-20 records) from the newly stored dataset
  const initialBatch = await fetchRandomVehicleBatch(null, fileName)
  return {
    success: true,
    totalStored: rows.length,
    fileName,
    initialBatch: initialBatch.records,
  }
}

function pauseStream() {
  streamPaused = true
  return { paused: true }
}

function resumeStream() {
  streamPaused = false
  return { paused: false }
}

function isStreamPaused() {
  return streamPaused
}

async function triggerInstantBatch(io) {
  const batch = await fetchRandomVehicleBatch()
  if (batch.records.length && io) {
    io.emit('newVehicleBatch', batch.records)
    const status = {
      type: 'batch',
      fileName: currentActiveFileName,
      batchCount: batch.count,
      totalPool: 5000,
      timestamp: new Date().toLocaleTimeString(),
      overspeeding: batch.records.filter((r) => r.isOverSpeed).length,
      isPaused: streamPaused,
      manualTrigger: true,
    }
    latestStreamStatus = status
    io.emit('vehicleStreamStatus', status)
  }
  return batch
}

async function runVehicleStream(io) {
  await seedNH44DatabaseIfEmpty()

  console.log(`[VehicleStream] Live telemetry streaming initialized (random batches 1-20 records every ${STREAM_INTERVAL / 1000}s)`)

  while (true) {
    try {
      if (!streamPaused) {
        const batch = await fetchRandomVehicleBatch()
        if (batch.records.length && io) {
          io.emit('newVehicleBatch', batch.records)
          const status = {
            type: 'batch',
            fileName: currentActiveFileName,
            batchCount: batch.count,
            totalPool: 5000,
            timestamp: new Date().toLocaleTimeString(),
            overspeeding: batch.records.filter((r) => r.isOverSpeed).length,
            isPaused: streamPaused,
          }
          latestStreamStatus = status
          io.emit('vehicleStreamStatus', status)
          console.log(`[VehicleStream] Broadcast random batch of ${batch.count} records (1-20 random range)`)
        }
      }
    } catch (err) {
      console.error('[VehicleStream Loop Error]:', err.message)
    }

    await wait(STREAM_INTERVAL)
  }
}

/**
 * Returns initial sample of stored vehicles (default 20, avoids reading entire file at once)
 */
async function getStoredVehicles({ limit = 20, fileName = null } = {}) {
  if (!pool) return []
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const targetFile = fileName || currentActiveFileName
  const [rows] = await pool.query(
    'SELECT * FROM vehicle_events WHERE source_file = ? OR source_file LIKE ? ORDER BY id ASC LIMIT ?',
    [targetFile, `%${targetFile}%`, safeLimit]
  )
  return rows.map(toClientRecord)
}

async function getVehiclePoolStats(fileName = null) {
  if (!pool) return { totalPool: 0 }
  const targetFile = fileName || currentActiveFileName
  const [totalRes] = await pool.query(
    "SELECT COUNT(*) as count, AVG(speed) as avgSpeed, SUM(CASE WHEN over_speed = 'Yes' THEN 1 ELSE 0 END) as overspeedCount FROM vehicle_events WHERE source_file = ? OR source_file LIKE ?",
    [targetFile, `%${targetFile}%`]
  )
  const [typesRes] = await pool.query(
    'SELECT vehicle_type, COUNT(*) as count FROM vehicle_events WHERE source_file = ? OR source_file LIKE ? GROUP BY vehicle_type',
    [targetFile, `%${targetFile}%`]
  )
  return {
    totalPool: totalRes[0]?.count || 0,
    averageSpeed: Math.round(totalRes[0]?.avgSpeed || 68),
    overspeedTotal: totalRes[0]?.overspeedCount || 0,
    vehicleTypes: typesRes.reduce((acc, r) => { acc[r.vehicle_type] = r.count; return acc }, {}),
    fileName: targetFile,
  }
}

function getLatestStreamStatus() {
  return latestStreamStatus
}

module.exports = {
  DATA_DIRECTORY,
  getLatestStreamStatus,
  getStoredVehicles,
  runVehicleStream,
  fetchRandomVehicleBatch,
  pauseStream,
  resumeStream,
  isStreamPaused,
  triggerInstantBatch,
  seedNH44DatabaseIfEmpty,
  getVehiclePoolStats,
  storeUploadedVehicleRecords,
  getActiveFileName,
}