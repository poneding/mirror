#!/usr/bin/env node
// Stamps the release version into every file that carries it.
//
// The git tag is the source of truth for a release (`v1.2.3`), so the release
// workflow runs this instead of keeping four literals in step by hand:
//
//   package.json               the JS package version
//   package-lock.json          npm's record of the above
//   src-tauri/tauri.conf.json  the version Tauri bakes into the bundles
//   src-tauri/Cargo.toml       CARGO_PKG_VERSION
//
// src-tauri/Cargo.lock is deliberately left alone: the next cargo build
// rewrites the `mirror` entry on its own. Existing formatting is preserved —
// the fields are replaced in place, not re-serialised.
//
// Usage: node scripts/set-version.mjs v1.2.3
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const raw = process.argv[2] ?? "";
const version = raw.startsWith("v") ? raw.slice(1) : raw;

if (!SEMVER.test(version)) {
  console.error(
    `set-version: "${raw}" is not SemVer. Pass the release tag, for example v1.2.3 or v1.2.3-rc.1.`,
  );
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function write(relativePath, before, next) {
  const changed = before !== next;
  if (changed) {
    writeFileSync(join(root, relativePath), next);
  }
  console.log(`${changed ? "updated" : "unchanged"}  ${relativePath}`);
}

/**
 * Replaces the leading `"version": "…"` fields — the ones belonging to the
 * document itself, not to a dependency further down — and parses the result
 * back to prove the field landed where it should.
 */
function stampJson(relativePath, fields, verify) {
  const before = readFileSync(join(root, relativePath), "utf8");
  let written = 0;
  const next = before.replace(/"version": "[^"]*"/g, (match) =>
    written++ < fields ? `"version": "${version}"` : match,
  );
  if (!verify(JSON.parse(next))) {
    throw new Error(`set-version: could not stamp the version into ${relativePath}`);
  }
  write(relativePath, before, next);
}

function stampCargoToml(relativePath) {
  // The first `version = "…"` line belongs to [package]; dependency versions
  // are inline tables or live further down.
  const pattern = /^version = "[^"]*"\r?$/m;
  const before = readFileSync(join(root, relativePath), "utf8");
  if (!pattern.test(before)) {
    throw new Error(`set-version: no package version found in ${relativePath}`);
  }
  write(relativePath, before, before.replace(pattern, `version = "${version}"`));
}

stampJson("package.json", 1, (pkg) => pkg.version === version);
stampJson(
  "package-lock.json",
  2,
  (lock) => lock.version === version && lock.packages[""].version === version,
);
stampJson("src-tauri/tauri.conf.json", 1, (config) => config.version === version);
stampCargoToml("src-tauri/Cargo.toml");

console.log(`mirror ${version}`);
