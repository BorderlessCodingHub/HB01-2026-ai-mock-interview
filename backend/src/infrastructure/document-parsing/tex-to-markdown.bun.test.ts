import { describe, expect, test } from "bun:test";

import { texToMarkdown } from "./tex-to-markdown";

describe("texToMarkdown (live pandoc-wasm)", () => {
  test(
    "converts a minimal TeX document to GFM containing Jane Doe",
    async () => {
      const tex =
        "\\documentclass{article}\\begin{document}Jane Doe\\end{document}";
      const markdown = await texToMarkdown(Buffer.from(tex, "utf8"));

      expect(markdown.length).toBeGreaterThan(0);
      expect(markdown).toContain("Jane Doe");
    },
    { timeout: 60_000 },
  );
});
