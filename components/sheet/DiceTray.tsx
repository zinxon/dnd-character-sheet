"use client";

import { useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { parseDice } from "@/lib/sheet";
import { cn } from "@/lib/utils";

export type DiceGroup = { count: number; faces: number };
type RollPoolFn = (groups: DiceGroup[], bonus: number, label: string) => void;

const DICE = [20, 12, 100, 10, 8, 6, 4] as const;

// Tray springs open from the launcher (bottom-left); dice cascade in.
const trayMotion: Variants = {
  closed: { opacity: 0, scale: 0.6, y: 24, transition: { duration: 0.15 } },
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 420, damping: 30, staggerChildren: 0.03, delayChildren: 0.05 },
  },
};
const itemMotion: Variants = {
  closed: { opacity: 0, y: 10, scale: 0.85 },
  open: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 500, damping: 26 } },
};
const MAX_CUSTOM = 8;

// Outline icons for each die (original line art).
function DieIcon({ faces, className }: { faces: number; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const };
  const shapes: Record<number, React.ReactNode> = {
    4: <path d="M16 4 L28 26 H4 Z M16 4 L16 26" {...p} />,
    6: (
      <path d="M16 3 L28 9 V23 L16 29 L4 23 V9 Z M4 9 L16 15 L28 9 M16 15 V29" {...p} />
    ),
    8: <path d="M16 2 L28 16 L16 30 L4 16 Z M4 16 H28 M16 2 L11 16 L16 30 M16 2 L21 16 L16 30" {...p} />,
    10: <path d="M16 2 L29 13 L16 30 L3 13 Z M3 13 L16 18 L29 13 M16 18 V30" {...p} />,
    12: (
      <path d="M16 2 L29 11 L24 27 H8 L3 11 Z M16 8 L22 12.5 L20 20 H12 L10 12.5 Z M16 2 V8 M29 11 L22 12.5 M24 27 L20 20 M8 27 L12 20 M3 11 L10 12.5" {...p} />
    ),
    20: (
      <path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z M16 9 L23 21 H9 Z M16 2 V9 M4 9 L16 9 L28 9 M4 23 L9 21 M28 23 L23 21 M16 30 L9 21 M16 30 L23 21 M4 9 L9 21 M28 9 L23 21" {...p} />
    ),
    100: (
      <g {...p}>
        <path d="M11 4 L20 12 L11 26 L2 12 Z M2 12 L11 16 L20 12 M11 16 V26" />
        <path d="M21 4 L30 12 L21 26 L17 20" />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      {shapes[faces]}
    </svg>
  );
}

// Tidy "4D8 + 2" → "4d8+2"; null when it isn't a single NdM±K roll.
function normalise(raw: string): string | null {
  const expr = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!/^\d*d\d+([+-]\d+)?$/.test(expr)) return null;
  try {
    const { count, faces } = parseDice(expr);
    if (count < 1 || count > 50 || faces < 2 || faces > 1000) return null;
  } catch {
    return null;
  }
  return expr.startsWith("d") ? `1${expr}` : expr;
}

