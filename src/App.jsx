import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

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

import PlaceholderPage from './components/PlaceholderPage'
import ProjectMainBar from './components/ProjectMainBar'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'

import {
  normalizeTrafficData,
  parseTrafficCsv,
  sampleTrafficData,
} from './data/dashboardData'
import { routePaths } from './data/navigation'
import { projects } from './data/projects'

const storedProjectsKey = 'vision-iq-created-projects'

export default function App() {
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
  const [fileName, setFileName] = useState('')
  const [importError, setImportError] = useState('')

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
        setTrafficData(importedRows)
        setFileName('sample_traffic_feed.xlsx')
        setImportError('')
        return
      }
    } catch (e) {
      console.warn('Could not load sample_traffic_feed.xlsx, falling back:', e)
    }
    setTrafficData(normalizeTrafficData(sampleTrafficData))
    setFileName('sample_traffic_feed.csv')
    setImportError('')
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

  async function handleImport(event) {
    const [file] = event.target.files || []
    if (!file) return

    try {
      const importedRows = await parseTrafficCsv(file)
      setTrafficData(importedRows)
      setFileName(file.name)
      setImportError('')
    } catch (error) {
      setImportError(error.message || 'Unable to import this file (supported: .csv, .xlsx).')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        connectedProject={connectedProject}
        onCreateProject={handleCreateProject}
        onSelectProject={handleSelectProject}
        projectList={projectList}
        selectedProject={selectedProject}
      />

      <main className="main-content">
        <Topbar searchOpen={searchOpen} setSearchOpen={setSearchOpen} />

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
                    fileName={fileName}
                    importError={importError}
                    onImport={handleImport}
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

            {/* RULES & EVENTS: CENTRAL GOVERNMENT TRAFFIC KNOWLEDGE BASE */}
            <Route path="/rules-events" element={<RulesEventsPage />} />

            {/* OTHER PLATFORM PAGES */}
            {routePaths
              .filter(
                (path) =>
                  path !== '/dashboards' &&
                  path !== '/ontology' &&
                  path !== '/knowledge-graph' &&
                  path !== '/query' &&
                  path !== '/document-intelligence' &&
                  path !== '/rules-events'
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
  )
}