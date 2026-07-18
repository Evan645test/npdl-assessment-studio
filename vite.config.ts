import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "course-ideation": path.resolve(__dirname, "course-ideation/index.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("@heyputer/puter.js")) return "puter";
        },
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "main"
            ? "assets/app.js"
            : "assets/[name].js",
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === "puter") return "assets/chunks/index.js";
          if (chunkInfo.name === "index") return "assets/chunks/shared.js";
          return "assets/chunks/[name].js";
        },
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css")
            ? "assets/index.css"
            : "assets/[name][extname]",
      },
    },
  },
});
