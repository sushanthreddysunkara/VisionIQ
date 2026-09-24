import { Bell, CalendarDays, CircleHelp, Menu, Search, Settings2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { navigation } from '../data/navigation'

export default function Topbar({
  searchOpen,
  setSearchOpen,
  streamNotifications = [],
  notificationSoundEnabled,
  setNotificationSoundEnabled,
}) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const seenNotificationIds = useRef(new Set())
  const notificationWrapRef = useRef(null)
  const activeItem = navigation.find(({ path }) => path === pathname)?.label ?? 'Home'

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
    function closeNotifications(event) {
      if (notificationWrapRef.current && !notificationWrapRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeNotifications)
    return () => document.removeEventListener('pointerdown', closeNotifications)
  }, [])

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
  const timeLabel = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const displayName = user?.displayName || user?.username || 'VisionIQ user'

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>VisionIQ workspace</span>
        <i>/</i>
        <strong>{activeItem}</strong>
      </div>
      <div className="topbar-heading">
        <button aria-label="Toggle navigation" className="topbar-menu icon-button" type="button"><Menu size={21} /></button>
        <div className="welcome-copy">
          <span>{greeting}, {displayName}</span>
          <strong>Let's make our roads safer today!</strong>
        </div>
      </div>
      <div className="topbar-actions">
        {searchOpen && (
          <input
            aria-label="Search workspace"
            autoFocus
            className="top-search"
            placeholder="Search here..."
          />
        )}
        <button
          aria-label="Search"
          className="icon-button"
          onClick={() => setSearchOpen((current) => !current)}
          type="button"
        >
          <Search size={18} />
        </button>
        <div className="notification-wrap" ref={notificationWrapRef}>
          <button
            aria-expanded={notificationsOpen}
            aria-haspopup="menu"
            aria-label="Notifications"
            className={`icon-button notification-button ${unreadCount ? 'has-new' : ''}`}
            onClick={() => {
              setNotificationsOpen((current) => !current)
              setUnreadCount(0)
            }}
            type="button"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span>{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          {notificationsOpen && (
            <div className="notification-menu" role="menu">
              <div className="notification-menu-heading">
                <div><strong>Live data stream</strong><span>Vehicle detections from the backend</span></div>
                <span>{streamNotifications.length}</span>
              </div>
              <div className="notification-setting">
                <span>New data sound</span>
                <button
                  aria-label="Toggle notification sound"
                  className={`sound-toggle ${notificationSoundEnabled ? 'is-on' : ''}`}
                  onClick={() => setNotificationSoundEnabled((current) => !current)}
                  type="button"
                >
                  <span />
                </button>
              </div>
              {streamNotifications.length ? streamNotifications.map((item) => (
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
                    <small>{item.events} events · {item.overspeeding} overspeeding · {item.totalProcessed} total stored</small>
                  </div>
                </button>
              )) : (
                <p className="notification-empty">No new vehicle data yet.</p>
              )}
            </div>
          )}
        </div>
        <button aria-label="Help" className="icon-button topbar-optional" type="button"><CircleHelp size={17} /></button>
        <button aria-label="Settings" className="icon-button topbar-optional" onClick={() => navigate('/settings')} type="button"><Settings2 size={17} /></button>
        <div className="topbar-divider" />
        <span className="status-dot" />
        <span className="system-status">All systems operational</span>
        <div className="topbar-date"><CalendarDays size={16} /><div><strong>{dateLabel}</strong><span>{timeLabel}</span></div></div>
      </div>
    </header>
  )
}
