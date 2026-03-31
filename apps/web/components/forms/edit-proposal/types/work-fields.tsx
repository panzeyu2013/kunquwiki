"use client";

import { mapWorkTypeLabel } from "../../../../lib/labels";
import { SearchCreateSelect, type EditorOptions, type QuickCreatedOption, CollapsibleFormSection } from "../shared";

// Styles
import styles from "../../../../styles/editor-page.module.css";

type WorkFieldsProps = {
  formState: Record<string, unknown>;
  options: EditorOptions;
  setField: (name: string, value: unknown) => void;
  createQuickOption: (
    entityType: string,
    name: string,
    targetList: keyof NonNullable<EditorOptions>,
    extra?: { workType?: string; parentWorkId?: string; initialData?: Record<string, unknown> }
  ) => Promise<QuickCreatedOption | void>;
};

export function WorkFields({ formState, options, setField, createQuickOption }: WorkFieldsProps) {
  return (
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
      </div>
    </CollapsibleFormSection>
  );
}
