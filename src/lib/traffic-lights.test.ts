import { describe, expect, it } from "vitest";
import stylesheet from "../styles.css?raw";
import native from "../../src-tauri/src/lib.rs?raw";
import macosConfig from "../../src-tauri/tauri.macos.conf.json?raw";

/**
 * Guards the two numbers the stylesheet and the native window share.
 *
 * macOS paints the system's three window buttons itself, over Mirror's own
 * titlebar, so the stylesheet can neither take them away with the bar nor place
 * them in it. The fade lives in `lib.rs`, on the titlebar's clock; the position
 * lives in the macOS window config. Nothing links either pair at build time, and
 * both drifts are quiet: a fade 100ms out only shows to someone watching the
 * dots leave, and buttons centred for a 28pt titlebar look merely "a bit high"
 * in a 36px one — which is how this was noticed.
 */
const windowConfig = JSON.parse(macosConfig).app.windows[0];

describe("traffic lights", () => {
  it("fade on the titlebar's own clock", () => {
    const duration = /--dur-slow:\s*([\d.]+)s/.exec(stylesheet)?.[1];
    const fade = /TITLEBAR_FADE_SECONDS:\s*f64\s*=\s*([\d.]+)/.exec(native)?.[1];
    expect(duration, "no `--dur-slow` in the stylesheet").toBeDefined();
    expect(fade, "no `TITLEBAR_FADE_SECONDS` in lib.rs").toBeDefined();
    // The stylesheet may write `.24s` where Rust writes `0.24`.
    expect(Number(fade)).toBe(Number(duration));
  });

  it("sit in the middle of the titlebar", () => {
    const height = /--titlebar-height:\s*([\d.]+)px/.exec(stylesheet)?.[1];
    const inset = windowConfig.trafficLightPosition?.y;
    expect(height, "no `--titlebar-height` in the stylesheet").toBeDefined();
    expect(inset, "no `trafficLightPosition` in the macOS window config").toBeDefined();
    // macOS centres the stock buttons 14pt down its own 28pt titlebar (their
    // frame is (7, 6, 14, 16) in a view 28pt tall), and tao's inset puts that
    // centre at `inset + 2` — measured on the live window, see AGENTS.md. So
    // centring them in a bar `h` px tall is `h / 2 - 2`.
    expect(inset).toBe(Number(height) / 2 - 2);
  });
});
