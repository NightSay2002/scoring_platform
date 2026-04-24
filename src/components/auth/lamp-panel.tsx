"use client";

import { motion } from "framer-motion";

import { PullChain } from "@/components/auth/pull-chain";
import { useI18n } from "@/components/i18n/language-provider";

export function LampPanel({
  revealed,
  onTrigger,
}: {
  revealed: boolean;
  onTrigger: () => void;
}) {
  const { messages } = useI18n();

  return (
    <div className="relative flex min-h-[52svh] items-center justify-center overflow-hidden bg-transparent lg:min-h-screen">
      <motion.div
        aria-hidden
        animate={{
          opacity: revealed ? 0.95 : 0.05,
          scale: revealed ? 1 : 0.82,
        }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_31%,rgba(255,237,185,0.2),rgba(255,222,148,0.08)_16%,rgba(9,11,16,0)_42%)]"
      />
      <motion.div
        aria-hidden
        animate={{
          opacity: revealed ? 1 : 0,
          scale: revealed ? 1 : 0.85,
          filter: revealed ? "blur(0px)" : "blur(16px)",
        }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-1/2 top-[31%] h-[17rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,244,199,0.55),rgba(245,208,110,0.18)_34%,rgba(245,208,110,0.05)_54%,transparent_76%)] lg:h-[21rem] lg:w-[22rem]"
      />
      <div className="relative z-10 flex w-full max-w-[28rem] flex-col items-center justify-center px-8 py-20">
        <div className="absolute top-[12%] h-20 w-px bg-gradient-to-b from-white/0 via-white/14 to-white/4" />
        <motion.div
          aria-hidden
          animate={{
            y: revealed ? 0 : -4,
          }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-2 flex h-[18rem] w-[12rem] flex-col items-center justify-start lg:h-[20rem] lg:w-[13rem]"
        >
          <div className="absolute left-1/2 top-0 h-[4.75rem] w-[9.5rem] -translate-x-1/2 rounded-t-full rounded-b-[1.4rem] bg-[#f3efe7] shadow-[inset_0_-4px_10px_rgba(0,0,0,0.08)] lg:h-[5.2rem] lg:w-[10.5rem]" />
          <div className="absolute top-[4.4rem] h-[8.8rem] w-[0.85rem] rounded-full bg-[#ece7df] lg:top-[4.9rem] lg:h-[9.5rem]" />
          <div className="absolute bottom-[1.5rem] h-[0.95rem] w-[3.7rem] rounded-full bg-[#ece7df] lg:w-[4.2rem]" />
        </motion.div>
        <div className="absolute left-1/2 top-[26%] ml-[2.6rem] lg:ml-[3.1rem]">
          <PullChain active={revealed} onTrigger={onTrigger} />
        </div>
        <motion.div
          animate={{
            opacity: revealed ? 0.55 : 1,
            y: revealed ? 10 : 0,
          }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 text-center"
        >
          <p className="text-sm tracking-[0.22em] text-slate-500 uppercase">
            {revealed ? messages.login.pullAgain : messages.login.pullToReveal}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
