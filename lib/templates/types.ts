/**
 * The template gallery contract.
 *
 * Kept in its own module so both the core gallery (`index.ts`) and the showcase
 * content (`showcase.ts`) can depend on it without importing each other.
 */

import type { BuiltGraph } from "@/lib/graph-builder";

export type Template = {
  id: string;
  name: string;
  description: string;
  /** Short label shown on the gallery card. */
  category: string;
  /**
   * Lowercase discovery tags (`ai`, `logic`, `fintech`…). The gallery's tag filter
   * is built from the union of every template's tags, so adding a tag here is all
   * it takes to make it filterable.
   */
  tags: readonly string[];
  nodeCount: number;
  build: () => BuiltGraph;
};

/** Sort key for the tag chips: alphabetical, so the filter row never reshuffles. */
export function sortTags(tags: Iterable<string>): string[] {
  return [...new Set(tags)].sort((a, b) => a.localeCompare(b));
}

/**
 * Filter templates by tag and free-text query.
 *
 * `tag === null` means "All". The query matches name, description, category and
 * tags, so typing "fintech" finds templates that are only tagged — not titled —
 * with it.
 */
export function filterTemplates(
  templates: readonly Template[],
  options: { tag?: string | null; query?: string } = {},
): Template[] {
  const { tag = null, query = "" } = options;
  const needle = query.trim().toLowerCase();

  return templates.filter((template) => {
    if (tag && !template.tags.includes(tag)) return false;
    if (needle.length === 0) return true;

    return (
      template.name.toLowerCase().includes(needle) ||
      template.description.toLowerCase().includes(needle) ||
      template.category.toLowerCase().includes(needle) ||
      template.tags.some((entry) => entry.includes(needle))
    );
  });
}
