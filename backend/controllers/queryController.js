const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '')
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b'

// Robust fallback parsing if Ollama is unreachable or busy
function fallbackRuleParser(query, facets = {}) {
  const q = String(query || '').toLowerCase().trim()
  const filters = {
    vehicleType: null,
    minSpeed: null,
    maxSpeed: null,
    overspeedOnly: null,
    location: null,
    camera: null,
    signalState: null,
    weather: null,
    plateSearch: null,
    sortBy: 'timestamp-desc',
    explanation: `Natural query: "${query}"`,
  }

  // Overspeed
  if (q.includes('overspeed') || q.includes('speeding') || q.includes('violation') || q.includes('fast')) {
    filters.overspeedOnly = true
  }

  // Speed numerical
  const speedMatch = q.match(/(?:speed|>|over|above|faster than)\s*(\d+)/i)
  if (speedMatch) {
    filters.minSpeed = parseInt(speedMatch[1], 10)
  }
  const speedUnderMatch = q.match(/(?:<|under|below|slower than)\s*(\d+)/i)
  if (speedUnderMatch) {
    filters.maxSpeed = parseInt(speedUnderMatch[1], 10)
  }

  // Multi-vehicle types detection (e.g. "all bikes and all autos", "cars and buses")
  const detectedTypes = []
  if (/\b(?:car|cars|sedan|suv|hatchback)\b/i.test(q)) detectedTypes.push('Car')
  if (/\b(?:bike|bikes|motorcycle|motorcycles|scooter|scooters|two wheeler|two wheelers|cycle|cycles)\b/i.test(q)) detectedTypes.push('Bike')
  if (/\b(?:bus|buses)\b/i.test(q)) detectedTypes.push('Bus')
  if (/\b(?:truck|trucks|lorry|lorries|trailer|trailers)\b/i.test(q)) detectedTypes.push('Truck')
  if (/\b(?:auto|autos|rickshaw|rickshaws|auto rickshaw)\b/i.test(q)) detectedTypes.push('Auto')
  if (/\b(?:tractor|tractors)\b/i.test(q)) detectedTypes.push('Tractor')
  if (/\b(?:jeep|jeeps)\b/i.test(q)) detectedTypes.push('Jeep')
  if (/\b(?:pedestrian|pedestrians|walking|people|person)\b/i.test(q)) detectedTypes.push('Pedestrian')
  if (/\b(?:van|vans)\b/i.test(q)) detectedTypes.push('Van')
  if (/\b(?:train|trains|metro|rail)\b/i.test(q)) detectedTypes.push('Train')

  filters.vehicleTypes = detectedTypes
  filters.vehicleType = detectedTypes.length === 1 ? detectedTypes[0] : (detectedTypes.length > 1 ? detectedTypes : null)

  // Signals
  if (q.includes('red light') || q.includes('red signal') || q.includes('ran red')) filters.signalState = 'Red'
  else if (q.includes('green signal') || q.includes('green light')) filters.signalState = 'Green'
  else if (q.includes('yellow') || q.includes('amber')) filters.signalState = 'Yellow'

  // Weather
  if (q.includes('rain') || q.includes('rainy')) filters.weather = 'Rainy'
  else if (q.includes('fog') || q.includes('foggy')) filters.weather = 'Foggy'
  else if (q.includes('clear')) filters.weather = 'Clear'

  // Location matching from facets if provided
  if (facets.locations && Array.isArray(facets.locations)) {
    for (const loc of facets.locations) {
      const locLower = loc.toLowerCase()
      if (q.includes(locLower) || locLower.includes(q)) {
        filters.location = loc
        break
      }
      const words = locLower.split(/\s+/).filter((w) => w.length > 3)
      if (words.some((w) => q.includes(w))) {
        filters.location = loc
        break
      }
    }
  }

  // Camera matching
  const camMatch = q.match(/cam(?:era)?[-_\s]*(\d+|[a-z0-9]+)/i)
  if (camMatch) {
    filters.camera = `CAM-${camMatch[1]}`
  }

  // Plate matching pattern (e.g. MH01, DL04, KA05, etc.)
  const plateMatch = q.match(/\b([a-z]{2}[0-9]{1,2}[a-z]{0,3}[0-9]{1,4})\b/i)
  if (plateMatch) {
    filters.plateSearch = plateMatch[1].toUpperCase()
  }

  // Sort
  if (q.includes('fastest') || q.includes('highest speed')) {
    filters.sortBy = 'speed-desc'
  } else if (q.includes('slowest')) {
    filters.sortBy = 'speed-asc'
  } else if (q.includes('highest confidence') || q.includes('most confident')) {
    filters.sortBy = 'confidence-desc'
  }

  // Generate explanation
  const parts = []
  if (filters.vehicleType) parts.push(`Vehicle Type: ${filters.vehicleType}`)
  if (filters.overspeedOnly) parts.push('Over Speed: Yes')
  if (filters.minSpeed) parts.push(`Speed > ${filters.minSpeed} km/h`)
  if (filters.location) parts.push(`Road: ${filters.location}`)
  if (filters.signalState) parts.push(`Signal: ${filters.signalState}`)
  if (filters.camera) parts.push(`Camera: ${filters.camera}`)

  filters.explanation = parts.length
    ? `Filtered telemetry graph segment for ${parts.join(', ')}`
    : `Retrieved telemetry graph segment matching "${query}"`

  return filters
}

