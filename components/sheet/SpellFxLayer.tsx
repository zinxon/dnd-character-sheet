"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SPELL_FX_EVENT, type BuiltInFx, type SpellFxDetail } from "@/lib/spellFx";

type Play = SpellFxDetail & { id: number; useVideo: boolean };

// Plays spell effects on cast. Built-in effects live in a click-through
// full-screen layer; videos are separate top-level elements so their
// `mix-blend-mode: screen` blends with the sheet underneath (inside the
// layer's own stacking context they would only blend with empty space).
export function SpellFxLayer() {
  const [plays, setPlays] = useState<Play[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    const onFx = (e: Event) => {
      const d = (e as CustomEvent<SpellFxDetail>).detail;
      setPlays((p) => [...p, { ...d, id: Date.now() + Math.random(), useVideo: Boolean(d.video) && !reducedRef.current }]);
    };
    window.addEventListener(SPELL_FX_EVENT, onFx);
    return () => window.removeEventListener(SPELL_FX_EVENT, onFx);
  }, []);
  // Reduced motion: skip videos, use the gentle built-in fallback.
  const reducedRef = useRef(false);
  reducedRef.current = Boolean(reduced);

  const done = (id: number) => setPlays((p) => p.filter((x) => x.id !== id));
  // A video that can't play falls back to the built-in effect (if any).
  const videoFailed = (play: Play) =>
    setPlays((p) =>
      play.builtIn ? p.map((x) => (x.id === play.id ? { ...x, useVideo: false } : x)) : p.filter((x) => x.id !== play.id),
    );

  return (
    <>
      {plays
        .filter((play) => play.useVideo && play.video)
        .map((play) => (
          <video
            key={play.id}
            aria-hidden
            src={play.video!}
            autoPlay
            muted
            playsInline
            onEnded={() => done(play.id)}
            onError={() => videoFailed(play)}
            className="pointer-events-none fixed top-1/2 left-1/2 z-[95] size-[min(90vw,90vh)] -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-screen"
          />
        ))}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
        <AnimatePresence>
          {plays
            .filter((play) => !play.useVideo && play.builtIn)
            .map((play) => (
              <BuiltIn key={play.id} kind={play.builtIn!} reduced={Boolean(reduced)} onDone={() => done(play.id)} />
            ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function BuiltIn({ kind, reduced, onDone }: { kind: BuiltInFx; reduced: boolean; onDone: () => void }) {
  if (kind === "fireball") return <Fireball reduced={reduced} onDone={onDone} />;
  return null;
}

// Deterministic pseudo-random so the burst shape is stable per render.
function rand(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const FLAME = ["#fff3b0", "#ffd23f", "#ff9f1c", "#ff6b1a", "#e63e11"];

// Original cartoon fireball: white-hot flash → swelling orange core →
// shockwave ring → flame puffs and sparks flung outward → smoke drifting up.
function Fireball({ reduced, onDone }: { reduced: boolean; onDone: () => void }) {
  const size = "min(70vw, 70vh)";
  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 700 : 1800);
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  if (reduced) {
    // Reduced motion: a single soft glow, no movement.
    return (
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 50%, #ff9f1c66, transparent 60%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.7 }}
      />
    );
  }

  const puffs = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + rand(i, 1) * 0.5;
    const dist = 22 + rand(i, 2) * 18; // % of the effect size
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      size: 14 + rand(i, 3) * 14,
      color: FLAME[Math.floor(rand(i, 4) * FLAME.length)],
      delay: 0.05 + rand(i, 5) * 0.12,
    };
  });
  const sparks = Array.from({ length: 18 }, (_, i) => {
    const angle = rand(i, 6) * Math.PI * 2;
    const dist = 40 + rand(i, 7) * 30;
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, delay: rand(i, 8) * 0.1 };
  });
  const smoke = Array.from({ length: 7 }, (_, i) => ({
    x: (rand(i, 9) - 0.5) * 50,
    y: (rand(i, 10) - 0.5) * 30,
    size: 22 + rand(i, 11) * 16,
    delay: 0.35 + rand(i, 12) * 0.25,
  }));

  return (
    <motion.div
      className="absolute top-1/2 left-1/2"
      style={{ width: size, height: size, x: "-50%", y: "-50%" }}
      // Little screen-shake on impact.
      animate={{ translateX: [0, -8, 7, -5, 3, 0], translateY: [0, 5, -6, 3, -2, 0] }}
      transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
    >
      {/* Smoke (behind the fire) */}
      {smoke.map((s, i) => (
        <motion.span
          key={`smoke${i}`}
          className="absolute rounded-full"
          style={{
            left: `${50 + s.x}%`,
            top: `${50 + s.y}%`,
            width: `${s.size}%`,
            height: `${s.size}%`,
            background: "radial-gradient(circle at 40% 35%, #8a8580, #4b4642 70%)",
            translateX: "-50%",
            translateY: "-50%",
          }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1, 1.25], opacity: [0, 0.75, 0], y: ["0%", "-30%", "-70%"] }}
          transition={{ duration: 1.3, delay: s.delay, ease: "easeOut" }}
        />
      ))}

      {/* Shockwave ring */}
      <motion.span
        className="absolute inset-0 rounded-full border-[6px] border-orange-300"
        initial={{ scale: 0.15, opacity: 0.9 }}
        animate={{ scale: 1.5, opacity: 0, borderWidth: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />

      {/* Fireball core */}
      <motion.span
        className="absolute inset-[18%] rounded-full"
        style={{
          background: "radial-gradient(circle at 45% 40%, #fffbe0 0%, #ffd23f 25%, #ff9f1c 50%, #ff5a14 72%, #c4280b 100%)",
          boxShadow: "0 0 60px 20px #ff7a1a88",
        }}
        initial={{ scale: 0.1, opacity: 1 }}
        animate={{ scale: [0.1, 1.15, 1, 0.6], opacity: [1, 1, 0.9, 0] }}
        transition={{ duration: 0.9, times: [0, 0.3, 0.55, 1], ease: "easeOut" }}
      />

      {/* Flame puffs flung outward */}
      {puffs.map((p, i) => (
        <motion.span
          key={`puff${i}`}
          className="absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: `${p.size}%`,
            height: `${p.size}%`,
            background: `radial-gradient(circle at 40% 35%, #fff3b0, ${p.color} 60%)`,
            translateX: "-50%",
            translateY: "-50%",
          }}
          initial={{ x: "0%", y: "0%", scale: 0.2, opacity: 1 }}
          animate={{ x: `${p.x * 4}%`, y: `${p.y * 4}%`, scale: [0.2, 1.1, 0], opacity: [1, 1, 0] }}
          transition={{ duration: 0.85, delay: p.delay, ease: [0.2, 0.8, 0.3, 1] }}
        />
      ))}

      {/* Sparks */}
      {sparks.map((s, i) => (
        <motion.span
          key={`spark${i}`}
          className="absolute size-2 rounded-full bg-yellow-200"
          style={{ left: "50%", top: "50%", boxShadow: "0 0 8px 2px #ffd23f" }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: `${s.x * 6}%`, y: `${s.y * 6}%`, opacity: [1, 1, 0] }}
          transition={{ duration: 0.7, delay: 0.05 + s.delay, ease: "easeOut" }}
        />
      ))}

      {/* White-hot flash */}
      <motion.span
        className="absolute inset-[10%] rounded-full"
        style={{ background: "radial-gradient(circle, #ffffff 0%, #fff6c2 35%, transparent 70%)" }}
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </motion.div>
  );
}
