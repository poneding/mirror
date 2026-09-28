import { describe, expect, it } from "vitest";
import config from "../../src-tauri/tauri.conf.json";
import native from "../../src-tauri/src/media.rs?raw";
import { MEDIA_SCHEME, parseHistory } from "./player";

describe("media protocol integration", () => {
  it("allows the registered media protocol without restoring the retired asset protocol", () => {
    expect(native).toContain(`pub const SCHEME: &str = "${MEDIA_SCHEME}";`);
    const sources = config.app.security.csp["media-src"].split(/\s+/);
    expect(sources).toContain(`${MEDIA_SCHEME}:`);
    expect(sources).toContain(`http://${MEDIA_SCHEME}.localhost`);
    expect(sources).toContain(`https://${MEDIA_SCHEME}.localhost`);
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
    expect(config.app.security).not.toHaveProperty("assetProtocol");
  });

  it("both migrates old history sources and removes expired blob entries", () => {
    const history = parseHistory(JSON.stringify([
      { id: "old", source: "http://asset.localhost/C%3A%5Cfilm.mp4", position: 42 },
      { id: "expired", source: "blob:http://localhost/expired", position: 10 },
    ]));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: "old", source: "http://media.localhost/C%3A%5Cfilm.mp4", position: 42,
    });
  });
});
