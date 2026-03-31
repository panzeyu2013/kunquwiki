"use client";

import { useState } from "react";
import { login, register } from "../../lib/api-client";
import ghostButtonStyles from "../../styles/components/ghost-button.module.css";
import styles from "../../styles/editor-page.module.css";
import { ActionBar } from "../action-bar";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className={styles.page}>
      <div className="editor-shell">
        <div className="editor-page-head">
          <p className="editor-kicker">Account</p>
          <h1 className="page-title">{mode === "login" ? "登录" : "注册"}</h1>
          <p className="editor-lead">进入编辑后台，提交剧目、人物、院团与演出的结构化修改。</p>
        </div>
        <div className="detail-layout editor-layout">
          <section className="detail-panel editor-panel">
            <div className="editor-section-head">
              <h2>{mode === "login" ? "账号验证" : "创建账号"}</h2>
              <p>{mode === "login" ? "使用已有账号进入编辑工作台。" : "注册后可立即返回站点继续编辑。"}</p>
            </div>
            <form
              className="edit-form editor-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setPending(true);
                setMessage(null);
                const formData = new FormData(event.currentTarget);
                try {
                  if (mode === "login") {
                    await login(String(formData.get("identifier") ?? ""), String(formData.get("password") ?? ""));
                    window.location.href = "/";
                    return;
                  } else {
                    await register({
                      username: String(formData.get("username") ?? ""),
                      displayName: String(formData.get("displayName") ?? ""),
                      email: String(formData.get("email") ?? ""),
                      password: String(formData.get("password") ?? "")
                    });
                    window.location.href = "/";
                    return;
                  }
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "请求失败");
                } finally {
                  setPending(false);
                }
              }}
            >
              <section className="form-section">
                {mode === "register" ? (
                  <>
                    <label>
                      用户名
                      <input name="username" required />
                    </label>
                    <label>
                      显示名
                      <input name="displayName" required />
                    </label>
                    <label>
                      邮箱
                      <input name="email" type="email" required />
                    </label>
                  </>
                ) : (
                  <label>
                    用户名或邮箱
                    <input name="identifier" required />
                  </label>
                )}
                <label>
                  密码
                  <input name="password" type="password" required />
                </label>
              </section>
              <ActionBar>
                <button type="submit" disabled={pending}>
                  {pending ? "提交中..." : mode === "login" ? "登录" : "注册"}
                </button>
                <button type="button" className={ghostButtonStyles.button} onClick={() => setMode(mode === "login" ? "register" : "login")}>
                  {mode === "login" ? "切换到注册" : "切换到登录"}
                </button>
              </ActionBar>
              {message ? <p className="status-message">{message}</p> : null}
            </form>
          </section>
          <aside className="detail-panel editor-panel editor-side-panel">
            <div className="editor-section-head">
              <h2>示例账号</h2>
              <p>用于快速进入不同权限身份的后台界面。</p>
            </div>
            <p>`admin` / `Kunquwiki123!`</p>
            <p>`reviewer` / `Kunquwiki123!`</p>
            <p>`editor` / `Kunquwiki123!`</p>
            <p>`visitor` / `Kunquwiki123!`</p>
            <p>`admin` 同时拥有管理员、审核、编辑三种站点身份。</p>
            <p>登录或注册成功后会自动回到首页。</p>
            <p>如果出现“无法连接到 API”，请先启动 `apps/api` 服务。</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
