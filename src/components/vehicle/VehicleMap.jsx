import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Camera,
  CarFront,
  Clock3,
  LocateFixed,
  MapPinned,
  Maximize2,
  Minimize2,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import {
  getHighwayRouteForObservations,
  NH44_HIGHWAY_WAYPOINTS,
  sortObservationsChronologically,
} from '../../data/vehicleTrackingData'
import 'leaflet/dist/leaflet.css'

const cameraPinIcon = divIcon({
  html: `<span class="vehicle-camera-pin">${renderToStaticMarkup(<Camera size={17} strokeWidth={2.4} />)}</span>`,
  className: 'vehicle-map-div-icon',
  iconSize: [34, 40],
  iconAnchor: [17, 37],
})

const incidentCameraPinIcon = divIcon({
  html: `<span class="vehicle-camera-pin is-incident">${renderToStaticMarkup(<Camera size={17} strokeWidth={2.4} />)}</span>`,
  className: 'vehicle-map-div-icon',
  iconSize: [34, 40],
  iconAnchor: [17, 37],
})

const pendingCameraPinIcon = divIcon({
  html: `<span class="vehicle-camera-pin is-pending">${renderToStaticMarkup(<Camera size={16} strokeWidth={2.4} />)}</span>`,
  className: 'vehicle-map-div-icon',
  iconSize: [34, 40],
  iconAnchor: [17, 37],
})

const carPinIcon = divIcon({
  html: `<span class="vehicle-car-pin">${renderToStaticMarkup(<CarFront size={21} strokeWidth={2.4} />)}</span>`,
  className: 'vehicle-map-div-icon',
  iconSize: [42, 46],
  iconAnchor: [21, 42],
})

function RouteViewport({ currentPoint, vehicleKey }) {
  const map = useMap()

  useEffect(() => {
    if (currentPoint) map.setView(currentPoint, map.getZoom(), { animate: true })
  }, [map, vehicleKey, currentPoint?.[0], currentPoint?.[1]])

  return null
}

function MapResizeHandler() {
  const map = useMap()

  useEffect(() => {
    function refreshMapSize() {
      window.requestAnimationFrame(() => map.invalidateSize())
    }
    document.addEventListener('fullscreenchange', refreshMapSize)
    return () => document.removeEventListener('fullscreenchange', refreshMapSize)
  }, [map])

  return null
}

function MapControls({ points }) {
  const map = useMap()

  function focusRoute() {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [42, 42], maxZoom: 13, animate: true })
    } else if (points.length === 1) {
      map.setView(points[0], 13, { animate: true })
    }
  }

  return (
    <div className="vehicle-route-controls" aria-label="Map controls">
      <button type="button" onClick={() => map.zoomIn()} title="Zoom in" aria-label="Zoom in">+</button>
      <button type="button" onClick={() => map.zoomOut()} title="Zoom out" aria-label="Zoom out">−</button>
      <span />
      <button type="button" onClick={focusRoute} title="Fit full route" aria-label="Fit full route">
        <LocateFixed size={16} />
      </button>
    </div>
  )
}

