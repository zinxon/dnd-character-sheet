"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { playSpellSound } from "@/lib/spellSound";
import { playSpellFx } from "@/lib/spellFx";
import { SpellFxLayer } from "@/components/sheet/SpellFxLayer";
import { Portrait } from "@/components/sheet/Portrait";
import { DiceTray } from "@/components/sheet/DiceTray";
import { AbilityBox, BonusButton, Panel, ProfDot, StatBox } from "@/components/sheet/blocks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BackpackIcon,
  BadgeCheckIcon,
  BookOpenIcon,
  DumbbellIcon,
  LayoutGridIcon,
  Loader2Icon,
  NotebookPenIcon,
  ScrollTextIcon,
  SparklesIcon,
  SwordsIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { useIsMobile } from "@/components/sheet/useIsMobile";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
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
  profBonus,
  parseDice,
  rollDice,
  rollPool as poolResult,
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
  zhHigher: string | null;
};

type LogEntry = RollResult & { label: string; at: number };

// Phone section menu: tiles cascade up from the menu button (bottom-right)
// and fold back down in reverse order.
const menuMotion: Variants = {
  open: { transition: { staggerChildren: 0.035, staggerDirection: -1 } },
  closed: { transition: { staggerChildren: 0.02 } },
};
const menuItemMotion: Variants = {
  closed: { opacity: 0, y: 24, scale: 0.9 },
  open: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 480, damping: 28 } },
};

