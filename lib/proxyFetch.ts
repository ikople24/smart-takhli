// lib/proxyFetch.ts
import type { NextApiRequest } from 'next';

export async function proxyFetch(req: NextApiRequest, backendPath: string) {
  const BACKEND_API_URL = process.env.BACKEND_API_URL;
  const APP_ID = process.env.NEXT_PUBLIC_APP_ID;

  if (!BACKEND_API_URL || !APP_ID) {
    throw new Error("Missing BACKEND_API_URL or APP_ID");
  }

  const url = `${BACKEND_API_URL}${backendPath}`;
  const response = await fetch(url, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'x-app-id': APP_ID,
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    return { status: response.status, body: data };
  } else {
    const text = await response.text();
    return { status: response.status, body: text };
  }
}