import fs from "node:fs";
import pg from "pg";

function loadEnv() {
  const result = {};
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 0) continue;
      result[trimmed.slice(0, index)] = trimmed.slice(index + 1).trim();
    }
  }
  return result;
}

const env = loadEnv();
const connectionString = env.SUPABASE_DB_URL;
const emails = (env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (!connectionString) {
  throw new Error("Missing SUPABASE_DB_URL in .env");
}

if (!emails.length) {
  throw new Error("Missing NEXT_PUBLIC_ADMIN_EMAILS in .env");
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
const result = await client.query(
  `
  insert into public.admin_users (user_id, email)
  select id, lower(email)
  from auth.users
  where lower(email) = any($1::text[])
  on conflict (user_id) do update set email = excluded.email
  returning email
  `,
  [emails]
);
await client.end();

const synced = result.rows.map((row) => row.email);
const missing = emails.filter((email) => !synced.includes(email));
console.log(`synced ${synced.length} admin user(s): ${synced.join(", ") || "none"}`);
if (missing.length) {
  console.log(`not found in auth.users yet: ${missing.join(", ")}`);
}
