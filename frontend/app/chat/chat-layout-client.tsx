"use client";

import { HomePageClient } from "@/components/home/HomePageClient";

export function ChatLayoutClient({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <HomePageClient />
      {children}
    </>
  );
}
