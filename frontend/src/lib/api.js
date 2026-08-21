const configuredBase = String(import.meta.env.VITE_API_URL || '').trim();
export const API_BASE_URL = configuredBase.replace(/\/$/, '');

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}
