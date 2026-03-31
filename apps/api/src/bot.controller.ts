import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { BotCheckDto, BotImportDto } from "./bot.dto";
import { BotAuthGuard } from "./bot.guard";
import { BotService } from "./bot.service";

@Controller("api/bot")
@UseGuards(BotAuthGuard)
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post("import")
  importBatch(@Body() body: BotImportDto) {
    return this.botService.importBatch(body);
  }

  @Post("check")
  runCheck(@Body() body: BotCheckDto) {
    return this.botService.runCheck(body);
  }

  @Get("check/health")
  getHealth() {
    return this.botService.healthCheck();
  }
}
