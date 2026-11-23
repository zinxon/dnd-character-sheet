// 3D dice via @3d-dice/dice-box (BabylonJS + Ammo physics in a web worker).
// The physics decides the result: rollPhysical() resolves with the face
// values the dice landed on. It resolves null when dice-box can't run
// (no WebGL, assets missing) or the roll was superseded by a newer one,
// so callers can fall back to a plain random roll.

import type DiceBoxType from "@3d-dice/dice-box";

export const CONTAINER_ID = "dice-box";
const CLEAR_AFTER_MS = 2500;

let boxPromise: Promise<DiceBoxType | null> | null = null;
let cancelPending: (() => void) | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function getBox(): Promise<DiceBoxType | null> {
  if (!boxPromise) {
    boxPromise = import("@3d-dice/dice-box")
      .then(async ({ default: DiceBox }) => {
        const box = new DiceBox({
          container: `#${CONTAINER_ID}`,
          assetPath: "/assets/dice-box/",
          theme: "default",
          themeColor: "#7a1f1f",
          scale: 6,
          gravity: 1.5,
          throwForce: 6,
          spinForce: 5,
          settleTimeout: 4000,
        });
        await box.init();
        return box;
      })
      .catch((err) => {
        console.warn("dice-box unavailable, using plain rolls", err);
        return null;
      });
  }
  return boxPromise;
}

// Start loading the engine early (e.g. on mount) so the first roll is quick.
export function preloadDiceBox() {
  void getBox();
}

export async function rollPhysical(count: number, faces: number): Promise<number[] | null> {
  const box = await getBox();
  if (!box) return null;
  // A new roll clears the box, which would leave the previous promise
  // hanging forever — settle it now so its caller can fall back.
  cancelPending?.();
  if (clearTimer) clearTimeout(clearTimer);

  return new Promise<number[] | null>((resolve) => {
    let done = false;
    const finish = (v: number[] | null) => {
      if (done) return;
      done = true;
      if (cancelPending === cancel) cancelPending = null;
      resolve(v);
    };
    const cancel = () => finish(null);
    cancelPending = cancel;

    box
      .roll(`${count}d${faces}`)
      .then((dice) => {
        const values = dice.map((d) => d.value);
        const valid =
          values.length === count && values.every((v) => Number.isInteger(v) && v >= 1 && v <= faces);
        finish(valid ? values : null);
        clearTimer = setTimeout(() => box.clear(), CLEAR_AFTER_MS);
      })
      .catch(() => finish(null));
  });
}
