import { useEffect, useState } from 'react';
import LogoutButton from '../components/LogoutButton';
import SessionExpiry from '../components/SessionExpiry';
import { extractLineInfo, formatEuro, formatGiga } from '../lib/lineInfo';

interface SessionResp { ok?: boolean; claims?: any; }
interface LoadedLine {
  lineId: string;
  contractId: string | null;
  loading: boolean;
  info?: ReturnType<typeof extractLineInfo>[0];
  error?: string;
}

export default function Home() {
  const [session, setSession] = useState<SessionResp | null>(null);
  const [lines, setLines] = useState<LoadedLine[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingSession(true);
      try {
        const r = await fetch('/api/auth/session', { credentials: 'include' });
        if (!r.ok) { window.location.href = '/login'; return; }
        const data = await r.json();
        setSession(data);

        let candidate: string[] = [];
        const contractsClaim = data?.claims?.contracts;
        if (Array.isArray(contractsClaim)) {
          contractsClaim.forEach((c: any) => {
            if (Array.isArray(c.lines)) {
              c.lines.forEach((lid: any) => {
                if (typeof lid === 'string') candidate.push(lid);
                else if (lid?.id) candidate.push(String(lid.id));
              });
            }
          });
        }
        candidate = Array.from(new Set(candidate));
        setLines(candidate.map(lid => ({ lineId: lid, contractId: null, loading: true })));
      } catch {
        window.location.href = '/login';
      } finally {
        setLoadingSession(false);
      }
    })();
  }, []);

  async function loadContractsMap() {
    setMapLoading(true);
    try {
      const r = await fetch('/api/me/contracts', { credentials: 'include' });
      if (!r.ok) {
        setLines(prev => prev.map(l => ({
          ...l, loading: false, error: 'Mappa contractId non disponibile. Completa login OTP.'
        })));
        return;
      }
      const j = await r.json();
      const map: Record<string, string> = j?.map || {};
      setLines(prev => prev.map(l => ({
        ...l,
        contractId: map[l.lineId] || l.contractId,
        loading: true,
        error: undefined
      })));
    } finally {
      setMapLoading(false);
    }
  }

  useEffect(() => { if (session?.ok) loadContractsMap(); }, [session?.ok]);

  useEffect(() => {
    lines.forEach((ln, idx) => {
      if (!ln.loading) return;
      if (!ln.contractId) {
        setLines(prev => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], loading: false, error: 'ContractId assente. Esegui login OTP per generare la mappa.' };
          return copy;
        });
        return;
      }
      const path = `/ob/v2/contract/lineunfolded?contractId=${encodeURIComponent(ln.contractId)}&lineId=${encodeURIComponent(ln.lineId)}`;
      fetch(`/api/proxy-auth?path=${encodeURIComponent(path)}`, { credentials: 'include' })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          setLines(prev => {
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              loading: false,
              info: r.ok ? extractLineInfo(j)[0] : undefined,
              error: r.ok ? undefined : (j?.error || 'Errore upstream')
            };
            return copy;
          });
        })
        .catch(e => {
          setLines(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], loading: false, error: String(e?.message || e) };
            return copy;
          });
        });
    });
  }, [JSON.stringify(lines.map(l => ({ id: l.lineId, cid: l.contractId, loading: l.loading })))]);

  const loggedIn = !!session?.ok;

  return (
    <main style={{ padding: '1.2rem', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Dashboard Very</h1>
        {loggedIn && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
            <SessionExpiry
              warnAtSec={5 * 60}
              refreshEveryMs={60_000}
              onExpire={() => {
                // opzionale: al termine, reindirizza al login
                // window.location.href = '/login';
              }}
            />
            <LogoutButton />
          </div>
        )}
      </header>

      {!loggedIn && loadingSession && <p>Verifica sessione…</p>}

      {loggedIn && (
        <section aria-labelledby="lines-heading">
          <h2 id="lines-heading" style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Le tue linee</h2>

          {mapLoading && <p style={{ opacity: 0.7 }}>Carico mappa contratti…</p>}

          {!lines.length && <p>Nessuna linea rilevata nelle claims. Completa login OTP o ricarica.</p>}

          <div style={{ display: 'grid', gap: '1rem' }}>
            {lines.map(l => {
              const i = l.info;
              const hasBreakdown =
                typeof i?.creditBreakdown?.prepaid === 'number' ||
                typeof i?.creditBreakdown?.bonus === 'number';
              return (
                <article
                  key={l.lineId}
                  style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '0.8rem', background: '#fff' }}
                  aria-busy={l.loading}
                >
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{l.lineId}</h3>
                  </header>

                  {l.loading && <p style={{ opacity: 0.7 }}>Caricamento…</p>}

                  {l.error && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <p style={{ color: '#b00', margin: '0 0 0.5rem' }}>{l.error}</p>
                    </div>
                  )}

                  {!l.loading && !l.error && i && (
                    <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      <div><strong>Offerta:</strong> {i.offerName || '—'}</div>
                      <div><strong>Rinnovo:</strong> {i.offerRenewalDate || '—'}</div>
                      <div>
                        <strong>Credito totale:</strong> {formatEuro(i.creditTotal)}
                        {hasBreakdown && (
                          <span style={{ opacity: 0.7 }}>
                            {' '} (Prepaid {formatEuro(i.creditBreakdown?.prepaid)} + Bonus {formatEuro(i.creditBreakdown?.bonus)})
                          </span>
                        )}
                      </div>
                      <div>
                        <strong>GIGA nazionali:</strong> {formatGiga(i.gigaNational?.available)} / {formatGiga(i.gigaNational?.total)}
                        {typeof i.gigaNational?.percent === 'number' && <span style={{ opacity: 0.7 }}> ({i.gigaNational.percent}% rimasti)</span>}
                      </div>
                      <div>
                        <strong>GIGA roaming:</strong> {formatGiga(i.gigaRoaming?.available)} / {formatGiga(i.gigaRoaming?.total)}
                        {typeof i.gigaRoaming?.percent === 'number' && <span style={{ opacity: 0.7 }}> ({i.gigaRoaming.percent}% rimasti)</span>}
                      </div>
                      {i.planActivationDate && <div><strong>Attivazione piano:</strong> {i.planActivationDate}</div>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => location.reload()}
              style={{ background: '#0a5', color: '#fff', border: 'none', padding: '0.45rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Ricarica
            </button>
            <button
              onClick={() => window.location.href = '/login'}
              style={{ background: '#333', color: '#fff', border: 'none', padding: '0.45rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Re‑autenticati
            </button>
          </div>
        </section>
      )}
    </main>
  );
}