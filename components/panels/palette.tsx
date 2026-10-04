"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Search, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { listNodeDefs, type AnyNodeTypeDef } from "@/lib/engine/registry";
import { getNodeUi } from "@/components/nodes/registry";
import { NODE_DRAG_TYPE } from "@/config/constants";
import { CATEGORY_LABEL } from "@/config/theme";
import { useWorkflowStore } from "@/store/workflowStore";
import { useFavouriteNodes, useIsRunning, useUiStore } from "@/store/uiStore";
import type { NodeCategory, NodeType } from "@/types/nodes";

const CATEGORY_ORDER: NodeCategory[] = ["trigger", "action", "output"];

export type PaletteFilterResult = {
  favourites: AnyNodeTypeDef[];
  groups: { category: NodeCategory; defs: AnyNodeTypeDef[] }[];
  total: number;
  visible: number;
};

/**
 * Pure filter + favourite-grouping logic for the node palette.
 *
 * Extracted so unit tests can verify query matching (title, description, type id,
 * category label) and favourite ordering without mounting a DOM.
 */
export function filterPaletteNodes(
  defs: readonly AnyNodeTypeDef[],
  query: string,
  favouriteNodes: readonly NodeType[],
): PaletteFilterResult {
  const trimmed = query.trim().toLowerCase();
  const favSet = new Set(favouriteNodes);

  const matching = defs.filter((def) => {
    if (!trimmed) return true;
    return (
      def.title.toLowerCase().includes(trimmed) ||
      def.description.toLowerCase().includes(trimmed) ||
      def.type.toLowerCase().includes(trimmed) ||
      CATEGORY_LABEL[def.category].toLowerCase().includes(trimmed)
    );
  });

  const favourites = matching.filter((def) => favSet.has(def.type));

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    defs: matching.filter((def) => def.category === category),
  })).filter((group) => group.defs.length > 0);

  return {
    favourites,
    groups,
    total: defs.length,
    visible: matching.length,
  };
}

/**
 * Node palette.
 *
 * Rows are deliberately flat — no border, no shadow, no glow. Fourteen bordered
 * cards stacked vertically is a wall of chrome; a quiet list with a hover wash and
 * one accent-coloured icon per row carries the same information with far less
 * noise. Drag is still available, but it is an enhancement on top of click-to-add
 * rather than the only path, so the grip affordance is gone.
 */
