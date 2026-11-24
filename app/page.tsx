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
import { SubclassSelect } from "@/components/SubclassSelect";
import { RaceSelect } from "@/components/RaceSelect";
import {
  ABILITIES,
  ABILITY_NAMES,
  CLASS_CORES,
  SKILLS,
  abilityScores,
  averageHp,
  blankCharacter,
  classCore,
  classLevelString,
  hitDiceString,
  mod,
  parseClasses,
  slotsForClasses,
  type Ability,
  type CharData,
  type ClassLevel,
} from "@/lib/sheet";

type Summary = {
  id: string;
  name: string;
  classLevel: string;
  level: number;
  hpcur: unknown;
  hpmax: unknown;
  portrait: string;
  updatedAt: string;
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export default function LibraryPage() {
  const [characters, setCharacters] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Summary | null>(null);
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
    <main className="relative isolate min-h-svh">
      {/* Decorative backdrop: the logo wordmark, faded into a warm glow. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_65%)]" />
        <div
          className="absolute top-[42%] left-1/2 aspect-[560/232] w-[min(92vw,900px)] -translate-x-1/2 -translate-y-1/2 bg-contain bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url(/assets/background.png)" }}
        />
      </div>
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <h1 className="text-2xl font-semibold">
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
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
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
              <CardHeader className="flex flex-row items-center gap-3">
                {c.portrait && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL
                  <img
                    src={c.portrait}
                    alt=""
                    className="size-12 shrink-0 rounded-md border object-cover"
                  />
                )}
                <div className="min-w-0">
                  <CardTitle className="font-medium">{c.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {c.classLevel || "No class yet"} · Level {c.level}
                  </p>
                </div>
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
                <Button size="sm" variant="outline" onClick={() => setEditTarget(c)}>
                  Edit
                </Button>
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

      {/* key: each open starts with fresh fields */}
      <CharacterDialog
        key={createOpen ? "create-open" : "create"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={load}
      />
      {editTarget && (
        <CharacterDialog
          key={editTarget.id}
          editId={editTarget.id}
          open
          onOpenChange={(o) => !o && setEditTarget(null)}
          onSaved={load}
        />
      )}

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
      </div>
    </main>
  );
}

const ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
];
const MAX_CLASSES = 4;

