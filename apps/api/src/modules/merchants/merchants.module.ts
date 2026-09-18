import { Module } from "@nestjs/common";
import { MerchantsController } from "./merchants.controller.js";
import { MerchantsService } from "./merchants.service.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  controllers: [MerchantsController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
