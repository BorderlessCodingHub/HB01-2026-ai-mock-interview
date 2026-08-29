import { beforeEach, describe, expect, it, vi } from "vitest";

const { convertMock } = vi.hoisted(() => ({
  convertMock: vi.fn(),
}));

vi.mock("pandoc-wasm", () => ({
  convert: convertMock,
}));

import { texToMarkdown } from "./tex-to-markdown";

describe("texToMarkdown", () => {
  beforeEach(() => {
    convertMock.mockReset();
    convertMock.mockResolvedValue({ stdout: "# Converted\n" });
  });

  it("passes UTF-8 TeX as stdin with latex→gfm and empty files", async () => {
    const tex = "\\documentclass{article}\\begin{document}Café\\end{document}";

    await texToMarkdown(Buffer.from(tex, "utf8"));

    expect(convertMock).toHaveBeenCalledOnce();
    expect(convertMock).toHaveBeenCalledWith(
      { from: "latex", to: "gfm" },
      tex,
      {},
    );
  });

  it("returns stdout when warnings and stderr are present", async () => {
    convertMock.mockResolvedValue({
      stdout: "# Jane Doe\n",
      stderr: "pandoc warning on stderr",
      warnings: ["unused package"],
    });

    await expect(
      texToMarkdown(Buffer.from("\\begin{document}Jane\\end{document}", "utf8")),
    ).resolves.toBe("# Jane Doe\n");
  });

  it("throws a clean message when convert throws", async () => {
    convertMock.mockRejectedValue(
      new Error("WASM instantiate failed\n    at wasm://wasm/001"),
    );

    const error = await texToMarkdown(Buffer.from("\\bad", "utf8")).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Failed to convert TeX resume");
    expect((error as Error).message).not.toContain("WASM instantiate failed");
    expect((error as Error).message).not.toContain("wasm://wasm/001");
  });

  it("returns an empty string when stdout is undefined", async () => {
    convertMock.mockResolvedValue({
      stdout: undefined,
      stderr: "note",
      warnings: ["empty"],
    });

    await expect(texToMarkdown(Buffer.from("% empty", "utf8"))).resolves.toBe(
      "",
    );
  });
});
