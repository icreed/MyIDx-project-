import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@Controller({ version: "1" })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Public, unauthenticated profile page. */
  @Get("u/:username")
  publicProfile(@Param("username") username: string) {
    return this.users.getPublicProfile(username);
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  me(@Req() req: { user: { id: string } }) {
    return this.users.getMe(req.user.id);
  }

  @Patch("me/profile")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  updateProfile(
    @Req() req: { user: { id: string } },
    @Body() body: { displayName?: string; bio?: string; isPublic?: boolean; showCountry?: boolean },
  ) {
    return this.users.updateProfile(req.user.id, body);
  }

  @Get("me/activity")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  activity(@Req() req: { user: { id: string } }) {
    return this.users.listActivity(req.user.id);
  }
}
