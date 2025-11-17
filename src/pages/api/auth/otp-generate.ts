import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { API_BASE, windHeaders } from '../../../constants';
import {
  getCookie,
  getOrSetDeviceId,
  getChallengeToken,
  mergeSetCookie,
  readJsonSafe,
  setChallengeToken,
  setCookie,
} from '../../../lib/serverCookies';

// POST body: { email } oppure { email, customerLine: "<masked>" }
// Richiede header X-W3-Challenge-Token (da cookie w3_challenge)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, customerLine } = (req.body || {}) as { email?: string; customerLine?: string };
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const challenge = getChallengeToken(req);
  if (!challenge) return res.status(412).json({ error: 'Missing challenge token. Run credentials first.' });

  try {
    const deviceId = getOrSetDeviceId(req, res);
    const prevGw = getCookie(req, 'gw_cookie');
    const cookie = prevGw ? decodeURIComponent(prevGw) : undefined;

    const url = `${API_BASE.replace(/\/+$/, '')}/v1/strong-auth/otp/generate`;
    const headers = {
      ...windHeaders({ uuid: deviceId, cookie, challengeToken: challenge }),
      'Content-Type': 'application/json; charset=UTF-8',
    };
    const body = customerLine ? { email, customerLine } : { email };

    const upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const out = await readJsonSafe(upstream as any);

    // Challenge può ruotare
    const ch = upstream.headers.get('x-w3-challenge-token') || upstream.headers.get('X-W3-Challenge-Token');
    if (ch) setChallengeToken(res, ch);

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