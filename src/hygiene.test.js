import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Things that were removed on purpose and must not creep back (vitest runs from the project root).
const read = (path) => readFileSync(path, "utf8");

describe("removed dead code stays removed", () => {
  it("the demo client dataset (fabricated personal data) is not in the source", () => {
    expect(existsSync("src/data/demoClients.js")).toBe(false);
  });

  it("the unread VITE_GOOGLE_CLIENT_ID is in no config or documentation", () => {
    for (const file of [".env.example", ".env.production", "README.md", "Dockerfile", ".github/workflows/ci.yml"]) {
      expect(read(file), file).not.toContain("VITE_GOOGLE_CLIENT_ID");
    }
  });

  it("no source file reads an environment variable other than the API address", () => {
    const found = new Set();
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = `${dir}/${name}`;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\./.test(name))
          for (const m of read(path).matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) found.add(m[1]);
      }
    };
    walk("src");
    expect([...found]).toEqual(["VITE_API_URL"]);
  });

  it("the layout uses no utility class that Tailwind has no definition for (scrollbar-none)", () => {
    expect(read("src/components/Layout.jsx")).not.toContain("scrollbar-none");
  });

  it("the cancel-subscription API helper with no caller is gone", () => {
    expect(read("src/lib/api.js")).not.toContain("cancelSubscription");
  });
});
