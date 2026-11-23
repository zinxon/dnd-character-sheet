import { headers } from "next/headers";
import { auth } from "./auth";

// Who owns character rows for this request: the signed-in Better Auth user,
// or the seed owner 'zinxon' while Google sign-in is not configured yet.
export async function getOwner(): Promise<string> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user.id ?? "zinxon";
  } catch {
    return "zinxon";
  }
}