// Floating d20 launcher (bottom-left on every screen size) that opens a
// dice tray: tap dice to build a pool, add a modifier, then roll. Also holds
// the character's saved custom rolls (e.g. 4d8+2).
export function DiceTray({
  custom,
  onCustomChange,
  rollPool,
}: {
  custom: string[];
  onCustomChange: (next: string[]) => void;
  rollPool: RollPoolFn;
}) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<Record<number, number>>({});
  const [bonus, setBonus] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  // Close on Escape or a click outside the tray.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const groups: DiceGroup[] = DICE.filter((f) => pool[f]).map((f) => ({ count: pool[f], faces: f }));
  const empty = groups.length === 0;
  const reset = () => {
    setPool({});
    setBonus(0);
  };

  const rollNow = () => {
    if (empty) return;
    const label = groups.map((g) => `${g.count}d${g.faces}`).join(" + ") + (bonus ? ` ${bonus > 0 ? "+" : ""}${bonus}` : "");
    rollPool(groups, bonus, label);
    reset();
    setOpen(false);
  };

  const rollCustom = (expr: string) => {
    const { count, faces, bonus: b } = parseDice(expr);
    rollPool([{ count, faces }], b, expr);
    setOpen(false);
  };

  const addCustom = () => {
    const expr = normalise(draft);
    if (!expr) {
      setError("Use a roll like 4d8, 3d6+2 or 2d4.");
      return;
    }
    if (!custom.includes(expr)) onCustomChange([...custom, expr].slice(-MAX_CUSTOM));
    setDraft("");
    setError("");
  };

  return (
    <div ref={panel} className="fixed bottom-4 left-4 z-40">
      <AnimatePresence>
      {open && (
        <motion.div
          key="tray"
          role="dialog"
          aria-label="Roll dice"
          variants={trayMotion}
          initial="closed"
          animate="open"
          exit="closed"
          style={{ transformOrigin: "bottom left" }}
          className="absolute bottom-16 left-0 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-zinc-900 p-4 text-zinc-50 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Roll dice <span className="font-normal text-zinc-400">擲骰</span>
            </h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close dice tray" className="text-zinc-400 hover:text-white">
              <XIcon className="size-5" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {DICE.map((f) => (
              <motion.button
                key={f}
                variants={itemMotion}
                whileTap={{ scale: 0.88 }}
                type="button"
                onClick={() => setPool((p) => ({ ...p, [f]: Math.min(20, (p[f] ?? 0) + 1) }))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setPool((p) => ({ ...p, [f]: Math.max(0, (p[f] ?? 0) - 1) }));
                }}
                aria-label={`Add a d${f}${pool[f] ? ` (${pool[f]} in pool)` : ""}`}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-lg py-2 hover:bg-white/10",
                  pool[f] && "bg-white/10",
                )}
              >
                <DieIcon faces={f} className="size-9" />
                <span className="text-sm font-semibold">d{f}</span>
                <AnimatePresence>
                  {pool[f] ? (
                    <motion.span
                      key={pool[f]}
                      initial={{ scale: 1.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 600, damping: 20 }}
                      className="absolute top-1 right-2 flex size-5 items-center justify-center rounded-full bg-red-600 text-[0.7rem] font-bold"
                    >
                      {pool[f]}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </motion.button>
            ))}
            <motion.div variants={itemMotion} className="flex flex-col items-center justify-center gap-1 rounded-lg py-2">
              <span className="text-[0.65rem] font-semibold tracking-wider text-zinc-400 uppercase">Mod</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setBonus((b) => b - 1)} aria-label="Decrease modifier" className="rounded p-0.5 hover:bg-white/10">
                  <MinusIcon className="size-3.5" />
                </button>
                <span className="w-7 text-center text-sm font-semibold">{bonus >= 0 ? `+${bonus}` : bonus}</span>
                <button type="button" onClick={() => setBonus((b) => b + 1)} aria-label="Increase modifier" className="rounded p-0.5 hover:bg-white/10">
                  <PlusIcon className="size-3.5" />
                </button>
              </div>
            </motion.div>
          </div>

          <p className="mt-2 min-h-5 text-center text-sm text-zinc-300">
            {empty
              ? "Tap dice to add them"
              : groups.map((g) => `${g.count}d${g.faces}`).join(" + ") + (bonus ? ` ${bonus > 0 ? "+" : "−"} ${Math.abs(bonus)}` : "")}
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={empty && !bonus}
              className="rounded-md bg-zinc-700 py-2 text-sm font-semibold tracking-wide uppercase disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={rollNow}
              disabled={empty}
              className="rounded-md bg-red-700 py-2 text-sm font-semibold tracking-wide uppercase hover:bg-red-600 disabled:opacity-40"
            >
              Roll
            </button>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Saved rolls</p>
            {custom.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {custom.map((expr) => (
                  <span key={expr} className="flex items-center rounded-full bg-white/10 text-sm">
                    <button type="button" onClick={() => rollCustom(expr)} className="py-1 pr-1 pl-3 hover:text-white" aria-label={`Roll ${expr}`}>
                      {expr}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCustomChange(custom.filter((c) => c !== expr))}
                      className="rounded-full p-1 text-zinc-400 hover:text-white"
                      aria-label={`Remove ${expr}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                addCustom();
              }}
            >
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError("");
                }}
                placeholder="4d8+2"
                aria-label="New saved roll"
                aria-invalid={Boolean(error)}
                className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm placeholder:text-zinc-500"
              />
              <button type="submit" className="rounded-md bg-white/15 px-3 text-sm font-medium hover:bg-white/25">
                Save
              </button>
            </form>
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close dice tray" : "Open dice tray"}
        aria-expanded={open}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.86 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className="flex size-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg ring-2 ring-white/20 hover:bg-zinc-800"
      >
        {/* The d20 spins a third of a turn as the tray opens/closes. */}
        <motion.span
          animate={{ rotate: open ? 120 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="flex"
        >
          <DieIcon faces={20} className="size-8" />
        </motion.span>
      </motion.button>
    </div>
  );
}
