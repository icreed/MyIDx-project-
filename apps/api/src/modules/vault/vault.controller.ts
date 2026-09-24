import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { IdDocumentType } from "@prisma/client";
import { VaultService } from "./vault.service.js";

@ApiTags("vault")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller({ path: "vault", version: "1" })
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  @Get("documents")
  list(@Req() req: { user: { id: string } }) {
    return this.vault.listDocuments(req.user.id);
  }

  @Post("documents")
  add(
    @Req() req: { user: { id: string } },
    @Body()
    body: {
      countryCode: string;
      type: IdDocumentType;
      number: string;
      issuedAt?: string;
      expiresAt?: string;
    },
  ) {
    return this.vault.addDocument(req.user.id, body);
  }

  /**
   * Full document number. Rate limited hard and audited — this is the most
   * sensitive read in the product.
   */
  @Post("documents/:id/reveal")
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  reveal(
    @Req() req: { user: { id: string }; headers: Record<string, string | undefined> },
    @Param("id") id: string,
  ) {
    return this.vault.revealDocument(req.user.id, id);
  }

  @Delete("documents/:id")
  remove(@Req() req: { user: { id: string } }, @Param("id") id: string) {
    return this.vault.deleteDocument(req.user.id, id);
  }

  @Post("attributes")
  setAttribute(
    @Req() req: { user: { id: string } },
    @Body() body: { key: string; value: string; sensitivity?: "PUBLIC" | "INTERNAL" | "SENSITIVE" },
  ) {
    return this.vault.setAttribute(req.user.id, body.key, body.value, body.sensitivity);
  }
}
