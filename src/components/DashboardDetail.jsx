import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Camera,
  Car,
  CheckCircle2,
  Database,
  FileText,
  Gauge,
  MapPin,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatTimestampIst, groupBy, sampleTrafficData, summarizeData } from '../data/dashboardData'
import { getVehicleMeta } from '../data/vehicleTypes'
import { cameraFeeds, getCameraFeed } from '../data/cameraFeeds'
import VehicleBadge from './VehicleBadge'
import VehicleImageThumbnail from './VehicleImageThumbnail'
import MediaPreviewModal from './MediaPreviewModal'
import CameraFeedModal from './CameraFeedModal'
import CameraFeedPanel from './CameraFeedPanel'
import { getCameras } from '../services/vehicleService'
import { getNetworkOverview } from '../services/networkApi'

function getRecordTimestampScore(row) {
  const raw = String(row.timestampIst || row.timestamp || row.time || row.date || '')
  const parsed = Date.parse(raw)
  if (!isNaN(parsed)) return parsed
  const timeMatch = raw.match(/(\d{1,2}):(\d{2}):(\d{2})/)
  if (timeMatch) {
    return Number(timeMatch[1]) * 3600 + Number(timeMatch[2]) * 60 + Number(timeMatch[3])
  }
  const idNum = Number(String(row.id || row.csvRecordId || '').replace(/\D/g, ''))
  return idNum || 0
}

function toTrafficIncident(incident, networkData) {
  const zone = networkData.zones?.find((item) => item.zone_id === incident.zone_id)
  const segment = networkData.roadSegments?.find((item) => item.road_segment_id === incident.road_segment_id)
  const impact = networkData.impactAnalysis?.find((item) => item.incident_id === incident.incident_id) || {}
  const risk = networkData.riskProfiles?.find((item) => item.incident_id === incident.incident_id) || {}
  const linkedVehicles = networkData.incidentVehicles?.filter((item) => item.incident_id === incident.incident_id) || []
  const zoneIndex = networkData.zones?.findIndex((item) => item.zone_id === incident.zone_id) ?? -1
  const flowRows = (networkData.trafficFlow || [])
    .filter((item) => item.road_segment_id === incident.road_segment_id)
    .sort((left, right) => new Date(left.observed_at_ist) - new Date(right.observed_at_ist))

  return {
    id: incident.incident_id,
    title: incident.incident_type,
    severity: String(incident.severity || 'Low').toUpperCase(),
    queueKm: Number(impact.max_queue_km || 0),
    occurrenceRate: networkData.incidents.filter((item) => item.road_segment_id === incident.road_segment_id).length,
    probability: Number(risk.risk_score_0_100 || 0),
    description: incident.description || incident.incident_type,
    location: zone?.zone_name || 'NH-44 Corridor',
    zoneId: incident.zone_id,
    roadSegmentId: incident.road_segment_id,
    affectedCameras: [incident.camera_id],
    affectedSegments: [incident.road_segment_id],
    upstream: networkData.zones?.[Math.max(zoneIndex - 1, 0)]?.zone_name || 'Upstream zone unavailable',
    currentZone: zone?.zone_name || 'NH-44 Corridor',
    downstream: networkData.zones?.[Math.min(zoneIndex + 1, (networkData.zones?.length || 1) - 1)]?.zone_name || 'Downstream zone unavailable',
    categories: [incident.incident_type, `${linkedVehicles.length} linked vehicle${linkedVehicles.length === 1 ? '' : 's'}`, `Risk ${risk.risk_category || 'Unknown'}`],
    involvedVehicles: linkedVehicles.map((vehicle) => vehicle.plate_number),
    queueTrend: flowRows.map((flow) => ({
      time: new Date(flow.observed_at_ist).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
      speed: Number(flow.average_speed_kmh || 0),
      queue: Number(impact.max_queue_km || 0),
      flow: Number(flow.vehicles_per_5_min || 0),
    })),
    impactBreakdown: [
      { name: 'Flow reduction (%)', value: Number(impact.traffic_flow_reduction_pct || 0) },
      { name: 'Estimated delay (min)', value: Number(impact.estimated_delay_min || 0) },
      { name: 'Affected lanes', value: Number(impact.affected_lanes || incident.lanes_blocked || 0) },
    ],
    zoneImpact: [{
      zone: String(zone?.km_marker ?? ''),
      name: zone?.zone_name || 'NH-44 Corridor',
      status: incident.status,
      value: Number(risk.risk_score_0_100 || 0),
    }],
    riskProfile: risk,
    impactAnalysis: impact,
    segmentName: segment?.segment_name || incident.road_segment_id,
  }
}

const configs = {
  vehicles: {
    number: '01',
    title: 'Vehicle Analytics',
    eyebrow: 'VEHICLE INTELLIGENCE',
    description: 'Vehicle types, HSRP plates, speeds, and classification mix along the NH-44 corridor.',
    icon: Car,
    chartTitle: 'Vehicles by Classification',
    chartKey: 'type',
    color: '#3b82f6',
  },
  traffic: {
    number: '02',
    title: 'Traffic Flow & Corridor Speed',
    eyebrow: 'FLOW INTELLIGENCE',
    description: 'Highway volume density, high-speed violation heatmaps, and corridor pressure.',
    icon: BarChart3,
    chartTitle: 'Traffic by Highway Checkpoint',
    chartKey: 'location',
    color: '#f59e0b',
  },
  cameras: {
    number: '03',
    title: 'Camera & Checkpoint Monitoring',
    eyebrow: 'COVERAGE INTELLIGENCE',
    description: 'Surveillance camera coverage, optical checkpoint health, and detection telemetry.',
    icon: Camera,
    chartTitle: 'Records by Optical Camera',
    chartKey: 'camera',
    color: '#10b981',
  },
}

