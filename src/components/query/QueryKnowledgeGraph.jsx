import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import {
  Camera,
  Car,
  ChevronDown,
  Layers,
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

export default function QueryKnowledgeGraph({
  rows = [],
  queryLabel = 'Queried Telemetry',
  initialSelectedId = null,
  onClose,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selectedNode, setSelectedNode] = useState(null)
  const containerRef = useRef(null)
  const cyRef = useRef(null)

  // Construct instance knowledge graph specifically for the queried records
  const graphData = useMemo(() => {
    if (!rows || !rows.length) {
      return { nodes: [], edges: [], stats: { cameras: 0, locations: 0, types: 0, observations: 0 } }
    }

    const cameras = Array.from(new Set(rows.map((r) => r.camera).filter(Boolean)))
    const locations = Array.from(new Set(rows.map((r) => r.roadName || r.location).filter(Boolean)))
    const types = Array.from(new Set(rows.map((r) => r.type).filter(Boolean)))

    const nodes = []
    const edges = []
    let edgeIndex = 1

    // 1. Location / Road Nodes
    locations.forEach((loc) => {
      const locRows = rows.filter((r) => (r.roadName || r.location) === loc)
      const vol = locRows.reduce((sum, r) => sum + (r.volume || 1), 0)
      const peds = locRows.reduce((sum, r) => sum + (r.pedestrians || 0), 0)

      nodes.push({
        id: `loc-${loc}`,
        label: loc,
        category: 'Location',
        color: '#10b981',
        icon: 'MapPin',
        properties: {
          'Road / Junction': loc,
          'Matching Records': locRows.length,
          'Calculated Volume': vol,
          'Pedestrian Events': peds,
        },
      })
    })

    // 2. Camera Nodes
    cameras.forEach((cam) => {
      const camRows = rows.filter((r) => r.camera === cam)
      const loc = camRows[0]?.roadName || camRows[0]?.location || 'Monitored Road'

      nodes.push({
        id: `cam-${cam}`,
        label: cam,
        category: 'Camera',
        color: '#0ea5e9',
        icon: 'Camera',
        properties: {
          'Camera ID': cam,
          'Assigned Road': loc,
          'Queried Detections': camRows.length,
          Heading: camRows[0]?.cameraDirection || 'North',
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
      const meta = getVehicleMeta(type)

      nodes.push({
        id: `type-${type}`,
        label: type,
        category: 'VehicleType',
        color: meta.color || '#3b82f6',
        icon: meta.label || type,
        properties: {
          'Vehicle Category': type,
          'Matching Detections': typeRows.length,
          'Average Confidence': `${Math.round(
            typeRows.reduce((sum, r) => sum + (r.confidence > 1 ? r.confidence : (r.confidence || 0.9) * 100), 0) /
              typeRows.length
          )}%`,
        },
      })
    })

    // 4. Observation Nodes (sample up to 25 top matching detections for clarity)
    const sampleRows = rows.slice(0, 25)
    sampleRows.forEach((row, i) => {
      const obsId = row.observationId ? `obs-${row.observationId}` : `obs-${i + 1}`
      const obsLabel = row.numberPlate && row.numberPlate !== 'N/A' ? row.numberPlate : (row.observationId || `Detection #${i + 1}`)
      const loc = row.roadName || row.location

      nodes.push({
        id: obsId,
        label: obsLabel,
        category: 'Observation',
        color: '#8b5cf6',
        icon: 'Sparkles',
        properties: {
          'Observation ID': row.observationId || `OBS-${i + 1}`,
          'Number Plate': row.numberPlate || 'N/A',
          Vehicle: row.type,
          Timestamp: `${row.date || ''} ${row.time || row.timestamp || ''}`.trim() || 'N/A',
          Road: loc || 'Unknown',
          Junction: row.junctionId || 'N/A',
          Camera: row.camera,
          'Camera Heading': row.cameraDirection || 'North',
          'Signal State': row.signalState || 'Green',
          Confidence: `${Math.round(row.confidence > 1 ? row.confidence : (row.confidence || 0.94) * 100)}%`,
          Weather: row.weather || 'Clear',
          Distance: `${row.distance || 18}m`,
          Coordinates: `${row.latitude || 17.4485}, ${row.longitude || 78.3742}`,
        },
      })

      // Link to vehicle type
      if (row.type) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `type-${row.type}`,
          label: 'OF_TYPE',
        })
      }

      // Link to camera
      if (row.camera) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `cam-${row.camera}`,
          label: 'CAPTURED_BY',
        })
      }

      // Link to location
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
        observations: sampleRows.length,
        totalQueried: rows.length,
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

  // Set initial selected node if provided
  useEffect(() => {
    if (initialSelectedId && graphData.nodes.length) {
      const match =
        graphData.nodes.find((n) => n.id === initialSelectedId) ||
        graphData.nodes.find((n) => n.label === initialSelectedId) ||
        graphData.nodes.find((n) => n.id === `obs-${initialSelectedId}`)
      if (match) {
        setSelectedNode(match)
      }
    }
  }, [initialSelectedId, graphData.nodes])

  // Cytoscape rendering
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
        padding: 40,
        nodeRepulsion: 7500,
        idealEdgeLength: 110,
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
            color: '#0f172a',
            'font-size': 11,
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-wrap': 'wrap',
            'text-max-width': 95,
            'border-width': 2.5,
            'border-color': '#ffffff',
            'border-opacity': 0.95,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#2563eb',
            'underlay-color': '#2563eb',
            'underlay-padding': 5,
            'underlay-opacity': 0.3,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.8,
            'line-color': '#cbd5e1',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#94a3b8',
            'arrow-scale': 0.9,
            label: 'data(label)',
            'font-size': 8,
            color: '#64748b',
            'text-rotation': 'autorotate',
            'text-margin-y': -7,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
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
    cyRef.current?.fit(undefined, 35)
  }

  function handleRelayout() {
    cyRef.current?.layout({ name: 'cose', animate: true, animationDuration: 400, padding: 40 }).run()
  }

  return (
    <div className="query-kg-container">
      {/* Knowledge Graph Toolbar */}
      <div className="query-kg-toolbar">
        <div className="query-kg-title">
          <Network className="query-kg-icon" size={18} />
          <div>
            <strong>Knowledge Graph for &ldquo;{queryLabel}&rdquo;</strong>
            <span>
              {graphData.stats.totalQueried} matching detections · {graphData.nodes.length} entities · {graphData.edges.length} relationships
            </span>
          </div>
        </div>

        <div className="query-kg-search-wrap">
          <Search size={14} />
          <input
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search graph entities..."
            type="text"
            value={searchTerm}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} type="button">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category Filter Buttons */}
        <div className="query-kg-cat-filters">
          {['ALL', 'Location', 'Camera', 'VehicleType', 'Observation'].map((cat) => (
            <button
              className={`query-kg-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              key={cat}
              onClick={() => setActiveCategory(cat)}
              type="button"
            >
              {cat === 'ALL' ? 'All' : cat === 'VehicleType' ? 'Vehicle' : cat}
            </button>
          ))}
        </div>

        {/* Zoom & Fit Actions */}
        <div className="query-kg-actions">
          <button onClick={handleZoomIn} title="Zoom in" type="button">
            <Plus size={16} />
          </button>
          <button onClick={handleZoomOut} title="Zoom out" type="button">
            <Minus size={16} />
          </button>
          <button onClick={handleFit} title="Fit graph" type="button">
            <Maximize size={15} />
          </button>
          <button onClick={handleRelayout} title="Re-layout graph" type="button">
            <RefreshCw size={15} />
          </button>
          {onClose && (
            <button className="query-kg-close-btn" onClick={onClose} title="Close graph" type="button">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Graph Canvas & Side Drawer */}
      <div className="query-kg-canvas-wrapper">
        <div className="query-kg-cy" ref={containerRef} />

        <div className="query-kg-watermark">
          <Network size={14} />
          <span>Queried Knowledge Sub-Graph · Cytoscape Engine</span>
        </div>

        {/* Node Properties Drawer */}
        {selectedNode && (
          <div className="query-kg-drawer">
            <div className="query-kg-drawer-header">
              <div className="query-kg-drawer-badge" style={{ backgroundColor: selectedNode.color }}>
                {selectedNode.category}
              </div>
              <button
                className="query-kg-drawer-close"
                onClick={() => setSelectedNode(null)}
                type="button"
              >
                <X size={15} />
              </button>
            </div>

            <h3 className="query-kg-drawer-title">{selectedNode.label}</h3>
            <span className="query-kg-drawer-id">ID: {selectedNode.id}</span>

            <div className="query-kg-drawer-section">
              <h4>Entity Properties</h4>
              <div className="query-kg-prop-list">
                {Object.entries(selectedNode.properties || {}).map(([k, v]) => (
                  <div className="query-kg-prop-row" key={k}>
                    <span>{k}</span>
                    <strong>{String(v)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="query-kg-drawer-section">
              <h4>Direct Relationships</h4>
              <div className="query-kg-rel-list">
                {graphData.edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e) => (
                    <div className="query-kg-rel-item" key={e.id}>
                      <span className="query-kg-rel-badge">{e.label}</span>
                      <span className="query-kg-rel-node">
                        {e.source === selectedNode.id ? `→ ${e.target}` : `← ${e.source}`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
