// Modifica: non aggiungere più segmenti "5G_VIS" vuoti nei segments;
// 5G rimane rappresentata nel tray, non come segmento della donut.
// Manteniamo la dedup/active logic già presente, ma assicuriamoci che
// segments contengano solo segmenti con totalBytes > 0.

export interface ParsedLineInfo {
  msisdn: string;
  offerName: string;
  offerRenewalDate?: string;
  gigaNational?: { total: number; available: number };
  gigaRoaming?: { total: number; available: number };
  extraGigaAddOns: ExtraGiga[];
  has5G: boolean;
  hasAutoTopup: boolean;
  trayItems: TrayItem[];
  segments: Segment[]; // per DonutGauge
  creditTotal?: number;
  creditRegular?: number; // credito non-omaggio (prepaid/standard)
  creditPromo?: number;   // credito omaggio / bonus
}

export interface ExtraGiga {
  code: string;
  itemUUID?: string;
  name: string;
  addedTotalBytes: number;
  addedAvailableBytes: number;
  renewalDate?: string;
}

export interface TrayItem {
  key: string;
  label: string;
  type: '5G' | 'EXTRA_GIGA' | 'AUTORICARICA' | 'OTHER';
  source?: string;
}

export interface Segment {
  key: string;
  label?: string;
  totalBytes: number;
  availableBytes: number;
  color?: string;
  type?: 'BASE' | 'EXTRA_GIGA' | 'OTHER';
}

