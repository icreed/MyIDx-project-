import { Injectable, NotFoundException } from "@nestjs/common";
import type { PublicProfile } from "@myidx/shared";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public projection for /u/:username.
   *
   * Only fields the user explicitly opted to publish are returned. Email, phone,
   * documents and vault attributes are never part of this response.
   */
  async getPublicProfile(username: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findFirst({
      where: { username: username.toLowerCase(), status: "ACTIVE" },
      select: {
        username: true,
        countryCode: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            bio: true,
            isPublic: true,
            showCountry: true,
            verified: true,
            verifiedAt: true,
          },
        },
      },
    });

    // A private profile is reported as absent rather than "exists but hidden",
    // so the endpoint cannot be used to enumerate accounts.
    if (!user?.profile?.isPublic) throw new NotFoundException("profile not found");

    return {
      username: user.username,
      displayName: user.profile.displayName ?? undefined,
      avatarUrl: user.profile.avatarUrl ?? undefined,
      bio: user.profile.bio ?? undefined,
      country: user.profile.showCountry ? user.countryCode : undefined,
      verified: user.profile.verified,
      verifiedAt: user.profile.verifiedAt?.toISOString(),
      memberSince: user.createdAt.toISOString(),
    };
  }

  getMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        countryCode: true,
        status: true,
        mfaEnabled: true,
        mfaMethods: true,
        creditBalance: true,
        createdAt: true,
      },
    });
  }

  updateProfile(
    userId: string,
    data: {
      displayName?: string;
      bio?: string;
      isPublic?: boolean;
      showCountry?: boolean;
    },
  ) {
    return this.prisma.profile.update({ where: { userId }, data });
  }

  /** Recent activity, surfaced in-app as security alerts. */
  listActivity(userId: string, take = 50) {
    return this.prisma.auditEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { action: true, actorType: true, createdAt: true, metadata: true },
    });
  }
}
