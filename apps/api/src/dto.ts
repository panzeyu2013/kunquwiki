import { Type } from "class-transformer";
import { EntityType, UserRole, UserStatus } from "@prisma/client";
import { IsArray, IsEmail, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MinLength } from "class-validator";

const USER_ROLE_VALUES = ["visitor", "bot", "editor", "reviewer", "admin"] as const;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  proposalType!: string;

  @IsOptional()
  @IsString()
  editSummary!: string;

  @IsObject()
  @Type(() => Object)
  payload!: Record<string, unknown>;
}

export class ReviewProposalDto {
  @IsIn(["approved", "rejected"])
  decision!: "approved" | "rejected";

  @IsOptional()
  @IsString()
  reviewComment?: string;
}

export class UpdateUserAccessDto {
  @IsOptional()
  @IsArray()
  @IsIn(USER_ROLE_VALUES, { each: true })
  roles?: UserRole[];

  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reputation?: number;
}

export class QuickCreateEntityDto {
  @IsIn([EntityType.city, EntityType.troupe, EntityType.venue, EntityType.work, EntityType.person, EntityType.article, EntityType.event, EntityType.role])
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
