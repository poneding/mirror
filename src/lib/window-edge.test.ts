import { describe, expect, it } from "vitest";
import config from "../../src-tauri/tauri.conf.json?raw";
import native from "../../src-tauri/src/lib.rs?raw";

/**
 * Guards the two settings that keep macOS from drawing a white edge around the
 * window.
 *
 * Neither is cosmetic preference: both were measured on the live window, and
 * both fail quietly. The window's edge highlight is part of its shadow, drawn
 * above the page — a black shell does not cover it — so it shows wherever the
 * picture is dark, which is exactly the state Mirror is in once the chrome has
 * hidden itself (a keyboard close leaves the bars away with the pointer outside
 * the window). Measured over a black picture it was one device pixel of white at
 * about 10% alpha down the left, right and bottom edges, and two brighter pixels
 * across the top.
 *
 * Dropping the shadow removes the three sides. The top pair is the transparent
 * titlebar's own highlight, and it is why `macOSPrivateApi` must stay on: with a
 * genuinely transparent window the page composites over that highlight, while an
 * opaque window leaves it on top. Turn either setting off and the border comes
 * back — which is the whole reason this file exists.
 */
const windowConfig = JSON.parse(config).app;

describe("macOS window edge", () => {
  it("keeps the window transparent, so the titlebar highlight sits under the page", () => {
    expect(windowConfig.macOSPrivateApi).toBe(true);
  });

  it("keeps the macOS shadow off, so the window rim is not drawn", () => {
    // The call lives in the macOS `apply_glass`, next to the vibrancy that
    // supplies the home screen's blur; that function is the only place the
    // window is set up.
    const macos = /#\[cfg\(target_os = "macos"\)\]\s*fn apply_glass[\s\S]*?\n}/.exec(native)?.[0];
    expect(macos, "no macOS `apply_glass` in lib.rs").toBeDefined();
    expect(macos).toContain("set_shadow(false)");
  });
});
