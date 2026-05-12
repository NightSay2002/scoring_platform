"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, onFocus, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100",
          className,
        )}
        onFocus={(event) => {
          if (props.type === "number" && event.currentTarget.value === "0") {
            event.currentTarget.select();
          }

          onFocus?.(event);
        }}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
