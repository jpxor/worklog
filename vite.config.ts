import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tauriConfig from "./src-tauri/tauri.conf.json" with { type: "json" };
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Bound jsdom workers to avoid memory/CPU contention on local and CI hosts.
  test: { maxWorkers: 2 },
  preview: {headers:{"Content-Security-Policy":tauriConfig.app.security.csp}},
  server: { watch: { ignored: ["**/src-tauri/**"] } },
});
