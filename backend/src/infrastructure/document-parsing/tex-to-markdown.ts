type PandocConvert = (
  options: { from: string; to: string },
  stdin: string,
  files: Record<string, string>,
) => Promise<{
  stdout?: string;
  stderr?: string;
  warnings?: unknown;
  files?: unknown;
  mediaFiles?: unknown;
}>;

let pandocConvertPromise: Promise<PandocConvert> | null = null;

async function getPandocConvert(): Promise<PandocConvert> {
  if (pandocConvertPromise === null) {
    pandocConvertPromise = import("pandoc-wasm").then((mod) => mod.convert);
  }

  return pandocConvertPromise;
}

export type TexToMarkdown = (buffer: Buffer) => Promise<string>;

export async function texToMarkdown(buffer: Buffer): Promise<string> {
  try {
    const texString = buffer.toString("utf8");
    const convert = await getPandocConvert();
    const result = await convert({ from: "latex", to: "gfm" }, texString, {});
    return result.stdout ?? "";
  } catch (error) {
    throw new Error("Failed to convert TeX resume", { cause: error });
  }
}
