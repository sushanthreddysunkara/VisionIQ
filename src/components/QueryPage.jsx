import { useMemo, useState } from 'react'
import {
  ArrowUpDown,
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Download,
  Filter,
  Layers,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  SunMedium,
  TrafficCone,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import { getVehicleMeta } from '../data/vehicleTypes'
import VehicleBadge from './VehicleBadge'
import QueryKnowledgeGraph from './query/QueryKnowledgeGraph'

export default function QueryPage({ rows = [], fileName = 'Active Dataset' }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('ALL')
  const [selectedLocation, setSelectedLocation] = useState('ALL')
  const [selectedCamera, setSelectedCamera] = useState('ALL')
  const [selectedSignal, setSelectedSignal] = useState('ALL')
  const [selectedWeather, setSelectedWeather] = useState('ALL')
  const [sortBy, setSortBy] = useState('timestamp-desc')
  const [viewMode, setViewMode] = useState('graph') // 'graph' | 'table' | 'cards'
  const [previewMode, setPreviewMode] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [queryHistory, setQueryHistory] = useState([])
  const [graphFocusId, setGraphFocusId] = useState(null)

  // Extract unique facets from dataset
  const facets = useMemo(() => {
    const types = Array.from(new Set(rows.map((r) => r.type).filter(Boolean))).sort()
    const locations = Array.from(new Set(rows.map((r) => r.roadName || r.location).filter(Boolean))).sort()
    const cameras = Array.from(new Set(rows.map((r) => r.camera).filter(Boolean))).sort()
    const signals = Array.from(new Set(rows.map((r) => r.signalState).filter(Boolean))).sort()
    const weathers = Array.from(new Set(rows.map((r) => r.weather).filter(Boolean))).sort()
    return { types, locations, cameras, signals, weathers }
  }, [rows])

  // Filter to primary real vehicle/pedestrian categories
  const primaryTypes = useMemo(() => {
    return facets.types.filter((t) => {
      const lower = t.toLowerCase()
      return !lower.includes('sign') && !lower.includes('signal')
    })
  }, [facets.types])

  // Count detections by vehicle type in the current dataset
  const vehicleCounts = useMemo(() => {
    const counts = {}
    rows.forEach((r) => {
      const t = r.type || 'Unknown'
      counts[t] = (counts[t] || 0) + 1
    })
    return counts
  }, [rows])

  // Preset search suggestions covering every vehicle category & telemetry attributes
  const suggestions = useMemo(() => {
    return [
      'Cars',
      'Bikes',
      'Buses',
      'Trucks',
      'Tractors',
      'Jeeps',
      'Pedestrians',
      'Green Signal',
      'Red Signal',
      'Clear Weather',
      'High Confidence > 90%',
    ]
  }, [])

  // Filter and search logic with intelligent vehicle identification & telemetry fields
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return rows
      .filter((row) => {
        // 1. Facet Filters
        if (selectedType !== 'ALL' && row.type !== selectedType) return false
        if (selectedLocation !== 'ALL' && (row.roadName !== selectedLocation && row.location !== selectedLocation)) return false
        if (selectedCamera !== 'ALL' && row.camera !== selectedCamera) return false
        if (selectedSignal !== 'ALL' && row.signalState !== selectedSignal) return false
        if (selectedWeather !== 'ALL' && row.weather !== selectedWeather) return false

        // 2. Freeform Search Query
        if (!query) return true

        // Numerical volume / confidence queries
        if (query.startsWith('>') || query.includes('>')) {
          const num = parseFloat(query.replace(/[^0-9.]/g, ''))
          if (!isNaN(num)) {
            if (num <= 1) return (row.confidence || 0) > num
            if (num > 50 && num <= 100 && (row.confidence || 0) <= 1) return ((row.confidence || 0) * 100) > num
            return (row.volume || 1) > num
          }
        }
        if (query.startsWith('<') || query.includes('<')) {
          const num = parseFloat(query.replace(/[^0-9.]/g, ''))
          if (!isNaN(num)) return (row.volume || 1) < num
        }

        // Special quick keyword queries
        const rowTypeLower = (row.type || '').toLowerCase()
        const signalLower = (row.signalState || '').toLowerCase()
        const weatherLower = (row.weather || '').toLowerCase()

        if (query === 'cars' || query === 'car') return rowTypeLower.includes('car')
        if (query === 'bikes' || query === 'bike' || query === 'motorcycle' || query === 'bicycle' || query === 'scooter') {
          return rowTypeLower.includes('bike') || rowTypeLower.includes('cycle') || rowTypeLower.includes('scooter')
        }
        if (query === 'buses' || query === 'bus') return rowTypeLower.includes('bus')
        if (query === 'trucks' || query === 'truck' || query === 'lorry' || query === 'trailer') {
          return rowTypeLower.includes('truck') || rowTypeLower.includes('lorry') || rowTypeLower.includes('trailer')
        }
        if (query === 'tractors' || query === 'tractor' || query === 'tractr') {
          return rowTypeLower.includes('tractor') || rowTypeLower.includes('tractr')
        }
        if (query === 'jeeps' || query === 'jeep' || query === 'suv' || query === '4x4') {
          return rowTypeLower.includes('jeep') || rowTypeLower.includes('suv')
        }
        if (query === 'autos' || query === 'auto' || query === 'rickshaw') {
          return rowTypeLower.includes('auto') || rowTypeLower.includes('rickshaw')
        }
        if (query === 'vans' || query === 'van') return rowTypeLower.includes('van')
        if (query === 'trains' || query === 'train' || query === 'metro' || query === 'rail' || query === 'tram') {
          return rowTypeLower.includes('train') || rowTypeLower.includes('metro') || rowTypeLower.includes('rail') || rowTypeLower.includes('tram')
        }
        if (
          query === 'pedestrians' ||
          query === 'pedestrian' ||
          query === 'edisetrains' ||
          query === 'edisetrain' ||
          query === 'pedestrain' ||
          query.includes('pedestrian') ||
          query === 'walking'
        ) {
          return rowTypeLower.includes('pedestrian') || rowTypeLower.includes('edisetrain') || (row.pedestrians || 0) > 0
        }
        if (query === 'green signal' || query === 'green') return signalLower === 'green'
        if (query === 'red signal' || query === 'red') return signalLower === 'red'
        if (query === 'yellow signal' || query === 'yellow' || query === 'amber') return signalLower === 'yellow' || signalLower === 'amber'
        if (query.includes('weather')) return weatherLower.includes(query.replace('weather', '').trim())

        // Multi-attribute search across all 20 schema fields
        const terms = query.split(/\s+/).filter(Boolean)
        const rowSearchString = [
          row.observationId,
          row.type,
          row.numberPlate,
          row.roadName,
          row.location,
          row.junctionId,
          row.camera,
          row.cameraDirection,
          row.signalState,
          row.weather,
          row.time,
          row.date,
          row.timestamp,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return terms.every((term) => {
          const singularTerm = term.endsWith('s') && term.length > 3 ? term.slice(0, -1) : term
          return rowSearchString.includes(term) || rowSearchString.includes(singularTerm)
        })
      })
      .sort((a, b) => {
        if (sortBy === 'confidence-desc') return (b.confidence || 0) - (a.confidence || 0)
        if (sortBy === 'confidence-asc') return (a.confidence || 0) - (b.confidence || 0)
        if (sortBy === 'volume-desc') return (b.volume || 0) - (a.volume || 0)
        if (sortBy === 'timestamp-desc') return String(b.time || b.timestamp).localeCompare(String(a.time || a.timestamp))
        if (sortBy === 'timestamp-asc') return String(a.time || a.timestamp).localeCompare(String(b.time || b.timestamp))
        return 0
      })
  }, [rows, searchQuery, selectedType, selectedLocation, selectedCamera, selectedSignal, selectedWeather, sortBy])

  // Summary statistics for the filtered result set
  const filteredStats = useMemo(() => {
    const totalRecords = filteredRows.length
    const uniquePlates = new Set(filteredRows.map((r) => r.numberPlate).filter((p) => p && p !== 'N/A')).size
    const uniqueLocations = new Set(filteredRows.map((r) => r.roadName || r.location).filter(Boolean)).size
    const uniqueCameras = new Set(filteredRows.map((r) => r.camera).filter(Boolean)).size
    const avgConfidence = filteredRows.length
      ? Math.round(
        (filteredRows.reduce((sum, r) => sum + (r.confidence > 1 ? r.confidence : r.confidence * 100), 0) /
          filteredRows.length)
      )
      : 0
    return { totalRecords, uniquePlates, uniqueLocations, uniqueCameras, avgConfidence }
  }, [filteredRows])

  // CSV Export for filtered query results in the exact 20-column schema
  function exportQueryResults() {
    if (!filteredRows.length) return
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

    const csvContent = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          r.observationId || 'OBS-0001',
          r.camera,
          r.junctionId || 'JNC-01',
          `"${r.roadName || r.location}"`,
          r.date || '2026-09-11',
          r.time || r.timestamp,
          r.timezone || 'IST',
          r.cameraDirection || 'North',
          r.type,
          r.numberPlate || 'N/A',
          r.signalState || 'Green',
          r.latitude || 17.4485,
          r.longitude || 78.3742,
          r.bboxX || 120,
          r.bboxY || 340,
          r.bboxWidth || 180,
          r.bboxHeight || 140,
          r.confidence || 0.95,
          r.distance || 18.0,
          r.weather || 'Clear',
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `traffic_telemetry_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function pushHistory() {
    setQueryHistory((prev) => [
      ...prev,
      {
        searchQuery,
        selectedType,
        selectedLocation,
        selectedCamera,
        selectedSignal,
        selectedWeather,
        viewMode,
        previewMode,
        currentPage,
      },
    ])
  }

  function handleUndoQuery() {
    if (!queryHistory.length) return
    const prev = queryHistory[queryHistory.length - 1]
    setQueryHistory((hist) => hist.slice(0, -1))
    setSearchQuery(prev.searchQuery)
    setSelectedType(prev.selectedType)
    setSelectedLocation(prev.selectedLocation)
    setSelectedCamera(prev.selectedCamera)
    setSelectedSignal(prev.selectedSignal)
    setSelectedWeather(prev.selectedWeather)
    setViewMode(prev.viewMode)
    setPreviewMode(prev.previewMode)
    setCurrentPage(prev.currentPage)
    setGraphFocusId(null)
  }

  function handleQuickSuggestion(item) {
    pushHistory()
    setCurrentPage(1)
    setViewMode('graph')
    setGraphFocusId(null)
    if (item === 'Green Signal') {
      setSelectedSignal('Green')
    } else if (item === 'Red Signal') {
      setSelectedSignal('Red')
    } else if (item === 'Clear Weather') {
      setSelectedWeather('Clear')
    } else if (item.startsWith('High Confidence')) {
      setSearchQuery('> 0.90')
    } else {
      setSearchQuery(item)
    }
  }

  function handleSelectType(type) {
    pushHistory()
    setSelectedType(type)
    setCurrentPage(1)
    setViewMode('graph')
    setGraphFocusId(null)
  }

  function clearAllFilters() {
    pushHistory()
    setSearchQuery('')
    setSelectedType('ALL')
    setSelectedLocation('ALL')
    setSelectedCamera('ALL')
    setSelectedSignal('ALL')
    setSelectedWeather('ALL')
    setPreviewMode(false)
    setCurrentPage(1)
    setGraphFocusId(null)
  }

  function handleFocusInGraph(obsId) {
    setGraphFocusId(obsId)
    setViewMode('graph')
  }

  const activeQueryLabel = useMemo(() => {
    const parts = []
    if (searchQuery) parts.push(`"${searchQuery}"`)
    if (selectedType !== 'ALL') parts.push(`Type: ${selectedType}`)
    if (selectedLocation !== 'ALL') parts.push(`Road: ${selectedLocation}`)
    if (selectedCamera !== 'ALL') parts.push(`Cam: ${selectedCamera}`)
    if (selectedSignal !== 'ALL') parts.push(`Signal: ${selectedSignal}`)
    if (selectedWeather !== 'ALL') parts.push(`Weather: ${selectedWeather}`)
    if (!parts.length) return previewMode ? 'Preview Dataset' : 'All Traffic Telemetry'
    return parts.join(' · ')
  }, [searchQuery, selectedType, selectedLocation, selectedCamera, selectedSignal, selectedWeather, previewMode])

  const hasActiveFilters = Boolean(
    searchQuery ||
    selectedType !== 'ALL' ||
    selectedLocation !== 'ALL' ||
    selectedCamera !== 'ALL' ||
    selectedSignal !== 'ALL' ||
    selectedWeather !== 'ALL'
  )

  const isQueryActive = hasActiveFilters || previewMode

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => {
    if (!isQueryActive) return []
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, isQueryActive, currentPage, pageSize])

  const getPageNumbers = () => {
    const pages = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
      }
    }
    return pages
  }

  return (
    <div className="query-page">
      {/* Intro Header */}
      <div className="page-intro query-page-header">
        <div>
          <p className="section-kicker">INTELLIGENT TRAFFIC TELEMETRY QUERY ENGINE</p>
          <h1>Traffic Telemetry Query & Search</h1>
          <p className="intro-copy">
            Search, filter, and inspect real-time camera detections, vehicle plates, signals, and coordinates in <strong>{fileName}</strong>.
          </p>
        </div>

        <div className="query-header-actions">
          <button
            className="query-export-btn"
            disabled={!filteredRows.length}
            onClick={exportQueryResults}
            title="Export filtered records to 20-column CSV"
            type="button"
          >
            <Download size={15} />
            <span>Export CSV ({filteredRows.length})</span>
          </button>
        </div>
      </div>

      {/* Streamlined Search Console */}
      <div className="query-search-console">
        <div className="query-search-row">
          <div className="query-input-box">
            <Search className="query-search-icon" size={18} />
            <input
              autoFocus
              className="query-search-input"
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  pushHistory()
                  setViewMode('graph')
                }
              }}
              placeholder="Search by vehicle, plate, road, junction, camera, signal..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="query-clear-search-btn"
                onClick={() => {
                  pushHistory()
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
                title="Clear search"
                type="button"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="query-search-actions-group">
            <button
              className="query-execute-graph-btn"
              onClick={() => {
                pushHistory()
                setViewMode('graph')
              }}
              title="Generate and view Knowledge Graph for this query"
              type="button"
            >
              <Network size={14} />
              <span>Graph Query</span>
            </button>

            {queryHistory.length > 0 && (
              <button
                className="query-undo-btn"
                onClick={handleUndoQuery}
                title="Revert / Undo last query action"
                type="button"
              >
                <Undo2 size={14} />
                <span>Undo</span>
              </button>
            )}
          </div>
        </div>

        {/* Curated Category Filter Chips */}
        <div className="query-vehicle-bar">
          <span className="query-vehicle-bar-label">
            <Layers size={13} /> Filters:
          </span>
          <div className="query-vehicle-chips-wrap">
            <button
              className={`query-vehicle-pill-btn ${selectedType === 'ALL' && selectedSignal === 'ALL' && !searchQuery ? 'active' : ''}`}
              onClick={() => {
                handleSelectType('ALL')
                setSelectedSignal('ALL')
              }}
              type="button"
            >
              All Types <span className="query-pill-count">{rows.length}</span>
            </button>
            {primaryTypes.map((type) => {
              const meta = getVehicleMeta(type)
              const Icon = meta.icon
              const count = vehicleCounts[type] || 0
              const isActive = selectedType === type

              return (
                <button
                  className={`query-vehicle-pill-btn ${isActive ? 'active' : ''}`}
                  key={type}
                  onClick={() => handleSelectType(isActive ? 'ALL' : type)}
                  style={{
                    color: isActive ? '#ffffff' : meta.color,
                    backgroundColor: isActive ? meta.color : meta.bg,
                    borderColor: meta.border,
                  }}
                  title={`Filter to ${type} (${count} records)`}
                  type="button"
                >
                  <Icon size={13} />
                  <span>{type}</span>
                  <span
                    className="query-pill-count"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                      color: isActive ? '#ffffff' : meta.color,
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}

            {/* Quick High-Impact Toggle */}
            <button
              className={`query-vehicle-pill-btn ${selectedSignal === 'Red' ? 'active' : ''}`}
              onClick={() => {
                pushHistory()
                setSelectedSignal(selectedSignal === 'Red' ? 'ALL' : 'Red')
                setCurrentPage(1)
                setViewMode('graph')
              }}
              style={{
                color: selectedSignal === 'Red' ? '#ffffff' : '#ef4444',
                backgroundColor: selectedSignal === 'Red' ? '#ef4444' : '#fef2f2',
                borderColor: '#fecaca',
              }}
              title="Filter to Red Signal Violations"
              type="button"
            >
              <TrafficCone size={13} />
              <span>Red Signal</span>
            </button>
          </div>
        </div>

        {/* Compact Filter Controls */}
        <div className="query-filters-bar">
          <div className="query-filter-group">
            <label>
              <MapPin size={14} /> Road:
            </label>
            <select
              onChange={(e) => {
                pushHistory()
                setSelectedLocation(e.target.value)
                setCurrentPage(1)
              }}
              value={selectedLocation}
            >
              <option value="ALL">All Roads ({facets.locations.length})</option>
              {facets.locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="query-filter-group">
            <label>
              <Camera size={14} /> Camera:
            </label>
            <select
              onChange={(e) => {
                pushHistory()
                setSelectedCamera(e.target.value)
                setCurrentPage(1)
              }}
              value={selectedCamera}
            >
              <option value="ALL">All Cameras ({facets.cameras.length})</option>
              {facets.cameras.map((cam) => (
                <option key={cam} value={cam}>
                  {cam}
                </option>
              ))}
            </select>
          </div>

          <div className="query-filter-group query-sort-group">
            <label>
              <ArrowUpDown size={14} /> Sort:
            </label>
            <select
              onChange={(e) => {
                setSortBy(e.target.value)
                setCurrentPage(1)
              }}
              value={sortBy}
            >
              <option value="timestamp-desc">Timestamp (Recent first)</option>
              <option value="timestamp-asc">Timestamp (Earliest first)</option>
              <option value="confidence-desc">Confidence (High to Low)</option>
              <option value="confidence-asc">Confidence (Low to High)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button className="query-reset-btn" onClick={clearAllFilters} type="button">
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* When no query is active: Show Clean Starter State (DO NOT SHOW ALL DATA DOWN) */}
      {!isQueryActive ? (
        <div className="query-empty-results query-start-prompt">
          <div className="query-start-icon-wrap">
            <Search size={28} />
          </div>
          <h2>Ready to Query Traffic Telemetry</h2>
          <p>
            Enter a keyword above (e.g. number plate, vehicle, road name, camera ID), select a category chip, or click any quick query below.
          </p>
          <div className="query-quick-actions">
            <button
              className="query-quick-action-btn"
              onClick={() => handleQuickSuggestion('Cars')}
              type="button"
            >
              🚗 Query Cars ({vehicleCounts['Car'] || vehicleCounts['car'] || 0})
            </button>
            <button
              className="query-quick-action-btn"
              onClick={() => handleQuickSuggestion('Bikes')}
              type="button"
            >
              🏍️ Query Bikes ({vehicleCounts['Bike'] || vehicleCounts['Motorcycle'] || vehicleCounts['bike'] || 0})
            </button>
            <button
              className="query-quick-action-btn"
              onClick={() => handleQuickSuggestion('Buses')}
              type="button"
            >
              🚌 Query Buses ({vehicleCounts['Bus'] || vehicleCounts['bus'] || 0})
            </button>
            <button
              className="query-quick-action-btn"
              onClick={() => handleQuickSuggestion('Trucks')}
              type="button"
            >
              🚛 Query Trucks ({vehicleCounts['Truck'] || vehicleCounts['truck'] || 0})
            </button>
            <button
              className="query-quick-action-btn"
              onClick={() => handleQuickSuggestion('Red Signal')}
              type="button"
            >
              🛑 Red Signal Violations
            </button>
            <button
              className="query-quick-action-btn"
              onClick={() => handleQuickSuggestion('Pedestrians')}
              type="button"
            >
              🚶 Pedestrians
            </button>
            <button
              className="query-quick-action-btn secondary"
              onClick={() => {
                setPreviewMode(true)
                setCurrentPage(1)
              }}
              type="button"
            >
              📄 Preview First 10 Records
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Query Stats Ribbon */}
          <div className="query-stats-ribbon">
            <div className="query-stat-item">
              <strong>{filteredStats.totalRecords}</strong>
              <span>Matching Detections</span>
            </div>
            <div className="query-stat-item">
              <strong>{filteredStats.uniquePlates}</strong>
              <span>Identified Plates</span>
            </div>
            <div className="query-stat-item">
              <strong>{filteredStats.avgConfidence}%</strong>
              <span>Avg Confidence</span>
            </div>
            <div className="query-stat-item">
              <strong>{filteredStats.uniqueLocations}</strong>
              <span>Roads / Junctions</span>
            </div>
            <div className="query-stat-item">
              <strong>{filteredStats.uniqueCameras}</strong>
              <span>Active Cameras</span>
            </div>
          </div>

          {/* View Switcher, Counter & Preview Status */}
          <div className="query-view-toolbar">
            <span className="query-counter-text">
              Showing <strong>{paginatedRows.length ? (currentPage - 1) * pageSize + 1 : 0}</strong>–
              <strong>{Math.min(currentPage * pageSize, filteredRows.length)}</strong> of{' '}
              <strong>{filteredRows.length}</strong> matching records
              {searchQuery && (
                <span>
                  {' '}
                  matching &ldquo;<em>{searchQuery}</em>&rdquo;
                </span>
              )}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {previewMode && !hasActiveFilters && (
                <button
                  className="query-reset-btn"
                  onClick={() => setPreviewMode(false)}
                  style={{ fontSize: '11px', padding: '4px 9px' }}
                  type="button"
                >
                  Close Preview
                </button>
              )}

              <div className="query-view-buttons">
                <button
                  className={`query-view-btn ${viewMode === 'graph' ? 'active' : ''}`}
                  onClick={() => setViewMode('graph')}
                  type="button"
                >
                  <Network size={14} />
                  <span>Knowledge Graph</span>
                </button>
                <button
                  className={`query-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  type="button"
                >
                  Table View
                </button>

              </div>
            </div>
          </div>

          {/* Results Rendering (Paginated or Graph) */}
          {filteredRows.length === 0 ? (
            <div className="query-empty-results">
              <Search size={36} />
              <h2>No matching traffic telemetry found</h2>
              <p>
                No entries matched your query <strong>&ldquo;{searchQuery}&rdquo;</strong>. Try adjusting your search term
                or resetting the filters.
              </p>
              <button className="data-import-sample-btn" onClick={clearAllFilters} type="button">
                Clear Filters
              </button>
            </div>
          ) : viewMode === 'graph' ? (
            <QueryKnowledgeGraph
              initialSelectedId={graphFocusId}
              onClose={() => setViewMode('table')}
              queryLabel={activeQueryLabel}
              rows={filteredRows}
            />
          ) : (
            <div className="query-table-wrapper">
              <table className="query-results-table">
                <thead>
                  <tr>
                    <th>VEHICLE / OBJECT</th>
                    <th>NUMBER PLATE</th>
                    <th>ROAD & JUNCTION</th>
                    <th>CAMERA & HEADING</th>
                    <th>SIGNAL</th>
                    <th>CONFIDENCE</th>
                    <th>WEATHER</th>
                    <th>TIMESTAMP</th>
                    <th>GRAPH</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, idx) => (
                    <tr key={`${row.observationId || row.camera}-${row.time || row.timestamp}-${idx}`}>
                      <td>
                        <VehicleBadge type={row.type} />
                      </td>
                      <td>
                        {row.numberPlate && row.numberPlate !== 'N/A' ? (
                          <span className="query-plate-badge">{row.numberPlate}</span>
                        ) : (
                          <span className="query-plate-na">—</span>
                        )}
                      </td>
                      <td>
                        <div className="query-road-cell">
                          <strong>{row.roadName || row.location}</strong>
                          {row.junctionId && <span className="query-jnc-tag">{row.junctionId}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="query-cam-cell">
                          <code className="query-camera-code">{row.camera}</code>
                          {row.cameraDirection && (
                            <span className="query-heading-tag">{row.cameraDirection}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`query-signal-pill signal-${(row.signalState || 'green').toLowerCase()}`}>
                          {row.signalState || 'Green'}
                        </span>
                      </td>
                      <td>
                        <span className="query-confidence-badge">
                          {Math.round(row.confidence > 1 ? row.confidence : (row.confidence || 0.9) * 100)}%
                        </span>
                      </td>
                      <td>
                        <span className="query-weather-tag">{row.weather || 'Clear'}</span>
                      </td>
                      <td>
                        <span className="query-time-cell">
                          <Clock size={12} />
                          {row.time || row.timestamp}
                        </span>
                      </td>
                      <td>
                        <button
                          className="query-row-graph-btn"
                          onClick={() => handleFocusInGraph(row.observationId || row.numberPlate)}
                          title="Inspect in Knowledge Graph"
                          type="button"
                        >
                          <Network size={13} />
                          <span>Graph</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Clean Pagination Bar */}
          {viewMode !== 'graph' && filteredRows.length > 0 && (
            <div className="query-pagination-bar">
              <div className="query-pagination-info">
                <span>
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredRows.length} total)
                </span>
                <div className="query-page-size-selector">
                  <label htmlFor="query-page-size">Per page:</label>
                  <select
                    id="query-page-size"
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    value={pageSize}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="query-pagination-controls">
                <button
                  className="query-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="Previous page"
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers().map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: '#94a3b8' }}>
                      …
                    </span>
                  ) : (
                    <button
                      className={`query-page-btn ${currentPage === p ? 'active' : ''}`}
                      key={`page-${p}`}
                      onClick={() => setCurrentPage(p)}
                      type="button"
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  className="query-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  title="Next page"
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
