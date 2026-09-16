import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

export const sampleTrafficData = [
  {
    observationId: 'OBS-0001',
    camera: 'CAM-HYD-001-N',
    junctionId: 'JNC-01',
    roadName: 'Madhapur Main Road',
    location: 'Madhapur Main Road',
    date: '2026-09-11',
    time: '08:12:14',
    timestamp: '08:12:14',
    timezone: 'IST',
    cameraDirection: 'North',
    type: 'Car',
    numberPlate: 'TS 09 AB 4521',
    signalState: 'Green',
    latitude: 17.4485,
    longitude: 78.3742,
    bboxX: 120,
    bboxY: 340,
    bboxWidth: 180,
    bboxHeight: 140,
    confidence: 0.96,
    distance: 18.5,
    weather: 'Clear',
    volume: 68,
    pedestrians: 32,
  },
  {
    observationId: 'OBS-0002',
    camera: 'CAM-HYD-002-E',
    junctionId: 'JNC-02',
    roadName: 'HITEC City Road',
    location: 'HITEC City Road',
    date: '2026-09-11',
    time: '08:13:02',
    timestamp: '08:13:02',
    timezone: 'IST',
    cameraDirection: 'East',
    type: 'Bike',
    numberPlate: 'TG 08 CD 8214',
    signalState: 'Green',
    latitude: 17.4431,
    longitude: 78.3812,
    bboxX: 210,
    bboxY: 410,
    bboxWidth: 75,
    bboxHeight: 90,
    confidence: 0.94,
    distance: 12.0,
    weather: 'Clear',
    volume: 44,
    pedestrians: 24,
  },
  {
    observationId: 'OBS-0003',
    camera: 'CAM-HYD-003-S',
    junctionId: 'JNC-03',
    roadName: 'Banjara Hills Road No 1',
    location: 'Banjara Hills Road No 1',
    date: '2026-09-11',
    time: '08:14:31',
    timestamp: '08:14:31',
    timezone: 'IST',
    cameraDirection: 'South',
    type: 'Auto',
    numberPlate: 'TS 10 EF 2341',
    signalState: 'Yellow',
    latitude: 17.4156,
    longitude: 78.435,
    bboxX: 160,
    bboxY: 380,
    bboxWidth: 110,
    bboxHeight: 120,
    confidence: 0.91,
    distance: 15.2,
    weather: 'Sunny',
    volume: 35,
    pedestrians: 19,
  },
  {
    observationId: 'OBS-0004',
    camera: 'CAM-HYD-004-W',
    junctionId: 'JNC-04',
    roadName: 'Jubilee Hills Checkpost',
    location: 'Jubilee Hills Checkpost',
    date: '2026-09-11',
    time: '08:15:18',
    timestamp: '08:15:18',
    timezone: 'IST',
    cameraDirection: 'West',
    type: 'Bus',
    numberPlate: 'TS 07 GH 8912',
    signalState: 'Red',
    latitude: 17.4319,
    longitude: 78.4073,
    bboxX: 90,
    bboxY: 280,
    bboxWidth: 240,
    bboxHeight: 210,
    confidence: 0.98,
    distance: 28.4,
    weather: 'Clear',
    volume: 56,
    pedestrians: 41,
  },
  {
    observationId: 'OBS-0005',
    camera: 'CAM-HYD-009-N',
    junctionId: 'JNC-08',
    roadName: 'Outer Ring Road',
    location: 'Outer Ring Road',
    date: '2026-09-11',
    time: '08:16:07',
    timestamp: '08:16:07',
    timezone: 'IST',
    cameraDirection: 'North',
    type: 'Truck',
    numberPlate: 'TS 12 EF 9011',
    signalState: 'Green',
    latitude: 17.4721,
    longitude: 78.3298,
    bboxX: 80,
    bboxY: 260,
    bboxWidth: 260,
    bboxHeight: 230,
    confidence: 0.95,
    distance: 35.0,
    weather: 'Clear',
    volume: 34,
    pedestrians: 8,
  },
  {
    observationId: 'OBS-0006',
    camera: 'CAM-HYD-010-E',
    junctionId: 'JNC-09',
    roadName: 'Rural Corridor East',
    location: 'Rural Corridor East',
    date: '2026-09-11',
    time: '08:17:15',
    timestamp: '08:17:15',
    timezone: 'IST',
    cameraDirection: 'East',
    type: 'Tractor',
    numberPlate: 'TS 15 KL 3421',
    signalState: 'Green',
    latitude: 17.489,
    longitude: 78.315,
    bboxX: 140,
    bboxY: 320,
    bboxWidth: 190,
    bboxHeight: 160,
    confidence: 0.89,
    distance: 22.1,
    weather: 'Sunny',
    volume: 18,
    pedestrians: 6,
  },
  {
    observationId: 'OBS-0007',
    camera: 'CAM-HYD-005-N',
    junctionId: 'JNC-05',
    roadName: 'Gachibowli Junction',
    location: 'Gachibowli Junction',
    date: '2026-09-11',
    time: '08:18:40',
    timestamp: '08:18:40',
    timezone: 'IST',
    cameraDirection: 'North',
    type: 'Jeep',
    numberPlate: 'TS 09 MN 5678',
    signalState: 'Green',
    latitude: 17.4401,
    longitude: 78.3489,
    bboxX: 175,
    bboxY: 350,
    bboxWidth: 170,
    bboxHeight: 145,
    confidence: 0.93,
    distance: 19.8,
    weather: 'Clear',
    volume: 42,
    pedestrians: 14,
  },
  {
    observationId: 'OBS-0008',
    camera: 'CAM-HYD-008-S',
    junctionId: 'JNC-07',
    roadName: 'Financial District Blvd',
    location: 'Financial District Blvd',
    date: '2026-09-11',
    time: '08:19:55',
    timestamp: '08:19:55',
    timezone: 'IST',
    cameraDirection: 'South',
    type: 'Van',
    numberPlate: 'TS 08 UV 9821',
    signalState: 'Yellow',
    latitude: 17.4182,
    longitude: 78.3371,
    bboxX: 150,
    bboxY: 330,
    bboxWidth: 195,
    bboxHeight: 150,
    confidence: 0.92,
    distance: 21.0,
    weather: 'Overcast',
    volume: 29,
    pedestrians: 11,
  },
  {
    observationId: 'OBS-0009',
    camera: 'CAM-HYD-002-E',
    junctionId: 'JNC-02',
    roadName: 'HITEC City Metro Crossing',
    location: 'HITEC City Metro Crossing',
    date: '2026-09-11',
    time: '08:20:12',
    timestamp: '08:20:12',
    timezone: 'IST',
    cameraDirection: 'East',
    type: 'Pedestrians',
    numberPlate: 'N/A',
    signalState: 'Red',
    latitude: 17.4435,
    longitude: 78.3818,
    bboxX: 310,
    bboxY: 460,
    bboxWidth: 45,
    bboxHeight: 110,
    confidence: 0.97,
    distance: 8.2,
    weather: 'Clear',
    volume: 12,
    pedestrians: 85,
  },
  {
    observationId: 'OBS-0010',
    camera: 'CAM-HYD-002-E',
    junctionId: 'JNC-02',
    roadName: 'HITEC City Road',
    location: 'HITEC City Road',
    date: '2026-09-11',
    time: '08:21:05',
    timestamp: '08:21:05',
    timezone: 'IST',
    cameraDirection: 'East',
    type: 'Car',
    numberPlate: 'TS 07 PQ 7712',
    signalState: 'Green',
    latitude: 17.4433,
    longitude: 78.3815,
    bboxX: 130,
    bboxY: 345,
    bboxWidth: 175,
    bboxHeight: 138,
    confidence: 0.95,
    distance: 16.4,
    weather: 'Clear',
    volume: 64,
    pedestrians: 30,
  },
  {
    observationId: 'OBS-0011',
    camera: 'CAM-HYD-005-N',
    junctionId: 'JNC-05',
    roadName: 'Gachibowli Stadium Road',
    location: 'Gachibowli Stadium Road',
    date: '2026-09-11',
    time: '08:22:01',
    timestamp: '08:22:01',
    timezone: 'IST',
    cameraDirection: 'North',
    type: 'Bike',
    numberPlate: 'TG 11 JK 4501',
    signalState: 'Green',
    latitude: 17.4408,
    longitude: 78.3495,
    bboxX: 225,
    bboxY: 420,
    bboxWidth: 70,
    bboxHeight: 88,
    confidence: 0.93,
    distance: 11.5,
    weather: 'Clear',
    volume: 48,
    pedestrians: 15,
  },
  {
    observationId: 'OBS-0012',
    camera: 'CAM-HYD-001-N',
    junctionId: 'JNC-01',
    roadName: 'Madhapur Main Road',
    location: 'Madhapur Main Road',
    date: '2026-09-11',
    time: '08:23:22',
    timestamp: '08:23:22',
    timezone: 'IST',
    cameraDirection: 'North',
    type: 'Bus',
    numberPlate: 'TS 08 XY 1290',
    signalState: 'Green',
    latitude: 17.4489,
    longitude: 78.3748,
    bboxX: 95,
    bboxY: 290,
    bboxWidth: 250,
    bboxHeight: 215,
    confidence: 0.97,
    distance: 29.1,
    weather: 'Clear',
    volume: 81,
    pedestrians: 52,
  },
  {
    observationId: 'OBS-0013',
    camera: 'CAM-HYD-011-S',
    junctionId: 'JNC-10',
    roadName: 'Agri Hub South Expressway',
    location: 'Agri Hub South Expressway',
    date: '2026-09-11',
    time: '08:24:45',
    timestamp: '08:24:45',
    timezone: 'IST',
    cameraDirection: 'South',
    type: 'Tractor',
    numberPlate: 'TS 14 TR 8832',
    signalState: 'Yellow',
    latitude: 17.4912,
    longitude: 78.3102,
    bboxX: 155,
    bboxY: 335,
    bboxWidth: 185,
    bboxHeight: 155,
    confidence: 0.88,
    distance: 24.0,
    weather: 'Sunny',
    volume: 21,
    pedestrians: 4,
  },
  {
    observationId: 'OBS-0014',
    camera: 'CAM-HYD-003-S',
    junctionId: 'JNC-03',
    roadName: 'Banjara Hills Road No 12',
    location: 'Banjara Hills Road No 12',
    date: '2026-09-11',
    time: '08:25:30',
    timestamp: '08:25:30',
    timezone: 'IST',
    cameraDirection: 'South',
    type: 'Jeep',
    numberPlate: 'TS 10 JP 9904',
    signalState: 'Red',
    latitude: 17.4162,
    longitude: 78.4358,
    bboxX: 165,
    bboxY: 360,
    bboxWidth: 180,
    bboxHeight: 150,
    confidence: 0.94,
    distance: 18.0,
    weather: 'Clear',
    volume: 38,
    pedestrians: 16,
  },
  {
    observationId: 'OBS-0015',
    camera: 'CAM-HYD-007-W',
    junctionId: 'JNC-06',
    roadName: 'Kondapur Botanical Road',
    location: 'Kondapur Botanical Road',
    date: '2026-09-11',
    time: '08:26:40',
    timestamp: '08:26:40',
    timezone: 'IST',
    cameraDirection: 'West',
    type: 'Auto',
    numberPlate: 'TS 09 AT 6623',
    signalState: 'Green',
    latitude: 17.4611,
    longitude: 78.3582,
    bboxX: 180,
    bboxY: 390,
    bboxWidth: 115,
    bboxHeight: 125,
    confidence: 0.9,
    distance: 14.6,
    weather: 'Rainy',
    volume: 39,
    pedestrians: 18,
  },
  {
    observationId: 'OBS-0016',
    camera: 'CAM-HYD-006-E',
    junctionId: 'JNC-01',
    roadName: 'Madhapur Freight Lane',
    location: 'Madhapur Freight Lane',
    date: '2026-09-11',
    time: '08:27:42',
    timestamp: '08:27:42',
    timezone: 'IST',
    cameraDirection: 'East',
    type: 'Truck',
    numberPlate: 'TS 08 TK 5410',
    signalState: 'Green',
    latitude: 17.4495,
    longitude: 78.3755,
    bboxX: 75,
    bboxY: 250,
    bboxWidth: 270,
    bboxHeight: 240,
    confidence: 0.96,
    distance: 36.2,
    weather: 'Rainy',
    volume: 22,
    pedestrians: 12,
  },
  {
    observationId: 'OBS-0017',
    camera: 'CAM-HYD-012-R',
    junctionId: 'JNC-11',
    roadName: 'HITEC Rail Corridor',
    location: 'HITEC Rail Corridor',
    date: '2026-09-11',
    time: '08:28:15',
    timestamp: '08:28:15',
    timezone: 'IST',
    cameraDirection: 'East',
    type: 'Train',
    numberPlate: 'N/A',
    signalState: 'Green',
    latitude: 17.444,
    longitude: 78.383,
    bboxX: 50,
    bboxY: 200,
    bboxWidth: 380,
    bboxHeight: 260,
    confidence: 0.99,
    distance: 48.0,
    weather: 'Clear',
    volume: 120,
    pedestrians: 54,
  },
  {
    observationId: 'OBS-0018',
    camera: 'CAM-HYD-004-W',
    junctionId: 'JNC-04',
    roadName: 'Jubilee Hills Plaza',
    location: 'Jubilee Hills Plaza',
    date: '2026-09-11',
    time: '08:28:50',
    timestamp: '08:28:50',
    timezone: 'IST',
    cameraDirection: 'West',
    type: 'Pedestrians',
    numberPlate: 'N/A',
    signalState: 'Red',
    latitude: 17.4325,
    longitude: 78.408,
    bboxX: 290,
    bboxY: 450,
    bboxWidth: 48,
    bboxHeight: 115,
    confidence: 0.95,
    distance: 9.0,
    weather: 'Clear',
    volume: 8,
    pedestrians: 62,
  },
  {
    observationId: 'OBS-0019',
    camera: 'CAM-HYD-008-S',
    junctionId: 'JNC-07',
    roadName: 'Financial District Blvd',
    location: 'Financial District Blvd',
    date: '2026-09-11',
    time: '08:29:55',
    timestamp: '08:29:55',
    timezone: 'IST',
    cameraDirection: 'South',
    type: 'Car',
    numberPlate: 'TS 09 CR 3344',
    signalState: 'Green',
    latitude: 17.4188,
    longitude: 78.3378,
    bboxX: 140,
    bboxY: 340,
    bboxWidth: 185,
    bboxHeight: 142,
    confidence: 0.96,
    distance: 17.8,
    weather: 'Overcast',
    volume: 95,
    pedestrians: 45,
  },
]

