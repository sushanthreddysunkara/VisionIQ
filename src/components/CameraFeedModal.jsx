import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, ExternalLink, Maximize2, X } from 'lucide-react'

export default function CameraFeedModal({ camera, cameras = [], isOpen, onClose, onSelectCamera }) {
  const playerRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  useEffect(() => {
    setIsLoading(Boolean(camera?.streamPageUrl))
    setLoadError(!camera?.streamPageUrl)
  }, [camera?.id, camera?.streamPageUrl, isOpen])

  if (!isOpen || !camera) return null

  function toggleFullscreen() {
    if (!playerRef.current) return
    if (document.fullscreenElement) document.exitFullscreen()
    else playerRef.current.requestFullscreen?.()
  }

  function handleCameraChange(event) {
    const nextCamera = cameras.find((item) => item.id === event.target.value)
    if (nextCamera) onSelectCamera?.(nextCamera)
  }

  return (
    <div className="camera-feed-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section aria-label="Camera feed player" className="camera-feed-modal" onMouseDown={(event) => event.stopPropagation()} ref={playerRef}>
        <header className="camera-feed-header">
          <div className="camera-feed-heading">
            <div className="camera-feed-icon"><Camera size={16} /></div>
            <div><p className="section-kicker">SHARED LIVE CAMERA SOURCE</p><h2>{camera.name}</h2><span>{camera.location || 'NH-44 Corridor'}</span></div>
          </div>
          <div className="camera-feed-header-actions">
            <label className="camera-feed-select">Camera <ChevronDown size={13} /><select aria-label="Select camera" onChange={handleCameraChange} value={camera.id}>{cameras.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <span className="camera-live-indicator"><i /> LIVE SOURCE</span>
            <button aria-label="Close camera feed" className="camera-feed-close" onClick={onClose} type="button"><X size={18} /></button>
          </div>
        </header>

        <div className="camera-feed-stage">
          {!loadError && <iframe allow="autoplay; fullscreen; picture-in-picture" allowFullScreen onError={() => { setIsLoading(false); setLoadError(true) }} onLoad={() => setIsLoading(false)} src={camera.streamPageUrl} title={`Live camera feed: ${camera.name}`} />}
          {isLoading && !loadError && <div className="camera-feed-message"><span className="camera-loading-spinner" />Connecting to the shared live camera...</div>}
          {loadError && <div className="camera-feed-message camera-feed-error"><Camera size={25} /><strong>Unable to load camera feed</strong><span>Check the source connection or open it directly.</span></div>}
        </div>

        <div className="camera-feed-details"><span><strong>Camera ID</strong>{camera.id}</span><span><strong>Location</strong>{camera.location || 'NH-44 Corridor'}</span><span><strong>Status</strong><b>{camera.status || 'ACTIVE'}</b></span><span><strong>Records captured</strong>{Number(camera.value || 0).toLocaleString()}</span></div>

        <div className="camera-feed-controls">
          <a className="camera-feed-source-link" href={camera.streamPageUrl} rel="noreferrer" target="_blank"><ExternalLink size={15} /> Open source feed</a>
          <button aria-label="Fullscreen" className="camera-feed-control-button" onClick={toggleFullscreen} type="button"><Maximize2 size={16} /></button>
        </div>
      </section>
    </div>
  )
}
