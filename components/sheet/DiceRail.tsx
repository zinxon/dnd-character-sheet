"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseDice } from "@/lib/sheet";
import { cn } from "@/lib/utils";

const STANDARD = [4, 6, 8, 10, 12, 20, 100];
const MAX_CUSTOM = 8;

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

// Right-hand dice rail (desktop): the standard dice plus the character's own
// saved rolls (e.g. 4d8, 3d6+2), stored on the character as `customDice`.
export function DiceRail({
  custom,
  onCustomChange,
  roll,
}: {
  custom: string[];
  onCustomChange: (next: string[]) => void;
  roll: (label: string, expr: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    const expr = normalise(draft);
    if (!expr) {
      setError("Use a roll like 4d8, 3d6+2 or 2d4.");
      return;
    }
    if (!custom.includes(expr)) onCustomChange([...custom, expr].slice(-MAX_CUSTOM));
    roll(expr, expr);
    setDraft("");
    setError("");
    setOpen(false);
  };

  const railButton = "h-9 w-11 bg-background px-0 text-xs";

  return (
    <div className="fixed top-1/2 right-1.5 z-40 hidden max-h-[90svh] -translate-y-1/2 flex-col gap-1.5 overflow-y-auto lg:flex">
      {STANDARD.map((f) => (
        <Button
          key={f}
          size="sm"
          variant="outline"
          className={railButton}
          onClick={() => roll(`d${f}`, `1d${f}`)}
          aria-label={`Roll 1d${f}`}
        >
          d{f}
        </Button>
      ))}

      {custom.length > 0 && <div className="mx-auto my-0.5 h-px w-6 bg-border" />}
      {custom.map((expr) => (
        <div key={expr} className="group relative">
          <Button
            size="sm"
            variant="outline"
            className={cn(railButton, expr.length > 5 && "text-[0.65rem]")}
            onClick={() => roll(expr, expr)}
            aria-label={`Roll ${expr}`}
            title={`Roll ${expr}`}
          >
            {expr}
          </Button>
          <button
            type="button"
            onClick={() => onCustomChange(custom.filter((c) => c !== expr))}
            className="absolute -top-1.5 -left-1.5 hidden size-4 items-center justify-center rounded-full border bg-background group-hover:flex"
            aria-label={`Remove ${expr}`}
          >
            <XIcon className="size-2.5" />
          </button>
        </div>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), railButton)}
          aria-label="Add custom dice"
          title="Add custom dice"
        >
          <PlusIcon className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent side="left" align="end" className="w-56">
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <p className="text-sm font-medium">Custom dice</p>
            <div className="flex gap-1.5">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError("");
                }}
                placeholder="4d8+2"
                aria-label="Dice expression"
                aria-invalid={Boolean(error)}
              />
              <Button type="submit" size="sm">
                Add
              </Button>
            </div>
            <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
              {error || "Saved to this character's dice rail and rolled once."}
            </p>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
