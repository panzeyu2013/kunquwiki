import { BadRequestException } from "@nestjs/common";
import { isProbablyReaderable, Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { JSDOM } from "jsdom";
import { promises as dns } from "node:dns";
import net from "node:net";
import { chromium } from "playwright";

const DEFAULT_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

export type ParsedEventDraft = {
  sourceUrl: string;
  title?: string;
  bodyMarkdown?: string;
  startAt?: string;
  endAt?: string;
  cityName?: string;
  venueName?: string;
  troupeNames?: string[];
  programTitles?: string[];
  ticketUrl?: string;
  noteText?: string;
  posterImageUrl?: string;
};

type JsonLdEvent = {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: { name?: string; address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } } | string;
  image?: string | string[];
  performer?: Array<{ name?: string }> | { name?: string } | string;
  organizer?: { name?: string } | string;
  offers?: { url?: string } | Array<{ url?: string }>;
};

// Testing/diagnostics helper: parse raw HTML without fetching.
export function parseEventHtmlForTesting(html: string, url: string) {
  return extractFromHtml(html, url);
}

export async function fetchHtmlForParsing(url: string) {
  const normalizedUrl = await assertSafeUrl(url);

  const html = await fetchHtml(normalizedUrl);
  const readabilityResult = extractReadableContent(html, normalizedUrl);

  let parsed = extractFromHtml(html, normalizedUrl, readabilityResult);

  if (shouldFallbackToBrowser(html, parsed, normalizedUrl)) {
    const browserHtml = await fetchHtmlWithPlaywright(normalizedUrl);
    const browserReadable = extractReadableContent(browserHtml, normalizedUrl);
    parsed = extractFromHtml(browserHtml, normalizedUrl, browserReadable);
    const cleanTextForAI = extractCleanTextForAI(browserHtml, normalizedUrl, {
      readabilityText: browserReadable.text,
      wechatBodyMarkdown: parsed.bodyMarkdown
    });
    return { html: browserHtml, normalizedUrl, parsed, cleanTextForAI };
  }
  const cleanTextForAI = extractCleanTextForAI(html, normalizedUrl, {
    readabilityText: readabilityResult.text,
    wechatBodyMarkdown: parsed.bodyMarkdown
  });
  return { html, normalizedUrl, parsed, cleanTextForAI };
}

export function extractCleanTextForAI(
  html: string,
  url: string,
  options?: { readabilityText?: string | null; wechatBodyMarkdown?: string }
) {
  const $ = cheerio.load(html);
  if (url.includes("mp.weixin.qq.com") && $("#js_content").length > 0) {
    if (options?.wechatBodyMarkdown && options.wechatBodyMarkdown.trim().length > 0) {
      return options.wechatBodyMarkdown;
    }
    return cleanWeChatBody($("#js_content").html() ?? "");
  }
  const readabilityText = options?.readabilityText ?? extractReadableContent(html, url).text;
  if (readabilityText && readabilityText.trim().length > 0) {
    return readabilityText;
  }
  const fallback = $("body").text().trim();
  return fallback;
}

async function assertSafeUrl(input: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new BadRequestException("无效的链接格式");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BadRequestException("仅支持 http/https 链接");
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestException("链接格式不允许包含账号信息");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new BadRequestException("不允许使用本地地址");
  }

  const ip = await resolveHostIp(hostname);
  if (ip && isPrivateIp(ip)) {
    throw new BadRequestException("不允许访问内网地址");
  }

  return parsed.toString();
}

async function resolveHostIp(hostname: string): Promise<string | null> {
  if (net.isIP(hostname)) {
    return hostname;
  }
  try {
    const result = await dns.lookup(hostname);
    return result.address;
  } catch {
    return null;
  }
}

