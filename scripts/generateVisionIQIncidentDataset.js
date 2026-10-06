import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const corridorId = 'COR-NH44'
const outputPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'VisionIQ_NH44_Incident_Dataset.xlsx')
const guide = [
	{ Item: 'Purpose', Details: 'Synthetic NH-44 traffic, incidents, impact, and knowledge-graph sample for VisionIQ.' },
	{ Item: 'Synthetic data', Details: 'All events and DEMO-TS09 plate values are fictional examples, not real registration records.' },
	{ Item: 'Find accident plates', Details: 'Filter Incidents by incident_id, then match it in Incident_Vehicles to see involved plate numbers.' },
	{ Item: 'Join keys', Details: 'incident_id, vehicle_id, corridor_id, zone_id, road_segment_id, camera_id, impact_id.' },
	{ Item: 'Timezone', Details: 'All timestamps are local Asia/Kolkata time (IST).' },
]

const corridors = [{ corridor_id: corridorId, corridor_name: 'NH-44 Hyderabad North-South Corridor', route: 'Medchal to Jadcherla', length_km: 110, status: 'Active' }]
const zoneSeed = [
	['MEDCHAL', 'Medchal North Gateway', 36, 17.6297, 78.4815, 'CAM-NH44-04-MEDCHAL', 'Medchal North Gateway'],
	['RINGROAD', 'Hyderabad Ring Corridor', 24, 17.5180, 78.4875, 'CAM-NH44-03-RINGROAD', 'Hyderabad Ring Corridor'],
	['ARAMGHAR', 'Aramghar Toll Interchange', 8, 17.3210, 78.4415, 'CAM-NH44-06-TOLLPLAZA', 'Aramghar Express Toll Plaza'],
	['SHAMSHABAD', 'Shamshabad Airport Express', 18, 17.2510, 78.4285, 'CAM-NH44-01-SHAMSHABAD', 'Shamshabad Tollway'],
	['SHADNAGAR', 'Shadnagar South Bypass', 52, 17.0720, 78.2090, 'CAM-NH44-02-SHADNAGAR', 'Shadnagar Interchange'],
	['JADCHERLA', 'Jadcherla Terminal Gateway', 84, 16.7650, 78.1400, 'CAM-NH44-05-JADCHERLA', 'Jadcherla Express Point'],
]
const zones = zoneSeed.map(([key, zone_name, km_marker, latitude, longitude]) => ({ zone_id: `ZONE-${key}`, corridor_id: corridorId, zone_name, km_marker, latitude, longitude }))
const cameras = zoneSeed.map(([key, , , latitude, longitude, camera_id, camera_name]) => ({ camera_id, zone_id: `ZONE-${key}`, camera_name, latitude, longitude, status: 'Active' }))
const segmentRanges = [[34, 39, 3, 60], [22, 27, 3, 80], [6, 10, 3, 60], [16, 20, 3, 80], [50, 55, 2, 80], [82, 87, 2, 80]]
const roadSegments = zoneSeed.map(([key, name], index) => ({ road_segment_id: `SEG-${key}-01`, zone_id: `ZONE-${key}`, segment_name: `${name} section`, km_start: segmentRanges[index][0], km_end: segmentRanges[index][1], lanes: segmentRanges[index][2], speed_limit_kmh: segmentRanges[index][3] }))

const vehicleSeed = [
	['CAR', 'Silver sedan'], ['SUV', 'Blue SUV'], ['BIKE', 'Black motorcycle'], ['TRUCK', 'White goods truck'], ['CAR', 'Red hatchback'],
	['BUS', 'Blue bus'], ['VAN', 'White delivery van'], ['CAR', 'Grey sedan'], ['AUTO', 'Yellow auto-rickshaw'], ['TRUCK', 'Green lorry'],
	['CAR', 'White sedan'], ['BIKE', 'Black motorcycle'], ['SUV', 'Black SUV'], ['CAR', 'Silver hatchback'], ['TRUCK', 'Blue goods truck'],
]
const vehicles = vehicleSeed.map(([vehicle_type, vehicle_color], index) => {
	const number = String(index + 1).padStart(4, '0')
	return { vehicle_id: `VEH-${number}`, plate_number: `DEMO-TS09-${number}`, plate_is_synthetic: 'Yes', vehicle_type, vehicle_color }
})

