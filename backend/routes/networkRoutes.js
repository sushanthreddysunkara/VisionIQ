const express = require('express')
const { pool, isMockMode } = require('../config/database')

const router = express.Router()

router.get('/overview', async (_req, res) => {
  if (!pool || isMockMode()) {
    return res.status(503).json({ success: false, message: 'Network dataset database is unavailable.' })
  }

  try {
    const tables = [
      ['corridors', 'network_corridors'],
      ['zones', 'network_zones'],
      ['roadSegments', 'network_road_segments'],
      ['cameras', 'network_cameras'],
      ['vehicles', 'network_vehicles'],
      ['incidents', 'network_incidents'],
      ['incidentVehicles', 'network_incident_vehicles'],
      ['impactAnalysis', 'network_impact_analysis'],
      ['trafficFlow', 'network_traffic_flow'],
      ['riskProfiles', 'network_risk_profiles'],
      ['graphEdges', 'network_knowledge_graph_edges'],
    ]
    const records = await Promise.all(tables.map(async ([key, table]) => {
      const query = key === 'cameras'
        ? `SELECT c.*, COALESCE(d.detection_count, 0) AS detection_count, d.latest_detection_at
           FROM network_cameras c
           LEFT JOIN (
             SELECT camera_id, COUNT(*) AS detection_count, MAX(timestamp_ist) AS latest_detection_at
             FROM network_vehicle_detections
             GROUP BY camera_id
           ) d ON d.camera_id = c.camera_id`
        : `SELECT * FROM ${table}`
      const [rows] = await pool.query(query)
      return [key, rows]
    }))

    return res.json({ success: true, data: Object.fromEntries(records) })
  } catch (error) {
    console.error('Unable to load network overview:', error.message)
    return res.status(500).json({ success: false, message: 'Unable to load network dataset.' })
  }
})

module.exports = router