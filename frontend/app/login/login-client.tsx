"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AuthForm } from "@/components/auth/AuthForm";

export function LoginPageClient() {
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#fdfdfc] px-4">
      <main className="flex flex-1 flex-col justify-center py-10 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-md shrink-0"
        >
          <div className="rounded-2xl border border-[#e5e5e5] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <AuthForm
              onAuthenticated={() => {
                router.push("/");
                router.refresh();
              }}
            />
          </div>

          <p className="mt-8 text-center">
            <Link
              href="/"
              className="text-sm text-gray-500 underline-offset-4 hover:text-gray-800 hover:underline"
            >
              ← 返回对话
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
