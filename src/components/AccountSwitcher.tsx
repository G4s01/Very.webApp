import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './AccountSwitcher.module.css';

export type Account = {
  id: string;
  name?: string; // full name used only for aria-label and initials extraction
  avatarBg?: string; // optional background color for initials tile (prefers explicit)
  avatarUrl?: string;
};

export type AccountSwitcherProps = {
  accounts: Account[];
  activeId?: string;
  onSelect?: (id: string) => void;
  width?: number;
  className?: string;
};

/** localStorage key used to persist per-account colors */
const STORAGE_KEY = 'account_switcher_colors_v1';

/** Default palette shown in the picker (high contrast, varied hues) */
const DEFAULT_PALETTE = Array.from(new Set([
  '#FDE68A', // amber
  '#FCA5A5', // red/pink
  '#FBCFE8', // pink
  '#C7F9CC', // green
  '#BFDBFE', // blue light
  '#D8B4FE', // purple
  '#FCD34D', // yellow
  '#CFFAFE', // cyan
  '#FEE2B3', // apricot
  '#E6E6FA', // lavender
  '#FFD6E0', // soft rose
]));

/** Deterministic pastel-ish color from string (fallback when no explicit color) */
function colorFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  const hue = Math.abs(h) % 360;
  const sat = 58 + (Math.abs(h) % 12); // 58-69
  const light = 84 - (Math.abs(h) % 8); // 84-77
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/** Return two-letter initials: first + last name (or first two letters if single word) */
function initialsOf(name?: string) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1][0] ?? '';
  return `${first}${last}`.toUpperCase();
}

type PickerState = {
  accountId: string;
  left: number;
  top: number;
  openAbove: boolean;
} | null;

