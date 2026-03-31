"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createQuickEntityClient, getEditorOptions, getEntityPublic, submitProposal } from "../../lib/api-client";
import {
  mapArticleTypeLabel,
  mapEventStatusLabel,
  mapEventTypeLabel,
  mapTroupeTypeLabel,
  mapWorkTypeLabel
} from "../../lib/labels";
import { getEntityDetailPath } from "../../lib/routes";
import { excerptText } from "../../lib/text";
import { ActionBar } from "../action-bar";

// Styles
import pillStyles from "../../styles/components/pill.module.css";
import ghostButtonStyles from "../../styles/components/ghost-button.module.css";
import buttonStyles from "../../styles/components/button.module.css";
import styles from "../../styles/editor-page.module.css";

type EditorOptions = Awaited<ReturnType<typeof getEditorOptions>>;
type EditableEntity = Awaited<ReturnType<typeof getEntityPublic>>;
type QuickCreatedOption = Awaited<ReturnType<typeof createQuickEntityClient>>;
type EntityOption = { id: string; title: string; slug?: string };

type PersonIdentityRow = {
  key: string;
  identityTerm: string;
  startDate: string;
  endDate: string;
};

type TroupeMembershipRow = {
  key: string;
  troupeEntityId: string;
  membershipRole: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

type PerformanceCastRow = {
  key: string;
  roleEntityId: string;
  personEntityId: string;
  castNote: string;
};

type EventProgramItemRow = {
  key: string;
  workEntityId: string;
  titleOverride: string;
  sequenceNo: string;
  durationMinutes: string;
  notes: string;
  casts: PerformanceCastRow[];
};

function makeClientKey(prefix: string) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function emptyIdentityRow(): PersonIdentityRow {
  return {
    key: makeClientKey("identity"),
    identityTerm: "",
    startDate: "",
    endDate: ""
  };
}

function emptyMembershipRow(): TroupeMembershipRow {
  return {
    key: makeClientKey("membership"),
    troupeEntityId: "",
    membershipRole: "成员",
    startDate: "",
    endDate: "",
    isCurrent: true
  };
}

function emptyCastRow(): PerformanceCastRow {
  return {
    key: makeClientKey("cast"),
    roleEntityId: "",
    personEntityId: "",
    castNote: ""
  };
}

function emptyProgramRow(): EventProgramItemRow {
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

function emptyState(entityType: string) {
  const base: Record<string, unknown> = {
    representativeWorkIds: [],
    representativeExcerptIds: []
  };

  switch (entityType) {
    case "work":
      return {
        ...base,
        workType: "full_play",
        originalAuthor: "",
        dynastyPeriod: "",
        genreNote: "",
        parentWorkId: "",
        excerptName: "",
        durationMinutes: "",
        firstKnownDate: "",
        isKunquCore: true
      };
    case "person":
      return {
        ...base,
        personTypeNote: "",
        gender: "",
        birthDate: "",
        deathDate: "",
        hometown: "",
        birthCityId: "",
        isLiving: true,
        personIdentities: [] as PersonIdentityRow[],
        troupeMemberships: [] as TroupeMembershipRow[]
      };
    case "troupe":
      return {
        ...base,
        troupeType: "troupe",
        foundedDate: "",
        dissolvedDate: "",
        cityId: "",
        city: "",
        region: "",
        officialWebsite: ""
      };
    case "venue":
      return {
        ...base,
        venueType: "theater",
        country: "中国",
        cityId: "",
        city: "",
        region: "",
        address: "",
        latitude: "",
        longitude: "",
        capacity: ""
      };
    case "event":
      return {
        ...base,
        eventType: "performance",
        businessStatus: "scheduled",
        startAt: "",
        endAt: "",
        cityId: "",
        venueEntityId: "",
        troupeIds: [] as string[],
        ticketUrl: "",
        duration: "",
        ticketStatus: "",
        noteText: "",
        posterImageId: "",
        programDetailed: [] as EventProgramItemRow[]
      };
    case "city":
      return {
        ...base,
        province: ""
      };
    case "article":
      return {
        ...base,
        articleType: "term",
        abstract: "",
        difficultyLevel: "",
        bodySourceType: ""
      };
    default:
      return base;
  }
}

function entityPath(entityType: string, slug: string) {
  return getEntityDetailPath(entityType, slug);
}

function SearchCreateSelect({
  label,
  options,
  value,
  onChange,
  onCreate,
  placeholder,
  createLabel,
  disabled,
  className
}: {
  label: string;
  options: EntityOption[];
  value: string;
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<QuickCreatedOption | void>;
  placeholder: string;
  createLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = options.find((item) => item.id === value);
  const [creating, setCreating] = useState(false);
  const filtered = options.filter((item) => item.title.includes(query.trim()));

  useEffect(() => {
    setQuery(selected?.title ?? "");
  }, [selected?.title]);

  const showOptions = !disabled && query.trim().length > 0 && query.trim() !== (selected?.title ?? "");

  return (
    <fieldset className={className}>
      <legend>{label}</legend>
      <div className={styles.stack}>
        <input value={query} placeholder={placeholder} onChange={(event) => setQuery(event.target.value)} disabled={disabled || creating} />
        {showOptions ? (
          <div className={styles.pickerList}>
            {filtered.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                className={ghostButtonStyles.button}
                onClick={() => {
                  onChange(item.id);
                  setQuery(item.title);
                }}
              >
                选择 {item.title}
              </button>
            ))}
          </div>
        ) : null}
        {showOptions && query.trim() && !filtered.some((item) => item.title === query.trim()) ? (
          <button
            type="button"
            className={buttonStyles.button}
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              try {
                const created = await onCreate(query.trim());
                if (created) {
                  onChange(created.id);
                  setQuery(created.title);
                }
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "创建中..." : `${createLabel}“${query.trim()}”`}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

function SearchCreateMultiSelect({
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
}: {
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
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedOptions = useMemo(
    () => options.filter((item) => values.includes(item.id)),
    [options, values]
  );

  const normalizedQuery = query.trim();

  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return options.filter((item) => !values.includes(item.id)).slice(0, 12);
    }
    return options
      .filter((item) => !values.includes(item.id) && item.title.includes(normalizedQuery))
      .slice(0, 12);
  }, [options, values, normalizedQuery]);

  const canCreate =
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

        <input
          value={query}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled || creating}
        />

        {(normalizedQuery.length > 0 || filtered.length > 0) ? (
          <div className={styles.pickerList}>
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={ghostButtonStyles.button}
                onClick={() => {
                  onAdd(item.id);
                  setQuery("");
                }}
                disabled={disabled || creating}
              >
                选择 {item.title}
              </button>
            ))}

            {canCreate ? (
              <button
                type="button"
                className={buttonStyles.button}
                disabled={disabled || creating}
                onClick={async () => {
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

            {normalizedQuery.length > 0 && filtered.length === 0 && !canCreate ? (
              <p className={styles.helperText}>没有匹配结果。</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function SearchCreateInlineSelect({
  options,
  value,
  onChange,
  onCreate,
  placeholder,
  createLabel,
  disabled
}: {
  options: EntityOption[];
  value: string;
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<QuickCreatedOption | void>;
  placeholder: string;
  createLabel: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = options.find((item) => item.id === value);
  const filtered = options.filter((item) => item.title.includes(query.trim()));

  useEffect(() => {
    setQuery(selected?.title ?? "");
  }, [selected?.title]);

  const showOptions = !disabled && query.trim().length > 0 && query.trim() !== (selected?.title ?? "");
  const canCreate = showOptions && query.trim() && !filtered.some((item) => item.title === query.trim());

  return (
    <div className={styles.inlineSelect}>
      <input value={query} placeholder={placeholder} onChange={(event) => setQuery(event.target.value)} disabled={disabled || creating} />
      {showOptions ? (
        <div className={styles.inlinePickerList}>
          {filtered.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${ghostButtonStyles.button} ${styles.inlineChoice} ${value === item.id ? styles.inlineChoiceSelected : ""}`}
              onClick={() => {
                onChange(item.id);
                setQuery(item.title);
              }}
            >
              {item.title}
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              className={`${ghostButtonStyles.button} ${styles.inlineChoice} ${styles.inlineChoiceCreate}`}
              disabled={creating}
              onClick={async () => {
                setCreating(true);
                try {
                  const created = await onCreate(query.trim());
                  if (created) {
                    onChange(created.id);
                    setQuery(created.title);
                  }
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "创建中..." : `${createLabel}${query.trim()}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DraftBadge({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }
  return <span className={styles.warningPill}>新建占位条目，资料待补充</span>;
}

function formatDateTimeLabel(value: string) {
  if (!value) {
    return "未设置";
  }
  const [date, time] = value.split("T");
  if (!date) {
    return value;
  }
  return time ? `${date} ${time}` : date;
}

function summarizeCollection(items: string[], emptyLabel = "未填写") {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return emptyLabel;
  }
  if (normalized.length === 1) {
    return normalized[0];
  }
  return `${normalized[0]} 等 ${normalized.length} 项`;
}

function buildIdentitySummary(item: PersonIdentityRow) {
  const identity = item.identityTerm.trim() || "未填写身份";
  const period = `${formatDateTimeLabel(item.startDate)} - ${formatDateTimeLabel(item.endDate)}`;
  return `${identity} · ${period}`;
}

function buildMembershipSummary(item: TroupeMembershipRow, options: EditorOptions) {
  const troupeTitle = options.troupes.find((entry) => entry.id === item.troupeEntityId)?.title ?? "未选择院团";
  const period = item.isCurrent
    ? `${formatDateTimeLabel(item.startDate)} 起至今`
    : `${formatDateTimeLabel(item.startDate)} - ${formatDateTimeLabel(item.endDate)}`;
  return `${troupeTitle} · ${item.membershipRole || "成员"} · ${period}`;
}

function buildEventSectionSummary(formState: Record<string, unknown>, options: EditorOptions) {
  const cityTitle = options.cities.find((item) => item.id === formState.cityId)?.title ?? "未选城市";
  const venueTitle = options.venues.find((item) => item.id === formState.venueEntityId)?.title ?? "未选剧场";
  const troupeIds = Array.isArray(formState.troupeIds) ? (formState.troupeIds as string[]) : [];
  const troupeTitles = options.troupes.filter((item) => troupeIds.includes(item.id)).map((item) => item.title);
  const programCount = Array.isArray(formState.programDetailed) ? (formState.programDetailed as EventProgramItemRow[]).length : 0;
  return `${formatDateTimeLabel(String(formState.startAt ?? ""))} · ${cityTitle} / ${venueTitle} · ${summarizeCollection(troupeTitles, "未选剧团")} · ${programCount} 个节目`;
}

function CollapsibleFormSection({
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
      className={`${styles.formSection} ${styles.collapsibleFormSection}${
        accent ? ` ${styles.formSectionAccent}` : ""
      }`}
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

function DateTimeField({
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

function IdentityRowEditor({
  item,
  onUpdate,
  onRemove
}: {
  item: PersonIdentityRow;
  onUpdate: (updater: (current: PersonIdentityRow) => PersonIdentityRow) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(!(item.identityTerm || item.startDate || item.endDate));

  return (
    <section className={`${styles.structuredCard} ${styles.collapsibleStructuredCard}`}>
      <div className={`${styles.structuredCardHead} ${styles.structuredCardToolbar}`}>
        <div className={`${styles.stack} ${styles.compactStack}`}>
          <strong>身份履历</strong>
          <p className={styles.structuredCardSummary}>{buildIdentitySummary(item)}</p>
        </div>
        <div className={styles.inlineActions}>
          <button type="button" className={ghostButtonStyles.button} onClick={() => setExpanded((current) => !current)}>
            {expanded ? "收起" : "展开"}
          </button>
          <button type="button" className={ghostButtonStyles.button} onClick={onRemove}>
            删除
          </button>
        </div>
      </div>
      {expanded ? (
        <div className={styles.structuredGrid}>
          <label>
            身份
            <input
              list="identity-options"
              value={item.identityTerm}
              onChange={(event) =>
                onUpdate((current) => ({
                  ...current,
                  identityTerm: event.target.value
                }))
              }
            />
          </label>
          <DateTimeField
            label="开始时间"
            value={item.startDate}
            onChange={(value) =>
              onUpdate((current) => ({
                ...current,
                startDate: value
              }))
            }
          />
          <DateTimeField
            label="结束时间"
            value={item.endDate}
            onChange={(value) =>
              onUpdate((current) => ({
                ...current,
                endDate: value
              }))
            }
          />
        </div>
      ) : null}
    </section>
  );
}

function MembershipRowEditor({
  item,
  options,
  onUpdate,
  onRemove,
  onCreateTroupe,
  isDraftEntity
}: {
  item: TroupeMembershipRow;
  options: EditorOptions;
  onUpdate: (updater: (current: TroupeMembershipRow) => TroupeMembershipRow) => void;
  onRemove: () => void;
  onCreateTroupe: (name: string) => Promise<QuickCreatedOption | void>;
  isDraftEntity: (id: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(!(item.troupeEntityId || item.startDate || item.endDate));

  return (
    <section className={`${styles.structuredCard} ${styles.collapsibleStructuredCard}`}>
      <div className={`${styles.structuredCardHead} ${styles.structuredCardToolbar}`}>
        <div className={`${styles.stack} ${styles.compactStack}`}>
          <strong>院团履历</strong>
          <p className={styles.structuredCardSummary}>{buildMembershipSummary(item, options)}</p>
        </div>
        <div className={styles.inlineActions}>
          <button type="button" className={ghostButtonStyles.button} onClick={() => setExpanded((current) => !current)}>
            {expanded ? "收起" : "展开"}
          </button>
          <button type="button" className={ghostButtonStyles.button} onClick={onRemove}>
            删除
          </button>
        </div>
      </div>
      {expanded ? (
        <div className={styles.stack}>
          <SearchCreateSelect
            className={styles.fieldSpanFull}
            label="所属院团"
            options={options.troupes}
            value={item.troupeEntityId}
            onChange={(value) =>
              onUpdate((current) => ({
                ...current,
                troupeEntityId: value
              }))
            }
            onCreate={onCreateTroupe}
            placeholder="搜索已有院团，没有则创建新院团"
            createLabel="创建新院团："
          />
          <DraftBadge visible={Boolean(item.troupeEntityId) && isDraftEntity(item.troupeEntityId)} />
          <div className={styles.structuredGrid}>
            <label>
              身份/职务
              <input
                value={item.membershipRole}
                onChange={(event) =>
                  onUpdate((current) => ({
                    ...current,
                    membershipRole: event.target.value
                  }))
                }
              />
            </label>
            <DateTimeField
              label="开始时间"
              value={item.startDate}
              onChange={(value) =>
                onUpdate((current) => ({
                  ...current,
                  startDate: value
                }))
              }
            />
            <DateTimeField
              label="结束时间"
              value={item.endDate}
              onChange={(value) =>
                onUpdate((current) => ({
                  ...current,
                  endDate: value
                }))
              }
            />
          </div>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={item.isCurrent}
              onChange={(event) =>
                onUpdate((current) => ({
                  ...current,
                  isCurrent: event.target.checked
                }))
              }
            />
            当前仍在该院团
          </label>
        </div>
      ) : null}
    </section>
  );
}

function EditorSummaryBar({
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
          <Link className={ghostButtonStyles.button} href={entityPath(entity.entityType, entity.slug)}>
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

type CastRowProps = {
  cast: PerformanceCastRow;
  options: EditorOptions;
  onUpdate: (row: PerformanceCastRow) => void;
  onRemove: () => void;
  onClearRole: () => void;
  createQuickOption: (entityType: string, name: string, targetList: keyof NonNullable<EditorOptions>, extra?: { workType?: string; parentWorkId?: string; initialData?: Record<string, unknown> }) => Promise<QuickCreatedOption | void>;
  isDraftEntity: (id: string) => boolean;
  workEntityId?: string;
};

function CastRow({ cast, options, onUpdate, onRemove, onClearRole, createQuickOption, isDraftEntity, workEntityId }: CastRowProps) {
  return (
    <div className={styles.castRow}>
      <div className={styles.castFields}>
        <label>
          <span>角色</span>
          <SearchCreateInlineSelect
            options={options.roleEntities}
            value={cast.roleEntityId}
            onChange={(value) => onUpdate({ ...cast, roleEntityId: value })}
            onCreate={(name) =>
              createQuickOption("role", name, "roleEntities", {
                initialData: {
                  workEntityId: workEntityId || null,
                  bodyMarkdown: "",
                  description: ""
                }
              })
            }
            placeholder="搜索或创建角色"
            createLabel="创建角色："
          />
        </label>
        <label>
          <span>演员</span>
          <SearchCreateInlineSelect
            options={options.people}
            value={cast.personEntityId}
            onChange={(value) => onUpdate({ ...cast, personEntityId: value })}
            onCreate={(name) =>
              createQuickOption("person", name, "people", {
                initialData: {
                  bodyMarkdown: "",
                  bio: "",
                  personTypeNote: ""
                }
              })
            }
            placeholder="搜索或创建演员"
            createLabel="创建人物："
          />
        </label>
        <label>
          <span>备注</span>
          <input value={cast.castNote} onChange={(event) => onUpdate({ ...cast, castNote: event.target.value })} />
        </label>
      </div>
      <div className={styles.castActions}>
        <button type="button" className={ghostButtonStyles.button} onClick={onClearRole}>
          清空角色
        </button>
        <button type="button" className={ghostButtonStyles.button} onClick={onRemove}>
          删除
        </button>
      </div>
      <div className={styles.castRowNote}>
        <DraftBadge visible={Boolean(cast.roleEntityId) && isDraftEntity(cast.roleEntityId)} />
        <DraftBadge visible={Boolean(cast.personEntityId) && isDraftEntity(cast.personEntityId)} />
        {Boolean(cast.personEntityId) && isDraftEntity(cast.personEntityId) ? (
          <p className={styles.helperText}>演员为占位条目，建议补充信息。</p>
        ) : null}
      </div>
    </div>
  );
}

type ProgramBlockProps = {
  item: EventProgramItemRow;
  index: number;
  options: EditorOptions;
  onUpdate: (item: EventProgramItemRow) => void;
  onRemove: () => void;
  onAddCast: () => void;
  createQuickOption: (entityType: string, name: string, targetList: keyof NonNullable<EditorOptions>, extra?: { workType?: string; parentWorkId?: string; initialData?: Record<string, unknown> }) => Promise<QuickCreatedOption | void>;
  isDraftEntity: (id: string) => boolean;
};

function ProgramBlock({ item, index, options, onUpdate, onRemove, onAddCast, createQuickOption, isDraftEntity }: ProgramBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const combinedWorks = useMemo(() => [...options.fullWorks, ...options.excerpts], [options.fullWorks, options.excerpts]);
  const workLabel = combinedWorks.find((entry) => entry.id === item.workEntityId)?.title;

  const handleFieldChange = (field: keyof EventProgramItemRow, value: string) => {
    onUpdate({ ...item, [field]: value });
  };

  const updateCast = (castKey: string, updater: (cast: PerformanceCastRow) => PerformanceCastRow) => {
    onUpdate({
      ...item,
      casts: updateAt(item.casts, castKey, updater)
    });
  };

  const removeCast = (castKey: string) => {
    onUpdate({
      ...item,
      casts: removeAt(item.casts, castKey)
    });
  };

  return (
    <section className={styles.programBlock}>
      <div className={styles.programBlockHead}>
        <div>
          <strong>节目 {index + 1}</strong>
          <p>{workLabel ?? "未选择剧目"}</p>
        </div>
        <div className={styles.programBlockMeta}>
          <span>顺序 {item.sequenceNo || index + 1}</span>
          <span>{item.durationMinutes ? `${item.durationMinutes} 分钟` : "时长未填"}</span>
        </div>
        <div className={styles.programBlockActions}>
          <button type="button" className={ghostButtonStyles.button} onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? "收起" : "展开"}
          </button>
          <button type="button" className={ghostButtonStyles.button} onClick={onRemove}>
            删除节目
          </button>
        </div>
      </div>
      {expanded ? (
        <div className={styles.programBlockBody}>
          <SearchCreateSelect
            label="对应剧目/折子"
            options={combinedWorks}
            value={item.workEntityId}
            onChange={(value) => handleFieldChange("workEntityId", value)}
            onCreate={(name) =>
              createQuickOption("work", name, "fullWorks", { workType: "full_play" })
            }
            placeholder="搜索已有剧目或折子"
            createLabel="创建剧目："
          />
          <div className={styles.inlineGrid}>
            <label>
              顺序
              <input value={item.sequenceNo} onChange={(event) => handleFieldChange("sequenceNo", event.target.value)} />
            </label>
            <label>
              时长（分钟）
              <input value={item.durationMinutes} onChange={(event) => handleFieldChange("durationMinutes", event.target.value)} />
            </label>
            <label>
              标题覆盖
              <input value={item.titleOverride} onChange={(event) => handleFieldChange("titleOverride", event.target.value)} />
            </label>
          </div>
          <label>
            节目备注
            <textarea value={item.notes} onChange={(event) => handleFieldChange("notes", event.target.value)} rows={2} />
          </label>
          <div className={styles.castSection}>
            <div className={styles.structuredGroupHead}>
              <h5>演员表</h5>
              <p>一行里填写角色、演员和备注，操作更紧凑。</p>
            </div>
            {item.casts.length > 0 ? (
              <div className={styles.castList}>
                {item.casts.map((cast) => (
                  <CastRow
                    key={cast.key}
                    cast={cast}
                    options={options}
                    createQuickOption={createQuickOption}
                    isDraftEntity={isDraftEntity}
                    workEntityId={item.workEntityId}
                    onUpdate={(nextCast) => updateCast(cast.key, () => nextCast)}
                    onRemove={() => removeCast(cast.key)}
                    onClearRole={() =>
                      updateCast(cast.key, (current) => ({
                        ...current,
                        roleEntityId: ""
                      }))
                    }
                  />
                ))}
              </div>
            ) : (
              <p className={styles.helperText}>尚未添加演员。</p>
            )}
            <div className={styles.sectionActions}>
              <button type="button" className={styles.secondaryButton} onClick={onAddCast}>
                添加演员
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function removeAt<T>(items: T[], key: string) {
  return items.filter((item) => (item as { key: string }).key !== key);
}

function updateAt<T extends { key: string }>(items: T[], key: string, updater: (item: T) => T) {
  return items.map((item) => (item.key === key ? updater(item) : item));
}

function buildEventTitle(input: {
  startAt: string;
  cityTitle?: string;
  venueTitle?: string;
  troupeTitles: string[];
  workTitles: string[];
  excerptTitles: string[];
}) {
  const dateLabel = input.startAt ? input.startAt.slice(0, 10) : "待定日期";
  const locationLabel = input.cityTitle || input.venueTitle || "待定地点";
  const troupeLabel =
    input.troupeTitles.length === 0 ? "未命名剧团" : input.troupeTitles.length === 1 ? input.troupeTitles[0] : `${input.troupeTitles[0]}等`;
  const programTitles = [...input.workTitles, ...input.excerptTitles];
  const programLabel =
    programTitles.length === 0 ? "昆曲演出" : programTitles.length === 1 ? `《${programTitles[0]}》演出` : `《${programTitles[0]}》等演出`;
  return `${dateLabel} ${locationLabel} ${troupeLabel} ${programLabel}`;
}

export function EditProposalForm({ slug, entityType }: { slug?: string; entityType?: string }) {
  const [entity, setEntity] = useState<EditableEntity | null>(null);
  const [options, setOptions] = useState<EditorOptions | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [draftEntityIds, setDraftEntityIds] = useState<string[]>([]);

  const activeEntityType = entity?.entityType ?? entityType ?? "";
  const isCreateMode = !slug;

  function setField(name: string, value: unknown) {
    setFormState((current) => ({ ...current, [name]: value }));
  }

  function setArrayField(name: string, values: string[]) {
    setFormState((current) => ({ ...current, [name]: values }));
  }

  function toggleArrayField(name: string, value: string) {
    setFormState((current) => {
      const previous = Array.isArray(current[name]) ? (current[name] as string[]) : [];
      return {
        ...current,
        [name]: previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]
      };
    });
  }

  function appendStructuredRow<T>(name: string, row: T) {
    setFormState((current) => {
      const previous = Array.isArray(current[name]) ? (current[name] as T[]) : [];
      return {
        ...current,
        [name]: [...previous, row]
      };
    });
  }

  function updateStructuredRow<T extends { key: string }>(name: string, key: string, updater: (row: T) => T) {
    setFormState((current) => {
      const previous = Array.isArray(current[name]) ? (current[name] as T[]) : [];
      return {
        ...current,
        [name]: updateAt(previous, key, updater)
      };
    });
  }

  function removeStructuredRow<T extends { key: string }>(name: string, key: string) {
    setFormState((current) => {
      const previous = Array.isArray(current[name]) ? (current[name] as T[]) : [];
      return {
        ...current,
        [name]: removeAt(previous, key)
      };
    });
  }

  function isDraftEntity(id: string) {
    return draftEntityIds.includes(id);
  }

  async function createQuickOption(
    nextEntityType: string,
    name: string,
    targetList: keyof NonNullable<EditorOptions>,
    extra?: { workType?: string; parentWorkId?: string; initialData?: Record<string, unknown> }
  ) {
    const created = await createQuickEntityClient({
      entityType: nextEntityType,
      title: name,
      workType: extra?.workType,
      parentWorkId: extra?.parentWorkId,
      initialData: extra?.initialData
    });

    setDraftEntityIds((current) => (current.includes(created.id) ? current : [...current, created.id]));
    setOptions((current) => {
      if (!current) {
        return current;
      }
      const list = current[targetList] as unknown;
      if (!Array.isArray(list) || list.some((item) => !item || typeof item !== "object" || !("title" in item))) {
        return current;
      }
      const optionList = list as EntityOption[];
      if (optionList.some((item) => item.id === created.id)) {
        return current;
      }
      return {
        ...current,
        [targetList]: [...optionList, created].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))
      };
    });

    return created;
  }

  useEffect(() => {
    let active = true;

    async function loadCreateState() {
      if (!entityType) {
        setLoaded(true);
        return;
      }
      const nextOptions = await getEditorOptions(entityType);
      if (!active) {
        return;
      }
      setFormState(emptyState(entityType));
      setOptions(nextOptions);
      setLoaded(true);
    }

    async function loadEditState() {
      const loadedEntity = await getEntityPublic(slug!);
      if (!active || !loadedEntity) {
        return;
      }
      setEntity(loadedEntity);
      setTitle(loadedEntity.title);
      setBody(
        loadedEntity.entityType === "work"
          ? loadedEntity.plot ?? loadedEntity.synopsis ?? ""
          : loadedEntity.entityType === "person"
            ? loadedEntity.bio ?? ""
            : loadedEntity.entityType === "event"
              ? loadedEntity.body ?? ""
              : loadedEntity.entityType === "troupe" || loadedEntity.entityType === "venue"
                ? loadedEntity.description ?? ""
                : loadedEntity.body ?? ""
      );

      const nextState = emptyState(loadedEntity.entityType);
      switch (loadedEntity.entityType) {
        case "work":
          nextState.workType = loadedEntity.workType ?? "full_play";
          nextState.originalAuthor = loadedEntity.originalAuthor ?? "";
          nextState.dynastyPeriod = loadedEntity.dynastyPeriod ?? "";
          nextState.genreNote = loadedEntity.genreNote ?? "";
          nextState.parentWorkId = loadedEntity.parentWorkId ?? "";
          nextState.excerptName =
            loadedEntity.workType === "excerpt" ? loadedEntity.title.split("·").slice(1).join("·") || loadedEntity.title : "";
          nextState.durationMinutes = loadedEntity.durationMinutes ? String(loadedEntity.durationMinutes) : "";
          nextState.firstKnownDate = loadedEntity.firstKnownDate ?? "";
          nextState.isKunquCore = loadedEntity.isKunquCore ?? true;
          break;
        case "person":
          nextState.personTypeNote = loadedEntity.personTypeNote ?? "";
          nextState.gender = loadedEntity.gender ?? "";
          nextState.birthDate = loadedEntity.birthDate ? loadedEntity.birthDate.slice(0, 16) : "";
          nextState.deathDate = loadedEntity.deathDate ? loadedEntity.deathDate.slice(0, 16) : "";
          nextState.hometown = loadedEntity.hometown ?? "";
          nextState.birthCityId = loadedEntity.birthCityId ?? "";
          nextState.isLiving = loadedEntity.isLiving ?? true;
          nextState.representativeWorkIds = loadedEntity.representativeWorkIds ?? [];
          nextState.representativeExcerptIds = loadedEntity.representativeExcerptIds ?? [];
          nextState.personIdentities =
            loadedEntity.personIdentities?.map((item) => ({
              key: makeClientKey("identity"),
              identityTerm: item.identityTerm ?? "",
              startDate: item.startDate ? item.startDate.slice(0, 16) : "",
              endDate: item.endDate ? item.endDate.slice(0, 16) : ""
            })) ?? [];
          nextState.troupeMemberships =
            loadedEntity.troupeMemberships?.map((item) => ({
              key: makeClientKey("membership"),
              troupeEntityId: item.troupeEntityId ?? "",
              membershipRole: item.membershipRole ?? "成员",
              startDate: item.startDate ? item.startDate.slice(0, 16) : "",
              endDate: item.endDate ? item.endDate.slice(0, 16) : "",
              isCurrent: item.isCurrent ?? false
            })) ?? [];
          break;
        case "troupe":
          nextState.troupeType = loadedEntity.troupeType ?? "troupe";
          nextState.foundedDate = loadedEntity.foundedDate ? loadedEntity.foundedDate.slice(0, 16) : "";
          nextState.dissolvedDate = loadedEntity.dissolvedDate ? loadedEntity.dissolvedDate.slice(0, 16) : "";
          nextState.cityId = loadedEntity.cityId ?? "";
          nextState.city = loadedEntity.city ?? "";
          nextState.region = loadedEntity.region ?? "";
          nextState.officialWebsite = loadedEntity.officialWebsite ?? "";
          break;
        case "venue":
          nextState.venueType = loadedEntity.venueType ?? "theater";
          nextState.country = loadedEntity.country ?? "中国";
          nextState.cityId = loadedEntity.cityId ?? "";
          nextState.city = loadedEntity.city ?? "";
          nextState.region = loadedEntity.region ?? "";
          nextState.address = loadedEntity.address ?? "";
          nextState.latitude = loadedEntity.latitude !== undefined ? String(loadedEntity.latitude) : "";
          nextState.longitude = loadedEntity.longitude !== undefined ? String(loadedEntity.longitude) : "";
          nextState.capacity = loadedEntity.capacity !== undefined ? String(loadedEntity.capacity) : "";
          break;
        case "event":
          nextState.eventType = loadedEntity.eventType ?? "performance";
          nextState.businessStatus = loadedEntity.businessStatus ?? "scheduled";
          nextState.startAt = loadedEntity.startAt ? loadedEntity.startAt.slice(0, 16) : "";
          nextState.endAt = loadedEntity.endAt ? loadedEntity.endAt.slice(0, 16) : "";
          nextState.cityId = loadedEntity.cityId ?? "";
          nextState.venueEntityId = loadedEntity.venueId ?? "";
          nextState.troupeIds = loadedEntity.troupeIds ?? [];
          nextState.ticketUrl = loadedEntity.ticketUrl ?? "";
          nextState.duration = loadedEntity.duration ?? "";
          nextState.ticketStatus = loadedEntity.ticketStatus ?? "";
          nextState.noteText = loadedEntity.noteText ?? "";
          nextState.posterImageId = loadedEntity.posterImageId ?? "";
          nextState.programDetailed =
            loadedEntity.programDetailed?.map((item) => ({
              key: makeClientKey("program"),
              workEntityId: item.workEntityId ?? "",
              titleOverride: item.titleOverride ?? "",
              sequenceNo: item.sequenceNo ? String(item.sequenceNo) : "",
              durationMinutes: item.durationMinutes ? String(item.durationMinutes) : "",
              notes: item.notes ?? "",
              casts:
                item.casts?.map((cast) => ({
                  key: makeClientKey("cast"),
                  roleEntityId: cast.roleEntityId ?? "",
                  personEntityId: cast.personEntityId ?? "",
                  castNote: cast.castNote ?? ""
                })) ?? []
            })) ?? [];
          break;
        case "city":
          nextState.province = loadedEntity.province ?? "";
          break;
        case "article":
          nextState.articleType = loadedEntity.articleType ?? "term";
          nextState.abstract = loadedEntity.abstract ?? "";
          nextState.difficultyLevel = loadedEntity.difficultyLevel ?? "";
          nextState.bodySourceType = loadedEntity.bodySourceType ?? "";
          break;
        default:
          break;
      }

      const nextOptions = await getEditorOptions(loadedEntity.entityType, loadedEntity.id);
      if (!active) {
        return;
      }
      setFormState(nextState);
      setOptions(nextOptions);
      setLoaded(true);
    }

    (slug ? loadEditState() : loadCreateState()).catch(() => {
      if (active) {
        setMessage(slug ? "无法加载当前条目。" : "无法加载新建表单。");
        setLoaded(true);
      }
    });

    return () => {
      active = false;
    };
  }, [entityType, slug]);

  useEffect(() => {
    if (activeEntityType !== "work" || !options) {
      return;
    }
    if (formState.workType !== "excerpt") {
      return;
    }
    const parentId = typeof formState.parentWorkId === "string" ? formState.parentWorkId : "";
    const excerptName = typeof formState.excerptName === "string" ? formState.excerptName : "";
    const parent = options.fullWorks.find((item) => item.id === parentId);
    if (parent && excerptName.trim()) {
      setTitle(`${parent.title}·${excerptName.trim()}`);
    }
  }, [activeEntityType, formState.excerptName, formState.parentWorkId, formState.workType, options]);

  useEffect(() => {
    if (activeEntityType !== "event" || !options || !isCreateMode) {
      return;
    }
    const program = Array.isArray(formState.programDetailed) ? (formState.programDetailed as EventProgramItemRow[]) : [];
    const cityTitle = options.cities.find((item) => item.id === formState.cityId)?.title;
    const venueTitle = options.venues.find((item) => item.id === formState.venueEntityId)?.title;
    const troupeIds = Array.isArray(formState.troupeIds) ? (formState.troupeIds as string[]) : [];
    const troupeTitles = options.troupes.filter((item) => troupeIds.includes(item.id)).map((item) => item.title);
    const workIds = program.map((item) => item.workEntityId).filter(Boolean);
    const workTitles = options.fullWorks.filter((item) => workIds.includes(item.id)).map((item) => item.title);
    const excerptTitles = options.excerpts.filter((item) => workIds.includes(item.id)).map((item) => item.title);
    setTitle(
      buildEventTitle({
        startAt: typeof formState.startAt === "string" ? formState.startAt : "",
        cityTitle,
        venueTitle,
        troupeTitles,
        workTitles,
        excerptTitles
      })
    );
  }, [
    activeEntityType,
    formState.cityId,
    formState.programDetailed,
    formState.startAt,
    formState.troupeIds,
    formState.venueEntityId,
    isCreateMode,
    options
  ]);

  const entityTypeLabel = useMemo(() => {
    switch (activeEntityType) {
      case "work":
        return "剧目";
      case "person":
        return "人物";
      case "troupe":
        return "剧团";
      case "venue":
        return "剧场";
      case "event":
        return "演出";
      case "city":
        return "城市";
      case "article":
        return "知识条目";
      default:
        return "条目";
    }
  }, [activeEntityType]);

  const bodyLabel = useMemo(() => {
    switch (activeEntityType) {
      case "work":
        return "剧情或正文（支持 Markdown）";
      case "person":
        return "人物简介（支持 Markdown）";
      case "article":
        return "知识正文（支持 Markdown）";
      default:
        return "正文（支持 Markdown）";
    }
  }, [activeEntityType]);

  const modeLabel = isCreateMode ? "完整新建" : "提案编辑";
  const editSummaryFilled = Boolean(editSummary.trim());
  const bodyLength = body.trim().length;
  const programItems = Array.isArray(formState.programDetailed) ? (formState.programDetailed as EventProgramItemRow[]) : [];

  async function buildPayload() {
    const payload: Record<string, unknown> = {
      title,
      bodyMarkdown: body
    };

    switch (activeEntityType) {
      case "work":
        payload.plot = body;
        payload.synopsis = excerptText(body);
        payload.workType = formState.workType;
        payload.originalAuthor = formState.originalAuthor;
        payload.dynastyPeriod = formState.dynastyPeriod;
        payload.genreNote = formState.genreNote;
        payload.parentWorkId = formState.parentWorkId || null;
        payload.durationMinutes = formState.durationMinutes ? Number(formState.durationMinutes) : null;
        payload.firstKnownDate = formState.firstKnownDate;
        payload.isKunquCore = formState.isKunquCore;
        break;
      case "person":
        payload.bio = body;
        payload.personTypeNote = formState.personTypeNote;
        payload.gender = formState.gender;
        payload.birthDate = formState.birthDate ? new Date(String(formState.birthDate)).toISOString() : null;
        payload.deathDate = formState.deathDate ? new Date(String(formState.deathDate)).toISOString() : null;
        payload.hometown = formState.hometown;
        payload.birthCityId = formState.birthCityId || null;
        payload.isLiving = formState.isLiving;
        payload.personIdentities = (Array.isArray(formState.personIdentities) ? (formState.personIdentities as PersonIdentityRow[]) : []).map((item) => ({
          identityTerm: item.identityTerm,
          startDate: item.startDate ? new Date(item.startDate).toISOString() : null,
          endDate: item.endDate ? new Date(item.endDate).toISOString() : null
        }));
        payload.troupeMemberships = (
          Array.isArray(formState.troupeMemberships) ? (formState.troupeMemberships as TroupeMembershipRow[]) : []
        ).map((item) => ({
          troupeEntityId: item.troupeEntityId || null,
          membershipRole: item.membershipRole,
          startDate: item.startDate ? new Date(item.startDate).toISOString() : null,
          endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
          isCurrent: item.isCurrent
        }));
        payload.representativeWorkIds = formState.representativeWorkIds ?? [];
        payload.representativeExcerptIds = formState.representativeExcerptIds ?? [];
        break;
      case "troupe":
        payload.description = body;
        payload.troupeType = formState.troupeType;
        payload.foundedDate = formState.foundedDate ? new Date(String(formState.foundedDate)).toISOString() : null;
        payload.dissolvedDate = formState.dissolvedDate ? new Date(String(formState.dissolvedDate)).toISOString() : null;
        payload.cityId = formState.cityId || null;
        payload.city = formState.city;
        payload.region = formState.region;
        payload.officialWebsite = formState.officialWebsite;
        break;
      case "venue":
        payload.description = body;
        payload.venueType = formState.venueType;
        payload.country = formState.country;
        payload.cityId = formState.cityId || null;
        payload.city = formState.city;
        payload.region = formState.region;
        payload.address = formState.address;
        payload.latitude = formState.latitude ? Number(formState.latitude) : null;
        payload.longitude = formState.longitude ? Number(formState.longitude) : null;
        payload.capacity = formState.capacity ? Number(formState.capacity) : null;
        break;
      case "event":
        payload.eventType = formState.eventType;
        payload.businessStatus = formState.businessStatus;
        payload.startAt = formState.startAt ? new Date(String(formState.startAt)).toISOString() : undefined;
        payload.endAt = formState.endAt ? new Date(String(formState.endAt)).toISOString() : null;
        payload.cityId = formState.cityId || null;
        payload.venueEntityId = formState.venueEntityId || null;
        payload.troupeIds = Array.isArray(formState.troupeIds) ? formState.troupeIds : [];
        payload.ticketUrl = formState.ticketUrl;
        payload.duration = formState.duration;
        payload.ticketStatus = formState.ticketStatus;
        payload.noteText = formState.noteText;
        payload.posterImageId = formState.posterImageId;
        payload.programDetailed = (Array.isArray(formState.programDetailed) ? (formState.programDetailed as EventProgramItemRow[]) : []).map((item) => ({
          workEntityId: item.workEntityId || null,
          titleOverride: item.titleOverride || null,
          sequenceNo: item.sequenceNo ? Number(item.sequenceNo) : null,
          durationMinutes: item.durationMinutes ? Number(item.durationMinutes) : null,
          notes: item.notes || null,
          casts: item.casts.map((cast) => ({
            roleEntityId: cast.roleEntityId || null,
            personEntityId: cast.personEntityId || null,
            castNote: cast.castNote || null
          }))
        }));
        break;
      case "city":
        payload.province = formState.province;
        break;
      case "article":
        payload.articleType = formState.articleType;
        payload.abstract = formState.abstract;
        payload.difficultyLevel = formState.difficultyLevel;
        payload.bodySourceType = formState.bodySourceType;
        break;
      default:
        break;
    }

    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEntityType) {
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const payload = await buildPayload();
      if (isCreateMode) {
        const created = await createQuickEntityClient({
          entityType: activeEntityType,
          title,
          workType: typeof payload.workType === "string" ? payload.workType : undefined,
          parentWorkId: typeof payload.parentWorkId === "string" ? payload.parentWorkId : undefined,
          initialData: payload
        });
        window.location.href = entityPath(activeEntityType, created.slug);
      } else {
        await submitProposal(slug!, {
          proposalType: "content_update",
          editSummary,
          payload: {
            ...payload,
            editSummary
          }
        });
        setMessage("提案已提交到审核队列。");
        setEditSummary("");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.editorFormPage}>
      <EditorSummaryBar
        entityTypeLabel={entityTypeLabel}
        title={title || entity?.title || "未命名条目"}
        modeLabel={modeLabel}
        editSummaryFilled={!isCreateMode && editSummaryFilled}
        bodyLength={bodyLength}
        loaded={loaded}
        entity={entity}
      />

      <form className={`${styles.editForm} ${styles.editorForm}`} onSubmit={handleSubmit}>
        <div className={styles.editorFormIntro}>
          <p className={styles.editorFormEyebrow}>{isCreateMode ? "Full Create" : "Structured Editing"}</p>
          <h2>{isCreateMode ? `${entityTypeLabel}完整新建表单` : `${entityTypeLabel}完整编辑表单`}</h2>
          <p>现在所有可编辑内容都通过结构化表单录入，不再要求用户直接编辑 JSON。</p>
        </div>

        <CollapsibleFormSection
          title="基础信息"
          description="标题与正文会直接进入条目的公开主内容，所有条目都不再单独维护摘要。"
          summary={`${title.trim() || "未命名条目"} · 正文 ${bodyLength} 字`}
        >
          <div className={styles.formGrid}>
            <label className={styles.fieldSpanFull}>
              标题
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending || (activeEntityType === "work" && formState.workType === "excerpt")}
              />
            </label>
            <label className={styles.fieldSpanFull}>
              {bodyLabel}
              <textarea rows={10} value={body} onChange={(event) => setBody(event.target.value)} disabled={pending} />
            </label>
          </div>
        </CollapsibleFormSection>

        {activeEntityType === "work" && options ? (
          <CollapsibleFormSection
            title="剧目资料"
            description="覆盖作品表中的关键信息。"
            summary={`${mapWorkTypeLabel(String(formState.workType ?? "full_play"))} · ${String(formState.originalAuthor ?? "").trim() || "原作者未填"} · ${String(formState.durationMinutes ?? "").trim() || "时长未填"} 分钟`}
            defaultExpanded
          >
            <div className={styles.formGrid}>
              <label>
                剧目类型
                <select value={String(formState.workType ?? "full_play")} onChange={(event) => setField("workType", event.target.value)}>
                  {options.workTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {mapWorkTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                原作者
                <input value={String(formState.originalAuthor ?? "")} onChange={(event) => setField("originalAuthor", event.target.value)} />
              </label>
              <label>
                朝代/时期
                <input value={String(formState.dynastyPeriod ?? "")} onChange={(event) => setField("dynastyPeriod", event.target.value)} />
              </label>
              <label>
                题材/体裁说明
                <input value={String(formState.genreNote ?? "")} onChange={(event) => setField("genreNote", event.target.value)} />
              </label>
              <label>
                时长（分钟）
                <input value={String(formState.durationMinutes ?? "")} onChange={(event) => setField("durationMinutes", event.target.value)} />
              </label>
              <label>
                最早可考时间
                <input value={String(formState.firstKnownDate ?? "")} onChange={(event) => setField("firstKnownDate", event.target.value)} />
              </label>
              <SearchCreateSelect
                className={styles.fieldSpanFull}
                label="所属母剧目"
                options={options.fullWorks}
                value={String(formState.parentWorkId ?? "")}
                onChange={(value) => setField("parentWorkId", value)}
                onCreate={(name) => createQuickOption("work", name, "fullWorks", { workType: "full_play" })}
                placeholder="搜索已有剧目，没有则创建新剧目"
                createLabel="创建新剧目："
              />
              {formState.workType === "excerpt" ? (
                <label className={styles.fieldSpanFull}>
                  折子名称
                  <input value={String(formState.excerptName ?? "")} onChange={(event) => setField("excerptName", event.target.value)} />
                </label>
              ) : null}
              <label className={`${styles.checkboxRow} ${styles.fieldSpanFull}`}>
                <input
                  type="checkbox"
                  checked={Boolean(formState.isKunquCore)}
                  onChange={(event) => setField("isKunquCore", event.target.checked)}
                />
                昆曲核心剧目
              </label>
            </div>
          </CollapsibleFormSection>
        ) : null}

        {activeEntityType === "person" && options ? (
          <CollapsibleFormSection
            title="人物资料"
            description="人物履历和院团履历现在都通过行编辑器录入，不再直接暴露 JSON。"
            summary={`${String(formState.personTypeNote ?? "").trim() || "人物类型未填"} · ${String(formState.gender ?? "").trim() || "性别未填"} · ${String(formState.hometown ?? "").trim() || "籍贯未填"}`}
            defaultExpanded
          >
            <div className={styles.formGrid}>
              <label>
                人物类型说明
                <input value={String(formState.personTypeNote ?? "")} onChange={(event) => setField("personTypeNote", event.target.value)} />
              </label>
              <label>
                性别
                <input value={String(formState.gender ?? "")} onChange={(event) => setField("gender", event.target.value)} />
              </label>
              <DateTimeField label="出生时间" value={String(formState.birthDate ?? "")} onChange={(value) => setField("birthDate", value)} />
              <DateTimeField label="去世时间" value={String(formState.deathDate ?? "")} onChange={(value) => setField("deathDate", value)} />
              <label>
                籍贯/家乡
                <input value={String(formState.hometown ?? "")} onChange={(event) => setField("hometown", event.target.value)} />
              </label>
              <SearchCreateSelect
                label="出生地"
                options={options.cities}
                value={String(formState.birthCityId ?? "")}
                onChange={(value) => setField("birthCityId", value)}
                onCreate={(name) => createQuickOption("city", name, "cities")}
                placeholder="搜索已有城市，没有则创建新城市"
                createLabel="创建新城市："
              />
              <label className={`${styles.checkboxRow} ${styles.fieldSpanFull}`}>
                <input type="checkbox" checked={Boolean(formState.isLiving)} onChange={(event) => setField("isLiving", event.target.checked)} />
                在世
              </label>
              <SearchCreateMultiSelect
                className={styles.fieldSpanFull}
                label="代表剧目"
                options={options.fullWorks}
                values={Array.isArray(formState.representativeWorkIds) ? (formState.representativeWorkIds as string[]) : []}
                onAdd={(id) => toggleArrayField("representativeWorkIds", id)}
                onRemove={(id) => toggleArrayField("representativeWorkIds", id)}
                onCreate={(name) => createQuickOption("work", name, "fullWorks", { workType: "full_play" })}
                placeholder="搜索已有剧目"
                createLabel="创建新剧目："
              />
              <SearchCreateMultiSelect
                className={styles.fieldSpanFull}
                label="代表折子戏"
                options={options.excerpts}
                values={Array.isArray(formState.representativeExcerptIds) ? (formState.representativeExcerptIds as string[]) : []}
                onAdd={(id) => toggleArrayField("representativeExcerptIds", id)}
                onRemove={(id) => toggleArrayField("representativeExcerptIds", id)}
                onCreate={(name) =>
                  createQuickOption("work", name, "excerpts", {
                    workType: "excerpt",
                    parentWorkId:
                      Array.isArray(formState.representativeWorkIds) && typeof formState.representativeWorkIds[0] === "string"
                        ? String(formState.representativeWorkIds[0])
                        : undefined
                  })
                }
                placeholder="搜索已有折子戏"
                createLabel="创建新折子戏："
              />
            </div>

            <div className={styles.structuredGroup}>
              <div className={styles.structuredGroupHead}>
                <h4>人物身份履历</h4>
                <p>按时间补充人物的身份变化，例如演员、教师、导演等。</p>
              </div>
              {Array.isArray(formState.personIdentities) && (formState.personIdentities as PersonIdentityRow[]).length > 0 ? (
                <div className={styles.structuredList}>
                  {(formState.personIdentities as PersonIdentityRow[]).map((item) => (
                    <IdentityRowEditor
                      key={item.key}
                      item={item}
                      onUpdate={(updater) => updateStructuredRow<PersonIdentityRow>("personIdentities", item.key, updater)}
                      onRemove={() => removeStructuredRow<PersonIdentityRow>("personIdentities", item.key)}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.helperText}>暂无身份履历，可按需添加。</p>
              )}
              <button type="button" className={buttonStyles.button} onClick={() => appendStructuredRow("personIdentities", emptyIdentityRow())}>
                添加身份履历
              </button>
              <datalist id="identity-options">
                {options.identityOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className={styles.structuredGroup}>
              <div className={styles.structuredGroupHead}>
                <h4>院团履历</h4>
                <p>支持直接选择已有院团，不存在时可当场创建占位条目并高亮提醒。</p>
              </div>
              {Array.isArray(formState.troupeMemberships) && (formState.troupeMemberships as TroupeMembershipRow[]).length > 0 ? (
                <div className={styles.structuredList}>
                  {(formState.troupeMemberships as TroupeMembershipRow[]).map((item) => (
                    <MembershipRowEditor
                      key={item.key}
                      item={item}
                      options={options}
                      onUpdate={(updater) => updateStructuredRow<TroupeMembershipRow>("troupeMemberships", item.key, updater)}
                      onRemove={() => removeStructuredRow<TroupeMembershipRow>("troupeMemberships", item.key)}
                      onCreateTroupe={(name) => createQuickOption("troupe", name, "troupes")}
                      isDraftEntity={isDraftEntity}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.helperText}>暂无院团履历，可按需添加。</p>
              )}
              <button type="button" className={buttonStyles.button} onClick={() => appendStructuredRow("troupeMemberships", emptyMembershipRow())}>
                添加院团履历
              </button>
            </div>
          </CollapsibleFormSection>
        ) : null}

        {activeEntityType === "troupe" && options ? (
          <CollapsibleFormSection
            title="院团资料"
            description="院团本体字段全部可编辑。"
            summary={`${mapTroupeTypeLabel(String(formState.troupeType ?? "troupe"))} · ${String(formState.city ?? "").trim() || "城市未填"} · ${String(formState.region ?? "").trim() || "地区未填"}`}
          >
            <div className={styles.formGrid}>
              <label>
                院团类型
                <select value={String(formState.troupeType ?? "troupe")} onChange={(event) => setField("troupeType", event.target.value)}>
                  {options.troupeTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {mapTroupeTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <DateTimeField label="成立时间" value={String(formState.foundedDate ?? "")} onChange={(value) => setField("foundedDate", value)} />
              <DateTimeField label="解散时间" value={String(formState.dissolvedDate ?? "")} onChange={(value) => setField("dissolvedDate", value)} />
              <SearchCreateSelect
                label="所在城市"
                options={options.cities}
                value={String(formState.cityId ?? "")}
                onChange={(value) => setField("cityId", value)}
                onCreate={(name) => createQuickOption("city", name, "cities")}
                placeholder="搜索已有城市"
                createLabel="创建新城市："
              />
              <label>
                城市文本
                <input value={String(formState.city ?? "")} onChange={(event) => setField("city", event.target.value)} />
              </label>
              <label>
                地区
                <input value={String(formState.region ?? "")} onChange={(event) => setField("region", event.target.value)} />
              </label>
              <label className={styles.fieldSpanFull}>
                官网
                <input value={String(formState.officialWebsite ?? "")} onChange={(event) => setField("officialWebsite", event.target.value)} />
              </label>
            </div>
          </CollapsibleFormSection>
        ) : null}

        {activeEntityType === "venue" && options ? (
          <CollapsibleFormSection
            title="剧场资料"
            description="包含场馆坐标、容量、国家与地址信息。"
            summary={`${String(formState.venueType ?? "").trim() || "类型未填"} · ${String(formState.country ?? "").trim() || "国家未填"} · ${String(formState.city ?? "").trim() || "城市未填"}`}
          >
            <div className={styles.formGrid}>
              <label>
                场馆类型
                <input value={String(formState.venueType ?? "")} onChange={(event) => setField("venueType", event.target.value)} />
              </label>
              <label>
                国家
                <input value={String(formState.country ?? "")} onChange={(event) => setField("country", event.target.value)} />
              </label>
              <SearchCreateSelect
                label="所在城市"
                options={options.cities}
                value={String(formState.cityId ?? "")}
                onChange={(value) => setField("cityId", value)}
                onCreate={(name) => createQuickOption("city", name, "cities")}
                placeholder="搜索已有城市"
                createLabel="创建新城市："
              />
              <label>
                城市文本
                <input value={String(formState.city ?? "")} onChange={(event) => setField("city", event.target.value)} />
              </label>
              <label>
                地区
                <input value={String(formState.region ?? "")} onChange={(event) => setField("region", event.target.value)} />
              </label>
              <label className={styles.fieldSpanFull}>
                地址
                <input value={String(formState.address ?? "")} onChange={(event) => setField("address", event.target.value)} />
              </label>
              <label>
                纬度
                <input value={String(formState.latitude ?? "")} onChange={(event) => setField("latitude", event.target.value)} />
              </label>
              <label>
                经度
                <input value={String(formState.longitude ?? "")} onChange={(event) => setField("longitude", event.target.value)} />
              </label>
              <label>
                容量
                <input value={String(formState.capacity ?? "")} onChange={(event) => setField("capacity", event.target.value)} />
              </label>
            </div>
          </CollapsibleFormSection>
        ) : null}

        {activeEntityType === "event" && options ? (
          <CollapsibleFormSection
            title="演出资料"
            description="演出默认视为单场条目，可录入多个剧团、节目单和演员表，并支持就地创建缺失人物或剧团。"
            summary={buildEventSectionSummary(formState, options)}
            accent
            defaultExpanded
          >
            <div className={`${styles.formGrid} ${styles.formGridWide}`}>
              <label>
                演出类型
                <select value={String(formState.eventType ?? "performance")} onChange={(event) => setField("eventType", event.target.value)}>
                  {options.eventTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {mapEventTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                业务状态
                <select value={String(formState.businessStatus ?? "scheduled")} onChange={(event) => setField("businessStatus", event.target.value)}>
                  {options.eventStatusOptions.map((item) => (
                    <option key={item} value={item}>
                      {mapEventStatusLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <SearchCreateSelect
                label="演出城市"
                options={options.cities}
                value={String(formState.cityId ?? "")}
                onChange={(value) => setField("cityId", value)}
                onCreate={(name) => createQuickOption("city", name, "cities")}
                placeholder="搜索已有城市"
                createLabel="创建新城市："
              />
              <SearchCreateSelect
                label="演出剧场"
                options={options.venues}
                value={String(formState.venueEntityId ?? "")}
                onChange={(value) => setField("venueEntityId", value)}
                onCreate={(name) => createQuickOption("venue", name, "venues")}
                placeholder="搜索已有剧场"
                createLabel="创建新剧场："
              />
              <SearchCreateMultiSelect
                className={styles.fieldSpanFull}
                label="剧团"
                options={options.troupes}
                values={Array.isArray(formState.troupeIds) ? (formState.troupeIds as string[]) : []}
                onAdd={(id) => toggleArrayField("troupeIds", id)}
                onRemove={(id) => toggleArrayField("troupeIds", id)}
                onCreate={(name) => createQuickOption("troupe", name, "troupes")}
                placeholder="搜索已有剧团，没有则创建新剧团"
                createLabel="创建新剧团："
                renderTagMeta={(item) => (isDraftEntity(item.id) ? <span className={styles.tagStatusPill}>待补充</span> : null)}
              />
              <div className={`${styles.eventTimePanel} ${styles.fieldSpanFull}`}>
                <div className={styles.eventTimePanelHead}>
                  <strong>演出时间</strong>
                  <p>开始与结束时间合并为一个紧凑时间块，填写时更清晰，回看时也更容易比较。</p>
                </div>
                <div className={styles.eventTimeGrid}>
                  <DateTimeField label="开始时间" value={String(formState.startAt ?? "")} onChange={(value) => setField("startAt", value)} />
                  <DateTimeField
                    label="结束时间"
                    value={String(formState.endAt ?? "")}
                    onChange={(value) => setField("endAt", value)}
                    helper="如果是单场演出，可只填写开始时间。"
                  />
                </div>
              </div>
              <label>
                票务链接
                <input value={String(formState.ticketUrl ?? "")} onChange={(event) => setField("ticketUrl", event.target.value)} />
              </label>
              <label>
                演出时长
                <input value={String(formState.duration ?? "")} onChange={(event) => setField("duration", event.target.value)} />
              </label>
              <label>
                票务状态
                <input value={String(formState.ticketStatus ?? "")} onChange={(event) => setField("ticketStatus", event.target.value)} />
              </label>
              <label>
                海报资源 ID
                <input value={String(formState.posterImageId ?? "")} onChange={(event) => setField("posterImageId", event.target.value)} />
              </label>
              <label className={styles.fieldSpanFull}>
                演出备注
                <textarea value={String(formState.noteText ?? "")} onChange={(event) => setField("noteText", event.target.value)} />
              </label>
            </div>

            <div className={`${styles.structuredGroup} ${styles.programsPanel}`}>
              <div className={styles.structuredGroupHead}>
                <h4>节目单与演员</h4>
                <p>按节目折叠，演员以行编辑形式快速补全。</p>
              </div>
              {programItems.length > 0 ? (
                <div className={styles.programsList}>
                  {programItems.map((item, index) => (
                    <ProgramBlock
                      key={item.key}
                      item={item}
                      index={index}
                      options={options}
                      createQuickOption={createQuickOption}
                      isDraftEntity={isDraftEntity}
                      onUpdate={(nextItem) =>
                        updateStructuredRow<EventProgramItemRow>("programDetailed", item.key, () => nextItem)
                      }
                      onRemove={() => removeStructuredRow<EventProgramItemRow>("programDetailed", item.key)}
                      onAddCast={() =>
                        updateStructuredRow<EventProgramItemRow>("programDetailed", item.key, (current) => ({
                          ...current,
                          casts: [...current.casts, emptyCastRow()]
                        }))
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.helperText}>尚未添加节目单。</p>
              )}
              <div className={styles.sectionActions}>
                <button type="button" className={buttonStyles.button} onClick={() => appendStructuredRow("programDetailed", emptyProgramRow())}>
                  添加节目
                </button>
              </div>
            </div>
          </CollapsibleFormSection>
        ) : null}

        {activeEntityType === "city" ? (
          <CollapsibleFormSection title="城市资料" description="目前城市实体的结构化字段为所属省份。" summary={String(formState.province ?? "").trim() || "省份未填"}>
            <div className={styles.formGrid}>
              <label>
                省份
                <input value={String(formState.province ?? "")} onChange={(event) => setField("province", event.target.value)} />
              </label>
            </div>
          </CollapsibleFormSection>
        ) : null}

        {activeEntityType === "article" && options ? (
          <CollapsibleFormSection
            title="知识条目资料"
            description="覆盖条目分类、摘要和正文来源字段。"
            summary={`${mapArticleTypeLabel(String(formState.articleType ?? "term"))} · ${String(formState.difficultyLevel ?? "").trim() || "难度未填"}`}
          >
            <div className={styles.formGrid}>
              <label>
                条目类型
                <select value={String(formState.articleType ?? "term")} onChange={(event) => setField("articleType", event.target.value)}>
                  {options.articleTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {mapArticleTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                难度等级
                <input value={String(formState.difficultyLevel ?? "")} onChange={(event) => setField("difficultyLevel", event.target.value)} />
              </label>
              <label className={styles.fieldSpanFull}>
                摘要说明
                <textarea value={String(formState.abstract ?? "")} onChange={(event) => setField("abstract", event.target.value)} />
              </label>
              <label className={styles.fieldSpanFull}>
                正文来源类型
                <input value={String(formState.bodySourceType ?? "")} onChange={(event) => setField("bodySourceType", event.target.value)} />
              </label>
            </div>
          </CollapsibleFormSection>
        ) : null}

        {!isCreateMode ? (
          <CollapsibleFormSection
            title="提交审核"
            description="编辑说明会进入提案与版本历史。留空时会自动使用你的签名和提交时间。"
            summary={editSummary.trim() ? "已填写编辑说明" : "编辑说明为空"}
            defaultExpanded={false}
          >
            <div className={styles.formGrid}>
              <label className={styles.fieldSpanFull}>
                编辑说明
                <textarea value={editSummary} onChange={(event) => setEditSummary(event.target.value)} disabled={pending} />
              </label>
            </div>
          </CollapsibleFormSection>
        ) : null}

        <ActionBar>
          <button type="submit" disabled={pending || !loaded || !title.trim()}>
            {pending ? "提交中..." : isCreateMode ? "创建条目" : "提交提案"}
          </button>
          {message ? <p className={styles.statusMessage}>{message}</p> : null}
        </ActionBar>
      </form>
    </div>
  );
}
