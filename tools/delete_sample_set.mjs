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
await client.query("delete from public.quiz_sets where id = $1", ["sample-mln111"]);
await client.end();

console.log("deleted sample set from Supabase");
