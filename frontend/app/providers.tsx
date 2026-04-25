"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        className="font-sans"
        toastOptions={{ classNames: { title: "font-medium" } }}
      />
    </AuthProvider>
  );
}
