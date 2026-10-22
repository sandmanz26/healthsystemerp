import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Relative base so the static build works from any path (GitHub Pages, a bucket, a zip).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@v2" is the frozen copy of the previous design served at /v2 for side-by-side comparison.
    alias: { "@v2": path.resolve(__dirname, "./v2/src"), "@": path.resolve(__dirname, "./src") },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: { main: path.resolve(__dirname, "index.html"), v2: path.resolve(__dirname, "v2/index.html") },
      output: {
        // Vendor code changes rarely; separate chunks keep feature chunks small and cacheable.
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react"
          if (/[\\/]node_modules[\\/](recharts|d3-[a-z]+|victory-vendor)[\\/]/.test(id)) return "charts"
          if (/[\\/]node_modules[\\/](@heroui|react-aria|react-aria-components|@react-aria|@react-stately|@react-types|@internationalized)[\\/]/.test(id)) return "ui"
        },
      },
    },
  },
})
