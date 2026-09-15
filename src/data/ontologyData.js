// src/data/ontologyData.js

export const ontologyCategories = [
  {
    name: 'Entity',
    color: '#d89b7f',
  },
  {
    name: 'DataProperty',
    color: '#ffab6b',
  },
  {
    name: 'Datatype',
    color: '#f3a9dc',
  },
  {
    name: 'ObjectProperty',
    color: '#ff8415',
  },
  {
    name: 'OntologyClass',
    color: '#a878d4',
  },
  {
    name: 'Ontology',
    color: '#53b9d7',
  },
  {
    name: 'OperationalStatus',
    color: '#83b65e',
  },
]

export const ontologyNodes = [
  // Main entities
  {
    id: 'vehicle',
    label: 'Vehicle',
    category: 'Entity',
    description: 'Represents a vehicle detected by the VisionIQ system.',
  },
  {
    id: 'camera',
    label: 'Camera',
    category: 'Entity',
    description: 'Represents a traffic monitoring camera.',
  },
  {
    id: 'road',
    label: 'Road',
    category: 'Entity',
    description: 'Represents a road monitored by VisionIQ.',
  },
  {
    id: 'junction',
    label: 'Junction',
    category: 'Entity',
    description: 'Represents a road junction or intersection.',
  },
  {
    id: 'location',
    label: 'Location',
    category: 'Entity',
    description: 'Represents a geographical location.',
  },
  {
    id: 'violation',
    label: 'Violation',
    category: 'Entity',
    description: 'Represents a traffic rule violation.',
  },
  {
    id: 'rule',
    label: 'Rule',
    category: 'Entity',
    description: 'Represents a traffic rule.',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    category: 'Entity',
    description: 'Represents image or video evidence.',
  },

  // Vehicle related
  {
    id: 'car',
    label: 'Car',
    category: 'OntologyClass',
    description: 'A passenger vehicle.',
  },
  {
    id: 'bus',
    label: 'Bus',
    category: 'OntologyClass',
    description: 'A public or private bus.',
  },
  {
    id: 'truck',
    label: 'Truck',
    category: 'OntologyClass',
    description: 'A commercial truck.',
  },
  {
    id: 'motorcycle',
    label: 'Motorcycle',
    category: 'OntologyClass',
    description: 'A two-wheeled motor vehicle.',
  },

  // Data properties
  {
    id: 'vehicle-id',
    label: 'vehicleId',
    category: 'DataProperty',
    description: 'Unique identifier of a vehicle.',
  },
  {
    id: 'number-plate',
    label: 'numberPlate',
    category: 'DataProperty',
    description: 'Registration number of a vehicle.',
  },
  {
    id: 'vehicle-type',
    label: 'vehicleType',
    category: 'DataProperty',
    description: 'Type of detected vehicle.',
  },
  {
    id: 'speed',
    label: 'speed',
    category: 'DataProperty',
    description: 'Detected speed of the vehicle.',
  },
  {
    id: 'timestamp',
    label: 'timestamp',
    category: 'DataProperty',
    description: 'Time at which an event occurred.',
  },
  {
    id: 'camera-id',
    label: 'cameraId',
    category: 'DataProperty',
    description: 'Unique identifier of a camera.',
  },

  // Datatypes
  {
    id: 'string',
    label: 'String',
    category: 'Datatype',
    description: 'Text-based datatype.',
  },
  {
    id: 'integer',
    label: 'Integer',
    category: 'Datatype',
    description: 'Integer datatype.',
  },
  {
    id: 'datetime',
    label: 'DateTime',
    category: 'Datatype',
    description: 'Date and time datatype.',
  },

  // Object properties
  {
    id: 'detects',
    label: 'detects',
    category: 'ObjectProperty',
    description: 'Connects a camera to an entity it detects.',
  },
  {
    id: 'located-at',
    label: 'locatedAt',
    category: 'ObjectProperty',
    description: 'Connects an entity to its location.',
  },
  {
    id: 'violates',
    label: 'violates',
    category: 'ObjectProperty',
    description: 'Connects a vehicle or event to a violated rule.',
  },
  {
    id: 'has-evidence',
    label: 'hasEvidence',
    category: 'ObjectProperty',
    description: 'Connects a violation to its evidence.',
  },
  {
    id: 'has-rule',
    label: 'hasRule',
    category: 'ObjectProperty',
    description: 'Connects a violation to the applicable rule.',
  },
  {
    id: 'has-vehicle-type',
    label: 'hasVehicleType',
    category: 'ObjectProperty',
    description: 'Connects a vehicle with its classification.',
  },

  // Ontology / status
  {
    id: 'traffic-ontology',
    label: 'TrafficOntology',
    category: 'Ontology',
    description: 'Root ontology for the VisionIQ traffic domain.',
  },
  {
    id: 'active',
    label: 'Active',
    category: 'OperationalStatus',
    description: 'Indicates an active operational state.',
  },
]

