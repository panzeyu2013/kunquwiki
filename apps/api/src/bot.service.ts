import { Injectable, Logger } from "@nestjs/common";
import { EntityType } from "@prisma/client";
import { BotCheckDto, BotImportDto, BotImportItemDto } from "./bot.dto";
import { AppService } from "./app.service";
import { ContentRepository } from "./content.repository";
import { PrismaService } from "./prisma.service";

type BotImportResultItem = {
  index: number;
  externalId?: string;
  entityType?: string;
  title?: string;
  success: boolean;
  message: string;
};

type BotCheckResult = {
  index: number;
  field?: string;
  message: string;
};

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private cachedBotUserId?: string;

  constructor(
    private readonly appService: AppService,
    private readonly repository: ContentRepository,
    private readonly prisma: PrismaService
  ) {}

  async importBatch(payload: BotImportDto) {
    const options = {
      dryRun: payload.options?.dryRun ?? false,
      upsert: payload.options?.upsert ?? true
    };

    this.logger.log(`Bot import started: total=${payload.items.length}, dryRun=${options.dryRun}`);

    const results: BotImportResultItem[] = [];
    const errors = this.validateItems(payload.items);
    const errorMap = new Map<number, BotCheckResult[]>();
    for (const error of errors) {
      const list = errorMap.get(error.index) ?? [];
      list.push(error);
      errorMap.set(error.index, list);
    }

    const actorId = options.dryRun ? null : await this.resolveBotUserId();

    for (const [index, item] of payload.items.entries()) {
      const validationErrors = errorMap.get(index);
      if (validationErrors && validationErrors.length > 0) {
        results.push({
          index,
          externalId: item.externalId,
          entityType: item.entityType,
          title: item.title,
          success: false,
          message: validationErrors.map((error) => error.message).join("; ")
        });
        continue;
      }

      if (options.dryRun) {
        results.push({
          index,
          externalId: item.externalId,
          entityType: item.entityType,
          title: item.title,
          success: true,
          message: "dry_run"
        });
        continue;
      }

      try {
        const shouldCheckDuplicate = item.entityType !== EntityType.event;
        const existing = shouldCheckDuplicate
          ? await this.repository.findEntityByTypeAndTitle(item.entityType, item.title.trim())
          : null;
        if (existing && !options.upsert) {
          results.push({
            index,
            externalId: item.externalId,
            entityType: item.entityType,
            title: item.title,
            success: false,
            message: "duplicate title"
          });
          continue;
        }

        const entity = await this.appService.createQuickEntity(
          {
            entityType: item.entityType,
            title: item.title,
            workType: item.workType,
            parentWorkId: item.parentWorkId,
            initialData: item.initialData
          },
          actorId!
        );

        results.push({
          index,
          externalId: item.externalId,
          entityType: item.entityType,
          title: item.title,
          success: true,
          message: existing ? "existing" : "created"
        });
        this.logger.log(`Bot import success: index=${index}, entityId=${entity.id}`);
      } catch (error) {
        results.push({
          index,
          externalId: item.externalId,
          entityType: item.entityType,
          title: item.title,
          success: false,
          message: error instanceof Error ? error.message : "unknown error"
        });
        this.logger.warn(
          `Bot import failed: index=${index}, error=${error instanceof Error ? error.message : "unknown error"}`
        );
      }
    }

    const successCount = results.filter((item) => item.success).length;
    const summary = {
      total: payload.items.length,
      successCount,
      failedCount: payload.items.length - successCount
    };

    this.logger.log(`Bot import finished: total=${summary.total}, success=${summary.successCount}, failed=${summary.failedCount}`);

    return {
      success: summary.failedCount === 0,
      summary,
      results
    };
  }

  async runCheck(payload: BotCheckDto) {
    const items = payload.items ?? [];
    const errors: BotCheckResult[] = [];
    const warnings: BotCheckResult[] = [];
    const schemaErrors = this.validateItems(items);
    errors.push(...schemaErrors);

    if (payload.checkType === "business" && items.length > 0) {
      const businessErrors = await this.validateBusinessRules(items);
      errors.push(...businessErrors.errors);
      warnings.push(...businessErrors.warnings);
    }

    return {
      success: true,
      checkType: payload.checkType,
      passed: errors.length === 0,
      errors,
      warnings,
      stats: {
        total: items.length,
        errorCount: errors.length,
        warningCount: warnings.length
      }
    };
  }

  async healthCheck() {
    const database = await this.checkDatabase();
    return {
      ok: true,
      service: "kunquwiki-api",
      database
    };
  }

  private validateItems(items: BotImportItemDto[]) {
    const errors: BotCheckResult[] = [];
    const seenKeys = new Map<string, number>();

    items.forEach((item, index) => {
      if (!item.entityType) {
        errors.push({ index, field: "entityType", message: "entityType is required" });
      }
      if (!item.title || item.title.trim().length === 0) {
        errors.push({ index, field: "title", message: "title is required" });
      }
      if (item.entityType === EntityType.work && item.workType === "excerpt" && !item.parentWorkId) {
        errors.push({ index, field: "parentWorkId", message: "parentWorkId is required for excerpt work" });
      }

      const dedupeKey = `${item.entityType}::${item.title?.trim() ?? ""}`;
      if (item.title && item.entityType) {
        const existingIndex = seenKeys.get(dedupeKey);
        if (typeof existingIndex === "number") {
          errors.push({ index, field: "title", message: `duplicate title with item ${existingIndex}` });
        } else {
          seenKeys.set(dedupeKey, index);
        }
      }
    });

    return errors;
  }

  private async validateBusinessRules(items: BotImportItemDto[]) {
    const errors: BotCheckResult[] = [];
    const warnings: BotCheckResult[] = [];

    for (const [index, item] of items.entries()) {
      if (!item.entityType || !item.title) {
        continue;
      }

      if (item.entityType !== EntityType.event) {
        const existing = await this.repository.findEntityByTypeAndTitle(item.entityType, item.title.trim());
        if (existing) {
          warnings.push({ index, field: "title", message: "entity with same title already exists" });
        }
      }

      const idFields = this.collectReferenceIds(item);
      if (idFields.length > 0) {
        const missing = await this.findMissingEntities(idFields);
        for (const missingId of missing) {
          errors.push({ index, field: "initialData", message: `related entity not found: ${missingId}` });
        }
      }
    }

    return { errors, warnings };
  }

  private collectReferenceIds(item: BotImportItemDto) {
    const initialData = item.initialData ?? {};
    const ids: string[] = [];
    const pick = (value: unknown) => {
      if (typeof value === "string" && value.trim().length > 0) {
        ids.push(value.trim());
      }
    };

    pick(item.parentWorkId);
    pick((initialData as { cityId?: unknown }).cityId);
    pick((initialData as { venueEntityId?: unknown }).venueEntityId);
    pick((initialData as { troupeId?: unknown }).troupeId);
    pick((initialData as { workEntityId?: unknown }).workEntityId);
    pick((initialData as { birthCityId?: unknown }).birthCityId);
    pick((initialData as { posterImageId?: unknown }).posterImageId);

    const troupeIds = (initialData as { troupeIds?: unknown }).troupeIds;
    if (Array.isArray(troupeIds)) {
      for (const id of troupeIds) {
        pick(id);
      }
    }

    return ids;
  }

  private async findMissingEntities(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(ids)];
    const existing = await this.prisma.entity.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((item) => item.id));
    return uniqueIds.filter((id) => !existingIds.has(id));
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "unknown error" };
    }
  }

  private async resolveBotUserId() {
    if (this.cachedBotUserId) {
      return this.cachedBotUserId;
    }

    const actorId = process.env.BOT_ACTOR_ID;
    if (actorId) {
      this.cachedBotUserId = actorId;
      return actorId;
    }

    const username = process.env.BOT_ACTOR_USERNAME ?? "bot";
    const user = await this.prisma.user.findFirst({
      where: { username },
      select: { id: true }
    });

    if (!user) {
      throw new Error(`Bot actor user not found: ${username}`);
    }

    this.cachedBotUserId = user.id;
    return user.id;
  }
}
