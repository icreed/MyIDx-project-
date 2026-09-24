import { Module } from "@nestjs/common";
import { CreditsController } from "./credits.controller.js";
import { CreditsService } from "./credits.service.js";

@Module({
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
