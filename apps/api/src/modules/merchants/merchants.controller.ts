import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ApiOperation } from "@nestjs/swagger";
import { MerchantsService } from "./merchants.service.js";

@ApiTags("merchants")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller({ path: "merchants", version: "1" })
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get("me")
  me(@Req() req: { user: { id: string } }) {
    return this.merchants.getMe(req.user.id);
  }

  @Get("me/clients")
  listClients(@Req() req: { user: { id: string } }) {
    return this.merchants.listClients(req.user.id);
  }

  @Post("me/clients")
  @ApiOperation({ summary: "Register an OAuth client. The secret is returned once only." })
  createClient(
    @Req() req: { user: { id: string } },
    @Body() body: { name: string; redirectUris: string[]; scopes: string[] },
  ) {
    return this.merchants.createClient(req.user.id, body);
  }

  @Delete("me/clients/:clientId")
  revokeClient(@Req() req: { user: { id: string } }, @Param("clientId") clientId: string) {
    return this.merchants.deactivateClient(req.user.id, clientId);
  }
}
