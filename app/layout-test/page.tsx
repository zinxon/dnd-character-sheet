import SheetClient from "@/components/sheet/SheetClient";
import seed from "@/scripts/seed-tempest.json";
import { SPELL_DB, withZh, type SpellDetail } from "@/lib/spells";
import type { CharData } from "@/lib/sheet";
export default function T() {
  const data = seed as CharData;
  const entries = (data.spellEntries ?? {}) as Record<string, { name: string }[]>;
  const details: Record<string, SpellDetail> = {};
  for (const l of Object.values(entries)) for (const e of l ?? []) if (SPELL_DB[e.name]) details[e.name] = withZh(SPELL_DB[e.name]);
  return <SheetClient id="00000000-0000-0000-0000-000000000000" initialData={data} spellDetails={details} />;
}
