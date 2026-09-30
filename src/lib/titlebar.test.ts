import { describe, expect, it } from "vitest";
import app from "../App.tsx?raw";
import stylesheet from "../styles.css?raw";
import capability from "../../src-tauri/capabilities/default.json";

/** CSS drag regions send false mouse-leave events in WebView2. The shell
 * hides on leave and reveals on movement, causing both bars to flicker.
 * Tauri's explicit drag-region attribute handles dragging without that loop. */
describe("titlebar dragging", () => {
  it("does not turn the titlebar into a CSS native drag region", () => {
    const css = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
    const nativeRegions = [...css.matchAll(/(?:-webkit-)?app-region\s*:\s*drag\s*(?:!important\s*)?[;}]/g)];
    expect(nativeRegions.map(([declaration]) => declaration)).toEqual([]);
  });

  it("keeps the titlebar's Tauri drag region and permission", () => {
    expect(app).toMatch(/<header\b[^>]*data-tauri-drag-region="true"/);
    expect(capability.permissions).toContain("core:window:allow-start-dragging");
  });
});
