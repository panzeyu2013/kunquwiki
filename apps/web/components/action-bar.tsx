import { ReactNode } from "react";

// Styles
import styles from "../styles/components/action-bar.module.css";

export function ActionBar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={[styles.bar, className].filter(Boolean).join(" ")}>{children}</div>;
}