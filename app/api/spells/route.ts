import { NextResponse } from "next/server";
import { SPELL_DB, withZh, zhName } from "@/lib/spells";

// Spell library search over the 510 spells extracted from the classic
// sheet's sourcebook, with Traditional Chinese names where translated.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase();
  const all = Object.values(SPELL_DB);
  const hits = (q
    ? all.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || (zhName(s.name) ?? "").includes(q),
      )
    : all
  )
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .slice(0, 60)
    .map(withZh);
  return NextResponse.json(hits);
}
