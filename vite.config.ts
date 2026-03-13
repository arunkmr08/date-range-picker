import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/date-range-picker/" : "/",
  build: {
    outDir:       "dist",
    sourcemap:    true,
    rollupOptions: {
      output: {
        manualChunks: { vendor: ["react", "react-dom"] },
      },
    },
  },
  test: {
    globals:      true,
    environment:  "jsdom",
    setupFiles:   ["./src/test/setup.ts"],
    testTimeout:  15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
}));
