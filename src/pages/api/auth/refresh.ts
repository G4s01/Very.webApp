import type { NextApiRequest, NextApiResponse } from 'next';
import { mergeSetCookie } from '../../../lib/serverCookies';

/**
 * Proxy endpoint for upstream refresh.
 *
 * - Requires environment variable UPSTREAM_AUTH_REFRESH set to the upstream refresh URL.
 * - Forwards client cookies to upstream and propagates Set-Cookie from upstream back to the browser.
 *
 * Note: adapt headers/body if the upstream refresh API requires specific payload.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const upstreamUrl = process.env.UPSTREAM_AUTH_REFRESH;
  if (!upstreamUrl) {
    res.status(500).json({ ok: false, error: 'UPSTREAM_AUTH_REFRESH not configured' });
    return;
  }

  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (req.headers.cookie) headers['cookie'] = String(req.headers.cookie);

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
    });

    // Merge Set-Cookie from upstream into a single string (as used elsewhere in the repo)
    const merged = mergeSetCookie(upstreamRes.headers, req.headers.cookie ? decodeURIComponent(String(req.headers.cookie)) : undefined);
    if (merged) {
      // Store merged cookie in gw_cookie (to keep backward compatibility with existing code that reads gw_cookie)
      res.setHeader('Set-Cookie', `gw_cookie=${encodeURIComponent(merged)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}`);
    }

    const text = await upstreamRes.text().catch(() => '');
    try {
      const json = JSON.parse(text);
      res.status(upstreamRes.status).json(json);
    } catch {
      res.status(upstreamRes.status).send(text);
    }
  } catch (err: any) {
    console.error('[auth/refresh] error', err);
    res.status(502).json({ ok: false, error: 'Upstream refresh failed' });
  }
}