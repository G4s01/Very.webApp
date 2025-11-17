import type { NextApiRequest, NextApiResponse } from 'next';
import { clearCookie } from '../../../lib/serverCookies';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const names = [
    'gw_cookie',
    'w3_token',
    'w3_buildat',
    'w3_challenge',
    'line_contracts',
    'active_line',
    'last_email',
    // opzionale/legacy
    'device_id',
    'session_token',
    'auth_token',
  ];
  for (const n of names) clearCookie(res, n);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
}