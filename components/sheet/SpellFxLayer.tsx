"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SPELL_FX_EVENT, type BuiltInFx, type SpellFxDetail } from "@/lib/spellFx";

type Play = SpellFxDetail & { id: number; useVideo: boolean };
type Cast = { id: number; kind: "fire" };

// Time from the fireball leaving the caster to the explosion.
const FIREBALL_FLIGHT_MS = 560;

// Plays spell effects on cast. Built-in effects live in a click-through
// full-screen layer; videos are separate top-level elements so their
// `mix-blend-mode: screen` blends with the sheet underneath (inside the
// layer's own stacking context they would only blend with empty space).
// With a character portrait, the portrait appears as the caster: a Fireball
// is hurled from it before exploding, Shocking Grasp springs from it.
export function SpellFxLayer({ portrait = "" }: { portrait?: string }) {
  const [plays, setPlays] = useState<Play[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const reduced = useReducedMotion();
  const reducedRef = useRef(false);
  reducedRef.current = Boolean(reduced);
  const portraitRef = useRef(portrait);
  portraitRef.current = portrait;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onFx = (e: Event) => {
      const d = (e as CustomEvent<SpellFxDetail>).detail;
      const play = () =>
        setPlays((p) => [...p, { ...d, id: Date.now() + Math.random(), useVideo: Boolean(d.video) && !reducedRef.current }]);
      if (d.builtIn === "fireball" && portraitRef.current && !reducedRef.current) {
        setCasts((c) => [...c, { id: Date.now() + Math.random(), kind: "fire" }]);
        timers.push(setTimeout(play, FIREBALL_FLIGHT_MS));
      } else {
        play();
      }
    };
    window.addEventListener(SPELL_FX_EVENT, onFx);
    return () => {
      window.removeEventListener(SPELL_FX_EVENT, onFx);
      timers.forEach(clearTimeout);
    };
  }, []);

  const done = (id: number) => setPlays((p) => p.filter((x) => x.id !== id));
  const castDone = (id: number) => setCasts((c) => c.filter((x) => x.id !== id));
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
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[96] overflow-hidden">
        <AnimatePresence>
          {casts.map((c) => (
            <FireballCaster key={c.id} portrait={portrait} onDone={() => castDone(c.id)} />
          ))}
          {plays
            .filter((play) => !play.useVideo && play.builtIn)
            .map((play) => (
              <BuiltIn
                key={play.id}
                kind={play.builtIn!}
                portrait={portrait}
                reduced={Boolean(reduced)}
                onDone={() => done(play.id)}
              />
            ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function BuiltIn({
  kind,
  portrait,
  reduced,
  onDone,
}: {
  kind: BuiltInFx;
  portrait: string;
  reduced: boolean;
  onDone: () => void;
}) {
  if (kind === "fireball") return <Fireball reduced={reduced} onDone={onDone} />;
  if (kind === "shock") return <ShockingGrasp portrait={portrait} reduced={reduced} onDone={onDone} />;
  if (kind === "bolt") return <LightningBolt portrait={portrait} reduced={reduced} onDone={onDone} />;
  return null;
}

// The character as caster: their portrait springs in as a glowing
// medallion (bottom-left), then hurls a comet-like fireball to the centre
// of the screen, where the explosion takes over.
function FireballCaster({ portrait, onDone }: { portrait: string; onDone: () => void }) {
  const [path] = useState(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = w < 768 ? 84 : 128;
    const from = { x: w < 768 ? 24 + size / 2 : 64 + size / 2, y: h - (w < 768 ? 120 : 96) - size / 2 };
    return { size, from, dx: w / 2 - from.x, dy: h / 2 - from.y };
  });
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  const { size, from, dx, dy } = path;
  const launch = 0.28;
  const flight = FIREBALL_FLIGHT_MS / 1000 - launch;

  return (
    <>
      {/* Caster medallion */}
      <motion.div
        className="absolute"
        style={{ left: from.x - size / 2, top: from.y - size / 2, width: size, height: size }}
        initial={{ scale: 0.3, opacity: 0, y: 30 }}
        animate={{ scale: [0.3, 1.08, 1, 1, 0.9], opacity: [0, 1, 1, 1, 0], y: [30, 0, 0, 0, 10] }}
        transition={{ duration: 1.9, times: [0, 0.14, 0.22, 0.75, 1], ease: "easeOut" }}
      >
        {/* Fiery aura pulsing behind the portrait */}
        <motion.span
          className="absolute -inset-[30%] rounded-full"
          style={{ background: "radial-gradient(circle, #ffb34799 0%, #ff6b1a55 40%, transparent 70%)" }}
          animate={{ scale: [0.8, 1.15, 0.95, 1.1], opacity: [0.6, 1, 0.8, 0.5] }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute -inset-1 rounded-full border-2 border-dashed border-orange-300/80"
          animate={{ rotate: 120 }}
          transition={{ duration: 1.9, ease: "linear" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
        <img
          src={portrait}
          alt=""
          className="relative size-full rounded-full border-4 border-orange-400 object-cover shadow-[0_0_30px_8px_#ff7a1a88]"
        />
        {/* Recoil flash as the fireball is thrown */}
        <motion.span
          className="absolute inset-0 rounded-full bg-orange-200 mix-blend-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 0.9, 0] }}
          transition={{ duration: 0.5, times: [0, 0.5, 0.6, 1] }}
        />
      </motion.div>

      {/* Fireball projectile with a fading comet trail */}
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: from.x,
            top: from.y,
            width: 44 - i * 8,
            height: 44 - i * 8,
            marginLeft: -(22 - i * 4),
            marginTop: -(22 - i * 4),
            background: "radial-gradient(circle at 40% 35%, #fffbe0, #ffd23f 35%, #ff7a1a 65%, #c4280b)",
            boxShadow: i === 0 ? "0 0 24px 10px #ff7a1a99" : undefined,
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{ x: [0, 0, dx], y: [0, 0, dy], scale: [0, 1, 1.25], opacity: [0, 1 - i * 0.2, 1 - i * 0.2] }}
          transition={{ duration: launch + flight, times: [0, launch / (launch + flight), 1], delay: i * 0.035, ease: "easeIn" }}
        />
      ))}
    </>
  );
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
// With a portrait, the caster medallion sits just behind the hand point.
const CASTER = { x: 168, y: 424, r: 50 };
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

function ShockingGrasp({ portrait, reduced, onDone }: { portrait: string; reduced: boolean; onDone: () => void }) {
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
        <CasterMedallion id="shock" portrait={portrait} cx={CASTER.x} cy={CASTER.y} r={CASTER.r} total={TOTAL} />

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

// ── Shared: the character as caster (SVG) ─────────────────────────────
// Portrait medallion that springs in, shimmers as the spell is released and
// fades at the end. Without a portrait it is just an electric glow, so the
// spell still has a visible source. `total` is the effect length in seconds.
function CasterMedallion({
  id,
  portrait,
  cx,
  cy,
  r,
  total,
  ring = ELECTRIC.hot,
  aura = `url(#${"caster-aura"})`,
  releaseAt = 0.3,
}: {
  id: string;
  portrait: string;
  cx: number;
  cy: number;
  r: number;
  total: number;
  ring?: string;
  aura?: string;
  releaseAt?: number;
}) {
  const clip = `${id}-caster-clip`;
  const origin = { originX: `${cx}px`, originY: `${cy}px`, transformBox: "view-box" as const };
  return (
    <motion.g
      style={origin}
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: [0.3, 1.08, 1, 1, 0.92], opacity: [0, 1, 1, 1, 0] }}
      transition={{ duration: total, times: [0, 0.14, 0.22, 0.82, 1], ease: "easeOut" }}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <radialGradient id="caster-aura">
          <stop offset="0%" stopColor={ELECTRIC.core} />
          <stop offset="35%" stopColor={ELECTRIC.hot} />
          <stop offset="70%" stopColor={ELECTRIC.glow} stopOpacity={0.6} />
          <stop offset="100%" stopColor={ELECTRIC.deep} stopOpacity={0} />
        </radialGradient>
      </defs>
      <motion.circle
        cx={cx}
        cy={cy}
        r={r + 16}
        fill={aura}
        style={origin}
        animate={{ scale: [0.9, 1.15, 1, 1.1, 1], opacity: [0.4, 0.8, 0.55, 0.7, 0.5] }}
        transition={{ duration: total, ease: "easeInOut" }}
      />
      {portrait ? (
        <image
          href={portrait}
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clip})`}
        />
      ) : (
        <circle cx={cx} cy={cy} r={r * 0.55} fill={ELECTRIC.hot} opacity={0.8} />
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={3} />
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill={ELECTRIC.glow}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.5, 0, 0.25, 0] }}
        transition={{
          duration: releaseAt + 0.5,
          times: [0, releaseAt, releaseAt + 0.08, releaseAt + 0.2, releaseAt + 0.28, releaseAt + 0.5].map((t) => t / (releaseAt + 0.5)),
        }}
      />
    </motion.g>
  );
}

// ── Lightning Bolt ────────────────────────────────────────────────────
// "A stroke of lightning forming a line 100 feet long and 5 feet wide blasts
// out from you." Energy gathers into the caster → a beam blasts across the
// whole screen with lightning cores inside → each creature in the line is hit
// → flammable things along the line ignite → beam narrows and fades.

const BOLT = { x: 120, y: 330, r: 52 };
const LINE = { from: BOLT.x + BOLT.r - 4, to: 1060, y: BOLT.y, width: 26 };
const HITS = [430, 640, 850];
const FIRES = [300, 520, 740, 930];

function LightningBolt({ portrait, reduced, onDone }: { portrait: string; reduced: boolean; onDone: () => void }) {
  // Timed to public/sounds/Lightning Bolt.mp3: crackles while charging,
  // thunder peak at ~0.8s — the beam fires on it.
  const TOTAL = 2.15;
  const BLAST = 0.75;
  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 700 : TOTAL * 1000 + 100);
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  if (reduced) {
    return (
      <motion.div
        className="absolute inset-0"
        style={{ background: `linear-gradient(90deg, ${ELECTRIC.glow}55, transparent 80%)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.7 }}
      />
    );
  }

  const start = { x: LINE.from, y: LINE.y };
  const end = { x: LINE.to, y: LINE.y };
  const cores = [61, 73, 89].map((seed) => boltPath(start, end, seed, 22, 14));
  const gather = Array.from({ length: 14 }, (_, i) => {
    const a = rand(i, 71) * Math.PI * 2;
    const d = 110 + rand(i, 72) * 90;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, delay: 0.08 + rand(i, 73) * (BLAST - 0.38) };
  });
  const hitSparks = HITS.flatMap((hx, h) =>
    Array.from({ length: 8 }, (_, i) => {
      const a = rand(i + h * 10, 81) * Math.PI * 2;
      const d = 30 + rand(i + h * 10, 82) * 50;
      return { hx, x: Math.cos(a) * d, y: Math.sin(a) * d, delay: BLAST + 0.1 + h * 0.06 };
    }),
  );
  const beamOrigin = { originX: `${LINE.from}px`, originY: `${LINE.y}px`, transformBox: "view-box" as const };

  return (
    <>
      {/* White-blue flash across the screen as the bolt fires */}
      <motion.div
        className="absolute inset-0"
        style={{ background: `linear-gradient(90deg, ${ELECTRIC.hot}66, ${ELECTRIC.glow}33 50%, ${ELECTRIC.deep}22)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0] }}
        transition={{ duration: BLAST + 0.45, times: [0, BLAST, BLAST + 0.06, BLAST + 0.45].map((t) => t / (BLAST + 0.45)) }}
      />
      <motion.div
        className="absolute inset-0"
        // Screen shake on the blast
        animate={{ x: [0, 0, -9, 8, -5, 3, 0], y: [0, 0, 4, -5, 3, -1, 0] }}
        transition={{
          duration: BLAST + 0.4,
          times: [0, BLAST, BLAST + 0.06, BLAST + 0.13, BLAST + 0.2, BLAST + 0.3, BLAST + 0.4].map((t) => t / (BLAST + 0.4)),
        }}
      >
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id="bolt-beam" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={ELECTRIC.core} />
              <stop offset="55%" stopColor={ELECTRIC.hot} />
              <stop offset="100%" stopColor={ELECTRIC.glow} stopOpacity={0.5} />
            </linearGradient>
            <radialGradient id="bolt-hit">
              <stop offset="0%" stopColor={ELECTRIC.core} />
              <stop offset="45%" stopColor={ELECTRIC.hot} stopOpacity={0.8} />
              <stop offset="100%" stopColor={ELECTRIC.glow} stopOpacity={0} />
            </radialGradient>
            <radialGradient id="bolt-flame" cx="50%" cy="70%">
              <stop offset="0%" stopColor="#fff3b0" />
              <stop offset="45%" stopColor="#ffb347" />
              <stop offset="100%" stopColor="#e63e11" stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* Energy gathering into the caster */}
          {gather.map((g, i) => (
            <motion.circle
              key={`g${i}`}
              cx={BOLT.x}
              cy={BOLT.y}
              r={3}
              fill={ELECTRIC.hot}
              initial={{ x: g.x, y: g.y, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: [0, 1, 0] }}
              transition={{ duration: 0.38, delay: g.delay, ease: "easeIn" }}
            />
          ))}

          {/* The line: a 5-ft-wide beam blasting out to the edge */}
          <motion.g
            style={beamOrigin}
            initial={{ scaleX: 0, scaleY: 1, opacity: 1 }}
            animate={{ scaleX: [0, 1, 1, 1], scaleY: [1, 1.15, 1, 0], opacity: [1, 1, 0.9, 0] }}
            transition={{ duration: TOTAL - BLAST, delay: BLAST, times: [0, 0.1, 0.55, 1], ease: "easeOut" }}
          >
            <rect x={LINE.from} y={LINE.y - LINE.width * 1.6} width={LINE.to - LINE.from} height={LINE.width * 3.2} fill={ELECTRIC.deep} opacity={0.25} rx={LINE.width} />
            <rect x={LINE.from} y={LINE.y - LINE.width} width={LINE.to - LINE.from} height={LINE.width * 2} fill={ELECTRIC.glow} opacity={0.45} rx={LINE.width} />
            <rect x={LINE.from} y={LINE.y - LINE.width / 2} width={LINE.to - LINE.from} height={LINE.width} fill="url(#bolt-beam)" rx={LINE.width / 2} />
          </motion.g>

          {/* Lightning cores flickering inside the beam */}
          {cores.map((d, i) => {
            const f = flicker(BLAST + 0.02, [i * 0.05, 0.16 + i * 0.05, 0.36 + i * 0.05, 0.6 + i * 0.04], TOTAL);
            return (
              <Bolt
                key={`c${i}`}
                d={d}
                width={i === 0 ? 3.5 : 2.2}
                core={ELECTRIC.core}
                initial={{ opacity: 0 }}
                animate={{ opacity: f.opacity }}
                transition={{ duration: TOTAL, times: f.times, ease: "linear" }}
              />
            );
          })}

          {/* Each creature in the line is struck */}
          {HITS.map((hx, h) => {
            const o = { originX: `${hx}px`, originY: `${LINE.y}px`, transformBox: "view-box" as const };
            const delay = BLAST + 0.06 + h * 0.06;
            return (
              <g key={`hit${h}`}>
                <motion.circle
                  cx={hx}
                  cy={LINE.y}
                  r={46}
                  fill="url(#bolt-hit)"
                  style={o}
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: [0.2, 1.5, 1.9], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.45, delay, ease: "easeOut" }}
                />
                <motion.circle
                  cx={hx}
                  cy={LINE.y}
                  r={30}
                  fill="none"
                  stroke={ELECTRIC.glow}
                  strokeWidth={2.5}
                  style={o}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 2.8, opacity: [0, 0.9, 0] }}
                  transition={{ duration: 0.55, delay: delay + 0.04, ease: "easeOut" }}
                />
                {[0, 1].map((k) => {
                  const arc = arcAround({ x: hx, y: LINE.y }, 90 + h * 7 + k, 52);
                  const f = flicker(delay + 0.12 + k * 0.08, [0, 0.2], TOTAL);
                  return (
                    <Bolt
                      key={k}
                      d={arc}
                      width={1.6}
                      core={ELECTRIC.hot}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: f.opacity }}
                      transition={{ duration: TOTAL, times: f.times, ease: "linear" }}
                    />
                  );
                })}
              </g>
            );
          })}
          {hitSparks.map((p, i) => (
            <motion.circle
              key={`sp${i}`}
              cx={p.hx}
              cy={LINE.y}
              r={2.4}
              fill={ELECTRIC.hot}
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{ x: p.x, y: p.y, opacity: [0, 1, 0] }}
              transition={{ duration: 0.5, delay: p.delay, ease: "easeOut" }}
            />
          ))}

          {/* Flammable things along the line catch fire */}
          {FIRES.map((fx, i) => {
            const fy = LINE.y + (i % 2 ? 34 : -30);
            const o = { originX: `${fx}px`, originY: `${fy + 14}px`, transformBox: "view-box" as const };
            const delay = BLAST + 0.3 + i * 0.07;
            return (
              <g key={`f${i}`}>
                <motion.ellipse
                  cx={fx}
                  cy={fy}
                  rx={14}
                  ry={22}
                  fill="url(#bolt-flame)"
                  style={o}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: [0, 1.1, 0.85, 1.05, 0.9, 0], scaleX: [1, 0.9, 1.05, 0.92, 1, 0.8], opacity: [0, 1, 1, 1, 0.8, 0] }}
                  transition={{ duration: TOTAL - delay, delay, ease: "easeInOut" }}
                />
                {[0, 1, 2].map((k) => (
                  <motion.circle
                    key={k}
                    cx={fx + (rand(i * 3 + k, 95) - 0.5) * 16}
                    cy={fy}
                    r={1.8}
                    fill="#ffd23f"
                    initial={{ y: 0, opacity: 0 }}
                    animate={{ y: -40 - rand(i * 3 + k, 96) * 30, opacity: [0, 1, 0] }}
                    transition={{ duration: 0.8, delay: delay + 0.15 + k * 0.12, ease: "easeOut" }}
                  />
                ))}
              </g>
            );
          })}

          {/* The caster */}
          <CasterMedallion id="bolt" portrait={portrait} cx={BOLT.x} cy={BOLT.y} r={BOLT.r} total={TOTAL} releaseAt={BLAST} />
        </svg>
      </motion.div>
    </>
  );
}
