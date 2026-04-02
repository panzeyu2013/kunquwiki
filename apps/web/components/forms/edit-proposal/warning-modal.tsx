"use client";

import styles from "../../../styles/editor-page.module.css";
import buttonStyles from "../../../styles/components/button.module.css";
import ghostButtonStyles from "../../../styles/components/ghost-button.module.css";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function WarningModal({ open, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div>
            <h3>{title}</h3>
            <p className={styles.helperText}>{message}</p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={ghostButtonStyles.button} onClick={onCancel}>
            取消
          </button>
          <button type="button" className={buttonStyles.button} onClick={onConfirm}>
            {confirmLabel ?? "继续"}
          </button>
        </div>
      </div>
    </div>
  );
}
