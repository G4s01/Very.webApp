import type { NextApiRequest, NextApiResponse } from 'next';

function b64urlDecode(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const str = s + '='.repeat(pad);
  return Buffer.from(str, 'base64').toString('utf8');
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies['w3_token'];
  const buildAt = req.cookies['w3_buildat'] || null;
  if (!token) return res.status(401).json({ error: 'Missing w3_token (login needed)' });

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return res.status(200).json({ token, buildAt, claims: null });

    const claims = JSON.parse(b64urlDecode(parts[1]));
    return res.status(200).json({ token, buildAt, claims });
  } catch (e: any) {
    return res.status(200).json({ token, buildAt, claims: null, parseError: e.message || String(e) });
  }
}