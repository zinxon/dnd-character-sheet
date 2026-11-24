// 3D dice via @3d-dice/dice-box (BabylonJS + Ammo physics in a web worker).
// The physics decides the result: rollPhysical() resolves with the face
// values the dice landed on. It resolves null when dice-box can't run
// (no WebGL, assets missing) or the roll was superseded by a newer one,
// so callers can fall back to a plain random roll.

import type DiceBoxType from "@3d-dice/dice-box";

const CONTAINER_ID = "dice-box";
const CLEAR_AFTER_MS = 2500;

let boxPromise: Promise<DiceBoxType | null> | null = null;
let cancelPending: (() => void) | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

// The overlay lives directly on <body>, outside React: if it were a React
// element, a re-render that swaps layouts (phone ↔ desktop) or a hot reload
// would replace it and leave dice-box drawing into a detached canvas.
function ensureContainer(): HTMLElement {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CONTAINER_ID;
    el.setAttribute("aria-hidden", "true");
    // Above dialogs (z-50); never blocks clicks.
    Object.assign(el.style, { position: "fixed", inset: "0", zIndex: "100", pointerEvents: "none" });
  }
  if (!el.isConnected) document.body.appendChild(el);
  return el;
}

function getBox(): Promise<DiceBoxType | null> {
  if (!boxPromise) {
    boxPromise = import("@3d-dice/dice-box")
      .then(async ({ default: DiceBox }) => {
        ensureContainer();
        const box = new DiceBox({
          container: `#${CONTAINER_ID}`,
          assetPath: "/assets/dice-box/",
          theme: "default",
          themeColor: "#7a1f1f",
          // Smaller dice on phones so they stay on screen.
          scale: window.innerWidth < 768 ? 3.5 : 4,
          enableShadows: false,
          gravity: 1.5,
          throwForce: 6,
          spinForce: 5,
          // Settle quickly: the result only arrives once every die is at rest.
          linearDamping: 0.6,
          angularDamping: 0.5,
          settleTimeout: 2500,
        });
        // Size the canvas inline (not via the page's CSS, which may not be
        // applied yet) and re-measure once ready, so the 3D world matches the
        // viewport instead of the default 300×150 canvas stretched to fit.
        const canvas = document.querySelector<HTMLCanvasElement>(`#${CONTAINER_ID} > canvas`);
        if (canvas) Object.assign(canvas.style, { width: "100%", height: "100%", display: "block" });
        // Guard against a hung start (e.g. an asset request that never
        // settles): give up after 10 s so rolls fall back and retry later.
        await Promise.race([
          box.init(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("dice-box init timed out")), 10_000)),
        ]);
        // Only with a real canvas: without WebGL dice-box has none and its
        // resize handler would throw.
        if (canvas) window.dispatchEvent(new Event("resize"));
        return box;
      })
      .catch((err) => {
        // Often transient (e.g. an asset request failing while the dev server
        // restarts). Forget the failure so the next roll tries again instead
        // of leaving 3D dice off until a reload; this roll falls back to RNG.
        console.warn("dice-box unavailable, using plain rolls", err);
        boxPromise = null;
        document.getElementById(CONTAINER_ID)?.replaceChildren();
        return null;
      });
  }
  return boxPromise;
}

// Start loading the engine early (e.g. on mount) so the first roll is quick.
export function preloadDiceBox() {
  void getBox();
}

export type DiceGroup = { count: number; faces: number };

// Roll one die type (e.g. 3d6). Values in throw order, or null (see above).
export async function rollPhysical(count: number, faces: number): Promise<number[] | null> {
  const res = await rollPool([{ count, faces }]);
  return res ? res[0] : null;
}

// Roll a mixed pool (e.g. 2d6 + 1d8) in one throw. Resolves with the landed
// values per group, in the same order as `groups`, or null.
export async function rollPool(groups: DiceGroup[]): Promise<number[][] | null> {
  if (groups.length === 0) return null;
  const box = await getBox();
  if (!box) return null;
  ensureContainer();
  // A new roll clears the box, which would leave the previous promise
  // hanging forever — settle it now so its caller can fall back.
  cancelPending?.();
  if (clearTimer) clearTimeout(clearTimer);

  return new Promise<number[][] | null>((resolve) => {
    let done = false;
    const finish = (v: number[][] | null) => {
      if (done) return;
      done = true;
      if (cancelPending === cancel) cancelPending = null;
      resolve(v);
    };
    const cancel = () => finish(null);
    cancelPending = cancel;

    box
      .roll(groups.map((g) => `${g.count}d${g.faces}`))
      .then((dice) => {
        const out = groups.map(() => [] as number[]);
        for (const d of dice) out[d.groupId]?.push(d.value);
        const valid = groups.every(
          (g, i) =>
            out[i].length === g.count &&
            out[i].every((v) => Number.isInteger(v) && v >= 1 && v <= g.faces),
        );
        finish(valid ? out : null);
        clearTimer = setTimeout(() => box.clear(), CLEAR_AFTER_MS);
      })
      .catch(() => finish(null));
  });
}
