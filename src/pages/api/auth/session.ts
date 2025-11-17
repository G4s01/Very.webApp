import type { NextApiRequest, NextApiResponse } from 'next';
import { getCookie } from '../../../lib/serverCookies';

// Ritorna claims del w3_token (se presente). Altrimenti 401.

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getCookie(req, 'w3_token');
  if (!token) return res.status(401).json({ ok: false });

  try {
    const payload = token.split('.')[1];
    const json = payload ? JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) : null;
    return res.status(200).json({ ok: true, token: true, claims: json || null });
  } catch {
    return res.status(200).json({ ok: true, token: true, claims: null });
  }
}