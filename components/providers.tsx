"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";

// App-wide client providers: Better Auth UI (Google-only sign-in),
// its React Query cache, tooltips and toasts.
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        authClient={authClient}
        socialProviders={["google"]}
        emailAndPassword={{ enabled: false }}
        redirectTo="/"
        navigate={({ to, replace }) => (replace ? router.replace(to) : router.push(to))}
        Link={({ href, ...props }) => <NextLink href={href} {...props} />}
      >
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
