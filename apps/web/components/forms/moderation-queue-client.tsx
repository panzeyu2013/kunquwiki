"use client";

import { useEffect, useState } from "react";
import { getEditorOptions, getModerationQueueClient, reviewProposal } from "../../lib/api-client";
import {
  mapEntityTypeLabel,
  mapEventStatusLabel,
  mapEventTypeLabel,
  mapProposalTypeLabel,
  mapReviewStatusLabel,
  mapTroupeTypeLabel,
  mapUserRoleLabel,
  mapWorkTypeLabel
} from "../../lib/labels";
import pillStyles from "../../styles/components/pill.module.css";
import ghostButtonStyles from "../../styles/components/ghost-button.module.css";
import { ActionBar } from "../action-bar";

type QueueItem = Awaited<ReturnType<typeof getModerationQueueClient>>[number];
type EditorOptions = Awaited<ReturnType<typeof getEditorOptions>>;

function formatValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value.trim() || "未填写";
  }
  return "未填写";
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "未填写";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function renderKeyValueRows(rows: Array<{ label: string; value: string }>) {
  return (
    <div className="editor-meta-grid">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="editor-meta-item">
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function renderSummaryBlock(title: string, description: string, lines: string[]) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="structured-group">
      <div className="structured-group-head">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <div className="stack">
        {lines.map((line) => (
          <p key={line} className="helper-text">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function resolveEntityLabel(value: unknown, options: EditorOptions | null, fallbackLabel: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "未填写";
  }

  if (!options) {
    return value;
  }

  const collections = [
    options.works,
    options.fullWorks,
    options.excerpts,
    options.people,
    options.troupes,
    options.venues,
    options.cities,
    options.roleEntities
  ];

  for (const collection of collections) {
    const matched = collection.find((item) => item.id === value);
    if (matched) {
      return matched.title;
    }
  }

  return `${fallbackLabel}（${value}）`;
}

function renderWorkReview(payload: Record<string, unknown>, options: EditorOptions | null) {
  return (
    <>
      {renderKeyValueRows([
        { label: "剧目类型", value: mapWorkTypeLabel(typeof payload.workType === "string" ? payload.workType : "") },
        { label: "原作者", value: formatValue(payload.originalAuthor) },
        { label: "朝代/时期", value: formatValue(payload.dynastyPeriod) },
        { label: "体裁说明", value: formatValue(payload.genreNote) },
        { label: "时长", value: typeof payload.durationMinutes === "number" ? `${payload.durationMinutes} 分钟` : "未填写" },
        { label: "最早可考时间", value: formatValue(payload.firstKnownDate) },
        { label: "昆曲核心剧目", value: formatValue(payload.isKunquCore) }
      ])}
      {renderSummaryBlock(
        "代表内容",
        "长度较长的正文会在这里给审核时快速预览。",
        [
          typeof payload.plot === "string" && payload.plot.trim().length > 0 ? `剧情: ${payload.plot.slice(0, 120)}${payload.plot.length > 120 ? "..." : ""}` : ""
        ].filter(Boolean)
      )}
    </>
  );
}

function renderPersonReview(payload: Record<string, unknown>, options: EditorOptions | null) {
  const identities = Array.isArray(payload.personIdentities) ? payload.personIdentities : [];
  const memberships = Array.isArray(payload.troupeMemberships) ? payload.troupeMemberships : [];

  return (
    <>
      {renderKeyValueRows([
        { label: "人物类型说明", value: formatValue(payload.personTypeNote) },
        { label: "性别", value: formatValue(payload.gender) },
        { label: "出生时间", value: formatDateTime(payload.birthDate) },
        { label: "去世时间", value: formatDateTime(payload.deathDate) },
        { label: "家乡", value: formatValue(payload.hometown) },
        { label: "在世", value: formatValue(payload.isLiving) }
      ])}
      {renderSummaryBlock("人物身份履历", "逐条查看人物的身份变化。", identities.map((item, index) => {
        const row = item as Record<string, unknown>;
        return `记录 ${index + 1}: ${formatValue(row.identityTerm)}，${formatDateTime(row.startDate)} 至 ${formatDateTime(row.endDate)}`;
      }))}
      {renderSummaryBlock("院团履历", "核对人物和院团之间的关系。", memberships.map((item, index) => {
        const row = item as Record<string, unknown>;
        return `记录 ${index + 1}: 院团 ${resolveEntityLabel(row.troupeEntityId, options, "院团")}，身份 ${formatValue(row.membershipRole)}，当前在团 ${formatValue(row.isCurrent)}`;
      }))}
      {renderSummaryBlock(
        "人物简介",
        "预览本次修改的人物简介。",
        [typeof payload.bio === "string" && payload.bio.trim().length > 0 ? `简介: ${payload.bio.slice(0, 120)}${payload.bio.length > 120 ? "..." : ""}` : ""].filter(Boolean)
      )}
    </>
  );
}

function renderTroupeReview(payload: Record<string, unknown>, options: EditorOptions | null) {
  return (
    <>
      {renderKeyValueRows([
        { label: "院团类型", value: mapTroupeTypeLabel(typeof payload.troupeType === "string" ? payload.troupeType : "") },
        { label: "成立时间", value: formatDateTime(payload.foundedDate) },
        { label: "解散时间", value: formatDateTime(payload.dissolvedDate) },
        { label: "所在城市", value: resolveEntityLabel(payload.cityId, options, "城市") },
        { label: "城市文本", value: formatValue(payload.city) },
        { label: "地区", value: formatValue(payload.region) },
        { label: "官网", value: formatValue(payload.officialWebsite) }
      ])}
      {renderSummaryBlock(
        "院团简介",
        "预览这次提案更新的院团说明。",
        [typeof payload.description === "string" && payload.description.trim().length > 0 ? `简介: ${payload.description.slice(0, 120)}${payload.description.length > 120 ? "..." : ""}` : ""].filter(Boolean)
      )}
    </>
  );
}

function renderEventReview(payload: Record<string, unknown>, options: EditorOptions | null) {
  const programItems = Array.isArray(payload.programDetailed) ? payload.programDetailed : [];
  const troupeIds = Array.isArray(payload.troupeIds) ? payload.troupeIds : [];

  return (
    <>
      {renderKeyValueRows([
        { label: "演出类型", value: mapEventTypeLabel(typeof payload.eventType === "string" ? payload.eventType : "") },
        { label: "业务状态", value: mapEventStatusLabel(typeof payload.businessStatus === "string" ? payload.businessStatus : "") },
        { label: "开始时间", value: formatDateTime(payload.startAt) },
        { label: "结束时间", value: formatDateTime(payload.endAt) },
        { label: "城市", value: resolveEntityLabel(payload.cityId, options, "城市") },
        { label: "剧场", value: resolveEntityLabel(payload.venueEntityId, options, "剧场") },
        {
          label: "剧团",
          value:
            troupeIds.length > 0
              ? troupeIds.map((item) => resolveEntityLabel(item, options, "剧团")).join("、")
              : "未填写"
        }
      ])}
      {renderSummaryBlock("节目单", "核对节目条目以及演员数量。", programItems.map((item, index) => {
        const row = item as Record<string, unknown>;
        const casts = Array.isArray(row.casts) ? row.casts : [];
        const castSummary =
          casts.length > 0
            ? casts
                .slice(0, 3)
                .map((cast) => {
                  const castRow = cast as Record<string, unknown>;
                  const person = resolveEntityLabel(castRow.personEntityId, options, "人物");
                  const role = resolveEntityLabel(castRow.roleEntityId, options, "角色");
                  return role === "未填写" ? person : `${role}:${person}`;
                })
                .join("，")
            : "未列出演员";
        return `节目 ${index + 1}: 剧目 ${resolveEntityLabel(row.workEntityId, options, "剧目")}，顺序 ${formatValue(row.sequenceNo)}，演员 ${castSummary}`;
      }))}
      {renderSummaryBlock(
        "附加说明",
        "预览演出正文、票务和备注。",
        [
          typeof payload.bodyMarkdown === "string" && payload.bodyMarkdown.trim().length > 0 ? "正文: 已填写" : "",
          typeof payload.duration === "string" && payload.duration.trim().length > 0 ? `演出时长: ${payload.duration}` : "",
          typeof payload.ticketStatus === "string" && payload.ticketStatus.trim().length > 0 ? `票务状态: ${payload.ticketStatus}` : "",
          typeof payload.noteText === "string" && payload.noteText.trim().length > 0 ? `备注: ${payload.noteText}` : ""
        ].filter(Boolean)
      )}
    </>
  );
}

function renderGenericReview(payload: Record<string, unknown>) {
  const excluded = new Set(["title", "bodyMarkdown", "description", "bio", "plot", "synopsis", "abstract", "editSummary"]);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    if (excluded.has(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      lines.push(`${key}: ${value.length} 项`);
      continue;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      lines.push(`${key}: ${value}`);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`${key}: ${String(value)}`);
    }
  }

  return renderSummaryBlock("结构化变更", "展示提案里的关键字段。", lines.slice(0, 8));
}

function renderEntityReview(item: QueueItem, options: EditorOptions | null) {
  switch (item.entity.entityType) {
    case "event":
      return renderEventReview(item.payloadJson, options);
    case "person":
      return renderPersonReview(item.payloadJson, options);
    case "troupe":
      return renderTroupeReview(item.payloadJson, options);
    case "work":
      return renderWorkReview(item.payloadJson, options);
    default:
      return renderGenericReview(item.payloadJson);
  }
}

export function ModerationQueueClient() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [editorOptions, setEditorOptions] = useState<EditorOptions | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadQueue() {
    setLoading(true);
    try {
      setQueue(await getModerationQueueClient());
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  useEffect(() => {
    getEditorOptions()
      .then(setEditorOptions)
      .catch(() => {
        // Keep the review page usable even if the lookup table fails to load.
      });
  }, []);

  return (
    <div className="stack editor-list-shell">
      <div className="editor-list-head">
        <div>
          <h2>待审核提案</h2>
          <p>逐条核对提案内容、提案人身份与编辑说明。</p>
        </div>
        <ActionBar>
          <button type="button" onClick={() => void loadQueue()}>
            刷新队列
          </button>
          <span className={`${pillStyles.pill} ${pillStyles.strong}`}>{queue.length} 项</span>
        </ActionBar>
      </div>
      {message ? <p className="status-message">{message}</p> : null}
      {loading ? <p className="status-message">正在加载审核队列...</p> : null}
      {queue.map((item) => (
        <article key={item.id} className="detail-panel editor-record-card">
          <div className="editor-record-top">
            <div className={pillStyles.row}>
              <span className={`${pillStyles.pill} ${pillStyles.strong}`}>{mapReviewStatusLabel(item.status)}</span>
              <span className={pillStyles.pill}>{mapProposalTypeLabel(item.proposalType)}</span>
              <span className={pillStyles.pill}>{mapEntityTypeLabel(item.entity.entityType)}</span>
            </div>
            <span className="editor-record-meta">#{item.id}</span>
          </div>
          <div className="editor-record-body">
            <div>
              <h2>{item.entity.title}</h2>
            </div>
            <div className="editor-meta-grid">
              <div className="editor-meta-item">
                <span>提案人</span>
                <strong>{item.proposer.displayName}</strong>
                <small>{item.proposer.roles.map(mapUserRoleLabel).join(" / ")}</small>
              </div>
              <div className="editor-meta-item">
                <span>编辑说明</span>
                <strong>{String(item.payloadJson.editSummary ?? "未填写")}</strong>
              </div>
            </div>
          </div>
          {renderEntityReview(item, editorOptions)}
          <ActionBar>
            <button
              type="button"
              onClick={async () => {
                await reviewProposal(item.id, "approved", "前台审核通过");
                await loadQueue();
              }}
            >
              通过
            </button>
            <button
              type="button"
              className={ghostButtonStyles.button}
              onClick={async () => {
                await reviewProposal(item.id, "rejected", "前台审核驳回");
                await loadQueue();
              }}
            >
              驳回
            </button>
          </ActionBar>
        </article>
      ))}
      {!loading && queue.length === 0 ? <p className="status-message">当前没有待审核提案。</p> : null}
    </div>
  );
}
