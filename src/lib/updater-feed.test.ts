import { describe, expect, it } from "vitest";
import workflow from "../../.github/workflows/release.yml?raw";

/**
 * Guards the updater feed against the API URLs tauri-action v1 writes.
 *
 * tauri-action switched `latest.json` to
 * `api.github.com/repos/.../releases/assets/<id>` for private-repo support, and
 * GitHub rate-limits unauthenticated API downloads to 60 an hour per IP. On a
 * public repo that is "Download request failed with status: 403 Forbidden" for
 * every install — v0.1.0-alpha.5 shipped that way, and it was reproduced
 * against the live asset: HTTP 403 with `x-ratelimit-remaining: 0` on the API
 * URL, HTTP 200 with the full 4.89 MB on the CDN URL for the same file. The
 * action has no input to turn the API form off, so the workflow's
 * `updater-feed` job rewrites the feed after every build has uploaded its own,
 * and this file fails if that job stops doing any of it.
 */

/** One job of the workflow, from its key to the next key at the same indent. */
function job(name: string): string {
  const start = workflow.search(new RegExp(`^  ${name}:$`, "m"));
  expect(start, `no \`${name}\` job in the release workflow`).toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const end = rest.search(/^ {2}[a-z][a-z0-9-]*:$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe("updater feed", () => {
  const feed = job("updater-feed");

  it("rewrites the feed once every build has uploaded its own", () => {
    // The build jobs each upload a `latest.json` of their own, so a rewrite
    // that ran beside them would be overwritten by the next upload.
    expect(feed).toMatch(/^ {4}needs: build$/m);
  });

  it("maps the API asset URL to the release's own download URL", () => {
    // Recognises the shape tauri-action writes...
    expect(feed).toContain("releases/assets/");
    // ...and replaces it with the URL the CDN serves without an API call.
    expect(feed).toContain("releases/download/");
  });

  it("fails the release instead of shipping a feed that still 403s", () => {
    expect(feed).toContain('"api.github.com"');
    expect(feed).toContain('"/null$"');
    expect(feed).toMatch(/exit 1/);
  });

  it("uploads the rewritten feed back to the release", () => {
    expect(feed).toMatch(/gh release upload .*latest\.json/);
  });
});