export default function DashboardDetail({
  addedCameras = [],
  onAddCamera,
  onRemoveCamera,
  removedCameras = [],
  rows = [],
  fileName,
  onImport,
  importError,
  projectName,
  latestBatchInfo,
  streamPaused = false,
  onFetchRandomBatch,
  onToggleStreamPause,
  dbStats,
}) {
  const [previewModalRow, setPreviewModalRow] = useState(null)
  const [initialModalTab, setInitialModalTab] = useState('vehicle')
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false)
  const [cameraRemoveDialogOpen, setCameraRemoveDialogOpen] = useState(false)
  const [cameraFeedOpen, setCameraFeedOpen] = useState(false)
  const [selectedCameraFeed, setSelectedCameraFeed] = useState(null)
  const [inlineCameraFeed, setInlineCameraFeed] = useState(() => cameraFeeds[0] || null)
  const [networkCameras, setNetworkCameras] = useState([])
  const [networkOverview, setNetworkOverview] = useState(null)
  const [isFetchingBatch, setIsFetchingBatch] = useState(false)
  const [cameraForm, setCameraForm] = useState({ name: '', location: '', streamUrl: '' })
  const [trafficTab, setTrafficTab] = useState('overview')

  const { kind, incidentId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const config = configs[kind] || configs.vehicles
  const Icon = config.icon

  useEffect(() => {
    let isCurrent = true
    Promise.all([getCameras(), getNetworkOverview()]).then(([cameras, overview]) => {
      if (!isCurrent) return
      if (Array.isArray(cameras)) setNetworkCameras(cameras)
      setNetworkOverview(overview)
    })
    return () => { isCurrent = false }
  }, [])

  const incidentDetails = useMemo(() => ({
    'acc-401': {
      id: 'ACC-401',
      title: 'NH-44 / Kurnool Incident',
      severity: 'HIGH',
      queueKm: 3.2,
      description: 'Severe congestion triggered by a major accident impact along the Kurnool corridor with a queue extending into the upstream zone.',
      location: 'NH-44 / Kurnool',
      affectedCameras: ['CAM-401', 'CAM-402', 'CAM-403', 'CAM-404'],
      affectedSegments: ['RS-401', 'RS-402'],
      upstream: 'ZONE 03 — Kothakota',
      currentZone: 'ZONE 04 — Kurnool',
      downstream: 'ZONE 05 — Dhone',
      categories: ['CONGESTION', 'ACCIDENT', 'ROAD WORK', 'LANE CLOSURE', 'BLACK SPOT'],
      queueTrend: [
        { time: '00:00', speed: 88, queue: 0.6, flow: 1180 },
        { time: '02:00', speed: 76, queue: 1.1, flow: 1260 },
        { time: '04:00', speed: 62, queue: 2.0, flow: 1340 },
        { time: '06:00', speed: 44, queue: 3.2, flow: 1385 },
        { time: '08:00', speed: 39, queue: 3.9, flow: 1420 },
        { time: '10:00', speed: 48, queue: 3.2, flow: 1380 },
      ],
      impactBreakdown: [
        { name: 'Congestion', value: 42 },
        { name: 'Accident', value: 28 },
        { name: 'Road work', value: 16 },
        { name: 'Lane closure', value: 10 },
        { name: 'Black spot', value: 4 },
      ],
      zoneImpact: [
        { zone: '03', name: 'Kothakota', status: 'Potential congestion', value: 64 },
        { zone: '04', name: 'Kurnool', status: 'Severe congestion', value: 92 },
        { zone: '05', name: 'Dhone', status: 'Traffic inflow reduced', value: 51 },
      ],
    },
  }), [])

  const staticActiveIncident = kind === 'traffic' && incidentId ? incidentDetails[incidentId.toLowerCase()] : null

  const trafficIncidentCatalog = useMemo(() => ({
    'acc-401': {
      id: 'ACC-401',
      title: 'NH-44 / Kurnool Incident',
      severity: 'HIGH',
      queueKm: 3.2,
      occurrenceRate: 26,
      probability: 87,
      description: 'Severe congestion triggered by a major accident impact along the Kurnool corridor with a queue extending into the upstream zone.',
      location: 'NH-44 / Kurnool',
      affectedCameras: ['CAM-401', 'CAM-402', 'CAM-403', 'CAM-404'],
      affectedSegments: ['RS-401', 'RS-402'],
      upstream: 'ZONE 03 — Kothakota',
      currentZone: 'ZONE 04 — Kurnool',
      downstream: 'ZONE 05 — Dhone',
      categories: ['CONGESTION', 'ACCIDENT', 'ROAD WORK', 'LANE CLOSURE', 'BLACK SPOT'],
      queueTrend: [
        { time: '00:00', speed: 88, queue: 0.6, flow: 1180 },
        { time: '02:00', speed: 76, queue: 1.1, flow: 1260 },
        { time: '04:00', speed: 62, queue: 2.0, flow: 1340 },
        { time: '06:00', speed: 44, queue: 3.2, flow: 1385 },
        { time: '08:00', speed: 39, queue: 3.9, flow: 1420 },
        { time: '10:00', speed: 48, queue: 3.2, flow: 1380 },
      ],
      impactBreakdown: [
        { name: 'Congestion', value: 42 },
        { name: 'Accident', value: 28 },
        { name: 'Road work', value: 16 },
        { name: 'Lane closure', value: 10 },
        { name: 'Black spot', value: 4 },
      ],
      zoneImpact: [
        { zone: '03', name: 'Kothakota', status: 'Potential congestion', value: 64 },
        { zone: '04', name: 'Kurnool', status: 'Severe congestion', value: 92 },
        { zone: '05', name: 'Dhone', status: 'Traffic inflow reduced', value: 51 },
      ],
    },
    'acc-402': {
      id: 'ACC-402',
      title: 'Jadcherla Black Spot',
      severity: 'MEDIUM',
      queueKm: 1.4,
      occurrenceRate: 12,
      probability: 61,
      description: 'Recurring speed instability and vehicle weaving around the Farukhnagar–Jadcherla black-spot corridor increase collision risk.',
      location: 'Jadcherla / NH-44',
      affectedCameras: ['CAM-201', 'CAM-202', 'CAM-203'],
      affectedSegments: ['RS-201', 'RS-202'],
      upstream: 'ZONE 02 — Farukhnagar',
      currentZone: 'ZONE 02 — Jadcherla',
      downstream: 'ZONE 03 — Kothakota',
      categories: ['BLACK SPOT', 'CONGESTION', 'WEATHER', 'ROAD CONDITION'],
      queueTrend: [
        { time: '00:00', speed: 82, queue: 0.4, flow: 980 },
        { time: '02:00', speed: 74, queue: 0.8, flow: 1040 },
        { time: '04:00', speed: 61, queue: 1.1, flow: 1105 },
        { time: '06:00', speed: 53, queue: 1.4, flow: 1170 },
        { time: '08:00', speed: 58, queue: 1.2, flow: 1160 },
        { time: '10:00', speed: 64, queue: 1.0, flow: 1080 },
      ],
      impactBreakdown: [
        { name: 'Black spot', value: 37 },
        { name: 'Road condition', value: 24 },
        { name: 'Weather', value: 18 },
        { name: 'Congestion', value: 14 },
        { name: 'Lane issue', value: 7 },
      ],
      zoneImpact: [
        { zone: '02', name: 'Farukhnagar', status: 'Rising queue', value: 58 },
        { zone: '02', name: 'Jadcherla', status: 'Black spot risk', value: 72 },
        { zone: '03', name: 'Kothakota', status: 'Approach slowdown', value: 48 },
      ],
    },
    'acc-403': {
      id: 'ACC-403',
      title: 'Dhone Junction Merge',
      severity: 'MEDIUM',
      queueKm: 1.8,
      occurrenceRate: 17,
      probability: 68,
      description: 'Dense lane merging around the Dhone junction is increasing heavy-vehicle interaction and lower-speed queueing.',
      location: 'Dhone / NH-44 Junction',
      affectedCameras: ['CAM-301', 'CAM-302', 'CAM-303'],
      affectedSegments: ['RS-301', 'RS-302'],
      upstream: 'ZONE 04 — Kurnool',
      currentZone: 'ZONE 05 — Dhone',
      downstream: 'ZONE 06 — Gooty',
      categories: ['JUNCTION', 'HEAVY VEHICLE', 'URBAN MERGE', 'CONGESTION'],
      queueTrend: [
        { time: '00:00', speed: 84, queue: 0.3, flow: 1080 },
        { time: '02:00', speed: 70, queue: 0.9, flow: 1145 },
        { time: '04:00', speed: 57, queue: 1.5, flow: 1230 },
        { time: '06:00', speed: 46, queue: 1.8, flow: 1285 },
        { time: '08:00', speed: 51, queue: 1.6, flow: 1210 },
        { time: '10:00', speed: 63, queue: 1.1, flow: 1120 },
      ],
      impactBreakdown: [
        { name: 'Heavy vehicle', value: 35 },
        { name: 'Urban merge', value: 25 },
        { name: 'Junction', value: 22 },
        { name: 'Congestion', value: 13 },
        { name: 'Road work', value: 5 },
      ],
      zoneImpact: [
        { zone: '04', name: 'Kurnool', status: 'Reduced flow', value: 56 },
        { zone: '05', name: 'Dhone', status: 'Merge pressure', value: 81 },
        { zone: '06', name: 'Gooty', status: 'Adaptive flow', value: 43 },
      ],
    },
    'acc-404': {
      id: 'ACC-404',
      title: 'Penukonda Toll Node Delay',
      severity: 'LOW',
      queueKm: 0.9,
      occurrenceRate: 9,
      probability: 45,
      description: 'Toll plaza approach queues build as stop-and-go traffic begins to merge with highway flow near Penukonda.',
      location: 'Penukonda / Toll Plaza',
      affectedCameras: ['CAM-401', 'CAM-402'],
      affectedSegments: ['RS-401', 'RS-402'],
      upstream: 'ZONE 07 — Gooty',
      currentZone: 'ZONE 08 — Penukonda',
      downstream: 'ZONE 09 — Bagepalli',
      categories: ['TOLL PLAZA', 'LANE CLOSURE', 'CONGESTION', 'ROAD WORK'],
      queueTrend: [
        { time: '00:00', speed: 86, queue: 0.2, flow: 870 },
        { time: '02:00', speed: 76, queue: 0.4, flow: 950 },
        { time: '04:00', speed: 68, queue: 0.7, flow: 1035 },
        { time: '06:00', speed: 58, queue: 0.9, flow: 1100 },
        { time: '08:00', speed: 63, queue: 0.8, flow: 1040 },
        { time: '10:00', speed: 71, queue: 0.4, flow: 940 },
      ],
      impactBreakdown: [
        { name: 'Toll plaza', value: 38 },
        { name: 'Congestion', value: 28 },
        { name: 'Road work', value: 17 },
        { name: 'Lane closure', value: 12 },
        { name: 'Merge', value: 5 },
      ],
      zoneImpact: [
        { zone: '07', name: 'Gooty', status: 'Mild build-up', value: 41 },
        { zone: '08', name: 'Penukonda', status: 'Toll delay', value: 63 },
        { zone: '09', name: 'Bagepalli', status: 'Stable inflow', value: 35 },
      ],
    },
  }), [])

  const databaseIncidentCards = useMemo(() => (networkOverview?.incidents || []).map((incident) => toTrafficIncident(incident, networkOverview)), [networkOverview])
  const incidentCardList = databaseIncidentCards.length ? databaseIncidentCards : Object.values(trafficIncidentCatalog)
  const activeIncident = kind === 'traffic' && incidentId
    ? databaseIncidentCards.find((incident) => incident.id.toLowerCase() === incidentId.toLowerCase()) || staticActiveIncident
    : null

  const latestNetworkFlows = useMemo(() => {
    const latestBySegment = new Map()
    for (const observation of networkOverview?.trafficFlow || []) {
      const current = latestBySegment.get(observation.road_segment_id)
      if (!current || new Date(observation.observed_at_ist) > new Date(current.observed_at_ist)) {
        latestBySegment.set(observation.road_segment_id, observation)
      }
    }
    return [...latestBySegment.values()]
  }, [networkOverview])

  const fallbackCorridorZoneData = [
    { id: '01', name: 'Hyderabad / Bahadurpura–Petlaburj', type: 'Urban', status: 'High', note: 'Heavy city inflow and merge pressure', speed: 41, queue: 2.8 },
    { id: '02', name: 'Farukhnagar–Jadcherla', type: 'Black Spot', status: 'Watch', note: 'Repeated incident and speed disruption', speed: 48, queue: 2.1 },
    { id: '03', name: 'Kothakota', type: 'Upstream', status: 'Watch', note: 'Traffic queue begins to form upstream', speed: 54, queue: 1.6 },
    { id: '04', name: 'Kurnool', type: 'Critical', status: 'Critical', note: 'Primary flow collapse and severe queueing', speed: 22, queue: 3.9 },
    { id: '05', name: 'Dhone', type: 'Downstream', status: 'Watch', note: 'Reduced inflow and redistributed traffic', speed: 49, queue: 1.9 },
    { id: '06', name: 'Dhone–Gooty', type: 'Junction', status: 'Normal', note: 'Merging heavy-vehicle movement', speed: 63, queue: 0.9 },
    { id: '07', name: 'Gooty–Anantapur', type: 'Highway', status: 'Normal', note: 'Stable corridor throughput', speed: 70, queue: 0.8 },
    { id: '08', name: 'Penukonda', type: 'Toll', status: 'Watch', note: 'Toll approach with queue variation', speed: 58, queue: 1.1 },
    { id: '09', name: 'Bagepalli', type: 'Border', status: 'Normal', note: 'Cross-border movement remains moderate', speed: 68, queue: 0.7 },
    { id: '10', name: 'Chikkaballapur', type: 'Urban', status: 'Normal', note: 'Approach is recovering smoothly', speed: 66, queue: 0.7 },
    { id: '11', name: 'Devanahalli–Bengaluru', type: 'Urban', status: 'High', note: 'Airport traffic and final approach pressure', speed: 44, queue: 2.5 },
  ]

  const corridorZoneData = networkOverview?.zones?.length
    ? networkOverview.zones.map((zone, index) => {
      const segment = networkOverview.roadSegments?.find((item) => item.zone_id === zone.zone_id)
      const flow = latestNetworkFlows.find((item) => item.road_segment_id === segment?.road_segment_id)
      const incident = databaseIncidentCards.find((item) => item.zoneId === zone.zone_id)
      const flowState = String(flow?.flow_state || '').toLowerCase()
      const status = incident?.severity === 'CRITICAL' || flowState.includes('incident')
        ? 'Critical'
        : incident?.severity === 'HIGH' || flowState.includes('congested')
          ? 'High'
          : flowState.includes('slow') ? 'Watch' : 'Normal'
      return {
        id: String(zone.km_marker ?? index + 1).padStart(2, '0'),
        zoneId: zone.zone_id,
        name: zone.zone_name,
        type: incident ? 'Incident zone' : 'Highway',
        status,
        note: incident?.description || `${flow?.flow_state || 'No recent flow state'} on ${segment?.segment_name || zone.zone_name}`,
        speed: Number(flow?.average_speed_kmh || 0),
        queue: incident?.queueKm || 0,
      }
    })
    : fallbackCorridorZoneData

  const corridorSegmentIncidents = corridorZoneData.map((zone, index) => {
    const linkedIncidentIds = { '02': 'acc-402', '04': 'acc-401', '05': 'acc-403', '08': 'acc-404' }
    const existingIncident = databaseIncidentCards.find((incident) => incident.zoneId && incident.zoneId === zone.zoneId)
      || trafficIncidentCatalog[linkedIncidentIds[zone.id]]
    const upstreamZone = corridorZoneData[Math.max(0, index - 1)]
    const downstreamZone = corridorZoneData[Math.min(corridorZoneData.length - 1, index + 1)]
    const severity = zone.status === 'Critical' || zone.status === 'High'
      ? 'HIGH'
      : zone.status === 'Watch' ? 'MEDIUM' : 'LOW'
    const risk = existingIncident?.probability ?? Math.min(92, Math.max(18, Math.round(zone.queue * 14 + (80 - zone.speed) * 0.55 + 20)))
    const impactScore = Math.min(96, Math.round(zone.queue * 14 + (90 - zone.speed) * 0.45 + 18))

    return {
      ...(existingIncident || {}),
      id: existingIncident?.id || `SEG-${zone.id}`,
      title: existingIncident?.title || `${zone.name} Corridor Segment`,
      severity,
      probability: risk,
      queueKm: zone.queue,
      corridorSpeed: zone.speed,
      segmentId: zone.id,
      segmentType: zone.type,
      segmentStatus: zone.status,
      description: `${zone.note}. Current segment speed is ${zone.speed} km/h with ${zone.queue} km of queue pressure across the ${zone.name} corridor segment.`,
      location: zone.name,
      currentZone: `ZONE ${zone.id} — ${zone.name}`,
      upstream: `ZONE ${upstreamZone.id} — ${upstreamZone.name}`,
      downstream: `ZONE ${downstreamZone.id} — ${downstreamZone.name}`,
      affectedCameras: existingIncident?.affectedCameras || [`CAM-${zone.id}01`, `CAM-${zone.id}02`],
      affectedSegments: existingIncident?.affectedSegments || [`RS-${zone.id}01`, `RS-${zone.id}02`],
      categories: existingIncident?.categories || [zone.type.toUpperCase(), 'CONGESTION', 'SPEED DISRUPTION'],
      queueTrend: Array.from({ length: 6 }, (_, step) => {
        const factor = [0.45, 0.6, 0.78, 1, 0.88, 0.7][step]
        return {
          time: `${String(step * 2).padStart(2, '0')}:00`,
          speed: Math.max(15, Math.round(zone.speed + (1 - factor) * (82 - zone.speed))),
          queue: Number((zone.queue * factor).toFixed(1)),
          flow: Math.round((1000 + zone.speed * 7) * factor + 250),
        }
      }),
      impactBreakdown: existingIncident?.impactBreakdown || [
        { name: zone.type, value: 44 },
        { name: 'Congestion', value: 34 },
        { name: 'Speed disruption', value: 22 },
      ],
      zoneImpact: [upstreamZone, zone, downstreamZone].map((impactZone, impactIndex) => ({
        zone: impactZone.id,
        name: impactZone.name,
        status: impactZone.id === zone.id ? `${zone.status} segment impact` : impactIndex < 1 ? 'Upstream traffic exposure' : 'Downstream flow exposure',
        value: impactZone.id === zone.id ? impactScore : Math.min(88, Math.round(impactZone.queue * 13 + (85 - impactZone.speed) * 0.4 + 18)),
      })),
    }
  })

  const bottleneckRows = [
    { zone: '01', segment: 'Hyderabad / Bahadurpura–Petlaburj', type: 'Urban congestion', effect: 'Queue build-up and lower speeds', monitor: 'Camera + traffic flow', severity: 82 },
    { zone: '02', segment: 'Farukhnagar–Jadcherla', type: 'Black-spot section', effect: 'Incident and speed disruption', monitor: 'Camera + incident', severity: 71 },
    { zone: '03', segment: 'Kothakota Upstream', type: 'Approach queue', effect: 'Incoming congestion spillback', monitor: 'Zone + speed', severity: 68 },
    { zone: '04', segment: 'Kurnool corridor', type: 'Accident / lane closure', effect: 'Severe lane-speed reduction', monitor: 'Camera + flow', severity: 96 },
    { zone: '05', segment: 'Dhone downstream', type: 'Junction / inflow shift', effect: 'Traffic inflow reduced', monitor: 'Camera + queue', severity: 58 },
    { zone: '06', segment: 'Dhone–Gooty interchange', type: 'Heavy-vehicle merge', effect: 'Merging and heavy vehicles', monitor: 'Camera + vehicle mix', severity: 60 },
    { zone: '08', segment: 'Penukonda approaches', type: 'Toll / highway node', effect: 'Queue variation', monitor: 'Toll + flow', severity: 63 },
    { zone: '11', segment: 'Devanahalli–Bengaluru / Hebbal', type: 'Urban approach', effect: 'Peak-hour congestion', monitor: 'Camera + incident', severity: 75 },
  ]

  const impactFlowData = [
    { stage: 'Upstream', value: 64, label: 'ZONE 03 — Kothakota', status: 'Potential congestion' },
    { stage: 'Current', value: 94, label: 'ZONE 04 — Kurnool', status: 'Severe congestion' },
    { stage: 'Downstream', value: 52, label: 'ZONE 05 — Dhone', status: 'Traffic inflow reduced' },
  ]

  const safeRows = useMemo(() => {
    if (Array.isArray(rows) && rows.length > 0) return rows
    return sampleTrafficData
  }, [rows])
  const summary = summarizeData(safeRows)

  const importedCameras = groupBy(safeRows, 'camera').map((camera) => ({
    ...camera,
    id: camera.name,
    status: 'ACTIVE',
  }))

  const baseCameras = (networkCameras.length ? networkCameras : cameraFeeds).map((camera) => {
    const feed = getCameraFeed(camera)
    const matched = importedCameras.find((c) => c.name === camera.name || c.id === camera.id)
    return {
      ...feed,
      ...camera,
      id: camera.id || feed.id,
      name: camera.name || feed.name,
      location: camera.location || feed.location,
      videoUrl: camera.videoUrl || camera.streamUrl || feed.videoUrl,
      value: matched ? matched.value : 0,
      status: 'ACTIVE',
    }
  })

  const extraImported = importedCameras.filter(
    (c) => !cameraFeeds.some((feed) => feed.name === c.name || feed.id === c.id)
  )

  const cameraRecords = [...baseCameras, ...extraImported, ...addedCameras].filter(
    (camera) => !removedCameras.includes(camera.id),
  )

  const topCameras = useMemo(() => {
    return [...cameraRecords].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 6)
  }, [cameraRecords])

  const cameraFeedOptions = useMemo(() => {
    const knownFeeds = cameraFeeds.map((feed) => ({
      ...feed,
      ...(cameraRecords.find((camera) => camera.id === feed.id || camera.name === feed.name) || {}),
    }))
    const extraCameras = addedCameras
      .filter((cam) => !cameraFeeds.some((feed) => feed.id === cam.id || feed.name === cam.name))
      .map((cam) => ({
        ...cam,
        videoUrl: cam.videoUrl || cam.streamUrl || cameraFeeds[0].videoUrl,
      }))
    return [...knownFeeds, ...extraCameras]
  }, [cameraRecords, addedCameras])

  useEffect(() => {
    if (kind === 'cameras' && !inlineCameraFeed && cameraFeedOptions.length) {
      setInlineCameraFeed(cameraFeedOptions[0])
    }
  }, [cameraFeedOptions, inlineCameraFeed, kind])

  useEffect(() => {
    if (kind !== 'cameras' || !location.state?.selectedCameraId || !cameraFeedOptions.length) return

    const requestedId = String(location.state.selectedCameraId)
    const cameraCode = requestedId.match(/^CAM-(\d+)/i)?.[1]
    const corridorCameraCode = cameraCode?.length === 3 ? cameraCode[0].padStart(2, '0') : null
    const matchingCamera = cameraFeedOptions.find((camera) =>
      camera.id === requestedId || camera.name === requestedId
    ) || cameraFeedOptions.find((camera) =>
      corridorCameraCode && camera.id.includes(`-${corridorCameraCode}-`)
    )

    if (matchingCamera && inlineCameraFeed?.id !== matchingCamera.id) {
      setInlineCameraFeed(matchingCamera)
    }
  }, [cameraFeedOptions, inlineCameraFeed?.id, kind, location.state])

  const chartData = useMemo(() => {
    if (kind === 'traffic' && latestNetworkFlows.length) {
      const segmentNames = new Map((networkOverview?.roadSegments || []).map((segment) => [segment.road_segment_id, segment.segment_name]))
      return latestNetworkFlows.map((flow) => ({
        name: segmentNames.get(flow.road_segment_id) || flow.road_segment_id,
        value: Number(flow.vehicles_per_5_min || 0),
        averageSpeed: Number(flow.average_speed_kmh || 0),
      }))
    }
    if (kind === 'cameras' && networkCameras.length) {
      return cameraRecords.slice(0, 6).map((camera) => ({ name: camera.name, value: Number(camera.value || 0) }))
    }
    const grouped = groupBy(safeRows, config.chartKey)
    if (grouped.length > 0) {
      return grouped.sort((a, b) => b.value - a.value).slice(0, 10)
    }
    if (kind === 'cameras') {
      return cameraRecords.slice(0, 6).map((cam) => ({
        name: cam.name.replace('CAM-NH44-', ''),
        value: cam.value || 0,
      }))
    }
    return []
  }, [safeRows, config.chartKey, kind, cameraRecords, latestNetworkFlows, networkOverview, networkCameras.length])

  const pieData = groupBy(safeRows, 'type')
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const topLocations = groupBy(safeRows, 'location')
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  function openCameraFeed(camera) {
    setSelectedCameraFeed(getCameraFeed(camera))
    setCameraFeedOpen(true)
  }

  function closeCameraFeed() {
    setCameraFeedOpen(false)
    setSelectedCameraFeed(null)
  }

  const averageSpeed = kind === 'traffic' && latestNetworkFlows.length
    ? Math.round(latestNetworkFlows.reduce((total, row) => total + Number(row.average_speed_kmh || 0), 0) / latestNetworkFlows.length)
    : safeRows.length
      ? Math.round(safeRows.reduce((total, row) => total + Number(row.speed || 0), 0) / safeRows.length)
      : 62

  const overspeedRows = safeRows.filter((row) => row.overSpeed === 'Yes' || row.isOverSpeed)
  const overspeedCount = overspeedRows.length
  const overspeedPercent = safeRows.length ? Math.round((overspeedCount / safeRows.length) * 100) : 0

  function submitCamera(event) {
    event.preventDefault()
    if (!cameraForm.name.trim() || !onAddCamera) return
    onAddCamera({
      id: `CAM-NH44-${Date.now().toString().slice(-4)}`,
      name: cameraForm.name.trim(),
      location: cameraForm.location.trim() || 'NH-44 Corridor',
      streamUrl: cameraForm.streamUrl.trim(),
      value: 0,
      status: 'Active',
    })
    setCameraForm({ name: '', location: '', streamUrl: '' })
    setCameraDialogOpen(false)
  }

  const handleManualBatchClick = async () => {
    if (!onFetchRandomBatch || isFetchingBatch) return
    setIsFetchingBatch(true)
    try {
      await onFetchRandomBatch()
    } finally {
      setTimeout(() => setIsFetchingBatch(false), 500)
    }
  }

  // Strictly select the latest 12 records for display at the bottom of the dashboard
  const latestTenRows = useMemo(() => {
    if (!safeRows.length) return []
    const scored = safeRows.map((row, idx) => ({
      row,
      originalIdx: idx,
      score: getRecordTimestampScore(row),
    }))
    const hasScores = scored.some((s) => s.score > 0)
    if (hasScores) {
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.originalIdx - a.originalIdx
      })
      return scored.slice(0, 12).map((s) => s.row)
    }
    return safeRows.slice(0, 12)
  }, [safeRows])

  if (activeIncident) {
    return (
      <div className="dashboard-page dashboard-detail-page nh44-theme" style={{ gap: '18px' }}>
        <div className="detail-back-row">
          <Link className="back-link" to="/dashboards/traffic">
            <ArrowLeft size={16} />
            Back to Traffic Flow
          </Link>
        </div>

        <div className="page-intro nh44-header">
          <div>
            <div className="nh44-badge-row">
              <span className="nh44-highway-tag">
                <Radio size={13} className="nh44-pulse-icon" />
                {activeIncident.id} INCIDENT RADAR
              </span>
              <span className="nh44-db-pill">
                <AlertTriangle size={13} />
                Severity {activeIncident.severity}
              </span>
            </div>
            <h1>{activeIncident.title}</h1>
            <p className="intro-copy">{activeIncident.description}</p>
          </div>
          <div className="detail-heading-icon" style={{ borderColor: '#ef444440', color: '#ef4444' }}>
            <AlertTriangle size={26} />
          </div>
        </div>

        <div className="nh44-kpi-grid">
          <div className="nh44-kpi-card">
            <div className="kpi-icon-wrap" style={{ background: '#fff1f2', color: '#dc2626' }}>
              <AlertTriangle size={22} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Queue Length</span>
              <div className="kpi-value-row">
                <strong className="kpi-number">{activeIncident.queueKm}</strong>
                <span className="kpi-unit">km</span>
              </div>
              <span className="kpi-subtext">Immediate corridor obstruction</span>
            </div>
          </div>

          <div className="nh44-kpi-card">
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <MapPin size={22} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Current Zone</span>
              <div className="kpi-value-row">
                <strong className="kpi-number" style={{ fontSize: '1.15rem' }}>{activeIncident.currentZone}</strong>
              </div>
              <span className="kpi-subtext">Primary impact zone</span>
            </div>
          </div>

          <div className="nh44-kpi-card">
            <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Gauge size={22} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Average Speed</span>
              <div className="kpi-value-row">
                <strong className="kpi-number">42</strong>
                <span className="kpi-unit">km/h</span>
              </div>
              <span className="kpi-subtext">Below safe corridor flow</span>
            </div>
          </div>

          <div className="nh44-kpi-card">
            <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
              <Camera size={22} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Affected Cameras</span>
              <div className="kpi-value-row">
                <strong className="kpi-number" style={{ fontSize: '1.05rem' }}>{activeIncident.affectedCameras.length}</strong>
              </div>
              <span className="kpi-subtext">Monitoring incident spread</span>
            </div>
          </div>
        </div>

        <div className="traffic-static-page">
          <div className="traffic-static-hero">
            <div>
              <p className="section-kicker">INCIDENT IMPACT</p>
              <h2>{activeIncident.location}</h2>
              <p>Upstream and downstream traffic conditions are being evaluated through the affected corridor segments and camera network.</p>
            </div>
            <div className="traffic-static-status"><span className="pulse-dot" /> {activeIncident.severity} severity</div>
          </div>

          <div className="impact-zone-board">
            <div className="impact-zone-card watch">
              <span>UPSTREAM</span>
              <h3>{activeIncident.upstream}</h3>
              <b>Potential congestion</b>
              <p>Queue formation beginning to build against the current incident zone.</p>
            </div>
            <div className="impact-zone-card critical">
              <span>CURRENT</span>
              <h3>{activeIncident.currentZone}</h3>
              <b>Severe congestion</b>
              <p>Primary incident area with the most concentrated disruption.</p>
            </div>
            <div className="impact-zone-card watch">
              <span>DOWNSTREAM</span>
              <h3>{activeIncident.downstream}</h3>
              <b>Traffic inflow reduced</b>
              <p>Outflow and inflow are being redistributed due to incident clearance timing.</p>
            </div>
          </div>

          <div className="detail-chart-grid">
            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">TRAFFIC FLOW</p>
                  <h2>Speed vs Queue Trend</h2>
                </div>
                <span className="nh44-live-pill">Last 10 hours</span>
              </div>
              <div className="chart-frame" style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeIncident.queueTrend} margin={{ top: 10, right: 12, left: -20, bottom: 2 }}>
                    <CartesianGrid stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="speed" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} name="Speed (km/h)" />
                    <Line type="monotone" dataKey="queue" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Queue (km)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">IMPACT MIX</p>
                  <h2>Incident Drivers</h2>
                </div>
                <span className="nh44-live-pill">Classified factors</span>
              </div>
              <div className="chart-frame" style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeIncident.impactBreakdown} margin={{ top: 10, right: 12, left: -20, bottom: 2 }}>
                    <CartesianGrid stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {activeIncident.impactBreakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={['#2563eb', '#f59e0b', '#10b981', '#f97316', '#ef4444'][index % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="detail-chart-grid">
            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">ZONE RESPONSE</p>
                  <h2>Zone Impact Overview</h2>
                </div>
              </div>
              <div className="chart-frame" style={{ height: '220px', padding: '8px 0 0' }}>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {activeIncident.zoneImpact.map((zone) => (
                    <div key={zone.zone}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#475569' }}>
                        <span>Zone {zone.zone} — {zone.name}</span>
                        <strong>{zone.value}%</strong>
                      </div>
                      <div style={{ height: '10px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${zone.value}%`, background: zone.status.includes('Severe') ? '#ef4444' : '#f59e0b', borderRadius: '999px' }} />
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b' }}>{zone.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">CORRIDOR DATA</p>
                  <h2>Operational Summary</h2>
                </div>
              </div>
              <div className="chart-frame" style={{ height: '220px', padding: '12px 0 0' }}>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Affected cameras</span>
                    <strong>{activeIncident.affectedCameras.join(', ')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Affected segments</span>
                    <strong>{activeIncident.affectedSegments.join(', ')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Current impact</span>
                    <strong>{activeIncident.queueKm} km queue</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Event class</span>
                    <strong>{activeIncident.categories.join(' • ')}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`dashboard-page dashboard-detail-page dashboard-kind-${kind || 'vehicles'} nh44-theme`}>
      {/* TOP NAVIGATION & CONTROLS */}
      <div className="detail-back-row">
        <Link className="back-link" to="/dashboards">
          <ArrowLeft size={16} />
          Back to Highway Intelligence Hub
        </Link>
        <div className="header-actions">
          <label className="csv-import-button csv-import-button-small">
            <Upload size={14} />
            Import CSV / XLSX
            <input
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel"
              onChange={onImport}
              type="file"
            />
          </label>
        </div>
      </div>

      {importError && (
        <p className="csv-import-error" role="alert">
          {importError}
        </p>
      )}

      {/* VIEW HERO */}
      <div className="page-intro nh44-header">
        <div>
          <div className="nh44-badge-row">
            <span className="nh44-highway-tag">
              <Radio size={13} className="nh44-pulse-icon" />
              {fileName?.includes('NH44') ? 'NH-44 LIVE RADAR' : `${fileName || 'HIGHWAY'} RADAR`}
            </span>
            <span className="nh44-db-pill">
              <Database size={13} />
              {dbStats?.totalRecords || dbStats?.totalPool ? `${Number(dbStats.totalRecords || dbStats.totalPool).toLocaleString()} Archive Records (MySQL)` : 'MySQL Database Connected'}
            </span>
          </div>
          <h1>{config.title}</h1>
          <p className="intro-copy">{config.description}</p>
        </div>
        <div className="detail-heading-icon" style={{ borderColor: `${config.color}40`, color: config.color }}>
          <Icon size={26} />
        </div>
      </div>

      {/* ── 2 SUB-PAGES HORIZONTAL TAB BAR FOR TRAFFIC FLOW ── */}
      {kind === 'traffic' && (
        <div className="tr-tab-row" style={{ marginTop: '16px', marginBottom: '24px' }}>
          <button
            type="button"
            className={`tr-tab-btn ${trafficTab === 'overview' ? 'active' : ''}`}
            onClick={() => setTrafficTab('overview')}
          >
            Flow Overview
          </button>
          <button
            type="button"
            className={`tr-tab-btn ${trafficTab === 'corridor' ? 'active' : ''}`}
            onClick={() => setTrafficTab('corridor')}
          >
            Corridor Segments
          </button>
          <button
            type="button"
            className={`tr-tab-btn ${trafficTab === 'bottlenecks' ? 'active' : ''}`}
            onClick={() => setTrafficTab('bottlenecks')}
          >
            Bottlenecks
          </button>
          <button
            type="button"
            className={`tr-tab-btn ${trafficTab === 'impact' ? 'active' : ''}`}
            onClick={() => setTrafficTab('impact')}
          >
            Corridor Impact
          </button>
          <button
            type="button"
            className={`tr-tab-btn ${trafficTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setTrafficTab('analytics')}
          >
            Vehicle Analytics
          </button>
        </div>
      )}

      {(kind !== 'traffic' || trafficTab === 'overview') && (
        <>
      {/* LIVE HIGHWAY TELEMETRY CONTROL BAR */}
      <div className="nh44-stream-console">
        <div className="stream-console-status">
          <div className={`radar-indicator ${streamPaused ? 'paused' : 'active'}`}>
            <span className="radar-ring" />
            <span className="radar-dot" />
          </div>
          <div className="stream-status-text">
            <div className="stream-status-title">
              <strong>{streamPaused ? 'Stream Paused' : 'Live Highway Telemetry Streaming'}</strong>
              <span className="stream-source-tag">Source: {fileName || 'NH44_vehicles_5000_merged_with_images.xlsx'}</span>
            </div>
            <div className="stream-status-meta">
              {latestBatchInfo?.batchCount ? (
                <span className="batch-flash-pill">
                  <Zap size={13} />
                  +<strong>{latestBatchInfo.batchCount}</strong> records ingested in this batch (Random range 1–20)
                  <span className="batch-total-growth">
                    • Cumulative Total: <strong>{safeRows.length}</strong> records (Increasing ▲)
                  </span>
                  {latestBatchInfo.overspeedCount > 0 && (
                    <span className="batch-overspeed-tag">
                      ({latestBatchInfo.overspeedCount} speeding alerts)
                    </span>
                  )}
                </span>
              ) : (
                <span>Receiving random batches (1–20 rows) from MySQL database... Total: <strong>{safeRows.length}</strong> records</span>
              )}
            </div>
          </div>
        </div>

        <div className="stream-console-actions">
          <button
            className={`nh44-control-btn nh44-trigger-btn ${isFetchingBatch ? 'is-loading' : ''}`}
            onClick={handleManualBatchClick}
            type="button"
            title="Fetch a random batch of 1 to 20 records instantly"
          >
            <RefreshCw size={15} className={isFetchingBatch ? 'spin-icon' : ''} />
            <span>Fetch Random Batch (1–20)</span>
          </button>

          {onToggleStreamPause && (
            <button
              className={`nh44-control-btn nh44-pause-btn ${streamPaused ? 'resume' : ''}`}
              onClick={onToggleStreamPause}
              type="button"
            >
              {streamPaused ? (
                <>
                  <Play size={15} />
                  <span>Resume Stream</span>
                </>
              ) : (
                <>
                  <Pause size={15} />
                  <span>Pause Stream</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="nh44-kpi-grid">
        <div className="nh44-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <TrendingUp size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Cumulative Ingested Data</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{safeRows.length}</strong>
              <span className="kpi-delta-tag success">▲ Increasing</span>
            </div>
            <span className="kpi-subtext">Accumulating random batches (1–20) live</span>
          </div>
        </div>

        <div className="nh44-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#ef4444' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Speeding Violations</span>
            <div className="kpi-value-row">
              <strong className="kpi-number" style={{ color: '#dc2626' }}>
                {overspeedCount}
              </strong>
              <span className="kpi-delta-tag alert">{overspeedPercent}%</span>
            </div>
            <span className="kpi-subtext">Exceeding 60 km/h radar limit</span>
          </div>
        </div>

        <div className="nh44-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#fffbeb', color: '#d97706' }}>
            <Gauge size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Average Speed</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{averageSpeed}</strong>
              <span className="kpi-unit">km/h</span>
            </div>
            <span className="kpi-subtext">Monitored along NH-44 corridor</span>
          </div>
        </div>

        <div className="nh44-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Camera size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Active Checkpoints</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{summary.uniqueLocations || 4}</strong>
              <span className="kpi-unit">gates</span>
            </div>
            <span className="kpi-subtext">Shamshabad, Shadnagar, Medchal</span>
          </div>
        </div>
      </div>

      {/* TRAFFIC FLOW SPECIFIC SECTION */}
      {kind === 'traffic' && (
        <section className="alternate-dashboard-layout traffic-flow-layout">
          <div className="flow-command-panel">
            <div className="flow-command-copy">
              <p className="section-kicker">LIVE FLOW PULSE</p>
              <h2>Corridor Radar Activity</h2>
              <span>Calculated across {safeRows.length} active detections</span>
            </div>
            <div className="flow-pulse">
              <Activity size={19} />
              <strong>{summary.total.toLocaleString()}</strong>
              <span>active detections</span>
            </div>
            <div className="flow-pulse warm">
              <Gauge size={19} />
              <strong>
                {averageSpeed} <small>km/h</small>
              </strong>
              <span>average speed</span>
            </div>
            <div className="flow-pulse alert">
              <Radio size={19} />
              <strong>{overspeedCount}</strong>
              <span>speed alerts</span>
            </div>
            <div className="flow-pulse incident-link-panel" style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <strong style={{ fontSize: '12px', display: 'block' }}>ACC-401</strong>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>NH-44 / Kurnool</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/vehicle-information', {
                    state: {
                      trafficIncident: {
                        id: 'ACC-401',
                        title: 'NH-44 / Kurnool Incident',
                        severity: 'HIGH',
                        queueKm: 3.2,
                        location: 'NH-44 / Kurnool',
                        currentZone: 'ZONE 04 — Kurnool',
                        upstream: 'ZONE 03 — Kothakota',
                        downstream: 'ZONE 05 — Dhone',
                        affectedCameras: ['CAM-401', 'CAM-402', 'CAM-403', 'CAM-404'],
                        affectedSegments: ['RS-401', 'RS-402'],
                        categories: ['CONGESTION', 'ACCIDENT', 'ROAD WORK', 'LANE CLOSURE', 'BLACK SPOT'],
                      },
                    },
                  })}
                  className="nh44-control-btn nh44-trigger-btn"
                  style={{ padding: '8px 12px', borderRadius: '10px', minWidth: 'auto', fontSize: '11px' }}
                >
                  Open incident
                </button>
              </div>
            </div>
          </div>
          <div className="flow-location-board">
            <div className="alternate-section-heading">
              <div>
                <p className="section-kicker">PRESSURE DISTRIBUTION</p>
                <h2>Corridor Segments</h2>
              </div>
              <span className="nh44-live-indicator">
                <span className="pulse-dot" /> LIVE
              </span>
            </div>
            {topLocations.length ? (
              topLocations.map((location, index) => (
                <div className="flow-location-row" key={location.name}>
                  <span className="flow-location-rank">0{index + 1}</span>
                  <div>
                    <strong>{location.name}</strong>
                    <span>{location.value} detections</span>
                  </div>
                  <b>{Math.round((location.value / (summary.total || 1)) * 100)}%</b>
                  <i>
                    <em
                      style={{
                        width: `${Math.min(100, (location.value / (topLocations[0]?.value || 1)) * 100)}%`,
                      }}
                    />
                  </i>
                </div>
              ))
            ) : (
              <p className="alternate-empty">Waiting for traffic records...</p>
            )}
          </div>
        </section>
      )}

        </>
      )}

      {/* STATIC NH-44 CORRIDOR SUB-PAGES */}
      {kind === 'traffic' && trafficTab === 'corridor' && (
        <section className="traffic-static-page">
          <div className="traffic-static-hero">
            <div>
              <p className="section-kicker">NH-44 CORRIDOR INTELLIGENCE</p>
              <h2>Hyderabad → Bengaluru Corridor</h2>
              <p>Current congestion mapping for the Kurnool incident shows queue spillback into upstream segments and reduced throughput into the downstream zone.</p>
            </div>
            <div className="traffic-static-status"><span className="pulse-dot" /> 11 monitored zones</div>
          </div>

          <div className="corridor-incident-alerts">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">ACTIVE EVENTS</p>
                <h2>Incident alerts</h2>
              </div>
              <span className="nh44-live-pill">{incidentCardList.length} incidents</span>
            </div>
            <div className="traffic-trigger-list" style={{ display: 'grid', gap: '10px' }}>
              {incidentCardList.map((incident) => (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => navigate('/vehicle-information', {
                    state: {
                      trafficIncident: {
                        id: incident.id,
                        title: incident.title,
                        severity: incident.severity,
                        queueKm: incident.queueKm,
                        location: incident.location,
                        currentZone: incident.currentZone,
                        upstream: incident.upstream,
                        downstream: incident.downstream,
                        affectedCameras: incident.affectedCameras,
                        affectedSegments: incident.affectedSegments,
                        categories: incident.categories,
                      },
                      incidentCatalog: incidentCardList,
                    },
                  })}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    border: '1px solid #dfe8f3',
                    background: '#fff',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>{incident.id}</div>
                    <div style={{ fontWeight: 800, color: '#11233d', marginTop: '2px' }}>{incident.title}</div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{incident.location}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ background: '#fef2f2', color: '#991b1b', padding: '4px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 800 }}>{incident.severity}</span>
                    <span style={{ background: '#ecfeff', color: '#0f766e', padding: '4px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 800 }}>{incident.probability}% risk</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="detail-chart-grid">
            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">ZONE SPEED</p>
                  <h2>Corridor Speed Profile</h2>
                </div>
                <span className="nh44-live-pill">Speed (km/h)</span>
              </div>
              <div className="chart-frame" style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={corridorZoneData} margin={{ top: 8, right: 12, left: -20, bottom: 2 }}>
                    <CartesianGrid stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="id" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="speed" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} name="Speed" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">QUEUE PRESSURE</p>
                  <h2>Queue Intensity by Zone</h2>
                </div>
                <span className="nh44-live-pill">Queue (km)</span>
              </div>
              <div className="chart-frame" style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={corridorZoneData} margin={{ top: 8, right: 12, left: -20, bottom: 2 }}>
                    <CartesianGrid stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="id" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="queue" radius={[6, 6, 0, 0]}>
                      {corridorZoneData.map((entry, index) => (
                        <Cell key={entry.id} fill={entry.id === '04' ? '#ef4444' : ['#60a5fa', '#93c5fd', '#fbbf24', '#f59e0b', '#34d399'][index % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="traffic-zone-grid">
            {corridorZoneData.map((zone, index) => {
              const { id, name, type, status, note, speed, queue } = zone
              const incident = corridorSegmentIncidents[index]
              return (
              <button
                className="traffic-zone-card traffic-zone-card-button"
                key={id}
                type="button"
                aria-label={`Open incident details for Zone ${id}, ${name}`}
                onClick={() => navigate('/vehicle-information', {
                  state: {
                    trafficIncident: incident,
                    incidentCatalog: corridorSegmentIncidents,
                  },
                })}
              >
                <div className="traffic-zone-number">{id}</div>
                <div className="traffic-zone-main">
                  <div className="traffic-zone-title-row">
                    <div><span>{type}</span><h3>{name}</h3></div>
                    <b className={`zone-status ${status.toLowerCase()}`}>{status}</b>
                  </div>
                  <p>{note}</p>
                  <div className="traffic-zone-metrics">
                    <span>Speed <strong>{speed} km/h</strong></span>
                    <span>Queue <strong>{queue} km</strong></span>
                    <span>Impact <strong>{id === '04' ? 'Critical' : 'Live'}</strong></span>
                  </div>
                </div>
              </button>
            )})}
          </div>
        </section>
      )}

      {kind === 'traffic' && trafficTab === 'bottlenecks' && (
        <section className="traffic-static-page">
          <div className="traffic-static-hero">
            <div>
              <p className="section-kicker">BOTTLENECK REGISTER</p>
              <h2>NH-44 Corridor Bottleneck Map</h2>
              <p>Live congestion pressure points are mapped to the affected corridor network, with queue growth concentrated around Kurnool and upstream route spillback.</p>
            </div>
          </div>

          <div className="detail-chart-grid">
            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">SEVERITY</p>
                  <h2>Bottleneck Severity Index</h2>
                </div>
                <span className="nh44-live-pill">0–100</span>
              </div>
              <div className="chart-frame" style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bottleneckRows} margin={{ top: 8, right: 12, left: -20, bottom: 2 }}>
                    <CartesianGrid stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="zone" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="severity" radius={[6, 6, 0, 0]} fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">RISK NOTES</p>
                  <h2>Current Operational Risks</h2>
                </div>
              </div>
              <div className="chart-frame" style={{ height: '240px', padding: '10px 0 0' }}>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {bottleneckRows.slice(0, 4).map((row) => (
                    <div key={row.zone} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                        <strong style={{ color: '#10233d' }}>Zone {row.zone}</strong>
                        <span>{row.severity}/100</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>{row.effect}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bottleneck-table-wrap">
            <table className="bottleneck-table">
              <thead><tr><th>ZONE</th><th>LOCATION / SEGMENT</th><th>TYPE</th><th>EXPECTED EFFECT</th><th>MONITORING</th></tr></thead>
              <tbody>
                {bottleneckRows.map((row) => (
                  <tr key={row.zone + row.segment}>
                    <td><strong>{row.zone}</strong></td>
                    <td>{row.segment}</td>
                    <td>{row.type}</td>
                    <td>{row.effect}</td>
                    <td>{row.monitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {kind === 'traffic' && trafficTab === 'impact' && (
        <section className="traffic-static-page">
          <div className="traffic-static-hero">
            <div>
              <p className="section-kicker">CORRIDOR IMPACT MODEL</p>
              <h2>How the Kurnool incident propagates through NH-44</h2>
              <p>Queue pressure begins upstream, peaks in Kurnool, and then reduces downstream inflow as route capacity is diverted and the main corridor clears.</p>
            </div>
          </div>

          <div className="detail-chart-grid">
            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">IMPACT SPREAD</p>
                  <h2>Zone Pressure Trend</h2>
                </div>
                <span className="nh44-live-pill">Current impact</span>
              </div>
              <div className="chart-frame" style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={impactFlowData} margin={{ top: 8, right: 12, left: -20, bottom: 2 }}>
                    <CartesianGrid stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Impact score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">SEGMENT LOAD</p>
                  <h2>Impact Points</h2>
                </div>
              </div>
              <div className="chart-frame" style={{ height: '240px', padding: '10px 0 0' }}>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {impactFlowData.map((item) => (
                    <div key={item.stage}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#475569' }}>
                        <span>{item.label}</span>
                        <strong>{item.value}%</strong>
                      </div>
                      <div style={{ height: '10px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.value}%`, background: item.stage === 'Current' ? '#ef4444' : '#f59e0b', borderRadius: '999px' }} />
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b' }}>{item.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="impact-flow-board">
            <div className="impact-node"><span>01</span><strong>Incident</strong><small>Accident and lane disruption observed in Kurnool</small></div>
            <div className="impact-arrow">→</div>
            <div className="impact-node"><span>02</span><strong>Road Segment</strong><small>Vehicle flow slows and queue forms on RS-401 and RS-402</small></div>
            <div className="impact-arrow">→</div>
            <div className="impact-node"><span>03</span><strong>Zone Impact</strong><small>Upstream queue forms while downstream inflow reduces</small></div>
            <div className="impact-arrow">→</div>
            <div className="impact-node"><span>04</span><strong>Corridor Impact</strong><small>Network-wide congestion risk remains elevated until clearance</small></div>
          </div>

          <div className="impact-zone-board">
            {[
              ['Zone 03','Kothakota','WATCH','Potential upstream queue'],
              ['Zone 04','Kurnool','CRITICAL','Primary incident zone with severe congestion'],
              ['Zone 05','Dhone','WATCH','Reduced / redistributed flow'],
            ].map(([zone, location, status, note]) => (
              <div className={`impact-zone-card ${status.toLowerCase()}`} key={zone}>
                <div><span>{zone}</span><h3>{location}</h3></div>
                <b>{status}</b>
                <p>{note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(kind !== 'traffic' || trafficTab === 'overview') && (
        <>
      {/* CAMERA COVERAGE SPECIFIC SECTION */}
      {kind === 'cameras' && (
        <section className="alternate-dashboard-layout camera-coverage-layout">
          <div className="camera-coverage-hero">
            <div>
              <p className="section-kicker">NETWORK MANAGEMENT</p>
              <h2>NH-44 Checkpoint Feeds</h2>
              <span>Active optical cameras capturing live highway events</span>
            </div>
            <div className="coverage-ring">
              <strong>{cameraRecords.length}</strong>
              <span>sources</span>
            </div>
            <div className="camera-control-actions">
              <button
                className="primary-action camera-add-button"
                onClick={() => setCameraDialogOpen(true)}
                type="button"
              >
                <Camera size={15} />
                Add new camera
              </button>
              <button
                className="camera-remove-button"
                onClick={() => setCameraRemoveDialogOpen(true)}
                type="button"
              >
                <Trash2 size={15} />
                Remove camera
              </button>
            </div>
          </div>
          <CameraFeedPanel cameras={cameraFeedOptions} camera={inlineCameraFeed} onSelectCamera={setInlineCameraFeed} />
          <div className="camera-source-grid">
            {topCameras.length ? (
              topCameras.map((camera, index) => (
                <div className="camera-source-card" key={camera.id || camera.name}>
                  <div className="camera-source-icon">
                    <Camera size={17} />
                  </div>
                  <div>
                    <strong>{camera.name}</strong>
                    <span>
                      {camera.value || 0} records captured
                      {camera.location ? ` · ${camera.location}` : ''}
                    </span>
                  </div>
                  <div className="camera-source-actions">
                    <b className={camera.status === 'Active' || index === 0 ? 'active' : ''}>
                      {camera.status || (index === 0 ? 'LIVE' : 'ACTIVE')}
                    </b>
                    <button className="camera-feed-open-button" onClick={() => openCameraFeed(camera)} type="button">
                      <Play size={11} /> View Feed
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="alternate-empty">Waiting for camera records...</p>
            )}
          </div>
        </section>
      )}

      {/* VISUAL ANALYTICS CHARTS */}
      <div className="detail-chart-grid">
        <div className="dashboard-panel chart-panel nh44-chart-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">DATA REPRESENTATION</p>
              <h2>{config.chartTitle}</h2>
            </div>
            <button className="nh44-live-pill nh44-live-button" onClick={() => openCameraFeed(topCameras[0] || cameraFeedOptions[0])} type="button">
              <span className="pulse-dot" /> Live Stream
            </button>
          </div>
          <div className="chart-frame" style={{ height: '260px' }}>
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {chartData.map((entry) => {
                    const barColor =
                      config.chartKey === 'type' ? getVehicleMeta(entry.name).color : config.color
                    return <Cell fill={barColor} key={entry.name} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-panel chart-panel nh44-chart-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">COMPOSITION</p>
              <h2>Vehicle Classification Mix</h2>
            </div>
            <span className="nh44-live-pill">{pieData.length} Categories</span>
          </div>
          <div className="chart-frame pie-chart-frame" style={{ height: '200px' }}>
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={pieData}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {pieData.map((entry) => (
                    <Cell fill={getVehicleMeta(entry.name).color} key={entry.name} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {pieData.map((entry) => {
              const meta = getVehicleMeta(entry.name)
              return (
                <span key={entry.name}>
                  <i style={{ background: meta.color }} />
                  {entry.name} <strong>{entry.value}</strong>
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* CAMERA SETUP MODAL */}
      {cameraDialogOpen &&
        createPortal(
          <div className="modal-backdrop" onMouseDown={() => setCameraDialogOpen(false)}>
            <form
              className="camera-dialog"
              onMouseDown={(event) => event.stopPropagation()}
              onSubmit={submitCamera}
            >
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">CHECKPOINT SETUP</p>
                  <h2>Add NH-44 Camera Feed</h2>
                </div>
                <button className="modal-close" onClick={() => setCameraDialogOpen(false)} type="button">
                  ×
                </button>
              </div>
              <label>
                Camera checkpoint name
                <input
                  autoFocus
                  onChange={(event) => setCameraForm({ ...cameraForm, name: event.target.value })}
                  placeholder="e.g. NH44-Shamshabad-South"
                  value={cameraForm.name}
                />
              </label>
              <label>
                Highway Location
                <input
                  onChange={(event) => setCameraForm({ ...cameraForm, location: event.target.value })}
                  placeholder="e.g. NH-44 KM 24.5 South Toll"
                  value={cameraForm.location}
                />
              </label>
              <label>
                Stream URL <span>(optional)</span>
                <input
                  onChange={(event) => setCameraForm({ ...cameraForm, streamUrl: event.target.value })}
                  placeholder="rtsp:// or https://"
                  value={cameraForm.streamUrl}
                />
              </label>
              <button className="primary-action" type="submit">
                <Camera size={15} />
                Add checkpoint
              </button>
            </form>
          </div>,
          document.body,
        )}

      {/* CAMERA REMOVAL MODAL */}
      {cameraRemoveDialogOpen &&
        createPortal(
          <div className="modal-backdrop" onMouseDown={() => setCameraRemoveDialogOpen(false)}>
            <div
              className="camera-dialog camera-remove-dialog"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">CAMERA ADMINISTRATION</p>
                  <h2>Remove Camera Feed</h2>
                </div>
                <button
                  className="modal-close"
                  onClick={() => setCameraRemoveDialogOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <p className="camera-dialog-copy">
                Select a checkpoint to remove it from surveillance monitoring.
              </p>
              <div className="camera-remove-list">
                {cameraRecords.length ? (
                  cameraRecords.map((camera) => (
                    <div className="camera-remove-row" key={camera.id}>
                      <div>
                        <strong>{camera.name}</strong>
                        <span>
                          {camera.location || `${camera.value || 0} records captured`} ·{' '}
                          {camera.status || 'ACTIVE'}
                        </span>
                      </div>
                      <button
                        className="camera-remove-confirm"
                        onClick={() => {
                          onRemoveCamera?.(camera.id)
                          setCameraRemoveDialogOpen(false)
                        }}
                        type="button"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="alternate-empty">No cameras are currently available.</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* SOURCE RECORDS TABLE */}
      {safeRows.length > 0 && (
        <div className="dashboard-panel traffic-table-panel nh44-table-panel" style={{ marginTop: '24px' }}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">SOURCE RECORDS</p>
              <h2>Latest Detections ({config.title})</h2>
            </div>
            <div className="table-heading-right">
              <span className="nh44-live-indicator">
                <span className="pulse-dot" />
                Live Feed
              </span>
              <span className="record-count">
                Displaying latest {latestTenRows.length} of {safeRows.length} records
              </span>
            </div>
          </div>

          <div className="traffic-table-wrapper">
            <table className="traffic-table nh44-table">
              <thead>
                <tr>
                  <th>SURVEILLANCE SNAPSHOT</th>
                  <th>TIMESTAMP (IST)</th>
                  <th>VEHICLE TYPE</th>
                  <th>NUMBER PLATE (HSRP)</th>
                  <th>SPEED / LIMIT</th>
                  <th>RADAR STATUS</th>
                  <th>ANPR OCR</th>
                  <th>HIGHWAY CHECKPOINT</th>
                </tr>
              </thead>
              <tbody>
                {latestTenRows.map((row, index) => {
                  const isOver = row.overSpeed === 'Yes' || row.isOverSpeed
                  const speedNum = Number(row.speed || 0)
                  const speedLimit = Number(row.speedLimit || 60)
                  const plateText = row.vehicleNumberPlate || row.numberPlate
                  const confidenceVal = Math.round(
                    (row.plateConfidence || row.confidence) > 1
                      ? (row.plateConfidence || row.confidence)
                      : ((row.plateConfidence || row.confidence || 0.94) * 100),
                  )

                  return (
                    <tr
                      key={`${row.id || row.csvRecordId || row.observationId}-${index}`}
                      className={index === 0 && latestBatchInfo?.batchCount ? 'row-new-arrival' : ''}
                    >
                      <td style={{ minWidth: '130px' }}>
                        <VehicleImageThumbnail
                          onClick={() => {
                            setInitialModalTab('vehicle')
                            setPreviewModalRow(row)
                          }}
                          onPlayVideo={() => {
                            setInitialModalTab('video')
                            setPreviewModalRow(row)
                          }}
                          row={row}
                          size="table"
                        />
                      </td>
                      <td>
                        <div className="timestamp-cell">
                          <strong>{row.timestampIst || row.timestamp || 'Live'}</strong>
                          {index === 0 && <span className="new-tag">NEW</span>}
                        </div>
                      </td>
                      <td>
                        <VehicleBadge type={row.vehicleType || row.type} />
                      </td>
                      <td>
                        {plateText ? (
                          <div className="hsrp-plate-badge" title="High Security Registration Plate">
                            <span className="hsrp-country">
                              <span className="chakra-dot">☸</span>
                              IND
                            </span>
                            <span className="hsrp-code">{plateText}</span>
                          </div>
                        ) : (
                          <span className="query-plate-na">—</span>
                        )}
                      </td>
                      <td>
                        <div className="speed-metric-cell">
                          <strong className={isOver ? 'speed-val alert' : 'speed-val'}>
                            {speedNum}
                          </strong>
                          <span className="speed-denom">/ {speedLimit} km/h</span>
                        </div>
                      </td>
                      <td>
                        {isOver ? (
                          <span className="nh44-status-pill danger">
                            <AlertTriangle size={12} />
                            +{speedNum - speedLimit} km/h Over
                          </span>
                        ) : (
                          <span className="nh44-status-pill normal">
                            <CheckCircle2 size={12} />
                            Normal
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="nh44-confidence-badge"
                          style={{ color: confidenceVal >= 90 ? '#059669' : '#d97706' }}
                        >
                          {confidenceVal}%
                        </span>
                      </td>
                      <td>
                        <span className="nh44-location-cell">
                          <MapPin size={13} />
                          {row.location || row.camera || 'NH-44 Corridor'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* SUB-PAGE 2: VEHICLE ANALYTICS */}
      {kind === 'traffic' && trafficTab === 'analytics' && (
        <div className="vehicle-analytics-subpage" style={{ display: 'grid', gap: '20px' }}>
          <div className="page-intro" style={{ marginBottom: '10px' }}>
            <div>
              <p className="section-kicker">VEHICLE INTELLIGENCE &amp; CLASSIFICATION</p>
              <h1 style={{ fontSize: '22px', fontWeight: '800', margin: '2px 0 4px 0', color: '#0f172a' }}>
                Vehicle Analytics &amp; HSRP Classification Mix
              </h1>
              <p className="intro-copy" style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Analyze vehicle type distributions, HSRP optical license plate recognition confidence, velocity profiles, and category ratios across the monitored corridor.
              </p>
            </div>
          </div>

          <div className="detail-chart-grid">
            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">CLASSIFICATION DISTRIBUTION</p>
                  <h2>Vehicles by Classification</h2>
                </div>
                <span className="nh44-live-pill">Live Stream</span>
              </div>
              <div className="chart-frame" style={{ height: '260px' }}>
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={pieData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                      {pieData.map((entry) => (
                        <Cell fill={getVehicleMeta(entry.name).color} key={entry.name} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-panel chart-panel nh44-chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">CATEGORY BREAKDOWN</p>
                  <h2>Vehicle Type Mix Ratio</h2>
                </div>
                <span className="nh44-live-pill">Distribution</span>
              </div>
              <div className="chart-frame pie-chart-frame" style={{ height: '200px', display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      innerRadius={55}
                      nameKey="name"
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {pieData.map((entry) => (
                        <Cell fill={getVehicleMeta(entry.name).color} key={entry.name} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend" style={{ marginTop: '12px' }}>
                {pieData.map((entry) => {
                  const meta = getVehicleMeta(entry.name)
                  return (
                    <span key={entry.name}>
                      <i style={{ background: meta.color }} />
                      {entry.name} <strong>{entry.value}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* SOURCE RECORDS TABLE FOR VEHICLE ANALYTICS */}
          {safeRows.length > 0 && (
            <div className="dashboard-panel traffic-table-panel nh44-table-panel" style={{ marginTop: '24px' }}>
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">SOURCE RECORDS</p>
                  <h2>Latest Detections (Vehicle Analytics)</h2>
                </div>
                <div className="table-heading-right">
                  <span className="nh44-live-indicator">
                    <span className="pulse-dot" />
                    Live Feed
                  </span>
                  <span className="record-count">
                    Displaying latest {latestTenRows.length} of {safeRows.length} records
                  </span>
                </div>
              </div>
              <div className="traffic-table-wrapper">
                <table className="traffic-table nh44-table">
                  <thead>
                    <tr>
                      <th>SURVEILLANCE SNAPSHOT</th>
                      <th>TIMESTAMP (IST)</th>
                      <th>VEHICLE TYPE</th>
                      <th>NUMBER PLATE (HSRP)</th>
                      <th>SPEED / LIMIT</th>
                      <th>RADAR STATUS</th>
                      <th>ANPR OCR</th>
                      <th>HIGHWAY CHECKPOINT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestTenRows.map((row, index) => {
                      const isOver = row.overSpeed === 'Yes' || row.isOverSpeed
                      const speedNum = Number(row.speed || 0)
                      const speedLimit = Number(row.speedLimit || 60)
                      const plateText = row.vehicleNumberPlate || row.numberPlate
                      const confidenceVal = Math.round(
                        (row.plateConfidence || row.confidence) > 1
                          ? (row.plateConfidence || row.confidence)
                          : ((row.plateConfidence || row.confidence || 0.94) * 100),
                      )

                      return (
                        <tr key={`${row.id || row.csvRecordId || row.observationId}-${index}`}>
                          <td style={{ minWidth: '130px' }}>
                            <VehicleImageThumbnail
                              onClick={() => {
                                setInitialModalTab('vehicle')
                                setPreviewModalRow(row)
                              }}
                              onPlayVideo={() => {
                                setInitialModalTab('video')
                                setPreviewModalRow(row)
                              }}
                              row={row}
                              size="table"
                            />
                          </td>
                          <td>
                            <div className="timestamp-cell">
                              <strong>{row.timestampIst || row.timestamp || 'Live'}</strong>
                            </div>
                          </td>
                          <td>
                            <VehicleBadge type={row.vehicleType || row.type} />
                          </td>
                          <td>
                            {plateText ? (
                              <div className="hsrp-plate-badge" title="High Security Registration Plate">
                                <span className="hsrp-country">
                                  <span className="chakra-dot">☸</span>
                                  IND
                                </span>
                                <span className="hsrp-code">{plateText}</span>
                              </div>
                            ) : (
                              <span className="query-plate-na">—</span>
                            )}
                          </td>
                          <td>
                            <div className="speed-metric-cell">
                              <strong className={isOver ? 'speed-val alert' : 'speed-val'}>
                                {speedNum}
                              </strong>
                              <span className="speed-denom">/ {speedLimit} km/h</span>
                            </div>
                          </td>
                          <td>
                            {isOver ? (
                              <span className="nh44-status-pill danger">
                                <AlertTriangle size={12} />
                                +{speedNum - speedLimit} km/h Over
                              </span>
                            ) : (
                              <span className="nh44-status-pill normal">
                                <CheckCircle2 size={12} />
                                Normal
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className="nh44-confidence-badge"
                              style={{ color: confidenceVal >= 90 ? '#059669' : '#d97706' }}
                            >
                              {confidenceVal}%
                            </span>
                          </td>
                          <td>
                            <span className="nh44-location-cell">
                              <MapPin size={13} />
                              {row.location || row.camera || 'NH-44 Corridor'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MEDIA PREVIEW MODAL */}
      {previewModalRow && (
        <MediaPreviewModal
          allRows={latestTenRows}
          initialTab={initialModalTab}
          isOpen={Boolean(previewModalRow)}
          onClose={() => setPreviewModalRow(null)}
          onSelectRow={setPreviewModalRow}
          row={previewModalRow}
        />
      )}

      {cameraFeedOpen && selectedCameraFeed && (
        <CameraFeedModal
          camera={selectedCameraFeed}
          cameras={cameraFeedOptions}
          isOpen={cameraFeedOpen}
          onClose={closeCameraFeed}
          onSelectCamera={setSelectedCameraFeed}
        />
      )}
    </div>
  )
}
