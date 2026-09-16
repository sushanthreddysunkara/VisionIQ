import {
  Check,
  ChevronDown,
  FileSpreadsheet,
  FolderKanban,
  HelpCircle,
  LogOut,
  Plug,
  Plus,
  Sparkles,
  Settings2,
  Trash2,
  Upload,
  UserCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { navigation } from '../data/navigation'
import { projects } from '../data/projects'
import { useAuth } from '../context/AuthContext'

const storedProjectsKey = 'vision-iq-created-projects'

export default function Sidebar({
  connectedProject,
  onProjectConnect,
  onProjectDisconnect,
  onImport,
  fileName,
  hasImportedFile,
  rows = [],
  importError,
  onLoadSampleData,
}) {
  const { user, logout } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  const initials = user?.username?.slice(0, 2).toUpperCase() || 'VI'

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

      <ProjectsSection
        connectedProject={connectedProject}
        fileName={fileName}
        hasImportedFile={hasImportedFile}
        importError={importError}
        onImport={onImport}
        onLoadSampleData={onLoadSampleData}
        onProjectConnect={onProjectConnect}
        onProjectDisconnect={onProjectDisconnect}
        rows={rows}
      />

      <nav className="main-nav" aria-label="Primary navigation">
        <p className="nav-eyebrow">Workspace</p>
        {navigation.map(({ label, path, icon: Icon }) => (
          <NavLink
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
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

function ProjectsSection({
  connectedProject,
  onProjectConnect,
  onProjectDisconnect,
  onImport,
  fileName,
  hasImportedFile,
  rows = [],
  importError,
  onLoadSampleData,
}) {
  const [projectList, setProjectList] = useState(() => {
    try {
      const storedProjects = JSON.parse(localStorage.getItem(storedProjectsKey) || '[]')
      return [...projects, ...storedProjects.filter((project) => project.created)]
    } catch {
      return projects
    }
  })
  const [selectedProject, setSelectedProject] = useState(projects[0])
  const [expanded, setExpanded] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  useEffect(() => {
    localStorage.setItem(
      storedProjectsKey,
      JSON.stringify(projectList.filter((project) => project.created)),
    )
  }, [projectList])

  function selectProject(project) {
    setSelectedProject(project)
  }

  function createProject(event) {
    event.preventDefault()
    const name = newProjectName.trim()
    if (!name) return

    const project = {
      name,
      caption: 'New project',
      status: 'Coming soon',
      modules: 'No modules yet',
      dashboards: 'No dashboards yet',
      data: 'Not connected',
      key: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      comingSoon: true,
      created: true,
    }
    setProjectList((currentProjects) => [...currentProjects, project])
    setSelectedProject(project)
    setNewProjectName('')
    setShowCreate(false)
  }

  function deleteProject() {
    if (!selectedProject.comingSoon) return
    const confirmed = window.confirm(`Delete ${selectedProject.name}?`)
    if (!confirmed) return

    setProjectList((currentProjects) => currentProjects.filter((project) => project.key !== selectedProject.key))
    setSelectedProject(projectList[0])
  }

  const connected = connectedProject?.key === selectedProject.key
  const uniqueCameras = new Set(rows.map((r) => r.camera).filter(Boolean)).size
  const uniqueLocations = new Set(rows.map((r) => r.location).filter(Boolean)).size

  return (
    <section className="projects-section" aria-labelledby="projects-heading">
      <button
        aria-controls="projects-content"
        aria-expanded={expanded}
        className="projects-heading-row"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <p className="nav-eyebrow" id="projects-heading">Projects</p>
        <span className="projects-heading-actions">
          <span className="projects-count">{projectList.length}</span>
          <ChevronDown className={`projects-chevron ${expanded ? 'expanded' : ''}`} size={15} />
        </span>
      </button>
      <div className={`projects-content ${expanded ? 'expanded' : ''}`} id="projects-content">
        <div className="projects-list">
          {projectList.map((project) => (
            <button
              aria-pressed={selectedProject.name === project.name}
              className={`project-item ${selectedProject.name === project.name ? 'active' : ''}`}
              key={project.name}
              onClick={() => selectProject(project)}
              type="button"
            >
              <span className="project-icon"><FolderKanban size={16} strokeWidth={1.8} /></span>
              <span className="project-copy">
                <strong>{project.name}</strong>
                <small>{project.caption}</small>
              </span>
              {selectedProject.name === project.name && <Check className="project-check" size={16} strokeWidth={2.2} />}
            </button>
          ))}
        </div>
        {showCreate ? (
          <form className="create-project-form" onSubmit={createProject}>
            <input autoFocus onChange={(event) => setNewProjectName(event.target.value)} placeholder="Project name" value={newProjectName} />
            <div className="create-project-actions">
              <button type="submit">Create</button>
              <button onClick={() => setShowCreate(false)} type="button">Cancel</button>
            </div>
          </form>
        ) : (
          <button className="create-project-button" onClick={() => setShowCreate(true)} type="button">
            <Plus size={14} />
            <span>Create project</span>
          </button>
        )}
        <div className="selected-project-panel">
          <div className="selected-project-header">
            <span className="selected-project-label">Selected project</span>
            <span className={`project-state ${connected ? 'connected' : ''}`}>
              {selectedProject.comingSoon ? 'Coming soon' : connected ? 'Connected' : selectedProject.status}
            </span>
          </div>
          <strong className="selected-project-title">{selectedProject.name}</strong>
          {selectedProject.comingSoon && !selectedProject.created ? (
            <>
              <p className="project-coming-soon">This project will be available in a future phase.</p>
              <button className="project-delete-button" onClick={deleteProject} type="button">
                <Trash2 size={13} />
                Delete project
              </button>
            </>
          ) : (
            <>
              {/* Connected File Upload / Active File Status */}
              {connected && (
                <div className="project-file-import-section">
                  {hasImportedFile ? (
                    <div className="project-imported-card">
                      <div className="project-file-info">
                        <FileSpreadsheet className="file-pill-icon" size={16} />
                        <div className="file-pill-copy">
                          <strong>{fileName}</strong>
                          <span>{rows.length} records active</span>
                        </div>
                      </div>
                      <label className="project-change-file-btn" title="Upload another CSV file">
                        <Upload size={12} />
                        <span>Change CSV</span>
                        <input accept=".csv,text/csv" onChange={onImport} style={{ display: 'none' }} type="file" />
                      </label>
                    </div>
                  ) : (
                    <div className="project-upload-prompt">
                      <label className="project-upload-btn">
                        <Upload size={14} />
                        <span>Upload CSV File</span>
                        <input accept=".csv,text/csv" onChange={onImport} style={{ display: 'none' }} type="file" />
                      </label>
                      {onLoadSampleData && (
                        <button className="project-sample-quick-btn" onClick={onLoadSampleData} type="button">
                          <Sparkles size={12} />
                          <span>Load Sample Data</span>
                        </button>
                      )}
                      <span className="project-upload-hint">Upload CSV to activate Ontology, Graph & Dashboards</span>
                    </div>
                  )}
                  {importError && <p className="sidebar-import-error">{importError}</p>}
                </div>
              )}

              <div className="project-build-summary">
                <span>{hasImportedFile ? `${rows.length} records` : '0 records'}</span>
                <span>{hasImportedFile ? `${uniqueCameras} cameras` : '0 cameras'}</span>
                <span>{hasImportedFile ? `${uniqueLocations} locations` : 'No CSV data'}</span>
              </div>

              <button
                className={`project-connect-button ${connected ? 'connected' : ''}`}
                onClick={() => connected ? onProjectDisconnect() : onProjectConnect(selectedProject)}
                type="button"
              >
                {connected ? <Check size={14} strokeWidth={2.2} /> : <Plug size={14} />}
                <span>{connected ? 'Disconnect project' : 'Connect project'}</span>
              </button>
              {selectedProject.created && (
                <button className="project-delete-button" onClick={deleteProject} type="button">
                  <Trash2 size={13} />
                  Delete project
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
