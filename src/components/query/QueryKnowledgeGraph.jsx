import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import {
  Camera,
  Car,
  ChevronDown,
  Eye,
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
import { getCanonicalVehicleDomain, getVehicleMeta } from '../../data/vehicleTypes'
import MediaPreviewModal from '../MediaPreviewModal'

export default function QueryKnowledgeGraph({
  rows = [],
  queryLabel = 'Queried Telemetry',
  initialSelectedId = null,
  onClose,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [vehicleDomainFilter, setVehicleDomainFilter] = useState('ALL')
  const [segregatedView, setSegregatedView] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null)
  const [previewModalRow, setPreviewModalRow] = useState(null)
  const containerRef = useRef(null)
  const cyRef = useRef(null)

  // Compute breakdown of vehicle types for the domain color legend
  const domainBreakdown = useMemo(() => {
    const counts = {}
    rows.forEach((r) => {
      const rawType = r.type || r.vehicleType || 'Car'
      const domain = getCanonicalVehicleDomain(rawType)
      const meta = getVehicleMeta(domain)
      if (!counts[domain]) {
        counts[domain] = {
          label: domain,
          rawType: domain,
          count: 0,
          color: meta.color,
          bg: meta.bg,
          border: meta.border,
        }
      }
      counts[domain].count += 1
    })
    return Object.values(counts).sort((a, b) => b.count - a.count)
  }, [rows])

  // Construct instance knowledge graph specifically for the queried records
  const graphData = useMemo(() => {
    if (!rows || !rows.length) {
      return { nodes: [], edges: [], stats: { cameras: 0, locations: 0, types: 0, observations: 0, totalQueried: 0 } }
    }

    const cameras = Array.from(new Set(rows.map((r) => r.camera).filter(Boolean)))
    const locations = Array.from(new Set(rows.map((r) => r.roadName || r.location).filter(Boolean)))
    const domains = Array.from(new Set(rows.map((r) => getCanonicalVehicleDomain(r.type || r.vehicleType)).filter(Boolean)))

    const nodes = []
    const edges = []
    let edgeIndex = 1

    // If segregatedView is active, create parent compound group nodes for each Vehicle Type,
    // plus parent compound group nodes for Cameras and Locations so all types/domains are segregated together!
    if (segregatedView) {
      // Parent cluster for each vehicle domain
      domains.forEach((domain) => {
        const meta = getVehicleMeta(domain)
        const count = rows.filter((r) => getCanonicalVehicleDomain(r.type || r.vehicleType) === domain).length
        nodes.push({
          id: `group-type-${domain}`,
          label: `${domain.toUpperCase()} DOMAIN · ${count} RECORDS`,
          category: 'Group',
          color: meta.bg || '#f8fafc',
          borderColor: meta.color || '#3b82f6',
          isGroup: true,
          properties: {
            'Cluster Domain': domain,
            'Vehicle Count': count,
            'Color Classification': meta.color,
          },
        })
      })

      // Cameras cluster
      if (cameras.length > 0) {
        nodes.push({
          id: 'group-cameras',
          label: `CAMERAS NETWORK · ${cameras.length} UNITS`,
          category: 'Group',
          color: '#f8fafc',
          borderColor: '#475569',
          isGroup: true,
          properties: {
            'Cluster Domain': 'Surveillance Network',
            'Active Cameras': cameras.length,
          },
        })
      }

      // Monitored Locations cluster
      if (locations.length > 0) {
        nodes.push({
          id: 'group-locations',
          label: `MONITORED ROADS · ${locations.length} ZONES`,
          category: 'Group',
          color: '#f0fdf4',
          borderColor: '#10b981',
          isGroup: true,
          properties: {
            'Cluster Domain': 'Roads & Corridors',
            'Monitored Zones': locations.length,
          },
        })
      }
    }

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
        borderColor: '#ffffff',
        icon: 'MapPin',
        parent: segregatedView ? 'group-locations' : undefined,
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
      const assignedLoc = camRows[0]?.roadName || camRows[0]?.location || (locations.length > 0 ? locations[0] : null)

      nodes.push({
        id: `cam-${cam}`,
        label: cam,
        category: 'Camera',
        color: '#475569',
        borderColor: '#ffffff',
        icon: 'Camera',
        parent: segregatedView ? 'group-cameras' : undefined,
        properties: {
          'Camera ID': cam,
          'Assigned Road': assignedLoc || 'N/A',
          'Queried Detections': camRows.length,
          Heading: camRows[0]?.cameraDirection || 'North',
        },
      })

      // Link camera to location only if location node exists
      if (assignedLoc && locations.includes(assignedLoc)) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: `cam-${cam}`,
          target: `loc-${assignedLoc}`,
          label: 'MONITORS',
          color: '#94a3b8',
        })
      }
    })

    // 3. Vehicle Type Domain Nodes
    domains.forEach((domain) => {
      const domainRows = rows.filter((r) => getCanonicalVehicleDomain(r.type || r.vehicleType) === domain)
      const meta = getVehicleMeta(domain)

      nodes.push({
        id: `type-${domain}`,
        label: domain,
        category: 'VehicleType',
        vehicleType: domain,
        color: meta.color || '#2563eb',
        borderColor: '#ffffff',
        icon: domain,
        parent: segregatedView ? `group-type-${domain}` : undefined,
        properties: {
          'Vehicle Domain': domain,
          'Matching Detections': domainRows.length,
          'Average Confidence': `${Math.round(
            domainRows.reduce((sum, r) => sum + (r.confidence > 1 ? r.confidence : (r.confidence || 0.9) * 100), 0) /
              (domainRows.length || 1)
          )}%`,
        },
      })
    })

    // 4. Observation Nodes (each individual vehicle detection)
    // Inherit consistent domain color from vehicle type (all cars blue, all bikes cyan, etc.)
    rows.forEach((row, i) => {
      const obsId = row.observationId ? `obs-${row.observationId}` : `obs-${row.id || i + 1}`
      const obsLabel = row.numberPlate && row.numberPlate !== 'N/A' && row.numberPlate !== 'Unknown'
        ? row.numberPlate
        : (row.observationId || row.id || `Detection #${i + 1}`)
      const loc = row.roadName || row.location
      const domain = getCanonicalVehicleDomain(row.type || row.vehicleType)
      const meta = getVehicleMeta(domain)

      nodes.push({
        id: obsId,
        label: obsLabel,
        category: 'Observation',
        vehicleType: domain,
        color: meta.color, // Same color as all other vehicles in this domain!
        borderColor: meta.border || '#ffffff',
        icon: meta.label,
        parent: segregatedView ? `group-type-${domain}` : undefined,
        properties: {
          'Observation ID': row.id || row.observationId || `OBS-${i + 1}`,
          'Vehicle Domain': domain,
          'Number Plate': row.vehicleNumberPlate || row.numberPlate || 'N/A',
          'Vehicle Type': domain,
          'Timestamp (IST)': row.timestampIst || row.timestamp || 'N/A',
          'Plate Confidence': `${Math.round(((row.plateConfidence || row.confidence) > 1 ? (row.plateConfidence || row.confidence) : (row.plateConfidence || row.confidence || 0.95) * 100))}%`,
          'Speed (km/h)': `${row.speed || 0} km/h`,
          'Speed Limit': `${row.speedLimit || 60} km/h`,
          'Over Speed': row.overSpeed || (row.speed > row.speedLimit ? 'Yes' : 'No'),
          Coordinates: `${row.latitude?.toFixed?.(4) || '17.4485'}, ${row.longitude?.toFixed?.(4) || '78.3742'}`,
          'Vehicle Image': row.vehicleImage || 'N/A',
          'Vehicle Image Path': row.vehicleImagePath || 'N/A',
          'Plate Image Path': row.plateImagePath || 'N/A',
          'Video Clip Path': row.videoClipPath || 'N/A',
        },
        image: row.extractedImage || row.vehicleImageDataUrl,
        hasExtractedImage: row.hasExtractedImage,
        rawRow: row,
      })

      // Link to Domain Hub (all links share uniform #94a3b8)
      edges.push({
        id: `edge-${edgeIndex++}`,
        source: obsId,
        target: `type-${domain}`,
        label: 'OF_TYPE',
        color: '#94a3b8',
      })

      // Link to camera
      if (row.camera && cameras.includes(row.camera)) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `cam-${row.camera}`,
          label: 'CAPTURED_BY',
          color: '#94a3b8',
        })
      }

      // Link to location
      if (loc && locations.includes(loc)) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `loc-${loc}`,
          label: 'OCCURRED_AT',
          color: '#94a3b8',
        })
      }
    })

    return {
      nodes,
      edges,
      stats: {
        cameras: cameras.length,
        locations: locations.length,
        types: domains.length,
        observations: rows.length,
        totalQueried: rows.length,
      },
    }
  }, [rows, segregatedView])


  // Filter nodes by category, vehicle domain, and search
  const visibleNodes = useMemo(() => {
    const rawFiltered = graphData.nodes.filter((node) => {
      if (node.category === 'Group') return true // keep candidate groups

      const matchCat = activeCategory === 'ALL' || node.category === activeCategory

      let matchDomain = true
      if (vehicleDomainFilter !== 'ALL') {
        const targetDomain = vehicleDomainFilter.toLowerCase()
        if (node.category === 'Observation') {
          matchDomain = (node.vehicleType || '').toLowerCase() === targetDomain
        } else if (node.category === 'VehicleType') {
          matchDomain = (node.vehicleType || node.label || '').toLowerCase() === targetDomain
        }
      }

      const searchLower = searchTerm.toLowerCase()
      const matchSearch =
        !searchTerm ||
        node.label.toLowerCase().includes(searchLower) ||
        node.category.toLowerCase().includes(searchLower) ||
        (node.vehicleType && node.vehicleType.toLowerCase().includes(searchLower))

      return matchCat && matchDomain && matchSearch
    })

    let candidateNodes = rawFiltered

    if (vehicleDomainFilter !== 'ALL') {
      const activeObs = rawFiltered.filter((n) => n.category === 'Observation')
      const activeObsIds = new Set(activeObs.map((n) => n.id))
      const connectedEntityIds = new Set()

      graphData.edges.forEach((e) => {
        if (activeObsIds.has(e.source)) connectedEntityIds.add(e.target)
        if (activeObsIds.has(e.target)) connectedEntityIds.add(e.source)
      })

      candidateNodes = rawFiltered.filter((n) => {
        if (n.category === 'Group') return true
        if (n.category === 'Observation') return true
        if (n.category === 'VehicleType') {
          return (n.vehicleType || n.label || '').toLowerCase() === vehicleDomainFilter.toLowerCase()
        }
        return connectedEntityIds.has(n.id)
      })
    }

    // Only keep parent group nodes that actually have visible children
    const visibleChildParentIds = new Set(
      candidateNodes
        .filter((n) => n.category !== 'Group' && n.parent)
        .map((n) => n.parent)
    )

    return candidateNodes.filter((n) => {
      if (n.category === 'Group') {
        return visibleChildParentIds.has(n.id)
      }
      return true
    })
  }, [graphData.nodes, graphData.edges, activeCategory, vehicleDomainFilter, searchTerm])

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])

  const visibleEdges = useMemo(() => {
    return graphData.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    )
  }, [graphData.edges, visibleNodeIds])

  // Clustered Force (COSE) layout config
  const layoutConfig = useMemo(() => {
    return {
      name: 'cose',
      animate: false,
      padding: 60,
      componentSpacing: 180,
      nodeDimensionsIncludeLabels: true,
      nodeOverlap: 25,
      nestingFactor: 1.25,
      gravityCompound: 1.0,
      gravityRangeCompound: 1.5,
      nodeRepulsion: (node) => {
        if (node.isParent?.() || node.data('category') === 'Group') return 650000
        const cat = node.data('category')
        if (cat === 'Location') return 240000
        if (cat === 'Camera' || cat === 'VehicleType') return 160000
        return 75000
      },
      idealEdgeLength: (edge) => {
        const lbl = edge.data('label')
        if (lbl === 'OF_TYPE') return 75 // gathers same vehicle types tightly together around their domain hub!
        if (lbl === 'MONITORS') return 240
        return 280
      },
      edgeElasticity: (edge) => {
        if (edge.data('label') === 'OF_TYPE') return 90 // high elasticity inside domain cluster
        return 18
      },
      gravity: 0.012,
      numIter: 1100,
      stop: () => {
        cyRef.current?.animate({
          fit: { eles: cyRef.current.elements(), padding: 50 },
          duration: 250,
        })
      },
    }
  }, [segregatedView])

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
          borderColor: n.borderColor || '#ffffff',
          vehicleType: n.vehicleType || '',
          parent: (n.parent && visibleNodeIds.has(n.parent)) ? n.parent : undefined,
          isGroup: n.isGroup,
        },
      })),
      ...visibleEdges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          color: e.color || '#94a3b8',
        },
      })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.08,
      maxZoom: 3,
      wheelSensitivity: 0.15,
      layout: layoutConfig,
      style: [
        {
          selector: 'node',
          style: {
            width: (node) => {
              const cat = node.data('category')
              if (cat === 'Location') return 58
              if (cat === 'Camera') return 48
              if (cat === 'VehicleType') return 52
              return 36
            },
            height: (node) => {
              const cat = node.data('category')
              if (cat === 'Location') return 58
              if (cat === 'Camera') return 48
              if (cat === 'VehicleType') return 52
              return 36
            },
            label: 'data(label)',
            'background-color': 'data(color)',
            color: '#0f172a',
            'font-size': (node) => (node.data('category') === 'Observation' ? 9.5 : 12),
            'font-weight': (node) => (node.data('category') === 'Observation' ? 600 : 700),
            'text-valign': 'bottom',
            'text-margin-y': 7,
            'text-wrap': 'wrap',
            'text-max-width': (node) => (node.data('category') === 'Observation' ? 85 : 110),
            'border-width': (node) => (node.data('category') === 'VehicleType' ? 3.5 : 2.5),
            'border-color': 'data(borderColor)',
            'border-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.94,
            'text-background-padding': 3,
            'text-background-shape': 'roundrectangle',
          },
        },
        // Style for Segregated Compound Parent Clusters
        {
          selector: ':parent',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.16,
            'border-width': 2,
            'border-style': 'dashed',
            'border-color': 'data(borderColor)',
            'border-opacity': 0.8,
            'border-radius': 16,
            label: 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': -8,
            'font-size': 11,
            'font-weight': 800,
            color: '#1e293b',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.94,
            'text-background-padding': 3,
            'text-background-shape': 'roundrectangle',
            padding: 24,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3.5,
            'border-color': '#0f172a',
            'underlay-color': 'data(color)',
            'underlay-padding': 8,
            'underlay-opacity': 0.45,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.3,
            'line-color': '#94a3b8',
            opacity: 0.6,
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
            width: 3,
            'line-color': '#0f172a',
            'target-arrow-color': '#0f172a',
            color: '#0f172a',
            opacity: 1,
          },
        },
      ],
    })

    cy.ready(() => {
      cy.animate({
        fit: { eles: cy.elements(), padding: 50 },
        duration: 250,
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

  // Viewport-centered smooth zoom controls
  function handleZoomIn() {
    const cy = cyRef.current
    if (!cy) return
    const currentZoom = cy.zoom()
    const targetZoom = Math.min(3, currentZoom * 1.3)
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
    const targetZoom = Math.max(0.1, currentZoom * 0.75)
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
        padding: 50,
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
    }).run()
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

        {/* Segregation Toggle Button */}
        <button
          className={`kg-segregation-toggle ${segregatedView ? 'active' : ''}`}
          onClick={() => setSegregatedView(!segregatedView)}
          title="Toggle segregated type clusters"
          type="button"
        >
          <Layers size={13} />
          <span>{segregatedView ? 'Segregated by Type' : 'Free Network'}</span>
        </button>

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

      {/* Vehicle Domain Colors Legend & Quick-Filter Bar */}
      {domainBreakdown.length > 0 && (
        <div className="kg-domain-bar">
          <div className="kg-domain-bar-left">
            <span className="kg-domain-title">
              <Sparkles className="kg-domain-icon" size={13} />
              Vehicle Domains:
            </span>
            <div className="kg-domain-pills">
              <button
                className={`kg-domain-pill ${vehicleDomainFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setVehicleDomainFilter('ALL')}
                type="button"
              >
                <span className="kg-swatch-all" />
                <span>All Domains ({rows.length})</span>
              </button>
              {domainBreakdown.map((item) => {
                const isActive = vehicleDomainFilter.toLowerCase() === item.label.toLowerCase()
                return (
                  <button
                    className={`kg-domain-pill ${isActive ? 'active' : ''}`}
                    key={item.label}
                    onClick={() => setVehicleDomainFilter(isActive ? 'ALL' : item.label)}
                    style={{
                      borderColor: isActive ? item.color : '#e2e8f0',
                      backgroundColor: isActive ? item.bg : '#ffffff',
                    }}
                    title={`Show all ${item.label}s (${item.count} detections with color ${item.color})`}
                    type="button"
                  >
                    <span
                      className="kg-domain-dot"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="kg-domain-name">{item.label}s</span>
                    <span
                      className="kg-domain-count"
                      style={{
                        backgroundColor: isActive ? item.color : '#f1f5f9',
                        color: isActive ? '#ffffff' : '#475569',
                      }}
                    >
                      {item.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          {vehicleDomainFilter !== 'ALL' && (
            <button
              className="kg-domain-reset-btn"
              onClick={() => setVehicleDomainFilter('ALL')}
              type="button"
            >
              <X size={12} />
              <span>Show All Vehicles</span>
            </button>
          )}
        </div>
      )}

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
              <div
                className="query-kg-drawer-badge"
                style={{
                  backgroundColor: selectedNode.color,
                  color: selectedNode.category === 'Group' ? '#0f172a' : '#ffffff',
                  border: selectedNode.category === 'Group' ? '1px solid rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {selectedNode.category === 'Observation'
                  ? `${selectedNode.vehicleType || 'Vehicle'} · Detection`
                  : selectedNode.category === 'Group'
                  ? 'Domain Cluster'
                  : selectedNode.category}
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
            {selectedNode.vehicleType && (
              <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                <button
                  className="kg-domain-isolate-btn"
                  onClick={() => setVehicleDomainFilter(selectedNode.vehicleType)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${selectedNode.color}`,
                    color: selectedNode.color,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  type="button"
                >
                  Show all {selectedNode.vehicleType}s
                </button>
              </div>
            )}

            {selectedNode.image && (
              <div
                style={{
                  background: '#0f172a',
                  borderRadius: '10px',
                  padding: '8px',
                  margin: '10px 0 14px 0',
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
