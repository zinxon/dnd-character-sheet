# D&D character sheet — React version (1 to 1 migration, in progress)

The classic single-file sheet on `main` is the reference. This branch is its
1 to 1 migration to Next.js 16 (React 19) + the Vercel UI SDK (`@ui-sdk/react` +
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
npm run build   # Next.js production build
npm run start   # serve the production build
```

## Auth (Better Auth + Google)

Better Auth is wired to the same Neon database (tables `user`, `session`,
`account`, `verification`, created with the Better Auth CLI migrate command).
The Google provider turns on only when these env vars are set, so the app
runs without them:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from the Google Cloud console
  (OAuth client, redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google`)
- `BETTER_AUTH_SECRET` — a random 32+ character secret
- `BETTER_AUTH_URL` — the app's base URL

Profile linking: once a user signs in with Google, their characters are the
`characters` rows owned by their Better Auth user id. The two seeded rows
(owner `zinxon`) get claimed by the first sign-in — that claim step ships
with the character library stage.