export function Palette({
  onAddAtViewportCenter,
  onNodeAdded,
  className,
}: {
  onAddAtViewportCenter: () => { x: number; y: number };
  /** Lets a mobile sheet close itself after an add. */
  onNodeAdded?: () => void;
  className?: string;
}) {
  const addNode = useWorkflowStore((state) => state.addNode);
  const isRunning = useIsRunning();
  const favouriteNodes = useFavouriteNodes();
  const toggleFavouriteNode = useUiStore((state) => state.toggleFavouriteNode);
  const [addedType, setAddedType] = useState<NodeType | null>(null);
  const [query, setQuery] = useState("");

  const handleAdd = useCallback(
    (type: NodeType) => {
      if (isRunning) return;
      const position = onAddAtViewportCenter();
      const id = addNode(type, position);
      if (id) {
        setAddedType(type);
        window.setTimeout(
          () => setAddedType((current) => (current === type ? null : current)),
          900,
        );
        onNodeAdded?.();
      }
    },
    [addNode, isRunning, onAddAtViewportCenter, onNodeAdded],
  );

  const { favourites, groups, total, visible } = useMemo(
    () => filterPaletteNodes(listNodeDefs(), query, favouriteNodes),
    [query, favouriteNodes],
  );

  const favSet = useMemo(() => new Set(favouriteNodes), [favouriteNodes]);

  return (
    <nav
      aria-label="Node palette"
      className={cn(
        "flex h-full min-h-0 flex-col bg-surface",
        isRunning && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/70 px-3 py-3">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="palette-search-input" className="sr-only">
            Filter nodes
          </label>
          <input
            id="palette-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.stopPropagation();
                setQuery("");
              }
            }}
            placeholder={`Search ${total} nodes`}
            className={cn(
              "h-8 w-full rounded-md border border-border bg-surface-raised pr-8 pl-8",
              "text-xs text-foreground placeholder:text-muted-foreground",
              "focus:border-accent focus:outline-none",
              "[&::-webkit-search-cancel-button]:appearance-none",
            )}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear node search"
              className="absolute right-2 grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground active:bg-border"
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {visible === 0 ? (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">
            No node matches “{query.trim()}”.
          </p>
        ) : (
          <div className="space-y-4">
            {favourites.length > 0 && (
              <section aria-labelledby="palette-favourites">
                <h3
                  id="palette-favourites"
                  className="flex items-center gap-1 px-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-accent uppercase"
                >
                  <Star className="size-2.5 fill-current" aria-hidden />
                  Favourites
                </h3>

                <ul>
                  {favourites.map((def) => (
                    <li key={`fav-${def.type}`}>
                      <PaletteItem
                        def={def}
                        disabled={isRunning}
                        justAdded={addedType === def.type}
                        isFavourite={true}
                        onAdd={handleAdd}
                        onToggleFavourite={toggleFavouriteNode}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {groups.map(({ category, defs }) => (
              <section key={category} aria-labelledby={`palette-${category}`}>
                <h3
                  id={`palette-${category}`}
                  className="px-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
                >
                  {CATEGORY_LABEL[category]}s
                </h3>

                <ul>
                  {defs.map((def) => (
                    <li key={def.type}>
                      <PaletteItem
                        def={def}
                        disabled={isRunning}
                        justAdded={addedType === def.type}
                        isFavourite={favSet.has(def.type)}
                        onAdd={handleAdd}
                        onToggleFavourite={toggleFavouriteNode}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function PaletteItem({
  def,
  disabled,
  justAdded,
  isFavourite,
  onAdd,
  onToggleFavourite,
}: {
  def: AnyNodeTypeDef;
  disabled: boolean;
  justAdded: boolean;
  isFavourite: boolean;
  onAdd: (type: NodeType) => void;
  onToggleFavourite: (type: NodeType) => void;
}) {
  const ui = getNodeUi(def.type);
  const Icon = ui.icon;

  return (
    <div className="group flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-surface-raised">
      <button
        type="button"
        draggable={!disabled}
        disabled={disabled}
        onDragStart={(event) => {
          event.dataTransfer.setData(NODE_DRAG_TYPE, def.type);
          event.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onAdd(def.type)}
        aria-label={`Add ${def.title} node`}
        className={cn(
          "flex min-w-0 flex-1 cursor-grab items-center gap-3 rounded-md px-2 py-2 text-left",
          "active:cursor-grabbing",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span
          aria-hidden
          className="grid size-6 shrink-0 place-items-center rounded"
          style={{ color: ui.accent, backgroundColor: `${ui.accent}1f` }}
        >
          <Icon className="size-3.5" strokeWidth={2.2} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-tight font-medium text-foreground">
            {def.title}
          </span>
          <span className="mt-1 block truncate text-[11px] leading-tight text-muted-foreground">
            {def.description}
          </span>
        </span>

        <span className="relative grid size-5 shrink-0 place-items-center">
          <Plus
            aria-hidden
            className="size-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground"
          />
          <AnimatePresence>
            {justAdded && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                className="absolute inset-0 grid place-items-center text-success"
              >
                <Check className="size-3.5" aria-hidden strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggleFavourite(def.type)}
        aria-pressed={isFavourite}
        aria-label={
          isFavourite
            ? `Remove ${def.title} from favourites`
            : `Pin ${def.title} to favourites`
        }
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded transition-colors active:bg-border",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isFavourite
            ? "text-accent"
            : "text-muted-foreground/0 group-hover:text-muted-foreground hover:text-foreground focus-visible:text-muted-foreground",
        )}
      >
        <Star className={cn("size-3.5", isFavourite && "fill-current")} aria-hidden />
      </button>
    </div>
  );
}
