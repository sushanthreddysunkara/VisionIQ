import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import {
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
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selectedNode, setSelectedNode] = useState(null)
  const [previewModalRow, setPreviewModalRow] = useState(null)
  const containerRef = useRef(null)
  const cyRef = useRef(null)

  // Construct instance knowledge graph from CSV rows
  const graphData = useMemo(() => {
    if (!rows || !rows.length) {
      return { nodes: [], edges: [], stats: { cameras: 0, locations: 0, types: 0 } }
    }

    const cameras = Array.from(new Set(rows.map((r) => r.camera).filter(Boolean)))
    const locations = Array.from(new Set(rows.map((r) => r.location).filter(Boolean)))
    const types = Array.from(new Set(rows.map((r) => r.type).filter(Boolean)))

    const nodes = []
    const edges = []
    let edgeIndex = 1

    // 1. Location Nodes
    locations.forEach((loc) => {
      const locRows = rows.filter((r) => r.location === loc)
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
      const camRows = rows.filter((r) => r.camera === cam)
      const loc = camRows[0]?.location || 'Unknown'
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
      edges.push({
        id: `edge-${edgeIndex++}`,
        source: `cam-${cam}`,
        target: `loc-${loc}`,
        label: 'MONITORS',
      })
    })

    // 3. Vehicle Type Nodes
    types.forEach((type) => {
      const typeRows = rows.filter((r) => r.type === type)
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

    // 4. Observation Samples (limit to first 18 for optimal visual clarity)
    const sampleRows = rows.slice(0, 18)
    sampleRows.forEach((row, i) => {
      const obsId = row.observationId ? `obs-${row.observationId}` : `obs-${i + 1}`
      const obsLabel = row.observationId || `Observation #${i + 1}`
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
          'Coordinates': `${row.latitude?.toFixed(4) || '17.4485'}, ${row.longitude?.toFixed(4) || '78.3742'}`,
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
      if (row.location) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `loc-${row.location}`,
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
        observations: sampleRows.length,
      },
    }
  }, [rows])

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
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.15,
      layout: {
        name: 'cose',
        animate: false,
        padding: 50,
        nodeRepulsion: 7000,
        idealEdgeLength: 120,
        gravity: 0.25,
      },
      style: [
        {
          selector: 'node',
          style: {
            width: 44,
            height: 44,
            label: 'data(label)',
            'background-color': 'data(color)',
            color: '#1e293b',
            'font-size': 11,
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-wrap': 'wrap',
            'text-max-width': 90,
            'border-width': 2.5,
            'border-color': '#ffffff',
            'border-opacity': 0.9,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#2563eb',
            'underlay-color': '#2563eb',
            'underlay-padding': 4,
            'underlay-opacity': 0.35,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.8,
            'line-color': '#94a3b8',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#94a3b8',
            'arrow-scale': 0.9,
            label: 'data(label)',
            'font-size': 8,
            color: '#64748b',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.85,
            'text-background-padding': 2,
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            width: 3,
            'line-color': '#2563eb',
            'target-arrow-color': '#2563eb',
            color: '#2563eb',
          },
        },
      ],
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
  }, [visibleNodes, visibleEdges, graphData.nodes])

  function handleZoomIn() {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25)
  }

  function handleZoomOut() {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8)
  }

  function handleFit() {
    cyRef.current?.fit(undefined, 40)
  }

  function handleRelayout() {
    cyRef.current?.layout({ name: 'cose', animate: true, animationDuration: 400, padding: 50 }).run()
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
            <strong>{fileName}</strong> ({rows.length} records).
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
              {['ALL', 'Location', 'Camera', 'VehicleType', 'Observation'].map((cat) => (
                <button
                  className={`kg-filter-btn ${activeCategory === cat ? 'active' : ''}`}
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  type="button"
                >
                  {cat === 'ALL' ? 'All Entities' : cat}
                </button>
              ))}
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
          <div className="ontology-graph-wrapper" style={{ height: '560px' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            <div className="ontology-layout-badge">
              <Network size={15} />
              <span>Force Graph · Cytoscape Engine</span>
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
