import { useState } from 'react'
import { ArrowLeft, BarChart3, Camera, Car, FileText, MapPin, Upload, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { groupBy, summarizeData } from '../data/dashboardData'
import { getVehicleMeta } from '../data/vehicleTypes'
import VehicleBadge from './VehicleBadge'
import VehicleImageThumbnail from './VehicleImageThumbnail'
import MediaPreviewModal from './MediaPreviewModal'

const configs = {
  vehicles: { number: '01', title: 'Vehicle Analytics', eyebrow: 'VEHICLE INTELLIGENCE', description: 'Understand vehicle mix and traffic volume from every imported detection.', icon: Car, chartTitle: 'Vehicles by type', chartKey: 'type', color: '#467c62' },
  traffic: { number: '02', title: 'Pedestrian & Traffic Flow', eyebrow: 'FLOW INTELLIGENCE', description: 'Compare traffic and pedestrian activity across your captured locations.', icon: BarChart3, chartTitle: 'Traffic by location', chartKey: 'location', color: '#b36d4d' },
  cameras: { number: '03', title: 'Camera & Location Monitoring', eyebrow: 'COVERAGE INTELLIGENCE', description: 'Review camera sources and the locations represented in your dataset.', icon: Camera, chartTitle: 'Records by camera', chartKey: 'camera', color: '#417987' },
}

export default function DashboardDetail({ rows, fileName, onImport, importError, projectName }) {
  const [previewModalRow, setPreviewModalRow] = useState(null)
  const [initialModalTab, setInitialModalTab] = useState('vehicle')
  const { kind } = useParams()
  const config = configs[kind] || configs.vehicles
  const Icon = config.icon
  const summary = summarizeData(rows)
  const chartData = groupBy(rows, config.chartKey).sort((a, b) => b.value - a.value).slice(0, 10)
  const pieData = groupBy(rows, 'type').sort((a, b) => b.value - a.value).slice(0, 12)

  return (
    <div className="dashboard-page dashboard-detail-page">
      <div className="detail-back-row">
        <Link className="back-link" to="/dashboards"><ArrowLeft size={16} />All dashboards</Link>
        <label className="csv-import-button csv-import-button-small">
          <Upload size={15} />Import CSV / XLSX
          <input
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel"
            onChange={onImport}
            type="file"
          />
        </label>
      </div>
      {importError && <p className="csv-import-error" role="alert">{importError}</p>}
      <div className="page-intro">
        <div><p className="section-kicker">{config.eyebrow}</p><h1>{config.title}</h1><p className="intro-copy">{projectName} data: {config.description}</p></div>
        <div className="detail-heading-icon"><Icon size={24} /></div>
      </div>
      <div className="dashboard-source-bar">
        <div className="source-icon"><FileText size={17} /></div>
        <div><strong>{projectName} / {fileName || 'Sample traffic data'}</strong><span>{rows.length} records powering this view</span></div>
        <span className="source-status">{config.number} / 03</span>
      </div>

      <div className="traffic-stat-grid detail-stat-grid">
        <div className="traffic-stat-card"><div className="traffic-stat-icon"><Car size={19} /></div><div><span>Traffic volume</span><strong>{summary.total.toLocaleString()}</strong></div></div>
        <div className="traffic-stat-card"><div className="traffic-stat-icon"><Users size={19} /></div><div><span>Pedestrians</span><strong>{summary.pedestrians.toLocaleString()}</strong></div></div>
        <div className="traffic-stat-card"><div className="traffic-stat-icon"><MapPin size={19} /></div><div><span>Locations</span><strong>{summary.uniqueLocations}</strong></div></div>
        <div className="traffic-stat-card"><div className="traffic-stat-icon"><Camera size={19} /></div><div><span>Cameras</span><strong>{summary.uniqueCameras}</strong></div></div>
      </div>

      <div className="detail-chart-grid">
        <div className="dashboard-panel chart-panel">
          <div className="panel-heading">
            <div><p className="section-kicker">DATA REPRESENTATION</p><h2>{config.chartTitle}</h2></div>
            <span className="chart-period">Imported CSV</span>
          </div>
          <div className="chart-frame">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid stroke="#e6eeea" vertical={false} />
                <XAxis axisLine={false} dataKey="name" tick={{ fill: '#7a8984', fontSize: 10 }} tickLine={false} />
                <YAxis axisLine={false} tick={{ fill: '#7a8984', fontSize: 10 }} tickLine={false} />
                <Tooltip cursor={{ fill: '#edf3ef' }} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {chartData.map((entry) => {
                    const barColor = config.chartKey === 'type' ? getVehicleMeta(entry.name).color : config.color
                    return <Cell fill={barColor} key={entry.name} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-panel chart-panel">
          <div className="panel-heading">
            <div><p className="section-kicker">COMPOSITION</p><h2>Object mix</h2></div>
          </div>
          <div className="chart-frame pie-chart-frame">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie cx="50%" cy="50%" data={pieData} dataKey="value" innerRadius={52} outerRadius={82} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell fill={getVehicleMeta(entry.name).color} key={entry.name} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {pieData.map((entry) => {
              const meta = getVehicleMeta(entry.name)
              return (
                <span key={entry.name}>
                  <i style={{ background: meta.color }} />
                  {entry.name} <strong>{entry.value}</strong>
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <div className="dashboard-panel traffic-table-panel">
        <div className="panel-heading">
          <div><p className="section-kicker">SOURCE RECORDS</p><h2>Latest imported rows</h2></div>
          <span className="record-count">{rows.length} records</span>
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
              {rows.slice(0, 10).map((row, index) => (
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

      {previewModalRow && (
        <MediaPreviewModal
          allRows={rows}
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