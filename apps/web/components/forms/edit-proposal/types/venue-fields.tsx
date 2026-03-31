"use client";

import { CollapsibleFormSection, SearchCreateSelect, type EditorOptions, type QuickCreatedOption } from "../shared";

// Styles
import styles from "../../../../styles/editor-page.module.css";

type VenueFieldsProps = {
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

export function VenueFields({ formState, options, setField, createQuickOption }: VenueFieldsProps) {
  return (
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
  );
}
