"use client";

import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";

/**
 * The canvas pane's DOM element, shared with the palette so "add node" can drop at
 * the centre of the *visible* canvas rather than the centre of the window (which is
 * wrong whenever the palette or inspector is open).
 */
const CanvasElementContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function CanvasElementProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  return <CanvasElementContext.Provider value={ref}>{children}</CanvasElementContext.Provider>;
}

export function useCanvasElement(): RefObject<HTMLDivElement | null> {
  const context = useContext(CanvasElementContext);
  if (!context) {
    throw new Error("useCanvasElement must be used inside <CanvasElementProvider>");
  }
  return context;
}
