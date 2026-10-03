"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet — the mobile counterpart to the docked side panels.
 *
 * Built on the same Radix Dialog primitive as `dialog.tsx` so focus trapping,
 * Escape and scroll locking all behave identically; only the geometry and the
 * enter animation differ.
 */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  title,
  subtitle,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  subtitle?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className={cn(
          "fixed inset-0 z-50 bg-background/70 backdrop-blur-sm",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        )}
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col",
          "rounded-t-2xl border-t border-border bg-surface shadow-2xl",
          // Slide up rather than zoom — reads as a sheet, not a modal.
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "duration-200",
          "pb-[env(safe-area-inset-bottom)]",
          className,
        )}
        {...props}
      >
        {/* Grab affordance. Purely visual; Escape and the button both close. */}
        <span
          aria-hidden
          className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border"
        />

        <header className="flex shrink-0 items-start gap-3 px-4 pt-3 pb-2.5">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-sm font-semibold tracking-tight text-foreground">
              {title}
            </DialogPrimitive.Title>
            {subtitle && (
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                {subtitle}
              </DialogPrimitive.Description>
            )}
          </div>

          <DialogPrimitive.Close
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetTrigger };
