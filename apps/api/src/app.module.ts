import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { BotController } from "./bot.controller";
import { BotService } from "./bot.service";
import { ContentRepository } from "./content.repository";
import { PrismaService } from "./prisma.service";
import { SearchIndexService } from "./search-index.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController, AuthController, BotController],
  providers: [AppService, AuthService, BotService, PrismaService, SearchIndexService, ContentRepository]
})
export class AppModule {}
