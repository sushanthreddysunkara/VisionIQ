import {
  Activity,
  BarChart3,
  Camera,
  CarFront,
  Database,
  FileText,
  Home,
  Network,
  Search,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'

export const navigation = [
  { label: 'Dashboard', path: '/home', icon: Home, exact: true },
  { label: 'Query', path: '/query', icon: Search },
  { label: 'Knowledge Graph', path: '/knowledge-graph', icon: Network },
  { label: 'Ontology', path: '/ontology', icon: Database },
  { label: 'Analytics', path: '/dashboards/vehicles', icon: BarChart3 },
  { label: 'Traffic Flow', path: '/dashboards/traffic', icon: Activity },
  { label: 'Camera Network', path: '/dashboards/cameras', icon: Camera },
  { label: 'Vehicle Info', path: '/vehicle-information', icon: CarFront },
  { label: 'Reports', path: '/document-intelligence', icon: FileText },
  { label: 'Rules & Events', path: '/rules-events', icon: ShieldCheck },
]

export const routePaths = navigation.map(({ path }) => path)
