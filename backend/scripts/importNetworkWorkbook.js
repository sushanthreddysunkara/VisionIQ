const path = require('path')
const XLSX = require('xlsx')
const { pool, initializeDatabase, isMockMode } = require('../config/database')

const workbookPath = path.resolve(__dirname, '../..', 'VisionIQ_NH44_Incident_Dataset.xlsx')
const importOrder = [
  ['Corridors', 'network_corridors'],
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
]

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`Invalid SQL identifier: ${identifier}`)
  return `\`${identifier}\``
}

async function importWorkbook() {
  if (!require('fs').existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`)

  const databaseStatus = await initializeDatabase()
  if (!databaseStatus.connected || isMockMode()) {
    throw new Error('MySQL is unavailable; the workbook was not imported. Start/configure MySQL, then rerun npm run import:network.')
  }

  const workbook = XLSX.readFile(workbookPath)
  const connection = await pool.getConnection()
  let totalImported = 0

  try {
    await connection.beginTransaction()
    for (const [sheetName, tableName] of importOrder) {
      if (!workbook.Sheets[sheetName]) throw new Error(`Required workbook sheet missing: ${sheetName}`)
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null })
      if (!rows.length) continue

      const columns = Object.keys(rows[0])
      const columnSql = columns.map(quoteIdentifier).join(', ')
      const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ')
      const updateSql = columns.slice(1).map((column) => `${quoteIdentifier(column)} = VALUES(${quoteIdentifier(column)})`).join(', ')
      const values = rows.flatMap((row) => columns.map((column) => row[column] ?? null))
      await connection.query(
        `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateSql}`,
        values,
      )
      totalImported += rows.length
      console.log(`${sheetName}: ${rows.length} rows upserted`)
    }
    await connection.commit()
    console.log(`Imported ${totalImported} rows from ${path.basename(workbookPath)}.`)
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