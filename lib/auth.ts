import { betterAuth } from "better-auth";
import { Pool } from "pg";

// Google sign-in is enabled only once GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET are set (Vercel env / .env.local), so the app
// builds and runs before those arrive.
const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
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
