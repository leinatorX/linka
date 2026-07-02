import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://localhost:3030"
    }
  },
  build: {
    outDir: "../../dist/public",
    emptyOutDir: true
  }
});
