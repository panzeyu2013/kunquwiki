import { Type } from "class-transformer";
import { EntityType } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

const ENTITY_TYPE_VALUES = [
  EntityType.city,
  EntityType.troupe,
  EntityType.venue,
  EntityType.work,
  EntityType.person,
  EntityType.article,
  EntityType.event,
  EntityType.role
] as const;

const CHECK_TYPE_VALUES = ["schema", "business"] as const;

export class BotImportItemDto {
  @IsOptional()
  @IsString()
  externalId?: string;

  @IsIn(ENTITY_TYPE_VALUES)
  entityType!: EntityType;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  workType?: string;

  @IsOptional()
  @IsString()
  parentWorkId?: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  initialData?: Record<string, unknown>;
}

export class BotImportOptionsDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  dryRun?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  upsert?: boolean;
}

export class BotImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BotImportItemDto)
  items!: BotImportItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BotImportOptionsDto)
  options?: BotImportOptionsDto;
}

export class BotCheckDto {
  @IsIn(CHECK_TYPE_VALUES)
  checkType!: (typeof CHECK_TYPE_VALUES)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BotImportItemDto)
  items?: BotImportItemDto[];
}

export type BotCheckType = (typeof CHECK_TYPE_VALUES)[number];
