const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '')
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b'

let ollamaCache = { online: false, checkedAt: 0, models: [] }
const OLLAMA_CHECK_INTERVAL = 15000 // 15s cache

const PREFERRED_FAST_MODELS = [
  'qwen2.5:1.5b',
  'qwen2.5:0.5b',
  'llama3.2:1b',
  'llama3.2:3b',
  'qwen2.5:3b',
  'qwen3:8b',
]

async function isOllamaOnline() {
  const now = Date.now()
  if (now - ollamaCache.checkedAt < OLLAMA_CHECK_INTERVAL) {
    return ollamaCache.online
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 800)
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = response.ok ? await response.json() : null
    const models = (data?.models || []).map((m) => m.name)
    ollamaCache = { online: response.ok, checkedAt: now, models }
    return response.ok
  } catch {
    ollamaCache = { online: false, checkedAt: now, models: [] }
    return false
  }
}

function selectBestModel(installedModels = []) {
  if (process.env.OLLAMA_MODEL) {
    const custom = installedModels.find((m) => m === process.env.OLLAMA_MODEL || m.startsWith(process.env.OLLAMA_MODEL))
    if (custom) return custom
  }
  for (const pref of PREFERRED_FAST_MODELS) {
    const match = installedModels.find((m) => m === pref || m.startsWith(pref.split(':')[0]))
    if (match) return match
  }
  return installedModels[0] || DEFAULT_MODEL
}

