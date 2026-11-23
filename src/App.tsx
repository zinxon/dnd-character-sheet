import { createMemo, createSignal, For, Show } from "solid-js";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/solid/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/solid/select";
import data from "./data/characters.json";
import "./styles.css";

type Spellcasting = {
  label: string;
  labelZh: string;
  ability: string;
  abilityZh: string;
  dc: number;
  attack: number;
  note: string;
};

type Character = {
  id: string;
  name: string;
  classLevel: string;
  race: string;
  background: string;
  alignment: string;
  scores: Record<string, number>;
  saveProfs: string[];
  skillProfs: string[];
  skillExpertise: string[];
  hpMax: number;
  hpCur: number;
  ac: number;
  speed: number;
  hitDice: string;
  slots: { level: number; total: number; used: number }[];
  spellcasting: Spellcasting[];
  spells: {
    name: string;
    zh: string;
    level: number;
    prepared: boolean;
    source: string;
  }[];
  attacks: { name: string; bonus: string; damage: string }[];
  features: string;
  proficiencies: string;
  personality: string;
  ideals: string;
  bonds: string;
  flaws: string;
  allies: string;
  backstory: string;
  notes: string;
  coins: Record<string, string>;
};

const characters = data.characters as Character[];

const ABILITIES = [
  { key: "str", en: "Strength", zh: "力量" },
  { key: "dex", en: "Dexterity", zh: "敏捷" },
  { key: "con", en: "Constitution", zh: "體質" },
  { key: "int", en: "Intelligence", zh: "智力" },
  { key: "wis", en: "Wisdom", zh: "感知" },
  { key: "cha", en: "Charisma", zh: "魅力" },
] as const;

const SKILLS: { key: string; en: string; zh: string; ability: string }[] = [
  { key: "acrobatics", en: "Acrobatics", zh: "體操", ability: "dex" },
  { key: "animal handling", en: "Animal handling", zh: "馴養動物", ability: "wis" },
  { key: "arcana", en: "Arcana", zh: "奧秘", ability: "int" },
  { key: "athletics", en: "Athletics", zh: "運動", ability: "str" },
  { key: "deception", en: "Deception", zh: "欺瞞", ability: "cha" },
  { key: "history", en: "History", zh: "歷史", ability: "int" },
  { key: "insight", en: "Insight", zh: "洞悉", ability: "wis" },
  { key: "intimidation", en: "Intimidation", zh: "威嚇", ability: "cha" },
  { key: "investigation", en: "Investigation", zh: "調查", ability: "int" },
  { key: "medicine", en: "Medicine", zh: "醫藥", ability: "wis" },
  { key: "nature", en: "Nature", zh: "自然", ability: "int" },
  { key: "perception", en: "Perception", zh: "察覺", ability: "wis" },
  { key: "performance", en: "Performance", zh: "表演", ability: "cha" },
  { key: "persuasion", en: "Persuasion", zh: "說服", ability: "cha" },
  { key: "religion", en: "Religion", zh: "宗教", ability: "int" },
  { key: "sleight of hand", en: "Sleight of hand", zh: "巧手", ability: "dex" },
  { key: "stealth", en: "Stealth", zh: "隱匿", ability: "dex" },
  { key: "survival", en: "Survival", zh: "生存", ability: "wis" },
];

const mod = (score: number) => Math.floor((score - 10) / 2);
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function totalLevel(c: Character) {
  return (c.classLevel.match(/\d+/g) ?? []).reduce((a, b) => a + Number(b), 0);
}
const profBonus = (c: Character) => 2 + Math.floor((totalLevel(c) - 1) / 4);

function Zh(props: { text: string }) {
  return <Show when={props.text}><span class="zh">{props.text}</span></Show>;
}

