import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CarFront,
  Navigation,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react'

import IncidentAnalyticsCards from './vehicle/IncidentAnalyticsCards'
import CollisionVehiclesTable from './vehicle/CollisionVehiclesTable'
import VehiclePathTable from './vehicle/VehiclePathTable'
import VehicleMap from './vehicle/VehicleMap'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getCameras,
  getVehicleIncidents,
  getVehicleTracking,
} from '../services/vehicleService'

const STORAGE_KEY_RECORDS = 'vision-iq-collision-records'
const STORAGE_KEY_INDEX = 'vision-iq-collision-queue-index'
const STORAGE_KEY_SELECTED = 'vision-iq-selected-vehicle-plate'

function readStoredCollisions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RECORDS)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // ignore parse error
  }
  return null
}

function readStoredIndex() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_INDEX)
    if (stored) {
      const val = parseInt(stored, 10)
      if (!isNaN(val)) return val
    }
  } catch {
    // ignore parse error
  }
  return 3
}

function readStoredSelectedPlate() {
  try {
    return localStorage.getItem(STORAGE_KEY_SELECTED) || null
  } catch {
    return null
  }
}

function buildIncidentCatalog(rows = []) {
  const byId = new Map()
  for (const row of rows) {
    if (!row.incidentId) continue
    let incident = byId.get(row.incidentId)
    if (!incident) {
      const impact = row.impact || {}
      const risk = row.risk || {}
      incident = {
        id: row.incidentId,
        title: row.incidentType || 'Road incident',
        severity: String(row.severity || 'Low').toUpperCase(),
        queueKm: Number(impact.maxQueueKm || 0),
        probability: Number(risk.score || 0),
        location: row.location || 'NH-44 Corridor',
        description: row.summary || row.incidentType || 'Incident reported on NH-44.',
        currentZone: row.location || 'NH-44 Corridor',
        upstream: 'Adjacent upstream zone',
        downstream: 'Adjacent downstream zone',
        affectedCameras: row.cameraId ? [row.cameraId] : [],
        affectedSegments: row.roadSegmentId ? [row.roadSegmentId] : [],
        categories: [row.incidentType || 'Incident'],
        zoneImpact: [{ zone: '', name: row.location || 'NH-44 Corridor', status: row.status || 'Reported', value: Number(risk.score || 0) }],
        impactBreakdown: [
          { name: 'Estimated delay', value: Math.min(Number(impact.estimatedDelayMin || 0), 100), displayValue: `${Number(impact.estimatedDelayMin || 0)} min` },
          { name: 'Traffic flow reduction', value: Number(impact.trafficFlowReductionPct || 0), displayValue: `${Number(impact.trafficFlowReductionPct || 0)}%` },
          { name: 'Affected lanes', value: Math.min(Number(row.lanesBlocked || 0) * 25, 100), displayValue: `${Number(row.lanesBlocked || 0)} lanes` },
        ],
        involvedVehicles: [],
        status: row.status,
        riskProfile: risk,
        impactAnalysis: impact,
      }
      byId.set(row.incidentId, incident)
    }
    if (row.vehicleNumber && row.vehicleNumber !== 'N/A') {
      incident.involvedVehicles.push({ plate: row.vehicleNumber, type: row.vehicleType, role: row.involvementRole })
    }
  }

  return [...byId.values()].map((incident) => ({
    ...incident,
    categories: [...incident.categories, `${incident.involvedVehicles.length} linked vehicle${incident.involvedVehicles.length === 1 ? '' : 's'}`],
  }))
}