export const ontologyRelationships = [
  {
    id: 'r1',
    source: 'camera',
    target: 'vehicle',
    label: 'detects',
  },
  {
    id: 'r2',
    source: 'camera',
    target: 'evidence',
    label: 'generates',
  },
  {
    id: 'r3',
    source: 'vehicle',
    target: 'violation',
    label: 'hasViolation',
  },
  {
    id: 'r4',
    source: 'violation',
    target: 'rule',
    label: 'violates',
  },
  {
    id: 'r5',
    source: 'violation',
    target: 'evidence',
    label: 'hasEvidence',
  },
  {
    id: 'r6',
    source: 'camera',
    target: 'location',
    label: 'locatedAt',
  },
  {
    id: 'r7',
    source: 'road',
    target: 'location',
    label: 'locatedAt',
  },
  {
    id: 'r8',
    source: 'junction',
    target: 'road',
    label: 'connectedTo',
  },
  {
    id: 'r9',
    source: 'vehicle',
    target: 'car',
    label: 'hasType',
  },
  {
    id: 'r10',
    source: 'vehicle',
    target: 'bus',
    label: 'hasType',
  },
  {
    id: 'r11',
    source: 'vehicle',
    target: 'truck',
    label: 'hasType',
  },
  {
    id: 'r12',
    source: 'vehicle',
    target: 'motorcycle',
    label: 'hasType',
  },
  {
    id: 'r13',
    source: 'vehicle',
    target: 'vehicle-id',
    label: 'hasDataProperty',
  },
  {
    id: 'r14',
    source: 'vehicle',
    target: 'number-plate',
    label: 'hasDataProperty',
  },
  {
    id: 'r15',
    source: 'vehicle',
    target: 'vehicle-type',
    label: 'hasDataProperty',
  },
  {
    id: 'r16',
    source: 'vehicle',
    target: 'speed',
    label: 'hasDataProperty',
  },
  {
    id: 'r17',
    source: 'violation',
    target: 'timestamp',
    label: 'hasDataProperty',
  },
  {
    id: 'r18',
    source: 'camera',
    target: 'camera-id',
    label: 'hasDataProperty',
  },
  {
    id: 'r19',
    source: 'vehicle-id',
    target: 'string',
    label: 'hasDatatype',
  },
  {
    id: 'r20',
    source: 'number-plate',
    target: 'string',
    label: 'hasDatatype',
  },
  {
    id: 'r21',
    source: 'speed',
    target: 'integer',
    label: 'hasDatatype',
  },
  {
    id: 'r22',
    source: 'timestamp',
    target: 'datetime',
    label: 'hasDatatype',
  },
  {
    id: 'r23',
    source: 'traffic-ontology',
    target: 'vehicle',
    label: 'hasClass',
  },
  {
    id: 'r24',
    source: 'traffic-ontology',
    target: 'camera',
    label: 'hasClass',
  },
  {
    id: 'r25',
    source: 'traffic-ontology',
    target: 'violation',
    label: 'hasClass',
  },
  {
    id: 'r26',
    source: 'traffic-ontology',
    target: 'rule',
    label: 'hasClass',
  },
  {
    id: 'r27',
    source: 'camera',
    target: 'active',
    label: 'hasStatus',
  },
]

