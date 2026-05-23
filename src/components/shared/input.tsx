"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, onChange, onFocus, onInput, onKeyDown, onMouseUp, ...props }, ref) => {
    const shouldClearDefaultZero = (element: HTMLInputElement) => props.type === "number" && element.value === "0";
    const normalizeNumberInput = (element: HTMLInputElement) => {
      if (props.type !== "number") {
        return;
      }

      const normalized = element.value.replace(/^(-?)0+(?=\d)/, "$1");
      if (normalized !== element.value) {
        element.value = normalized;
      }
    };

    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100",
          className,
        )}
        onFocus={(event) => {
          if (shouldClearDefaultZero(event.currentTarget)) {
            event.currentTarget.select();
          }

          onFocus?.(event);
        }}
        onMouseUp={(event) => {
          onMouseUp?.(event);

          if (!event.defaultPrevented && shouldClearDefaultZero(event.currentTarget)) {
            event.preventDefault();
            event.currentTarget.select();
          }
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);

          if (
            !event.defaultPrevented &&
            shouldClearDefaultZero(event.currentTarget) &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey &&
            (/^\d$/.test(event.key) || event.key === "-")
          ) {
            event.currentTarget.value = "";
          }
        }}
        onInput={(event) => {
          normalizeNumberInput(event.currentTarget);
          onInput?.(event);
        }}
        onChange={(event) => {
          normalizeNumberInput(event.currentTarget);
          onChange?.(event);
        }}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
