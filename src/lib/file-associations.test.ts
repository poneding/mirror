import { describe, expect, it } from "vitest";
import config from "../../src-tauri/tauri.conf.json?raw";
import { SUPPORTED_VIDEO_EXTENSIONS } from "./player";

/**
 * Guards the file associations against the extensions the player opens.
 *
 * `bundle > fileAssociations` is what the NSIS installer turns into registry
 * entries, so a video type missing here never reaches the system's "open with"
 * list — and one that is there but unknown to the player is a file Mirror
 * cannot open at all: the association hands it over as `%1` and the playlist
 * filter drops it. The list is necessarily written down twice (the installer
 * reads JSON, the player reads TypeScript), so the two are kept in step by
 * failing here instead of trusting whoever edits one of them.
 */
describe("file associations", () => {
  const { fileAssociations } = JSON.parse(config).bundle;

  it("register exactly the extensions the player opens", () => {
    expect(fileAssociations).toBeTruthy();
    const registered = fileAssociations.flatMap((association: { ext: string[] }) => association.ext);
    expect(new Set(registered)).toEqual(new Set(SUPPORTED_VIDEO_EXTENSIONS));
  });

  it("give each extension one association of its own", () => {
    // Two entries for one extension would both claim it: the installer writes
    // them in turn, and the last one wins the extension's default handler.
    const registered = fileAssociations.flatMap((association: { ext: string[] }) => association.ext);
    expect(registered.length).toBe(new Set(registered).size);
  });
});
