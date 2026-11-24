"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zhOf } from "@/components/Zh";
import { SPECIES_GROUPS, isKnownSpecies } from "@/lib/species";

const NONE = "__none__";
const CUSTOM = "__custom__";

// Race dropdown: the SRD species, each followed by its lineages, plus
// "None yet" and "Custom…" (free text) for anything else.
export function RaceSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (race: string) => void;
  id?: string;
}) {
  const known = isKnownSpecies(value);
  const [custom, setCustom] = useState(Boolean(value) && !known);
  const selected = custom ? CUSTOM : value ? value : NONE;

  return (
    <div className="grid gap-2">
      <Select
        value={selected}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            setCustom(true);
            if (known) onChange("");
          } else {
            setCustom(false);
            onChange(v === NONE || v == null ? "" : String(v));
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {(v: string) =>
              v === NONE ? (
                <span className="text-muted-foreground">Choose</span>
              ) : v === CUSTOM ? (
                "Custom…"
              ) : (
                <>
                  {v}
                  {zhOf(v) && <span className="ml-1.5 text-muted-foreground">{zhOf(v)}</span>}
                </>
              )
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None yet</SelectItem>
          {SPECIES_GROUPS.map((g) => (
            <SelectGroup key={g.species}>
              <SelectSeparator />
              <SelectLabel>
                {g.species}
                {zhOf(g.species) && <span className="ml-1.5">{zhOf(g.species)}</span>}
              </SelectLabel>
              {g.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                  {zhOf(o) && <span className="text-muted-foreground">{zhOf(o)}</span>}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Race name"
          aria-label="Custom race"
        />
      )}
    </div>
  );
}
