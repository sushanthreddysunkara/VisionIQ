import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import DashboardDetail from './components/DashboardDetail'
import DashboardHub from './components/DashboardHub'
import OntologyPage from './components/ontology/OntologyPage'
import KnowledgeGraphPage from './components/knowledgeGraph/KnowledgeGraphPage'
import DocumentIntelligence from './components/DocumentIntelligence'
import ProjectConnectionRequired from './components/ProjectConnectionRequired'
import ProjectComingSoon from './components/ProjectComingSoon'
import DataImportRequired from './components/DataImportRequired'
import QueryPage from './components/QueryPage'
import RulesEventsPage from './components/RulesEventsPage'
import ProfilePage from './components/ProfilePage'
import SettingsPage from './components/SettingsPage'
import VehicleInformation from './components/VehicleInformation'
import PlaceholderPage from './components/PlaceholderPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import ProjectsPage from './components/projects/ProjectsPage'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import LoginPage from './components/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { useAuth } from './context/AuthContext'

import {
  normalizeTrafficData,
  parseTrafficCsv,
  sampleTrafficData,
} from './data/dashboardData'
import { routePaths } from './data/navigation'
import { projects } from './data/projects'

const storedProjectsKey = 'vision-iq-created-projects'
const storedCamerasKey = 'vision-iq-added-cameras'
const storedRemovedCamerasKey = 'vision-iq-removed-cameras'
const storedNotificationsKey = 'vision-iq-stream-notifications'
const apiBaseUrl = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '')

function rowKey(row) {
  return `${row.sourceFile || row.fileName || 'local'}::${row.csvRecordId || row.observationId || row.id || `${row.timestamp}-${row.vehicleNumberPlate}`}`
}

function prependUniqueRows(previousRows, incomingRows, maxCapacity = 100) {
  const existingKeys = new Set(incomingRows.map(rowKey))
  const filteredPrevious = previousRows.filter((row) => !existingKeys.has(rowKey(row)))
  return [...incomingRows, ...filteredPrevious].slice(0, maxCapacity)
}

function appendUniqueRows(previousRows, incomingRows) {
  return prependUniqueRows(previousRows, incomingRows, 100)
}

function normalizeStreamRows(rows) {
  const normalizedRows = normalizeTrafficData(rows)
  return normalizedRows.map((row, index) => ({
    ...row,
    csvRecordId: rows[index]?.csvRecordId || row.csvRecordId,
    sourceFile: rows[index]?.sourceFile || row.sourceFile,
    events: rows[index]?.events || row.events || '',
  }))
}

