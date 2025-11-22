import React from 'react';
import styles from './RightCard.module.css';

type Props = {
  title?: React.ReactNode;
  children?: React.ReactNode;
};

export default function RightCard({ title, children }: Props) {
  return (
    <aside className={styles.root} role="complementary" aria-label={typeof title === 'string' ? title : 'Right panel'}>
      {title ? <div className={styles.title}>{title}</div> : null}
      <div className={styles.body}>
        {children}
      </div>
    </aside>
  );
}