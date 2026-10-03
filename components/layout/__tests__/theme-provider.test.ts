// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  adoptThemeIfUnset,
} from "../theme-provider";

/**
 * The theme fix from QA Phase 2 (issue #4) had no test, because the suite runs in
 * a Node environment with no DOM. This file opts into jsdom for itself only — the
 * global environment stays `node`, so the "the engine is pure" signal is kept.
 *
 * These test the two pieces that actually run outside React: the inline bootstrap
 * script that sets the class before first paint, and `adoptThemeIfUnset`, which
 * decides whether a persisted file gets to choose the theme.
 */

const isDark = () => document.documentElement.classList.contains("dark");

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("THEME_INIT_SCRIPT — the anti-flash bootstrap", () => {
  const run = () => new Function(THEME_INIT_SCRIPT)();

  it("applies the stored light theme before first paint", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    run();

    expect(isDark()).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("applies the stored dark theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();

    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("defaults to dark for a first-time visitor", () => {
    run();

    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("treats a corrupt stored value as dark rather than crashing", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "chartreuse");
    run();

    expect(isDark()).toBe(true);
  });

  it("still lands on dark if localStorage throws", () => {
    // Private browsing can make getItem throw. The script must not leave <html>
    // unstyled, or the page flashes unthemed before React mounts.
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("denied");
    };
    try {
      expect(() => run()).not.toThrow();
      expect(isDark()).toBe(true);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe("adoptThemeIfUnset — a saved file may suggest a theme, never impose one", () => {
  it("applies the theme when this browser has no preference yet", () => {
    adoptThemeIfUnset("light");

    expect(isDark()).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
    // Recording it means the choice survives the next reload.
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("does not override a theme the user already chose here", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    document.documentElement.classList.add("dark");

    adoptThemeIfUnset("light");

    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("treats a corrupt stored value as an existing preference", () => {
    // Deliberately conservative: if we cannot read the preference, do not
    // overwrite whatever the bootstrap script already applied.
    localStorage.setItem(THEME_STORAGE_KEY, "nonsense");
    document.documentElement.classList.add("dark");

    adoptThemeIfUnset("light");

    expect(isDark()).toBe(true);
  });

  it("survives localStorage throwing", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("denied");
    };
    try {
      expect(() => adoptThemeIfUnset("light")).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
