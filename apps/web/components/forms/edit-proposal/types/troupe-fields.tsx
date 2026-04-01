"use client";

import { mapTroupeTypeLabel } from "../../../../lib/labels";
import type { WorkType } from "@kunquwiki/shared";
import { CollapsibleFormSection, DateTimeField, SearchCreateSelect, type EditorOptions, type QuickCreatedOption } from "../shared";

// Styles
import styles from "../../../../styles/editor-page.module.css";

type TroupeFieldsProps = {
  formState: Record<string, unknown>;
  options: EditorOptions;
  setField: (name: string, value: unknown) => void;
  createQuickOption: (
    entityType: string,
    name: string,
    targetList: keyof NonNullable<EditorOptions>,
    extra?: { workType?: WorkType; parentWorkId?: string; initialData?: Record<string, unknown> }
  ) => Promise<QuickCreatedOption | void>;
};

export function TroupeFields({ formState, options, setField, createQuickOption }: TroupeFieldsProps) {
  return (
    <CollapsibleFormSection
      title="院团资料"
      description="院团本体字段全部可编辑。"
      summary={`${mapTroupeTypeLabel(String(formState.troupeType ?? "troupe"))} · ${String(formState.cityText ?? "").trim() || "城市未填"} · ${String(formState.regionText ?? "").trim() || "地区未填"}`}
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
          <input value={String(formState.cityText ?? "")} onChange={(event) => setField("cityText", event.target.value)} />
        </label>
        <label>
          地区
          <input value={String(formState.regionText ?? "")} onChange={(event) => setField("regionText", event.target.value)} />
        </label>
        <label className={styles.fieldSpanFull}>
          官网
          <input value={String(formState.officialWebsite ?? "")} onChange={(event) => setField("officialWebsite", event.target.value)} />
        </label>
      </div>
    </CollapsibleFormSection>
  );
}