export function generateOntologyFromRows(rows) {
  if (!rows || !rows.length) {
    return { nodes: ontologyNodes, relationships: ontologyRelationships }
  }

  const vehicleTypes = Array.from(new Set(rows.map((r) => r.type).filter(Boolean)))
  const locations = Array.from(new Set(rows.map((r) => r.location).filter(Boolean)))
  const cameras = Array.from(new Set(rows.map((r) => r.camera).filter(Boolean)))

  const dynamicNodes = [
    // Root Ontology Class
    {
      id: 'traffic-ontology',
      label: 'TrafficOntology',
      category: 'Ontology',
      description: `Active ontology model constructed from ${rows.length} CSV records.`,
    },

    // Core Entities
    {
      id: 'vehicle',
      label: 'Vehicle',
      category: 'Entity',
      description: `General vehicle entity representing ${vehicleTypes.length} detected vehicle categories.`,
    },
    {
      id: 'camera',
      label: 'Camera',
      category: 'Entity',
      description: `Traffic monitoring device network with ${cameras.length} active sensors.`,
    },
    {
      id: 'location',
      label: 'Location',
      category: 'Entity',
      description: `Monitored spatial zones covering ${locations.length} designated locations.`,
    },
    {
      id: 'traffic-event',
      label: 'TrafficEvent',
      category: 'Entity',
      description: 'Telemetry observation record representing traffic movement at a point in time.',
    },

    // Vehicle Subclasses based on uploaded CSV
    ...vehicleTypes.map((type) => {
      const count = rows.filter((r) => r.type === type).length
      const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return {
        id: `type-${slug}`,
        label: type,
        category: 'OntologyClass',
        description: `Detected class instance '${type}' (${count} observations in dataset).`,
      }
    }),

    // Location Nodes based on uploaded CSV
    ...locations.slice(0, 5).map((loc) => {
      const vol = rows.filter((r) => r.location === loc).reduce((s, r) => s + (r.volume || 1), 0)
      const slug = loc.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return {
        id: `loc-${slug}`,
        label: loc,
        category: 'Location',
        description: `Zone '${loc}' with total recorded traffic volume of ${vol}.`,
      }
    }),

    // Data Properties from the full 20-column schema
    {
      id: 'prop-type',
      label: 'objectType',
      category: 'DataProperty',
      description: 'Categorical type of detected vehicle or object.',
    },
    {
      id: 'prop-plate',
      label: 'numberPlate',
      category: 'DataProperty',
      description: 'Vehicle registration number plate identifier.',
    },
    {
      id: 'prop-location',
      label: 'roadName',
      category: 'DataProperty',
      description: 'Monitored road name or corridor corridor.',
    },
    {
      id: 'prop-junction',
      label: 'junctionId',
      category: 'DataProperty',
      description: 'Intersection or junction identifier.',
    },
    {
      id: 'prop-camera',
      label: 'cameraId',
      category: 'DataProperty',
      description: 'Identifier of recording camera sensor.',
    },
    {
      id: 'prop-direction',
      label: 'cameraDirection',
      category: 'DataProperty',
      description: 'Orientation heading of camera sensor (North/South/East/West).',
    },
    {
      id: 'prop-signal',
      label: 'trafficSignalState',
      category: 'DataProperty',
      description: 'State of traffic signal during capture (Green/Red/Yellow).',
    },
    {
      id: 'prop-confidence',
      label: 'detectionConfidence',
      category: 'DataProperty',
      description: 'Machine learning model confidence score (0.0 to 1.0).',
    },
    {
      id: 'prop-distance',
      label: 'estimatedDistance',
      category: 'DataProperty',
      description: 'Estimated distance in meters from camera to vehicle.',
    },
    {
      id: 'prop-weather',
      label: 'weather',
      category: 'DataProperty',
      description: 'Atmospheric condition during telemetry capture.',
    },
    {
      id: 'prop-timestamp',
      label: 'timestamp',
      category: 'DataProperty',
      description: 'Recorded timestamp of detection.',
    },

    // Datatypes
    {
      id: 'dt-string',
      label: 'String',
      category: 'Datatype',
      description: 'Textual string representation.',
    },
    {
      id: 'dt-float',
      label: 'Float',
      category: 'Datatype',
      description: 'Floating point numerical value.',
    },
    {
      id: 'dt-integer',
      label: 'Integer',
      category: 'Datatype',
      description: 'Whole numerical count measurement.',
    },
    {
      id: 'dt-time',
      label: 'Timestamp',
      category: 'Datatype',
      description: 'Temporal timestamp string or date object.',
    },
  ]

  let relId = 1
  const dynamicRelationships = [
    // Model has classes
    { id: `r-${relId++}`, source: 'traffic-ontology', target: 'vehicle', label: 'hasClass' },
    { id: `r-${relId++}`, source: 'traffic-ontology', target: 'camera', label: 'hasClass' },
    { id: `r-${relId++}`, source: 'traffic-ontology', target: 'location', label: 'hasClass' },
    { id: `r-${relId++}`, source: 'traffic-ontology', target: 'traffic-event', label: 'hasClass' },

    // Vehicle types inherit from Vehicle
    ...vehicleTypes.map((type) => {
      const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return {
        id: `r-${relId++}`,
        source: `type-${slug}`,
        target: 'vehicle',
        label: 'subClassOf',
      }
    }),

    // Top locations are locations
    ...locations.slice(0, 5).map((loc) => {
      const slug = loc.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return {
        id: `r-${relId++}`,
        source: `loc-${slug}`,
        target: 'location',
        label: 'subClassOf',
      }
    }),

    // Core entity relations
    { id: `r-${relId++}`, source: 'vehicle', target: 'camera', label: 'detectedBy' },
    { id: `r-${relId++}`, source: 'camera', target: 'location', label: 'monitors' },
    { id: `r-${relId++}`, source: 'traffic-event', target: 'vehicle', label: 'records' },
    { id: `r-${relId++}`, source: 'traffic-event', target: 'location', label: 'occursAt' },

    // Vehicle Properties
    { id: `r-${relId++}`, source: 'vehicle', target: 'prop-type', label: 'hasDataProperty' },
    { id: `r-${relId++}`, source: 'vehicle', target: 'prop-plate', label: 'hasDataProperty' },

    // Camera Properties
    { id: `r-${relId++}`, source: 'camera', target: 'prop-camera', label: 'hasDataProperty' },
    { id: `r-${relId++}`, source: 'camera', target: 'prop-direction', label: 'hasDataProperty' },

    // Location Properties
    { id: `r-${relId++}`, source: 'location', target: 'prop-location', label: 'hasDataProperty' },
    { id: `r-${relId++}`, source: 'location', target: 'prop-junction', label: 'hasDataProperty' },

    // Event Properties
    { id: `r-${relId++}`, source: 'traffic-event', target: 'prop-timestamp', label: 'hasDataProperty' },
    { id: `r-${relId++}`, source: 'traffic-event', target: 'prop-signal', label: 'hasDataProperty' },
    { id: `r-${relId++}`, source: 'traffic-event', target: 'prop-confidence', label: 'hasDataProperty' },
    { id: `r-${relId++}`, source: 'traffic-event', target: 'prop-distance', label: 'hasDataProperty' },
    { id: `r-${relId++}`, source: 'traffic-event', target: 'prop-weather', label: 'hasDataProperty' },

    // Datatype Links
    { id: `r-${relId++}`, source: 'prop-type', target: 'dt-string', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-plate', target: 'dt-string', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-location', target: 'dt-string', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-junction', target: 'dt-string', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-camera', target: 'dt-string', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-direction', target: 'dt-string', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-signal', target: 'dt-string', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-weather', target: 'dt-string', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-timestamp', target: 'dt-time', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-confidence', target: 'dt-float', label: 'hasDatatype' },
    { id: `r-${relId++}`, source: 'prop-distance', target: 'dt-float', label: 'hasDatatype' },
  ]

  return { nodes: dynamicNodes, relationships: dynamicRelationships }
}