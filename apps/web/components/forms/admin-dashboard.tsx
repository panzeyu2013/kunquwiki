"use client";

import { useEffect, useRef, useState } from "react";
import { getAdminOverviewClient, getAdminUsersClient, updateAdminUserClient } from "../../lib/api-client";
import { mapUserRoleLabel, mapUserStatusLabel } from "../../lib/labels";

// Styles
import pillStyles from "../../styles/components/pill.module.css";
import sharedStyles from "../../styles/components/editor-shared.module.css";
import adminStyles from "../../styles/admin-page.module.css";

export function AdminDashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminOverviewClient>> | null>(null);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof getAdminUsersClient>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const initialUserOrderRef = useRef<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("all");
  const [appliedRole, setAppliedRole] = useState("all");

  function sortUsersStable(list: Awaited<ReturnType<typeof getAdminUsersClient>>) {
    if (!initialUserOrderRef.current) {
      initialUserOrderRef.current = list.map((user) => user.id);
      return list;
    }

    const order = new Map(initialUserOrderRef.current.map((id, index) => [id, index]));
    return [...list].sort((a, b) => {
      const aIndex = order.get(a.id);
      const bIndex = order.get(b.id);

      if (aIndex !== undefined && bIndex !== undefined) {
        return aIndex - bIndex;
      }

      if (aIndex !== undefined) {
        return -1;
      }

      if (bIndex !== undefined) {
        return 1;
      }

      return a.id.localeCompare(b.id);
    });
  }

  async function loadAll() {
    const [overview, userList] = await Promise.all([getAdminOverviewClient(), getAdminUsersClient()]);
    setData(overview);
    setUsers(sortUsersStable(userList));
  }

  const normalizedQuery = appliedQuery.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesQuery = normalizedQuery.length === 0
      || user.displayName.toLowerCase().includes(normalizedQuery)
      || user.username.toLowerCase().includes(normalizedQuery)
      || user.email.toLowerCase().includes(normalizedQuery);

    const matchesStatus = appliedStatus === "all" || user.status === appliedStatus;
    const matchesRole = appliedRole === "all" || user.roles.includes(appliedRole);

    return matchesQuery && matchesStatus && matchesRole;
  });

  useEffect(() => {
    loadAll()
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "加载失败");
      });
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest(`.${adminStyles.moreActions}`)) {
        return;
      }

      document.querySelectorAll<HTMLDetailsElement>(`details.${adminStyles.moreActions}[open]`).forEach((detail) => {
        detail.open = false;
      });
    }

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  if (message) {
    return <p className={sharedStyles.statusMessage}>{message}</p>;
  }

  if (!data) {
    return <p className={sharedStyles.statusMessage}>正在加载后台概览...</p>;
  }

  function getNextRoles(currentRoles: string[], role: string) {
    if (role === "visitor") {
      return ["visitor"];
    }
    const withoutVisitor = currentRoles.filter((item) => item !== "visitor");
    return withoutVisitor.includes(role) ? withoutVisitor.filter((item) => item !== role) : [...new Set([...withoutVisitor, role])];
  }

  return (
    <div className={`${sharedStyles.stack} ${adminStyles.adminShell}`}>
      <section className={adminStyles.metrics}>
        <article className={adminStyles.metricCard}>
          <span>待审核提案</span>
          <strong>{data.pendingProposals}</strong>
        </article>
        <article className={adminStyles.metricCard}>
          <span>注册用户</span>
          <strong>{data.totalUsers}</strong>
        </article>
      </section>
      <div className={sharedStyles.detailLayout}>
        <section className={`${sharedStyles.detailPanel} ${sharedStyles.editorPanel}`}>
          <div className={sharedStyles.editorListHead}>
            <div>
              <h2>最近审计日志</h2>
              <p>后台操作和权限变更会记录在这里。</p>
            </div>
          </div>
          <div className={sharedStyles.stack}>
            {data.recentAuditLogs.map((log) => (
              <div key={log.id} className={adminStyles.adminRowCard}>
                <div>
                  <strong>{log.actionType}</strong>
                  <p>{log.actor}</p>
                </div>
                <span>{log.createdAt}</span>
              </div>
            ))}
          </div>
        </section>
        <section className={`${sharedStyles.detailPanel} ${sharedStyles.editorPanel}`}>
          <div className={sharedStyles.editorListHead}>
            <div>
              <h2>最近修订</h2>
              <p>最新修订摘要与编辑者概览。</p>
            </div>
          </div>
          <div className={sharedStyles.stack}>
            {data.recentRevisions.map((revision) => (
              <div key={revision.id} className={adminStyles.adminRowCard}>
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
      <section className={`${sharedStyles.detailPanel} ${sharedStyles.editorPanel} ${adminStyles.compactUserPanel}`}>
        <div className={`${sharedStyles.editorListHead} ${adminStyles.compactHead}`}>
          <div>
            <h2>用户权限管理</h2>
            <p>统一调整账号身份、状态与基础权限。</p>
          </div>

          <div className={adminStyles.toolbar}>
            <input
              className={adminStyles.searchInput}
              placeholder="搜索用户名 / 邮箱"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select
              className={adminStyles.filterSelect}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="suspended">停用</option>
            </select>
            <select
              className={adminStyles.filterSelect}
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">全部身份</option>
              <option value="visitor">访客</option>
              <option value="reviewer">审核</option>
              <option value="editor">编辑</option>
              <option value="admin">管理员</option>
              <option value="bot">机器人</option>
            </select>
            <button
              type="button"
              className={adminStyles.miniButton}
              onClick={() => {
                setAppliedQuery(searchQuery);
                setAppliedStatus(statusFilter);
                setAppliedRole(roleFilter);
              }}
            >
              搜索
            </button>
            <span className={`${pillStyles.pill} ${pillStyles.strong}`}>{filteredUsers.length} / {users.length} 人</span>
          </div>
        </div>

        <div className={adminStyles.userTable}>
          <div className={adminStyles.userTableHead}>
            <span>状态</span>
            <span>用户</span>
            <span>邮箱</span>
            <span>身份</span>
            <span>信誉</span>
            <span>操作</span>
          </div>

          {filteredUsers.map((user) => (
            <div key={user.id} className={adminStyles.userTableRow}>
              <div className={adminStyles.cell}>
                <span
                  className={`${adminStyles.statusTag} ${
                    user.status === "active" ? adminStyles.statusTagActive : adminStyles.statusTagSuspended
                  }`}
                >
                  {mapUserStatusLabel(user.status)}
                </span>
              </div>

              <div className={`${adminStyles.cell} ${adminStyles.userCell}`}>
                <strong>{user.displayName}</strong>
                <span>@{user.username}</span>
              </div>

              <div className={`${adminStyles.cell} ${adminStyles.emailCell}`}>{user.email}</div>

              <div className={`${adminStyles.cell} ${adminStyles.roleCell}`}>
                {user.roles.map((role) => (
                  <span key={role} className={adminStyles.roleTag}>
                    {mapUserRoleLabel(role)}
                  </span>
                ))}
              </div>

              <div className={`${adminStyles.cell} ${adminStyles.reputationCell}`}>{user.reputation}</div>

              <div className={`${adminStyles.cell} ${adminStyles.actionsCell}`}>
                <button
                  type="button"
                  className={`${adminStyles.miniButton} ${user.roles.includes("reviewer") ? adminStyles.miniButtonActive : ""}`}
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
                  className={`${adminStyles.miniButton} ${user.roles.includes("editor") ? adminStyles.miniButtonActive : ""}`}
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
                  className={`${adminStyles.miniButton} ${adminStyles.miniButtonDanger} ${
                    user.status !== "active" ? adminStyles.miniButtonDangerActive : ""
                  }`}
                  onClick={async () => {
                    const nextStatus = user.status === "active" ? "suspended" : "active";
                    await updateAdminUserClient(user.id, { status: nextStatus });
                    await loadAll();
                  }}
                >
                  {user.status === "active" ? "停用" : "恢复"}
                </button>

                <details className={adminStyles.moreActions}>
                  <summary>更多</summary>
                  <div className={adminStyles.dropdownMenu}>
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
