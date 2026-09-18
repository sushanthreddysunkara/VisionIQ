const fs = require('fs/promises')
const path = require('path')
const XLSX = require('xlsx')
const { pool } = require('../config/database')

const BATCH_INTERVAL = 5000
const FILE_INTERVAL = Number(process.env.FILE_INTERVAL || 30000)
const DATA_DIRECTORY = path.resolve(process.env.DATA_DIRECTORY || path.join(__dirname, '..', 'data'))
const processedFileVersions = new Set()
let latestStreamStatus = null

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

function normalizeRow(row, index, sourceFile) {
  const speed = numberOrNull(valueFor(row, aliases.speed))
  const speedLimit = numberOrNull(valueFor(row, aliases.speedLimit))
  const rawOverSpeed = valueFor(row, aliases.overSpeed)
  const overSpeed = rawOverSpeed || (speed !== null && speedLimit !== null && speed > speedLimit ? 'Yes' : 'No')
  const rawId = valueFor(row, aliases.id)

  return {
    csvRecordId: rawId || String(index + 1),
    timestampIst: valueFor(row, aliases.timestamp),
    vehicleType: valueFor(row, aliases.vehicleType) || 'Unknown',
    vehicleNumberPlate: valueFor(row, aliases.numberPlate),
    plateConfidence: numberOrNull(valueFor(row, aliases.plateConfidence)),
    vehicleImage: valueFor(row, aliases.vehicleImage),
    speed,
    speedLimit,
    overSpeed,
    latitude: numberOrNull(valueFor(row, aliases.latitude)),
    longitude: numberOrNull(valueFor(row, aliases.longitude)),
    videoClipPath: valueFor(row, aliases.videoClipPath),
    vehicleImagePath: valueFor(row, aliases.vehicleImagePath),
    plateImagePath: valueFor(row, aliases.plateImagePath),
    events: valueFor(row, aliases.events),
    sourceFile,
  }
}

function readSourceFile(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function chooseBatchSize(availableRows) {
  return Math.min(availableRows, Math.floor(Math.random() * 20) + 1)
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function toClientRecord(row) {
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
    plateConfidence: row.plate_confidence,
    confidence: row.plate_confidence,
    vehicleImage: row.vehicle_image,
    speed: row.speed,
    speedLimit: row.speed_limit,
    overSpeed: row.over_speed,
    isOverSpeed: String(row.over_speed).toLowerCase() === 'yes',
    latitude: row.latitude,
    longitude: row.longitude,
    videoClipPath: row.video_clip_path,
    vehicleImagePath: row.vehicle_image_path || row.vehicle_image,
    plateImagePath: row.plate_image_path,
    events: row.events,
    sourceFile: row.source_file,
  }
}

async function listDataFiles() {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true })
  const entries = await fs.readdir(DATA_DIRECTORY, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && /\.(csv|xlsx)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function emitStreamStatus(io, status) {
  latestStreamStatus = status
  io.emit('vehicleStreamStatus', status)
}

async function processFile(fileName, io) {
  const sourceFile = fileName
  const filePath = path.join(DATA_DIRECTORY, fileName)
  let rawRows

  try {
    rawRows = readSourceFile(filePath)
  } catch (error) {
    console.error(`Unable to read ${sourceFile}:`, error.message)
    return
  }

  const fileStats = await fs.stat(filePath)
  const fileVersion = `${sourceFile}:${fileStats.size}:${fileStats.mtimeMs}`
  if (processedFileVersions.has(fileVersion)) return

  const rows = rawRows.map((row, index) => normalizeRow(row, index, sourceFile))
  const [existingRows] = await pool.query(
    'SELECT csv_record_id FROM vehicle_events WHERE source_file = ?',
    [sourceFile],
  )
  const existingIds = new Set(existingRows.map((row) => String(row.csv_record_id)))
  const replayStoredRows = processedFileVersions.size === 0
  const pendingRows = rows.filter((row) => replayStoredRows || !existingIds.has(String(row.csvRecordId)))

  while (pendingRows.length) {
    const batch = pendingRows.splice(0, chooseBatchSize(pendingRows.length))
    const inserted = []

    for (const row of batch) {
      try {
        const [result] = await pool.query(
          `INSERT IGNORE INTO vehicle_events
            (csv_record_id, timestamp_ist, vehicle_type, vehicle_number_plate, plate_confidence,
             vehicle_image, speed, speed_limit, over_speed, latitude, longitude, video_clip_path,
             vehicle_image_path, plate_image_path, events, source_file)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.csvRecordId, row.timestampIst, row.vehicleType, row.vehicleNumberPlate,
            row.plateConfidence, row.vehicleImage, row.speed, row.speedLimit, row.overSpeed,
            row.latitude, row.longitude, row.videoClipPath, row.vehicleImagePath,
            row.plateImagePath, row.events, row.sourceFile,
          ],
        )

        if (result.affectedRows || (replayStoredRows && existingIds.has(String(row.csvRecordId)))) {
          existingIds.add(String(row.csvRecordId))
          inserted.push(row)
        }
      } catch (error) {
        console.error(`Skipping bad row ${row.csvRecordId} in ${sourceFile}:`, error.message)
      }
    }

    if (!inserted.length) continue

    const [savedRows] = await pool.query(
      `SELECT * FROM vehicle_events WHERE source_file = ? AND csv_record_id IN (?) ORDER BY id`,
      [sourceFile, inserted.map((row) => row.csvRecordId)],
    )
    const status = {
      type: 'batch',
      fileName: sourceFile,
      batchCount: savedRows.length,
      totalProcessed: existingIds.size,
      events: inserted.filter((row) => row.events).length,
      overspeeding: inserted.filter((row) => String(row.overSpeed).toLowerCase() === 'yes').length,
    }
    io.emit('newVehicleBatch', savedRows.map(toClientRecord))
    emitStreamStatus(io, status)
    console.log(`Streamed ${savedRows.length} records from ${sourceFile}; next update in ${BATCH_INTERVAL}ms`)
    await wait(BATCH_INTERVAL)
  }

  processedFileVersions.add(fileVersion)
  console.log(`Finished ${sourceFile}`)
  emitStreamStatus(io, { type: 'file-complete', fileName: sourceFile })
}

async function runVehicleStream(io) {
  while (true) {
    const files = await listDataFiles()
    if (!files.length) {
      console.log('No CSV/XLSX files available. Waiting for additional files...')
      await wait(FILE_INTERVAL)
      continue
    }

    for (const fileName of files) {
      await processFile(fileName, io)
      await wait(FILE_INTERVAL)
    }
  }
}

async function getStoredVehicles({ limit, afterId = 0 } = {}) {
  const query = limit
    ? 'SELECT * FROM vehicle_events WHERE id > ? ORDER BY id ASC LIMIT ?'
    : 'SELECT * FROM vehicle_events ORDER BY id ASC'
  const parameters = limit ? [afterId, limit] : []
  const [rows] = await pool.query(query, parameters)
  return rows.map(toClientRecord)
}

function getLatestStreamStatus() {
  return latestStreamStatus
}

module.exports = { DATA_DIRECTORY, getLatestStreamStatus, getStoredVehicles, runVehicleStream }