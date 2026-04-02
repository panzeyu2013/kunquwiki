"use client";

import type { ParsedEventDraft } from "../../../lib/api-client";
import styles from "../../../styles/editor-page.module.css";
import buttonStyles from "../../../styles/components/button.module.css";
import ghostButtonStyles from "../../../styles/components/ghost-button.module.css";

const MAX_BODY_PREVIEW = 220;

function summarizeText(value?: string) {
  if (!value) {
    return "-";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "-";
  }
  if (trimmed.length <= MAX_BODY_PREVIEW) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_BODY_PREVIEW)}...`;
}

function formatList(values?: string[]) {
  if (!values || values.length === 0) {
    return "-";
  }
  return values.join("、");
}

type Props = {
  open: boolean;
  result: ParsedEventDraft | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function EventParsePreviewModal({ open, result, onConfirm, onClose }: Props) {
  if (!open || !result) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div>
            <h3>解析结果预览</h3>
            <p className={styles.helperText}>请确认解析内容是否准确，再决定是否替换表单。</p>
          </div>
          <button type="button" className={ghostButtonStyles.button} onClick={onClose}>
            关闭
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalGrid}>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>标题</span>
              <span className={styles.modalValue}>{result.title ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>开始时间</span>
              <span className={styles.modalValue}>{result.startAt ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>结束时间</span>
              <span className={styles.modalValue}>{result.endAt ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>城市</span>
              <span className={styles.modalValue}>{result.cityName ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>场馆</span>
              <span className={styles.modalValue}>{result.venueName ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>剧团</span>
              <span className={styles.modalValue}>{formatList(result.troupeNames)}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>节目单</span>
              <span className={styles.modalValue}>{formatList(result.programTitles)}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>票务链接</span>
              <span className={styles.modalValue}>{result.ticketUrl ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>海报链接</span>
              <span className={styles.modalValue}>{result.posterImageUrl ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>备注</span>
              <span className={styles.modalValue}>{result.noteText ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>正文摘要</span>
              <span className={styles.modalValue}>{summarizeText(result.bodyMarkdown)}</span>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={ghostButtonStyles.button} onClick={onClose}>
            取消
          </button>
          <button type="button" className={buttonStyles.button} onClick={onConfirm}>
            替换表单内容
          </button>
        </div>
      </div>
    </div>
  );
}