export const projectDatasets = {
  'platform-a': sampleTrafficData,
  'vision-ops': [
    {
      observationId: 'OBS-1001',
      camera: 'OPS-101',
      junctionId: 'JNC-A1',
      roadName: 'Airport Road Express',
      location: 'Airport Road Express',
      date: '2026-09-11',
      time: '09:21:10',
      timestamp: '09:21:10',
      timezone: 'IST',
      cameraDirection: 'North',
      type: 'Car',
      numberPlate: 'TS 09 XY 8821',
      signalState: 'Green',
      latitude: 17.2403,
      longitude: 78.4294,
      bboxX: 130,
      bboxY: 320,
      bboxWidth: 170,
      bboxHeight: 130,
      confidence: 0.97,
      distance: 20.1,
      weather: 'Clear',
      pedestrians: 48,
      volume: 92,
    },
    {
      observationId: 'OBS-1002',
      camera: 'OPS-102',
      junctionId: 'JNC-A2',
      roadName: 'Financial District Ring',
      location: 'Financial District Ring',
      date: '2026-09-11',
      time: '09:22:06',
      timestamp: '09:22:06',
      timezone: 'IST',
      cameraDirection: 'South',
      type: 'Bus',
      numberPlate: 'TS 07 GH 4410',
      signalState: 'Green',
      latitude: 17.4175,
      longitude: 78.3411,
      bboxX: 100,
      bboxY: 270,
      bboxWidth: 230,
      bboxHeight: 200,
      confidence: 0.96,
      distance: 26.5,
      weather: 'Clear',
      pedestrians: 36,
      volume: 74,
    },
  ],
  'mobility-lab': [
    {
      observationId: 'OBS-2001',
      camera: 'LAB-201',
      junctionId: 'JNC-L1',
      roadName: 'Test Junction Loop',
      location: 'Test Junction Loop',
      date: '2026-09-11',
      time: '10:04:11',
      timestamp: '10:04:11',
      timezone: 'IST',
      cameraDirection: 'East',
      type: 'Bike',
      numberPlate: 'TG 08 BK 3012',
      signalState: 'Green',
      latitude: 17.445,
      longitude: 78.38,
      bboxX: 200,
      bboxY: 400,
      bboxWidth: 80,
      bboxHeight: 90,
      confidence: 0.95,
      distance: 13.0,
      weather: 'Sunny',
      pedestrians: 18,
      volume: 31,
    },
  ],
}

