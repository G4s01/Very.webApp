import type { NextApiRequest, NextApiResponse } from 'next';

export function getCookie(req: NextApiRequest, name: string): string | undefined {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map(s => s.trim());
  for (const p of parts) {
    const [k, ...rest] = p.split('=');
    if (k === name) return rest.join('=');
  }
  return undefined;
}

export function setCookie(res: NextApiResponse, name: string, value: string, opts?: {
  path?: string; httpOnly?: boolean; sameSite?: 'Lax'|'Strict'|'None'; secure?: boolean; maxAge?: number;
}) {
  const pieces = [`${name}=${value}`];
  pieces.push(`Path=${opts?.path ?? '/'}`);
  if (opts?.httpOnly) pieces.push('HttpOnly');
  if (opts?.sameSite) pieces.push(`SameSite=${opts.sameSite}`);
  if (opts?.secure) pieces.push('Secure');
  if (typeof opts?.maxAge === 'number') pieces.push(`Max-Age=${opts.maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  const next = Array.isArray(prev) ? [...prev, pieces.join('; ')] : pieces.join('; ');
  res.setHeader('Set-Cookie', next as any);
}

export function clearCookie(res: NextApiResponse, name: string) {
  setCookie(res, name, '', { path: '/', maxAge: 0 });
}

export function getOrSetDeviceId(req: NextApiRequest, res: NextApiResponse): string {
  let id = getCookie(req, 'device_id');
  if (!id) {
    id = `web-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    setCookie(res, 'device_id', id, {
      path: '/', sameSite: 'Lax', httpOnly: false,
      secure: process.env.NODE_ENV === 'production', maxAge: 60*60*24*365
    });
  }
  return id;
}

function getSetCookiesArray(headers: Headers): string[] {
  const any = headers as any;
  if (typeof any.getSetCookie === 'function') { try { return any.getSetCookie(); } catch {} }
  if (typeof any.raw === 'function') { try {
    const raw = any.raw(); if (raw?.['set-cookie']) return raw['set-cookie'];
  } catch {} }
  const merged = (headers as any).get?.('set-cookie');
  return merged ? [merged] : [];
}

export function mergeSetCookie(headers: Headers, prev?: string): string {
  const setCookies = getSetCookiesArray(headers);
  const pairs: string[] = [];
  if (prev) pairs.push(...prev.split(';').map(s => s.trim()).filter(Boolean));
  for (const sc of setCookies) {
    const nv = sc.split(';')[0].trim();
    if (nv) pairs.push(nv);
  }
  const map = new Map<string,string>();
  for (const p of pairs) {
    const [n, ...rest] = p.split('=');
    if (n) map.set(n, `${n}=${rest.join('=')}`);
  }
  return Array.from(map.values()).join('; ');
}

export function getChallengeToken(req: NextApiRequest): string | undefined {
  const v = getCookie(req, 'w3_challenge');
  return v ? decodeURIComponent(v) : undefined;
}
export function setChallengeToken(res: NextApiResponse, token: string) {
  setCookie(res, 'w3_challenge', encodeURIComponent(token), {
    path: '/', httpOnly: true, sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production', maxAge: 60*60*6
  });
}

// Map linea (suffix4 -> msisdn); fallback se cookie più vecchio aveva solo 3 cifre.
export function getLineMap(req: NextApiRequest): Record<string,string> {
  const v = getCookie(req, 'line_map');
  if (!v) return {};
  try {
    return JSON.parse(decodeURIComponent(v));
  } catch {
    return {};
  }
}
export function setLineMap(res: NextApiResponse, map: Record<string,string>) {
  setCookie(res, 'line_map', encodeURIComponent(JSON.stringify(map)), {
    path: '/', httpOnly: true, sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production', maxAge: 60*60*24*180
  });
}

export async function readJsonSafe(r: Response): Promise<{ json: any; text: string }> {
  const t = await (r as any).text().catch(() => '');
  try { return { json: JSON.parse(t), text: t }; } catch { return { json: null, text: t }; }
}