export default function VehicleMap({ vehicle, cameras = [], showCameraJourney = false }) {
  const panelRef = useRef(null)
  const observations = Array.isArray(vehicle?.observations) ? vehicle.observations : []
  const validObservations = sortObservationsChronologically(observations.filter(
    (observation) => Number.isFinite(Number(observation.latitude)) && Number.isFinite(Number(observation.longitude))
  ))
  const [activeObservationIndex, setActiveObservationIndex] = useState(() => Math.max(validObservations.length - 1, 0))
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFollowing, setIsFollowing] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const route = getHighwayRouteForObservations(validObservations)
  const routePoints = route.length ? route : validObservations.map((observation) => [
    Number(observation.latitude),
    Number(observation.longitude),
  ])
  const boundedObservationIndex = Math.min(activeObservationIndex, Math.max(validObservations.length - 1, 0))
  const activeObservation = validObservations[boundedObservationIndex]
  const currentPoint = activeObservation
    ? [Number(activeObservation.latitude), Number(activeObservation.longitude)]
    : null
  const collisionObservation = validObservations.find((observation) =>
    /collision|accident/i.test(observation.detectionType || '') || observation.cameraId === vehicle?.collisionCamera
  )
  const collisionCameraId = vehicle?.collisionCamera || collisionObservation?.cameraId
  const cameraById = new Map(cameras.map((camera) => [camera.id, camera]))
  validObservations.forEach((observation) => {
    if (observation.cameraId && !cameraById.has(observation.cameraId)) {
      cameraById.set(observation.cameraId, {
        id: observation.cameraId,
        name: observation.location || observation.cameraId,
        location: observation.location,
        latitude: observation.latitude,
        longitude: observation.longitude,
      })
    }
  })
  const waypointOrder = new Map(
    NH44_HIGHWAY_WAYPOINTS.filter((waypoint) => waypoint.cameraId)
      .map((waypoint) => waypoint.cameraId)
      .filter((cameraId, index, cameraIds) => cameraIds.indexOf(cameraId) === index)
      .map((cameraId, index) => [cameraId, index])
  )
  const cameraStops = [...cameraById.values()].map((camera) => ({
    ...camera,
    observation: validObservations.find((observation) => observation.cameraId === camera.id),
  })).sort((left, right) => {
    if (left.observation && right.observation) {
      const leftTime = Date.parse(left.observation.timestamp || left.observation.timestampIst || '')
      const rightTime = Date.parse(right.observation.timestamp || right.observation.timestampIst || '')
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime
    }
    if (left.observation) return -1
    if (right.observation) return 1
    return (waypointOrder.get(left.id) ?? Infinity) - (waypointOrder.get(right.id) ?? Infinity)
  })

  useEffect(() => {
    setActiveObservationIndex(Math.max(validObservations.length - 1, 0))
    setIsPlaying(false)
    setIsFollowing(true)
  }, [vehicle?.vehicleNumber])

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === panelRef.current)
    }
    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  useEffect(() => {
    if (!isPlaying) return undefined
    if (boundedObservationIndex >= validObservations.length - 1) {
      setIsPlaying(false)
      return undefined
    }
    const timer = window.setTimeout(() => {
      setActiveObservationIndex((index) => Math.min(index + 1, validObservations.length - 1))
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [isPlaying, boundedObservationIndex, validObservations.length])

  async function toggleFullscreen() {
    if (!panelRef.current) return
    if (document.fullscreenElement === panelRef.current) {
      await document.exitFullscreen()
    } else {
      await panelRef.current.requestFullscreen()
    }
  }

  function togglePlayback() {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    if (boundedObservationIndex >= validObservations.length - 1) setActiveObservationIndex(0)
    setIsPlaying(validObservations.length > 1)
  }

  return (
    <section className="vehicle-panel vehicle-route-panel" ref={panelRef}>
      <header className="vehicle-route-header">
        <div>
          <p className="section-kicker">LIVE VEHICLE NAVIGATION</p>
          <h2><MapPinned size={18} /> NH-44 route</h2>
        </div>
        <div className="vehicle-route-header-actions">
          <span className="vehicle-route-plate"><Navigation size={13} /> {vehicle?.vehicleNumber || 'No vehicle selected'}</span>
          <button
            type="button"
            className="vehicle-map-action"
            onClick={() => setIsFollowing((following) => !following)}
            aria-pressed={isFollowing}
            title={isFollowing ? 'Stop following vehicle' : 'Follow vehicle during replay'}
          >
            <LocateFixed size={15} />
            {isFollowing ? 'Following' : 'Follow'}
          </button>
          <button
            type="button"
            className="vehicle-map-icon-action"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>

      <div className="vehicle-route-playback">
        <div className="vehicle-playback-buttons">
          <button
            type="button"
            onClick={() => { setIsPlaying(false); setActiveObservationIndex(0) }}
            disabled={!validObservations.length || boundedObservationIndex === 0}
            aria-label="First sighting"
            title="First sighting"
          ><SkipBack size={15} /></button>
          <button
            type="button"
            className="vehicle-play-toggle"
            onClick={togglePlayback}
            disabled={validObservations.length < 2}
            aria-label={isPlaying ? 'Pause route replay' : 'Play route replay'}
            title={isPlaying ? 'Pause route replay' : 'Play route replay'}
          >{isPlaying ? <Pause size={15} /> : <Play size={15} />}</button>
          <button
            type="button"
            onClick={() => { setIsPlaying(false); setActiveObservationIndex((index) => Math.min(index + 1, validObservations.length - 1)) }}
            disabled={!validObservations.length || boundedObservationIndex >= validObservations.length - 1}
            aria-label="Next sighting"
            title="Next sighting"
          ><SkipForward size={15} /></button>
        </div>
        <div className="vehicle-playback-track">
          <div className="vehicle-playback-caption">
            <strong>{activeObservation?.location || activeObservation?.cameraId || 'No vehicle sightings'}</strong>
            <span>
              <Clock3 size={12} />
              {activeObservation?.timestamp ? new Date(activeObservation.timestamp).toLocaleString() : 'No timestamp'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(validObservations.length - 1, 0)}
            value={boundedObservationIndex}
            onChange={(event) => { setIsPlaying(false); setActiveObservationIndex(Number(event.target.value)) }}
            disabled={validObservations.length < 2}
            aria-label="Select vehicle sighting"
          />
        </div>
        <span className="vehicle-playback-step">{validObservations.length ? boundedObservationIndex + 1 : 0} / {validObservations.length}</span>
      </div>

      <div className="vehicle-route-map-wrap">
        {routePoints.length ? (
          <MapContainer
            center={currentPoint || [17.35, 78.45]}
            zoom={12}
            scrollWheelZoom
            className="vehicle-route-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RouteViewport currentPoint={isFollowing ? currentPoint : null} vehicleKey={vehicle?.vehicleNumber} />
            <MapResizeHandler />
            <MapControls points={routePoints} />
            {routePoints.length > 1 && (
              <>
                <Polyline positions={routePoints} pathOptions={{ color: '#fff', weight: 10, opacity: 0.9 }} />
                <Polyline positions={routePoints} pathOptions={{ color: '#16856f', weight: 5, opacity: 0.95 }} />
              </>
            )}
            {cameraStops.map((camera) => {
              const latitude = Number(camera.latitude ?? camera.observation?.latitude)
              const longitude = Number(camera.longitude ?? camera.observation?.longitude)
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
              const isCollision = camera.id === collisionCameraId || /collision|accident/i.test(camera.observation?.detectionType || '')
              return (
                <Marker
                  key={camera.id}
                  position={[latitude, longitude]}
                  icon={isCollision ? incidentCameraPinIcon : camera.observation ? cameraPinIcon : pendingCameraPinIcon}
                >
                  <Tooltip direction="top" offset={[0, -32]}>
                    {camera.name || camera.location || camera.id}
                  </Tooltip>
                  <Popup>
                    <strong>{camera.name || camera.id}</strong><br />
                    {camera.observation ? camera.observation.detectionType || 'Vehicle detected' : 'No sighting recorded'}<br />
                    {camera.observation?.timestamp && new Date(camera.observation.timestamp).toLocaleString()}
                  </Popup>
                </Marker>
              )
            })}
            {currentPoint && (
              <Marker position={currentPoint} icon={carPinIcon} zIndexOffset={1000}>
                <Tooltip direction="top" offset={[0, -38]}>{vehicle?.vehicleNumber} · {boundedObservationIndex === validObservations.length - 1 ? 'Latest position' : 'Selected sighting'}</Tooltip>
                <Popup>
                  <strong>{vehicle?.vehicleNumber}</strong><br />
                  {activeObservation?.location || activeObservation?.cameraId || 'Selected vehicle'}<br />
                  {boundedObservationIndex === validObservations.length - 1 ? 'Latest position' : 'Recorded sighting'}
                </Popup>
              </Marker>
            )}
            {collisionObservation && (
              <CircleMarker
                center={[Number(collisionObservation.latitude), Number(collisionObservation.longitude)]}
                radius={13}
                pathOptions={{ color: '#d74b50', weight: 2, fillColor: '#d74b50', fillOpacity: 0.18 }}
              />
            )}
          </MapContainer>
        ) : (
          <div className="vehicle-route-empty">
            <MapPinned size={24} />
            <strong>No route coordinates available</strong>
            <span>Select a vehicle with recorded camera observations to view its navigation.</span>
          </div>
        )}
      </div>

      <footer className="vehicle-route-footer">
        <span><i className="route-legend-line" /> Vehicle route</span>
        <span><Camera size={14} /> Passed camera</span>
        <span><i className="route-legend-pending" /> No sighting</span>
        <span><CarFront size={15} /> Current vehicle</span>
        {collisionObservation && <span><i className="route-legend-incident" /> Incident location</span>}
        <span className="vehicle-route-count"><RotateCcw size={13} /> {validObservations.length} sightings</span>
      </footer>

      {showCameraJourney && (
        <section className="vehicle-camera-journey" aria-label="Vehicle camera journey">
          <div className="vehicle-camera-journey-heading">
            <div>
              <p className="section-kicker">NH-44 CHECKPOINTS</p>
              <h3>Camera journey</h3>
            </div>
            <span>{cameraStops.filter((camera) => camera.observation).length} of {cameraStops.length} passed</span>
          </div>
          <ol className="vehicle-camera-stop-list">
            {cameraStops.map((camera, index) => {
              const isCollision = camera.id === collisionCameraId || /collision|accident/i.test(camera.observation?.detectionType || '')
              return (
                <li className={`${camera.observation ? 'is-passed' : 'is-pending'} ${isCollision ? 'is-collision' : ''}`} key={camera.id}>
                  <span className="vehicle-camera-stop-index">{index + 1}</span>
                  <span className="vehicle-camera-stop-copy">
                    <strong>{camera.name || camera.location || camera.id}</strong>
                    <small>{camera.corridorKm || camera.id}</small>
                    {camera.observation && (
                      <small>{camera.observation.timestamp ? new Date(camera.observation.timestamp).toLocaleString() : 'Vehicle detected'}
                        {camera.observation.speed ? ` · ${camera.observation.speed} km/h` : ''}
                      </small>
                    )}
                  </span>
                  <span className="vehicle-camera-stop-status">
                    {isCollision ? 'Collision' : camera.observation ? 'Passed' : 'No sighting'}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </section>
  )
}
