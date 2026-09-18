// The editable SVG is the single source of truth. Use the already-installed
// Tauri renderer so regenerating the icon needs no additional dependencies.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const assets = join(root, "src", "assets");
const icons = join(root, "src-tauri", "icons");
const source = readFileSync(join(assets, "logo.svg"), "utf8");
const palette = new Map(
  [...source.matchAll(/(--mirror-[\w-]+):\s*(#[\da-fA-F]{6});/g)].map(
    ([, name, color]) => [name, color],
  ),
);

// The SVG keeps its neutral palette in CSS variables for editing/browser use.
// Resolve those variables for the native SVG renderer, which does not support
// custom properties. Unknown tokens must fail rather than render as black.
const resolved = source
  .replace(/var\((--mirror-[\w-]+)\)/g, (_, name) => {
    const color = palette.get(name);
    if (!color) throw new Error(`Undefined logo color: ${name}`);
    return color;
  })
  .replace(/<style>[\s\S]*?<\/style>/, "");

function render(input, output, sizes = []) {
  execFileSync(
    process.execPath,
    [cli, "icon", input, "--output", output, ...sizes.flatMap((size) => ["--png", String(size)])],
    { cwd: root, stdio: "inherit" },
  );
}

function verifyPng(file, size) {
  const png = readFileSync(file);
  if (
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    png.readUInt32BE(16) !== size ||
    png.readUInt32BE(20) !== size ||
    png[25] !== 6 // RGBA: corners must remain transparent, not baked onto white.
  ) {
    throw new Error(`Expected a ${size}×${size} RGBA PNG: ${file}`);
  }
}

function removeScratch(directory) {
  // Validate the absolute deletion target, including on Windows.
  if (dirname(directory) !== root || !basename(directory).startsWith(".tmp-icons-")) {
    throw new Error(`Refusing to remove an unexpected scratch directory: ${directory}`);
  }
  rmSync(directory, { recursive: true, force: true });
}

const scratch = mkdtempSync(join(root, ".tmp-icons-"));
try {
  const vector = join(scratch, "logo.svg");
  const raster = join(scratch, "raster");
  const bundles = join(scratch, "bundles");
  writeFileSync(vector, resolved);
  render(vector, raster, [1024, 256]);
  const master = join(raster, "1024x1024.png");
  const frontend = join(raster, "256x256.png");
  verifyPng(master, 1024);
  verifyPng(frontend, 256);
  render(master, bundles);
  verifyPng(join(bundles, "32x32.png"), 32);
  verifyPng(join(bundles, "128x128.png"), 128);
  verifyPng(join(bundles, "128x128@2x.png"), 256);

  // Mirror is desktop-only: do not commit the CLI's Android/iOS subdirectories.
  mkdirSync(icons, { recursive: true });
  for (const entry of readdirSync(bundles, { withFileTypes: true })) {
    if (entry.isFile() && /\.(png|ico|icns)$/.test(entry.name)) {
      copyFileSync(join(bundles, entry.name), join(icons, entry.name));
    }
  }
  // Tauri's default icon.png is smaller. Keep the actual 1024px master instead.
  copyFileSync(master, join(icons, "icon.png"));
  copyFileSync(frontend, join(assets, "logo.png"));
  console.log("Generated Mirror's 1024px master, 256px UI logo, and desktop icons.");
} finally {
  removeScratch(scratch);
}
