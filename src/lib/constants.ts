export const API_BASE = (process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'https://apigw.verymobile.it/api').replace(/\/+$/, '');

export const APP_VERSION = '3.5.3';
export const BRAND = 'DEA';
export const CHANNEL_WEB = 'WEB';

// Dal decompilato
export const APP_KEY = '13aDLlze1621842102779';

// UA e device “tipo app Android”
export const USER_AGENT_APP = `VeryApp/${APP_VERSION} Android`;
export const USER_AGENT_HTTP = 'okhttp/4.11.0';
export const DEVICE_OS_DEFAULT = '13';
export const DEVICE_NAME_DEFAULT = 'Google Pixel 6';

function rfc1123Date(): string {
  return new Date().toUTCString();
}

export type WindHeaderProfile = 'minimal' | 'full';

export interface WindHeaderOptions {
  cookie?: string;
  uuid?: string;
  clientId?: string;
  deviceOs?: string;
  deviceName?: string;
  userAgentApp?: string;
  profile?: WindHeaderProfile;             // default: 'minimal'
  client?: 'app-android' | 'app-and';      // default: 'app-android'
  withRef?: boolean;                       // default: false (nessun Origin/Referer)
}

export function windHeaders(opts: WindHeaderOptions = {}): Record<string, string> {
  const {
    cookie,
    uuid,
    clientId,
    deviceOs = DEVICE_OS_DEFAULT,
    deviceName = DEVICE_NAME_DEFAULT,
    userAgentApp = USER_AGENT_APP,
    profile = 'minimal',
    client = 'app-android',
    withRef = false,
  } = opts;

  const h: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'it-IT,it;q=0.9',
    'accept-encoding': 'gzip',
    'Cache-Control': 'max-age=10',
    'Content-Type': 'application/json',
    Date: rfc1123Date(),
    'User-Agent': USER_AGENT_HTTP,

    'X-Wind-Client': client,
    'X-Wind-Version': `Android_V${APP_VERSION}`,
    'X-Brand': BRAND,
    'X-Language': 'it',
    'user-language': 'it',

    'X-W3-OS': deviceOs,
    'X-W3-Device': deviceName,
    'X-API-User-Agent': userAgentApp,
    'X-Channel': CHANNEL_WEB,
  };

  if (profile === 'full') {
    h['X-App-Key'] = APP_KEY;
    h['X-App-Version'] = APP_VERSION;
    h['X-Android-Services'] = 'GMS';
  }

  if (withRef) {
    h['Origin'] = 'https://visual.wind.it';
    h['Referer'] = 'https://visual.wind.it/';
  }

  if (uuid) h['X-W3-UUID'] = uuid;
  if (clientId) h['X-API-Client-Id'] = clientId;
  if (cookie) h['Cookie'] = cookie;

  return h;
}