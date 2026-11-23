# D&D character sheet — React version (1 to 1 migration, in progress)

The classic single-file sheet on `main` is the reference. This branch is its
1 to 1 migration to React 19 + the Vercel UI SDK (`@ui-sdk/react` +
`@ui-sdk/core`), built in stages and verified against the classic sheet at
each stage. The classic version stays live everywhere until this reaches
parity.

Stages:
1. Data layer — extract the sourcebook data and bilingual (English /
   Traditional Chinese) text maps from the classic file
2. Character library — create / import / export / delete, save and load
3. Sheet core — abilities, saves, skills, combat, dice roller, rests,
   conditions, death saves
4. Level up — class progression, ASI / feats, hit points
5. Spells, inventory, infusions, homebrew, print

## Run it

```bash
npm install
npm run dev
npm run build   # static output in dist/
```
