import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, Clock3, MapPin, Maximize2 } from 'lucide-react'

export default function CameraFeedPanel({ camera, cameras = [], onSelectCamera }) {
  const playerRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [liveTime, setLiveTime] = useState(() => new Date())

  useEffect(() => {
    setIsLoading(Boolean(camera?.streamPageUrl))
    setHasError(!camera?.streamPageUrl)
  }, [camera?.id, camera?.streamPageUrl])

  useEffect(() => {
    const timer = window.setInterval(() => setLiveTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function toggleFullscreen() {
    if (!playerRef.current) return
    if (document.fullscreenElement) document.exitFullscreen()
    else playerRef.current.requestFullscreen?.()
  }

  if (!camera) return null

  return (
    <section className="camera-live-feed-panel" aria-label="Live camera feed">
      <header className="camera-live-feed-header">
        <div className="camera-live-feed-title">
          <div className="camera-live-feed-icon"><Camera size={17} /></div>
          <div><strong>Live Feed</strong><span><MapPin size={12} />{camera.location || 'NH-44 Corridor'}</span></div>
        </div>
        <div className="camera-live-feed-actions">
          <label className="camera-live-feed-selector">
            <span>Camera</span>
            <ChevronDown size={13} />
            <select aria-label="Change live camera" onChange={(event) => onSelectCamera?.(cameras.find((item) => item.id === event.target.value))} value={camera.id}>
              {cameras.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <span className="camera-live-feed-id"><i />Camera ID: {camera.id}</span>
        </div>
      </header>
      <div className="camera-live-feed-stage" ref={playerRef}>
        {!hasError && <iframe allow="autoplay; fullscreen; picture-in-picture" allowFullScreen onError={() => { setIsLoading(false); setHasError(true) }} onLoad={() => setIsLoading(false)} src={camera.streamPageUrl} title={`Live camera feed: ${camera.name}`} />}
        {isLoading && !hasError && <div className="camera-live-feed-message"><span className="camera-loading-spinner" />Loading camera feed...</div>}
        {hasError && <div className="camera-live-feed-message camera-live-feed-error"><Camera size={24} /><strong>Unable to load camera feed</strong><span>Open the source feed to check its connection.</span></div>}
        <span className="camera-live-feed-badge"><i /> LIVE</span>
        <div className="camera-live-feed-video-actions"><button aria-label="View camera feed fullscreen" className="camera-live-feed-mute" onClick={toggleFullscreen} type="button"><Maximize2 size={15} /></button></div>
      </div>
      <footer className="camera-live-feed-footer"><span><MapPin size={13} />{camera.location || 'NH-44 Corridor'}</span><span>{Number(camera.value || 0).toLocaleString()} records captured</span><span className="camera-live-feed-clock"><Clock3 size={15} /><strong>{liveTime.toLocaleTimeString()}</strong><small>{liveTime.toLocaleDateString()}</small></span><span className="camera-live-feed-time">{camera.status || 'ACTIVE'}</span></footer>
    </section>
  )
}
