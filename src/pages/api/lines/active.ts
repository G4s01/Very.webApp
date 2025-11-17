import type { NextApiRequest, NextApiResponse } from 'next';

interface LineContractsMap {
  [lineId: string]: string; // contractId
}

function decodeMap(cookieValue?: string): LineContractsMap {
  if (!cookieValue) return {};
  try {
    const json = Buffer.from(cookieValue, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object') return parsed as LineContractsMap;
  } catch {}
  return {};
}

function setCookie(
  res: NextApiResponse,
  name: string,
  value: string,
  {
    httpOnly = false,
    maxAge = 60 * 60 * 24 * 30,
  }: { httpOnly?: boolean; maxAge?: number } = {}
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.appendHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res: NextApiResponse, name: string) {
  const parts = [`${name}=`, 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.appendHeader('Set-Cookie', parts.join('; '));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = (req.method || 'GET').toUpperCase();
  const mapCookie = req.cookies['line_contracts']; // httpOnly cookie
  const activeClient = req.cookies['active_line'] ? decodeURIComponent(req.cookies['active_line']) : null;

  const map = decodeMap(mapCookie);
  const allLines = Object.keys(map);

  if (method === 'GET') {
    const contractId = activeClient ? map[activeClient] : undefined;
    return res.status(200).json({
      active: activeClient || null,
      contractId: contractId || null,
      available: allLines.map(l => ({ lineId: l, contractId: map[l] })),
    });
  }

  if (method === 'POST') {
    const { lineId } = req.body || {};
    if (!lineId || typeof lineId !== 'string') {
      return res.status(400).json({ error: 'Missing lineId' });
    }
    if (!map[lineId]) {
      return res.status(404).json({ error: 'Line not found in mapping', lineId });
    }
    // Salva scelta linea in cookie non httpOnly (client può leggerlo)
    setCookie(res, 'active_line', lineId, { httpOnly: false });
    return res.status(200).json({ ok: true, active: lineId, contractId: map[lineId] });
  }

  if (method === 'DELETE') {
    clearCookie(res, 'active_line');
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}