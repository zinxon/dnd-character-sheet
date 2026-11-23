"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zh, zhOf } from "@/components/Zh";
import {
  ABILITIES,
  ABILITY_NAMES,
  CLASS_CORES,
  CONDITIONS,
  SKILLS,
  XP_THRESHOLDS,
  abilityScores,
  classCore,
  classLevelString,
  fmt,
  mod,
  parseClasses,
  passivePerception,
  profBonus,
  parseDice,
  rollDice,
  saveBonus,
  skillBonus,
  slotTotals,
  slotUsed,
  slotsForClasses,
  spellcasting,
  totalLevel,
  type CharData,
  type RollResult,
} from "@/lib/sheet";

type SpellDetail = {
  name: string;
  level: number;
  school: string;
  time: string;
  range: string;
  components: string;
  duration: string;
  text: string;
  higher?: string;
  ritual?: boolean;
  conc?: boolean;
  zhName: string | null;
  zhText: string | null;
};

type LogEntry = RollResult & { label: string; at: number };

// Dice the 3D roller has meshes for; anything else rolls instantly.
const ANIMATED_FACES = [4, 6, 8, 10, 12, 20, 100];
const MAX_ANIMATED_DICE = 20;

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => {
  const p = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(p) ? p : 0;
};

export default function SheetClient({
  id,
  initialData,
  spellDetails,
}: {
  id: string;
  initialData: CharData;
  spellDetails: Record<string, SpellDetail>;
}) {
  const [data, setData] = useState<CharData>(initialData);
  const [details, setDetails] = useState(spellDetails);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [diceOpen, setDiceOpen] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [shortRestOpen, setShortRestOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((patch: Partial<CharData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      return next;
    });
    setSaveState("dirty");
  }, []);

  useEffect(() => {
    if (saveState !== "dirty") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      await fetch(`/api/characters/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data }),
      });
      setSaveState("saved");
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, saveState, id]);

  const roll = useCallback(async (label: string, expr: string) => {
    let landed: number[] | null = null;
    try {
      const { count, faces } = parseDice(expr);
      if (ANIMATED_FACES.includes(faces) && count <= MAX_ANIMATED_DICE) {
        // The physics decides the result: wait for the dice to settle.
        const { rollPhysical } = await import("@/lib/diceBox");
        landed = await rollPhysical(count, faces);
      }
    } catch {
      // fall through to a plain random roll
    }
    try {
      const result = rollDice(expr, landed ?? undefined);
      setLog((prev) => [{ ...result, label, at: Date.now() }, ...prev].slice(0, 30));
    } catch {
      // unparsable damage strings etc. — ignore
    }
  }, []);

  useEffect(() => {
    import("@/lib/diceBox").then((m) => m.preloadDiceBox()).catch(() => {});
  }, []);

  const classes = useMemo(() => parseClasses(data), [data]);
  const scores = useMemo(() => abilityScores(data), [data]);
  const pb = profBonus(data);
  const level = totalLevel(data);
  const xp = n(data.xp);
  const nextThreshold = XP_THRESHOLDS[level] ?? null;
  const slots = useMemo(() => slotTotals(data), [data]);
  const casters = useMemo(() => spellcasting(data), [data]);
  const conditions = (data.conditions as string[] | undefined) ?? [];

  const hpcur = n(data.hpcur);
  const hpmax = n(data["hpmax-base"]) || n(data.hpmax);
  const hptmp = n(data.hptmp);

  const applyDamage = (amount: number) => {
    let remaining = amount;
    let tmp = hptmp;
    let cur = hpcur;
    if (tmp > 0) {
      const absorbed = Math.min(tmp, remaining);
      tmp -= absorbed;
      remaining -= absorbed;
    }
    cur = Math.max(0, cur - remaining);
    set({ hpcur: String(cur), hptmp: tmp ? String(tmp) : "" });
  };
  const applyHeal = (amount: number) =>
    set({ hpcur: String(Math.min(hpmax, hpcur + amount)) });

  const toggleSlot = (lvl: number, index: number) => {
    const used = slotUsed(data, lvl);
    const next = index < used ? index : index + 1;
    set({ [`slot${lvl}u`]: next === 0 ? "" : String(next) });
  };

  const longRest = () => {
    const patch: Partial<CharData> = {
      hpcur: String(hpmax),
      hptmp: "",
    };
    for (let lvl = 1; lvl <= 9; lvl++) patch[`slot${lvl}u`] = "";
    const hdTotal = n(data["hd-total"]) || level;
    const hdUsed = n(data["hd-used"]);
    patch["hd-used"] = Math.max(0, hdUsed - Math.max(1, Math.floor(hdTotal / 2)));
    for (let i = 0; i < 3; i++) {
      patch[`dss-${i}`] = false;
      patch[`dsf-${i}`] = false;
    }
    for (let i = 0; i < 16; i++) if (data[`lfname-${i}`]) patch[`lfused-${i}`] = "";
    set(patch);
  };

  const acComputed = 10 + mod(scores.dex) + n(data.armormod);
  const acShown = data.acManual ? n(data.acManual) : acComputed;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-56 flex-1">
          <Input
            value={s(data.charname)}
            onChange={(e) => set({ charname: e.target.value })}
            className="h-auto border-none px-0 text-2xl font-medium shadow-none focus-visible:ring-0"
            aria-label="Character name"
          />
          <p className="text-sm text-muted-foreground">
            {s(data.classlevel)}
            {data.race ? ` · ${s(data.race)}` : ""}
            {data.background ? ` · ${s(data.background)}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {saveState === "saved"
              ? "Saved to Neon"
              : saveState === "saving"
                ? "Saving…"
                : "Unsaved changes"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Library
          </Link>
          <Button variant="outline" onClick={() => setShortRestOpen(true)}>
            Short rest
            <Zh text="Short Rest" />
          </Button>
          <Button variant="outline" onClick={longRest}>
            Long rest
            <Zh text="Long Rest" />
          </Button>
          <Button variant="outline" onClick={() => setDiceOpen(true)}>
            Dice roller
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <Button onClick={() => setLevelUpOpen(true)}>
            Level up
            <Zh text="Level Up" />
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span>
          Proficiency bonus <span className="font-medium">{fmt(pb)}</span>
          <Zh text="Proficiency Bonus" />
        </span>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(data.inspiration)}
            onCheckedChange={(c) => set({ inspiration: Boolean(c) })}
          />
          Inspiration
          <Zh text="Inspiration" />
        </label>
        <span className="flex items-center gap-2">
          <Label htmlFor="xp" className="font-normal">Experience</Label>
          <Input
            id="xp"
            type="number"
            className="w-28"
            value={s(data.xp)}
            onChange={(e) => set({ xp: e.target.value })}
          />
          {nextThreshold != null && (
            <span className="text-muted-foreground">
              Level {level + 1} at {nextThreshold.toLocaleString()} XP
              {xp >= nextThreshold ? " — ready to level up" : ""}
            </span>
          )}
        </span>
        <span>
          Passive perception <span className="font-medium">{passivePerception(data)}</span>
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm">
          Conditions
          <Zh text="Conditions" />:
        </span>
        {CONDITIONS.map((c) => {
          const active = conditions.includes(c);
          return (
            <Button
              key={c}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() =>
                set({
                  conditions: active
                    ? conditions.filter((x) => x !== c)
                    : [...conditions, c],
                })
              }
            >
              {c}
              {zhOf(c) ? <span className="ml-1 text-[0.8em] opacity-80">{zhOf(c)}</span> : null}
            </Button>
          );
        })}
      </div>

      <Tabs defaultValue="core">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="core">Core<Zh text="Core" /></TabsTrigger>
          <TabsTrigger value="spells">Spells<Zh text="Spells" /></TabsTrigger>
          <TabsTrigger value="inventory">Inventory<Zh text="Inventory" /></TabsTrigger>
          <TabsTrigger value="features">Features<Zh text="Features" /></TabsTrigger>
          <TabsTrigger value="story">Background<Zh text="Background" /></TabsTrigger>
          <TabsTrigger value="notes">Notes<Zh text="Notes" /></TabsTrigger>
        </TabsList>

        <TabsContent value="core" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {ABILITIES.map((a) => (
                  <Card key={a}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {ABILITY_NAMES[a]}
                        <Zh text={ABILITY_NAMES[a]} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      <Button
                        variant="outline"
                        className="h-12 text-xl font-medium"
                        onClick={() => roll(`${ABILITY_NAMES[a]} check`, String(mod(scores[a])))}
                      >
                        {fmt(mod(scores[a]))}
                      </Button>
                      <Input
                        type="number"
                        value={scores[a]}
                        aria-label={`${ABILITY_NAMES[a]} score`}
                        onChange={(e) =>
                          set({
                            manualScores: {
                              ...(data.manualScores as Record<string, unknown>),
                              [a]: e.target.value,
                            },
                          })
                        }
                      />
                      <div className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={Boolean(data[`savep-${a}`])}
                          onCheckedChange={(c) => set({ [`savep-${a}`]: Boolean(c) })}
                          aria-label={`${ABILITY_NAMES[a]} save proficiency`}
                        />
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => roll(`${ABILITY_NAMES[a]} save`, String(saveBonus(data, a)))}
                        >
                          Save {fmt(saveBonus(data, a))}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">
                    Skills
                    <Zh text="Skills" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                    {SKILLS.map((skill) => (
                      <div key={skill.key} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={Boolean(data[`skp-${skill.key}`])}
                          onCheckedChange={(c) => set({ [`skp-${skill.key}`]: Boolean(c) })}
                          aria-label={`${skill.name} proficiency`}
                        />
                        <Checkbox
                          checked={Boolean(data[`ske-${skill.key}`])}
                          onCheckedChange={(c) => set({ [`ske-${skill.key}`]: Boolean(c) })}
                          aria-label={`${skill.name} expertise`}
                        />
                        <button
                          type="button"
                          className="w-10 text-left font-medium"
                          onClick={() => roll(skill.name, String(skillBonus(data, skill.key)))}
                        >
                          {fmt(skillBonus(data, skill.key))}
                        </button>
                        <span>
                          {skill.name}
                          <Zh text={skill.name} />
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground uppercase">
                          {skill.ability}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <AttacksCard data={data} set={set} roll={roll} casters={casters} />
              <LimitedFeaturesCard data={data} set={set} />
            </div>

            <div className="grid content-start gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">
                    Combat
                    <Zh text="Combat" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="ac">Armor class</Label>
                      <Input
                        id="ac" type="number" value={acShown}
                        onChange={(e) => set({ acManual: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label>Initiative</Label>
                      <Button
                        variant="outline"
                        onClick={() => roll("Initiative", String(mod(scores.dex)))}
                      >
                        {fmt(mod(scores.dex))}
                      </Button>
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="speed">Speed</Label>
                      <Input
                        id="speed" type="number" value={n(data.speedBase) || 30}
                        onChange={(e) => set({ speedBase: parseInt(e.target.value || "0", 10) })}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="hpcur">Current HP</Label>
                      <Input id="hpcur" type="number" value={s(data.hpcur)} onChange={(e) => set({ hpcur: e.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="hpmax">Max HP</Label>
                      <Input id="hpmax" type="number" value={s(data.hpmax)} onChange={(e) => set({ hpmax: e.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="hptmp">Temp HP</Label>
                      <Input id="hptmp" type="number" value={s(data.hptmp)} onChange={(e) => set({ hptmp: e.target.value })} />
                    </div>
                  </div>
                  <HpAdjust onDamage={applyDamage} onHeal={applyHeal} />
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span>
                      Hit dice: {s(data.hitdice) || "—"} ({n(data["hd-total"]) - n(data["hd-used"])} left)
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <span>Death saves</span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        Success
                        {[0, 1, 2].map((i) => (
                          <Checkbox
                            key={i}
                            checked={Boolean(data[`dss-${i}`])}
                            onCheckedChange={(c) => set({ [`dss-${i}`]: Boolean(c) })}
                            aria-label={`Death save success ${i + 1}`}
                          />
                        ))}
                      </span>
                      <span className="flex items-center gap-1">
                        Failure
                        {[0, 1, 2].map((i) => (
                          <Checkbox
                            key={i}
                            checked={Boolean(data[`dsf-${i}`])}
                            onCheckedChange={(c) => set({ [`dsf-${i}`]: Boolean(c) })}
                            aria-label={`Death save failure ${i + 1}`}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <SlotPips slots={slots} data={data} onToggle={toggleSlot} />
              <RollLog log={log} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="spells" className="mt-4">
          <SpellsTab
            data={data}
            set={set}
            slots={slots}
            casters={casters}
            details={details}
            setDetails={setDetails}
            onToggleSlot={toggleSlot}
            roll={roll}
          />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <InventoryTab data={data} set={set} />
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <FeaturesTab data={data} set={set} />
        </TabsContent>

        <TabsContent value="story" className="mt-4">
          <StoryTab data={data} set={set} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <Textarea
                value={s(data.notes)}
                onChange={(e) => set({ notes: e.target.value })}
                rows={16}
                placeholder="Session notes, plans, reminders…"
                aria-label="Notes"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 3D dice overlay — dice-box draws its canvas in here */}
      <div
        id="dice-box"
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 [&>canvas]:h-full [&>canvas]:w-full"
      />

      <div className="fixed top-1/2 right-1.5 z-40 hidden -translate-y-1/2 flex-col gap-1.5 lg:flex">
        {[4, 6, 8, 10, 12, 20, 100].map((f) => (
          <Button
            key={f}
            size="sm"
            variant="outline"
            className="h-9 w-11 bg-background px-0 text-xs"
            onClick={() => roll(`d${f}`, `1d${f}`)}
            aria-label={`Roll 1d${f}`}
          >
            d{f}
          </Button>
        ))}
      </div>

      {log.length > 0 && (
        <button
          type="button"
          onClick={() => setDiceOpen(true)}
          // Mobile: centre of the screen. Desktop: top-right, below the header.
          className="fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full border bg-background px-4 py-2 shadow-lg lg:top-16 lg:right-4 lg:left-auto lg:translate-x-0 lg:translate-y-0"
          aria-label="Latest roll — open dice roller"
        >
          <span
            key={log[0].at}
            className="text-xl font-medium [animation:rollpop_.2s_ease-out]"
          >
            {log[0].total}
          </span>
          <span className="max-w-56 truncate text-sm text-muted-foreground">
            {log[0].label} · {log[0].detail}
            {log[0].nat === "crit"
              ? " · critical!"
              : log[0].nat === "fumble"
                ? " · fumble"
                : ""}
          </span>
        </button>
      )}
      <style>{`@keyframes rollpop { from { transform: scale(1.35); } to { transform: scale(1); } }`}</style>

      <DiceDialog open={diceOpen} onOpenChange={setDiceOpen} roll={roll} log={log} />
      <LevelUpDialog
        open={levelUpOpen}
        onOpenChange={setLevelUpOpen}
        data={data}
        set={set}
        classes={classes}
      />
      <ShortRestDialog
        open={shortRestOpen}
        onOpenChange={setShortRestOpen}
        data={data}
        set={set}
        roll={roll}
      />
    </main>
  );
}

type SetFn = (patch: Partial<CharData>) => void;
type RollFn = (label: string, expr: string) => void;

function HpAdjust({
  onDamage,
  onHeal,
}: {
  onDamage: (n: number) => void;
  onHeal: (n: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const value = parseInt(amount || "0", 10) || 0;
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="w-24"
        aria-label="Hit point amount"
      />
      <Button size="sm" variant="outline" onClick={() => value && onDamage(value)}>
        Damage
      </Button>
      <Button size="sm" variant="outline" onClick={() => value && onHeal(value)}>
        Heal
        <Zh text="Heal" />
      </Button>
    </div>
  );
}

export function SlotPips({
  slots,
  data,
  onToggle,
}: {
  slots: number[];
  data: CharData;
  onToggle: (lvl: number, index: number) => void;
}) {
  if (!slots.some((t) => t > 0)) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          Spell slots
          <Zh text="Spellcasting" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1.5 text-sm">
        {slots.map((total, i) => {
          if (!total) return null;
          const lvl = i + 1;
          const used = slotUsed(data, lvl);
          return (
            <div key={lvl} className="flex items-center gap-2">
              <span className="w-14">Level {lvl}</span>
              <span className="flex gap-1">
                {Array.from({ length: total }, (_, p) => (
                  <button
                    key={p}
                    type="button"
                    aria-label={`Level ${lvl} slot ${p + 1}`}
                    onClick={() => onToggle(lvl, p)}
                    className={`h-4 w-4 rounded-full border ${
                      p < used ? "bg-primary" : "bg-transparent"
                    }`}
                  />
                ))}
              </span>
              <span className="text-muted-foreground">
                {total - used} / {total}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RollLog({ log }: { log: LogEntry[] }) {
  if (log.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Roll log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-44">
          <ul className="grid gap-1 text-sm">
            {log.map((entry) => (
              <li key={entry.at + entry.label} className="flex items-baseline gap-2">
                <span className="font-medium">{entry.total}</span>
                <span className="text-muted-foreground">
                  {entry.label} · {entry.expr} · {entry.detail}
                  {entry.nat === "crit" ? " · critical!" : entry.nat === "fumble" ? " · fumble" : ""}
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AttacksCard({
  data,
  set,
  roll,
  casters,
}: {
  data: CharData;
  set: SetFn;
  roll: RollFn;
  casters: ReturnType<typeof spellcasting>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          Attacks
          <Zh text="Attacks" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {casters.map((c) => (
          <div key={c.className} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {c.className} spell attack
            </span>
            <Button size="sm" variant="outline" onClick={() => roll(`${c.className} spell attack`, String(c.attack))}>
              {fmt(c.attack)} to hit
            </Button>
            <Badge variant="secondary">Save DC {c.dc}</Badge>
          </div>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={s(data[`atkname-${i}`])}
              onChange={(e) => set({ [`atkname-${i}`]: e.target.value })}
              placeholder="Attack name"
              className="flex-1"
              aria-label={`Attack ${i + 1} name`}
            />
            <Input
              value={s(data[`atkbonus-${i}`])}
              onChange={(e) => set({ [`atkbonus-${i}`]: e.target.value })}
              placeholder="+0"
              className="w-16"
              aria-label={`Attack ${i + 1} bonus`}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => roll(s(data[`atkname-${i}`]) || `Attack ${i + 1}`, s(data[`atkbonus-${i}`]) || "0")}
            >
              Hit
            </Button>
            <Input
              value={s(data[`atkdmg-${i}`])}
              onChange={(e) => set({ [`atkdmg-${i}`]: e.target.value })}
              placeholder="1d6"
              className="w-20"
              aria-label={`Attack ${i + 1} damage`}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => roll(`${s(data[`atkname-${i}`]) || `Attack ${i + 1}`} damage`, s(data[`atkdmg-${i}`]) || "1d6")}
            >
              Damage
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LimitedFeaturesCard({ data, set }: { data: CharData; set: SetFn }) {
  const rows = Array.from({ length: 16 }, (_, i) => i).filter(
    (i) => s(data[`lfname-${i}`]),
  );
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          Limited features
          <Zh text="Limited Features" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {rows.map((i) => {
          const max = n(data[`lfmax-${i}`]);
          const used = n(data[`lfused-${i}`]);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1">
                {s(data[`lfname-${i}`])}
                {zhOf(s(data[`lfname-${i}`])) ? (
                  <span className="ml-1.5 text-[0.8em] text-muted-foreground">
                    {zhOf(s(data[`lfname-${i}`]))}
                  </span>
                ) : null}
              </span>
              <span className="flex gap-1">
                {Array.from({ length: max }, (_, p) => (
                  <button
                    key={p}
                    type="button"
                    aria-label={`${s(data[`lfname-${i}`])} use ${p + 1}`}
                    onClick={() =>
                      set({ [`lfused-${i}`]: String(p < used ? p : p + 1) })
                    }
                    className={`h-4 w-4 rounded-full border ${p < used ? "bg-primary" : "bg-transparent"}`}
                  />
                ))}
              </span>
              <span className="text-muted-foreground">
                {max - used} / {max} · {s(data[`lfrec-${i}`]) || "—"}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SpellsTab({
  data,
  set,
  slots,
  casters,
  details,
  setDetails,
  onToggleSlot,
  roll,
}: {
  data: CharData;
  set: SetFn;
  slots: number[];
  casters: ReturnType<typeof spellcasting>;
  details: Record<string, SpellDetail>;
  setDetails: (d: Record<string, SpellDetail>) => void;
  onToggleSlot: (lvl: number, index: number) => void;
  roll: RollFn;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const entries = (data.spellEntries ?? {}) as Record<
    string,
    { name: string; prep?: boolean }[]
  >;
  const levels = Object.keys(entries)
    .map(Number)
    .sort((a, b) => a - b);

  const setEntries = (next: typeof entries) => set({ spellEntries: next });

  const togglePrep = (lvl: number, name: string) => {
    const list = (entries[String(lvl)] ?? []).map((e) =>
      e.name === name ? { ...e, prep: !e.prep } : e,
    );
    setEntries({ ...entries, [String(lvl)]: list });
  };

  const removeSpell = (lvl: number, name: string) => {
    const list = (entries[String(lvl)] ?? []).filter((e) => e.name !== name);
    setEntries({ ...entries, [String(lvl)]: list });
  };

  const cast = (lvl: number) => {
    if (lvl === 0) return;
    const used = slotUsed(data, lvl);
    if (used < (slots[lvl - 1] ?? 0)) set({ [`slot${lvl}u`]: String(used + 1) });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {casters.map((c) => (
          <Badge key={c.className} variant="secondary" className="text-sm font-normal">
            {c.className}: spell save DC {c.dc} · attack {fmt(c.attack)}
          </Badge>
        ))}
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          Add spell
        </Button>
      </div>
      <SlotPips slots={slots} data={data} onToggle={onToggleSlot} />
      {levels.map((lvl) => (
        <Card key={lvl}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {lvl === 0 ? "Cantrips" : `Level ${lvl}`}
              <Zh text={lvl === 0 ? "Cantrips" : `${["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"][lvl]} Level`} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {(entries[String(lvl)] ?? []).map((entry) => {
              const d = details[entry.name];
              const isOpen = expanded === entry.name;
              return (
                <div key={entry.name} className="rounded-md border p-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {lvl > 0 && (
                      <Checkbox
                        checked={Boolean(entry.prep)}
                        onCheckedChange={() => togglePrep(lvl, entry.name)}
                        aria-label={`Prepare ${entry.name}`}
                      />
                    )}
                    <button
                      type="button"
                      className="font-medium"
                      onClick={() => setExpanded(isOpen ? null : entry.name)}
                    >
                      {entry.name}
                      {d?.zhName ? (
                        <span className="ml-1.5 text-[0.8em] font-normal text-muted-foreground">
                          {d.zhName}
                        </span>
                      ) : null}
                    </button>
                    {d && (
                      <span className="text-muted-foreground">
                        {d.school} · {d.time} · {d.range} · {d.duration}
                        {d.conc ? " · concentration" : ""}
                        {d.ritual ? " · ritual" : ""}
                      </span>
                    )}
                    <span className="ml-auto flex gap-1.5">
                      {lvl > 0 && (
                        <Button size="sm" variant="outline" onClick={() => cast(lvl)}>
                          Cast
                          <Zh text="Cast" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSpell(lvl, entry.name)}
                      >
                        Remove
                      </Button>
                    </span>
                  </div>
                  {isOpen && d && (
                    <div className="mt-2 grid gap-2 text-sm whitespace-pre-wrap">
                      <p>{d.text}</p>
                      {d.higher && <p>At higher levels: {d.higher}</p>}
                      {d.zhText && <p className="text-muted-foreground">{d.zhText}</p>}
                    </div>
                  )}
                </div>
              );
            })}
            {(entries[String(lvl)] ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No spells at this level.</p>
            )}
          </CardContent>
        </Card>
      ))}
      <AddSpellDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(spell) => {
          const key = String(spell.level);
          const list = entries[key] ?? [];
          if (!list.some((e) => e.name === spell.name)) {
            setEntries({
              ...entries,
              [key]: [...list, { name: spell.name, prep: spell.level === 0 }],
            });
          }
          setDetails({ ...details, [spell.name]: spell });
        }}
      />
    </div>
  );
}

function AddSpellDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (spell: SpellDetail) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SpellDetail[]>([]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/spells?q=${encodeURIComponent(q)}`);
      setResults(await res.json());
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-medium">Add spell</DialogTitle>
        </DialogHeader>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 510 spells…"
          aria-label="Search spells"
        />
        <ScrollArea className="h-72">
          <div className="grid gap-1">
            {results.map((spell) => (
              <button
                key={spell.name}
                type="button"
                className="flex items-center gap-2 rounded-md border p-2 text-left text-sm"
                onClick={() => {
                  onAdd(spell);
                  onOpenChange(false);
                }}
              >
                <span className="font-medium">
                  {spell.name}
                  {spell.zhName ? (
                    <span className="ml-1.5 text-[0.8em] font-normal text-muted-foreground">
                      {spell.zhName}
                    </span>
                  ) : null}
                </span>
                <span className="ml-auto text-muted-foreground">
                  {spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · {spell.school}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function InventoryTab({ data, set }: { data: CharData; set: SetFn }) {
  const rows = Array.from({ length: 58 }, (_, i) => i);
  const usedRows = rows.filter((i) => s(data[`invname-${i}`]));
  const nextFree = rows.find((i) => !s(data[`invname-${i}`]));
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Currency
            <Zh text="Currency" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(["cp", "sp", "ep", "gp", "pp"] as const).map((c) => (
            <div key={c} className="grid w-24 gap-1">
              <Label htmlFor={`cur-${c}`}>{c.toUpperCase()}</Label>
              <Input
                id={`cur-${c}`}
                type="number"
                value={s(data[c])}
                onChange={(e) => set({ [c]: e.target.value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Equipment
            <Zh text="Equipment Notes" />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {usedRows.map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={s(data[`invname-${i}`])}
                onChange={(e) => set({ [`invname-${i}`]: e.target.value })}
                className="flex-1"
                aria-label={`Item ${i + 1} name`}
              />
              <Input
                value={s(data[`invqty-${i}`])}
                onChange={(e) => set({ [`invqty-${i}`]: e.target.value })}
                className="w-20"
                aria-label={`Item ${i + 1} quantity`}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => set({ [`invname-${i}`]: "", [`invqty-${i}`]: "" })}
              >
                Remove
              </Button>
            </div>
          ))}
          {nextFree !== undefined && (
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => set({ [`invname-${nextFree}`]: "New item", [`invqty-${nextFree}`]: "1" })}
            >
              Add item
            </Button>
          )}
          <Separator />
          <Label htmlFor="equipment-notes">Equipment notes</Label>
          <Textarea
            id="equipment-notes"
            value={s(data.equipment)}
            onChange={(e) => set({ equipment: e.target.value })}
            rows={5}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FeaturesTab({ data, set }: { data: CharData; set: SetFn }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Features and traits
            <Zh text="Features & Traits" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={s(data.features)}
            onChange={(e) => set({ features: e.target.value })}
            rows={18}
            aria-label="Features and traits"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Proficiencies and languages
            <Zh text="Proficiencies and Languages" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={s(data.proficiencies)}
            onChange={(e) => set({ proficiencies: e.target.value })}
            rows={5}
            aria-label="Proficiencies and languages"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StoryTab({ data, set }: { data: CharData; set: SetFn }) {
  const fields: { key: string; label: string; rows?: number }[] = [
    { key: "personality", label: "Personality traits", rows: 3 },
    { key: "ideals", label: "Ideals", rows: 3 },
    { key: "bonds", label: "Bonds", rows: 3 },
    { key: "flaws", label: "Flaws", rows: 3 },
    { key: "backstory", label: "Character backstory", rows: 8 },
    { key: "bg-allies", label: "Allies", rows: 3 },
    { key: "bg-enemies", label: "Enemies", rows: 3 },
  ];
  const headerFields: { key: string; label: string }[] = [
    { key: "race", label: "Race" },
    { key: "background", label: "Background" },
    { key: "alignment", label: "Alignment" },
    { key: "player", label: "Player" },
    { key: "campaign", label: "Campaign" },
    { key: "age", label: "Age" },
  ];
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          {headerFields.map((f) => (
            <div key={f.key} className="grid gap-1">
              <Label htmlFor={`story-${f.key}`}>{f.label}</Label>
              <Input
                id={`story-${f.key}`}
                value={s(data[f.key])}
                onChange={(e) => set({ [f.key]: e.target.value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      {fields.map((f) => (
        <Card key={f.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {f.label}
              <Zh text={f.label} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={s(data[f.key])}
              onChange={(e) => set({ [f.key]: e.target.value })}
              rows={f.rows ?? 3}
              aria-label={f.label}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DiceDialog({
  open,
  onOpenChange,
  roll,
  log,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roll: RollFn;
  log: LogEntry[];
}) {
  const [expr, setExpr] = useState("1d20");
  const quick = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20", "1d100", "2d6", "4d6"];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium">Dice roller</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <Button key={q} variant="outline" size="sm" onClick={() => roll(q, q)}>
              {q}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="e.g. 2d6+3"
            aria-label="Dice expression"
          />
          <Button onClick={() => roll(expr, expr)}>Roll</Button>
        </div>
        <ScrollArea className="h-40">
          <ul className="grid gap-1 text-sm">
            {log.map((entry) => (
              <li key={entry.at + entry.label} className="flex items-baseline gap-2">
                <span className="font-medium">{entry.total}</span>
                <span className="text-muted-foreground">
                  {entry.label} · {entry.detail}
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function LevelUpDialog({
  open,
  onOpenChange,
  data,
  set,
  classes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: CharData;
  set: SetFn;
  classes: ReturnType<typeof parseClasses>;
}) {
  const [className, setClassName] = useState("");
  const [method, setMethod] = useState<"average" | "roll">("average");
  const [rolled, setRolled] = useState<number | null>(null);
  const core = classCore(className || classes[0]?.name || "Wizard");
  const scores = abilityScores(data);
  const conMod = mod(scores.con);

  useEffect(() => {
    if (open) {
      setClassName(classes[0]?.name ?? "Wizard");
      setRolled(null);
    }
  }, [open, classes]);

  const apply = () => {
    if (!core) return;
    const gain =
      (method === "roll"
        ? (rolled ?? core.hitDie)
        : Math.floor(core.hitDie / 2) + 1) + conMod;
    const next = classes.map((c) => ({ ...c }));
    const existing = next.find((c) => c.name === core.name);
    if (existing) existing.level += 1;
    else next.push({ name: core.name, subclass: "", level: 1 });
    const patch: Partial<CharData> = {
      charClasses: next.map((c) => ({
        class: c.name,
        subclass: c.subclass,
        level: c.level,
      })),
      classlevel: classLevelString(next),
      hpmax: String(n(data.hpmax) + gain),
      hpcur: String(n(data.hpcur) + gain),
      "hd-total": (n(data["hd-total"]) || totalLevel(data)) + 1,
    };
    const newSlots = slotsForClasses(next);
    newSlots.forEach((total, i) => {
      patch[`slot${i + 1}`] = total ? String(total) : "";
    });
    set(patch);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium">
            Level up
            <Zh text="Level Up" />
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Class to advance</Label>
            <Select value={className} onValueChange={(v) => setClassName(v ?? "")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASS_CORES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name} (d{c.hitDie})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Hit points</Label>
            <Select value={method} onValueChange={(v) => setMethod((v as "average" | "roll") ?? "average")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="average">
                  Take average ({core ? Math.floor(core.hitDie / 2) + 1 : 0} + Con {fmt(conMod)})
                </SelectItem>
                <SelectItem value="roll">Roll the hit die</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {method === "roll" && core && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setRolled(1 + Math.floor(Math.random() * core.hitDie))
                }
              >
                Roll 1d{core.hitDie}
              </Button>
              {rolled != null && (
                <span>
                  Rolled {rolled} → gain {rolled + conMod} HP
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            New total level {totalLevel(data) + 1}. Spell slots are recalculated
            from the class build; features for the new level are yours to add on
            the Features tab, as in the classic sheet.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={method === "roll" && rolled == null}>
            Apply level up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShortRestDialog({
  open,
  onOpenChange,
  data,
  set,
  roll,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: CharData;
  set: SetFn;
  roll: RollFn;
}) {
  const [dice, setDice] = useState("1");
  const scores = abilityScores(data);
  const conMod = mod(scores.con);
  const hdTotal = n(data["hd-total"]) || totalLevel(data);
  const hdLeft = hdTotal - n(data["hd-used"]);
  const dieFaces = (() => {
    const m = s(data.hitdice).match(/d(\d+)/);
    return m ? parseInt(m[1], 10) : (classCore(parseClasses(data)[0]?.name ?? "")?.hitDie ?? 8);
  })();

  const apply = () => {
    const spend = Math.min(parseInt(dice || "0", 10) || 0, hdLeft);
    if (spend <= 0) {
      onOpenChange(false);
      return;
    }
    let healed = 0;
    for (let i = 0; i < spend; i++) {
      healed += 1 + Math.floor(Math.random() * dieFaces) + conMod;
    }
    roll(`Short rest (${spend} hit dice)`, `${spend}d${dieFaces}${conMod ? fmt(conMod).replace("+", "+") : ""}`);
    const patch: Partial<CharData> = {
      "hd-used": n(data["hd-used"]) + spend,
      hpcur: String(Math.min(n(data.hpmax), n(data.hpcur) + Math.max(0, healed))),
    };
    for (let i = 0; i < 16; i++) {
      if (s(data[`lfrec-${i}`]) === "SR") patch[`lfused-${i}`] = "";
    }
    set(patch);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium">
            Short rest
            <Zh text="Short Rest" />
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Hit dice available: {hdLeft} × d{dieFaces} (each heals the roll + Con{" "}
            {fmt(conMod)}). Short-rest features are recovered.
          </p>
          <div className="grid gap-1">
            <Label htmlFor="sr-dice">Hit dice to spend</Label>
            <Input
              id="sr-dice"
              type="number"
              min={0}
              max={hdLeft}
              value={dice}
              onChange={(e) => setDice(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply}>Take short rest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
