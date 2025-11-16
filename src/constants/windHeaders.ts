// v7: aggiunto Accept esplicito; nessun altro cambiamento “rumoroso”.
export function windHeaders(opts: {
  uuid: string;
  cookie?: string;
  challengeToken?: string;
  bearerToken?: string;
}): Record<string, string> {
  const h: Record<string, string> = {
    'X-Wind-Client': 'app-and',
    'X-Wind-Version': 'ANDROID_V3.5.3',
    'X-Brand': 'DEA',
    'X-Android-Services': 'GMS',
    'X-W3-OS': '9',
    'X-W3-Device': 'Samsung SM-S9160',
    'X-Language': 'it',
    'X-API-Client-Id': opts.uuid,
    'Cache-Control': 'public, max-age=5',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.12.0',
  };
  if (opts.challengeToken) h['X-W3-Challenge-Token'] = opts.challengeToken;
  if (opts.bearerToken) h['Authorization'] = `Bearer ${opts.bearerToken}`;
  if (opts.cookie) h['Cookie'] = opts.cookie;
  return h;
}