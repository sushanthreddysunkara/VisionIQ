export const cameras = [
  { id: 'CAM-001', name: 'Main Road Junction', latitude: 17.385044, longitude: 78.486671, status: 'Active' },
  { id: 'CAM-002', name: 'MG Road', latitude: 17.390000, longitude: 78.480000, status: 'Active' },
  { id: 'CAM-003', name: 'Tank Bund Approach', latitude: 17.399000, longitude: 78.473000, status: 'Active' },
  { id: 'CAM-004', name: 'Banjara Checkpoint', latitude: 17.415000, longitude: 78.448000, status: 'Maintenance' },
  { id: 'CAM-005', name: 'Airport Road', latitude: 17.395000, longitude: 78.475000, status: 'Active' },
  { id: 'CAM-006', name: 'Hitech City Gate', latitude: 17.443500, longitude: 78.377200, status: 'Active' },
  { id: 'CAM-008', name: 'Highway Junction', latitude: 17.420000, longitude: 78.410000, status: 'Active' },
  { id: 'CAM-009', name: 'Ring Road Exit', latitude: 17.435000, longitude: 78.395000, status: 'Active' },
  { id: 'CAM-012', name: 'Outer Corridor North', latitude: 17.465000, longitude: 78.385000, status: 'Active' },
]

export const vehicleIncidents = [
  {
    vehicleNumber: 'MP44AB1234', vehicleType: 'Car', incidentType: 'Collision', incidentTime: '2026-09-18T10:32:15', collisionCamera: 'CAM-001', status: 'Tracking',
    observations: [
      { cameraId: 'CAM-001', timestamp: '2026-09-18T10:32:15', latitude: 17.385044, longitude: 78.486671, location: 'Main Road Junction', detectionType: 'Collision', confidence: 0.98, imageUrl: '' },
      { cameraId: 'CAM-002', timestamp: '2026-09-18T10:35:21', latitude: 17.390000, longitude: 78.480000, location: 'MG Road', detectionType: 'Vehicle Detected', confidence: 0.96 },
      { cameraId: 'CAM-005', timestamp: '2026-09-18T10:39:47', latitude: 17.395000, longitude: 78.475000, location: 'Airport Road', detectionType: 'Vehicle Detected', confidence: 0.94 },
      { cameraId: 'CAM-008', timestamp: '2026-09-18T10:44:12', latitude: 17.420000, longitude: 78.410000, location: 'Highway Junction', detectionType: 'Vehicle Detected', confidence: 0.93 },
      { cameraId: 'CAM-012', timestamp: '2026-09-18T10:51:36', latitude: 17.465000, longitude: 78.385000, location: 'Outer Corridor North', detectionType: 'Vehicle Detected', confidence: 0.91 },
    ],
  },
  {
    vehicleNumber: 'TS09XY4567', vehicleType: 'Bike', incidentType: 'Collision', incidentTime: '2026-09-18T11:15:00', collisionCamera: 'CAM-004', status: 'Escaped',
    observations: [
      { cameraId: 'CAM-004', timestamp: '2026-09-18T11:15:00', latitude: 17.415000, longitude: 78.448000, location: 'Banjara Checkpoint', detectionType: 'Collision', confidence: 0.95 },
      { cameraId: 'CAM-006', timestamp: '2026-09-18T11:21:44', latitude: 17.443500, longitude: 78.377200, location: 'Hitech City Gate', detectionType: 'Vehicle Detected', confidence: 0.89 },
      { cameraId: 'CAM-009', timestamp: '2026-09-18T11:28:10', latitude: 17.435000, longitude: 78.395000, location: 'Ring Road Exit', detectionType: 'Vehicle Detected', confidence: 0.87 },
    ],
  },
  {
    vehicleNumber: 'AP28CD7890', vehicleType: 'Auto', incidentType: 'Accident', incidentTime: '2026-09-18T12:42:09', collisionCamera: 'CAM-002', status: 'Detected',
    observations: [
      { cameraId: 'CAM-002', timestamp: '2026-09-18T12:42:09', latitude: 17.390000, longitude: 78.480000, location: 'MG Road', detectionType: 'Accident', confidence: 0.92 },
      { cameraId: 'CAM-003', timestamp: '2026-09-18T12:47:31', latitude: 17.399000, longitude: 78.473000, location: 'Tank Bund Approach', detectionType: 'Vehicle Detected', confidence: 0.90 },
    ],
  },
]
