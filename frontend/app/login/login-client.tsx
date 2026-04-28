"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AuthForm } from "@/components/auth/AuthForm";

export function LoginPageClient() {
  const router = useRouter();

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-12 bg-[#fdfdfc]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-8">
          <AuthForm
            onAuthenticated={() => {
              router.push("/");
              router.refresh();
            }}
          />
        </div>

        <p className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-800 underline-offset-4 hover:underline"
          >
            ← 返回对话
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
