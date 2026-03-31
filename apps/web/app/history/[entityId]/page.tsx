import { getRecentChanges } from "../../../lib/api";
import { mapReviewStatusLabel } from "../../../lib/labels";

// Styles
import styles from "../../../styles/detail-page.module.css";
import tableStyles from "../../../styles/components/table.module.css";

export default async function HistoryPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  const changes = await getRecentChanges();
  const entityChanges = changes.filter((item) => item.entityId === entityId);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>版本历史</h1>
      <div className={tableStyles.shell}>
        <table>
          <thead>
            <tr>
              <th>版本</th>
              <th>编辑者</th>
              <th>说明</th>
              <th>状态</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {entityChanges.map((change) => (
              <tr key={change.id}>
                <td>r{change.revisionNo}</td>
                <td>{change.editorName}</td>
                <td>{change.editSummary}</td>
                <td>{mapReviewStatusLabel(change.reviewStatus)}</td>
                <td>{change.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}