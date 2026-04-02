import { PrismaClient } from "@prisma/client";
import { fetchHtmlForParsing } from "./event-link.parser";
import { parseEventWithAI } from "./event-ai.parser";
import { resolveEventEntities } from "./entity-resolver";

export type ParsePipelineResult = {
  source: "ai" | "rule" | "ai+rule_merge";
  rawText?: string | null;
  parsed: {
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
  resolved?: {
    cityId?: string;
    venueId?: string;
    troupeIds?: string[];
    programDetailed?: Array<{
      title?: string;
      workEntityId?: string;
      casts?: Array<{
        roleName?: string;
        roleEntityId?: string;
        personName?: string;
        personEntityId?: string;
      }>;
    }>;
  };
  unmatched?: {
    cityName?: string;
    venueName?: string;
    troupeNames?: string[];
    workTitles?: string[];
    roleNames?: string[];
    personNames?: string[];
  };
  warnings?: string[];
};

export async function parseEventFromLink(prisma: PrismaClient, url: string): Promise<ParsePipelineResult> {
  const { cleanTextForAI, parsed: ruleParsed } = await fetchHtmlForParsing(url);
  const cleanText = cleanTextForAI;

  return parseEventFromCleanText(prisma, cleanText, ruleParsed, cleanText);
}

// Non-frontend path: text parsing is reserved for manual/automation usage.
export async function parseEventFromText(prisma: PrismaClient, text: string, url?: string): Promise<ParsePipelineResult> {
  const cleanText = text.trim();
  return parseEventFromCleanText(prisma, cleanText, {}, cleanText);
}

async function parseEventFromCleanText(
  prisma: PrismaClient,
  cleanText: string,
  ruleParsed: Record<string, unknown>,
  fallbackBodyMarkdown: string
): Promise<ParsePipelineResult> {
  const aiOutcome = await parseEventWithAI(cleanText);
  const warnings: string[] = [];
  if (aiOutcome.errors.length > 0) {
    warnings.push(...aiOutcome.errors.map((item) => `AI 解析提示：${item}`));
  }

  let source: ParsePipelineResult["source"] = "ai";
  let parsed = aiOutcome.parsed ?? null;

  if (!parsed) {
    source = "rule";
    parsed = {
      ...ruleParsed,
      bodyMarkdown: (ruleParsed.bodyMarkdown as string | undefined) ?? fallbackBodyMarkdown
    };
  } else {
    const merged = mergeParsed(parsed, ruleParsed, fallbackBodyMarkdown);
    if (merged.didMerge) {
      source = "ai+rule_merge";
    }
    parsed = merged.result;
  }

  const resolution = await resolveEventEntities(prisma, parsed);
  if (resolution.warnings.length > 0) {
    warnings.push(...resolution.warnings);
  }

  return {
    source,
    rawText: aiOutcome.rawText ?? null,
    parsed,
    resolved: resolution.resolved,
    unmatched: resolution.unmatched,
    warnings
  };
}

/**
 合并所有解析项目，AI解析优先，无法解析的时候尝试基于HTML Rule的Fallback
 */
function mergeParsed(
  ai: NonNullable<ParsePipelineResult["parsed"]>,
  ruleParsed: Record<string, unknown>,
  fallbackText: string
) {
  const merged: ParsePipelineResult["parsed"] = { ...ai };
  let didMerge = false;

  if (!merged.bodyMarkdown) {
    merged.bodyMarkdown = (ruleParsed.bodyMarkdown as string | undefined) ?? fallbackText;
    didMerge = true;
  }

  if (!merged.ticketUrl && ruleParsed.ticketUrl) {
    merged.ticketUrl = ruleParsed.ticketUrl as string;
    didMerge = true;
  }
  if (!merged.posterImageUrl && ruleParsed.posterImageUrl) {
    merged.posterImageUrl = ruleParsed.posterImageUrl as string;
    didMerge = true;
  }
  if (!merged.noteText && ruleParsed.noteText) {
    merged.noteText = ruleParsed.noteText as string;
    didMerge = true;
  }

  return { result: merged, didMerge };
}
