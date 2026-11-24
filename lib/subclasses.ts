// Subclass choices per class for the subclass dropdown.
// The SRD subclass comes from data/en/5e-SRD-Subclasses.json; the others are
// the official subclass *names* (no rules text) from the Player's Handbook,
// Xanathar's Guide, Tasha's Cauldron and other official books, so players can
// pick what they actually play. Anything else can be typed in as "Custom".

import srd from "@/data/en/5e-SRD-Subclasses.json";

type SrdSubclass = { name: string; class: { name: string } };

const SRD_BY_CLASS: Record<string, string[]> = {};
for (const s of srd as SrdSubclass[]) {
  (SRD_BY_CLASS[s.class.name] ??= []).push(s.name);
}

const OFFICIAL: Record<string, string[]> = {
  Artificer: ["Alchemist", "Armorer", "Artillerist", "Battle Smith"],
  Barbarian: [
    "Path of the Berserker",
    "Path of the Wild Heart",
    "Path of the Totem Warrior",
    "Path of the World Tree",
    "Path of the Zealot",
    "Path of the Ancestral Guardian",
    "Path of the Storm Herald",
    "Path of the Beast",
    "Path of Wild Magic",
    "Path of the Battlerager",
    "Path of the Giant",
  ],
  Bard: [
    "College of Lore",
    "College of Dance",
    "College of Glamour",
    "College of Valor",
    "College of Swords",
    "College of Whispers",
    "College of Creation",
    "College of Eloquence",
    "College of Spirits",
  ],
  Cleric: [
    "Life Domain",
    "Knowledge Domain",
    "Light Domain",
    "Nature Domain",
    "Tempest Domain",
    "Trickery Domain",
    "War Domain",
    "Arcana Domain",
    "Death Domain",
    "Forge Domain",
    "Grave Domain",
    "Order Domain",
    "Peace Domain",
    "Twilight Domain",
  ],
  Druid: [
    "Circle of the Land",
    "Circle of the Moon",
    "Circle of the Sea",
    "Circle of the Stars",
    "Circle of Dreams",
    "Circle of the Shepherd",
    "Circle of Spores",
    "Circle of Wildfire",
  ],
  Fighter: [
    "Champion",
    "Battle Master",
    "Eldritch Knight",
    "Psi Warrior",
    "Arcane Archer",
    "Cavalier",
    "Samurai",
    "Echo Knight",
    "Rune Knight",
    "Purple Dragon Knight",
  ],
  Monk: [
    "Warrior of the Open Hand",
    "Way of the Open Hand",
    "Warrior of Mercy",
    "Warrior of Shadow",
    "Warrior of the Elements",
    "Way of the Four Elements",
    "Way of Shadow",
    "Way of the Drunken Master",
    "Way of the Kensei",
    "Way of the Sun Soul",
    "Way of the Astral Self",
    "Way of Mercy",
    "Way of the Long Death",
    "Way of the Ascendant Dragon",
  ],
  Paladin: [
    "Oath of Devotion",
    "Oath of Glory",
    "Oath of the Ancients",
    "Oath of Vengeance",
    "Oath of Conquest",
    "Oath of Redemption",
    "Oath of the Watchers",
    "Oath of the Crown",
    "Oathbreaker",
  ],
  Ranger: [
    "Hunter",
    "Beast Master",
    "Fey Wanderer",
    "Gloom Stalker",
    "Horizon Walker",
    "Monster Slayer",
    "Swarmkeeper",
    "Drakewarden",
  ],
  Rogue: [
    "Thief",
    "Arcane Trickster",
    "Assassin",
    "Soulknife",
    "Inquisitive",
    "Mastermind",
    "Scout",
    "Swashbuckler",
    "Phantom",
  ],
  Sorcerer: [
    "Draconic Sorcery",
    "Draconic Bloodline",
    "Wild Magic Sorcery",
    "Aberrant Sorcery",
    "Clockwork Sorcery",
    "Divine Soul",
    "Shadow Magic",
    "Storm Sorcery",
    "Lunar Sorcery",
  ],
  Warlock: [
    "Fiend Patron",
    "The Fiend",
    "Archfey Patron",
    "Celestial Patron",
    "Great Old One Patron",
    "The Hexblade",
    "The Fathomless",
    "The Genie",
    "The Undead",
    "The Undying",
  ],
  Wizard: [
    "Evoker",
    "School of Evocation",
    "Abjurer",
    "Diviner",
    "Illusionist",
    "School of Abjuration",
    "School of Conjuration",
    "School of Divination",
    "School of Enchantment",
    "School of Illusion",
    "School of Necromancy",
    "School of Transmutation",
    "Bladesinging",
    "War Magic",
    "Order of Scribes",
    "Chronurgy Magic",
    "Graviturgy Magic",
  ],
};

export type SubclassOption = { name: string; srd: boolean };

// SRD subclass first, then the rest of the official names, no duplicates.
export function subclassOptions(className: string): SubclassOption[] {
  const srdNames = SRD_BY_CLASS[className] ?? [];
  const seen = new Set<string>();
  const out: SubclassOption[] = [];
  for (const name of [...srdNames, ...(OFFICIAL[className] ?? [])]) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, srd: srdNames.includes(name) });
  }
  return out;
}
