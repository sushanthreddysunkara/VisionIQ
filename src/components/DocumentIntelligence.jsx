import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Camera,
  CarFront,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  MapPin,
  Printer,
  Route,
  ShieldCheck,
  Upload,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { liveHighwayIncidents } from '../data/vehicleTrackingData'
import { getVehicleIncidents } from '../services/vehicleService'

const REPORT_TEMPLATES = [
  {
    id: 'operations',
    title: 'Operations daily summary',
    description: 'Corridor activity, vehicle detections, speed exceptions and current dataset coverage.',
    cadence: 'Daily · 06:00 AM',
    audience: 'Shift supervisors, operations',
    source: 'Dashboard, Traffic Flow, Camera Network',
    icon: Activity,
    accent: 'blue',
    selectRows: () => true,
  },
  {
    id: 'incidents',
    title: 'Incident & response report',
    description: 'Download every vehicle-linked and live-feed incident with the associated vehicles, locations and event details.',
    cadence: 'On demand · incident closure',
    audience: 'Traffic Police, operations',
    source: 'Incidents',
    icon: AlertTriangle,
    accent: 'red',
    selectRows: (row) => Boolean(row.incidentId || row.incidentType || row.incident) || isSafetyException(row),
  },
  {
    id: 'traffic',
    title: 'Traffic flow & travel time',
    description: 'Observed speeds, vehicle volumes and corridor coverage; travel time is included when supplied.',
    cadence: 'Weekly · Monday',
    audience: 'Operations, planning',
    source: 'Traffic Flow',
    icon: Route,
    accent: 'orange',
    selectRows: () => true,
  },
  {
    id: 'revenue',
    title: 'Toll revenue & leakage',
    description: 'Toll transactions, collections and leakage indicators when transaction data is connected.',
    cadence: 'Daily and monthly',
    audience: 'Toll auditors, finance',
    source: 'Toll & Revenue',
    icon: IndianRupee,
    accent: 'purple',
    selectRows: (row) => row.tollAmount != null || row.transactionAmount != null || row.leakageAmount != null || row.tollPlaza != null,
  },
  {
    id: 'assets',
    title: 'Camera & asset health',
    description: 'Observed camera coverage and device health fields present in the active dataset.',
    cadence: 'Weekly · Friday',
    audience: 'Maintenance planners',
    source: 'Camera Network',
    icon: Wrench,
    accent: 'yellow',
    selectRows: (row) => Boolean(row.camera || row.cameraId || row.camera_id || row.assetId || row.assetStatus),
  },
  {
    id: 'safety',
    title: 'Road safety & compliance',
    description: 'Speed-limit exceptions, signal observations and safety evidence from traffic detections.',
    cadence: 'Quarterly',
    audience: 'Road safety, operations',
    source: 'Incidents, Traffic Flow, Rules & Events',
    icon: ShieldCheck,
    accent: 'green',
    selectRows: (row) => isSafetyException(row),
  },
]

function isSafetyException(row) {
  const speed = numericValue(row.speed)
  const limit = numericValue(row.speedLimit)
  return row.overSpeed === 'Yes'
    || Boolean(row.isOverSpeed)
    || (speed !== null && limit !== null && speed > limit)
    || String(row.signalState || '').toLowerCase() === 'red'
    || Boolean(row.ruleViolation || row.violation)
}

function csvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function uniqueValues(rows, selector) {
  return new Set(rows.map(selector).filter((value) => value !== undefined && value !== null && String(value).trim())).size
}

function countDistinctIncidentVehicles(incidents) {
  return new Set(incidents.flatMap((incident) => incident.vehicleNumbers.split('; ').filter(Boolean))).size
}

function rowsWithField(rows, fields) {
  return rows.filter((row) => fields.some((field) => row[field] !== undefined && row[field] !== null && row[field] !== ''))
}

