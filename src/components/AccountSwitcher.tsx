import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './AccountSwitcher.module.css';

export type Account = {
  id: string;
  name?: string;
  avatarBg?: string;
  avatarUrl?: string;
};

export type AccountSwitcherProps = {
  accounts: Account[];
  activeId?: string;
  onSelect?: (id: string) => void;
  width?: number;
  className?: string;
};

const STORAGE_KEY = 'account_switcher_colors_v1';

// built-in fallback palette (used until/if dynamic import succeeds)
const BUILTIN_PALETTE = [
  '#99FFCC', '#C7F9CC', '#CFFAFE', '#FCA5A5',
  '#FFD6E0', '#FF99CC', '#FCD34D', '#FDE68A',
  '#FEE2B3', '#D8B4FE', '#E6E6FA', '#BFDBFE',
];

function colorFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  const hue = Math.abs(h) % 360;
  const sat = 58 + (Math.abs(h) % 12);
  const light = 84 - (Math.abs(h) % 8);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function initialsOf(name?: string) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type PickerState = {
  accountId: string;
  left: number;
  top: number;
  width: number;
  height: number;
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

  const [colorsMap, setColorsMap] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<PickerState>(null);
  const [flashMap, setFlashMap] = useState<Record<string, boolean>>({});
  const [cardAccent, setCardAccent] = useState<string | null>(null);

  // palette state (can be dynamically imported from JSON)
  const [palette, setPalette] = useState<string[]>(BUILTIN_PALETTE);

  // Palette layout constants
  const SWATCH = 16; // px
  const COLS = 3;
  const ROWS = 4;
  const GAP = 10; // px between swatches
  const PAD_LR = 10;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 16;

  useEffect(() => {
    (async () => {
      try {
        const mod = await import('../data/palette.json');
        const arr = (mod && (mod.default ?? mod)) as unknown;
        if (Array.isArray(arr) && arr.length) {
          setPalette(arr as string[]);
        }
      } catch {
        // ignore – use fallback
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setColorsMap(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(colorsMap));
    } catch {}
  }, [colorsMap]);

  useEffect(() => {
    if (activeId && colorsMap[activeId]) setCardAccent(colorsMap[activeId]);
    else setCardAccent(null);
  }, [activeId, colorsMap]);

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

  // close palette when clicking outside (works with portal)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!picker) return;
      const menuEl = paletteRef.current;
      const target = e.target as Node | null;
      if (menuEl && menuEl.contains(target)) return;
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

  function computePaletteSize() {
    const widthPx = PAD_LR * 2 + COLS * SWATCH + (COLS - 1) * GAP;
    const heightPx = PAD_TOP + ROWS * SWATCH + (ROWS - 1) * GAP + PAD_BOTTOM;
    return { width: Math.round(widthPx), height: Math.round(heightPx) };
  }

  function openPickerFor(accountId: string, anchorEl: HTMLElement | null) {
    if (!anchorEl) {
      setPicker(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const { width: paletteWidth, height: paletteHeight } = computePaletteSize();
    const gap = 8;

    const btn = anchorEl.querySelector(`.${styles.paletteBtn}`) as HTMLElement | null;
    let referenceTop = rect.top;
    if (btn) {
      const bRect = btn.getBoundingClientRect();
      referenceTop = bRect.top;
    }

    const TOP_NUDGE = 4;
    let top = referenceTop + TOP_NUDGE;

    let left = rect.right + gap;
    if (left + paletteWidth > window.innerWidth - gap) {
      left = rect.left - gap - paletteWidth;
    }

    const pad = 8;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    if (top + paletteHeight > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - paletteHeight);
    }

    setPicker({ accountId, left: Math.round(left), top: Math.round(top), width: paletteWidth, height: paletteHeight });
  }

  function handleOpenClick(e: React.MouseEvent, accountId: string) {
    e.stopPropagation();
    const el = (e.currentTarget as HTMLElement).closest(`.${styles.itemWrap}`) as HTMLElement | null;
    if (picker && picker.accountId === accountId) {
      setPicker(null);
      return;
    }
    openPickerFor(accountId, el);
  }

  function handlePickColor(accountId: string, color: string) {
    setColorsMap(prev => ({ ...prev, [accountId]: color }));
    setFlashMap(prev => ({ ...prev, [accountId]: true }));
    setCardAccent(color);
    window.setTimeout(() => {
      setFlashMap(prev => {
        const copy = { ...prev };
        delete copy[accountId];
        return copy;
      });
    }, 420);
    setPicker(null);
  }

  function handleClearColor(accountId: string) {
    setColorsMap(prev => {
      const copy = { ...prev };
      delete copy[accountId];
      return copy;
    });
    setFlashMap(prev => ({ ...prev, [accountId]: true }));
    window.setTimeout(() => {
      setFlashMap(prev => {
        const copy = { ...prev };
        delete copy[accountId];
        return copy;
      });
    }, 420);
    if (accountId === activeId) setCardAccent(null);
    setPicker(null);
  }

  const styleVars: React.CSSProperties = {};
  if (width) {
    styleVars.width = `${width}px`;
    styleVars.minWidth = `${width}px`;
  }

  const palettePortal = picker ? ReactDOM.createPortal(
    <div
      ref={paletteRef}
      className={styles.paletteMenu}
      role="dialog"
      aria-label="Scegli colore"
      style={{
        left: picker.left,
        top: picker.top,
        position: 'fixed',
        width: `${picker.width}px`,
        height: `${picker.height}px`
      }}
    >
      <button
        type="button"
        className={styles.closeX}
        aria-label="Chiudi"
        onClick={(ev) => { ev.stopPropagation(); setPicker(null); }}
        title="Chiudi"
      >
        ×
      </button>

      <div className={styles.paletteGrid}>
        {palette.map((col, idx) => {
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

      <button
        className={styles.resetIcon}
        onClick={(e) => { e.stopPropagation(); handleClearColor(picker.accountId); }}
        aria-label="Ripristina colore predefinito"
        title="Ripristina"
        type="button"
      >
        ↺
      </button>
    </div>,
    typeof document !== 'undefined' ? document.body : document.createElement('div')
  ) : null;

  return (
    <>
      <aside
        className={`${styles.accountSwitcherRoot} ${className ?? ''}`}
        style={styleVars}
        aria-label="Account Switcher"
      >
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

                    <button
                      aria-label={`Cambia colore account ${acc.name ?? acc.id}`}
                      className={styles.paletteBtn}
                      onClick={(e) => handleOpenClick(e, acc.id)}
                      title="Cambia colore"
                      type="button"
                    >
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