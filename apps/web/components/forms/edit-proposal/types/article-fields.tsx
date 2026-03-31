"use client";

import { mapArticleTypeLabel } from "../../../../lib/labels";
import { CollapsibleFormSection, type EditorOptions } from "../shared";

// Styles
import styles from "../../../../styles/editor-page.module.css";

type ArticleFieldsProps = {
  formState: Record<string, unknown>;
  options: EditorOptions;
  setField: (name: string, value: unknown) => void;
};

export function ArticleFields({ formState, options, setField }: ArticleFieldsProps) {
  return (
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
  );
}
