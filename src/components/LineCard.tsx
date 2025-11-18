import React, { useMemo } from 'react';
import DonutGauge from './ui/DonutGauge';
import LegendPill from './ui/LegendPill';
import OptionsTray from './ui/OptionsTray';
import type { ParsedLineInfo, TrayItem } from '../lib/lineInfo';

const DONUT_SIZE = 220;

type Props = {
  info: ParsedLineInfo;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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

export default function LineCard({ info, isFavorite = false, onToggleFavorite }: Props) {
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

  return (
    <div className="line-card" role="group" aria-label={`Sintesi linea ${info.msisdn}`}>
      <button className="icon-btn-abs" aria-label="Opzioni">⋮</button>
      <div className="lc__grid">
        {/* Colonna sinistra fissa */}
        <div className="lc__left">
          <div className="lc__header-row">
            <div className={`header-split${isFavorite ? ' header-split--fav' : ''}`} style={{ width: DONUT_SIZE }}>
              <button
                className={`hs-left${isFavorite ? ' on' : ''}`}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? 'Rimuovi preferita' : 'Segna preferita'}
                onClick={e => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(); }}
                title={isFavorite ? 'Linea preferita' : 'Segna linea come preferita'}
              >
                <span className="hs-star" aria-hidden>{isFavorite ? '★' : '☆'}</span>
              </button>
              <div className="hs-right">{info.msisdn}</div>
            </div>
          </div>
          <div className="lc__donut" style={{ width: DONUT_SIZE }}>
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
        {/* Colonna destra fluida, pill sempre sopra (non toccare tray!) */}
        <div className="lc__right">
          <div className="legendpill-align">
            <LegendPill segments={segmentsNormalized} trayItems={trayItems} />
          </div>
        </div>
      </div>
      {/* PATCH: la riga renewal+options tray FUORI dalla grid, width: 100%! */}
      <div className="lc__renewal-options-row">
        <div className="renewal-split">
          <div className="rs-left" title={info.offerName}>{info.offerName}</div>
          <div className="rs-right">{formatRenewalShort(info.offerRenewalDate)}</div>
        </div>
        <div className="lc-options-align">
          <OptionsTray items={trayItems} height={48} maxWidth="100%" />
        </div>
      </div>
      <style jsx>{`
        .line-card { position:relative; background:#fff; border-radius:16px; box-shadow:0 6px 18px rgba(0,0,0,0.08); padding:22px; border:1px solid #eef3ef;}
        .icon-btn-abs { position:absolute; top:22px; right:28px; border:none; background:transparent; font-size:22px; color:#0a5d36; cursor:pointer; z-index:10;}
        .lc__grid {
          display: grid;
          grid-template-columns: ${DONUT_SIZE}px 1fr;
          column-gap: 22px;
          align-items: start;
          width: 100%;
          min-height: 250px;
        }
        .lc__left { display: flex; flex-direction: column; align-items: center;}
        .lc__header-row { margin-bottom:8px; }
        .header-split { display:flex; align-items:center; height:48px; min-width:160px; background:linear-gradient(180deg,#ffffff,#fbfffd);border-radius:12px; border:1px solid #dfeae5; box-shadow:0 4px 12px rgba(0,0,0,0.04); overflow:hidden;}
        .hs-left { flex:0 0 56px; display:grid; place-items:center; border-right:1px solid #e6efe9; background:#fff; cursor:pointer;}
        .hs-left.on { background:linear-gradient(180deg,#fff,#fffdf5);}
        .hs-star { font-size:22px; color:#9aa69f;}
        .hs-left.on .hs-star { color: #f2c94c;}
        .hs-right { flex:1 1 auto; display:inline-flex; align-items:center; padding:0 14px; font-weight:800; color:#0a5d36; font-size:1.05rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
        .lc__donut { margin-bottom:12px; }
        .lc__right { position: relative; display: flex; flex-direction: column; height: 100%; }
        .legendpill-align { height: 48px; display: flex; align-items: flex-start; }
        /* RINNOVO+TRAY ROW PATCH: width 100%, tray si espande */
        .lc__renewal-options-row {
          margin-top:16px;
          width: 100%;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 18px;
        }
        .renewal-split { display:flex; align-items:stretch; height:48px; min-width:220px; border-radius:12px; background:linear-gradient(180deg,#f0fbf4,#ffffff); border:1px solid #cfe6da; box-shadow:0 4px 12px rgba(0,0,0,0.04); overflow:hidden;}
        .rs-left { flex:1 1 auto; display:inline-flex; align-items:center; padding:0 14px; color:#0a5d36; font-weight:800; font-size:1rem; letter-spacing:0.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
        .rs-right { flex:0 0 108px; display:inline-flex; align-items:center; justify-content:center; padding:0 16px; color:#2b513e; font-weight:700; font-size:0.98rem; border-left:1px solid #cfe6da; background:#ffffff; white-space:nowrap;}
        .lc-options-align {
          flex: 1 1 0;
          min-width: 0; /* PATCH: permette allargamento tray */
          display: flex;
          align-items: center;
        }
        .lc-options-align :global(.OptionsTray), .lc-options-align > div {
          width: 100%;
          min-width: 0;
          max-width: 100%;
        }

        @media (max-width:900px) {
          .line-card { padding:7px;}
          .lc__grid{ grid-template-columns: 1fr; min-height:0;}
          .lc__left{align-items:center;}
          .lc__right{align-items:center; position:static;}
          .legendpill-align{justify-content:center;}
          .lc__renewal-options-row{flex-direction:column;align-items:center;}
          .lc-options-align{width:100%;}
        }
      `}</style>
    </div>
  );
}