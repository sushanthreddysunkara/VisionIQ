import { cameras, vehicleIncidents, NH44_HIGHWAY_WAYPOINTS } from '../data/vehicleTrackingData'

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function getJson(path, fallback) {
  if (!apiBaseUrl) return fallback
  try {
    const response = await fetch(`${apiBaseUrl}${path}`)
    if (!response.ok) return fallback
    return await response.json()
  } catch {
    return fallback
  }
}

export async function getVehicleIncidents() {
  const result = await getJson('/api/vehicles/incidents', null)
  return result?.incidents || vehicleIncidents
}

export async function getCameras() {
  const result = await getJson('/api/cameras', null)
  return result?.cameras || cameras
}

function cleanPlate(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

/**
 * Build tracking structure if plate is searched from the 7,044 live records in MySQL
 */
function buildTrackedVehicleFromRecords(vehicleNumber, records = []) {
  if (!records.length) return null
  const sorted = [...records].sort((a, b) => (a.timestampIst || a.timestamp || '').localeCompare(b.timestampIst || b.timestamp || ''))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const hasCollision = sorted.some((r) => r.isOverSpeed || String(r.overSpeed).toLowerCase() === 'yes' || /collision|accident|reckless/i.test(r.events || ''))
  const collisionRecord = sorted.find((r) => r.isOverSpeed || String(r.overSpeed).toLowerCase() === 'yes' || /collision|accident/i.test(r.events || '')) || first

  // Map each record to nearest NH-44 camera or cycle through them
  const observations = sorted.map((r, idx) => {
    const targetCamera = cameras.find((c) => c.id === r.camera || c.name === r.camera) || cameras[idx % cameras.length]
    const isRecordCollision = r.id === collisionRecord.id && hasCollision
    return {
      cameraId: targetCamera.id,
      timestamp: r.timestampIst || r.timestamp || new Date().toISOString(),
      latitude: Number(r.latitude) || targetCamera.latitude,
      longitude: Number(r.longitude) || targetCamera.longitude,
      location: targetCamera.location,
      detectionType: isRecordCollision ? (r.isOverSpeed ? 'Overspeeding' : 'Collision') : 'Vehicle Detected',
      speed: Number(r.speed) || 68,
      speedLimit: Number(r.speedLimit) || targetCamera.speedLimit || 80,
      confidence: Number(r.plateConfidence) || 0.96,
      notes: r.events || (isRecordCollision ? 'Flagged on NH-44 surveillance radar' : 'Normal highway passage'),
    }
  })

  return {
    vehicleNumber: first.vehicleNumberPlate || vehicleNumber,
    vehicleType: first.vehicleType || 'Car',
    incidentType: hasCollision ? (collisionRecord.isOverSpeed ? 'Overspeeding' : 'Collision') : 'Vehicle Detected',
    incidentTime: collisionRecord.timestampIst || collisionRecord.timestamp || new Date().toISOString(),
    collisionCamera: observations.find((o) => /collision|overspeeding/i.test(o.detectionType))?.cameraId || observations[0].cameraId,
    status: 'Tracking',
    speed: Number(last.speed) || 72,
    speedLimit: Number(last.speedLimit) || 80,
    summary: `Vehicle ${first.vehicleNumberPlate || vehicleNumber} (${first.vehicleType}) tracked across ${observations.length} observations on NH-44 corridor.`,
    observations,
  }
}

export async function getVehicleTracking(vehicleNumber) {
  if (!vehicleNumber) return null
  const normTarget = cleanPlate(vehicleNumber)

  // 1. Direct match in forensic vehicle incidents
  const match = vehicleIncidents.find((vehicle) => cleanPlate(vehicle.vehicleNumber) === normTarget)
  if (match) return match

  // 2. Query backend search endpoint for database records
  if (apiBaseUrl) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/vehicles/search?q=${encodeURIComponent(vehicleNumber)}&limit=15`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.vehicles) && data.vehicles.length) {
          return buildTrackedVehicleFromRecords(vehicleNumber, data.vehicles)
        }
      }
    } catch {
      // ignore network errors and fallback
    }
  }

  // 3. Substring match fallback
  return vehicleIncidents.find((vehicle) => cleanPlate(vehicle.vehicleNumber).includes(normTarget) || normTarget.includes(cleanPlate(vehicle.vehicleNumber))) || null
}
