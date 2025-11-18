import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TrayItem } from '../../lib/lineInfo';

type Props = {
  items: TrayItem[];
  height?: number;
  maxWidth?: string;
};

export default function OptionsTray({ items, height = 48, maxWidth = '100%' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  // compute presence of categories for tray border color
  const has5g = items.some(i => i.type === '5G');
  const hasExtra = items.some(i => i.type === 'EXTRA_GIGA');
  const hasAuto = items.some(i => i.type === 'AUTORICARICA');

  const toneClass = has5g ? 'tray--5g' : hasExtra ? 'tray--extra' : hasAuto ? 'tray--auto' : 'tray--default';

  function updateFade() {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setFadeLeft(scrollLeft > 0);
    setFadeRight(scrollLeft + clientWidth < scrollWidth - 1);
  }

  useEffect(() => {
    updateFade();
    const el = ref.current;
    if (!el) return;
    const onScroll = () => updateFade();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateFade());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [items]);

  const styleVars: React.CSSProperties = {
    ['--row-h' as any]: `${height}px`,
    maxWidth,
  };

  // PATCH: autoricarica sempre come prima se presente!
  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const idx = items.findIndex(
      i => i.type === 'AUTORICARICA' ||
           (typeof i.label === 'string' && i.label.trim().toUpperCase() === "AUTORICARICA")
    );
    if (idx <= 0) return items; // già in testa o assente, nessun riordino
    return [
      items[idx],
      ...items.slice(0, idx),
      ...items.slice(idx + 1)
    ];
  }, [items]);

  return (
    <div className={`tray ${toneClass} ${fadeLeft ? 'fade-left' : ''} ${fadeRight ? 'fade-right' : ''}`} style={styleVars}>
      <div className="tray__inner" ref={ref} role="list" aria-label="Opzioni attive">
        {sortedItems.length === 0 ? (
          <div className="opt-empty">Nessuna opzione</div>
        ) : sortedItems.map(it => (
          <div
            key={it.key}
            className={`opt-chip opt-${it.type.toLowerCase()} ${it.type === '5G' ? 'opt-chip--5g' : ''}`}
            role="listitem"
            title={it.label}
          >
            {it.label}
          </div>
        ))}
      </div>
      {/* ...STYLES INVARIATI... */}
      <style jsx>{`
        .tray {
          position: relative;
          height: var(--row-h);
          display: grid;
          align-items: center;
          border-radius: 12px;
          border: 1px solid #d9e9e1;
          background: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
          padding: 0 10px;
        }
        .tray--5g {
          border: 1px solid transparent;
          background:
            linear-gradient(#ffffff, #ffffff) padding-box,
            linear-gradient(180deg, #FFD66B, #FFA94D) border-box;
        }
        .tray--extra {
            border: 1px solid transparent;
            background:
              linear-gradient(#ffffff, #ffffff) padding-box,
              linear-gradient(180deg, #BDE7F9, #7EC9E6) border-box;
        }
        .tray--auto {
          border: 1px solid transparent;
          background:
            linear-gradient(#ffffff, #ffffff) padding-box,
            linear-gradient(180deg, #BFE9D5, #86D3B0) border-box;
        }
        .tray--default { border: 1px solid #d9e9e1; }

        .tray__inner {
          height: 100%;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .tray__inner::-webkit-scrollbar { display: none; }

        .opt-chip {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 0.9rem;
          font-weight: 600;
          line-height: 1;
          background: #fff;
          border: 1px solid #cdd8d1;
          color: #2b513e;
          letter-spacing: 0.15px;
        }
        .opt-chip--5g {
          border-color: #ffe08a;
          background: #fffaf0;
          color: #6b4e00;
        }
        .opt-extra_giga {
          border-color: #7EC9E6;
          background: #F2FBFE;
          color: #0d4a5b;
        }
        .opt-autoricarica {
          border-color: #86D3B0;
          background: #EEFAF5;
          color: #07543c;
        }
        .opt-other {
          background: #ffffff;
        }

        .opt-empty {
          opacity: 0.55;
          font-size: 0.85rem;
          font-style: italic;
          padding-inline: 4px;
        }

        .tray::before,
        .tray::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 18px;
          pointer-events: none;
          opacity: 0;
          transition: opacity .18s ease;
        }
        .tray::before {
          left: 0;
          background: linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0));
        }
        .tray::after {
          right: 0;
          background: linear-gradient(-90deg, rgba(255,255,255,1), rgba(255,255,255,0));
        }
        .tray.fade-left::before { opacity: 1; }
        .tray.fade-right::after { opacity: 1; }
      `}</style>
    </div>
  );
}