import { Bell, CalendarDays, CircleHelp, Menu, Search, Settings2 } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { navigation } from '../data/navigation'

export default function Topbar({ searchOpen, setSearchOpen }) {
  const { pathname } = useLocation()
  const activeItem = navigation.find(({ path }) => path === pathname)?.label ?? 'Home'

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
          <span>Welcome back,</span>
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
        <button aria-label="Notifications" className="icon-button notification-button" type="button">
          <Bell size={18} />
          <span />
        </button>
        <button aria-label="Help" className="icon-button topbar-optional" type="button"><CircleHelp size={17} /></button>
        <button aria-label="Settings" className="icon-button topbar-optional" type="button"><Settings2 size={17} /></button>
        <div className="topbar-divider" />
        <span className="status-dot" />
        <span className="system-status">All systems operational</span>
        <div className="topbar-profile"><span className="topbar-avatar">AM</span><span><strong>Alex Morgan</strong><small>Operator</small></span></div>
        <div className="topbar-date"><CalendarDays size={16} /><div><strong>Tuesday, 10 Sep 2025</strong><span>09:24 AM</span></div></div>
      </div>
    </header>
  )
}
