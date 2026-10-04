"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNodeUi } from "@/components/nodes/registry";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { listAllNodeDefs, listNodeDefs, type AnyNodeTypeDef } from "@/lib/engine/registry";
import { REGISTRY_CATEGORY_META, REGISTRY_CATEGORY_ORDER, getRegistryNode } from "@/lib/nodes";
import { CATEGORY_LABEL } from "@/config/theme";
import { NODE_DRAG_TYPE } from "@/config/constants";
import { useWorkflowStore } from "@/store/workflowStore";
import {
  useFavouriteNodes,
  useIsRunning,
  useRecentNodes,
  useUiStore,
} from "@/store/uiStore";
import type { NodeCategory, NodeType } from "@/types/nodes";
import type { RegistryCategory, RegistryNodeDef } from "@/types/registry";

const CATEGORY_ORDER: NodeCategory[] = ["trigger", "action", "output"];

export type PaletteFilterResult = {
  favourites: AnyNodeTypeDef[];
  groups: { category: NodeCategory; defs: AnyNodeTypeDef[] }[];
  total: number;
  visible: number;
};

/**
 * Pure filter + favourite-grouping logic across the full registry node library.
 *
 * Kept behaviourally stable so the palette contract test still holds; the palette
 * itself now also renders the full 144-node registry.
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

  return { favourites, groups, total: defs.length, visible: matching.length };
}

export type RegistryPaletteSection = {
  category: RegistryCategory;
  label: string;
  description: string;
  defs: RegistryNodeDef[];
};

export type RegistryPaletteResult = {
  favourites: RegistryNodeDef[];
  recent: RegistryNodeDef[];
  sections: RegistryPaletteSection[];
  total: number;
  visible: number;
};

/** Free-text match across label, description, subcategory, id, and keywords. */
export function matchesRegistryNodeQuery(def: RegistryNodeDef, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const haystack = [
    def.id,
    def.label,
    def.description,
    def.category,
    def.subcategory,
    REGISTRY_CATEGORY_META[def.category]?.label ?? "",
    ...def.keywords,
  ]
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Group the registry nodes into the 6 discovery categories, surfacing favourites
 * and recently-used nodes above the accordions.
 */
export function groupRegistryNodes(
  defs: readonly RegistryNodeDef[],
  query: string,
  favourites: readonly NodeType[],
  recent: readonly NodeType[],
): RegistryPaletteResult {
  const matched = defs.filter((def) => matchesRegistryNodeQuery(def, query));
  const byId = new Map(matched.map((def) => [def.id, def]));
  const favSet = new Set(favourites);

  const pick = (types: readonly NodeType[]): RegistryNodeDef[] =>
    types
      .map((type) => byId.get(type))
      .filter((def): def is RegistryNodeDef => def !== undefined);

  const sections = REGISTRY_CATEGORY_ORDER.map((category) => ({
    category,
    label: REGISTRY_CATEGORY_META[category].label,
    description: REGISTRY_CATEGORY_META[category].description,
    defs: matched.filter((def) => def.category === category),
  })).filter((section) => section.defs.length > 0);

  return {
    favourites: pick(favourites),
    recent: pick(recent.filter((type) => !favSet.has(type))),
    sections,
    total: defs.length,
    visible: matched.length,
  };
}

/**
 * Node palette for all 144 nodes.
 *
 * Categories are collapsible accordions with live counts; rows use
 * `content-visibility` (`ff-lazy-row`) so a long AI section costs nothing until it
 * scrolls into view. `/` focuses search, `Escape` clears it, and the footer reports
 * how many of the 144 nodes the current query matched.
 */
export function Palette({
  onAddAtViewportCenter,
  onNodeAdded,
  className,
}: {
  onAddAtViewportCenter: () => { x: number; y: number };
  onNodeAdded?: () => void;
  className?: string;
}) {
  const addNode = useWorkflowStore((state) => state.addNode);
  const recordRecentNode = useUiStore((state) => state.recordRecentNode);
  const isRunning = useIsRunning();
  const favouriteNodes = useFavouriteNodes();
  const recentNodes = useRecentNodes();
  const toggleFavouriteNode = useUiStore((state) => state.toggleFavouriteNode);

  const [addedType, setAddedType] = useState<NodeType | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<RegistryCategory>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  /** The 14 original engine nodes are the head of `listAllNodeDefs()`, so slice them off. */
  const registryDefs = useMemo<RegistryNodeDef[]>(() => {
    const coreTypes = new Set(listNodeDefs().map((def) => def.type));
    const seen = new Set<string>();
    const collected: RegistryNodeDef[] = [];
    for (const def of listAllNodeDefs()) {
      if (coreTypes.has(def.type) || seen.has(def.type)) continue;
      const reg = getRegistryNode(def.type);
      if (!reg) continue;
      seen.add(def.type);
      collected.push(reg);
    }
    return collected;
  }, []);

  const result = useMemo(
    () => groupRegistryNodes(registryDefs, query, favouriteNodes, recentNodes),
    [registryDefs, query, favouriteNodes, recentNodes],
  );

  const totalNodes = registryDefs.length + listNodeDefs().length;
  const isSearching = query.trim().length > 0;

  const handleAdd = useCallback(
    (type: NodeType) => {
      if (isRunning) return;
      const position = onAddAtViewportCenter();
      const id = addNode(type, position);
      if (id) {
        recordRecentNode(type);
        setAddedType(type);
        window.setTimeout(
          () => setAddedType((current) => (current === type ? null : current)),
          900,
        );
        onNodeAdded?.();
      }
    },
    [addNode, isRunning, onAddAtViewportCenter, onNodeAdded, recordRecentNode],
  );

  // `/` focuses search from anywhere on the page; Escape blurs.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const favSet = useMemo(() => new Set(favouriteNodes), [favouriteNodes]);

  const toggleSection = (category: RegistryCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

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
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                if (query) setQuery("");
                else searchRef.current?.blur();
              }
            }}
            placeholder={`Search ${totalNodes} nodes`}
            aria-label={`Search ${totalNodes} nodes`}
            className={cn(
              "h-8 w-full rounded-md border border-border bg-surface-raised pr-9 pl-8",
              "text-xs text-foreground placeholder:text-muted-foreground",
              "focus:border-accent focus:outline-none",
              "[&::-webkit-search-cancel-button]:appearance-none",
            )}
          />
          {query.length > 0 ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear node search"
              className="absolute right-2 grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground active:bg-border"
            >
              <X className="size-3" aria-hidden />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              /
            </kbd>
          )}
        </div>
      </div>

      <div className="ff-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {isSearching && result.visible === 0 ? (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">
            No node matches “{query.trim()}”. Try a brand, action, or category name.
          </p>
        ) : (
          <div className="space-y-4">
            {result.favourites.length > 0 && (
              <PaletteSectionList
                id="palette-favourites"
                heading="Favourites"
                headingIcon={<Star className="size-2.5 fill-current" aria-hidden />}
                headingClass="text-accent"
                defs={result.favourites}
                disabled={isRunning}
                addedType={addedType}
                favSet={favSet}
                onAdd={handleAdd}
                onToggleFavourite={toggleFavouriteNode}
              />
            )}

            {result.recent.length > 0 && (
              <PaletteSectionList
                id="palette-recent"
                heading="Recently used"
                headingIcon={<Clock className="size-2.5" aria-hidden />}
                headingClass="text-muted-foreground"
                defs={result.recent}
                disabled={isRunning}
                addedType={addedType}
                favSet={favSet}
                onAdd={handleAdd}
                onToggleFavourite={toggleFavouriteNode}
              />
            )}

            {result.sections.map((section) => {
              const isCollapsed = !isSearching && collapsed.has(section.category);
              return (
                <section
                  key={section.category}
                  aria-labelledby={`palette-heading-${section.category}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.category)}
                    aria-expanded={!isCollapsed}
                    title={section.description}
                    className="flex w-full items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="size-3 shrink-0" aria-hidden />
                    )}
                    <span id={`palette-heading-${section.category}`} className="truncate">
                      {section.label}
                    </span>
                    <span className="ml-auto shrink-0 rounded-full border border-border bg-surface-raised px-1.5 font-mono text-[10px] tabular-nums">
                      {section.defs.length}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <ul className="mt-1">
                      {section.defs.map((def) => (
                        <li key={def.id} className="ff-lazy-row">
                          <PaletteRow
                            type={def.id}
                            disabled={isRunning}
                            justAdded={addedType === def.id}
                            isFavourite={favSet.has(def.id)}
                            onAdd={handleAdd}
                            onToggleFavourite={toggleFavouriteNode}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <p className="shrink-0 border-t border-border/70 px-3 py-2 text-center font-mono text-[10px] text-muted-foreground">
        {isSearching
          ? `${result.visible} of ${totalNodes} nodes match`
          : `${totalNodes} nodes · press / to search`}
      </p>
    </nav>
  );
}

function PaletteSectionList({
  id,
  heading,
  headingIcon,
  headingClass,
  defs,
  disabled,
  addedType,
  favSet,
  onAdd,
  onToggleFavourite,
}: {
  id: string;
  heading: string;
  headingIcon: React.ReactNode;
  headingClass: string;
  defs: readonly RegistryNodeDef[];
  disabled: boolean;
  addedType: NodeType | null;
  favSet: Set<NodeType>;
  onAdd: (type: NodeType) => void;
  onToggleFavourite: (type: NodeType) => void;
}) {
  return (
    <section aria-labelledby={id}>
      <h3
        id={id}
        className={cn(
          "flex items-center gap-1 px-2 pb-1 text-[10px] font-semibold tracking-[0.08em] uppercase",
          headingClass,
        )}
      >
        {headingIcon}
        {heading}
      </h3>
      <ul>
        {defs.map((def) => (
          <li key={`${id}-${def.id}`} className="ff-lazy-row">
            <PaletteRow
              type={def.id}
              disabled={disabled}
              justAdded={addedType === def.id}
              isFavourite={favSet.has(def.id)}
              onAdd={onAdd}
              onToggleFavourite={onToggleFavourite}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaletteRow({
  type,
  disabled,
  justAdded,
  isFavourite,
  onAdd,
  onToggleFavourite,
}: {
  type: NodeType;
  disabled: boolean;
  justAdded: boolean;
  isFavourite: boolean;
  onAdd: (type: NodeType) => void;
  onToggleFavourite: (type: NodeType) => void;
}) {
  const ui = getNodeUi(type);
  const reg = getRegistryNode(type);
  const Icon = ui.icon;
  const title = reg?.label ?? type;
  const subtitle = reg?.subcategory ?? "Core";

  const description = reg?.description ?? "Core engine node.";

  return (
    <div className="group flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-surface-raised">
      <Tooltip>
        {/* The hover card is an enhancement: the button itself stays fully
            labelled and clickable for keyboard and screen-reader users. */}
        <TooltipTrigger asChild>
          <button
            type="button"
            draggable={!disabled}
            disabled={disabled}
            onDragStart={(event) => {
              event.dataTransfer.setData(NODE_DRAG_TYPE, type);
              event.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onAdd(type)}
            aria-label={`Add ${title} node`}
            className={cn(
              "flex min-w-0 flex-1 cursor-grab items-center gap-3 rounded-md px-2 py-2 text-left",
              "active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50",
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
                {title}
              </span>
              <span className="mt-1 block truncate text-[11px] leading-tight text-muted-foreground">
                {subtitle}
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
        </TooltipTrigger>

        <TooltipContent side="right" className="max-w-72">
          <p className="text-xs font-medium text-foreground">{title}</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">{description}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{type}</p>
        </TooltipContent>
      </Tooltip>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggleFavourite(type)}
        aria-pressed={isFavourite}
        aria-label={
          isFavourite ? `Remove ${title} from favourites` : `Pin ${title} to favourites`
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
