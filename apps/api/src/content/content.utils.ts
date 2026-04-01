import { BadRequestException } from "@nestjs/common";
import { IdentityTerm } from "@prisma/client";

/**
 * 从未知数组中过滤出非空字符串数组。
 *
 * 输入：
 * - `value`: 原始数组，通常来自 DTO / proposal payload。
 *
 * 输出：
 * - 仅包含去除空串判断后的字符串数组。
 *
 * 控制逻辑：
 * - 不做 trim 后写回，只负责过滤非法项。
 * - 常用于批量关系 ID、枚举字符串列表的预处理。
 */
export function toStringArray(value: unknown[]) {
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/**
 * 将未知值安全转换为字符串数组，非数组直接回退为空数组。
 *
 * 输入：
 * - `value`: 可能是 `string[]`、`unknown[]` 或其他类型。
 *
 * 输出：
 * - 仅包含非空字符串的数组。
 */
export function toStringArrayOrEmpty(value: unknown) {
  return Array.isArray(value) ? toStringArray(value) : [];
}

/**
 * 规范化路由层传入的 slug。
 *
 * 输入：
 * - `slug`: 用户输入或 URL 参数中的 slug。
 *
 * 输出：
 * - 若含有 URL 编码，则解码后的 slug；否则返回原始去空白结果。
 *
 * 控制逻辑：
 * - 只处理路径片段层面的 `%xx` 编码。
 * - 避免详情查询时出现“编码 slug”和“原始 slug”不一致。
 */
export function normalizeSlugInput(slug: string) {
  const trimmed = slug.trim();
  return /%[0-9A-Fa-f]{2}/.test(trimmed) ? decodeURIComponent(trimmed) : trimmed;
}

/**
 * 将未知值转换为“非空字符串或 null”。
 *
 * 输入：
 * - `value`: 任意未知值。
 *
 * 输出：
 * - 非空字符串返回 `trim()` 后的值；其余情况返回 `null`。
 *
 * 控制逻辑：
 * - 这是内容仓储里最常用的兜底标准化函数。
 * - 用于把表单空串收敛成数据库友好的 `null`。
 */
export function toNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * 将未知值转换为整数或 null。
 *
 * 输入：
 * - `value`: number / string / unknown。
 *
 * 输出：
 * - 合法整数返回 `number`，否则返回 `null`。
 *
 * 控制逻辑：
 * - 数字输入会被截断为整数。
 * - 字符串输入会使用十进制解析。
 */
export function toNullableInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * 将未知值转换为十进制数值或 null。
 *
 * 输入：
 * - `value`: number / string / unknown。
 *
 * 输出：
 * - 合法浮点数返回 `number`，否则返回 `null`。
 *
 * 控制逻辑：
 * - 用于经纬度等需要保留小数的字段。
 */
export function toNullableDecimal(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * 将未知值转换为 `Date | null`。
 *
 * 输入：
 * - `value`: 预期为 ISO 日期字符串。
 *
 * 输出：
 * - 合法日期返回 `Date`，空值或非法值返回 `null`。
 *
 * 控制逻辑：
 * - 这是宽松转换函数，不抛异常。
 * - 适用于结构化行编辑器中的可选日期字段。
 */
export function toNullableDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 在创建流程中解析日期字段。
 *
 * 输入：
 * - `value`: 原始日期值。
 * - `field`: 出错时写入错误消息的字段名。
 * - `required`: 是否必须提供。
 *
 * 输出：
 * - 返回 `Date | null`。
 *
 * 控制逻辑：
 * - 创建时对非法日期直接抛 `BadRequestException`。
 * - 必填字段缺失时也会立即抛错。
 */
export function parseDateForCreate(value: unknown, field: string, required = false) {
  if (typeof value !== "string") {
    if (required) {
      throw new BadRequestException(`${field} is required`);
    }
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (required) {
      throw new BadRequestException(`${field} is required`);
    }
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} is invalid date`);
  }
  return parsed;
}

/**
 * 在更新流程中解析日期字段。
 *
 * 输入：
 * - `value`: 原始日期值，可为 `undefined/null/string`。
 * - `field`: 仅用于保持和 create 侧一致的语义。
 *
 * 输出：
 * - `undefined`: 表示不更新该字段。
 * - `null`: 表示显式清空该字段。
 * - `Date`: 表示写入新日期。
 *
 * 控制逻辑：
 * - 更新时采用宽松策略，不对非法格式抛错，而是返回 `undefined`。
 */
export function parseDateForUpdate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

/**
 * 从未知值中提取对象数组。
 *
 * 输入：
 * - `value`: 任意未知值。
 *
 * 输出：
 * - 仅保留 `Record<string, unknown>` 的数组。
 *
 * 控制逻辑：
 * - 常用于解析 `programDetailed`、`personIdentities` 等结构化行编辑器数据。
 */
export function toObjectArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

/**
 * 将中英文身份标签归一化为 Prisma `IdentityTerm` 枚举。
 *
 * 输入：
 * - `value`: 可能是英文枚举值，也可能是中文展示文案。
 *
 * 输出：
 * - 匹配到的 `IdentityTerm`，否则返回 `null`。
 *
 * 控制逻辑：
 * - 兼容老测试和历史 payload 中的中文身份字符串。
 */
export function toIdentityTerm(value: unknown): IdentityTerm | null {
  const normalized = toNullableString(value);
  if (!normalized) {
    return null;
  }

  const labelMap: Record<string, IdentityTerm> = {
    actor: IdentityTerm.actor,
    演员: IdentityTerm.actor,
    teacher: IdentityTerm.teacher,
    教师: IdentityTerm.teacher,
    director: IdentityTerm.director,
    导演: IdentityTerm.director,
    writer: IdentityTerm.writer,
    编剧: IdentityTerm.writer,
    researcher: IdentityTerm.researcher,
    研究者: IdentityTerm.researcher,
    promoter: IdentityTerm.promoter,
    推广者: IdentityTerm.promoter
  };

  return labelMap[normalized] ?? null;
}

/**
 * 解析人物身份履历行数据。
 *
 * 输入：
 * - `items`: 原始对象数组。
 *
 * 输出：
 * - 仅保留 `identityTerm` 合法的结构化身份数组。
 *
 * 控制逻辑：
 * - 起止时间采用宽松日期解析。
 * - 无效身份行会被静默过滤。
 */
export function toPersonIdentities(items: Record<string, unknown>[]) {
  return items
    .map((item) => ({
      identityTerm: toIdentityTerm(item.identityTerm),
      startDate: toNullableDate(item.startDate),
      endDate: toNullableDate(item.endDate)
    }))
    .filter(
      (item): item is { identityTerm: IdentityTerm; startDate: Date | null; endDate: Date | null } => Boolean(item.identityTerm)
    );
}

/**
 * 解析人物-院团履历行数据。
 *
 * 输入：
 * - `items`: 原始对象数组。
 *
 * 输出：
 * - 仅保留存在 `troupeEntityId` 的履历数组。
 *
 * 控制逻辑：
 * - 缺省 `membershipRole` 会自动回退到“成员”。
 */
export function toTroupeMemberships(items: Record<string, unknown>[]) {
  return items
    .map((item) => ({
      troupeEntityId: toNullableString(item.troupeEntityId),
      membershipRole: toNullableString(item.membershipRole) ?? "成员",
      startDate: toNullableDate(item.startDate),
      endDate: toNullableDate(item.endDate),
      isCurrent: typeof item.isCurrent === "boolean" ? item.isCurrent : false
    }))
    .filter(
      (item): item is {
        troupeEntityId: string;
        membershipRole: string;
        startDate: Date | null;
        endDate: Date | null;
        isCurrent: boolean;
      } => Boolean(item.troupeEntityId)
    );
}

/**
 * 解析节目单中的演员表数据。
 *
 * 输入：
 * - `value`: 原始 cast 数组。
 *
 * 输出：
 * - 规范化后的 cast 数组。
 *
 * 控制逻辑：
 * - 强制要求 `roleEntityId` / `personEntityId` 至少存在一个。
 * - 若不满足要求，直接抛 `BadRequestException`。
 */
export function toPerformanceCasts(value: unknown) {
  return toObjectArray(value).map((item) => {
    const roleEntityId = toNullableString(item.roleEntityId);
    const personEntityId = toNullableString(item.personEntityId);
    const castNote = toNullableString(item.castNote);
    if (!roleEntityId && !personEntityId) {
      throw new BadRequestException("演员表记录至少需要选择角色或人物其中之一。");
    }
    return {
      roleEntityId,
      personEntityId,
      castNote
    };
  });
}

/**
 * 解析节目单行数据，必要时可回退到简化剧目列表。
 *
 * 输入：
 * - `items`: 原始详细节目单数组。
 * - `fallback`: 当没有详细节目单时的简化回退剧目列表。
 *
 * 输出：
 * - 可直接用于写入 `EventProgramItem` 的标准化对象数组。
 *
 * 控制逻辑：
 * - 若详细节目单为空，则根据 fallback 构造顺序化的节目单。
 * - 若行内既没有剧目也没有标题覆盖，则过滤掉该行。
 */
export function toEventProgramItems(
  items: Record<string, unknown>[],
  fallback?: { fallbackWorkIds?: string[]; fallbackExcerptIds?: string[] }
) {
  if (items.length === 0) {
    const workIds = fallback?.fallbackWorkIds ?? [];
    const excerptIds = fallback?.fallbackExcerptIds ?? [];
    return [...workIds, ...excerptIds].map((workEntityId, index) => ({
      workEntityId,
      titleOverride: null,
      sequenceNo: index + 1,
      durationMinutes: null,
      notes: null,
      casts: []
    }));
  }
  return items
    .map((item, index) => ({
      workEntityId: toNullableString(item.workEntityId),
      titleOverride: toNullableString(item.titleOverride),
      sequenceNo: toNullableInt(item.sequenceNo) ?? index + 1,
      durationMinutes: toNullableInt(item.durationMinutes),
      notes: toNullableString(item.notes),
      casts: item.casts
    }))
    .filter((item) => item.workEntityId || item.titleOverride);
}

/**
 * 粗略去除 Markdown 标记，生成纯文本。
 *
 * 输入：
 * - `value`: Markdown 字符串。
 *
 * 输出：
 * - 简化后的纯文本字符串。
 *
 * 控制逻辑：
 * - 主要服务于摘要生成和搜索辅助，不追求完整 Markdown 语义。
 */
export function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/[#*_~>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 生成固定长度的纯文本摘要。
 *
 * 输入：
 * - `value`: 原始 Markdown 正文。
 * - `limit`: 最大摘要长度。
 *
 * 输出：
 * - 截断后的纯文本摘要。
 *
 * 控制逻辑：
 * - 先调用 `stripMarkdown` 做文本净化。
 * - 长度超限时追加 `...`。
 */
export function excerptText(value: string, limit = 120) {
  const plain = stripMarkdown(value);
  if (plain.length <= limit) {
    return plain || "待补充";
  }
  return `${plain.slice(0, limit).trim()}...`;
}
