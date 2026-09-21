import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    // Tauri's default is 1420 for every project, which collides as soon as a
    // second Tauri app is debugged at the same time. Keep this in step with
    // `build.devUrl` in src-tauri/tauri.conf.json.
    port: 6477,
    strictPort: true,
    host: "0.0.0.0"
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false
  }
});
