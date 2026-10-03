"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RunConsole } from "./run-console";
import { RunHistory } from "./run-history";
import { useRunStore } from "@/store/runStore";

type Tab = "console" | "history";

/**
 * Collapsible bottom panel with two tabs.
 *
 * Height is user-adjustable by dragging the divider; it collapses to just the tab
 * strip so the canvas can take the whole screen while building.
 */
export function BottomPanel() {
  const [tab, setTab] = useState<Tab>("console");
  const [height, setHeight] = useState(248);
  const [collapsed, setCollapsed] = useState(false);
  const status = useRunStore((state) => state.status);
  const historyCount = useRunStore((state) => state.history.length);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "console", label: "Console" },
    { id: "history", label: "History", badge: historyCount },
  ];

  return (
    <div
      className="relative flex shrink-0 flex-col border-t border-border bg-surface"
      style={{ height: collapsed ? 40 : height }}
    >
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize run console"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") setHeight((h) => Math.min(560, h + 24));
            if (event.key === "ArrowDown") setHeight((h) => Math.max(140, h - 24));
            if (event.key === "Enter" || event.key === " ") setCollapsed(true);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            const startY = event.clientY;
            const startHeight = height;
            const onMove = (move: PointerEvent) => {
              const next = startHeight - (move.clientY - startY);
              setHeight(Math.min(560, Math.max(140, next)));
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
          className="absolute -top-1 right-0 left-0 h-2 cursor-row-resize"
        />
      )}

      <div className="flex h-10 shrink-0 items-center gap-1 px-3">
        <div role="tablist" aria-label="Console views" className="flex items-center gap-1">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`tab-${entry.id}`}
              aria-selected={tab === entry.id && !collapsed}
              aria-controls={`panel-${entry.id}`}
              onClick={() => {
                setTab(entry.id);
                setCollapsed(false);
              }}
              className={cn(
                "relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                tab === entry.id && !collapsed
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
              {entry.badge !== undefined && entry.badge > 0 && (
                <span className="ml-1.5 rounded-full bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground tabular-nums">
                  {entry.badge}
                </span>
              )}
              {tab === entry.id && !collapsed && (
                <span className="absolute inset-x-2 -bottom-[7px] h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>

        {status === "running" && (
          <span className="ml-2 flex items-center gap-1.5 font-mono text-[10px] text-accent">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
            running
          </span>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand run console" : "Collapse run console"}
          className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1">
          <div
            id="panel-console"
            role="tabpanel"
            aria-labelledby="tab-console"
            hidden={tab !== "console"}
            className="h-full"
          >
            {tab === "console" && <RunConsole />}
          </div>

          <div
            id="panel-history"
            role="tabpanel"
            aria-labelledby="tab-history"
            hidden={tab !== "history"}
            className="h-full"
          >
            {tab === "history" && <RunHistory />}
          </div>
        </div>
      )}
    </div>
  );
}
