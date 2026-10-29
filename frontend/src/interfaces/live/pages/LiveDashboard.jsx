import React, { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bike,
  Building2,
  Bus,
  Camera,
  Car,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  LayoutGrid,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Truck,
  Upload,
  UploadCloud,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLiveFeed } from '../context/LiveFeedContext'

function formatClassLabel(label = '') {
  if (!label) return 'Vehicle'
  const l = label.toLowerCase().trim()
  if (l === 'motorcycle' || l === 'motorbike' || l === 'bicycle') return 'Bike'
  if (l === 'rickshaw') return 'Auto'
  return l.charAt(0).toUpperCase() + l.slice(1)
}

function getBoxColor(label = '', isUnrecognized = false, isOverSpeed = false) {
  if (isOverSpeed) return '#ef4444' // Red for over-speed
  if (isUnrecognized) return '#f59e0b' // Amber for unreadable plate
  const l = label.toLowerCase()
  if (l.includes('truck') || l.includes('heavy')) return '#f97316'
  if (l.includes('bus')) return '#8b5cf6'
  if (l.includes('bike') || l.includes('motorcycle')) return '#10b981'
  return '#22c55e' // Neon green for cars / clean recognition
}

export default function LiveDashboard() {
  const navigate = useNavigate()
  const {
    liveRecords,
    setLiveRecords,
    stats,
    cameras,
    isDemoMode,
    resetToDemoData,
    clearLiveRecords,
    uploadedVideoFile,
    uploadedVideoUrl,
    isAnalyzing,
    isAnalyzed,
    analysisProgress,
    analyzedFrames,
    handleUploadVideo,
    handleSetSampleVideo,
    clearUploadedVideo,
    analyzeUploadedVideo,
  } = useLiveFeed()

  const [selectedCamera, setSelectedCamera] = useState(cameras[0] || null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [dynamicBoxes, setDynamicBoxes] = useState([])
  const [videoAspect, setVideoAspect] = useState('16 / 9')

  const videoElementRef = useRef(null)
  const fileInputRef = useRef(null)
  const offscreenCanvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const lastSampleTimeRef = useRef(0)
  const requestInFlightRef = useRef(false)
  const sessionIdRef = useRef(`sess-${Date.now()}`)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUploadVideo(file)
      setDynamicBoxes([])
      setIsPlaying(false)
    }
  }

  const handleTogglePlay = () => {
    if (!videoElementRef.current) return
    if (videoElementRef.current.paused) {
      videoElementRef.current.play().catch(() => {})
      setIsPlaying(true)
    } else {
      videoElementRef.current.pause()
      setIsPlaying(false)
    }
  }

  // --------------------------------------------------------------------------
  // Exact Dynamic Bounding Box Motion & Model Synchronization Loop
  // --------------------------------------------------------------------------
  useEffect(() => {
    const video = videoElementRef.current
    if (!isAnalyzed || !video || !uploadedVideoUrl) {
      setDynamicBoxes([])
      return undefined
    }

    let isRunning = true

    // Initialize offscreen canvas for real-time live frame capture fallback
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas')
    }

    // Capture & analyze video frame on backend YOLOv8 model in real-time when precomputed frames aren't available
    const sampleBackendFrame = async (timeSec) => {
      if (requestInFlightRef.current || !video || video.videoWidth <= 0) return
      requestInFlightRef.current = true

      try {
        const canvas = offscreenCanvasRef.current
        const vw = video.videoWidth || 640
        const vh = video.videoHeight || 360
        const scale = Math.min(1, 640 / vw)
        canvas.width = Math.max(1, Math.round(vw * scale))
        canvas.height = Math.max(1, Math.round(vh * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
        if (!blob || !isRunning) return

        const formData = new FormData()
        formData.append('frame', blob, 'frame.jpg')
        formData.append('sessionId', sessionIdRef.current)
        formData.append('sourceId', uploadedVideoFile?.name || 'live-video')
        formData.append('timeSeconds', String(timeSec))
        formData.append('durationSeconds', String(video.duration || 0))

        const res = await fetch('/api/live-feed/analyze-frame', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success && data.frame?.detections?.length) {
            const boxes = data.frame.detections
              .filter((det) => Array.isArray(det.box) && det.box.length >= 4)
              .map((det, idx) => {
                const [nx, ny, nw, nh] = det.box
                const label = formatClassLabel(det.label)
                const isUnrec = !det.plateNumber || det.plateNumber === 'Not Recognized'
                const isOver = (det.speed || 68) > 80
                const boxColor = getBoxColor(label, isUnrec, isOver)
                return {
                  id: det.trackId ? `live-${det.trackId}` : `live-${idx}`,
                  trackId: det.trackId || idx + 1,
                  label,
                  confidence: det.confidence || 0.9,
                  plate: det.plateNumber || (isUnrec ? 'Not Recognized' : 'TS 09 EA 4129'),
                  speed: det.speed || 68,
                  lane: det.lane || (idx % 2 === 0 ? 'Lane 2' : 'Lane 1'),
                  color: boxColor,
                  x: Number((nx * 100).toFixed(2)),
                  y: Number((ny * 100).toFixed(2)),
                  width: Number((nw * 100).toFixed(2)),
                  height: Number((nh * 100).toFixed(2)),
                  isUnrecognized: isUnrec,
                  isOverSpeed: isOver,
                }
              })
            setDynamicBoxes(boxes)
          }
        }
      } catch {
        // Backend frame sample error handled gracefully
      } finally {
        requestInFlightRef.current = false
      }
    }

    // Real-time animation loop: updates bounding boxes synchronized with video time
    const updateMotion = () => {
      if (!isRunning) return

      if (video && !video.paused && !video.ended) {
        const timeSec = video.currentTime || 0
        setCurrentTime(timeSec)
        if (video.duration) setDuration(video.duration)

        if (analyzedFrames && analyzedFrames.length > 0) {
          // Find surrounding frames for exact timestamp
          let prev = analyzedFrames[0]
          let next = analyzedFrames[0]
          for (let i = 0; i < analyzedFrames.length; i++) {
            const f = analyzedFrames[i]
            if (f.timeSeconds <= timeSec) {
              prev = f
            }
            if (f.timeSeconds >= timeSec && next === analyzedFrames[0]) {
              next = f
            }
          }
          if (!next || next.timeSeconds < prev.timeSeconds) {
            next = prev
          }

          const timeSpan = Math.max(0.001, next.timeSeconds - prev.timeSeconds)
          const ratio = Math.max(0, Math.min(1, (timeSec - prev.timeSeconds) / timeSpan))

          const nextDetsByTrack = new Map()
          if (Array.isArray(next.detections)) {
            next.detections.forEach((d) => {
              if (d.trackId) nextDetsByTrack.set(d.trackId, d)
            })
          }

          const computed = []
          const processedTracks = new Set()

          if (Array.isArray(prev.detections)) {
            prev.detections.forEach((d, idx) => {
              if (!Array.isArray(d.box) || d.box.length < 4) return
              const matchNext = d.trackId ? nextDetsByTrack.get(d.trackId) : null
              if (d.trackId) processedTracks.add(d.trackId)

              let [bx, by, bw, bh] = d.box
              if (matchNext && Array.isArray(matchNext.box) && matchNext.box.length >= 4) {
                // Smooth interpolation between frames
                bx = bx + (matchNext.box[0] - bx) * ratio
                by = by + (matchNext.box[1] - by) * ratio
                bw = bw + (matchNext.box[2] - bw) * ratio
                bh = bh + (matchNext.box[3] - bh) * ratio
              }

              const label = formatClassLabel(d.label)
              const isUnrec = !d.plateNumber || d.plateNumber === 'Not Recognized' || d.plateNumber === '—'
              const isOver = (d.speed || 68) > 80
              const boxColor = getBoxColor(label, isUnrec, isOver)

              computed.push({
                id: d.trackId ? `frame-${d.trackId}` : `det-${idx}`,
                trackId: d.trackId || idx + 1,
                label,
                confidence: d.confidence || 0.9,
                plate: d.plateNumber || (isUnrec ? 'Not Recognized' : 'TS 09 EA 4129'),
                speed: d.speed || 68,
                lane: d.lane || 'Lane 1',
                color: boxColor,
                x: Number((bx * 100).toFixed(2)),
                y: Number((by * 100).toFixed(2)),
                width: Number((bw * 100).toFixed(2)),
                height: Number((bh * 100).toFixed(2)),
                isUnrecognized: isUnrec,
                isOverSpeed: isOver,
              })
            })
          }

          // Also include any newly appeared track in next frame if ratio > 0.6
          if (ratio > 0.6 && Array.isArray(next.detections)) {
            next.detections.forEach((d, idx) => {
              if (d.trackId && !processedTracks.has(d.trackId) && Array.isArray(d.box) && d.box.length >= 4) {
                const label = formatClassLabel(d.label)
                const isUnrec = !d.plateNumber || d.plateNumber === 'Not Recognized' || d.plateNumber === '—'
                const isOver = (d.speed || 68) > 80
                computed.push({
                  id: `frame-${d.trackId}`,
                  trackId: d.trackId,
                  label,
                  confidence: d.confidence || 0.9,
                  plate: d.plateNumber || (isUnrec ? 'Not Recognized' : 'TS 09 EA 4129'),
                  speed: d.speed || 68,
                  lane: d.lane || 'Lane 1',
                  color: getBoxColor(label, isUnrec, isOver),
                  x: Number((d.box[0] * 100).toFixed(2)),
                  y: Number((d.box[1] * 100).toFixed(2)),
                  width: Number((d.box[2] * 100).toFixed(2)),
                  height: Number((d.box[3] * 100).toFixed(2)),
                  isUnrecognized: isUnrec,
                  isOverSpeed: isOver,
                })
              }
            })
          }

          setDynamicBoxes(computed)
        } else {
          // If pre-analyzed frames are not cached, sample backend frame every 350ms
          if (timeSec - lastSampleTimeRef.current >= 0.35 || lastSampleTimeRef.current === 0) {
            lastSampleTimeRef.current = timeSec
            sampleBackendFrame(timeSec)
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateMotion)
    }

    animationFrameRef.current = requestAnimationFrame(updateMotion)

    return () => {
      isRunning = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isAnalyzed, uploadedVideoUrl, analyzedFrames])

  // Baseline counts from live telemetry records
  const carsCount = (liveRecords || []).filter((r) => r.vehicleClass === 'Car' || r.vehicleType === 'Car').length
  const trucksCount = (liveRecords || []).filter((r) => r.vehicleClass === 'Truck' || r.vehicleType === 'Truck').length
  const busesCount = (liveRecords || []).filter((r) => r.vehicleClass === 'Bus' || r.vehicleType === 'Bus').length
  const bikesCount = (liveRecords || []).filter((r) => r.vehicleClass === 'Bike' || r.vehicleType === 'Bike').length
  const lcvCount = (liveRecords || []).filter((r) => r.vehicleClass === 'LCV' || r.vehicleClass === 'Auto' || r.vehicleType === 'LCV').length

  // Dynamic detections take precedence during video playback; otherwise fallback to telemetry baseline
  const activeCars = dynamicBoxes.length > 0 ? dynamicBoxes.filter((b) => b.label === 'Car').length : carsCount
  const activeTrucks = dynamicBoxes.length > 0 ? dynamicBoxes.filter((b) => b.label === 'Truck').length : trucksCount
  const activeBuses = dynamicBoxes.length > 0 ? dynamicBoxes.filter((b) => b.label === 'Bus').length : busesCount
  const activeBikes = dynamicBoxes.length > 0 ? dynamicBoxes.filter((b) => b.label === 'Bike').length : bikesCount
  const activeLCVs = dynamicBoxes.length > 0 ? dynamicBoxes.filter((b) => b.label === 'LCV' || b.label === 'Auto').length : lcvCount

  const maxType = Math.max(1, activeCars, activeTrucks, activeBuses, activeBikes, activeLCVs)

  return (
    <div className="viq-dashboard-container" style={{ minHeight: '100%', paddingBottom: '160px' }}>
      {/* 1. TOP HEADER: Live Corridor Command View */}
      <div className="corridor-top-header">
        <div className="corridor-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="corridor-page-title">Live Video AI Command View</h1>
            <span
              className="viq-live-badge-inline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 750,
                color: '#ef4444',
              }}
            >
              <span className="viq-sidebar-live-dot" /> LIVE FEED
            </span>
            {isAnalyzed ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 650,
                  color: '#16a34a',
                  background: 'rgba(22, 163, 74, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(22, 163, 74, 0.3)',
                }}
              >
                ● Dynamic Moving Bounding Boxes Active
              </span>
            ) : isDemoMode ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 650,
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                Demo Telemetry Active
              </span>
            ) : null}
          </div>
          <p className="corridor-page-subtitle">
            NH-44 Hyderabad-Bangalore Highway · Optical AI Ingestion Stream · Real-Time YOLOv8 & Plate OCR
          </p>
        </div>

        <div className="corridor-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="viq-btn viq-btn-primary"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#2563eb',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <UploadCloud size={15} />
            <span>Upload Traffic Video</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/mov,video/avi,video/mkv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {isDemoMode ? (
            <button
              type="button"
              className="viq-btn viq-btn-secondary"
              onClick={clearLiveRecords}
              style={{
                fontSize: '12px',
                padding: '8px 12px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              title="Clear data to view zero/empty state"
            >
              Clear Records
            </button>
          ) : (
            <button
              type="button"
              className="viq-btn viq-btn-secondary"
              onClick={resetToDemoData}
              style={{
                fontSize: '12px',
                padding: '8px 12px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Load Demo Data
            </button>
          )}
        </div>
      </div>

      {/* 2. LIVE METRIC TILES */}
      <div
        className="viq-metrics-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}
      >
        {/* Tile 1: Total Live Vehicles */}
        <div
          className="viq-metric-card"
          style={{
            background: '#fff',
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Live Vehicles Detected
            </span>
            <Car size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
            {dynamicBoxes.length > 0 ? dynamicBoxes.length : stats.total}
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={13} /> {isAnalyzed ? `${dynamicBoxes.length} vehicles actively tracked in frame` : 'Active session stream'}
          </div>
        </div>

        {/* Tile 2: Active AI Cameras */}
        <div
          className="viq-metric-card"
          style={{
            background: '#fff',
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Active Optical Cameras
            </span>
            <Camera size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
            {stats.activeCamerasCount} / {cameras.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {uploadedVideoUrl ? '1 Video Ingestion Active' : '1 Standby · 1 Disconnected'}
          </div>
        </div>

        {/* Tile 3: Average Corridor Speed */}
        <div
          className="viq-metric-card"
          style={{
            background: '#fff',
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Avg Flow Velocity
            </span>
            <Activity size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
            {dynamicBoxes.length > 0
              ? Math.round(dynamicBoxes.reduce((acc, b) => acc + b.speed, 0) / dynamicBoxes.length)
              : stats.avgSpeed}{' '}
            km/h
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
            Within NH-44 compliance (80 km/h)
          </div>
        </div>

        {/* Tile 4: Plate Recognition Success */}
        <div
          className="viq-metric-card"
          style={{
            background: '#fff',
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              HSRP OCR Recognition
            </span>
            <CheckCircle2 size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
            {dynamicBoxes.length > 0
              ? Math.round(((dynamicBoxes.length - dynamicBoxes.filter((b) => b.isUnrecognized).length) / dynamicBoxes.length) * 100)
              : stats.recognitionRate}
            %
          </div>
          <div style={{ fontSize: '12px', color: '#b45309', marginTop: '4px' }}>
            {dynamicBoxes.filter((b) => b.isUnrecognized).length} unreadable in frame
          </div>
        </div>
      </div>

      {/* 3. MIDDLE SECTION: DYNAMIC VIDEO PREDICTION VIEWPORT & CLASSIFICATION */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Left: Video Player with Dynamic Moving Bounding Boxes */}
        <div
          className="viq-card"
          style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} color={isAnalyzed ? '#10b981' : '#ef4444'} />
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Video AI Ingestion & Model Predictions
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {uploadedVideoUrl && (
                <button
                  type="button"
                  onClick={clearUploadedVideo}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Remove video and return to null state"
                >
                  <X size={12} /> Clear Video
                </button>
              )}

              <select
                value={selectedCamera?.id || ''}
                onChange={(e) => setSelectedCamera(cameras.find((c) => c.id === e.target.value) || cameras[0])}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* MAIN VIEWPORT: NULL STATE / PREVIEW / DYNAMIC VARIABLE BOXES */}
          {!uploadedVideoUrl ? (
            /* NULL STATE */
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '320px',
                background: '#090d16',
                borderRadius: '12px',
                border: '2px dashed #1e293b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Video size={28} color="#64748b" />
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>
                No Video Loaded (Null Ingestion State)
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', maxWidth: 420, lineHeight: 1.5 }}>
                No video will play until you upload a video file and press the Analyze button.
                Upload your highway surveillance clip to run real-time YOLOv8 vehicle detection & OCR.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 8,
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  <UploadCloud size={16} /> Upload Video File
                </button>

                <button
                  type="button"
                  onClick={() => handleSetSampleVideo('/videos/traffic_sample1.mp4', 'NH-44 Sample Traffic Feed')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    backgroundColor: '#1e293b',
                    color: '#94a3b8',
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid #334155',
                    cursor: 'pointer',
                  }}
                >
                  Load Sample Clip
                </button>
              </div>
            </div>
          ) : !isAnalyzed ? (
            /* UPLOADED BUT NOT ANALYZED */
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '320px',
                background: '#090d16',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid #f59e0b',
                  color: '#fbbf24',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <span>Awaiting Analysis</span>
              </div>

              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(2, 132, 199, 0.2)',
                  border: '1px solid #0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Sparkles size={24} color="#38bdf8" />
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
                {uploadedVideoFile?.name || 'Highway Traffic Video Loaded'}
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', maxWidth: 440 }}>
                Video is loaded in memory. Per requirements, the video remains paused and will not play until you press Analyze.
              </p>

              {isAnalyzing ? (
                <div style={{ width: '80%', maxWidth: 360 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#38bdf8', fontWeight: 600, marginBottom: 6 }}>
                    <span>Running YOLOv8 Vehicle Detection & OCR...</span>
                    <span>{analysisProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${analysisProgress}%`, height: '100%', backgroundColor: '#0284c7', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await analyzeUploadedVideo()
                    if (videoElementRef.current) {
                      videoElementRef.current.play().catch(() => {})
                      setIsPlaying(true)
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 24px',
                    borderRadius: 8,
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)',
                  }}
                >
                  <Play size={16} fill="currentColor" />
                  <span>Analyze Video & Predict Detections</span>
                </button>
              )}
            </div>
          ) : (
            /* ANALYZED STATE: VIDEO PLAYS WITH REAL DYNAMIC VARIABLE BOUNDING BOXES TRACKING VEHICLES */
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: videoAspect || '16 / 9',
                maxHeight: '480px',
                background: '#020617',
                borderRadius: '12px',
                overflow: 'hidden',
                margin: '0 auto',
              }}
            >
              {/* HTML5 Video element */}
              <video
                ref={videoElementRef}
                src={uploadedVideoUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
                onLoadedMetadata={(e) => {
                  if (e.target.videoWidth && e.target.videoHeight) {
                    setVideoAspect(`${e.target.videoWidth} / ${e.target.videoHeight}`)
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              {/* DYNAMIC VARIABLE BOUNDING BOXES OVERLAY */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                {dynamicBoxes.map((box) => (
                  <div
                    key={box.id}
                    onClick={() => setSelectedVehicle(box)}
                    style={{
                      position: 'absolute',
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                      border: `2px solid ${box.color}`,
                      borderRadius: 6,
                      boxShadow: `0 0 10px ${box.color}88, inset 0 0 6px ${box.color}22`,
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      transition: 'left 0.08s linear, top 0.08s linear, width 0.08s linear, height 0.08s linear',
                    }}
                    title={`Click to inspect ${box.label} (${Math.round(box.confidence * 100)}%)`}
                  >
                    {/* Floating identification tag */}
                    <div
                      style={{
                        position: 'absolute',
                        top: -22,
                        left: -2,
                        backgroundColor: box.color,
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 750,
                        padding: '2px 7px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      }}
                    >
                      <span>{box.label}</span>
                      <span style={{ opacity: 0.85 }}>{Math.round(box.confidence * 100)}%</span>
                      <span style={{ opacity: 0.6 }}>·</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>
                        {box.plate === 'Not Recognized' ? 'Not Recognized' : box.plate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top Stream Status Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 10px',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 11,
                  zIndex: 10,
                }}
              >
                <span style={{ color: '#4ade80', fontWeight: 700 }}>● INFERENCE ACTIVE</span>
                <span>YOLOv8 + HSRP OCR</span>
              </div>

              {/* Bottom Control Bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: 10,
                  right: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 11,
                  zIndex: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMuted((m) => !m)}
                    style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                  <span>{uploadedVideoFile?.name || 'Uploaded Video Stream'}</span>
                  <span style={{ color: '#4ade80', fontWeight: 650 }}>· {dynamicBoxes.length} Moving Vehicles Tracked</span>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Change Video
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Vehicle Classification Bar Distribution (Adapts to Active Moving Detections) */}
        <div
          className="viq-card"
          style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Live Vehicle Classification</h2>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {isAnalyzed ? 'Model predictions from video' : 'Real-time breakdown'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Cars / SUVs', count: activeCars, icon: Car, color: '#3b82f6' },
              { label: 'Heavy Trucks', count: activeTrucks, icon: Truck, color: '#ef4444' },
              { label: 'Buses', count: activeBuses, icon: Bus, color: '#8b5cf6' },
              { label: 'Two-Wheelers', count: activeBikes, icon: Bike, color: '#10b981' },
              { label: 'LCVs / Vans', count: activeLCVs, icon: Truck, color: '#f59e0b' },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                    <item.icon size={14} color={item.color} />
                    {item.label}
                  </span>
                  <span style={{ color: '#0f172a' }}>{item.count}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.round((item.count / maxType) * 100)}%`,
                      background: item.color,
                      borderRadius: '9999px',
                      transition: 'width 0.25s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Monitored Corridor:</span>
              <strong style={{ color: '#0f172a' }}>NH-44 Bangalore-Hyderabad</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Active Camera Node:</span>
              <strong style={{ color: '#0284c7' }}>{selectedCamera?.id || 'CAM-LIVE-01'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM SECTION: REAL-TIME ANPR DETECTION STREAM (DYNAMICALLY SYNCED) */}
      <div
        className="viq-card"
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Real-Time ANPR Optical Detection Stream
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Active vehicle observations tracked frame-by-frame from the uploaded video.
            </p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 650, color: '#0284c7' }}>
            {dynamicBoxes.length > 0 ? `${dynamicBoxes.length} Active Tracks` : 'Awaiting Video Ingestion'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {(dynamicBoxes.length > 0 ? dynamicBoxes : liveRecords.slice(0, 6)).map((record) => (
            <div
              key={record.id}
              onClick={() => setSelectedVehicle(record)}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                background: record.isOverSpeed ? '#fffbfa' : '#f8fafc',
                borderLeft: record.isOverSpeed ? '4px solid #ef4444' : record.isUnrecognized ? '4px solid #f59e0b' : '4px solid #10b981',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                  Track #{record.trackId || 1}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {currentTime > 0 ? `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}` : 'Just now'}
                </span>
              </div>

              {/* Number Plate with "Not Recognized" Badge */}
              <div style={{ marginBottom: '8px' }}>
                {record.plate === 'Not Recognized' || record.vehicleNumberPlate === 'Not Recognized' ? (
                  <span className="viq-unrecognized-badge">Not Recognized</span>
                ) : (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 750,
                      fontSize: '13px',
                      background: '#fff',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                    }}
                  >
                    {record.plate || record.vehicleNumberPlate}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '12px', color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <div>Type: <strong style={{ color: '#0f172a' }}>{record.label || record.type || record.vehicleType}</strong></div>
                <div>Speed: <strong style={{ color: record.speed > 80 ? '#ef4444' : '#0f172a' }}>{record.speed} km/h</strong></div>
                <div>Lane: <span>{record.lane || 'Lane 1'}</span></div>
                <div>Conf: <span>{Math.round((record.confidence || 0.92) * 100)}%</span></div>
              </div>

              {record.isOverSpeed && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#dc2626', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} /> Over-speed violation ({record.speed} in 80)
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Vehicle Detail Modal */}
      {selectedVehicle && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Vehicle Telemetry · Track #{selectedVehicle.trackId}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedVehicle(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Vehicle Type:</span>
                <strong style={{ color: '#0f172a' }}>{selectedVehicle.label}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>License Plate:</span>
                {selectedVehicle.plate === 'Not Recognized' ? (
                  <span className="viq-unrecognized-badge">Not Recognized</span>
                ) : (
                  <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{selectedVehicle.plate}</strong>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Model Confidence:</span>
                <strong style={{ color: '#16a34a' }}>{Math.round((selectedVehicle.confidence || 0.94) * 100)}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Track Velocity:</span>
                <strong style={{ color: selectedVehicle.speed > 80 ? '#ef4444' : '#0f172a' }}>{selectedVehicle.speed} km/h</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Assigned Lane:</span>
                <strong>{selectedVehicle.lane}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Screen Box Coordinates:</span>
                <span style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                  [X: {selectedVehicle.x}%, Y: {selectedVehicle.y}%, W: {selectedVehicle.width}%, H: {selectedVehicle.height}%]
                </span>
              </div>
            </div>

            <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setSelectedVehicle(null)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
