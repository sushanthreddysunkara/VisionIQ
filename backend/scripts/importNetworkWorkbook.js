const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')
const { pool, initializeDatabase, isMockMode } = require('../config/database')

const workbookPath = path.resolve(__dirname, '../..', 'VisionIQ_NH44_Corridor_16_Backend_Ready.xlsx')
const importOrder = [
  ['Corridors', 'network_corridors'],
  ['Corridor_KPIs', 'network_corridor_kpis'],
  ['Zones', 'network_zones'],
  ['Road_Segments', 'network_road_segments'],
  ['Cameras', 'network_cameras'],
  ['Vehicles', 'network_vehicles'],
  ['Incidents', 'network_incidents'],
  ['Incident_Vehicles', 'network_incident_vehicles'],
  ['Impact_Analysis', 'network_impact_analysis'],
  ['Traffic_Flow', 'network_traffic_flow'],
  ['Risk_Profiles', 'network_risk_profiles'],
  ['Knowledge_Graph', 'network_knowledge_graph_edges'],
  ['Vehicle_Detections', 'network_vehicle_detections'],
]
const BATCH_SIZE = 250

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`Invalid SQL identifier: ${identifier}`)
  return `\`${identifier}\``
}

function normalizePlate(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function getVehicleEventRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { defval: null }).map((row) => ({
    csv_record_id: row['Record ID'],
    timestamp_ist: row['Timestamp (IST)'],
    vehicle_type: row['Vehicle Type'],
    vehicle_number_plate: row['Vehicle Number Plate'],
    plate_confidence: row['Plate Confidence'],
    vehicle_image: null,
    speed: row['Speed (km/h)'],
    speed_limit: row['Speed Limit (km/h)'],
    over_speed: row['Over Speed'],
    latitude: row.Latitude,
    longitude: row.Longitude,
    video_clip_path: null,
    vehicle_image_path: row['Vehicle Image Path'],
    plate_image_path: row['Plate Image Path'] || null,
    events: row.Events,
    source_file: path.basename(workbookPath),
  }))
}

async function upsertRows(connection, tableName, rows) {
  if (!rows.length) return 0

  const columns = Object.keys(rows[0])
  const columnSql = columns.map(quoteIdentifier).join(', ')
  const updateSql = columns
    .filter((column) => column !== columns[0])
    .map((column) => `${quoteIdentifier(column)} = VALUES(${quoteIdentifier(column)})`)
    .join(', ')
  const tupleSql = `(${columns.map(() => '?').join(', ')})`

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE)
    const placeholders = batch.map(() => tupleSql).join(', ')
    const values = batch.flatMap((row) => columns.map((column) => row[column] ?? null))
    await connection.query(
      `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateSql}`,
      values,
    )
  }

  return rows.length
}

async function upsertVehicleEventRows(connection, rows) {
  let imported = 0
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE)
    const sourceFile = batch[0].source_file
    const placeholders = batch.map(() => '?').join(', ')
    const [existingRows] = await connection.query(
      `SELECT id, csv_record_id FROM vehicle_events WHERE source_file = ? AND csv_record_id IN (${placeholders})`,
      [sourceFile, ...batch.map((row) => row.csv_record_id)],
    )
    const existingIds = new Map(existingRows.map((row) => [row.csv_record_id, row.id]))
    const existingRecords = []
    const newRecords = []
    batch.forEach((row) => {
      const existingId = existingIds.get(row.csv_record_id)
      if (existingId === undefined) newRecords.push(row)
      else existingRecords.push({ id: existingId, ...row })
    })
    imported += await upsertRows(connection, 'vehicle_events', existingRecords)
    imported += await upsertRows(connection, 'vehicle_events', newRecords)
  }
  return imported
}

