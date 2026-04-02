import { createAIProvider } from "../ai/ai.factory";
import { repairJson } from "../ai/json-repair";

export type AIEventDraft = {
  title?: string;
  bodyMarkdown?: string;
  startAt?: string;
  endAt?: string;
  cityName?: string;
  venueName?: string;
  troupeNames?: string[];
  programTitles?: string[];
  programDetailed?: Array<{
    title?: string;
    sequenceNo?: number;
    casts?: Array<{
      roleName?: string;
      personName?: string;
      note?: string;
    }>;
  }>;
  ticketUrl?: string;
  posterImageUrl?: string;
  noteText?: string;
};

export type AIParseOutcome = {
  parsed: AIEventDraft | null;
  rawText: string | null;
  errors: string[];
};

type AIProgramCast = NonNullable<NonNullable<AIEventDraft["programDetailed"]>[number]["casts"]>[number];

const PROMPT_TEMPLATE = `你是演出官宣信息抽取器。\n给定正文文本，请输出 JSON。\n\n规则：\n- 严格输出 JSON\n- 不要编造，无法确认填空字符串\n- 时间只有“4月11日 14:00”则推断为今年\n- 如场馆名称包含城市前缀，可推断城市\n- 尽量提取节目单与演员表\n- 只输出 JSON，不要任何额外文本\n\n字段：\n- title\n- bodyMarkdown\n- startAt\n- endAt\n- cityName\n- venueName\n- troupeNames (数组)\n- programTitles (数组)\n- programDetailed (数组, 每项包含 title/sequenceNo/casts)\n- ticketUrl\n- posterImageUrl\n- noteText\n\nprogramDetailed 示例：\n[{\n  \"title\": \"剧目名\",\n  \"sequenceNo\": 1,\n  \"casts\": [\n    { \"roleName\": \"角色\", \"personName\": \"演员\", \"note\": \"\" }\n  ]\n}]\n`;

export async function parseEventWithAI(text: string): Promise<AIParseOutcome> {
  const provider = createAIProvider();
  if (!provider) {
    return { parsed: null, rawText: null, errors: ["AI provider not configured"] };
  }

  try {
    const response = await provider.parse({
      prompt: PROMPT_TEMPLATE,
      input: text
    });

    const rawText = response.rawText ?? "";
    const repaired = repairJson(rawText);
    if (!repaired || typeof repaired !== "object") {
      return { parsed: null, rawText, errors: ["AI JSON parse failed"] };
    }

    const parsed = normalizeAIEventDraft(repaired as Record<string, unknown>);
    return { parsed, rawText, errors: [] };
  } catch (error) {
    return {
      parsed: null,
      rawText: null,
      errors: [error instanceof Error ? error.message : "AI provider error"]
    };
  }
}

function normalizeAIEventDraft(input: Record<string, unknown>): AIEventDraft {
  return {
    title: toString(input.title),
    bodyMarkdown: toString(input.bodyMarkdown),
    startAt: toString(input.startAt),
    endAt: toString(input.endAt),
    cityName: toString(input.cityName),
    venueName: toString(input.venueName),
    troupeNames: toStringArray(input.troupeNames),
    programTitles: toStringArray(input.programTitles),
    programDetailed: toProgramDetailed(input.programDetailed),
    ticketUrl: toString(input.ticketUrl),
    posterImageUrl: toString(input.posterImageUrl),
    noteText: toString(input.noteText)
  };
}

function toString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function toProgramDetailed(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return { title: undefined, sequenceNo: undefined, casts: [] as AIProgramCast[] };
    }
    const record = item as Record<string, unknown>;
    const castsRaw = Array.isArray(record.casts) ? record.casts : [];
    const casts = castsRaw.map((cast) => {
      if (!cast || typeof cast !== "object") {
        return { roleName: undefined, personName: undefined, note: undefined };
      }
      const castRecord = cast as Record<string, unknown>;
      return {
        roleName: toString(castRecord.roleName),
        personName: toString(castRecord.personName),
        note: toString(castRecord.note)
      };
    });
    const sequenceNo =
      typeof record.sequenceNo === "number"
        ? record.sequenceNo
        : typeof record.sequenceNo === "string"
          ? Number(record.sequenceNo)
          : undefined;
    return {
      title: toString(record.title),
      sequenceNo: Number.isFinite(sequenceNo) ? sequenceNo : undefined,
      casts
    };
  });
}
