const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'tm_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

// Build "?a=1&b=2" skipping empty values
export function qs(params = {}) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('tm:logout'));
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).message || message;
    } catch { /* not JSON */ }
    throw new Error(message);
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

// Opens a PDF (or any file) that needs the auth header.
// The tab is opened synchronously (inside the click) so popup blockers allow it.
export async function openFile(path) {
  const win = window.open('', '_blank');
  try {
    const res = await api(path, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    throw e;
  }
}

export async function downloadFile(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