function numericValue(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(String(value).replace(/[₹,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeIncidentRows(vehicleIncidents, liveIncidents) {
  const incidentsById = new Map()

  vehicleIncidents.forEach((incident, index) => {
    const incidentType = String(incident.incidentType || incident.title || 'Road incident')
    if (incidentType.toLowerCase() === 'vehicle detected') return
    const observations = Array.isArray(incident.observations) ? incident.observations : []
    const key = incident.incidentId || `${incident.vehicleNumber || 'unknown'}-${incident.incidentTime || incident.occurredAt || index}`
    const incidentObservation = observations.find((observation) =>
      observation.detectionType && observation.detectionType.toLowerCase() !== 'vehicle detected'
    )
    const cameraObservation = observations.find((observation) =>
      observation.cameraId && (observation.cameraId === incident.collisionCamera || observation.cameraId === incident.cameraId)
    )
    const eventObservation = incidentObservation || cameraObservation || observations[observations.length - 1]
    const routeLocations = observations.map((observation) => observation.location).filter(Boolean)
    const vehicleNumber = incident.vehicleNumber && incident.vehicleNumber !== 'N/A' ? incident.vehicleNumber : ''
    const existing = incidentsById.get(key)

    if (existing) {
      if (vehicleNumber && !existing.vehicleNumbers.includes(vehicleNumber)) existing.vehicleNumbers.push(vehicleNumber)
      if (incident.vehicleType && !existing.vehicleTypes.includes(incident.vehicleType)) existing.vehicleTypes.push(incident.vehicleType)
      if (incident.involvementRole && !existing.involvementRoles.includes(incident.involvementRole)) existing.involvementRoles.push(incident.involvementRole)
      routeLocations.forEach((location) => {
        if (!existing.routeLocations.includes(location)) existing.routeLocations.push(location)
      })
      return
    }

    incidentsById.set(key, {
      id: incident.incidentId || `VEH-${key}`,
      source: 'Vehicle incident records',
      incidentType,
      severity: incident.severity || '',
      status: incident.status || '',
      vehicleNumbers: vehicleNumber ? [vehicleNumber] : [],
      vehicleTypes: incident.vehicleType ? [incident.vehicleType] : [],
      involvementRoles: incident.involvementRole ? [incident.involvementRole] : [],
      location: incident.location || eventObservation?.location || 'Not recorded',
      routeLocations: [...new Set(routeLocations)],
      timestamp: incident.incidentTime || incident.occurredAt || eventObservation?.timestamp || '',
      camera: incident.cameraId || incident.collisionCamera || eventObservation?.cameraId || '',
      speed: incident.speed ?? eventObservation?.speed ?? '',
      speedLimit: incident.speedLimit ?? eventObservation?.speedLimit ?? '',
      latitude: incident.latitude ?? eventObservation?.latitude ?? '',
      longitude: incident.longitude ?? eventObservation?.longitude ?? '',
      description: incident.summary || incident.description || incident.detail || '',
      notes: eventObservation?.notes || '',
    })
  })

  liveIncidents.forEach((incident) => {
    incidentsById.set(`live-${incident.id}`, {
      id: incident.id,
      source: 'Live incident feed',
      incidentType: incident.type || incident.title || 'Road incident',
      severity: incident.severity || '',
      status: 'Reported',
      vehicleNumbers: incident.vehicleNumber ? [incident.vehicleNumber] : [],
      vehicleTypes: [],
      involvementRoles: [],
      location: incident.location || 'Not recorded',
      routeLocations: [],
      timestamp: incident.timestamp || incident.time || '',
      camera: incident.cameraId || '',
      speed: '',
      speedLimit: '',
      latitude: incident.latitude ?? '',
      longitude: incident.longitude ?? '',
      description: incident.detail || incident.description || incident.title || '',
      notes: '',
    })
  })

  return [...incidentsById.values()].map((incident) => ({
    ...incident,
    vehicleNumbers: incident.vehicleNumbers.join('; '),
    vehicleTypes: incident.vehicleTypes.join('; '),
    involvementRoles: incident.involvementRoles.join('; '),
    routeLocations: incident.routeLocations.join('; '),
  }))
}

function buildReportMetrics(template, rows, incidentRows = []) {
  const scopedRows = rows.filter(template.selectRows)
  const numericSpeeds = rows.map((row) => numericValue(row.speed)).filter((value) => value !== null)
  const averageSpeed = numericSpeeds.length
    ? Math.round(numericSpeeds.reduce((sum, value) => sum + value, 0) / numericSpeeds.length)
    : null
  const speedExceptions = rows.filter((row) => {
    const speed = numericValue(row.speed)
    const limit = numericValue(row.speedLimit)
    return row.overSpeed === 'Yes' || Boolean(row.isOverSpeed)
      || (speed !== null && limit !== null && speed > limit)
  }).length
  const redSignalObservations = rows.filter((row) => String(row.signalState || '').toLowerCase() === 'red').length
  const datasetIncidentRows = rowsWithField(rows, ['incidentId', 'incidentType', 'incident'])
  const tollRows = rowsWithField(rows, ['tollAmount', 'transactionAmount', 'leakageAmount', 'tollPlaza'])
  const assetStatusRows = rowsWithField(rows, ['assetStatus', 'cameraStatus', 'deviceStatus', 'healthStatus'])
  const locationCounts = new Map()
  rows.forEach((row) => {
    const location = row.location || row.roadName || row.road_name
    if (location) locationCounts.set(location, (locationCounts.get(location) || 0) + 1)
  })
  const topLocation = [...locationCounts.entries()].sort((left, right) => right[1] - left[1])[0]
  const travelTimeRows = rowsWithField(rows, ['travelTimeMinutes', 'travel_time_minutes', 'travelTime'])

  const available = (value, source) => value === null || value === undefined || value === ''
    ? { value: 'Not available in active dataset', detail: `Connect or load ${source} data to include this measure.` }
    : { value: String(value), detail: '' }

  switch (template.id) {
    case 'operations':
      return {
        rows: scopedRows,
        metrics: [
          { label: 'Vehicle observations', value: rows.length.toLocaleString(), detail: 'Records in the active dataset.' },
          { label: 'Average observed speed', ...available(averageSpeed === null ? null : `${averageSpeed} km/h`, 'speed') },
          { label: 'Speed-limit exceptions', value: speedExceptions.toLocaleString(), detail: 'Rows marked over the speed limit.' },
          { label: 'Vehicle classes observed', value: uniqueValues(rows, (row) => row.vehicleType || row.type).toLocaleString(), detail: 'Distinct vehicle classes in the dataset.' },
          { label: 'Locations represented', value: locationCounts.size.toLocaleString(), detail: 'Distinct road or location values.' },
          { label: 'Camera IDs observed', value: uniqueValues(rows, (row) => row.camera || row.cameraId || row.camera_id).toLocaleString(), detail: 'Cameras with detection records; not a device-health check.' },
        ],
      }
    case 'incidents':
      return {
        rows: incidentRows,
        metrics: [
          { label: 'Incident records', value: incidentRows.length.toLocaleString(), detail: 'Vehicle-linked and live-feed incidents.' },
          { label: 'Linked vehicle plates', value: countDistinctIncidentVehicles(incidentRows).toLocaleString(), detail: 'Distinct plate fields linked to incident records.' },
          { label: 'Incident locations', value: uniqueValues(incidentRows, (incident) => incident.location).toLocaleString(), detail: 'Distinct locations recorded by the incident sources.' },
          { label: 'High-severity incidents', value: incidentRows.filter((incident) => String(incident.severity).toLowerCase() === 'high').length.toLocaleString(), detail: 'High severity as provided by source data.' },
          { label: 'Incident response times', ...available(null, 'incident response-time') },
        ],
      }
    case 'traffic':
      return {
        rows: scopedRows,
        metrics: [
          { label: 'Vehicle observations', value: rows.length.toLocaleString(), detail: 'Records in the active traffic dataset.' },
          { label: 'Average observed speed', ...available(averageSpeed === null ? null : `${averageSpeed} km/h`, 'speed') },
          { label: 'Travel-time observations', ...available(travelTimeRows.length ? travelTimeRows.length.toLocaleString() : null, 'travel-time') },
          { label: 'Top observed location', ...available(topLocation ? `${topLocation[0]} (${topLocation[1].toLocaleString()} records)` : null, 'location') },
        ],
      }
    case 'revenue': {
      const amountRows = rowsWithField(tollRows, ['tollAmount', 'transactionAmount'])
      const amounts = amountRows.map((row) => numericValue(row.tollAmount ?? row.transactionAmount)).filter((value) => value !== null)
      const total = amounts.reduce((sum, value) => sum + value, 0)
      return {
        rows: tollRows,
        metrics: [
          { label: 'Toll transaction records', ...available(tollRows.length ? tollRows.length.toLocaleString() : null, 'Toll & Revenue transaction') },
          { label: 'Recorded collections', ...available(amounts.length ? total.toLocaleString(undefined, { style: 'currency', currency: 'INR' }) : null, 'toll amount') },
          { label: 'Leakage indicators', ...available(rowsWithField(tollRows, ['leakageAmount']).length ? rowsWithField(tollRows, ['leakageAmount']).length.toLocaleString() : null, 'toll leakage') },
          { label: 'Source', value: 'Toll & Revenue tab', detail: 'No toll transactions are passed to Reports from the active dataset.' },
        ],
      }
    }
    case 'assets':
      return {
        rows: scopedRows,
        metrics: [
          { label: 'Camera IDs observed', value: uniqueValues(rows, (row) => row.camera || row.cameraId || row.camera_id).toLocaleString(), detail: 'Distinct camera IDs represented by vehicle detections.' },
          { label: 'Device health records', ...available(assetStatusRows.length ? assetStatusRows.length.toLocaleString() : null, 'camera or asset health status') },
          { label: 'Faults and maintenance backlog', ...available(null, 'asset maintenance') },
          { label: 'Source', value: 'Camera Network tab', detail: 'Detection coverage is not the same as device operational health.' },
        ],
      }
    case 'safety':
      return {
        rows: scopedRows,
        metrics: [
          { label: 'Safety exceptions', value: scopedRows.length.toLocaleString(), detail: 'Rows matching speed, signal or rule-violation indicators.' },
          { label: 'Speed-limit exceptions', value: speedExceptions.toLocaleString(), detail: 'Rows marked or calculated as over the recorded speed limit.' },
          { label: 'Red-signal observations', value: redSignalObservations.toLocaleString(), detail: 'Traffic detections with a red signal state.' },
          { label: 'Incident records', ...available(datasetIncidentRows.length ? datasetIncidentRows.length.toLocaleString() : null, 'incident records from the Incidents tab') },
        ],
      }
    default:
      return { rows: [], metrics: [] }
  }
}

function serializeReport(template, report, rows, projectName, fileName) {
  const generatedAt = report.generatedAt.toLocaleString()
  const lines = [
    ['Report', 'Period', 'Project', 'Dataset', 'Generated', 'Metric', 'Value', 'Notes'],
    ...report.metrics.map((metric) => [
      template.title,
      'Active dataset',
      projectName,
      fileName,
      generatedAt,
      metric.label,
      metric.value,
      metric.detail,
    ]),
  ]
  if (report.rows.length) {
    lines.push(['Detail rows', '', '', '', '', '', '', ''])
    if (template.id === 'incidents') {
      lines.push([
        'Incident ID',
        'Source',
        'Incident type',
        'Severity',
        'Status',
        'Vehicle plate(s)',
        'Vehicle type(s)',
        'Involvement role(s)',
        'Incident location',
        'Other observed route locations',
        'Incident date/time',
        'Camera',
        'Speed km/h',
        'Speed limit km/h',
        'Latitude',
        'Longitude',
        'Incident details',
        'Event notes',
      ])
      report.rows.forEach((incident) => lines.push([
        incident.id,
        incident.source,
        incident.incidentType,
        incident.severity,
        incident.status,
        incident.vehicleNumbers,
        incident.vehicleTypes,
        incident.involvementRoles,
        incident.location,
        incident.routeLocations,
        incident.timestamp,
        incident.camera,
        incident.speed,
        incident.speedLimit,
        incident.latitude,
        incident.longitude,
        incident.description,
        incident.notes,
      ]))
    } else {
      lines.push(['Observation ID', 'Timestamp', 'Vehicle class', 'Plate', 'Speed km/h', 'Speed limit km/h', 'Location', 'Camera'])
      report.rows.forEach((row) => lines.push([
        row.observationId || row.id || '',
        row.timestampIst || row.timestamp || row.date || '',
        row.vehicleType || row.type || '',
        row.vehicleNumberPlate || row.numberPlate || '',
        row.speed ?? '',
        row.speedLimit ?? '',
        row.location || row.roadName || row.road_name || '',
        row.camera || row.cameraId || row.camera_id || '',
      ]))
    }
  }
  return lines.map((line) => line.map(csvValue).join(',')).join('\n')
}

function saveCsv(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fileNameFor(title, generatedAt) {
  const date = generatedAt.toISOString().slice(0, 10)
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-${date}.csv`
}

function formatGeneratedAt(value) {
  return value.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function DocumentIntelligence({
  rows = [],
  projectName = 'Platform A',
  fileName = 'Active Dataset',
  onImport,
  onLoadSampleData,
  importError,
}) {
  const [recentReports, setRecentReports] = useState([])
  const [schedules, setSchedules] = useState({})
  const [scheduledReportId, setScheduledReportId] = useState('')
  const [scheduleFrequency, setScheduleFrequency] = useState('Weekly · Monday')
  const [scheduleTime, setScheduleTime] = useState('06:00')
  const [scheduleMessage, setScheduleMessage] = useState('')
  const [recentRange, setRecentRange] = useState('7')
  const recentReportsRef = useRef(null)
  const [vehicleIncidents, setVehicleIncidents] = useState([])
  const [incidentsLoading, setIncidentsLoading] = useState(true)
  const [incidentLoadError, setIncidentLoadError] = useState('')

  useEffect(() => {
    let isCurrent = true
    getVehicleIncidents(1000)
      .then((data) => {
        if (isCurrent) setVehicleIncidents(Array.isArray(data) ? data : [])
      })
      .catch((error) => {
        if (isCurrent) setIncidentLoadError(error instanceof Error ? error.message : 'Unable to load incident data.')
      })
      .finally(() => {
        if (isCurrent) setIncidentsLoading(false)
      })
    return () => {
      isCurrent = false
    }
  }, [])

  const templateById = useMemo(() => new Map(REPORT_TEMPLATES.map((item) => [item.id, item])), [])
  const incidentReportRows = useMemo(
    () => normalizeIncidentRows(vehicleIncidents, liveHighwayIncidents),
    [vehicleIncidents],
  )
  const summary = useMemo(() => buildReportMetrics(REPORT_TEMPLATES[0], rows).metrics, [rows])
  const visibleRecentReports = useMemo(() => {
    const latestByTemplate = new Map()
    recentReports.forEach((report) => {
      const templateId = report.templateId || report.id.split('-')[0]
      const existing = latestByTemplate.get(templateId)
      if (!existing || report.generatedAt > existing.generatedAt) {
        latestByTemplate.set(templateId, report)
      }
    })
    const uniqueReports = [...latestByTemplate.values()]
    if (recentRange === 'all') return uniqueReports
    const cutoff = Date.now() - Number(recentRange) * 24 * 60 * 60 * 1000
    return uniqueReports.filter((report) => report.generatedAt.getTime() >= cutoff)
  }, [recentReports, recentRange])

  function openSchedule(reportId = REPORT_TEMPLATES[0].id) {
    setScheduledReportId(reportId)
    setScheduleFrequency(schedules[reportId]?.frequency || templateById.get(reportId)?.cadence || 'Weekly · Monday')
    setScheduleTime(schedules[reportId]?.time || '06:00')
    setScheduleMessage('')
  }

  function saveSchedule(event) {
    event.preventDefault()
    const template = templateById.get(scheduledReportId)
    if (!template) return
    setSchedules((current) => ({
      ...current,
      [scheduledReportId]: { frequency: scheduleFrequency, time: scheduleTime },
    }))
    setScheduleMessage(`Schedule preference saved for this session. Automated delivery is not connected yet.`)
  }

  function generateReport(template) {
    const reportData = buildReportMetrics(template, rows, incidentReportRows)
    const report = {
      id: template.id,
      templateId: template.id,
      generatedAt: new Date(),
      metrics: reportData.metrics,
      rows: reportData.rows,
      fileName: fileNameFor(template.title, new Date()),
    }
    report.csv = serializeReport(template, report, rows, projectName, fileName)
    setRecentReports((current) => [
      report,
      ...current.filter((existing) => (existing.templateId || existing.id.split('-')[0]) !== template.id),
    ].slice(0, 20))
    window.setTimeout(() => recentReportsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function downloadReport(report) {
    saveCsv(report.csv, report.fileName)
  }

  return (
    <div className="document-intelligence-page reports-dashboard">
      <header className="reports-page-header">
        <div>
          <p className="section-kicker">CORRIDOR OPERATIONS</p>
          <h1>Reports</h1>
          <p className="intro-copy">Generate operational, incident, traffic, revenue and safety reports from VisionIQ workspace data.</p>
        </div>
        <div className="reports-header-actions">
          <button className="reports-button reports-button-secondary" onClick={() => openSchedule()} type="button"><CalendarDays size={15} /> Schedule</button>
          <button className="reports-button reports-button-primary" onClick={() => generateReport(REPORT_TEMPLATES[0])} type="button"><FileText size={15} /> Generate report</button>
        </div>
      </header>

      {importError && <div className="csv-import-error" role="alert">{importError}</div>}

      <div className="reports-toolbar">
        <span><strong>{rows.length.toLocaleString()}</strong> active records · <strong>{projectName}</strong> · {fileName}</span>
        <div className="reports-toolbar-actions">
          {onImport && (
            <label className="reports-inline-action" title="Import CSV or Excel data">
              <Upload size={14} /> Import data
              <input accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel" onChange={onImport} type="file" />
            </label>
          )}
          {onLoadSampleData && <button className="reports-inline-action" onClick={onLoadSampleData} type="button"><FileSpreadsheet size={14} /> Load sample data</button>}
          <button className="reports-inline-action" onClick={() => window.print()} type="button"><Printer size={14} /> Print summary</button>
        </div>
      </div>

      <section aria-label="Available report templates" className="reports-template-grid">
        {REPORT_TEMPLATES.map((template) => {
          const Icon = template.icon
          const schedule = schedules[template.id]
          return (
            <article className={`reports-template-card accent-${template.accent}`} key={template.id}>
              <div className="reports-template-main">
                <span className="reports-template-icon"><Icon size={17} /></span>
                <div className="reports-template-copy">
                  <h2>{template.title}</h2>
                  <p>{template.description}</p>
                </div>
              </div>
              <div className="reports-template-meta">
                <span><CalendarDays size={13} />{schedule ? `${schedule.frequency} · ${schedule.time}` : template.cadence}</span>
                <span><Users size={13} />{template.audience}</span>
              </div>
              <div className="reports-template-footer">
                <span className="reports-source-label">
                  Source: {template.source}
                  {template.id === 'incidents' && !incidentsLoading ? ` · ${incidentReportRows.length} records` : ''}
                </span>
                <div>
                  <button className="reports-button reports-button-primary reports-button-small" disabled={template.id === 'incidents' && incidentsLoading} onClick={() => generateReport(template)} type="button"><FileText size={13} /> {template.id === 'incidents' && incidentsLoading ? 'Loading incidents' : 'Generate'}</button>
                  <button className="reports-button reports-button-secondary reports-button-small" onClick={() => openSchedule(template.id)} type="button"><CalendarDays size={13} /> Schedule</button>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      {incidentLoadError && <p className="reports-incident-error" role="alert">Incident records could not be loaded: {incidentLoadError}</p>}

      <section className="reports-lower-grid">
        <article className="reports-panel reports-recent-panel" ref={recentReportsRef}>
          <header className="reports-panel-header">
            <div><FileText size={16} /><h2>Recent reports</h2></div>
            <select aria-label="Filter recent reports by age" onChange={(event) => setRecentRange(event.target.value)} value={recentRange}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All generated</option>
            </select>
          </header>
          {visibleRecentReports.length ? (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead><tr><th>Report</th><th>Period</th><th>Generated</th><th>Scope</th><th>Format</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {visibleRecentReports.map((report) => {
                    const template = templateById.get(report.templateId || report.id.split('-')[0])
                    return (
                      <tr key={report.id}>
                        <td><FileText size={14} /><strong>{template?.title || 'Workspace report'}</strong></td>
                        <td>Active dataset</td>
                        <td>{formatGeneratedAt(report.generatedAt)}</td>
                        <td>{report.rows.length.toLocaleString()} records</td>
                        <td><span className="reports-format-pill">CSV</span></td>
                        <td><button aria-label={`Download ${template?.title || 'report'}`} className="reports-download-button" onClick={() => downloadReport(report)} type="button"><Download size={14} /> Download</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="reports-empty-state">
              <FileText size={22} />
              <strong>No reports generated in this period</strong>
              <span>Choose a report template above to create a downloadable, dataset-backed report.</span>
            </div>
          )}
          <p className="reports-retention-note">Generated reports are available in this session. Download a report to keep a copy.</p>
        </article>

        <article className="reports-panel reports-summary-panel">
          <header className="reports-panel-header">
            <div><Activity size={16} /><h2>Operations summary · draft</h2></div>
            <span className="reports-draft-badge">Draft</span>
          </header>
          <p className="reports-summary-intro">Based on {rows.length.toLocaleString()} records in <strong>{fileName}</strong>. This is a current-dataset summary, not a scheduled 24-hour report.</p>
          <ul className="reports-summary-list">
            <li><span className="summary-icon blue"><CarFront size={15} /></span><div><strong>{summary[0]?.value || '0'} vehicle observations</strong><span>{summary[3]?.value || '0'} vehicle classes represented in the active dataset.</span></div></li>
            <li><span className="summary-icon red"><AlertTriangle size={15} /></span><div><strong>{summary[2]?.value || '0'} speed-limit exceptions</strong><span>Derived from speed and speed-limit fields in available records.</span></div></li>
            <li><span className="summary-icon orange"><Route size={15} /></span><div><strong>Average observed speed: {summary[1]?.value || 'Not available'}</strong><span>Calculated from rows with a numeric speed measurement.</span></div></li>
            <li><span className="summary-icon purple"><MapPin size={15} /></span><div><strong>{summary[4]?.value || '0'} locations represented</strong><span>Based on road and location fields; this does not imply route travel time.</span></div></li>
            <li><span className="summary-icon green"><Camera size={15} /></span><div><strong>{summary[5]?.value || '0'} camera IDs observed</strong><span>Detection coverage only; device health is not available from this dataset.</span></div></li>
            <li><span className="summary-icon yellow"><IndianRupee size={15} /></span><div><strong>Toll and asset-health data are not connected here</strong><span>Use the Toll & Revenue and Camera Network tabs for those source workflows.</span></div></li>
          </ul>
          <div className="reports-summary-footnote"><CheckCircle2 size={14} /> Summary figures are calculated from the selected project’s active records.</div>
        </article>
      </section>

      {scheduledReportId && (
        <div className="reports-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setScheduledReportId('')}>
          <form aria-label="Schedule report" className="reports-schedule-modal" onSubmit={saveSchedule}>
            <header><div><CalendarDays size={18} /><h2>Schedule a report</h2></div><button aria-label="Close schedule" onClick={() => setScheduledReportId('')} type="button"><X size={18} /></button></header>
            <label>Report template<select onChange={(event) => openSchedule(event.target.value)} value={scheduledReportId}>{REPORT_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label>
            <label>Frequency<select onChange={(event) => setScheduleFrequency(event.target.value)} value={scheduleFrequency}><option>Daily</option><option>Weekly · Monday</option><option>Weekly · Friday</option><option>Monthly</option><option>Quarterly</option><option>On demand</option></select></label>
            <label>Preferred time<input onChange={(event) => setScheduleTime(event.target.value)} type="time" value={scheduleTime} /></label>
            <p className="reports-schedule-note"><Clock3 size={14} /> Schedule preferences are held for this session. Automatic generation and email delivery are not configured.</p>
            {scheduleMessage && <p className="reports-schedule-success" role="status"><CheckCircle2 size={14} />{scheduleMessage}</p>}
            <footer><button className="reports-button reports-button-secondary" onClick={() => setScheduledReportId('')} type="button">Cancel</button><button className="reports-button reports-button-primary" type="submit">Save preference</button></footer>
          </form>
        </div>
      )}
    </div>
  )
}
