import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  Download,
  Eye,
  FileVideo,
  Filter,
  Image as ImageIcon,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Table2,
  TrafficCone,
  Users,
  Video,
  X,
} from 'lucide-react'
import VehicleBadge from './VehicleBadge'
import QueryKnowledgeGraph from './query/QueryKnowledgeGraph'
import MediaPreviewModal from './MediaPreviewModal'
import VehicleImageThumbnail from './VehicleImageThumbnail'
import { isVehicleTypeMatch } from '../data/vehicleTypes'
import { checkOllamaStatus, parseNaturalLanguageQuery, parseQueryClient } from '../services/queryApi'

export default function QueryPage({ rows = [], fileName = 'Active Dataset' }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [sortBy, setSortBy] = useState('timestamp-desc')
  const [viewMode, setViewMode] = useState('graph') // Knowledge Graph first, then table view
  const [previewMode, setPreviewMode] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [queryHistory, setQueryHistory] = useState([])
  const [graphFocusId, setGraphFocusId] = useState(null)
  const [previewModalRow, setPreviewModalRow] = useState(null)
  const [initialModalTab, setInitialModalTab] = useState('vehicle')

  // Ollama AI Query State
  const [ollamaStatus, setOllamaStatus] = useState({ connected: false, loading: true, targetModel: 'qwen3:8b' })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiFilters, setAiFilters] = useState(null)
  const [aiExplanation, setAiExplanation] = useState('')
  const [aiSource, setAiSource] = useState('')

  useEffect(() => {
    let active = true
    checkOllamaStatus()
      .then((status) => {
        if (active) setOllamaStatus(status)
      })
      .catch(() => {
        if (active) setOllamaStatus({ connected: false, loading: false, targetModel: 'qwen3:8b' })
      })
    return () => { active = false }
  }, [])

  // Extract unique facets from dataset for grounding AI prompts
  const facets = useMemo(() => {
    const types = Array.from(new Set(rows.map((r) => r.vehicleType || r.type).filter(Boolean))).sort()
    const locations = Array.from(new Set(rows.map((r) => r.roadName || r.location).filter(Boolean))).sort()
    const cameras = Array.from(new Set(rows.map((r) => r.camera).filter(Boolean))).sort()
    const signals = Array.from(new Set(rows.map((r) => r.signalState).filter(Boolean))).sort()
    const weathers = Array.from(new Set(rows.map((r) => r.weather).filter(Boolean))).sort()
    return { types, locations, cameras, signals, weathers }
  }, [rows])

  // Filter and search logic with intelligent vehicle identification & telemetry fields
  const filteredRows = useMemo(() => {
    const query = submittedQuery.trim().toLowerCase()

    return rows
      .filter((row) => {
        const rowTypeLower = (row.vehicleType || row.type || '').toLowerCase()
        const signalLower = (row.signalState || '').toLowerCase()
        const weatherLower = (row.weather || '').toLowerCase()

        // 0. AI Structured Natural Language Filters
        if (aiFilters) {
          if (aiFilters.vehicleTypes || aiFilters.vehicleType) {
            const rawTypes = []
            if (Array.isArray(aiFilters.vehicleTypes)) rawTypes.push(...aiFilters.vehicleTypes)
            if (Array.isArray(aiFilters.vehicleType)) rawTypes.push(...aiFilters.vehicleType)
            else if (typeof aiFilters.vehicleType === 'string') rawTypes.push(aiFilters.vehicleType)

            if (rawTypes.length) {
              const matchedType = rawTypes.some((typeVal) => isVehicleTypeMatch(row.vehicleType || row.type, typeVal))
              if (!matchedType) return false
            }
          }
          if (aiFilters.location) {
            const rawLocs = Array.isArray(aiFilters.location)
              ? aiFilters.location
              : typeof aiFilters.location === 'string'
                ? [aiFilters.location]
                : [String(aiFilters.location)]

            const loc = (row.roadName || row.location || '').toLowerCase().trim()
            const locWords = loc.split(/\s+/).filter((w) => w.length > 2)

            const matchedLoc = rawLocs.some((locVal) => {
              if (!locVal) return false
              const target = String(locVal).toLowerCase().trim()
              const targetWords = target.split(/\s+/).filter((w) => w.length > 2)
              return (
                loc.includes(target) ||
                target.includes(loc) ||
                targetWords.some((w) => loc.includes(w)) ||
                locWords.some((w) => target.includes(w))
              )
            })
            if (!matchedLoc) return false
          }
          if (aiFilters.camera) {
            const rawCams = Array.isArray(aiFilters.camera)
              ? aiFilters.camera
              : [aiFilters.camera]
            const cam = (row.camera || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            const matchedCam = rawCams.some((camVal) => {
              if (!camVal) return false
              const targetCam = String(camVal).toLowerCase().replace(/[^a-z0-9]/g, '')
              return cam && targetCam && (cam.includes(targetCam) || targetCam.includes(cam))
            })
            if (!matchedCam) return false
          }
          if (aiFilters.signalState) {
            const targetSig = String(aiFilters.signalState).toLowerCase().trim()
            if (signalLower !== targetSig) return false
          }
          if (aiFilters.weather) {
            const targetWeather = String(aiFilters.weather).toLowerCase().trim()
            if (!weatherLower.includes(targetWeather)) return false
          }
          if (aiFilters.overspeedOnly) {
            const isOver = row.overSpeed === 'Yes' || row.isOverSpeed === true || (row.speed && row.speedLimit && row.speed > row.speedLimit)
            if (!isOver) return false
          }
          if (aiFilters.minSpeed !== null && aiFilters.minSpeed !== undefined && Number(aiFilters.minSpeed) > 0) {
            if ((row.speed || 0) < Number(aiFilters.minSpeed)) return false
          }
          if (aiFilters.maxSpeed !== null && aiFilters.maxSpeed !== undefined && Number(aiFilters.maxSpeed) > 0) {
            if ((row.speed || 0) > Number(aiFilters.maxSpeed)) return false
          }
          if (aiFilters.plateSearch) {
            const targetPlate = String(aiFilters.plateSearch).toUpperCase().replace(/[^A-Z0-9]/g, '')
            const plate = String(row.numberPlate || row.vehicleNumberPlate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
            if (!plate.includes(targetPlate)) return false
          }

          // Matched all structured AI criteria if any were set
          const hasAnyCriteria = Boolean(
            (aiFilters.vehicleTypes && aiFilters.vehicleTypes.length) ||
            aiFilters.vehicleType ||
            aiFilters.location ||
            aiFilters.camera ||
            aiFilters.signalState ||
            aiFilters.weather ||
            aiFilters.overspeedOnly ||
            (aiFilters.minSpeed !== null && aiFilters.minSpeed !== undefined) ||
            (aiFilters.maxSpeed !== null && aiFilters.maxSpeed !== undefined) ||
            aiFilters.plateSearch
          )
          if (hasAnyCriteria) return true
        }

        // 1. Freeform Search Query (when AI not yet invoked)
        if (!query) return true

        // Speed queries (e.g. speed > 60, > 70)
        if (query.includes('speed') && (query.includes('>') || query.includes('<'))) {
          const num = parseFloat(query.replace(/[^0-9.]/g, ''))
          if (!isNaN(num)) {
            if (query.includes('>')) return (row.speed || 0) > num
            if (query.includes('<')) return (row.speed || 0) < num
          }
        }

        // Numerical volume / confidence queries
        if (query.startsWith('>') || query.includes('>')) {
          const num = parseFloat(query.replace(/[^0-9.]/g, ''))
          if (!isNaN(num)) {
            if (num <= 1) return (row.plateConfidence || row.confidence || 0) > num
            if (num > 50 && num <= 100 && (row.plateConfidence || row.confidence || 0) <= 1) {
              return ((row.plateConfidence || row.confidence || 0) * 100) > num
            }
            return (row.speed || row.volume || 1) > num
          }
        }
        if (query.startsWith('<') || query.includes('<')) {
          const num = parseFloat(query.replace(/[^0-9.]/g, ''))
          if (!isNaN(num)) return (row.speed || row.volume || 1) < num
        }

        // Special quick keyword queries
        if (query === 'overspeed' || query === 'over speed' || query === 'speed violation' || query === 'violation') {
          return row.overSpeed === 'Yes' || row.isOverSpeed
        }

        if (query === 'cars' || query === 'car') return isVehicleTypeMatch(row.vehicleType || row.type, 'car')
        if (query === 'bikes' || query === 'bike' || query === 'motorcycle' || query === 'bicycle' || query === 'scooter') {
          return isVehicleTypeMatch(row.vehicleType || row.type, 'bike')
        }
        if (query === 'buses' || query === 'bus') return isVehicleTypeMatch(row.vehicleType || row.type, 'bus')
        if (query === 'trucks' || query === 'truck' || query === 'lorry' || query === 'trailer') {
          return isVehicleTypeMatch(row.vehicleType || row.type, 'truck')
        }
        if (query === 'tractors' || query === 'tractor' || query === 'tractr') {
          return isVehicleTypeMatch(row.vehicleType || row.type, 'tractor')
        }
        if (query === 'jeeps' || query === 'jeep' || query === 'suv' || query === '4x4') {
          return isVehicleTypeMatch(row.vehicleType || row.type, 'jeep')
        }
        if (query === 'autos' || query === 'auto' || query === 'rickshaw') {
          return isVehicleTypeMatch(row.vehicleType || row.type, 'auto')
        }
        if (query === 'vans' || query === 'van') return isVehicleTypeMatch(row.vehicleType || row.type, 'van')
        if (query === 'trains' || query === 'train' || query === 'metro' || query === 'rail' || query === 'tram') {
          return isVehicleTypeMatch(row.vehicleType || row.type, 'train')
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
          return isVehicleTypeMatch(row.vehicleType || row.type, 'pedestrian') || (row.pedestrians || 0) > 0
        }
        if (query === 'green signal' || query === 'green') return signalLower === 'green'
        if (query === 'red signal' || query === 'red') return signalLower === 'red'
        if (query === 'yellow signal' || query === 'yellow' || query === 'amber') return signalLower === 'yellow' || signalLower === 'amber'
        if (query.includes('weather')) return weatherLower.includes(query.replace('weather', '').trim())

        // Multi-attribute search across all schema fields
        const STOP_WORDS = new Set(['show', 'all', 'me', 'find', 'get', 'list', 'the', 'in', 'on', 'at', 'with', 'and', 'or', 'for', 'of', 'to', 'from', 'any', 'where', 'please'])
        const rawTerms = query.split(/\s+/).filter(Boolean)
        const meaningfulTerms = rawTerms.filter((t) => !STOP_WORDS.has(t.toLowerCase()))
        const terms = meaningfulTerms.length ? meaningfulTerms : rawTerms

        const rowSearchString = [
          row.id,
          row.observationId,
          row.vehicleType,
          row.type,
          row.roadName,
          row.location,
          row.camera,
          row.signalState,
          row.weather,
          row.vehicleNumberPlate,
          row.numberPlate,
          row.speed ? `${row.speed}km/h` : '',
          row.speedLimit ? `${row.speedLimit}km/h` : '',
          row.overSpeed,
          (row.overSpeed === 'Yes' || row.isOverSpeed) ? 'overspeed speeding speed violation fast' : '',
          row.vehicleImage,
          row.videoClipPath,
          row.vehicleImagePath,
          row.plateImagePath,
          row.timestampIst,
          row.time,
          row.date,
          row.timestamp,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        // Check for multi-type or compound queries (e.g. "cars and bikes")
        const multiTypes = []
        if (/\b(?:car|cars|sedan|suv|hatchback)\b/i.test(query)) multiTypes.push('car')
        if (/\b(?:bike|bikes|motorcycle|motorcycles|scooter|scooters|two[- ]?wheelers?|cycle)\b/i.test(query)) multiTypes.push('bike')
        if (/\b(?:bus|buses)\b/i.test(query)) multiTypes.push('bus')
        if (/\b(?:truck|trucks|lorry|trailer)\b/i.test(query)) multiTypes.push('truck')
        if (/\b(?:auto|autos|rickshaw|rickshaws)\b/i.test(query)) multiTypes.push('auto')
        if (/\b(?:tractor|tractors)\b/i.test(query)) multiTypes.push('tractor')
        if (/\b(?:jeep|jeeps)\b/i.test(query)) multiTypes.push('jeep')
        if (/\b(?:pedestrian|pedestrians|walking|people|edisetrain)\b/i.test(query)) multiTypes.push('pedestrian')
        if (/\b(?:van|vans)\b/i.test(query)) multiTypes.push('van')
        if (/\b(?:train|trains|metro)\b/i.test(query)) multiTypes.push('train')

        if (multiTypes.length > 1) {
          const typeMatch = multiTypes.some((t) => isVehicleTypeMatch(row.vehicleType || row.type, t))
          if (!typeMatch) return false
          const nonTypeTerms = terms.filter(
            (term) => !multiTypes.some((t) => term.includes(t) || t.includes(term))
          )
          if (nonTypeTerms.length === 0) return true
          return nonTypeTerms.every((term) => {
            const singularTerm = term.endsWith('s') && term.length > 3 ? term.slice(0, -1) : term
            return rowSearchString.includes(term) || rowSearchString.includes(singularTerm)
          })
        }

        return terms.every((term) => {
          const singularTerm = term.endsWith('s') && term.length > 3 ? term.slice(0, -1) : term
          return rowSearchString.includes(term) || rowSearchString.includes(singularTerm)
        })

      })
      .sort((a, b) => {
        if (sortBy === 'speed-desc') return (b.speed || 0) - (a.speed || 0)
        if (sortBy === 'speed-asc') return (a.speed || 0) - (b.speed || 0)
        if (sortBy === 'confidence-desc') return (b.plateConfidence || b.confidence || 0) - (a.plateConfidence || a.confidence || 0)
        if (sortBy === 'confidence-asc') return (a.plateConfidence || a.confidence || 0) - (b.plateConfidence || b.confidence || 0)
        if (sortBy === 'volume-desc') return (b.volume || 0) - (a.volume || 0)
        if (sortBy === 'timestamp-desc') return String(b.timestampIst || b.time || b.timestamp).localeCompare(String(a.timestampIst || a.time || a.timestamp))
        if (sortBy === 'timestamp-asc') return String(a.timestampIst || a.time || a.timestamp).localeCompare(String(b.timestampIst || b.time || b.timestamp))
        return 0
      })
  }, [rows, submittedQuery, sortBy, aiFilters])

  // Summary statistics for the filtered result set
  const filteredStats = useMemo(() => {
    const totalRecords = filteredRows.length
    const uniquePlates = new Set(filteredRows.map((r) => r.numberPlate || r.vehicleNumberPlate).filter((p) => p && p !== 'N/A')).size
    const uniqueLocations = new Set(filteredRows.map((r) => r.roadName || r.location).filter(Boolean)).size
    const uniqueCameras = new Set(filteredRows.map((r) => r.camera).filter(Boolean)).size
    const avgConfidence = filteredRows.length
      ? Math.round(
        (filteredRows.reduce((sum, r) => sum + ((r.plateConfidence || r.confidence) > 1 ? (r.plateConfidence || r.confidence) : (r.plateConfidence || r.confidence) * 100), 0) /
          filteredRows.length)
      )
      : 0
    return { totalRecords, uniquePlates, uniqueLocations, uniqueCameras, avgConfidence }
  }, [filteredRows])

  // CSV Export for filtered query results in the exact 14-column schema
  function exportQueryResults() {
    if (!filteredRows.length) return
    const headers = [
      'ID',
      'Timestamp (IST)',
      'Vehicle Type',
      'Vehicle Number Plate',
      'Plate Confidence',
      'Vehicle Image',
      'Speed (km/h)',
      'Speed Limit (km/h)',
      'Over Speed',
      'Latitude',
      'Longitude',
      'Video Clip Path',
      'Vehicle Image Path',
      'Plate Image Path',
    ]

    const csvContent = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          r.id || r.observationId || 'OBS-0001',
          `"${r.timestampIst || r.timestamp || r.time || ''}"`,
          r.vehicleType || r.type || 'Car',
          `"${r.vehicleNumberPlate || r.numberPlate || 'N/A'}"`,
          r.plateConfidence || r.confidence || 0.95,
          `"${r.vehicleImage || ''}"`,
          r.speed || 0,
          r.speedLimit || 60,
          r.overSpeed || (r.speed > r.speedLimit ? 'Yes' : 'No'),
          r.latitude || 17.4485,
          r.longitude || 78.3742,
          `"${r.videoClipPath || ''}"`,
          `"${r.vehicleImagePath || ''}"`,
          `"${r.plateImagePath || ''}"`,
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
        submittedQuery,
        aiFilters,
        aiExplanation,
        aiSource,
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
    setSearchQuery(prev.searchQuery || '')
    setSubmittedQuery(prev.submittedQuery || '')
    setAiFilters(prev.aiFilters || null)
    setAiExplanation(prev.aiExplanation || '')
    setAiSource(prev.aiSource || '')
    setViewMode(prev.viewMode || 'graph')
    setPreviewMode(prev.previewMode || false)
    setCurrentPage(prev.currentPage || 1)
    setGraphFocusId(null)
  }

  function clearAllFilters() {
    pushHistory()
    setSearchQuery('')
    setSubmittedQuery('')
    setAiFilters(null)
    setAiExplanation('')
    setAiSource('')
    setSortBy('timestamp-desc')
    setPreviewMode(false)
    setCurrentPage(1)
    setGraphFocusId(null)
    setViewMode('graph')
  }

  function parseQueryClient(text, facets = {}) {
    const q = String(text || '').toLowerCase().trim()
    if (!q) return null

    const filters = {
      vehicleType: null,
      minSpeed: null,
      maxSpeed: null,
      overspeedOnly: null,
      location: null,
      camera: null,
      signalState: null,
      weather: null,
      plateSearch: null,
      sortBy: 'timestamp-desc',
    }

    let matched = false

    // Overspeed
    if (q.includes('overspeed') || q.includes('speeding') || q.includes('violation') || (q.includes('speed') && q.includes('limit'))) {
      filters.overspeedOnly = true
      matched = true
    }

    // Speed numerical
    const speedMatch = q.match(/(?:speed|>|over|above|faster than)\s*(\d+)/i)
    if (speedMatch) {
      filters.minSpeed = parseInt(speedMatch[1], 10)
      matched = true
    }
    const speedUnderMatch = q.match(/(?:<|under|below|slower than)\s*(\d+)/i)
    if (speedUnderMatch) {
      filters.maxSpeed = parseInt(speedUnderMatch[1], 10)
      matched = true
    }

    // Multi-vehicle types detection (e.g. "all bikes and all autos")
    const detectedTypes = []
    if (/\b(?:car|cars|sedan|suv|hatchback)\b/i.test(q)) detectedTypes.push('Car')
    if (/\b(?:bike|bikes|motorcycle|motorcycles|scooter|scooters|two wheeler|two wheelers|cycle|cycles)\b/i.test(q)) detectedTypes.push('Bike')
    if (/\b(?:bus|buses)\b/i.test(q)) detectedTypes.push('Bus')
    if (/\b(?:truck|trucks|lorry|lorries|trailer|trailers)\b/i.test(q)) detectedTypes.push('Truck')
    if (/\b(?:auto|autos|rickshaw|rickshaws|auto rickshaw)\b/i.test(q)) detectedTypes.push('Auto')
    if (/\b(?:tractor|tractors)\b/i.test(q)) detectedTypes.push('Tractor')
    if (/\b(?:jeep|jeeps)\b/i.test(q)) detectedTypes.push('Jeep')
    if (/\b(?:pedestrian|pedestrians|walking|people|person)\b/i.test(q)) detectedTypes.push('Pedestrian')
    if (/\b(?:van|vans)\b/i.test(q)) detectedTypes.push('Van')
    if (/\b(?:train|trains|metro|rail)\b/i.test(q)) detectedTypes.push('Train')

    if (detectedTypes.length > 0) {
      filters.vehicleTypes = detectedTypes
      filters.vehicleType = detectedTypes.length === 1 ? detectedTypes[0] : detectedTypes
      matched = true
    }

    // Signals
    if (q.includes('red light') || q.includes('red signal') || q.includes('ran red')) { filters.signalState = 'Red'; matched = true }
    else if (q.includes('green signal') || q.includes('green light')) { filters.signalState = 'Green'; matched = true }
    else if (q.includes('yellow') || q.includes('amber')) { filters.signalState = 'Yellow'; matched = true }

    // Weather
    if (q.includes('rain') || q.includes('rainy')) { filters.weather = 'Rainy'; matched = true }
    else if (q.includes('fog') || q.includes('foggy')) { filters.weather = 'Foggy'; matched = true }
    else if (q.includes('clear')) { filters.weather = 'Clear'; matched = true }

    // Location matching from facets if provided
    if (facets.locations && Array.isArray(facets.locations)) {
      for (const loc of facets.locations) {
        const locLower = loc.toLowerCase()
        if (q.includes(locLower) || locLower.includes(q)) {
          filters.location = loc
          matched = true
          break
        }
        const words = locLower.split(/\s+/).filter((w) => w.length > 3)
        if (words.some((w) => q.includes(w))) {
          filters.location = loc
          matched = true
          break
        }
      }
    }

    // Camera matching
    const camMatch = q.match(/cam(?:era)?[-_\s]*(\d+|[a-z0-9]+)/i)
    if (camMatch) {
      filters.camera = `CAM-${camMatch[1].toUpperCase()}`
      matched = true
    }

    // Plate matching
    const plateMatch = q.match(/\b([a-z]{2}[0-9]{1,2}[a-z]{0,3}[0-9]{1,4})\b/i)
    if (plateMatch) {
      filters.plateSearch = plateMatch[1].toUpperCase()
      matched = true
    }

    // Sort
    if (q.includes('fastest') || q.includes('highest speed')) {
      filters.sortBy = 'speed-desc'
    } else if (q.includes('slowest')) {
      filters.sortBy = 'speed-asc'
    } else if (q.includes('highest confidence') || q.includes('most confident')) {
      filters.sortBy = 'confidence-desc'
    }

    return matched ? filters : null
  }

  function handleExecuteSearch(queryText) {
    handleExecuteAiQuery(queryText)
  }

  async function handleExecuteAiQuery(queryText) {
    const textToRun = (queryText !== undefined ? queryText : searchQuery).trim()
    if (!textToRun) return

    pushHistory()
    setSubmittedQuery(textToRun)
    setAiLoading(true)
    setPreviewMode(false)
    setCurrentPage(1)
    setGraphFocusId(null)

    // Compute instant client-side parsed filters immediately so UI & graph update with ZERO latency!
    const instantFilters = parseQueryClient(textToRun, {
      types: facets.types,
      locations: facets.locations,
      cameras: facets.cameras,
    })
    setAiFilters(instantFilters)
    setAiExplanation(instantFilters.explanation || `Telemetry segment for "${textToRun}"`)
    setAiSource('rule-instant')
    if (instantFilters.sortBy) {
      setSortBy(instantFilters.sortBy)
    }
    setViewMode('graph')

    try {
      const res = await parseNaturalLanguageQuery(textToRun, {
        types: facets.types,
        locations: facets.locations,
        cameras: facets.cameras,
      })

      if (res && res.filters) {
        setAiFilters(res.filters)
        setAiExplanation(res.explanation || `AI telemetry segment for "${textToRun}"`)
        setAiSource(res.aiSource || 'ollama-qwen3:8b')

        if (res.filters.sortBy) {
          setSortBy(res.filters.sortBy)
        }
      }
    } catch (e) {
      console.warn('AI query backend call failed:', e)
    } finally {
      setAiLoading(false)
    }
  }


  function handleFocusInGraph(obsId) {
    setGraphFocusId(obsId)
    setViewMode('graph')
  }

  const activeQueryLabel = useMemo(() => {
    if (aiExplanation) return aiExplanation
    if (submittedQuery) return `"${submittedQuery}"`
    return previewMode ? 'Preview Dataset' : 'All Traffic Telemetry'
  }, [aiExplanation, submittedQuery, previewMode])

  const hasActiveFilters = Boolean(submittedQuery || aiFilters)
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

      {/* Search Console */}
      <div className="query-search-console">
        <div className="query-search-row">
          <div className="query-input-box">
            <Search className="query-search-icon" size={18} />
            <input
              autoFocus
              className="query-search-input"
              disabled={aiLoading}
              onChange={(e) => {
                setSearchQuery(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleExecuteSearch()
                }
              }}
              placeholder="Ask anything (e.g. 'Show speeding cars on Ring Road', 'Bikes running red lights')..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="query-clear-search-btn"
                onClick={() => {
                  pushHistory()
                  setSearchQuery('')
                  setSubmittedQuery('')
                  setAiFilters(null)
                  setAiExplanation('')
                  setPreviewMode(false)
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
              className="query-search-btn"
              disabled={!searchQuery.trim()}
              onClick={() => handleExecuteSearch()}
              title="Search traffic telemetry records"
              type="button"
            >
              <Search size={15} />
              <span>Search</span>
            </button>

            <button
              className="query-ask-ai-btn"
              disabled={aiLoading || !searchQuery.trim()}
              onClick={() => handleExecuteAiQuery()}
              title="Search with AI reasoning and extract Knowledge Graph segment"
              type="button"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="spinning" size={15} />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Ask AI</span>
                </>
              )}
            </button>

            <button
              className={`query-execute-graph-btn ${viewMode === 'graph' ? 'active' : ''}`}
              onClick={() => {
                const text = searchQuery.trim()
                pushHistory()
                if (text) {
                  handleExecuteSearch(text)
                } else {
                  setPreviewMode(true)
                  setViewMode('graph')
                  setCurrentPage(1)
                }
              }}
              title="View Knowledge Graph"
              type="button"
            >
              <Network size={14} />
              <span>Knowledge Graph</span>
            </button>
          </div>
        </div>

        {/* Animated AI Thinking Progress State */}
        {aiLoading && (
          <div className="query-ai-loading-banner">
            <Loader2 className="spinning" size={20} />
            <div className="ai-loading-text">
              <strong>AI is analyzing your query...</strong>
              <span>Searching records and preparing the Knowledge Graph segment.</span>
            </div>
          </div>
        )}

        {/* AI Knowledge Graph Segment Retrieved Banner */}
        {aiFilters && (
          <div className="query-ai-segment-banner">
            <div className="ai-segment-main">
              <div className="ai-segment-title-row">
                <div className="ai-segment-pill">
                  <Sparkles size={14} />
                  <span>AI KNOWLEDGE GRAPH SEGMENT</span>
                </div>
                <span className="ai-source-badge">AI Engine</span>
                <span className="ai-node-count-badge">
                  {filteredRows.length} matching entities · {filteredStats.uniqueCameras} cameras · {filteredStats.uniqueLocations} roads
                </span>
              </div>
              <p className="ai-segment-explanation-text">{aiExplanation}</p>
              <div className="ai-segment-tags-row">
                {(aiFilters.vehicleTypes?.length || aiFilters.vehicleType) && (
                  <span className="ai-criteria-tag">
                    Type: <strong>{Array.isArray(aiFilters.vehicleTypes) ? aiFilters.vehicleTypes.join(', ') : (Array.isArray(aiFilters.vehicleType) ? aiFilters.vehicleType.join(', ') : String(aiFilters.vehicleType))}</strong>
                  </span>
                )}
                {aiFilters.overspeedOnly && (
                  <span className="ai-criteria-tag warning">
                    ⚠️ Over Speed Violation
                  </span>
                )}
                {aiFilters.minSpeed && (
                  <span className="ai-criteria-tag">
                    Speed &gt; <strong>{aiFilters.minSpeed} km/h</strong>
                  </span>
                )}
                {aiFilters.maxSpeed && (
                  <span className="ai-criteria-tag">
                    Speed &lt; <strong>{aiFilters.maxSpeed} km/h</strong>
                  </span>
                )}
                {aiFilters.location && (
                  <span className="ai-criteria-tag">
                    Road: <strong>{Array.isArray(aiFilters.location) ? aiFilters.location.join(', ') : String(aiFilters.location)}</strong>
                  </span>
                )}
                {aiFilters.camera && (
                  <span className="ai-criteria-tag">
                    Camera: <strong>{Array.isArray(aiFilters.camera) ? aiFilters.camera.join(', ') : String(aiFilters.camera)}</strong>
                  </span>
                )}
                {aiFilters.signalState && (
                  <span className="ai-criteria-tag">
                    Signal: <strong>{aiFilters.signalState}</strong>
                  </span>
                )}
                {aiFilters.weather && (
                  <span className="ai-criteria-tag">
                    Weather: <strong>{aiFilters.weather}</strong>
                  </span>
                )}
                {aiFilters.plateSearch && (
                  <span className="ai-criteria-tag">
                    Plate: <strong>{aiFilters.plateSearch}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="ai-segment-actions">
              <button
                className={`ai-segment-toggle-btn ${viewMode === 'graph' ? 'active' : ''}`}
                onClick={() => setViewMode('graph')}
                title="View Knowledge Graph Subgraph"
                type="button"
              >
                <Network size={14} />
                <span>Knowledge Graph</span>
              </button>
              <button
                className={`ai-segment-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="View Records Table"
                type="button"
              >
                <Table2 size={14} />
                <span>Table</span>
              </button>
              <button
                className="ai-segment-toggle-btn clear"
                onClick={clearAllFilters}
                title="Clear AI Filters"
                type="button"
              >
                <X size={14} />
                <span>Reset AI</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 1. When AI query is loading: Show dedicated AI Loading State ONLY */}
      {aiLoading ? (
        <div className="query-ai-loading-container">
          <div className="query-ai-loading-pulse">
            <Bot size={36} className="query-ai-pulse-icon" />
            <Loader2 className="spinning query-ai-spinner" size={54} />
          </div>
          <h2>AI Query Engine Processing Telemetry</h2>
          <p>
            Analyzing natural language query <strong>&ldquo;{submittedQuery || searchQuery}&rdquo;</strong> and constructing the Knowledge Graph segment...
          </p>
          <div className="query-ai-loading-chips">
            <span className="query-ai-chip">Semantic Analysis</span>
            <span className="query-ai-chip">Multi-Entity Extraction</span>
            <span className="query-ai-chip">Graph Subgraph Construction</span>
          </div>
        </div>
      ) : !isQueryActive ? (
        <div className="query-empty-results query-start-prompt">
          <div className="query-start-icon-wrap">
            <Sparkles size={32} />
          </div>
          <h2>Natural Language Traffic Intelligence</h2>
          <p>
            Type any traffic question in plain English above (e.g. <em>"Show all speeding cars on Ring Road"</em> or <em>"Find bikes running red lights"</em>) and click <strong>Ask AI</strong>.
          </p>
          <div className="query-quick-actions">
            <button
              className="query-quick-action-btn"
              onClick={() => {
                setPreviewMode(true)
                setViewMode('graph')
              }}
              type="button"
            >
              <Network size={14} />
              <span>Explore Knowledge Graph</span>
            </button>
            <button
              className="query-quick-action-btn secondary"
              onClick={() => {
                setPreviewMode(true)
                setViewMode('table')
                setCurrentPage(1)
              }}
              type="button"
            >
              📄 Preview Records Table ({rows.length})
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
              {submittedQuery && (
                <span>
                  {' '}
                  matching &ldquo;<em>{submittedQuery}</em>&rdquo;
                </span>
              )}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {rows.some((r) => r.hasExtractedImage) && (
                <span
                  className="query-xlsx-extracted-badge"
                  title="Images extracted directly from Excel (.xlsx) workbook"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    background: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <Sparkles size={12} />
                  {rows.filter((r) => r.hasExtractedImage).length} images extracted from XLSX
                </span>
              )}

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
                No entries matched your query <strong>&ldquo;{submittedQuery}&rdquo;</strong>. Try adjusting your search term
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
                    <th>ID</th>
                    <th>TIMESTAMP (IST)</th>
                    <th>VEHICLE TYPE</th>
                    <th>NUMBER PLATE</th>
                    <th>PLATE CONFIDENCE</th>
                    <th>SPEED / LIMIT</th>
                    <th>OVER SPEED</th>
                    <th>COORDINATES</th>
                    <th>MEDIA EVIDENCE</th>
                    <th>GRAPH</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, idx) => (
                    <tr key={`${row.id || row.observationId}-${row.timestampIst || row.timestamp}-${idx}`}>
                      <td>
                        <code className="query-camera-code">{row.id || row.observationId || `ID-${idx + 1}`}</code>
                      </td>
                      <td>
                        <span className="query-time-cell">
                          <Clock size={12} />
                          {row.timestampIst || row.time || row.timestamp}
                        </span>
                      </td>
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
                        <span className="query-confidence-badge">
                          {Math.round(
                            (row.plateConfidence || row.confidence) > 1
                              ? (row.plateConfidence || row.confidence)
                              : ((row.plateConfidence || row.confidence || 0.95) * 100)
                          )}%
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <strong style={{ fontSize: '13px', color: (row.overSpeed === 'Yes' || row.isOverSpeed) ? '#dc2626' : '#1e293b' }}>
                            {row.speed || 0}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            / {row.speedLimit || 60} km/h
                          </span>
                        </div>
                      </td>
                      <td>
                        {(row.overSpeed === 'Yes' || row.isOverSpeed) ? (
                          <span
                            className="query-signal-pill"
                            style={{
                              background: '#fef2f2',
                              color: '#dc2626',
                              borderColor: '#fca5a5',
                              fontWeight: 600,
                            }}
                          >
                            ⚠ Over Speed
                          </span>
                        ) : (
                          <span
                            className="query-signal-pill"
                            style={{
                              background: '#ecfdf5',
                              color: '#059669',
                              borderColor: '#a7f3d0',
                            }}
                          >
                            Normal
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="query-heading-tag" style={{ fontSize: '11px' }}>
                          {row.latitude?.toFixed(4) || '17.4485'}°, {row.longitude?.toFixed(4) || '78.3742'}°
                        </span>
                      </td>
                      <td>
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
                      <td>
                        <button
                          className="query-row-graph-btn"
                          onClick={() => handleFocusInGraph(row.id || row.observationId || row.numberPlate)}
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

      {previewModalRow && (
        <MediaPreviewModal
          allRows={filteredRows}
          isOpen={Boolean(previewModalRow)}
          onClose={() => setPreviewModalRow(null)}
          onSelectRow={setPreviewModalRow}
          row={previewModalRow}
        />
      )}
    </div>
  )
}
