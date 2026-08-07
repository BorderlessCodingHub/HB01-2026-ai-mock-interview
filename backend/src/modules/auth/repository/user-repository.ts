import type {
  CreateUserParams,
  UpdateUserParams,
  UpsertFromBorderlessParams,
  User,
} from "@/modules/auth/types/user";
import type { InterviewLocale } from "@/shared";
import prisma from "@/infrastructure/database";

export class UserRepository {
  async getByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async getByExternalId(externalId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { externalId } });
  }

  async create(params: CreateUserParams): Promise<User> {
    return prisma.user.create({
      data: {
        name: params.name,
        email: params.email,
        password: params.password ?? null,
        externalId: params.externalId ?? null,
      },
    });
  }

  async getById(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async update(id: number, params: UpdateUserParams): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: params,
    });
  }

  async updateInterviewLocale(
    userId: number,
    locale: InterviewLocale,
  ): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { interviewLocale: locale },
    });
  }

  async completeTutorial(userId: number): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { hasCompletedTutorial: true },
    });
  }

  /**
   * Upsert by externalId. Preserves interviewLocale.
   * If a row exists with the same email but no/different externalId, link and update.
   */
  async upsertFromBorderless(
    params: UpsertFromBorderlessParams,
  ): Promise<User> {
    const byExternal = await this.getByExternalId(params.externalId);
    if (byExternal) {
      return prisma.user.update({
        where: { id: byExternal.id },
        data: {
          email: params.email,
          name: params.name,
        },
      });
    }

    const byEmail = await this.getByEmail(params.email);
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          externalId: params.externalId,
          name: params.name,
          email: params.email,
        },
      });
    }

    return prisma.user.create({
      data: {
        externalId: params.externalId,
        email: params.email,
        name: params.name,
        password: null,
      },
    });
  }
}
