import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { MfaService } from "./mfa.service.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { CryptoModule } from "../../common/crypto/crypto.module.js";

@Module({
  imports: [
    CryptoModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("jwt.secret"),
        signOptions: { expiresIn: config.get<string>("jwt.accessTtl") ?? "15m" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MfaService, JwtStrategy],
  exports: [AuthService, MfaService],
})
export class AuthModule {}
