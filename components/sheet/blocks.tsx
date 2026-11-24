"use client";

// Building blocks for the sheet's dashboard layout (stat strip, framed
// panels, skill rows). Layout inspired by the familiar online-sheet
// arrangement; styling is our own (shadcn tokens, no borrowed artwork).

import type { ReactNode } from "react";
import { zhOf } from "@/components/Zh";
import { cn } from "@/lib/utils";

const fmt = (v: number) => (v >= 0 ? `+${v}` : String(v));

// Framed panel with its title along the bottom edge.
export function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const zh = zhOf(title);
  return (
    <section className={cn("flex flex-col rounded-xl border-2 bg-card p-3 shadow-xs", className)}>
      <div className="flex-1">{children}</div>
      <h2 className="mt-3 text-center text-xs font-semibold tracking-wider uppercase">
        {title}
        {zh && <span className="ml-1.5 font-normal tracking-normal text-muted-foreground normal-case">{zh}</span>}
      </h2>
    </section>
  );
}

// Small labelled stat box (proficiency, speed, initiative, AC …).
export function StatBox({
  top,
  bottom,
  children,
  className,
}: {
  top?: string;
  bottom?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center justify-center rounded-xl border-2 bg-card px-2 py-1.5 text-center shadow-xs",
        className,
      )}
    >
      {top && <Label text={top} />}
      <div className="my-0.5 flex items-baseline gap-0.5">{children}</div>
      {bottom && <Label text={bottom} />}
    </div>
  );
}

function Label({ text }: { text: string }) {
  const zh = zhOf(text);
  return (
    <span className="text-[0.65rem] leading-tight font-semibold tracking-wider uppercase">
      {text}
      {zh && <span className="block font-normal tracking-normal text-muted-foreground">{zh}</span>}
    </span>
  );
}

// Ability score: big modifier (click to roll a check) over the raw score.
export function AbilityBox({
  name,
  score,
  onRoll,
  onScore,
}: {
  name: string;
  score: number;
  onRoll: () => void;
  onScore: (v: string) => void;
}) {
  const mod = Math.floor((score - 10) / 2);
  return (
    <div className="flex min-w-0 flex-col items-center rounded-xl border-2 bg-card px-1.5 pt-1.5 shadow-xs">
      <Label text={name} />
      <button
        type="button"
        onClick={onRoll}
        className="my-1 w-full rounded-lg border py-1 text-2xl font-medium hover:bg-muted"
        aria-label={`Roll ${name} check`}
      >
        {fmt(mod)}
      </button>
      <input
        type="number"
        value={score}
        onChange={(e) => onScore(e.target.value)}
        aria-label={`${name} score`}
        className="-mb-3 w-12 rounded-full border-2 bg-background py-0.5 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="h-3" />
    </div>
  );
}

// A rollable bonus in a small box.
export function BonusButton({
  value,
  onClick,
  label,
  className,
}: {
  value: number;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn("min-w-10 rounded-md border px-1.5 py-0.5 text-center font-medium hover:bg-muted", className)}
    >
      {fmt(value)}
    </button>
  );
}

// Proficiency dot (filled when proficient); a second click level for expertise.
export function ProfDot({
  prof,
  expert,
  onCycle,
  label,
}: {
  prof: boolean;
  expert?: boolean;
  onCycle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={label}
      title={expert ? "Expertise" : prof ? "Proficient" : "Not proficient"}
      className={cn(
        "size-3 shrink-0 rounded-full border-2 border-foreground/60",
        prof && "bg-foreground/80",
        expert && "ring-2 ring-foreground/40 ring-offset-1 ring-offset-card",
      )}
    />
  );
}
