const path = require('path')
const XLSX = require('xlsx')

const sourcePath = path.resolve(__dirname, '../..', 'VisionIQ_NH44_Corridor_16_Combined_Dataset.xlsx')
const outputPath = path.resolve(__dirname, '../..', 'VisionIQ_NH44_Corridor_16_Backend_Ready.xlsx')
const incidentTypeById = new Map([
  ['INC-20261005-001', 'Multi-vehicle rear-end collision'],
  ['INC-20261005-002', 'Side-swipe collision'],
  ['INC-20261004-003', 'Truck and car collision'],
  ['INC-20261004-004', 'Single-vehicle loss-of-control crash'],
  ['INC-20261003-005', 'Intersection rear-end collision'],
  ['INC-20261002-006', 'Four-vehicle chain collision'],
  ['INC-20261005-007', 'Vehicle breakdown'],
  ['INC-20261003-008', 'Road debris hazard'],
])

function readRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Required source sheet missing: ${sheetName}`)
  return XLSX.utils.sheet_to_json(sheet, { defval: null })
}

function slug(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function corridorKey(value) {
  return String(value || '').trim().toUpperCase()
}

function plateKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function vehicleTypeKey(value) {
  const type = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (type === 'BIKE' || type === 'MOTORCYCLE') return 'MOTORCYCLE'
  if (type === 'AUTO' || type === 'AUTORICKSHAW') return 'AUTO'
  if (type === 'SUV' || type === 'VAN') return 'CAR'
  return type
}

function formatTimestamp(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (!date) return null
    return `${String(date.y).padStart(4, '0')}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')} ${String(date.H).padStart(2, '0')}:${String(date.M).padStart(2, '0')}:${String(date.S).padStart(2, '0')}`
  }
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`
  }
  return String(value).trim()
}

function resolveIncidentType(incident) {
  const sourceType = String(incident.incident_type || '').trim()
  if (sourceType && !/^(incident_type|unspecified(?:\s*\(source field missing\))?)$/i.test(sourceType)) return sourceType

  const correctedType = incidentTypeById.get(incident.incident_id)
  if (!correctedType) throw new Error(`Incident ${incident.incident_id} has no valid incident_type.`)
  return correctedType
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const radians = (degrees) => (degrees * Math.PI) / 180
  const latitudeDelta = radians(lat2 - lat1)
  const longitudeDelta = radians(lon2 - lon1)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function addForeignKeyCheck(errors, label, rows, key, knownIds) {
  rows.forEach((row, index) => {
    if (!knownIds.has(row[key])) errors.push(`${label} row ${index + 1} references missing ${key} "${row[key]}"`)
  })
}

function validateDataset(data) {
  const errors = []
  const ids = (rows, key) => new Set(rows.map((row) => row[key]))
  addForeignKeyCheck(errors, 'Zones', data.zones, 'corridor_id', ids(data.corridors, 'corridor_id'))
  addForeignKeyCheck(errors, 'Road_Segments', data.roadSegments, 'zone_id', ids(data.zones, 'zone_id'))
  addForeignKeyCheck(errors, 'Cameras', data.cameras, 'zone_id', ids(data.zones, 'zone_id'))
  addForeignKeyCheck(errors, 'Incidents', data.incidents, 'corridor_id', ids(data.corridors, 'corridor_id'))
  addForeignKeyCheck(errors, 'Incidents', data.incidents, 'zone_id', ids(data.zones, 'zone_id'))
  addForeignKeyCheck(errors, 'Incidents', data.incidents, 'road_segment_id', ids(data.roadSegments, 'road_segment_id'))
  addForeignKeyCheck(errors, 'Incidents', data.incidents, 'camera_id', ids(data.cameras, 'camera_id'))
  addForeignKeyCheck(errors, 'Incident_Vehicles', data.incidentVehicles, 'incident_id', ids(data.incidents, 'incident_id'))
  addForeignKeyCheck(errors, 'Incident_Vehicles', data.incidentVehicles, 'vehicle_id', ids(data.vehicles, 'vehicle_id'))
  addForeignKeyCheck(errors, 'Impact_Analysis', data.impactAnalysis, 'incident_id', ids(data.incidents, 'incident_id'))
  addForeignKeyCheck(errors, 'Impact_Analysis', data.impactAnalysis, 'road_segment_id', ids(data.roadSegments, 'road_segment_id'))
  addForeignKeyCheck(errors, 'Traffic_Flow', data.trafficFlow, 'road_segment_id', ids(data.roadSegments, 'road_segment_id'))
  addForeignKeyCheck(errors, 'Traffic_Flow', data.trafficFlow, 'camera_id', ids(data.cameras, 'camera_id'))
  addForeignKeyCheck(errors, 'Risk_Profiles', data.riskProfiles, 'incident_id', ids(data.incidents, 'incident_id'))
  addForeignKeyCheck(errors, 'Risk_Profiles', data.riskProfiles, 'road_segment_id', ids(data.roadSegments, 'road_segment_id'))
  addForeignKeyCheck(errors, 'Vehicle_Detections', data.detections, 'camera_id', ids(data.cameras, 'camera_id'))
  addForeignKeyCheck(errors, 'Vehicle_Detections', data.detections, 'zone_id', ids(data.zones, 'zone_id'))
  addForeignKeyCheck(errors, 'Vehicle_Detections', data.detections, 'road_segment_id', ids(data.roadSegments, 'road_segment_id'))
  addForeignKeyCheck(errors, 'Vehicle_Detections', data.detections, 'vehicle_id', ids(data.vehicles, 'vehicle_id'))

  const checkUnique = (label, rows, key) => {
    const values = rows.map((row) => row[key])
    if (new Set(values).size !== values.length) errors.push(`${label}.${key} contains duplicate values`)
  }
  checkUnique('Corridors', data.corridors, 'corridor_id')
  checkUnique('Zones', data.zones, 'zone_id')
  checkUnique('Road_Segments', data.roadSegments, 'road_segment_id')
  checkUnique('Cameras', data.cameras, 'camera_id')
  checkUnique('Vehicles', data.vehicles, 'vehicle_id')
  checkUnique('Vehicles', data.vehicles, 'plate_number')
  checkUnique('Incidents', data.incidents, 'incident_id')
  checkUnique('Impact_Analysis', data.impactAnalysis, 'impact_id')
  checkUnique('Risk_Profiles', data.riskProfiles, 'risk_profile_id')
  checkUnique('Traffic_Flow', data.trafficFlow, 'observation_id')
  checkUnique('Vehicle_Detections', data.detections, 'detection_id')

  const detectionsByCamera = new Map()
  data.detections.forEach((row) => detectionsByCamera.set(row.camera_id, (detectionsByCamera.get(row.camera_id) || 0) + 1))
  const camerasWithoutDetections = data.cameras.filter((camera) => !detectionsByCamera.has(camera.camera_id))
  if (camerasWithoutDetections.length) {
    errors.push(`Cameras without vehicle detections: ${camerasWithoutDetections.map((camera) => camera.camera_id).join(', ')}`)
  }

  const nodeIds = new Set([
    ...data.corridors.map((row) => row.corridor_id),
    ...data.zones.map((row) => row.zone_id),
    ...data.roadSegments.map((row) => row.road_segment_id),
    ...data.cameras.map((row) => row.camera_id),
    ...data.vehicles.map((row) => row.vehicle_id),
    ...data.incidents.map((row) => row.incident_id),
    ...data.impactAnalysis.map((row) => row.impact_id),
    ...data.riskProfiles.map((row) => row.risk_profile_id),
  ])
  data.graphEdges.forEach((edge) => {
    if (!nodeIds.has(edge.source_id)) errors.push(`Graph edge ${edge.graph_edge_id} has unknown source "${edge.source_id}"`)
    if (!nodeIds.has(edge.target_id)) errors.push(`Graph edge ${edge.graph_edge_id} has unknown target "${edge.target_id}"`)
  })

  if (!errors.length && nodeIds.size) {
    const adjacency = new Map()
    data.graphEdges.forEach((edge) => {
      const sourceNeighbors = adjacency.get(edge.source_id) || []
      sourceNeighbors.push(edge.target_id)
      adjacency.set(edge.source_id, sourceNeighbors)
      const targetNeighbors = adjacency.get(edge.target_id) || []
      targetNeighbors.push(edge.source_id)
      adjacency.set(edge.target_id, targetNeighbors)
    })
    const startId = data.corridors[0]?.corridor_id
    const reached = new Set(startId ? [startId] : [])
    const pending = [...reached]
    while (pending.length) {
      const current = pending.pop()
      for (const neighbor of adjacency.get(current) || []) {
        if (reached.has(neighbor)) continue
        reached.add(neighbor)
        pending.push(neighbor)
      }
    }
    const disconnected = [...nodeIds].filter((id) => !reached.has(id))
    if (disconnected.length) errors.push(`Knowledge graph has ${disconnected.length} disconnected entities; examples: ${disconnected.slice(0, 10).join(', ')}`)
  }

  if (errors.length) throw new Error(`Dataset validation failed:\n- ${errors.join('\n- ')}`)
}

function prepareWorkbook() {
  const sourceWorkbook = XLSX.readFile(sourcePath)
  const sourceSheets = Object.fromEntries(sourceWorkbook.SheetNames.map((name) => [name, sourceWorkbook.Sheets[name]]))
  const hierarchy = readRows(sourceWorkbook, 'Corridor_Hierarchy')
  const corridorKpis = readRows(sourceWorkbook, 'Corridor_KPIs')
  const cameraCatalog = readRows(sourceWorkbook, 'Corridor_Cameras')
  const sourceDetections = readRows(sourceWorkbook, 'Vehicle_Detections')
  const sourceIncidents = readRows(sourceWorkbook, 'Incidents_Expanded')
  const sourceIncidentVehicles = readRows(sourceWorkbook, 'Incident_Vehicles_Expanded')
  const sourceImpact = readRows(sourceWorkbook, 'Impact_Analysis_Expanded')
  const sourceRisk = readRows(sourceWorkbook, 'Risk_Profiles_Expanded')
  const sourceFlow = readRows(sourceWorkbook, 'Traffic_Flow_Expanded')
  const originalIncidents = readRows(sourceWorkbook, 'Incidents_Original')
  const originalZones = readRows(sourceWorkbook, 'Zones')
  const originalSegments = readRows(sourceWorkbook, 'Road_Segments')
  const originalCameras = readRows(sourceWorkbook, 'Cameras')
  const originalCorridors = readRows(sourceWorkbook, 'Corridors')

  const extendedCorridors = hierarchy.map((row) => ({
    corridor_id: row.corridor_id,
    corridor_name: row.corridor_name,
    route: row.route,
    length_km: null,
    status: row.status || 'Active',
    corridor_order: row.corridor_order,
    highway: row.highway,
    start_location: row.start_location,
    end_location: row.end_location,
    key_locations: row.key_locations,
  }))
  const corridors = [
    ...originalCorridors.map((row) => ({
      ...row,
      corridor_order: null,
      highway: null,
      start_location: null,
      end_location: null,
      key_locations: null,
    })),
    ...extendedCorridors,
  ]
  const corridorIds = new Set(corridors.map((row) => corridorKey(row.corridor_id)))
  const extendedCamerasByCorridor = new Map()
  cameraCatalog.forEach((camera) => {
    const key = corridorKey(camera.corridor_id)
    if (!corridorIds.has(key)) throw new Error(`Camera ${camera.camera_id} references unknown corridor ${camera.corridor_id}`)
    const group = extendedCamerasByCorridor.get(key) || []
    group.push(camera)
    extendedCamerasByCorridor.set(key, group)
  })

  const zones = [...originalZones]
  const segments = [...originalSegments]
  const cameras = [...originalCameras]
  const zoneForCamera = new Map()
  const segmentForCamera = new Map()
  const corridorZoneIds = new Map()
  const corridorSegmentIds = new Map()

  for (const corridor of hierarchy) {
    const cKey = corridorKey(corridor.corridor_id)
    const catalog = extendedCamerasByCorridor.get(cKey) || []
    if (!catalog.length) throw new Error(`No camera assignments found for ${corridor.corridor_id}`)

    const zonesByLocation = new Map()
    catalog.forEach((camera) => {
      const location = String(camera.location || corridor.start_location || corridor.corridor_name).trim()
      if (!zonesByLocation.has(location)) {
        const zoneId = `ZONE-${slug(corridor.corridor_id)}-${slug(location)}`
        zonesByLocation.set(location, { zone_id: zoneId, corridor_id: corridor.corridor_id, zone_name: location, km_marker: null, latitude: null, longitude: null, cameraCoordinates: [] })
      }
      if (camera.latitude != null && camera.longitude != null) {
        zonesByLocation.get(location).cameraCoordinates.push([Number(camera.latitude), Number(camera.longitude)])
      }
    })

    for (const zone of zonesByLocation.values()) {
      if (zone.cameraCoordinates.length) {
        zone.latitude = zone.cameraCoordinates.reduce((sum, coords) => sum + coords[0], 0) / zone.cameraCoordinates.length
        zone.longitude = zone.cameraCoordinates.reduce((sum, coords) => sum + coords[1], 0) / zone.cameraCoordinates.length
      }
      delete zone.cameraCoordinates
      zones.push(zone)
      corridorZoneIds.set(cKey, [...(corridorZoneIds.get(cKey) || []), zone.zone_id])
    }

    for (const camera of catalog) {
      const zone = zonesByLocation.get(String(camera.location || corridor.start_location || corridor.corridor_name).trim())
      const segmentId = `SEG-${slug(corridor.corridor_id)}-${slug(camera.road_segment || camera.camera_id)}-${slug(camera.location)}`
      if (!segments.some((row) => row.road_segment_id === segmentId)) {
        segments.push({
          road_segment_id: segmentId,
          zone_id: zone.zone_id,
          segment_name: camera.road_segment || `${camera.location} road segment`,
          km_start: null,
          km_end: null,
          lanes: null,
          speed_limit_kmh: null,
        })
        corridorSegmentIds.set(cKey, [...(corridorSegmentIds.get(cKey) || []), segmentId])
      }
      const cameraId = String(camera.camera_id)
      cameras.push({
        camera_id: cameraId,
        zone_id: zone.zone_id,
        camera_name: `${camera.camera_id} - ${camera.location}`,
        latitude: camera.latitude,
        longitude: camera.longitude,
        status: camera.status || 'Active',
      })
      zoneForCamera.set(cameraId, zone.zone_id)
      segmentForCamera.set(cameraId, segmentId)
    }
  }

  const sourceToPreparedCamera = (corridorId, latitude, longitude) => {
    const catalog = extendedCamerasByCorridor.get(corridorKey(corridorId))
    if (!catalog?.length) throw new Error(`No assigned cameras for ${corridorId}`)
    const incidentLatitude = Number(latitude)
    const incidentLongitude = Number(longitude)
    if (!Number.isFinite(incidentLatitude) || !Number.isFinite(incidentLongitude)) {
      throw new Error(`Incident in ${corridorId} has no valid coordinates for location assignment.`)
    }
    const camera = catalog.reduce((nearest, candidate) => {
      const distance = distanceKm(incidentLatitude, incidentLongitude, Number(candidate.latitude), Number(candidate.longitude))
      return !nearest || distance < nearest.distance
        ? { camera: candidate, distance }
        : nearest
    }, null).camera
    return {
      camera_id: String(camera.camera_id),
      zone_id: zoneForCamera.get(String(camera.camera_id)),
      road_segment_id: segmentForCamera.get(String(camera.camera_id)),
    }
  }

  const originalIncidentIds = new Set(originalIncidents.map((row) => row.incident_id))
  const incidentMap = new Map()
  const incidents = originalIncidents.map((row) => {
    const mapped = { ...row }
    incidentMap.set(mapped.incident_id, { corridor_id: mapped.corridor_id, zone_id: mapped.zone_id, road_segment_id: mapped.road_segment_id, camera_id: mapped.camera_id })
    return mapped
  })
  sourceIncidents.filter((row) => !originalIncidentIds.has(row.incident_id)).forEach((row) => {
    const relation = sourceToPreparedCamera(row.corridor_id, row.latitude, row.longitude)
    const mapped = {
      incident_id: row.incident_id,
      incident_type: row.incident_type,
      occurred_at_ist: formatTimestamp(row.occurred_at_ist),
      corridor_id: row.corridor_id,
      zone_id: relation.zone_id,
      road_segment_id: relation.road_segment_id,
      camera_id: relation.camera_id,
      latitude: row.latitude,
      longitude: row.longitude,
      severity: row.severity,
      status: row.status,
      lanes_blocked: row.lanes_blocked,
      description: row.description,
    }
    incidents.push(mapped)
    incidentMap.set(mapped.incident_id, { corridor_id: mapped.corridor_id, zone_id: mapped.zone_id, road_segment_id: mapped.road_segment_id, camera_id: mapped.camera_id })
  })

  const sourcePlateByKey = new Map()
  const sourceVehiclesByType = new Map()
  sourceDetections.forEach((row) => {
    const key = plateKey(row.plate_number)
    if (!key) throw new Error(`Source detection ${row.detection_id} has no vehicle plate.`)
    if (!sourcePlateByKey.has(key)) sourcePlateByKey.set(key, String(row.plate_number).trim())
    const type = vehicleTypeKey(row.vehicle_type)
    const candidates = sourceVehiclesByType.get(type) || new Map()
    if (!candidates.has(key)) {
      candidates.set(key, {
        plateNumber: String(row.plate_number).trim(),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      })
    }
    sourceVehiclesByType.set(type, candidates)
  })

  const vehiclesByPlate = new Map()
  const vehicles = []
  const addVehicle = (plate, vehicleType, vehicleColor, sourceVehicleId) => {
    const key = plateKey(plate) || `UNKNOWN-${sourceVehicleId || vehicles.length + 1}`
    if (!vehiclesByPlate.has(key)) {
      const vehicleId = `VEH-${String(vehicles.length + 1).padStart(6, '0')}`
      const plateNumber = sourcePlateByKey.get(key) || (plateKey(plate) ? String(plate).trim() : `UNREGISTERED-${String(vehicles.length + 1).padStart(6, '0')}`)
      vehiclesByPlate.set(key, vehicleId)
      vehicles.push({
        vehicle_id: vehicleId,
        plate_number: plateNumber,
        plate_is_synthetic: sourcePlateByKey.has(key) ? 'No' : 'Yes',
        vehicle_type: vehicleType || null,
        vehicle_color: vehicleColor || null,
      })
    }
    return vehiclesByPlate.get(key)
  }

  sourceDetections.forEach((row) => addVehicle(row.plate_number, row.vehicle_type, null, row.detection_id))

  const incidentVehicles = []
  const seenIncidentVehicles = new Set()
  const incidentById = new Map(incidents.map((incident) => [incident.incident_id, incident]))
  const incidentPlateKeys = new Map()
  sourceIncidentVehicles.forEach((row) => {
    const sourcePlateKey = plateKey(row.plate_number)
    let plateNumber = sourcePlateByKey.get(sourcePlateKey)
    if (!plateNumber) {
      const incident = incidentById.get(row.incident_id)
      if (!incident) throw new Error(`Incident vehicle references unknown incident ${row.incident_id}.`)
      const type = vehicleTypeKey(row.vehicle_type)
      const candidates = [...(sourceVehiclesByType.get(type)?.values() || [])]
        .filter((candidate) => !incidentPlateKeys.get(row.incident_id)?.has(plateKey(candidate.plateNumber)))
        .map((candidate) => ({
          ...candidate,
          distance: Number.isFinite(Number(incident.latitude)) && Number.isFinite(Number(incident.longitude))
            ? distanceKm(Number(incident.latitude), Number(incident.longitude), candidate.latitude, candidate.longitude)
            : Number.POSITIVE_INFINITY,
        }))
        .sort((left, right) => left.distance - right.distance)
      if (!candidates.length) throw new Error(`No source vehicle plate matches ${row.vehicle_type} for incident ${row.incident_id}.`)
      plateNumber = candidates[0].plateNumber
    }

    const usedPlateKeys = incidentPlateKeys.get(row.incident_id) || new Set()
    usedPlateKeys.add(plateKey(plateNumber))
    incidentPlateKeys.set(row.incident_id, usedPlateKeys)
    const vehicleId = addVehicle(plateNumber, row.vehicle_type, null, row.vehicle_id)
    const uniqueKey = `${row.incident_id}|${vehicleId}`
    if (seenIncidentVehicles.has(uniqueKey)) return
    seenIncidentVehicles.add(uniqueKey)
    incidentVehicles.push({
      incident_id: row.incident_id,
      vehicle_id: vehicleId,
      plate_number: plateNumber,
      vehicle_type: row.vehicle_type,
      involvement_role: row.involvement_role,
      plate_confidence: row.plate_confidence,
      detected_at_ist: formatTimestamp(row.detected_at_ist),
      evidence_reference: row.evidence_reference,
    })
  })

  const impactByIncident = new Map(sourceImpact.map((row) => [row.incident_id, row]))
  const riskByIncident = new Map(sourceRisk.map((row) => [row.incident_id, row]))
  const impactAnalysis = incidents.map((incident) => {
    const row = impactByIncident.get(incident.incident_id)
    if (!row) throw new Error(`Impact analysis missing for ${incident.incident_id}`)
    return {
      impact_id: row.impact_id,
      incident_id: row.incident_id,
      road_segment_id: incident.road_segment_id,
      estimated_delay_min: row.estimated_delay_min,
      max_queue_km: row.max_queue_km,
      traffic_flow_reduction_pct: row.traffic_flow_reduction_pct,
      affected_lanes: row.affected_lanes,
      estimated_clearance_min: row.estimated_clearance_min,
      diversion_recommended: row.diversion_recommended,
    }
  })
  const riskProfiles = incidents.map((incident) => {
    const row = riskByIncident.get(incident.incident_id)
    if (!row) throw new Error(`Risk profile missing for ${incident.incident_id}`)
    return {
      risk_profile_id: row.risk_profile_id,
      incident_id: row.incident_id,
      road_segment_id: incident.road_segment_id,
      risk_score_0_100: row.risk_score_0_100,
      risk_category: row.risk_category,
      contributing_factors: row.contributing_factors,
      recommended_action: row.recommended_action,
      assessed_at_ist: formatTimestamp(row.assessed_at_ist),
    }
  })

  const trafficFlow = sourceFlow.map((row) => ({
    observation_id: row.observation_id,
    observed_at_ist: formatTimestamp(row.observed_at_ist),
    road_segment_id: row.road_segment_id,
    camera_id: row.camera_id,
    vehicles_per_5_min: row.vehicles_per_5_min,
    average_speed_kmh: row.average_speed_kmh,
    occupancy_pct: row.occupancy_pct,
    flow_state: row.flow_state,
  }))

  const detections = sourceDetections.map((row) => {
    const relation = sourceToPreparedCamera(row.corridor_id, row.latitude, row.longitude)
    return {
      ...row,
      timestamp_ist: formatTimestamp(row.timestamp_ist),
      source_camera_id: row.camera_id,
      source_zone_id: row.zone_id,
      source_road_segment_id: row.road_segment_id,
      camera_id: relation.camera_id,
      zone_id: relation.zone_id,
      road_segment_id: relation.road_segment_id,
      vehicle_id: addVehicle(row.plate_number, row.vehicle_type, null, row.detection_id),
    }
  })

  const legacyCameraCoverage = originalCameras.map((camera) => {
    const zoneName = zones.find((zone) => zone.zone_id === camera.zone_id)?.zone_name || camera.camera_name
    const station = String(zoneName).toLowerCase().match(/[a-z]+/)?.[0]
    const sourceDetection = sourceDetections.find((row) => row.zone_id === camera.zone_id)
      || sourceDetections.find((row) => {
        const corridorText = `${row.corridor_name || ''} ${row.corridor_start || ''} ${row.corridor_end || ''} ${row.corridor_stop || ''}`.toLowerCase()
        return station && corridorText.includes(station)
      })
    if (!sourceDetection) {
      throw new Error(`No source vehicle found for legacy camera ${camera.camera_id}`)
    }

    const segment = originalSegments.find((row) => row.zone_id === camera.zone_id)
    if (!segment) throw new Error(`No road segment found for legacy camera ${camera.camera_id}`)

    return {
      ...sourceDetection,
      detection_id: `DEMO-CAM-${slug(camera.camera_id)}`,
      source_id: null,
      camera_id: camera.camera_id,
      zone_id: camera.zone_id,
      road_segment_id: segment.road_segment_id,
      source_camera_id: sourceDetection.camera_id,
      source_zone_id: sourceDetection.zone_id,
      source_road_segment_id: sourceDetection.road_segment_id,
      vehicle_id: addVehicle(sourceDetection.plate_number, sourceDetection.vehicle_type, null, sourceDetection.detection_id),
      timestamp_ist: formatTimestamp(sourceDetection.timestamp_ist),
      data_source: 'SYNTHETIC_CAMERA_COVERAGE',
      event: `${sourceDetection.event || 'Vehicle detected'} (demo camera coverage)`,
    }
  })
  const allDetections = [...detections, ...legacyCameraCoverage]

  let correctedIncidentTypeCount = 0
  incidents.forEach((incident) => {
    const resolvedType = resolveIncidentType(incident)
    if (resolvedType !== String(incident.incident_type || '').trim()) correctedIncidentTypeCount += 1
    incident.incident_type = resolvedType
  })

  const graphEdges = []
  let edgeIndex = 1
  const addEdge = (sourceType, sourceId, relationship, targetType, targetId) => {
    graphEdges.push({
      graph_edge_id: `EDGE-${String(edgeIndex++).padStart(5, '0')}`,
      source_type: sourceType,
      source_id: sourceId,
      relationship,
      target_type: targetType,
      target_id: targetId,
    })
  }

  zones.forEach((zone) => addEdge('Corridor', zone.corridor_id, 'CONTAINS', 'Zone', zone.zone_id))
  segments.forEach((segment) => addEdge('Zone', segment.zone_id, 'CONTAINS', 'RoadSegment', segment.road_segment_id))
  cameras.forEach((camera) => addEdge('Zone', camera.zone_id, 'MONITORED_BY', 'Camera', camera.camera_id))
  allDetections.forEach((row) => {
    addEdge('Camera', row.camera_id, 'OBSERVED', 'Vehicle', row.vehicle_id)
  })
  incidents.forEach((incident) => {
    addEdge('Camera', incident.camera_id, 'DETECTED', 'Incident', incident.incident_id)
    addEdge('Incident', incident.incident_id, 'OCCURRED_ON', 'RoadSegment', incident.road_segment_id)
  })
  incidentVehicles.forEach((link) => addEdge('Incident', link.incident_id, 'INVOLVES', 'Vehicle', link.vehicle_id))
  impactAnalysis.forEach((row) => addEdge('Incident', row.incident_id, 'GENERATES_IMPACT', 'ImpactAnalysis', row.impact_id))
  riskProfiles.forEach((row) => addEdge('Incident', row.incident_id, 'HAS_RISK_PROFILE', 'RiskProfile', row.risk_profile_id))

  const orderedCorridors = [...extendedCorridors].sort((a, b) => {
    const orderA = hierarchy.find((row) => row.corridor_id === a.corridor_id)?.corridor_order || 0
    const orderB = hierarchy.find((row) => row.corridor_id === b.corridor_id)?.corridor_order || 0
    return orderA - orderB
  })
  addEdge('Corridor', originalCorridors[0].corridor_id, 'CONTINUES_TO', 'Corridor', orderedCorridors[0].corridor_id)
  orderedCorridors.slice(1).forEach((corridor, index) => {
    addEdge('Corridor', orderedCorridors[index].corridor_id, 'CONTINUES_TO', 'Corridor', corridor.corridor_id)
  })

  const vehicleEvents = detections.map((row, index) => ({
    'Record ID': `NH44-${String(index + 1).padStart(5, '0')}`,
    'Timestamp (IST)': row.timestamp_ist,
    'Vehicle Type': row.vehicle_type,
    'Vehicle Number Plate': row.plate_number,
    'Plate Confidence': row.plate_confidence,
    'Speed (km/h)': row.speed_kmh,
    'Speed Limit (km/h)': row.speed_limit_kmh,
    'Over Speed': row.overspeed,
    Latitude: row.latitude,
    Longitude: row.longitude,
    'Vehicle Image Path': row.vehicle_image_path,
    Events: row.event,
  }))

  const data = {
    corridors,
    zones,
    roadSegments: segments,
    cameras,
    vehicles,
    incidents,
    incidentVehicles,
    impactAnalysis,
    trafficFlow,
    riskProfiles,
    detections: allDetections,
    graphEdges,
  }
  if (vehicles.some((row) => /^DEMO[-_]/i.test(row.plate_number))) throw new Error('Prepared vehicle list still contains a DEMO plate.')
  if (incidentVehicles.some((row) => /^DEMO[-_]/i.test(row.plate_number))) throw new Error('Prepared incident links still contain a DEMO plate.')
  if (allDetections.some((row) => /^DEMO[-_]/i.test(row.plate_number))) throw new Error('Prepared vehicle detections still contain a DEMO plate.')
  validateDataset(data)

  const outputWorkbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(vehicleEvents), 'Vehicle_Events')
  for (const name of sourceWorkbook.SheetNames) {
    if (['Corridors', 'Corridor_KPIs', 'Zones', 'Road_Segments', 'Cameras', 'Vehicles', 'Knowledge_Graph', 'Vehicle_Detections'].includes(name)) continue
    XLSX.utils.book_append_sheet(outputWorkbook, sourceSheets[name], name)
  }
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(corridors), 'Corridors')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(corridorKpis), 'Corridor_KPIs')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(zones), 'Zones')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(segments), 'Road_Segments')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(cameras), 'Cameras')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(vehicles), 'Vehicles')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(incidents), 'Incidents')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(incidentVehicles), 'Incident_Vehicles')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(impactAnalysis), 'Impact_Analysis')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(trafficFlow), 'Traffic_Flow')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(riskProfiles), 'Risk_Profiles')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(graphEdges), 'Knowledge_Graph')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(allDetections), 'Vehicle_Detections')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(sourceDetections), 'Vehicle_Detections_Source')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(readRows(sourceWorkbook, 'Knowledge_Graph')), 'Knowledge_Graph_Source')
  XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet([
    { Check: 'Corridors', Result: corridors.length, Notes: 'Includes 16 demo corridors and the original NH-44 corridor.' },
    { Check: 'Cameras', Result: cameras.length, Notes: 'Includes 64 corridor cameras plus the original six network cameras.' },
    { Check: 'Vehicle detections', Result: allDetections.length, Notes: `${detections.length} source detections are distributed across their corridor cameras, with ${legacyCameraCoverage.length} clearly marked demo coverage observations for legacy cameras.` },
    { Check: 'Incidents', Result: incidents.length, Notes: 'Original incidents retained; synthetic incidents are mapped to corridor cameras.' },
    { Check: 'Knowledge graph edges', Result: graphEdges.length, Notes: 'Relationships are rebuilt against normalized entity IDs and corridor order.' },
    { Check: 'Corrected incident types', Result: correctedIncidentTypeCount, Notes: 'Known malformed source incident types were restored to descriptive labels.' },
    { Check: 'Synthetic data notice', Result: 'Demo only', Notes: 'Corridor assignments and generated relationships are synthetic demonstration mappings, not verified live infrastructure data.' },
  ]), 'Backend_Import_Notes')

  XLSX.writeFile(outputWorkbook, outputPath)
  console.log(`Prepared ${path.basename(outputPath)}`)
  console.log(`Rows: ${JSON.stringify(Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])))}`)
}

try {
  prepareWorkbook()
} catch (error) {
  console.error(`Unable to prepare backend-ready dataset: ${error.message}`)
  process.exitCode = 1
}