export default function App() {
  const { isAuthenticated, loading } = useAuth()
  const { pathname } = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [projectList, setProjectList] = useState(() => {
    try {
      const storedProjects = JSON.parse(
        localStorage.getItem(storedProjectsKey) || '[]',
      )
      return [...projects, ...storedProjects.filter((project) => project.created)]
    } catch {
      return projects
    }
  })
  const [selectedProject, setSelectedProject] = useState(projects[0])
  const [connectedProject, setConnectedProject] = useState(projects[0])
  const [trafficData, setTrafficData] = useState([])
  const [addedCameras, setAddedCameras] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storedCamerasKey) || '[]')
    } catch {
      return []
    }
  })
  const [removedCameras, setRemovedCameras] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storedRemovedCamerasKey) || '[]')
    } catch {
      return []
    }
  })
  const [fileName, setFileName] = useState('')
  const [importError, setImportError] = useState('')
  const [streamNotifications, setStreamNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storedNotificationsKey) || '[]')
    } catch {
      return []
    }
  })
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('vision-iq-notification-sound') !== 'off'
    } catch {
      return true
    }
  })
  const notificationSoundEnabledRef = useRef(notificationSoundEnabled)

  useEffect(() => {
    notificationSoundEnabledRef.current = notificationSoundEnabled
    try {
      localStorage.setItem(
        'vision-iq-notification-sound',
        notificationSoundEnabled ? 'on' : 'off',
      )
    } catch {
      // ignore localStorage write errors
    }
  }, [notificationSoundEnabled])

  function playNotificationTone() {
    if (!notificationSoundEnabledRef.current) return
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      const now = ctx.currentTime

      const notificationSound = new Audio('/notification_sound.mp3')
      notificationSound.volume = 1
      notificationSound.currentTime = 0
      notificationSound.play().catch(() => undefined)
      window.setTimeout(() => {
        notificationSound.pause()
        notificationSound.currentTime = 0
      }, 1000)
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc2.type = 'triangle'
      osc1.frequency.setValueAtTime(587.33, now)
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12)
      osc2.frequency.setValueAtTime(293.66, now)
      osc2.frequency.exponentialRampToValueAtTime(440, now + 0.12)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.23)
      osc2.stop(now + 0.23)
      setTimeout(() => ctx.close().catch(() => { }), 400)
    } catch {
      // audio autoplay policies can suppress this until first user gesture
    }
  }

  const [streamPaused, setStreamPaused] = useState(false)
  const [latestBatchInfo, setLatestBatchInfo] = useState({
    batchCount: 0,
    timestamp: null,
    overspeedCount: 0,
    delta: 0,
    isManual: false,
    fileName: 'NH44_vehicles_5000_merged_with_images.xlsx',
  })
  const [dbStats, setDbStats] = useState({
    totalRecords: 5000,
    overspeedRate: '28%',
    avgSpeed: 65,
    cameras: 6,
    activeCorridor: 'NH-44 Hyderabad Express Corridor',
  })

  useEffect(() => {
    if (!isAuthenticated) return
    fetch(`${apiBaseUrl}/api/vehicles/stats`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.stats) {
          setDbStats(data.stats)
        }
      })
      .catch(() => undefined)
  }, [isAuthenticated])

  const userUploadedFileRef = useRef(false)

  const handleFetchRandomBatch = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/vehicles/stream-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger' }),
      })
      const data = await response.json()
      if (data.success && Array.isArray(data.vehicles) && data.vehicles.length) {
        const streamRows = normalizeStreamRows(data.vehicles)
        setTrafficData((currentRows) => prependUniqueRows(currentRows, streamRows, 100))
        const overspeeds = streamRows.filter((r) => r.isOverSpeed || r.overSpeed === 'Yes').length
        setLatestBatchInfo({
          batchCount: streamRows.length,
          timestamp: new Date().toLocaleTimeString(),
          overspeedCount: overspeeds,
          delta: streamRows.length,
          isManual: true,
          fileName: 'NH44_vehicles_5000_merged_with_images.xlsx',
        })
        playNotificationTone()
      }
    } catch (error) {
      console.warn('Unable to trigger random batch:', error)
    }
  }

  const handleToggleStreamPause = async () => {
    try {
      const nextAction = streamPaused ? 'resume' : 'pause'
      const response = await fetch(`${apiBaseUrl}/api/vehicles/stream-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction }),
      })
      const data = await response.json()
      if (data.success) {
        setStreamPaused(data.isPaused)
      }
    } catch (error) {
      console.warn('Unable to toggle stream pause:', error)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return undefined

    let isCancelled = false

    async function loadInitialVehicles() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/vehicles?limit=20`)
        if (!response.ok) return
        const data = await response.json()
        if (!isCancelled && !userUploadedFileRef.current && Array.isArray(data.vehicles) && data.vehicles.length) {
          const streamRows = normalizeStreamRows(data.vehicles)
          setTrafficData((currentRows) => (userUploadedFileRef.current ? currentRows : prependUniqueRows(currentRows, streamRows, 100)))
          setFileName((currentName) => currentName || 'NH44_vehicles_5000_merged_with_images.xlsx')
          setLatestBatchInfo({
            batchCount: streamRows.length,
            timestamp: new Date().toLocaleTimeString(),
            overspeedCount: streamRows.filter((r) => r.isOverSpeed || r.overSpeed === 'Yes').length,
            delta: streamRows.length,
            isManual: false,
            fileName: 'NH44_vehicles_5000_merged_with_images.xlsx',
          })
        }
      } catch (error) {
        console.warn('Unable to load initial vehicles from database:', error.message)
      }
    }

    loadInitialVehicles()

    const socket = io(apiBaseUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    })

    socket.on('newVehicleBatch', (incomingVehicles) => {
      if (!Array.isArray(incomingVehicles) || !incomingVehicles.length || isCancelled) return
      const streamRows = normalizeStreamRows(incomingVehicles)
      if (!userUploadedFileRef.current) {
        setTrafficData((currentRows) => prependUniqueRows(currentRows, streamRows, 100))
        setFileName((currentName) => currentName || 'NH44_vehicles_5000_merged_with_images.xlsx')
        const overspeeds = streamRows.filter((r) => r.isOverSpeed || r.overSpeed === 'Yes').length
        setLatestBatchInfo({
          batchCount: streamRows.length,
          timestamp: new Date().toLocaleTimeString(),
          overspeedCount: overspeeds,
          delta: streamRows.length,
          isManual: false,
          fileName: 'NH44_vehicles_5000_merged_with_images.xlsx',
        })
        const firstRow = streamRows[0]
        const label = firstRow.vehicleNumberPlate || firstRow.plateNumber || firstRow.id || 'Live vehicle'
        const type = firstRow.vehicleType || firstRow.type || 'Detection'
        setStreamNotifications((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            title: `+${streamRows.length} NH-44 Records: ${label}`,
            message: `${type} captured at ${firstRow.location || firstRow.roadName || 'NH-44 Corridor'}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev.slice(0, 11),
        ])
        playNotificationTone()
      }
    })

    socket.on('vehicleStreamComplete', (payload) => {
      if (!userUploadedFileRef.current) {
        setStreamNotifications((prev) => [
          {
            id: `${Date.now()}-complete`,
            title: 'Telemetry Stream Cycle Completed',
            message: payload?.fileName
              ? `Completed random polling cycle across ${payload.totalRows || '5,000'} records in ${payload.fileName}.`
              : 'Dataset processing cycle completed.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev.slice(0, 11),
        ])
      }
    })

    socket.on('vehicleStreamStatus', (status) => {
      if (!isCancelled) {
        if (status?.fileName) {
          setFileName(status.fileName)
        }
        if (typeof status?.isPaused === 'boolean') {
          setStreamPaused(status.isPaused)
        }
        if (status?.batchCount) {
          setLatestBatchInfo((prev) => ({
            ...prev,
            batchCount: status.batchCount,
            timestamp: status.timestamp || new Date().toLocaleTimeString(),
            overspeedCount: status.overspeed || 0,
            delta: status.batchCount,
          }))
        }
      }
    })

    return () => {
      isCancelled = true
      socket.disconnect()
    }
  }, [isAuthenticated])

  useEffect(() => {
    try {
      localStorage.setItem(
        storedProjectsKey,
        JSON.stringify(projectList.filter((project) => project.created)),
      )
    } catch {
      // ignore localStorage write errors
    }
  }, [projectList])

  useEffect(() => {
    try {
      localStorage.setItem(storedCamerasKey, JSON.stringify(addedCameras))
    } catch {
      // ignore localStorage write errors
    }
  }, [addedCameras])

  useEffect(() => {
    try {
      localStorage.setItem(storedRemovedCamerasKey, JSON.stringify(removedCameras))
    } catch {
      // ignore localStorage write errors
    }
  }, [removedCameras])

  useEffect(() => {
    try {
      localStorage.setItem(storedNotificationsKey, JSON.stringify(streamNotifications))
    } catch {
      // ignore localStorage write errors
    }
  }, [streamNotifications])

  const hasImportedFile = Boolean(trafficData.length > 0 && fileName)

  if (loading) return <div className="auth-loading">Checking your session...</div>
  if (!isAuthenticated || pathname === '/login') {
    return (
      <Routes>
        <Route path="*" element={isAuthenticated ? <Navigate replace to="/home" /> : <LoginPage />} />
      </Routes>
    )
  }

  async function handleLoadSampleData() {
    try {
      const res = await fetch('/sample_traffic_feed.xlsx')
      if (res.ok) {
        const blob = await res.blob()
        const file = new File([blob], 'sample_traffic_feed.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const importedRows = await parseTrafficCsv(file)
        userUploadedFileRef.current = true
        setTrafficData(importedRows)
        setFileName('sample_traffic_feed.xlsx')
        setImportError('')
        return
      }
    } catch (e) {
      console.warn('Could not load sample_traffic_feed.xlsx, falling back:', e)
    }
    const fallbackRows = normalizeTrafficData(sampleTrafficData)
    userUploadedFileRef.current = true
    setTrafficData(fallbackRows)
    setFileName('sample_traffic_feed.csv')
    setImportError('')
  }

  function handleSelectProject(project) {
    setSelectedProject(project)
  }

  function handleCreateProject(name) {
    const newProject = {
      name,
      caption: 'Created project',
      status: 'Active',
      modules: '7 modules',
      dashboards: '3 dashboards',
      data: 'CSV analytics',
      created: true,
      createdAt: new Date().toISOString(),
    }
    setProjectList((current) => [...current, newProject])
    setSelectedProject(newProject)
  }

  function handleDeleteProject(name) {
    setProjectList((current) => current.filter((p) => p.name !== name))
    if (selectedProject?.name === name) {
      setSelectedProject(projectList.find((p) => p.name !== name) || projects[0])
    }
    if (connectedProject?.name === name) {
      setConnectedProject(null)
      userUploadedFileRef.current = false
      setTrafficData([])
      setFileName('')
    }
  }

  function handleProjectConnect(project) {
    setConnectedProject(project)
    setSelectedProject(project)
  }

  function handleProjectDisconnect() {
    setConnectedProject(null)
    userUploadedFileRef.current = false
    setTrafficData([])
    setFileName('')
  }

  function handleAddCamera(camera) {
    setAddedCameras((currentCameras) => [...currentCameras, camera])
  }

  function handleRemoveCamera(cameraId) {
    setAddedCameras((currentCameras) => currentCameras.filter((camera) => camera.id !== cameraId))
    setRemovedCameras((currentCameras) => currentCameras.includes(cameraId) ? currentCameras : [...currentCameras, cameraId])
  }

  async function handleImport(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const importedRows = await parseTrafficCsv(file)
      // Directly display user's uploaded Excel dataset with all extracted vehicle images
      userUploadedFileRef.current = true
      setTrafficData(importedRows)
      setFileName(file.name)
      setImportError('')
    } catch (error) {
      setImportError(error.message || 'Unable to import file.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <div className="app-shell">
          <Sidebar
            connectedProject={connectedProject}
            onCreateProject={handleCreateProject}
            onSelectProject={handleSelectProject}
            projectList={projectList}
            selectedProject={selectedProject}
          />

          <main className="main-content">
            <Topbar
              notificationSoundEnabled={notificationSoundEnabled}
              searchOpen={searchOpen}
              setSearchOpen={setSearchOpen}
              setNotificationSoundEnabled={setNotificationSoundEnabled}
              streamNotifications={streamNotifications}
            />

            <section className="content-wrap">
              <Routes>
                {/* HOME */}
                <Route path="/" element={<Navigate replace to="/home" />} />
                <Route
                  path="/home"
                  element={
                    !connectedProject ? (
                      <ProjectConnectionRequired />
                    ) : (
                      <PlaceholderPage cameraCount={addedCameras.length} fileName={fileName} rows={trafficData} />
                    )
                  }
                />

                {/* PROJECTS MANAGEMENT (NEO4J DESKTOP STYLE) */}
                <Route
                  path="/projects"
                  element={
                    <ProjectsPage
                      connectedProject={connectedProject}
                      fileName={fileName}
                      hasImportedFile={hasImportedFile}
                      importError={importError}
                      onCreateProject={handleCreateProject}
                      onDeleteProject={handleDeleteProject}
                      onImport={handleImport}
                      onLoadSampleData={handleLoadSampleData}
                      onProjectConnect={handleProjectConnect}
                      onProjectDisconnect={handleProjectDisconnect}
                      onSelectProject={handleSelectProject}
                      projectList={projectList}
                      rows={trafficData}
                      selectedProject={selectedProject}
                    />
                  }
                />

                {/* ONTOLOGY */}
                <Route
                  path="/ontology"
                  element={
                    !connectedProject ? (
                      <ProjectConnectionRequired />
                    ) : (
                      <OntologyPage
                        fileName={fileName}
                        importError={importError}
                        onImport={handleImport}
                        onLoadSampleData={handleLoadSampleData}
                        projectName={connectedProject.name}
                        rows={trafficData}
                      />
                    )
                  }
                />

                {/* KNOWLEDGE GRAPH */}
                <Route
                  path="/knowledge-graph"
                  element={
                    !connectedProject ? (
                      <ProjectConnectionRequired />
                    ) : (
                      <KnowledgeGraphPage
                        fileName={fileName}
                        importError={importError}
                        onImport={handleImport}
                        projectName={connectedProject.name}
                        rows={trafficData}
                      />
                    )
                  }
                />

                {/* QUERY */}
                <Route
                  path="/query"
                  element={
                    !connectedProject ? (
                      <ProjectConnectionRequired />
                    ) : (
                      <QueryPage fileName={fileName} rows={trafficData} />
                    )
                  }
                />

                {/* DOCUMENT INTELLIGENCE */}
                <Route
                  path="/document-intelligence"
                  element={
                    !connectedProject ? (
                      <ProjectConnectionRequired />
                    ) : (
                      <DocumentIntelligence
                        fileName={fileName}
                        importError={importError}
                        onImport={handleImport}
                        onLoadSampleData={handleLoadSampleData}
                        projectName={connectedProject.name}
                        rows={trafficData}
                      />
                    )
                  }
                />

                {/* DASHBOARDS HUB */}
                <Route
                  path="/dashboards"
                  element={
                    !connectedProject ? (
                      <ProjectConnectionRequired />
                    ) : (
                      <DashboardHub
                        dbStats={dbStats}
                        fileName={fileName}
                        hasImportedFile={hasImportedFile}
                        importError={importError}
                        latestBatchInfo={latestBatchInfo}
                        onFetchRandomBatch={handleFetchRandomBatch}
                        onImport={handleImport}
                        onLoadSampleData={handleLoadSampleData}
                        onToggleStreamPause={handleToggleStreamPause}
                        projectName={connectedProject.name}
                        rows={trafficData}
                        streamPaused={streamPaused}
                      />
                    )
                  }
                />

                {/* DASHBOARD DETAILS */}
                <Route
                  path="/dashboards/:kind"
                  element={
                    !connectedProject ? (
                      <ProjectConnectionRequired />
                    ) : (
                      <DashboardDetail
                        addedCameras={addedCameras}
                        dbStats={dbStats}
                        fileName={fileName}
                        importError={importError}
                        latestBatchInfo={latestBatchInfo}
                        onAddCamera={handleAddCamera}
                        onFetchRandomBatch={handleFetchRandomBatch}
                        onImport={handleImport}
                        onRemoveCamera={handleRemoveCamera}
                        onToggleStreamPause={handleToggleStreamPause}
                        projectName={connectedProject.name}
                        removedCameras={removedCameras}
                        rows={trafficData}
                        streamPaused={streamPaused}
                      />
                    )
                  }
                />

                {/* VEHICLE INFORMATION */}
                <Route path="/vehicle-information" element={<VehicleInformation />} />

                {/* RULES & EVENTS: CENTRAL GOVERNMENT TRAFFIC KNOWLEDGE BASE */}
                <Route path="/rules-events" element={<RulesEventsPage />} />

                {/* PROFILE & SETTINGS */}
                <Route path="/profile" element={<ProfilePage />} />
                <Route
                  path="/settings"
                  element={
                    <SettingsPage
                      notificationSoundEnabled={notificationSoundEnabled}
                      setNotificationSoundEnabled={setNotificationSoundEnabled}
                    />
                  }
                />

                {/* OTHER PLATFORM PAGES */}
                {routePaths
                  .filter(
                    (path) =>
                      path !== '/home' &&
                      path !== '/dashboards' &&
                      path !== '/ontology' &&
                      path !== '/knowledge-graph' &&
                      path !== '/query' &&
                      path !== '/document-intelligence' &&
                      path !== '/vehicle-information' &&
                      path !== '/rules-events' &&
                      path !== '/profile' &&
                      path !== '/settings'
                  )
                  .map((path) => (
                    <Route element={<PlaceholderPage />} key={path} path={path} />
                  ))}

                {/* UNKNOWN URL */}
                <Route path="*" element={<Navigate replace to="/home" />} />
              </Routes>
            </section>
          </main>
        </div>
      </ErrorBoundary>
    </ProtectedRoute>
  )
}
