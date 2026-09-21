const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

/**
 * Check if the backend is connected to the local Ollama server and if qwen3:8b is loaded.
 */
export async function checkOllamaStatus() {
  try {
    const res = await fetch(`${API_URL}/api/query/ollama-status`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      return { connected: false, message: `Server error: HTTP ${res.status}` }
    }
    return await res.json()
  } catch (err) {
    return { connected: false, message: err.message || 'Cannot reach VisionIQ backend' }
  }
}

/**
 * Send natural language query to backend qwen3:8b endpoint to parse into structured telemetry criteria.
 */
export async function parseNaturalLanguageQuery(query, facets = {}) {
  try {
    const res = await fetch(`${API_URL}/api/query/ai-parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, facets }),
    })
    if (!res.ok) {
      throw new Error(`API responded with HTTP ${res.status}`)
    }
    return await res.json()
  } catch (err) {
    console.warn('[queryApi] AI query backend call failed:', err)
    // Intelligent local client fallback
    const q = (query || '').toLowerCase().trim()
    
    // Multi-vehicle types dynamic detection
    const detectedTypes = []
    if (/\b(?:car|cars|sedan|suv|hatchback)\b/i.test(q)) detectedTypes.push('Car')
    if (/\b(?:bike|bikes|motorcycle|motorcycles|scooter|scooters|two wheeler|two wheelers|cycle|cycles)\b/i.test(q)) detectedTypes.push('Bike')
    if (/\b(?:bus|buses)\b/i.test(q)) detectedTypes.push('Bus')
    if (/\b(?:truck|trucks|lorry|lorries|trailer|trailers)\b/i.test(q)) detectedTypes.push('Truck')
    if (/\b(?:auto|autos|rickshaw|rickshaws|auto rickshaw|autorickshaw)\b/i.test(q)) detectedTypes.push('Auto')
    if (/\b(?:tractor|tractors)\b/i.test(q)) detectedTypes.push('Tractor')
    if (/\b(?:jeep|jeeps)\b/i.test(q)) detectedTypes.push('Jeep')
    if (/\b(?:pedestrian|pedestrians|walking|people|person)\b/i.test(q)) detectedTypes.push('Pedestrian')
    if (/\b(?:van|vans)\b/i.test(q)) detectedTypes.push('Van')
    if (/\b(?:train|trains|metro|rail)\b/i.test(q)) detectedTypes.push('Train')

    const vehicleType = detectedTypes.length === 1 ? detectedTypes[0] : (detectedTypes.length > 1 ? detectedTypes : null)

    const isOverspeed = q.includes('overspeed') || q.includes('speeding') || q.includes('violation')
    const speedMatch = q.match(/(?:speed|>|over|above)\s*(\d+)/i)
    const minSpeed = speedMatch ? parseInt(speedMatch[1], 10) : null

    let location = null
    if (facets.locations && Array.isArray(facets.locations)) {
      for (const loc of facets.locations) {
        if (q.includes(loc.toLowerCase()) || loc.toLowerCase().includes(q)) {
          location = loc
          break
        }
      }
    }

    return {
      success: true,
      aiSource: 'client-rule-engine',
      filters: {
        vehicleType,
        vehicleTypes: detectedTypes,
        minSpeed,
        maxSpeed: null,
        overspeedOnly: isOverspeed,
        location,
        camera: null,
        signalState: q.includes('red') ? 'Red' : q.includes('green') ? 'Green' : q.includes('yellow') ? 'Yellow' : null,
        weather: q.includes('rain') ? 'Rainy' : q.includes('fog') ? 'Foggy' : q.includes('clear') ? 'Clear' : null,
        plateSearch: null,
        sortBy: 'timestamp-desc',
      },
      explanation: `Telemetry segment matching "${query}"`,
      rawQuery: query,
    }
  }
}
