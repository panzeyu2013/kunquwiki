import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Styles
import styles from "../styles/components/markdown-content.module.css";

export function MarkdownContent({ value }: { value: string }) {
  return (
    <div className={styles.content}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}