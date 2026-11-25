// Database schema (Drizzle ORM, Postgres on Neon). Introspected from the
// live database with `drizzle-kit pull`, then tidied. Change tables here and
// run `npm run db:generate` + `npm run db:migrate`.

import { sql } from "drizzle-orm";
import { boolean, foreignKey, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// ── App ────────────────────────────────────────────────────────────────
// One row per character; the whole sheet lives in `data` (classic record
// format, see lib/sheet.ts). `owner` is the Better Auth user id, or the seed
// owner 'zinxon'.
export const characters = pgTable("characters", {
  id: uuid().defaultRandom().primaryKey(),
  owner: text().notNull(),
  name: text().notNull(),
  data: jsonb().$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export type Character = typeof characters.$inferSelect;

// ── Better Auth (user, session, account, verification) ─────────────────
// Column names match Better Auth's defaults; timestamps are Dates because
// that's what its Drizzle adapter reads and writes.
const createdAt = () =>
  timestamp({ withTimezone: true, mode: "date" }).default(sql`CURRENT_TIMESTAMP`).notNull();

export const user = pgTable(
  "user",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull(),
    image: text(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [unique("user_email_key").on(t.email)],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    token: text().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text().notNull(),
  },
  (t) => [
    index("session_userId_idx").using("btree", t.userId.asc().nullsLast().op("text_ops")),
    foreignKey({ columns: [t.userId], foreignColumns: [user.id], name: "session_userId_fkey" }).onDelete("cascade"),
    unique("session_token_key").on(t.token),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [
    index("account_userId_idx").using("btree", t.userId.asc().nullsLast().op("text_ops")),
    foreignKey({ columns: [t.userId], foreignColumns: [user.id], name: "account_userId_fkey" }).onDelete("cascade"),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("verification_identifier_idx").using("btree", t.identifier.asc().nullsLast().op("text_ops"))],
);
