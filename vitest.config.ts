import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // `src/styles.css` is imported by `src/lib/aspect.test.ts`, which guards the
    // one CSS rule that keeps the picture from being cropped. Vitest returns an
    // empty module for stylesheet imports unless CSS processing is on.
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
    },
  },
});