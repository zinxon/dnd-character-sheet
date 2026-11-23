// Sheet engine: reads and writes the classic sheet's own record format
// (the flat field map stored in Neon `characters.data`), and reproduces the
// classic sheet's calculations — ability modifiers, proficiency, saves,
// skills, spell slots (incl. multiclass), spell DC / attack, XP thresholds.

export type CharData = Record<string, unknown>;

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const SKILLS: { key: string; name: string; ability: Ability }[] = [
  { key: "acrobatics", name: "Acrobatics", ability: "dex" },
  { key: "animal", name: "Animal Handling", ability: "wis" },
  { key: "arcana", name: "Arcana", ability: "int" },
  { key: "athletics", name: "Athletics", ability: "str" },
  { key: "deception", name: "Deception", ability: "cha" },
  { key: "history", name: "History", ability: "int" },
  { key: "insight", name: "Insight", ability: "wis" },
  { key: "intimidation", name: "Intimidation", ability: "cha" },
  { key: "investigation", name: "Investigation", ability: "int" },
  { key: "medicine", name: "Medicine", ability: "wis" },
  { key: "nature", name: "Nature", ability: "int" },
  { key: "perception", name: "Perception", ability: "wis" },
  { key: "performance", name: "Performance", ability: "cha" },
  { key: "persuasion", name: "Persuasion", ability: "cha" },
  { key: "religion", name: "Religion", ability: "int" },
  { key: "sleight", name: "Sleight of Hand", ability: "dex" },
  { key: "stealth", name: "Stealth", ability: "dex" },
  { key: "survival", name: "Survival", ability: "wis" },
];

export type CasterType = "full" | "half" | "third" | "pact" | "none";

export type ClassCore = {
  name: string;
  hitDie: number;
  saves: Ability[];
  caster: CasterType;
  spellAbility: Ability | null;
  skillsFrom: string[]; // skill keys offered by the class
  skillCount: number;
};

const ALL_SKILL_KEYS = SKILLS.map((s) => s.key);

export const CLASS_CORES: ClassCore[] = [
  { name: "Artificer", hitDie: 8, saves: ["con", "int"], caster: "half", spellAbility: "int", skillsFrom: ["arcana", "history", "investigation", "medicine", "nature", "perception", "sleight"], skillCount: 2 },
  { name: "Barbarian", hitDie: 12, saves: ["str", "con"], caster: "none", spellAbility: null, skillsFrom: ["animal", "athletics", "intimidation", "nature", "perception", "survival"], skillCount: 2 },
  { name: "Bard", hitDie: 8, saves: ["dex", "cha"], caster: "full", spellAbility: "cha", skillsFrom: ALL_SKILL_KEYS, skillCount: 3 },
  { name: "Cleric", hitDie: 8, saves: ["wis", "cha"], caster: "full", spellAbility: "wis", skillsFrom: ["history", "insight", "medicine", "persuasion", "religion"], skillCount: 2 },
  { name: "Druid", hitDie: 8, saves: ["int", "wis"], caster: "full", spellAbility: "wis", skillsFrom: ["arcana", "animal", "insight", "medicine", "nature", "perception", "religion", "survival"], skillCount: 2 },
  { name: "Fighter", hitDie: 10, saves: ["str", "con"], caster: "third", spellAbility: "int", skillsFrom: ["acrobatics", "animal", "athletics", "history", "insight", "intimidation", "perception", "survival"], skillCount: 2 },
  { name: "Monk", hitDie: 8, saves: ["str", "dex"], caster: "none", spellAbility: null, skillsFrom: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], skillCount: 2 },
  { name: "Paladin", hitDie: 10, saves: ["wis", "cha"], caster: "half", spellAbility: "cha", skillsFrom: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], skillCount: 2 },
  { name: "Ranger", hitDie: 10, saves: ["str", "dex"], caster: "half", spellAbility: "wis", skillsFrom: ["animal", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"], skillCount: 3 },
  { name: "Rogue", hitDie: 8, saves: ["dex", "int"], caster: "third", spellAbility: "int", skillsFrom: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight", "stealth"], skillCount: 4 },
  { name: "Sorcerer", hitDie: 6, saves: ["con", "cha"], caster: "full", spellAbility: "cha", skillsFrom: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], skillCount: 2 },
  { name: "Warlock", hitDie: 8, saves: ["wis", "cha"], caster: "pact", spellAbility: "cha", skillsFrom: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], skillCount: 2 },
  { name: "Wizard", hitDie: 6, saves: ["int", "wis"], caster: "full", spellAbility: "int", skillsFrom: ["arcana", "history", "insight", "investigation", "medicine", "religion"], skillCount: 2 },
];

