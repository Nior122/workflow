import { beforeEach, describe, expect, it } from "vitest";
import { filterPaletteNodes } from "../palette";
import { listNodeDefs } from "@/lib/engine/registry";
import { useUiStore } from "@/store/uiStore";

beforeEach(() => {
  useUiStore.setState({ favouriteNodes: [] });
});

describe("filterPaletteNodes", () => {
  const defs = listNodeDefs();

  it("returns all 14 node types grouped into 3 categories when the query is empty", () => {
    const result = filterPaletteNodes(defs, "", []);

    expect(result.total).toBe(14);
    expect(result.visible).toBe(14);
    expect(result.favourites).toEqual([]);
    expect(result.groups.map((group) => group.category)).toEqual([
      "trigger",
      "action",
      "output",
    ]);
  });

  it("matches by node title, description, type id, or category label", () => {
    const byTitle = filterPaletteNodes(defs, "AI Agent", []);
    expect(byTitle.visible).toBe(1);
    expect(byTitle.groups[0].defs[0].type).toBe("action.aiAgent");

    const byDescription = filterPaletteNodes(defs, "observation loops", []);
    expect(byDescription.groups.flatMap((group) => group.defs).map((d) => d.type)).toEqual([
      "action.aiAgent",
    ]);

    const byCategory = filterPaletteNodes(defs, "trigger", []);
    expect(byCategory.groups.map((group) => group.category)).toContain("trigger");
  });

  it("surfaces pinned favourites in palette order and filters them with the active query", () => {
    const pinned = filterPaletteNodes(defs, "", ["output.slack", "action.aiAgent"]);
    expect(pinned.favourites.map((def) => def.type)).toEqual([
      "action.aiAgent",
      "output.slack",
    ]);

    const filteredPinned = filterPaletteNodes(defs, "slack", [
      "output.slack",
      "action.aiAgent",
    ]);
    expect(filteredPinned.favourites.map((def) => def.type)).toEqual(["output.slack"]);
  });

  it("returns zero visible nodes for a query that matches nothing", () => {
    const empty = filterPaletteNodes(defs, "nonexistent-node-xyz", ["action.aiAgent"]);
    expect(empty.visible).toBe(0);
    expect(empty.favourites).toEqual([]);
    expect(empty.groups).toEqual([]);
  });
});

describe("uiStore favouriteNodes", () => {
  it("pins and unpins node types via toggleFavouriteNode", () => {
    const store = useUiStore.getState();
    store.toggleFavouriteNode("action.aiAgent");
    store.toggleFavouriteNode("trigger.webhook");

    expect(useUiStore.getState().favouriteNodes).toEqual([
      "action.aiAgent",
      "trigger.webhook",
    ]);

    useUiStore.getState().toggleFavouriteNode("action.aiAgent");
    expect(useUiStore.getState().favouriteNodes).toEqual(["trigger.webhook"]);
  });

  it("deduplicates entries passed to setFavouriteNodes", () => {
    useUiStore
      .getState()
      .setFavouriteNodes(["action.aiAgent", "output.slack", "action.aiAgent"]);

    expect(useUiStore.getState().favouriteNodes).toEqual([
      "action.aiAgent",
      "output.slack",
    ]);
  });
});
