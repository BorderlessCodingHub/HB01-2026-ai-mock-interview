import type { InterviewLocale } from "@/shared";

/** Domain user entity (mirrors Prisma `User` model). */
export type User = {
  id: number;
  externalId: string | null;
  name: string;
  email: string;
  password: string | null;
  interviewLocale: InterviewLocale | null;
  hasCompletedTutorial: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** User fields safe to return from service/controller layers. */
export type UserWithoutPassword = Omit<User, "password">;

export type CreateUserParams = {
  name: string;
  email: string;
  password?: string | null;
  externalId?: string | null;
};

export type UpsertFromBorderlessParams = {
  externalId: string;
  email: string;
  name: string;
};

export type UpdateUserParams = {
  password?: string | null;
  name?: string;
  email?: string;
};

export function toUserWithoutPassword(user: User): UserWithoutPassword {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
