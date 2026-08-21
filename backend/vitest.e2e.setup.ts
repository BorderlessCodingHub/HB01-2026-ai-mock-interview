const e2eEnvDefaults: Record<string, string> = {
  CORS_ORIGIN: "http://localhost:3001",
  FRONTEND_URL: "http://localhost:3001",
  NODE_ENV: "test",
  RATE_LIMIT_WINDOW_MS: "900000",
  RATE_LIMIT_MAX: "500",
  RATE_LIMIT_AI_WINDOW_MS: "900000",
  RATE_LIMIT_AI_MAX: "500",
  SESSION_QUOTA_PRACTICE_MAX: "500",
  SESSION_QUOTA_STUDY_MAX: "500",
  OPENAI_API_KEY: "test-openai-key",
  ASSEMBLYAI_API_KEY: "test-assemblyai-api-key",
  OPENAI_MODEL_INTERVIEW: "gpt-5",
  OPENAI_MODEL_EXTRACTION: "gpt-5-mini",
  OPENAI_MODEL_REVIEW: "gpt-5-mini",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "bucket",
  RESUME_MAX_BYTES: "5242880",
  INTERNAL_AUTH_SYNC_SECRET: "test-internal-auth-sync-secret-min-32-chars",
};

for (const [key, value] of Object.entries(e2eEnvDefaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

process.env.RATE_LIMIT_MAX = e2eEnvDefaults.RATE_LIMIT_MAX;
process.env.RATE_LIMIT_WINDOW_MS = e2eEnvDefaults.RATE_LIMIT_WINDOW_MS;
process.env.RATE_LIMIT_AI_WINDOW_MS = e2eEnvDefaults.RATE_LIMIT_AI_WINDOW_MS;
process.env.RATE_LIMIT_AI_MAX = e2eEnvDefaults.RATE_LIMIT_AI_MAX;
process.env.SESSION_QUOTA_PRACTICE_MAX =
  e2eEnvDefaults.SESSION_QUOTA_PRACTICE_MAX;
process.env.SESSION_QUOTA_STUDY_MAX = e2eEnvDefaults.SESSION_QUOTA_STUDY_MAX;
