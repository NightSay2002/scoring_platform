"use client";

import { useEffect, useState } from "react";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useI18n } from "@/components/i18n/language-provider";
import { LampPanel } from "@/components/auth/lamp-panel";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/shared/card";

export function LoginExperience({ supportEmail }: { supportEmail: string }) {
  const [revealed, setRevealed] = useState(false);
  const mobileSheetY = useMotionValue(0);
  const mobileDragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  const { messages } = useI18n();

  useEffect(() => {
    if (reduceMotion) {
      mobileSheetY.set(0);
      return;
    }

    const controls = animate(mobileSheetY, 0, {
      type: "spring",
      stiffness: 360,
      damping: 34,
    });

    return () => controls.stop();
  }, [revealed, mobileSheetY, reduceMotion]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090b10]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_28%,#15171b_0%,#0d0f14_32%,#090b10_68%),linear-gradient(115deg,#0d0f14,#07090d)]"
      />
      <motion.div
        aria-hidden
        animate={{
          opacity: revealed ? 1 : 0,
        }}
        transition={reduceMotion ? { duration: 0.18 } : { duration: 1.05, delay: revealed ? 0.16 : 0, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute inset-0 hidden lg:block bg-[radial-gradient(ellipse_at_27%_33%,rgba(255,231,166,0.15)_0%,rgba(214,161,74,0.065)_25%,transparent_56%),linear-gradient(104deg,transparent_25%,rgba(255,231,177,0.018)_43%,rgba(255,225,158,0.045)_69%,rgba(255,222,145,0.018)_88%,transparent_100%)]"
      />
      <motion.div
        aria-hidden
        initial={false}
        animate={{
          opacity: revealed ? 0.26 : 0,
          scale: revealed ? 1 : 0.84,
          filter: revealed ? "blur(14px)" : "blur(24px)",
        }}
        transition={reduceMotion ? { duration: 0.18 } : { duration: 1.15, delay: revealed ? 0.2 : 0, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute inset-0 hidden origin-left bg-[radial-gradient(ellipse_at_29%_43%,rgba(255,232,166,0.24)_0%,rgba(218,161,76,0.07)_34%,rgba(157,94,28,0.018)_57%,transparent_74%)] lg:block"
      />
      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <LanguageToggle dark />
      </div>
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[96rem] lg:grid-cols-2">
        <div className="relative overflow-visible">
          <LampPanel revealed={revealed} onTrigger={() => setRevealed((current) => !current)} />
        </div>

        <div className="relative hidden min-h-full items-center justify-center overflow-visible bg-transparent lg:flex">
          <motion.div
            initial={false}
            animate={{
              opacity: revealed ? 1 : 0,
              x: reduceMotion ? 0 : revealed ? 0 : -32,
              y: reduceMotion ? 0 : revealed ? 0 : 20,
              filter: revealed ? "blur(0px)" : "blur(12px)",
            }}
            transition={reduceMotion ? { duration: 0.18 } : { duration: 0.78, delay: revealed ? 0.3 : 0, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex w-full justify-center px-8"
          >
            <Card className="relative w-full max-w-[24rem] overflow-hidden rounded-[2rem] border border-[#f6d98d]/14 bg-[linear-gradient(180deg,rgba(20,20,21,0.91),rgba(8,9,12,0.97))] shadow-[-18px_4px_54px_rgba(218,164,74,0.08),0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_-10%_24%,rgba(255,255,255,0.26),rgba(255,255,255,0.14)_14%,rgba(255,255,255,0.05)_28%,transparent_56%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04)_24%,rgba(255,255,255,0.015)_40%,transparent_62%)]" />
              <motion.div
                aria-hidden
                animate={{ opacity: revealed ? 1 : 0 }}
                transition={reduceMotion ? { duration: 0.18 } : { duration: 0.9, delay: revealed ? 0.38 : 0 }}
                className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[linear-gradient(90deg,rgba(255,220,139,0.12),rgba(255,226,159,0.035)_48%,transparent)]"
              />
              <CardContent className="relative p-9">
                <div className="mb-8 flex flex-col items-center text-center">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/6 p-3 text-[#f0ebe1]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h2 className="text-3xl font-semibold tracking-tight text-white">{messages.login.title}</h2>
                  <p className="mt-2 text-sm text-[#b6b1a8]">{messages.login.subtitle}</p>
                </div>
                <LoginForm revealed={revealed} supportEmail={supportEmail} />
              </CardContent>
            </Card>
          </motion.div>
          {!revealed ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-16 px-10 text-center text-sm text-[#7c766a]">
              {messages.login.revealHint}
            </div>
          ) : null}
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{
          y: reduceMotion ? 0 : revealed ? 0 : "105%",
          opacity: revealed ? 1 : 0,
        }}
        transition={reduceMotion ? { duration: 0.18 } : { duration: 0.7, delay: revealed ? 0.18 : 0, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 bottom-0 top-0 z-40 lg:hidden"
        style={{ pointerEvents: revealed ? "auto" : "none" }}
      >
        <button
          type="button"
          aria-label="Close sign in form"
          className="absolute inset-0 bg-black/48 backdrop-blur-sm"
          onClick={() => setRevealed(false)}
        />
        <motion.div
          drag="y"
          dragControls={mobileDragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 220 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const shouldClose = info.offset.y > 96 || info.velocity.y > 760;

            if (shouldClose) {
              setRevealed(false);
              mobileSheetY.set(0);
              return;
            }

            animate(mobileSheetY, 0, {
              type: "spring",
              stiffness: 380,
              damping: 35,
            });
          }}
          style={{ y: mobileSheetY }}
          className="absolute inset-x-0 bottom-0 top-[18svh] overflow-hidden rounded-t-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,18,21,0.96),rgba(8,9,12,0.99))] shadow-[0_-24px_70px_rgba(0,0,0,0.55)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.18),rgba(255,255,255,0.08)_14%,rgba(255,255,255,0.025)_30%,transparent_56%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,220,132,0.14),rgba(205,145,60,0.04)_44%,transparent_72%)]" />
          <div className="mx-auto flex h-full max-w-xl flex-col overflow-y-auto px-6 pb-10 pt-6">
            <button
              type="button"
              aria-label="Drag down to close sign in form"
              onPointerDown={(event) => mobileDragControls.start(event)}
              className="mx-auto mb-4 flex h-8 w-24 touch-none items-center justify-center"
            >
              <span className="h-1.5 w-14 rounded-full bg-white/12" />
            </button>
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/6 p-3 text-[#f0ebe1]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-white">{messages.login.title}</h2>
              <p className="mt-2 text-sm text-[#b6b1a8]">{messages.login.subtitle}</p>
            </div>
            <LoginForm revealed={revealed} supportEmail={supportEmail} />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
