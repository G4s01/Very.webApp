import type { NextApiRequest, NextApiResponse } from 'next';

function clear(res: NextApiResponse, name: string, httpOnly = true) {
  res.setHeader('Set-Cookie', [
    `${name}=; Path=/; Max-Age=0; SameSite=Lax; ${httpOnly ? 'HttpOnly; ' : ''}${process.env.NODE_ENV==='production' ? 'Secure; ' : ''}`.trim()
  ]);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Pulisci tutti i cookie auth correnti
  clear(res, 'gw_cookie', true);
  clear(res, 'w3_token', true);
  clear(res, 'w3_buildat', false);
  clear(res, 'last_email', false);
  // Se usi un cookie per challenge in serverCookies, aggiungilo qui (es. 'w3_challenge')
  clear(res, 'w3_challenge', true);

  return res.status(200).json({ ok: true, message: 'Logged out' });
}