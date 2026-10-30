import React, { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Layers,
  Search,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react'
import { modelsData } from '../../data/modelsData'

export default function ModelsPage({ isLive = false, initialModelId = null }) {
  const [selectedModelId, setSelectedModelId] = useState(initialModelId)
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [selectedPack, setSelectedPack] = useState('HIGHWAY')
  const [searchQuery, setSearchQuery] = useState('')

  // Compute status counts
  const statusCounts = useMemo(() => {
    const counts = {
      REFERENCE: 0,
      RETIRED: 0,
      'EVALUATION ONLY': 0,
      CANDIDATE: 0,
      'NOT EVALUATED': 0,
      PLANNED: 0,
      total: modelsData.length,
    }
    modelsData.forEach((m) => {
      if (counts[m.status] !== undefined) {
        counts[m.status]++
      }
    })
    return counts
  }, [])

  // Filtered models list
  const filteredModels = useMemo(() => {
    return modelsData.filter((m) => {
      if (selectedPack !== 'ALL' && m.pack !== selectedPack) return false
      if (selectedStatus !== 'ALL' && m.status !== selectedStatus) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchCode = (m.code || '').toLowerCase().includes(q)
        const matchName = (m.name || '').toLowerCase().includes(q)
        const matchTask = (m.task || '').toLowerCase().includes(q)
        const matchRules = (m.rules || []).some((r) => r.toLowerCase().includes(q))
        const matchLicence = (m.licence || '').toLowerCase().includes(q)
        if (!matchCode && !matchName && !matchTask && !matchRules && !matchLicence) {
          return false
        }
      }
      return true
    })
  }, [selectedStatus, selectedPack, searchQuery])

  const selectedModel = useMemo(() => {
    if (!selectedModelId) return null
    return modelsData.find((m) => m.id === selectedModelId || m.code === selectedModelId) || modelsData[0]
  }, [selectedModelId])

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'REFERENCE':
        return { backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }
      case 'RETIRED':
        return { backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }
      case 'EVALUATION ONLY':
        return { backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
      case 'CANDIDATE':
        return { backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #7dd3fc' }
      case 'NOT EVALUATED':
        return { backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }
      case 'PLANNED':
        return { backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff' }
      default:
        return { backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DETAIL SPECIFICATION VIEW (Matching User Screenshot Exactly)
  // ──────────────────────────────────────────────────────────────────────────
  if (selectedModel) {
    const m = selectedModel
    const statusStyle = getStatusBadgeStyle(m.status)

    return (
      <div style={{ padding: '24px 36px', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
        {/* Back Link */}
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setSelectedModelId(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0284c7',
              fontSize: '13px',
              fontWeight: 650,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
            }}
          >
            <ArrowLeft size={14} />
            <span>Models</span>
          </button>
        </div>

        {/* Model Title & Subtitle */}
        <div style={{ marginBottom: '18px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px', color: '#0f172a', letterSpacing: '-0.02em' }}>
            {m.name}
          </h1>
          <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: '#475569', maxWidth: '1050px', lineHeight: 1.55 }}>
            {m.description || m.task}
          </p>

          {/* Tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {m.kind}
            </span>
            <span style={{
              display: 'inline-block',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 750,
              letterSpacing: '0.02em',
            }}>
              {m.pack}
            </span>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 750,
              letterSpacing: '0.02em',
              ...statusStyle,
            }}>
              {m.status}
            </span>
            <a
              href={m.sourceUrl || 'https://huggingface.co/Sushanthreddy03/vizioniq-ai-models'}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 750,
                letterSpacing: '0.02em',
                textDecoration: 'none',
              }}
            >
              <span>HF: Sushanthreddy03/vizioniq-ai-models</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {/* ── Two-Column Specifications Panel ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}>
          {/* Left Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Id</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{m.code}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Task</span>
                <span style={{ color: '#334155', lineHeight: 1.5 }}>{m.task}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Source</span>
                <a
                  href={m.sourceUrl || `https://huggingface.co/${m.source}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>{m.source}</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Pinned revision</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}>{m.pinnedRevision}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Files</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#334155' }}>{m.files}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Fetched by</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#334155' }}>{m.fetchedBy}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Runtime</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#334155' }}>{m.runtime}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Training data</span>
                <span style={{ color: '#334155', lineHeight: 1.5 }}>{m.trainingData}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Speed, as recorded</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{m.speed}</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#94a3b8' }}>
              Source: <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{m.sourceRegistry}</span>
            </div>
          </div>

          {/* Right Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Licence</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{m.licence}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Licence status</span>
                <span style={{ color: '#334155' }}>{m.licenceStatus || 'stated'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Licence note</span>
                <span style={{ color: '#334155', lineHeight: 1.5 }}>{m.licenceNote}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Blockers</span>
                <div>
                  {m.blockers && m.blockers.length > 0 ? (
                    m.blockers.map((b, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ color: '#334155' }}>{b.label || b.code}</span>
                        <span style={{
                          display: 'inline-block',
                          backgroundColor: b.type === 'BLOCKING' ? '#fee2e2' : '#f1f5f9',
                          color: b.type === 'BLOCKING' ? '#b91c1c' : '#64748b',
                          border: `1px solid ${b.type === 'BLOCKING' ? '#fecaca' : '#cbd5e1'}`,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 750,
                          letterSpacing: '0.03em',
                        }}>
                          {b.type || 'NOT BLOCKING'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span style={{ color: '#94a3b8' }}>none</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Production clearance</span>
                <span style={{ color: '#475569', lineHeight: 1.5 }}>{m.productionClearance}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Rules that use it</span>
                <div style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#0284c7', lineHeight: 1.6 }}>
                  {m.rulesThatUseIt || (m.rules && m.rules.length > 0 ? m.rules.join(', ') : 'none')}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Served runs</span>
                <span style={{ color: '#475569' }}>{m.servedRuns || 'none served by this fabric'}</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Source: <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{m.sourceDoc}</span></span>
              {m.sourceDocBadge && (
                <span style={{
                  backgroundColor: '#fef3c7',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontSize: '9.5px',
                  fontWeight: 750,
                }}>
                  {m.sourceDocBadge}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Section: Evaluations ── */}
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 12px', color: '#0f172a' }}>
            Evaluations
          </h2>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            maxWidth: '850px',
          }}>
            {m.evaluations && m.evaluations.length > 0 ? (
              m.evaluations.map((ev, evIdx) => (
                <div key={evIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 750, margin: 0, color: '#0f172a' }}>
                    {ev.title || 'Quoted figure'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>
                    {ev.metrics}
                  </p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
                    {ev.note}
                  </p>
                </div>
              ))
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '12.5px' }}>
                No formal evaluation report attached for this candidate architecture yet.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN TABLE INVENTORY VIEW
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 6px', color: '#0f172a', letterSpacing: '-0.02em' }}>
              Models
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '980px', lineHeight: 1.55 }}>
              Every model and analytical method VisionIQ uses, evaluates or plans. No model has a production clearance record;
              the blocking items say why. A method has parameters, not weights; its accuracy is unmeasured until confirmed ground cases exist.
            </p>
          </div>

          {/* Mode Pill Indicator & Repo Link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href="https://huggingface.co/Sushanthreddy03/vizioniq-ai-models"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0284c7',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '13px' }}>🤗</span>
              <span>HF Repo: <strong>Sushanthreddy03/vizioniq-ai-models</strong></span>
              <ExternalLink size={12} />
            </a>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: isLive ? '#ecfdf5' : '#eff6ff',
              border: `1px solid ${isLive ? '#a7f3d0' : '#bfdbfe'}`,
              fontSize: '12px',
              fontWeight: 700,
              color: isLive ? '#065f46' : '#1e40af',
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isLive ? '#10b981' : '#3b82f6',
                boxShadow: isLive ? '0 0 8px #10b981' : 'none',
              }} />
              <span>{isLive ? 'Live Feed Telemetry Mode' : 'Excel Data Ingestion Mode'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pack Filter & Subtitle Bar ── */}
      <div style={{
        backgroundColor: '#f1f5f9',
        padding: '10px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        fontSize: '13px',
        color: '#475569',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div>
          Showing the <strong style={{ color: '#0f172a' }}>highway pack</strong> only.{' '}
          <button
            type="button"
            onClick={() => setSelectedPack(selectedPack === 'ALL' ? 'HIGHWAY' : 'ALL')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0284c7',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              padding: 0,
            }}
          >
            {selectedPack === 'ALL' ? 'Show highway pack only.' : 'Show every pack.'}
          </button>
        </div>

        {/* Live Active Engine Highlight Pill */}
        {isLive && (
          <div style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={13} />
            <span>Active Inference: <strong>NH5 YOLOv8n-960</strong> + <strong>RapidOCR HSRP</strong></span>
          </div>
        )}
      </div>

      {/* ── Status Count Badges & Search ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {/* Status Filters Bar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { label: 'ALL', count: statusCounts.total, color: '#334155', bg: '#f1f5f9' },
            { label: 'REFERENCE', count: statusCounts.REFERENCE, color: '#0369a1', bg: '#e0f2fe' },
            { label: 'RETIRED', count: statusCounts.RETIRED, color: '#64748b', bg: '#f1f5f9' },
            { label: 'EVALUATION ONLY', count: statusCounts['EVALUATION ONLY'], color: '#b45309', bg: '#fef3c7' },
            { label: 'CANDIDATE', count: statusCounts.CANDIDATE, color: '#0284c7', bg: '#e0f2fe' },
            { label: 'NOT EVALUATED', count: statusCounts['NOT EVALUATED'], color: '#4b5563', bg: '#f3f4f6' },
            { label: 'PLANNED', count: statusCounts.PLANNED, color: '#7e22ce', bg: '#f3e8ff' },
          ].map(({ label, count, color, bg }) => {
            const isSelected = selectedStatus === label
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedStatus(label)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? color : bg,
                  color: isSelected ? '#ffffff' : color,
                  border: isSelected ? `2px solid ${color}` : '1px solid transparent',
                  fontSize: '12px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.01em',
                }}
              >
                <span>{label}</span>
                <span style={{
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}>
                  {count}
                </span>
              </button>
            )
          })}
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#64748b',
            marginLeft: '4px',
          }}>
            model <span style={{ color: '#0f172a' }}>{statusCounts.total}</span>
          </div>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter models, rules, licenses..."
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              outline: 'none',
              backgroundColor: '#ffffff',
            }}
          />
        </div>
      </div>

      {/* ── High-Fidelity Models Table ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 650 }}>
                <th style={{ padding: '12px 14px', minWidth: '160px' }}>Model</th>
                <th style={{ padding: '12px 10px', width: '85px' }}>Pack</th>
                <th style={{ padding: '12px 10px', width: '70px' }}>Kind</th>
                <th style={{ padding: '12px 14px', minWidth: '220px' }}>Task</th>
                <th style={{ padding: '12px 12px', minWidth: '120px' }}>Status</th>
                <th style={{ padding: '12px 14px', minWidth: '180px' }}>Licence</th>
                <th style={{ padding: '12px 12px', minWidth: '110px' }}>Blockers</th>
                <th style={{ padding: '12px 14px', minWidth: '200px' }}>Rules or parameters</th>
                <th style={{ padding: '12px 14px', minWidth: '160px' }}>Speed, as recorded</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No models found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredModels.map((m) => {
                  const statusStyle = getStatusBadgeStyle(m.status)
                  const isAssumed = (m.licence || '').startsWith('ASSUMED')
                  const displayLicence = isAssumed ? m.licence.replace('ASSUMED', '').trim() : m.licence

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedModelId(m.id)}
                      title={`Click to inspect ${m.name} specifications & evaluations`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.1s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      {/* Model */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '12.5px', textDecoration: 'underline' }}>
                          {m.code}
                        </div>
                        <div style={{ color: '#475569', fontSize: '11.5px', marginTop: '2px' }}>
                          {m.name}
                        </div>
                        <a
                          href={m.sourceUrl || 'https://huggingface.co/Sushanthreddy03/vizioniq-ai-models'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#0284c7',
                            fontSize: '11px',
                            marginTop: '3px',
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}
                          title={`View ${m.code} on Hugging Face`}
                        >
                          <span>{m.source || 'Sushanthreddy03/vizioniq-ai-models'}</span>
                          <ExternalLink size={10} />
                        </a>
                      </td>

                      {/* Pack */}
                      <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-block',
                          backgroundColor: '#e0f2fe',
                          color: '#0284c7',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 750,
                          letterSpacing: '0.02em',
                        }}>
                          {m.pack}
                        </span>
                      </td>

                      {/* Kind */}
                      <td style={{ padding: '12px 10px', verticalAlign: 'top', color: '#64748b' }}>
                        {m.kind}
                      </td>

                      {/* Task */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', color: '#334155', lineHeight: 1.45 }}>
                        {m.task}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 750,
                          letterSpacing: '0.02em',
                          ...statusStyle,
                        }}>
                          {m.status}
                        </span>
                      </td>

                      {/* Licence */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', color: '#334155' }}>
                        {isAssumed ? (
                          <span>
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontSize: '10px',
                              fontWeight: 750,
                              marginRight: '6px',
                            }}>
                              ASSUMED
                            </span>
                            {displayLicence}
                          </span>
                        ) : (
                          <span>{m.licence}</span>
                        )}
                      </td>

                      {/* Blockers */}
                      <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                        {m.blockers && m.blockers.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {m.blockers.map((b, bIdx) => (
                              <React.Fragment key={bIdx}>
                                <span style={{
                                  display: 'inline-block',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  fontSize: '10.5px',
                                  fontWeight: 750,
                                }}>
                                  {b.code}
                                </span>
                                {b.type === 'BLOCKING' && (
                                  <span style={{
                                    display: 'inline-block',
                                    backgroundColor: '#fee2e2',
                                    color: '#b91c1c',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    letterSpacing: '0.03em',
                                  }}>
                                    BLOCKING
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>none</span>
                        )}
                      </td>

                      {/* Rules or parameters */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        {m.rules && m.rules.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'monospace', fontSize: '11px', color: '#334155' }}>
                            {m.rules.map((rule, rIdx) => (
                              <span key={rIdx}>{rule}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>none</span>
                        )}
                      </td>

                      {/* Speed, as recorded */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', color: '#475569', fontSize: '11.5px' }}>
                        {m.speed}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
