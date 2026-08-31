import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: [
        "src/main.tsx",
        "src/i18n/locales/**",
        "src/components/ui/**",
        "src/test/**",
      ],
    },
  },
});
