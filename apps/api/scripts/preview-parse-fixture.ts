import { readFile } from "node:fs/promises";
import { parseEventHtmlForTesting } from "../src/content/event-link.parser";

const fixturePath = process.argv[2];
const url = process.argv[3] ?? "https://mp.weixin.qq.com/s/fixture";

if (!fixturePath) {
  console.error("Usage: tsx preview-parse-fixture.ts <fixturePath> [url]");
  process.exit(1);
}

async function main() {
  const html = await readFile(fixturePath, "utf8");
  const parsed = parseEventHtmlForTesting(html, url);
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
