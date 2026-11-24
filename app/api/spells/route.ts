import { NextResponse } from "next/server";
import { SPELL_DB, withZh, zhName } from "@/lib/spells";
import { learnableSpells } from "@/lib/autobuild";
import type { ClassLevel } from "@/lib/sheet";

// Spell search. With ?classes=<JSON ClassLevel[]>, spells the character can
// learn come first (tagged with the class or subclass that grants them),
// then every other spell.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").toLowerCase();
  let classes: ClassLevel[] = [];
  try {
    classes = JSON.parse(params.get("classes") ?? "[]");
  } catch {}
  const learnable = Array.isArray(classes) && classes.length ? learnableSpells(classes) : new Map<string, string>();
  const groupOrder = [...new Set(learnable.values())];
  const rank = (name: string) => {
    const g = learnable.get(name);
    return g === undefined ? groupOrder.length : groupOrder.indexOf(g);
  };
  const all = Object.values(SPELL_DB);
  const hits = (q
    ? all.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || (zhName(s.name) ?? "").includes(q),
      )
    : all
  )
    .sort((a, b) => rank(a.name) - rank(b.name) || a.level - b.level || a.name.localeCompare(b.name))
    .map((s) => ({ ...withZh(s), group: learnable.get(s.name) ?? null }));
  return NextResponse.json(hits);
}