const incidentSeed = [
	['20261005-001', 'Multi-vehicle rear-end collision', '2026-10-05 08:12:00', 3, 17.2514, 78.4289, 'High', 'Cleared', 2, 'Three vehicles collided in slow airport-bound traffic.'],
	['20261005-002', 'Side-swipe collision', '2026-10-05 07:42:00', 0, 17.6302, 78.4819, 'Medium', 'Under Review', 1, 'A car and motorcycle made contact while merging.'],
	['20261004-003', 'Truck and car collision', '2026-10-04 18:20:00', 1, 17.5184, 78.4879, 'High', 'Cleared', 2, 'A truck struck two cars near the interchange queue.'],
	['20261004-004', 'Single-vehicle loss-of-control crash', '2026-10-04 13:05:00', 2, 17.3214, 78.4419, 'Medium', 'Cleared', 1, 'A vehicle left its lane near the toll approach.'],
	['20261003-005', 'Intersection rear-end collision', '2026-10-03 09:16:00', 4, 17.0724, 78.2094, 'High', 'Cleared', 1, 'Two vehicles collided approaching the south bypass junction.'],
	['20261002-006', 'Four-vehicle chain collision', '2026-10-02 21:10:00', 5, 16.7654, 78.1404, 'Critical', 'Cleared', 2, 'A chain collision formed in a braking queue before the toll plaza.'],
	['20261005-007', 'Vehicle breakdown', '2026-10-05 06:30:00', 1, 17.5176, 78.4871, 'Low', 'Responding', 1, 'A van stopped on the shoulder; no collision reported.'],
	['20261003-008', 'Road debris hazard', '2026-10-03 16:40:00', 3, 17.2507, 78.4282, 'Low', 'Cleared', 1, 'Debris was reported in one lane; no vehicle was identified.'],
]
const incidents = incidentSeed.map(([suffix, incident_type, occurred_at_ist, zoneIndex, latitude, longitude, severity, status, lanes_blocked, description]) => ({
	incident_id: `INC-${suffix}`, incident_type, occurred_at_ist, corridor_id: corridorId,
	zone_id: zones[zoneIndex].zone_id, road_segment_id: roadSegments[zoneIndex].road_segment_id,
	camera_id: cameras[zoneIndex].camera_id, latitude, longitude, severity, status, lanes_blocked, description,
}))

const incidentVehicleSeed = [
	['001', 1, 'Lead vehicle', 0.98], ['001', 2, 'Following vehicle', 0.96], ['001', 3, 'Third vehicle', 0.93],
	['002', 4, 'Merging vehicle', 0.95], ['002', 5, 'Adjacent vehicle', 0.91],
	['003', 6, 'Truck', 0.97], ['003', 7, 'Car A', 0.94], ['003', 8, 'Car B', 0.92],
	['004', 9, 'Single involved vehicle', 0.96], ['005', 10, 'Following vehicle', 0.95], ['005', 11, 'Lead vehicle', 0.97],
	['006', 12, 'Vehicle 1', 0.92], ['006', 13, 'Vehicle 2', 0.96], ['006', 14, 'Vehicle 3', 0.94], ['006', 15, 'Vehicle 4', 0.91],
	['007', 7, 'Disabled vehicle', 0.95],
]
const incidentVehicles = incidentVehicleSeed.map(([incidentSuffix, vehicleIndex, involvement_role, plate_confidence]) => {
	const incident_id = `INC-202610${incidentSuffix === '001' || incidentSuffix === '002' || incidentSuffix === '007' ? '05' : incidentSuffix === '003' || incidentSuffix === '004' ? '04' : incidentSuffix === '005' || incidentSuffix === '008' ? '03' : '02'}-${incidentSuffix.slice(-3)}`
	const vehicle = vehicles[vehicleIndex - 1]
	const incident = incidents.find((item) => item.incident_id === incident_id)
	return { incident_id, vehicle_id: vehicle.vehicle_id, plate_number: vehicle.plate_number, vehicle_type: vehicle.vehicle_type, involvement_role, plate_confidence, detected_at_ist: incident.occurred_at_ist, evidence_reference: `SYNTHETIC/${incident_id}/${vehicle.vehicle_id}` }
})

