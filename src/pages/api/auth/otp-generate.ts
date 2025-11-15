import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { windHeaders, API_BASE } from '../../../constants';
import {
  getOrSetDeviceId,
  getCookie,
  mergeSetCookie,
  readJsonSafe,
  setCookie,
  getChallengeToken,
} from '../../../lib/serverCookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, customerLine } = (req.body || {}) as { email?: string; customerLine?: string };
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const challenge = getChallengeToken(req);
  if (!challenge) return res.status(412).json({ error: 'Missing challenge token. Call /credentials first.' });

  try {
    const deviceId = getOrSetDeviceId(req, res);
    const prevGw = getCookie(req, 'gw_cookie');
    const cookie = prevGw ? decodeURIComponent(prevGw) : undefined;

    const headers = windHeaders({ uuid: deviceId, cookie, challengeToken: challenge });
    const body = customerLine ? { email, customerLine } : { email };

    const r = await fetch(`${API_BASE}/v1/strong-auth/otp/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const out = await readJsonSafe(r);

    const gw = mergeSetCookie(r.headers, cookie);
    if (gw) {
      setCookie(res, 'gw_cookie', encodeURIComponent(gw), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
      });
    }

    return res.status(r.status).json(out.json ?? { raw: out.text });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
