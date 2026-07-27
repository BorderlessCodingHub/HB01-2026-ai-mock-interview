export type {
  BorderlessSessionRecord,
  BorderlessTokenClaims,
  IBorderlessSessionStore,
  IBorderlessTokenVerifier,
  IMailer,
  IPasswordHasher,
  ITokenService,
  SignTokenOptions,
  TokenPayload,
} from "./protocols";
export {
  makeCheckAuthMiddleware,
  PUBLIC_ROUTES,
} from "./middlewares/check-auth-middleware";
export type { PublicRoute } from "./middlewares/check-auth-middleware";
export { UserRepository } from "./repository/user-repository";
export { UserSyncService } from "./service/user-sync-service";
export { BorderlessAccessTokenParser } from "./adapters/borderless-access-token-parser";
export { RedisBorderlessSessionStore } from "./adapters/borderless-session-store";
export { BorderlessTokenResolver } from "./adapters/borderless-token-resolver";
export type {
  CreateUserParams,
  UpdateUserParams,
  UpsertFromBorderlessParams,
  User,
  UserWithoutPassword,
} from "./types/user";
export { toUserWithoutPassword } from "./types/user";