function isPrivateIp(ip: string) {
  if (net.isIP(ip) === 4) {
    const parts = ip.split(".").map((item) => Number.parseInt(item, 10));
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }

  return false;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "kunquwiki-parser/1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new BadRequestException(`无法获取页面内容（${response.status}）`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_HTML_BYTES) {
      throw new BadRequestException("页面内容过大，无法解析");
    }

    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new BadRequestException("页面内容过大，无法解析");
    }

    return html;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException("解析失败，无法访问该链接");
  } finally {
    clearTimeout(timeout);
  }
}

function extractFromHtml(
  html: string,
  url: string,
  readabilityResult?: ReturnType<typeof extractReadableContent>
) {
  const $ = cheerio.load(html);

  if (url.includes("mp.weixin.qq.com") && $("#js_content").length > 0) {
    return extractFromWeChat($, url);
  }

  const meta = extractMeta($);
  const jsonLd = extractJsonLd($);
  const jsonLdEvent = extractEventFromJsonLd(jsonLd);

  const readability = readabilityResult ?? extractReadableContent(html, url);
  const bodyText = readability.text ?? "";

  const fromText = extractEventFieldsFromText(bodyText);
  const fromLinks = extractTicketLink($, url);

  const title = firstNonEmpty(
    jsonLdEvent?.name,
    meta.ogTitle,
    meta.twitterTitle,
    readability.title,
    meta.title
  );

  const description = firstNonEmpty(
    jsonLdEvent?.description,
    meta.ogDescription,
    meta.twitterDescription,
    meta.description
  );

  const bodyMarkdown = normalizeMarkdownBody(firstNonEmpty(readability.text, description));

  const startAt = firstNonEmpty(jsonLdEvent?.startDate, fromText.startAt);
  const endAt = firstNonEmpty(jsonLdEvent?.endDate, fromText.endAt);

  const venueName = firstNonEmpty(
    typeof jsonLdEvent?.location === "string" ? jsonLdEvent?.location : jsonLdEvent?.location?.name,
    fromText.venueName
  );

  const cityName = firstNonEmpty(
    typeof jsonLdEvent?.location !== "string" ? jsonLdEvent?.location?.address?.addressLocality : undefined,
    fromText.cityName
  );

  const troupeNames = uniqueStrings(
    toStringArray(jsonLdEvent?.performer).concat(toStringArray(fromText.troupeNames))
  );

  const programTitles = uniqueStrings(fromText.programTitles ?? []);

  const ticketUrl = firstNonEmpty(
    normalizeUrlField(jsonLdEvent?.offers),
    fromLinks
  );

  const posterImageUrl = firstNonEmpty(
    normalizeImage(jsonLdEvent?.image),
    meta.ogImage,
    meta.twitterImage
  );

  const noteText = fromText.noteText;

  return {
    title: title ?? undefined,
    bodyMarkdown: bodyMarkdown ?? undefined,
    startAt: startAt ?? undefined,
    endAt: endAt ?? undefined,
    cityName: cityName ?? undefined,
    venueName: venueName ?? undefined,
    troupeNames,
    programTitles,
    ticketUrl: ticketUrl ?? undefined,
    noteText: noteText ?? undefined,
    posterImageUrl: posterImageUrl ?? undefined
  };
}

function extractFromWeChat($: cheerio.CheerioAPI, url: string) {
  const title = $("#activity-name").text().trim() || extractMeta($).ogTitle;
  const publishTime = $("#publish_time").text().trim();
  const author = $("#js_name").text().trim();
  const bodyHtml = $("#js_content").html() ?? "";

  const cleanedText = cleanWeChatBody(bodyHtml);
  const bodyMarkdown = normalizeMarkdownBody(cleanedText);

  const fromText = extractEventFieldsFromText(cleanedText);
  const fromLinks = extractTicketLink($, url);
  const meta = extractMeta($);

  const noteParts = [publishTime ? `发布时间：${publishTime}` : "", author ? `作者：${author}` : ""].filter(Boolean);
  const noteText = noteParts.length > 0 ? noteParts.join("\\n") : undefined;

  return {
    title: title ?? undefined,
    bodyMarkdown: bodyMarkdown ?? undefined,
    startAt: fromText.startAt ?? undefined,
    endAt: fromText.endAt ?? undefined,
    cityName: fromText.cityName?.trim() ?? undefined,
    venueName: fromText.venueName?.trim() ?? undefined,
    troupeNames: fromText.troupeNames,
    programTitles: fromText.programTitles,
    ticketUrl: fromLinks ?? undefined,
    noteText,
    posterImageUrl: meta.ogImage ?? undefined
  };
}

