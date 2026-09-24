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
import ProjectMainBar from './components/ProjectMainBar'
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

function appendUniqueRows(previousRows, incomingRows) {
  const existingKeys = new Set(previousRows.map(rowKey))
  const uniqueRows = incomingRows.filter((row) => {
    const key = rowKey(row)
    if (existingKeys.has(key)) return false
    existingKeys.add(key)
    return true
  })
  return uniqueRows.length ? [...previousRows, ...uniqueRows] : previousRows
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

    const notificationSound = new Audio('/notification_sound.mp3')
    notificationSound.volume = 1
    notificationSound.currentTime = 0
    notificationSound.play().catch(() => undefined)
    window.setTimeout(() => {
      notificationSound.pause()
      notificationSound.currentTime = 0
    }, 1000)
  }

  useEffect(() => {
    if (!isAuthenticated) return undefined

    let active = true
    const socket = io(apiBaseUrl, { transports: ['websocket', 'polling'] })

    socket.on('newVehicleBatch', (newRows = []) => {
      if (!newRows.length) return
      const normalizedRows = normalizeStreamRows(newRows)
      if (normalizedRows[0]?.sourceFile) {
        setFileName((currentFileName) => currentFileName || normalizedRows[0].sourceFile)
      }
      setTrafficData((currentRows) => appendUniqueRows(currentRows, normalizedRows))
      const nextNotification = {
        id: `batch-${normalizedRows[0]?.sourceFile || 'stream'}-${Date.now()}`,
        receivedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'batch',
        fileName: normalizedRows[0]?.sourceFile || 'Live vehicle stream',
        batchCount: normalizedRows.length,
        events: normalizedRows.filter((row) => row.events).length,
        overspeeding: normalizedRows.filter((row) => row.isOverSpeed || row.overSpeed === 'Yes').length,
        totalProcessed: normalizedRows.length,
      }
      setStreamNotifications((current) => [nextNotification, ...current].slice(0, 8))
      playNotificationTone()
    })

    socket.on('vehicleStreamStatus', (status) => {
      if (status.fileName) setFileName(status.fileName)
    })

    return () => {
      active = false
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

  async function handleLoadSampleData() {
    try {
      const res = await fetch('/sample_traffic_feed.xlsx')
      if (res.ok) {
        const blob = await res.blob()
        const file = new File([blob], 'sample_traffic_feed.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const importedRows = await parseTrafficCsv(file)
        setTrafficData((currentRows) => appendUniqueRows(currentRows, importedRows))
        setFileName('sample_traffic_feed.xlsx')
        setImportError('')
        return
      }
    } catch (e) {
      console.warn('Could not load sample_traffic_feed.xlsx, falling back:', e)
    }
    setTrafficData((currentRows) => appendUniqueRows(currentRows, normalizeTrafficData(sampleTrafficData)))
    setFileName('sample_traffic_feed.csv')
    setImportError('')
  }

  if (loading) return <div className="auth-loading">Checking your session...</div>
  if (!isAuthenticated || pathname === '/login') {
    return (
      <Routes>
        <Route path="*" element={isAuthenticated ? <Navigate replace to="/home" /> : <LoginPage />} />
      </Routes>
    )
  }

  function handleSelectProject(project) {
    setSelectedProject(project)
  }

  function handleCreateProject(name) {
    const newProject = {
      name,
      caption: 'New project',
      status: 'Coming soon',
      modules: 'No modules yet',
      dashboards: 'No dashboards yet',
      data: 'Not connected',
      key: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      comingSoon: true,
      created: true,
    }
    setProjectList((currentProjects) => [...currentProjects, newProject])
    setSelectedProject(newProject)
  }

  function handleDeleteProject(targetProject) {
    const target = targetProject || selectedProject
    if (!target || !target.created) return
    const confirmed = window.confirm(`Delete ${target.name}?`)
    if (!confirmed) return

    setProjectList((currentProjects) => {
      const remaining = currentProjects.filter((p) => p.key !== target.key)
      setSelectedProject(remaining[0] || projects[0])
      return remaining
    })

    if (connectedProject?.key === target.key) {
      handleProjectDisconnect()
    }
  }

  function handleProjectConnect(project) {
    const target = project || selectedProject
    if (!target) return
    if (target.comingSoon && !target.created) return
    setConnectedProject(target)
    setTrafficData([])
    setFileName('')
    setImportError('')
  }

  function handleProjectDisconnect() {
    setConnectedProject(null)
    setTrafficData([])
    setFileName('')
    setImportError('')
  }

  function handleAddCamera(camera) {
    setAddedCameras((currentCameras) => [...currentCameras, camera])
  }

  function handleRemoveCamera(cameraId) {
    setAddedCameras((currentCameras) => currentCameras.filter((camera) => camera.id !== cameraId))
    setRemovedCameras((currentCameras) => currentCameras.includes(cameraId) ? currentCameras : [...currentCameras, cameraId])
  }

  async function handleImport(event) {
    const [file] = event.target.files || []
    if (!file) return

    try {
      const importedRows = await parseTrafficCsv(file)
      setTrafficData((currentRows) => appendUniqueRows(currentRows, importedRows))
      setFileName(file.name)
      setImportError('')
    } catch (error) {
      setImportError(error.message || 'Unable to import this file (supported: .csv, .xlsx).')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <ProtectedRoute>
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

        <ProjectMainBar
          connectedProject={connectedProject}
          fileName={fileName}
          hasImportedFile={hasImportedFile}
          importError={importError}
          onDeleteProject={handleDeleteProject}
          onImport={handleImport}
          onLoadSampleData={handleLoadSampleData}
          onProjectConnect={handleProjectConnect}
          onProjectDisconnect={handleProjectDisconnect}
          rows={trafficData}
          selectedProject={selectedProject}
        />

        <section className="content-wrap">
          <Routes>
            {/* HOME */}
            <Route path="/" element={<Navigate replace to="/home" />} />
            <Route path="/home" element={<PlaceholderPage cameraCount={addedCameras.length} fileName={fileName} rows={trafficData} />} />

            {/* ONTOLOGY */}
            <Route
              path="/ontology"
              element={
                !connectedProject ? (
                  <ProjectConnectionRequired />
                ) : connectedProject.comingSoon ? (
                  <ProjectComingSoon projectName={connectedProject.name} />
                ) : !hasImportedFile ? (
                  <DataImportRequired
                    featureName="Ontology Knowledge Model"
                    onImport={handleImport}
                    onLoadSample={handleLoadSampleData}
                    projectName={connectedProject.name}
                  />
                ) : (
                  <OntologyPage fileName={fileName} rows={trafficData} />
                )
              }
            />

            {/* KNOWLEDGE GRAPH */}
            <Route
              path="/knowledge-graph"
              element={
                !connectedProject ? (
                  <ProjectConnectionRequired />
                ) : connectedProject.comingSoon ? (
                  <ProjectComingSoon projectName={connectedProject.name} />
                ) : !hasImportedFile ? (
                  <DataImportRequired
                    featureName="Knowledge Graph Network"
                    onImport={handleImport}
                    onLoadSample={handleLoadSampleData}
                    projectName={connectedProject.name}
                  />
                ) : (
                  <KnowledgeGraphPage fileName={fileName} rows={trafficData} />
                )
              }
            />

            {/* QUERY ENGINE */}
            <Route
              path="/query"
              element={
                !connectedProject ? (
                  <ProjectConnectionRequired />
                ) : connectedProject.comingSoon ? (
                  <ProjectComingSoon projectName={connectedProject.name} />
                ) : !hasImportedFile ? (
                  <DataImportRequired
                    featureName="Traffic Query Engine"
                    onImport={handleImport}
                    onLoadSample={handleLoadSampleData}
                    projectName={connectedProject.name}
                  />
                ) : (
                  <QueryPage fileName={fileName} rows={trafficData} />
                )
              }
            />

            {/* DASHBOARDS HUB */}
            <Route
              path="/dashboards"
              element={
                !connectedProject ? (
                  <ProjectConnectionRequired />
                ) : connectedProject.comingSoon ? (
                  <ProjectComingSoon projectName={connectedProject.name} />
                ) : !hasImportedFile ? (
                  <DataImportRequired
                    featureName="Dashboards Analytics"
                    onImport={handleImport}
                    onLoadSample={handleLoadSampleData}
                    projectName={connectedProject.name}
                  />
                ) : (
                  <DashboardHub
                    fileName={fileName}
                    importError={importError}
                    onImport={handleImport}
                    projectName={connectedProject.name}
                    rows={trafficData}
                  />
                )
              }
            />

            {/* DASHBOARD DETAIL */}
            <Route
              path="/dashboards/:kind"
              element={
                !connectedProject ? (
                  <ProjectConnectionRequired />
                ) : connectedProject.comingSoon ? (
                  <ProjectComingSoon projectName={connectedProject.name} />
                ) : !hasImportedFile ? (
                  <DataImportRequired
                    featureName="Dashboard View"
                    onImport={handleImport}
                    onLoadSample={handleLoadSampleData}
                    projectName={connectedProject.name}
                  />
                ) : (
                  <DashboardDetail
                    addedCameras={addedCameras}
                    onRemoveCamera={handleRemoveCamera}
                    removedCameras={removedCameras}
                    fileName={fileName}
                    importError={importError}
                    onImport={handleImport}
                    onAddCamera={handleAddCamera}
                    projectName={connectedProject.name}
                    rows={trafficData}
                  />
                )
              }
            />

            {/* DOCUMENT INTELLIGENCE */}
            <Route
              path="/document-intelligence"
              element={
                !connectedProject ? (
                  <ProjectConnectionRequired />
                ) : connectedProject.comingSoon ? (
                  <ProjectComingSoon projectName={connectedProject.name} />
                ) : !hasImportedFile ? (
                  <DataImportRequired
                    featureName="Document Intelligence"
                    onImport={handleImport}
                    onLoadSample={handleLoadSampleData}
                    projectName={connectedProject.name}
                  />
                ) : (
                  <DocumentIntelligence
                    fileName={fileName}
                    projectName={connectedProject.name}
                    rows={trafficData}
                  />
                )
              }
            />

            {/* VEHICLE INFORMATION */}
            <Route path="/vehicle-information" element={<VehicleInformation />} />

            {/* RULES & EVENTS: CENTRAL GOVERNMENT TRAFFIC KNOWLEDGE BASE */}
            <Route path="/rules-events" element={<RulesEventsPage />} />

            {/* ACCOUNT */}
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
    </ProtectedRoute>
  )
}