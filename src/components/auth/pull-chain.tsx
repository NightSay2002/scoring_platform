"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

type PullChainProps = {
  active?: boolean;
  onTrigger: () => void;
};

const DRAG_LIMIT = 108;
const TRIGGER_THRESHOLD = 72;

export function PullChain({ active = false, onTrigger }: PullChainProps) {
  const dragY = useMotionValue(0);
  const chainHeight = useTransform(dragY, (value) => 126 + Math.max(value, 0));
  const handleRotate = useTransform(dragY, [-DRAG_LIMIT, 0, DRAG_LIMIT], [-8, 0, 8]);
  const handleScale = useTransform(dragY, [0, DRAG_LIMIT], [1, 1.04]);

  useEffect(() => {
    dragY.set(0);
  }, [active, dragY]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
      <div className="pointer-events-none flex flex-col items-center">
        <motion.div className="w-[2px] rounded-full bg-white/18" style={{ height: chainHeight }} />
        <motion.button
          type="button"
          drag="y"
          dragConstraints={{ top: 0, bottom: DRAG_LIMIT }}
          dragElastic={0.18}
          dragMomentum={false}
          whileTap={{ cursor: "grabbing" }}
          onDragEnd={(_, info) => {
            const passedThreshold = info.offset.y > TRIGGER_THRESHOLD;
            if (passedThreshold) {
              onTrigger();
            }

            animate(dragY, 0, {
              type: "spring",
              stiffness: passedThreshold ? 180 : 320,
              damping: passedThreshold ? 16 : 22,
            });
          }}
          className="pointer-events-auto flex h-7 w-7 cursor-grab items-center justify-center rounded-full border border-[#c6a36f]/45 bg-[radial-gradient(circle_at_35%_35%,#ffe0a7,#d0a060_65%,#9e6d33)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.4)]"
          style={{ y: dragY, rotate: handleRotate, scale: handleScale, touchAction: "none" }}
          aria-label={active ? "Pull lamp chain to hide the sign in form" : "Pull lamp chain to reveal the sign in form"}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-[#f3d4a2]/70" />
        </motion.button>
      </div>
    </div>
  );
}
