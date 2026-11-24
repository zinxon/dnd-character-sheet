// Race (species) choices for the race dropdown, from the SRD data in
// data/en/5e-SRD-Species.json and 5e-SRD-Subspecies.json. A lineage is stored
// as "Species (Lineage)", e.g. "Elf (High Elf)" or "Dragonborn (Red)".

import species from "@/data/en/5e-SRD-Species.json";
import subspecies from "@/data/en/5e-SRD-Subspecies.json";

type Named = { name: string };
type Sub = { name: string; species: Named };

export type SpeciesGroup = { species: string; options: string[] };

// "Elven Lineage: High Elf" → "High Elf"
const lineage = (name: string) => name.split(":").pop()!.trim();

export const SPECIES_GROUPS: SpeciesGroup[] = (species as Named[]).map(({ name }) => ({
  species: name,
  options: [
    name,
    ...(subspecies as Sub[])
      .filter((s) => s.species.name === name)
      .map((s) => `${name} (${lineage(s.name)})`),
  ],
}));

export const isKnownSpecies = (value: string) =>
  SPECIES_GROUPS.some((g) => g.options.includes(value));
