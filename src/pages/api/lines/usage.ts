import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'cross-fetch';
import { windHeaders } from '../../../constants/windHeaders';
import {
  getCookie,
  getLineMap,
  getOrSetDeviceId,
  getChallengeToken,
  mergeSetCookie,
  readJsonSafe,
  setChallengeToken,
  setCookie,
} from '../../../lib/serverCookies';
import { dlog } from '../../../lib/debug';
import { parseJwt, maskMsisdn4 } from '../../../lib/jwt';

// Helpers
const onlyDigits = (s?: string | null) => (s || '').replace(/\D/g, '');
const normalizeMsisdn = (msisdn: string) => {
  const d = onlyDigits(msisdn);
  return d.startsWith('39') ? d : `39${d}`;
};
const last4 = (s: string) => {
  const d = onlyDigits(s);
  return d.length >= 4 ? d.slice(-4) : null;
};
const last3 = (s: string) => {
  const d = onlyDigits(s);
  return d.length >= 3 ? d.slice(-3) : null;
};

type UsageNormalized = {
  lineMasked: string | null;
  msisdnLast4: string | null;
  data: { totalBytes: number | null; usedBytes: number | null; remainingBytes: number | null; renewAt?: string | null };
  minutes: { unlimited: boolean; used?: number | null };
  sms: { unlimited: boolean; used?: number | null };
  options: string[];
  credit: { amount: number | null; currency: string };
};

function mockUsage(masked: string | null): UsageNormalized {
  const total = 200 * 1024 ** 3;
  const remaining = 199.6 * 1024 ** 3;
  const used = total - remaining;
  const l4 = masked ? last4(masked) : null;
  return {
    lineMasked: masked,
    msisdnLast4: l4,
    data: { totalBytes: total, usedBytes: used, remainingBytes: remaining, renewAt: null },
    minutes: { unlimited: true, used: null },
    sms: { unlimited: true, used: null },
    options: ['5G Full Speed', 'Ricarica automatica'],
    credit: { amount: 42.73, currency: 'EUR' },
  };
}

function adaptDataFromLineUnfolded(json: any): { totalBytes: number | null; remainingBytes: number | null; usedBytes: number | null; renewAt?: string | null; options: string[] } {
  let total: number | null = null;
  let remaining: number | null = null;
  let used: number | null = null;
  let renewAt: string | null = null;
  const options: string[] = [];
  try {
    const str = JSON.stringify(json).toLowerCase();
    if (str.includes('5g') && str.includes('full')) options.push('5G Full Speed');
    function walk(o: any) {
      if (!o || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        const v = o[k];
        const kl = k.toLowerCase();
        if (typeof v === 'number') {
          if ((kl.includes('total') || kl.endsWith('cap')) && total == null) total = v;
          if ((kl.includes('remain') || kl.includes('avail')) && remaining == null) remaining = v;
          if (kl.includes('used') && used == null) used = v;
        }
        if (typeof v === 'string') {
          if ((kl.includes('renew') || kl.includes('expiry') || kl.includes('expire')) && !renewAt) {
            if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/.test(v.toLowerCase())) renewAt = v;
          }
        }
        if (v && typeof v === 'object') walk(v);
      }
    }
    walk(json);
    if (total != null && remaining != null && used == null) used = Math.max(0, total - remaining);
    if (total == null && remaining != null && used != null) total = remaining + used;
  } catch {}
  return { totalBytes: total, remainingBytes: remaining, usedBytes: used, renewAt, options };
}

async function req(apiBase: string, path: string, headers: Record<string, string>) {
  const url = `${apiBase}${path}`;
  return fetch(url, { method: 'GET', headers });
}

