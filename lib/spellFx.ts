// Spell visual effects. Casting a spell calls playSpellFx(name); the sheet's
// <SpellFxLayer> listens and plays the effect:
//  1. a video listed in VIDEO_FX (public/vfx/<file>.webm), else
//  2. the built-in animated effect listed in BUILT_IN, else nothing.
// Videos are drawn with `mix-blend-mode: screen`, so a pure-black background
// disappears and only the bright effect shows — no alpha channel needed.

export type BuiltInFx = "fireball";

const BUILT_IN: Record<string, BuiltInFx> = {
  Fireball: "fireball",
  "Delayed Blast Fireball": "fireball",
  "Meteor Swarm": "fireball",
};

// Spell → video file in public/vfx/. Add a line when you add a file.
const VIDEO_FX: Record<string, string> = {
  Fireball: "Fireball.webm",
};

export const SPELL_FX_EVENT = "spell-fx";

export type SpellFxDetail = { spell: string; builtIn: BuiltInFx | null; video: string | null };

export function playSpellFx(spell: string) {
  if (typeof window === "undefined") return;
  const video = VIDEO_FX[spell] ? `/vfx/${encodeURIComponent(VIDEO_FX[spell])}` : null;
  const builtIn = BUILT_IN[spell] ?? null;
  if (!video && !builtIn) return;
  window.dispatchEvent(
    new CustomEvent<SpellFxDetail>(SPELL_FX_EVENT, { detail: { spell, builtIn, video } }),
  );
}
