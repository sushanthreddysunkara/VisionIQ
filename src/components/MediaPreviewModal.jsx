import React, { useEffect, useState } from 'react'
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileVideo,
  Gauge,
  Image as ImageIcon,
  Layers,
  MapPin,
  Maximize2,
  Play,
  Shield,
  Sparkles,
  X,
} from 'lucide-react'
import SurveillanceVideoPlayer from './SurveillanceVideoPlayer'
import { formatTimestampIst } from '../data/dashboardData'

export default function MediaPreviewModal({
  isOpen,
  onClose,
  row,
  allRows = [],
  onSelectRow,
  initialTab = 'video', // 'vehicle' | 'plate' | 'video'
}) {
  const [activeMediaTab, setActiveMediaTab] = useState(initialTab) // 'vehicle' | 'plate' | 'video'
  const [copiedPath, setCopiedPath] = useState(false)
  const [imgLoadError, setImgLoadError] = useState(false)
  const [plateLoadError, setPlateLoadError] = useState(false)

  useEffect(() => {
    setActiveMediaTab(initialTab || 'video')
  }, [initialTab, row?.id, row?.observationId])

  useEffect(() => {
    setImgLoadError(false)
    setPlateLoadError(false)
  }, [row?.id, row?.observationId])

  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose?.()
      } else if (e.key === 'ArrowLeft' && allRows.length > 1 && onSelectRow) {
        navigateRow(-1)
      } else if (e.key === 'ArrowRight' && allRows.length > 1 && onSelectRow) {
        navigateRow(1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, row, allRows, onSelectRow])

  if (!isOpen || !row) return null

  const currentIndex = allRows.findIndex(
    (r) =>
      (r.id && r.id === row.id) ||
      (r.observationId && r.observationId === row.observationId)
  )

  function navigateRow(direction) {
    if (currentIndex === -1 || !allRows.length) return
    const nextIdx = (currentIndex + direction + allRows.length) % allRows.length
    onSelectRow?.(allRows[nextIdx])
  }

  const isOverSpeed =
    row.overSpeed === 'Yes' ||
    row.isOverSpeed ||
    Number(row.speed) > Number(row.speedLimit)

  const plateConfidencePercent = Math.round(
    (row.plateConfidence || row.confidence) > 1
      ? row.plateConfidence || row.confidence
      : (row.plateConfidence || row.confidence || 0.95) * 100
  )

  // Extract raw path strings
  const videoUrl =
    row.videoClipPath ||
    row.videoUrl ||
    row.url ||
    row.video ||
    row['Video URL'] ||
    row['Video Clip Path'] ||
    row['Vedio Clip Path'] ||
    row['Video Link'] ||
    row['video_url'] ||
    row['URL'] ||
    row['link'] ||
    ''

  const vehicleImagePath =
    row.vehicleImagePath ||
    row.vehicleImage ||
    row['Vehicle Image Path'] ||
    row['vehicle_photos'] ||
    ''

  const plateImagePath =
    row.plateImagePath ||
    row['Plate Image Path'] ||
    row['plate_photos'] ||
    ''

  function getBasename(pathStr) {
    if (!pathStr || typeof pathStr !== 'string') return 'Unknown'
    const parts = pathStr.split('/')
    return parts[parts.length - 1] || pathStr
  }

  // Active path depending on current tab
  const currentActivePath =
    activeMediaTab === 'video'
      ? videoUrl
      : activeMediaTab === 'plate'
      ? plateImagePath
      : vehicleImagePath

  function handleCopyPath() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentActivePath)
      setCopiedPath(true)
      setTimeout(() => setCopiedPath(false), 2000)
    }
  }

  function handleDownloadImage() {
    const targetUrl =
      (activeMediaTab === 'plate' && plateImagePath && !plateLoadError)
        ? plateImagePath
        : vehicleImagePath || row.extractedImage || row.vehicleImageDataUrl
    if (!targetUrl) return
    const link = document.createElement('a')
    link.href = targetUrl
    link.download = `${row.id || 'OBS'}_${activeMediaTab}_${row.vehicleType || 'Vehicle'}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Determine actual image source for vehicle
  const vehicleSrc = !imgLoadError && (
    row.extractedImage ||
    row.vehicleImageDataUrl ||
    (vehicleImagePath && (vehicleImagePath.startsWith('http') || vehicleImagePath.startsWith('/')) ? vehicleImagePath : '')
  )

  // Determine actual image source for plate
  const plateSrc =
    (!plateLoadError && plateImagePath && (plateImagePath.startsWith('http') || plateImagePath.startsWith('/')))
      ? plateImagePath
      : null

  return (
    <div className="media-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="media-modal-container media-modal-tactical"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tactical Surveillance Console Header */}
        <div className="media-modal-tactical-header">
          <div className="media-tactical-title-wrap">
            <div className="media-tactical-pill-row">
              <span className="media-tactical-rec-pill">
                <span className="media-rec-dot" />
                SURVEILLANCE EVIDENCE
              </span>
              <span className="media-tactical-track-pill">
                TARGET ID: #{row.id || row.observationId || '1383'}
              </span>
              <span className="media-tactical-class-pill">
                {String(row.vehicleType || row.type || 'Vehicle').toUpperCase()}
              </span>
              {row.hasExtractedImage && (
                <span className="media-tactical-xlsx-pill">
                  <Sparkles size={11} />
                  Excel Asset
                </span>
              )}
            </div>

            <div className="media-tactical-headline">
              <h2>
                {row.vehicleType || row.type || 'Vehicle'} —{' '}
                <span style={{ color: '#38bdf8', letterSpacing: '1px' }}>
                  {row.vehicleNumberPlate || row.numberPlate || 'TG 08 Z 07'}
                </span>
              </h2>
              <p className="media-tactical-coords">
                <Clock size={12} />
                <span>{formatTimestampIst(row)}</span>
                <span style={{ color: '#475569' }}>·</span>
                <MapPin size={12} />
                <span>
                  {row.latitude?.toFixed(4) || '17.4485'}°N, {row.longitude?.toFixed(4) || '78.3742'}°E
                </span>
                <span style={{ color: '#475569' }}>·</span>
                <span style={{ color: '#94a3b8' }}>{row.roadName || row.location || 'Outer Corridor Sector 1'}</span>
              </p>
            </div>
          </div>

          <div className="media-modal-header-actions">
            {allRows.length > 1 && (
              <div className="media-nav-buttons">
                <button
                  className="media-nav-btn"
                  onClick={() => navigateRow(-1)}
                  title="Previous record (Left Arrow)"
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="media-nav-counter">
                  {currentIndex >= 0 ? currentIndex + 1 : 1} / {allRows.length}
                </span>
                <button
                  className="media-nav-btn"
                  onClick={() => navigateRow(1)}
                  title="Next record (Right Arrow)"
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <button
              className="media-modal-close-btn"
              onClick={onClose}
              title="Close (Esc)"
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tactical Media Dock: 3 Sleek Surveillance Selector Cards */}
        <div className="media-tactical-body">
          <div className="media-evidence-dock-grid">
            {/* Card 1: Vehicle Image */}
            <button
              className={`media-evidence-card ${activeMediaTab === 'vehicle' ? 'active-card' : ''}`}
              onClick={() => setActiveMediaTab('vehicle')}
              type="button"
            >
              <div className="evidence-card-icon-col">
                <div className="evidence-card-icon-wrap icon-cyan">
                  <ImageIcon size={18} />
                </div>
              </div>
              <div className="evidence-card-info-col">
                <span className="evidence-card-kicker">VEHICLE DETECTION</span>
                <strong className="evidence-card-filename" title={vehicleImagePath}>
                  {getBasename(vehicleImagePath || 'track_1383.jpg')}
                </strong>
                <span className="evidence-card-meta">
                  1080p Optical Snapshot
                </span>
              </div>
              <span className={`evidence-card-indicator ${activeMediaTab === 'vehicle' ? 'indicator-active' : ''}`} />
            </button>

            {/* Card 2: License Plate ANPR */}
            <button
              className={`media-evidence-card ${activeMediaTab === 'plate' ? 'active-card' : ''}`}
              onClick={() => setActiveMediaTab('plate')}
              type="button"
            >
              <div className="evidence-card-icon-col">
                <div className="evidence-card-icon-wrap icon-emerald">
                  <Eye size={18} />
                </div>
              </div>
              <div className="evidence-card-info-col">
                <span className="evidence-card-kicker">LICENSE PLATE ANPR</span>
                <strong className="evidence-card-filename" title={plateImagePath}>
                  {getBasename(plateImagePath || 'plate_photos/track_1383.jpg')}
                </strong>
                <span className="evidence-card-meta">
                  {plateConfidencePercent}% OCR Match
                </span>
              </div>
              <span className={`evidence-card-indicator ${activeMediaTab === 'plate' ? 'indicator-active' : ''}`} />
            </button>

            {/* Card 3: Video Stream */}
            <button
              className={`media-evidence-card ${activeMediaTab === 'video' ? 'active-card' : ''}`}
              onClick={() => setActiveMediaTab('video')}
              type="button"
            >
              <div className="evidence-card-icon-col">
                <div className="evidence-card-icon-wrap icon-blue">
                  <FileVideo size={18} />
                </div>
              </div>
              <div className="evidence-card-info-col">
                <span className="evidence-card-kicker">ANNOTATED STREAM</span>
                <strong className="evidence-card-filename" title={videoUrl}>
                  {getBasename(videoUrl || 'annotated.mp4')}
                </strong>
                <span className="evidence-card-meta">
                  {activeMediaTab === 'video' ? '● STREAMING LIVE' : 'Click to Play'}
                </span>
              </div>
              <span className={`evidence-card-indicator ${activeMediaTab === 'video' ? 'indicator-active' : ''}`} />
            </button>
          </div>

          {/* Active Stream URI Pill Bar */}
          <div className="media-tactical-uri-bar">
            <div className="uri-label-group">
              <span className="uri-tag">SOURCE URI</span>
              <code className="uri-code-val" title={currentActivePath}>
                {currentActivePath}
              </code>
            </div>

            <div className="uri-actions-group">
              <button
                className="uri-action-btn"
                onClick={handleCopyPath}
                title="Copy active path to clipboard"
                type="button"
              >
                {copiedPath ? <Check color="#34d399" size={12} /> : <Copy size={12} />}
                <span>{copiedPath ? 'Copied' : 'Copy'}</span>
              </button>

              {currentActivePath && (currentActivePath.startsWith('http') || currentActivePath.startsWith('/')) && (
                <a
                  className="uri-action-btn"
                  href={currentActivePath}
                  rel="noopener noreferrer"
                  target="_blank"
                  title="Open source file in new browser window"
                >
                  <ExternalLink size={12} />
                  <span>Open ↗</span>
                </a>
              )}
            </div>
          </div>

          {/* High-Resolution Tactical Viewport Screen */}
          <div className="media-tactical-viewport">
            {activeMediaTab === 'video' && videoUrl ? (
              /* Video Player Mode */
              <SurveillanceVideoPlayer
                autoPlay={true}
                row={row}
                videoClipPath={videoUrl}
              />
            ) : activeMediaTab === 'video' ? (
              <div className="media-tactical-placeholder"><FileVideo size={48} /><p>No video URL was provided in the Excel file.</p></div>
            ) : activeMediaTab === 'plate' ? (
              /* Plate Crop View */
              <div className="media-tactical-frame">
                {plateSrc ? (
                  <img
                    alt={`Plate crop for ${row.vehicleNumberPlate || 'Vehicle'}`}
                    className="media-tactical-img"
                    onError={() => setPlateLoadError(true)}
                    src={plateSrc}
                  />
                ) : (
                  <div className="media-tactical-placeholder"><ImageIcon size={48} /><p>No number plate image URL was provided in the Excel file.</p></div>
                )}

                {/* CCTV HUD Overlay */}
                <div className="media-cctv-hud-top">
                  <span className="media-hud-cam">
                    <Camera size={12} />
                    {row.camera || 'CAM-04-HYD'} · ANPR CROP
                  </span>
                  <span className="media-hud-time">{formatTimestampIst(row)}</span>
                </div>

                <div className="media-cctv-hud-bottom">
                  <div className="media-hud-plate">
                    <span>ANPR OCR</span>
                    <strong>{row.vehicleNumberPlate || row.numberPlate || 'TG 08 Z 07'}</strong>
                    <span className="media-hud-conf">({plateConfidencePercent}%)</span>
                  </div>
                  <div className="media-hud-speed media-hud-speed-ok">
                    <span>IR ILLUMINATION 850nm</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Vehicle Image View */
              <div className="media-tactical-frame">
                {vehicleSrc ? (
                  <img
                    alt={`Vehicle Detection ${row.vehicleType || 'Vehicle'} - ${row.vehicleNumberPlate || 'N/A'}`}
                    className="media-tactical-img"
                    onError={() => setImgLoadError(true)}
                    src={vehicleSrc}
                  />
                ) : (
                  <div className="media-tactical-placeholder">
                    <ImageIcon size={48} />
                    <p>Optical capture standby for target #{row.id || '1383'}</p>
                  </div>
                )}

                {/* Corner reticles */}
                <span className="tactical-crosshair top-left">+</span>
                <span className="tactical-crosshair top-right">+</span>
                <span className="tactical-crosshair bottom-left">+</span>
                <span className="tactical-crosshair bottom-right">+</span>

                {/* CCTV Top Overlay */}
                <div className="media-cctv-hud-top">
                  <div className="media-hud-rec">
                    <span className="media-hud-rec-dot" />
                    <span>REC</span>
                  </div>
                  <span className="media-hud-cam">{row.camera || 'CAM-04-HYD'} · OPTICAL</span>
                  <span className="media-hud-time">{formatTimestampIst(row)}</span>
                </div>

                {/* CCTV Bottom Overlay */}
                <div className="media-cctv-hud-bottom">
                  <div className="media-hud-plate">
                    <span>TARGET</span>
                    <strong>{row.vehicleNumberPlate || row.numberPlate || 'TG 08 Z 07'}</strong>
                    <span className="media-hud-conf">({plateConfidencePercent}%)</span>
                  </div>

                  <div
                    className={`media-hud-speed ${
                      isOverSpeed ? 'media-hud-speed-violation' : 'media-hud-speed-ok'
                    }`}
                  >
                    <Gauge size={13} />
                    <span>
                      {row.speed || 48} km/h &nbsp;·&nbsp; LIMIT: {row.speedLimit || 60} km/h
                    </span>
                    {isOverSpeed && <span className="media-hud-alert-tag">OVERSPEED</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tactical Bottom Toolbar */}
          <div className="media-tactical-bottom-bar">
            <div className="tactical-bar-left">
              <span className="tactical-status-indicator">
                <span className="status-ping" />
                SENSOR FEED LOCKED
              </span>
              <span className="tactical-meta-sep">·</span>
              <span className="tactical-meta-item">
                CLASSIFICATION: <strong>{String(row.vehicleType || row.type || 'Vehicle').toUpperCase()}</strong>
              </span>
              <span className="tactical-meta-sep">·</span>
              <span className="tactical-meta-item">
                CONFIDENCE: <strong>{plateConfidencePercent}%</strong>
              </span>
            </div>

            <div className="tactical-bar-right">
              <button
                className="tactical-download-btn"
                onClick={handleDownloadImage}
                title="Download full-resolution evidence asset"
                type="button"
              >
                <Download size={13} />
                <span>Save Asset</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
