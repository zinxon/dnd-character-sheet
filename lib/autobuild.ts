// Auto-build a character's features, spells and actions from its classes
// (with level + subclass) and race, using the SRD 5.2 data in data/en.
// Runs on the server (app/api/build) so the big JSON files stay out of the
// browser bundle. Returns a patch of classic sheet fields.
//
// Only the SRD subclass of each class has rules text in data/en; any other
// subclass gets a note asking the player to add its features.

import "server-only";
import featuresJson from "@/data/en/5e-SRD-Features.json";
import levelsJson from "@/data/en/5e-SRD-Levels.json";
import classesJson from "@/data/en/5e-SRD-Classes.json";
import srdSpellsJson from "@/data/en/5e-SRD-Spells.json";
import speciesJson from "@/data/en/5e-SRD-Species.json";
import subspeciesJson from "@/data/en/5e-SRD-Subspecies.json";
import traitsJson from "@/data/en/5e-SRD-Traits.json";
import featuresZhJson from "@/data/features-zh.json";
import zhJson from "@/data/zh.json";
import { SPELL_DB } from "@/lib/spells";
import { classCore, mod, type Ability, type CharData, type ClassLevel } from "@/lib/sheet";

type Ref = { name: string; index?: string };
type Feature = {
  index: string;
  name: string;
  class: Ref;
  subclass?: Ref;
  level: Ref;
  description: string;
};
type Level = {
  level: number;
  class: Ref;
  subclass?: Ref;
  class_specific?: Record<string, unknown>;
  spellcasting?: Record<string, number>;
};
type SrdClass = { name: string; proficiencies: Ref[] };
type SrdSpell = { name: string; level: number; classes: Ref[] };
type Species = { name: string; speed: number; size: string; traits: Ref[] };
type Subspecies = { name: string; species: Ref; traits: (Ref & { level?: number })[] };
type Trait = { index: string; name: string; description: string };

const FEATURES = featuresJson as Feature[];
const LEVELS = levelsJson as Level[];
const CLASSES = classesJson as SrdClass[];
const SRD_SPELLS = srdSpellsJson as SrdSpell[];
const SPECIES = speciesJson as Species[];
const SUBSPECIES = subspeciesJson as Subspecies[];
const TRAITS = traitsJson as Trait[];
// Traditional Chinese: rules text keyed by feature index ("trait:<index>"
// for species traits), and short names from the shared glossary.
const TEXT_ZH = featuresZhJson as Record<string, string>;
const ZH = zhJson as Record<string, string>;
const zh = (name: string) => ZH[name] ?? name;
// "精靈（Elf）" style heading part: Chinese with the English kept for lookup.
const both = (name: string) => (ZH[name] ? `${ZH[name]}（${name}）` : name);
const PROF_ZH: Record<string, string> = {
  "Light Armor": "輕甲", "Medium Armor": "中甲", "Heavy Armor": "重甲", Shields: "盾牌",
  "Simple Weapons": "簡易武器", "Martial Weapons": "軍用武器",
};

export type BuildInput = {
  classes: ClassLevel[];
  race: string;
  scores: Record<Ability, number>;
};

const featureLevel = (f: Feature) => parseInt(f.level.name.replace(/\D+/g, ""), 10) || 1;
const classLevelRow = (cls: string, level: number) =>
  LEVELS.find((l) => !l.subclass && l.class.name === cls && l.level === level);
const fmt = (n: number) => (n >= 0 ? `+${n}` : String(n));

// Class features that are tables or choices rather than something to read
// on the sheet.
const SKIP_FEATURES = /^(Spellcasting|Pact Magic|Ability Score Improvement|Epic Boon|.+ Subclass)$/;

