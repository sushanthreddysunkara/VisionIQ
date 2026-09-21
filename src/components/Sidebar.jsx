import {
  Check,
  ChevronDown,
  Database,
  FolderKanban,
  HelpCircle,
  LogOut,
  Settings2,
  Sparkles,
  UserCircle,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navigation } from '../data/navigation'
import { projects as defaultProjects } from '../data/projects'

export default function Sidebar({
  projectList = defaultProjects,
  selectedProject,
  connectedProject,
  onSelectProject,
  onCreateProject,
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const [expanded, setExpanded] = useState(true)
  const [accountOpen, setAccountOpen] = useState(false)

  const initials = (user?.displayName || user?.username || 'VI').slice(0, 2).toUpperCase()

  const activeProject = selectedProject || projectList[0] || defaultProjects[0]
  const isProjectsRoute = pathname === '/projects'

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <Sparkles size={22} strokeWidth={2} />
        </div>
        <div className="brand-text">
          <p className="brand-name">VISION IQ</p>
          <p className="brand-caption">{connectedProject?.name || 'Platform A'}</p>
        </div>
      </div>

      <section aria-labelledby="projects-heading" className="projects-section">
        <div className="projects-heading-row">
          <button
            className="nav-eyebrow"
            id="projects-heading"
            onClick={() => navigate('/projects')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textAlign: 'left',
              width: '100%',
              fontFamily: 'inherit',
            }}
            type="button"
          >
            Projects
          </button>
        </div>

        <div className="projects-content expanded" id="projects-content">
          <button
            aria-pressed={isProjectsRoute}
            className={`nav-item ${isProjectsRoute ? 'active' : ''}`}
            onClick={() => {
              onSelectProject?.(defaultProjects[0])
              navigate('/projects')
            }}
            style={{
              width: '100%',
              cursor: 'pointer',
              textAlign: 'left',
              border: 'none',
              fontFamily: 'inherit',
            }}
            type="button"
          >
            <Database size={18} strokeWidth={1.8} />
            <span style={{ flex: 1 }}>Instances</span>
            {connectedProject && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 6px rgba(34, 197, 94, 0.7)',
                  display: 'inline-block',
                }}
                title="Connected"
              />
            )}
          </button>
        </div>
      </section>

      <nav aria-label="Primary navigation" className="main-nav">
        <p className="nav-eyebrow">Workspace</p>
        {navigation.map(({ label, path, icon: Icon }) => (
          <NavLink
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
            key={path}
            to={path}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="utility-item" type="button">
          <HelpCircle size={18} strokeWidth={1.8} />
          <span>Help center</span>
        </button>
        <div className="account-menu-wrap">
          <button aria-expanded={accountOpen} aria-haspopup="menu" className="user-card" onClick={() => setAccountOpen((value) => !value)} type="button">
            <div className="user-avatar">{user?.profilePhoto ? <img alt="" src={user.profilePhoto} /> : initials}</div>
            <div className="user-copy">
              <strong>{user?.displayName || user?.username || 'VisionIQ user'}</strong>
              <span>{user?.role || 'Operator'} · Account</span>
            </div>
            <ChevronDown className={accountOpen ? 'account-chevron open' : 'account-chevron'} size={16} />
          </button>
          {accountOpen && (
            <div className="account-menu" role="menu">
              <NavLink onClick={() => setAccountOpen(false)} role="menuitem" to="/profile"><UserCircle size={16} /> Profile</NavLink>
              <NavLink onClick={() => setAccountOpen(false)} role="menuitem" to="/settings"><Settings2 size={16} /> Settings</NavLink>
              <button onClick={logout} role="menuitem" type="button"><LogOut size={16} /> Log out</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
