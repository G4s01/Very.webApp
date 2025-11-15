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

interface ContractLine { id?: string; lines?: any[] }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, otp } = (req.body || {}) as { email?: string; otp?: string };
  if (!email || !otp) return res.status(400).json({ error: 'Missing email or otp' });

  const challenge = getChallengeToken(req);
  if (!challenge) return res.status(412).json({ error: 'Missing challenge token. Call /credentials first.' });

  try {
    const deviceId = getOrSetDeviceId(req, res);
    const prevGw = getCookie(req, 'gw_cookie');
    const cookie = prevGw ? decodeURIComponent(prevGw) : undefined;

    const headers = windHeaders({ uuid: deviceId, cookie, challengeToken: challenge });

    const r = await fetch(`${API_BASE}/v1/strong-auth/otp/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, otp }),
    });
    const out = await readJsonSafe(r);

    const gw = mergeSetCookie(r.headers, cookie);
    if (gw) {
      setCookie(res, 'gw_cookie', encodeURIComponent(gw), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
      });
    }

    const w3Token = r.headers.get('x-w3-token') || r.headers.get('X-W3-Token');
    const buildAt = r.headers.get('x-w3-buildat') || r.headers.get('X-W3-BuildAt');
    if (w3Token) {
      setCookie(res, 'w3_token', w3Token, {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 2,
      });
    }
    if (buildAt) {
      setCookie(res, 'w3_buildat', buildAt, {
        path: '/', httpOnly: false, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 2,
      });
    }

    try {
      const mapping: Record<string, string> = {};
      const contracts = out?.json?.data?.contracts as ContractLine[] | undefined;
      if (Array.isArray(contracts)) {
        contracts.forEach(c => {
          const cid = (c as any)?.id;
          const lines = (c as any)?.lines;
          if (cid && Array.isArray(lines)) {
            lines.forEach(l => {
              const lid = (l && typeof l === 'object') ? l.id : l;
              if (lid) mapping[String(lid)] = String(cid);
            });
          }
        });
      }
      const encoded = Buffer.from(JSON.stringify(mapping), 'utf8').toString('base64');
      setCookie(res, 'line_contracts', encoded, {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
      });
    } catch {}

    return res.status(r.status).json(out.json ?? { raw: out.text });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
