import { useEffect, useMemo, useState } from 'react';
import LogoutButton from '../components/LogoutButton';
import SessionExpiry from '../components/SessionExpiry';
import LineCard from '../components/LineCard';
import CreditButton from '../components/ui/CreditButton';
import { extractLineInfo, type ParsedLineInfo } from '../lib/lineInfo';
import fetchWithRefresh from '../lib/fetchWithRefresh';

interface SessionResp { ok?: boolean; claims?: any; }
interface LoadedLine {
  lineId: string;
  contractId: string | null;
  loading: boolean;
  info?: ParsedLineInfo;
  error?: string;
}

const FAVORITE_KEY = 'very_favorite_line';

function formatEuro(v?: number) {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  try {
    return v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  } catch {
    return `${v.toFixed(2)} €`;
  }
}

export default function Home() {
  const [session, setSession] = useState<SessionResp | null>(null);
  const [lines, setLines] = useState<LoadedLine[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [current, setCurrent] = useState(0);
  const [favorite, setFavorite] = useState<string | null>(null);

  // Carica preferita da localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem(FAVORITE_KEY);
      if (v) setFavorite(v);
    } catch {}
  }, []);

  // Verifica sessione e inizializza lista linee dall'ID presenti nelle claims
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

  // Mappa lineId -> contractId
  useEffect(() => {
    (async () => {
      if (!session?.ok) return;
      const r = await fetch('/api/me/contracts', { credentials: 'include' });
      if (!r.ok) {
        setLines(prev => prev.map(l => ({ ...l, loading: false, error: 'Completa login OTP per generare la mappa contratti.' })));
        return;
      }
      const j = await r.json();
      const map: Record<string, string> = j?.map || {};
      setLines(prev => prev.map(l => ({ ...l, contractId: map[l.lineId] || null, loading: true, error: undefined })));
    })();
  }, [session?.ok]);

  // Per ogni linea con contractId, carica i dettagli lineunfolded via proxy
  useEffect(() => {
    lines.forEach((ln, idx) => {
      if (!ln.loading) return;
      if (!ln.contractId) {
        setLines(prev => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], loading: false, error: 'ContractId assente. Completa login OTP.' };
          return copy;
        });
        return;
      }
      const path = `/ob/v2/contract/lineunfolded?contractId=${encodeURIComponent(ln.contractId)}&lineId=${encodeURIComponent(ln.lineId)}`;
      // use fetchWithRefresh to allow a refresh attempt on 401
      fetchWithRefresh(`/api/proxy-auth?path=${encodeURIComponent(path)}`)
        .then(async (r) => {
          if (r.status === 401) {
            // refresh not possible or failed -> force login
            window.location.href = '/login';
            return;
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines.map(l => ({ id: l.lineId, cid: l.contractId, loading: l.loading })))]);

  // Se esiste preferita, porta il carosello su quella
  useEffect(() => {
    if (!favorite || lines.length === 0) return;
    const idx = lines.findIndex(l => l.lineId === favorite);
    if (idx >= 0) setCurrent(idx);
  }, [favorite, lines]);

  // Toggle preferita (una sola)
  function toggleFavorite(lineId: string) {
    const next = favorite === lineId ? null : lineId;
    setFavorite(next);
    try {
      if (next) localStorage.setItem(FAVORITE_KEY, next);
      else localStorage.removeItem(FAVORITE_KEY);
    } catch {}
    if (next) {
      const idx = lines.findIndex(l => l.lineId === next);
      if (idx >= 0) setCurrent(idx);
    }
  }

  const loggedIn = !!session?.ok;

  const active = lines[current] || null;
  const activeInfo = active?.info;

  // PATCH: Estrai i 3 valori del credito dalla activeInfo
  const creditTotal = typeof activeInfo?.creditTotal === 'number' ? activeInfo.creditTotal : 0;
  const creditRegular = typeof activeInfo?.creditRegular === 'number' ? activeInfo.creditRegular : 0;
  const creditPromo = typeof activeInfo?.creditPromo === 'number' ? activeInfo.creditPromo : 0;

  const totalLines = lines.length;
  function go(i: number) {
    if (totalLines === 0) return;
    const next = (i + totalLines) % totalLines;
    setCurrent(next);
  }

  return (
    <main style={{ padding: '1rem 1rem 0', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <header className="app-header">
        <h1 className="app-header__title">Very</h1>
        {loggedIn && (
          <div className="app-header__right">
            <SessionExpiry
              warnAtSec={5 * 60}
              refreshEveryMs={60_000}
              onExpire={() => { window.location.href = '/login'; }}
            />
            <LogoutButton />
          </div>
        )}
      </header>

      {!loggedIn && loadingSession && <p>Verifica sessione…</p>}

      {loggedIn && (
        <>
          {totalLines > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                <button
                  aria-label="Linea precedente"
                  onClick={() => go(current - 1)}
                  style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#0a5d36' }}
                >
                  ‹
                </button>
                <div style={{ flex: '1 1 auto', maxWidth: 960 }}>
                  {active && active.info && (
                    <LineCard
                      info={active.info}
                      isFavorite={favorite === active.lineId}
                      onToggleFavorite={() => toggleFavorite(active.lineId)}
                    />
                  )}
                </div>
                <button
                  aria-label="Linea successiva"
                  onClick={() => go(current + 1)}
                  style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#0a5d36' }}
                >
                  ›
                </button>
              </div>

              <div className="carousel-nav" aria-label="Selettore linea">
                {Array.from({ length: totalLines }).map((_, i) => (
                  <div
                    key={i}
                    className={`dot ${i === current ? 'dot--active' : ''}`}
                    role="button"
                    aria-label={`Vai alla linea ${i + 1}`}
                    onClick={() => setCurrent(i)}
                  />
                ))}
              </div>
            </>
          )}

          <div style={{ maxWidth: 960, margin: '8px auto 0' }}>
            {lines.map((l) => l.error ? (
              <p key={l.lineId} style={{ color: '#b00020', margin: '4px 0' }}>
                {l.lineId}: {l.error}
              </p>
            ) : null)}
          </div>

          <div className="bottom-bar" role="contentinfo">
            <div className="bb__label">
              Credito residuo
              <span title="Somma di credito prepaid e bonus, quando disponibile.">ⓘ</span>
            </div>
            <div className="bb__value">
              <CreditButton
                total={creditTotal}
                regular={creditRegular}
                promo={creditPromo}
              />
            </div>
            <button className="bb__btn" onClick={() => window.location.href = '/ricarica'}>
              Ricarica
            </button>
          </div>
        </>
      )}
    </main>
  );
}