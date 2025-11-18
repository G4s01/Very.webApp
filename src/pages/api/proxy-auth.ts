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
  clearCookie,
} from '../../lib/serverCookies';

const ALLOWED_PREFIX = ['/v0/', '/v1/', '/v2/', '/ob/'];

function normalizePath(p?: string) {
  if (!p) return '';
  return p.replace(/^\/+/, '');
}

/**
 * Proxy to upstream API with basic token handling.
 *
 * Improvements:
 *  - if upstream returns 401 with token expired, attempt a server-side refresh
 *    using UPSTREAM_AUTH_REFRESH (if configured). If refresh succeeds, retry
 *    the original request using merged cookies returned by the refresh call.
 */
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

    // First attempt to call upstream
    let upstream = await fetch(url, init);
    let out = await readJsonSafe(upstream as any);

    // If upstream returned 401 and message hints token expiry, try server-side refresh
    if (upstream.status === 401) {
      const msg = out?.json?.message || out?.text || 'Unauthorized';
      const isExpired = typeof msg === 'string' && msg.toLowerCase().includes('token expired');

      if (isExpired) {
        // Attempt server-side refresh if configured
        const refreshUrl = process.env.UPSTREAM_AUTH_REFRESH;
        if (refreshUrl) {
          try {
            const refreshHeaders: Record<string, string> = {};
            // forward the current gw_cookie/raw cookie string to upstream refresh
            if (cookie) refreshHeaders['cookie'] = cookie;
            else if (req.headers.cookie) refreshHeaders['cookie'] = String(req.headers.cookie);

            const refreshRes = await fetch(refreshUrl, {
              method: 'POST',
              headers: refreshHeaders,
            });

            // read refresh response body (for debugging and propagation)
            const refreshOut = await readJsonSafe(refreshRes as any);

            if (refreshRes.ok) {
              // Merge cookies returned by refresh with previous cookie set
              const mergedAfterRefresh = mergeSetCookie(refreshRes.headers, cookie);
              if (mergedAfterRefresh) {
                // persist merged gw_cookie similarly to upstream handling
                setCookie(res, 'gw_cookie', encodeURIComponent(mergedAfterRefresh), {
                  path: '/', httpOnly: true, sameSite: 'Lax',
                  secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
                });
              }

              // Prepare headers for retry: use merged cookies as the cookie header
              const retryCookieHeader = mergedAfterRefresh || cookie || (req.headers.cookie ? String(req.headers.cookie) : undefined);
              const retryHeaders = windHeaders({ uuid: deviceId, cookie: retryCookieHeader, bearerToken: undefined, challengeToken: challenge });
              const retryInit: RequestInit = { method, headers: retryHeaders };
              if (!['GET', 'HEAD'].includes(method)) {
                if ((init as any).body !== undefined) (retryInit as any).body = (init as any).body;
                (retryInit.headers as Record<string, string>)['Content-Type'] = 'application/json; charset=UTF-8';
              }

              // Retry the original request with refreshed cookies
              upstream = await fetch(url, retryInit);
              out = await readJsonSafe(upstream as any);

              // If retry succeeded, fall through and proxy response
              if (upstream.status !== 401) {
                // allow normal processing below
              } else {
                // retry still unauthorized -> clear token and respond accordingly
                clearCookie(res, 'w3_token');
                res.setHeader('Cache-Control', 'no-store');
                return res.status(401).json(out.json ?? { raw: out.text });
              }
            } else {
              // refresh failed -> clear token and notify client
              clearCookie(res, 'w3_token');
              res.setHeader('Cache-Control', 'no-store');
              const failMsg = refreshOut?.json?.message || refreshOut?.text || 'Refresh failed';
              return res.status(401).json({ error: 'TOKEN_EXPIRED', message: failMsg });
            }
          } catch (refreshErr: any) {
            console.error('[proxy-auth] refresh error', refreshErr);
            clearCookie(res, 'w3_token');
            res.setHeader('Cache-Control', 'no-store');
            return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Refresh attempt failed' });
          }
        } else {
          // No refresh endpoint configured: clear token and return TOKEN_EXPIRED
          clearCookie(res, 'w3_token');
          res.setHeader('Cache-Control', 'no-store');
          return res.status(401).json({ error: 'TOKEN_EXPIRED', message: msg });
        }
      } else {
        // other 401
        res.setHeader('Cache-Control', 'no-store');
        return res.status(401).json(out.json ?? { raw: out.text });
      }
    }

    // If upstream provided a challenge token, persist it (note: proxy previously used 1h)
    const ch = upstream.headers.get('x-w3-challenge-token') || upstream.headers.get('X-W3-Challenge-Token');
    if (ch) {
      setCookie(res, 'w3_challenge', encodeURIComponent(ch), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60,
      });
    }

    // Merge set-cookie values from upstream into gw_cookie (existing behaviour)
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