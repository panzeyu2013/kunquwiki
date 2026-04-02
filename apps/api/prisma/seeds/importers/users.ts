import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { SeedUser } from "../types";

export async function importUsers(prisma: PrismaClient, users: SeedUser[]) {
  const userByUsername = new Map<string, string>();
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password ?? "Kunquwiki123!", 10);
    const created = await prisma.user.create({
      data: {
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        passwordHash,
        roles: user.roles,
        status: user.status ?? undefined
      }
    });
    userByUsername.set(user.username, created.id);
  }
  return userByUsername;
}
