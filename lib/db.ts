import { Pool } from "pg";

// Single shared pool for the Neon database (also used by Better Auth).
const globalForDb = globalThis as unknown as { _dndPool?: Pool };

export const pool =
  globalForDb._dndPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForDb._dndPool = pool;

export type CharacterRow = {
  id: string;
  owner: string;
  name: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function listCharacters(owner: string): Promise<CharacterRow[]> {
  const { rows } = await pool.query(
    `select id, owner, name, data, created_at, updated_at from characters
     where owner = $1 or owner = 'zinxon' order by created_at asc`,
    [owner],
  );
  return rows;
}

export async function getCharacter(
  id: string,
  owner: string,
): Promise<CharacterRow | null> {
  const { rows } = await pool.query(
    `select id, owner, name, data, created_at, updated_at from characters
     where id = $1 and (owner = $2 or owner = 'zinxon')`,
    [id, owner],
  );
  return rows[0] ?? null;
}

// The seeded rows carry owner 'zinxon'; the first signed-in user claims them.
export async function claimIfSeeded(row: CharacterRow, owner: string) {
  if (row.owner === "zinxon" && owner !== "zinxon") {
    await pool.query(`update characters set owner = $1 where id = $2`, [
      owner,
      row.id,
    ]);
    row.owner = owner;
  }
  return row;
}

export async function createCharacter(
  owner: string,
  name: string,
  data: Record<string, unknown>,
): Promise<CharacterRow> {
  const { rows } = await pool.query(
    `insert into characters (owner, name, data) values ($1, $2, $3)
     returning id, owner, name, data, created_at, updated_at`,
    [owner, name, JSON.stringify(data)],
  );
  return rows[0];
}

export async function updateCharacter(
  id: string,
  owner: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const name = typeof data.charname === "string" ? data.charname : undefined;
  const res = await pool.query(
    `update characters set data = $1, name = coalesce($2, name), updated_at = now()
     where id = $3 and (owner = $4 or owner = 'zinxon')`,
    [JSON.stringify(data), name ?? null, id, owner],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function deleteCharacter(
  id: string,
  owner: string,
): Promise<boolean> {
  const res = await pool.query(
    `delete from characters where id = $1 and (owner = $2 or owner = 'zinxon')`,
    [id, owner],
  );
  return (res.rowCount ?? 0) > 0;
}
