import fs from "node:fs";
import pg from "pg";

const env = fs
  .readFileSync(".env", "utf8")
  .split(/\r?\n/)
  .find((line) => line.startsWith("SUPABASE_DB_URL="));
const connectionString = env?.slice("SUPABASE_DB_URL=".length).trim();

if (!connectionString) {
  throw new Error("Missing SUPABASE_DB_URL in .env");
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
const result = await client.query(`
  delete from public.quiz_sets s
  where not exists (
    select 1
    from public.quiz_set_questions qsq
    where qsq.set_id = s.id
  )
  returning s.id, s.title
`);
await client.end();

console.log(`deleted ${result.rowCount} empty quiz set(s)`);
