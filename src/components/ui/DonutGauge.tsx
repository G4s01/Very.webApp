import React from 'react';

type Segment = {
  key: string;
  label?: string;
  totalBytes: number;
  availableBytes: number;
  color?: string;
  type?: 'BASE' | 'EXTRA_GIGA' | 'OTHER';
};

type Props = {
  segments?: Segment[];
  valueLabel?: string;
  valueSuffix?: string;
  centerExtra?: React.ReactNode;
  size?: number;
  stroke?: number;
  gapFraction?: number;
  bg?: string;
  consumptionFadeColor?: string; // opzionale: colore dell’overlay trasparente
};

export default function DonutGauge({
  segments = [],
  valueLabel = '',
  valueSuffix,
  centerExtra,
  size = 220,
  stroke = 18,
  gapFraction = 0.003,
  bg = '#e7f2ec',
  consumptionFadeColor = '#666'  // grigio neutro trasparente
}: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const normalized = (Array.isArray(segments) ? segments : []).map(s => ({
      key: String(s.key),
      label: s.label || String(s.key),
      totalBytes: Number(s.totalBytes || 0),
      availableBytes: Number(s.availableBytes || 0),
      color: s.color || '#cdd8d1',
      type: s.type || 'OTHER',
  })).filter(s => s.totalBytes > 0);

  // Ordina: extra prima, poi base
  const ordered = [
    ...normalized.filter(s => s.type === "EXTRA_GIGA"),
    ...normalized.filter(s => s.type === "BASE")
  ];

  const overallTotal = ordered.reduce((acc, s) => acc + s.totalBytes, 0);
  const overallAvailable = ordered.reduce((acc, s) => acc + s.availableBytes, 0);
  const overallUsed = Math.max(0, overallTotal - overallAvailable);
  const safeTotal = overallTotal > 0 ? overallTotal : 1;
  const gapLen = Math.max(0.6, circumference * Math.min(Math.max(0, gapFraction), 0.02));

  // Offset cumulativo per disegnare i segmenti attaccati
  let cumulative = 0;
  const segs = ordered.map((s) => {
    const arcLen = (s.totalBytes / safeTotal) * circumference - gapLen;
    const offset = cumulative;
    cumulative += (s.totalBytes / safeTotal) * circumference;
    return {
      key: s.key,
      color: s.color,
      dashTotal: arcLen,
      offset: offset,
      label: s.label
    };
  });

  // Arco fade (trasparente) unico: quota totale consumata in px. Overlay sempre dal top.
  const usedArcLen = (overallUsed / safeTotal) * circumference;

  return (
    <div className="donut" role="img" aria-label="Consumo dati">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* background faint */}
        <circle cx={size / 2} cy={size / 2} r={r} stroke={bg} strokeWidth={stroke} fill="none" />
        {segs.map((s) => {
          const fullDash = `${s.dashTotal} ${Math.max(1, circumference - s.dashTotal)}`;
          const fullOffset = -s.offset - (gapLen / 2);
          return (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              fill="none"
              strokeDasharray={fullDash}
              strokeDashoffset={fullOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              opacity={1}
            />
          );
        })}
        {/* overlay fade unico */}
        {usedArcLen > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={consumptionFadeColor}
            strokeWidth={stroke}
            strokeLinecap="butt"
            fill="none"
            strokeDasharray={`${usedArcLen} ${Math.max(1, circumference - usedArcLen)}`}
            strokeDashoffset={0}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            opacity={0.7}
          />
        )}
      </svg>
      <div className="donut__center">
        <div className="donut-center-col">
          <div className="donut__value">
            <span className="num">{valueLabel}</span>
            {valueSuffix && <span className="unit">{valueSuffix}</span>}
          </div>
          <div className="donut__extra">
            {centerExtra || (
              <>
                <div>Minuti e</div>
                <div>SMS Illimitati</div>
              </>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .donut { position: relative; display: inline-block; width:${size}px; height:${size}px; }
        .donut__center { position: absolute; inset: 0; width:100%; height:100%; display:grid; place-items:center; text-align:center; pointer-events:none; }
        .donut-center-col { display:flex; flex-direction:column; align-items:center; width:100%; }
        .donut__value { display:inline-flex; align-items:baseline; gap:6px; font-size:2.8rem; font-weight:900; color:#0a5d36; line-height:1; pointer-events:auto;}
        .donut__value .unit{ font-size:0.41em; font-weight:800; transform:translateY(0.12em);}
        .donut__extra{margin-top:0.04rem;line-height:1.07;color:#0a5d36;font-weight:800;font-size:1.05rem;display:flex;flex-direction:column;gap:0;}
        @media (max-width:600px){.donut__value{font-size:2rem;} .donut__extra{font-size:0.93rem;}}
      `}</style>
    </div>
  );
}