export const classCore = (name: string): ClassCore | undefined =>
  CLASS_CORES.find((c) => c.name.toLowerCase() === name.toLowerCase());

// Full-caster slot table, index = effective caster level 1..20 → slots per spell level.
export const FULL_SLOTS: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

// Warlock pact magic: [slot count, slot level] per warlock level 1..20.
export const PACT_SLOTS: [number, number][] = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5],
  [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5],
  [4, 5], [4, 5],
];

export const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated",
  "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained",
  "Stunned", "Unconscious", "Concentrating",
];

export type ClassLevel = { name: string; subclass: string; level: number };

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const mod = (score: number) => Math.floor((score - 10) / 2);

// Parse the class build. Prefers charClasses; when it is empty (characters
// imported from D&D Beyond), rebuilds it from the "Class & Level" text —
// the same repair the classic sheet's Level Up fix applies.
export function parseClasses(data: CharData): ClassLevel[] {
  const built = data.charClasses;
  if (Array.isArray(built) && built.length > 0) {
    return built
      .map((c) => {
        const o = c as Record<string, unknown>;
        return {
          name: String(o.class ?? o.name ?? ""),
          subclass: String(o.subclass ?? o.sub ?? ""),
          level: num(o.level, 1),
        };
      })
      .filter((c) => c.name);
  }
  const text = String(data.classlevel ?? "");
  const out: ClassLevel[] = [];
  // Segments look like "Wizard (School of Evocation) 7" joined by " / " or
  // ", " — e.g. "Cleric 3 (Tempest Domain), Wizard 5 (Order of Scribes)".
  const re =
    /([A-Za-z' ]+?)\s+(?:\(([^)]*)\)\s+)?(\d+)(?:\s*\(([^)]*)\))?(?=\s*(?:,|\/|$))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const core = classCore(m[1].trim());
    if (!core && out.length > 0) continue;
    out.push({
      name: core ? core.name : m[1].trim(),
      subclass: m[2] ?? m[4] ?? "",
      level: parseInt(m[3], 10),
    });
  }
  return out;
}

export function classLevelString(classes: ClassLevel[]): string {
  return classes
    .map((c) => `${c.name}${c.subclass ? ` (${c.subclass})` : ""} ${c.level}`)
    .join(" / ");
}

export const totalLevel = (data: CharData) =>
  parseClasses(data).reduce((sum, c) => sum + c.level, 0) || 1;

export const profBonus = (data: CharData) =>
  2 + Math.floor((totalLevel(data) - 1) / 4);

export function abilityScores(data: CharData): Record<Ability, number> {
  const manual = (data.manualScores ?? {}) as Record<string, unknown>;
  const base = (data.baseVals ?? {}) as Record<string, unknown>;
  const bonus = (data.bonusVals ?? {}) as Record<string, Record<string, unknown>>;
  const out = {} as Record<Ability, number>;
  for (const a of ABILITIES) {
    if (manual[a] != null && manual[a] !== "") out[a] = num(manual[a], 10);
    else if (base[a] != null) {
      out[a] =
        num(base[a], 10) +
        num(bonus.asi?.[a]) +
        num(bonus.racial?.[a]) +
        num(bonus.magical?.[a]);
    } else out[a] = 10;
  }
  return out;
}

export function saveBonus(data: CharData, ability: Ability): number {
  const scores = abilityScores(data);
  return mod(scores[ability]) + (data[`savep-${ability}`] ? profBonus(data) : 0);
}

export function skillBonus(data: CharData, skillKey: string): number {
  const skill = SKILLS.find((s) => s.key === skillKey);
  if (!skill) return 0;
  const scores = abilityScores(data);
  let bonus = mod(scores[skill.ability]);
  if (data[`skp-${skillKey}`]) bonus += profBonus(data);
  if (data[`ske-${skillKey}`]) bonus += profBonus(data);
  return bonus;
}

export function passivePerception(data: CharData): number {
  return 10 + skillBonus(data, "perception");
}

// Effective multiclass caster level for the shared slot pool.
export function casterLevel(data: CharData): number {
  let level = 0;
  for (const c of parseClasses(data)) {
    const core = classCore(c.name);
    if (!core) continue;
    if (core.caster === "full") level += c.level;
    else if (core.caster === "half") level += Math.floor(c.level / 2);
    else if (core.caster === "third") level += Math.floor(c.level / 3);
  }
  return level;
}

// Slot totals: the record's own slot1..slot9 win when present (the classic
// sheet stores them); otherwise computed from the class build.
export function slotTotals(data: CharData): number[] {
  const stored = Array.from({ length: 9 }, (_, i) => num(data[`slot${i + 1}`]));
  if (stored.some((n) => n > 0)) return stored;
  const cl = casterLevel(data);
  if (cl <= 0) return Array(9).fill(0);
  const row = FULL_SLOTS[Math.min(cl, 20) - 1] ?? [];
  return Array.from({ length: 9 }, (_, i) => row[i] ?? 0);
}

export function slotUsed(data: CharData, level: number): number {
  return num(data[`slot${level}u`]);
}

export function spellcasting(data: CharData) {
  const scores = abilityScores(data);
  const pb = profBonus(data);
  return parseClasses(data)
    .map((c) => {
      const core = classCore(c.name);
      if (!core || !core.spellAbility) return null;
      const abilityMod = mod(scores[core.spellAbility]);
      return {
        className: c.name,
        ability: core.spellAbility,
        dc: 8 + pb + abilityMod,
        attack: pb + abilityMod,
      };
    })
    .filter(Boolean) as {
    className: string;
    ability: Ability;
    dc: number;
    attack: number;
  }[];
}

export type RollResult = {
  expr: string;
  total: number;
  detail: string;
  nat?: "crit" | "fumble" | null;
  // Individual die values and the die size, for the 3D dice animation.
  rolls: number[];
  dieFaces: number;
};

// Parse a roll expression into its dice: "2d6+3" → 2 × d6, +3.
// Plain "20" is a d20 check with that bonus.
export function parseDice(exprRaw: string): { count: number; faces: number; bonus: number } {
  const expr = exprRaw.trim().toLowerCase().replace(/\s+/g, "");
  if (/^[+-]?\d+$/.test(expr)) return { count: 1, faces: 20, bonus: parseInt(expr, 10) };
  const m = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) throw new Error(`Cannot parse dice: ${exprRaw}`);
  return {
    count: parseInt(m[1] || "1", 10),
    faces: parseInt(m[2], 10),
    bonus: m[3] ? parseInt(m[3], 10) : 0,
  };
}

