import React from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navigation } from '../data/navigation'

export default function Sidebar({
  liveMode = false,
  sidebarOpen = false,
  setSidebarOpen = null,
  isSidebarPinned = false,
  isSidebarHovered = false,
  handleSidebarMouseEnter = null,
  handleSidebarMouseLeave = null,
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isLive = liveMode || pathname.startsWith('/live')

  const handleNavClick = () => {
    if (setSidebarOpen) {
      setSidebarOpen(false)
    }
    if (!isSidebarPinned && handleSidebarMouseLeave) {
      handleSidebarMouseLeave()
    }
  }

  const isExpanded = isSidebarPinned || isSidebarHovered || sidebarOpen

  return (
    <aside
      className={`viq-dark-sidebar ${isExpanded ? 'is-open' : 'is-closed'} ${isSidebarPinned ? 'is-pinned' : 'is-unpinned'
        }`}
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {/* ── Mode Subtitle / Live Indicator ── */}
      {isLive && (
        <div className="viq-sidebar-mode-indicator" title="Currently viewing Live Feed Interface">
          <span className="viq-sidebar-live-dot" />
          <span className="viq-sidebar-mode-text">LIVE FEED TELEMETRY</span>
        </div>
      )}

      {/* ── Primary Navigation List (Preserving exact 11 items & visual styling) ── */}
      <nav aria-label="Primary navigation" className="viq-nav-list">
        {navigation.map(({ label, path, icon: Icon, exact }) => {
          // In live mode, route to /live${path}
          const targetPath = isLive ? `/live${path}` : path
          const isActive = isLive
            ? pathname === targetPath || (path !== '/home' && pathname.startsWith(targetPath))
            : pathname === path || (path !== '/home' && !pathname.startsWith('/live') && pathname.startsWith(path))

          return (
            <NavLink
              className={`viq-nav-item ${isActive ? 'active' : ''}`}
              end={exact}
              key={path}
              onClick={handleNavClick}
              title={`${label} (${isLive ? 'Live Feed' : 'Excel Data'})`}
              to={targetPath}
            >
              {Icon === 'rupee' ? (
                <span className="viq-nav-rupee-icon" aria-hidden="true">₹</span>
              ) : (
                <Icon className="viq-nav-icon" size={18} strokeWidth={2} />
              )}
              <span className="viq-nav-label">{label}</span>
              {isLive && label === 'Camera Network' && (
                <span className="viq-nav-live-subbadge">LIVE</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Bottom Highway Graphic with "Smarter Highways Brighter India" ── */}
      <div className="viq-sidebar-bottom-graphic">
        <img
          src="/images/sidebar_highway_bg.jpg"
          alt="Highway Corridor"
          className="viq-sidebar-highway-img"
        />
        <div className="viq-sidebar-highway-gradient" />
        <div className="viq-sidebar-quote">
          <span className="quote-word-1">Smarter</span>
          <span className="quote-word-2">Highways</span>
          <span className="quote-word-3">Brighter India</span>
        </div>
      </div>
    </aside>
  )
}
