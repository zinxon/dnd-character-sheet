import { Auth } from "@/components/auth/auth";

// Better Auth UI views: /auth/sign-in, /auth/callback, /auth/sign-out, …
export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Auth path={path} className="w-full max-w-sm" />
    </main>
  );
}