/* --- helper functions (same as before) --- */
function safeNumber(n: any): number | undefined { return typeof n === 'number' && isFinite(n) ? n : undefined; }
function sumBy<T>(arr: T[], sel: (t: T) => number | undefined): number { return arr.reduce((acc, v) => acc + (safeNumber(sel(v)) ?? 0), 0); }
function toDate(d?: string) { const t = d ? Date.parse(d) : NaN; return isNaN(t) ? undefined : new Date(t); }
function isFuture(d?: string) { const dd = toDate(d); if (!dd) return false; return dd.getTime() > Date.now(); }
function isPast(d?: string) { const dd = toDate(d); if (!dd) return false; return dd.getTime() < Date.now(); }
function hasCategory(o: any, rx: RegExp) { return Array.isArray(o?.categoryIds) && o.categoryIds.some((c: string) => rx.test(String(c))); }
function normalizeName(n?: string) { if (!n) return ''; return String(n).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function pickColorForType(t: Segment['type']) { switch (t) { case 'BASE': return '#0a5d36'; case 'EXTRA_GIGA': return '#7EC9E6'; default: return '#cdd8d1'; } }
function isVeryPlus(o: any) { return hasCategory(o, /very-?plus/i) || /very\s*plus/i.test(o?.name || '') || /very[_-]?plus/i.test(o?.code || ''); }
function is5G(o: any) { return hasCategory(o, /\b5g(\-?nsa|\-?sa)?\b/i) || /5g/i.test(o?.name || '') || /5g/i.test(o?.code || ''); }
function isExtraCategory(o: any) { return hasCategory(o, /(ADDITIONAL(_RECURRING)?|CAMPAIGN|CAMP)/i); }

function isActiveEntity(ent: any): boolean {
  if (!ent) return false;
  if (typeof ent?.commercialStatus === 'string' && ent.commercialStatus !== 'ACTIVE') return false;
  if (typeof ent?.status === 'string' && ent.status !== 'ACTIVE') return false;
  if (ent?.deactivationDate && isPast(ent.deactivationDate)) return false;
  if (ent?.activationDate && isFuture(ent.activationDate)) return false;
  return true;
}

/* --- parser principale (semplificata: manteniamo logica precedente ma evitiamo 5G_VIS segments) --- */
export function parseLineUnfolded(raw: any): ParsedLineInfo | null {
  const line = raw?.data?.lines?.[0];
  if (!line) return null;

  const msisdn = String(line.id ?? '');
  const planOpt = (Array.isArray(line.options) ? line.options : []).find((o: any) => Array.isArray(o?.categoryIds) && (o.categoryIds.includes('PLAN') || o.categoryIds.includes('PREPAID-PLAN')));
  const offerName = line?.tariffPlan?.name || planOpt?.name || '';
  const offerRenewalDate = planOpt?.renewalDate || undefined;

  const rawOptions = Array.isArray(line.options) ? line.options.slice() : [];
  const rawPromos = Array.isArray(line.promos) ? line.promos.slice() : [];

  const unifiedMap = new Map<string, any>();
  function pushUnique(ent: any, source: string) {
    if (!ent) return;
    const key = (ent.itemUUID && String(ent.itemUUID)) || (ent.code && String(ent.code)) || `${source}:${normalizeName(ent.name)}`;
    if (!unifiedMap.has(key)) {
      unifiedMap.set(key, { ...ent, __source: source, __key: key });
    } else {
      const existing = unifiedMap.get(key);
      const existingActive = isActiveEntity(existing);
      const incomingActive = isActiveEntity(ent);
      if (!existingActive && incomingActive) {
        unifiedMap.set(key, { ...existing, ...ent, __source: source });
        console.debug('[lineInfo] merged: replaced inactive existing with active incoming', { key, existing, incoming: ent });
      } else {
        if (!existing.itemUUID && ent.itemUUID) existing.itemUUID = ent.itemUUID;
      }
    }
  }
  rawOptions.forEach(o => pushUnique(o, 'option'));
  rawPromos.forEach(p => pushUnique(p, 'promo'));
  const unified = Array.from(unifiedMap.values());
  const inactive = unified.filter(e => !isActiveEntity(e));
  if (inactive.length > 0) console.debug('[lineInfo] excluded inactive entities', inactive.map((e:any)=>({ key: e.__key, name: e.name, status: e.status, commercialStatus: e.commercialStatus, activationDate: e.activationDate, deactivationDate: e.deactivationDate })));
  const activeEntities = unified.filter(isActiveEntity);

  const hasVeryPlus = activeEntities.some(isVeryPlus);
  const has5gOnly = !hasVeryPlus && activeEntities.some(is5G);
  const has5G = hasVeryPlus || has5gOnly;

  const hasAutoTopup = activeEntities.some((e: any) => /autoricarica/i.test(e?.name || '') || /smart[_-]?top.?up/i.test(e?.code || '') || hasCategory(e, /RECURRING[_-]?TOPUP/i));

  // extraGigaAddOns deduplicati per itemUUID/code/normalized-name+total
  const rawExtras = activeEntities.filter(o => isExtraCategory(o) && Array.isArray(o.insights) && o.insights.some((i: any) => i?.type === 'DATA'));
  const extraMap = new Map<string, ExtraGiga>();
  rawExtras.forEach((o: any) => {
    const nat = (o.insights || []).find((i: any) => i?.type === 'DATA' && i?.group === 'NATIONAL') || (o.insights || []).find((i: any) => i?.type === 'DATA');
    const total = safeNumber(nat?.total) || 0;
    const avail = safeNumber(nat?.available) || 0;
    if (total <= 0) return;
    const key = (o.itemUUID && String(o.itemUUID)) || (o.code && String(o.code)) || `${normalizeName(o.name)}::${total}`;
    if (!extraMap.has(key)) {
      extraMap.set(key, {
        code: o.code,
        itemUUID: o.itemUUID,
        name: o.name,
        addedTotalBytes: total,
        addedAvailableBytes: avail,
        renewalDate: o.renewalDate
      });
    } else {
      console.debug('[lineInfo] duplicate extra add-on deduped', { key, existing: extraMap.get(key), incoming: o.name, total });
    }
  });
  const extraGigaAddOns: ExtraGiga[] = Array.from(extraMap.values());

  // Aggregazione dati nazionali: preferiamo insightsSummary quando presente
  const sumNat = raw?.data?.insightsSummary?.national?.data;
  let gigaNationalTotal = safeNumber(sumNat?.total) ?? 0;
  let gigaNationalAvail = safeNumber(sumNat?.available) ?? 0;
  if (!gigaNationalTotal || gigaNationalTotal <= 0) {
    const nationalDataInsights = activeEntities.flatMap((o: any) => Array.isArray(o.insights) ? o.insights : []).filter((i: any) => i?.type === 'DATA' && i?.group === 'NATIONAL');
    gigaNationalTotal = sumBy(nationalDataInsights, i => i?.total);
    gigaNationalAvail = sumBy(nationalDataInsights, i => i?.available);
  }
  gigaNationalTotal = gigaNationalTotal || 0;
  gigaNationalAvail = (typeof gigaNationalAvail === 'number') ? gigaNationalAvail : 0;

  // roaming (opzionale)
  const roamingDataInsights = activeEntities.flatMap((o: any) => Array.isArray(o.insights) ? o.insights : []).filter((i: any) => i?.type === 'DATA' && i?.group === 'ROAMING');
  const gigaRoamingTotal = sumBy(roamingDataInsights, i => i?.total);
  const gigaRoamingAvail = sumBy(roamingDataInsights, i => i?.available);

  // Build segments: base = overall - extras; then extras segments (only those with bytes)
  const sumExtraTotal = sumBy(extraGigaAddOns, e => e.addedTotalBytes);
  const sumExtraAvail = sumBy(extraGigaAddOns, e => e.addedAvailableBytes);
  const overallTotal = gigaNationalTotal;
  const overallAvail = gigaNationalAvail;
  const baseTotalBytes = Math.max(0, (overallTotal || 0) - sumExtraTotal);
  const baseAvailBytes = Math.max(0, (overallAvail || 0) - sumExtraAvail);

  const segments: Segment[] = [];
  if (baseTotalBytes > 0) {
    segments.push({
      key: 'BASE',
      label: offerName || 'Offerta',
      totalBytes: Math.round(baseTotalBytes),
      availableBytes: Math.max(0, Math.round(baseAvailBytes)),
      color: pickColorForType('BASE'),
      type: 'BASE'
    });
  } else if ((overallTotal || 0) > 0 && extraGigaAddOns.length === 0) {
    segments.push({
      key: 'BASE_FALLBACK',
      label: offerName || 'Offerta',
      totalBytes: Math.round(overallTotal || 0),
      availableBytes: Math.max(0, Math.round(overallAvail || 0)),
      color: pickColorForType('BASE'),
      type: 'BASE'
    });
  }

  extraGigaAddOns.forEach(a => {
    const segKey = `EXTRA_${a.itemUUID || a.code || normalizeName(a.name)}`;
    if (!segments.some(s => s.key === segKey)) {
      segments.push({
        key: segKey,
        label: a.name || `+${Math.round((a.addedTotalBytes || 0) / (1024 ** 3))}GB`,
        totalBytes: Math.round(a.addedTotalBytes),
        availableBytes: Math.max(0, Math.round(a.addedAvailableBytes)),
        color: pickColorForType('EXTRA_GIGA'),
        type: 'EXTRA_GIGA'
      });
    }
  });

  // NOTE: do NOT add 5G_VIS segments with zero bytes; 5G remains only in the tray
  // Build tray items (deduplicated)
  const trayMap = new Map<string, TrayItem>();
  if (hasVeryPlus) trayMap.set('VERY_PLUS', { key: 'VERY_PLUS', label: 'Very Plus', type: '5G', source: 'auto' });
  else if (has5gOnly) trayMap.set('5G', { key: '5G', label: '5G Full Speed', type: '5G', source: 'auto' });

  extraGigaAddOns.forEach(a => {
    const addedGB = a.addedTotalBytes / (1024 ** 3);
    const label = Number.isFinite(addedGB) && addedGB >= 1 ? `+${Math.round(addedGB)}GB` : a.name || 'Add-on Giga';
    const k = a.itemUUID || a.code || normalizeName(a.name);
    trayMap.set(k, { key: k, label, type: 'EXTRA_GIGA', source: 'option' });
  });

  if (hasAutoTopup) trayMap.set('AUTORICARICA', { key: 'AUTORICARICA', label: 'AUTORICARICA', type: 'AUTORICARICA', source: 'promo' });

  activeEntities.forEach((o: any) => {
    if (hasCategory(o, /^(PLAN|PREPAID-PLAN)$/)) return;
    if (isVeryPlus(o) || is5G(o)) return;
    if (isExtraCategory(o)) return;
    if (/autoricarica/i.test(o?.name || '')) return;
    const k = o.itemUUID || o.code || normalizeName(o.name);
    if (!trayMap.has(k)) trayMap.set(k, { key: k, label: o.name || 'Opzione', type: 'OTHER', source: o.__source || 'option' });
  });
  activeEntities.filter(e => e.__source === 'promo').forEach((p: any) => {
    if (/autoricarica/i.test(p?.name || '')) return;
    const k = p.itemUUID || p.code || normalizeName(p.name);
    if (!trayMap.has(k)) trayMap.set(k, { key: k, label: p.name || 'Promo', type: 'OTHER', source: 'promo' });
  });

  const order: Record<TrayItem['type'], number> = { '5G': 1, 'EXTRA_GIGA': 2, 'AUTORICARICA': 3, 'OTHER': 10 };
  const trayItems = Array.from(trayMap.values()).sort((a, b) => (order[a.type] - order[b.type]) || a.label.localeCompare(b.label));

  // --- CREDIT extraction: explicit fields and robust fallbacks ---
  const rawCredit = safeNumber(line.credit);               // e.g. 192.7261
  const prepaidField = safeNumber(line.creditPrepaid);     // e.g. 6.9261
  const bonusField = safeNumber(line.creditBonus) ?? safeNumber(line.creditPromo) ?? 0; // e.g. 185.8

  // creditPromo is the explicit bonus/omaggio if present
  const creditPromo = bonusField || 0;

  // creditRegular prefer explicit prepaid; otherwise derive from total - promo when possible
  let creditRegular: number;
  if (typeof prepaidField === 'number') {
    creditRegular = prepaidField;
  } else if (typeof rawCredit === 'number') {
    creditRegular = Math.max(0, rawCredit - creditPromo);
  } else {
    // fallback: try to infer from active entities (legacy heuristics could be added)
    creditRegular = 0;
  }

  // creditTotal prefer rawCredit, otherwise sum parts
  const detectedCreditTotal = (typeof rawCredit === 'number') ? rawCredit : Math.max(0, creditRegular + creditPromo);

  console.debug('[lineInfo] parse result', {
    msisdn, offerName, offerRenewalDate,
    overallTotal, overallAvail, extraGigaAddOnsCount: extraGigaAddOns.length,
    segmentsCount: segments.length, trayItemsCount: trayItems.length,
    trayItems, segments,
    creditTotal: detectedCreditTotal,
    creditRegular,
    creditPromo
  });

  return {
    msisdn,
    offerName,
    offerRenewalDate,
    gigaNational: (overallTotal && overallTotal > 0) ? { total: overallTotal, available: overallAvail } : undefined,
    gigaRoaming: (gigaRoamingTotal && gigaRoamingTotal > 0) ? { total: gigaRoamingTotal, available: gigaRoamingAvail } : undefined,
    extraGigaAddOns,
    has5G,
    hasAutoTopup,
    trayItems,
    segments,
    creditTotal: safeNumber(detectedCreditTotal) ?? undefined,
    creditRegular: safeNumber(creditRegular) ?? undefined,
    creditPromo: safeNumber(creditPromo) ?? undefined
  };
}

export function extractLineInfo(raw: any): ParsedLineInfo[] {
  const p = parseLineUnfolded(raw);
  return p ? [p] : [];
}