// Recommended picks, best first. Only spells on the class's SRD list (and in
// the sheet's spell database) are used; the rest of the list fills any gap.
const PICKS: Record<string, { cantrips: string[]; spells: string[] }> = {
  Wizard: {
    cantrips: ["Fire Bolt", "Mage Hand", "Prestidigitation", "Shocking Grasp", "Minor Illusion", "Ray of Frost", "Light"],
    spells: ["Shield", "Magic Missile", "Mage Armor", "Detect Magic", "Find Familiar", "Sleep", "Misty Step", "Web", "Mirror Image", "Hold Person", "Scorching Ray", "Fireball", "Counterspell", "Haste", "Fly", "Lightning Bolt", "Dispel Magic", "Greater Invisibility", "Polymorph", "Banishment", "Dimension Door", "Wall of Fire", "Cone of Cold", "Wall of Force", "Hold Monster", "Animate Objects", "Disintegrate", "Globe of Invulnerability", "Chain Lightning", "Teleport", "Finger of Death", "Forcecage", "Sunburst", "Mind Blank", "Power Word Stun", "Wish", "Time Stop", "Meteor Swarm"],
  },
  Sorcerer: {
    cantrips: ["Fire Bolt", "Mage Hand", "Prestidigitation", "Shocking Grasp", "Ray of Frost", "Minor Illusion", "Light"],
    spells: ["Shield", "Magic Missile", "Chromatic Orb", "Mage Armor", "Sleep", "Misty Step", "Scorching Ray", "Hold Person", "Mirror Image", "Fireball", "Counterspell", "Haste", "Fly", "Lightning Bolt", "Greater Invisibility", "Polymorph", "Dimension Door", "Cone of Cold", "Hold Monster", "Disintegrate", "Chain Lightning", "Globe of Invulnerability", "Finger of Death", "Teleport", "Sunburst", "Dominate Monster", "Meteor Swarm", "Wish", "Time Stop"],
  },
  Warlock: {
    cantrips: ["Eldritch Blast", "Mage Hand", "Minor Illusion", "Prestidigitation", "Chill Touch"],
    spells: ["Hex", "Hellish Rebuke", "Protection from Evil and Good", "Misty Step", "Hold Person", "Darkness", "Invisibility", "Counterspell", "Fly", "Hypnotic Pattern", "Dimension Door", "Banishment", "Hold Monster", "Scrying", "Circle of Death", "Finger of Death", "Dominate Monster", "Power Word Kill", "Foresight"],
  },
  Cleric: {
    cantrips: ["Sacred Flame", "Guidance", "Thaumaturgy", "Spare the Dying", "Light", "Resistance"],
    spells: ["Bless", "Healing Word", "Guiding Bolt", "Cure Wounds", "Shield of Faith", "Command", "Spiritual Weapon", "Aid", "Lesser Restoration", "Hold Person", "Spirit Guardians", "Revivify", "Mass Healing Word", "Dispel Magic", "Banishment", "Death Ward", "Guardian of Faith", "Freedom of Movement", "Greater Restoration", "Mass Cure Wounds", "Flame Strike", "Raise Dead", "Heal", "Harm", "Blade Barrier", "Regenerate", "Resurrection", "Fire Storm", "Holy Aura", "Antimagic Field", "Mass Heal", "Gate", "True Resurrection"],
  },
  Druid: {
    cantrips: ["Produce Flame", "Guidance", "Shillelagh", "Druidcraft", "Poison Spray", "Resistance"],
    spells: ["Healing Word", "Entangle", "Faerie Fire", "Goodberry", "Cure Wounds", "Thunderwave", "Moonbeam", "Pass without Trace", "Spike Growth", "Barkskin", "Lesser Restoration", "Call Lightning", "Conjure Animals", "Dispel Magic", "Revivify", "Polymorph", "Ice Storm", "Freedom of Movement", "Wall of Fire", "Mass Cure Wounds", "Greater Restoration", "Wall of Stone", "Insect Plague", "Sunbeam", "Heal", "Wind Walk", "Fire Storm", "Regenerate", "Sunburst", "Earthquake", "Foresight", "Shapechange"],
  },
  Bard: {
    cantrips: ["Vicious Mockery", "Minor Illusion", "Mage Hand", "Prestidigitation", "Light", "Dancing Lights"],
    spells: ["Healing Word", "Dissonant Whispers", "Faerie Fire", "Charm Person", "Heroism", "Thunderwave", "Silence", "Hold Person", "Invisibility", "Shatter", "Suggestion", "Hypnotic Pattern", "Dispel Magic", "Fear", "Mass Healing Word", "Greater Invisibility", "Polymorph", "Dimension Door", "Freedom of Movement", "Mass Cure Wounds", "Greater Restoration", "Animate Objects", "Hold Monster", "Mass Suggestion", "Eyebite", "Teleport", "Etherealness", "Mind Blank", "Feeblemind", "Power Word Kill", "Foresight"],
  },
  Paladin: {
    cantrips: [],
    spells: ["Bless", "Divine Favor", "Cure Wounds", "Shield of Faith", "Command", "Heroism", "Searing Smite", "Aid", "Find Steed", "Lesser Restoration", "Magic Weapon", "Revivify", "Dispel Magic", "Daylight", "Banishment", "Death Ward", "Freedom of Movement", "Raise Dead", "Dispel Evil and Good"],
  },
  Ranger: {
    cantrips: [],
    spells: ["Hunter's Mark", "Goodberry", "Cure Wounds", "Ensnaring Strike", "Entangle", "Fog Cloud", "Pass without Trace", "Spike Growth", "Silence", "Lesser Restoration", "Conjure Animals", "Revivify", "Water Breathing", "Wind Wall", "Freedom of Movement", "Stoneskin", "Conjure Woodland Beings", "Tree Stride", "Commune with Nature", "Swift Quiver"],
  },
};

