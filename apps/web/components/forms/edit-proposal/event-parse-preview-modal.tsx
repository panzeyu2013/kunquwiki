"use client";

import type { ParsedEventResponse } from "../../../lib/api-client";
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

function formatProgramDetail(result: ParsedEventResponse) {
  const programDetailed = result.parsed.programDetailed ?? [];
  if (programDetailed.length === 0) {
    return null;
  }
  return programDetailed.map((item, index) => {
    const title = item.title?.trim() || `节目 ${index + 1}`;
    const casts = item.casts ?? [];
    const castLabel =
      casts.length === 0
        ? "未解析演员"
        : casts
            .map((cast) => {
              const role = cast.roleName?.trim();
              const person = cast.personName?.trim();
              if (role && person) {
                return `${role}：${person}`;
              }
              return role || person || "演员信息不全";
            })
            .join("；");
    return (
      <div key={`${title}-${index}`} className={styles.modalSubBlock}>
        <strong>{title}</strong>
        <p className={styles.helperText}>{castLabel}</p>
      </div>
    );
  });
}

type Props = {
  open: boolean;
  result: ParsedEventResponse | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function EventParsePreviewModal({ open, result, onConfirm, onClose }: Props) {
  if (!open || !result) {
    return null;
  }

  const parsed = result.parsed;
  const warnings = result.warnings ?? [];
  const unmatched = result.unmatched;

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
              <span className={styles.modalValue}>{parsed.title ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>开始时间</span>
              <span className={styles.modalValue}>{parsed.startAt ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>结束时间</span>
              <span className={styles.modalValue}>{parsed.endAt ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>城市</span>
              <span className={styles.modalValue}>{parsed.cityName ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>场馆</span>
              <span className={styles.modalValue}>{parsed.venueName ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>剧团</span>
              <span className={styles.modalValue}>{formatList(parsed.troupeNames)}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>节目单</span>
              <span className={styles.modalValue}>{formatList(parsed.programTitles)}</span>
            </div>
            {parsed.programDetailed && parsed.programDetailed.length > 0 ? (
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>节目详情</span>
                <div className={styles.modalValue}>{formatProgramDetail(result)}</div>
              </div>
            ) : null}
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>票务链接</span>
              <span className={styles.modalValue}>{parsed.ticketUrl ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>海报链接</span>
              <span className={styles.modalValue}>{parsed.posterImageUrl ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>备注</span>
              <span className={styles.modalValue}>{parsed.noteText ?? "-"}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>正文摘要</span>
              <span className={styles.modalValue}>{summarizeText(parsed.bodyMarkdown)}</span>
            </div>
            {warnings.length > 0 || unmatched ? (
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>匹配提示</span>
                <span className={styles.modalValue}>
                  {warnings.length > 0 ? warnings.join("；") : "未发现匹配问题。"}
                  {unmatched?.cityName ? ` 城市未匹配：${unmatched.cityName}。` : ""}
                  {unmatched?.venueName ? ` 场馆未匹配：${unmatched.venueName}。` : ""}
                  {unmatched?.troupeNames && unmatched.troupeNames.length > 0
                    ? ` 剧团未匹配：${unmatched.troupeNames.join("、")}。`
                    : ""}
                  {unmatched?.workTitles && unmatched.workTitles.length > 0
                    ? ` 剧目未匹配：${unmatched.workTitles.join("、")}。`
                    : ""}
                  {unmatched?.roleNames && unmatched.roleNames.length > 0
                    ? ` 角色未匹配：${unmatched.roleNames.join("、")}。`
                    : ""}
                  {unmatched?.personNames && unmatched.personNames.length > 0
                    ? ` 演员未匹配：${unmatched.personNames.join("、")}。`
                    : ""}
                </span>
              </div>
            ) : null}
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
