// Character storage (Drizzle ORM on Neon). Rows belong to their owner; the
// seed owner 'zinxon' is visible to everyone until claimed on first open.

import { and, asc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { characters, type Character } from "@/db/schema";

export type CharacterRow = Character;

const SEED_OWNER = "zinxon";
const visibleTo = (owner: string) => or(eq(characters.owner, owner), eq(characters.owner, SEED_OWNER));

export async function listCharacters(owner: string): Promise<CharacterRow[]> {
  return db.select().from(characters).where(visibleTo(owner)).orderBy(asc(characters.createdAt));
}

export async function getCharacter(id: string, owner: string): Promise<CharacterRow | null> {
  const [row] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), visibleTo(owner)))
    .limit(1);
  return row ?? null;
}

export async function claimIfSeeded(row: CharacterRow, owner: string) {
  if (row.owner === SEED_OWNER && owner !== SEED_OWNER) {
    await db.update(characters).set({ owner }).where(eq(characters.id, row.id));
    row.owner = owner;
  }
  return row;
}

export async function createCharacter(
  owner: string,
  name: string,
  data: Record<string, unknown>,
): Promise<CharacterRow> {
  const [row] = await db.insert(characters).values({ owner, name, data }).returning();
  return row;
}

export async function updateCharacter(
  id: string,
  owner: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const name = typeof data.charname === "string" ? data.charname : undefined;
  const rows = await db
    .update(characters)
    .set({ data, ...(name !== undefined && { name }), updatedAt: new Date().toISOString() })
    .where(and(eq(characters.id, id), visibleTo(owner)))
    .returning({ id: characters.id });
  return rows.length > 0;
}

export async function deleteCharacter(id: string, owner: string): Promise<boolean> {
  const rows = await db
    .delete(characters)
    .where(and(eq(characters.id, id), visibleTo(owner)))
    .returning({ id: characters.id });
  return rows.length > 0;
}
