const API_BASE = window.API_BASE || '/api';

const getToken = () => localStorage.getItem('sari_token');
const getUser  = () => JSON.parse(localStorage.getItem('sari_user') || 'null');

const setSession = (token, refresh, user) => {
  localStorage.setItem('sari_token', token);
  localStorage.setItem('sari_refresh', refresh);
  localStorage.setItem('sari_user', JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem('sari_token');
  localStorage.removeItem('sari_refresh');
  localStorage.removeItem('sari_user');
};

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch(path, options);
    clearSession();
    window.location.href = '/login.html';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function tryRefresh() {
  const refresh = localStorage.getItem('sari_refresh');
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('sari_token', data.access_token);
    localStorage.setItem('sari_refresh', data.refresh_token);
    return true;
  } catch { return false; }
}

function requireAuth(requiredRole) {
  const user = getUser();
  if (!user || !getToken()) {
    window.location.href = '/login.html';
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

function showAdminNav() {
  const user = getUser();
  if (user && user.role === 'admin') {
    document.querySelectorAll('[data-admin]').forEach(el => el.removeAttribute('hidden'));
  }
}

function fillUserInfo() {
  const user = getUser();
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.full_name);
  document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1));
}

async function handleLogout() {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  clearSession();
  window.location.href = '/login.html';
}
