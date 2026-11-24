// Spell sound effects: casting a spell plays /sounds/<Spell Name>.mp3
// (e.g. public/sounds/Fireball.mp3). Drop in more files to add sounds;
// spells without one stay silent. Misses are remembered so a missing
// file is only requested once per session.

const missing = new Set<string>();

export function playSpellSound(spellName: string) {
  if (typeof window === "undefined" || missing.has(spellName)) return;
  const audio = new Audio(`/sounds/${encodeURIComponent(spellName)}.mp3`);
  audio.addEventListener("error", () => missing.add(spellName), { once: true });
  audio.play().catch(() => {
    // 404 or autoplay blocked — stay silent
  });
}
