import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  Car,
  Activity,
  ArrowLeft,
  CircleCheck,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  Clock3,
  BarChart3,
  LayoutGrid,
  Search,
  X,
  Play,
  Square,
  Upload,
  Video,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '../styles/live-detection.css'

const apiBaseUrl = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '')
const LIVE_FRAME_INTERVAL_SECONDS = 0.5
const MAX_DISPLAYED_FRAMES = 1200
const MAX_TEMP_VEHICLE_IMAGES = 300
const MAX_TEMP_IMAGES_PER_FRAME = 4
const CHART_COLORS = ['#2563eb', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const PAGE_SIZE = 10

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatTimestamp(seconds) {
  return `${formatTime(seconds)} (${seconds.toFixed(1)}s)`
}

function PlateNumber({ value, compact = false }) {
  const recognized = Boolean(value)
  const Icon = recognized ? CircleCheck : CircleHelp
  return (
    <span className={`live-ai-plate-number ${recognized ? 'is-recognized' : 'is-unrecognized'} ${compact ? 'compact' : ''}`}>
      <Icon aria-hidden="true" size={compact ? 12 : 14} />
      <span>{value || 'Not recognized'}</span>
    </span>
  )
}

function Pagination({ page, total, onChange }) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0
  const last = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="live-ai-pagination">
      <span>Showing {first}–{last} of {total} results</span>
      <div>
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span>Page {page} of {pageCount}</span>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function pageSlice(records, page) {
  return records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

function isVehicleLabel(label = '') {
  return /^(car|truck|bus|motorcycle|motorbike|bicycle|bike|van|vehicle|train)$/i.test(label.trim())
}

async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const responseBody = await response.text()
    if (response.status === 404) {
      throw new Error('The live-data API endpoint was not found. Restart the Django backend and try again.')
    }
    throw new Error(
      `The backend returned a non-JSON response (HTTP ${response.status}). ${
        responseBody.includes('<!doctype') ? 'Check that the API URL points to Django.' : 'Check the backend server.'
      }`,
    )
  }
  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('The backend response was incomplete. Check the backend logs and try again.')
  }
  if (!response.ok || !result.success) {
    throw new Error(result.message || `Frame analysis failed (${response.status}).`)
  }
  return result
}

