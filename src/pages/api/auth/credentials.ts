import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { API_BASE, windHeaders } from '../../../constants';
import {
  getCookie,
  getOrSetDeviceId,
  mergeSetCookie,
  readJsonSafe,
  setChallengeToken,
  setCookie,
  clearCookie
} from '../../../lib/serverCookies';

// Se upstream risponde 200 OK senza challenge:
// - retry1: elimina gw_cookie (non persiste) mantiene stesso device
// - retry2: nuovo deviceId senza cookie
// Se ancora no challenge → 503 ERR_NO_CHALLENGE

async function upstreamCall(url: string, headers: Record<string,string>, username: string, password: string) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ username, password, rememberMe: true })
  });
  const out = await readJsonSafe(r as any);
  return { r, out };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, email, password } = (req.body || {}) as { username?: string; email?: string; password?: string };
  const user = (username || email || '').trim();
  if (!user || !password) return res.status(400).json({ error: 'Missing username/email or password' });

  const base = API_BASE.replace(/\/+$/, '');
  const url = `${base}/v1/strong-auth/credentials`;

  // Primo tentativo
  const deviceId = getOrSetDeviceId(req, res);
  const gwRaw = getCookie(req, 'gw_cookie');
  const gwChain = gwRaw ? decodeURIComponent(gwRaw) : undefined;

  let { r, out } = await upstreamCall(url, windHeaders({ uuid: deviceId, cookie: gwChain }), user, password);
  let challenge = r.headers.get('x-w3-challenge-token') || r.headers.get('X-W3-Challenge-Token');

  if (r.status !== 200) {
    // errore “normale”
    const mergedErr = mergeSetCookie(r.headers, gwChain);
    if (mergedErr) {
      setCookie(res, 'gw_cookie', encodeURIComponent(mergedErr), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 86400,
      });
    }
    return res.status(r.status).json(out.json ?? { raw: out.text });
  }

  if (!challenge) {
    // retry1 (senza cookie)
    clearCookie(res, 'gw_cookie');
    ({ r, out } = await upstreamCall(url, windHeaders({ uuid: deviceId }), user, password));
    challenge = r.headers.get('x-w3-challenge-token') || r.headers.get('X-W3-Challenge-Token');
  }

  if (r.status === 200 && !challenge) {
    // retry2 (nuovo device id)
    const newDev = `web-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    setCookie(res, 'device_id', newDev, {
      path: '/', httpOnly: false, sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production', maxAge: 31536000,
    });
    ({ r, out } = await upstreamCall(url, windHeaders({ uuid: newDev }), user, password));
    challenge = r.headers.get('x-w3-challenge-token') || r.headers.get('X-W3-Challenge-Token');
  }

  // Ora processa risultato finale
  if (r.status !== 200) {
    return res.status(r.status).json(out.json ?? { raw: out.text });
  }

  const merged = mergeSetCookie(r.headers, gwChain);
  if (merged) {
    setCookie(res, 'gw_cookie', encodeURIComponent(merged), {
      path: '/', httpOnly: true, sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production', maxAge: 86400,
    });
  }

  setCookie(res, 'last_email', encodeURIComponent(user), {
    path: '/', httpOnly: false, sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production', maxAge: 21600,
  });

  if (!challenge) {
    return res.status(503).json({
      status: 'FAIL',
      errorCodes: ['ERR_NO_CHALLENGE'],
      messages: [{ type: 'BSN', message: 'Challenge non fornito dall’upstream dopo retry.' }],
      data: { customerLines: out.json?.data?.customerLines || [] }
    });
  }

  setChallengeToken(res, challenge);
  return res.status(200).json(out.json ?? { raw: out.text });
}