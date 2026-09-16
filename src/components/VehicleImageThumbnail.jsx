import React from 'react'
import { Eye, FileVideo, Image as ImageIcon, Play, Sparkles } from 'lucide-react'

export default function VehicleImageThumbnail({
  row,
  onClick,
  onPlayVideo,
  size = 'table', // 'sm' | 'md' | 'lg' | 'table'
  showBadge = true,
}) {
  if (!row) return null

  const imgSrc = row.extractedImage || row.vehicleImageDataUrl
  const hasExtracted = Boolean(row.hasExtractedImage)
  const hasVideo = Boolean(row.videoClipPath)

  const sizeClasses = {
    sm: 'veh-thumb-sm', // 44x30
    md: 'veh-thumb-md', // 56x38
    lg: 'veh-thumb-lg', // 76x50
    table: 'veh-thumb-table', // 100x64 (Large prominent table card)
  }

  return (
    <div
      className={`vehicle-image-thumb-wrap ${sizeClasses[size] || sizeClasses.table} ${
        hasExtracted ? 'has-xlsx-image' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(row)
      }}
      title={
        hasExtracted
          ? `Extracted from Excel (${row.extractedImageName || 'image.png'}) - Click to inspect media evidence`
          : `Vehicle Capture (${row.vehicleImage || 'Image'}) - Click to inspect media evidence`
      }
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(row)
        }
      }}
    >
      {imgSrc ? (
        <img
          alt={row.vehicleImage || 'Vehicle capture'}
          className="vehicle-image-thumb-img"
          loading="lazy"
          src={imgSrc}
        />
      ) : (
        <div className="vehicle-image-thumb-empty">
          <ImageIcon size={18} />
        </div>
      )}

      {/* Hover Overlay */}
      <div className="vehicle-thumb-hover-overlay">
        <Eye size={13} />
        <span>Inspect</span>
      </div>

      {/* XLSX Extracted Badge */}
      {showBadge && hasExtracted && (
        <span className="vehicle-thumb-xlsx-badge" title="Extracted from Excel .xlsx">
          <Sparkles size={8} />
        </span>
      )}

      {/* Video Clip Indicator Pill */}
      {hasVideo && (
        <span
          className="vehicle-thumb-video-badge"
          onClick={(e) => {
            if (onPlayVideo) {
              e.stopPropagation()
              onPlayVideo(row)
            }
          }}
          title={`Video Clip: ${row.videoClipPath} (Click to play)`}
        >
          <Play size={8} style={{ fill: '#ffffff' }} />
          <span>Clip</span>
        </span>
      )}
    </div>
  )
}
