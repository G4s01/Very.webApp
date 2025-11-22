import { useEffect, useMemo, useRef, useState } from 'react';
import LineCard from '../components/LineCard';
import CreditButton from '../components/ui/CreditButton';
import { extractLineInfo, type ParsedLineInfo } from '../lib/lineInfo';
import fetchWithRefresh from '../lib/fetchWithRefresh';
import AccountSwitcher, { type Account } from '../components/AccountSwitcher';
import TopBar from '../components/TopBar';
import RightCard from '../components/RightCard';

interface SessionResp { ok?: boolean; claims?: any; }
interface LoadedLine {
  lineId: string;
  contractId: string | null;
  loading: boolean;
  info?: ParsedLineInfo;
  error?: string;
}

const FAVORITE_KEY = 'very_favorite_line';

/* MOCK ACCOUNTS used only as sample data for AccountSwitcher previews */
const MOCK_ACCOUNTS: Account[] = [
  { id: 'mock-a1', name: 'Michele Gastaldi', email: 'michele@example.com' },
  { id: 'mock-a2', name: 'Luca Rossi', email: 'luca@example.com' },
  { id: 'mock-a3', name: 'Anna Bianchi', email: 'anna@example.com' },
  { id: 'mock-a4', name: 'Giulia Verdi', email: 'giulia@example.com' },
  { id: 'mock-a5', name: 'Marco Neri', email: 'marco@example.com' },
  { id: 'mock-a6', name: 'Paolo Blu', email: 'paolo@example.com' },
  { id: 'mock-a7', name: 'Elena Gialli', email: 'elena@example.com' },
];

