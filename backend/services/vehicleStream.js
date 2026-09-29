const fs = require('fs/promises')
const path = require('path')
const XLSX = require('xlsx')
const { pool } = require('../config/database')

const STREAM_INTERVAL = Number(process.env.STREAM_INTERVAL || 2500)
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

function canonicalVehicleType(raw) {
  if (!raw) return 'Car'
  const norm = String(raw).trim().toLowerCase()
  if (norm.includes('truck') || norm.includes('lorry') || norm.includes('trailer')) return 'Truck'
  if (norm.includes('bus')) return 'Bus'
  if (norm.includes('auto') || norm.includes('rickshaw')) return 'Auto'
  if (norm.includes('bike') || norm.includes('motorcycle') || norm.includes('scooter') || norm.includes('two wheeler')) return 'Bike'
  if (norm.includes('van')) return 'Van'
  if (norm.includes('suv') || norm.includes('jeep')) return 'SUV'
  if (norm.includes('tractor')) return 'Tractor'
  if (norm.includes('pedestrian')) return 'Pedestrian'
  if (norm.includes('train')) return 'Train'
  if (norm.includes('car') || norm.includes('sedan') || norm.includes('hatchback')) return 'Car'
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

function toClientRecord(row) {
  const idNum = Number(String(row.id || row.csv_record_id || '').replace(/\D/g, '')) || 0
  const lat = row.latitude ? Number(row.latitude) : null
  const lon = row.longitude ? Number(row.longitude) : null
  const cleanType = canonicalVehicleType(row.vehicle_type)

  return {
    id: row.id,
    csvRecordId: row.csv_record_id,
    observationId: row.csv_record_id,
    timestampIst: row.timestamp_ist,
    timestamp: row.timestamp_ist,
    vehicleType: cleanType,
    type: cleanType,
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
        const type = canonicalVehicleType(r['Vehicle Type'])
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

const ALL_RECORDS_MODE = 'ALL_DATABASE_RECORDS'
const ALL_RECORDS_LABEL = 'All Database Records (7,044 Live Archive)'

let currentActiveFileName = ALL_RECORDS_MODE
let streamOffset = 0

function isAllMode(target) {
  if (!target) return true
  const lower = String(target).toLowerCase().trim()
  return (
    lower === 'all' ||
    lower === 'all_database_records' ||
    lower === 'all database records' ||
    lower.includes('all database') ||
    lower.includes('all records') ||
    lower.includes('7,044')
  )
}

async function getTotalDatabaseRecordCount() {
  if (!pool) return 0
  try {
    const [res] = await pool.query('SELECT COUNT(*) as count FROM vehicle_events')
    return Number(res[0]?.count || 0)
  } catch {
    return 7044
  }
}

function getActiveFileName() {
  return isAllMode(currentActiveFileName) ? ALL_RECORDS_LABEL : currentActiveFileName
}

/**
 * Fetch a random number of records (1 to 20) from the database sequentially, looping through all records
 */
async function fetchRandomVehicleBatch(forcedCount = null, requestedFileName = null) {
  const count = typeof forcedCount === 'number' && forcedCount > 0
    ? Math.min(forcedCount, 50)
    : getRandomBatchSize()

  if (!pool) {
    return { count: 0, batchSize: count, records: [], totalPool: 0 }
  }

  const targetFile = requestedFileName !== null && requestedFileName !== undefined
    ? requestedFileName
    : currentActiveFileName

  const queryingAll = isAllMode(targetFile)
  const totalCount = await getTotalDatabaseRecordCount()
  let rows = []

  if (queryingAll) {
    // If stream offset reached or exceeded the total database pool, wrap around to loop from beginning
    if (streamOffset >= totalCount && totalCount > 0) {
      console.log(`[VehicleStream] Stream reached end of database pool (${streamOffset}/${totalCount}). Looping back to offset 0.`)
      streamOffset = 0
    }

    const [fetched] = await pool.query(
      'SELECT * FROM vehicle_events ORDER BY id ASC LIMIT ? OFFSET ?',
      [count, streamOffset]
    )
    rows = fetched || []

    // If query returned no rows (e.g. boundary wrap), loop back to beginning
    if (!rows.length && totalCount > 0) {
      console.log(`[VehicleStream] Loop wrap: returning to offset 0 across all ${totalCount} records in MySQL database.`)
      streamOffset = 0
      const [wrapped] = await pool.query(
        'SELECT * FROM vehicle_events ORDER BY id ASC LIMIT ? OFFSET 0',
        [count]
      )
      rows = wrapped || []
    }
  } else {
    // Single file isolation mode
    const [countRes] = await pool.query(
      'SELECT COUNT(*) as fileCount FROM vehicle_events WHERE source_file = ? OR source_file LIKE ?',
      [targetFile, `%${targetFile}%`]
    )
    const fileTotal = countRes[0]?.fileCount || 0

    if (streamOffset >= fileTotal && fileTotal > 0) {
      streamOffset = 0
    }

    const [fetched] = await pool.query(
      'SELECT * FROM vehicle_events WHERE source_file = ? OR source_file LIKE ? ORDER BY id ASC LIMIT ? OFFSET ?',
      [targetFile, `%${targetFile}%`, count, streamOffset]
    )
    rows = fetched || []

    if (!rows.length && fileTotal > 0) {
      streamOffset = 0
      const [wrapped] = await pool.query(
        'SELECT * FROM vehicle_events WHERE source_file = ? OR source_file LIKE ? ORDER BY id ASC LIMIT ? OFFSET 0',
        [targetFile, `%${targetFile}%`, count]
      )
      rows = wrapped || []
    }
  }

  const previousOffset = streamOffset
  streamOffset = streamOffset + rows.length

  const batchTimestamp = new Date().toISOString()
  const clientRecords = rows.map((r, idx) => ({
    ...toClientRecord(r),
    _streamSeq: previousOffset + idx + 1,
    _streamBatchTime: batchTimestamp,
  }))

  return {
    count: clientRecords.length,
    batchSize: count,
    records: clientRecords,
    offset: streamOffset,
    totalPool: totalCount,
    isAllRecords: queryingAll,
  }
}

/**
 * Stores an uploaded vehicle dataset into MySQL and includes it in the active database loop
 */
async function storeUploadedVehicleRecords(fileName, rows, options = {}) {
  if (!pool) {
    throw new Error('Database connection is not available.')
  }
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No records found in the uploaded file.')
  }

  const { isAppend = false } = options
  const safeFileName = String(fileName || 'uploaded_dataset.csv').slice(0, 255)
  const CHUNK_SIZE = 250
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const values = chunk.map((r, index) => {
      const globalIdx = i + index + 1
      const id = String(r.id || r.csvRecordId || r.observationId || `${safeFileName.replace(/\.[^/.]+$/, '')}-${String(globalIdx).padStart(5, '0')}`).slice(0, 120)
      const timestamp = String(r.timestampIst || r.timestamp || r.time || new Date().toISOString().slice(0, 19).replace('T', ' ')).slice(0, 80)
      const type = canonicalVehicleType(String(r.vehicleType || r.type || 'car'))
      const plate = String(r.vehicleNumberPlate || r.numberPlate || r.plate || '').slice(0, 80)
      const conf = r.plateConfidence || r.confidence ? Math.min(Math.max(Number(r.plateConfidence || r.confidence) || 0.95, 0), 1) : 0.95
      const speed = Number.isFinite(Number(r.speed)) ? Number(r.speed) : Math.floor(Math.random() * 40) + 45
      const speedLimit = Number.isFinite(Number(r.speedLimit)) ? Number(r.speedLimit) : 60
      const isOver = r.isOverSpeed || r.overSpeed === 'Yes' || speed > speedLimit
      const overSpeed = isOver ? 'Yes' : 'No'
      const lat = Number.isFinite(Number(r.latitude)) ? Number(r.latitude) : 17.385044
      const lon = Number.isFinite(Number(r.longitude)) ? Number(r.longitude) : 78.486671
      const video = r.videoClipPath && !r.videoClipPath.startsWith('data:') ? String(r.videoClipPath).slice(0, 1000) : null
      const imgPath = r.vehicleImagePath && !r.vehicleImagePath.startsWith('data:') ? String(r.vehicleImagePath).slice(0, 1000) : null
      const plateImgPath = r.plateImagePath && !r.plateImagePath.startsWith('data:') ? String(r.plateImagePath).slice(0, 1000) : null
      const events = String(r.events || (isOver ? 'Overspeeding' : 'Standard detection')).slice(0, 255)
      return [id, timestamp, type, plate, conf, null, speed, speedLimit, overSpeed, lat, lon, video, imgPath, plateImgPath, events, safeFileName]
    })

    await pool.query(
      `INSERT INTO vehicle_events 
        (csv_record_id, timestamp_ist, vehicle_type, vehicle_number_plate, plate_confidence, vehicle_image, speed, speed_limit, over_speed, latitude, longitude, video_clip_path, vehicle_image_path, plate_image_path, events, source_file) 
       VALUES ? 
       ON DUPLICATE KEY UPDATE 
        speed = VALUES(speed), 
        speed_limit = VALUES(speed_limit), 
        over_speed = VALUES(over_speed), 
        timestamp_ist = VALUES(timestamp_ist), 
        vehicle_type = VALUES(vehicle_type), 
        vehicle_number_plate = VALUES(vehicle_number_plate),
        plate_confidence = VALUES(plate_confidence),
        events = VALUES(events),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude)`,
      [values]
    )
  }

  const totalInDb = await getTotalDatabaseRecordCount()
  console.log(`[Database] Successfully stored ${rows.length} records for uploaded file "${safeFileName}" in MySQL. Total records in database: ${totalInDb}.`)

  // Return initial batch across all database records
  const initialBatch = await fetchRandomVehicleBatch(null, ALL_RECORDS_MODE)
  return {
    success: true,
    totalStored: totalInDb,
    chunkStored: rows.length,
    fileName: ALL_RECORDS_LABEL,
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
    const liveTotal = await getTotalDatabaseRecordCount()
    const status = {
      type: 'batch',
      fileName: isAllMode(currentActiveFileName) ? ALL_RECORDS_LABEL : currentActiveFileName,
      batchCount: batch.count,
      totalPool: liveTotal,
      streamOffset: streamOffset,
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

  const liveTotal = await getTotalDatabaseRecordCount()
  console.log(`[VehicleStream] Live telemetry streaming initialized across ALL ${liveTotal} records in MySQL database (random batches 1-20 records every ${STREAM_INTERVAL / 1000}s)`)

  while (true) {
    try {
      if (!streamPaused) {
        const batch = await fetchRandomVehicleBatch()
        if (batch.records.length && io) {
          io.emit('newVehicleBatch', batch.records)
          const currentTotal = await getTotalDatabaseRecordCount()
          const status = {
            type: 'batch',
            fileName: isAllMode(currentActiveFileName) ? ALL_RECORDS_LABEL : currentActiveFileName,
            batchCount: batch.count,
            totalPool: currentTotal,
            streamOffset: streamOffset,
            timestamp: new Date().toLocaleTimeString(),
            overspeeding: batch.records.filter((r) => r.isOverSpeed).length,
            isPaused: streamPaused,
          }
          latestStreamStatus = status
          io.emit('vehicleStreamStatus', status)
          console.log(`[VehicleStream] Broadcast random batch of ${batch.count} records (Offset: ${streamOffset} / ${currentTotal} database records in MySQL)`)
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
  const targetFile = fileName !== null && fileName !== undefined ? fileName : currentActiveFileName

  if (isAllMode(targetFile)) {
    const [rows] = await pool.query(
      'SELECT * FROM vehicle_events ORDER BY id ASC LIMIT ?',
      [safeLimit]
    )
    return rows.map(toClientRecord)
  }

  const [rows] = await pool.query(
    'SELECT * FROM vehicle_events WHERE source_file = ? OR source_file LIKE ? ORDER BY id ASC LIMIT ?',
    [targetFile, `%${targetFile}%`, safeLimit]
  )
  return rows.map(toClientRecord)
}

async function getVehiclePoolStats(fileName = null) {
  if (!pool) return { totalPool: 0, totalRecords: 0 }
  const targetFile = fileName !== null && fileName !== undefined ? fileName : currentActiveFileName
  const isAll = isAllMode(targetFile)

  let totalRes, typesRes

  if (isAll) {
    ;[totalRes] = await pool.query(
      "SELECT COUNT(*) as count, AVG(speed) as avgSpeed, SUM(CASE WHEN over_speed = 'Yes' THEN 1 ELSE 0 END) as overspeedCount FROM vehicle_events"
    )
    ;[typesRes] = await pool.query(
      'SELECT vehicle_type, COUNT(*) as count FROM vehicle_events GROUP BY vehicle_type'
    )
  } else {
    ;[totalRes] = await pool.query(
      "SELECT COUNT(*) as count, AVG(speed) as avgSpeed, SUM(CASE WHEN over_speed = 'Yes' THEN 1 ELSE 0 END) as overspeedCount FROM vehicle_events WHERE source_file = ? OR source_file LIKE ?",
      [targetFile, `%${targetFile}%`]
    )
    ;[typesRes] = await pool.query(
      'SELECT vehicle_type, COUNT(*) as count FROM vehicle_events WHERE source_file = ? OR source_file LIKE ? GROUP BY vehicle_type',
      [targetFile, `%${targetFile}%`]
    )
  }

  const count = Number(totalRes[0]?.count || 0)
  const avgSpeed = Math.round(Number(totalRes[0]?.avgSpeed || 68))
  const overspeedTotal = Number(totalRes[0]?.overspeedCount || 0)

  return {
    totalPool: count,
    totalRecords: count,
    averageSpeed: avgSpeed,
    avgSpeed: avgSpeed,
    overspeedTotal: overspeedTotal,
    overspeedRate: count > 0 ? `${Math.round((overspeedTotal / count) * 100)}%` : '0%',
    vehicleTypes: (typesRes || []).reduce((acc, r) => {
      acc[r.vehicle_type] = r.count
      return acc
    }, {}),
    fileName: isAll ? ALL_RECORDS_LABEL : targetFile,
    cameras: 6,
    activeCorridor: 'NH-44 Hyderabad Express Corridor',
  }
}

function getLatestStreamStatus() {
  return latestStreamStatus
}

/**
 * Fast search across all vehicle records in MySQL by number plate, ID, type, or location.
 * Extracts license plates and record IDs from natural language queries.
 */
async function searchVehicles(searchTerm, limit = 50) {
  if (!pool || !searchTerm) return []
  const rawTerm = String(searchTerm).trim()
  if (!rawTerm) return []

  // 1. Extract Indian license plate pattern (e.g. TG 11 UV 6900, TS09AB4521, TG08KW3126, AP87LL1639)
  const plateMatch = rawTerm.match(/\b([a-zA-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[a-zA-Z]{0,3}[-\s]?[0-9]{1,4})\b/i)
  const extractedPlate = plateMatch ? plateMatch[1].replace(/[^a-zA-Z0-9]/g, '') : ''

  // 2. Extract record ID (e.g. NH44-01082, OBS-0001, ID-5)
  const idMatch = rawTerm.match(/\b(NH44[-\s]?[0-9]+|OBS[-\s]?[0-9]+|ID[-\s]?[0-9]+)\b/i)
  const extractedId = idMatch ? idMatch[1] : ''

  // 3. Fallback clean alphanumeric string
  const cleanTerm = rawTerm.replace(/[^a-zA-Z0-9]/g, '')
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200)

  // Primary search term to prioritize
  const primaryPlate = extractedPlate || cleanTerm

  try {
    const [rows] = await pool.query(
      `SELECT * FROM vehicle_events 
       WHERE REPLACE(REPLACE(vehicle_number_plate, ' ', ''), '-', '') LIKE ?
          OR vehicle_number_plate LIKE ?
          OR csv_record_id LIKE ?
          OR vehicle_type LIKE ?
          OR events LIKE ?
       ORDER BY 
         CASE 
           WHEN REPLACE(REPLACE(vehicle_number_plate, ' ', ''), '-', '') = ? THEN 0
           WHEN REPLACE(REPLACE(vehicle_number_plate, ' ', ''), '-', '') LIKE ? THEN 1
           ELSE 2
         END,
         id ASC LIMIT ?`,
      [
        `%${primaryPlate}%`,
        `%${rawTerm}%`,
        `%${extractedId || rawTerm}%`,
        `%${rawTerm}%`,
        `%${rawTerm}%`,
        primaryPlate,
        `%${primaryPlate}%`,
        safeLimit,
      ]
    )

    return (rows || []).map(toClientRecord)
  } catch (error) {
    console.error('[Database Search Error]:', error.message)
    return []
  }
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
  searchVehicles,
  toClientRecord,
}