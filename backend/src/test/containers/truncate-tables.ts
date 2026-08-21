import { Client } from "pg";

function getDatabaseUrl(databaseUrl?: string): string {
  const resolvedUrl = databaseUrl ?? process.env.DATABASE_URL;

  if (!resolvedUrl) {
    throw new Error("DATABASE_URL is required to truncate tables");
  }

  return resolvedUrl;
}

export async function truncateTables(databaseUrl?: string): Promise<void> {
  const client = new Client({
    connectionString: getDatabaseUrl(databaseUrl),
  });
  await client.connect();

  try {
    await client.query(
      'TRUNCATE TABLE "review_items", "interview_messages", "interview_sessions", "resumes", "session_quota_events", "users" RESTART IDENTITY CASCADE;',
    );
  } finally {
    await client.end();
  }
}
