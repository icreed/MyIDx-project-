import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { IdDocumentType, VerificationScope } from "@prisma/client";
import { VerificationService } from "./verification.service.js";
import { SumsubProvider } from "./sumsub.provider.js";

@ApiTags("verifications")
@Controller({ path: "verifications", version: "1" })
export class VerificationController {
  constructor(
    private readonly verification: VerificationService,
    private readonly sumsub: SumsubProvider,
  ) {}

  @Post()
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  start(
    @Req() req: { user: { id: string; actor: "USER" | "MERCHANT" } },
    @Body() body: { scope: VerificationScope; countryCode: string; documentType?: IdDocumentType },
  ) {
    return this.verification.start({
      scope: body.scope,
      countryCode: body.countryCode,
      documentType: body.documentType,
      userId: req.user.actor === "USER" ? req.user.id : undefined,
      merchantId: req.user.actor === "MERCHANT" ? req.user.id : undefined,
    });
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  get(@Param("id") id: string) {
    return this.verification.getRun(id);
  }
}

/**
 * Webhooks live on an unversioned path because the provider configuration points
 * at a fixed URL. Authenticity rests entirely on the HMAC signature.
 */
@ApiTags("webhooks")
@Controller({ path: "webhooks", version: VERSION_NEUTRAL })
export class VerificationWebhookController {
  constructor(
    private readonly verification: VerificationService,
    private readonly sumsub: SumsubProvider,
  ) {}

  @Post("sumsub")
  async sumsubWebhook(
    @Req() req: RawBodyRequest<{ body: unknown }>,
    @Headers("x-payload-digest") signature: string | undefined,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!this.sumsub.verifyWebhookSignature(raw, signature)) {
      throw new ForbiddenException("invalid webhook signature");
    }
    return this.verification.applyWebhook(
      req.body as { applicantId: string; reviewStatus?: string },
    );
  }
}
