"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createQuickEntityClient, getEditorOptions, getEntityPublic } from "../../../lib/api-client";
import { getEntityDetailPath } from "../../../lib/routes";
import { SearchSuggestInput, type SearchSuggestion } from "../../search-suggest-input";

// Styles
import pillStyles from "../../../styles/components/pill.module.css";
import ghostButtonStyles from "../../../styles/components/ghost-button.module.css";
import buttonStyles from "../../../styles/components/button.module.css";
import styles from "../../../styles/editor-page.module.css";

export type EditorOptions = Awaited<ReturnType<typeof getEditorOptions>>;
export type EditableEntity = Awaited<ReturnType<typeof getEntityPublic>>;
export type QuickCreatedOption = Awaited<ReturnType<typeof createQuickEntityClient>>;
export type EntityOption = { id: string; title: string; slug?: string };

export type PersonIdentityRow = {
  key: string;
  identityTerm: string;
  startDate: string;
  endDate: string;
};

export type TroupeMembershipRow = {
  key: string;
  troupeEntityId: string;
  membershipRole: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export type PerformanceCastRow = {
  key: string;
  roleEntityId: string;
  personEntityId: string;
  castNote: string;
};

export type EventProgramItemRow = {
  key: string;
  workEntityId: string;
  titleOverride: string;
  sequenceNo: string;
  durationMinutes: string;
  notes: string;
  casts: PerformanceCastRow[];
};

type SearchCreateSelectProps = {
  label: string;
  options: EntityOption[];
  value: string;
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<QuickCreatedOption | void>;
  placeholder: string;
  createLabel: string;
  disabled?: boolean;
  className?: string;
};

type SearchCreateMultiSelectProps = {
  label: string;
  options: EntityOption[];
  values: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onCreate: (name: string) => Promise<QuickCreatedOption | void>;
  placeholder: string;
  createLabel: string;
  disabled?: boolean;
  className?: string;
  renderTagMeta?: (item: EntityOption) => React.ReactNode;
};

type SearchCreateInlineSelectProps = {
  options: EntityOption[];
  value: string;
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<QuickCreatedOption | void>;
  placeholder: string;
  createLabel: string;
  disabled?: boolean;
};

function toSuggestion(option: EntityOption): SearchSuggestion {
  return {
    id: option.id,
    title: option.title,
    entityType: "",
    slug: option.slug ?? ""
  };
}

export function SearchCreateSelect({
  label,
  options,
  value,
  onChange,
  onCreate,
  placeholder,
  createLabel,
  disabled,
  className
}: SearchCreateSelectProps) {
  const [query, setQuery] = useState("");
  const selected = options.find((item) => item.id === value);
  const [creating, setCreating] = useState(false);
  const normalizedQuery = query.trim();
  const canCreate =
    !disabled &&
    normalizedQuery.length > 0 &&
    normalizedQuery !== (selected?.title ?? "") &&
    !options.some((item) => item.title === normalizedQuery);

  useEffect(() => {
    setQuery(selected?.title ?? "");
  }, [selected?.title]);

  return (
    <fieldset className={className}>
      <legend>{label}</legend>
      <div className={styles.stack}>
        <SearchSuggestInput
          value={query}
          onValueChange={setQuery}
          onSelect={(item) => {
            onChange(item.id);
            setQuery(item.title);
          }}
          placeholder={placeholder}
          minChars={1}
          shouldSearch={(input) => {
            const trimmed = input.trim();
            return trimmed.length > 0 && trimmed !== (selected?.title ?? "");
          }}
          getSuggestions={async (input) => {
            const trimmed = input.trim();
            if (!trimmed || trimmed === (selected?.title ?? "")) {
              return [];
            }
            return options.filter((item) => item.title.includes(trimmed)).slice(0, 8).map(toSuggestion);
          }}
          inputClassName=""
          disabled={disabled || creating}
        />
        {canCreate ? (
          <button
            type="button"
            className={buttonStyles.button}
            disabled={creating || disabled}
            onClick={async () => {
              if (!window.confirm(`确认创建占位条目「${normalizedQuery}」？`)) {
                return;
              }
              setCreating(true);
              try {
                const created = await onCreate(normalizedQuery);
                if (created) {
                  onChange(created.id);
                  setQuery(created.title);
                }
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "创建中..." : `${createLabel}“${normalizedQuery}”`}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

export function SearchCreateMultiSelect({
  label,
  options,
  values,
  onAdd,
  onRemove,
  onCreate,
  placeholder,
  createLabel,
  disabled,
  className,
  renderTagMeta
}: SearchCreateMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedOptions = useMemo(
    () => options.filter((item) => values.includes(item.id)),
    [options, values]
  );

  const normalizedQuery = query.trim();
  const canCreate =
    !disabled &&
    normalizedQuery.length > 0 &&
    !options.some((item) => item.title === normalizedQuery);

  return (
    <fieldset className={className}>
      <legend>{label}</legend>
      <div className={styles.stack}>
        {selectedOptions.length > 0 ? (
          <div className={styles.multiSelectTags}>
            {selectedOptions.map((item) => (
              <span key={item.id} className={styles.multiSelectTag}>
                <span>{item.title}</span>
                {renderTagMeta ? renderTagMeta(item) : null}
                <button
                  type="button"
                  className={styles.tagRemoveButton}
                  onClick={() => onRemove(item.id)}
                  disabled={disabled || creating}
                  aria-label={`移除 ${item.title}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.helperText}>尚未选择。</p>
        )}

        <SearchSuggestInput
          value={query}
          onValueChange={setQuery}
          onSelect={(item) => {
            onAdd(item.id);
            setQuery("");
          }}
          placeholder={placeholder}
          minChars={0}
          allowEmpty
          getSuggestions={async (input) => {
            const trimmed = input.trim();
            const pool = options.filter((item) => !values.includes(item.id));
            const matches = trimmed ? pool.filter((item) => item.title.includes(trimmed)) : pool;
            return matches.slice(0, 12).map(toSuggestion);
          }}
          inputClassName=""
          disabled={disabled || creating}
        />

        {canCreate ? (
          <button
            type="button"
            className={buttonStyles.button}
            disabled={disabled || creating}
            onClick={async () => {
              if (!window.confirm(`确认创建占位条目「${normalizedQuery}」？`)) {
                return;
              }
              setCreating(true);
              try {
                const created = await onCreate(normalizedQuery);
                if (created) {
                  onAdd(created.id);
                  setQuery("");
                }
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "创建中..." : `${createLabel}“${normalizedQuery}”`}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

export function SearchCreateInlineSelect({
  options,
  value,
  onChange,
  onCreate,
  placeholder,
  createLabel,
  disabled
}: SearchCreateInlineSelectProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = options.find((item) => item.id === value);
  const normalizedQuery = query.trim();

  useEffect(() => {
    setQuery(selected?.title ?? "");
  }, [selected?.title]);

  const canCreate =
    !disabled &&
    normalizedQuery.length > 0 &&
    normalizedQuery !== (selected?.title ?? "") &&
    !options.some((item) => item.title === normalizedQuery);

  return (
    <div className={styles.inlineSelect}>
      <SearchSuggestInput
        value={query}
        onValueChange={setQuery}
        onSelect={(item) => {
          onChange(item.id);
          setQuery(item.title);
        }}
        placeholder={placeholder}
        minChars={1}
        shouldSearch={(input) => {
          const trimmed = input.trim();
          return trimmed.length > 0 && trimmed !== (selected?.title ?? "");
        }}
        getSuggestions={async (input) => {
          const trimmed = input.trim();
          if (!trimmed || trimmed === (selected?.title ?? "")) {
            return [];
          }
          return options.filter((item) => item.title.includes(trimmed)).slice(0, 6).map(toSuggestion);
        }}
        inputClassName=""
        disabled={disabled || creating}
      />
      {canCreate ? (
        <button
          type="button"
          className={`${ghostButtonStyles.button} ${styles.inlineChoice} ${styles.inlineChoiceCreate}`}
          disabled={creating || disabled}
          onClick={async () => {
            if (!window.confirm(`确认创建占位条目「${normalizedQuery}」？`)) {
              return;
            }
            setCreating(true);
            try {
              const created = await onCreate(normalizedQuery);
              if (created) {
                onChange(created.id);
                setQuery(created.title);
              }
            } finally {
              setCreating(false);
            }
          }}
        >
          {creating ? "创建中..." : `${createLabel}${normalizedQuery}`}
        </button>
      ) : null}
    </div>
  );
}

export function DraftBadge({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }
  return <span className={styles.warningPill}>新建占位条目，资料待补充</span>;
}

export function formatDateTimeLabel(value: string) {
  if (!value) {
    return "未设置";
  }
  const [date, time] = value.split("T");
  if (!date) {
    return value;
  }
  return time ? `${date} ${time}` : date;
}

export function summarizeCollection(items: string[], emptyLabel = "未填写") {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return emptyLabel;
  }
  if (normalized.length === 1) {
    return normalized[0];
  }
  return `${normalized[0]} 等 ${normalized.length} 项`;
}

export function CollapsibleFormSection({
  title,
  description,
  summary,
  children,
  defaultExpanded = true,
  accent = false
}: {
  title: string;
  description: string;
  summary?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  accent?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section
      className={`${styles.formSection} ${styles.collapsibleFormSection}${accent ? ` ${styles.formSectionAccent}` : ""}`}
    >
      <div className={styles.formSectionToolbar}>
        <div className={styles.editorSectionHead}>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button
          type="button"
          className={`${ghostButtonStyles.button} ${styles.sectionToggleButton}`}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "收起" : "展开"}
        </button>
      </div>
      {summary ? <p className={styles.sectionSummary}>{summary}</p> : null}
      {expanded ? <div className={styles.formSectionBody}>{children}</div> : null}
    </section>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
  helper,
  className
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  className?: string;
}) {
  return (
    <label className={`${styles.dateTimeField}${className ? ` ${className}` : ""}`}>
      <span>{label}</span>
      <div className={styles.dateTimeInputShell}>
        <span className={styles.dateTimePrefix}>日期时间</span>
        <input
          className={styles.dateTimeInput}
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {helper ? <span className={styles.fieldHelper}>{helper}</span> : null}
    </label>
  );
}

export function EditorSummaryBar({
  entityTypeLabel,
  title,
  modeLabel,
  editSummaryFilled,
  bodyLength,
  loaded,
  entity
}: {
  entityTypeLabel: string;
  title: string;
  modeLabel: string;
  editSummaryFilled: boolean;
  bodyLength: number;
  loaded: boolean;
  entity: EditableEntity | null;
}) {
  return (
    <header className={styles.editorSummaryBar}>
      <div>
        <div className={pillStyles.row}>
          <span className={`${pillStyles.pill} ${pillStyles.strong}`}>{entityTypeLabel}</span>
          <span className={pillStyles.pill}>{loaded ? "已加载" : "加载中"}</span>
        </div>
        <h1>{title || "未命名条目"}</h1>
        <div className={styles.summaryMetaRow}>
          <span>{modeLabel}</span>
          <span>正文 {bodyLength} 字</span>
          <span>{entity ? (editSummaryFilled ? "已填写编辑说明" : "编辑说明空白") : "创建模式"}</span>
        </div>
      </div>
      {entity ? (
        <div className={styles.summaryActions}>
          <Link className={ghostButtonStyles.button} href={getEntityDetailPath(entity.entityType, entity.slug)}>
            查看条目
          </Link>
          <Link className={ghostButtonStyles.button} href={`/history/${entity.id}`}>
            历史
          </Link>
        </div>
      ) : null}
    </header>
  );
}

export function makeClientKey(prefix: string) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function emptyIdentityRow(): PersonIdentityRow {
  return {
    key: makeClientKey("identity"),
    identityTerm: "",
    startDate: "",
    endDate: ""
  };
}

export function emptyMembershipRow(): TroupeMembershipRow {
  return {
    key: makeClientKey("membership"),
    troupeEntityId: "",
    membershipRole: "成员",
    startDate: "",
    endDate: "",
    isCurrent: true
  };
}

export function emptyCastRow(): PerformanceCastRow {
  return {
    key: makeClientKey("cast"),
    roleEntityId: "",
    personEntityId: "",
    castNote: ""
  };
}

export function emptyProgramRow(): EventProgramItemRow {
  return {
    key: makeClientKey("program"),
    workEntityId: "",
    titleOverride: "",
    sequenceNo: "",
    durationMinutes: "",
    notes: "",
    casts: [emptyCastRow()]
  };
}

export function updateAt<T extends { key: string }>(items: T[], key: string, updater: (item: T) => T) {
  return items.map((item) => (item.key === key ? updater(item) : item));
}

export function removeAt<T>(items: T[], key: string) {
  return items.filter((item) => (item as { key: string }).key !== key);
}
