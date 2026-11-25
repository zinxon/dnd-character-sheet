-- Baseline: these tables already existed when Drizzle was adopted
-- (characters, user, session, account, verification). Their definitions
-- are in db/schema.ts and drizzle/meta/0000_snapshot.json. Running this
-- migration only records the baseline; it changes nothing.
SELECT 1;
