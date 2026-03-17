/**
 * Fetch wrapper with CSRF token handling and error normalization.
 * All requests go through the Vite proxy (/api → localhost:3000).
 */

let csrfToken: string | null = null;

export interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/csrf-token', { credentials: 'include' });
  const token = res.headers.get('X-CSRF-Token');
  if (!token) throw new Error('Failed to obtain CSRF token');
  csrfToken = token;
  return token;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach CSRF token for state-changing methods
  const method = (options.method ?? 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    headers.set('csrf-token', csrfToken!);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // If CSRF token was rejected, refresh and retry once
  if (res.status === 403) {
    const body = await res.clone().json().catch(() => null);
    if (body?.code === 'EBADCSRFTOKEN') {
      await fetchCsrfToken();
      headers.set('csrf-token', csrfToken!);
      const retry = await fetch(url, { ...options, headers, credentials: 'include' });
      if (!retry.ok) {
        throw await parseError(retry);
      }
      return retry.json() as Promise<T>;
    }
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  return res.json() as Promise<T>;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    // Server returns { error: { code, message } } or { message } depending on endpoint
    const message =
      body.message ??
      (typeof body.error === 'string' ? body.error : body.error?.message) ??
      'Request failed';
    return {
      status: res.status,
      message,
      errors: body.errors ?? body.error?.details,
    };
  } catch {
    return { status: res.status, message: res.statusText || 'Request failed' };
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};
