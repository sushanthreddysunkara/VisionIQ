import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bus,
  Car,
  CarFront,
  Flame,
  Layers,
  MapPinned,
  ShieldCheck,
  Target,
  Truck,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import VehicleList from './vehicle/VehicleList'
import { useEffect, useRef, useState } from 'react'
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

export default function VehicleInformation({ rows = [], dbStats = null }) {
  const [vehicles, setVehicles] = useState([])
export default function VehicleInformation() {
  const [cameras, setCameras] = useState([])
  const [allCollisions, setAllCollisions] = useState([])
  const [displayedCollisions, setDisplayedCollisions] = useState(() => readStoredCollisions() || [])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [newlyAddedPlate, setNewlyAddedPlate] = useState(null)
  const [searchValue, setSearchValue] = useState('')
  const [searched, setSearched] = useState(false)
  const [selectedPairing, setSelectedPairing] = useState('All')

  useEffect(() => {
    if (rows && rows.length > 0) {
      const liveVehicles = rows.map((r, idx) => {
        const plate = r.vehicleNumberPlate || r.numberPlate || r.id || `OBS-${idx + 1}`
        const isOver = r.isOverSpeed || r.overSpeed === 'Yes' || Number(r.speed) > Number(r.speedLimit || 60)
        return {
          vehicleNumber: plate,
          vehicleType: r.vehicleType || r.type || 'Car',
          incidentType: isOver ? 'Speed Violation' : (r.events || 'Corridor Telemetry'),
          incidentTime: r.timestampIst || r.timestamp || 'Live',
          collisionCamera: r.camera || 'CAM-NH44-01-SHAMSHABAD',
          status: isOver ? 'Tracking' : 'Detected',
          observations: [
            {
              cameraId: r.camera || 'CAM-NH44-01-SHAMSHABAD',
              timestamp: r.timestampIst || r.timestamp || 'Live',
              latitude: Number(r.latitude) || 17.385044,
              longitude: Number(r.longitude) || 78.486671,
              location: r.location || r.roadName || 'NH-44 Corridor',
              detectionType: isOver ? 'Overspeeding Alert' : 'Vehicle Detected',
              confidence: Number(r.plateConfidence || 0.95),
              imageUrl: r.vehicleImagePath || r.vehicleImage,
              speed: r.speed,
              speedLimit: r.speedLimit || 60,
            },
          ],
        }
      })
      setVehicles(liveVehicles)
      setSelectedVehicle((prev) => prev || liveVehicles[0] || null)
    } else {
      Promise.all([getVehicleIncidents(), getCameras()]).then(([incidentData, cameraData]) => {
        if (incidentData && incidentData.length) {
          setVehicles(incidentData)
          setSelectedVehicle((prev) => prev || incidentData[0] || null)
        }
        if (cameraData && cameraData.length) setCameras(cameraData)
      })
    }
  }, [rows])

  useEffect(() => {
    getCameras().then((cameraData) => {
      if (cameraData && cameraData.length) setCameras(cameraData)
    })
  }, [])
  const [searchLoading, setSearchLoading] = useState(false)

  const nextQueueIndexRef = useRef(readStoredIndex())

  useEffect(() => {
    Promise.all([getVehicleIncidents(), getCameras()]).then(
      ([incidentData, cameraData]) => {
        const loadedVehicles = incidentData || []
        setCameras(cameraData || [])

        // Filter all collision / accident / fire vehicles
        const collisions = loadedVehicles.filter((v) =>
          /collision|accident|fire/i.test(v.incidentType || '') ||
          /collision|accident/i.test(v.summary || '') ||
          v.observations?.some((o) => /collision|accident/i.test(o.detectionType || ''))
        )

        setAllCollisions(collisions)

        // If records were already stored in localStorage, preserve them!
        const existingStored = readStoredCollisions()
        let activeList = existingStored

        if (!activeList || activeList.length === 0) {
          // Initialize with first 3 records on very first load
          activeList = collisions.slice(0, 3)
          setDisplayedCollisions(activeList)
          try {
            localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(activeList))
            localStorage.setItem(STORAGE_KEY_INDEX, '3')
          } catch {}
          nextQueueIndexRef.current = 3
        } else {
          setDisplayedCollisions(activeList)
        }

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
    if (!query) {
      setSearched(false)
      setSelectedVehicle(vehicles[0] || null)
      return
    }
    // Search local rows first for instant match
    const localMatch = vehicles.find((v) =>
      v.vehicleNumber.toLowerCase().includes(query.toLowerCase())
    )
    if (localMatch) {
      setSelectedVehicle(localMatch)
      setSearched(true)
      return
    }
    const vehicle = await getVehicleTracking(query)
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

  function clearSearch() {
    setSearchValue('')
    setSearched(false)
    setSelectedVehicle(vehicles[0] || null)
  }

  const trackedCount = vehicles.filter((vehicle) => vehicle.status === 'Tracking').length
  const collisionVehicles = vehicles.filter((vehicle) => /collision|accident|violation|speed/i.test(vehicle.incidentType))
  const collisionCount = collisionVehicles.length || (dbStats?.overspeedTotal ? dbStats.overspeedTotal : 14)
  const collisionTypes = ['Car', 'Bike', 'Auto', 'Bus', 'Truck'].map((type) => ({
    type,
    count: collisionVehicles.filter((vehicle) => vehicle.vehicleType === type).length,
  }))
  const chartColors = { Car: '#3978db', Bike: '#2b9c7b', Auto: '#d98a43', Bus: '#8a63c7', Truck: '#d94d58' }
  const maxCollisionCount = Math.max(...collisionTypes.map((item) => item.count), 1)
  const vehicleIcon = { Car, Bike: CarFront, Auto: CarFront, Bus, Truck }

  // Collision Combination Matrix Data
  const collisionCombinations = [
    { pair: 'Truck ↔ Car', primary: 'Truck', secondary: 'Car', count: 14, severity: 'High', color: '#d94d58', desc: 'Highway high-speed rear-end impact during lane merging' },
    { pair: 'Bus ↔ Auto', primary: 'Bus', secondary: 'Auto', count: 8, severity: 'Critical', color: '#dc2626', desc: 'Interchange side-swipe collision at toll approach' },
    { pair: 'Car ↔ Bike', primary: 'Car', secondary: 'Bike', count: 11, severity: 'Moderate', color: '#d98a43', desc: 'Queue tailback collision at Raikal Toll Plaza' },
    { pair: 'Multi-Vehicle Pileup', primary: 'Multi', secondary: '3+ Vehicles', count: 5, severity: 'Extreme', color: '#7c3aed', desc: 'Corridor fog morning pileup on NH-44 KM 58' },
    { pair: 'Truck ↔ LCV', primary: 'Truck', secondary: 'LCV', count: 6, severity: 'High', color: '#e11d48', desc: 'Night shift fast overtaking impact' },
  ]

  const filteredVehicles = selectedPairing === 'All'
    ? vehicles
    : vehicles.filter((v) => {
        if (selectedPairing === 'Truck ↔ Car') return v.vehicleType === 'Truck' || v.vehicleType === 'Car'
        if (selectedPairing === 'Bus ↔ Auto') return v.vehicleType === 'Bus' || v.vehicleType === 'Auto'
        if (selectedPairing === 'Car ↔ Bike') return v.vehicleType === 'Car' || v.vehicleType === 'Bike'
        return true
      })

  return (
    <div className="vehicle-information-page">
      <div className="page-intro vehicle-information-intro">
        <div>
          <p className="section-kicker">VEHICLE FORENSICS &amp; INCIDENT MATRIX</p>
          <h1>Vehicle Tracking &amp; Incident Intelligence</h1>
          <p className="intro-copy">
            Trace collision vehicles across the camera network, reconstruct movement, and analyze multi-vehicle collision combinations.
          </p>
        </div>
        <div className="vehicle-hero-mark">
          <CarFront size={26} />
        </div>
      </div>

      <VehicleSearch onChange={setSearchValue} onClear={clearSearch} onSubmit={handleSearch} value={searchValue} />

      {searched && !selectedVehicle ? (
        <div className="vehicle-empty-state">
          <AlertTriangle size={28} />
          <h2>No vehicle found</h2>
          <p>
            No tracking information is available for <strong>{searchValue}</strong>.
          </p>
          <button className="secondary-action" onClick={clearSearch} type="button">
            Back to all vehicles
          </button>
        </div>
      ) : (
        <>
          <div className="vehicle-stat-grid">
            <div>
              <span>
                <AlertTriangle size={15} />
                Total incidents
              </span>
              <strong>{collisionCount}</strong>
              <small>Across the camera network</small>
            </div>
            <div>
              <span>
                <Target size={15} />
                Vehicles tracked
              </span>
              <strong>{trackedCount}</strong>
              <small>Cases with an active route</small>
            </div>
            <div>
              <span>
                <MapPinned size={15} />
                Cameras online
              </span>
              <strong>{cameras.filter((camera) => camera.status === 'Active').length}</strong>
              <small>Operational sources</small>
            </div>
            <div>
              <span>
                <ShieldCheck size={15} />
                Network confidence
              </span>
              <strong>94.2%</strong>
              <small>Average detection quality</small>
            </div>
          </div>

          {/* ── COLLISION COMBINATION & INCIDENT MATRIX PANEL ── */}
          <div className="vehicle-panel" style={{ padding: '20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <div className="vehicle-panel-heading" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p className="section-kicker" style={{ color: '#dc2626', fontWeight: '800' }}>INCIDENT PAIRING MATRIX</p>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Multi-Vehicle Collision Combinations</h2>
              </div>
              <span style={{ fontSize: '12px', background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '20px', fontWeight: '700', border: '1px solid #fecdd3' }}>
                <Flame size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                44 Active Corridor Collision Records
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              {collisionCombinations.map((combo) => {
                const isSelected = selectedPairing === combo.pair
                return (
                  <div
                    key={combo.pair}
                    onClick={() => setSelectedPairing(isSelected ? 'All' : combo.pair)}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: `2px solid ${isSelected ? combo.color : '#e2e8f0'}`,
                      background: isSelected ? `${combo.color}0d` : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? `0 4px 12px ${combo.color}25` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#1e293b' }}>{combo.pair}</strong>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: `${combo.color}20`,
                          color: combo.color,
                        }}
                      >
                        {combo.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: combo.color, marginBottom: '4px' }}>
                      {combo.count} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>cases</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                      {combo.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <section className="collision-intelligence-grid">
            <div className="vehicle-panel collision-chart-panel">
              <div className="vehicle-panel-heading">
                <div>
                  <p className="section-kicker">COLLISION PROFILE</p>
                  <h2>Vehicles by type</h2>
                </div>
                <span>
                  <BarChart3 size={14} />
                  {collisionCount} cases
                </span>
              </div>
              <div className="collision-bars">
                {collisionTypes.map((item) => {
                  const Icon = vehicleIcon[item.type]
                  return (
                    <div className="collision-bar-row" key={item.type}>
                      <span className="collision-bar-label">
                        <Icon size={16} />
                        {item.type}
                      </span>
                      <div className="collision-bar-track">
                        <i style={{ width: `${(item.count / maxCollisionCount) * 100}%`, background: chartColors[item.type] }} />
                      </div>
                      <strong>{item.count}</strong>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="vehicle-panel collision-donut-panel">
              <div className="vehicle-panel-heading">
                <div>
                  <p className="section-kicker">INCIDENT MIX</p>
                  <h2>Collision distribution</h2>
                </div>
              </div>
              <div className="collision-donut">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      data={collisionTypes.filter((item) => item.count)}
                      dataKey="count"
                      innerRadius={48}
                      nameKey="type"
                      outerRadius={74}
                      paddingAngle={4}
                    >
                      {collisionTypes
                        .filter((item) => item.count)
                        .map((item) => (
                          <Cell fill={chartColors[item.type]} key={item.type} />
                        ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <strong>{collisionCount}</strong>
                <span>incidents</span>
              </div>
              <div className="collision-legend">
                {collisionTypes.map((item) => (
                  <span key={item.type}>
                    <i style={{ background: chartColors[item.type] }} />
                    {item.type}
                    <b>{item.count}</b>
                  </span>
                ))}
              </div>
            </div>

            <div className="vehicle-panel collision-column-panel">
              <div className="vehicle-panel-heading">
                <div>
                  <p className="section-kicker">COMPARISON VIEW</p>
                  <h2>Collision count chart</h2>
                </div>
              </div>
              <div className="collision-recharts">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={collisionTypes} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                    <XAxis axisLine={false} dataKey="type" tick={{ fill: '#71807a', fontSize: 10 }} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tick={{ fill: '#71807a', fontSize: 10 }} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {collisionTypes.map((item) => (
                        <Cell fill={chartColors[item.type]} key={item.type} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {!searched && (
            <VehicleList
              onSelect={setSelectedVehicle}
              selectedVehicle={selectedVehicle}
              vehicles={filteredVehicles}
            />
          )}

          {selectedVehicle && (
            <div className="vehicle-detail-layout">
              <div className="vehicle-detail-column">
                <button
                  className="vehicle-back-button"
                  onClick={() => {
                    setSearched(false)
                    setSelectedVehicle(null)
                  }}
                  type="button"
                >
                  <ArrowLeft size={15} />
                  Back to all vehicles
                </button>
                <VehicleSummary vehicle={selectedVehicle} />
                <VehicleTimeline vehicle={selectedVehicle} />
              </div>
              <VehicleMap cameras={cameras} vehicle={selectedVehicle} />
            </div>
          )}
        </>
      )}
    </div>
  return (
    <main className="vehicle-clean-page">
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

      {/* 2. AT TOP: ANALYTICS GRAPH PART (UPDATES DYNAMICALLY WITH VEHICLE DATA) */}
      <section className="clean-analytics-section" aria-label="Incident Analytics">
        <IncidentAnalyticsCards vehicles={displayedCollisions} />
      </section>

      {/* 3. THEN: TABLE OF VEHICLE (COLLISION VEHICLES TABLE) */}
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