// 1. Check Ollama server connectivity & qwen3:8b status
async function checkOllamaStatus(req, res) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return res.json({
        connected: false,
        host: OLLAMA_HOST,
        model: OLLAMA_MODEL,
        message: `Ollama responded with HTTP ${response.status}`,
      })
    }

    const data = await response.json()
    const models = (data.models || []).map((m) => m.name)
    const modelFound = models.some((m) => m === OLLAMA_MODEL || m.startsWith(OLLAMA_MODEL.split(':')[0]))

    return res.json({
      connected: true,
      host: OLLAMA_HOST,
      targetModel: OLLAMA_MODEL,
      modelAvailable: modelFound,
      installedModels: models,
      message: modelFound
        ? `Ollama connected with ${OLLAMA_MODEL} model ready.`
        : `Ollama connected, but ${OLLAMA_MODEL} not found in [${models.join(', ')}]`,
    })
  } catch (error) {
    return res.json({
      connected: false,
      host: OLLAMA_HOST,
      model: OLLAMA_MODEL,
      message: `Could not connect to Ollama at ${OLLAMA_HOST} (${error.message})`,
    })
  }
}

// 2. Parse natural language traffic query into structured filters using qwen3:8b
async function parseNaturalLanguageQuery(req, res) {
  const { query, facets = {} } = req.body

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ success: false, message: 'Query string is required.' })
  }

  const cleanQuery = query.trim()

  const knownTypes = facets.types?.length ? facets.types.join(', ') : 'Car, Bus, Truck, Bike, Auto, Tractor'
  const knownLocations = facets.locations?.length ? facets.locations.slice(0, 10).join(', ') : 'Ring Road, Main Junction, Highway 4, MG Road'
  const knownCameras = facets.cameras?.length ? facets.cameras.slice(0, 8).join(', ') : 'CAM-01, CAM-02, CAM-03'

  const prompt = `Convert traffic query to JSON filter.
Fields:
- vehicleTypes: array of strings from (${knownTypes}) or null (e.g. if query asks for bikes and autos, return ["Bike", "Auto"]; if only bikes, return ["Bike"])
- vehicleType: string or array of strings or null
- minSpeed: number or null
- maxSpeed: number or null
- overspeedOnly: boolean or null
- location: string or array of strings or null (${knownLocations})
- camera: string or null (${knownCameras})
- signalState: "Green"|"Red"|"Yellow"|null
- weather: "Clear"|"Rainy"|"Foggy"|null
- plateSearch: string or null
- sortBy: "timestamp-desc"|"speed-desc"|"confidence-desc"
- explanation: concise 1-sentence description

Query: "${cleanQuery}"
Return ONLY valid JSON:`

  try {
    const controller = new AbortController()
    // 60 second timeout for CPU inference
    const timeout = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        format: 'json',
        stream: false,
        keep_alive: '2h',
        options: {
          temperature: 0.1,
          num_predict: 350,
        },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Ollama HTTP error ${response.status}`)
    }

    const data = await response.json()
    let rawText = (data.response || '').trim()
    // Strip <think>...</think> reasoning tags if emitted by Qwen/DeepSeek
    rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    // Strip markdown code fences if present
    rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch {
      // If output had leading/trailing text, extract JSON block
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        throw new Error('Could not parse JSON from model output')
      }
    }

    // Extract and normalize all vehicle types (supports single string or array of strings)
    const rawTypes = []
    if (Array.isArray(parsed.vehicleTypes)) rawTypes.push(...parsed.vehicleTypes)
    if (Array.isArray(parsed.vehicleType)) rawTypes.push(...parsed.vehicleType)
    else if (typeof parsed.vehicleType === 'string') rawTypes.push(parsed.vehicleType)

    const normalizedTypes = Array.from(new Set(rawTypes.map((t) => {
      const v = String(t || '').trim().toLowerCase()
      if (v.startsWith('car') || v === 'sedan' || v === 'suv') return 'Car'
      if (v.startsWith('bike') || v.startsWith('motorcycle') || v.startsWith('scooter') || v.startsWith('cycle') || v.startsWith('two wheeler')) return 'Bike'
      if (v.startsWith('bus')) return 'Bus'
      if (v.startsWith('truck') || v.startsWith('lorry') || v.startsWith('trailer')) return 'Truck'
      if (v.startsWith('auto') || v.startsWith('rickshaw')) return 'Auto'
      if (v.startsWith('tractor')) return 'Tractor'
      if (v.startsWith('jeep')) return 'Jeep'
      if (v.startsWith('pedestrian') || v.startsWith('walking')) return 'Pedestrian'
      if (v.startsWith('van')) return 'Van'
      if (v.startsWith('train') || v.startsWith('metro')) return 'Train'
      return String(t).trim()
    }).filter(Boolean)))

    const finalVehicleType = normalizedTypes.length === 1 ? normalizedTypes[0] : (normalizedTypes.length > 1 ? normalizedTypes : null)
    const isOverspeed = parsed.overspeedOnly === true || parsed.overspeedOnly === 'true' || parsed.overspeedOnly === 'Yes'

    return res.json({
      success: true,
      aiSource: `ollama-${OLLAMA_MODEL}`,
      filters: {
        vehicleType: finalVehicleType,
        vehicleTypes: normalizedTypes,
        minSpeed: typeof parsed.minSpeed === 'number' ? parsed.minSpeed : null,
        maxSpeed: typeof parsed.maxSpeed === 'number' ? parsed.maxSpeed : null,
        overspeedOnly: isOverspeed,
        location: parsed.location || null,
        camera: parsed.camera || null,
        signalState: parsed.signalState || null,
        weather: parsed.weather || null,
        plateSearch: parsed.plateSearch || null,
        sortBy: parsed.sortBy || 'timestamp-desc',
      },
      explanation: parsed.explanation || `AI retrieved traffic telemetry matching "${cleanQuery}"`,
      rawQuery: cleanQuery,
    })
  } catch (err) {
    console.warn(`[Ollama Query] AI generation failed or timed out (${err.message}). Using fallback parser.`)
    const fallbackFilters = fallbackRuleParser(cleanQuery, facets)
    return res.json({
      success: true,
      aiSource: 'rule-fallback',
      fallbackReason: err.message,
      filters: fallbackFilters,
      explanation: fallbackFilters.explanation,
      rawQuery: cleanQuery,
    })
  }
}

module.exports = {
  checkOllamaStatus,
  parseNaturalLanguageQuery,
}
