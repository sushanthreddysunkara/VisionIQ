import { cameras, vehicleIncidents } from '../data/vehicleTrackingData'

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

export async function getVehicleTracking(vehicleNumber) {
  const encodedNumber = encodeURIComponent(vehicleNumber)
  const result = await getJson(`/api/vehicles/${encodedNumber}`, null)
  return result?.vehicle || vehicleIncidents.find((vehicle) => vehicle.vehicleNumber.toLowerCase() === vehicleNumber.toLowerCase()) || null
}
