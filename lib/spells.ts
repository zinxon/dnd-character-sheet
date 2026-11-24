import spells from "@/data/spells.json";
import zh from "@/data/zh.json";
import spellsZh from "@/data/spells-zh.json";

export type Spell = {
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

export type SpellDetail = Spell & {
  zhName: string | null;
  zhText: string | null;
  zhHigher: string | null;
};

export const SPELL_DB = spells as Record<string, Spell>;
const ZH = zh as Record<string, string>;
// Traditional Chinese spell descriptions, keyed by English spell name.
const SPELLS_ZH = spellsZh as Record<string, { text: string; higher?: string }>;

export function withZh(s: Spell): SpellDetail {
  const t = SPELLS_ZH[s.name];
  return {
    ...s,
    zhName: ZH[s.name] ?? null,
    zhText: t?.text ?? null,
    zhHigher: t?.higher ?? null,
  };
}

export function zhName(name: string): string | undefined {
  return ZH[name];
}