export default function VehicleInformation() {
  const location = useLocation()
  const navigate = useNavigate()
  const defaultIncidentCatalog = [
    {
      id: 'ACC-401',
      title: 'NH-44 / Kurnool Incident',
      severity: 'HIGH',
      queueKm: 3.2,
      probability: 87,
      location: 'NH-44 / Kurnool',
      currentZone: 'ZONE 04 — Kurnool',
      upstream: 'ZONE 03 — Kothakota',
      downstream: 'ZONE 05 — Dhone',
      affectedCameras: ['CAM-401', 'CAM-402', 'CAM-403', 'CAM-404'],
      affectedSegments: ['RS-401', 'RS-402'],
      categories: ['CONGESTION', 'ACCIDENT', 'ROAD WORK', 'LANE CLOSURE', 'BLACK SPOT'],
      description: 'Severe congestion triggered by a major accident impact along the Kurnool corridor with a queue extending into the upstream zone.',
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
    {
      id: 'ACC-402',
      title: 'Jadcherla Black Spot',
      severity: 'MEDIUM',
      queueKm: 1.4,
      probability: 61,
      location: 'Jadcherla / NH-44',
      currentZone: 'ZONE 02 — Jadcherla',
      upstream: 'ZONE 02 — Farukhnagar',
      downstream: 'ZONE 03 — Kothakota',
      affectedCameras: ['CAM-201', 'CAM-202', 'CAM-203'],
      affectedSegments: ['RS-201', 'RS-202'],
      categories: ['BLACK SPOT', 'CONGESTION', 'WEATHER', 'ROAD CONDITION'],
      description: 'Recurring speed instability and vehicle weaving around the Farukhnagar–Jadcherla black-spot corridor increase collision risk.',
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
    {
      id: 'ACC-403',
      title: 'Dhone Junction Merge',
      severity: 'MEDIUM',
      queueKm: 1.8,
      probability: 68,
      location: 'Dhone / NH-44 Junction',
      currentZone: 'ZONE 05 — Dhone',
      upstream: 'ZONE 04 — Kurnool',
      downstream: 'ZONE 06 — Gooty',
      affectedCameras: ['CAM-301', 'CAM-302', 'CAM-303'],
      affectedSegments: ['RS-301', 'RS-302'],
      categories: ['JUNCTION', 'HEAVY VEHICLE', 'URBAN MERGE', 'CONGESTION'],
      description: 'Dense lane merging around the Dhone junction is increasing heavy-vehicle interaction and lower-speed queueing.',
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
    {
      id: 'ACC-404',
      title: 'Penukonda Toll Node Delay',
      severity: 'LOW',
      queueKm: 0.9,
      probability: 45,
      location: 'Penukonda / Toll Plaza',
      currentZone: 'ZONE 08 — Penukonda',
      upstream: 'ZONE 07 — Gooty',
      downstream: 'ZONE 09 — Bagepalli',
      affectedCameras: ['CAM-401', 'CAM-402'],
      affectedSegments: ['RS-401', 'RS-402'],
      categories: ['TOLL PLAZA', 'LANE CLOSURE', 'CONGESTION', 'ROAD WORK'],
      description: 'Toll plaza approach queues build as stop-and-go traffic begins to merge with highway flow near Penukonda.',
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
  ]

  const [databaseIncidentCatalog, setDatabaseIncidentCatalog] = useState([])

  const triggeredIncident = useMemo(() => {
    const stateIncident = location.state?.trafficIncident || null
    if (!stateIncident) return null
    const catalogIncident = [...databaseIncidentCatalog, ...defaultIncidentCatalog].find((incident) => incident.id === stateIncident.id)
    return catalogIncident ? { ...catalogIncident, ...stateIncident } : stateIncident
  }, [location.state, defaultIncidentCatalog, databaseIncidentCatalog])

  const incidentCatalog = useMemo(() => {
    const routeCatalog = Array.isArray(location.state?.incidentCatalog)
      ? location.state.incidentCatalog
      : []
    const merged = [...routeCatalog, ...databaseIncidentCatalog, ...defaultIncidentCatalog]
    const unique = merged.filter(
      (incident, index, list) => list.findIndex((item) => item.id === incident.id) === index,
    )
    return unique.length ? unique : defaultIncidentCatalog
  }, [location.state, defaultIncidentCatalog, databaseIncidentCatalog])

  const [activeIncidentTab, setActiveIncidentTab] = useState('overview')

  const selectedTrafficIncident = useMemo(() => {
    return triggeredIncident || incidentCatalog[0] || null
  }, [incidentCatalog, triggeredIncident])

  const incidentTabs = ['overview', 'impact', 'cameras', 'risk', 'analytics']

  const [cameras, setCameras] = useState([])
  const [allCollisions, setAllCollisions] = useState([])
  const [displayedCollisions, setDisplayedCollisions] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [newlyAddedPlate, setNewlyAddedPlate] = useState(null)
  const [searchValue, setSearchValue] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  const nextQueueIndexRef = useRef(readStoredIndex())

  useEffect(() => {
    Promise.all([getVehicleIncidents(), getCameras()]).then(
      ([incidentData, cameraData]) => {
        const loadedVehicles = incidentData || []
        setDatabaseIncidentCatalog(buildIncidentCatalog(loadedVehicles))
        setCameras(cameraData || [])

        // Filter all collision / accident / fire vehicles
        const collisions = loadedVehicles.filter((v) =>
          /collision|accident|fire/i.test(v.incidentType || '') ||
          /collision|accident/i.test(v.summary || '') ||
          v.observations?.some((o) => /collision|accident/i.test(o.detectionType || ''))
        )

        setAllCollisions(collisions)

        const activeList = collisions.slice(0, 3)
        setDisplayedCollisions(activeList)
        try {
          localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(activeList))
          localStorage.setItem(STORAGE_KEY_INDEX, String(activeList.length))
        } catch {}
        nextQueueIndexRef.current = activeList.length

        // Restore selected vehicle if previously saved, otherwise pick first
        const savedPlate = readStoredSelectedPlate()
        const matchedSaved = activeList.find((v) => v.vehicleNumber === savedPlate)
        setSelectedVehicle(matchedSaved || activeList[0] || collisions[0] || null)
      }
    )
  }, [])

  // Periodically add 1 new record after some time (every 25 seconds) without lag
  // And persist to localStorage so data is NEVER lost when switching pages or refreshing!
  useEffect(() => {
    if (!allCollisions.length) return undefined

    const intervalTimer = setInterval(() => {
      const nextIdx = nextQueueIndexRef.current
      if (nextIdx < allCollisions.length) {
        const newVehicle = allCollisions[nextIdx]
        const updatedIdx = nextIdx + 1
        nextQueueIndexRef.current = updatedIdx

        setDisplayedCollisions((prev) => {
          if (prev.some((v) => v.vehicleNumber === newVehicle.vehicleNumber)) {
            return prev
          }
          const updated = [newVehicle, ...prev].slice(0, 8)
          try {
            localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(updated))
            localStorage.setItem(STORAGE_KEY_INDEX, String(updatedIdx))
          } catch {}
          return updated
        })

        // Flash NEW ALERT badge for 5 seconds
        setNewlyAddedPlate(newVehicle.vehicleNumber)
        setTimeout(() => {
          setNewlyAddedPlate(null)
        }, 5000)
      }
    }, 25000)

    return () => clearInterval(intervalTimer)
  }, [allCollisions])

  async function handleSearch(e) {
    if (e?.preventDefault) e.preventDefault()
    const query = searchValue.trim()
    if (!query) return

    setSearchLoading(true)
    try {
      const match = await getVehicleTracking(query)
      if (match) {
        handleVehicleSelect(match)
        setDisplayedCollisions((prev) => {
          if (prev.some((v) => v.vehicleNumber === match.vehicleNumber)) return prev
          const updated = [match, ...prev]
          try {
            localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(updated))
          } catch {}
          return updated
        })
      }
    } finally {
      setSearchLoading(false)
    }
  }

  function handleVehicleSelect(vehicle) {
    setSelectedVehicle(vehicle)
    try {
      localStorage.setItem(STORAGE_KEY_SELECTED, vehicle.vehicleNumber)
    } catch {}
  }

  function handleResetStoredData() {
    try {
      localStorage.removeItem(STORAGE_KEY_RECORDS)
      localStorage.removeItem(STORAGE_KEY_INDEX)
      localStorage.removeItem(STORAGE_KEY_SELECTED)
    } catch {}
    const initialFew = allCollisions.slice(0, 3)
    setDisplayedCollisions(initialFew)
    setSelectedVehicle(initialFew[0] || null)
    nextQueueIndexRef.current = 3
  }

  return (
    <main className="vehicle-clean-page">
      {triggeredIncident && (
        <div className="traffic-trigger-banner" style={{
          marginBottom: '16px',
          padding: '14px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(251,146,60,0.08))',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.12em', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase' }}>
              Triggered from Traffic Flow
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px' }}>{triggeredIncident.title}</div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
              {triggeredIncident.location} · {triggeredIncident.severity} severity · {triggeredIncident.queueKm} km queue
            </div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7f1d1d', background: 'rgba(254,226,226,0.8)', borderRadius: '999px', padding: '7px 10px' }}>
            {triggeredIncident.currentZone}
          </div>
        </div>
      )}

      {selectedTrafficIncident && (
        <section className="incident-control-center">
          <div className={`incident-detail-panel severity-${selectedTrafficIncident.severity?.toLowerCase() || 'low'}`}>
            <header className="incident-detail-heading">
              <div>
                <div className="incident-heading-kicker">Incident intelligence / {selectedTrafficIncident.id}</div>
                <h2>{selectedTrafficIncident.title}</h2>
              </div>
              <div className="incident-live-status">
                <span className="incident-live-dot" />
                Monitoring
              </div>
            </header>

            <div className="incident-subtabs" role="tablist" aria-label="Incident details">
              {incidentTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeIncidentTab === tab}
                  className={`incident-subtab ${activeIncidentTab === tab ? 'is-active' : ''}`}
                  onClick={() => setActiveIncidentTab(tab)}
                >
                  {tab === 'risk' ? 'Risk profile' : tab}
                </button>
              ))}
            </div>

            {activeIncidentTab === 'overview' && (
            <section className="incident-expanded-section" aria-label="Incident overview">
              <div className="incident-overview-grid">
                <div className="incident-overview-copy">
                  <div className="incident-metric-label">Corridor event summary</div>
                  <p>{selectedTrafficIncident.description}</p>
                  <div className="incident-location-line"><Radio size={15} /> {selectedTrafficIncident.location}</div>
                  {selectedTrafficIncident.involvedVehicles?.length > 0 && (
                    <div className="incident-involved-vehicles">
                      <div className="incident-metric-label">Involved vehicle plates</div>
                      <div className="incident-token-list">
                        {selectedTrafficIncident.involvedVehicles.map((vehicle) => (
                          <span className="incident-token segment-token" key={`${selectedTrafficIncident.id}-${vehicle.plate}`}>
                            {vehicle.plate}{vehicle.type ? ` · ${vehicle.type}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="incident-kpi-grid">
                  <div className="incident-mini-kpi">
                    <span>Severity</span>
                    <strong className={`incident-severity-text severity-${selectedTrafficIncident.severity?.toLowerCase() || 'low'}`}>{selectedTrafficIncident.severity}</strong>
                  </div>
                  <div className="incident-mini-kpi">
                    <span>Queue length</span>
                    <strong>{selectedTrafficIncident.queueKm} <small>km</small></strong>
                  </div>
                  <div className="incident-mini-kpi">
                    <span>Modeled occurrence risk</span>
                    <strong>{selectedTrafficIncident.probability || 0}<small>%</small></strong>
                  </div>
                  <div className="incident-mini-kpi">
                    <span>Segment speed</span>
                    <strong>{selectedTrafficIncident.corridorSpeed ?? 42}<small>km/h</small></strong>
                  </div>
                </div>
              </div>
            </section>
            )}

            {activeIncidentTab === 'impact' && (
            <section className="incident-expanded-section" aria-label="Incident impact">
              <div className="incident-data-grid">
                <div className="incident-data-column">
                  <div className="incident-metric-label">Affected zones</div>
                  <div className="incident-data-list">
                    {(selectedTrafficIncident.zoneImpact || []).map((zone) => (
                      <div key={`${selectedTrafficIncident.id}-${zone.zone}-${zone.name}`} className="incident-data-row">
                        <div className="incident-data-row-heading">
                          <span>Zone {zone.zone} — {zone.name}</span>
                          <strong>{zone.value}%</strong>
                        </div>
                        <div className="incident-progress-track">
                          <div className={`incident-progress-fill ${zone.status.includes('Severe') ? 'is-critical' : ''}`} style={{ width: `${zone.value}%` }} />
                        </div>
                        <div className="incident-row-caption">{zone.status}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="incident-data-column">
                  <div className="incident-metric-label">Primary drivers</div>
                  <div className="incident-data-list">
                    {(selectedTrafficIncident.impactBreakdown || []).map((entry, index) => (
                      <div key={`${selectedTrafficIncident.id}-${entry.name}`} className="incident-data-row">
                        <div className="incident-data-row-heading">
                          <span>{entry.name}</span>
                          <strong>{entry.displayValue || `${entry.value}%`}</strong>
                        </div>
                        <div className="incident-progress-track">
                          <div className={`incident-progress-fill driver-color-${index % 5}`} style={{ width: `${Math.min(100, Math.max(0, Number(entry.value) || 0))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            )}

            {activeIncidentTab === 'cameras' && (
            <section className="incident-expanded-section" aria-label="Affected cameras and segments">
              <div className="incident-data-grid">
                <div className="incident-data-column">
                  <div className="incident-metric-label">Affected cameras</div>
                  <div className="incident-token-list">
                    {(selectedTrafficIncident.affectedCameras || []).map((camera) => (
                      <button
                        key={`${selectedTrafficIncident.id}-${camera}`}
                        className="incident-token camera-token incident-camera-link"
                        type="button"
                        onClick={() => navigate('/dashboards/cameras', {
                          state: { selectedCameraId: camera, incidentId: selectedTrafficIncident.id },
                        })}
                        title={`Open ${camera} in Camera Network`}
                      >
                        {camera}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="incident-data-column">
                  <div className="incident-metric-label">Affected segments</div>
                  <div className="incident-token-list">
                    {(selectedTrafficIncident.affectedSegments || []).map((segment) => (
                      <span key={`${selectedTrafficIncident.id}-${segment}`} className="incident-token segment-token">{segment}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            )}

            {activeIncidentTab === 'risk' && (
            <section className="incident-expanded-section" aria-label="Incident risk profile">
              <div className="incident-risk-grid">
                <div className="incident-zone-card current-zone">
                  <div className="incident-metric-label">Current zone</div>
                  <div>{selectedTrafficIncident.currentZone}</div>
                </div>
                <div className="incident-zone-card">
                  <div className="incident-metric-label">Upstream</div>
                  <div>{selectedTrafficIncident.upstream}</div>
                </div>
                <div className="incident-zone-card">
                  <div className="incident-metric-label">Downstream</div>
                  <div>{selectedTrafficIncident.downstream}</div>
                </div>
              </div>
              {selectedTrafficIncident.riskProfile && (
                <div className="incident-data-grid">
                  <div className="incident-data-column">
                    <div className="incident-metric-label">Risk score</div>
                    <div className="incident-zone-card current-zone">
                      <strong>{selectedTrafficIncident.riskProfile.score}/100 · {selectedTrafficIncident.riskProfile.category}</strong>
                    </div>
                  </div>
                  <div className="incident-data-column">
                    <div className="incident-metric-label">Contributing factors</div>
                    <p>{selectedTrafficIncident.riskProfile.contributingFactors || 'No risk factors recorded.'}</p>
                    <div className="incident-metric-label">Recommended action</div>
                    <p>{selectedTrafficIncident.riskProfile.recommendedAction || 'No action recommendation recorded.'}</p>
                  </div>
                </div>
              )}
            </section>
            )}

            {activeIncidentTab === 'analytics' && (
            <section className="incident-expanded-section incident-analytics-section" aria-label="Incident analytics">
                <IncidentAnalyticsCards incident={selectedTrafficIncident} />
            </section>
            )}
          </div>
        </section>
      )}

      {/* 1. HEADER */}
      <header className="vehicle-clean-header">
        <div className="clean-header-title">
          <div className="clean-kicker">
            <span>VISION IQ</span> <i>/</i> <span>NH-44 HIGHWAY CORRIDOR</span> <i>/</i> <span>SURVEILLANCE</span>
          </div>
          <h1>Vehicle Journey & Incident Intelligence</h1>
          <p>
            Real-time radar detections, collision tracking, and highway ANPR checkpoint trajectory.
          </p>
        </div>

        <div className="clean-header-actions">
          <div className="live-radar-badge">
            <span className="live-pulse-green" />
            <span>NH-44 RADAR ACTIVE</span>
          </div>

          <form onSubmit={handleSearch} className="clean-search-form">
            <Search size={14} className="clean-search-icon" />
            <input
              type="text"
              placeholder="Search vehicle plate (e.g. MP44, TS09)..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {searchValue && (
              <button
                type="button"
                className="clean-search-clear"
                onClick={() => setSearchValue('')}
              >
                ×
              </button>
            )}
            <button type="submit" className="clean-search-submit" disabled={searchLoading}>
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </form>

          <button
            type="button"
            className="clean-reset-btn"
            onClick={handleResetStoredData}
            title="Reset collision stream cache"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </header>

      {/* 2. COLLISION VEHICLE REGISTRY */}
      <section className="clean-collision-section" aria-label="Collision Vehicles Registry">
        <CollisionVehiclesTable
          vehicles={displayedCollisions}
          selectedVehicle={selectedVehicle}
          onSelectVehicle={handleVehicleSelect}
          newlyAddedPlate={newlyAddedPlate}
        />
      </section>

      {/* 4. BELOW THIS: VEHICLE TRACK IN LEFT AND MAP IN RIGHT */}
      <section className="clean-track-and-map-grid" aria-label="Vehicle Traversal and Highway Map">
        {/* LEFT COLUMN: VEHICLE TRACK (PATH FOLLOWED BY SELECTED VEHICLE) */}
        <div className="track-grid-left">
          <VehiclePathTable
            vehicle={selectedVehicle}
            onSelectCheckpoint={() => {}}
          />
        </div>

        {/* RIGHT COLUMN: THE MAP (WITHOUT THE PART BELOW THE MAP) */}
        <div className="track-grid-right">
          <VehicleMap
            cameras={cameras}
            vehicle={selectedVehicle}
            showCameraJourney={false}
          />
        </div>
      </section>
    </main>
  )
}
