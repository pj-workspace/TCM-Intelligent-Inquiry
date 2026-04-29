"use client";

import { motion } from "framer-motion";

export function ClaudeStar() {
  return (
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
      className="flex items-center justify-center w-7 h-7"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 完美对称的 8 角星，对角线长度经过精确计算以保持视觉上的正圆形 */}
        <path
          d="M12 2.5V21.5M2.5 12H21.5M5.5 5.5L18.5 18.5M5.5 18.5L18.5 5.5"
          stroke="#d97757"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