async function withChallengeRetry(
  apiBase: string,
  path: string,
  baseHeaders: Record<string, string>,
  reqObj: NextApiRequest,
  resObj: NextApiResponse,
  cookieChain?: string
) {
  const first = await req(apiBase, path, baseHeaders);
  let out = await readJsonSafe(first as any);
  let merged = mergeSetCookie((first as any).headers, cookieChain);
  if (merged) {
    setCookie(resObj, 'gw_cookie', encodeURIComponent(merged), {
      path: '/', httpOnly: true, sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
    });
  }
  const ch = (first.headers.get && (first.headers.get('X-W3-Challenge-Token') || first.headers.get('x-w3-challenge-token'))) || null;
  if (ch && first.status === 401) {
    setChallengeToken(resObj, ch as string);
    const second = await req(apiBase, path, { ...baseHeaders, 'X-W3-Challenge-Token': ch as string });
    out = await readJsonSafe(second as any);
    merged = mergeSetCookie((second as any).headers, merged || cookieChain);
    if (merged) {
      setCookie(resObj, 'gw_cookie', encodeURIComponent(merged), {
        path: '/', httpOnly: true, sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24,
      });
    }
    return { res: second, body: out };
  }
  return { res: first, body: out };
}

export default async function handler(reqObj: NextApiRequest, resObj: NextApiResponse) {
  try {
    const forceLive = String(reqObj.query?.live || '').trim() === '1';
    const mockEnv = process.env.NEXT_PUBLIC_MOCK_USAGE === '1' || process.env.MOCK_USAGE === '1';
    const isMock = !forceLive && mockEnv;

    // Determina masked dalla query/cookie o fallback prima linea dal JWT
    let masked: string | null = null;
    const qMasked = (reqObj.query?.masked as string) || '';
    if (qMasked) masked = qMasked;
    else {
      const c = getCookie(reqObj, 'active_masked');
      if (c) masked = decodeURIComponent(c);
    }

    const sessionJwt = getCookie(reqObj, 'session_token');
    const payload = sessionJwt ? parseJwt<any>(sessionJwt) : null;
    const contracts = Array.isArray(payload?.contracts) ? payload.contracts : [];

    if (!masked && contracts.length) {
      const firstLine = contracts.find((c: any) => Array.isArray(c?.lines) && c.lines.length)?.lines?.[0];
      if (typeof firstLine === 'string') masked = maskMsisdn4(firstLine);
    }

    if (isMock) {
      return resObj.status(200).json({ ok: true, mock: true, source: 'mock', usage: mockUsage(masked) });
    }

    // Risolvi lineId: preferisci msisdn, altrimenti usa la maschera
    const map = getLineMap(reqObj);
    let msisdnResolved: string | null = null;
    if (masked) {
      const s4 = last4(masked);
      const s3 = last3(masked);
      msisdnResolved = (s4 && map[s4]) || (s3 && map[s3]) || null;
      // fallback dal JWT se contiene il numero completo
      if (!msisdnResolved && contracts.length) {
        for (const c of contracts) {
          if (Array.isArray(c?.lines)) {
            const hit = c.lines.find((ln: any) => typeof ln === 'string' && (last4(ln || '') === s4 || last3(ln || '') === s3));
            if (hit) { msisdnResolved = onlyDigits(hit); break; }
          }
        }
      }
    } else if (contracts.length) {
      const firstLine = contracts.find((c: any) => Array.isArray(c?.lines) && c.lines.length)?.lines?.[0];
      if (typeof firstLine === 'string') msisdnResolved = onlyDigits(firstLine);
    }

    const apiBase = process.env.API_BASE || 'https://apigw.verymobile.it/api';
    const deviceId = getOrSetDeviceId(reqObj, resObj);
    const challenge = getChallengeToken(reqObj);
    const prevGw = getCookie(reqObj, 'gw_cookie');
    const cookie = prevGw ? decodeURIComponent(prevGw) : undefined;

    const baseHeaders = windHeaders({ uuid: deviceId, clientId: deviceId, cookie });
    if (challenge) baseHeaders['X-W3-Challenge-Token'] = challenge;

    // Scegli il parametro lineId per le chiamate: MSISDN se disponibile, altrimenti maschera
    const lineIdParam = msisdnResolved ? normalizeMsisdn(msisdnResolved) : (masked || null);
    if (!lineIdParam) {
      return resObj.status(400).json({ ok: false, error: 'Nessuna linea disponibile nel JWT o come selezione attiva.' });
    }

    // Deriva un contractId dal JWT se possibile (per autotopup/lineunfolded)
    let contractIdForLine: string | null = null;
    if (contracts.length) {
      const target = msisdnResolved ? last4(msisdnResolved) : (masked ? last4(masked) : null);
      for (const c of contracts) {
        if (Array.isArray(c?.lines)) {
          const match = c.lines.find((ln: any) => typeof ln === 'string' && last4(ln || '') === target);
          if (match) { contractIdForLine = c?.code || c?.contractId || null; break; }
        }
      }
      if (!contractIdForLine && contracts[0]) contractIdForLine = contracts[0].code || contracts[0].contractId || null;
    }

    // Chiama i 3 endpoint; se lineIdParam è maschera e qualche endpoint non lo accetta, cattura l’errore e prosegui.
    let creditAmount: number | null = null;
    let autoActive = false;
    let dataAdapt = { totalBytes: null as number | null, remainingBytes: null as number | null, usedBytes: null as number | null, renewAt: null as string | null, options: [] as string[] };

    // Credito
    try {
      const rCred = await withChallengeRetry(apiBase, `/v1/debits/credit/balance?lineId=${encodeURIComponent(lineIdParam)}`, baseHeaders, reqObj, resObj, cookie);
      dlog('[usage][credit]', rCred.res.status, rCred.body.json || rCred.body.text);
      const cAmt = rCred.body.json?.data?.amount ?? rCred.body.json?.data?.balance ?? rCred.body.json?.credit ?? rCred.body.json?.amount ?? null;
      creditAmount = cAmt != null ? Number(cAmt) : null;
    } catch {}

    // AutoTopup
    try {
      if (contractIdForLine) {
        const rAuto = await withChallengeRetry(apiBase, `/v1/autotopup/check?contractId=${encodeURIComponent(contractIdForLine)}&lineId=${encodeURIComponent(lineIdParam)}`, baseHeaders, reqObj, resObj, cookie);
        dlog('[usage][autotopup]', rAuto.res.status, rAuto.body.json || rAuto.body.text);
        autoActive =
          rAuto.body.json?.active === true ||
          rAuto.body.json?.data?.active === true ||
          rAuto.body.json?.enabled === true ||
          rAuto.body.json?.data?.enabled === true;
      }
    } catch {}

    // LineUnfolded
    try {
      if (contractIdForLine) {
        const rLine = await withChallengeRetry(apiBase, `/ob/v2/contract/lineunfolded?contractId=${encodeURIComponent(contractIdForLine)}&lineId=${encodeURIComponent(lineIdParam)}`, baseHeaders, reqObj, resObj, cookie);
        dlog('[usage][lineunfolded]', rLine.res.status, rLine.body.json || rLine.body.text);
        dataAdapt = adaptDataFromLineUnfolded(rLine.body.json);
      }
    } catch {}

    const options = new Set<string>(dataAdapt.options || []);
    if (autoActive) options.add('Ricarica automatica');

    const usage: UsageNormalized = {
      lineMasked: masked || (msisdnResolved ? maskMsisdn4(msisdnResolved) : null),
      msisdnLast4: msisdnResolved ? last4(msisdnResolved) : (masked ? last4(masked) : null),
      data: {
        totalBytes: dataAdapt.totalBytes ?? null,
        usedBytes: dataAdapt.usedBytes ?? null,
        remainingBytes: dataAdapt.remainingBytes ?? null,
        renewAt: dataAdapt.renewAt ?? null,
      },
      minutes: { unlimited: true, used: null },
      sms: { unlimited: true, used: null },
      options: Array.from(options),
      credit: { amount: creditAmount, currency: 'EUR' },
    };

    return resObj.status(200).json({ ok: true, mock: false, source: 'live', usage });
  } catch (e: any) {
    return resObj.status(500).json({ ok: false, error: e.message || String(e) });
  }
}