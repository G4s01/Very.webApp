// Log minimale, abilitato con DEBUG=1 (o non-production)
const ON = process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production';

export function dlog(...args: any[]) {
  if (!ON) return;
  try {
    const ts = new Date().toISOString();
    const safe = args.map(a => {
      if (a && typeof a === 'object') {
        try { return JSON.parse(JSON.stringify(a)); } catch { return String(a); }
      }
      return a;
    });
    // eslint-disable-next-line no-console
    console.log(`[DEBUG ${ts}]`, ...safe);
  } catch {
    // eslint-disable-next-line no-console
    console.log('[DEBUG]', ...args);
  }
}

export function derr(...args: any[]) {
  // eslint-disable-next-line no-console
  console.error('[ERROR]', ...args);
}

export function dwarn(...args: any[]) {
  if (!ON) return;
  // eslint-disable-next-line no-console
  console.warn('[WARN]', ...args);
}