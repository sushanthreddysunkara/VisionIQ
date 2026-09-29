import { cameras, vehicleIncidents } from '../data/vehicleTrackingData'

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function getJson(path, fallback) {
  try {
    const url = apiBaseUrl ? `${apiBaseUrl}${path}` : path
    const response = await fetch(url)
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

export async function getVehicleTracking(vehicleNumber) {
  const encodedNumber = encodeURIComponent(vehicleNumber)
  const result = await getJson(`/api/vehicles/search?q=${encodedNumber}`, null)
  if (result?.vehicles && result.vehicles.length > 0) {
    const top = result.vehicles[0]
    return {
      vehicleNumber: top.vehicleNumberPlate,
      vehicleType: top.vehicleType,
      incidentType: top.isOverSpeed ? 'Speed Violation' : (top.events || 'Detection Alert'),
      incidentTime: top.timestampIst,
      collisionCamera: top.camera,
      status: top.isOverSpeed ? 'Tracking' : 'Detected',
      speed: top.speed,
      speedLimit: top.speedLimit,
      observations: result.vehicles.map((v) => ({
        cameraId: v.camera,
        timestamp: v.timestampIst,
        latitude: Number(v.latitude) || 17.385044,
        longitude: Number(v.longitude) || 78.486671,
        location: v.location,
        detectionType: v.isOverSpeed ? 'Speed Violation' : 'Corridor Observation',
        confidence: Number(v.plateConfidence || 0.95),
        imageUrl: v.vehicleImagePath,
        speed: v.speed,
        speedLimit: v.speedLimit,
      })),
    }
  }
  return vehicleIncidents.find((vehicle) => vehicle.vehicleNumber.toLowerCase() === vehicleNumber.toLowerCase()) || null
}
