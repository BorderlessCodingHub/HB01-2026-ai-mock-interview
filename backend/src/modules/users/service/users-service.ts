import type { UserRepository } from "@/modules/auth/repository/user-repository";
import {
  toUserWithoutPassword,
  type UserWithoutPassword,
} from "@/modules/auth/types/user";
import { NotFoundError, type InterviewLocale } from "@/shared";

export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async getMe(userId: number): Promise<UserWithoutPassword> {
    const user = await this.userRepository.getById(userId);
    if (!user) throw new NotFoundError("User not found");
    return toUserWithoutPassword(user);
  }

  async updateInterviewLocale(
    userId: number,
    locale: InterviewLocale,
  ): Promise<{ interviewLocale: InterviewLocale }> {
    await this.userRepository.updateInterviewLocale(userId, locale);
    return { interviewLocale: locale };
  }

  async completeTutorial(
    userId: number,
  ): Promise<{ hasCompletedTutorial: boolean }> {
    await this.userRepository.completeTutorial(userId);
    return { hasCompletedTutorial: true };
  }
}
