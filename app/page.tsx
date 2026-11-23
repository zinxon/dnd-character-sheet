"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zh } from "@/components/Zh";
import {
  ABILITIES,
  ABILITY_NAMES,
  CLASS_CORES,
  FULL_SLOTS,
  PACT_SLOTS,
  SKILLS,
  blankCharacter,
  classCore,
  classLevelString,
  mod,
  type Ability,
  type CharData,
} from "@/lib/sheet";

type Summary = {
  id: string;
  name: string;
  classLevel: string;
  level: number;
  hpcur: unknown;
  hpmax: unknown;
  updatedAt: string;
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

function slotsForSingleClass(className: string, level: number): number[] {
  const core = classCore(className);
  if (!core || core.caster === "none") return Array(9).fill(0);
  if (core.caster === "pact") {
    const [count, slotLevel] = PACT_SLOTS[Math.min(level, 20) - 1];
    const out = Array(9).fill(0);
    out[slotLevel - 1] = count;
    return out;
  }
  const effective =
    core.caster === "full"
      ? level
      : core.caster === "half"
        ? Math.ceil(level / 2)
        : Math.floor(level / 3);
  if (effective <= 0) return Array(9).fill(0);
  const row = FULL_SLOTS[Math.min(effective, 20) - 1] ?? [];
  return Array.from({ length: 9 }, (_, i) => row[i] ?? 0);
}

export default function LibraryPage() {
  const [characters, setCharacters] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Summary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/characters");
    setCharacters(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const duplicate = async (id: string) => {
    await fetch("/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ duplicateFrom: id }),
    });
    load();
  };

  const exportOne = async (c: Summary) => {
    const res = await fetch(`/api/characters/${c.id}`);
    const { data } = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${c.name}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (file: File) => {
    const data = JSON.parse(await file.text()) as CharData;
    await fetch("/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data }),
    });
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/characters/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  };

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-medium">
          Character library
          <Zh text="Characters" />
        </h1>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>New character</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Sign in
          </Link>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : characters.length === 0 ? (
        <p className="text-muted-foreground">
          No characters yet. Create your first one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="font-medium">{c.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {c.classLevel || "No class yet"} · Level {c.level}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Hit points: {String(c.hpcur ?? "—")} / {String(c.hpmax ?? "—")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(c.updatedAt).toLocaleString()}
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Link href={`/characters/${c.id}`} className={buttonVariants({ size: "sm" })}>
                  Open sheet
                </Link>
                <Button size="sm" variant="outline" onClick={() => duplicate(c.id)}>
                  Duplicate
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportOne(c)}>
                  Export
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteTarget(c)}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the character from the database. Export
              it first if you want a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("Wizard");
  const [subclass, setSubclass] = useState("");
  const [race, setRace] = useState("");
  const [background, setBackground] = useState("");
  const [alignment, setAlignment] = useState("");
  const [scores, setScores] = useState<Record<Ability, number>>({
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  });
  const [skills, setSkills] = useState<string[]>([]);
  const core = classCore(className);

  const create = async () => {
    const data = blankCharacter(name.trim() || "Unnamed");
    const classes = [{ name: className, subclass, level: 1 }];
    data.charClasses = classes.map((c) => ({
      class: c.name,
      subclass: c.subclass,
      level: c.level,
    }));
    data.classlevel = classLevelString(classes);
    data.race = race;
    data.background = background;
    data.alignment = alignment;
    data.manualScores = Object.fromEntries(
      ABILITIES.map((a) => [a, String(scores[a])]),
    );
    for (const s of core?.saves ?? []) data[`savep-${s}`] = true;
    for (const sk of skills) data[`skp-${sk}`] = true;
    const hp = (core?.hitDie ?? 8) + mod(scores.con);
    data.hpmax = String(hp);
    data.hpcur = String(hp);
    data.hitdice = `1d${core?.hitDie ?? 8}`;
    data["hd-total"] = 1;
    data["hd-used"] = 0;
    const slots = slotsForSingleClass(className, 1);
    slots.forEach((n, i) => {
      data[`slot${i + 1}`] = n ? String(n) : "";
    });
    if (core?.spellAbility) {
      data.spellability = core.spellAbility;
      data.spellclass = className;
    }
    const res = await fetch("/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const { id } = await res.json();
    onOpenChange(false);
    onCreated();
    if (id) window.location.href = `/characters/${id}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-medium">Create character</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cc-name">Name</Label>
            <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={className} onValueChange={(v) => { setClassName(v ?? "Wizard"); setSkills([]); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_CORES.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cc-sub">Subclass</Label>
              <Input id="cc-sub" value={subclass} onChange={(e) => setSubclass(e.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cc-race">Race</Label>
              <Input id="cc-race" value={race} onChange={(e) => setRace(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cc-bg">Background</Label>
              <Input id="cc-bg" value={background} onChange={(e) => setBackground(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Alignment</Label>
            <Select value={alignment} onValueChange={(v) => setAlignment(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"].map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label>Ability scores</Label>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() =>
                  setScores(Object.fromEntries(ABILITIES.map((a, i) => [a, STANDARD_ARRAY[i]])) as Record<Ability, number>)
                }
              >
                Standard array
              </Button>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() =>
                  setScores(
                    Object.fromEntries(
                      ABILITIES.map((a) => {
                        const rolls = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x);
                        return [a, rolls[0] + rolls[1] + rolls[2]];
                      }),
                    ) as Record<Ability, number>,
                  )
                }
              >
                Roll 4d6
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {ABILITIES.map((a) => (
                <div key={a} className="grid gap-1">
                  <Label htmlFor={`cc-${a}`} className="text-xs">
                    {ABILITY_NAMES[a]} ({mod(scores[a]) >= 0 ? "+" : ""}{mod(scores[a])})
                  </Label>
                  <Input
                    id={`cc-${a}`} type="number" value={scores[a]}
                    onChange={(e) => setScores({ ...scores, [a]: parseInt(e.target.value || "0", 10) })}
                  />
                </div>
              ))}
            </div>
          </div>
          {core && (
            <div className="grid gap-2">
              <Label>
                Skill proficiencies (choose {core.skillCount})
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {SKILLS.filter((s) => core.skillsFrom.includes(s.key)).map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={skills.includes(s.key)}
                      onCheckedChange={(checked) =>
                        setSkills(
                          checked
                            ? [...skills, s.key].slice(-core.skillCount)
                            : skills.filter((k) => k !== s.key),
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create}>Create and open</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
