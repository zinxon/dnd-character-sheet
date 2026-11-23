import { NextResponse } from "next/server";
import spells from "@/data/spells.json";
import zh from "@/data/zh.json";

type Spell = {
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
};

const SPELL_DB = spells as Record<string, Spell>;
const ZH = zh as Record<string, string>;

// Spell library search over the 510 spells extracted from the classic
// sheet's sourcebook, with Traditional Chinese names where translated.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase();
  const all = Object.values(SPELL_DB);
  const hits = (q
    ? all.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || (ZH[s.name] ?? "").includes(q),
      )
    : all
  )
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .slice(0, 60)
    .map((s) => ({ ...s, zhName: ZH[s.name] ?? null, zhText: ZH[s.text] ?? null }));
  return NextResponse.json(hits);
}