export default function AccountSwitcher({
  accounts,
  activeId,
  onSelect,
  width,
  className,
}: AccountSwitcherProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const [showBottomHint, setShowBottomHint] = useState(false);

  // map accountId -> color string persisted in localStorage
  const [colorsMap, setColorsMap] = useState<Record<string, string>>({});
  // which account currently has the color picker open (portal-based)
  const [picker, setPicker] = useState<PickerState>(null);
  // flash state per account for animation
  const [flashMap, setFlashMap] = useState<Record<string, boolean>>({});
  // accent color shown on the card (derived from active account color if any)
  const [cardAccent, setCardAccent] = useState<string | null>(null);

  // load persisted colors once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setColorsMap(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // persist when colorsMap changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(colorsMap));
    } catch {
      // ignore
    }
  }, [colorsMap]);

  // update card accent when activeId or colorsMap changes
  useEffect(() => {
    if (activeId && colorsMap[activeId]) {
      setCardAccent(colorsMap[activeId]);
    } else {
      setCardAccent(null);
    }
  }, [activeId, colorsMap]);

  // compute bottom hint (scrollable)
  useEffect(() => {
    function updateHint() {
      const el = containerRef.current;
      if (!el) {
        setShowBottomHint(false);
        return;
      }
      const isScrollable = el.scrollHeight > el.clientHeight + 1;
      if (!isScrollable) {
        setShowBottomHint(false);
        return;
      }
      const scrolledToBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      setShowBottomHint(!scrolledToBottom);
    }

    updateHint();
    const el = containerRef.current;
    if (el) el.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);
    return () => {
      if (el) el.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, [accounts]);

  // click outside to close palette (works with portal)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!picker) return;
      const target = e.target as Node | null;
      const menuEl = paletteRef.current;
      // if click inside the palette, keep open
      if (menuEl && menuEl.contains(target)) return;
      // if click on a palette button (which is outside the portal) we don't want to prematurely close,
      // but palette button click toggles picker before this handler runs (onClick). For safety: close.
      setPicker(null);
    }
    if (picker) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
    return;
  }, [picker]);

  function handleSelect(id: string) {
    if (onSelect) onSelect(id);
  }

  function openPickerFor(accountId: string, anchorEl: HTMLElement | null) {
    if (!anchorEl) {
      setPicker(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const paletteWidth = 176; // matches CSS
    const paletteHeight = 120; // approximate: grid + actions
    // desired centered horizontally under tile
    let left = rect.left + rect.width / 2 - paletteWidth / 2;
    // preferred below the tile
    let top = rect.bottom + 8;
    let openAbove = false;
    // clamp horizontally
    const pad = 8;
    if (left < pad) left = pad;
    if (left + paletteWidth > window.innerWidth - pad) left = window.innerWidth - pad - paletteWidth;
    // if not enough space below, open above
    if (rect.bottom + 8 + paletteHeight > window.innerHeight) {
      // open above
      openAbove = true;
      top = rect.top - 8 - paletteHeight;
      // if still outside top, clamp to pad
      if (top < pad) top = pad;
    }
    setPicker({ accountId, left, top, openAbove });
  }

  function handleOpenClick(e: React.MouseEvent, accountId: string) {
    e.stopPropagation();
    // get the outer itemWrap element as anchor
    const el = (e.currentTarget as HTMLElement).closest(`.${styles.itemWrap}`) as HTMLElement | null;
    if (picker && picker.accountId === accountId) {
      setPicker(null);
      return;
    }
    openPickerFor(accountId, el);
  }

  function handlePickColor(accountId: string, color: string) {
    // set color and trigger flash animation for that account
    setColorsMap(prev => ({ ...prev, [accountId]: color }));
    setFlashMap(prev => ({ ...prev, [accountId]: true }));
    // clear flash after short time
    window.setTimeout(() => {
      setFlashMap(prev => {
        const copy = { ...prev };
        delete copy[accountId];
        return copy;
      });
    }, 420);
    // set card accent to this color (immediate visual)
    setCardAccent(color);
    setPicker(null);
  }

  function handleClearColor(accountId: string) {
    setColorsMap(prev => {
      const copy = { ...prev };
      delete copy[accountId];
      return copy;
    });
    // small flash as feedback
    setFlashMap(prev => ({ ...prev, [accountId]: true }));
    window.setTimeout(() => {
      setFlashMap(prev => {
        const copy = { ...prev };
        delete copy[accountId];
        return copy;
      });
    }, 420);
    // if the cleared account was active, remove card accent
    if (accountId === activeId) setCardAccent(null);
    setPicker(null);
  }

  const styleVars: React.CSSProperties = {};
  if (width) {
    styleVars.width = `${width}px`;
    styleVars.minWidth = `${width}px`;
  }

  // Portal content for palette (rendered outside and absolutely positioned)
  const palettePortal = picker ? ReactDOM.createPortal(
    <div
      ref={paletteRef}
      className={styles.paletteMenu}
      role="dialog"
      aria-label="Scegli colore"
      style={{ left: picker.left, top: picker.top, position: 'fixed' }}
    >
      <div className={styles.paletteGrid}>
        {DEFAULT_PALETTE.map((col, idx) => {
          const isSelected = (colorsMap[picker.accountId] ?? '') === col;
          return (
            <button
              key={`${col}-${idx}`}
              className={`${styles.swatch} ${isSelected ? styles.swatchSelected : ''}`}
              onClick={(ev) => { ev.stopPropagation(); handlePickColor(picker.accountId, col); }}
              style={{ background: col }}
              aria-label={`Seleziona colore ${col}`}
              type="button"
            />
          );
        })}
      </div>
      <div className={styles.paletteActions}>
        <button
          className={styles.clearBtn}
          onClick={(e) => { e.stopPropagation(); handleClearColor(picker!.accountId); }}
          type="button"
        >
          Ripristina
        </button>
        <button
          className={styles.closeBtn}
          onClick={(e) => { e.stopPropagation(); setPicker(null); }}
          type="button"
        >
          Chiudi
        </button>
      </div>
    </div>,
    // render into body so it's outside any clipping/overflow
    typeof document !== 'undefined' ? document.body : document.createElement('div')
  ) : null;

  return (
    <>
      <aside
        className={`${styles.wrapper} ${className ?? ''}`}
        style={styleVars}
        aria-label="Account Switcher"
      >
        {/* Group card containing all account tiles */}
        <div
          className={`${styles.card} ${cardAccent ? styles.hasAccent : ''}`}
          role="group"
          aria-label="Accounts group"
          style={cardAccent ? { ['--card-accent' as any]: cardAccent } : undefined}
        >
          <div className={styles.listWrap}>
            <div className={styles.list} ref={containerRef} role="list">
              {accounts.map(acc => {
                const selected = acc.id === activeId;
                const initials = initialsOf(acc.name);
                const explicit = acc.avatarBg;
                const persisted = colorsMap[acc.id];
                const tileBg = explicit ?? persisted ?? colorFromId(acc.id);
                const ariaLabel = acc.name ? `${acc.name}` : `Account ${acc.id}`;
                const isFlashing = !!flashMap[acc.id];

                return (
                  <div className={styles.itemWrap} key={acc.id}>
                    <button
                      role="listitem"
                      aria-pressed={selected}
                      aria-label={ariaLabel}
                      className={`${styles.accountBtn} ${selected ? styles.selected : ''} ${persisted ? styles.hasCustom : ''}`}
                      onClick={() => handleSelect(acc.id)}
                      title={acc.name ?? acc.id}
                      type="button"
                    >
                      <span
                        className={`${styles.tile} ${isFlashing ? styles.flash : ''}`}
                        style={{ background: acc.avatarUrl ? undefined : tileBg }}
                      >
                        {acc.avatarUrl ? (
                          <img src={acc.avatarUrl} alt={acc.name ? `${acc.name} avatar` : 'avatar'} />
                        ) : (
                          <span className={styles.initials}>{initials}</span>
                        )}
                      </span>
                    </button>

                    {/* palette button (small) top-right of the outer button */}
                    <button
                      aria-label={`Cambia colore account ${acc.name ?? acc.id}`}
                      className={styles.paletteBtn}
                      onClick={(e) => handleOpenClick(e, acc.id)}
                      title="Cambia colore"
                      type="button"
                    >
                      {/* simple palette SVG icon */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
                        <path d="M12 3C7.03 3 3 7.03 3 12a7 7 0 0012 4.9A1.5 1.5 0 0018.5 16c0-2.48 2.02-4.5 4.5-4.5S27.5 13.52 27.5 16 25.48 20.5 23 20.5h-1.5" transform="scale(.8)" stroke="#22333b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="6" cy="6" r="1.4" transform="scale(.9) translate(2,2)" fill="#22333b"/>
                        <circle cx="10" cy="8" r="1.2" transform="scale(.9) translate(2,2)" fill="#22333b"/>
                        <circle cx="7" cy="11" r="0.9" transform="scale(.9) translate(2,2)" fill="#22333b"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className={`${styles.bottomHint} ${showBottomHint ? styles.visible : ''}`} aria-hidden />
          </div>
        </div>
      </aside>

      {palettePortal}
    </>
  );
}