import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import cytoscape from 'cytoscape'
import {
  Bot,
  Camera,
  Car,
  ChevronDown,
  Eye,
  Filter,
  MapPin,
  Maximize,
  Minus,
  Network,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { getVehicleMeta } from '../../data/vehicleTypes'
import MediaPreviewModal from '../MediaPreviewModal'

export default function KnowledgeGraphPage({ rows = [], fileName = 'Active Dataset' }) {
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selectedNode, setSelectedNode] = useState(null)
  const [previewModalRow, setPreviewModalRow] = useState(null)
  const [recordLimit, setRecordLimit] = useState('ALL')
  const containerRef = useRef(null)
  const cyRef = useRef(null)

  // Support AI Queried Knowledge Graph Segment passed from Query Page
  const [segmentFilter, setSegmentFilter] = useState(() => location.state?.queryFilter || null)
  const [segmentExplanation, setSegmentExplanation] = useState(() => location.state?.explanation || '')

  const activeRows = useMemo(() => {
    if (!segmentFilter) return rows

    return rows.filter((r) => {
      const typeLower = (r.vehicleType || r.type || '').toLowerCase()
      if (segmentFilter.vehicleTypes || segmentFilter.vehicleType) {
        const rawTypes = []
        if (Array.isArray(segmentFilter.vehicleTypes)) rawTypes.push(...segmentFilter.vehicleTypes)
        if (Array.isArray(segmentFilter.vehicleType)) rawTypes.push(...segmentFilter.vehicleType)
        else if (typeof segmentFilter.vehicleType === 'string') rawTypes.push(segmentFilter.vehicleType)
        if (rawTypes.length) {
          const matchType = rawTypes.some((t) => {
            if (!t || typeof t !== 'string') return false
            const vt = t.toLowerCase().trim()
            if (vt === 'all') return true
            const vtSingular = vt.endsWith('s') && vt.length > 3 ? vt.slice(0, -1) : vt
            const rowSingular = typeLower.endsWith('s') && typeLower.length > 3 ? typeLower.slice(0, -1) : typeLower
            return typeLower.includes(vt) || vt.includes(typeLower) || rowSingular.includes(vtSingular) || vtSingular.includes(rowSingular)
          })
          if (!matchType) return false
        }
      }
      if (segmentFilter.location) {
        const loc = (r.roadName || r.location || '').toLowerCase().trim()
        const target = String(Array.isArray(segmentFilter.location) ? segmentFilter.location[0] : segmentFilter.location).toLowerCase().trim()
        if (target && !loc.includes(target) && !target.includes(loc)) {
          const targetWords = target.split(/\s+/).filter((w) => w.length > 2)
          if (!targetWords.some((w) => loc.includes(w))) return false
        }
      }
      if (segmentFilter.camera) {
        const cam = String(r.camera || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const targetCam = String(Array.isArray(segmentFilter.camera) ? segmentFilter.camera[0] : segmentFilter.camera).toLowerCase().replace(/[^a-z0-9]/g, '')
        if (cam && targetCam && !cam.includes(targetCam) && !targetCam.includes(cam)) return false
      }
      if (segmentFilter.signalState && (r.signalState || '').toLowerCase() !== String(segmentFilter.signalState).toLowerCase()) return false
      if (segmentFilter.weather && !(r.weather || '').toLowerCase().includes(String(segmentFilter.weather).toLowerCase())) return false
      if (segmentFilter.overspeedOnly && !(r.overSpeed === 'Yes' || r.isOverSpeed || (r.speed && r.speedLimit && r.speed > r.speedLimit))) return false
      if (segmentFilter.minSpeed !== null && segmentFilter.minSpeed !== undefined && (r.speed || 0) < Number(segmentFilter.minSpeed)) return false
      if (segmentFilter.maxSpeed !== null && segmentFilter.maxSpeed !== undefined && (r.speed || 0) > Number(segmentFilter.maxSpeed)) return false
      if (segmentFilter.plateSearch) {
        const plate = (r.numberPlate || r.vehicleNumberPlate || '').toUpperCase()
        if (!plate.includes(String(segmentFilter.plateSearch).toUpperCase())) return false
      }
      return true
    })
  }, [rows, segmentFilter])

  // Construct instance knowledge graph from CSV rows (or isolated segment)
  const graphData = useMemo(() => {
    if (!activeRows || !activeRows.length) {
      return { nodes: [], edges: [], stats: { cameras: 0, locations: 0, types: 0, observations: 0, totalDatasetRows: 0 } }
    }

    const cameras = Array.from(new Set(activeRows.map((r) => r.camera).filter(Boolean)))
    const locations = Array.from(new Set(activeRows.map((r) => r.location || r.roadName).filter(Boolean)))
    const types = Array.from(new Set(activeRows.map((r) => r.type).filter(Boolean)))

    const nodes = []
    const edges = []
    let edgeIndex = 1

    // 1. Location Nodes
    locations.forEach((loc) => {
      const locRows = activeRows.filter((r) => (r.location || r.roadName) === loc)
      const vol = locRows.reduce((sum, r) => sum + (r.volume || 1), 0)
      const peds = locRows.reduce((sum, r) => sum + (r.pedestrians || 0), 0)
      nodes.push({
        id: `loc-${loc}`,
        label: loc,
        category: 'Location',
        color: '#10b981',
        icon: 'MapPin',
        properties: {
          'Total Volume': vol,
          'Pedestrian Activity': peds,
          'Active Records': locRows.length,
        },
      })
    })

    // 2. Camera Nodes
    cameras.forEach((cam) => {
      const camRows = activeRows.filter((r) => r.camera === cam)
      const loc = camRows[0]?.location || camRows[0]?.roadName || 'Unknown'
      nodes.push({
        id: `cam-${cam}`,
        label: cam,
        category: 'Camera',
        color: '#0ea5e9',
        icon: 'Camera',
        properties: {
          'Assigned Location': loc,
          'Frames Captured': camRows.length,
          Status: 'Active Telemetry',
        },
      })

      // Link camera to location
      if (loc && loc !== 'Unknown') {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: `cam-${cam}`,
          target: `loc-${loc}`,
          label: 'MONITORS',
        })
      }
    })

    // 3. Vehicle Type Nodes
    types.forEach((type) => {
      const typeRows = activeRows.filter((r) => r.type === type)
      const vol = typeRows.reduce((sum, r) => sum + (r.volume || 1), 0)
      const meta = getVehicleMeta(type)
      nodes.push({
        id: `type-${type}`,
        label: type,
        category: 'VehicleType',
        color: meta.color,
        icon: meta.label,
        properties: {
          Classification: type,
          'Total Detections': typeRows.length,
          'Calculated Volume': vol,
        },
      })
    })

    // 4. Observation Nodes (all active records by default, or user-selected limit)
    const targetRows = recordLimit === 'ALL'
      ? activeRows
      : activeRows.slice(0, Math.min(Number(recordLimit) || activeRows.length, activeRows.length))

    targetRows.forEach((row, i) => {
      const obsId = row.observationId ? `obs-${row.observationId}` : `obs-${row.id || i + 1}`
      const obsLabel = (row.numberPlate && row.numberPlate !== 'N/A' && row.numberPlate !== 'Unknown')
        ? row.numberPlate
        : (row.observationId || row.id || `Record #${i + 1}`)
      const loc = row.location || row.roadName

      nodes.push({
        id: obsId,
        label: obsLabel,
        category: 'Observation',
        color: '#8b5cf6',
        icon: 'Sparkles',
        properties: {
          'Observation ID': row.id || row.observationId || `OBS-${i + 1}`,
          'Timestamp (IST)': row.timestampIst || row.timestamp || 'N/A',
          'Vehicle Type': row.vehicleType || row.type || 'Car',
          'Number Plate': row.vehicleNumberPlate || row.numberPlate || 'N/A',
          'Plate Confidence': `${Math.round(((row.plateConfidence || row.confidence) > 1 ? (row.plateConfidence || row.confidence) : (row.plateConfidence || row.confidence || 0.95) * 100))}%`,
          'Speed (km/h)': `${row.speed || 0} km/h`,
          'Speed Limit': `${row.speedLimit || 60} km/h`,
          'Over Speed': row.overSpeed || (row.speed > row.speedLimit ? 'Yes' : 'No'),
          'Coordinates': `${row.latitude?.toFixed?.(4) || '17.4485'}, ${row.longitude?.toFixed?.(4) || '78.3742'}`,
          'Vehicle Image': row.vehicleImage || 'N/A',
          'Vehicle Image Path': row.vehicleImagePath || 'N/A',
          'Plate Image Path': row.plateImagePath || 'N/A',
          'Video Clip Path': row.videoClipPath || 'N/A',
        },
        image: row.extractedImage || row.vehicleImageDataUrl,
        hasExtractedImage: row.hasExtractedImage,
        rawRow: row,
      })

      // Links
      if (row.type) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `type-${row.type}`,
          label: 'OF_TYPE',
        })
      }
      if (row.camera) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `cam-${row.camera}`,
          label: 'CAPTURED_BY',
        })
      }
      if (loc) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `loc-${loc}`,
          label: 'OCCURRED_AT',
        })
      }
    })

    return {
      nodes,
      edges,
      stats: {
        cameras: cameras.length,
        locations: locations.length,
        types: types.length,
        observations: targetRows.length,
        totalDatasetRows: activeRows.length,
      },
    }
  }, [activeRows, recordLimit])

  // Filter nodes by category and search
  const visibleNodes = useMemo(() => {
    return graphData.nodes.filter((node) => {
      const matchCat = activeCategory === 'ALL' || node.category === activeCategory
      const matchSearch =
        !searchTerm ||
        node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.category.toLowerCase().includes(searchTerm.toLowerCase())
      return matchCat && matchSearch
    })
  }, [graphData.nodes, activeCategory, searchTerm])

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])

  const visibleEdges = useMemo(() => {
    return graphData.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    )
  }, [graphData.edges, visibleNodeIds])

  const layoutConfig = useMemo(() => {
    // Force (COSE) layout only - collision-free, anti-overlap, spacious physics
    return {
      name: 'cose',
      animate: false,
      padding: 80,
      componentSpacing: 160,
      nodeDimensionsIncludeLabels: true,
      nodeOverlap: 80,
      nodeRepulsion: (node) => {
        const cat = node.data('category')
        if (cat === 'Location') return 240000
        if (cat === 'Camera' || cat === 'VehicleType') return 150000
        return 80000
      },
      idealEdgeLength: (edge) => {
        const lbl = edge.data('label')
        if (lbl === 'MONITORS') return 280
        if (lbl === 'OF_TYPE') return 240
        return 320
      },
      edgeElasticity: 25,
      nestingFactor: 1.1,
      gravity: 0.018, // weak gravity allows nodes to spread out broadly without clumping
      numIter: 1000,
      initialTemp: 400,
      coolingFactor: 0.95,
      stop: () => {
        cyRef.current?.animate({
          fit: { eles: cyRef.current.elements(), padding: 70 },
          duration: 300,
        })
      },
    }
  }, [])

  // Cytoscape initialization
  useEffect(() => {
    if (!containerRef.current) return

    const elements = [
      ...visibleNodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          category: n.category,
          color: n.color,
        },
      })),
      ...visibleEdges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        },
      })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.04,
      maxZoom: 3.5,
      wheelSensitivity: 0.15,
      layout: layoutConfig,
      style: [
        {
          selector: 'node',
          style: {
            width: (node) => {
              const cat = node.data('category')
              if (cat === 'Location') return 60
              if (cat === 'Camera') return 50
              if (cat === 'VehicleType') return 50
              return 38
            },
            height: (node) => {
              const cat = node.data('category')
              if (cat === 'Location') return 60
              if (cat === 'Camera') return 50
              if (cat === 'VehicleType') return 50
              return 38
            },
            label: 'data(label)',
            'background-color': 'data(color)',
            color: '#0f172a',
            'font-size': (node) => (node.data('category') === 'Observation' ? 10 : 12),
            'font-weight': (node) => (node.data('category') === 'Observation' ? 600 : 700),
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'text-wrap': 'wrap',
            'text-max-width': (node) => (node.data('category') === 'Observation' ? 85 : 120),
            'border-width': 2.5,
            'border-color': '#ffffff',
            'border-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.94,
            'text-background-padding': 3,
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#2563eb',
            'underlay-color': '#2563eb',
            'underlay-padding': 6,
            'underlay-opacity': 0.35,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.2,
            'line-color': '#94a3b8',
            opacity: 0.55,
            'curve-style': 'bezier',
            'control-point-step-size': 35,
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#94a3b8',
            'arrow-scale': 0.75,
            label: 'data(label)',
            'font-size': 7.5,
            color: '#64748b',
            'text-rotation': 'autorotate',
            'text-margin-y': -6,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.85,
            'text-background-padding': 2,
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            width: 2.8,
            'line-color': '#2563eb',
            'target-arrow-color': '#2563eb',
            color: '#2563eb',
            opacity: 1,
          },
        },
      ],
    })

    cy.ready(() => {
      cy.animate({
        fit: { eles: cy.elements(), padding: 70 },
        duration: 300,
      })
    })

    cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id()
      const nodeObj = graphData.nodes.find((n) => n.id === nodeId)
      setSelectedNode(nodeObj || null)
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null)
      }
    })

    cyRef.current = cy

    return () => {
      cy.destroy()
    }
  }, [visibleNodes, visibleEdges, graphData.nodes, layoutConfig])

  // Viewport-centered smooth animated zoom controls
  function handleZoomIn() {
    const cy = cyRef.current
    if (!cy) return
    const currentZoom = cy.zoom()
    const targetZoom = Math.min(3.5, currentZoom * 1.3)
    cy.animate({
      zoom: {
        level: targetZoom,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      },
      duration: 180,
    })
  }

  function handleZoomOut() {
    const cy = cyRef.current
    if (!cy) return
    const currentZoom = cy.zoom()
    const targetZoom = Math.max(0.04, currentZoom * 0.75)
    cy.animate({
      zoom: {
        level: targetZoom,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      },
      duration: 180,
    })
  }

  function handleFit() {
    const cy = cyRef.current
    if (!cy) return
    cy.animate({
      fit: {
        eles: cy.elements(),
        padding: 70,
      },
      duration: 260,
    })
  }

  function handleRelayout() {
    const cy = cyRef.current
    if (!cy) return
    cy.layout({
      ...layoutConfig,
      animate: true,
      animationDuration: 500,
      stop: () => {
        cy.animate({
          fit: { eles: cy.elements(), padding: 70 },
          duration: 260,
        })
      },
    }).run()
  }

  return (
    <div className="ontology-page knowledge-graph-page">
      {/* Topbar */}
      <div className="ontology-topbar">
        <div>
          <div className="ontology-kicker">INSTANCE GRAPH · {fileName.toUpperCase()}</div>
          <h1>Knowledge Graph</h1>
          <p>
            Interactive network graph showing entity instances and relationships extracted from{' '}
            <strong>{fileName}</strong> ({activeRows.length} total records).
          </p>
        </div>

        <div className="ontology-stat-card">
          <Network size={18} />
          <div>
            <strong>{graphData.nodes.length}</strong>
            <span>Entities</span>
          </div>
          <div className="ontology-stat-divider" />
          <div>
            <strong>{graphData.edges.length}</strong>
            <span>Relationships</span>
          </div>
          <div className="ontology-stat-divider" />
          <div>
            <strong>{graphData.stats.observations} / {activeRows.length}</strong>
            <span>Records</span>
          </div>
          <div className="ontology-stat-divider" />
          <div>
            <strong>{graphData.stats.cameras}</strong>
            <span>Cameras</span>
          </div>
          <div className="ontology-stat-divider" />
          <div>
            <strong>{graphData.stats.locations}</strong>
            <span>Locations</span>
          </div>
        </div>
      </div>

      {/* AI Queried Segment Banner */}
      {segmentFilter && (
        <div className="kg-active-segment-alert">
          <div className="kg-segment-alert-left">
            <Bot size={18} />
            <div>
              <strong>AI Queried Knowledge Graph Segment</strong>
              <p>{segmentExplanation || 'Filtered subgraph matching your natural language query'}</p>
            </div>
          </div>
          <div className="kg-segment-alert-right">
            <span className="kg-segment-pill">{activeRows.length} events retrieved</span>
            <button
              className="kg-segment-clear-btn"
              onClick={() => {
                setSegmentFilter(null)
                setSegmentExplanation('')
              }}
              type="button"
            >
              <X size={14} />
              <span>Show Full Knowledge Graph</span>
            </button>
          </div>
        </div>
      )}

      {/* Workspace */}
      <div className="ontology-workspace">
        <div className="ontology-main">
          {/* Toolbar */}
          <div className="ontology-toolbar">
            <div className="ontology-search">
              <Search size={16} />
              <input
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search knowledge graph..."
                type="text"
                value={searchTerm}
              />
            </div>

            {/* Category Filter Pills */}
            <div className="kg-category-filters">
              {[
                { key: 'ALL', label: `All (${graphData.nodes.length})` },
                { key: 'Location', label: `Locations (${graphData.stats.locations})` },
                { key: 'Camera', label: `Cameras (${graphData.stats.cameras})` },
                { key: 'VehicleType', label: `Types (${graphData.stats.types})` },
                { key: 'Observation', label: `Records (${graphData.stats.observations})` },
              ].map(({ key, label }) => (
                <button
                  className={`kg-filter-btn ${activeCategory === key ? 'active' : ''}`}
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Records & Layout Controls */}
            <div className="kg-toolbar-controls">
              <div className="kg-control-group">
                <span className="kg-control-label">Records:</span>
                <select
                  aria-label="Records displayed in knowledge graph"
                  className="kg-select-control"
                  onChange={(e) => setRecordLimit(e.target.value)}
                  value={recordLimit}
                >
                  <option value="ALL">All ({activeRows.length})</option>
                  {activeRows.length > 250 && <option value="250">Top 250</option>}
                  {activeRows.length > 100 && <option value="100">Top 100</option>}
                  {activeRows.length > 50 && <option value="50">Top 50</option>}
                  {activeRows.length > 20 && <option value="20">Top 20</option>}
                </select>
              </div>

              <div className="kg-control-group">
                <span className="kg-control-label">Format:</span>
                <span className="kg-format-pill">Force (COSE)</span>
              </div>
            </div>

            {/* Actions */}
            <div className="ontology-toolbar-actions">
              <button onClick={handleZoomIn} title="Zoom In" type="button">
                <Plus size={17} />
              </button>
              <button onClick={handleZoomOut} title="Zoom Out" type="button">
                <Minus size={17} />
              </button>
              <button onClick={handleFit} title="Fit to Screen" type="button">
                <Maximize size={16} />
              </button>
              <button onClick={handleRelayout} title="Re-layout Graph" type="button">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Graph Canvas */}
          <div className="ontology-graph-wrapper">
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            <div className="ontology-layout-badge">
              <Network size={15} />
              <span>Force Layout (COSE) · Cytoscape Engine</span>
            </div>

            <div className="ontology-graph-info">
              {visibleNodes.length} nodes · {visibleEdges.length} edges
            </div>
          </div>
        </div>

        {/* Selected Entity Details Drawer */}
        {selectedNode && (
          <div className="kg-details-panel">
            <div className="kg-details-header">
              <div className="kg-details-title-row">
                <span className="kg-badge" style={{ backgroundColor: selectedNode.color }}>
                  {selectedNode.category}
                </span>
                <button className="ontology-details-close" onClick={() => setSelectedNode(null)} type="button">
                  <X size={16} />
                </button>
              </div>
              <h2>{selectedNode.label}</h2>
              <span className="kg-node-id">ID: {selectedNode.id}</span>
            </div>

            <div className="kg-details-body">
              {selectedNode.image && (
                <div
                  className="kg-inspector-media-card"
                  style={{
                    background: '#0f172a',
                    borderRadius: '10px',
                    padding: '8px',
                    marginBottom: '14px',
                    border: '1px solid #334155',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                      fontSize: '11px',
                      color: '#94a3b8',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Camera size={12} /> Surveillance Capture
                    </span>
                    {selectedNode.hasExtractedImage && (
                      <span
                        style={{
                          background: '#064e3b',
                          color: '#34d399',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Sparkles size={10} /> XLSX Extracted
                      </span>
                    )}
                  </div>
                  <div
                    onClick={() => selectedNode.rawRow && setPreviewModalRow(selectedNode.rawRow)}
                    style={{
                      cursor: 'pointer',
                      position: 'relative',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      maxHeight: '140px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#020617',
                    }}
                    title="Click to open high-resolution surveillance modal"
                  >
                    <img
                      alt={selectedNode.label}
                      src={selectedNode.image}
                      style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        color: '#ffffff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Eye size={10} /> Click to Inspect
                    </div>
                  </div>
                </div>
              )}

              <h3>Attributes & Telemetry</h3>
              <div className="kg-property-list">
                {Object.entries(selectedNode.properties || {}).map(([key, val]) => (
                  <div className="kg-property-row" key={key}>
                    <span className="kg-prop-key">{key}</span>
                    <strong className="kg-prop-val">{String(val)}</strong>
                  </div>
                ))}
              </div>

              <h3>Connected Relationships</h3>
              <div className="kg-edge-list">
                {graphData.edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e) => (
                    <div className="kg-edge-item" key={e.id}>
                      <span className="kg-edge-label">{e.label}</span>
                      <span className="kg-edge-target">
                        {e.source === selectedNode.id ? `→ ${e.target}` : `← ${e.source}`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {previewModalRow && (
        <MediaPreviewModal
          allRows={rows}
          isOpen={Boolean(previewModalRow)}
          onClose={() => setPreviewModalRow(null)}
          onSelectRow={setPreviewModalRow}
          row={previewModalRow}
        />
      )}
    </div>
  )
}
