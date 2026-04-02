# API 脚本说明

这个目录存放解析与调试用的小工具脚本。

## 1. 抓取链接 HTML

使用 Playwright 渲染页面后保存 HTML 到本地（已内置微信移动端 UA）：

```bash
node --import tsx apps/api/scripts/capture-link-html.ts "<url>" "<outputPath>"
```

示例：

```bash
node --import tsx apps/api/scripts/capture-link-html.ts "https://mp.weixin.qq.com/s/xxxx" "apps/api/test/fixtures/wechat-example.html"
```

## 2. 预览解析结果

对保存的 HTML 夹具运行解析器，并输出 JSON 结果：

```bash
node --import tsx apps/api/scripts/preview-parse-fixture.ts "<fixturePath>" "<url>"
```

示例：

```bash
node --import tsx apps/api/scripts/preview-parse-fixture.ts "apps/api/test/fixtures/wechat-example.html" "https://mp.weixin.qq.com/s/xxxx"
```

备注：
- 如果 Playwright 报错，请先执行一次：
  `npx playwright install chromium`
