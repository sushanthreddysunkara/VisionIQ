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

export default function VehicleInformation() {
  const [cameras, setCameras] = useState([])
  const [allCollisions, setAllCollisions] = useState([])
  const [displayedCollisions, setDisplayedCollisions] = useState(() => readStoredCollisions() || [])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [newlyAddedPlate, setNewlyAddedPlate] = useState(null)
  const [searchValue, setSearchValue] = useState('')
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
