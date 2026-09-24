import { useMemo, useState } from 'react'
import { ArrowRight, BarChart3, Camera, Car, CircleUserRound, FileUp, MapPin, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { groupBy, summarizeData } from '../data/dashboardData'
import VehicleBadge from './VehicleBadge'
import VehicleImageThumbnail from './VehicleImageThumbnail'
import MediaPreviewModal from './MediaPreviewModal'

function getRecordTimestampScore(row) {
  const raw = String(row.timestampIst || row.timestamp || row.time || row.date || '')
  const parsed = Date.parse(raw)
  if (!isNaN(parsed)) return parsed
  const timeMatch = raw.match(/(\d{1,2}):(\d{2}):(\d{2})/)
  if (timeMatch) {
    return Number(timeMatch[1]) * 3600 + Number(timeMatch[2]) * 60 + Number(timeMatch[3])
  }
  const idNum = Number(String(row.id || row.csvRecordId || '').replace(/\D/g, ''))
  return idNum || 0
}

const dashboardCards = [
  { path: '/dashboards/vehicles', number: '01', title: 'Vehicle Analytics', description: 'Vehicle types, volume, number plates and movement across the network.', icon: Car, tone: 'mint' },
  { path: '/dashboards/traffic', number: '02', title: 'Traffic Flow', description: 'Traffic volume and location patterns over time.', icon: BarChart3, tone: 'peach' },
  { path: '/dashboards/cameras', number: '03', title: 'Camera & Location Monitoring', description: 'Camera coverage, active locations and imported detection records.', icon: Camera, tone: 'sky' },
]

export default function DashboardHub({ rows = [], fileName, onImport, importError, projectName }) {
  const [previewModalRow, setPreviewModalRow] = useState(null)
  const [initialModalTab, setInitialModalTab] = useState('vehicle')
  const safeRows = Array.isArray(rows) ? rows : []
  const summary = summarizeData(safeRows)
  const topLocations = groupBy(safeRows, 'location').sort((a, b) => b.value - a.value).slice(0, 3)

  // Strictly select the latest 10 records
  const latestTenRows = useMemo(() => {
    if (!safeRows.length) return []
    const scored = safeRows.map((row, idx) => ({
      row,
      originalIdx: idx,
      score: getRecordTimestampScore(row),
    }))
    const hasScores = scored.some((s) => s.score > 0)
    if (hasScores) {
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.originalIdx - a.originalIdx
      })
      return scored.slice(0, 10).map((s) => s.row)
    }
    return [...safeRows].reverse().slice(0, 10)
  }, [safeRows])

  return (
    <div className="dashboard-page dashboard-hub">
      <div className="page-intro">
        <div>
          <p className="section-kicker">TRAFFIC INTELLIGENCE</p>
          <h1>Dashboards</h1>
          <p className="intro-copy">{projectName} data is connected. Choose a dashboard to explore the latest traffic data.</p>
        </div>
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

      <div className="dashboard-source-bar">
        <div className="source-icon"><FileUp size={17} /></div>
        <div><strong>{projectName} / {fileName || 'Sample traffic data'}</strong><span>{rows.length} records loaded across all dashboards</span></div>
        <span className="source-status">Live dataset</span>
      </div>
      {importError && <p className="csv-import-error" role="alert">{importError}</p>}

      <div className="dashboard-card-grid">
        {dashboardCards.map(({ path, number, title, description, icon: Icon, tone }) => (
          <Link className={`dashboard-card dashboard-card-${tone}`} key={path} to={path}>
            <div className="dashboard-card-top"><span className="dashboard-card-number">{number}</span><Icon size={21} /></div>
            <div><h2>{title}</h2><p>{description}</p></div>
            <span className="dashboard-card-link">Open dashboard <ArrowRight size={15} /></span>
          </Link>
        ))}
      </div>

      <div className="dashboard-summary-grid">
        <div className="dashboard-summary-panel">
          <p className="section-kicker">DATA SNAPSHOT</p>
          <h2>One import, three views</h2>
          <div className="dashboard-summary-stats">
            <div><strong>{summary.total.toLocaleString()}</strong><span>Traffic volume</span></div>
            <div><strong>{summary.uniqueCameras}</strong><span>Camera sources</span></div>
          </div>
        </div>
        <div className="dashboard-summary-panel">
          <p className="section-kicker">BUSIEST LOCATIONS</p>
          <h2>Where activity is concentrated</h2>
          <div className="dashboard-location-list">
            {topLocations.map(({ name, value }) => <div key={name}><span><CircleUserRound size={14} />{name}</span><strong>{value}</strong></div>)}
          </div>
        </div>
      </div>

      {safeRows.length > 0 && (
        <div className="dashboard-panel traffic-table-panel" style={{ marginTop: '24px' }}>
          <div className="panel-heading">
            <div>
              <p className="section-kicker">SOURCE RECORDS</p>
              <h2>Latest 10 Detections</h2>
            </div>
            <span className="record-count">
              Latest {latestTenRows.length} of {safeRows.length} records
            </span>
          </div>
          <div className="traffic-table-wrapper">
            <table className="traffic-table">
              <thead>
                <tr>
                  <th>VEHICLE IMAGE</th>
                  <th>TIMESTAMP (IST)</th>
                  <th>VEHICLE TYPE</th>
                  <th>NUMBER PLATE</th>
                  <th>SPEED / LIMIT</th>
                  <th>OVER SPEED</th>
                  <th>PLATE CONFIDENCE</th>
                  <th>COORDINATES</th>
                </tr>
              </thead>
              <tbody>
                {latestTenRows.map((row, index) => (
                  <tr key={`${row.id || row.observationId || row.camera}-${index}`}>
                    <td style={{ minWidth: '120px' }}>
                      <VehicleImageThumbnail
                        onClick={() => {
                          setInitialModalTab('vehicle')
                          setPreviewModalRow(row)
                        }}
                        onPlayVideo={() => {
                          setInitialModalTab('video')
                          setPreviewModalRow(row)
                        }}
                        row={row}
                        size="table"
                      />
                    </td>
                    <td>{row.timestampIst || row.time || row.timestamp}</td>
                    <td>
                      <VehicleBadge type={row.vehicleType || row.type} />
                    </td>
                    <td>
                      {row.vehicleNumberPlate || row.numberPlate ? (
                        <span className="query-plate-badge">{row.vehicleNumberPlate || row.numberPlate}</span>
                      ) : (
                        <span className="query-plate-na">—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <strong style={{ color: (row.overSpeed === 'Yes' || row.isOverSpeed) ? '#dc2626' : '#1e293b' }}>
                          {row.speed || 0}
                        </strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          / {row.speedLimit || 60} km/h
                        </span>
                      </div>
                    </td>
                    <td>
                      {(row.overSpeed === 'Yes' || row.isOverSpeed) ? (
                        <span className="query-signal-pill" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', fontWeight: 600 }}>
                          ⚠ Over Speed
                        </span>
                      ) : (
                        <span className="query-signal-pill" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
                          Normal
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="query-confidence-badge">
                        {Math.round(
                          (row.plateConfidence || row.confidence) > 1
                            ? (row.plateConfidence || row.confidence)
                            : ((row.plateConfidence || row.confidence || 0.94) * 100)
                        )}%
                      </span>
                    </td>
                    <td>
                      <span className="location-cell">
                        <MapPin size={13} />
                        {row.latitude?.toFixed(4) || '17.4485'}°, {row.longitude?.toFixed(4) || '78.3742'}°
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {previewModalRow && (
        <MediaPreviewModal
          allRows={latestTenRows}
          initialTab={initialModalTab}
          isOpen={Boolean(previewModalRow)}
          onClose={() => setPreviewModalRow(null)}
          onSelectRow={setPreviewModalRow}
          row={previewModalRow}
        />
      )}
    </div>
  )
}