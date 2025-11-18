import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { windHeaders, API_BASE } from '../../../constants';
import { getOrSetDeviceId } from '../../../lib/serverCookies';

// API per il flusso di "Password dimenticata" via email (usare endpoint reale di Very se differisce)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const deviceId = getOrSetDeviceId(req, res);
    const headers = windHeaders({ uuid: deviceId });
    // URL endpoint fittizio, adattalo se serve!
    const r = await fetch(`${API_BASE}/v1/strong-auth/password/forgot`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email }),
    });
    const out = await r.json().catch(() => ({}));
    return res.status(r.status).json(out);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}