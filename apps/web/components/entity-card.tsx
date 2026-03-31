import { ReactNode } from "react";
import styles from "../styles/components/entity-card.module.css";

export function EntityCard({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return <article className={[styles.card, className].filter(Boolean).join(" ")}>{children}</article>;
}

export { styles as entityCardStyles };
