import React, { useState, useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  Camera,
  Car,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  Filter,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Minus,
  Network,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useLiveFeed } from '../context/LiveFeedContext'

export default function LiveKnowledgeGraph() {
  const { knowledgeGraph, liveRecords } = useLiveFeed()
  const [selectedNode, setSelectedNode] = useState(null)
  const [filterType, setFilterType] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredNodes = useMemo(() => {
    return knowledgeGraph.nodes.filter((node) => {
      const matchType = filterType === 'All' || node.type === filterType
      const matchSearch = !searchQuery || node.label.toLowerCase().includes(searchQuery.toLowerCase()) || node.id.toLowerCase().includes(searchQuery.toLowerCase())
      return matchType && matchSearch
    })
  }, [knowledgeGraph.nodes, filterType, searchQuery])

  // Active node details
  const activeNodeData = useMemo(() => {
    if (!selectedNode) return knowledgeGraph.nodes[0]
    return knowledgeGraph.nodes.find((n) => n.id === selectedNode.id) || selectedNode
  }, [selectedNode, knowledgeGraph.nodes])

  // Related links for the active node
  const activeLinks = useMemo(() => {
    if (!activeNodeData) return []
    return knowledgeGraph.links.filter(
      (link) => link.source === activeNodeData.id || link.target === activeNodeData.id
    )
  }, [activeNodeData, knowledgeGraph.links])

  return (
    <div className="knowledge-graph-page" style={{ padding: '24px 32px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
            LIVE TELEMETRY · SPATIAL & TEMPORAL KNOWLEDGE GRAPH
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Live Knowledge Graph
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Connected entity graph constructed strictly from real-time optical camera telemetry, vehicle observations, and automated rules.
          </p>
        </div>

        {/* Demo entities indicator */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1d4ed8',
          fontSize: 12,
          fontWeight: 600,
        }}>
          <Network size={14} />
          {knowledgeGraph.nodes.length} Live Entities · {knowledgeGraph.links.length} Relations
        </div>
      </div>

      {/* Main Layout: Graph Visualization + Inspector Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, minHeight: 600 }}>
        {/* Left: Interactive Canvas */}
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: 8,
          border: '1px solid #1e293b',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}>
          {/* Controls Bar inside graph */}
          <div style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}>
            <div style={{ pointerEvents: 'auto', display: 'flex', gap: 8 }}>
              {['All', 'Camera', 'Vehicle', 'Corridor', 'TollPlaza', 'Incident'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: filterType === type ? '#0284c7' : 'rgba(30, 41, 59, 0.85)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(30, 41, 59, 0.85)', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Find node..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  width: 100,
                }}
              />
            </div>
          </div>

          {/* SVG Visual Graph Representation */}
          <div style={{ flex: 1, position: 'relative', minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="100%" height="100%" viewBox="0 0 700 500" style={{ position: 'absolute', top: 0, left: 0 }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
                </marker>
              </defs>

              {/* Edge lines */}
              <line x1="200" y1="140" x2="350" y2="80" stroke="#334155" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="200" y1="140" x2="200" y2="280" stroke="#334155" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="200" y1="140" x2="480" y2="200" stroke="#334155" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="200" y1="140" x2="480" y2="340" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 2" markerEnd="url(#arrow)" />
              <line x1="480" y1="340" x2="620" y2="340" stroke="#f97316" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="200" y1="400" x2="350" y2="80" stroke="#334155" strokeWidth="2" markerEnd="url(#arrow)" />

              {/* Edge Relationship Labels */}
              <text x="260" y="100" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">MONITORS</text>
              <text x="160" y="210" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">INSTALLED_AT</text>
              <text x="320" y="160" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">DETECTED</text>
              <text x="330" y="260" fill="#ef4444" fontSize="10" fontFamily="sans-serif">DETECTED (OCR FAILS)</text>
              <text x="530" y="330" fill="#f97316" fontSize="10" fontFamily="sans-serif">TRIGGERED</text>
            </svg>

            {/* Interactive Node Badges (HTML absolute layout over SVG) */}
            <div style={{ position: 'relative', width: 700, height: 500, pointerEvents: 'auto' }}>
              {/* CAM-LIVE-01 */}
              <div
                onClick={() => setSelectedNode(knowledgeGraph.nodes[0])}
                style={{
                  position: 'absolute',
                  left: 140,
                  top: 120,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#064e3b',
                  border: selectedNode?.id === 'CAM-LIVE-01' ? '2px solid #34d399' : '1px solid #10b981',
                  borderRadius: 24,
                  padding: '8px 16px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
                }}
              >
                <Camera size={16} color="#34d399" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>CAM-LIVE-01</span>
              </div>

              {/* CORR-NH44 */}
              <div
                onClick={() => setSelectedNode(knowledgeGraph.nodes[2])}
                style={{
                  position: 'absolute',
                  left: 350,
                  top: 80,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#1e3a8a',
                  border: selectedNode?.id === 'CORR-NH44' ? '2px solid #60a5fa' : '1px solid #3b82f6',
                  borderRadius: 24,
                  padding: '8px 16px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <MapPin size={16} color="#60a5fa" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>NH-44 Corridor</span>
              </div>

              {/* PLZ-RAIKAL */}
              <div
                onClick={() => setSelectedNode(knowledgeGraph.nodes[3])}
                style={{
                  position: 'absolute',
                  left: 200,
                  top: 280,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#78350f',
                  border: selectedNode?.id === 'PLZ-RAIKAL' ? '2px solid #fcd34d' : '1px solid #f59e0b',
                  borderRadius: 24,
                  padding: '8px 16px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <Database size={16} color="#fcd34d" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Raikal Toll Plaza</span>
              </div>

              {/* VEH-TS09EA */}
              <div
                onClick={() => setSelectedNode(knowledgeGraph.nodes[4])}
                style={{
                  position: 'absolute',
                  left: 480,
                  top: 200,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#312e81',
                  border: selectedNode?.id === 'VEH-TS09EA' ? '2px solid #a5b4fc' : '1px solid #6366f1',
                  borderRadius: 24,
                  padding: '8px 16px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <Car size={16} color="#a5b4fc" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>TS 09 EA 4129 (Car)</span>
              </div>

              {/* VEH-UNREC (Plate unreadable) */}
              <div
                onClick={() => setSelectedNode(knowledgeGraph.nodes[5])}
                style={{
                  position: 'absolute',
                  left: 480,
                  top: 340,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#7f1d1d',
                  border: selectedNode?.id === 'VEH-UNREC' ? '2px solid #fca5a5' : '1px solid #ef4444',
                  borderRadius: 24,
                  padding: '8px 16px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 0 14px rgba(239, 68, 68, 0.4)',
                }}
              >
                <AlertTriangle size={16} color="#fca5a5" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Not Recognized (Truck)</span>
              </div>

              {/* INC-802 */}
              <div
                onClick={() => setSelectedNode(knowledgeGraph.nodes[6])}
                style={{
                  position: 'absolute',
                  left: 620,
                  top: 340,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#7c2d12',
                  border: selectedNode?.id === 'INC-802' ? '2px solid #fdba74' : '1px solid #f97316',
                  borderRadius: 24,
                  padding: '8px 16px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <Shield size={16} color="#fdba74" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Plate Failure Alert</span>
              </div>

              {/* CAM-LIVE-02 */}
              <div
                onClick={() => setSelectedNode(knowledgeGraph.nodes[1])}
                style={{
                  position: 'absolute',
                  left: 200,
                  top: 400,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#064e3b',
                  border: selectedNode?.id === 'CAM-LIVE-02' ? '2px solid #34d399' : '1px solid #10b981',
                  borderRadius: 24,
                  padding: '8px 16px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <Camera size={16} color="#34d399" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>CAM-LIVE-02</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Entity Inspector Panel */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            ENTITY TELEMETRY INSPECTOR
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
            {activeNodeData?.label || 'Select an Entity'}
          </h3>

          <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>Entity ID:</span>
              <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{activeNodeData?.id}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>Entity Type:</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
              }}>
                {activeNodeData?.type}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>Active Relations:</span>
              <strong style={{ color: '#0f172a' }}>{activeLinks.length} connections</strong>
            </div>
          </div>

          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8, textTransform: 'uppercase' }}>
            Connected Graph Relations
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeLinks.map((link, idx) => (
              <div key={idx} style={{ padding: '8px 10px', borderRadius: 4, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', fontSize: 12 }}>
                <span style={{ color: '#0284c7', fontWeight: 700 }}>{link.source}</span>
                <span style={{ margin: '0 6px', color: '#94a3b8' }}>—[{link.relationship}]→</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{link.target}</span>
              </div>
            ))}
          </div>

          {/* Quick Filter Entities List */}
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginTop: 20, marginBottom: 8, textTransform: 'uppercase' }}>
            All Live Entities ({filteredNodes.length})
          </h4>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredNodes.map((n) => (
              <div
                key={n.id}
                onClick={() => setSelectedNode(n)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  backgroundColor: selectedNode?.id === n.id ? '#e0f2fe' : '#f8fafc',
                  border: selectedNode?.id === n.id ? '1px solid #0284c7' : '1px solid transparent',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{n.label}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{n.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
