import { redirect } from "next/navigation";

// Old sign-in URL — the Better Auth UI sign-in view now lives at /auth/sign-in.
export default function LoginPage() {
  redirect("/auth/sign-in");
}
