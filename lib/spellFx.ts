// Spell visual effects. Casting a spell calls playSpellFx(name); the sheet's
// <SpellFxLayer> listens and plays the effect. A file at
// public/vfx/<Spell Name>.webm (transparent video) takes priority; otherwise
// spells listed in BUILT_IN get the built-in animated effect.

export type BuiltInFx = "fireball";

const BUILT_IN: Record<string, BuiltInFx> = {
  Fireball: "fireball",
  "Delayed Blast Fireball": "fireball",
  "Meteor Swarm": "fireball",
};

export const SPELL_FX_EVENT = "spell-fx";

export type SpellFxDetail = { spell: string; builtIn: BuiltInFx | null };

export function playSpellFx(spell: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SpellFxDetail>(SPELL_FX_EVENT, {
      detail: { spell, builtIn: BUILT_IN[spell] ?? null },
    }),
  );
}

export const vfxUrl = (spell: string) => `/vfx/${encodeURIComponent(spell)}.webm`;