// Create a character, or edit an existing one's basics (name, classes with
// level + subclass, race, background, alignment, ability scores). Editing
// keeps everything else on the sheet; HP shifts by however much the new
// build's average HP differs from the old one, so rolled HP is preserved.
function CharacterDialog({
  open,
  onOpenChange,
  onSaved,
  editId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  editId?: string;
}) {
  const editing = Boolean(editId);
  const [original, setOriginal] = useState<CharData | null>(null);
  const [name, setName] = useState("");
  const [classes, setClasses] = useState<ClassLevel[]>([{ name: "Wizard", subclass: "", level: 1 }]);
  const [race, setRace] = useState("");
  const [background, setBackground] = useState("");
  const [alignment, setAlignment] = useState("");
  const [scores, setScores] = useState<Record<Ability, number>>({
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const core = classCore(classes[0]?.name ?? "");
  const total = classes.reduce((sum, c) => sum + c.level, 0);
  const loaded = !editing || original !== null;

  useEffect(() => {
    if (!editId) return;
    let alive = true;
    fetch(`/api/characters/${editId}`)
      .then((r) => r.json())
      .then(({ data }: { data: CharData }) => {
        if (!alive) return;
        setOriginal(data);
        setName(String(data.charname ?? ""));
        const parsed = parseClasses(data);
        setClasses(parsed.length ? parsed : [{ name: "Wizard", subclass: "", level: 1 }]);
        setRace(String(data.race ?? ""));
        setBackground(String(data.background ?? ""));
        setAlignment(String(data.alignment ?? ""));
        setScores(abilityScores(data));
      });
    return () => {
      alive = false;
    };
  }, [editId]);

  const updateClass = (i: number, patch: Partial<ClassLevel>) =>
    setClasses(classes.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const buildFields = (): Partial<CharData> => {
    const slots = slotsForClasses(classes);
    const caster = classes.map((c) => classCore(c.name)).find((c) => c?.spellAbility);
    return {
      charname: name.trim() || "Unnamed",
      charClasses: classes.map((c) => ({ class: c.name, subclass: c.subclass, level: c.level })),
      classlevel: classLevelString(classes),
      race,
      background,
      alignment,
      hitdice: hitDiceString(classes),
      "hd-total": total,
      ...Object.fromEntries(slots.map((n, i) => [`slot${i + 1}`, n ? String(n) : ""])),
      ...(caster?.spellAbility ? { spellability: caster.spellAbility, spellclass: caster.name } : {}),
    };
  };

  const save = async () => {
    setSaving(true);
    let id = editId;
    if (editing && original) {
      const fields = buildFields();
      // Same build: keep any hand-tuned slots and spellcasting settings.
      if (classLevelString(parseClasses(original)) === fields.classlevel) {
        for (const k of Object.keys(fields)) {
          if (/^slot\d$|^spell(ability|class)$/.test(k)) delete fields[k];
        }
      }
      const data: CharData = { ...original, ...fields };
      const oldScores = abilityScores(original);
      const scoresChanged = ABILITIES.some((a) => oldScores[a] !== scores[a]);
      if (scoresChanged) {
        data.manualScores = Object.fromEntries(ABILITIES.map((a) => [a, String(scores[a])]));
      }
      // Keep rolled HP: shift by the change in average HP.
      const delta =
        averageHp(classes, mod(scores.con)) -
        averageHp(parseClasses(original), mod(oldScores.con));
      const num = (v: unknown) => parseInt(String(v ?? "0"), 10) || 0;
      data.hpmax = String(Math.max(1, num(original.hpmax) + delta));
      data.hpcur = String(Math.max(0, Math.min(num(original.hpcur) + delta, num(data.hpmax))));
      data["hd-used"] = Math.min(num(original["hd-used"]), total);
      await fetch(`/api/characters/${editId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data }),
      });
    } else {
      const data: CharData = { ...blankCharacter(name.trim() || "Unnamed"), ...buildFields() };
      data.manualScores = Object.fromEntries(ABILITIES.map((a) => [a, String(scores[a])]));
      // Saving throws and skills come from the first class.
      for (const s of core?.saves ?? []) data[`savep-${s}`] = true;
      for (const sk of skills) data[`skp-${sk}`] = true;
      const hp = averageHp(classes, mod(scores.con));
      data.hpmax = String(hp);
      data.hpcur = String(hp);
      data["hd-used"] = 0;
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data }),
      });
      id = (await res.json()).id;
    }
    setSaving(false);
    onOpenChange(false);
    onSaved();
    if (!editing && id) window.location.href = `/characters/${id}`;
  };

  const valid = loaded && total >= 1 && total <= 20 && classes.every((c) => c.name && c.level >= 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-medium">
            {editing ? "Edit character" : "Create character"}
          </DialogTitle>
        </DialogHeader>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cc-name">Name</Label>
              <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label>Classes</Label>
                <span className={total > 20 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                  Total level {total}
                  {total > 20 && " (max 20)"}
                </span>
                {classes.length < MAX_CLASSES && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => {
                      const unused = CLASS_CORES.find((c) => !classes.some((x) => x.name === c.name));
                      setClasses([...classes, { name: unused?.name ?? "Fighter", subclass: "", level: 1 }]);
                    }}
                  >
                    + Add class
                  </Button>
                )}
              </div>
              {classes.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2 rounded-lg border p-2 sm:grid-cols-[9rem_4.5rem_minmax(0,1fr)_auto]"
                >
                  <Select
                    value={c.name}
                    onValueChange={(v) => {
                      updateClass(i, { name: v ?? c.name, subclass: "" });
                      if (i === 0) setSkills([]);
                    }}
                  >
                    <SelectTrigger aria-label={`Class ${i + 1}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_CORES.filter(
                        (cc) => cc.name === c.name || !classes.some((x) => x.name === cc.name),
                      ).map((cc) => (
                        <SelectItem key={cc.name} value={cc.name}>
                          {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={c.level}
                    aria-label={`${c.name} level`}
                    onChange={(e) =>
                      updateClass(i, { level: Math.max(1, Math.min(20, parseInt(e.target.value || "1", 10))) })
                    }
                  />
                  <div className="col-span-2 flex gap-2 sm:col-span-1 sm:contents">
                    <div className="min-w-0 flex-1">
                      {/* key: a new class starts the dropdown fresh */}
                      <SubclassSelect
                        key={c.name}
                        className={c.name}
                        value={c.subclass}
                        onChange={(sub) => updateClass(i, { subclass: sub })}
                      />
                    </div>
                    {classes.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => setClasses(classes.filter((_, j) => j !== i))}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {classes.length > 1 && !editing && (
                <p className="text-xs text-muted-foreground">
                  Saving throws and skills come from the first class.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="cc-race">Race</Label>
                <RaceSelect id="cc-race" value={race} onChange={setRace} />
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
                  {ALIGNMENTS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
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
            {core && !editing && (
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
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid || saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create and open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
