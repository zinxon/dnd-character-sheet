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
  if (kind === "shock") return <ShockingGrasp reduced={reduced} onDone={onDone} />;
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

// ── Shocking Grasp ────────────────────────────────────────────────────
// Lightning springs from the caster's hand into the creature they touch.
// Charge at the hand → jagged bolt to the target → impact flash, shock
// rings and sparks → static crackling on the target, then fade.

const HAND = { x: 210, y: 400 };
const TARGET = { x: 790, y: 230 };
const ELECTRIC = { core: "#ffffff", hot: "#bae6fd", glow: "#38bdf8", deep: "#6366f1" };

// Jagged polyline between two points; deterministic per seed.
function boltPath(from: { x: number; y: number }, to: { x: number; y: number }, seed: number, segments = 12, jitter = 38) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M ${from.x} ${from.y}`;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const taper = Math.sin(Math.PI * t);
    const off = (rand(i, seed) - 0.5) * 2 * jitter * taper;
    d += ` L ${(from.x + dx * t + nx * off).toFixed(1)} ${(from.y + dy * t + ny * off).toFixed(1)}`;
  }
  return `${d} L ${to.x} ${to.y}`;
}

// A short arc crackling around a point.
function arcAround(c: { x: number; y: number }, seed: number, r: number) {
  const a = rand(seed, 31) * Math.PI * 2;
  const from = { x: c.x + Math.cos(a) * r * 0.3, y: c.y + Math.sin(a) * r * 0.3 };
  const to = { x: c.x + Math.cos(a + 0.9) * r, y: c.y + Math.sin(a + 0.9) * r };
  return boltPath(from, to, seed + 7, 5, r * 0.25);
}

// Visible only in its own slice of the timeline → bolts that flicker
// between shapes like real lightning.
function flicker(start: number, slots: number[], total: number) {
  const times = [0];
  const opacity = [0];
  for (const t of slots) {
    times.push((start + t) / total, (start + t + 0.04) / total);
    opacity.push(1, 0);
  }
  times.push(1);
  opacity.push(0);
  return { times, opacity };
}

// A lightning stroke with a glow made of layered strokes (a wide faint blue
// halo under a thin bright core) — far cheaper than an SVG blur filter.
function Bolt({
  d,
  width,
  core = ELECTRIC.core,
  ...motionProps
}: { d: string; width: number; core?: string } & React.ComponentProps<typeof motion.g>) {
  return (
    <motion.g {...motionProps}>
      <path d={d} fill="none" stroke={ELECTRIC.deep} strokeOpacity={0.35} strokeWidth={width * 5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={ELECTRIC.glow} strokeOpacity={0.6} strokeWidth={width * 2.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={core} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </motion.g>
  );
}

function ShockingGrasp({ reduced, onDone }: { reduced: boolean; onDone: () => void }) {
  const TOTAL = 1.4;
  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 700 : TOTAL * 1000 + 100);
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  if (reduced) {
    return (
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 60% 45%, ${ELECTRIC.glow}55, transparent 60%)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.7 }}
      />
    );
  }

  const mainBolts = [11, 23, 37].map((seed) => boltPath(HAND, TARGET, seed));
  const branches = [5, 9].map((seed, i) => {
    const mid = { x: HAND.x + (TARGET.x - HAND.x) * (0.45 + i * 0.15), y: HAND.y + (TARGET.y - HAND.y) * (0.45 + i * 0.15) };
    const end = { x: mid.x + 60 + rand(seed, 2) * 80, y: mid.y + (i ? -1 : 1) * (70 + rand(seed, 3) * 60) };
    return boltPath(mid, end, seed + 40, 6, 18);
  });
  const handArcs = [1, 2, 3, 4].map((seed) => arcAround(HAND, seed, 46));
  const targetArcs = [5, 6, 7, 8, 9, 10].map((seed) => arcAround(TARGET, seed, 70));
  const sparks = Array.from({ length: 16 }, (_, i) => {
    const a = rand(i, 51) * Math.PI * 2;
    const d = 70 + rand(i, 52) * 110;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, delay: 0.42 + rand(i, 53) * 0.08 };
  });

  return (
    <>
      {/* Screen-wide electric tint on impact */}
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 62% 40%, ${ELECTRIC.glow}40, ${ELECTRIC.deep}22 45%, transparent 75%)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0] }}
        transition={{ duration: 0.9, times: [0, 0.3, 0.45, 1] }}
      />
      <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full">
        {/* Rune circle at the hand */}
        <motion.g
          style={{ originX: `${HAND.x}px`, originY: `${HAND.y}px`, transformBox: "view-box" }}
          initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{ opacity: [0, 0.9, 0.9, 0], scale: [0.4, 1, 1.05, 1.2], rotate: 90 }}
          transition={{ duration: 0.9, times: [0, 0.25, 0.6, 1], ease: "easeOut" }}
        >
          <circle cx={HAND.x} cy={HAND.y} r={58} fill="none" stroke={ELECTRIC.glow} strokeWidth={1.5} strokeDasharray="4 7" />
          <circle cx={HAND.x} cy={HAND.y} r={44} fill="none" stroke={ELECTRIC.hot} strokeWidth={1} opacity={0.7} />
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <path
                key={i}
                d={`M ${HAND.x + Math.cos(a) * 44} ${HAND.y + Math.sin(a) * 44} L ${HAND.x + Math.cos(a + 0.2) * 58} ${HAND.y + Math.sin(a + 0.2) * 58}`}
                stroke={ELECTRIC.hot}
                strokeWidth={1.5}
              />
            );
          })}
        </motion.g>

        {/* Charge glow in the hand */}
        <motion.circle
          cx={HAND.x}
          cy={HAND.y}
          r={34}
          fill="url(#shock-orb)"
          style={{ originX: `${HAND.x}px`, originY: `${HAND.y}px`, transformBox: "view-box" }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 1.3, 0.6], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.8, times: [0, 0.3, 0.45, 1], ease: "easeOut" }}
        />

        {/* Crackle around the fingers while charging */}
        <g>
          {handArcs.map((d, i) => {
            const f = flicker(0.04 + i * 0.05, [0, 0.12], TOTAL);
            return (
              <Bolt
                key={`h${i}`}
                d={d}
                width={2}
                core={ELECTRIC.hot}
                initial={{ opacity: 0 }}
                animate={{ opacity: f.opacity }}
                transition={{ duration: TOTAL, times: f.times, ease: "linear" }}
              />
            );
          })}
        </g>

        {/* Main bolt: drawn from hand to target, then flickers between shapes */}
        <g>
          <motion.path
            d={mainBolts[0]}
            fill="none"
            stroke={ELECTRIC.glow}
            strokeOpacity={0.55}
            strokeWidth={14}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 1 }}
            animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
            transition={{ duration: 0.38, delay: 0.24, times: [0, 0.4, 1], ease: "easeOut" }}
          />
          <motion.path
            d={mainBolts[0]}
            fill="none"
            stroke={ELECTRIC.core}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 1 }}
            animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
            transition={{ duration: 0.38, delay: 0.24, times: [0, 0.4, 1], ease: "easeOut" }}
          />
          {mainBolts.map((d, i) => {
            const f = flicker(0.36, [i * 0.05, 0.16 + i * 0.05], TOTAL);
            return (
              <Bolt
                key={`m${i}`}
                d={d}
                width={i === 0 ? 3.5 : 2.5}
                core={i === 0 ? ELECTRIC.core : ELECTRIC.hot}
                initial={{ opacity: 0 }}
                animate={{ opacity: f.opacity }}
                transition={{ duration: TOTAL, times: f.times, ease: "linear" }}
              />
            );
          })}
          {branches.map((d, i) => (
            <motion.path
              key={`b${i}`}
              d={d}
              fill="none"
              stroke={ELECTRIC.hot}
              strokeWidth={1.8}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: [0, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 0.3, delay: 0.32 + i * 0.05, ease: "easeOut" }}
            />
          ))}
        </g>

        {/* Impact: flash and shock rings on the target */}
        <motion.circle
          cx={TARGET.x}
          cy={TARGET.y}
          r={60}
          fill="url(#shock-flash)"
          style={{ originX: `${TARGET.x}px`, originY: `${TARGET.y}px`, transformBox: "view-box" }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.6, 2], opacity: [0, 1, 0] }}
          transition={{ duration: 0.45, delay: 0.36, ease: "easeOut" }}
        />
        {[0, 0.1].map((delay, i) => (
          <motion.circle
            key={`r${i}`}
            cx={TARGET.x}
            cy={TARGET.y}
            r={40}
            fill="none"
            stroke={i ? ELECTRIC.deep : ELECTRIC.glow}
            strokeWidth={3}
            style={{ originX: `${TARGET.x}px`, originY: `${TARGET.y}px`, transformBox: "view-box" }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 3.2, opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.6, delay: 0.38 + delay, ease: "easeOut" }}
          />
        ))}

        {/* Sparks thrown off the target */}
        {sparks.map((p, i) => (
          <motion.circle
            key={`s${i}`}
            cx={TARGET.x}
            cy={TARGET.y}
            r={2.6}
            fill={ELECTRIC.hot}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: p.x, y: p.y, opacity: [0, 1, 0] }}
            transition={{ duration: 0.55, delay: p.delay, ease: "easeOut" }}
          />
        ))}

        {/* Lingering static: no reactions until its next turn */}
        <g>
          {targetArcs.map((d, i) => {
            const f = flicker(0.62 + (i % 3) * 0.06, [0, 0.18, 0.4], TOTAL);
            return (
              <Bolt
                key={`t${i}`}
                d={d}
                width={1.8}
                core={i % 2 ? ELECTRIC.glow : ELECTRIC.hot}
                initial={{ opacity: 0 }}
                animate={{ opacity: f.opacity }}
                transition={{ duration: TOTAL, times: f.times, ease: "linear" }}
              />
            );
          })}
        </g>

        <defs>
          <radialGradient id="shock-orb">
            <stop offset="0%" stopColor={ELECTRIC.core} />
            <stop offset="35%" stopColor={ELECTRIC.hot} />
            <stop offset="70%" stopColor={ELECTRIC.glow} stopOpacity={0.6} />
            <stop offset="100%" stopColor={ELECTRIC.deep} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="shock-flash">
            <stop offset="0%" stopColor={ELECTRIC.core} />
            <stop offset="40%" stopColor={ELECTRIC.hot} stopOpacity={0.8} />
            <stop offset="100%" stopColor={ELECTRIC.glow} stopOpacity={0} />
          </radialGradient>
        </defs>
      </svg>
    </>
  );
}
