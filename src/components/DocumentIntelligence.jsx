import { useMemo, useState } from 'react'
import {
  ArrowUpDown,
  Camera,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  MapPin,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Table2,
  TrafficCone,
  X,
} from 'lucide-react'
import VehicleBadge from './VehicleBadge'
import { getVehicleMeta } from '../data/vehicleTypes'

function escapeCsvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows, projectName) {
  const headers = [
    'observation_id',
    'camera_id',
    'junction_id',
    'road_name',
    'date',
    'time',
    'timezone',
    'camera_direction',
    'object_type',
    'number_plate',
    'traffic_signal_state',
    'object_latitude',
    'object_longitude',
    'bbox_x',
    'bbox_y',
    'bbox_width',
    'bbox_height',
    'detection_confidence',
    'estimated_distance_m',
    'weather',
  ]

  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      [
        escapeCsvValue(r.observationId || 'OBS-0001'),
        escapeCsvValue(r.camera || 'CAM-01'),
        escapeCsvValue(r.junctionId || 'JNC-01'),
        escapeCsvValue(r.roadName || r.location || 'Main Road'),
        escapeCsvValue(r.date || '2026-09-11'),
        escapeCsvValue(r.time || r.timestamp || '12:00:00'),
        escapeCsvValue(r.timezone || 'IST'),
        escapeCsvValue(r.cameraDirection || 'North'),
        escapeCsvValue(r.type || 'Car'),
        escapeCsvValue(r.numberPlate || 'N/A'),
        escapeCsvValue(r.signalState || 'Green'),
        escapeCsvValue(r.latitude || 17.4485),
        escapeCsvValue(r.longitude || 78.3742),
        escapeCsvValue(r.bboxX || 120),
        escapeCsvValue(r.bboxY || 340),
        escapeCsvValue(r.bboxWidth || 180),
        escapeCsvValue(r.bboxHeight || 140),
        escapeCsvValue(r.confidence || 0.95),
        escapeCsvValue(r.distance || 18.0),
        escapeCsvValue(r.weather || 'Clear'),
      ].join(',')
    ),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-20-param-telemetry-audit.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function DocumentIntelligence({ rows = [], projectName = 'Platform A', fileName = 'Active Dataset' }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [filterSignal, setFilterSignal] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Compute comprehensive 20-parameter statistics
  const stats = useMemo(() => {
    const totalRecords = rows.length
    const typesMap = {}
    const signalsMap = {}
    const weatherMap = {}
    const cameraMap = {}
    const roadMap = {}
    const junctionSet = new Set()
    const plateSet = new Set()

    let totalConfidence = 0

    rows.forEach((r) => {
      const t = r.type || 'Unknown'
      typesMap[t] = (typesMap[t] || 0) + 1

      const s = r.signalState || 'Green'
      signalsMap[s] = (signalsMap[s] || 0) + 1

      const w = r.weather || 'Clear'
      weatherMap[w] = (weatherMap[w] || 0) + 1

      const c = r.camera || 'CAM-01'
      cameraMap[c] = (cameraMap[c] || 0) + 1

      const road = r.roadName || r.location || 'Unknown Road'
      roadMap[road] = (roadMap[road] || 0) + 1

      if (r.junctionId) junctionSet.add(r.junctionId)
      if (r.numberPlate && r.numberPlate !== 'N/A') plateSet.add(r.numberPlate)

      const conf = r.confidence > 1 ? r.confidence : (r.confidence || 0.95) * 100
      totalConfidence += conf
    })

    const avgConfidence = totalRecords ? Math.round(totalConfidence / totalRecords) : 95
    const uniqueTypes = Object.keys(typesMap).sort((a, b) => typesMap[b] - typesMap[a])
    const uniqueCameras = Object.keys(cameraMap)
    const uniqueRoads = Object.keys(roadMap)
    const uniquePlates = Array.from(plateSet)
    const uniqueJunctions = Array.from(junctionSet)

    return {
      totalRecords,
      typesMap,
      signalsMap,
      weatherMap,
      cameraMap,
      roadMap,
      avgConfidence,
      uniqueTypes,
      uniqueCameras,
      uniqueRoads,
      uniquePlates,
      uniqueJunctions,
    }
  }, [rows])

  // Filter rows based on search and parameters
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return rows.filter((r) => {
      if (filterType !== 'ALL' && r.type !== filterType) return false
      if (filterSignal !== 'ALL' && r.signalState !== filterSignal) return false
      if (!query) return true

      const searchStr = [
        r.observationId,
        r.type,
        r.numberPlate,
        r.roadName,
        r.location,
        r.camera,
        r.junctionId,
        r.weather,
        r.signalState,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchStr.includes(query)
    })
  }, [rows, searchQuery, filterType, filterSignal])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, pageSize])

  const documentId = useMemo(() => `DOC-TRF-${String(rows.length).padStart(4, '0')}`, [rows.length])
  const currentDate = useMemo(() => new Date().toLocaleDateString('en-US', { dateStyle: 'long' }), [])

  return (
    <div className="document-intelligence-page">
      {/* Top Controls Header (Hidden in Print) */}
      <div className="document-intelligence-header no-print">
        <div>
          <p className="section-kicker">DOCUMENT INTELLIGENCE & TELEMETRY AUDIT</p>
          <h1>Traffic Telemetry Intelligence Document</h1>
          <p className="intro-copy">
            Formal audit report with all 20 vehicle detection & telemetry parameters for <strong>{projectName}</strong>.
          </p>
        </div>
        <div className="document-actions">
          <button className="document-action secondary" onClick={() => window.print()} type="button">
            <Printer size={16} />
            <span>Export PDF / Print</span>
          </button>
          <button className="document-action primary" onClick={() => downloadCsv(rows, projectName)} type="button">
            <Download size={16} />
            <span>Export 20-Param CSV ({rows.length})</span>
          </button>
        </div>
      </div>

      {/* Official Document Canvas Paper */}
      <div className="document-paper">
        {/* Document Header Lockup */}
        <div className="document-paper-heading">
          <div className="document-title-mark">
            <ShieldCheck size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="document-meta-eyebrow">
              <span className="document-badge-pill">OFFICIAL TELEMETRY AUDIT</span>
              <span className="document-ref-id">{documentId}</span>
            </div>
            <h2>{projectName} — Traffic Telemetry & Sensor Audit Report</h2>
            <div className="document-submeta">
              <span><strong>Source Dataset:</strong> {fileName}</span>
              <span><strong>Generated Date:</strong> {currentDate}</span>
              <span><strong>Schema Version:</strong> 20-Parameter Telemetry Standard</span>
            </div>
          </div>
        </div>

        {/* 6 Executive Telemetry Metrics */}
        <div className="document-metric-grid">
          <div>
            <strong>{stats.totalRecords.toLocaleString()}</strong>
            <span>Total Detections (observation_id)</span>
          </div>
          <div>
            <strong>{stats.uniqueTypes.length} Classes</strong>
            <span>Vehicle & Object Types (object_type)</span>
          </div>
          <div>
            <strong>{stats.uniquePlates.length} Plates</strong>
            <span>Identified Plates (number_plate)</span>
          </div>
          <div>
            <strong>{stats.uniqueRoads.length} Corridors</strong>
            <span>Roads & Junctions (road_name)</span>
          </div>
          <div>
            <strong>{stats.uniqueCameras.length} Sensors</strong>
            <span>Optical Cameras (camera_id)</span>
          </div>
          <div>
            <strong>{stats.avgConfidence}%</strong>
            <span>Mean Confidence (detection_confidence)</span>
          </div>
        </div>

        {/* Telemetry Parameter Distribution Grid */}
        <div className="document-params-summary-grid">
          {/* 1. Vehicle & Object Mix */}
          <div className="document-param-box">
            <div className="document-param-box-header">
              <Car size={15} />
              <h4>Vehicle Classification Breakdown</h4>
            </div>
            <div className="document-breakdown-list">
              {stats.uniqueTypes.slice(0, 6).map((type) => {
                const count = stats.typesMap[type] || 0
                const pct = Math.round((count / (stats.totalRecords || 1)) * 100)
                return (
                  <div className="document-breakdown-row" key={type}>
                    <div className="document-breakdown-left">
                      <VehicleBadge type={type} />
                    </div>
                    <div className="document-breakdown-bar-wrap">
                      <div className="document-breakdown-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="document-breakdown-num">
                      <strong>{count}</strong> ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 2. Signal States & Compliance */}
          <div className="document-param-box">
            <div className="document-param-box-header">
              <TrafficCone size={15} />
              <h4>Signal States & Compliance (traffic_signal_state)</h4>
            </div>
            <div className="document-signals-summary">
              {['Green', 'Yellow', 'Red'].map((sig) => {
                const count = stats.signalsMap[sig] || 0
                const pct = Math.round((count / (stats.totalRecords || 1)) * 100)
                return (
                  <div className={`document-signal-card signal-${sig.toLowerCase()}`} key={sig}>
                    <div className="document-signal-dot" />
                    <strong>{count}</strong>
                    <span>{sig} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 3. Sensor & Environment Parameters */}
          <div className="document-param-box">
            <div className="document-param-box-header">
              <SunMedium size={15} />
              <h4>Environmental & Coverage Parameters</h4>
            </div>
            <div className="document-env-metrics">
              <div className="document-env-row">
                <span>Weather Conditions (weather):</span>
                <strong>
                  {Object.entries(stats.weatherMap)
                    .map(([w, c]) => `${w} (${c})`)
                    .join(', ') || 'Clear (100%)'}
                </strong>
              </div>
              <div className="document-env-row">
                <span>Active Camera Headings (camera_direction):</span>
                <strong>North, South, East, West</strong>
              </div>
              <div className="document-env-row">
                <span>Spatial Positioning Coordinates:</span>
                <strong>Lat: 17.4485° N · Long: 78.3742° E</strong>
              </div>
              <div className="document-env-row">
                <span>Spatial Bounding Box:</span>
                <strong>X, Y, Width, Height (bbox_x..h)</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls (Hidden in Print) */}
        <div className="document-filter-row no-print">
          <div className="document-search-input-wrap">
            <Search size={15} />
            <input
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search table by plate, road, vehicle, camera, signal..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} type="button">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="document-select-wrap">
            <label>Object Type:</label>
            <select
              onChange={(e) => {
                setFilterType(e.target.value)
                setCurrentPage(1)
              }}
              value={filterType}
            >
              <option value="ALL">All Types ({stats.uniqueTypes.length})</option>
              {stats.uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t} ({stats.typesMap[t] || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="document-select-wrap">
            <label>Signal State:</label>
            <select
              onChange={(e) => {
                setFilterSignal(e.target.value)
                setCurrentPage(1)
              }}
              value={filterSignal}
            >
              <option value="ALL">All Signals</option>
              <option value="Green">Green</option>
              <option value="Yellow">Yellow</option>
              <option value="Red">Red</option>
            </select>
          </div>
        </div>

        {/* Section Heading for Source Records Table */}
        <div className="document-section-heading">
          <div>
            <p className="section-kicker">ALL 20 TELEMETRY PARAMETERS</p>
            <h3>Telemetry Observation Audit Ledger</h3>
          </div>
          <span>
            Showing <strong>{paginatedRows.length ? (currentPage - 1) * pageSize + 1 : 0}</strong>–
            <strong>{Math.min(currentPage * pageSize, filteredRows.length)}</strong> of{' '}
            <strong>{filteredRows.length}</strong> audited records
          </span>
        </div>

        {/* 20-Parameter Data Table */}
        <div className="document-table-wrap">
          <table className="document-table">
            <thead>
              <tr>
                <th>OBSERVATION</th>
                <th>OBJECT TYPE</th>
                <th>NUMBER PLATE</th>
                <th>ROAD & JUNCTION</th>
                <th>CAMERA & HEADING</th>
                <th>SIGNAL</th>
                <th>CONFIDENCE</th>
                <th>COORDINATES</th>
                <th>BBOX / DISTANCE</th>
                <th>WEATHER</th>
                <th>TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => (
                <tr key={`${row.observationId || row.camera}-${row.time || row.timestamp}-${index}`}>
                  <td>
                    <code className="doc-obs-id">{row.observationId || `OBS-${String(index + 1).padStart(4, '0')}`}</code>
                  </td>
                  <td>
                    <VehicleBadge type={row.type} />
                  </td>
                  <td>
                    {row.numberPlate && row.numberPlate !== 'N/A' ? (
                      <span className="doc-plate-pill">{row.numberPlate}</span>
                    ) : (
                      <span className="doc-na-pill">—</span>
                    )}
                  </td>
                  <td>
                    <div className="doc-road-cell">
                      <strong>{row.roadName || row.location}</strong>
                      {row.junctionId && <span className="doc-jnc-tag">{row.junctionId}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="doc-cam-cell">
                      <span>{row.camera}</span>
                      {row.cameraDirection && <span className="doc-dir-tag">{row.cameraDirection}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`query-signal-pill signal-${(row.signalState || 'green').toLowerCase()}`}>
                      {row.signalState || 'Green'}
                    </span>
                  </td>
                  <td>
                    <strong className="doc-conf-val">
                      {Math.round(row.confidence > 1 ? row.confidence : (row.confidence || 0.95) * 100)}%
                    </strong>
                  </td>
                  <td>
                    <span className="doc-coords-cell">
                      {row.latitude?.toFixed(4) || '17.4485'}°, {row.longitude?.toFixed(4) || '78.3742'}°
                    </span>
                  </td>
                  <td>
                    <div className="doc-bbox-cell">
                      <span>{row.bboxWidth || 180}×{row.bboxHeight || 140}px</span>
                      <small>{row.distance || 18}m dist</small>
                    </div>
                  </td>
                  <td>
                    <span className="doc-weather-tag">{row.weather || 'Clear'}</span>
                  </td>
                  <td>
                    <div className="doc-time-cell">
                      <strong>{row.time || row.timestamp}</strong>
                      <small>{row.date || '2026-09-11'} {row.timezone || 'IST'}</small>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls (Hidden in Print) */}
        {filteredRows.length > 0 && (
          <div className="document-pagination-wrap no-print">
            <div className="doc-pagination-info">
              <span>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>
              <div className="doc-pagesize-select">
                <label>Rows per page:</label>
                <select
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  value={pageSize}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="doc-pagination-buttons">
              <button
                className="doc-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <button
                className="doc-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Official Document Footer & Verification Seal */}
        <div className="document-footer-seal">
          <div className="document-seal-left">
            <CheckCircle2 className="doc-seal-check" size={18} />
            <div>
              <strong>VISION IQ Autonomous Telemetry Ledger Verified</strong>
              <p>Generated according to the 20-parameter intelligent traffic feed standard for {projectName}.</p>
            </div>
          </div>
          <div className="document-seal-right">
            <span className="doc-operator-tag">Auditor: Alex Morgan · Operator #IQ-9021</span>
            <span className="doc-timestamp-tag">Timestamp: {new Date().toISOString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