function cleanWeChatBody(html: string) {
  const $ = cheerio.load(html);
  $("script, style, iframe, noscript").remove();
  $("section").each((_index: number, el: AnyNode) => {
    const text = $(el).text().trim();
    if (!text) {
      $(el).remove();
    }
  });
  $("img").each((_index: number, el: AnyNode) => {
    const element = $(el);
    const dataSrc = element.attr("data-src");
    if (dataSrc && !element.attr("src")) {
      element.attr("src", dataSrc);
    }
  });
  const lines: string[] = [];
  $("p, li, h1, h2, h3, h4").each((_index: number, el: AnyNode) => {
    const text = $(el).text().replace(/\u00a0/g, " ").trim();
    if (text) {
      lines.push(text);
    }
  });
  return lines.join("\n\n");
}

function shouldFallbackToBrowser(html: string, parsed: ReturnType<typeof extractFromHtml>, url: string) {
  if (!html || html.trim().length < 400) {
    return true;
  }
  const blockedSignals = [
    "请在微信客户端打开",
    "为了你的安全",
    "访问过于频繁",
    "环境异常",
    "内容暂时无法查看"
  ];
  if (blockedSignals.some((signal) => html.includes(signal))) {
    return true;
  }
  if (url.includes("mp.weixin.qq.com") && isParsedEmpty(parsed)) {
    return true;
  }
  return false;
}

function isParsedEmpty(parsed: ReturnType<typeof extractFromHtml>) {
  return !parsed.title && !parsed.bodyMarkdown && !parsed.startAt && !parsed.venueName && !parsed.cityName && !parsed.ticketUrl;
}

async function fetchHtmlWithPlaywright(url: string) {
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
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1200);
    const html = await page.content();
    return html;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException("解析失败，无法使用浏览器抓取内容。");
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

function extractMeta($: cheerio.CheerioAPI) {
  const readMeta = (selector: string, attr: "content" = "content") =>
    $(selector)
      .map((_, el) => $(el).attr(attr))
      .get()
      .find(Boolean) as string | undefined;

  const ogTitle = readMeta('meta[property="og:title"], meta[name="og:title"]');
  const ogDescription = readMeta('meta[property="og:description"], meta[name="og:description"]');
  const ogImage = readMeta('meta[property="og:image"], meta[name="og:image"]');
  const twitterTitle = readMeta('meta[name="twitter:title"]');
  const twitterDescription = readMeta('meta[name="twitter:description"]');
  const twitterImage = readMeta('meta[name="twitter:image"], meta[name="twitter:image:src"]');
  const description = readMeta('meta[name="description"]');
  const title = $("title").first().text();

  return {
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    description,
    title
  };
}

function extractJsonLd($: cheerio.CheerioAPI) {
  const items: unknown[] = [];
  $("script[type='application/ld+json']").each((_index: number, el: AnyNode) => {
    const text = $(el).contents().text();
    if (!text) {
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        items.push(...parsed);
      } else if (parsed && typeof parsed === "object") {
        items.push(parsed);
      }
    } catch {
      // ignore invalid json-ld
    }
  });
  return items;
}

