import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { windHeaders } from '../../../constants/windHeaders';
import {
  getOrSetDeviceId,
  mergeSetCookie,
  readJsonSafe,
  setCookie,
  getCookie,
  setChallengeToken,
} from '../../../lib/serverCookies';
import { dlog } from '../../../lib/debug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const { email, username, msisdn, password } = req.body || {};
  const user = String(email ?? username ?? msisdn ?? '').trim();
  if (!user) return res.status(400).json({ error: 'Email/username mancante' });
  if (!password) return res.status(400).json({ error: 'Password mancante' });

  try {
    const apiBase = process.env.API_BASE || 'https://apigw.verymobile.it/api';
    const deviceId = getOrSetDeviceId(req, res);

    const prevGw = getCookie(req, 'gw_cookie');
    const cookie = prevGw ? decodeURIComponent(prevGw) : undefined;

    const headers = windHeaders({ uuid: deviceId, cookie });

    const body = {
      username: user,
      password: String(password),
      rememberMe: true, // come l'app
    };

    const r = await fetch(`${apiBase}/v1/strong-auth/credentials`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const out = await readJsonSafe(r as any);

    // Gateway cookies
    const gw = mergeSetCookie(r.headers, cookie);
    if (gw) {
      setCookie(res, 'gw_cookie', encodeURIComponent(gw), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
      });
    }

    // Challenge
    const ch = r.headers.get('x-w3-challenge-token') || r.headers.get('X-W3-Challenge-Token');
    if (ch) setChallengeToken(res, ch);

    if (!r.ok) return res.status(r.status).json(out.json ?? { raw: out.text });

    // Salvo anche email “comoda” lato client
    setCookie(res, 'last_email', encodeURIComponent(user), {
      path: '/', httpOnly: false, sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production', maxAge: 60 * 30,
    });

    return res.status(200).json(out.json ?? { raw: out.text });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}