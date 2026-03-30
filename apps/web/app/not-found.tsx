import styles from "../styles/catalog-page.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <h1 className="page-title">未找到页面</h1>
      <p>这个条目可能还没有建立，或者 slug 已经发生变化。</p>
    </div>
  );
}
