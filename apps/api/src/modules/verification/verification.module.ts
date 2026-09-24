import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CreditsModule } from "../credits/credits.module.js";
import {
  VerificationController,
  VerificationWebhookController,
} from "./verification.controller.js";
import { VerificationService } from "./verification.service.js";
import { SumsubProvider } from "./sumsub.provider.js";

@Module({
  imports: [AuthModule, CreditsModule],
  controllers: [VerificationController, VerificationWebhookController],
  providers: [VerificationService, SumsubProvider],
  exports: [VerificationService],
})
export class VerificationModule {}
