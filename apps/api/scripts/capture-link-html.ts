import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const targetUrl = process.argv[2];
const outputPath = process.argv[3];

if (!targetUrl || !outputPath) {
  console.error("Usage: tsx capture-link-html.ts <url> <outputPath>");
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai"
  });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    Referer: "https://mp.weixin.qq.com/",
    "Accept-Language": "zh-CN,zh;q=0.9"
  });
  try {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1200);
    const html = await page.content();
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, html, "utf8");
    console.log(`Saved HTML to ${outputPath}`);
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
