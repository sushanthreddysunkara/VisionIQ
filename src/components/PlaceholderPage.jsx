import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Network,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { navigation } from '../data/navigation'
import { useAuth } from '../context/AuthContext'

const pageContent = {
  Home: {
    kicker: 'OPERATIONS OVERVIEW',
    title: 'Operations overview',
    description: 'A clear view of your intelligence workspace, data health, and active operations.',
    metrics: [['Data sources', '12', '+2 this month'], ['Records processed', '48.6K', '+18.4% vs last week'], ['Model confidence', '94.8%', 'Within target range']],
    activity: ['Traffic dataset refreshed', 'Ontology model synchronized', 'Rule set published to production'],
  },
  'Knowledge Graph': {
    kicker: 'SEMANTIC INTELLIGENCE',
    title: 'Knowledge Graph',
    description: 'Connect operational entities and discover the relationships that matter.',
    metrics: [['Graph nodes', '2,418', 'Across 7 entity types'], ['Relationships', '8,904', '+326 this week'], ['Graph health', '99.2%', 'All pipelines healthy']],
    activity: ['Vehicle entity index updated', 'New road-camera relationships detected', 'Semantic search is ready'],
  },
  Query: {
    kicker: 'INTELLIGENT QUERY',
    title: 'Ask your data',
    description: 'Find answers across connected sources with a natural, focused query experience.',
    metrics: [['Saved queries', '24', '5 shared with your team'], ['Avg. response', '1.8s', '18% faster this week'], ['Query coverage', '87%', 'Across active sources']],
    activity: ['Peak traffic query completed', 'Camera coverage query saved', '3 query suggestions available'],
  },
  'Rules & Events': {
    kicker: 'GOVERNANCE & ACTIONS',
    title: 'Rules & Events',
    description: 'Monitor automation, review operational events, and keep every response accountable.',
    metrics: [['Active rules', '18', '3 changed today'], ['Events today', '143', '12 need attention'], ['Resolved', '96.4%', 'Last 30 days']],
    activity: ['High-volume rule evaluated', 'Camera outage event resolved', 'New alert policy drafted'],
  },
}

const iconFor = { Home: Activity, 'Knowledge Graph': Network, Query: Search, 'Rules & Events': ShieldCheck }

function formatCompactNumber(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString()
}

export default function PlaceholderPage({ rows = [], fileName = '' }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [now, setNow] = useState(() => new Date())
  const page = navigation.find(({ path }) => path === pathname) ?? navigation[0]
  const content = pageContent[page.label] ?? pageContent.Home
  const Icon = iconFor[page.label] ?? page.icon
  const displayName = user?.displayName || user?.username || 'VisionIQ user'
  const hour = now.getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const sourceCount = new Set(
    (rows || []).map((row) => row.sourceFile || row.fileName || row.camera || fileName || 'VisionIQ feed')
  ).size || (fileName ? 1 : 2)

  const processedCount = rows.length ? rows.length : 1284
  const processedValue = formatCompactNumber(processedCount)

  const averageConfidence = rows.length
    ? (rows.reduce((sum, row) => sum + (Number(row.confidence) || 0), 0) / rows.length) * 100
    : 94.8
  const confidenceValue = `${Math.min(99.9, Math.max(82, averageConfidence)).toFixed(1)}%`

  const metricCards = page.label === 'Home'
    ? [
        ['Data sources', String(sourceCount), '+2 this month'],
        ['Records processed', processedValue, `${processedCount > 0 ? '+' : ''}${Math.max(8, Math.round((processedCount / 1200) * 18))}% vs last week`],
        ['Model confidence', confidenceValue, rows.length ? 'Live signal quality' : 'Within target range'],
      ]
    : content.metrics

  const activityItems = page.label === 'Home'
    ? [
        { title: 'Traffic dataset refreshed', detail: 'Just now · VisionIQ automation', route: '/dashboards', cta: 'Open dashboard' },
        { title: 'Ontology model synchronized', detail: '1 hour ago · VisionIQ automation', route: '/ontology', cta: 'Review ontology' },
        { title: 'Rule set published to production', detail: '2 hours ago · VisionIQ automation', route: '/rules-events', cta: 'View rules' },
      ]
    : (content.activity || []).map((item, index) => ({
        title: item,
        detail: `${index === 0 ? 'Just now' : `${index + 1} hours ago`} · VisionIQ automation`,
        route: page.label === 'Knowledge Graph' ? '/knowledge-graph' : page.label === 'Rules & Events' ? '/rules-events' : '/dashboards',
        cta: 'View details',
      }))

  useEffect(() => {
    if (page.label !== 'Home') return undefined
    const timer = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [page.label])

  const title = page.label === 'Home' ? `${timeGreeting}, ${displayName}` : content.title

  return (
    <div className="workspace-page">
      <div className="workspace-hero">
        <div>
          <p className="section-kicker">{content.kicker}</p>
          <h1>{title}</h1>
          <p className="intro-copy">{content.description}</p>
        </div>
        <div className="workspace-hero-icon"><Icon size={24} /></div>
      </div>
      <div className="workspace-metrics">
        {metricCards.map(([label, value, note], index) => (
          <div className={`workspace-metric metric-${index}`} key={label}>
            <span>{label}</span><strong>{value}</strong><small>{note}</small>
          </div>
        ))}
      </div>
      <div className="workspace-grid">
        <section className="workspace-panel workspace-panel-main">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">WORKSPACE ACTIVITY</p>
              <h2>What is happening now</h2>
            </div>
            <button className="text-action" onClick={() => navigate('/dashboards')} type="button">
              View activity <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="workspace-activity">
            {activityItems.map((item, index) => (
              <div className="workspace-activity-row" key={item.title}>
                <span className={`workspace-activity-icon icon-${index}`}><CheckCircle2 size={16} /></span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <button className="workspace-activity-button" onClick={() => navigate(item.route)} type="button">
                  {item.cta}
                  <ArrowUpRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="workspace-panel workspace-panel-side">
          <div className="panel-heading"><div><p className="section-kicker">QUICK ACCESS</p><h2>Explore workspace</h2></div></div>
          {[['Data Foundation', Database, '/document-intelligence'], ['Ontology', GitBranch, '/ontology'], ['Dashboards', BarChart3, '/dashboards']].map(([label, ItemIcon, path]) => <Link className="workspace-link" key={label} to={path}><span><ItemIcon size={17} /></span><strong>{label}</strong><ArrowUpRight size={15} /></Link>)}
          <div className="workspace-status"><Clock3 size={16} /><span>Last sync</span><strong>{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong></div>
        </section>
      </div>
    </div>
  )
}
