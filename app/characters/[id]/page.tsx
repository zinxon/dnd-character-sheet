import { notFound } from "next/navigation";
import { getCharacter, claimIfSeeded } from "@/lib/db";
import { getOwner } from "@/lib/owner";
import spells from "@/data/spells.json";
import zh from "@/data/zh.json";
import SheetClient from "@/components/sheet/SheetClient";
import type { CharData } from "@/lib/sheet";

type SpellDetail = {
  name: string;
  level: number;
  school: string;
  time: string;
  range: string;
  components: string;
  duration: string;
  text: string;
  higher?: string;
  ritual?: boolean;
  conc?: boolean;
  zhName: string | null;
  zhText: string | null;
};

const SPELL_DB = spells as Record<string, Omit<SpellDetail, "zhName" | "zhText">>;
const ZH = zh as Record<string, string>;

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await getOwner();
  const row = await getCharacter(id, owner);
  if (!row) notFound();
  await claimIfSeeded(row, owner);

  // Only this character's spell details go to the client; the full library
  // is served by /api/spells for the add-spell search.
  const entries = (row.data.spellEntries ?? {}) as Record<
    string,
    { name: string }[]
  >;
  const details: Record<string, SpellDetail> = {};
  for (const list of Object.values(entries)) {
    for (const entry of list ?? []) {
      const s = SPELL_DB[entry.name];
      if (s) {
        details[entry.name] = {
          ...s,
          zhName: ZH[s.name] ?? null,
          zhText: ZH[s.text] ?? null,
        };
      }
    }
  }

  return (
    <SheetClient
      id={row.id}
      initialData={row.data as CharData}
      spellDetails={details}
    />
  );
}
