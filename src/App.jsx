import { useState } from 'react'
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

import PlaceholderPage from './components/PlaceholderPage'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'

import {
  normalizeTrafficData,
  parseTrafficCsv,
  sampleTrafficData,
} from './data/dashboardData'
import { routePaths } from './data/navigation'
import { projects } from './data/projects'

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [connectedProject, setConnectedProject] = useState(projects[0])
  const [trafficData, setTrafficData] = useState([])
  const [fileName, setFileName] = useState('')
  const [importError, setImportError] = useState('')

  const hasImportedFile = Boolean(trafficData.length > 0 && fileName)

  function handleLoadSampleData() {
    setTrafficData(sampleTrafficData)
    setFileName('sample_traffic_feed.csv')
    setImportError('')
  }

  function handleProjectConnect(project) {
    if (project.comingSoon && !project.created) return
    setConnectedProject(project)
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
      setTrafficData(normalizeTrafficData(importedRows))
      setFileName(file.name)
      setImportError('')
    } catch (error) {
      setImportError(error.message || 'Unable to import this CSV file.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        connectedProject={connectedProject}
        fileName={fileName}
        hasImportedFile={hasImportedFile}
        importError={importError}
        onImport={handleImport}
        onLoadSampleData={handleLoadSampleData}
        onProjectConnect={handleProjectConnect}
        onProjectDisconnect={handleProjectDisconnect}
        rows={trafficData}
      />

      <main className="main-content">
        <Topbar searchOpen={searchOpen} setSearchOpen={setSearchOpen} />

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

            {/* OTHER PLATFORM PAGES */}
            {routePaths
              .filter(
                (path) =>
                  path !== '/dashboards' &&
                  path !== '/ontology' &&
                  path !== '/knowledge-graph' &&
                  path !== '/query' &&
                  path !== '/document-intelligence'
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