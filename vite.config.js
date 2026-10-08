import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    // The API client reads this at import time; tests talk to the mock server at this address.
    env: { VITE_API_URL: "http://api.test" },
    css: false,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**", "src/**/*.test.{js,jsx}", "src/data/**"],
      // A floor, not a goal: set just under what the first real tests cover, so coverage can only go up.
      // Raise it as tests are added (see README, "Testing").
      thresholds: { statements: 4, branches: 40, functions: 10, lines: 4 },
    },
  },
});
