import React from 'react'
import { Navigate, Route, Routes, Outlet } from 'react-router-dom'
import { LiveFeedProvider } from './context/LiveFeedContext'
import LiveDashboard from './pages/LiveDashboard'
import LiveTollRevenue from './pages/LiveTollRevenue'
import LiveQuery from './pages/LiveQuery'
import LiveKnowledgeGraph from './pages/LiveKnowledgeGraph'
import LiveOntology from './pages/LiveOntology'
import LiveTrafficFlow from './pages/LiveTrafficFlow'
import LiveCameraNetwork from './pages/LiveCameraNetwork'
import LiveIncidents from './pages/LiveIncidents'
import LiveAssetsMaintenance from './pages/LiveAssetsMaintenance'
import LiveReports from './pages/LiveReports'
import LiveRulesEvents from './pages/LiveRulesEvents'

/**
 * LiveInterface
 * Root wrapper for the independent Live Feed interface.
 * Hosts the isolated LiveFeedProvider and renders all 11 Live pages.
 */
export default function LiveInterface() {
  return (
    <LiveFeedProvider>
      <Routes>
        <Route path="/" element={<Navigate replace to="home" />} />
        <Route path="home" element={<LiveDashboard />} />
        <Route path="toll-revenue" element={<LiveTollRevenue />} />
        <Route path="query" element={<LiveQuery />} />
        <Route path="knowledge-graph" element={<LiveKnowledgeGraph />} />
        <Route path="ontology" element={<LiveOntology />} />
        <Route path="dashboards" element={<Navigate replace to="dashboards/traffic" />} />
        <Route path="dashboards/traffic" element={<LiveTrafficFlow />} />
        <Route path="dashboards/cameras" element={<LiveCameraNetwork />} />
        <Route path="dashboards/vehicles" element={<Navigate replace to="dashboards/traffic" />} />
        <Route path="dashboards/corridors" element={<Navigate replace to="dashboards/traffic" />} />
        <Route path="dashboards/:kind" element={<LiveTrafficFlow />} />
        <Route path="vehicle-information" element={<LiveIncidents />} />
        <Route path="assets-maintenance" element={<LiveAssetsMaintenance />} />
        <Route path="document-intelligence" element={<LiveReports />} />
        <Route path="rules-events" element={<LiveRulesEvents />} />
        <Route path="*" element={<Navigate replace to="home" />} />
      </Routes>
    </LiveFeedProvider>
  )
}
