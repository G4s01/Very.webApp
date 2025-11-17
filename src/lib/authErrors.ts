// Aggiunto codice ERR_NO_CHALLENGE.
export type AuthErrorCode =
  | 'ERR_MAINTENANCE'
  | 'ERR_ACCOUNT_LOCKED'
  | 'ERR_OTP_RATE_LIMIT'
  | 'ERR_CHALLENGE'
  | 'ERR_NO_CHALLENGE'
  | 'ERR_CREDENTIALS'
  | 'ERR_UPSTREAM_FAIL'
  | 'ERR_UNKNOWN';

export interface NormalizedAuthError {
  code: AuthErrorCode;
  upstreamMessage?: string;
  suggestion?: string;
  lockedUntilMidnight?: boolean;
}

interface UpstreamLike {
  status?: string;
  messages?: Array<{ type?: string; message?: string }>;
  errorCodes?: string[];
  data?: any;
  message?: string;
}

function includesAny(h: string, arr: string[]): boolean {
  const l = h.toLowerCase();
  return arr.some(a => l.includes(a.toLowerCase()));
}

export function normalizeAuthError(resp: UpstreamLike, httpStatus?: number): NormalizedAuthError | null {
  if (!resp) return null;
  const msgs: string[] = [];
  if (resp.message) msgs.push(resp.message);
  if (resp.data?.message) msgs.push(resp.data.message);
  if (Array.isArray(resp.messages)) resp.messages.forEach(m => m?.message && msgs.push(m.message));
  const joined = msgs.join(' | ');

  if (resp.errorCodes?.includes('ERR_NO_CHALLENGE')) {
    return {
      code: 'ERR_NO_CHALLENGE',
      upstreamMessage: joined || 'Challenge assente dall’upstream',
      suggestion: 'Riprova più tardi. Possibile finestra di manutenzione / rate limit.'
    };
  }
  if (resp.errorCodes?.includes('ERR-VERS-01') || includesAny(joined, [
    'manutenzione','stiamo lavorando','versioning-closing'
  ])) {
    return {
      code: 'ERR_MAINTENANCE',
      upstreamMessage: joined || 'Servizio in manutenzione',
      suggestion: 'Attendi fine finestra indicata.'
    };
  }
  if (includesAny(joined, ['account is locked','account bloccato'])) {
    return {
      code: 'ERR_ACCOUNT_LOCKED',
      upstreamMessage: joined,
      suggestion: 'Verifica sicurezza account o contatta assistenza.'
    };
  }
  if (includesAny(joined, ['troppe volte il codice otp','too many otp','rate limit'])) {
    return {
      code: 'ERR_OTP_RATE_LIMIT',
      upstreamMessage: joined,
      lockedUntilMidnight: includesAny(joined, ['mezzanotte']),
      suggestion: 'Ripeti dopo la mezzanotte o attendi qualche minuto.'
    };
  }
  if (httpStatus === 412) {
    return {
      code: 'ERR_CHALLENGE',
      upstreamMessage: joined || 'Challenge mancante',
      suggestion: 'Esegui prima il login credenziali.'
    };
  }
  if ([400,401,403].includes(httpStatus || 0)) {
    return {
      code: 'ERR_CREDENTIALS',
      upstreamMessage: joined || 'Credenziali non valide',
      suggestion: 'Controlla username/password o recupera password.'
    };
  }
  if (resp.status?.toUpperCase() === 'FAIL') {
    return {
      code: 'ERR_UPSTREAM_FAIL',
      upstreamMessage: joined || 'Errore upstream',
      suggestion: 'Riprova più tardi.'
    };
  }
  return {
    code: 'ERR_UNKNOWN',
    upstreamMessage: joined || '',
    suggestion: ''
  };
}

export function formatAuthError(e: NormalizedAuthError | null): string {
  if (!e) return '';
  const base = e.upstreamMessage || '';
  switch (e.code) {
    case 'ERR_NO_CHALLENGE': return `Challenge assente: ${base}`;
    case 'ERR_MAINTENANCE': return `Manutenzione: ${base}`;
    case 'ERR_ACCOUNT_LOCKED': return `Account bloccato: ${base}`;
    case 'ERR_OTP_RATE_LIMIT': return `Rate limit OTP: ${base}${e.lockedUntilMidnight ? ' (fino a mezzanotte)' : ''}`;
    case 'ERR_CHALLENGE': return `Challenge mancante: ${base}`;
    case 'ERR_CREDENTIALS': return base;
    case 'ERR_UPSTREAM_FAIL': return base;
    case 'ERR_UNKNOWN':
    default: return base || 'Errore sconosciuto';
  }
}