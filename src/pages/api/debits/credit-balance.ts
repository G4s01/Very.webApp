import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { windHeaders } from '../../../constants/windHeaders';
import { getOrSetDeviceId, getCookie, mergeSetCookie, readJsonSafe, setCookie } from '../../../lib/serverCookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { lineId } = req.query || {};
  if (!lineId) return res.status(400).json({ error: 'Missing lineId' });

  const apiBase = process.env.API_BASE || 'https://apigw.verymobile.it/api';
  const deviceId = getOrSetDeviceId(req, res);
  const gw = getCookie(req, 'gw_cookie');
  const cookie = gw ? decodeURIComponent(gw) : undefined;
  const bearer = getCookie(req, 'w3_token');
  if (!bearer) return res.status(401).json({ error: 'Missing w3_token. Verify OTP first.' });

  const headers = windHeaders({ uuid: deviceId, cookie, bearerToken: bearer });
  const url = `${apiBase}/v1/debits/credit/balance?lineId=${encodeURIComponent(String(lineId))}`;

  const r = await fetch(url, { method: 'GET', headers });
  const out = await readJsonSafe(r as any);

  const newGw = mergeSetCookie(r.headers, cookie);
  if (newGw) {
    setCookie(res, 'gw_cookie', encodeURIComponent(newGw), {
      path: '/', httpOnly: true, sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
    });
  }
  return res.status(r.status).json(out.json ?? { raw: out.text });
}