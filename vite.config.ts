import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tauriConfig from "./src-tauri/tauri.conf.json";
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  preview: {headers:{"Content-Security-Policy":tauriConfig.app.security.csp}},
  server: { watch: { ignored: ["**/src-tauri/**"] } },
});