// Robust, comprehensive rule parser for natural language traffic queries
function fallbackRuleParser(query, facets = {}) {
  const q = String(query || '').toLowerCase().trim()
  const filters = {
    vehicleType: null,
    vehicleTypes: [],
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

  // Overspeed & Reckless Driving
  if (
    q.includes('overspeed') ||
    q.includes('speeding') ||
    q.includes('violation') ||
    q.includes('violator') ||
    q.includes('fast') ||
    q.includes('over speed') ||
    q.includes('rash') ||
    q.includes('reckless') ||
    q.includes('dangerously') ||
    q.includes('challan') ||
    q.includes('over limit') ||
    q.includes('flying')
  ) {
    filters.overspeedOnly = true
  }

  // Speed ranges (e.g. "between 40 and 70", "from 50 to 80")
  const speedRangeMatch = q.match(/(?:between|from)\s*(\d+)\s*(?:and|to|-)\s*(\d+)/i)
  if (speedRangeMatch) {
    filters.minSpeed = parseInt(speedRangeMatch[1], 10)
    filters.maxSpeed = parseInt(speedRangeMatch[2], 10)
  } else {
    // Min speed (e.g. "speed > 60", "speed >= 60", "greater than 60", "over 60", "faster than 60", "above 60", "speed 60 km/h")
    const speedMinMatch = q.match(/(?:speed\s*(?:>|>=|above|over|exceeding|faster than|greater than|more than|higher than|of)?\s*|>|>=|above|over|faster than|greater than|more than|exceeding)\s*(\d+)/i)
    if (speedMinMatch) {
      filters.minSpeed = parseInt(speedMinMatch[1], 10)
    }

    // Max speed (e.g. "speed < 40", "speed <= 40", "slower than 40", "under 40", "below 40", "less than 40")
    const speedMaxMatch = q.match(/(?:speed\s*(?:<|<=|under|below|slower than|less than|lower than)\s*|<|<=|under|below|slower than|less than|lower than)\s*(\d+)/i)
    if (speedMaxMatch) {
      filters.maxSpeed = parseInt(speedMaxMatch[1], 10)
    }
  }

  // Multi-vehicle types detection with broad category groupings
  const detectedTypes = []
  if (/\b(?:car|cars|sedan|suv|hatchback|cab|taxi|four[- ]?wheelers?|4[- ]?wheelers?)\b/i.test(q)) detectedTypes.push('Car')
  if (/\b(?:bike|bikes|motorcycle|motorcycles|scooter|scooters|two[- ]?wheelers?|2[- ]?wheelers?|cycle|cycles|bicycle|bicycles|moped)\b/i.test(q)) detectedTypes.push('Bike')
  if (/\b(?:bus|buses|minibus|coach)\b/i.test(q)) detectedTypes.push('Bus')
  if (/\b(?:truck|trucks|lorry|lorries|trailer|trailers|heavy|dumper|tipper)\b/i.test(q)) detectedTypes.push('Truck')
  if (/\b(?:auto|autos|rickshaw|rickshaws|auto[- ]?rickshaws?|autorickshaw|autorickshaws|3[- ]?wheelers?|three[- ]?wheelers?|tuktuk)\b/i.test(q)) detectedTypes.push('Auto')
  if (/\b(?:tractor|tractors)\b/i.test(q)) detectedTypes.push('Tractor')
  if (/\b(?:jeep|jeeps|4x4|thar)\b/i.test(q)) detectedTypes.push('Jeep')
  if (/\b(?:pedestrian|pedestrians|walking|people|person|edisetrain|edisetrains)\b/i.test(q)) detectedTypes.push('Pedestrian')
  if (/\b(?:van|vans|omni|eeco)\b/i.test(q)) detectedTypes.push('Van')
  if (/\b(?:ambulance|ambulances|emergency)\b/i.test(q)) detectedTypes.push('Ambulance')
  if (/\b(?:train|trains|metro|rail|tram)\b/i.test(q)) detectedTypes.push('Train')

  // Heavy vehicles grouping
  if (/\bheavy(?:\s+vehicles?|\s+transport)?\b/i.test(q)) {
    if (!detectedTypes.includes('Truck')) detectedTypes.push('Truck')
    if (!detectedTypes.includes('Bus')) detectedTypes.push('Bus')
  }
  // Commercial transport grouping
  if (/\bcommercial(?:\s+vehicles?|\s+transport)?\b/i.test(q)) {
    if (!detectedTypes.includes('Truck')) detectedTypes.push('Truck')
    if (!detectedTypes.includes('Bus')) detectedTypes.push('Bus')
    if (!detectedTypes.includes('Auto')) detectedTypes.push('Auto')
  }

  filters.vehicleTypes = detectedTypes
  filters.vehicleType = detectedTypes.length === 1 ? detectedTypes[0] : (detectedTypes.length > 1 ? detectedTypes : null)

  // Signals & Red Light Jumping
  if (
    q.includes('red light') ||
    q.includes('red signal') ||
    q.includes('ran red') ||
    q.includes('jumped red') ||
    q.includes('crossed red') ||
    q.includes('signal jump') ||
    q.includes('signal violation') ||
    /\bred\b/i.test(q)
  ) {
    filters.signalState = 'Red'
  } else if (q.includes('green signal') || q.includes('green light') || /\bgreen\b/i.test(q)) {
    filters.signalState = 'Green'
  } else if (q.includes('yellow') || q.includes('amber')) {
    filters.signalState = 'Yellow'
  }

  // Weather
  if (q.includes('rain') || q.includes('rainy') || q.includes('raining') || q.includes('monsoon') || q.includes('wet')) {
    filters.weather = 'Rainy'
  } else if (q.includes('fog') || q.includes('foggy') || q.includes('mist') || q.includes('misty') || q.includes('smog')) {
    filters.weather = 'Foggy'
  } else if (q.includes('clear') || q.includes('sunny')) {
    filters.weather = 'Clear'
  }

  // Camera matching
  const IGNORE_CAM_WORDS = new Set(['detections', 'records', 'view', 'network', 'graph', 'feed', 's', 'all', 'any'])
  if (facets.cameras && Array.isArray(facets.cameras)) {
    for (const cam of facets.cameras) {
      const camNorm = cam.toLowerCase().replace(/[^a-z0-9]/g, '')
      const qNorm = q.replace(/[^a-z0-9]/g, '')
      if (qNorm.includes(camNorm)) {
        filters.camera = cam
        break
      }
    }
  }
  if (!filters.camera) {
    const camMatch = q.match(/\bcam(?:era)?[-_\s]*(\d+|0[1-9])\b/i)
    if (camMatch && !IGNORE_CAM_WORDS.has(camMatch[1].toLowerCase())) {
      const num = camMatch[1]
      filters.camera = num.length === 1 ? `CAM-0${num}` : `CAM-${num}`
    }
  }

  // Location matching from facets
  const GENERIC_LOC_WORDS = new Set(['road', 'main', 'city', 'street', 'junction', 'lane', 'blvd', 'highway', 'crossing', 'expressway', 'traffic', 'zone', 'area', 'circle', 'bypass', 'way', 'north', 'south', 'east', 'west'])
  if (facets.locations && Array.isArray(facets.locations)) {
    for (const loc of facets.locations) {
      const locLower = loc.toLowerCase()
      if (q.includes(locLower)) {
        filters.location = loc
        break
      }
      const words = locLower.split(/[\s\-_]+/).filter((w) => w.length > 3 && !GENERIC_LOC_WORDS.has(w))
      if (words.length > 0 && words.some((w) => q.includes(w))) {
        filters.location = loc
        break
      }
    }
  }

  // Plate matching pattern: e.g. "TS09AB1234", "TS 09 AB 1234", "MH-12-DE-1433"
  const plateMatch = q.match(/\b([a-z]{2}\s*[-]?\s*[0-9]{1,2}\s*[-]?\s*[a-z]{0,3}\s*[-]?\s*[0-9]{1,4})\b/i)
  if (plateMatch && plateMatch[1].replace(/[^a-z0-9]/gi, '').length >= 4) {
    filters.plateSearch = plateMatch[1].replace(/[\s-]/g, '').toUpperCase()
  }

  // Sort & superlatives
  if (q.includes('fastest') || q.includes('highest speed') || q.includes('top speed') || q.includes('maximum speed')) {
    filters.sortBy = 'speed-desc'
  } else if (q.includes('slowest') || q.includes('lowest speed') || q.includes('traffic jam') || q.includes('crawl')) {
    filters.sortBy = 'speed-asc'
  } else if (q.includes('highest confidence') || q.includes('most confident') || q.includes('clear plate')) {
    filters.sortBy = 'confidence-desc'
  } else if (q.includes('lowest confidence') || q.includes('least confident') || q.includes('blurred') || q.includes('unclear')) {
    filters.sortBy = 'confidence-asc'
  } else if (q.includes('latest') || q.includes('recent') || q.includes('newest')) {
    filters.sortBy = 'timestamp-desc'
  } else if (q.includes('earliest') || q.includes('oldest')) {
    filters.sortBy = 'timestamp-asc'
  }

  // Generate explanation
  const parts = []
  if (filters.vehicleTypes?.length) parts.push(`Vehicle Type: ${filters.vehicleTypes.join(', ')}`)
  else if (filters.vehicleType) parts.push(`Vehicle Type: ${filters.vehicleType}`)
  if (filters.overspeedOnly) parts.push('Over Speed: Yes')
  if (filters.minSpeed && filters.maxSpeed) parts.push(`Speed: ${filters.minSpeed} - ${filters.maxSpeed} km/h`)
  else if (filters.minSpeed) parts.push(`Speed > ${filters.minSpeed} km/h`)
  else if (filters.maxSpeed) parts.push(`Speed < ${filters.maxSpeed} km/h`)
  if (filters.location) parts.push(`Road: ${filters.location}`)
  if (filters.camera) parts.push(`Camera: ${filters.camera}`)
  if (filters.signalState) parts.push(`Signal: ${filters.signalState}`)
  if (filters.weather) parts.push(`Weather: ${filters.weather}`)
  if (filters.plateSearch) parts.push(`Plate: ${filters.plateSearch}`)

  filters.explanation = parts.length
    ? `Filtered telemetry graph segment for ${parts.join(', ')}`
    : `Retrieved telemetry graph segment matching "${query}"`

  return filters
}


// 1. Check Ollama server connectivity & model status
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
        model: DEFAULT_MODEL,
        message: `Ollama responded with HTTP ${response.status}`,
      })
    }

    const data = await response.json()
    const models = (data.models || []).map((m) => m.name)
    const activeModel = selectBestModel(models)

    return res.json({
      connected: true,
      host: OLLAMA_HOST,
      targetModel: activeModel,
      modelAvailable: Boolean(activeModel),
      installedModels: models,
      message: `Ollama connected with high-speed model ${activeModel} ready.`,
    })
  } catch (error) {
    return res.json({
      connected: false,
      host: OLLAMA_HOST,
      model: DEFAULT_MODEL,
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

  // Fast check: If Ollama is offline or unreachable, instantly return the enhanced rule parser (<1ms)
  const isOnline = await isOllamaOnline()
  if (!isOnline) {
    const fallbackFilters = fallbackRuleParser(cleanQuery, facets)
    return res.json({
      success: true,
      aiSource: 'rule-fallback',
      filters: fallbackFilters,
      explanation: fallbackFilters.explanation,
      rawQuery: cleanQuery,
    })
  }

  const activeModel = selectBestModel(ollamaCache.models)
  const knownTypes = facets.types?.length ? facets.types.join(', ') : 'Car, Bus, Truck, Bike, Auto, Tractor, Jeep, Van, Pedestrian'
  const knownLocations = facets.locations?.length ? facets.locations.slice(0, 10).join(', ') : 'Ring Road, Main Junction, Highway 4, MG Road'
  const knownCameras = facets.cameras?.length ? facets.cameras.slice(0, 8).join(', ') : 'CAM-01, CAM-02, CAM-03'

  const prompt = `You are a high-speed traffic intelligence parser. Convert natural language queries into structured JSON filters.
Available Vehicle Types: Car, Bus, Truck, Bike, Auto, Tractor, Jeep, Van, Pedestrian

Rules:
1. "vehicleTypes": Array of strings from available types (e.g. ["Bike", "Auto"]) or null if all vehicle types apply (e.g. "all vehicles", "speeding cars and bikes", "violators at junction").
   - "two-wheelers", "motorcycles", "bikes", "scooters" -> ["Bike"]
   - "three-wheelers", "auto rickshaws", "autos" -> ["Auto"]
   - "heavy vehicles", "commercial transport" -> ["Truck", "Bus"]
   - "four-wheelers" -> ["Car", "Jeep", "Van"]
   - If user doesn't specify a type (e.g. "which vehicles are speeding"), use null.
2. "overspeedOnly": true if query mentions speeding, rash, fast, reckless, violators, over limit. Otherwise null.
3. "minSpeed": number (e.g. "above 80" -> 80, "> 70" -> 70). Otherwise null.
4. "maxSpeed": number (e.g. "under 40" -> 40, "< 50" -> 50). Otherwise null.
5. "signalState": "Red" if jumped signal or red light violation; "Green" or "Yellow" if mentioned; else null.
6. "weather": "Rainy" (rain, monsoon, wet), "Foggy" (mist, fog, low visibility), "Clear" (sunny, clear); else null.
7. "location": matching road name from (${knownLocations}) or null.
8. "camera": matching camera ID from (${knownCameras}) or null.
9. "plateSearch": plate substring or null.
10. "sortBy": "speed-desc" (fastest/speeding), "speed-asc" (slowest), "confidence-asc" (unclear/low confidence), "confidence-desc" (clear/high confidence), "timestamp-desc" (latest/recent).
11. "explanation": 1 concise sentence describing the telemetry segment found.

Query: "${cleanQuery}"
Return ONLY valid JSON:`

  try {
    const controller = new AbortController()
    // 15 second safety timeout (fast models finish in 1-4s)
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        prompt: prompt,
        format: 'json',
        stream: false,
        keep_alive: '2h',
        options: {
          temperature: 0.1,
          num_predict: 120,
          num_thread: 8,
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

    const fallback = fallbackRuleParser(cleanQuery, facets)
    const effectivePlate = fallback.plateSearch || parsed.plateSearch || null

    // Validate minSpeed against hallucinations (e.g. 6900 from plate number TG 11 UV 6900)
    let safeMinSpeed = typeof parsed.minSpeed === 'number' ? parsed.minSpeed : fallback.minSpeed
    if (safeMinSpeed && (safeMinSpeed > 200 || (effectivePlate && effectivePlate.includes(String(safeMinSpeed))))) {
      safeMinSpeed = null
    }

    let safeMaxSpeed = typeof parsed.maxSpeed === 'number' ? parsed.maxSpeed : fallback.maxSpeed
    if (safeMaxSpeed && safeMaxSpeed > 200) {
      safeMaxSpeed = null
    }

    return res.json({
      success: true,
      aiSource: `ollama-${activeModel}`,
      filters: {
        vehicleType: finalVehicleType || fallback.vehicleType,
        vehicleTypes: normalizedTypes.length ? normalizedTypes : fallback.vehicleTypes,
        minSpeed: safeMinSpeed,
        maxSpeed: safeMaxSpeed,
        overspeedOnly: isOverspeed || fallback.overspeedOnly,
        location: parsed.location || fallback.location || null,
        camera: parsed.camera || fallback.camera || null,
        signalState: parsed.signalState || fallback.signalState || null,
        weather: parsed.weather || fallback.weather || null,
        plateSearch: effectivePlate,
        sortBy: parsed.sortBy || fallback.sortBy || 'timestamp-desc',
      },
      explanation: parsed.explanation || fallback.explanation || `AI retrieved traffic telemetry matching "${cleanQuery}"`,
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

function isNaturalLanguageQuery(text) {
  if (!text || !text.trim()) return false
  const t = text.trim()
  if (/^(MATCH|CREATE|MERGE|RETURN|CALL|SHOW|EXPLAIN|PROFILE|OPTIONAL\s+MATCH)\b/i.test(t)) {
    return false
  }
  return true
}

// Rule-based deterministic English-to-Cypher translator
function ruleBasedNaturalToCypher(naturalText) {
  const q = String(naturalText || '').trim()
  const lower = q.toLowerCase()

  // 1. Wildcard / all
  if (lower === 'all' || lower === 'all records' || lower === 'everything' || lower === 'all nodes') {
    return {
      cypher: 'MATCH (n)\nOPTIONAL MATCH (n)-[r]->(m)\nRETURN *',
      explanation: 'Matches all graph nodes and transit relationships.',
    }
  }

  // 2. Extract vehicle type
  const matchedTypes = []
  if (lower.includes('bike') || lower.includes('motorcycle') || lower.includes('scooter') || lower.includes('two wheeler')) matchedTypes.push('Bike')
  if (lower.includes('car') || lower.includes('sedan') || lower.includes('hatchback')) matchedTypes.push('Car')
  if (lower.includes('truck') || lower.includes('lorry')) matchedTypes.push('Truck')
  if (lower.includes('bus')) matchedTypes.push('Bus')
  if (lower.includes('auto') || lower.includes('rickshaw')) matchedTypes.push('Auto')
  if (lower.includes('van')) matchedTypes.push('Van')
  if (lower.includes('tractor')) matchedTypes.push('Tractor')

  // 3. Extract speed
  const speedMatch = lower.match(/(?:speed\s*(?:>|>=|above|over|exceeding|faster than)?\s*|>|>=|above|over)\s*(\d+)/i)
  const minSpeed = speedMatch ? parseInt(speedMatch[1], 10) : null

  // 4. Extract overspeed / violation
  const isOverspeed = lower.includes('overspeed') || lower.includes('speeding') || lower.includes('violation') || lower.includes('violator') || lower.includes('rash')

  // 5. Extract camera or location
  const isCamera = lower.includes('camera') || lower.includes('cam')
  const isLocation = lower.includes('location') || lower.includes('corridor') || lower.includes('road')

  // Build Cypher query
  if (isCamera && isLocation) {
    return {
      cypher: 'MATCH (c:Camera)-[r:MONITORS]->(l:Location)\nRETURN *',
      explanation: 'Cameras monitoring highway corridors.',
    }
  }

  if (isCamera && !matchedTypes.length && !minSpeed && !isOverspeed) {
    const camIdMatch = q.match(/(CAM-[a-zA-Z0-9_-]+)/i)
    if (camIdMatch) {
      return {
        cypher: `MATCH (c:Camera {id: '${camIdMatch[1].toUpperCase()}'})\nRETURN c`,
        explanation: `Camera hub ${camIdMatch[1].toUpperCase()}.`,
      }
    }
    return {
      cypher: 'MATCH (n:Camera)\nRETURN n',
      explanation: 'All highway monitoring cameras.',
    }
  }

  if (isLocation && !matchedTypes.length && !minSpeed && !isOverspeed) {
    return {
      cypher: 'MATCH (n:Location)\nRETURN n',
      explanation: 'All highway corridor locations.',
    }
  }

  if (isOverspeed && !matchedTypes.length && !minSpeed) {
    return {
      cypher: "MATCH (n:Observation)\nWHERE n.overSpeed = 'Yes'\nRETURN n",
      explanation: 'All overspeed violations and offending vehicles.',
    }
  }

  const whereConditions = []
  if (matchedTypes.length === 1) {
    whereConditions.push(`n.vehicleType = '${matchedTypes[0]}'`)
  } else if (matchedTypes.length > 1) {
    whereConditions.push(`n.vehicleType IN [${matchedTypes.map((t) => `'${t}'`).join(', ')}]`)
  }

  if (minSpeed) {
    whereConditions.push(`n.speed > ${minSpeed}`)
  }

  if (isOverspeed && !minSpeed) {
    whereConditions.push("n.overSpeed = 'Yes'")
  }

  const whereClause = whereConditions.length ? `\nWHERE ${whereConditions.join(' AND ')}` : ''
  const cypher = `MATCH (n:Observation)${whereClause}\nRETURN n`
  return {
    cypher,
    explanation: `Telemetry observations filtered by: ${whereConditions.join(', ') || 'all'}`,
  }
}

async function naturalToCypher(req, res) {
  const { query } = req.body || {}
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ success: false, message: 'Query string is required.' })
  }

  const cleanQuery = query.trim()

  // If already Cypher, return as-is
  if (!isNaturalLanguageQuery(cleanQuery)) {
    return res.json({
      success: true,
      cypher: cleanQuery,
      source: 'direct-cypher',
      explanation: 'Direct Cypher query statement.',
    })
  }

  const isOnline = await isOllamaOnline()
  if (!isOnline) {
    const fallback = ruleBasedNaturalToCypher(cleanQuery)
    return res.json({
      success: true,
      cypher: fallback.cypher,
      source: 'rule-engine',
      explanation: fallback.explanation,
      rawQuery: cleanQuery,
    })
  }

  try {
    const activeModel = selectBestModel(ollamaCache.models)
    const prompt = `You are a Cypher query generator for a traffic intelligence knowledge graph.
Knowledge Graph Schema:
- Node Labels:
  - Observation: single vehicle detection record with properties: speed, speedLimit, overSpeed, vehicleType, camera, location, plate
  - Camera: traffic surveillance camera (e.g. CAM-001)
  - Location: corridor/roadway location
  - VehicleType: Car, Bike, Truck, Bus, Auto, Van
  - Violation: overspeeding violations
- Edge Types:
  - (:Observation)-[:CAPTURED_BY]->(:Camera)
  - (:Camera)-[:MONITORS]->(:Location)
  - (:Observation)-[:OF_TYPE]->(:VehicleType)
  - (:Observation)-[:TRIGGERED]->(:Violation)

Instructions:
Convert the user's natural language request into a single, clean Cypher query.
Return ONLY the raw Cypher query. Do NOT include markdown code blocks, backticks, or explanations.

Example 1:
Input: all bikes only
Output: MATCH (n:Observation) WHERE n.vehicleType = 'Bike' RETURN n

Example 2:
Input: cars faster than 70 km/h
Output: MATCH (n:Observation) WHERE n.vehicleType = 'Car' AND n.speed > 70 RETURN n

Example 3:
Input: cameras monitoring locations
Output: MATCH (c:Camera)-[r:MONITORS]->(l:Location) RETURN *

Example 4:
Input: all violators
Output: MATCH (n:Observation) WHERE n.overSpeed = 'Yes' RETURN n

Input: ${cleanQuery}
Output:`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        prompt: prompt,
        stream: false,
        keep_alive: '2h',
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`)
    }

    const data = await response.json()
    let rawOutput = String(data.response || '').trim()

    // Clean backticks or markdown fences
    rawOutput = rawOutput.replace(/```(?:cypher)?/gi, '').replace(/```/g, '').trim()

    // If output is valid Cypher (starts with MATCH, OPTIONAL, RETURN, etc.)
    if (/^(MATCH|OPTIONAL|RETURN|WITH)\b/i.test(rawOutput)) {
      return res.json({
        success: true,
        cypher: rawOutput,
        source: `ollama-${activeModel}`,
        explanation: `AI-converted from "${cleanQuery}" via Ollama (${activeModel})`,
        rawQuery: cleanQuery,
      })
    }

    const fallback = ruleBasedNaturalToCypher(cleanQuery)
    return res.json({
      success: true,
      cypher: fallback.cypher,
      source: 'rule-fallback',
      explanation: fallback.explanation,
      rawQuery: cleanQuery,
    })
  } catch (err) {
    const fallback = ruleBasedNaturalToCypher(cleanQuery)
    return res.json({
      success: true,
      cypher: fallback.cypher,
      source: 'rule-fallback',
      explanation: fallback.explanation,
      fallbackReason: err.message,
      rawQuery: cleanQuery,
    })
  }
}

module.exports = {
  checkOllamaStatus,
  parseNaturalLanguageQuery,
  naturalToCypher,
  ruleBasedNaturalToCypher,
  isNaturalLanguageQuery,
}
