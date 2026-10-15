import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  build: { outDir: "dist" },
  server: { proxy: { "/api": "http://localhost:3001" } }
});
