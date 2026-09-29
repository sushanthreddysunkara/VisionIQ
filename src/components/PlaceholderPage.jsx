import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bike,
  Building2,
  Bus,
  Calendar,
  Camera,
  Car,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  LayoutGrid,
  Leaf,
  MapPin,
  PieChart as PieIcon,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Timer,
  TrendingUp,
  Truck,
  User,
  Zap,
  Video,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navigation } from '../data/navigation'
import { isVehicleTypeMatch } from '../data/vehicleTypes'
import { cameraFeeds, getCameraFeed } from '../data/cameraFeeds'
import MediaPreviewModal from './MediaPreviewModal'
import CameraFeedModal from './CameraFeedModal'
import CorridorHighwayMap from './vehicle/CorridorHighwayMap'

export default function PlaceholderPage({
  cameraCount = 0,
  rows = [],
  fileName = '',
  latestBatchInfo = null,
  dbStats = null,
  onFetchRandomBatch = null,
  onToggleStreamPause = null,
  streamPaused = false,
  streamNotifications = [],
  isOverviewTab = false,
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [timeFilter, setTimeFilter] = useState('Today')
  const [trendRange, setTrendRange] = useState('Last 24 Hours')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [previewModalRow, setPreviewModalRow] = useState(null)
  const [cameraFeedOpen, setCameraFeedOpen] = useState(false)
  const [selectedCameraFeed, setSelectedCameraFeed] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const safeRows = Array.isArray(rows) ? rows : []
  const isHomePage = pathname === '/home' || pathname === '/' || isOverviewTab

  // Dynamic live vehicle statistics
  const totalCount = safeRows.length || dbStats?.totalRecords || dbStats?.totalPool || 7044
  const formattedTotal = Number(totalCount).toLocaleString()

  const vehicleStats = useMemo(() => {
    const counts = { Car: 0, Bike: 0, Truck: 0, Bus: 0, Auto: 0, Other: 0 }
    let overspeeds = 0

    if (safeRows.length > 0) {
      safeRows.forEach((r) => {
        const rawType = r.type || r.vehicleType
        if (isVehicleTypeMatch(rawType, 'Car') || isVehicleTypeMatch(rawType, 'SUV')) counts.Car += 1
        else if (isVehicleTypeMatch(rawType, 'Bike')) counts.Bike += 1
        else if (isVehicleTypeMatch(rawType, 'Truck')) counts.Truck += 1
        else if (isVehicleTypeMatch(rawType, 'Bus')) counts.Bus += 1
        else if (isVehicleTypeMatch(rawType, 'Auto')) counts.Auto += 1
        else counts.Other += 1

        if (r.isOverSpeed || r.overSpeed === 'Yes') overspeeds += 1
      })
    } else if (dbStats?.vehicleTypes) {
      counts.Car = (dbStats.vehicleTypes.Car || 0) + (dbStats.vehicleTypes.SUV || 0)
      counts.Bike = dbStats.vehicleTypes.Bike || 0
      counts.Truck = dbStats.vehicleTypes.Truck || 0
      counts.Bus = dbStats.vehicleTypes.Bus || 0
      counts.Auto = dbStats.vehicleTypes.Auto || 0
      counts.Other = dbStats.vehicleTypes.Van || 0
      overspeeds = dbStats.overspeedTotal || 0
    }

    const total = counts.Car + counts.Bike + counts.Truck + counts.Bus + counts.Auto + counts.Other || 1
    const maxBar = Math.max(counts.Car, counts.Bike, counts.Truck, counts.Bus, counts.Auto, counts.Other, 1)
    return {
      counts,
      total,
      maxBar,
      overspeeds,
      twoWheelers: counts.Bike,
      heavyVehicles: counts.Truck + counts.Bus,
      cars: counts.Car,
      autos: counts.Auto,
    }
  }, [safeRows, dbStats])

  // Format live clock e.g. "10:24:18 AM"
  // Dynamic or authentic values
  const totalCount = dbStats?.totalEvents || (safeRows.length ? safeRows.length : 72540)
  const formattedTotal = Number(totalCount).toLocaleString()

  // Format live clock e.g. "08:45:12 AM"
  const formattedClock = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  // Dynamic detection feed items or realistic corridor detections
  const displayDetections = useMemo(() => {
    if (safeRows.length >= 1) {
      return safeRows.slice(0, 4).map((r, i) => ({
        plate: r.vehicleNumberPlate || r.numberPlate || `TG-0${i + 1}-LIVE`,
        type: r.type || r.vehicleType || 'Car',
        camera: r.camera || `CAM-NH44-0${(i % 6) + 1}`,
        time: r.timestampIst ? r.timestampIst.slice(11, 19) : (r.timestamp || 'Live'),
        thumb: r.vehicleImagePath || r.vehicle_image_url || r.image_url || `/images/image${(i * 12) + 1}.jpeg`,
      }))
    }
    return [
      { plate: 'TG 08 KW 3126', type: 'Car', camera: 'CAM-NH44-01-SHAMSHABAD', time: '10:24:12', thumb: '/images/image1.jpeg' },
      { plate: 'TS 07 XY 5678', type: 'Truck', camera: 'CAM-NH44-02-SHADNAGAR', time: '10:23:45', thumb: '/images/image113.jpeg' },
      { plate: 'AP 28 CD 7890', type: 'Bike', camera: 'CAM-NH44-03-RINGROAD', time: '10:23:18', thumb: '/images/image25.jpeg' },
      { plate: 'TG 25 LY 5856', type: 'Bus', camera: 'CAM-NH44-04-MEDCHAL', time: '10:22:50', thumb: '/images/image45.jpeg' },
    ]
  }, [safeRows])

  const handleOpenLiveFeed = (camId) => {
    const feed = camId ? (cameraFeeds.find((c) => c.id === camId) || cameraFeeds[0]) : cameraFeeds[0]
    setSelectedCameraFeed(feed)
    setCameraFeedOpen(true)
  }

  // Fallback for non-home pages
  if (!isHomePage) {
    const page = navigation.find(({ path }) => path === pathname) ?? navigation[0]
    return (
      <div className="workspace-page">
        <div className="workspace-hero">
          <div>
            <p className="section-kicker">OPERATIONAL INTELLIGENCE</p>
            <h1>{page.label}</h1>
            <p className="intro-copy">Explore and manage your {page.label.toLowerCase()} configuration and assets.</p>
          </div>
          <div className="workspace-hero-icon"><Activity size={24} /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="viq-dashboard-container">
      {/* 1. TOP HEADER: Corridor Command View */}
      <div className="corridor-top-header">
        <div className="corridor-title-group">
          <h1 className="corridor-page-title">Corridor Command View</h1>
          <p className="corridor-page-subtitle">NH-44 · Hyderabad to Bengaluru · 570 km</p>
        </div>

        <div className="corridor-header-actions">
          <div className="corridor-live-status-pill">
            <span className="corridor-pulse-dot" />
            <span className="corridor-live-text">
              Live · updated {formattedClock}
            </span>
          </div>

          <button
            type="button"
            className="corridor-live-view-btn"
            onClick={() => handleOpenLiveFeed()}
          >
            <Video size={16} />
            <span>Open Live View</span>
          </button>
        </div>
      </div>

      {/* 2. SIX STAT KPI CARDS */}
      <div className="corridor-kpi-grid">
        {/* Card 1: Active Incidents */}
        <div className="corridor-kpi-card">
          <div className="corridor-kpi-icon red">
            <AlertTriangle size={20} strokeWidth={2.4} />
          </div>
          <div className="corridor-kpi-body">
            <div className="corridor-kpi-number">12</div>
            <div className="corridor-kpi-label">Active Incidents</div>
            <div className="corridor-kpi-trend red">
              <span className="trend-arrow">↑</span> +3 vs. yesterday
            </div>
          </div>
        </div>

        {/* Card 2: Vehicles (last 1 hour) */}
        <div className="corridor-kpi-card">
          <div className="corridor-kpi-icon blue">
            <Car size={20} strokeWidth={2.4} />
          </div>
          <div className="corridor-kpi-body">
            <div className="corridor-kpi-number">{formattedTotal}</div>
            <div className="corridor-kpi-label">Vehicles (last 1 hour)</div>
            <div className="corridor-kpi-trend green">
              <span className="trend-arrow">↑</span> +8% vs. yesterday
            </div>
          </div>
        </div>

      {/* LIVE TELEMETRY & STREAM CONTROL CONSOLE */}
      <div className="nh44-stream-console">
        <div className="stream-console-status">
          <div className={`radar-indicator ${streamPaused ? 'paused' : 'active'}`}>
            <span className="radar-ring" />
            <span className="radar-dot" />
          </div>
          <div className="stream-status-text">
            <div className="stream-status-title">
              <strong>{streamPaused ? '🔴 Live Feed & Database Fetching Stopped' : '🟢 Live Highway Telemetry & DB Fetching Active'}</strong>
              <span className="stream-source-tag">Source: {fileName || 'All Database Records (7,044 Live Archive)'}</span>
            </div>
            <div className="stream-status-meta">
              {streamPaused ? (
                <span className="stream-stopped-hint">
                  Live data feeding and background MySQL queries are paused. Click <strong>Start Live Feed</strong> to resume.
                </span>
              ) : latestBatchInfo?.batchCount ? (
                <span className="batch-flash-pill">
                  <Zap size={13} />
                  +<strong>{latestBatchInfo.batchCount}</strong> records ingested in this batch (Random range 1–20)
                  <span className="batch-total-growth">
                    • Cumulative Total: <strong>{safeRows.length}</strong> records (Increasing ▲)
                  </span>
                </span>
              ) : (
                <span>Streaming live telemetry from MySQL database... Total: <strong>{safeRows.length}</strong> records</span>
              )}
            </div>
          </div>
        </div>

        <div className="stream-console-actions">
          {onFetchRandomBatch && (
            <button
              className="nh44-control-btn nh44-trigger-btn"
              onClick={onFetchRandomBatch}
              type="button"
              title="Fetch a random batch of 1 to 20 records instantly"
            >
              <RefreshCw size={15} />
              <span>Fetch Random Batch (1–20)</span>
            </button>
          )}

          {onToggleStreamPause && (
            <button
              className={`nh44-control-btn nh44-pause-btn ${streamPaused ? 'resume' : 'stop'}`}
              onClick={onToggleStreamPause}
              type="button"
              title={streamPaused ? 'Start live feed and resume database fetching' : 'Stop live feed and halt database fetching'}
            >
              {streamPaused ? (
                <>
                  <Play size={15} fill="currentColor" />
                  <span>🟢 Start Live Feed</span>
                </>
              ) : (
                <>
                  <Square size={14} fill="currentColor" />
                  <span>🔴 Stop Live Feed</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. Top 4 Stat KPI Cards */}
      <div className="viq-stat-cards-grid">
        {/* Total Vehicles */}
        <div className="viq-stat-card">
          <div className="viq-stat-icon-wrap mint">
            <Car size={22} strokeWidth={2} />
        {/* Card 3: Corridor Travel Time */}
        <div className="corridor-kpi-card">
          <div className="corridor-kpi-icon orange">
            <Clock size={20} strokeWidth={2.4} />
          </div>
          <div className="corridor-kpi-body">
            <div className="corridor-kpi-number">8 h 22 m</div>
            <div className="corridor-kpi-label">Corridor Travel Time</div>
            <div className="corridor-kpi-trend orange">
              <span className="trend-arrow">↑</span> +1 h 12 m vs normal
            </div>
          </div>
        </div>

        {/* Two Wheelers */}
        <div className="viq-stat-card">
          <div className="viq-stat-icon-wrap amber">
            <Bike size={22} strokeWidth={2} />
          </div>
          <div className="viq-stat-info">
            <span className="viq-stat-label">Two Wheelers</span>
            <strong className="viq-stat-value">{vehicleStats.twoWheelers.toLocaleString()}</strong>
            <span className="viq-stat-trend">
              <ArrowUp size={13} strokeWidth={2.5} /> Live
            </span>
        {/* Card 4: Toll Revenue (today) */}
        <div className="corridor-kpi-card">
          <div className="corridor-kpi-icon purple">
            <span className="rupee-icon">₹</span>
          </div>
          <div className="corridor-kpi-body">
            <div className="corridor-kpi-number">₹ 1.28 Cr</div>
            <div className="corridor-kpi-label">Toll Revenue (today)</div>
            <div className="corridor-kpi-trend green">
              <span className="trend-arrow">↑</span> +4% vs. yesterday
            </div>
          </div>
        </div>

        {/* Heavy Vehicles */}
        <div className="viq-stat-card">
          <div className="viq-stat-icon-wrap peach">
            <Truck size={22} strokeWidth={2} />
          </div>
          <div className="viq-stat-info">
            <span className="viq-stat-label">Heavy Vehicles</span>
            <strong className="viq-stat-value">{vehicleStats.heavyVehicles.toLocaleString()}</strong>
            <span className="viq-stat-trend">
              <ArrowUp size={13} strokeWidth={2.5} /> Live
            </span>
        {/* Card 5: Asset Alerts */}
        <div className="corridor-kpi-card">
          <div className="corridor-kpi-icon amber">
            <Wrench size={20} strokeWidth={2.4} />
          </div>
          <div className="corridor-kpi-body">
            <div className="corridor-kpi-number">5</div>
            <div className="corridor-kpi-label">Asset Alerts</div>
            <div className="corridor-kpi-trend amber">
              <span className="trend-arrow">↑</span> 2 new today
            </div>
          </div>
        </div>

        {/* Speed Violations */}
        <div className="viq-stat-card">
          <div className="viq-stat-icon-wrap sky" style={{ background: '#fef2f2' }}>
            <Flame size={22} strokeWidth={2} style={{ color: '#dc2626' }} />
          </div>
          <div className="viq-stat-info">
            <span className="viq-stat-label">Speed Violations</span>
            <strong className="viq-stat-value" style={{ color: '#dc2626' }}>{vehicleStats.overspeeds.toLocaleString()}</strong>
            <span className="viq-stat-trend" style={{ color: '#dc2626' }}>
              <ArrowUp size={13} strokeWidth={2.5} /> Radar
            </span>
          </div>
          <div className="viq-stat-sparkline" aria-hidden="true">
            <svg viewBox="0 0 90 40" fill="none" className="sparkline-svg">
              <path d="M2 30 C 18 32, 28 20, 44 26 C 58 32, 70 12, 88 10" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
        {/* Card 6: Corridor Conditions */}
        <div className="corridor-kpi-card">
          <div className="corridor-kpi-icon green">
            <Leaf size={20} strokeWidth={2.4} />
          </div>
          <div className="corridor-kpi-body">
            <div className="corridor-kpi-number">Fair</div>
            <div className="corridor-kpi-label">Corridor Conditions</div>
            <div className="corridor-kpi-subtext">
              Rain Km 425–470 · fog near Devanahalli
            </div>
          </div>
        </div>
      </div>

      {/* 3. HERO MAP: Live Highway View (Full Width, Live Feed Removed per request) */}
      <div className="corridor-map-section">
        <CorridorHighwayMap onOpenLiveCamera={handleOpenLiveFeed} />
      </div>

      {/* 4. REMAINING ANALYTICS & DATA MOVED DOWN: Clean Multi-Grid Layout */}
      {/* Middle Row: Vehicle Count by Type Bar Chart & Vehicle Type Distribution */}
      <div className="viq-middle-grid viq-two-col-grid">
        {/* Left: Vehicle Count by Type */}
        <div className="viq-card viq-bar-chart-card">
          <div className="viq-card-header">
            <div className="viq-card-title-group">
              <BarChart3 className="viq-card-icon" size={19} />
              <h2>Vehicle Count by Type</h2>
            </div>
            <div className="viq-select-dropdown">
              <Calendar size={13} />
              <span>{timeFilter}</span>
              <ChevronDown size={14} />
            </div>
          </div>

          <div className="viq-bar-chart-canvas">
            {/* Y Axis Guide */}
            <div className="viq-chart-y-axis">
              <span>4K</span>
              <span>3K</span>
              <span>2K</span>
              <span>1K</span>
              <span>0</span>
            </div>

            {/* Bars Container with grid lines */}
            <div className="viq-chart-bars-wrap">
              <div className="viq-chart-gridline" style={{ top: '0%' }} />
              <div className="viq-chart-gridline" style={{ top: '25%' }} />
              <div className="viq-chart-gridline" style={{ top: '50%' }} />
              <div className="viq-chart-gridline" style={{ top: '75%' }} />
              <div className="viq-chart-gridline" style={{ top: '100%' }} />

              <div className="viq-chart-bars">
                {/* Cars */}
                <div className="viq-bar-col">
                  <span className="viq-bar-value">{vehicleStats.counts.Car.toLocaleString()}</span>
                  <div className="viq-bar-fill green" style={{ height: `${Math.max(12, Math.round((vehicleStats.counts.Car / vehicleStats.maxBar) * 88))}%` }} />
                  <div className="viq-bar-label">
                    <Car size={15} />
                    <span>Cars</span>
                  </div>
                </div>

                {/* Bikes */}
                <div className="viq-bar-col">
                  <span className="viq-bar-value">{vehicleStats.counts.Bike.toLocaleString()}</span>
                  <div className="viq-bar-fill amber" style={{ height: `${Math.max(12, Math.round((vehicleStats.counts.Bike / vehicleStats.maxBar) * 88))}%` }} />
                  <div className="viq-bar-label">
                    <Bike size={15} />
                    <span>Bikes</span>
                  </div>
                </div>

                {/* Trucks */}
                <div className="viq-bar-col">
                  <span className="viq-bar-value">{vehicleStats.counts.Truck.toLocaleString()}</span>
                  <div className="viq-bar-fill terracotta" style={{ height: `${Math.max(12, Math.round((vehicleStats.counts.Truck / vehicleStats.maxBar) * 88))}%` }} />
                  <div className="viq-bar-label">
                    <Truck size={15} />
                    <span>Trucks</span>
                  </div>
                </div>

                {/* Buses */}
                <div className="viq-bar-col">
                  <span className="viq-bar-value">{vehicleStats.counts.Bus.toLocaleString()}</span>
                  <div className="viq-bar-fill blue" style={{ height: `${Math.max(12, Math.round((vehicleStats.counts.Bus / vehicleStats.maxBar) * 88))}%` }} />
                  <div className="viq-bar-label">
                    <Bus size={15} />
                    <span>Buses</span>
                  </div>
                </div>

                {/* Auto */}
                <div className="viq-bar-col">
                  <span className="viq-bar-value">{vehicleStats.counts.Auto.toLocaleString()}</span>
                  <div className="viq-bar-fill purple" style={{ height: `${Math.max(12, Math.round((vehicleStats.counts.Auto / vehicleStats.maxBar) * 88))}%` }} />
                  <div className="viq-bar-label">
                    <Car size={15} />
                    <span>Auto</span>
                  </div>
                </div>

                {/* Other */}
                <div className="viq-bar-col">
                  <span className="viq-bar-value">{vehicleStats.counts.Other.toLocaleString()}</span>
                  <div className="viq-bar-fill slate" style={{ height: `${Math.max(12, Math.round((vehicleStats.counts.Other / vehicleStats.maxBar) * 88))}%` }} />
                  <div className="viq-bar-label">
                    <LayoutGrid size={15} />
                    <span>Other</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Vehicle Type Distribution (Donut Chart) */}
        <div className="viq-card viq-donut-card">
          <div className="viq-card-header">
            <div className="viq-card-title-group">
              <BarChart3 className="viq-card-icon" size={19} />
              <h2>Vehicle Type Distribution</h2>
            </div>
          </div>

          <div className="viq-donut-content">
            <div className="viq-donut-graphic">
              <svg viewBox="0 0 160 160" className="viq-donut-svg">
                {/* SVG Donut Slices */}
                {/* Cars 47% */}
                <circle cx="80" cy="80" r="54" fill="transparent" stroke="#3d9953" strokeWidth="22" strokeDasharray="159.5 179.5" strokeDashoffset="0" />
                {/* Bikes 23% */}
                <circle cx="80" cy="80" r="54" fill="transparent" stroke="#d89f4b" strokeWidth="22" strokeDasharray="78 261" strokeDashoffset="-159.5" />
                {/* Trucks 10% */}
                <circle cx="80" cy="80" r="54" fill="transparent" stroke="#cb5e48" strokeWidth="22" strokeDasharray="34 305" strokeDashoffset="-237.5" />
                {/* Buses 5% */}
                <circle cx="80" cy="80" r="54" fill="transparent" stroke="#4f82c4" strokeWidth="22" strokeDasharray="17 322" strokeDashoffset="-271.5" />
                {/* Auto 8% */}
                <circle cx="80" cy="80" r="54" fill="transparent" stroke="#8d6ab0" strokeWidth="22" strokeDasharray="27 312" strokeDashoffset="-288.5" />
                {/* Other 7% */}
                <circle cx="80" cy="80" r="54" fill="transparent" stroke="#83929b" strokeWidth="22" strokeDasharray="23.7 315" strokeDashoffset="-315.5" />
              </svg>
              <div className="viq-donut-center">
                <strong className="viq-donut-total">{formattedTotal}</strong>
                <span className="viq-donut-sub">Total</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="viq-donut-legend">
              <div className="viq-legend-row">
                <span className="viq-legend-dot" style={{ background: '#3d9953' }} />
                <span className="viq-legend-name">Cars</span>
                <strong className="viq-legend-val">47%</strong>
              </div>
              <div className="viq-legend-row">
                <span className="viq-legend-dot" style={{ background: '#d89f4b' }} />
                <span className="viq-legend-name">Bikes</span>
                <strong className="viq-legend-val">23%</strong>
              </div>
              <div className="viq-legend-row">
                <span className="viq-legend-dot" style={{ background: '#cb5e48' }} />
                <span className="viq-legend-name">Trucks</span>
                <strong className="viq-legend-val">10%</strong>
              </div>
              <div className="viq-legend-row">
                <span className="viq-legend-dot" style={{ background: '#4f82c4' }} />
                <span className="viq-legend-name">Buses</span>
                <strong className="viq-legend-val">5%</strong>
              </div>
              <div className="viq-legend-row">
                <span className="viq-legend-dot" style={{ background: '#8d6ab0' }} />
                <span className="viq-legend-name">Auto</span>
                <strong className="viq-legend-val">8%</strong>
              </div>
              <div className="viq-legend-row">
                <span className="viq-legend-dot" style={{ background: '#83929b' }} />
                <span className="viq-legend-name">Other</span>
                <strong className="viq-legend-val">7%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Row: Traffic Volume Trend (Area Chart) & Recent Detections List */}
      <div className="viq-bottom-grid viq-trend-detections-grid">
        {/* Left: Traffic Trend Area Chart */}
        <div className="viq-card viq-trend-card">
          <div className="viq-card-header">
            <div className="viq-card-title-group">
              <TrendingUp className="viq-card-icon" size={19} />
              <h2>Traffic Volume Trend</h2>
            </div>
            <div className="viq-select-dropdown">
              <span>{trendRange}</span>
              <ChevronDown size={14} />
            </div>
          </div>

          <div className="viq-trend-canvas-wrap">
            {/* Y Axis Labels */}
            <div className="viq-chart-y-axis">
              <span>4K</span>
              <span>3K</span>
              <span>2K</span>
              <span>1K</span>
              <span>0</span>
            </div>

            <div className="viq-trend-chart-area">
              {/* Horizontal Grid lines */}
              <div className="viq-chart-gridline" style={{ top: '0%' }} />
              <div className="viq-chart-gridline" style={{ top: '25%' }} />
              <div className="viq-chart-gridline" style={{ top: '50%' }} />
              <div className="viq-chart-gridline" style={{ top: '75%' }} />
              <div className="viq-chart-gridline" style={{ top: '100%' }} />

              {/* Area SVG */}
              <svg viewBox="0 0 500 160" preserveAspectRatio="none" className="viq-trend-svg">
                <defs>
                  <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3d9953" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#3d9953" stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                {/* Area Fill */}
                <path
                  d="M0 140 Q 40 120, 80 130 T 160 125 T 240 100 T 320 70 T 380 40 T 440 85 T 500 130 L 500 160 L 0 160 Z"
                  fill="url(#trendGradient)"
                />
                {/* Stroke Line */}
                <path
                  d="M0 140 Q 40 120, 80 130 T 160 125 T 240 100 T 320 70 T 380 40 T 440 85 T 500 130"
                  fill="none"
                  stroke="#3d9953"
                  strokeWidth="2.5"
                />
              </svg>

              {/* Peak Tooltip Pin at 18:00 */}
              <div className="viq-trend-marker" style={{ left: '74%', top: '24%' }}>
                <div className="viq-marker-pin" />
                <div className="viq-marker-line" />
                <div className="viq-marker-tooltip">
                  <strong>2,340 vehicles</strong>
                  <span>06:00 PM (Peak)</span>
                </div>
              </div>
            </div>
          </div>

          {/* X Axis Timestamps */}
          <div className="viq-trend-x-axis">
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
            <span>24:00</span>
          </div>
        </div>

        {/* Right: Recent Detections List */}
        <div className="viq-card viq-detections-card">
          <div className="viq-card-header">
            <div className="viq-card-title-group">
              <Camera className="viq-card-icon" size={19} />
              <h2>Recent ANPR Detections</h2>
            </div>
            <button
              className="viq-view-all-link"
              onClick={() => navigate('/query')}
              type="button"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="viq-detections-list">
            {displayDetections.map((item, idx) => (
              <div
                className="viq-detection-item"
                key={idx}
                onClick={() => {
                  if (safeRows[idx]) setPreviewModalRow(safeRows[idx])
                }}
                title="Click to inspect detection evidence"
              >
                <img
                  alt={item.plate}
                  className="viq-detection-thumb"
                  src={item.thumb}
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = '/images/image1.jpeg'
                  }}
                />
                <div className="viq-detection-details">
                  <strong className="viq-detection-plate">{item.plate}</strong>
                  <span className="viq-detection-sub">
                    {item.type} • {item.camera}
                  </span>
                </div>
                <div className="viq-detection-time">
                  <span>{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Media Preview Modal for Inspecting Any Incoming Vehicle */}
      {previewModalRow && (
        <MediaPreviewModal
          allRows={safeRows}
          isOpen={Boolean(previewModalRow)}
          onClose={() => setPreviewModalRow(null)}
          onSelectRow={setPreviewModalRow}
          row={previewModalRow}
        />
      )}

      {/* Camera Feed Modal for Live CCTV Streams */}
      {cameraFeedOpen && (
        <CameraFeedModal
          camera={selectedCameraFeed || cameraFeeds[0]}
          cameras={cameraFeeds}
          isOpen={cameraFeedOpen}
          onClose={() => setCameraFeedOpen(false)}
          onSelectCamera={setSelectedCameraFeed}
        />
      )}
    </div>
  )
}
