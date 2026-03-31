import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class BotAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const enabled = process.env.BOT_API_ENABLED;
    if (!enabled || enabled.toLowerCase() !== "true") {
      throw new ForbiddenException("Bot API is disabled");
    }

    const token = this.extractToken(context);
    const expected = process.env.BOT_API_TOKEN;
    if (!expected) {
      throw new UnauthorizedException("Bot API token is not configured");
    }
    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid bot token");
    }
    return true;
  }

  private extractToken(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { headers: Record<string, string | string[] | undefined> }>();
    const headerValue = request.headers["x-bot-token"];
    if (typeof headerValue === "string" && headerValue.trim().length > 0) {
      return headerValue.trim();
    }

    const authHeader = request.headers["authorization"];
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      return authHeader.slice("Bearer ".length).trim();
    }

    return undefined;
  }
}
