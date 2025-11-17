import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  warnAtSec?: number;        // soglia “warning” (default 5 minuti)
  refreshEveryMs?: number;   // polling di /api/auth/session (default 60s)
  onExpire?: () => void;     // callback allo scadere (opzionale)
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtHms(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(r)}` : `${m}:${pad2(r)}`;
}

export default function SessionExpiry({ warnAtSec = 5 * 60, refreshEveryMs = 60_000, onExpire }: Props) {
  const [expMs, setExpMs] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'expired' | 'unauth'>('loading');
  const tickRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  async function fetchSession() {
    try {
      const r = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) {
        setStatus('unauth');
        setExpMs(null);
        setRemainingSec(null);
        return;
      }
      const j = await r.json();
      const exp = j?.claims?.exp ? Number(j.claims.exp) * 1000 : null;
      if (!exp || !Number.isFinite(exp)) {
        setStatus('unauth');
        setExpMs(null);
        setRemainingSec(null);
        return;
      }
      setExpMs(exp);
      const rem = Math.floor((exp - Date.now()) / 1000);
      setRemainingSec(rem);
      setStatus(rem > 0 ? 'ok' : 'expired');
    } catch {
      // in caso di errore rete consideriamo non autenticato
      setStatus('unauth');
      setExpMs(null);
      setRemainingSec(null);
    }
  }

  useEffect(() => {
    // primo caricamento
    fetchSession();

    // tick 1s
    tickRef.current = window.setInterval(() => {
      setRemainingSec(prev => {
        if (prev == null) return prev;
        const next = prev - 1;
        if (next <= 0) {
          if (onExpire) onExpire();
        }
        return next;
      });
    }, 1000) as unknown as number;

    // polling claims periodico (per eventuale rotazione token)
    pollRef.current = window.setInterval(() => {
      fetchSession();
    }, refreshEveryMs) as unknown as number;

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aggiorna stato quando il contatore scende a 0
  useEffect(() => {
    if (remainingSec != null && remainingSec <= 0 && status !== 'expired') {
      setStatus('expired');
    }
  }, [remainingSec, status]);

  const titleText = useMemo(() => {
    if (!expMs) return 'Sessione non attiva';
    try {
      return `Scadenza: ${new Date(expMs).toLocaleString()}`;
    } catch {
      return 'Scadenza non disponibile';
    }
  }, [expMs]);

  const sev: 'ok' | 'warn' | 'danger' | 'off' = useMemo(() => {
    if (status === 'unauth') return 'off';
    if (status === 'expired' || (remainingSec != null && remainingSec <= 0)) return 'danger';
    if (remainingSec != null && remainingSec <= warnAtSec) return 'warn';
    return 'ok';
  }, [status, remainingSec, warnAtSec]);

  // Stili minimali inline per evitare dipendenze
  const styles: Record<string, React.CSSProperties> = {
    pill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.25rem 0.5rem',
      borderRadius: '999px',
      fontSize: '0.8rem',
      lineHeight: 1.1,
      userSelect: 'none',
      border: '1px solid transparent',
      ...(sev === 'ok' && { color: '#0a5', background: 'rgba(0,160,80,0.08)', borderColor: 'rgba(0,160,80,0.25)' }),
      ...(sev === 'warn' && { color: '#b26b00', background: 'rgba(255,165,0,0.12)', borderColor: 'rgba(255,165,0,0.35)' }),
      ...(sev === 'danger' && { color: '#b00020', background: 'rgba(176,0,32,0.10)', borderColor: 'rgba(176,0,32,0.35)' }),
      ...(sev === 'off' && { color: '#666', background: 'rgba(0,0,0,0.05)', borderColor: 'rgba(0,0,0,0.15)' }),
    },
    dot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background:
        sev === 'ok' ? '#0a5' : sev === 'warn' ? '#ffa500' : sev === 'danger' ? '#b00020' : '#999',
      flex: '0 0 8px',
    },
    label: { fontWeight: 600 },
    value: { fontVariantNumeric: 'tabular-nums' as any },
    sr: { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, border: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
  };

  return (
    <div style={styles.pill} title={titleText} aria-live="polite" aria-label="Stato sessione">
      <span style={styles.dot} aria-hidden="true" />
      <span style={styles.label}>Sessione:</span>
      <span style={styles.value}>
        {status === 'loading' && '…'}
        {status === 'unauth' && 'non attiva'}
        {status !== 'loading' && status !== 'unauth' && remainingSec != null && fmtHms(remainingSec)}
        {status === 'expired' && 'scaduta'}
      </span>
      <span style={styles.sr}>
        {expMs ? `Scade il ${new Date(expMs).toLocaleString()}` : 'Nessuna scadenza disponibile'}
      </span>
    </div>
  );
}