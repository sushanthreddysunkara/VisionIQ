import { ArrowRight, BarChart3, Camera, Car, CircleUserRound, FileUp, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { groupBy, summarizeData } from '../data/dashboardData'

const dashboardCards = [
  { path: '/dashboards/vehicles', number: '01', title: 'Vehicle Analytics', description: 'Vehicle types, volume, number plates and movement across the network.', icon: Car, tone: 'mint' },
  { path: '/dashboards/traffic', number: '02', title: 'Traffic Flow', description: 'Traffic volume and location patterns over time.', icon: BarChart3, tone: 'peach' },
  { path: '/dashboards/cameras', number: '03', title: 'Camera & Location Monitoring', description: 'Camera coverage, active locations and imported detection records.', icon: Camera, tone: 'sky' },
]

export default function DashboardHub({ rows, fileName, onImport, importError, projectName }) {
  const summary = summarizeData(rows)
  const topLocations = groupBy(rows, 'location').sort((a, b) => b.value - a.value).slice(0, 3)

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
    </div>
  )
}