"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

export function HorizontalDragScroll({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  function isInteractiveTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      target.closest(
        "button, a, input, textarea, select, summary, [role='button'], [role='link'], [data-no-drag]",
      ),
    );
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    if (isInteractiveTarget(event.target)) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    draggingRef.current = true;
    startXRef.current = event.clientX;
    startScrollLeftRef.current = element.scrollLeft;
    element.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    const deltaX = event.clientX - startXRef.current;
    element.scrollLeft = startScrollLeftRef.current - deltaX;
    event.preventDefault();
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) {
      return;
    }

    draggingRef.current = false;
    const element = ref.current;
    if (!element) {
      return;
    }

    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "cursor-grab overflow-x-auto select-none active:cursor-grabbing [scrollbar-width:thin]",
        className,
      )}
    >
      {children}
    </div>
  );
}
