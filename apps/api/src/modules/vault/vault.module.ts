import { Module } from "@nestjs/common";
import { VaultController } from "./vault.controller.js";
import { VaultService } from "./vault.service.js";
import { CryptoModule } from "../../common/crypto/crypto.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { CountriesModule } from "../countries/countries.module.js";

@Module({
  imports: [CryptoModule, AuthModule, CountriesModule],
  controllers: [VaultController],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
