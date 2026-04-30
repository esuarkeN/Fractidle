import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("node_modules") === -1) return undefined;
          if (id.indexOf("pixi.js") >= 0 || id.indexOf("@pixi") >= 0) return "vendor-pixi";
          if (id.indexOf("@radix-ui") >= 0) return "vendor-radix";
          if (id.indexOf("lucide-react") >= 0) return "vendor-icons";
          if (id.indexOf("motion") >= 0) return "vendor-motion";
          if (id.indexOf("react-hot-toast") >= 0) return "vendor-toast";
          if (id.indexOf("react") >= 0 || id.indexOf("react-dom") >= 0 || id.indexOf("scheduler") >= 0) return "vendor-react";
          return undefined;
        },
      },
    },
  },
});
