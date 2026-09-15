const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim()

export const API_BASE_URL = configuredBaseUrl.replace(/\/$/, '')

export function apiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : ''
}
