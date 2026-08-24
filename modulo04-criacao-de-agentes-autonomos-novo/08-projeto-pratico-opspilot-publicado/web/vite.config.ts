/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Keep in sync with `src/base.ts`. */
export const VITE_BASE = "/opspilot/";

export default defineConfig({
  plugins: [react()],
  base: VITE_BASE,
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    css: true,
  },
});
