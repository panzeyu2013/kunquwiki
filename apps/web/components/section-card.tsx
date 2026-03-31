import { ReactNode } from "react";

// Styles
import styles from "../styles/components/section-card.module.css";

export function SectionCard({
  title,
  header,
  className,
  children
}: {
  title?: string;
  header?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")}>
      {header ? <div className={styles.header}>{header}</div> : null}
      {!header && title ? (
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </div>
      ) : null}
      {children !== undefined && children !== null ? <div>{children}</div> : null}
    </section>
  );
}