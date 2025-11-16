import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { API_BASE, windHeaders } from '../../constants';
import {
  getCookie,
  getOrSetDeviceId,
  getChallengeToken,
  mergeSetCookie,
  readJsonSafe,
  setCookie,
} from '../../lib/serverCookies';

// Usa Authorization: Bearer <w3_token>. Inoltra challenge se presente.
// Allowlist di prefissi per sicurezza.

const ALLOWED_PREFIX = ['/v0/', '/v1/', '/v2/', '/ob/'];

function normalizePath(p?: string) {
  if (!p) return '';
  return p.replace(/^\/+/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = (req.method || 'GET').toUpperCase();
  const qPath = typeof req.query.path === 'string' ? req.query.path : undefined;
  const bPath = typeof (req.body as any)?.path === 'string' ? (req.body as any).path : undefined;
  const rawPath = bPath || qPath || '';
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  if (!path || path === '/') return res.status(400).json({ error: 'Missing path' });
  if (!ALLOWED_PREFIX.some(pref => path.startsWith(pref))) return res.status(400).json({ error: 'Path not allowed', path });

  try {
    const deviceId = getOrSetDeviceId(req, res);
    const prevGw = getCookie(req, 'gw_cookie');
    const cookie = prevGw ? decodeURIComponent(prevGw) : undefined;
    const bearer = getCookie(req, 'w3_token');
    if (!bearer) return res.status(401).json({ error: 'Missing w3_token. Do OTP verify first.' });

    const challenge = getChallengeToken(req);
    const url = `${API_BASE.replace(/\/+$/, '')}/${normalizePath(path)}`;
    const headers = windHeaders({ uuid: deviceId, cookie, bearerToken: bearer, challengeToken: challenge });

    const init: RequestInit = { method, headers };
    if (!['GET', 'HEAD'].includes(method)) {
      const payload =
        req.body && typeof req.body !== 'string'
          ? JSON.stringify((req.body as any).data ?? req.body)
          : typeof req.body === 'string'
          ? (req.body as string)
          : undefined;
      if (payload !== undefined) (init as any).body = payload;
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json; charset=UTF-8';
    }

    const upstream = await fetch(url, init);
    const out = await readJsonSafe(upstream as any);

    // Propaga/aggiorna challenge se ruota
    const ch = upstream.headers.get('x-w3-challenge-token') || upstream.headers.get('X-W3-Challenge-Token');
    if (ch) {
      setCookie(res, 'w3_challenge', encodeURIComponent(ch), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60,
      });
    }

    const merged = mergeSetCookie(upstream.headers, cookie);
    if (merged) {
      setCookie(res, 'gw_cookie', encodeURIComponent(merged), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
      });
    }

    return res.status(upstream.status).json(out.json ?? { raw: out.text });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}