// Damage cantrips shown as attacks. Dice grow at character levels 5/11/17.
const ATTACK_CANTRIPS: Record<string, { die: string; type: string; save?: Ability }> = {
  "Eldritch Blast": { die: "d10", type: "force" },
  "Fire Bolt": { die: "d10", type: "fire" },
  "Chill Touch": { die: "d10", type: "necrotic" },
  "Shocking Grasp": { die: "d8", type: "lightning" },
  "Ray of Frost": { die: "d8", type: "cold" },
  "Produce Flame": { die: "d8", type: "fire" },
  "Starry Wisp": { die: "d8", type: "radiant" },
  "Poison Spray": { die: "d12", type: "poison" },
  "Sacred Flame": { die: "d8", type: "radiant", save: "dex" },
  "Acid Splash": { die: "d6", type: "acid", save: "dex" },
  "Vicious Mockery": { die: "d6", type: "psychic", save: "wis" },
};

// A sensible starting weapon per class (2024 starting equipment).
const WEAPONS: Record<string, { name: string; dmg: string; type: string; finesse?: boolean; ranged?: boolean }> = {
  Barbarian: { name: "Greataxe", dmg: "1d12", type: "slashing" },
  Fighter: { name: "Greatsword", dmg: "2d6", type: "slashing" },
  Paladin: { name: "Longsword", dmg: "1d8", type: "slashing" },
  Ranger: { name: "Longbow", dmg: "1d8", type: "piercing", ranged: true },
  Rogue: { name: "Rapier", dmg: "1d8", type: "piercing", finesse: true },
  Monk: { name: "Spear", dmg: "1d6", type: "piercing" },
  Cleric: { name: "Mace", dmg: "1d6", type: "bludgeoning" },
  Druid: { name: "Quarterstaff", dmg: "1d6", type: "bludgeoning" },
  Wizard: { name: "Quarterstaff", dmg: "1d6", type: "bludgeoning" },
  Sorcerer: { name: "Dagger", dmg: "1d4", type: "piercing", finesse: true },
  Warlock: { name: "Dagger", dmg: "1d4", type: "piercing", finesse: true },
  Bard: { name: "Dagger", dmg: "1d4", type: "piercing", finesse: true },
  Artificer: { name: "Light Crossbow", dmg: "1d8", type: "piercing", ranged: true },
};

function speciesOf(race: string): { species?: Species; sub?: Subspecies } {
  const m = race.match(/^(.+?)(?:\s*\((.+)\))?$/);
  const species = SPECIES.find((s) => s.name === m?.[1]?.trim());
  const lineage = m?.[2]?.trim();
  const sub = lineage
    ? SUBSPECIES.find((s) => s.species.name === species?.name && s.name.split(":").pop()!.trim() === lineage)
    : undefined;
  return { species, sub };
}

// "3 | Aid, Bless" / "3 / Aid, Bless" rows of a subclass spell table.
// Circle of the Land has a table per land type; use Temperate (the player
// picks a land each Long Rest — the feature text explains the others).
function subclassSpells(f: Feature, classLevel: number): string[] {
  if (f.name === "Circle of the Land Spells") {
    const m = f.description.match(/Temperate Land\n([\s\S]*?)(?:\n\n|$)/);
    f = { ...f, description: m?.[1] ?? "" };
  }
  const out: string[] = [];
  const fix: Record<string, string> = { "Shielf of Faith": "Shield of Faith", "Dragon’s Breath": "Dragon's Breath" };
  for (const m of f.description.matchAll(/(\d+)\s*[|/]\s*([^|/\n]+?)(?=\s+\d+\s*[|/]|\n|$)/g)) {
    if (parseInt(m[1], 10) > classLevel) continue;
    for (const raw of m[2].split(",")) {
      const name = fix[raw.trim()] ?? raw.trim();
      if (SPELL_DB[name]) out.push(name);
    }
  }
  return out;
}

