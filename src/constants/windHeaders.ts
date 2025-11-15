// Header 1:1 come l'app Very (sample reale)
// Configurabili via .env.local se vuoi variare valori
// - BRAND=DEA
// - WIND_CLIENT=app-and
// - WIND_VERSION=ANDROID_V3.5.3
// - ANDROID_SERVICES=GMS
// - W3_OS=9
// - W3_DEVICE="Samsung SM-S9160"
// - OKHTTP_UA="okhttp/4.12.0"
export function windHeaders(opts: {
  uuid?: string;          // usalo sia come X-W3-UUID sia come X-API-Client-Id
  clientId?: string;      // alias di uuid
  cookie?: string;
  challengeToken?: string;
  bearerToken?: string;   // Authorization: Bearer ...
} = {}) {
  const BRAND = process.env.BRAND || 'DEA';
  const WIND_CLIENT = process.env.WIND_CLIENT || 'app-and';
  const WIND_VERSION = process.env.WIND_VERSION || 'ANDROID_V3.5.3';
  const ANDROID_SERVICES = process.env.ANDROID_SERVICES || 'GMS';
  const W3_OS = process.env.W3_OS || '9';
  const W3_DEVICE = process.env.W3_DEVICE || 'Samsung SM-S9160';
  const OKHTTP_UA = process.env.OKHTTP_UA || 'okhttp/4.12.0';

  const deviceId = opts.uuid || opts.clientId || 'web-device';
  const h: Record<string, string> = {
    'X-Wind-Client': WIND_CLIENT,
    'X-Wind-Version': WIND_VERSION,
    'X-Brand': BRAND,
    'X-Android-Services': ANDROID_SERVICES,
    'X-W3-OS': W3_OS,
    'X-W3-Device': W3_DEVICE,
    'X-Language': 'it',
    'X-API-Client-Id': deviceId,
    'Cache-Control': 'public, max-age=5',
    'Content-Type': 'application/json; charset=UTF-8',
    'Accept-Encoding': 'gzip',
    'User-Agent': OKHTTP_UA,
  };
  if (opts.challengeToken) h['X-W3-Challenge-Token'] = opts.challengeToken;
  if (opts.bearerToken) h['Authorization'] = `Bearer ${opts.bearerToken}`;
  if (opts.cookie) h['Cookie'] = opts.cookie;
  return h;
}