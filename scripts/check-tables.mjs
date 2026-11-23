import { readFileSync } from "node:fs";
import pg from "pg";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
);
console.log("tables:", rows.map((r) => r.table_name).join(", "));
await client.end();
