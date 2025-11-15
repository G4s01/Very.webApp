import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { windHeaders } from '../../constants/windHeaders';
import { getOrSetDeviceId, getCookie, mergeSetCookie, readJsonSafe, setCookie } from '../../lib/serverCookies';

// Allowlist semplice per sicurezza
const ALLOWED_PREFIX = ['/v0/', '/v1/', '/v2/', '/ob/'];

function normalizePath(p?: string) {
  if (!p) return '';
  // rimuovi gli slash iniziali per evitare che sovrascriva il path del base
  return p.replace(/^\/+/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = (req.method || 'GET').toUpperCase();

  // path può arrivare in query (?path=/v1/...) o nel body (utile per POST/PUT)
  const qPath = typeof req.query.path === 'string' ? req.query.path : undefined;
  const bPath = typeof (req.body?.path) === 'string' ? req.body.path : undefined;
  const rawPath = bPath || qPath || '';
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  if (!path || path === '/') return res.status(400).json({ error: 'Missing path' });
  if (!ALLOWED_PREFIX.some(pref => path.startsWith(pref))) {
    return res.status(400).json({ error: 'Path not allowed', path });
  }

  try {
    const base = process.env.API_BASE || 'https://apigw.verymobile.it/api';
    // Evita new URL per non perdere /api quando il path ha lo slash iniziale
    const url = `${base}/${normalizePath(path)}`;

    const deviceId = getOrSetDeviceId(req, res);
    const gw = getCookie(req, 'gw_cookie');
    const cookie = gw ? decodeURIComponent(gw) : undefined;
    const bearer = getCookie(req, 'w3_token');
    if (!bearer) return res.status(401).json({ error: 'Missing w3_token. Do OTP verify first.' });

    const headers = windHeaders({ uuid: deviceId, cookie, bearerToken: bearer });

    // Prepara init senza body per GET/HEAD
    const init: RequestInit = { method, headers };

    if (!['GET', 'HEAD'].includes(method)) {
      const payload =
        req.body && typeof req.body !== 'string'
          ? JSON.stringify((req.body as any).data ?? req.body)
          : typeof req.body === 'string'
          ? (req.body as string)
          : undefined;

      if (payload !== undefined) {
        (init as any).body = payload;
      }
    }

    const upstream = await fetch(url, init);
    const out = await readJsonSafe(upstream as any);

    const newGw = mergeSetCookie(upstream.headers, cookie);
    if (newGw) {
      setCookie(res, 'gw_cookie', encodeURIComponent(newGw), {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24,
      });
    }

    return res.status(upstream.status).json(out.json ?? { raw: out.text });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}