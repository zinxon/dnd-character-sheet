import { readFileSync } from "node:fs";
import pg from "pg";

// Load .env.local without printing any values.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
console.log("connected to Neon");

await client.query(`
  create table if not exists characters (
    id uuid primary key default gen_random_uuid(),
    owner text not null,
    name text not null,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )
`);
console.log("characters table ready");

const james = JSON.parse(readFileSync("scripts/seed-james.json", "utf8"));
const tempest = JSON.parse(readFileSync("scripts/seed-tempest.json", "utf8"));

for (const rec of [james, tempest]) {
  const existing = await client.query(
    "select id from characters where owner = $1 and name = $2",
    ["zinxon", rec.charname],
  );
  if (existing.rowCount > 0) {
    console.log("already present:", rec.charname);
    continue;
  }
  await client.query(
    "insert into characters (owner, name, data) values ($1, $2, $3)",
    ["zinxon", rec.charname, JSON.stringify(rec)],
  );
  console.log("inserted:", rec.charname);
}

const { rows } = await client.query(
  "select name, (select count(*) from jsonb_object_keys(data)) as fields, created_at from characters order by created_at",
);
console.table(rows);
await client.end();
