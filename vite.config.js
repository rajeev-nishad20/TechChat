import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(process.cwd(), "frontend"),
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "frontend/src")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/chat": "http://localhost:5000",
      "/config": "http://localhost:5000",
      "/health": "http://localhost:5000"
    }
  }
});
