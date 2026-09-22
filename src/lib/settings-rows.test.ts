import { describe, expect, it } from "vitest";
import stylesheet from "../styles.css?raw";

/**
 * Guards the one-row template of the settings panel.
 *
 * The five sections had drifted into five rhythms: 外观 and 关于 sat at 8px,
 * 快捷键 at 6px, the 更新 toggles at 16px, and 播放 mixed all three — the same
 * kind of row looked like a different control depending on which section it
 * happened to be in. The rows now share one template (`.setting-row`,
 * `.setting-label`, `.toggle-row`, `.shortcut-row`, `.about-row`) and one
 * rhythm rule on `.setting-section`, so a section cannot space or size itself
 * again without failing here.
 */

const ROW_CLASSES = [".setting-row", ".setting-label", ".toggle-row", ".shortcut-row", ".about-row"];

/** Every rule in the stylesheet, with its selector list split apart. */
function rules(css: string): { selectors: string[]; declarations: Map<string, string> }[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => {
    const declarations = new Map<string, string>();
    for (const chunk of body.split(";")) {
      const [property, ...rest] = chunk.split(":");
      if (rest.length) declarations.set(property.trim(), rest.join(":").trim());
    }
    return { selectors: selectors.split(",").map((selector) => selector.trim().replace(/\s+/g, " ")), declarations };
  });
}

const sheet = rules(stylesheet);
const rowRules = sheet.filter((rule) => rule.selectors.some((selector) => ROW_CLASSES.includes(selector)));

describe("settings rows", () => {
  it("gives every row the same template", () => {
    const template = sheet.find((rule) => ROW_CLASSES.every((selector) => rule.selectors.includes(selector)));
    expect(template, "the row template rule is gone").toBeDefined();
    const declarations = template!.declarations;
    expect(declarations.get("display")).toBe("flex");
    expect(declarations.get("align-items")).toBe("center");
    expect(declarations.get("justify-content")).toBe("space-between");
    expect(declarations.get("gap")).toBe("12px");
    expect(declarations.get("margin")).toBe("0");
    expect(declarations.get("font-size")).toBe("11px");
  });

  it("keeps the rhythm in the section, never in the row", () => {
    for (const rule of rowRules) {
      for (const property of ["margin", "margin-top", "margin-bottom"]) {
        const value = rule.declarations.get(property);
        if (value === undefined) continue;
        expect(value, `${rule.selectors.join(", ")} sets ${property}`).toBe("0");
      }
    }
  });

  it("steps rows one gap apart and a control's block a wider one", () => {
    const rhythm = sheet.find((rule) => rule.selectors.includes(".setting-section>*+*"));
    expect(rhythm?.declarations.get("margin-top")).toBe("var(--gap-row)");
    const blocks = sheet.find((rule) => rule.selectors.includes(".setting-section>.range-setting") && rule.selectors.includes(".setting-section>.setting-group"));
    expect(blocks?.declarations.get("margin-top")).toBe("var(--gap-control)");
  });
});
