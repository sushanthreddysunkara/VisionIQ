import React from 'react'
import { ArrowLeft, Video } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navigation } from '../data/navigation'

export default function Sidebar({
  liveMode = false,
  onSwitchToExcelData,
  sidebarOpen = false,
  setSidebarOpen = null,
  isSidebarPinned = false,
  isSidebarHovered = false,
  handleSidebarMouseEnter = null,
  handleSidebarMouseLeave = null,
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleNavClick = () => {
    if (setSidebarOpen) {
      setSidebarOpen(false)
    }
    if (!isSidebarPinned && handleSidebarMouseLeave) {
      handleSidebarMouseLeave()
    }
  }

  const isExpanded = isSidebarPinned || isSidebarHovered || sidebarOpen
  const isLiveView = pathname === '/live-view'

  return (
    <aside
      className={`viq-dark-sidebar ${isExpanded ? 'is-open' : 'is-closed'} ${
        isSidebarPinned ? 'is-pinned' : 'is-unpinned'
      }`}
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {/* ── Primary Navigation List ── */}
      <nav aria-label="Primary navigation" className="viq-nav-list">
        {isLiveView ? (
          <>
            <NavLink
              className="viq-nav-item active"
              onClick={handleNavClick}
              to="/live-view"
            >
              <Video className="viq-nav-icon" size={18} strokeWidth={2} />
              <span className="viq-nav-label">Live Feed</span>
            </NavLink>
            <button
              className="viq-nav-item"
              onClick={() => {
                handleNavClick()
                onSwitchToExcelData?.()
                navigate('/home')
              }}
              type="button"
            >
              <ArrowLeft className="viq-nav-icon" size={18} strokeWidth={2} />
              <span className="viq-nav-label">Back to Excel Data</span>
            </button>
          </>
        ) : (
          navigation.map(({ label, path, icon: Icon, exact }) => {
            const isActive = pathname === path

            return (
              <NavLink
                className={`viq-nav-item ${isActive ? 'active' : ''}`}
                end={exact}
                key={path}
                onClick={handleNavClick}
                title={label}
                to={path}
              >
                {Icon === 'rupee' ? (
                  <span className="viq-nav-rupee-icon" aria-hidden="true">₹</span>
                ) : (
                  <Icon className="viq-nav-icon" size={18} strokeWidth={2} />
                )}
                <span className="viq-nav-label">{label}</span>
              </NavLink>
            )
          })
        )}
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
