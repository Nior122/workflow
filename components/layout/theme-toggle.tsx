"use client";

import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "./theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDark}
          aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
          className="relative grid size-9 place-items-center overflow-hidden rounded-md border border-border bg-surface-raised text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ y: isDark ? 14 : -14, opacity: 0, rotate: -35 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: isDark ? -14 : 14, opacity: 0, rotate: 35 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="grid place-items-center"
            >
              {isDark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
            </motion.span>
          </AnimatePresence>
        </button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? "Light theme" : "Dark theme"}</TooltipContent>
    </Tooltip>
  );
}
