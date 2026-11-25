import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Google sign-in is enabled only once GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET are set (Vercel env / .env.local), so the app
// builds and runs before those arrive.
const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  // Same Drizzle client as the app. Neon's HTTP driver has no interactive
  // transactions, so leave the adapter's `transaction` option off.
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {},
});

export { googleEnabled };
