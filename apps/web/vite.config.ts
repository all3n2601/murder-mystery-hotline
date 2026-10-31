import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The mic worklet is loaded with audioWorklet.addModule, which needs an ES module.
  worker: { format: "es" },
  server: {
    proxy: {
      "/game": { target: "ws://localhost:8787", ws: true },
      "/cases": { target: "http://localhost:8787" },
    },
  },
});