// Dice roller: "2d6+3", "d20", "1d8-1", plain "20" (a d20 check).
// Pass `landed` to use die values that were already rolled (the 3D dice);
// otherwise each die is rolled with Math.random.
export function rollDice(exprRaw: string, landed?: number[]): RollResult {
  const expr = exprRaw.trim().toLowerCase().replace(/\s+/g, "");
  const check = expr.match(/^[+-]?\d+$/);
  if (check) {
    const bonus = parseInt(expr, 10);
    const roll = landed?.[0] ?? 1 + Math.floor(Math.random() * 20);
    return {
      expr: `d20${bonus ? fmt(bonus) : ""}`,
      total: roll + bonus,
      detail: `${roll}${bonus ? ` ${fmt(bonus)}` : ""}`,
      nat: roll === 20 ? "crit" : roll === 1 ? "fumble" : null,
      rolls: [roll],
      dieFaces: 20,
    };
  }
  const m = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) throw new Error(`Cannot parse dice: ${exprRaw}`);
  const count = parseInt(m[1] || "1", 10);
  const faces = parseInt(m[2], 10);
  const bonus = m[3] ? parseInt(m[3], 10) : 0;
  const rolls =
    landed && landed.length === count
      ? landed
      : Array.from({ length: count }, () => 1 + Math.floor(Math.random() * faces));
  const total = rolls.reduce((a, b) => a + b, 0) + bonus;
  const nat =
    faces === 20 && count === 1
      ? rolls[0] === 20
        ? "crit"
        : rolls[0] === 1
          ? "fumble"
          : null
      : null;
  return {
    expr,
    total,
    detail: `[${rolls.join(", ")}]${bonus ? ` ${fmt(bonus)}` : ""}`,
    nat,
    rolls,
    dieFaces: faces,
  };
}