export default function App() {
  const [charId, setCharId] = createSignal(characters[0].id);
  const character = createMemo(
    () => characters.find((c) => c.id === charId()) ?? characters[0],
  );

  const [hp, setHp] = createSignal<Record<string, number>>(
    Object.fromEntries(characters.map((c) => [c.id, c.hpCur])),
  );
  const [slotsUsed, setSlotsUsed] = createSignal<Record<string, Record<number, number>>>(
    Object.fromEntries(
      characters.map((c) => [
        c.id,
        Object.fromEntries(c.slots.map((s) => [s.level, s.used])),
      ]),
    ),
  );

  const [dark, setDark] = createSignal(false);
  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  };

  const changeHp = (delta: number) => {
    const c = character();
    setHp((prev) => ({
      ...prev,
      [c.id]: Math.max(0, Math.min(c.hpMax, (prev[c.id] ?? c.hpCur) + delta)),
    }));
  };

  const clickPip = (level: number, index: number) => {
    const c = character();
    setSlotsUsed((prev) => {
      const forChar = { ...(prev[c.id] ?? {}) };
      const used = forChar[level] ?? 0;
      forChar[level] = used === index + 1 ? index : index + 1;
      return { ...prev, [c.id]: forChar };
    });
  };

  const spellsByLevel = createMemo(() => {
    const groups = new Map<number, Character["spells"]>();
    for (const s of character().spells) {
      const list = groups.get(s.level) ?? [];
      list.push(s);
      groups.set(s.level, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  });

  const storyFields = createMemo(() =>
    [
      { en: "Personality traits", zh: "性格特質", text: character().personality },
      { en: "Ideals", zh: "理想", text: character().ideals },
      { en: "Bonds", zh: "牽絆", text: character().bonds },
      { en: "Flaws", zh: "缺點", text: character().flaws },
      { en: "Allies and organizations", zh: "盟友與組織", text: character().allies },
      { en: "Backstory", zh: "背景故事", text: character().backstory },
      { en: "Notes", zh: "筆記", text: character().notes },
    ].filter((f) => f.text.trim().length > 0),
  );

  return (
    <main class="page">
      <div class="topbar">
        <div>
          <h1 class="title">{character().name}</h1>
          <p class="subtitle">
            {character().classLevel}
            <Show when={character().race}> · {character().race}</Show>
            <Show when={character().background}> · {character().background}</Show>
          </p>
        </div>
        <div class="controls">
          <div>
            <Select
              value={charId()}
              onValueChange={(value) => {
                if (value) setCharId(value);
              }}
            >
              <SelectLabel class="select-label">
                Character<span class="zh">角色</span>
              </SelectLabel>
              <SelectTrigger class="select-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent class="select-content">
                <For each={characters}>
                  {(c) => (
                    <SelectItem class="select-item" value={c.id}>
                      {c.name}
                    </SelectItem>
                  )}
                </For>
              </SelectContent>
            </Select>
          </div>
          <button class="theme-button" type="button" onClick={toggleTheme}>
            {dark() ? "Light 明亮" : "Dark 深色"}
          </button>
        </div>
      </div>

      <Tabs defaultValue="core">
        <TabsList class="tabs-list" aria-label="Character sheet sections">
          <TabsTab class="tab" value="core">
            Core<span class="zh">核心</span>
          </TabsTab>
          <TabsTab class="tab" value="spells">
            Spells<span class="zh">法術</span>
          </TabsTab>
          <TabsTab class="tab" value="features">
            Features<span class="zh">特性</span>
          </TabsTab>
          <TabsTab class="tab" value="story">
            Story<span class="zh">故事</span>
          </TabsTab>
        </TabsList>

        <TabsPanel value="core">
          <div class="grid" role="list" aria-label="Ability scores">
            <For each={ABILITIES}>
              {(a) => (
                <div class="ability">
                  <div class="name">
                    {a.en}
                    <Zh text={a.zh} />
                  </div>
                  <div class="mod">{fmt(mod(character().scores[a.key]))}</div>
                  <span class="score">{character().scores[a.key]}</span>
                </div>
              )}
            </For>
          </div>

          <div class="panel" style={{ "margin-top": "14px" }}>
            <div class="combat">
              <div>
                <div class="value">{character().ac}</div>
                <div class="label">Armor class<span class="zh">護甲等級</span></div>
              </div>
              <div>
                <div class="value">{fmt(mod(character().scores.dex))}</div>
                <div class="label">Initiative<span class="zh">先攻</span></div>
              </div>
              <div>
                <div class="value">{character().speed} ft</div>
                <div class="label">Speed<span class="zh">速度</span></div>
              </div>
              <div>
                <div class="value">
                  {hp()[character().id]} / {character().hpMax}
                </div>
                <div class="label">Hit points<span class="zh">生命值</span></div>
                <div class="hp-controls">
                  <button type="button" aria-label="Lose one hit point" onClick={() => changeHp(-1)}>
                    −
                  </button>
                  <button type="button" aria-label="Gain one hit point" onClick={() => changeHp(1)}>
                    +
                  </button>
                </div>
              </div>
            </div>
            <p class="text-block" style={{ "margin-top": "10px" }}>
              Hit dice 生命骰: {character().hitDice} · Proficiency bonus 熟練加值:{" "}
              {fmt(profBonus(character()))}
            </p>
          </div>

          <div class="columns">
            <section class="panel">
              <h2>Saving throws<span class="zh">豁免檢定</span></h2>
              <div class="rows">
                <For each={ABILITIES}>
                  {(a) => (
                    <div class="row">
                      <span>
                        <Show when={character().saveProfs.includes(a.key)}>
                          <span class="prof-dot" aria-label="Proficient">●</span>
                        </Show>
                        {a.en}
                        <Zh text={a.zh} />
                      </span>
                      <span class="bonus">
                        {fmt(
                          mod(character().scores[a.key]) +
                            (character().saveProfs.includes(a.key)
                              ? profBonus(character())
                              : 0),
                        )}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </section>

            <section class="panel">
              <h2>Spell slots<span class="zh">法術位</span></h2>
              <For each={character().slots}>
                {(s) => (
                  <div class="slot-row">
                    <span>
                      Level {s.level}
                      <Zh text={`第 ${s.level} 環`} />
                    </span>
                    <span class="slot-pips">
                      <For each={Array.from({ length: s.total }, (_, i) => i)}>
                        {(i) => (
                          <button
                            type="button"
                            class={{
                              "slot-pip": true,
                              used: (slotsUsed()[character().id]?.[s.level] ?? 0) > i,
                            }}
                            aria-label={`Level ${s.level} slot ${i + 1}`}
                            aria-pressed={(slotsUsed()[character().id]?.[s.level] ?? 0) > i}
                            onClick={() => clickPip(s.level, i)}
                          />
                        )}
                      </For>
                    </span>
                  </div>
                )}
              </For>
              <p class="text-block" style={{ "margin-top": "10px" }}>
                Tap a circle to mark a slot as used. 點圓圈標記已用法術位。
              </p>
            </section>
          </div>

          <section class="panel">
            <h2>Skills<span class="zh">技能</span></h2>
            <div class="rows">
              <For each={SKILLS}>
                {(s) => (
                  <div class="row">
                    <span>
                      <Show when={character().skillProfs.includes(s.key)}>
                        <span class="prof-dot" aria-label="Proficient">●</span>
                      </Show>
                      {s.en}
                      <Zh text={s.zh} />
                    </span>
                    <span class="bonus">
                      {fmt(
                        mod(character().scores[s.ability]) +
                          (character().skillProfs.includes(s.key)
                            ? profBonus(character()) *
                              (character().skillExpertise.includes(s.key) ? 2 : 1)
                            : 0),
                      )}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </section>

          <section class="panel">
            <h2>Attacks<span class="zh">攻擊</span></h2>
            <table class="attacks">
              <thead>
                <tr>
                  <th>Name 名稱</th>
                  <th>Bonus 加值</th>
                  <th>Damage 傷害</th>
                </tr>
              </thead>
              <tbody>
                <For each={character().attacks}>
                  {(atk) => (
                    <tr>
                      <td>{atk.name}</td>
                      <td>{atk.bonus || "—"}</td>
                      <td>{atk.damage || "—"}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </section>

          <section class="panel">
            <h2>Proficiencies<span class="zh">熟練項</span></h2>
            <p class="text-block">{character().proficiencies}</p>
          </section>
        </TabsPanel>

        <TabsPanel value="spells">
          <section class="panel">
            <h2>Spellcasting<span class="zh">施法</span></h2>
            <div class="rows">
              <For each={character().spellcasting}>
                {(sc) => (
                  <div class="row">
                    <span>
                      {sc.label}
                      <Zh text={sc.labelZh} /> · {sc.ability}
                      <Zh text={sc.abilityZh} />
                    </span>
                    <span class="bonus">
                      Save DC {sc.dc} · Attack {fmt(sc.attack)}
                    </span>
                  </div>
                )}
              </For>
            </div>
            <For each={character().spellcasting}>
              {(sc) => (
                <Show when={sc.note}>
                  <p class="text-block" style={{ "margin-top": "8px" }}>
                    {sc.note}
                  </p>
                </Show>
              )}
            </For>
          </section>

          <section class="panel">
            <h2>Spellbook<span class="zh">法術書</span></h2>
            <For each={spellsByLevel()}>
              {([level, spells]) => (
                <div class="spell-group">
                  <h3>
                    {level === 0 ? "Cantrips 戲法" : `Level ${level} 第 ${level} 環`}
                  </h3>
                  <For each={spells}>
                    {(s) => (
                      <div class="spell">
                        <span>
                          {s.name}
                          <Zh text={s.zh} />
                        </span>
                        <span class="source">{s.source}</span>
                        <Show when={s.prepared}>
                          <span class="prep">Prepared 已準備</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </For>
          </section>
        </TabsPanel>

        <TabsPanel value="features">
          <section class="panel">
            <h2>Features and traits<span class="zh">特性與特質</span></h2>
            <p class="text-block">{character().features}</p>
          </section>
        </TabsPanel>

        <TabsPanel value="story">
          <section class="panel">
            <For each={storyFields()}>
              {(f) => (
                <>
                  <h2>
                    {f.en}
                    <Zh text={f.zh} />
                  </h2>
                  <p class="text-block">{f.text}</p>
                </>
              )}
            </For>
          </section>
        </TabsPanel>
      </Tabs>

      <p class="footer-note">
        Built with Solid 2 and the Vercel UI SDK (Tabs and Select). Data carried
        over from the classic sheet. 用 Solid 2 同 Vercel UI SDK 砌，資料嚟自經典版角色卡。
      </p>
    </main>
  );
}
