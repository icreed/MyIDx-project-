import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { configuration, validateEnv } from "./config/configuration.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { CryptoModule } from "./common/crypto/crypto.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { VaultModule } from "./modules/vault/vault.module.js";
import { MerchantsModule } from "./modules/merchants/merchants.module.js";
import { OAuthModule } from "./modules/oauth/oauth.module.js";
import { VerificationModule } from "./modules/verification/verification.module.js";
import { CreditsModule } from "./modules/credits/credits.module.js";
import { CountriesModule } from "./modules/countries/countries.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    // Blanket rate limit; sensitive routes tighten this with their own @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    CryptoModule,
    HealthModule,
    AuthModule,
    UsersModule,
    VaultModule,
    MerchantsModule,
    OAuthModule,
    VerificationModule,
    CreditsModule,
    CountriesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