const impactValues = [[18, 1.8, 42, 2, 35], [9, 0.8, 24, 1, 22], [26, 2.4, 51, 2, 48], [12, 0.9, 29, 1, 30], [21, 1.6, 38, 1, 40], [39, 3.7, 68, 2, 75], [6, 0.5, 14, 1, 18], [4, 0.3, 9, 1, 12]]
const impactAnalysis = incidents.map((incident, index) => {
	const [estimated_delay_min, max_queue_km, traffic_flow_reduction_pct, affected_lanes, estimated_clearance_min] = impactValues[index]
	return { impact_id: `IMPACT-${String(index + 1).padStart(3, '0')}`, incident_id: incident.incident_id, road_segment_id: incident.road_segment_id, estimated_delay_min, max_queue_km, traffic_flow_reduction_pct, affected_lanes, estimated_clearance_min, diversion_recommended: estimated_delay_min >= 20 ? 'Yes' : 'No' }
})
const riskScores = [78, 55, 82, 49, 69, 96, 31, 22]
const riskProfiles = incidents.map((incident, index) => {
	const score = riskScores[index]
	return { risk_profile_id: `RISK-${String(index + 1).padStart(3, '0')}`, incident_id: incident.incident_id, road_segment_id: incident.road_segment_id, risk_score_0_100: score, risk_category: score >= 85 ? 'Critical' : score >= 65 ? 'High' : score >= 40 ? 'Moderate' : 'Low', contributing_factors: incident.lanes_blocked > 1 ? 'Multiple lanes affected; queue growth; incident severity' : 'Lane obstruction; local traffic density', recommended_action: score >= 80 ? 'Dispatch response and activate upstream diversion' : score >= 55 ? 'Dispatch patrol and monitor queue' : 'Continue camera monitoring', assessed_at_ist: incident.occurred_at_ist }
})
const trafficFlow = roadSegments.flatMap((segment, index) => [
	{ observation_id: `FLOW-${String(index * 2 + 1).padStart(3, '0')}`, observed_at_ist: '2026-10-05 08:00:00', road_segment_id: segment.road_segment_id, camera_id: cameras[index].camera_id, vehicles_per_5_min: 74 - index * 4, average_speed_kmh: 58 - index * 3, occupancy_pct: 33 + index * 5, flow_state: index === 3 ? 'Congested' : 'Moving' },
	{ observation_id: `FLOW-${String(index * 2 + 2).padStart(3, '0')}`, observed_at_ist: '2026-10-05 08:15:00', road_segment_id: segment.road_segment_id, camera_id: cameras[index].camera_id, vehicles_per_5_min: 61 - index * 3, average_speed_kmh: 46 - index * 2, occupancy_pct: 42 + index * 5, flow_state: index === 3 ? 'Incident impact' : 'Slow' },
])

