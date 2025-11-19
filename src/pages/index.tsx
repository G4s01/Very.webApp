import { useEffect, useMemo, useState } from 'react';
import LogoutButton from '../components/LogoutButton';
import SessionExpiry from '../components/SessionExpiry';
import LineCard from '../components/LineCard';
import CreditButton from '../components/ui/CreditButton';
import { extractLineInfo, type ParsedLineInfo } from '../lib/lineInfo';
import fetchWithRefresh from '../lib/fetchWithRefresh';
import AccountSwitcher, { type Account } from '../components/AccountSwitcher';

interface SessionResp { ok?: boolean; claims?: any; }
interface LoadedLine {
  lineId: string;
  contractId: string | null;
  loading: boolean;
  info?: ParsedLineInfo;
  error?: string;
}

const FAVORITE_KEY = 'very_favorite_line';

/**
 * MOCK ACCOUNTS used for UI preview (toggleable from header)
 * You can edit/add entries here to see how AccountSwitcher behaves with many items.
 */
const MOCK_ACCOUNTS: Account[] = [
  { id: 'mock-a1', name: 'Michele Gastaldi', email: 'michele@example.com' },
  { id: 'mock-a2', name: 'Luca Rossi', email: 'luca@example.com' },
  { id: 'mock-a3', name: 'Anna Bianchi', email: 'anna@example.com' },
  { id: 'mock-a4', name: 'Giulia Verdi', email: 'giulia@example.com' },
  { id: 'mock-a5', name: 'Marco Neri', email: 'marco@example.com' },
  { id: 'mock-a6', name: 'Paolo Blu', email: 'paolo@example.com' },
  { id: 'mock-a7', name: 'Elena Gialli', email: 'elena@example.com' },
];

function formatEuro(v?: number) {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  try {
    return v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  } catch {
    return `${v.toFixed(2)} €`;
  }
}

/**
 * Helper: derive a human-readable full name from session claims or email.
 * Tries various claim fields in order, falls back to local-part of email,
 * finally returns undefined if nothing present.
 */
function deriveUserFullName(claims: any): string | undefined {
  if (!claims) return undefined;
  // Common places
  if (typeof claims.name === 'string' && claims.name.trim()) return claims.name.trim();
  if (claims.user && typeof claims.user === 'string' && claims.user.trim()) return claims.user.trim();
  if (claims.user && typeof claims.user.name === 'string' && claims.user.name.trim()) return claims.user.name.trim();
  if (typeof claims.fullname === 'string' && claims.fullname.trim()) return claims.fullname.trim();
  if (typeof claims.given_name === 'string' || typeof claims.family_name === 'string') {
    const g = (claims.given_name || '').trim();
    const f = (claims.family_name || '').trim();
    const both = `${g} ${f}`.trim();
    if (both) return both;
  }
  if (typeof claims.email === 'string' && claims.email.includes('@')) {
    const local = claims.email.split('@')[0].replace(/[._]/g, ' ').trim();
    if (local) return local.split(/\s+/).map((p: string) => p[0]?.toUpperCase() + p.slice(1)).join(' ');
  }
  if (typeof claims.sub === 'string' && claims.sub.trim()) return claims.sub.trim();
  return undefined;
}

export default function Home() {
  const [session, setSession] = useState<SessionResp | null>(null);
  const [lines, setLines] = useState<LoadedLine[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [current, setCurrent] = useState(0);
  const [favorite, setFavorite] = useState<string | null>(null);

  // NEW: UI toggle state to use mock accounts for preview
  const [useMockAccounts, setUseMockAccounts] = useState<boolean>(false);

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

  // Build accounts array: either from MOCK_ACCOUNTS (when previewing) or derived from lines.
  // For real accounts, derive a full name (first + last) from available session claims or line info;
  // AccountSwitcher will extract initials from this name.
  const accounts: Account[] = useMemo(() => {
    if (useMockAccounts) return MOCK_ACCOUNTS;
    const globalName = deriveUserFullName(session?.claims) || undefined;
    return lines.map((l, idx) => {
      // Prefer name present on the line info (owner/account holder), else use session-derived name,
      // else fallback to "Linea N"
      const candidateName =
        (l.info as any)?.accountHolderName ||
        (l.info as any)?.ownerName ||
        globalName ||
        `Linea ${idx + 1}`;
      // optional: vary avatarBg to differentiate tiles (deterministic via lineId)
      const avatarBg = undefined;
      return { id: l.lineId, name: candidateName, avatarBg };
    });
  }, [lines, useMockAccounts, session?.claims]);

  // activeId for AccountSwitcher
  const activeId = active?.lineId;

  return (
    // wrapper sets the bottombar height for the sidebar to respect
    <div style={{ ['--bottombar-height' as any]: '72px' }}>
      {/* AccountSwitcher UI: selection changes current index */}
      <AccountSwitcher
        accounts={accounts}
        activeId={activeId}
        onSelect={(id) => {
          const idx = lines.findIndex(l => l.lineId === id);
          if (idx >= 0) setCurrent(idx);
        }}
      />

      <main style={{ padding: '1rem 1rem 0', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', marginLeft: 96 }}>
        <header className="app-header">
          <h1 className="app-header__title">Very</h1>

          <div className="app-header__right" style={{ alignItems: 'center' }}>
            {/* Mock toggle visible when logged in so you can preview UI; you can adjust visibility rules */}
            {loggedIn && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={useMockAccounts}
                  onChange={(e) => setUseMockAccounts(e.target.checked)}
                />
                <span style={{ userSelect: 'none' }}>Mock accounts</span>
              </label>
            )}

            {loggedIn && (
              <>
                <SessionExpiry
                  warnAtSec={5 * 60}
                  refreshEveryMs={60_000}
                  onExpire={() => { window.location.href = '/login'; }}
                />
                <LogoutButton />
              </>
            )}
          </div>
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
    </div>
  );
}