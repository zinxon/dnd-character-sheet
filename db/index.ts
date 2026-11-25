// Drizzle client over Neon's serverless HTTP driver: each query is one
// HTTPS request, so there's no connection pool to exhaust on Vercel.
// (No interactive transactions on HTTP — use db.batch([...]) for atomic
// multi-statement writes.)

import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