const graphEdges = [
	...zones.map((zone) => ({ source_type: 'Corridor', source_id: corridorId, relationship: 'CONTAINS', target_type: 'Zone', target_id: zone.zone_id })),
	...roadSegments.map((segment) => ({ source_type: 'Zone', source_id: segment.zone_id, relationship: 'CONTAINS', target_type: 'RoadSegment', target_id: segment.road_segment_id })),
	...cameras.map((camera) => ({ source_type: 'Zone', source_id: camera.zone_id, relationship: 'MONITORED_BY', target_type: 'Camera', target_id: camera.camera_id })),
	...incidents.flatMap((incident, index) => [
		{ source_type: 'Camera', source_id: incident.camera_id, relationship: 'DETECTED', target_type: 'Incident', target_id: incident.incident_id },
		{ source_type: 'Incident', source_id: incident.incident_id, relationship: 'OCCURRED_ON', target_type: 'RoadSegment', target_id: incident.road_segment_id },
		{ source_type: 'Incident', source_id: incident.incident_id, relationship: 'GENERATES_IMPACT', target_type: 'ImpactAnalysis', target_id: impactAnalysis[index].impact_id },
		{ source_type: 'Incident', source_id: incident.incident_id, relationship: 'HAS_RISK_PROFILE', target_type: 'RiskProfile', target_id: riskProfiles[index].risk_profile_id },
	]),
	...incidentVehicles.map((link) => ({ source_type: 'Incident', source_id: link.incident_id, relationship: 'INVOLVES', target_type: 'Vehicle', target_id: link.vehicle_id })),
].map((edge, index) => ({ graph_edge_id: `EDGE-${String(index + 1).padStart(4, '0')}`, ...edge }))

function validateRelations() {
	const ids = (rows, key) => new Set(rows.map((row) => row[key]))
	const zoneIds = ids(zones, 'zone_id')
	const segmentIds = ids(roadSegments, 'road_segment_id')
	const cameraIds = ids(cameras, 'camera_id')
	const incidentIds = ids(incidents, 'incident_id')
	const vehicleById = new Map(vehicles.map((row) => [row.vehicle_id, row]))
	if (zones.some((row) => row.corridor_id !== corridorId)) throw new Error('Unknown corridor reference in Zones.')
	if (roadSegments.some((row) => !zoneIds.has(row.zone_id))) throw new Error('Unknown zone reference in Road_Segments.')
	if (cameras.some((row) => !zoneIds.has(row.zone_id))) throw new Error('Unknown zone reference in Cameras.')
	if (incidents.some((row) => !zoneIds.has(row.zone_id) || !segmentIds.has(row.road_segment_id) || !cameraIds.has(row.camera_id))) throw new Error('Unknown network reference in Incidents.')
	for (const link of incidentVehicles) {
		if (!incidentIds.has(link.incident_id) || vehicleById.get(link.vehicle_id)?.plate_number !== link.plate_number) throw new Error(`Invalid plate link for ${link.incident_id}/${link.vehicle_id}.`)
	}
	const linked = new Set(incidentVehicles.map((row) => row.incident_id))
	if (incidents.filter((row) => /collision|crash/i.test(row.incident_type)).some((row) => !linked.has(row.incident_id))) throw new Error('Every accident must have an involved vehicle plate.')
}

function addSheet(workbook, name, rows) {
	const sheet = XLSX.utils.json_to_sheet(rows)
	const headers = Object.keys(rows[0] || {})
	sheet['!cols'] = headers.map((header) => ({ wch: Math.min(Math.max(header.length + 3, 14), 42) }))
	if (rows.length && headers.length) sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) }
	workbook.Sheets[name] = sheet
	workbook.SheetNames.push(name)
}

validateRelations()
const workbook = XLSX.utils.book_new()
for (const [name, rows] of Object.entries({ Guide: guide, Corridors: corridors, Zones: zones, Road_Segments: roadSegments, Cameras: cameras, Vehicles: vehicles, Incidents: incidents, Incident_Vehicles: incidentVehicles, Impact_Analysis: impactAnalysis, Traffic_Flow: trafficFlow, Risk_Profiles: riskProfiles, Knowledge_Graph: graphEdges })) addSheet(workbook, name, rows)
XLSX.writeFile(workbook, outputPath, { compression: true })
console.log(`Created ${outputPath}`)
console.log(`${incidents.length} incidents; ${incidentVehicles.length} vehicle links with plates; ${vehicles.length} synthetic vehicles; ${graphEdges.length} graph edges.`)
