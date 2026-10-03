"use client";

import { cn } from "@/lib/utils";
import { EXECUTION_SPEEDS } from "@/config/constants";
import { useUiStore } from "@/store/uiStore";
import type { ExecutionSpeed } from "@/types/run";

/** 0.5x / 1x / 2x execution speed. Scales every simulated latency and delay. */
export function SpeedControl() {
  const speed = useUiStore((state) => state.speed);
  const setSpeed = useUiStore((state) => state.setSpeed);
  const isRunning = useUiStore((state) => state.isRunning);

  return (
    <div
      role="radiogroup"
      aria-label="Execution speed"
      className={cn(
        "flex items-center gap-0.5 rounded-md border border-border bg-surface-raised p-0.5",
        isRunning && "opacity-60",
      )}
    >
      {EXECUTION_SPEEDS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={speed === option}
          disabled={isRunning}
          onClick={() => setSpeed(option as ExecutionSpeed)}
          className={cn(
            "rounded px-2 py-1 font-mono text-[11px] transition-colors",
            speed === option
              ? "bg-accent text-accent-contrast"
              : "text-muted-foreground hover:text-foreground",
            isRunning && "cursor-not-allowed",
          )}
        >
          {option}×
        </button>
      ))}
    </div>
  );
}
