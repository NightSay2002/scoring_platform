"use client";

import { motion, useReducedMotion } from "framer-motion";

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
  const reduceMotion = useReducedMotion();

  const lightTransition = reduceMotion
    ? { duration: 0.18 }
    : { duration: 0.9, delay: revealed ? 0.1 : 0, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="relative flex min-h-[52svh] items-center justify-center overflow-hidden bg-transparent lg:min-h-screen lg:overflow-visible">
      <motion.div
        aria-hidden
        animate={{
          opacity: revealed ? 0.94 : 0.035,
          scale: revealed ? 1 : 0.78,
        }}
        transition={lightTransition}
        className="absolute left-1/2 top-[32%] h-[27rem] w-[29rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(255,236,165,0.54)_0%,rgba(244,194,91,0.22)_27%,rgba(204,139,47,0.065)_50%,transparent_72%)] blur-[3px] lg:h-[36rem] lg:w-[38rem]"
      />

      <motion.div
        aria-hidden
        initial={false}
        animate={{
          opacity: revealed ? 0.36 : 0,
          scaleX: revealed ? 1 : 0.72,
          scaleY: revealed ? 1 : 0.48,
          filter: revealed ? "blur(10px)" : "blur(20px)",
        }}
        transition={
          reduceMotion
            ? { duration: 0.18 }
            : { duration: 1.05, delay: revealed ? 0.16 : 0, ease: [0.16, 1, 0.3, 1] }
        }
        className="pointer-events-none absolute left-1/2 top-[38%] h-[50vh] w-[72vw] max-w-[62rem] -translate-x-1/2 origin-top rounded-[50%] bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,236,174,0.3)_0%,rgba(226,171,78,0.105)_38%,rgba(172,105,32,0.025)_66%,transparent_78%)] blur-xl"
      />

      <motion.div
        aria-hidden
        animate={{ opacity: revealed ? 0.42 : 0.025 }}
        transition={reduceMotion ? { duration: 0.18 } : { duration: 1, delay: revealed ? 0.22 : 0 }}
        className="pointer-events-none absolute bottom-[11%] left-1/2 h-24 w-[34rem] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(233,181,85,0.28),rgba(154,91,29,0.055)_48%,transparent_72%)] blur-xl"
      />

      <div aria-hidden className="pointer-events-none absolute bottom-[11%] left-1/2 h-px w-[31rem] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/8 to-transparent" />

      <div className="relative z-10 flex w-full max-w-[31rem] flex-col items-center justify-center px-8 py-8 lg:py-14">
        <div className="relative h-[26rem] w-[18rem] lg:h-[33rem] lg:w-[23rem]">
          <svg
            viewBox="0 0 360 520"
            role="img"
            aria-label="Table lamp with a fabric shade"
            className="h-full w-full overflow-visible drop-shadow-[0_24px_28px_rgba(0,0,0,0.55)]"
          >
            <defs>
              <linearGradient id="table-lamp-shade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={revealed ? "#a76d22" : "#332f29"} />
                <stop offset="0.18" stopColor={revealed ? "#d5a442" : "#524a3e"} />
                <stop offset="0.5" stopColor={revealed ? "#efd17c" : "#6a6050"} />
                <stop offset="0.78" stopColor={revealed ? "#c58a2d" : "#484137"} />
                <stop offset="1" stopColor={revealed ? "#754714" : "#27241f"} />
              </linearGradient>
              <linearGradient id="table-lamp-stem" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#08090a" />
                <stop offset="0.42" stopColor="#4b4a47" />
                <stop offset="0.65" stopColor="#18191a" />
                <stop offset="1" stopColor="#050607" />
              </linearGradient>
              <radialGradient id="table-lamp-interior" cx="50%" cy="28%" r="74%">
                <stop offset="0" stopColor={revealed ? "#b97a27" : "#3d3932"} />
                <stop offset="0.52" stopColor={revealed ? "#744413" : "#26231f"} />
                <stop offset="1" stopColor={revealed ? "#1d140b" : "#101113"} />
              </radialGradient>
              <radialGradient id="table-lamp-base" cx="42%" cy="24%" r="80%">
                <stop offset="0" stopColor="#5b5a56" />
                <stop offset="0.38" stopColor="#252628" />
                <stop offset="1" stopColor="#07080a" />
              </radialGradient>
              <filter id="table-lamp-shadow" x="-30%" y="-30%" width="160%" height="190%">
                <feDropShadow dx="0" dy="16" stdDeviation="13" floodColor="#000000" floodOpacity="0.62" />
              </filter>
              <filter id="table-lamp-shade-glow" x="-45%" y="-45%" width="190%" height="190%">
                <feGaussianBlur stdDeviation="12" />
              </filter>
              <filter id="table-lamp-bulb-soft" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="0.65" />
              </filter>
            </defs>

            <ellipse cx="180" cy="466" rx="86" ry="18" fill="#000000" opacity="0.42" />
            <path d="M94 444C94 432 266 432 266 444V463C260 478 100 478 94 463Z" fill="url(#table-lamp-base)" />
            <ellipse cx="180" cy="443" rx="86" ry="16" fill="#333331" />
            <ellipse cx="180" cy="441" rx="76" ry="11" fill="#50504c" opacity="0.36" />
            <rect x="174" y="226" width="12" height="216" rx="6" fill="url(#table-lamp-stem)" />
            <rect x="178" y="232" width="2.5" height="200" rx="1.25" fill="#ffffff" opacity="0.1" />
            <ellipse cx="180" cy="441" rx="12" ry="6" fill="#111214" />
            <ellipse cx="180" cy="229" rx="17" ry="10" fill="#171819" />
            <rect x="168" y="215" width="24" height="18" rx="8" fill="url(#table-lamp-stem)" />

            <motion.path
              aria-hidden
              d="M114 72Q180 58 246 72L298 228Q180 250 62 228Z"
              fill="#ffd878"
              filter="url(#table-lamp-shade-glow)"
              initial={false}
              animate={{ opacity: revealed ? (reduceMotion ? 0.34 : [0, 0.46, 0.28, 0.36]) : 0 }}
              transition={reduceMotion ? { duration: 0.18 } : { duration: 0.48, times: [0, 0.26, 0.56, 1] }}
            />

            <motion.g
              initial={false}
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : revealed
                    ? { rotate: [0, 0.45, -0.22, 0] }
                    : { rotate: 0 }
              }
              transition={reduceMotion ? { duration: 0.18 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: "180px 230px" }}
            >
              <path
                d="M114 72Q180 58 246 72L298 228Q180 250 62 228Z"
                fill="url(#table-lamp-shade)"
                filter="url(#table-lamp-shadow)"
              />

              <motion.g
                aria-hidden
                filter="url(#table-lamp-bulb-soft)"
                initial={false}
                animate={{ opacity: revealed ? (reduceMotion ? 0.115 : [0, 0.16, 0.09, 0.115]) : 0.015 }}
                transition={reduceMotion ? { duration: 0.18 } : { duration: 0.55, times: [0, 0.28, 0.58, 1] }}
              >
                <path
                  d="M168 201C168 192 164 186 159 181C149 172 148 157 154 145C159 134 169 127 180 127C191 127 201 134 206 145C212 157 211 172 201 181C196 186 192 192 192 201Z"
                  fill="none"
                  stroke="#493923"
                  strokeOpacity="0.62"
                  strokeWidth="2"
                />
              </motion.g>

              <ellipse cx="180" cy="73" rx="66" ry="14" fill={revealed ? "#edbd55" : "#464035"} opacity="0.86" />
              <ellipse cx="180" cy="228" rx="116" ry="18" fill="url(#table-lamp-interior)" opacity={revealed ? "0.72" : "0.84"} />

              <g fill="none" strokeLinecap="round">
                <path d="M128 75L86 229" stroke="#fff6c3" strokeOpacity={revealed ? "0.24" : "0.08"} strokeWidth="3" />
                <path d="M145 70L111 234" stroke="#fff6c3" strokeOpacity={revealed ? "0.2" : "0.07"} strokeWidth="3" />
                <path d="M162 67L145 238" stroke="#fff6c3" strokeOpacity={revealed ? "0.17" : "0.06"} strokeWidth="2.5" />
                <path d="M180 65V240" stroke="#fff6c3" strokeOpacity={revealed ? "0.21" : "0.065"} strokeWidth="2.5" />
                <path d="M198 67L215 238" stroke="#fff6c3" strokeOpacity={revealed ? "0.16" : "0.055"} strokeWidth="2.5" />
                <path d="M215 70L249 234" stroke="#fff6c3" strokeOpacity={revealed ? "0.14" : "0.05"} strokeWidth="3" />
                <path d="M232 75L274 229" stroke="#fff6c3" strokeOpacity={revealed ? "0.13" : "0.045"} strokeWidth="3" />
              </g>

              <path d="M114 72Q180 58 246 72" fill="none" stroke="#111214" strokeOpacity="0.42" strokeWidth="4" />
              <path d="M62 228Q180 250 298 228" fill="none" stroke={revealed ? "#ffe6a0" : "#171819"} strokeOpacity={revealed ? "0.68" : "0.72"} strokeWidth="4" />
              <path d="M82 195L126 83" fill="none" stroke="#ffffff" strokeOpacity={revealed ? "0.17" : "0.08"} strokeWidth="5" strokeLinecap="round" />
            </motion.g>
          </svg>

          <div className="absolute left-1/2 top-[45%] ml-[3.5rem] lg:ml-[4.5rem]">
            <PullChain active={revealed} onTrigger={onTrigger} />
          </div>
        </div>

        <motion.div
          animate={{
            opacity: revealed ? 0.62 : 1,
            y: reduceMotion ? 0 : revealed ? 7 : 0,
          }}
          transition={reduceMotion ? { duration: 0.18 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="-mt-3 text-center lg:-mt-5"
        >
          <p className="text-xs font-medium tracking-[0.24em] text-slate-500 uppercase lg:text-sm">
            {revealed ? messages.login.pullAgain : messages.login.pullToReveal}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