export function buildCharacter({ classes, race, scores }: BuildInput): Partial<CharData> {
  const total = classes.reduce((s, c) => s + c.level, 0) || 1;
  const prof = 2 + Math.floor((total - 1) / 4);
  const m = (a: Ability) => mod(scores[a] ?? 10);
  const patch: CharData = {};
  const featureText: string[] = [];
  const featureTextZh: string[] = [];
  const limited: { name: string; max: number; rec: "SR" | "LR" }[] = [];
  const spells = new Map<string, { level: number; prep: boolean }>();
  const attacks: { name: string; bonus: string; dmg: string }[] = [];
  const addSpell = (name: string, prep: boolean) => {
    const s = SPELL_DB[name];
    if (!s) return;
    const prev = spells.get(name);
    spells.set(name, { level: s.level, prep: prep || Boolean(prev?.prep) });
  };

  // ── Species ──────────────────────────────────────────────────────────
  const { species, sub } = speciesOf(race);
  if (species) {
    patch.speedBase = species.speed;
    const lines: string[] = [];
    const linesZh: string[] = [];
    const addTrait = (t: Trait) => {
      lines.push(`${t.name}. ${t.description.trim()}`);
      linesZh.push(`${both(t.name)}。${(TEXT_ZH[`trait:${t.index}`] ?? t.description).trim()}`);
    };
    const lineageSpells = new Set(
      (sub?.traits ?? []).filter((t) => SPELL_DB[t.name]).map((t) => t.name),
    );
    for (const ref of species.traits) {
      const t = TRAITS.find((x) => x.name === ref.name);
      if (t) addTrait(t);
    }
    for (const ref of sub?.traits ?? []) {
      if (lineageSpells.has(ref.name)) {
        if ((ref.level ?? 1) <= total) addSpell(ref.name, true);
        continue;
      }
      const t = TRAITS.find((x) => x.name === ref.name);
      if (t) addTrait(t);
    }
    featureText.push(`── ${race} ──\n\n${lines.join("\n\n")}`);
    featureTextZh.push(`── ${zh(race)} ──\n\n${linesZh.join("\n\n")}`);
    const pb = { max: prof, rec: "LR" as const };
    if (species.name === "Dragonborn") limited.push({ name: "Breath Weapon", ...pb });
    if (species.name === "Goliath" && sub) limited.push({ name: sub.name.split(":").pop()!.trim(), ...pb });
    if (species.name === "Orc") {
      limited.push({ name: "Adrenaline Rush", max: prof, rec: "SR" });
      limited.push({ name: "Relentless Endurance", max: 1, rec: "LR" });
    }
    if (species.name === "Dwarf" && total >= 3) limited.push({ name: "Stonecunning", ...pb });
  }

  // ── Classes ──────────────────────────────────────────────────────────
  classes.forEach((c, idx) => {
    const lines: string[] = [];
    const linesZh: string[] = [];
    const sub = c.subclass;
    const srdSub = FEATURES.some((f) => f.class.name === c.name && f.subclass?.name === sub);
    for (const f of FEATURES) {
      if (f.class.name !== c.name || featureLevel(f) > c.level) continue;
      if (f.subclass && f.subclass.name !== sub) continue;
      if (SKIP_FEATURES.test(f.name)) continue;
      if (f.subclass && /Spells$/.test(f.name)) {
        for (const name of subclassSpells(f, c.level)) addSpell(name, true);
      }
      lines.push(`${f.name}${f.subclass ? ` (${f.subclass.name})` : ""}. ${f.description.trim()}`);
      linesZh.push(
        `${both(f.name)}${f.subclass ? `（${zh(f.subclass.name)}）` : ""}。${(TEXT_ZH[f.index] ?? f.description).trim()}`,
      );
    }
    if (sub && !srdSub && c.level >= 3) {
      lines.push(
        `${sub}. This subclass isn't in the free SRD rules, so its features aren't filled in automatically — add them from your book.`,
      );
      linesZh.push(`${both(sub)}。此子職業不在免費 SRD 規則內，無法自動填入特性——請依你的規則書自行加入。`);
    }
    if (!FEATURES.some((f) => f.class.name === c.name)) {
      lines.push(`${c.name} isn't in the free SRD rules — add its features from your book.`);
      linesZh.push(`${both(c.name)}不在免費 SRD 規則內——請依你的規則書自行加入特性。`);
    }
    featureTextZh.push(
      `── ${zh(c.name)}${sub ? `（${zh(sub)}）` : ""} ${c.level} 級 ──\n\n${linesZh.join("\n\n")}`,
    );
    featureText.push(`── ${c.name}${sub ? ` (${sub})` : ""} ${c.level} ──\n\n${lines.join("\n\n")}`);

    // Limited-use features from the class table.
    const row = classLevelRow(c.name, c.level);
    const cs = (row?.class_specific ?? {}) as Record<string, number>;
    const L = c.level;
    switch (c.name) {
      case "Barbarian":
        limited.push({ name: "Rage", max: cs.rage_count ?? 2, rec: "LR" });
        break;
      case "Bard":
        limited.push({ name: "Bardic Inspiration", max: Math.max(1, m("cha")), rec: L >= 5 ? "SR" : "LR" });
        break;
      case "Cleric":
        if (cs.channel_divinity_charges) limited.push({ name: "Channel Divinity", max: cs.channel_divinity_charges, rec: "SR" });
        break;
      case "Paladin":
        limited.push({ name: "Lay on Hands (HP pool)", max: 5 * L, rec: "LR" });
        if (cs.channel_divinity_charges) limited.push({ name: "Channel Divinity", max: cs.channel_divinity_charges, rec: "SR" });
        break;
      case "Druid":
        if (cs.wild_shape_uses) limited.push({ name: "Wild Shape", max: cs.wild_shape_uses, rec: "SR" });
        break;
      case "Fighter":
        limited.push({ name: "Second Wind", max: cs.second_wind_uses ?? 2, rec: "SR" });
        if (L >= 2) limited.push({ name: "Action Surge", max: L >= 17 ? 2 : 1, rec: "SR" });
        if (L >= 9) limited.push({ name: "Indomitable", max: L >= 17 ? 3 : L >= 13 ? 2 : 1, rec: "LR" });
        break;
      case "Monk":
        if (cs.focus_points) limited.push({ name: "Focus Points", max: cs.focus_points, rec: "SR" });
        break;
      case "Sorcerer":
        if (cs.sorcery_points) limited.push({ name: "Sorcery Points", max: cs.sorcery_points, rec: "LR" });
        limited.push({ name: "Innate Sorcery", max: 2, rec: "LR" });
        break;
      case "Wizard":
        limited.push({ name: "Arcane Recovery", max: 1, rec: "LR" });
        break;
      case "Warlock":
        if (L >= 2) limited.push({ name: "Magical Cunning", max: 1, rec: "LR" });
        break;
      case "Ranger":
        limited.push({ name: "Favored Enemy (Hunter's Mark)", max: cs.favored_enemies ?? 2, rec: "LR" });
        addSpell("Hunter's Mark", true);
        break;
    }

    // Spells: recommended cantrips and prepared spells up to what this
    // class level allows.
    const core = classCore(c.name);
    const sc = row?.spellcasting;
    if (core?.spellAbility && sc) {
      const maxLevel = Math.max(0, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((l) => (sc[`spell_slots_level_${l}`] ?? 0) > 0));
      const list = SRD_SPELLS.filter(
        (s) => SPELL_DB[s.name] && s.classes.some((k) => k.name === c.name),
      );
      const picks = PICKS[c.name] ?? { cantrips: [], spells: [] };
      const ordered = (lvlOk: (l: number) => boolean, preferred: string[]) => {
        const pool = list.filter((s) => lvlOk(s.level));
        const names = pool.map((s) => s.name);
        const fromPicks = preferred.filter((n) => names.includes(n));
        // Fill gaps highest level first so the slots you have get used.
        const rest = pool
          .filter((s) => !fromPicks.includes(s.name))
          .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))
          .map((s) => s.name);
        return [...fromPicks, ...rest];
      };
      const take = (names: string[], count: number) => {
        let n = 0;
        for (const name of names) {
          if (n >= count) break;
          if (spells.has(name)) continue;
          addSpell(name, true);
          n++;
        }
      };
      take(ordered((l) => l === 0, picks.cantrips), sc.cantrips_known ?? 0);
      if (maxLevel > 0) take(ordered((l) => l >= 1 && l <= maxLevel, picks.spells), sc.prepared_spells ?? 0);

      // Damage cantrips become attack rows.
      const atk = prof + m(core.spellAbility);
      const dc = 8 + atk;
      const dice = total >= 17 ? 4 : total >= 11 ? 3 : total >= 5 ? 2 : 1;
      for (const [name, info] of Object.entries(ATTACK_CANTRIPS)) {
        if (!spells.has(name) || attacks.some((a) => a.name.startsWith(name))) continue;
        const count = name === "Eldritch Blast" ? 1 : dice;
        attacks.push({
          name: info.save ? `${name} (${info.save.toUpperCase()} save DC ${dc})` : name,
          bonus: info.save ? "" : fmt(atk),
          dmg: `${count}${info.die} ${info.type}${name === "Eldritch Blast" && dice > 1 ? ` ×${dice} beams` : ""}`,
        });
      }
      if (idx === 0 || !patch.spellability) {
        patch.spellability = core.spellAbility;
        patch.spellclass = c.name;
      }
    }
  });
  patch.features = featureText.join("\n\n");
  patch["features-zh"] = featureTextZh.join("\n\n");

  // ── Proficiencies (first class gives the full set) ──────────────────
  const first = CLASSES.find((k) => k.name === classes[0]?.name);
  const profs = (first?.proficiencies ?? []).map((p) => p.name).filter((n) => !n.startsWith("Saving Throw"));
  const armor = profs.filter((p) => /Armor|Shields/.test(p));
  const weapons = profs.filter((p) => /Weapons/.test(p));
  const tools = profs.filter((p) => !armor.includes(p) && !weapons.includes(p));
  patch.proficiencies = [
    `Armor: ${armor.join(", ") || "None"}`,
    `Weapons: ${weapons.join(", ") || "None"}`,
    tools.length ? `Tools: ${tools.join(", ")}` : "",
    "Languages: Common, plus two of your choice",
  ]
    .filter(Boolean)
    .join("\n");
  const zhList = (xs: string[]) => xs.map((x) => PROF_ZH[x] ?? zh(x)).join("、");
  patch["proficiencies-zh"] = [
    `護甲：${zhList(armor) || "無"}`,
    `武器：${zhList(weapons) || "無"}`,
    tools.length ? `工具：${zhList(tools)}` : "",
    "語言：通用語，另選兩種",
  ]
    .filter(Boolean)
    .join("\n");

  // ── Weapon + unarmed strike ──────────────────────────────────────────
  const w = WEAPONS[classes[0]?.name ?? ""];
  if (w) {
    const ab = w.ranged ? m("dex") : w.finesse ? Math.max(m("str"), m("dex")) : m("str");
    attacks.unshift({ name: w.name, bonus: fmt(prof + ab), dmg: `${w.dmg}${ab ? fmt(ab) : ""} ${w.type}` });
  }
  const monk = classes.find((c) => c.name === "Monk");
  if (monk) {
    const die = (classLevelRow("Monk", monk.level)?.class_specific?.martial_arts_die as string) ?? "1d6";
    const ab = Math.max(m("str"), m("dex"));
    attacks.push({ name: "Unarmed Strike (Martial Arts)", bonus: fmt(prof + ab), dmg: `${die}${fmt(ab)} bludgeoning` });
  } else {
    attacks.push({ name: "Unarmed Strike", bonus: fmt(prof + m("str")), dmg: `${Math.max(1, 1 + m("str"))} bludgeoning` });
  }
  for (let i = 0; i < 5; i++) {
    const a = attacks[i];
    patch[`atkname-${i}`] = a?.name ?? "";
    patch[`atkbonus-${i}`] = a?.bonus ?? "";
    patch[`atkdmg-${i}`] = a?.dmg ?? "";
  }

  // ── Limited features ─────────────────────────────────────────────────
  for (let i = 0; i < 16; i++) {
    const f = limited[i];
    patch[`lfname-${i}`] = f?.name ?? "";
    patch[`lfmax-${i}`] = f ? String(f.max) : "";
    patch[`lfrec-${i}`] = f?.rec ?? "";
    patch[`lfused-${i}`] = f ? "0" : "";
  }

  // ── Spell list ───────────────────────────────────────────────────────
  const entries: Record<string, { name: string; prep: boolean }[]> = {};
  for (const [name, s] of [...spells.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    (entries[String(s.level)] ??= []).push({ name, prep: s.prep });
  }
  patch.spellEntries = entries;

  return patch;
}
