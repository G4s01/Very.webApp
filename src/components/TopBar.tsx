import React from 'react';
import styles from './TopBar.module.css';
import SessionExpiry from './SessionExpiry';
import LogoutButton from './LogoutButton';

type Props = {
  accountSwitcherLeftOffset?: number; // px distance from viewport left to rail left (e.g. 12)
  accountSwitcherWidth?: number; // px width of the rail (e.g. 116)
  mainHorizontalPadding?: number; // px horizontal padding of <main> (e.g. 24)
  contentWrapperHorizontalPadding?: number; // px horizontal padding of the two-column wrapper (e.g. 12)
  leftSegment?: React.ReactNode;
  rightSegment?: React.ReactNode;
  alignedLeftMaxWidth?: number;
};

export default function TopBar({
  accountSwitcherLeftOffset = 12,
  accountSwitcherWidth = 116,
  mainHorizontalPadding = 24,
  contentWrapperHorizontalPadding = 12,
  leftSegment,
  rightSegment,
  alignedLeftMaxWidth = 720
}: Props) {
  // compute total left margin: rail left offset + rail width + main padding + wrapper padding
  const railOffset = (accountSwitcherLeftOffset || 0) + (accountSwitcherWidth || 0);
  const extraLeft = (mainHorizontalPadding || 0) + (contentWrapperHorizontalPadding || 0);
  const totalLeft = railOffset + extraLeft; // where the LineCard left edge starts

  // symmetric subtraction on the right: same extraLeft
  const totalSubtract = totalLeft + extraLeft; // left (rail+pad) + right padding (main+wrapper)

  const wrapperStyle: React.CSSProperties = {
    // the visual card (topInner) will start exactly at the LineCard left edge
    marginLeft: `${totalLeft}px`,
    // the width ends where RightCard ends (viewport minus totalSubtract)
    width: `calc(100% - ${totalSubtract}px)`,
    boxSizing: 'border-box'
  };

  const defaultRight = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <SessionExpiry warnAtSec={5 * 60} refreshEveryMs={60_000} onExpire={() => { window.location.href = '/login'; }} />
      <LogoutButton />
    </div>
  );

  return (
    <header className={styles.root} style={{ position: 'sticky', top: 0, zIndex: 40 }}>
      {/* MAIN TOP: visual card (.topInner) starts at totalLeft and spans until RightCard's edge */}
      <div className={styles.top}>
        <div className={styles.topInner} style={wrapperStyle}>
          <div className={styles.topLeft}>
            <div className={styles.brand}>Very</div>
          </div>

          <div className={styles.topRight}>
            {defaultRight}
          </div>
        </div>
      </div>

      {/* ALIGNED ROW: mirrors body columns but does NOT render defaultRight (avoids duplicates) */}
      <div className={styles.alignedRow} style={wrapperStyle}>
        <div className={styles.alignedInner}>
          <div className={styles.alignedLeft} style={{ maxWidth: alignedLeftMaxWidth }}>
            <div className={styles.alignedSlotInner}>
              {leftSegment ?? null}
            </div>
          </div>

          <div className={styles.alignedRight}>
            <div className={styles.alignedSlotInnerRight}>
              {rightSegment ?? null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}