import React from "react";
import type { TrayItem } from "../../lib/lineInfo";

type Segment = {
  key: string;
  totalBytes: number;
  color?: string;
  type?: "BASE" | "EXTRA_GIGA" | "OTHER";
};

type Props = {
  segments: Segment[];
  trayItems: TrayItem[];
};

export default function LegendPill({ segments, trayItems }: Props) {
  // Trova solo le opzioni extra ("addon" dati)
  const extras = Array.isArray(segments)
    ? segments.filter((s) => s.type === "EXTRA_GIGA")
    : [];

  if (extras.length === 0) return null;

  // Match: con chiave (key), se non basta prova con label
  const labelFor = (seg: Segment) => {
    // Priorità 1: match key;
    let found = trayItems.find((t) => t.type === "EXTRA_GIGA" && t.key === seg.key);
    // Priorità 2: se non trovato, match label
    if (!found && seg.label) {
      found = trayItems.find((t) => t.type === "EXTRA_GIGA" && t.label === seg.label);
    }
    // Priorità 3: se non trovato, forza il primo item EXTRA_GIGA
    if (!found) found = trayItems.find((t) => t.type === "EXTRA_GIGA");
    // Restituisci sempre label se presente
    return found?.label || seg.label || String(seg.key);
  };

  // Prendi il colore esatto dalla tray anche per la pill (fallback su segmento)
  const colorFor = (seg: Segment) => {
    const found = trayItems.find((t) => t.type === "EXTRA_GIGA" && t.key === seg.key);
    return found?.color || seg.color || "#7EC9E6";
  };

  return (
    <div className="legend-pill-row">
      {extras.map((s) => (
        <span
          key={s.key}
          className="legend-pill"
          style={{
            borderColor: colorFor(s),
            background: "#fff"
          }}>
          <span
            className="legend-pill-color"
            style={{ background: colorFor(s) }}
          />
          <span className="legend-pill-label">{labelFor(s)}</span>
        </span>
      ))}
      <style jsx>{`
        .legend-pill-row {
          height: 48px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: nowrap;
        }
        .legend-pill {
          height: 48px;
          display: inline-flex;
          align-items: center;
          border: 2.2px solid #7EC9E6;
          background: #fff;
          border-radius: 14px;
          padding: 0 18px 0 11px;
          font-size: 1.12rem;
          font-weight: 600;
          gap: 8px;
          box-shadow: 0 2px 14px rgba(38,70,83,0.03);
          white-space: nowrap;
          min-width: 55px;
          max-width: 420px;
        }
        .legend-pill-color {
          width: 13px;
          height: 13px;
          border-radius: 4px;
          margin-right: 9px;
          display: inline-block;
        }
        .legend-pill-label {
          font-weight: 700;
          color: #0e7ca1;
          white-space: nowrap;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}