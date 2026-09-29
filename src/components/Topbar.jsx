import {
  Bell,
  ChevronDown,
  CloudSun,
  LogOut,
  MapPin,
  Play,
  Search,
  Settings2,
  Square,
  UserCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navigation } from '../data/navigation'

export default function Topbar({
  searchOpen,
  setSearchOpen,
  streamNotifications = [],
  notificationSoundEnabled,
  setNotificationSoundEnabled,
  streamPaused = false,
  onToggleStreamPause = null,
}) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const seenNotificationIds = useRef(new Set())
  const notificationWrapRef = useRef(null)
  const accountWrapRef = useRef(null)

  useEffect(() => {
    const newNotificationCount = streamNotifications.reduce((count, notification) => {
      if (seenNotificationIds.current.has(notification.id)) return count
      seenNotificationIds.current.add(notification.id)
      return count + 1
    }, 0)
    if (newNotificationCount) setUnreadCount((count) => count + newNotificationCount)
  }, [streamNotifications])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationWrapRef.current && !notificationWrapRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
      if (accountWrapRef.current && !accountWrapRef.current.contains(event.target)) {
        setAccountOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [])

  // Keyboard shortcut '/' to focus search bar
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === '/' && document.activeElement !== searchInputRef.current) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/query?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  // Format date: e.g. "Fri, 19 Sep 2026"
  const formattedDate = now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const displayName = user?.displayName || user?.username || 'Sai Sushanth'
  const initials = (user?.displayName || user?.username || 'SR')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SR'

  return (
    <header className="topbar">
      {/* 1. Large Rounded Search Bar */}
      <form className="topbar-search-form" onSubmit={handleSearchSubmit}>
        <Search className="topbar-search-icon" size={17} strokeWidth={2} />
        <input
          aria-label="Search anything"
          className="topbar-search-input"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search anything (vehicles, locations, cameras, incidents...)"
          ref={searchInputRef}
          type="text"
          value={searchQuery}
        />
        <span className="topbar-search-shortcut" title="Press / to search">/</span>
      </form>

      {/* 2. Right Actions: Stop Live Feed, Notification, User Profile, Weather Widget */}
      <div className="topbar-right-actions">
        {/* Global Stop Live Feed / Resume DB Fetching Button */}
        {onToggleStreamPause && (
          <button
            className={`topbar-stream-stop-btn ${streamPaused ? 'is-stopped' : 'is-active'}`}
            onClick={onToggleStreamPause}
            type="button"
            title={
              streamPaused
                ? 'Click to start live feed and resume database fetching'
                : 'Click to stop live feed and pause database fetching'
            }
          >
            <span className={`stream-dot-pulse ${streamPaused ? 'stopped' : 'live'}`} />
            {streamPaused ? (
              <>
                <Play size={13} fill="currentColor" />
                <span>Start Live Feed</span>
              </>
            ) : (
              <>
                <Square size={12} fill="currentColor" />
                <span>Stop Live Feed</span>
              </>
            )}
          </button>
        )}

        {/* Notification Bell with Badge */}
        <div className="notification-wrap" ref={notificationWrapRef}>
          <button
            aria-expanded={notificationsOpen}
            aria-haspopup="menu"
            aria-label="Notifications"
            className="topbar-notification-btn"
            onClick={() => {
              setNotificationsOpen((current) => !current)
              setUnreadCount(0)
            }}
            type="button"
          >
            <Bell size={19} strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="notification-badge-dot">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="notification-menu" role="menu">
              <div className="notification-menu-heading">
                <div>
                  <strong>Live Telemetry Stream</strong>
                  <span>Vehicle detections from corridor cameras</span>
                </div>
                <span>{streamNotifications.length}</span>
              </div>
              <div className="notification-setting">
                <span>Alert chime</span>
                <button
                  aria-label="Toggle notification sound"
                  className={`sound-toggle ${notificationSoundEnabled ? 'is-on' : ''}`}
                  onClick={() => setNotificationSoundEnabled((current) => !current)}
                  type="button"
                >
                  <span />
                </button>
              </div>
              {streamNotifications.length ? (
                streamNotifications.map((item) => (
                  <button
                    className="notification-item"
                    key={item.id}
                    onClick={() => {
                      setNotificationsOpen(false)
                      setUnreadCount(0)
                      navigate('/dashboards/vehicles')
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <span className="notification-item-dot" />
                    <div>
                      <strong>{item.batchCount} new vehicle{item.batchCount === 1 ? '' : 's'}</strong>
                      <span>{item.fileName} · {item.receivedAt}</span>
                      <small>{item.events} events · {item.overspeeding} overspeeding</small>
                    </div>
                  </button>
                ))
              ) : (
                <p className="notification-empty">Corridor cameras broadcasting live.</p>
              )}
            </div>
          )}
        </div>

        {/* User Profile Avatar & Dropdown */}
        <div className="topbar-user-wrap" ref={accountWrapRef}>
          <button
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            className="topbar-user-btn"
            onClick={() => setAccountOpen((val) => !val)}
            type="button"
          >
            <div className="topbar-user-avatar">{initials}</div>
            <div className="topbar-user-info">
              <span className="topbar-user-greeting">Welcome back,</span>
              <strong className="topbar-user-name">
                {displayName} <ChevronDown size={14} className={accountOpen ? 'rotate-180' : ''} />
              </strong>
            </div>
          </button>

          {accountOpen && (
            <div className="topbar-account-menu" role="menu">
              <NavLink onClick={() => setAccountOpen(false)} role="menuitem" to="/profile">
                <UserCircle size={15} /> Operator Profile
              </NavLink>
              <NavLink onClick={() => setAccountOpen(false)} role="menuitem" to="/settings">
                <Settings2 size={15} /> Settings
              </NavLink>
              <button onClick={logout} role="menuitem" type="button">
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
        </div>

        {/* Hyderabad Weather & Environmental Widget Card */}
        <div className="topbar-weather-card">
          <div className="topbar-weather-top">
            <div className="topbar-weather-location">
              <MapPin size={13} className="weather-pin-icon" />
              <span>Hyderabad</span>
            </div>
          </div>

          <div className="topbar-weather-middle">
            <div className="weather-temp-group">
              <CloudSun size={20} className="weather-cloud-icon" />
              <strong className="weather-temp">28°C</strong>
              <span className="weather-condition">Partly Cloudy</span>
            </div>
            {/* Decorative leaf icon */}
            <div className="weather-leaf-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M17.5 4C17.5 4 10.5 4.5 7.5 9.5C4.5 14.5 7 19.5 7 19.5C7 19.5 13.5 19 16.5 14C19.5 9 17.5 4 17.5 4Z"
                  fill="#789262"
                  opacity="0.85"
                />
                <path d="M7 19.5L13.5 12" stroke="#f6f3ed" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className="topbar-weather-bottom">
            <span className="weather-date">{formattedDate}</span>
            <span className="weather-eco-pill">SAFER PEOPLE &nbsp; GREENER CITIES</span>
          </div>
        </div>
      </div>
    </header>
  )
}
