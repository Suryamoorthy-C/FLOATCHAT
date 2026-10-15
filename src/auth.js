const STORAGE_KEY = 'floatchat.supabase.session';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function saveSession(session) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
  return session;
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function authRequest(path, options = {}) {
  if (!isSupabaseAuthConfigured) {
    throw new Error('Account login is not configured yet. Add the Supabase public URL and anon key.');
  }
  const { accessToken, ...requestOptions } = options;
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...requestOptions,
    headers: { ...authHeaders(accessToken), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.msg || body.message || body.error_description || body.error || 'Authentication request failed.');
  return body;
}

export async function signIn(email, password) {
  const session = await authRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return saveSession(session);
}

export async function signUp(email, password, displayName) {
  const result = await authRequest('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { display_name: displayName } }),
  });
  return saveSession(result.access_token ? result : null) || result;
}

export async function getSession() {
  const session = getStoredSession();
  if (!session?.access_token) return null;
  try {
    const user = await authRequest('/auth/v1/user', { method: 'GET', accessToken: session.access_token });
    return saveSession({ ...session, user });
  } catch {
    saveSession(null);
    return null;
  }
}

export async function signOut() {
  const session = getStoredSession();
  if (session?.access_token && isSupabaseAuthConfigured) {
    await authRequest('/auth/v1/logout', { method: 'POST', accessToken: session.access_token }).catch(() => {});
  }
  saveSession(null);
}

export function getAccessToken() {
  return getStoredSession()?.access_token || '';
}
