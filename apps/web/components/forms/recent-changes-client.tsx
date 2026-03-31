"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecentChangesClient } from "../../lib/api-client";
import { mapReviewStatusLabel } from "../../lib/labels";
import pillStyles from "../../styles/components/pill.module.css";
import tableStyles from "../../styles/components/table.module.css";

type ChangeItem = Awaited<ReturnType<typeof getRecentChangesClient>>[number];

export function RecentChangesClient() {
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentChangesClient()
      .then((data) => {
        setChanges(data);
        setMessage(null);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "加载失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="status-message">正在加载最近更改...</p>;
  }

  if (message) {
    return <p className="status-message">{message}</p>;
  }

  return (
    <div className="editor-list-shell">
      <div className="editor-list-head">
        <div>
          <h2>修订记录</h2>
          <p>按版本浏览最近提交与审核状态。</p>
        </div>
        <span className={`${pillStyles.pill} ${pillStyles.strong}`}>{changes.length} 条</span>
      </div>
      <div className={`${tableStyles.shell} editor-table-shell`}>
      <table>
        <thead>
          <tr>
            <th>版本</th>
            <th>编辑者</th>
            <th>说明</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.id}>
              <td>r{change.revisionNo}</td>
              <td>{change.editorName}</td>
              <td>{change.editSummary}</td>
              <td>
                <span className={pillStyles.pill}>{mapReviewStatusLabel(change.reviewStatus)}</span>
              </td>
              <td>
                <Link className="table-link" href={`/history/${change.entityId}`}>
                  查看历史
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
