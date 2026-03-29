"use client";

import { useEffect, useState } from "react";
import { getAdminOverviewClient, getAdminUsersClient, updateAdminUserClient } from "../../lib/api-client";
import { mapUserRoleLabel, mapUserStatusLabel } from "../../lib/labels";

export function AdminDashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminOverviewClient>> | null>(null);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof getAdminUsersClient>>>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAll() {
    const [overview, userList] = await Promise.all([getAdminOverviewClient(), getAdminUsersClient()]);
    setData(overview);
    setUsers(userList);
  }

  useEffect(() => {
    loadAll()
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "加载失败");
      });
  }, []);

  if (message) {
    return <p className="status-message">{message}</p>;
  }

  if (!data) {
    return <p className="status-message">正在加载后台概览...</p>;
  }

  function getNextRoles(currentRoles: string[], role: string) {
    if (role === "visitor") {
      return ["visitor"];
    }
    const withoutVisitor = currentRoles.filter((item) => item !== "visitor");
    return withoutVisitor.includes(role) ? withoutVisitor.filter((item) => item !== role) : [...new Set([...withoutVisitor, role])];
  }

  return (
    <div className="stack admin-shell">
      <section className="metrics">
        <article className="metric-card">
          <span>待审核提案</span>
          <strong>{data.pendingProposals}</strong>
        </article>
        <article className="metric-card">
          <span>注册用户</span>
          <strong>{data.totalUsers}</strong>
        </article>
      </section>
      <div className="detail-layout">
        <section className="detail-panel editor-panel">
          <div className="editor-list-head">
            <div>
              <h2>最近审计日志</h2>
              <p>后台操作和权限变更会记录在这里。</p>
            </div>
          </div>
          <div className="stack">
            {data.recentAuditLogs.map((log) => (
              <div key={log.id} className="event-row admin-row-card">
                <div>
                  <strong>{log.actionType}</strong>
                  <p>{log.actor}</p>
                </div>
                <span>{log.createdAt}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="detail-panel editor-panel">
          <div className="editor-list-head">
            <div>
              <h2>最近修订</h2>
              <p>最新修订摘要与编辑者概览。</p>
            </div>
          </div>
          <div className="stack">
            {data.recentRevisions.map((revision) => (
              <div key={revision.id} className="event-row admin-row-card">
                <div>
                  <strong>r{revision.revisionNo}</strong>
                  <p>{revision.editSummary}</p>
                </div>
                <span>{revision.editor}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="detail-panel editor-panel">
        <div className="editor-list-head">
          <div>
            <h2>用户权限管理</h2>
            <p>统一调整账号身份、状态与基础权限。</p>
          </div>
          <span className="pill strong">{users.length} 人</span>
        </div>
        <div className="stack">
          {users.map((user) => (
            <article key={user.id} className="event-row admin-user-card">
              <div className="admin-user-overview">
                <div className="pill-row">
                  <span className="pill strong">{mapUserStatusLabel(user.status)}</span>
                  <span className="pill">信誉 {user.reputation}</span>
                </div>
                <strong>{user.displayName}</strong>
                <p>账号标识：{user.username}</p>
                <p>邮箱：{user.email}</p>
                <p>当前身份：{user.roles.map(mapUserRoleLabel).join(" / ")}</p>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    const nextRoles = getNextRoles(user.roles, "reviewer");
                    await updateAdminUserClient(user.id, { roles: nextRoles.length > 0 ? nextRoles : ["visitor"] });
                    await loadAll();
                  }}
                >
                  {user.roles.includes("reviewer") ? "撤销审核身份" : "授予审核身份"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    const nextRoles = getNextRoles(user.roles, "editor");
                    await updateAdminUserClient(user.id, { roles: nextRoles.length > 0 ? nextRoles : ["visitor"] });
                    await loadAll();
                  }}
                >
                  {user.roles.includes("editor") ? "撤销编辑身份" : "授予编辑身份"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    const nextRoles = getNextRoles(user.roles, "admin");
                    await updateAdminUserClient(user.id, { roles: nextRoles.length > 0 ? nextRoles : ["visitor"] });
                    await loadAll();
                  }}
                >
                  {user.roles.includes("admin") ? "撤销管理员身份" : "授予管理员身份"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    const nextRoles = getNextRoles(user.roles, "bot");
                    await updateAdminUserClient(user.id, { roles: nextRoles.length > 0 ? nextRoles : ["visitor"] });
                    await loadAll();
                  }}
                >
                  {user.roles.includes("bot") ? "撤销机器人身份" : "授予机器人身份"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    await updateAdminUserClient(user.id, { roles: getNextRoles(user.roles, "visitor") });
                    await loadAll();
                  }}
                >
                  仅保留访客身份
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    const nextStatus = user.status === "active" ? "suspended" : "active";
                    await updateAdminUserClient(user.id, { status: nextStatus });
                    await loadAll();
                  }}
                >
                  {user.status === "active" ? "停用账号" : "恢复账号"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
