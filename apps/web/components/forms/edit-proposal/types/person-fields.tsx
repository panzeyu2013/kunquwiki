"use client";

import { useState } from "react";
import {
  CollapsibleFormSection,
  DateTimeField,
  DraftBadge,
  SearchCreateMultiSelect,
  SearchCreateSelect,
  emptyIdentityRow,
  emptyMembershipRow,
  formatDateTimeLabel,
  type EditorOptions,
  type PersonIdentityRow,
  type QuickCreatedOption,
  type TroupeMembershipRow
} from "../shared";
import { mapIdentityLabel } from "../../../../lib/labels";

// Styles
import styles from "../../../../styles/editor-page.module.css";
import buttonStyles from "../../../../styles/components/button.module.css";
import ghostButtonStyles from "../../../../styles/components/ghost-button.module.css";

type PersonFieldsProps = {
  formState: Record<string, unknown>;
  options: EditorOptions;
  setField: (name: string, value: unknown) => void;
  toggleArrayField: (name: string, value: string) => void;
  appendStructuredRow: (name: string, row: PersonIdentityRow | TroupeMembershipRow) => void;
  updateStructuredRow: (name: string, key: string, updater: (row: PersonIdentityRow | TroupeMembershipRow) => PersonIdentityRow | TroupeMembershipRow) => void;
  removeStructuredRow: (name: string, key: string) => void;
  createQuickOption: (
    entityType: string,
    name: string,
    targetList: keyof NonNullable<EditorOptions>,
    extra?: { workType?: string; parentWorkId?: string; initialData?: Record<string, unknown> }
  ) => Promise<QuickCreatedOption | void>;
  isDraftEntity: (id: string) => boolean;
};

function buildIdentitySummary(item: PersonIdentityRow) {
  const identity = mapIdentityLabel(item.identityTerm.trim()) || "未填写身份";
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

export function PersonFields({
  formState,
  options,
  setField,
  toggleArrayField,
  appendStructuredRow,
  updateStructuredRow,
  removeStructuredRow,
  createQuickOption,
  isDraftEntity
}: PersonFieldsProps) {
  return (
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
          <input
            type="checkbox"
            checked={formState.isLiving === true}
            onChange={(event) => setField("isLiving", event.target.checked ? true : null)}
          />
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
                onUpdate={(updater) => updateStructuredRow("personIdentities", item.key, updater)}
                onRemove={() => removeStructuredRow("personIdentities", item.key)}
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
            <option key={item} value={item} label={mapIdentityLabel(item)} />
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
                onUpdate={(updater) => updateStructuredRow("troupeMemberships", item.key, updater)}
                onRemove={() => removeStructuredRow("troupeMemberships", item.key)}
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
  );
}
