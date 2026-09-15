import {
  Check,
  ChevronDown,
  FolderKanban,
  HelpCircle,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { navigation } from '../data/navigation'
import { projects as defaultProjects } from '../data/projects'

export default function Sidebar({
  projectList = defaultProjects,
  selectedProject,
  connectedProject,
  onSelectProject,
  onCreateProject,
}) {
  const [expanded, setExpanded] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  function handleCreateSubmit(e) {
    e.preventDefault()
    const trimmed = newProjectName.trim()
    if (!trimmed) return
    onCreateProject?.(trimmed)
    setNewProjectName('')
    setShowCreate(false)
  }

  const activeProject = selectedProject || projectList[0] || defaultProjects[0]

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
        <button
          aria-controls="projects-content"
          aria-expanded={expanded}
          className="projects-heading-row"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <p className="nav-eyebrow" id="projects-heading">
            Projects
          </p>
          <span className="projects-heading-actions">
            <span className="projects-count">{projectList.length}</span>
            <ChevronDown
              className={`projects-chevron ${expanded ? 'expanded' : ''}`}
              size={15}
            />
          </span>
        </button>

        <div
          className={`projects-content ${expanded ? 'expanded' : ''}`}
          id="projects-content"
        >
          <div className="projects-list">
            {projectList.map((project) => {
              const isSelected =
                activeProject &&
                (activeProject.key === project.key || activeProject.name === project.name)
              const isConnected =
                connectedProject &&
                (connectedProject.key === project.key || connectedProject.name === project.name)

              return (
                <button
                  aria-pressed={isSelected}
                  className={`project-item ${isSelected ? 'active' : ''}`}
                  key={project.key || project.name}
                  onClick={() => onSelectProject?.(project)}
                  type="button"
                >
                  <span className="project-icon">
                    <FolderKanban size={16} strokeWidth={1.8} />
                  </span>
                  <span className="project-copy">
                    <strong>{project.name}</strong>
                    <small>
                      {isConnected ? '● Connected' : project.caption}
                    </small>
                  </span>
                  {isSelected && (
                    <Check className="project-check" size={16} strokeWidth={2.2} />
                  )}
                </button>
              )
            })}
          </div>

          {showCreate ? (
            <form className="create-project-form" onSubmit={handleCreateSubmit}>
              <input
                autoFocus
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Project name"
                value={newProjectName}
              />
              <div className="create-project-actions">
                <button type="submit">Create</button>
                <button onClick={() => setShowCreate(false)} type="button">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              className="create-project-button"
              onClick={() => setShowCreate(true)}
              type="button"
            >
              <Plus size={14} />
              <span>Create project</span>
            </button>
          )}
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
        <div className="user-card">
          <div className="user-avatar">AM</div>
          <div className="user-copy">
            <strong>Alex Morgan</strong>
            <span>VisionIQ operator</span>
          </div>
          <ChevronDown size={16} />
        </div>
      </div>
    </aside>
  )
}
