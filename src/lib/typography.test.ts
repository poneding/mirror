import { describe, expect, it } from "vitest";
import stylesheet from "../styles.css?raw";
import { DEFAULT_MONO_STACK, DEFAULT_SANS_STACK } from "./player";

/**
 * Guards the type scale.
 *
 * Two things are load-bearing here.
 *
 * Anything that *counts* — a timecode, the seek step, the playback speed, a
 * playlist number, a version, a shortcut key — takes the mono face, and it is
 * reached through `--font-mono` rather than a literal stack. `tabular-nums` only
 * equalises digit widths, and it was declared on five rules and nothing else, so
 * those values were rendered in the UI font and changed width as they counted.
 *
 * The sizes are the answer to "the settings panel and the playlist feel small":
 * the panel bodies had drifted down to 9–11px under a 16px panel title, which is
 * hard to read at Windows' 125%/150% display scaling. Everything below is
 * asserted as a floor, so the ladder can be raised without touching this file;
 * lowering one is a product decision and has to be argued for in the test.
 */

/** Every rule in the stylesheet, keyed by each of its selectors. First one wins. */
function rules(css: string): Map<string, Map<string, string>> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = new Map<string, Map<string, string>>();
  for (const [, selectors, body] of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Map<string, string>();
    for (const chunk of body.split(";")) {
      const [property, ...rest] = chunk.split(":");
      if (rest.length) declarations.set(property.trim(), rest.join(":").trim());
    }
    for (const selector of selectors.split(",")) {
      const key = selector.trim().replace(/\s+/g, " ");
      if (key && !found.has(key)) found.set(key, declarations);
    }
  }
  return found;
}

const sheet = rules(stylesheet);

/** One declaration of one rule, failing loudly instead of returning undefined. */
function value(selector: string, property: string): string | undefined {
  const declarations = sheet.get(selector);
  expect(declarations, `no \`${selector}\` rule in the stylesheet`).toBeDefined();
  return declarations!.get(property);
}

/** The declared `font-size` of one rule, as a number of px. */
function size(selector: string): number {
  const declared = value(selector, "font-size");
  expect(declared, `\`${selector}\` does not set font-size`).toBeDefined();
  expect(declared, `\`${selector}\` must use px`).toMatch(/^\d+px$/);
  return Number.parseFloat(declared!);
}

describe("fonts", () => {
  it("keeps the two faces in one place and reaches them through tokens", () => {
    expect(value(":root", "--font-sans")).toContain("system-ui");
    expect(value(":root", "--font-mono")).toContain("ui-monospace");
    // `Menlo` is macOS-only; without these Windows falls back to Courier New.
    expect(value(":root", "--font-mono")).toContain("Consolas");
    // The base face goes through the token, or the two can drift apart.
    expect(value(":root", "font-family")).toBe("var(--font-sans)");
  });

  it("keeps the stylesheet stacks identical to the ones the font settings build on", () => {
    // A chosen font is applied as `"Chosen", <default stack>`, with the default
    // spelled out in player.ts. If the stylesheet copy changes there, the
    // fallback after a chosen font silently stops matching the no-choice case.
    expect(value(":root", "--font-sans")).toBe(DEFAULT_SANS_STACK);
    expect(value(":root", "--font-mono")).toBe(DEFAULT_MONO_STACK);
  });

  it("sets everything that counts in the mono face", () => {
    for (const selector of [
      ".num",
      "kbd",
      ".time-label",
      ".tabs-count",
      ".playlist-index",
      ".osd",
      ".dialog-version",
      ".update-status strong",
      ".combobox.chrome .combobox-trigger",
      ".combobox.chrome .combobox-option",
      ".changelog code",
    ]) {
      expect(value(selector, "font-family"), selector).toBe("var(--font-mono)");
    }
  });

  it("leaves the labels alone", () => {
    // Theme and language are words, and the release notes are prose. Only the
    // transport bar's speed dropdown holds values.
    expect(value(".combobox-option", "font-family")).toBeUndefined();
    expect(value(".combobox-trigger", "font-family")).toBeUndefined();
    expect(value(".changelog p", "font-family")).toBeUndefined();
    expect(value(".setting-row-label", "font-family")).toBeUndefined();
  });

  it("keeps the panel bodies readable", () => {
    for (const selector of [
      ".setting-row-label",
      ".setting-label",
      ".setting-label strong",
      ".toggle-row",
      ".shortcut-row",
      ".update-status",
      ".update-status strong",
      ".playlist-name strong",
      ".playlist-name small",
      ".tabs-trigger",
      ".changelog p",
      ".changelog ul",
      ".changelog ol",
      ".dialog-lead",
    ]) {
      expect(size(selector), selector).toBeGreaterThanOrEqual(11);
    }
  });

  it("never sets type below 10px", () => {
    const sizes = [...stylesheet.matchAll(/font-size:\s*([^;]+);/g)].map(([, declared]) => declared.trim());
    expect(sizes.length).toBeGreaterThan(20);
    for (const declared of sizes) {
      expect(declared, "font-size must be px so the floor is checkable").toMatch(/^\d+px$/);
      expect(Number.parseFloat(declared), `font-size: ${declared}`).toBeGreaterThanOrEqual(10);
    }
  });
});
