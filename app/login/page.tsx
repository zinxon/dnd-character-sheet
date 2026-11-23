"use client";

import { signIn, signOut, useSession } from "../../lib/auth-client";

// Sign-in page. The Google button starts Better Auth's social flow; it
// becomes functional once GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set.
export default function LoginPage() {
  const { data: session, isPending } = useSession();

  if (isPending) return <main><p>Loading…</p></main>;

  if (session) {
    return (
      <main>
        <h1>Your profile</h1>
        <p>
          Signed in as {session.user.name} ({session.user.email})
        </p>
        <p>
          Your characters in Neon will be linked to this account — the
          character library will read rows owned by your user id.
        </p>
        <button type="button" onClick={() => signOut()}>
          Sign out
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>Sign in</h1>
      <button
        type="button"
        onClick={() =>
          signIn.social({ provider: "google", callbackURL: "/login" })
        }
      >
        Sign in with Google
      </button>
    </main>
  );
}
