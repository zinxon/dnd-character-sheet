# D&D character sheet — Solid version

A D&D 5e (2014) character sheet rebuilt with Solid 2 and the Vercel UI SDK,
on branch `solid` of this repo. The classic single-file version stays on
`main`.

用 Solid 2 同 Vercel UI SDK 重寫嘅 D&D 5e（2014）角色卡，喺呢個 repo 嘅
`solid` 分支；經典單檔版保留喺 `main`。

## Stack

- Solid 2 (`solid-js` 2.0.3, `@solidjs/vite-plugin` start mode, Oxc compiler)
- Vercel UI SDK beta (`@ui-sdk/core` + `@ui-sdk/solid`) — the character
  switcher is its Select, the sections are its Tabs; both ship unstyled, so
  all styling is this project's own
- Vite 8, TypeScript

## What's in it

- Both characters from the classic sheet, switchable: James (Human Wizard,
  School of Evocation, 7) and Tempest Lightning Mage (Cleric 3 Tempest /
  Wizard 5 Order of Scribes)
- Auto-calculated ability modifiers, saving throws, skills and spellcasting
  stats; editable hit points and spell slot pips, held in Solid signals
- Bilingual labels and spell names: English first, Traditional Chinese behind
- Styled to the owner's global design rules (see `DESIGN_RULES.md` in the
  owner's workspace): sentence case, semantic tokens, no bold, no gradients,
  shadows only on floating elements, motion under 300ms; checked at 390px,
  in dark mode, and by keyboard

Full spell description texts, the sourcebook library and the character
creation wizard remain in the classic version on `main` for now.

## Run it

```bash
npm install
npm run dev     # develop
npm run build   # static client in dist/client, server bundle in dist/server
```