function deriveUserFullName(claims: any): string | undefined {
  if (!claims) return undefined;
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

  // UI toggle only used to control AccountSwitcher preview (kept for convenience)
  const [useMockAccounts, setUseMockAccounts] = useState<boolean>(false);

  // fallback display info so LineCard doesn't vanish when switching
  const [displayInfo, setDisplayInfo] = useState<ParsedLineInfo | null>(null);
  const [displayLineId, setDisplayLineId] = useState<string | null>(null);
  const [loadingLineId, setLoadingLineId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(FAVORITE_KEY);
      if (v) setFavorite(v);
    } catch {}
  }, []);

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

  const ongoingFetches = useRef(new Set<string>());
  useEffect(() => {
    let mounted = true;
    const controllers: Record<string, AbortController> = {};

    lines.forEach((ln) => {
      const lineId = ln.lineId;
      if (!ln.loading) return;
      if (!ln.contractId) {
        setLines(prev => {
          const copy = prev.slice();
          const idx = copy.findIndex(x => x.lineId === lineId);
          if (idx >= 0 && copy[idx].loading) {
            copy[idx] = { ...copy[idx], loading: false, error: 'ContractId assente. Completa login OTP.' };
          }
          return copy;
        });
        return;
      }
      if (ongoingFetches.current.has(lineId)) return;

      ongoingFetches.current.add(lineId);
      const controller = new AbortController();
      controllers[lineId] = controller;

      const path = `/ob/v2/contract/lineunfolded?contractId=${encodeURIComponent(ln.contractId)}&lineId=${encodeURIComponent(lineId)}`;

      fetchWithRefresh(`/api/proxy-auth?path=${encodeURIComponent(path)}`, { signal: controller.signal })
        .then(async (r) => {
          if (!mounted) return;
          if (r.status === 401) {
            window.location.href = '/login';
            return;
          }
          const j = await r.json().catch(() => ({}));
          setLines(prev => {
            const copy = prev.slice();
            const foundIdx = copy.findIndex(x => x.lineId === lineId);
            if (foundIdx >= 0) {
              copy[foundIdx] = {
                ...copy[foundIdx],
                loading: false,
                info: r.ok ? extractLineInfo(j)[0] : undefined,
                error: r.ok ? undefined : (j?.error || 'Errore upstream')
              };
            }
            return copy;
          });
        })
        .catch(e => {
          if (!mounted) return;
          if (e?.name === 'AbortError') return;
          setLines(prev => {
            const copy = prev.slice();
            const foundIdx = copy.findIndex(x => x.lineId === lineId);
            if (foundIdx >= 0) {
              copy[foundIdx] = { ...copy[foundIdx], loading: false, error: String(e?.message || e) };
            }
            return copy;
          });
        })
        .finally(() => {
          ongoingFetches.current.delete(lineId);
          delete controllers[lineId];
        });
    });

    return () => {
      mounted = false;
      Object.values(controllers).forEach(c => c.abort());
      ongoingFetches.current.clear();
    };
  }, [lines]);

  const loggedIn = !!session?.ok;
  const active = lines[current] || null;
  useEffect(() => {
    const newId = active?.lineId ?? null;
    if (!newId) return;
    if (active?.info) {
      setDisplayInfo(active.info);
      setDisplayLineId(newId);
      setLoadingLineId(null);
    } else {
      setLoadingLineId(newId);
    }
  }, [active?.lineId, active?.info]);

  useEffect(() => {
    if (!favorite || lines.length === 0) return;
    const idx = lines.findIndex(l => l.lineId === favorite);
    if (idx >= 0) setCurrent(idx);
  }, [favorite, lines]);

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

  const activeInfo = active?.info;
  const shownInfo = displayInfo ?? activeInfo ?? null;
  const isLoadingTarget = loadingLineId !== null && loadingLineId !== displayLineId;

  const creditTotal = typeof activeInfo?.creditTotal === 'number' ? activeInfo.creditTotal : (typeof displayInfo?.creditTotal === 'number' ? displayInfo.creditTotal : 0);
  const creditRegular = typeof activeInfo?.creditRegular === 'number' ? activeInfo.creditRegular : (typeof displayInfo?.creditRegular === 'number' ? displayInfo.creditRegular : 0);
  const creditPromo = typeof activeInfo?.creditPromo === 'number' ? activeInfo.creditPromo : (typeof displayInfo?.creditPromo === 'number' ? displayInfo?.creditPromo : 0);

  const totalLines = lines.length;
  function go(i: number) {
    if (totalLines === 0) return;
    const next = (i + totalLines) % totalLines;
    setCurrent(next);
  }

  const accounts: Account[] = useMemo(() => {
    if (useMockAccounts) return MOCK_ACCOUNTS;
    const globalName = deriveUserFullName(session?.claims) || undefined;
    return lines.map((l, idx) => {
      const candidateName =
        (l.info as any)?.accountHolderName ||
        (l.info as any)?.ownerName ||
        globalName ||
        `Linea ${idx + 1}`;
      const avatarBg = undefined;
      return { id: l.lineId, name: candidateName, avatarBg };
    });
  }, [lines, useMockAccounts, session?.claims]);

  const activeId = active?.lineId;

  // layout constants (must match AccountSwitcher.module.css)
  const accountSwitcherLeftOffset = 12;  // gap from page left to AccountSwitcher start
  const accountSwitcherWidth = 96;       // rail width = card width
  // choose paddings so their SUM equals accountSwitcherLeftOffset (12)
  const mainHorizontalPadding = 8;           // main padding left/right
  const contentWrapperHorizontalPadding = 4; // inner wrapper padding left/right

  // column gap must equal the reference gap (accountSwitcherLeftOffset)
  const columnGap = accountSwitcherLeftOffset;

  return (
    <div style={{ ['--bottombar-height' as any]: '72px' }}>
      {/* AccountSwitcher rail (fixed) */}
      <AccountSwitcher
        accounts={accounts}
        activeId={activeId}
        onSelect={(id) => {
          const idx = lines.findIndex(l => l.lineId === id);
          if (idx >= 0) setCurrent(idx);
        }}
      />

      {/* Single TopBar instance: pass offsets and paddings so TopBar aligns with LineCard/RightCard */}
      <TopBar
        accountSwitcherLeftOffset={accountSwitcherLeftOffset}
        accountSwitcherWidth={accountSwitcherWidth}
        mainHorizontalPadding={mainHorizontalPadding}
        contentWrapperHorizontalPadding={contentWrapperHorizontalPadding}
      />

      <main style={{
        padding: `0 ${mainHorizontalPadding}px 0`,
        fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
        marginLeft: `${accountSwitcherLeftOffset + accountSwitcherWidth}px`,
        width: `calc(100% - ${accountSwitcherLeftOffset + accountSwitcherWidth}px)`
      }}>
        {!loggedIn && loadingSession && <p>Verifica sessione…</p>}

        {loggedIn && (
          <>
            <div style={{ width: '100%', margin: '8px 0 0' }}>
              {lines.map((l) => l.error ? (
                <p key={l.lineId} style={{ color: '#b00020', margin: '4px 0' }}>
                  {l.lineId}: {l.error}
                </p>
              ) : null)}
            </div>

            <div style={{ width: '100%', margin: '12px 0 0', padding: `0 ${contentWrapperHorizontalPadding}px`, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', gap: `${columnGap}px`, alignItems: 'stretch' }}>
                <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                  <div style={{ width: 'auto', maxWidth: 720 }}>
                    {shownInfo ? (
                      <LineCard
                        info={shownInfo}
                        isFavorite={favorite === (displayLineId ?? activeId)}
                        onToggleFavorite={() => {
                          const lid = displayLineId ?? activeId;
                          if (lid) toggleFavorite(lid);
                        }}
                        onPrev={() => go(current - 1)}
                        onNext={() => go(current + 1)}
                      />
                    ) : (
                      <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6b6b' }}>
                        Caricamento dati linea…
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'stretch' }}>
                  <RightCard title="Right Panel">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>Controllo 1</div>
                      <div>Controllo 2</div>
                    </div>
                  </RightCard>
                </div>
              </div>

              {totalLines > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
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
                </div>
              )}

              {isLoadingTarget && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, color: '#6b6b6b', fontSize: 13 }}>
                  Caricamento dati della linea selezionata…
                </div>
              )}
            </div>

            <div className="bottom-bar" role="contentinfo" style={{ width: '100%', margin: '18px 0 0', padding: '0 12px', boxSizing: 'border-box' }}>
              <div className="bb__label">
                Credito residuo
                <span title="Somma di credito prepaid e bonus, quando disponibile.">ⓘ</span>
              </div>
              <div className="bb__value" style={{ display: 'inline-block', marginLeft: 12 }}>
                <CreditButton
                  total={creditTotal}
                  regular={creditRegular}
                  promo={creditPromo}
                />
              </div>
              <button className="bb__btn" onClick={() => window.location.href = '/ricarica'} style={{ marginLeft: 12 }}>
                Ricarica
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}