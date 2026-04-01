"use client";

import { useMemo, useState } from "react";
import { mapEventStatusLabel, mapEventTypeLabel } from "../../../../lib/labels";
import type { WorkType } from "@kunquwiki/shared";
import {
  CollapsibleFormSection,
  DateTimeField,
  DraftBadge,
  SearchCreateInlineSelect,
  SearchCreateMultiSelect,
  SearchCreateSelect,
  emptyCastRow,
  emptyProgramRow,
  formatDateTimeLabel,
  summarizeCollection,
  updateAt,
  removeAt,
  type EditorOptions,
  type EventProgramItemRow,
  type PerformanceCastRow,
  type QuickCreatedOption
} from "../shared";

// Styles
import styles from "../../../../styles/editor-page.module.css";
import buttonStyles from "../../../../styles/components/button.module.css";
import ghostButtonStyles from "../../../../styles/components/ghost-button.module.css";

type EventFieldsProps = {
  formState: Record<string, unknown>;
  options: EditorOptions;
  setField: (name: string, value: unknown) => void;
  toggleArrayField: (name: string, value: string) => void;
  appendStructuredRow: (name: string, row: EventProgramItemRow) => void;
  updateStructuredRow: (name: string, key: string, updater: (row: EventProgramItemRow) => EventProgramItemRow) => void;
  removeStructuredRow: (name: string, key: string) => void;
  createQuickOption: (
    entityType: string,
    name: string,
    targetList: keyof NonNullable<EditorOptions>,
    extra?: { workType?: WorkType; parentWorkId?: string; initialData?: Record<string, unknown> }
  ) => Promise<QuickCreatedOption | void>;
  isDraftEntity: (id: string) => boolean;
};

function buildEventSectionSummary(formState: Record<string, unknown>, options: EditorOptions) {
  const cityTitle = options.cities.find((item) => item.id === formState.cityId)?.title ?? "未选城市";
  const venueTitle = options.venues.find((item) => item.id === formState.venueEntityId)?.title ?? "未选剧场";
  const troupeIds = Array.isArray(formState.troupeIds) ? (formState.troupeIds as string[]) : [];
  const troupeTitles = options.troupes.filter((item) => troupeIds.includes(item.id)).map((item) => item.title);
  const programCount = Array.isArray(formState.programDetailed) ? (formState.programDetailed as EventProgramItemRow[]).length : 0;
  return `${formatDateTimeLabel(String(formState.startAt ?? ""))} · ${cityTitle} / ${venueTitle} · ${summarizeCollection(troupeTitles, "未选剧团")} · ${programCount} 个节目`;
}

type CastRowProps = {
  cast: PerformanceCastRow;
  options: EditorOptions;
  onUpdate: (row: PerformanceCastRow) => void;
  onRemove: () => void;
  onClearRole: () => void;
  createQuickOption: (
    entityType: string,
    name: string,
    targetList: keyof NonNullable<EditorOptions>,
    extra?: { workType?: WorkType; parentWorkId?: string; initialData?: Record<string, unknown> }
  ) => Promise<QuickCreatedOption | void>;
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
  createQuickOption: (
    entityType: string,
    name: string,
    targetList: keyof NonNullable<EditorOptions>,
    extra?: { workType?: WorkType; parentWorkId?: string; initialData?: Record<string, unknown> }
  ) => Promise<QuickCreatedOption | void>;
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
            onCreate={(name) => createQuickOption("work", name, "fullWorks", { workType: "full_play" as WorkType })}
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

export function EventFields({
  formState,
  options,
  setField,
  toggleArrayField,
  appendStructuredRow,
  updateStructuredRow,
  removeStructuredRow,
  createQuickOption,
  isDraftEntity
}: EventFieldsProps) {
  const programItems = Array.isArray(formState.programDetailed) ? (formState.programDetailed as EventProgramItemRow[]) : [];

  return (
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
                onUpdate={(nextItem) => updateStructuredRow("programDetailed", item.key, () => nextItem)}
                onRemove={() => removeStructuredRow("programDetailed", item.key)}
                onAddCast={() =>
                  updateStructuredRow("programDetailed", item.key, (current) => ({
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
  );
}
