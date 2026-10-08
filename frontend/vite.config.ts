import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In local development, /api goes to the backend on port 8000.
  server: { proxy: { "/api": "http://localhost:8000" } },
  // One small app: KaTeX and Recharts make a single ~800 kB bundle, which is fine.
  build: { chunkSizeWarningLimit: 1000 },
});
