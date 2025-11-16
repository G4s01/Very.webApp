// Estrattori e formattatori per la risposta lineUnfolded (/ob/v2/contract/lineunfolded?...).
// Migliorato: gestione robusta del credito (contratto/linea, number/string).

interface Insight {
  type?: string;
  unitOfMeasure?: string;
  available?: number;
  total?: number;
  unlimited?: boolean;
  group?: string;
}

interface Option {
  code?: string;
  name?: string;
  status?: string;
  activationDate?: string;
  renewalDate?: string;
  insights?: Insight[];
  commercialStatus?: string;
}

interface TariffPlan {
  code?: string;
  name?: string;
  status?: string;
  activationDate?: string;
}

interface LineUnfoldedLine {
  id?: string;
  tariffPlan?: TariffPlan | null;
  options?: Option[];
  credit?: number | string;
  creditPrepaid?: number | string;
  creditBonus?: number | string;
  integrationStack?: string;
}

interface LineUnfoldedData {
  id?: string;
  lines?: LineUnfoldedLine[];
  credit?: number | string;
  creditPrepaid?: number | string;
  creditBonus?: number | string;
  promos?: Option[];
  options?: Option[];
}

interface ResponseLineUnfolded {
  data?: LineUnfoldedData;
  status?: string;
}

export interface ExtractedLineInfo {
  lineId: string;
  offerName: string;
  offerRenewalDate?: string;
  planActivationDate?: string;
  creditTotal?: number;
  creditBreakdown?: { prepaid?: number; bonus?: number };
  gigaNational?: { available?: number; total?: number; percent?: number };
  gigaRoaming?: { available?: number; total?: number; percent?: number };
  has5G?: boolean;
}

function formatDateISO(d?: string): string | undefined {
  if (!d) return undefined;
  const m = d.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : d;
}

function asNum(v: unknown): number | undefined {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    if (isFinite(n)) return n;
  }
  return undefined;
}

function percent(av?: number, tot?: number) {
  if (typeof av !== 'number' || typeof tot !== 'number' || tot <= 0) return undefined;
  return +((av / tot) * 100).toFixed(2);
}

export function extractLineInfo(resp: ResponseLineUnfolded): ExtractedLineInfo[] {
  const result: ExtractedLineInfo[] = [];
  const data = resp?.data;
  if (!data || !Array.isArray(data.lines)) return result;

  for (const line of data.lines) {
    if (!line) continue;
    const lineId = String(line.id || '');

    // Offerta e date
    let offerName = '';
    let offerRenewalDate: string | undefined;
    let activationDate: string | undefined;

    if (line.tariffPlan) {
      offerName = line.tariffPlan.name || line.tariffPlan.code || '';
      activationDate = formatDateISO(line.tariffPlan.activationDate);
    }

    const activeOpts = (line.options || []).filter(
      o => o?.status === 'ACTIVE' || o?.commercialStatus === 'ACTIVE'
    );
    for (const opt of activeOpts) {
      if (!offerRenewalDate && opt.renewalDate) {
        if (
          (offerName && opt.name && opt.name.toLowerCase().includes(offerName.toLowerCase())) ||
          (line.tariffPlan?.code && opt.code === line.tariffPlan.code) ||
          (opt.name && opt.name.toLowerCase().includes('very'))
        ) {
          offerRenewalDate = formatDateISO(opt.renewalDate);
        }
      }
    }

    // Credito: prova (ordine)
    // 1) Contratto: creditPrepaid/creditBonus (anche come stringhe)
    // 2) Linea: creditPrepaid/creditBonus
    // 3) Contratto: credit
    // 4) Linea: credit
    let prepaid =
      asNum(data.creditPrepaid) ??
      asNum(line.creditPrepaid);
    let bonus =
      asNum(data.creditBonus) ??
      asNum(line.creditBonus);

    let total: number | undefined;

    if (typeof prepaid === 'number' || typeof bonus === 'number') {
      total = (prepaid ?? 0) + (bonus ?? 0);
    } else {
      total =
        asNum(data.credit) ??
        asNum(line.credit);
    }

    // Insights GIGA
    let gigaNational: ExtractedLineInfo['gigaNational'] = {};
    let gigaRoaming: ExtractedLineInfo['gigaRoaming'] = {};
    const mainOpt = activeOpts.find(o => Array.isArray(o.insights) && o.insights.length > 0);
    if (mainOpt) {
      const nat = mainOpt.insights?.find(i => i.type === 'DATA' && i.group === 'NATIONAL');
      const roa = mainOpt.insights?.find(i => i.type === 'DATA' && i.group === 'ROAMING');
      if (nat) {
        const av = asNum(nat.available);
        const tot = asNum(nat.total);
        gigaNational = { available: av, total: tot, percent: percent(av, tot) };
      }
      if (roa) {
        const av = asNum(roa.available);
        const tot = asNum(roa.total);
        gigaRoaming = { available: av, total: tot, percent: percent(av, tot) };
      }
    }

    // 5G attivo se tra le opzioni attive c'è qualcosa che contiene "5G"
    const has5G = activeOpts.some(o => o.name?.toLowerCase().includes('5g'));

    result.push({
      lineId,
      offerName,
      offerRenewalDate,
      planActivationDate: activationDate,
      creditTotal: total,
      creditBreakdown: (typeof prepaid === 'number' || typeof bonus === 'number') ? { prepaid, bonus } : undefined,
      gigaNational,
      gigaRoaming,
      has5G,
    });
  }

  return result;
}

export function formatEuro(value?: number): string {
  if (typeof value !== 'number' || !isFinite(value)) return '—';
  return value.toFixed(2).replace('.', ',') + ' €';
}

export function formatGiga(bytes?: number): string {
  if (typeof bytes !== 'number' || !isFinite(bytes)) return '—';
  const GB = 1024 ** 3;
  const valGb = bytes / GB;
  return valGb >= 0.1 ? `${valGb.toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}