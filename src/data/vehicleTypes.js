import {
  Ambulance,
  Bike,
  Bus,
  Car,
  CarFront,
  Footprints,
  Navigation,
  Tractor,
  Train,
  TramFront,
  Truck,
  Users,
  Van,
} from 'lucide-react'

export const VEHICLE_CONFIGS = {
  car: {
    label: 'Car',
    icon: Car,
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  cars: {
    label: 'Cars',
    icon: Car,
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  bike: {
    label: 'Bike',
    icon: Bike,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  bikes: {
    label: 'Bikes',
    icon: Bike,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  bicycle: {
    label: 'Bicycle',
    icon: Bike,
    color: '#0d9488',
    bg: '#f0fdfa',
    border: '#99f6e4',
  },
  motorcycle: {
    label: 'Motorcycle',
    icon: Bike,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  bus: {
    label: 'Bus',
    icon: Bus,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  buses: {
    label: 'Buses',
    icon: Bus,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  truck: {
    label: 'Truck',
    icon: Truck,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  trucks: {
    label: 'Trucks',
    icon: Truck,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  tractor: {
    label: 'Tractor',
    icon: Tractor,
    color: '#c2410c',
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  tractors: {
    label: 'Tractors',
    icon: Tractor,
    color: '#c2410c',
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  tractr: {
    label: 'Tractor',
    icon: Tractor,
    color: '#c2410c',
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  jeep: {
    label: 'Jeep',
    icon: CarFront,
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
  },
  jeeps: {
    label: 'Jeeps',
    icon: CarFront,
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
  },
  suv: {
    label: 'SUV',
    icon: CarFront,
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
  },
  auto: {
    label: 'Auto',
    icon: Navigation,
    color: '#ca8a04',
    bg: '#fefce8',
    border: '#fef08a',
  },
  autos: {
    label: 'Autos',
    icon: Navigation,
    color: '#ca8a04',
    bg: '#fefce8',
    border: '#fef08a',
  },
  rickshaw: {
    label: 'Rickshaw',
    icon: Navigation,
    color: '#ca8a04',
    bg: '#fefce8',
    border: '#fef08a',
  },
  van: {
    label: 'Van',
    icon: Van,
    color: '#475569',
    bg: '#f8fafc',
    border: '#cbd5e1',
  },
  vans: {
    label: 'Vans',
    icon: Van,
    color: '#475569',
    bg: '#f8fafc',
    border: '#cbd5e1',
  },
  train: {
    label: 'Train',
    icon: Train,
    color: '#4338ca',
    bg: '#eef2ff',
    border: '#c7d2fe',
  },
  trains: {
    label: 'Trains',
    icon: Train,
    color: '#4338ca',
    bg: '#eef2ff',
    border: '#c7d2fe',
  },
  tram: {
    label: 'Tram',
    icon: TramFront,
    color: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
  },
  ambulance: {
    label: 'Ambulance',
    icon: Ambulance,
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3',
  },
  pedestrian: {
    label: 'Pedestrians',
    icon: Footprints,
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  pedestrians: {
    label: 'Pedestrians',
    icon: Footprints,
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  edisetrains: {
    label: 'Pedestrians',
    icon: Footprints,
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  edisetrain: {
    label: 'Pedestrians',
    icon: Footprints,
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
}

export function getVehicleMeta(type) {
  if (!type) {
    return {
      label: 'Unknown',
      icon: Car,
      color: '#64748b',
      bg: '#f1f5f9',
      border: '#cbd5e1',
    }
  }

  const normalized = String(type).trim().toLowerCase()

  if (VEHICLE_CONFIGS[normalized]) {
    return { ...VEHICLE_CONFIGS[normalized] }
  }

  // Substring / partial matching
  if (normalized.includes('bike') || normalized.includes('cycle') || normalized.includes('scooter')) {
    return { ...VEHICLE_CONFIGS.bike }
  }
  if (normalized.includes('bus')) {
    return { ...VEHICLE_CONFIGS.bus }
  }
  if (normalized.includes('truck') || normalized.includes('lorry') || normalized.includes('trailer')) {
    return { ...VEHICLE_CONFIGS.truck }
  }
  if (normalized.includes('tractor') || normalized.includes('tractr')) {
    return { ...VEHICLE_CONFIGS.tractor }
  }
  if (normalized.includes('jeep') || normalized.includes('suv') || normalized.includes('4x4')) {
    return { ...VEHICLE_CONFIGS.jeep }
  }
  if (normalized.includes('auto') || normalized.includes('rickshaw')) {
    return { ...VEHICLE_CONFIGS.auto }
  }
  if (normalized.includes('van')) {
    return { ...VEHICLE_CONFIGS.van }
  }
  if (normalized.includes('train') || normalized.includes('rail') || normalized.includes('metro')) {
    return { ...VEHICLE_CONFIGS.train }
  }
  if (normalized.includes('tram')) {
    return { ...VEHICLE_CONFIGS.tram }
  }
  if (
    normalized.includes('pedestrian') ||
    normalized.includes('walk') ||
    normalized.includes('person') ||
    normalized.includes('edisetrain')
  ) {
    return { ...VEHICLE_CONFIGS.pedestrians }
  }
  if (normalized.includes('ambulance') || normalized.includes('emergency')) {
    return { ...VEHICLE_CONFIGS.ambulance }
  }
  if (normalized.includes('car')) {
    return { ...VEHICLE_CONFIGS.car }
  }

  // Fallback for custom vehicle
  return {
    label: type,
    icon: Car,
    color: '#334155',
    bg: '#f8fafc',
    border: '#e2e8f0',
  }
}