type MobileSection =
  | "abilities"
  | "skills"
  | "actions"
  | "inventory"
  | "spells"
  | "features"
  | "proficiencies"
  | "story"
  | "notes";

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
  const [hpAmount, setHpAmount] = useState("");
  // The roll currently animating (its result arrives when the dice settle).
  const [pending, setPending] = useState<{ label: string; expr: string } | null>(null);
  // The latest result shows as a notification for a few seconds.
  const [shownAt, setShownAt] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const [mobileSection, setMobileSection] = useState<MobileSection>("abilities");
  const [menuOpen, setMenuOpen] = useState(false);
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
    const me = { label, expr };
    try {
      const { count, faces } = parseDice(expr);
      if (ANIMATED_FACES.includes(faces) && count <= MAX_ANIMATED_DICE) {
        // The physics decides the result: wait for the dice to settle.
        setPending(me);
        const { rollPhysical } = await import("@/lib/diceBox");
        landed = await rollPhysical(count, faces);
      }
    } catch {
      // fall through to a plain random roll
    } finally {
      // Clear only our own marker — a newer roll may have replaced it.
      setPending((p) => (p === me ? null : p));
    }
    try {
      const result = rollDice(expr, landed ?? undefined);
      setLog((prev) => [{ ...result, label, at: Date.now() }, ...prev].slice(0, 30));
    } catch {
      // unparsable damage strings etc. — ignore
    }
  }, []);

  const latestAt = log[0]?.at;
  useEffect(() => {
    if (!latestAt) return;
    setShownAt(latestAt);
    const t = setTimeout(() => setShownAt((cur) => (cur === latestAt ? null : cur)), 4000);
    return () => clearTimeout(t);
  }, [latestAt]);

  // Roll a mixed pool from the dice tray (e.g. 2d6 + 1d8 + 2).
  const rollDicePool = useCallback(
    async (groups: { count: number; faces: number }[], bonus: number, label: string) => {
      const me = { label, expr: label };
      let landed: number[][] | null = null;
      const animate =
        groups.every((g) => ANIMATED_FACES.includes(g.faces)) &&
        groups.reduce((a, g) => a + g.count, 0) <= MAX_ANIMATED_DICE;
      try {
        if (animate) {
          setPending(me);
          const { rollPool } = await import("@/lib/diceBox");
          landed = await rollPool(groups);
        }
      } catch {
        // fall through to a plain random roll
      } finally {
        setPending((p) => (p === me ? null : p));
      }
      const result = poolResult(groups, bonus, landed);
      setLog((prev) => [{ ...result, label, at: Date.now() }, ...prev].slice(0, 30));
    },
    [],
  );

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

  const passive = (key: string) => 10 + skillBonus(data, key);
  const numInput =
    "bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";

  // ── Pieces, laid out differently on desktop and phone ──────────────
  const abilityBoxes = ABILITIES.map((a) => (
    <AbilityBox
      key={a}
      name={ABILITY_NAMES[a]}
      score={scores[a]}
      onRoll={() => roll(`${ABILITY_NAMES[a]} check`, String(mod(scores[a])))}
      onScore={(v) =>
        set({
          manualScores: {
            ...(data.manualScores as Record<string, unknown>),
            [a]: v,
          },
        })
      }
    />
  ));

  const speedInput = (
    <input
      type="number"
      value={n(data.speedBase) || 30}
      onChange={(e) => set({ speedBase: parseInt(e.target.value || "0", 10) })}
      aria-label="Walking speed"
      className={cn("w-10 text-right text-2xl font-medium", numInput)}
    />
  );

  const acInput = (
    <input
      type="number"
      value={acShown}
      onChange={(e) => set({ acManual: e.target.value })}
      aria-label="Armor class"
      className={cn("w-12 text-center text-3xl font-medium", numInput)}
    />
  );

  const inspirationButton = (className?: string) => (
    <button
      type="button"
      onClick={() => set({ inspiration: !data.inspiration })}
      aria-pressed={Boolean(data.inspiration)}
      className={cn(
        "plate flex flex-col items-center justify-center rounded-xl border bg-card px-2 py-1.5 text-center",
        data.inspiration
          ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "bg-card",
        className,
      )}
    >
      <SparklesIcon className="size-6" />
      <span className="mt-1 text-[0.65rem] leading-tight font-semibold tracking-wider uppercase">
        Inspiration
        <span className="block font-normal tracking-normal opacity-70">{zhOf("Inspiration")}</span>
      </span>
    </button>
  );

  const hpBox = (className?: string) => (
    <div className={cn("flex min-w-0 gap-3 plate rounded-xl border bg-card p-2", className)}>
      <div className="grid w-20 shrink-0 grid-cols-1 content-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-emerald-700 dark:text-emerald-400"
          onClick={() => n(hpAmount) && (applyHeal(n(hpAmount)), setHpAmount(""))}
        >
          Heal
        </Button>
        <input
          type="number"
          value={hpAmount}
          onChange={(e) => setHpAmount(e.target.value)}
          aria-label="Hit point amount"
          className={cn("h-7 w-full min-w-0 rounded-md border bg-background text-center text-sm", numInput)}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-red-700 dark:text-red-400"
          onClick={() => n(hpAmount) && (applyDamage(n(hpAmount)), setHpAmount(""))}
        >
          Damage
        </Button>
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-3 items-end gap-1 text-center">
        {(
          [
            ["Current", "hpcur"],
            ["Max", "hpmax"],
            ["Temp", "hptmp"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="grid gap-0.5">
            <span className="text-[0.65rem] leading-tight font-semibold tracking-wider uppercase">
              {label}
              <span className="block font-normal tracking-normal text-muted-foreground">{zhOf(label)}</span>
            </span>
            <input
              type="number"
              value={s(data[key])}
              placeholder="—"
              onChange={(e) => set({ [key]: e.target.value })}
              aria-label={`${label} hit points`}
              className={cn("w-full text-center text-3xl font-medium", numInput)}
            />
          </label>
        ))}
        <span className="col-span-3 text-[0.65rem] font-semibold tracking-wider uppercase">
          Hit points <span className="font-normal tracking-normal text-muted-foreground">{zhOf("Hit Points")}</span>
        </span>
      </div>
    </div>
  );

  const savesPanel = (
    <Panel title="Saving Throws">
      <div className="grid grid-cols-2 gap-2 text-sm">
        {ABILITIES.map((a) => (
          <div key={a} className="flex items-center gap-1.5 rounded-lg border px-2 py-1">
            <ProfDot
              prof={Boolean(data[`savep-${a}`])}
              onCycle={() => set({ [`savep-${a}`]: !data[`savep-${a}`] })}
              label={`${ABILITY_NAMES[a]} save proficiency`}
            />
            <span className="flex-1 font-semibold uppercase">{a}</span>
            <BonusButton
              value={saveBonus(data, a)}
              onClick={() => roll(`${ABILITY_NAMES[a]} save`, String(saveBonus(data, a)))}
              label={`Roll ${ABILITY_NAMES[a]} save`}
            />
          </div>
        ))}
      </div>
    </Panel>
  );

  const sensesPanel = (
    <Panel title="Senses">
      <div className="grid gap-2 text-sm">
        {(
          [
            ["Passive Perception", "perception"],
            ["Passive Investigation", "investigation"],
            ["Passive Insight", "insight"],
          ] as const
        ).map(([label, key]) => (
          <div key={key} className="flex items-center gap-2 rounded-full border pr-3">
            <span className="flex size-9 items-center justify-center rounded-full border-r bg-muted font-semibold">
              {passive(key)}
            </span>
            <span className="text-xs font-semibold uppercase">{label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );

  const hitDicePanel = (
    <Panel title="Hit Dice">
      <div className="grid gap-2 text-sm">
        <div>
          {s(data.hitdice) || "—"}{" "}
          <span className="text-muted-foreground">({n(data["hd-total"]) - n(data["hd-used"])} left)</span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-semibold uppercase">
            Death saves <span className="font-normal normal-case text-muted-foreground">{zhOf("Death Saves")}</span>
          </span>
          {(
            [
              ["Success", "dss"],
              ["Failure", "dsf"],
            ] as const
          ).map(([label, prefix]) => (
            <span key={prefix} className="flex items-center gap-1.5">
              <span className="w-16">{label}</span>
              {[0, 1, 2].map((i) => (
                <Checkbox
                  key={i}
                  checked={Boolean(data[`${prefix}-${i}`])}
                  onCheckedChange={(c) => set({ [`${prefix}-${i}`]: Boolean(c) })}
                  aria-label={`Death save ${label.toLowerCase()} ${i + 1}`}
                />
              ))}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );

  const proficienciesPanel = (
    <Panel title="Proficiencies and Languages">
      <div className="grid gap-2 text-sm whitespace-pre-wrap">
        {s(data.proficiencies) || <span className="text-muted-foreground">None yet</span>}
        {data["proficiencies-zh"] ? (
          <span className="text-muted-foreground">{s(data["proficiencies-zh"])}</span>
        ) : null}
        <span className="text-xs text-muted-foreground">Edit in Features &amp; Traits.</span>
      </div>
    </Panel>
  );

  const skillsPanel = (
    <Panel title="Skills">
      <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase">Prof</span>
        <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase">Mod</span>
        <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase">Skill</span>
        <span className="text-right text-[0.6rem] font-semibold text-muted-foreground uppercase">Bonus</span>
        {SKILLS.map((skill) => {
          const prof = Boolean(data[`skp-${skill.key}`]);
          const expert = Boolean(data[`ske-${skill.key}`]);
          return (
            <Fragment key={skill.key}>
              <ProfDot
                prof={prof}
                expert={expert}
                label={`${skill.name} proficiency`}
                // none → proficient → expertise → none
                onCycle={() =>
                  set(
                    !prof
                      ? { [`skp-${skill.key}`]: true, [`ske-${skill.key}`]: false }
                      : !expert
                        ? { [`ske-${skill.key}`]: true }
                        : { [`skp-${skill.key}`]: false, [`ske-${skill.key}`]: false },
                  )
                }
              />
              <span className="text-xs text-muted-foreground uppercase">{skill.ability}</span>
              <span className="truncate border-b py-1">
                {skill.name}
                <Zh text={skill.name} />
              </span>
              <BonusButton
                value={skillBonus(data, skill.key)}
                onClick={() => roll(skill.name, String(skillBonus(data, skill.key)))}
                label={`Roll ${skill.name}`}
              />
            </Fragment>
          );
        })}
      </div>
    </Panel>
  );

  const defensesField = (
    <Textarea
      value={s(data.defenses)}
      onChange={(e) => set({ defenses: e.target.value })}
      rows={2}
      placeholder="Resistances, immunities, vulnerabilities"
      aria-label="Defenses"
      className="min-h-0 resize-none border-none p-0 text-sm shadow-none focus-visible:ring-0"
    />
  );

  const conditionToggles = (
    <div className="flex flex-wrap gap-1.5">
      {CONDITIONS.map((c) => {
        const active = conditions.includes(c);
        return (
          <Button
            key={c}
            size="sm"
            variant={active ? "default" : "outline"}
            onClick={() =>
              set({ conditions: active ? conditions.filter((x) => x !== c) : [...conditions, c] })
            }
          >
            {c}
            {zhOf(c) ? <span className="ml-1 text-[0.8em] opacity-80">{zhOf(c)}</span> : null}
          </Button>
        );
      })}
    </div>
  );

  const activeConditions = conditions.length ? (
    <div className="flex flex-wrap gap-1">
      {conditions.map((c) => (
        <Badge key={c} variant="secondary">
          {c}
          {zhOf(c) ? <span className="ml-1 opacity-70">{zhOf(c)}</span> : null}
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-sm text-muted-foreground">None</span>
  );

  // Section bodies shared by the desktop tabs and the phone section menu.
  const sections = {
    actions: (
      <div className="grid gap-4">
        <AttacksCard data={data} set={set} roll={roll} casters={casters} />
        <LimitedFeaturesCard data={data} set={set} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SlotPips slots={slots} data={data} onToggle={toggleSlot} />
          <RollLog log={log} />
        </div>
      </div>
    ),
    spells: (
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
    ),
    inventory: <InventoryTab data={data} set={set} />,
    features: <FeaturesTab data={data} set={set} />,
    story: <StoryTab data={data} set={set} />,
    notes: (
      <Textarea
        value={s(data.notes)}
        onChange={(e) => set({ notes: e.target.value })}
        rows={16}
        placeholder="Session notes, plans, reminders…"
        aria-label="Notes"
      />
    ),
  };

  const overlays = (
    <>
      {/* The 3D dice overlay is created by lib/diceBox on <body>, outside React. */}
      <SpellFxLayer />
      <DiceTray
        custom={(data.customDice as string[] | undefined) ?? []}
        onCustomChange={(customDice) => set({ customDice })}
        rollPool={rollDicePool}
      />

      {/* Hidden while the dice roller is open — its own log shows the same. */}
      {!diceOpen && (pending || (log.length > 0 && shownAt === log[0].at)) && (
        <button
          type="button"
          onClick={() => setDiceOpen(true)}
          // Top-right on every screen size, like a notification.
          className="print:hidden fixed top-3 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-full border bg-background px-4 py-2 shadow-lg"
          aria-label="Latest roll — open dice roller"
        >
          {pending ? (
            <>
              <Loader2Icon className="size-5 animate-spin" />
              <span className="max-w-56 truncate text-sm text-muted-foreground">
                Rolling {pending.label === pending.expr ? pending.expr : `${pending.label} · ${pending.expr}`}…
              </span>
            </>
          ) : (
            <>
              <span key={log[0].at} className="rollpop text-xl font-medium">
                {log[0].total}
              </span>
              <span className="max-w-56 truncate text-sm text-muted-foreground">
                {log[0].label} · {log[0].detail}
                {log[0].nat === "crit" ? " · critical!" : log[0].nat === "fumble" ? " · fumble" : ""}
              </span>
            </>
          )}
        </button>
      )}
      <DiceDialog open={diceOpen} onOpenChange={setDiceOpen} roll={roll} log={log} pending={pending} />
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
    </>
  );

  // ── Phone: compact header + one section at a time ───────────────────
  if (isMobile) {
    const MOBILE_SECTIONS: { key: MobileSection; label: string; icon: typeof SparklesIcon; wide?: boolean }[] = [
      { key: "abilities", label: "Abilities, Saves, Senses", icon: DumbbellIcon, wide: true },
      { key: "skills", label: "Skills", icon: SparklesIcon },
      { key: "actions", label: "Actions", icon: SwordsIcon },
      { key: "inventory", label: "Inventory", icon: BackpackIcon },
      { key: "spells", label: "Spells", icon: WandSparklesIcon },
      { key: "features", label: "Features & Traits", icon: ScrollTextIcon },
      { key: "proficiencies", label: "Proficiencies", icon: BadgeCheckIcon },
      { key: "story", label: "Background", icon: BookOpenIcon },
      { key: "notes", label: "Notes", icon: NotebookPenIcon },
    ];
    const current = MOBILE_SECTIONS.find((x) => x.key === mobileSection)!;
    const go = (key: MobileSection) => {
      setMobileSection(key);
      setMenuOpen(false);
      window.scrollTo({ top: 0 });
    };

    return (
      <main className="min-h-svh bg-muted/50 pb-24">
        <header className="sticky top-0 z-40 bg-sidebar text-sidebar-foreground border-b border-border shadow-md">
          <div className="flex items-center gap-3 px-3 py-2">
            <Portrait
              src={s(data.portrait)}
              name={s(data.charname)}
              onChange={(portrait) => set({ portrait })}
              className="size-12"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg leading-tight font-medium">{s(data.charname) || "Unnamed"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[s(data.race), s(data.classlevel)].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">Level {level}</p>
            </div>
            <Popover>
              <PopoverTrigger className="rounded-lg border border-border bg-sidebar-accent px-3 py-1 text-center">
                <span className="block text-[0.6rem] font-semibold tracking-wider uppercase">
                  Hit points <span className="font-normal text-muted-foreground">{zhOf("Hit Points")}</span>
                </span>
                <span className="text-xl font-medium">
                  {s(data.hpcur) || "—"} / {s(data.hpmax) || "—"}
                </span>
                {hptmp ? <span className="ml-1 text-xs text-muted-foreground">+{hptmp}</span> : null}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-2">
                {hpBox("border-none p-0 shadow-none")}
              </PopoverContent>
            </Popover>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] items-center gap-1 border-t border-border px-2 py-1.5 text-center">
            <div>
              <span className="block text-[0.6rem] font-semibold uppercase text-muted-foreground">Prof</span>
              <span className="text-xl font-medium">{fmt(pb)}</span>
            </div>
            <div>
              <span className="block text-[0.6rem] font-semibold uppercase text-muted-foreground">Speed</span>
              <span className="text-xl font-medium">{n(data.speedBase) || 30}</span>
              <span className="text-xs text-muted-foreground"> ft.</span>
            </div>
            <button
              type="button"
              onClick={() => roll("Initiative", String(mod(scores.dex)))}
              aria-label="Roll initiative"
            >
              <span className="block text-[0.6rem] font-semibold uppercase text-muted-foreground">Initiative</span>
              <span className="rounded border border-border px-1.5 text-xl font-medium">{fmt(mod(scores.dex))}</span>
            </button>
            <div>
              <span className="block text-[0.6rem] font-semibold uppercase text-muted-foreground">Armor</span>
              <span className="text-xl font-medium">{acShown}</span>
            </div>
            <div className="grid gap-1">
              <Popover>
                <PopoverTrigger className="rounded border border-border px-2 py-0.5 text-[0.6rem] font-semibold uppercase">
                  Defenses
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <p className="mb-1 text-xs font-semibold uppercase">
                    Defenses <span className="font-normal normal-case text-muted-foreground">{zhOf("Defenses")}</span>
                  </p>
                  {defensesField}
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger
                  className={cn(
                    "rounded border px-2 py-0.5 text-[0.6rem] font-semibold uppercase",
                    conditions.length ? "border-amber-400 text-amber-300" : "border-border",
                  )}
                >
                  Conditions{conditions.length ? ` (${conditions.length})` : ""}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">{conditionToggles}</PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        <div className="px-3 pt-3">
          <h1 className="mb-3 text-center text-sm font-semibold tracking-wider uppercase">
            {current.label}
            {zhOf(current.label) && (
              <span className="ml-1.5 font-normal tracking-normal text-muted-foreground normal-case">
                {zhOf(current.label)}
              </span>
            )}
          </h1>

          {mobileSection === "abilities" && (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-2">{abilityBoxes}</div>
              <div className="grid grid-cols-2 gap-2">
                {inspirationButton()}
                <StatBox top="Walking" bottom="Speed">
                  {speedInput}
                  <span className="text-xs text-muted-foreground">ft.</span>
                </StatBox>
              </div>
              {savesPanel}
              {sensesPanel}
              {hitDicePanel}
            </div>
          )}
          {mobileSection === "skills" && skillsPanel}
          {mobileSection === "proficiencies" && proficienciesPanel}
          {mobileSection === "actions" && sections.actions}
          {mobileSection === "spells" && sections.spells}
          {mobileSection === "inventory" && sections.inventory}
          {mobileSection === "features" && sections.features}
          {mobileSection === "story" && sections.story}
          {mobileSection === "notes" && sections.notes}
        </div>

        {/* Section menu */}
        <motion.button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close sections menu" : "Open sections menu"}
          aria-expanded={menuOpen}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.86 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/40 print:hidden"
        >
          {/* Grid icon rotates into a close icon. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={menuOpen ? "close" : "open"}
              initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="flex"
            >
              {menuOpen ? <XIcon className="size-6" /> : <LayoutGridIcon className="size-6" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.1 } }}
          >
            <motion.nav
              className="absolute inset-x-3 bottom-22 grid grid-cols-2 gap-2"
              onClick={(e) => e.stopPropagation()}
              aria-label="Sheet sections"
              variants={menuMotion}
              initial="closed"
              animate="open"
              exit="closed"
            >
              {MOBILE_SECTIONS.map(({ key, label, icon: Icon, wide }) => (
                <motion.button
                  variants={menuItemMotion}
                  whileTap={{ scale: 0.94 }}
                  key={key}
                  type="button"
                  onClick={() => go(key)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-2 py-3 text-xs font-semibold tracking-wide text-card-foreground uppercase shadow-lg",
                    wide && "col-span-2",
                    key === mobileSection && "ring-2 ring-primary",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="text-left">
                    {label}
                    {zhOf(label) && <span className="block font-normal tracking-normal text-muted-foreground normal-case">{zhOf(label)}</span>}
                  </span>
                </motion.button>
              ))}
              <motion.div variants={menuItemMotion} className="col-span-2 mt-1 grid grid-cols-3 gap-2">
                {(
                  [
                    ["Short Rest", () => setShortRestOpen(true), false],
                    ["Long Rest", longRest, false],
                    ["Dice", () => setDiceOpen(true), false],
                    ["Level Up", () => setLevelUpOpen(true), true],
                    ["Print", () => window.print(), false],
                  ] as const
                ).map(([label, action, primary]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      action();
                    }}
                    className={cn(
                      "rounded-lg px-2 py-2 text-xs font-medium",
                      primary
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {label} <span className="opacity-80">{zhOf(label)}</span>
                  </button>
                ))}
                <Link href="/" className="rounded-lg bg-secondary px-2 py-2 text-center text-xs font-medium text-secondary-foreground">
                  Library
                </Link>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
        </AnimatePresence>

        {overlays}
      </main>
    );
  }

  // ── Tablet / desktop: dashboard ─────────────────────────────────────
  return (
    <main className="min-h-svh bg-muted/50 pb-12">
      <header className="bg-sidebar text-sidebar-foreground border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Portrait
            src={s(data.portrait)}
            name={s(data.charname)}
            onChange={(portrait) => set({ portrait })}
          />
          <div className="min-w-56 flex-1">
            <Input
              value={s(data.charname)}
              onChange={(e) => set({ charname: e.target.value })}
              className="h-auto border-none bg-transparent px-0 text-2xl font-semibold text-sidebar-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
              aria-label="Character name"
            />
            <p className="text-sm text-sidebar-foreground/80">
              {[s(data.race), s(data.classlevel)].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Level {level}</span>
              <span className="flex items-center gap-1.5">
                XP
                <input
                  type="number"
                  value={s(data.xp)}
                  onChange={(e) => set({ xp: e.target.value })}
                  aria-label="Experience points"
                  className="w-20 rounded border border-border bg-sidebar-accent px-1.5 py-0.5 text-sidebar-foreground"
                />
                {nextThreshold != null && (
                  <span>
                    / {nextThreshold.toLocaleString()}
                    {xp >= nextThreshold ? " — ready to level up" : ""}
                  </span>
                )}
              </span>
              <span>
                {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Unsaved changes"}
              </span>
            </div>
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
              Dice
              <Zh text="Dice" />
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
            <Button onClick={() => setLevelUpOpen(true)}>
              Level up
              <Zh text="Level Up" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4">
        {/* Stat strip */}
        <section className="grid grid-cols-6 gap-2 py-4 xl:grid-cols-[repeat(6,minmax(0,1fr))_repeat(3,minmax(0,0.9fr))_minmax(310px,3fr)]">
          {abilityBoxes}
          <StatBox top="Proficiency" bottom="Bonus" className="col-span-2 xl:col-span-1">
            <span className="text-2xl font-medium">{fmt(pb)}</span>
          </StatBox>
          <StatBox top="Walking" bottom="Speed" className="col-span-2 xl:col-span-1">
            {speedInput}
            <span className="text-xs text-muted-foreground">ft.</span>
          </StatBox>
          {inspirationButton("col-span-2 xl:col-span-1")}
          {hpBox("col-span-6 xl:col-span-1")}
        </section>

        {/* Three columns */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,250px)_minmax(0,290px)_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            {savesPanel}
            {sensesPanel}
            {hitDicePanel}
            {proficienciesPanel}
          </div>

          {skillsPanel}

          <div className="grid min-w-0 content-start gap-4 md:col-span-2 xl:col-span-1">
            <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <StatBox top="Initiative" className="px-4">
                <BonusButton
                  value={mod(scores.dex)}
                  onClick={() => roll("Initiative", String(mod(scores.dex)))}
                  label="Roll initiative"
                  className="border-2 px-3 text-2xl"
                />
              </StatBox>
              <StatBox top="Armor" bottom="Class" className="rounded-b-[2rem] px-4">
                {acInput}
              </StatBox>
              <div className="grid gap-1 plate rounded-xl border bg-card p-2">
                <span className="text-xs font-semibold uppercase">
                  Defenses <span className="font-normal normal-case text-muted-foreground">{zhOf("Defenses")}</span>
                </span>
                {defensesField}
              </div>
              <div className="grid content-start gap-1 plate rounded-xl border bg-card p-2">
                <span className="flex items-center justify-between text-xs font-semibold uppercase">
                  <span>
                    Conditions <span className="font-normal normal-case text-muted-foreground">{zhOf("Conditions")}</span>
                  </span>
                  <Popover>
                    <PopoverTrigger
                      className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-6 px-1.5 text-xs normal-case")}
                    >
                      Manage
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72">{conditionToggles}</PopoverContent>
                  </Popover>
                </span>
                {activeConditions}
              </div>
            </div>

            <section className="min-w-0 plate rounded-xl border bg-card p-3">
              <Tabs defaultValue="actions">
                <TabsList className="flex h-auto w-full flex-wrap justify-start [&>*]:flex-none">
                  <TabsTrigger value="actions">Actions<Zh text="Actions" /></TabsTrigger>
                  <TabsTrigger value="spells">Spells<Zh text="Spells" /></TabsTrigger>
                  <TabsTrigger value="inventory">Inventory<Zh text="Inventory" /></TabsTrigger>
                  <TabsTrigger value="features">Features &amp; Traits<Zh text="Features & Traits" /></TabsTrigger>
                  <TabsTrigger value="story">Background<Zh text="Background" /></TabsTrigger>
                  <TabsTrigger value="notes">Notes<Zh text="Notes" /></TabsTrigger>
                </TabsList>
                {(Object.keys(sections) as (keyof typeof sections)[]).map((key) => (
                  <TabsContent key={key} value={key} className="mt-4">
                    {sections[key]}
                  </TabsContent>
                ))}
              </Tabs>
            </section>
          </div>
        </div>
      </div>

      {overlays}
    </main>
  );
}


type SetFn = (patch: Partial<CharData>) => void;
type RollFn = (label: string, expr: string) => void;

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

  const cast = (lvl: number, spellName: string) => {
    if (lvl === 0) return;
    playSpellSound(spellName);
    playSpellFx(spellName);
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
                        <Button size="sm" variant="outline" onClick={() => cast(lvl, entry.name)}>
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
                      {d.zhHigher && <p className="text-muted-foreground">{d.zhHigher}</p>}
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

// Traditional Chinese companion to a free-text field. It is a separate,
// editable translation: editing the English does not update it.
function ZhField({
  value,
  onChange,
  rows,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  label: string;
}) {
  return (
    <div className="mt-3 grid gap-1.5">
      <Label className="text-xs text-muted-foreground">繁體中文</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        aria-label={label}
        placeholder="中文翻譯"
        className="text-muted-foreground"
      />
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
          <ZhField
            value={s(data["features-zh"])}
            onChange={(v) => set({ "features-zh": v })}
            rows={14}
            label="Features and traits (Traditional Chinese)"
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
          <ZhField
            value={s(data["proficiencies-zh"])}
            onChange={(v) => set({ "proficiencies-zh": v })}
            rows={4}
            label="Proficiencies and languages (Traditional Chinese)"
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
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roll: RollFn;
  log: LogEntry[];
  pending: { label: string; expr: string } | null;
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
            {pending && (
              <li className="flex items-center gap-2" aria-live="polite">
                <Loader2Icon className="size-4 animate-spin" />
                <span className="text-muted-foreground">Rolling {pending.expr}…</span>
              </li>
            )}
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
