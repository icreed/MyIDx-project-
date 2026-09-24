import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service.js";

@ApiTags("health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness only — no dependency checks, so Railway will not cycle the container. */
  @Get()
  live(): { status: string } {
    return { status: "ok" };
  }

  /** Readiness — verifies the database answers before accepting traffic. */
  @Get("ready")
  async ready(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "up" };
    } catch {
      return { status: "degraded", database: "down" };
    }
  }
}
