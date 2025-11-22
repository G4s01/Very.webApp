import React, { useMemo } from 'react';
import DonutGauge from './ui/DonutGauge';
// LegendPill temporarily disabled per richiesta (kept removed until you decide)
// import LegendPill from './ui/LegendPill';
import OptionsTray from './ui/OptionsTray';
import type { ParsedLineInfo } from '../lib/lineInfo';
import styles from './LineCard.module.css';

const DONUT_SIZE = 220;

type Props = {
  info: ParsedLineInfo;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

function bytesToGB(bytes?: number): number | undefined {
  if (typeof bytes !== 'number' || !isFinite(bytes)) return undefined;
  return bytes / (1024 ** 3);
}
function formatRenewalShort(d?: string): string {
  if (!d) return '—';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}`;
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }
  return d;
}

export default function LineCard({ info, isFavorite = false, onToggleFavorite, onPrev, onNext }: Props) {
  const availGB = useMemo(() => bytesToGB(info.gigaNational?.available), [info.gigaNational]);
  const valueLabel = availGB !== undefined ? availGB.toFixed(1) : '—';
  const valueSuffix = availGB !== undefined ? 'GB' : undefined;

  const segmentsNormalized = useMemo(() => {
    const raw = Array.isArray(info.segments) ? info.segments : [];
    return raw.map(s => ({
      key: String(s.key),
      label: s.label || s.key || '',
      totalBytes: Number(s.totalBytes || 0),
      availableBytes: Number(s.availableBytes || 0),
      color: s.color,
      type: s.type
    })).filter(s => !Number.isNaN(s.totalBytes) && s.totalBytes > 0);
  }, [info]);
  const trayItems = info.trayItems || [];

  // keyboard handler helper for accessibility
  const makeKeyHandler = (fn?: () => void) => (e: React.KeyboardEvent) => {
    if (!fn) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className={styles['line-card']} role="group" aria-label={`Sintesi linea ${info.msisdn}`}>
      {/* LEFT sidebar = full-height clickable area (acts as prev) */}
      <div
        className={styles['lc__sideBar']}
        data-side="left"
        role={onPrev ? 'button' : undefined}
        aria-label="Linea precedente"
        tabIndex={onPrev ? 0 : -1}
        onClick={(e) => { e.stopPropagation(); onPrev && onPrev(); }}
        onKeyDown={makeKeyHandler(onPrev)}
      >
        <div className={styles['lc__sideBarBtnInner']} aria-hidden>
          ‹
        </div>
      </div>

      {/* RIGHT sidebar = full-height clickable area (acts as next) */}
      <div
        className={styles['lc__sideBar']}
        data-side="right"
        role={onNext ? 'button' : undefined}
        aria-label="Linea successiva"
        tabIndex={onNext ? 0 : -1}
        onClick={(e) => { e.stopPropagation(); onNext && onNext(); }}
        onKeyDown={makeKeyHandler(onNext)}
      >
        <div className={styles['lc__sideBarBtnInner']} aria-hidden>
          ›
        </div>
      </div>

      {/* options button removed as requested */}

      <div className={styles['lc__grid']}>
        <div className={styles['lc__left']}>
          <div className={styles['lc__header-row']}>
            <div
              className={`${styles['header-split']} ${isFavorite ? styles['header-split--fav'] : ''}`}
              style={{ width: DONUT_SIZE }}
            >
              <button
                className={`${styles['hs-left']} ${isFavorite ? styles['hs-left--on'] : ''}`}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? 'Rimuovi preferita' : 'Segna preferita'}
                onClick={e => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(); }}
                title={isFavorite ? 'Linea preferita' : 'Segna linea come preferita'}
              >
                <span className={styles['hs-star']} aria-hidden>{isFavorite ? '★' : '☆'}</span>
              </button>
              <div className={styles['hs-right']}>{info.msisdn}</div>
            </div>
          </div>

          <div className={styles['lc__donut']} style={{ width: DONUT_SIZE }}>
            <DonutGauge
              segments={segmentsNormalized}
              valueLabel={valueLabel}
              valueSuffix={valueSuffix}
              centerExtra={undefined}
              size={DONUT_SIZE}
              stroke={18}
              gapFraction={0.003}
              bg="#e7f2ec"
            />
          </div>
        </div>

        <div className={styles['lc__right']}>
          {/* LegendPill intentionally removed; mascot now occupies the space */}
          {/* If you want to re-enable LegendPill, uncomment import and add it back here. */}

          {/* Mascot: fills the right column. Image served from public/mascotte.png */}
          <div className={styles['lc__mascot']} aria-hidden>
            <img src="/mascotte.png" alt="Mascotte" />
          </div>
        </div>
      </div>

      <div className={styles['lc__renewal-options-row']}>
        <div className={styles['renewal-split']} title={info.offerName}>
          <div className={styles['rs-left']}>{info.offerName}</div>
          <div className={styles['rs-right']}>{formatRenewalShort(info.offerRenewalDate)}</div>
        </div>
        <div className={styles['lc-options-align']}>
          <OptionsTray items={trayItems} height={48} maxWidth="100%" />
        </div>
      </div>
    </div>
  );
}