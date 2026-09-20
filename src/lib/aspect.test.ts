import { describe, expect, it } from "vitest";
import stylesheet from "../styles.css?raw";

/**
 * Guards the layout half of "the picture is never cropped".
 *
 * The sizing half lives in `player.test.ts` / `fitted_size` in `lib.rs`: a window
 * Mirror sizes itself has the video's shape and therefore needs no bars. This
 * file covers what happens when the window is *not* that shape, which the user
 * can always produce by dragging an edge — `fitWindowToVideo` only runs on load,
 * and Tauri 2 / tao 0.35 expose no `set_aspect_ratio`, so nothing locks the drag.
 *
 * Then the picture must be letterboxed in full. A `<video>` is a replaced
 * element, and as a grid item of `.stage` its automatic minimum size is its
 * intrinsic size: with only `width/height: 100%` it stays as tall as the video,
 * overflows the stage, and `.stage { overflow: hidden }` cuts the top and bottom
 * off the picture. Widening the window did exactly that. `min-width: 0;
 * min-height: 0` drops the automatic minimum, which is what lets
 * `object-fit: contain` do its job — those two declarations are load-bearing, so
 * this test fails if either one disappears.
 *
 * Letterboxing is only enough if the stage itself fits in the window, which is
 * what the `.mirror-shell` min-size floors can break: the OS enforces the
 * window's minimum on the outer frame, so the client area at the drag stop is a
 * few px smaller than the 640x360 the layout is written for. A floor larger
 * than the viewport makes the shell taller than the window, `.stage` centres the
 * picture in the full box anyway, and the picture is pushed down and cropped —
 * with no `<video>` declaration involved. So the floors are checked here too.
 */

/** Declarations of one CSS block, keyed by property. */
function parseDeclarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const chunk of body.split(";")) {
    const [property, ...rest] = chunk.split(":");
    if (rest.length) map.set(property.trim(), rest.join(":").trim());
  }
  return map;
}

/** Declarations of one CSS rule, keyed by property. */
function declarations(css: string, selector: string): Map<string, string> {
  const rule = new RegExp(`(?:^|[},])\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "m").exec(css);
  expect(rule, `no \`${selector}\` rule in the stylesheet`).not.toBeNull();
  return parseDeclarations(rule![1]);
}

describe("video letterboxing", () => {
  it("lets the video shrink to the stage instead of overflowing it", () => {
    const video = declarations(stylesheet, ".video-element");
    expect(video.get("min-width")).toBe("0");
    expect(video.get("min-height")).toBe("0");
  });

  it("fits the whole picture inside whatever size the element gets", () => {
    const video = declarations(stylesheet, ".video-element");
    expect(video.get("width")).toBe("100%");
    expect(video.get("height")).toBe("100%");
    // `cover` crops and `fill` distorts; only `contain` letterboxes.
    expect(video.get("object-fit")).toBe("contain");
  });

  it("keeps the stage clipping the element rather than the picture", () => {
    expect(declarations(stylesheet, ".stage").get("overflow")).toBe("hidden");
    expect(declarations(stylesheet, ".mirror-shell").get("overflow")).toBe("hidden");
  });
});

describe("shell sizing", () => {
  it("bounds the shell's floors by the viewport", () => {
    // `min(px, 100%)`, not a bare px: the floor has to give way when the window
    // is smaller than the design minimum, which the drag stop always is.
    const shell = declarations(stylesheet, ".mirror-shell");
    expect(shell.get("min-width")).toBe("min(640px, 100%)");
    expect(shell.get("min-height")).toBe("min(360px, 100%)");
  });

  it("has no bare size floor on the shell anywhere, media queries included", () => {
    // A `min-height: 360px` hiding in a media query would break the picture just
    // as well as one in the main rule.
    const rules = [...stylesheet.matchAll(/\.mirror-shell\s*\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, body] of rules) {
      const decls = parseDeclarations(body);
      for (const property of ["min-width", "min-height"]) {
        const value = decls.get(property);
        if (value === undefined) continue;
        expect(value === "0" || /^min\(.*100%\)$/.test(value), `${property}: ${value}`).toBe(true);
      }
    }
  });
});
