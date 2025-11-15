import { useEffect, useState } from 'react';

type MeLines = { lines: Array<{ lineId: string; contractId?: string }> };
type LineUnfolded = any;
type CreditBalance = any;

export default function Home() {
  const [lines, setLines] = useState<Array<{ lineId: string; contractId?: string }>>([]);
  const [items, setItems] = useState<Array<{
    lineId: string;
    contractId?: string;
    unfolded?: LineUnfolded;
    credit?: number;
    loading: boolean;
    error?: string;
  }>>([]);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Session
    fetch('/api/auth/session', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(setSession)
      .catch(() => setSession(null));
    // Lines
    fetch('/api/me/lines', { credentials: 'include' })
      .then(r => r.json())
      .then((j: MeLines) => {
        const arr = Array.isArray(j?.lines) ? j.lines : [];
        setLines(arr);
        setItems(arr.map(l => ({ lineId: l.lineId, contractId: l.contractId, loading: true })));
      });
  }, []);

  useEffect(() => {
    if (!lines.length) return;
    // Per ogni linea, carica unfolded + credit in parallelo
    lines.forEach(({ lineId, contractId }, idx) => {
      const promises: Promise<any>[] = [];
      if (contractId) {
        promises.push(
          fetch(
            '/api/proxy-auth?path=' + encodeURIComponent(`/ob/v2/contract/lineunfolded?contractId=${encodeURIComponent(contractId)}&lineId=${encodeURIComponent(lineId)}`),
            { credentials: 'include' }
          ).then(r => r.json())
        );
      } else {
        promises.push(Promise.resolve(null));
      }
      promises.push(
        fetch('/api/proxy-auth?path=' + encodeURIComponent(`/v1/debits/credit/balance?lineId=${encodeURIComponent(lineId)}`),
          { credentials: 'include' }
        ).then(r => r.json())
      );

      Promise.all(promises)
        .then(([unfolded, credit]) => {
          setItems(prev => {
            const copy = [...prev];
            const item = { ...(copy[idx] || { lineId, contractId }) };
            item.unfolded = unfolded?.data || unfolded;
            const val = credit?.data?.debt?.[0]?.value;
            item.credit = typeof val === 'number' ? val : undefined;
            item.loading = false;
            copy[idx] = item;
            return copy;
          });
        })
        .catch(err => {
          setItems(prev => {
            const copy = [...prev];
            const item = { ...(copy[idx] || { lineId, contractId }) };
            item.error = String(err?.message || err);
            item.loading = false;
            copy[idx] = item;
            return copy;
          });
        });
    });
  }, [lines]);

  const loggedIn = !!session?.token;

  return (
    <main style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1>Very App</h1>
      {!loggedIn && (
        <p>Non sei autenticato. Esegui login (credentials → OTP) per vedere le linee.</p>
      )}
      {loggedIn && (
        <>
          <h2>Le tue linee</h2>
          {!items.length && <p>Nessuna linea trovata.</p>}
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((it) => {
              const plan = it.unfolded?.tariffPlan?.name || it.unfolded?.tariffPlan?.code || '';
              const status = it.unfolded?.status || '';
              const number = it.unfolded?.lines?.[0]?.id || it.lineId;
              const credit = it.credit;
              return (
                <div key={it.lineId} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong>{number}</strong>
                    <span style={{ opacity: 0.7 }}>{status}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div>Piano: <b>{plan || '—'}</b></div>
                    <div>Credito: <b>{credit != null ? credit.toFixed(2) + ' €' : '—'}</b></div>
                  </div>
                  {it.loading && <div style={{ marginTop: 6, opacity: 0.7 }}>Caricamento…</div>}
                  {it.error && <div style={{ marginTop: 6, color: '#b00' }}>Errore: {it.error}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}