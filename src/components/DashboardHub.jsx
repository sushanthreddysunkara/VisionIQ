import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  Car,
  Database,
  Gauge,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Upload,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { groupBy, summarizeData } from '../data/dashboardData'
import VehicleMap from './vehicle/VehicleMap'



export default function DashboardHub({
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
  const [isFetchingBatch, setIsFetchingBatch] = useState(false)

  const safeRows = Array.isArray(rows) ? rows : []
  const summary = summarizeData(safeRows)

  // Compute live vehicle statistics from the active stream window
  const overspeedRows = safeRows.filter((r) => r.isOverSpeed || r.overSpeed === 'Yes')
  const overspeedCount = overspeedRows.length
  const overspeedPercent = safeRows.length ? Math.round((overspeedCount / safeRows.length) * 100) : 0

  const averageSpeed = safeRows.length
    ? Math.round(safeRows.reduce((acc, r) => acc + Number(r.speed || 0), 0) / safeRows.length)
    : 62

  const averageConfidence = safeRows.length
    ? Math.round(
        safeRows.reduce((acc, r) => {
          const conf = Number(r.plateConfidence || r.confidence || 0.94)
          return acc + (conf > 1 ? conf : conf * 100)
        }, 0) / safeRows.length,
      )
    : 96

  // Vehicle type distribution for Bar Chart
  const vehicleTypeData = groupBy(safeRows, 'type')
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Speed compliance distribution for Donut Chart
  const speedProfileData = [
    { name: 'Normal (<= 60 km/h)', value: safeRows.length - overspeedCount, color: '#10b981' },
    { name: 'Over Speed (> 60 km/h)', value: overspeedCount, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  // Top corridor checkpoints
  const topLocations = groupBy(safeRows, 'location')
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)



  const handleManualBatchClick = async () => {
    if (!onFetchRandomBatch || isFetchingBatch) return
    setIsFetchingBatch(true)
    try {
      await onFetchRandomBatch()
    } finally {
      setTimeout(() => setIsFetchingBatch(false), 500)
    }
  }

  const dashboardCards = [
    {
      path: '/dashboards/vehicles',
      number: '01',
      title: 'Vehicle Analytics',
      subtitle: `${summary.total} Monitored Vehicles`,
      description: 'Vehicle types, HSRP plates, speed profiling, and ANPR accuracy metrics.',
      icon: Car,
      accent: '#3b82f6',
      badge: `${vehicleTypeData.length} Types Active`,
    },
    {
      path: '/dashboards/traffic',
      number: '02',
      title: 'Traffic Flow & Corridor Speed',
      subtitle: `${averageSpeed} km/h Avg Velocity`,
      description: 'Highway volume density, high-speed violation heatmaps, and corridor pressure.',
      icon: BarChart3,
      accent: '#f59e0b',
      badge: `${overspeedPercent}% Overspeeding`,
    },
    {
      path: '/dashboards/cameras',
      number: '03',
      title: 'Camera Network & Gateways',
      subtitle: `${summary.uniqueCameras || 6} Checkpoint Feeds`,
      description: 'ANPR optical cameras, gateway coverage along NH-44, and checkpoint health.',
      icon: Camera,
      accent: '#10b981',
      badge: 'All Feeds Ready',
    },
  ]

  return (
    <div className="dashboard-page dashboard-hub nh44-theme">
      {/* PAGE HEADER */}
      <div className="page-intro nh44-header">
        <div>
          <div className="nh44-badge-row">
            <span className="nh44-highway-tag">
              <Radio size={13} className="nh44-pulse-icon" />
              {fileName?.includes('NH44') ? 'NH-44 HYDERABAD-BENGALURU HIGHWAY RADAR' : `${fileName || 'HIGHWAY'} RADAR FEED`}
            </span>
            <span className="nh44-db-pill">
              <Database size={13} />
              {dbStats?.totalRecords ? `${Number(dbStats.totalRecords).toLocaleString()} Records Ingested (MySQL)` : 'MySQL Database Connected'}
            </span>
          </div>
          <h1>Highway Traffic Intelligence</h1>
          <p className="intro-copy">
            Live telemetry connected to {projectName}. Processing random batches (1–20 records) from {fileName || 'MySQL database archive'}.
          </p>
        </div>
        <div className="header-actions">
          <label className="csv-import-button">
            <Upload size={16} />
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

      {/* LIVE TELEMETRY & STREAM CONTROL CONSOLE */}
      <div className="nh44-stream-console">
        <div className="stream-console-status">
          <div className={`radar-indicator ${streamPaused ? 'paused' : 'active'}`}>
            <span className="radar-ring" />
            <span className="radar-dot" />
          </div>
          <div className="stream-status-text">
            <div className="stream-status-title">
              <strong>{streamPaused ? 'Stream Paused' : 'Live Highway Feed Active'}</strong>
              <span className="stream-source-tag">Source: {fileName || 'NH44_vehicles_5000_merged_with_images.xlsx'}</span>
            </div>
            <div className="stream-status-meta">
              {latestBatchInfo?.batchCount ? (
                <span className="batch-flash-pill">
                  <Zap size={13} />
                  +<strong>{latestBatchInfo.batchCount}</strong> records arrived in this batch (Random range 1–20)
                  <span className="batch-total-growth">
                    • Cumulative Total: <strong>{safeRows.length}</strong> records (Increasing ▲)
                  </span>
                  {latestBatchInfo.overspeedCount > 0 && (
                    <span className="batch-overspeed-tag">
                      ({latestBatchInfo.overspeedCount} speed violation{latestBatchInfo.overspeedCount > 1 ? 's' : ''})
                    </span>
                  )}
                </span>
              ) : (
                <span>Streaming live telemetry from MySQL database... Total: <strong>{safeRows.length}</strong> records</span>
              )}
            </div>
          </div>
        </div>

        <div className="stream-console-actions">
          <button
            className={`nh44-control-btn nh44-trigger-btn ${isFetchingBatch ? 'is-loading' : ''}`}
            onClick={handleManualBatchClick}
            type="button"
            title="Pulls a random batch of 1 to 20 records from all records in the database"
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

      {/* DYNAMIC KPI METRICS ROW */}
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
              <span className="kpi-delta-tag alert">
                {overspeedPercent}% rate
              </span>
            </div>
            <span className="kpi-subtext">Exceeding 60 km/h limit on NH-44</span>
          </div>
        </div>

        <div className="nh44-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#fffbeb', color: '#d97706' }}>
            <Gauge size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Corridor Avg Speed</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{averageSpeed}</strong>
              <span className="kpi-unit">km/h</span>
            </div>
            <span className="kpi-subtext">Calculated across live batch stream</span>
          </div>
        </div>

        <div className="nh44-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">ANPR Optical Match</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{averageConfidence}%</strong>
              <span className="kpi-delta-tag success">High Quality</span>
            </div>
            <span className="kpi-subtext">HSRP plate detection confidence</span>
          </div>
        </div>

        <div className="nh44-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
            <Database size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Database Pool</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{dbStats?.totalRecords || dbStats?.totalPool ? Number(dbStats.totalRecords || dbStats.totalPool).toLocaleString() : '7,044'}</strong>
              <span className="kpi-unit">records</span>
            </div>
            <span className="kpi-subtext">All {dbStats?.totalRecords || dbStats?.totalPool ? Number(dbStats.totalRecords || dbStats.totalPool).toLocaleString() : '7,044'} rows in MySQL</span>
          </div>
        </div>
      </div>

      {/* THREE INTERACTIVE DASHBOARD MODULES */}
      <div className="dashboard-card-grid nh44-modules-grid">
        {dashboardCards.map(({ path, number, title, subtitle, description, icon: Icon, accent, badge }) => (
          <Link className="dashboard-card nh44-module-card" key={path} to={path}>
            <div className="nh44-card-header">
              <div className="card-top-icon" style={{ borderColor: `${accent}40`, color: accent }}>
                <Icon size={20} />
              </div>
              <div className="card-meta">
                <span className="dashboard-card-number">{number}</span>
                <span className="card-badge-pill" style={{ color: accent, borderColor: `${accent}30`, background: `${accent}10` }}>
                  {badge}
                </span>
              </div>
            </div>
            <div className="card-main">
              <h2>{title}</h2>
              <p className="card-subtitle">{subtitle}</p>
              <p className="card-description">{description}</p>
            </div>
            <div className="card-bottom">
              <span className="dashboard-card-link">
                Launch Dashboard <ArrowRight size={15} />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* NH-44 HIGHWAY MAP — full width in place of bar chart */}
      <div className="nh44-highway-map-section" style={{ marginTop: '28px' }}>
        <div className="panel-heading" style={{ padding: '0 0 14px' }}>
          <div>
            <p className="section-kicker">NH-44 LIVE CORRIDOR</p>
            <h2>Highway Surveillance Map</h2>
          </div>
          <span className="nh44-live-pill">
            <Activity size={13} />
            6 Cameras Active
          </span>
        </div>
        {/* Render the NH-44 map with no vehicle selected (overview mode) */}
        <VehicleMap vehicle={null} cameras={[]} />
      </div>

      {/* COMPACT SPEED ANALYTICS BELOW THE MAP */}
      <div className="nh44-analytics-section" style={{ marginTop: '20px' }}>
        {/* SPEED COMPLIANCE DONUT */}

        {/* SPEED COMPLIANCE & CORRIDOR PRESSURE */}
        <div className="dashboard-panel nh44-chart-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">SAFETY PROFILE</p>
              <h2>Speed & Corridor Pressure</h2>
            </div>
            <span className="nh44-live-pill">Limit: 60 km/h</span>
          </div>

          <div className="nh44-split-analytics">
            {/* Speed Profile Donut */}
            <div className="speed-donut-wrap">
              <div style={{ height: '160px', position: 'relative' }}>
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={speedProfileData}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={4}
                    >
                      {speedProfileData.map((entry) => (
                        <Cell fill={entry.color} key={entry.name} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="speed-donut-center">
                  <strong>{overspeedPercent}%</strong>
                  <span>Speeding</span>
                </div>
              </div>
              <div className="speed-donut-legend">
                <div className="donut-legend-item">
                  <span className="legend-dot" style={{ background: '#10b981' }} />
                  <span>Normal: {safeRows.length - overspeedCount}</span>
                </div>
                <div className="donut-legend-item">
                  <span className="legend-dot" style={{ background: '#ef4444' }} />
                  <span>Over Speed: {overspeedCount}</span>
                </div>
              </div>
            </div>

            {/* Corridor Checkpoints */}
            <div className="corridor-pressure-wrap">
              <p className="corridor-title">Top Highway Checkpoints</p>
              <div className="corridor-list">
                {topLocations.map((loc, idx) => {
                  const percent = Math.round((loc.value / (safeRows.length || 1)) * 100)
                  return (
                    <div className="corridor-item" key={loc.name}>
                      <div className="corridor-header">
                        <span className="corridor-rank">0{idx + 1}</span>
                        <span className="corridor-name">{loc.name}</span>
                        <strong className="corridor-count">{loc.value}</strong>
                      </div>
                      <div className="corridor-bar-track">
                        <div
                          className="corridor-bar-fill"
                          style={{
                            width: `${percent}%`,
                            background: idx === 0 ? '#3b82f6' : idx === 1 ? '#06b6d4' : '#8b5cf6',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}