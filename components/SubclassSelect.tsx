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
import { subclassOptions } from "@/lib/subclasses";

const NONE = "__none__";
const CUSTOM = "__custom__";

// Subclass dropdown for a class: SRD subclass first, then the other official
// subclasses, plus "None yet" and "Custom…" (free text) for anything else.
export function SubclassSelect({
  className,
  value,
  onChange,
  id,
}: {
  className: string;
  value: string;
  onChange: (subclass: string) => void;
  id?: string;
}) {
  const options = subclassOptions(className);
  const known = options.some((o) => o.name === value);
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
                <span className="text-muted-foreground">None yet</span>
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
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{className} subclasses</SelectLabel>
            {options.map((o) => (
              <SelectItem key={o.name} value={o.name}>
                {o.name}
                {zhOf(o.name) && <span className="text-muted-foreground">{zhOf(o.name)}</span>}
                {o.srd && (
                  <span className="rounded bg-muted px-1 text-[0.65rem] font-semibold text-muted-foreground uppercase">
                    SRD
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value={CUSTOM}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Subclass name"
          aria-label="Custom subclass"
        />
      )}
    </div>
  );
}