async function importWorkbook() {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Workbook not found: ${workbookPath}. Run "npm run prepare:network" from the repository root first.`)
  }

  const databaseStatus = await initializeDatabase()
  if (!databaseStatus.connected || isMockMode()) {
    throw new Error('MySQL is unavailable; the workbook was not imported. Start/configure MySQL, then rerun npm run import:network.')
  }

  const workbook = XLSX.readFile(workbookPath)
  const connection = await pool.getConnection()
  let totalImported = 0

  try {
    await connection.beginTransaction()
    await connection.query('DELETE FROM network_knowledge_graph_edges')
    console.log('Knowledge_Graph: replacing previous graph edges with the prepared dataset')
    const [removedDemoLinks] = await connection.query(
      "DELETE FROM network_incident_vehicles WHERE UPPER(plate_number) LIKE 'DEMO%'",
    )
    console.log(`Incident_Vehicles: removed ${removedDemoLinks.affectedRows} obsolete DEMO plate links`)

    const vehicleEventsSheet = workbook.Sheets.Vehicle_Events
    if (!vehicleEventsSheet) throw new Error('Required workbook sheet missing: Vehicle_Events')
    const vehicleEventRows = getVehicleEventRows(vehicleEventsSheet)
    totalImported += await upsertVehicleEventRows(connection, vehicleEventRows)
    console.log(`Vehicle_Events: ${vehicleEventRows.length} rows upserted`)

    const workbookVehicles = XLSX.utils.sheet_to_json(workbook.Sheets.Vehicles, { defval: null })
    if (!workbookVehicles.length) throw new Error('Required workbook sheet is empty: Vehicles')
    totalImported += await upsertRows(connection, 'network_vehicles', workbookVehicles)
    const [databaseVehicles] = await connection.query('SELECT vehicle_id, plate_number FROM network_vehicles')
    const databaseVehicleByExactPlate = new Map()
    const databaseVehicleByPlate = new Map()
    databaseVehicles.forEach((vehicle) => {
      const exactKey = String(vehicle.plate_number || '').trim().toUpperCase()
      const key = normalizePlate(vehicle.plate_number)
      if (exactKey && !databaseVehicleByExactPlate.has(exactKey)) {
        databaseVehicleByExactPlate.set(exactKey, vehicle.vehicle_id)
      }
      if (key && !databaseVehicleByPlate.has(key)) databaseVehicleByPlate.set(key, vehicle.vehicle_id)
    })
    const vehicleIdMap = new Map(workbookVehicles.map((vehicle) => {
      const exactKey = String(vehicle.plate_number || '').trim().toUpperCase()
      const databaseId = databaseVehicleByExactPlate.get(exactKey) || databaseVehicleByPlate.get(normalizePlate(vehicle.plate_number))
      if (!databaseId) throw new Error(`Vehicle plate "${vehicle.plate_number}" was not found after upsert`)
      return [vehicle.vehicle_id, databaseId]
    }))
    console.log(`Vehicles: ${workbookVehicles.length} rows upserted; linked to database IDs`)

    for (const [sheetName, tableName] of importOrder) {
      if (sheetName === 'Vehicles') continue
      if (!workbook.Sheets[sheetName]) throw new Error(`Required workbook sheet missing: ${sheetName}`)
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null })
      if (!rows.length) throw new Error(`Required workbook sheet is empty: ${sheetName}`)

      if (sheetName === 'Incident_Vehicles') {
        rows.forEach((row) => {
          row.vehicle_id = vehicleIdMap.get(row.vehicle_id) || row.vehicle_id
        })
      } else if (sheetName === 'Knowledge_Graph') {
        rows.forEach((row) => {
          if (row.source_type === 'Vehicle') row.source_id = vehicleIdMap.get(row.source_id) || row.source_id
          if (row.target_type === 'Vehicle') row.target_id = vehicleIdMap.get(row.target_id) || row.target_id
        })
      } else if (sheetName === 'Vehicle_Detections') {
        rows.forEach((row) => {
          row.vehicle_id = vehicleIdMap.get(row.vehicle_id) || row.vehicle_id
        })
      }

      totalImported += await upsertRows(connection, tableName, rows)
      console.log(`${sheetName}: ${rows.length} rows upserted`)
    }
    const [removedDemoVehicles] = await connection.query(
      "DELETE FROM network_vehicles WHERE UPPER(plate_number) LIKE 'DEMO%'",
    )
    console.log(`Vehicles: removed ${removedDemoVehicles.affectedRows} obsolete DEMO plate records`)
    const [demoCounts] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM network_vehicles WHERE UPPER(plate_number) LIKE 'DEMO%') AS vehicles,
        (SELECT COUNT(*) FROM network_vehicle_detections WHERE UPPER(plate_number) LIKE 'DEMO%') AS detections,
        (SELECT COUNT(*) FROM network_incident_vehicles WHERE UPPER(plate_number) LIKE 'DEMO%') AS incidentVehicles,
        (SELECT COUNT(*) FROM vehicle_events WHERE UPPER(vehicle_number_plate) LIKE 'DEMO%') AS vehicleEvents
    `)
    if (Object.values(demoCounts[0]).some((count) => Number(count) > 0)) {
      throw new Error(`DEMO plate records remain after import: ${JSON.stringify(demoCounts[0])}`)
    }
    await connection.commit()
    console.log(`Imported ${totalImported} rows from ${path.basename(workbookPath)}.`)
    const [vehicleEventCount] = await pool.query(
      'SELECT COUNT(*) AS row_count FROM vehicle_events WHERE source_file = ?',
      [path.basename(workbookPath)],
    )
    console.log(`vehicle_events (${path.basename(workbookPath)}): ${vehicleEventCount[0].row_count} rows`)
    for (const tableName of importOrder.map(([, table]) => table)) {
      const [rows] = await pool.query(`SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(tableName)}`)
      console.log(`${tableName}: ${rows[0].row_count} total rows in database`)
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

importWorkbook().catch((error) => {
  console.error(`Network workbook import failed: ${error.message}`)
  process.exitCode = 1
})