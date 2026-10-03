"use client";

import { Monitor, X } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/constants";

/**
 * Shown below the desktop breakpoint.
 *
 * Editing a graph on a phone is genuinely bad, so rather than ship a crippled
 * editor we say so plainly and offer a read-only canvas behind the dismiss.
 */
export function MobileNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs text-warning">
        Read-only view — drag and drop is disabled on small screens.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      className="flex flex-col items-center gap-3 border-b border-warning/30 bg-warning/10 px-5 py-4 text-center"
    >
      <span className="grid size-9 place-items-center rounded-full border border-warning/40 bg-warning/15 text-warning">
        <Monitor className="size-4" aria-hidden />
      </span>

      <div>
        <p className="text-sm font-semibold text-foreground">
          {APP_NAME} works best on a larger screen
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          You can still browse the flow below in read-only mode. To build or edit a
          workflow, open this page on a tablet or desktop.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setDismissed(true)}>
          View read-only
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X aria-hidden />
        </Button>
      </div>
    </motion.div>
  );
}
