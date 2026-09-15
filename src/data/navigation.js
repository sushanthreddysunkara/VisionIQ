import {
  FileText,
  GitFork,
  LayoutGrid,
  Network,
  Search,
  ShieldCheck,
} from 'lucide-react'

export const navigation = [
  { label: 'Home', path: '/home', icon: LayoutGrid },
  { label: 'Ontology', path: '/ontology', icon: GitFork },
  { label: 'Knowledge Graph', path: '/knowledge-graph', icon: Network },
  { label: 'Query', path: '/query', icon: Search },
  { label: 'Dashboards', path: '/dashboards', icon: LayoutGrid },
  { label: 'Document Intelligence', path: '/document-intelligence', icon: FileText },
  { label: 'Rules & Events', path: '/rules-events', icon: ShieldCheck },
]

export const routePaths = navigation.map(({ path }) => path)