export default function LiveDetectionDashboard({ onSwitchToExcelData }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = searchParams.get('view')
  const activePage = ['events', 'analytics'].includes(requestedPage) ? requestedPage : 'overview'
  const videoRef = useRef(null)
  const sessionIdRef = useRef('')
  const vehicleImageUrlsRef = useRef(new Map())
  const pendingVehicleImagesRef = useRef(new Map())
  const vehicleImageGenerationRef = useRef(0)
  const [videoFile, setVideoFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoReady, setVideoReady] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [videoAspectRatio, setVideoAspectRatio] = useState('16 / 9')
  const [currentTime, setCurrentTime] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Choose a video to begin analysis.')
  const [modelStatus, setModelStatus] = useState(null)
  const [vehiclePage, setVehiclePage] = useState(1)
  const [platePage, setPlatePage] = useState(1)
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('')
  const [plateSearch, setPlateSearch] = useState('')
  const [plateStatusFilter, setPlateStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [fromSeconds, setFromSeconds] = useState('')
  const [toSeconds, setToSeconds] = useState('')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [vehicleImageUrls, setVehicleImageUrls] = useState({})
  const [newRecordsWhileBrowsing, setNewRecordsWhileBrowsing] = useState(0)
  const knownObjectIdsRef = useRef(new Set())

  useEffect(() => {
    let cancelled = false
    fetch(`${apiBaseUrl}/api/live-feed/models`)
      .then(parseApiResponse)
      .then((result) => {
        if (!cancelled) setModelStatus(result)
      })
      .catch((requestError) => {
        if (!cancelled) {
          setModelStatus({
            ready: false,
            message: requestError.message || 'Could not read model readiness from the backend.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!videoFile) {
      setVideoUrl('')
      return undefined
    }
    const objectUrl = URL.createObjectURL(videoFile)
    setVideoUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [videoFile])

  useEffect(() => () => {
    for (const objectUrl of vehicleImageUrlsRef.current.values()) {
      URL.revokeObjectURL(objectUrl)
    }
    vehicleImageUrlsRef.current.clear()
  }, [])

  const currentDetections = useMemo(() => {
    const frames = analysis?.frames || []
    if (!frames.length) return []
    let closest = frames[0]
    for (const frame of frames) {
      if (Math.abs(frame.timeSeconds - currentTime) < Math.abs(closest.timeSeconds - currentTime)) {
        closest = frame
      }
    }
    const tolerance = (analysis?.video?.sampleIntervalSeconds || 0.5) * 1.25
    return Math.abs(closest.timeSeconds - currentTime) <= tolerance
      ? closest.detections
      : []
  }, [analysis, currentTime])

  const summary = analysis?.summary
  const vehicleRows = analysis?.vehicles || []
  const objectRows = analysis?.objects || []
  const trackedObjects = objectRows
    .filter((object) => object.trackingAvailable)
    .sort((left, right) => right.lastSeenSeconds - left.lastSeenSeconds)
  const trackedVehicles = trackedObjects.filter((object) => object.isVehicle)
  const plateRows = trackedObjects.filter((object) => object.plateStatus || object.plateNumber)
  const vehicleById = new Map(trackedVehicles.map((vehicle) => [vehicle.objectId, vehicle]))
  const plateByVehicleId = new Map()
  for (const plate of plateRows) {
    if (plate.vehicleId && !plateByVehicleId.has(plate.vehicleId)) {
      plateByVehicleId.set(plate.vehicleId, plate)
    }
  }
  const vehicleTypes = [...new Set(trackedVehicles.map((vehicle) => vehicle.label))].sort()
  const sourceOptions = [...new Set(trackedObjects.map((object) => object.sourceId).filter(Boolean))].sort()
  const matchesClipTime = (object) => (
    (fromSeconds === '' || object.lastSeenSeconds >= Number(fromSeconds))
    && (toSeconds === '' || object.lastSeenSeconds <= Number(toSeconds))
  )
  const filteredVehicles = trackedVehicles.filter((vehicle) => (
    (!vehicleTypeFilter || vehicle.label === vehicleTypeFilter)
    && (!sourceFilter || vehicle.sourceId === sourceFilter)
    && matchesClipTime(vehicle)
    && `${vehicle.label} ${vehicle.objectId} ${vehicle.sourceId || ''} ${plateByVehicleId.get(vehicle.objectId)?.plateNumber || ''}`
      .toLowerCase().includes(vehicleSearch.trim().toLowerCase())
  ))
  const filteredPlates = plateRows.filter((plate) => (
    (!plateStatusFilter || plate.plateStatus === plateStatusFilter)
    && (!sourceFilter || plate.sourceId === sourceFilter)
    && matchesClipTime(plate)
    && `${plate.plateNumber || ''} ${plate.objectId} ${plate.sourceId || ''} ${plate.vehicleId || ''}`
      .toLowerCase().includes(plateSearch.trim().toLowerCase())
  ))
  const pagedVehicles = pageSlice(filteredVehicles, vehiclePage)
  const pagedPlates = pageSlice(filteredPlates, platePage)
  const latestObject = trackedObjects[0]
  const recognizedPlateCount = plateRows.filter((plate) => plate.plateNumber).length
  const unreadablePlateCount = plateRows.filter((plate) => plate.plateStatus === 'Unreadable').length
  const unrecognizedPlateCount = plateRows.length - recognizedPlateCount
  const selectedVehicleImage = selectedRecord
    ? vehicleImageUrls[selectedRecord.objectId]
      || vehicleImageUrls[selectedRecord.vehicleId]
      || null
    : null
  const violationRows = vehicleRows.filter((vehicle) => vehicle.violation)
  const vehicleChartData = summary?.vehicleCategories?.length
    ? summary.vehicleCategories
    : summary?.objectCategories || []
  const violationChartData = summary?.violationCategories || []
  const frameTrendData = useMemo(() => {
    const buckets = new Map()
    for (const frame of analysis?.frames || []) {
      const bucketStart = Math.floor(frame.timeSeconds / 10) * 10
      const bucket = buckets.get(bucketStart) || { second: bucketStart, detections: 0 }
      bucket.detections += frame.detections.length
      buckets.set(bucketStart, bucket)
    }
    return [...buckets.values()].sort((left, right) => left.second - right.second)
  }, [analysis?.frames])

  function navigateLivePage(page) {
    const nextParams = new URLSearchParams(searchParams)
    if (page === 'overview') nextParams.delete('view')
    else nextParams.set('view', page)
    setSearchParams(nextParams)
  }

  useEffect(() => {
    const objectIds = new Set(trackedObjects.map((object) => object.objectId))
    const previousIds = knownObjectIdsRef.current
    const newCount = [...objectIds].filter((id) => !previousIds.has(id)).length
    if (previousIds.size && newCount && vehiclePage > 1) {
      setNewRecordsWhileBrowsing((count) => count + newCount)
    }
    knownObjectIdsRef.current = objectIds
  }, [objectRows, vehiclePage])

  useEffect(() => {
    setVehiclePage((page) => Math.min(page, Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE))))
  }, [filteredVehicles.length])

  useEffect(() => {
    setPlatePage((page) => Math.min(page, Math.max(1, Math.ceil(filteredPlates.length / PAGE_SIZE))))
  }, [filteredPlates.length])

  async function captureVehicleImages(frameCanvas, detections, isCancelled, generation) {
    const candidates = detections
      .filter((detection) => isVehicleLabel(detection.label) && detection.trackId != null)
      .slice(0, MAX_TEMP_IMAGES_PER_FRAME)
    const newImageUrls = {}

    await Promise.all(candidates.map(async (detection) => {
      const objectId = `${detection.model}:${detection.trackId}`
      if (
        vehicleImageUrlsRef.current.has(objectId)
        || pendingVehicleImagesRef.current.has(objectId)
        || vehicleImageUrlsRef.current.size + pendingVehicleImagesRef.current.size >= MAX_TEMP_VEHICLE_IMAGES
      ) return

      pendingVehicleImagesRef.current.set(objectId, generation)
      try {
        const [x, y, boxWidth, boxHeight] = detection.box || []
        if (![x, y, boxWidth, boxHeight].every(Number.isFinite) || boxWidth <= 0 || boxHeight <= 0) {
          return
        }
        const paddingX = boxWidth * frameCanvas.width * 0.12
        const paddingY = boxHeight * frameCanvas.height * 0.12
        const left = Math.max(0, Math.floor(x * frameCanvas.width - paddingX))
        const top = Math.max(0, Math.floor(y * frameCanvas.height - paddingY))
        const right = Math.min(frameCanvas.width, Math.ceil((x + boxWidth) * frameCanvas.width + paddingX))
        const bottom = Math.min(frameCanvas.height, Math.ceil((y + boxHeight) * frameCanvas.height + paddingY))
        const cropWidth = right - left
        const cropHeight = bottom - top
        if (cropWidth <= 0 || cropHeight <= 0) return

        const cropCanvas = document.createElement('canvas')
        const cropScale = Math.min(1, 480 / Math.max(cropWidth, cropHeight))
        cropCanvas.width = Math.max(1, Math.round(cropWidth * cropScale))
        cropCanvas.height = Math.max(1, Math.round(cropHeight * cropScale))
        const cropContext = cropCanvas.getContext('2d')
        if (!cropContext) {
          setError('Could not prepare a temporary vehicle image in this browser.')
          return
        }
        cropContext.drawImage(
          frameCanvas,
          left,
          top,
          cropWidth,
          cropHeight,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height,
        )

        const imageBlob = await new Promise((resolve, reject) => {
          cropCanvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Browser could not encode the vehicle crop.'))),
            'image/jpeg',
            0.72,
          )
        })
        if (isCancelled() || generation !== vehicleImageGenerationRef.current) return
        if (vehicleImageUrlsRef.current.has(objectId)) return
        const objectUrl = URL.createObjectURL(imageBlob)
        vehicleImageUrlsRef.current.set(objectId, objectUrl)
        newImageUrls[objectId] = objectUrl
      } catch (captureError) {
        setError(captureError.message || 'Could not create a temporary vehicle image.')
      } finally {
        if (pendingVehicleImagesRef.current.get(objectId) === generation) {
          pendingVehicleImagesRef.current.delete(objectId)
        }
      }
    }))
    if (
      Object.keys(newImageUrls).length
      && generation === vehicleImageGenerationRef.current
      && !isCancelled()
    ) {
      setVehicleImageUrls((current) => ({ ...current, ...newImageUrls }))
    } else if (generation !== vehicleImageGenerationRef.current || isCancelled()) {
      for (const objectUrl of Object.values(newImageUrls)) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!isAnalyzing || !video || !videoUrl) return undefined

    let cancelled = false
    let requestInFlight = false
    let lastAnalyzedTime = -LIVE_FRAME_INTERVAL_SECONDS
    let videoFrameCallback = null
    let fallbackTimer = null

    function stopScheduledFrame() {
      if (videoFrameCallback !== null && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(videoFrameCallback)
      }
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer)
      }
      videoFrameCallback = null
      fallbackTimer = null
    }

    async function analyzeFrameAt(timeSeconds) {
      if (requestInFlight || cancelled) return
      requestInFlight = true
      try {
        const scale = Math.min(1, 960 / video.videoWidth)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Browser could not prepare a frame for live analysis.')
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frame = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Could not capture the current video frame.'))),
            'image/jpeg',
            0.78,
          )
        })
        if (cancelled) return

        const body = new FormData()
        body.append('frame', frame, 'live-frame.jpg')
        body.append('sessionId', sessionIdRef.current)
        body.append('sourceId', videoFile?.name || sessionIdRef.current)
        body.append('timeSeconds', String(timeSeconds))
        body.append('durationSeconds', String(video.duration || 0))
        const response = await fetch(`${apiBaseUrl}/api/live-feed/analyze-frame`, {
          method: 'POST',
          body,
        })
        const result = await parseApiResponse(response)
        if (cancelled) return

        captureVehicleImages(
          canvas,
          result.frame.detections,
          () => cancelled,
          vehicleImageGenerationRef.current,
        ).catch((captureError) => {
          if (!cancelled) {
            setError(captureError.message || 'Could not create temporary vehicle images.')
          }
        })

        setAnalysis((current) => ({
          ...current,
          ...result,
          video: { ...current.video, ...result.video },
          frames: [...current.frames, result.frame].slice(-MAX_DISPLAYED_FRAMES),
        }))
        setStatus(
          `Live analysis · ${result.video.sampledFrames} frames · ${result.summary.vehicleCount} vehicle(s) detected`,
        )
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || 'Live frame analysis failed.')
          setStatus('Live analysis stopped. Fix the backend error and start again.')
          setIsAnalyzing(false)
        }
      } finally {
        requestInFlight = false
      }
    }

    function scheduleNextFrame() {
      if (cancelled || video.paused || video.ended) return
      if (video.requestVideoFrameCallback) {
        videoFrameCallback = video.requestVideoFrameCallback(onVideoFrame)
      } else {
        fallbackTimer = window.setTimeout(() => onVideoFrame(0, { mediaTime: video.currentTime }), 250)
      }
    }

    async function onVideoFrame(_now, metadata) {
      videoFrameCallback = null
      fallbackTimer = null
      if (cancelled || video.paused || video.ended) return
      const timeSeconds = metadata?.mediaTime ?? video.currentTime
      if (
        !requestInFlight
        && timeSeconds - lastAnalyzedTime >= LIVE_FRAME_INTERVAL_SECONDS
        && video.videoWidth > 0
      ) {
        lastAnalyzedTime = timeSeconds
        await analyzeFrameAt(timeSeconds)
      }
      scheduleNextFrame()
    }

    function startFrameLoop() {
      stopScheduledFrame()
      scheduleNextFrame()
    }

    function pauseFrameLoop() {
      stopScheduledFrame()
    }

    function finishAnalysis() {
      setIsAnalyzing(false)
      setStatus((current) => current.startsWith('Live analysis')
        ? current.replace('Live analysis', 'Analysis complete')
        : 'Video playback complete. Live analysis finished.')
    }

    function resetSeekSampling() {
      lastAnalyzedTime = video.currentTime - LIVE_FRAME_INTERVAL_SECONDS
    }

    video.addEventListener('play', startFrameLoop)
    video.addEventListener('pause', pauseFrameLoop)
    video.addEventListener('ended', finishAnalysis)
    video.addEventListener('seeking', resetSeekSampling)
    if (!video.paused) startFrameLoop()

    return () => {
      cancelled = true
      stopScheduledFrame()
      video.removeEventListener('play', startFrameLoop)
      video.removeEventListener('pause', pauseFrameLoop)
      video.removeEventListener('ended', finishAnalysis)
      video.removeEventListener('seeking', resetSeekSampling)
    }
  }, [isAnalyzing, videoUrl, videoFile])

  function clearVehicleImages() {
    vehicleImageGenerationRef.current += 1
    for (const objectUrl of vehicleImageUrlsRef.current.values()) {
      URL.revokeObjectURL(objectUrl)
    }
    vehicleImageUrlsRef.current.clear()
    pendingVehicleImagesRef.current.clear()
    setVehicleImageUrls({})
    setSelectedRecord(null)
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const supportedExtension = /\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(file.name)
    const supportedMimeType = !file.type || file.type.startsWith('video/') || file.type === 'application/octet-stream'
    if (!supportedExtension || !supportedMimeType) {
      setError('Choose a supported video file: MP4, WebM, OGG, MOV, M4V, AVI, or MKV.')
      return
    }
    if (file.size <= 0) {
      setError('The selected video is empty.')
      return
    }
    setError('')
    clearVehicleImages()
    setStatus('Video loaded. Select Start Detection to analyze it.')
    setVideoFile(file)
    setVideoReady(false)
    setAnalysis(null)
    setVehiclePage(1)
    setPlatePage(1)
    knownObjectIdsRef.current = new Set()
    setNewRecordsWhileBrowsing(0)
    setCurrentTime(0)
    setVideoAspectRatio('16 / 9')
  }

  async function startAnalysis() {
    if (!videoFile || isAnalyzing) return
    setError('')
    const video = videoRef.current
    if (!video) {
      setError('The selected video preview is not ready. Select the video again and retry.')
      return
    }
    clearVehicleImages()
    sessionIdRef.current = crypto.randomUUID()
    setAnalysis({
      video: {
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: video.duration || 0,
        sampleIntervalSeconds: LIVE_FRAME_INTERVAL_SECONDS,
        sampledFrames: 0,
      },
      models: [],
      modelWarnings: [],
      vehicleDetectionAvailable: true,
      vehicles: [],
      objects: [],
      frames: [],
      violationEvents: [],
      summary: {
        vehicleCount: 0,
        objectCount: 0,
        violationCount: 0,
        noViolationCount: 0,
        sampledFrames: 0,
        vehicleCategories: [],
        objectCategories: [],
        violationCategories: [],
      },
    })
    setCurrentTime(0)
    setIsAnalyzing(true)
    setStatus('Starting live analysis. The video plays locally; sampled frames are sent for detection.')
    try {
      video.currentTime = 0
      await video.play()
    } catch (requestError) {
      setIsAnalyzing(false)
      setError(requestError.message || 'Could not start video playback.')
      setStatus('Analysis did not start.')
    }
  }

  function stopAnalysis() {
    videoRef.current?.pause()
    setIsAnalyzing(false)
    setStatus('Live analysis stopped.')
  }

  function resetVehicleFilters(search = vehicleSearch, type = vehicleTypeFilter) {
    setVehicleSearch(search)
    setVehicleTypeFilter(type)
    setVehiclePage(1)
    setNewRecordsWhileBrowsing(0)
  }

  function resetPlateFilters(search = plateSearch, plateStatus = plateStatusFilter) {
    setPlateSearch(search)
    setPlateStatusFilter(plateStatus)
    setPlatePage(1)
  }

  function setLiveFilters({ source = sourceFilter, from = fromSeconds, to = toSeconds } = {}) {
    setSourceFilter(source)
    setFromSeconds(from)
    setToSeconds(to)
    setVehiclePage(1)
    setPlatePage(1)
    setNewRecordsWhileBrowsing(0)
  }

  return (
    <div className="live-ai-page" data-page={activePage}>
      <header className="live-ai-header">
        <div className="live-ai-header-title">
          <p className="live-ai-eyebrow">VISIONIQ · TRAFFIC OPERATIONS</p>
          <h1>Live Feed Command View</h1>
          <p>{videoFile?.name || 'No video source selected'} <span>·</span> Uploaded video</p>
        </div>
        <div className="live-ai-header-actions">
          <span className={`live-ai-connection ${isAnalyzing ? 'is-active' : videoReady ? 'is-ready' : ''}`}>
            <span />
            {error ? 'Error' : isAnalyzing ? 'Processing' : videoReady ? 'Ready' : 'Disconnected'}
          </span>
          {isAnalyzing && <span className="live-ai-live-indicator"><span /> LIVE ANALYSIS</span>}
          <span className="live-ai-clock"><Clock3 size={14} /> {latestObject ? `Last detection ${formatTimestamp(latestObject.lastSeenSeconds)}` : 'No detections yet'}</span>
          <button
            className="live-ai-back-button"
            type="button"
            onClick={() => {
              onSwitchToExcelData?.()
              navigate('/home')
            }}
          >
            <ArrowLeft size={17} />
            Excel Data
          </button>
        </div>
      </header>

      <nav className="live-ai-page-nav" aria-label="Live feed pages">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutGrid },
          { id: 'events', label: 'Events', icon: Camera },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            aria-current={activePage === id ? 'page' : undefined}
            className={activePage === id ? 'active' : ''}
            key={id}
            onClick={() => navigateLivePage(id)}
            type="button"
          >
            <Icon size={15} />
            {label}
            {id === 'events' && <span>{trackedObjects.length}</span>}
          </button>
        ))}
      </nav>

      {activePage === 'overview' && (
        <>
      <section className="live-ai-source-card">
        <div className="live-ai-source-copy">
          <div className="live-ai-source-icon"><Video size={22} /></div>
          <div>
            <h2>Upload a traffic video</h2>
            <p>Choose a browser-playable traffic video. Detection runs on sampled frames as the video plays.</p>
          </div>
        </div>
        <div className="live-ai-upload-actions">
          <label className="live-ai-upload-button">
            <Upload size={17} />
            Choose video
            <input
              type="file"
              accept="video/*,.mkv,.avi"
              onChange={handleFileChange}
              disabled={isAnalyzing}
            />
          </label>
          <button
            className="live-ai-start-button"
            type="button"
            onClick={isAnalyzing ? stopAnalysis : startAnalysis}
            disabled={!videoFile || !videoReady}
          >
            {isAnalyzing ? <Square size={16} /> : <Play size={17} />}
            {isAnalyzing ? 'Stop Analysis' : 'Play & Analyze'}
          </button>
        </div>
        <div className="live-ai-file-status">
          <span>{videoFile ? `${videoFile.name} · ${(videoFile.size / (1024 * 1024)).toFixed(1)} MB` : status}</span>
          {videoFile && <span>{status}</span>}
        </div>
        <div className="live-ai-model-note live-ai-source-model-status" role="status">
          <Activity size={15} />
          {modelStatus
            ? modelStatus.ready
              ? `NH5 model ready · ${modelStatus.models?.[0]?.name || 'Configured model'} · CPU/GPU auto-selection`
              : `NH5 model unavailable · ${modelStatus.message}`
            : 'Checking NH5 model readiness…'}
        </div>
        {error && <p className="live-ai-error" role="alert">{error}</p>}
      </section>

      <section className="live-ai-summary-grid" aria-label="Live feed summary">
        <article className="live-ai-summary-card">
          <span className="live-ai-summary-icon blue"><Car size={18} /></span>
          <div><small>VEHICLES DETECTED</small><strong>{trackedVehicles.length}</strong><span>Unique tracked vehicles · current clip</span></div>
        </article>
        <article className="live-ai-summary-card">
          <span className="live-ai-summary-icon amber"><Camera size={18} /></span>
          <div><small>NUMBER PLATES</small><strong>{plateRows.length}</strong><span>{recognizedPlateCount} confirmed · {unreadablePlateCount} unreadable</span></div>
        </article>
        <article className="live-ai-summary-card">
          <span className="live-ai-summary-icon red"><Activity size={18} /></span>
          <div><small>VIOLATION EVENTS</small><strong>{analysis?.violationEvents?.length || 0}</strong><span>Model-labeled events in this clip</span></div>
        </article>
        <article className="live-ai-summary-card">
          <span className="live-ai-summary-icon purple"><Clock3 size={18} /></span>
          <div><small>SAMPLED FRAMES</small><strong>{analysis?.video?.sampledFrames || 0}</strong><span>Frames processed by the model</span></div>
        </article>
        <article className="live-ai-summary-card">
          <span className="live-ai-summary-icon green"><Activity size={18} /></span>
          <div><small>LATEST DETECTION</small><strong>{latestObject?.label || '—'}</strong><span>{latestObject ? formatTimestamp(latestObject.lastSeenSeconds) : 'Waiting for model output'}</span></div>
        </article>
        <article className="live-ai-summary-card">
          <span className={`live-ai-summary-icon ${modelStatus?.ready ? 'green' : 'slate'}`}><Video size={18} /></span>
          <div><small>MODEL STATUS</small><strong className="live-ai-source-value">{modelStatus ? modelStatus.ready ? 'Model ready' : 'Unavailable' : 'Checking…'}</strong><span>{isAnalyzing ? 'Video analysis in progress' : videoReady ? 'Uploaded video · Ready' : 'Choose a video source'}</span></div>
        </article>
      </section>

      <section className="live-ai-main-grid">
        <article className="live-ai-card live-ai-video-card">
          <div className="live-ai-card-heading">
            <div>
              <h2>Live Video View</h2>
              <p>{videoFile?.name || 'Upload a traffic video to view detections'}</p>
            </div>
            <span className={`live-ai-status ${isAnalyzing ? 'processing' : analysis ? 'complete' : 'idle'}`}>
              <span />
              {isAnalyzing ? 'PROCESSING' : analysis ? 'ANALYZED' : 'READY'}
            </span>
          </div>
          <div className="live-ai-video-stage">
            {videoUrl ? (
              <div
                className="live-ai-video-frame"
                style={{
                  aspectRatio: analysis?.video?.width && analysis?.video?.height
                    ? `${analysis.video.width} / ${analysis.video.height}`
                    : videoAspectRatio,
                }}
              >
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  onLoadedMetadata={(event) => {
                    const { videoWidth, videoHeight } = event.currentTarget
                    setVideoReady(Boolean(videoWidth && videoHeight))
                    if (videoWidth && videoHeight) {
                      setVideoAspectRatio(`${videoWidth} / ${videoHeight}`)
                    }
                  }}
                  onError={() => {
                    setVideoReady(false)
                    setError('This video format or codec cannot be played by the browser. Try MP4 with H.264 video.')
                  }}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
                />
                {analysis && currentDetections.map((detection, index) => {
                  const [x, y, width, height] = detection.box
                  return (
                    <div
                      className={`live-ai-box ${detection.violationType ? 'violation' : ''}`}
                      key={`${detection.model}-${detection.trackId || index}-${index}`}
                      style={{
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        width: `${width * 100}%`,
                        height: `${height * 100}%`,
                      }}
                    >
                      <span>{detection.label} · {(detection.confidence * 100).toFixed(0)}%{detection.trackId ? ` · ${detection.trackId}` : ''}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="live-ai-empty-video">
                <Video size={42} />
                <strong>Video preview will appear here</strong>
                <span>No sample video or synthetic detections are used.</span>
              </div>
            )}
          </div>
          <div className="live-ai-model-note">
            <Activity size={15} />
            {analysis
              ? `Models used: ${analysis.models.join(', ')} · Sampling every ~${analysis.video.sampleIntervalSeconds}s`
              : 'Real model results appear here after the backend processes your uploaded video.'}
          </div>
          {analysis?.modelWarnings?.map((warning) => (
            <p className="live-ai-model-warning" key={warning}>{warning}</p>
          ))}
          {analysis && (
            <>
              <p className="live-ai-speed-note">
                Speed values are not shown: this video/model setup has no calibrated real-world speed measurement.
              </p>
              <p className="live-ai-speed-note">
                The driver-distraction ResNet checkpoint is not executed because its matching architecture and class mapping are not available in the project.
              </p>
              {!analysis.vehicleDetectionAvailable && (
                <p className="live-ai-model-warning">
                  No configured model currently detects vehicles. Check the backend model warning or configure AI_VEHICLE_MODEL_PATH with weights whose labels include vehicle classes.
                </p>
              )}
            </>
          )}
        </article>

        <aside className="live-ai-card live-ai-alerts-panel">
          <div className="live-ai-card-heading">
            <div><h2>Recent Detections</h2><p>Latest objects detected in this clip</p></div>
            <button className="live-ai-view-all" onClick={() => navigateLivePage('events')} type="button">View all</button>
          </div>
          <div className="live-ai-alert-list">
            {trackedObjects.slice(0, 5).map((object) => (
              <button
                className="live-ai-alert-item"
                key={object.objectId}
                onClick={() => setSelectedRecord(object)}
                type="button"
              >
                <span className={`live-ai-alert-mark ${object.plateStatus ? 'amber' : object.violation ? 'red' : 'green'}`} />
                <span className="live-ai-alert-copy">
                  <strong>{object.plateNumber || object.label}</strong>
                  <small>{object.sourceId || 'Uploaded video'} · {formatTimestamp(object.lastSeenSeconds)}</small>
                </span>
                <span className="live-ai-alert-confidence">{(object.confidence * 100).toFixed(0)}%</span>
              </button>
            ))}
            {!trackedObjects.length && (
              <div className="live-ai-alert-empty">
                <Activity size={20} />
                <span>{analysis ? 'No tracked objects in this clip yet.' : 'Start video analysis to view activity.'}</span>
              </div>
            )}
          </div>
          <div className="live-ai-plate-insight">
            <div className="live-ai-plate-insight-heading">
              <span><Camera size={14} /> Plate recognition</span>
              <button onClick={() => navigateLivePage('events')} type="button">View table</button>
            </div>
            <div className="live-ai-plate-insight-counts">
              <span><CircleCheck size={13} /> {recognizedPlateCount} recognized</span>
              <span><CircleHelp size={13} /> {unrecognizedPlateCount} not recognized</span>
            </div>
            {plateRows.length > 0 && (
              <div className="live-ai-plate-insight-latest">
                <PlateNumber value={plateRows[0].plateNumber} compact />
                <span>{formatTimestamp(plateRows[0].lastSeenSeconds)}</span>
              </div>
            )}
            {!plateRows.length && (
              <p className="live-ai-plate-insight-empty">
                {analysis ? 'No number-plate tracks detected in this clip.' : 'Plate readings will appear after video analysis.'}
              </p>
            )}
          </div>
          <div className="live-ai-alert-footer">
            <span><i className="green" /> {trackedVehicles.length} vehicles</span>
            <span><i className="amber" /> {plateRows.length} plate tracks</span>
          </div>
        </aside>
      </section>
        </>
      )}

      {activePage === 'analytics' && (
        <section className="live-ai-analytics-page">
      <div className="live-ai-analytics-intro">
        <div><p className="live-ai-eyebrow">VIDEO ANALYSIS</p><h2>Traffic analytics</h2><p>Charts are calculated from detections in the current uploaded clip.</p></div>
        <span>{analysis ? `${analysis.video.sampledFrames} sampled frames` : 'No analyzed clip yet'}</span>
      </div>
      <section className="live-ai-chart-grid">
        <article className="live-ai-card live-ai-chart-card">
          <div className="live-ai-card-heading">
            <div><h2>Detected model classes</h2><p>From this video analysis only</p></div>
          </div>
          {vehicleChartData.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={vehicleChartData} margin={{ top: 8, right: 12, left: -14, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#344253" />
                <XAxis dataKey="name" tick={{ fill: '#afbdcb', fontSize: 10 }} axisLine={{ stroke: '#526174' }} tickLine={{ stroke: '#526174' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#afbdcb', fontSize: 10 }} axisLine={{ stroke: '#526174' }} tickLine={{ stroke: '#526174' }} />
                <Tooltip contentStyle={{ color: '#e6edf5', background: '#172231', border: '1px solid #39495b', borderRadius: 7 }} />
                <Bar dataKey="count" name="Detections" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="live-ai-chart-empty">Vehicle chart will populate after video analysis.</div>}
        </article>

        <article className="live-ai-card live-ai-chart-card">
          <div className="live-ai-card-heading">
            <div><h2>Violation events</h2><p>Only classes explicitly recognized as violations</p></div>
          </div>
          {violationChartData.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={violationChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={82} label>
                  {violationChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ color: '#e6edf5', background: '#172231', border: '1px solid #39495b', borderRadius: 7 }} />
                <Legend wrapperStyle={{ color: '#bdc9d6', fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="live-ai-chart-empty">No violation chart until an analyzed video provides a supported violation class.</div>}
        </article>
      </section>
      <section className="live-ai-card live-ai-chart-card live-ai-trend-card">
        <div className="live-ai-card-heading">
          <div><h2>Detection volume over clip time</h2><p>Detections grouped into 10-second clip intervals; this is not a real-time traffic count.</p></div>
        </div>
        {frameTrendData.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={frameTrendData} margin={{ top: 8, right: 16, left: -14, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#344253" />
              <XAxis dataKey="second" tickFormatter={(second) => formatTime(second)} tick={{ fill: '#afbdcb', fontSize: 10 }} axisLine={{ stroke: '#526174' }} tickLine={{ stroke: '#526174' }} />
              <YAxis allowDecimals={false} tick={{ fill: '#afbdcb', fontSize: 10 }} axisLine={{ stroke: '#526174' }} tickLine={{ stroke: '#526174' }} />
              <Tooltip
                labelFormatter={(second) => `${formatTime(Number(second))}–${formatTime(Number(second) + 10)}`}
                contentStyle={{ color: '#e6edf5', background: '#172231', border: '1px solid #39495b', borderRadius: 7 }}
              />
              <Line dataKey="detections" name="Detections" type="monotone" stroke="#44c384" strokeWidth={2.5} dot={{ r: 3, fill: '#44c384' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="live-ai-chart-empty">Detection timeline will appear after video analysis.</div>}
      </section>
        </section>
      )}

      {activePage === 'events' && (
        <>
      <section className="live-ai-card live-ai-table-card">
        <div className="live-ai-card-heading">
          <div>
            <h2>Recently Detected Number Plates</h2>
            <p>Unique tracked plate objects · repeated, valid OCR readings only · no official registration verification.</p>
          </div>
          <span className="live-ai-result-count">{filteredPlates.length} plate tracks</span>
        </div>
        <div className="live-ai-table-filters">
          <label className="live-ai-search">
            <Search size={15} />
            <input
              aria-label="Search plate, track ID, or source"
              onChange={(event) => resetPlateFilters(event.target.value)}
              placeholder="Search plate, track ID, source"
              value={plateSearch}
            />
          </label>
          <select
            aria-label="Filter plate recognition status"
            onChange={(event) => resetPlateFilters(plateSearch, event.target.value)}
            value={plateStatusFilter}
          >
            <option value="">All recognition statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Pending verification">Pending verification</option>
            <option value="Unreadable">Unreadable</option>
          </select>
          <select aria-label="Filter by source" onChange={(event) => setLiveFilters({ source: event.target.value })} value={sourceFilter}>
            <option value="">All sources</option>
            {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
          <input
            aria-label="Filter from clip time in seconds"
            className="live-ai-time-filter"
            min="0"
            onChange={(event) => setLiveFilters({ from: event.target.value })}
            placeholder="From (sec)"
            type="number"
            value={fromSeconds}
          />
          <input
            aria-label="Filter to clip time in seconds"
            className="live-ai-time-filter"
            min="0"
            onChange={(event) => setLiveFilters({ to: event.target.value })}
            placeholder="To (sec)"
            type="number"
            value={toSeconds}
          />
        </div>
        <div className="live-ai-table-wrap">
          <table className="live-ai-table">
            <thead>
              <tr>
                <th>S. No.</th>
                <th>Plate image</th>
                <th>Plate number</th>
                <th>OCR confidence</th>
                <th>Associated vehicle</th>
                <th>Detection confidence</th>
                <th>Source</th>
                <th>Detected at</th>
                <th>Status / action</th>
              </tr>
            </thead>
            <tbody>
              {pagedPlates.map((plate, index) => {
                const associatedVehicle = vehicleById.get(plate.vehicleId)
                return (
                <tr
                  aria-label={`Show details for ${plate.plateNumber || plate.plateStatus || 'unreadable plate'}`}
                  key={plate.objectId}
                  onClick={() => setSelectedRecord(plate)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedRecord(plate)
                    }
                  }}
                  tabIndex={0}
                >
                  <td>{(platePage - 1) * PAGE_SIZE + index + 1}</td>
                  <td><span className="live-ai-plate-thumb">{plate.evidenceUrl ? <img alt="Plate crop" src={plate.evidenceUrl} /> : 'No crop'}</span></td>
                  <td><PlateNumber value={plate.plateNumber} /></td>
                  <td>{Number.isFinite(plate.ocrConfidence) ? `${(plate.ocrConfidence * 100).toFixed(1)}%` : '—'}</td>
                  <td>{associatedVehicle ? `${associatedVehicle.label} · ${associatedVehicle.objectId}` : 'Unassociated'}</td>
                  <td>{(plate.confidence * 100).toFixed(1)}%</td>
                  <td>{plate.sourceId || '—'}</td>
                  <td>{formatTimestamp(plate.lastSeenSeconds)}</td>
                  <td className="live-ai-row-actions">
                    <span className={`live-ai-state-pill ${plate.plateStatus === 'Confirmed' ? 'confirmed' : plate.plateStatus === 'Unreadable' ? 'unreadable' : 'pending'}`}>{plate.plateStatus || 'Unreadable'}</span>
                    <button type="button" onClick={() => setSelectedRecord(plate)}>Details</button>
                  </td>
                </tr>
              )})}
              {!pagedPlates.length && (
                <tr>
                  <td className="live-ai-table-empty" colSpan="9">
                    {analysis ? 'No license-plate records match these filters.' : 'Plate readings appear after video analysis.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={platePage} total={filteredPlates.length} onChange={setPlatePage} />
      </section>

      <section className="live-ai-card live-ai-table-card">
        <div className="live-ai-card-heading">
          <div>
            <h2>Recently Detected Vehicles</h2>
            <p>One row per tracked vehicle · temporary video crops stay in this browser and are cleared when analysis restarts.</p>
          </div>
          <span className="live-ai-result-count">{filteredVehicles.length} unique tracks</span>
        </div>
        <div className="live-ai-table-filters">
          <label className="live-ai-search">
            <Search size={15} />
            <input
              aria-label="Search vehicle, plate, or source"
              onChange={(event) => resetVehicleFilters(event.target.value)}
              placeholder="Search vehicle, track ID, plate, source"
              value={vehicleSearch}
            />
          </label>
          <select
            aria-label="Filter vehicle type"
            onChange={(event) => resetVehicleFilters(vehicleSearch, event.target.value)}
            value={vehicleTypeFilter}
          >
            <option value="">All vehicle types</option>
            {vehicleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select aria-label="Filter by source" onChange={(event) => setLiveFilters({ source: event.target.value })} value={sourceFilter}>
            <option value="">All sources</option>
            {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
          <input
            aria-label="Filter from clip time in seconds"
            className="live-ai-time-filter"
            min="0"
            onChange={(event) => setLiveFilters({ from: event.target.value })}
            placeholder="From (sec)"
            type="number"
            value={fromSeconds}
          />
          <input
            aria-label="Filter to clip time in seconds"
            className="live-ai-time-filter"
            min="0"
            onChange={(event) => setLiveFilters({ to: event.target.value })}
            placeholder="To (sec)"
            type="number"
            value={toSeconds}
          />
        </div>
        {newRecordsWhileBrowsing > 0 && vehiclePage > 1 && (
          <button
            className="live-ai-new-records"
            onClick={() => setNewRecordsWhileBrowsing(0)}
            type="button"
          >
            {newRecordsWhileBrowsing} new tracked vehicle{newRecordsWhileBrowsing === 1 ? '' : 's'} detected. You are viewing older results.
          </button>
        )}
        <div className="live-ai-table-wrap">
          <table className="live-ai-table">
            <thead>
              <tr>
                <th>S. No.</th>
                <th>Vehicle image</th>
                <th>Vehicle type</th>
                <th>Tracking ID</th>
                <th>Confidence</th>
                <th>Plate number</th>
                <th>Plate confidence</th>
                <th>Camera / source</th>
                <th>Detected at</th>
                <th>Status / action</th>
              </tr>
            </thead>
            <tbody>
              {pagedVehicles.map((vehicle, index) => {
                const plate = plateByVehicleId.get(vehicle.objectId)
                return (
                <tr
                  aria-label={`Show details for ${vehicle.label} ${vehicle.objectId}`}
                  key={vehicle.objectId}
                  onClick={() => setSelectedRecord(vehicle)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedRecord(vehicle)
                    }
                  }}
                  tabIndex={0}
                >
                  <td>{(vehiclePage - 1) * PAGE_SIZE + index + 1}</td>
                  <td>
                    {vehicleImageUrls[vehicle.objectId]
                      ? <img className="live-ai-vehicle-thumb" src={vehicleImageUrls[vehicle.objectId]} alt={`Temporary crop of ${vehicle.label} ${vehicle.objectId}`} />
                      : <span className="live-ai-vehicle-thumb-empty">Not captured</span>}
                  </td>
                  <td>{vehicle.label}</td>
                  <td>{vehicle.objectId}</td>
                  <td>{(vehicle.confidence * 100).toFixed(1)}%</td>
                  <td><PlateNumber value={plate?.plateNumber} /></td>
                  <td>{Number.isFinite(plate?.ocrConfidence) ? `${(plate.ocrConfidence * 100).toFixed(1)}%` : '—'}</td>
                  <td>{vehicle.sourceId || '—'}</td>
                  <td>{formatTimestamp(vehicle.lastSeenSeconds)}</td>
                  <td className="live-ai-row-actions">
                    <span className="live-ai-state-pill">Detected</span>
                    <button type="button" onClick={() => setSelectedRecord(vehicle)}>Details</button>
                  </td>
                </tr>
              )})}
              {!pagedVehicles.length && (
                <tr><td className="live-ai-table-empty" colSpan="10">{analysis ? 'No vehicle records match these filters.' : 'No video analysis results yet.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={vehiclePage} total={filteredVehicles.length} onChange={(page) => { setVehiclePage(page); setNewRecordsWhileBrowsing(0) }} />
      </section>

      <section className="live-ai-card live-ai-table-card">
        <div className="live-ai-card-heading">
          <div>
            <h2>Violation event history</h2>
            <p>Events are listed only when a model class explicitly indicates a violation.</p>
          </div>
          {analysis && <span className="live-ai-result-count">{analysis.violationEvents.length} events</span>}
        </div>
        <div className="live-ai-table-wrap">
          <table className="live-ai-table">
            <thead>
              <tr>
                <th>Video time</th>
                <th>Violation</th>
                <th>Detected object</th>
                <th>Track ID</th>
                <th>Confidence</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {(analysis?.violationEvents || []).map((event, index) => (
                <tr
                  aria-label={`Show details for ${event.type}`}
                  key={`${event.model}-${event.timeSeconds}-${index}`}
                  onClick={() => setSelectedRecord({
                    objectId: event.trackId,
                    label: event.object,
                    model: event.model,
                    confidence: event.confidence,
                    lastSeenSeconds: event.timeSeconds,
                    violationType: event.type,
                  })}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                      keyEvent.preventDefault()
                      setSelectedRecord({
                        objectId: event.trackId,
                        label: event.object,
                        model: event.model,
                        confidence: event.confidence,
                        lastSeenSeconds: event.timeSeconds,
                        violationType: event.type,
                      })
                    }
                  }}
                  tabIndex={0}
                >
                  <td>{formatTimestamp(event.timeSeconds)}</td>
                  <td>{event.type}</td>
                  <td>{event.object}</td>
                  <td>{event.trackId || 'Not supplied by model'}</td>
                  <td>{(event.confidence * 100).toFixed(1)}%</td>
                  <td>{event.model}</td>
                </tr>
              ))}
              {(!analysis || !analysis.violationEvents.length) && (
                <tr>
                  <td className="live-ai-table-empty" colSpan="6">
                    {analysis ? 'No supported violation classes were detected.' : 'No video analysis results yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}
      {selectedRecord && (
        <div className="live-ai-drawer-backdrop" onClick={() => setSelectedRecord(null)} role="presentation">
          <aside
            aria-labelledby="live-ai-detail-title"
            aria-modal="true"
            className="live-ai-details-drawer"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="live-ai-drawer-heading">
              <div><small>DETECTION DETAILS</small><h2 id="live-ai-detail-title">{selectedRecord.violationType || selectedRecord.plateNumber || selectedRecord.label}</h2></div>
              <button aria-label="Close detection details" onClick={() => setSelectedRecord(null)} type="button"><X size={18} /></button>
            </div>
            {selectedVehicleImage ? (
              <div className="live-ai-vehicle-detail-image">
                <img
                  alt={`Temporary crop of ${selectedRecord.label || 'detected vehicle'}`}
                  src={selectedVehicleImage}
                />
                <span>Temporary vehicle crop from the analyzed video · not saved</span>
              </div>
            ) : (
              <div className="live-ai-evidence-placeholder">
                <Video size={24} />
                <span>No vehicle crop is available for this detection.</span>
              </div>
            )}
            <dl className="live-ai-detail-list">
              <div><dt>Tracking ID</dt><dd>{selectedRecord.objectId || selectedRecord.trackId || '—'}</dd></div>
              <div><dt>Class</dt><dd>{selectedRecord.label || 'License plate'}</dd></div>
              <div><dt>Model</dt><dd>{selectedRecord.model || '—'}</dd></div>
              <div><dt>Detection confidence</dt><dd>{Number.isFinite(selectedRecord.confidence) ? `${(selectedRecord.confidence * 100).toFixed(1)}%` : '—'}</dd></div>
              <div><dt>Plate reading</dt><dd><PlateNumber value={selectedRecord.plateNumber} /></dd></div>
              <div><dt>OCR confidence</dt><dd>{Number.isFinite(selectedRecord.ocrConfidence) ? `${(selectedRecord.ocrConfidence * 100).toFixed(1)}%` : '—'}</dd></div>
              <div><dt>Associated vehicle</dt><dd>{selectedRecord.vehicleId ? vehicleById.get(selectedRecord.vehicleId)?.objectId || selectedRecord.vehicleId : 'Unassociated'}</dd></div>
              <div><dt>Source</dt><dd>{selectedRecord.sourceId || videoFile?.name || '—'}</dd></div>
              <div><dt>Last observed</dt><dd>{Number.isFinite(selectedRecord.lastSeenSeconds) ? formatTimestamp(selectedRecord.lastSeenSeconds) : '—'}</dd></div>
              {selectedRecord.violationType && <div><dt>Violation</dt><dd>{selectedRecord.violationType}</dd></div>}
              <div><dt>Review status</dt><dd>Not reviewed · no review workflow is connected</dd></div>
            </dl>
          </aside>
        </div>
      )}
    </div>
  )
}
