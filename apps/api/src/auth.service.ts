import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma, User, UserRole, UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { LoginDto, RegisterDto, UpdateUserAccessDto } from "./dto";
import { PrismaService } from "./prisma.service";

type TokenPayload = {
  sub: string;
  username: string;
  roles: UserRole[];
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDto) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          email: input.email,
          passwordHash,
          roles: [UserRole.editor]
        }
      });

      return this.buildAuthResponse(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Username or email already exists");
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: input.identifier }, { username: input.identifier }]
      }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException("Account is not active");
    }

    return this.buildAuthResponse(user);
  }

  verifyToken(authorization?: string) {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    const token = authorization.slice("Bearer ".length);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException("JWT secret is not configured");
    }

    return jwt.verify(token, secret) as TokenPayload;
  }

  async getCurrentUser(authorization?: string) {
    const payload = this.verifyToken(authorization);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        roles: true,
        status: true,
        reputation: true
      }
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException("Account is not active");
    }

    return user;
  }

  assertReviewerRole(payload: TokenPayload) {
    if (!this.hasRole(payload, UserRole.reviewer) && !this.hasRole(payload, UserRole.admin)) {
      throw new UnauthorizedException("Reviewer role required");
    }
  }

  assertEditorRole(payload: TokenPayload) {
    if (!this.hasRole(payload, UserRole.editor) && !this.hasRole(payload, UserRole.admin)) {
      throw new UnauthorizedException("Editor role required");
    }
  }

  assertAutomationRole(payload: TokenPayload) {
    if (
      !this.hasRole(payload, "bot" as UserRole) &&
      !this.hasRole(payload, UserRole.editor) &&
      !this.hasRole(payload, UserRole.admin)
    ) {
      throw new UnauthorizedException("Bot, editor, or admin role required");
    }
  }

  assertAdminRole(payload: TokenPayload) {
    if (!this.hasRole(payload, UserRole.admin)) {
      throw new UnauthorizedException("Admin role required");
    }
  }

  hasRole(payload: Pick<TokenPayload, "roles">, role: UserRole) {
    return payload.roles.includes(role);
  }

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        roles: true,
        status: true,
        reputation: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async updateUserAccess(userId: string, input: UpdateUserAccessDto, actorId: string) {
    const normalizedRoles = input.roles ? this.normalizeRoles(input.roles) : undefined;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(normalizedRoles ? { roles: normalizedRoles } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(typeof input.reputation === "number" ? { reputation: input.reputation } : {})
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        roles: true,
        status: true,
        reputation: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actionType: "user.access.update",
        targetType: "user",
        targetId: updated.id,
        payloadJson: {
          ...input,
          ...(normalizedRoles ? { roles: normalizedRoles } : {})
        } as Prisma.InputJsonValue
      }
    });

    return updated;
  }

  private buildAuthResponse(user: User) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException("JWT secret is not configured");
    }

    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        roles: this.normalizeRoles(user.roles)
      } satisfies TokenPayload,
      secret,
      { expiresIn: "7d" }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roles: this.normalizeRoles(user.roles)
      }
    };
  }

  private normalizeRoles(roles: UserRole[]) {
    const unique = [...new Set(roles)];
    if (unique.includes(UserRole.visitor)) {
      return [UserRole.visitor];
    }
    return unique;
  }
}