// Slot totals for a class build: a single class uses its own table
// (half casters round up, pact magic is separate); multiclass uses the
// shared pool from the combined caster level.
export function slotsForClasses(classes: ClassLevel[]): number[] {
  if (classes.length === 1) {
    const core = classCore(classes[0].name);
    if (!core || core.caster === "none") return Array(9).fill(0);
    if (core.caster === "pact") {
      const [count, slotLevel] = PACT_SLOTS[Math.min(classes[0].level, 20) - 1];
      const out = Array(9).fill(0);
      out[slotLevel - 1] = count;
      return out;
    }
    const effective =
      core.caster === "full"
        ? classes[0].level
        : core.caster === "half"
          ? Math.ceil(classes[0].level / 2)
          : Math.floor(classes[0].level / 3);
    if (effective <= 0) return Array(9).fill(0);
    const row = FULL_SLOTS[Math.min(effective, 20) - 1] ?? [];
    return Array.from({ length: 9 }, (_, i) => row[i] ?? 0);
  }
  let level = 0;
  for (const c of classes) {
    const core = classCore(c.name);
    if (!core) continue;
    if (core.caster === "full") level += c.level;
    else if (core.caster === "half") level += Math.floor(c.level / 2);
    else if (core.caster === "third") level += Math.floor(c.level / 3);
  }
  if (level <= 0) return Array(9).fill(0);
  const row = FULL_SLOTS[Math.min(level, 20) - 1] ?? [];
  return Array.from({ length: 9 }, (_, i) => row[i] ?? 0);
}

// A blank character in the classic record format.
export function blankCharacter(name: string): CharData {
  const data: CharData = {
    charname: name,
    classlevel: "",
    charClasses: [],
    race: "",
    background: "",
    alignment: "",
    player: "",
    campaign: "",
    xp: "0",
    hpcur: "0",
    hpmax: "0",
    hptmp: "",
    manualScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    inspiration: false,
    features: "",
    proficiencies: "",
    equipment: "",
    notes: "",
    spellEntries: {},
    conditions: [],
    created: true,
  };
  for (const a of ABILITIES) data[`savep-${a}`] = false;
  for (const s of SKILLS) {
    data[`skp-${s.key}`] = false;
    data[`ske-${s.key}`] = false;
  }
  for (let lvl = 1; lvl <= 9; lvl++) {
    data[`slot${lvl}`] = "";
    data[`slot${lvl}u`] = "";
  }
  for (let i = 0; i < 58; i++) {
    data[`invname-${i}`] = "";
    data[`invqty-${i}`] = "";
  }
  for (let i = 0; i < 5; i++) {
    data[`atkname-${i}`] = "";
    data[`atkbonus-${i}`] = "";
    data[`atkdmg-${i}`] = "";
  }
  for (let i = 0; i < 16; i++) {
    data[`lfname-${i}`] = "";
    data[`lfmax-${i}`] = "";
    data[`lfused-${i}`] = "";
    data[`lfrec-${i}`] = "";
  }
  for (let i = 0; i < 3; i++) {
    data[`dss-${i}`] = false;
    data[`dsf-${i}`] = false;
  }
  for (const c of ["cp", "sp", "ep", "gp", "pp"]) data[c] = "0";
  return data;
}
