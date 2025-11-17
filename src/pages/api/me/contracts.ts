import type { NextApiRequest, NextApiResponse } from 'next';
import { getCookie } from '../../../lib/serverCookies';

// Ritorna la mappa lineId -> contractId letta dal cookie httpOnly "line_contracts".
// 200: { map: { "3420217171": "3ce4..." , ... } }
// 404: se la mappa non c'è ancora (prima dell'OTP verify)
// 400: se il cookie è malformato

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const raw = getCookie(req, 'line_contracts');
  if (!raw) return res.status(404).json({ map: {}, message: 'line_contracts cookie not found' });
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const map = JSON.parse(decoded);
    if (!map || typeof map !== 'object') throw new Error('invalid map');
    return res.status(200).json({ map });
  } catch (e: any) {
    return res.status(400).json({ map: {}, error: e?.message || 'invalid cookie content' });
  }
}