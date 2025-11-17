import type { NextApiRequest, NextApiResponse } from 'next';

function b64urlDecode(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const str = s + '='.repeat(pad);
  return Buffer.from(str, 'base64').toString('utf8');
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies['w3_token'];
  if (!token) return res.status(401).json({ error: 'Missing w3_token' });

  // line -> contract mapping dal cookie
  let map: Record<string, string> = {};
  const mapCookie = req.cookies['line_contracts'];
  if (mapCookie) {
    try {
      map = JSON.parse(Buffer.from(mapCookie, 'base64').toString('utf8'));
    } catch {}
  }

  // prendi elenco linee dal token (claims.contracts[].lines[])
  try {
    const parts = token.split('.');
    const claims = JSON.parse(b64urlDecode(parts[1]));
    const contracts = Array.isArray(claims?.contracts) ? claims.contracts : [];
    const lines: Array<{ lineId: string; contractId?: string }> = [];
    contracts.forEach((c: any) => {
      const arr = Array.isArray(c?.lines) ? c.lines : [];
      arr.forEach((lid: any) => {
        const lineId = String(lid);
        lines.push({ lineId, contractId: map[lineId] });
      });
    });
    return res.status(200).json({ lines });
  } catch (e: any) {
    return res.status(200).json({ lines: [] });
  }
}