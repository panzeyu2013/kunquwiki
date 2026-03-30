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
      <section className="detail-panel editor-panel compact-user-panel">
        <div className="editor-list-head compact-head">
          <div>
            <h2>用户权限管理</h2>
            <p>统一调整账号身份、状态与基础权限。</p>
          </div>

          <div className="toolbar">
            <input className="search-input" placeholder="搜索用户名 / 邮箱" />
            <select className="filter-select">
              <option>全部状态</option>
              <option>正常</option>
              <option>停用</option>
            </select>
            <select className="filter-select">
              <option>全部身份</option>
              <option>访客</option>
              <option>审核</option>
              <option>编辑</option>
              <option>管理员</option>
              <option>机器人</option>
            </select>
            <span className="pill strong">{users.length} 人</span>
          </div>
        </div>

        <div className="user-table">
          <div className="user-table-head">
            <span>状态</span>
            <span>用户</span>
            <span>邮箱</span>
            <span>身份</span>
            <span>信誉</span>
            <span>操作</span>
          </div>

          {users.map((user) => (
            <div key={user.id} className="user-table-row">
              <div className="cell">
                <span className={`status-tag ${user.status}`}>
                  {mapUserStatusLabel(user.status)}
                </span>
              </div>

              <div className="cell user-cell">
                <strong>{user.displayName}</strong>
                <span>@{user.username}</span>
              </div>

              <div className="cell email-cell">{user.email}</div>

              <div className="cell role-cell">
                {user.roles.map((role) => (
                  <span key={role} className="role-tag">
                    {mapUserRoleLabel(role)}
                  </span>
                ))}
              </div>

              <div className="cell reputation-cell">{user.reputation}</div>

              <div className="cell actions-cell">
                <button
                  type="button"
                  className={`mini-button ${user.roles.includes("reviewer") ? "active" : ""}`}
                  onClick={async () => {
                    const nextRoles = getNextRoles(user.roles, "reviewer");
                    await updateAdminUserClient(user.id, {
                      roles: nextRoles.length > 0 ? nextRoles : ["visitor"],
                    });
                    await loadAll();
                  }}
                >
                  审核
                </button>

                <button
                  type="button"
                  className={`mini-button ${user.roles.includes("editor") ? "active" : ""}`}
                  onClick={async () => {
                    const nextRoles = getNextRoles(user.roles, "editor");
                    await updateAdminUserClient(user.id, {
                      roles: nextRoles.length > 0 ? nextRoles : ["visitor"],
                    });
                    await loadAll();
                  }}
                >
                  编辑
                </button>

                <button
                  type="button"
                  className={`mini-button danger ${user.status !== "active" ? "active" : ""}`}
                  onClick={async () => {
                    const nextStatus = user.status === "active" ? "suspended" : "active";
                    await updateAdminUserClient(user.id, { status: nextStatus });
                    await loadAll();
                  }}
                >
                  {user.status === "active" ? "停用" : "恢复"}
                </button>

                <details className="more-actions">
                  <summary>更多</summary>
                  <div className="dropdown-menu">
                    <button
                      type="button"
                      onClick={async () => {
                        const nextRoles = getNextRoles(user.roles, "admin");
                        await updateAdminUserClient(user.id, {
                          roles: nextRoles.length > 0 ? nextRoles : ["visitor"],
                        });
                        await loadAll();
                      }}
                    >
                      {user.roles.includes("admin") ? "撤销管理员" : "授予管理员"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const nextRoles = getNextRoles(user.roles, "bot");
                        await updateAdminUserClient(user.id, {
                          roles: nextRoles.length > 0 ? nextRoles : ["visitor"],
                        });
                        await loadAll();
                      }}
                    >
                      {user.roles.includes("bot") ? "撤销机器人" : "授予机器人"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await updateAdminUserClient(user.id, {
                          roles: getNextRoles(user.roles, "visitor"),
                        });
                        await loadAll();
                      }}
                    >
                      仅保留访客
                    </button>
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