function extractEventFromJsonLd(items: unknown[]): JsonLdEvent | null {
  const queue: unknown[] = [...items];
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;

    if (Array.isArray(record["@graph"])) {
      queue.push(...(record["@graph"] as unknown[]));
    }

    const typeValue = record["@type"];
    const types = Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : [];
    if (types.map(String).some((value) => value.toLowerCase().includes("event"))) {
      return record as JsonLdEvent;
    }
  }
  return null;
}

function extractReadableContent(html: string, url: string) {
  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    if (!isProbablyReaderable(doc)) {
      return {
        title: doc.title,
        text: null
      };
    }
    const reader = new Readability(doc);
    const result = reader.parse();
    if (!result) {
      return {
        title: doc.title,
        text: null
      };
    }
    const text = normalizeTextFromHtml(result.content || result.textContent || "");
    return {
      title: result.title || doc.title,
      text
    };
  } catch {
    return { title: undefined, text: null };
  }
}

function normalizeTextFromHtml(html: string) {
  const $ = cheerio.load(html);
  const lines: string[] = [];
  $("p, br, li").each((_index: number, el: AnyNode) => {
    const text = $(el).text().trim();
    if (text) {
      lines.push(text);
    }
  });
  if (lines.length === 0) {
    return cheerio.load(html).text().trim();
  }
  return lines.join("\n\n");
}

export function extractEventFieldsFromText(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const timeLine = cleanFieldValue(findLineValue(lines, ["时间", "演出时间", "活动时间"]) ?? "");
  const locationLine = cleanFieldValue(findLineValue(lines, ["地点", "场馆", "剧场", "剧院", "演出地点"]) ?? "");
  const troupeLine = cleanFieldValue(findLineValue(lines, ["演出单位", "演出团体", "演出院团", "主办", "承办"]) ?? "");
  const noteLine = cleanFieldValue(findLineValue(lines, ["备注", "说明", "提示", "注意事项"]) ?? "");

  const timeParsed = parseDateRange(timeLine || text);
  const locationParsed = parseLocation(locationLine);

  return {
    startAt: timeParsed.startAt,
    endAt: timeParsed.endAt,
    venueName: locationParsed.venueName,
    cityName: locationParsed.cityName,
    troupeNames: splitNames(troupeLine),
    programTitles: extractProgramTitles(lines),
    noteText: noteLine || undefined
  };
}

function extractTicketLink($: cheerio.CheerioAPI, baseUrl: string) {
  const candidates: string[] = [];
  $("a").each((_index: number, el: AnyNode) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href");
    if (!href) {
      return;
    }
    if (/票务|购票|售票|ticket|购买/.test(text)) {
      try {
        candidates.push(new URL(href, baseUrl).toString());
      } catch {
        candidates.push(href);
      }
    }
  });
  return candidates.find(Boolean);
}

function extractProgramTitles(lines: string[]) {
  const keywords = ["节目单", "演出曲目", "演出节目", "曲目表"]; 
  const startIndex = lines.findIndex((line) => keywords.some((key) => line.includes(key)));
  if (startIndex === -1) {
    return [];
  }
  const programLines: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      break;
    }
    if (/时间|地点|票务|备注|演出单位|主办/.test(line)) {
      break;
    }
    programLines.push(line);
  }
  if (programLines.length === 0 && lines[startIndex]) {
    const inline = lines[startIndex].split(/[:：]/).slice(1).join(":").trim();
    if (inline) {
      programLines.push(inline);
    }
  }
  return programLines.flatMap((line) => line.split(/[、,，；;\s]+/).map((item) => item.trim()).filter(Boolean));
}

