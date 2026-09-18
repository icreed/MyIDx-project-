import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreditsService } from "./credits.service.js";

@ApiTags("credits")
@Controller({ path: "credits", version: "1" })
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get("pricing")
  pricing() {
    return this.credits.getPricing();
  }

  @Get("balance")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  balance(@Req() req: { user: { id: string } }) {
    return this.credits.getBalance(req.user.id);
  }

  @Get("transactions")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  transactions(@Req() req: { user: { id: string } }) {
    return this.credits.listTransactions(req.user.id);
  }
}
