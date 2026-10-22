const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function getNetworkOverview() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/network/overview`)
    if (!response.ok) return null
    const result = await response.json()
    return result.success ? result.data : null
  } catch {
    return null
  }
}