import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { API_BASE, windHeaders } from '../../../constants';
import {
  getCookie,
  getOrSetDeviceId,
  getChallengeToken,
  mergeSetCookie,
  readJsonSafe,
  setCookie,
} from '../../../lib/serverCookies';

// POST body: { email, otp }
// Richiede header X-W3-Challenge-Token (da cookie w3_challenge)
// Header risposta: x-w3-token (JWT), x-w3-buildat

interface ContractLine { id?: string; code?: string; contractId?: string; lines?: any[] }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, otp } = (req.body || {}) as { email?: string; otp?: string };
  if (!email || !otp) return res.status(400).json({ error: 'Missing email or otp' });

  const challenge = getChallengeToken(req);
  if (!challenge) return res.status(412).json({ error: 'Missing challenge token. Run credentials first.' });

  try {
    const deviceId = getOrSetDeviceId(req, res);
    const prevGw = getCookie(req, 'gw_cookie');
    const cookie = prevGw ? decodeURIComponent(prevGw) : undefined;

    const url = `${API_BASE.replace(/\/+$/, '')}/v1/strong-auth/otp/verify`;
    const headers = {
      ...windHeaders({ uuid: deviceId, cookie, challengeToken: challenge }),
      'Content-Type': 'application/json; charset=UTF-8',
    };

    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, otp }),
    });
    const out = await readJsonSafe(upstream as any);

    // Aggiorna chain gateway
    const merged = mergeSetCookie(upstream.headers, cookie);
    if (merged) {
      setCookie(res, 'gw_cookie', encodeURIComponent(merged), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
      });
    }

    // Persisti bearer e buildAt
    const w3Token = upstream.headers.get('x-w3-token') || upstream.headers.get('X-W3-Token');
    const buildAt = upstream.headers.get('x-w3-buildat') || upstream.headers.get('X-W3-BuildAt');
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

    // Mappa lineId -> contractId in cookie httpOnly (line_contracts)
    try {
      const mapping: Record<string, string> = {};
      const contracts = out?.json?.data?.contracts as ContractLine[] | undefined;
      if (Array.isArray(contracts)) {
        contracts.forEach(c => {
          const cid = c?.id || c?.code || c?.contractId;
          const lines = c?.lines;
          if (cid && Array.isArray(lines)) {
            lines.forEach(l => {
              const lid = (l && typeof l === 'object') ? (l.id || (l as any)?.lineId) : l;
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

    return res.status(upstream.status).json(out.json ?? { raw: out.text });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}