function findLineValue(lines: string[], labels: string[]) {
  for (const line of lines) {
    for (const label of labels) {
      const regex = new RegExp(`${label}\\s*[:：]\\s*(.+)$`);
      const match = line.match(regex);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }
  return null;
}

function parseLocation(value: string) {
  const normalized = value.replace(/[（）()]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { cityName: undefined, venueName: undefined };
  }
  const parts = normalized.split(/[\s/、-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return { cityName: parts[0], venueName: parts.slice(1).join(" ") };
  }
  return { cityName: undefined, venueName: normalized };
}

function parseDateRange(value: string) {
  if (!value) {
    return { startAt: undefined, endAt: undefined };
  }
  const dateRegex = /(\d{4})[年\-./](\d{1,2})[月\-./](\d{1,2})日?/;
  const monthDayRegex = /(\d{1,2})月(\d{1,2})日/;
  const timeRangeRegex = /(\d{1,2}:\d{2})\s*(?:[-~到至]\s*(\d{1,2}:\d{2}))?/;

  const dateMatch = value.match(dateRegex);
  const monthDayMatch = dateMatch ? null : value.match(monthDayRegex);
  const timeMatch = value.match(timeRangeRegex);

  if (!dateMatch && !monthDayMatch) {
    return { startAt: undefined, endAt: undefined };
  }

  const year = dateMatch ? Number.parseInt(dateMatch[1] ?? "", 10) : new Date().getFullYear();
  const month = dateMatch ? Number.parseInt(dateMatch[2] ?? "", 10) : Number.parseInt(monthDayMatch?.[1] ?? "", 10);
  const day = dateMatch ? Number.parseInt(dateMatch[3] ?? "", 10) : Number.parseInt(monthDayMatch?.[2] ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { startAt: undefined, endAt: undefined };
  }
  const dateLabel = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  if (!timeMatch) {
    return { startAt: new Date(`${dateLabel}T00:00`).toISOString(), endAt: undefined };
  }

  const startTime = timeMatch[1] ?? "00:00";
  const endTime = timeMatch[2];
  const startAt = new Date(`${dateLabel}T${startTime}`).toISOString();
  const endAt = endTime ? new Date(`${dateLabel}T${endTime}`).toISOString() : undefined;

  return { startAt, endAt };
}

function normalizeMarkdownBody(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function firstNonEmpty<T extends string | null | undefined>(...values: Array<T | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? undefined;
}

function toStringArray(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String((item as { name?: string }).name ?? item)).filter(Boolean);
  }
  if (typeof value === "object" && "name" in (value as Record<string, unknown>)) {
    const name = (value as { name?: string }).name;
    return name ? [String(name)] : [];
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function normalizeUrlField(offers?: JsonLdEvent["offers"]) {
  if (!offers) {
    return undefined;
  }
  if (Array.isArray(offers)) {
    return offers.map((item) => item?.url).find(Boolean);
  }
  return offers.url;
}

function normalizeImage(image?: JsonLdEvent["image"]) {
  if (!image) {
    return undefined;
  }
  if (Array.isArray(image)) {
    return image.find(Boolean);
  }
  return image;
}

function splitNames(value?: string | null) {
  if (!value) {
    return [];
  }
  return value.split(/[、,，/\s]+/).map((item) => item.trim()).filter(Boolean);
}

function uniqueStrings(values: string[]) {
  const set = new Set(values.filter(Boolean));
  return [...set];
}

function cleanFieldValue(value: string) {
  if (!value) {
    return "";
  }
  let result = value.replace(/\u00a0/g, " ").trim();
  result = result.split(/\n+/)[0]?.trim() ?? result;
  const blockers = [
    "票价",
    "票务",
    "票务热线",
    "热线",
    "演员",
    "鼓",
    "笛",
    "时间",
    "地点",
    "备注",
    "演出单位",
    "主办",
    "承办",
    "节目单"
  ];
  let cutIndex = result.length;
  for (const keyword of blockers) {
    const idx = result.indexOf(`${keyword}：`);
    if (idx > 0 && idx < cutIndex) {
      cutIndex = idx;
    }
    const idxAlt = result.indexOf(`${keyword}:`);
    if (idxAlt > 0 && idxAlt < cutIndex) {
      cutIndex = idxAlt;
    }
  }
  return result.slice(0, cutIndex).trim();
}
