// lib/apiClient.ts
export async function apiFetch(url: string, options: RequestInit = {}) {
  const appId = process.env.NEXT_PUBLIC_APP_ID as string;

  const headers: HeadersInit = {
    ...(options.headers || {}),
    'x-app-id': appId,
    'Content-Type': 'application/json',
  };

  return fetch(url, {
    ...options,
    headers,
  });
}