// Aliases covering the user's exact 14-column CSV format + legacy variations
const aliases = {
  id: [
    'id',
    'observation_id',
    'observation id',
    'obs_id',
    'record_id',
  ],
  timestamp: [
    'timestamp (ist)',
    'timestamp(ist)',
    'timestamp ist',
    'timestamp',
    'time',
    'datetime',
    'date_time',
    'detection_date',
  ],
  vehicleType: [
    'vehicle type',
    'vehicle_type',
    'object_type',
    'object type',
    'type',
    'object',
    'category',
    'class',
  ],
  numberPlate: [
    'vehicle number plate',
    'vehicle_number_plate',
    'number_plate',
    'number plate',
    'license_plate',
    'license plate',
    'plate',
    'registration',
    'plate_number',
  ],
  plateConfidence: [
    'plate confidence',
    'plate_confidence',
    'detection_confidence',
    'confidence',
    'score',
    'ocr_confidence',
  ],
  vehicleImage: [
    'vehicle image',
    'vehicle_image',
    'image',
    'car_image',
    'vehicle_snapshot',
  ],
  speed: [
    'speed (km/h)',
    'speed(km/h)',
    'speed_kmh',
    'speed kmh',
    'speed (kmph)',
    'speed',
    'velocity',
  ],
  speedLimit: [
    'speed limit (km/h)',
    'speed limit(km/h)',
    'speed_limit (km/h)',
    'speed_limit_kmh',
    'speed_limit',
    'speed limit',
    'limit',
    'posted_speed',
  ],
  overSpeed: [
    'over speed',
    'over_speed',
    'overspeed',
    'speed_violation',
    'violation',
    'is_overspeed',
  ],
  latitude: [
    'latitude',
    'lat',
    'object_latitude',
    'gps_lat',
  ],
  longitude: [
    'longitude',
    'long',
    'lon',
    'lng',
    'object_longitude',
    'gps_lon',
  ],
  videoClipPath: [
    'video clip path',
    'video_clip_path',
    'vedio clip path',
    'vedio_clip_path',
    'video clip',
    'vedio clip',
    'video_path',
    'vedio_path',
    'video url',
    'video_url',
    'vedio url',
    'vedio_url',
    'videourl',
    'vediourl',
    'clip url',
    'clip_url',
    'video link',
    'videolink',
    'video_link',
    'clip_path',
    'clip',
    'videopath',
    'url',
    'video',
    'vedio',
    'media_url',
    'media url',
    'video_source',
    'source_url',
    'link',
  ],
  vehicleImagePath: [
    'vehicle image path',
    'vehicle_image_path',
    'vehicle_photo_path',
    'car_image_path',
    'image_path',
  ],
  plateImagePath: [
    'plate image path',
    'plate_image_path',
    'license_plate_image_path',
    'number_plate_image_path',
    'plate_photo_path',
  ],
  // Optional secondary / legacy fields
  camera: ['camera_id', 'camera id', 'camera', 'sensor', 'sensor_id'],
  junction: ['junction_id', 'junction id', 'junction', 'intersection'],
  location: ['road_name', 'road name', 'road', 'location', 'area', 'place'],
  date: ['date', 'detection_date'],
  time: ['time', 'timestamp'],
  timezone: ['timezone', 'tz'],
  cameraDirection: ['camera_direction', 'camera direction', 'direction', 'heading'],
  signalState: ['traffic_signal_state', 'traffic signal state', 'signal_state', 'signal', 'light'],
  bboxX: ['bbox_x', 'bbox x', 'x'],
  bboxY: ['bbox_y', 'bbox y', 'y'],
  bboxWidth: ['bbox_width', 'bbox width', 'width', 'w'],
  bboxHeight: ['bbox_height', 'bbox height', 'height', 'h'],
  distance: ['estimated_distance_m', 'estimated distance', 'distance_m', 'distance'],
  weather: ['weather', 'condition', 'weather_condition'],
  pedestrians: ['pedestrians', 'pedestrian_count', 'pedestrian count', 'people'],
  volume: ['volume', 'traffic_volume', 'traffic volume', 'count', 'vehicles'],
}

function cleanKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function valueFor(row, candidates = []) {
  if (!row || typeof row !== 'object') return ''
  const rowKeys = Object.keys(row)

  // 1. Exact case-insensitive match
  const exactKey = rowKeys.find((k) =>
    candidates.some((c) => c.trim().toLowerCase() === k.trim().toLowerCase())
  )
  if (exactKey && row[exactKey] !== undefined && row[exactKey] !== null) {
    return String(row[exactKey]).trim()
  }

  // 2. Alphanumeric match ignoring spaces, brackets, slashes
  const cleanedCandidates = candidates.map(cleanKey)
  const fuzzyKey = rowKeys.find((k) => cleanedCandidates.includes(cleanKey(k)))
  if (fuzzyKey && row[fuzzyKey] !== undefined && row[fuzzyKey] !== null) {
    return String(row[fuzzyKey]).trim()
  }

  return ''
}

function numberOrFallback(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(number) ? number : fallback
}

export function generateSurveillanceSvgDataUrl(row, index = 0) {
  const type = row.vehicleType || row.type || 'Vehicle'
  const plate = row.vehicleNumberPlate || row.numberPlate || 'N/A'
  const speed = row.speed !== undefined ? row.speed : 50
  const speedLimit = row.speedLimit !== undefined ? row.speedLimit : 60
  const isOverSpeed = row.overSpeed === 'Yes' || row.isOverSpeed || speed > speedLimit
  const timestamp = row.timestampIst || row.timestamp || '08:12:14 IST'
  const camera = row.camera || `CAM-HYD-${String((index % 8) + 1).padStart(3, '0')}-N`
  const conf = Math.round(
    (row.plateConfidence || row.confidence || 0.95) > 1
      ? row.plateConfidence || row.confidence
      : (row.plateConfidence || row.confidence || 0.95) * 100
  )

  const boxColor = isOverSpeed ? '#ef4444' : '#10b981'
  const typeColorMap = {
    Car: '#2563eb',
    Bike: '#ea580c',
    Auto: '#d97706',
    Bus: '#0d9488',
    Truck: '#7c3aed',
    Tractor: '#65a30d',
    Jeep: '#4f46e5',
    Van: '#0284c7',
    Train: '#e11d48',
    Pedestrians: '#ec4899',
  }
  const typeColor = typeColorMap[type] || '#3b82f6'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">
    <defs>
      <linearGradient id="bgGrad_${index}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <linearGradient id="vehGrad_${index}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${typeColor}" />
        <stop offset="100%" stop-color="#090d16" />
      </linearGradient>
    </defs>
    <rect width="320" height="200" fill="url(#bgGrad_${index})" />
    <line x1="50" y1="30" x2="10" y2="180" stroke="#334155" stroke-width="1.5" />
    <line x1="270" y1="30" x2="310" y2="180" stroke="#334155" stroke-width="1.5" />
    <line x1="160" y1="30" x2="160" y2="180" stroke="#eab308" stroke-dasharray="8 6" stroke-width="1.5" opacity="0.6" />
    <rect x="100" y="60" width="120" height="75" rx="8" fill="url(#vehGrad_${index})" stroke="#475569" stroke-width="1" />
    <rect x="115" y="70" width="90" height="24" rx="4" fill="#090d16" opacity="0.85" />
    <circle cx="112" cy="118" r="6" fill="#fef08a" opacity="0.9" />
    <circle cx="208" cy="118" r="6" fill="#fef08a" opacity="0.9" />
    <rect x="135" y="115" width="50" height="12" rx="2" fill="#ffffff" />
    <text x="160" y="124" font-size="7" font-family="monospace" font-weight="bold" fill="#0f172a" text-anchor="middle">${plate}</text>
    <rect x="92" y="52" width="136" height="92" fill="none" stroke="${boxColor}" stroke-width="2" stroke-dasharray="4 2" />
    <path d="M 88 64 L 88 48 L 104 48" fill="none" stroke="${boxColor}" stroke-width="2.5" />
    <path d="M 232 48 L 248 48 L 248 64" fill="none" stroke="${boxColor}" stroke-width="2.5" />
    <path d="M 88 132 L 88 148 L 104 148" fill="none" stroke="${boxColor}" stroke-width="2.5" />
    <path d="M 232 148 L 248 148 L 248 132" fill="none" stroke="${boxColor}" stroke-width="2.5" />
    <rect x="92" y="38" width="115" height="14" rx="3" fill="${boxColor}" />
    <text x="96" y="48" font-size="8" font-family="sans-serif" font-weight="bold" fill="#ffffff">${type.toUpperCase()} · ${conf}%</text>
    <rect x="0" y="0" width="320" height="22" fill="#090d16" opacity="0.95" />
    <circle cx="12" cy="11" r="4" fill="#ef4444" />
    <text x="22" y="14" font-size="8" font-family="monospace" font-weight="bold" fill="#ffffff">REC</text>
    <text x="50" y="14" font-size="8" font-family="monospace" fill="#94a3b8">${camera}</text>
    <text x="310" y="14" font-size="8" font-family="monospace" fill="#38bdf8" text-anchor="end">1080P · 60FPS</text>
    <rect x="0" y="178" width="320" height="22" fill="#090d16" opacity="0.95" />
    <text x="10" y="192" font-size="8" font-family="monospace" fill="#cbd5e1">${timestamp}</text>
    <rect x="235" y="181" width="75" height="16" rx="3" fill="${boxColor}" />
    <text x="272" y="192" font-size="8" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">${speed} / ${speedLimit} km/h</text>
  </svg>`

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export async function extractImagesFromXlsx(arrayBuffer) {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer)

    // 1. Collect all media files in the archive
    const mediaMap = {}
    const allImages = []

    for (const [filePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue
      const lower = filePath.toLowerCase()
      if (
        (lower.includes('media/') || lower.includes('pictures/') || lower.includes('drawings/')) &&
        (lower.endsWith('.png') ||
          lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.webp') ||
          lower.endsWith('.gif') ||
          lower.endsWith('.bmp') ||
          lower.endsWith('.svg'))
      ) {
        const ext = lower.split('.').pop()
        const mime =
          ext === 'png'
            ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
            ? 'image/gif'
            : ext === 'bmp'
            ? 'image/bmp'
            : ext === 'svg'
            ? 'image/svg+xml'
            : 'image/png'

        const base64 = await zipEntry.async('base64')
        const dataUrl = `data:${mime};base64,${base64}`
        const fileName = filePath.split('/').pop()

        const mediaObj = {
          path: filePath,
          fileName,
          name: fileName,
          mime,
          dataUrl,
        }

        mediaMap[filePath] = mediaObj
        mediaMap[fileName] = mediaObj
        allImages.push(mediaObj)
      }
    }

    if (allImages.length === 0) {
      return { imagesByRow: {}, allImages: [] }
    }

    // 2. Parse drawing rels to map rId -> media object
    const drawingRels = {}
    for (const [filePath, zipEntry] of Object.entries(zip.files)) {
      const lower = filePath.toLowerCase()
      if (
        lower.includes('rels') &&
        (lower.includes('drawing') || lower.includes('cellimage') || lower.includes('sheet'))
      ) {
        try {
          const xmlText = await zipEntry.async('text')
          const rels = {}
          const relMatches = xmlText.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi)
          for (const m of relMatches) {
            const id = m[1]
            const target = m[2]
            const baseName = target.split('/').pop()
            const mediaMatch =
              mediaMap[baseName] || mediaMap[target] || mediaMap['xl/media/' + baseName]
            if (mediaMatch) {
              rels[id] = mediaMatch
            }
          }
          drawingRels[filePath] = rels
          const baseRelName = filePath.split('/').pop()
          drawingRels[baseRelName] = rels
        } catch {
          // ignore xml parse error
        }
      }
    }

    // 3. Parse drawings to locate anchors
    const imagesByRow = {}
    for (const [filePath, zipEntry] of Object.entries(zip.files)) {
      const lower = filePath.toLowerCase()
      if (lower.includes('drawings/') && lower.endsWith('.xml') && !lower.includes('rels')) {
        try {
          const xmlText = await zipEntry.async('text')
          const baseName = filePath.split('/').pop()
          const rels =
            drawingRels[`xl/drawings/_rels/${baseName}.rels`] ||
            drawingRels[`${baseName}.rels`] ||
            Object.values(drawingRels)[0] ||
            {}

          const anchorRegex =
            /<(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)>/gi
          let anchorMatch
          while ((anchorMatch = anchorRegex.exec(xmlText)) !== null) {
            const content = anchorMatch[1]
            const rowMatch = content.match(/<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>/i)
            const blipMatch = content.match(/<(?:a:)?blip[^>]*r:embed="([^"]+)"/i)
            if (rowMatch && blipMatch) {
              const excelRow = parseInt(rowMatch[1], 10)
              const rId = blipMatch[1]
              const media = rels[rId]
              if (media) {
                // row 0 is header in Excel, so row 1 corresponds to data index 0
                const dataIndex = excelRow >= 1 ? excelRow - 1 : excelRow
                imagesByRow[dataIndex] = media
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return {
      imagesByRow,
      allImages,
    }
  } catch (err) {
    console.warn('Failed to extract images from XLSX archive:', err)
    return { imagesByRow: {}, allImages: [] }
  }
}

export function normalizeTrafficData(rows, extractedMedia = null) {
  if (!Array.isArray(rows)) return []

  const mediaByRow = extractedMedia?.imagesByRow || {}
  const allMediaList = extractedMedia?.allImages || []

  return rows
    .filter((row) => row && Object.values(row).some(Boolean))
    .map((row, index) => {
      // 1. ID
      const rawId = valueFor(row, aliases.id)
      const id = rawId || `ID-${String(index + 1).padStart(4, '0')}`
      const observationId = id

      // 2. Timestamp (IST)
      const rawTimestamp = valueFor(row, aliases.timestamp) || ''
      const rawDate = valueFor(row, aliases.date)
      const rawTime = valueFor(row, aliases.time)

      let date = rawDate || '2026-09-11'
      let time = rawTime || ''
      let timestamp = rawTimestamp

      if (rawTimestamp) {
        const parts = rawTimestamp.split(/[\sT]+/)
        if (parts.length >= 2) {
          date = parts[0]
          time = parts[1]
        } else if (rawTimestamp.includes(':')) {
          time = rawTimestamp
        } else if (rawTimestamp.includes('-') || rawTimestamp.includes('/')) {
          date = rawTimestamp
        }
      }
      if (!time) {
        time = `08:${String(12 + (Math.floor(index * 1.2) % 48)).padStart(2, '0')}:${String((index * 17) % 60).padStart(2, '0')}`
      }
      if (!timestamp) {
        timestamp = `${date} ${time}`
      }

      // 3. Vehicle Type
      const type = valueFor(row, aliases.vehicleType) || 'Car'
      const vehicleType = type

      // 4. Vehicle Number Plate
      const rawNumberPlate = valueFor(row, aliases.numberPlate)
      const isPed =
        type.toLowerCase().includes('pedestrian') || type.toLowerCase().includes('edisetrain')
      const isTrain = type.toLowerCase().includes('train') || type.toLowerCase().includes('rail')
      const numberPlate =
        rawNumberPlate ||
        (isPed || isTrain
          ? 'N/A'
          : `TS 09 ${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(66 + (index % 25))} ${1000 + ((index * 137) % 8999)}`)
      const vehicleNumberPlate = numberPlate

      // 5. Plate Confidence
      const rawPlateConf = valueFor(row, aliases.plateConfidence)
      let plateConfidence = rawPlateConf !== '' ? numberOrFallback(rawPlateConf, 0.95) : 0.95
      if (plateConfidence > 1 && plateConfidence <= 100) {
        plateConfidence = Number((plateConfidence / 100).toFixed(2))
      }
      const confidence = plateConfidence

      // 6. Extracted Image resolution from Excel archive
      let extractedImage = row.extractedImage || null
      let hasExtractedImage = Boolean(row.hasExtractedImage)
      let extractedImageName = row.extractedImageName || null

      if (!extractedImage && extractedMedia) {
        // Priority 1: Match by drawing anchor row
        if (mediaByRow[index]) {
          extractedImage = mediaByRow[index].dataUrl
          hasExtractedImage = true
          extractedImageName = mediaByRow[index].fileName
        }

        // Priority 2: Match by filename if row mentions image name
        if (!extractedImage && allMediaList.length > 0) {
          const rawImgVal = String(valueFor(row, aliases.vehicleImage) || '').toLowerCase()
          const rawPathVal = String(valueFor(row, aliases.vehicleImagePath) || '').toLowerCase()
          const match = allMediaList.find((img) => {
            const name = (img.fileName || '').toLowerCase()
            const baseName = name.replace(/\.[^.]+$/, '')
            return (
              (rawImgVal && (rawImgVal.includes(name) || rawImgVal.includes(baseName))) ||
              (rawPathVal && (rawPathVal.includes(name) || rawPathVal.includes(baseName)))
            )
          })
          if (match) {
            extractedImage = match.dataUrl
            hasExtractedImage = true
            extractedImageName = match.fileName
          }
        }

        // Priority 3: Single image in uploaded Excel workbook -> assign to row
        if (!extractedImage && allMediaList.length === 1) {
          extractedImage = allMediaList[0].dataUrl
          hasExtractedImage = true
          extractedImageName = allMediaList[0].fileName
        }

        // Priority 4: Sequential row matching
        if (!extractedImage && allMediaList[index]) {
          extractedImage = allMediaList[index].dataUrl
          hasExtractedImage = true
          extractedImageName = allMediaList[index].fileName
        }
      }

      const rawVehicleImage = valueFor(row, aliases.vehicleImage)
      const vehicleImage =
        rawVehicleImage ||
        extractedImageName ||
        `veh_obs_${String(index + 1).padStart(4, '0')}.jpg`

      // 7. Speed (km/h)
      const rawSpeed = valueFor(row, aliases.speed)
      const speed = rawSpeed !== '' ? numberOrFallback(rawSpeed, 45 + ((index * 7) % 45)) : 45 + ((index * 7) % 45)

      // 8. Speed Limit (km/h)
      const rawSpeedLimit = valueFor(row, aliases.speedLimit)
      const speedLimit = rawSpeedLimit !== '' ? numberOrFallback(rawSpeedLimit, 60) : 60

      // 9. Over Speed
      const rawOverSpeed = valueFor(row, aliases.overSpeed).trim().toLowerCase()
      let overSpeed = 'No'
      if (rawOverSpeed) {
        if (['yes', 'true', '1', 'y', 'violation', 'overspeed'].includes(rawOverSpeed)) {
          overSpeed = 'Yes'
        } else if (['no', 'false', '0', 'n'].includes(rawOverSpeed)) {
          overSpeed = 'No'
        } else {
          overSpeed = speed > speedLimit ? 'Yes' : 'No'
        }
      } else {
        overSpeed = speed > speedLimit ? 'Yes' : 'No'
      }
      const isOverSpeed = overSpeed === 'Yes'

      // 10. Latitude & 11. Longitude
      const rawLat = valueFor(row, aliases.latitude)
      const rawLng = valueFor(row, aliases.longitude)
      const latitude = rawLat !== '' ? numberOrFallback(rawLat, 17.4485 + ((index % 5) * 0.005)) : 17.4485 + ((index % 5) * 0.005)
      const longitude = rawLng !== '' ? numberOrFallback(rawLng, 78.3742 + ((index % 5) * 0.004)) : 78.3742 + ((index % 5) * 0.004)

      // 12. Video Clip Path / Video URL (Supports any direct URL, YouTube, Vimeo, Google Drive, or file path)
      let videoClipPath = valueFor(row, aliases.videoClipPath)
      if (!videoClipPath) {
        // Fallback 1: Any key containing 'video', 'vedio', 'clip', 'url', 'link'
        const rowKeys = Object.keys(row || {})
        const matchKey = rowKeys.find((k) => {
          const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '')
          return (
            lk.includes('video') ||
            lk.includes('vedio') ||
            lk.includes('clip') ||
            lk === 'url' ||
            lk.includes('videourl') ||
            lk.includes('link')
          )
        })
        if (matchKey && row[matchKey]) {
          videoClipPath = String(row[matchKey]).trim()
        }
      }
      if (!videoClipPath) {
        // Fallback 2: Any string value in the row that looks like an HTTP/HTTPS URL or video file
        const foundUrl = Object.values(row || {}).find((val) => {
          if (typeof val !== 'string') return false
          const s = val.trim().toLowerCase()
          return (
            s.startsWith('http://') ||
            s.startsWith('https://') ||
            s.includes('youtube.com') ||
            s.includes('youtu.be') ||
            s.includes('.mp4') ||
            s.includes('.webm')
          )
        })
        if (foundUrl) {
          videoClipPath = String(foundUrl).trim()
        }
      }
      if (!videoClipPath) {
        videoClipPath = 'https://www.youtube.com/watch?v=1EiC9bvVGnk'
      }

      // 13. Vehicle Image Path
      const vehicleImagePath =
        valueFor(row, aliases.vehicleImagePath) || `/evidence/vehicles/veh_${String(index + 1).padStart(4, '0')}.jpg`

      // 14. Plate Image Path
      const plateImagePath =
        valueFor(row, aliases.plateImagePath) || `/evidence/plates/plate_${String(index + 1).padStart(4, '0')}.jpg`

      // Derived & backward-compatible context
      const roadName =
        valueFor(row, aliases.location) ||
        `Outer Corridor Sector ${((index % 6) + 1)}`
      const junctionId = valueFor(row, aliases.junction) || `JNC-${String((index % 12) + 1).padStart(2, '0')}`
      const camera = valueFor(row, aliases.camera) || `CAM-HYD-${String((index % 8) + 1).padStart(3, '0')}-N`
      const cameraDirection =
        valueFor(row, aliases.cameraDirection) ||
        (camera.endsWith('-N') ? 'North' : camera.endsWith('-S') ? 'South' : camera.endsWith('-E') ? 'East' : 'West')
      const signalState =
        valueFor(row, aliases.signalState) ||
        (isOverSpeed ? 'Red' : index % 3 === 0 ? 'Green' : index % 3 === 1 ? 'Yellow' : 'Green')
      const weather =
        valueFor(row, aliases.weather) ||
        (index % 4 === 3 ? 'Rainy' : index % 4 === 2 ? 'Sunny' : index % 4 === 1 ? 'Overcast' : 'Clear')
      const timezone = valueFor(row, aliases.timezone) || 'IST'

      const rawVolume = valueFor(row, aliases.volume)
      const rawPeds = valueFor(row, aliases.pedestrians)
      const volume = rawVolume !== '' ? numberOrFallback(rawVolume, 1) : 1
      const pedestrians = rawPeds !== '' ? numberOrFallback(rawPeds, isPed ? 1 : 0) : (isPed ? 1 : 0)

      const vehicleImageDataUrl =
        extractedImage ||
        row.vehicleImageDataUrl ||
        generateSurveillanceSvgDataUrl(
          {
            id,
            vehicleType,
            type,
            vehicleNumberPlate,
            numberPlate,
            speed,
            speedLimit,
            overSpeed,
            isOverSpeed,
            plateConfidence,
            timestampIst: timestamp,
            camera,
          },
          index
        )

      return {
        // Exact 14 CSV parameters
        id,
        observationId,
        timestampIst: timestamp,
        timestamp,
        vehicleType,
        type,
        vehicleNumberPlate,
        numberPlate,
        plateConfidence,
        confidence,
        vehicleImage,
        speed,
        speedLimit,
        overSpeed,
        isOverSpeed,
        latitude,
        longitude,
        videoClipPath,
        vehicleImagePath,
        plateImagePath,

        // Extracted media attributes
        extractedImage,
        hasExtractedImage,
        extractedImageName,
        vehicleImageDataUrl,

        // Supporting / legacy telemetry properties
        camera,
        junctionId,
        roadName,
        location: roadName,
        date,
        time,
        timezone,
        cameraDirection,
        signalState,
        weather,
        volume,
        pedestrians,
        bboxX: numberOrFallback(valueFor(row, aliases.bboxX), 120),
        bboxY: numberOrFallback(valueFor(row, aliases.bboxY), 340),
        bboxWidth: numberOrFallback(valueFor(row, aliases.bboxWidth), 180),
        bboxHeight: numberOrFallback(valueFor(row, aliases.bboxHeight), 140),
        distance: numberOrFallback(valueFor(row, aliases.distance), 18.0),
      }
    })
}

export function parseTrafficDataFile(file) {
  const fileName = (file.name || '').toLowerCase()
  const isExcel =
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    (file.type &&
      (file.type.includes('spreadsheet') ||
        file.type.includes('excel') ||
        file.type.includes('officedocument')))

  if (isExcel) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const buffer = e.target.result
          const data = new Uint8Array(buffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          if (!sheetName) {
            reject(new Error('The Excel workbook does not contain any sheets.'))
            return
          }
          const worksheet = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

          // Extract images embedded in the Excel archive (xl/media, drawings, anchors)
          const extractedMedia = await extractImagesFromXlsx(buffer)
          const normalized = normalizeTrafficData(rows, extractedMedia)

          if (!normalized.length) {
            reject(new Error('The Excel sheet does not contain any valid data rows.'))
            return
          }

          normalized.extractedMediaCount = extractedMedia.allImages?.length || 0
          resolve(normalized)
        } catch (error) {
          reject(new Error(error.message || 'Failed to read the Excel file.'))
        }
      }
      reader.onerror = () => reject(new Error('Unable to read the selected file.'))
      reader.readAsArrayBuffer(file)
    })
  }

  // Fallback to CSV parsing with PapaParse
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        if (errors.length) {
          reject(new Error(errors[0].message || 'The CSV could not be read.'))
          return
        }
        const normalized = normalizeTrafficData(data)
        if (!normalized.length) {
          reject(new Error('The CSV does not contain any valid data rows.'))
          return
        }
        resolve(normalized)
      },
      error: (error) => reject(error),
    })
  })
}

export const parseTrafficCsv = parseTrafficDataFile
export const parseTrafficFile = parseTrafficDataFile

export function summarizeData(rows) {
  const total = rows.reduce((sum, row) => sum + (row.volume || 1), 0)
  const pedestrians = rows.reduce((sum, row) => sum + (row.pedestrians || 0), 0)
  const uniqueLocations = new Set(rows.map((row) => row.location || row.roadName).filter(Boolean)).size
  const uniqueCameras = new Set(rows.map((row) => row.camera).filter(Boolean)).size
  return { total, pedestrians, uniqueLocations, uniqueCameras }
}

export function groupBy(rows, key) {
  return Object.entries(
    rows.reduce((groups, row) => {
      const value = row[key] || 'Unknown'
      groups[value] = (groups[value] || 0) + (key === 'location' || key === 'roadName' ? row.volume || 1 : 1)
      return groups
    }, {})
  ).map(([name, value]) => ({ name, value }))
}