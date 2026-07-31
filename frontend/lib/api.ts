const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
const WS_BASE = (() => {
  const url = new URL(API_BASE);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}`;
})();
export { API_BASE, WS_BASE };
export async function apiFetch(url: string, options: RequestInit = {}) {
  const resolvedUrl = url.replace(`${process.env.NEXT_PUBLIC_API_URL}`, API_BASE);

  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (API_BASE.includes('ngrok')) {
    headers.set('ngrok-skip-browser-warning', 'true');
  }

  const response = await fetch(resolvedUrl, {
    ...options,
    headers,
    credentials: 'include',
  });

  const isLoginRequest = resolvedUrl.includes('/login');

  if (response.status === 401 && !isLoginRequest) {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login?error=session_expired';
    return Promise.reject('Unauthorized');
  }

  return response;
}

export async function logout() {
  try {
    await apiFetch(`${API_BASE}/logout`, { method: 'POST' });
  } catch {}
  finally {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  }
}

export async function getApproverEmails(): Promise<string[]> {
  try {
    const response = await apiFetch(`${API_BASE}/approvers-emails`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}