const testEnvDefaults: Record<string, string> = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  CORS_ORIGIN: "http://localhost:3001",
  FRONTEND_URL: "http://localhost:3001",
  NODE_ENV: "test",
  RATE_LIMIT_WINDOW_MS: "900000",
  RATE_LIMIT_MAX: "20",
  OPENAI_API_KEY: "sk-test-openai-api-key",
  ASSEMBLYAI_API_KEY: "test-assemblyai-api-key",
  OPENAI_MODEL_INTERVIEW: "gpt-5",
  OPENAI_MODEL_EXTRACTION: "gpt-5-nano",
  OPENAI_MODEL_REVIEW: "gpt-5-nano",
  R2_ACCOUNT_ID: "test-account-id",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET_NAME: "test-bucket",
  REDIS_URL: "redis://localhost:6379",
  RESUME_MAX_BYTES: "5242880",
  INTERNAL_AUTH_SYNC_SECRET: "test-internal-auth-sync-secret-min-32-chars",
};

for (const [key, value] of Object.entries(testEnvDefaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

process.env.SESSION_QUOTA_PRACTICE_MAX = "500";
process.env.SESSION_QUOTA_STUDY_MAX = "500";
