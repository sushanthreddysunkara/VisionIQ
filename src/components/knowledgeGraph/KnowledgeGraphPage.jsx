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
import { getCanonicalVehicleDomain, getVehicleMeta, isVehicleTypeMatch } from '../../data/vehicleTypes'
import MediaPreviewModal from '../MediaPreviewModal'

export default function KnowledgeGraphPage({ rows = [], fileName = 'Active Dataset' }) {
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [vehicleDomainFilter, setVehicleDomainFilter] = useState('ALL')
  const [segregatedView, setSegregatedView] = useState(true) // Segregate all types together into clusters by default
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
          const matchType = rawTypes.some((t) => isVehicleTypeMatch(r.vehicleType || r.type, t))
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

  // Compute breakdown of vehicle types for the domain color legend
  const domainBreakdown = useMemo(() => {
    const counts = {}
    activeRows.forEach((r) => {
      const rawType = r.vehicleType || r.type || 'Car'
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
  }, [activeRows])

  // Construct instance knowledge graph from CSV rows (or isolated segment)
  const graphData = useMemo(() => {
    if (!activeRows || !activeRows.length) {
      return { nodes: [], edges: [], stats: { cameras: 0, locations: 0, types: 0, observations: 0, totalDatasetRows: 0 } }
    }

    const cameras = Array.from(new Set(activeRows.map((r) => r.camera).filter(Boolean)))
    const locations = Array.from(new Set(activeRows.map((r) => r.location || r.roadName).filter(Boolean)))
    const domains = Array.from(new Set(activeRows.map((r) => getCanonicalVehicleDomain(r.vehicleType || r.type)).filter(Boolean)))
    const types = domains

    const nodes = []
    const edges = []
    let edgeIndex = 1

    // 0. Segregated Compound Group Parent Nodes (when segregatedView is enabled)
    // Encapsulates all instances of each vehicle domain, cameras, and locations into clean, distinct bounding clusters
    if (segregatedView) {
      // Vehicle type clusters
      domains.forEach((domain) => {
        const meta = getVehicleMeta(domain)
        const typeRows = activeRows.filter((r) => getCanonicalVehicleDomain(r.vehicleType || r.type) === domain)
        nodes.push({
          id: `group-type-${domain}`,
          label: `${domain.toUpperCase()} DOMAIN · ${typeRows.length} RECORDS`,
          category: 'Group',
          vehicleType: domain,
          color: meta.bg || '#eff6ff',
          borderColor: meta.color || '#2563eb',
          isGroup: true,
          properties: {
            'Cluster Domain': `${domain} Domain`,
            'Total Vehicles': typeRows.length,
            'Assigned Color': meta.color,
          },
        })
      })


      // Surveillance Cameras cluster
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
          label: `MONITORED LOCATIONS · ${locations.length} ZONES`,
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
        borderColor: '#ffffff',
        icon: 'MapPin',
        parent: segregatedView ? 'group-locations' : undefined,
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
        color: '#475569',
        borderColor: '#ffffff',
        icon: 'Camera',
        parent: segregatedView ? 'group-cameras' : undefined,
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
          color: '#94a3b8',
        })
      }
    })

    // 3. Vehicle Type Domain Nodes
    domains.forEach((domain) => {
      const typeRows = activeRows.filter((r) => getCanonicalVehicleDomain(r.vehicleType || r.type) === domain)
      const vol = typeRows.reduce((sum, r) => sum + (r.volume || 1), 0)
      const meta = getVehicleMeta(domain)
      nodes.push({
        id: `type-${domain}`,
        label: domain,
        category: 'VehicleType',
        vehicleType: domain,
        color: meta.color,
        borderColor: '#ffffff',
        icon: domain,
        parent: segregatedView ? `group-type-${domain}` : undefined,
        properties: {
          'Vehicle Domain': domain,
          'Total Detections': typeRows.length,
          'Calculated Volume': vol,
        },
      })
    })

    // 4. Observation Nodes (each individual vehicle detection)
    // Vehicle nodes inherit the consistent domain color of their vehicle type (Car, Bike, Bus, etc.)
    const targetRows = recordLimit === 'ALL'
      ? activeRows
      : activeRows.slice(0, Math.min(Number(recordLimit) || activeRows.length, activeRows.length))

    targetRows.forEach((row, i) => {
      const obsId = row.observationId ? `obs-${row.observationId}` : `obs-${row.id || i + 1}`
      const obsLabel = (row.numberPlate && row.numberPlate !== 'N/A' && row.numberPlate !== 'Unknown')
        ? row.numberPlate
        : (row.observationId || row.id || `Record #${i + 1}`)
      const loc = row.location || row.roadName
      const domain = getCanonicalVehicleDomain(row.vehicleType || row.type)
      const meta = getVehicleMeta(domain)

      nodes.push({
        id: obsId,
        label: obsLabel,
        category: 'Observation',
        vehicleType: domain,
        color: meta.color, // All vehicles of this domain share this exact same color!
        borderColor: meta.border || '#ffffff',
        icon: meta.label,
        parent: segregatedView ? `group-type-${domain}` : undefined,
        properties: {
          'Observation ID': row.id || row.observationId || `OBS-${i + 1}`,
          'Vehicle Domain': domain,
          'Timestamp (IST)': row.timestampIst || row.timestamp || 'N/A',
          'Vehicle Type': domain,
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

      // Links: All links share the exact same uniform color (#94a3b8)
      edges.push({
        id: `edge-${edgeIndex++}`,
        source: obsId,
        target: `type-${domain}`,
        label: 'OF_TYPE',
        color: '#94a3b8',
      })

      if (row.camera && cameras.includes(row.camera)) {
        edges.push({
          id: `edge-${edgeIndex++}`,
          source: obsId,
          target: `cam-${row.camera}`,
          label: 'CAPTURED_BY',
          color: '#94a3b8',
        })
      }
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
        types: types.length,
        observations: targetRows.length,
        totalDatasetRows: activeRows.length,
      },
    }
  }, [activeRows, recordLimit, segregatedView])

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
        if (activeObsIds.has(e.source)) {
          connectedEntityIds.add(e.target)
        }
        if (activeObsIds.has(e.target)) {
          connectedEntityIds.add(e.source)
        }
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

  const layoutConfig = useMemo(() => {
    // Clustered Force (COSE) layout - segregates all types together into compound domain containers
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
      gravity: 0.015,
      numIter: 1000,
      coolingFactor: 0.95,
      stop: () => {
        cyRef.current?.animate({
          fit: { eles: cyRef.current.elements(), padding: 70 },
          duration: 300,
        })
      },
    }
  }, [segregatedView])

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
          borderColor: n.borderColor || '#ffffff',
          vehicleType: n.vehicleType || '',
          parent: n.parent || undefined,
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
              if (cat === 'Camera') return 48
              if (cat === 'VehicleType') return 54
              return 38
            },
            height: (node) => {
              const cat = node.data('category')
              if (cat === 'Location') return 60
              if (cat === 'Camera') return 48
              if (cat === 'VehicleType') return 54
              return 38
            },
            label: 'data(label)',
            'background-color': 'data(color)',
            color: '#0f172a',
            'font-size': (node) => (node.data('category') === 'Observation' ? 9.5 : 12),
            'font-weight': (node) => (node.data('category') === 'Observation' ? 600 : 700),
            'text-valign': 'bottom',
            'text-margin-y': 7,
            'text-wrap': 'wrap',
            'text-max-width': (node) => (node.data('category') === 'Observation' ? 85 : 120),
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
            'corner-radius': 16,
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
            padding: 26,
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
                <span className="kg-control-label">Grouping:</span>
                <button
                  className={`kg-segregation-toggle ${segregatedView ? 'active' : ''}`}
                  onClick={() => setSegregatedView(!segregatedView)}
                  title="Toggle segregated type clusters"
                  type="button"
                >
                  <Layers size={13} />
                  <span>{segregatedView ? 'Segregated by Type' : 'Free Network'}</span>
                </button>
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

          {/* Vehicle Domain Colors Legend & Quick-Filter Bar */}
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
                  <span>All Domains ({activeRows.length})</span>
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

          {/* Graph Canvas */}
          <div className="ontology-graph-wrapper">
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            <div className="ontology-layout-badge">
              <Network size={15} />
              <span>{segregatedView ? 'Segregated Type Clusters (COSE Compound Engine)' : 'Force Layout (COSE) · Cytoscape Engine'}</span>
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
                <span className="kg-badge" style={{ backgroundColor: selectedNode.color, color: '#ffffff' }}>
                  {selectedNode.category === 'Observation'
                    ? `${selectedNode.vehicleType || 'Vehicle'} · Detection`
                    : selectedNode.category}
                </span>
                <button className="ontology-details-close" onClick={() => setSelectedNode(null)} type="button">
                  <X size={16} />
                </button>
              </div>
              <h2>{selectedNode.label}</h2>
              <span className="kg-node-id">ID: {selectedNode.id}</span>
              {selectedNode.vehicleType && (
                <div style={{ marginTop: '8px' }}>
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
                    <Filter size={12} /> Show all {selectedNode.vehicleType}s
                  </button>
                </div>
              )}
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
