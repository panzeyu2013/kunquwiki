"use client";

import { CollapsibleFormSection } from "../shared";

// Styles
import styles from "../../../../styles/editor-page.module.css";

type CityFieldsProps = {
  formState: Record<string, unknown>;
  setField: (name: string, value: unknown) => void;
};

export function CityFields({ formState, setField }: CityFieldsProps) {
  return (
    <CollapsibleFormSection
      title="城市资料"
      description="目前城市实体的结构化字段为所属省份。"
      summary={String(formState.province ?? "").trim() || "省份未填"}
    >
      <div className={styles.formGrid}>
        <label>
          省份
          <input value={String(formState.province ?? "")} onChange={(event) => setField("province", event.target.value)} />
        </label>
      </div>
    </CollapsibleFormSection>
  );
}
