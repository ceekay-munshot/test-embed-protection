import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static build for Cloudflare Pages. Everything in public/ (including the
// `_headers` embed-protection file) is copied verbatim into dist/.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
});
